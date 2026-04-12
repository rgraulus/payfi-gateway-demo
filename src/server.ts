// src/server.ts
//
// Phase B (real): Concordium PLT proof payload verification.
// - Verify JWS signature via facilitator JWKS (already done)
// - THEN require receipt payload to be a valid ccd-plt-proof@v1,
//   bound to the resolved frozen contract + nonce + amountRaw, and finalized.
//
// Supports both:
// 1) local resource mode: GET /paid
// 2) edge gateway/proxy mode: /x402/... forwards to upstream after verified payment
//
// C3/C4: NEVER emit PAYMENT-RESPONSE unless receipt verify + proof payload checks succeed.
// M1 hardening: In proxy mode, only emit PAYMENT-RESPONSE if upstream returns 2xx.
//
// DEV-ONLY PAID-PATH HARNESS (hardened; off by default):
// - Requires X402_ALLOW_DEV_HARNESS=true AND NODE_ENV != production
// - If enabled and a dev receipt is provided, we skip CRP calls and use that receipt JWS.
// - Still requires local JWKS verification + proof payload validation.
//
// OPTIONAL HARDENING:
// - When X402_ALLOW_DEV_HARNESS=true, /healthz includes non-secret dev receipt metadata:
//   jwksUrl, receipt sha256 prefix, kid, iat/exp — but NEVER the full receipt JWS.
//
// Phase C:
// - Deterministic tuple key + replay protection
// - Enforce replay protection immediately after verifyAndValidateProof succeeds.
// - Tuple key intentionally ignores query params to prevent replay bypass via decoration/reorder.
//
// Phase C.1 Hardening:
// - Replay expiry uses the tightest bound:
//     expSec = min(receipt.exp, proof.settlement.expiresAt, paymentRequired.expiresAt, now+ttlSec)
// - If derived expSec <= nowSec, treat it as expired and 402 (never emit PAYMENT-RESPONSE).
//
// Phase E:
// - Redis replay backend OPTIONAL at runtime with NO compile-time dependency.
// - No top-level `import 'redis'` (server must start even if redis isn’t installed).
// - Select replay backend via X402_REPLAY_BACKEND=memory|redis (default: memory).
// - If redis backend is selected and package isn’t installed, fail fast with clear error.
//
// M2:
// - Explicit pending/non-finalized settlement semantics:
//   If a receipt verifies but settlement is not finalized (e.g., pending), return 402 with:
//   - PAYMENT-REQUIRED present
//   - NO PAYMENT-RESPONSE
//   - JSON body reason="pending_settlement" + settlement metadata
//   - Optional Retry-After / retryAfterSec hint
//
// M2 tweak:
// - Even if validateCcdPltProofAgainstContract does NOT throw on pending settlement,
//   we still hard-stop after successful verify+validate if settlement is not finalized.
//   (Prevents pending receipts from being treated as paid.)
//
// M4 (ONLY changes in this file vs M3):
// - Add optional per-request dev receipt injection via header: X402-DEV-RECEIPT-JWS
// - Prefer header receipt over env receipt (when dev harness allowed + not prod)
// - Allow the header in CORS (only when dev harness allowed + not prod)
// - Strip the header before proxying upstream
// - Keep replyPendingFromVerifiedProof guard EXACTLY as-is (no M2 regression)
//
// M5 (Commit 1):
// - Capture raw request bytes for POST/PUT/PATCH and plumb sha256(rawBodyBytes) into tupleKey
// - No behavior change for GET and no change to pending/finalized semantics.
//
// PATCH (this file):
// - Fix root-cause “nonce treadmill”:
//   If the client sends a receipt (via `x402-receipt: <JWS>` OR inside PAYMENT-SIGNATURE JSON),
//   we verify it locally, take the nonce FROM THE VERIFIED RECEIPT payload,
//   and serve 200 without calling CRP match/fulfill.
// - Keep CRP flow for clients that don’t provide a receipt (classic 402 -> pay -> fulfill -> 200).
//
// NEW (this patch):
// - Compile contracts registry at startup to support exact + prefix-wildcard matching (e.g. /paid/*)
// - Exact matches still win; existing /premium scripts remain unaffected.
//
// M0.5:
// - Introduce ContractResolver abstraction so server.ts no longer owns
//   loadContracts()/compileContracts()/resolveContractFromRegistry() directly.
// - Current implementation remains file-backed via FileContractResolver.

import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID, createHash } from 'crypto';

import { CrpClient, MatchPaymentRequest } from './crpClient';
import { buildPaymentRequiredPayload, b64jsonHeader, ContractDefinition } from './contracts';
import { FileContractResolver } from './contractResolver';
import type { ContractResolver } from './contractResolver';
import {
  completePolicyEvaluationByNonce,
  completeReleaseByNonce,
  completeSettlementEntryByNonce,
  completeSettlementOutcomeByNonce,
  completeSourceVerificationByNonce,
  getChallengeStatusByNonce,
  persistIssuedChallenge,
  transitionChallengeStateByNonce,
} from './db/gatewayPersistence';

import type { ContractBinding, HttpMethod } from './proofPayload';
import {
  assertCcdPltProofV1,
  validateCcdPltProofAgainstContract,
  ProofPayloadError,
} from './proofPayload';

// Replay modules
import { buildTupleKey } from './x402/tupleKey';
import { ReplayCache } from './x402/replayCache';
import { receiptSha12 as receiptSha12Fingerprint } from './x402/receiptFingerprint';

// -----------------------------------------------------------------------------
// Raw body capture (M5 Commit 1)
// -----------------------------------------------------------------------------

type RawBodyRequest = express.Request & {
  rawBody?: Buffer;
};

function isBodyBoundMethod(method: string): boolean {
  const m = String(method || '').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH';
}

function sha256HexBytes(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

const app = express();

// Capture raw request bytes during JSON parsing.
// NOTE: this runs only for requests handled by bodyParser.json() (content-type based).
app.use(
  bodyParser.json({
    verify: (req, _res, buf) => {
      // Stash raw bytes for tupleKey body binding (POST/PUT/PATCH).
      // We intentionally store bytes (not string) to avoid encoding drift.
      (req as RawBodyRequest).rawBody = Buffer.isBuffer(buf) ? Buffer.from(buf) : Buffer.alloc(0);
    },
  }),
);

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const host = String(process.env.HOST ?? 'localhost'); // host dev default; Docker sets HOST=0.0.0.0
const port = Number(process.env.PORT ?? 3005);

const crpBaseUrl = (process.env.CRP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const jwksUrl = process.env.CRP_JWKS_URL ?? `${crpBaseUrl}/.well-known/jwks.json`;

const orchestratorBaseUrl =
  (process.env.ORCHESTRATOR_BASE_URL ?? 'http://localhost:8090').replace(/\/$/, '');
const orchestratorApiKey = process.env.ORCHESTRATOR_API_KEY ?? 'dev-internal-key';

const expectedKid = process.env.X402_EXPECTED_KID;

const x402Debug = String(process.env.X402_DEBUG ?? '').toLowerCase() === 'true';
const legacyHeaders = String(process.env.X402_LEGACY_HEADERS ?? '').toLowerCase() === 'true';

const ttlSec = Number(process.env.X402_TTL_SEC ?? 300);
const contractsPath = process.env.X402_CONTRACTS_PATH ?? 'config/contracts.json';

// Replay backend selection (Phase E)
const replayBackend = String(process.env.X402_REPLAY_BACKEND ?? 'memory').toLowerCase(); // memory|redis
const replayRedisUrl = process.env.X402_REDIS_URL ?? process.env.REDIS_URL ?? null;
const replayRedisKeyPrefix = process.env.X402_REDIS_KEY_PREFIX ?? 'x402:replay:';

// ----------------------------------------------------------------------------
// DEV HARNESS HARDENING
// ----------------------------------------------------------------------------
const allowDevHarness = String(process.env.X402_ALLOW_DEV_HARNESS ?? '').toLowerCase() === 'true';
const isProd = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';

const devReceiptJwsRaw = process.env.X402_DEV_RECEIPT_JWS ?? null;

// Require client to send PAYMENT-SIGNATURE even in dev bypass (keeps flow realistic)
const devReceiptRequiresPaymentSignature =
  String(process.env.X402_DEV_RECEIPT_REQUIRE_SIG ?? 'true').toLowerCase() === 'true';

// Harden: dev harness only when explicitly allowed AND not production
const devReceiptJws =
  allowDevHarness && !isProd && devReceiptJwsRaw && devReceiptJwsRaw.length > 0
    ? devReceiptJwsRaw
    : null;

// M4: per-request dev receipt injection header (only honored when allowDevHarness && !isProd)
const DEV_RECEIPT_HEADER = 'x402-dev-receipt-jws';

// PATCH: allow a “direct receipt JWS” header for real clients (matches what you were sending).
// This is NOT a dev-only feature; it is the cleanest interop path for curl/harnesses.
const DIRECT_RECEIPT_HEADER = 'x402-receipt';

// Load contracts once at startup via resolver (fail fast if frozen mismatch)
let contractResolver: ContractResolver;
let contracts: ContractDefinition[] = [];

try {
  contractResolver = new FileContractResolver(contractsPath);
  contracts = contractResolver.list();

  console.log(`[contracts] loaded ${contracts.length} contract(s) from ${contractsPath}`);
  for (const c of contracts) {
    console.log(
      `[contracts] ${c.resource.method.toUpperCase()} ${c.resource.path} -> ${c.contractId} (v${c.contractVersion}, frozen=${c.isFrozen}, mode=${c.mode ?? 'local'})`,
    );
  }
} catch (e: any) {
  console.error(`[contracts] ERROR: ${String(e?.message ?? e)}`);
  process.exit(1);
}

const crpClient = new CrpClient({ baseUrl: crpBaseUrl });

// -----------------------------------------------------------------------------
// CORS + no-store headers
// -----------------------------------------------------------------------------

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // M4: if dev harness is allowed (and not prod), allow the injection header in CORS preflight.
  const extraDevHeader = allowDevHarness && !isProd ? `,${DEV_RECEIPT_HEADER.toUpperCase()}` : '';

  // PATCH: allow the direct receipt header in CORS for convenience.
  const extraReceiptHeader = `,${DIRECT_RECEIPT_HEADER.toUpperCase()}`;

  res.setHeader(
    'Access-Control-Allow-Headers',
    legacyHeaders
      ? `Content-Type,PAYMENT-SIGNATURE,X-PAYMENT-SIGNATURE${extraDevHeader}${extraReceiptHeader}`
      : `Content-Type,PAYMENT-SIGNATURE${extraDevHeader}${extraReceiptHeader}`,
  );

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  const exposed = ['PAYMENT-REQUIRED', 'PAYMENT-SIGNATURE', 'PAYMENT-RESPONSE'];
  if (legacyHeaders) exposed.push('X-PAYMENT-REQUIRED', 'X-PAYMENT-SIGNATURE', 'X-PAYMENT-RESPONSE');

  res.setHeader('Access-Control-Expose-Headers', exposed.join(','));

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  next();
});

// IMPORTANT: In express/router stack with path-to-regexp v6, '*' throws.
// Use a regex to match all paths for OPTIONS preflight.
app.options(/.*/, (_req, res) => res.status(204).end());

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function b64json(obj: unknown): string {
  // Spec/client interop: use standard base64 (not base64url) for header payloads.
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

async function sendIntentToOrchestrator(input: {
  challengeId: string;
  contract: ContractDefinition;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}) {
  try {
    const res = await fetch(`${orchestratorBaseUrl}/internal/payments/intents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': orchestratorApiKey,
      },
      body: JSON.stringify({
        challengeId: input.nonce,
        merchantId: input.contract.merchantId,
        nonce: input.nonce,
        network: input.contract.network,
        asset: input.contract.asset,
        amount: input.contract.amount,
        payTo: input.contract.payTo,
        resource: input.contract.resource,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      }),
    });

    if (!res.ok) {
      console.warn('[orchestrator] intent call failed:', res.status);
    }
  } catch (err) {
    console.warn('[orchestrator] intent call error:', err);
  }
}


async function sendProofToOrchestrator(input: {
  challengeId: string;
  nonce: string;
  proofType: string;
  proofPayload: unknown;
}) {
  try {
    const res = await fetch(`${orchestratorBaseUrl}/internal/payments/proof`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': orchestratorApiKey,
      },
      body: JSON.stringify({
        challengeId: input.nonce,
        proofType: input.proofType,
        proofPayload: input.proofPayload,
      }),
    });

    if (!res.ok) {
      console.warn('[orchestrator] proof call failed:', res.status);
    }
  } catch (err) {
    console.warn('[orchestrator] proof call error:', err);
  }
}


async function sendReleaseCheckToOrchestrator(input: {
  challengeId: string;
  nonce: string;
}) {
  try {
    const res = await fetch(`${orchestratorBaseUrl}/internal/payments/release-check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': orchestratorApiKey,
      },
      body: JSON.stringify({
        challengeId: input.nonce,
      }),
    });

    if (!res.ok) {
      console.warn('[orchestrator] release-check call failed:', res.status);
      return;
    }

    const data = await res.json().catch(() => null);

    if (data && data.ready === false) {
      console.warn('[orchestrator] release-check advisory not ready:', {
        challengeId: input.nonce,
        reason: data.reason ?? null,
      });
    }
  } catch (err) {
    console.warn('[orchestrator] release-check call error:', err);
  }
}

function normalizeB64(b64: string): string {
  // Tolerate base64url inputs (from some clients), and missing padding.
  let s = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  return s;
}

function parseB64Json<T = any>(b64: string): T {
  const s = normalizeB64(b64);
  const json = Buffer.from(s, 'base64').toString('utf8');
  return JSON.parse(json) as T;
}

function sha256HexPrefix(input: string, hexChars: number): string {
  const hex = createHash('sha256').update(input, 'utf8').digest('hex');
  return hex.slice(0, Math.max(0, Math.min(hex.length, hexChars)));
}

function parseJwsUnverified(jws: string): { header: any; payload: any } {
  // NOTE: This is for /healthz metadata only. Verification happens elsewhere.
  const parts = String(jws || '').split('.');
  if (parts.length < 2) throw new Error('Invalid JWS: missing parts');
  const header = parseB64Json(parts[0]); // base64url tolerated by normalizeB64()
  const payload = parseB64Json(parts[1]);
  return { header, payload };
}

function getPaymentSignatureB64(req: express.Request): string | null {
  // Express lower-cases header names
  const h = req.headers['payment-signature'];
  if (typeof h === 'string' && h.length > 0) return h;

  if (legacyHeaders) {
    const xh = req.headers['x-payment-signature'];
    if (typeof xh === 'string' && xh.length > 0) return xh;
  }

  return null;
}

// PATCH: allow clients to provide the raw receipt JWS directly (what you were doing).
function getDirectReceiptJws(req: express.Request): string | null {
  const h = req.headers[DIRECT_RECEIPT_HEADER];
  if (typeof h === 'string' && h.length > 0) return h;
  return null;
}

// M4: read per-request injected receipt header (only when dev harness allowed + not prod).
function getInjectedDevReceiptJws(req: express.Request): string | null {
  if (!(allowDevHarness && !isProd)) return null;
  const h = req.headers[DEV_RECEIPT_HEADER];
  if (typeof h === 'string' && h.length > 0) return h;
  return null;
}

// --- jose (ESM-only) dynamic import helpers ---
// IMPORTANT: do NOT use `typeof import('jose')` in types here (TS1542 in CJS).
let joseModPromise: Promise<any> | null = null;
async function getJose(): Promise<any> {
  joseModPromise ??= import('jose');
  return joseModPromise;
}

let remoteJwksPromise: Promise<any> | null = null;
async function getRemoteJwks(): Promise<any> {
  if (!remoteJwksPromise) {
    remoteJwksPromise = (async () => {
      const jose = await getJose();
      const createRemoteJWKSet = jose.createRemoteJWKSet as (url: URL) => any;
      return createRemoteJWKSet(new URL(jwksUrl));
    })();
  }
  return remoteJwksPromise;
}

class ReceiptVerifyError extends Error {
  name = 'ReceiptVerifyError';
}

function receiptVerifyError(message: string): ReceiptVerifyError {
  return new ReceiptVerifyError(message);
}

// Local verify of facilitator receipt JWS via JWKS (no /v1/verify call)
async function verifyReceiptJwsLocal(jws: string) {
  const jose = await getJose();
  const jwtVerify = jose.jwtVerify as (jws: string, key: any, opts: any) => Promise<any>;
  const JWKS = await getRemoteJwks();

  let protectedHeader: any;
  let payload: any;

  try {
    const out = await jwtVerify(jws, JWKS, { algorithms: ['EdDSA'] });
    protectedHeader = out.protectedHeader;
    payload = out.payload;
  } catch (e: any) {
    throw receiptVerifyError(`receipt signature verification failed: ${String(e?.message ?? e)}`);
  }

  if (expectedKid && protectedHeader?.kid !== expectedKid) {
    throw receiptVerifyError(
      `unexpected kid: got ${protectedHeader?.kid ?? '(none)'}, expected ${expectedKid}`,
    );
  }

  return {
    valid: true,
    header: protectedHeader,
    payload,
    kid: protectedHeader?.kid,
  };
}

function stripPaymentHeaders(headers: HeadersInit): Headers {
  const h = new Headers(headers);
  const toDelete = [
    'payment-required',
    'payment-response',
    'payment-signature',
    'x-payment-required',
    'x-payment-response',
    'x-payment-signature',
    // M4: never forward the dev injection header upstream
    DEV_RECEIPT_HEADER,
    // PATCH: never forward raw receipt header upstream
    DIRECT_RECEIPT_HEADER,
  ];
  for (const k of toDelete) h.delete(k);
  return h;
}

function reqPathname(req: express.Request): string {
  const u = new URL(req.originalUrl || req.url, 'http://localhost');
  return u.pathname;
}

function reqQueryString(req: express.Request): string {
  const u = new URL(req.originalUrl || req.url, 'http://localhost');
  return u.search; // includes leading '?', or ''
}

function stripX402Prefix(pathname: string): string {
  // /x402/premium -> /premium
  if (pathname === '/x402') return '/';
  if (pathname.startsWith('/x402/')) return pathname.slice('/x402'.length);
  return pathname;
}

type UpstreamResult = {
  ok: boolean; // HTTP 2xx
  status: number;
  headers: Array<[string, string]>;
  body: Buffer;
};

async function fetchFromUpstream(args: {
  req: express.Request;
  contract: ContractDefinition;
  resourcePathname: string;
}): Promise<UpstreamResult> {
  const { req, contract, resourcePathname } = args;

  if (!contract.upstream?.baseUrl) {
    return {
      ok: false,
      status: 500,
      headers: [['content-type', 'application/json']],
      body: Buffer.from(JSON.stringify({ ok: false, error: 'proxy mode missing upstream.baseUrl' })),
    };
  }

  const upstreamBase = contract.upstream.baseUrl.replace(/\/$/, '');
  const prefix = contract.upstream.pathPrefix ?? '';
  const targetUrl = `${upstreamBase}${prefix}${resourcePathname}${reqQueryString(req)}`;

  // Forward safe subset: all incoming string headers except payment ones
  const incoming = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') incoming.set(k, v);
  }

  const forwarded = stripPaymentHeaders(incoming);
  forwarded.delete('host');
  forwarded.delete('content-length');

  const method = req.method.toUpperCase();
  const hasBody = !(method === 'GET' || method === 'HEAD');

  // Demo assumption: JSON bodies for non-GET.
  const body = hasBody ? JSON.stringify(req.body ?? {}) : undefined;

  const upstreamResp = await fetch(targetUrl, {
    method,
    headers: forwarded,
    body,
    redirect: 'manual',
  });

  const headers: Array<[string, string]> = [];
  upstreamResp.headers.forEach((value, key) => {
    headers.push([key, value]);
  });

  const buf = Buffer.from(await upstreamResp.arrayBuffer());
  return {
    ok: upstreamResp.ok,
    status: upstreamResp.status,
    headers,
    body: buf,
  };
}

function applyUpstreamResponse(res: express.Response, upstream: UpstreamResult) {
  res.status(upstream.status);

  for (const [key, value] of upstream.headers) {
    const k = key.toLowerCase();
    if (
      [
        'transfer-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailers',
        'upgrade',
      ].includes(k)
    ) {
      continue;
    }
    res.setHeader(key, value);
  }

  res.send(upstream.body);
}

// Build the expected contract binding for proof payload checks.
function toHttpMethod(s: string): HttpMethod {
  const m = String(s || '').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
    throw new Error(`Invalid HTTP method in contract: "${s}"`);
  }
  return m as HttpMethod;
}

function toContractBinding(c: ContractDefinition): ContractBinding {
  return {
    contractId: c.contractId,
    contractVersion: c.contractVersion,
    isFrozen: c.isFrozen,
    merchantId: c.merchantId,
    resource: { method: toHttpMethod(c.resource.method), path: c.resource.path },
    network: c.network,
    asset: {
      type: 'PLT',
      tokenId: c.asset.tokenId,
      decimals: c.asset.decimals,
    },
    amount: c.amount,
    payTo: c.payTo,
  };
}

// Convert ProofPayloadError into a stable error string
function proofErrorToString(e: any): string {
  if (e?.name === 'ProofPayloadError' || e instanceof ProofPayloadError) return String(e.message ?? e);
  return String(e?.message ?? e);
}

// Pending settlement helpers (M2)
function isPendingSettlement(proof: any): boolean {
  const st = proof?.settlement?.status;
  return typeof st === 'string' && st.length > 0 && st !== 'finalized';
}

function retryAfterFromProof(nowSec: number, proof: any): number | null {
  const exp = proof?.settlement?.expiresAt;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  const remaining = Math.max(0, Math.floor(exp - nowSec));
  // Hint: retry soon but don’t spam. Keep within 1..30 seconds.
  return Math.min(30, Math.max(1, Math.min(5, remaining)));
}

function settlementMeta(proof: any) {
  return {
    status: typeof proof?.settlement?.status === 'string' ? proof.settlement.status : null,
    settledAt: typeof proof?.settlement?.settledAt === 'number' ? proof.settlement.settledAt : null,
    expiresAt: typeof proof?.settlement?.expiresAt === 'number' ? proof.settlement.expiresAt : null,
  };
}

// Extract amountRaw for tuple key from proof when possible, else from contract
function amountRawFromProofOrContract(proof: any, contract: ContractDefinition): string {
  const direct = proof?.amountRaw;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const nested = proof?.amount?.raw;
  if (typeof nested === 'string' && nested.length > 0) return nested;

  const evt = proof?.paymentEvent?.amountRaw;
  if (typeof evt === 'string' && evt.length > 0) return evt;

  const cAmt: any = (contract as any).amount;
  if (typeof cAmt === 'string') return cAmt;
  if (typeof cAmt === 'number') return String(cAmt);
  if (cAmt && typeof cAmt === 'object') {
    if (typeof cAmt.raw === 'string') return cAmt.raw;
    if (typeof cAmt.value === 'string') return cAmt.value;
    try {
      return JSON.stringify(cAmt);
    } catch {
      return String(cAmt);
    }
  }
  return String(cAmt ?? '');
}

// ------------------------------
// Replay hardening helpers
// ------------------------------

function minDefined(...vals: Array<number | null | undefined>): number | null {
  const xs = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (xs.length === 0) return null;
  return Math.min(...xs);
}

function deriveReplayExpSec(args: {
  nowSec: number;
  ttlSec: number;
  paymentRequiredExpSec: number;
  proof: any; // ccd-plt-proof@v1 payload
}): number {
  const { nowSec, ttlSec, paymentRequiredExpSec, proof } = args;

  const receiptExp = typeof proof?.exp === 'number' && Number.isFinite(proof.exp) ? proof.exp : null;

  const settlementExp =
    typeof proof?.settlement?.expiresAt === 'number' && Number.isFinite(proof.settlement.expiresAt)
      ? proof.settlement.expiresAt
      : null;

  const fallback = nowSec + ttlSec;

  // Tightest possible bound; also never exceed PAYMENT-REQUIRED expiry.
  const m = minDefined(receiptExp, settlementExp, paymentRequiredExpSec, fallback);
  return m ?? paymentRequiredExpSec;
}

// -----------------------------------------------------------------------------
// Phase E: Optional replay store abstraction (memory default; redis optional)
// -----------------------------------------------------------------------------

export type ReplayEntry = {
  seenAtSec: number;
  expSec: number;
  receiptSha12: string;
  kid?: string;
};

export type ReplayDecision =
  | { ok: true; inserted: true; tupleKey: string; entry: ReplayEntry }
  | { ok: false; reason: 'replay'; tupleKey: string; entry: ReplayEntry };

interface ReplayStore {
  kind(): string;
  size(): Promise<number | null>;
  checkAndInsert(args: {
    tupleKey: string;
    nowSec: number;
    expSec: number;
    receiptSha12: string;
    kid?: string;
  }): Promise<ReplayDecision>;
}

// Memory replay store (wrap existing ReplayCache)
class MemoryReplayStore implements ReplayStore {
  private cache = new ReplayCache();

  kind(): string {
    return 'memory';
  }

  async size(): Promise<number | null> {
    return this.cache.size();
  }

  async checkAndInsert(args: {
    tupleKey: string;
    nowSec: number;
    expSec: number;
    receiptSha12: string;
    kid?: string;
  }): Promise<ReplayDecision> {
    return this.cache.checkAndInsert(args);
  }
}

// IMPORTANT: no `import 'redis'` anywhere. Load only if backend=redis at runtime.
function loadRedisModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('redis');
  } catch {
    throw new Error(
      "X402_REPLAY_BACKEND=redis selected, but the 'redis' package is not installed. " +
        "Install it with: npm i redis",
    );
  }
}

class RedisReplayStore implements ReplayStore {
  private client: any;
  private connected = false;

  constructor(private url: string, private keyPrefix: string) {}

  kind(): string {
    return 'redis';
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;

    const { createClient } = loadRedisModule();
    this.client = createClient({ url: this.url });

    this.client.on('error', (err: any) => {
      console.error('[replay][redis] client error:', err);
    });

    await this.client.connect();
    this.connected = true;
  }

  async size(): Promise<number | null> {
    // We intentionally avoid SCAN in a hot path. Return null (unknown).
    return null;
  }

  async checkAndInsert(args: {
    tupleKey: string;
    nowSec: number;
    expSec: number;
    receiptSha12: string;
    kid?: string;
  }): Promise<ReplayDecision> {
    await this.ensureConnected();

    const ttl = Math.max(1, Math.floor(args.expSec - args.nowSec));
    const key = `${this.keyPrefix}${args.tupleKey}`;

    const entry: ReplayEntry = {
      seenAtSec: args.nowSec,
      expSec: args.expSec,
      receiptSha12: args.receiptSha12,
      kid: args.kid,
    };

    // redis v4: SET key value NX EX <seconds>
    const setRes = await this.client.set(key, JSON.stringify(entry), { NX: true, EX: ttl });

    if (setRes) {
      return { ok: true, inserted: true, tupleKey: args.tupleKey, entry };
    }

    // Replay: fetch existing entry (best-effort)
    const existingRaw = await this.client.get(key);
    let existing: ReplayEntry = entry;
    try {
      if (existingRaw) existing = JSON.parse(existingRaw);
    } catch {
      // ignore parse errors; fall back to "entry" shape
    }

    return { ok: false, reason: 'replay', tupleKey: args.tupleKey, entry: existing };
  }
}

// Pick replay store (memory by default)
let replayStore: ReplayStore;
try {
  if (replayBackend === 'redis') {
    if (!replayRedisUrl) {
      throw new Error('X402_REPLAY_BACKEND=redis requires X402_REDIS_URL (or REDIS_URL) to be set.');
    }
    replayStore = new RedisReplayStore(replayRedisUrl, replayRedisKeyPrefix);
  } else {
    replayStore = new MemoryReplayStore();
  }
} catch (e: any) {
  console.error(`[replay] ERROR: ${String(e?.message ?? e)}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Health / readiness
// -----------------------------------------------------------------------------

app.get('/healthz', async (_req, res) => {
  // IMPORTANT: Never print full receipt JWS in /healthz.
  // If X402_ALLOW_DEV_HARNESS=true, expose only non-secret metadata for debugging.
  let devReceiptMeta:
    | {
        sha25612: string;
        kid: string | null;
        iat: number | null;
        exp: number | null;
      }
    | null = null;

  if (allowDevHarness && devReceiptJws) {
    try {
      const { header, payload } = parseJwsUnverified(devReceiptJws);
      devReceiptMeta = {
        sha25612: sha256HexPrefix(devReceiptJws, 12),
        kid: typeof header?.kid === 'string' ? header.kid : null,
        iat: typeof payload?.iat === 'number' ? payload.iat : null,
        exp: typeof payload?.exp === 'number' ? payload.exp : null,
      };
    } catch {
      // Keep healthz stable even if receipt env var is malformed.
      devReceiptMeta = {
        sha25612: sha256HexPrefix(devReceiptJws, 12),
        kid: null,
        iat: null,
        exp: null,
      };
    }
  }

  let replaySize: number | null = null;
  try {
    replaySize = await replayStore.size();
  } catch {
    replaySize = null;
  }

  res.json({
    ok: true,
    status: 'up',
    port,
    crpBaseUrl,
    jwksUrl,
    x402Debug,
    legacyHeaders,
    expectedKid: expectedKid ?? null,
    contractsPath,
    devHarness: {
      enabled: !!devReceiptJws,
      allowDevHarness,
      nodeEnv: process.env.NODE_ENV ?? null,
      requiresPaymentSignature: devReceiptRequiresPaymentSignature,
      // Only present when X402_ALLOW_DEV_HARNESS=true (and receipt is set).
      ...(allowDevHarness
        ? {
            jwksUrl,
            receipt: devReceiptMeta,
          }
        : {}),
    },
    contractsLoaded: contracts.map((c) => ({
      contractId: c.contractId,
      contractVersion: c.contractVersion,
      isFrozen: c.isFrozen,
      mode: c.mode ?? 'local',
      merchantId: c.merchantId,
      resource: c.resource,
      network: c.network,
      asset: c.asset,
      amount: c.amount,
      payTo: c.payTo,
      upstream: c.upstream ?? null,
      attestations: c.attestations ?? [],
    })),
    replay: {
      backend: replayStore.kind(),
      redisUrl: replayBackend === 'redis' ? replayRedisUrl : null,
      redisKeyPrefix: replayBackend === 'redis' ? replayRedisKeyPrefix : null,
      size: replaySize,
    },
  });
});

app.get('/readyz', async (_req, res) => {
  try {
    const r = await fetch(jwksUrl, { method: 'GET' });
    res.json({ ok: true, jwksOk: r.ok });
  } catch {
    res.json({ ok: true, jwksOk: false });
  }
});

// -----------------------------------------------------------------------------
// Unified x402 handler (used by /paid and /x402/...)
// -----------------------------------------------------------------------------

async function handleX402(req: express.Request, res: express.Response, resourcePathname: string) {
  // Resolve contract based on the underlying resource path (e.g. /premium or /paid/demo.pdf)
  let contract: ContractDefinition;
  try {
    contract = contractResolver.resolveByResource({
      method: req.method,
      pathname: resourcePathname,
    });
  } catch (e: any) {
    return res.status(404).json({ ok: false, error: String(e?.message ?? e) });
  }

  const paymentSignatureB64 = getPaymentSignatureB64(req);
  let paymentSignature: any | null = null;
  let paymentSignatureParseError: string | null = null;

  if (paymentSignatureB64) {
    try {
      paymentSignature = parseB64Json(paymentSignatureB64);
    } catch (e: any) {
      paymentSignature = null;
      paymentSignatureParseError = `invalid PAYMENT-SIGNATURE: ${String(e?.message ?? e)}`;
    }
  }

  // PATCH: accept receipt JWS either directly (x402-receipt) or embedded in PAYMENT-SIGNATURE JSON.
  // If present and verifies, we take nonce FROM THE VERIFIED RECEIPT payload and do NOT call CRP.
  const directReceiptJws = getDirectReceiptJws(req);

  const receiptJwsFromPaymentSignature =
    typeof paymentSignature?.receipt?.jws === 'string' && paymentSignature.receipt.jws.length > 0
      ? paymentSignature.receipt.jws
      : typeof paymentSignature?.receiptJws === 'string' && paymentSignature.receiptJws.length > 0
        ? paymentSignature.receiptJws
        : null;

  const clientReceiptJws = directReceiptJws ?? receiptJwsFromPaymentSignature;

  const nonceFromQuery =
    typeof req.query.nonce === 'string' && req.query.nonce.length > 0 ? req.query.nonce : null;

  const nonceFromSig =
    typeof paymentSignature?.nonce === 'string' && paymentSignature.nonce.length > 0
      ? paymentSignature.nonce
      : null;

  // We may override this nonce if we successfully verify a client-provided receipt.
  let nonce = nonceFromQuery ?? nonceFromSig ?? `demo-${randomUUID()}`;

  const nowSec = Math.floor(Date.now() / 1000);

  // These are built once we decide the nonce (possibly from verified receipt).
  let paymentRequiredHeaderPayload: any = null;
  let paymentRequiredBody: any = null;
  let prB64 = '';

  const rebuildPaymentRequired = (nonceValue: string) => {
    nonce = nonceValue;

    paymentRequiredHeaderPayload = buildPaymentRequiredPayload({
      contract,
      nonce,
      issuedAtSec: nowSec,
      expiresAtSec: nowSec + ttlSec,
    });

    paymentRequiredBody = {
      ...paymentRequiredHeaderPayload,
      facilitator: crpBaseUrl,
      description: `Payment required for ${contract.resource.method.toUpperCase()} ${contract.resource.path}`,
    };

    prB64 = b64jsonHeader(paymentRequiredHeaderPayload);
  };

  // Build it initially with current nonce (may be replaced if receipt verifies).
  rebuildPaymentRequired(nonce);

  let issuedPersistStarted = false;
  let issuedPersistPromise: Promise<void> | null = null;

  const persistIssuedChallengeIfNeeded = (): Promise<void> => {
    if (issuedPersistStarted && issuedPersistPromise) return issuedPersistPromise;

    issuedPersistStarted = true;

    const issuedAt = paymentRequiredHeaderPayload.issuedAt;
    const expiresAt = paymentRequiredHeaderPayload.expiresAt;

    issuedPersistPromise = (async () => {
      await sendIntentToOrchestrator({
        challengeId: nonce,
        contract,
        nonce,
        issuedAt,
        expiresAt,
      });

      await persistIssuedChallenge({
        contract,
        nonce,
        paymentRequiredHeaderPayload,
      });
    })().catch((err) => {
      // Keep current 402 behavior intact for this first persistence step.
      // Later phases may tighten this to fail closed.
      issuedPersistStarted = false;
      issuedPersistPromise = null;
      console.error('Failed to persist issued payment challenge:', err);
      throw err;
    });

    return issuedPersistPromise;
  };

  let proofWorkflowPersistStarted = false;
  let proofWorkflowPersistPromise: Promise<void> | null = null;

  const persistProofWorkflowForCurrentNonceIfNeeded = (
    submittedReasonCode = 'proof_submitted',
    pendingReasonCode = 'source_verify_pending',
  ): Promise<void> => {
    if (proofWorkflowPersistStarted && proofWorkflowPersistPromise) {
      return proofWorkflowPersistPromise;
    }

    proofWorkflowPersistStarted = true;

    proofWorkflowPersistPromise = (async () => {
      await transitionChallengeStateByNonce({
        nonce,
        fromState: 'ISSUED',
        toState: 'PROOF_SUBMITTED',
        actor: 'gateway',
        reasonCode: submittedReasonCode,
        reasonMessage: 'Payment proof material submitted to gateway',
      });

      await transitionChallengeStateByNonce({
        nonce,
        fromState: 'PROOF_SUBMITTED',
        toState: 'SOURCE_VERIFY_PENDING',
        actor: 'gateway',
        reasonCode: pendingReasonCode,
        reasonMessage: 'Gateway entered source verification workflow',
      });
    })().catch((err) => {
      proofWorkflowPersistStarted = false;
      proofWorkflowPersistPromise = null;
      console.error('Failed to persist proof workflow transitions:', err);
      throw err;
    });

    return proofWorkflowPersistPromise;
  };

  // Helper to issue a "payment required" response consistently
  const reply402 = (body: any) => {
    void persistIssuedChallengeIfNeeded();
    res.setHeader('PAYMENT-REQUIRED', prB64);
    if (legacyHeaders) res.setHeader('X-PAYMENT-REQUIRED', prB64);
    return res.status(402).json(body);
  };

  // If a client sent a PAYMENT-SIGNATURE but it couldn't be parsed,
  // return 402 with a clearer error (still include PAYMENT-REQUIRED).
  if (paymentSignatureB64 && paymentSignatureParseError) {
    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Invalid payment signature header',
      ...(x402Debug ? { debug: { reason: paymentSignatureParseError } } : {}),
    });
  }

  if (!paymentSignatureParseError && paymentSignatureB64 && (nonceFromQuery || nonceFromSig)) {
    await persistIssuedChallengeIfNeeded();

    void sendProofToOrchestrator({
      challengeId: nonce,
      nonce: nonce,
      proofType: 'payment_signature',
      proofPayload: {
        paymentSignature: paymentSignatureB64,
      },
    });

    await persistProofWorkflowForCurrentNonceIfNeeded(
      'payment_signature_submitted',
      'payment_signature_verification_started',
    );
  }

  // Helper: verify signature + enforce proof payload semantics.
  // PATCH: allow caller to specify which nonce to bind against (important when nonce comes from receipt).
  const verifyAndValidateProof = async (args: { receiptJws: string; expectedNonce: string }) => {
    const verify = await verifyReceiptJwsLocal(args.receiptJws);

    const payload = verify.payload;

    // Phase B (real): require ccd-plt-proof@v1 in receipt payload
    assertCcdPltProofV1(payload);

    validateCcdPltProofAgainstContract({
      proof: payload,
      expected: {
        nonce: args.expectedNonce,
        contract: toContractBinding(contract),
        nowSec,
      },
    });

    return { verify, proof: payload };
  };

  // M2: classify pending/non-finalized receipts without emitting PAYMENT-RESPONSE
  const tryReplyPendingSettlement = async (args: {
    receiptJws: string;
    label: 'dev' | 'real' | 'client';
    expectedNonce: string;
    match?: any;
    fulfill?: any;
  }): Promise<boolean> => {
    try {
      const v = await verifyReceiptJwsLocal(args.receiptJws);
      const payload = v?.payload ?? null;

      assertCcdPltProofV1(payload);

      // Ensure it’s at least structurally bound (nonce/contract checks) before we treat it as pending.
      validateCcdPltProofAgainstContract({
        proof: payload,
        expected: {
          nonce: args.expectedNonce,
          contract: toContractBinding(contract),
          nowSec,
        },
      });

      if (!isPendingSettlement(payload)) return false;

      const retryAfterSec = retryAfterFromProof(nowSec, payload);
      if (retryAfterSec) res.setHeader('Retry-After', String(retryAfterSec));

      return !!reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Payment pending settlement',
        reason: 'pending_settlement',
        settlement: settlementMeta(payload),
        ...(retryAfterSec ? { retryAfterSec } : {}),
        ...(x402Debug
          ? {
              debug: {
                where: args.label,
                note: 'receipt verified but settlement not finalized',
                kid: v?.kid ?? null,
                ...(args.match ? { match: args.match } : {}),
                ...(args.fulfill ? { fulfill: args.fulfill } : {}),
              },
            }
          : {}),
      });
    } catch {
      return false;
    }
  };

  // M2 tweak: after successful verify+validate, hard-stop if settlement is pending/non-finalized.
  // (Does NOT consume replay / does NOT emit PAYMENT-RESPONSE.)
  // KEEP EXACTLY AS-IS (NO REGRESSION).
  const replyPendingFromVerifiedProof = (args: {
    label: 'dev' | 'real' | 'client';
    verify: any;
    proof: any;
    match?: any;
    fulfill?: any;
  }): boolean => {
    if (!isPendingSettlement(args.proof)) return false;

    const retryAfterSec = retryAfterFromProof(nowSec, args.proof);
    if (retryAfterSec) res.setHeader('Retry-After', String(retryAfterSec));

    reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Payment pending settlement',
      reason: 'pending_settlement',
      settlement: settlementMeta(args.proof),
      ...(retryAfterSec ? { retryAfterSec } : {}),
      ...(x402Debug
        ? {
            debug: {
              where: args.label,
              note: 'verified receipt but settlement not finalized (post-verify guard)',
              kid: args.verify?.kid ?? null,
              ...(args.match ? { match: args.match } : {}),
              ...(args.fulfill ? { fulfill: args.fulfill } : {}),
            },
          }
        : {}),
    });

    return true;
  };

  // Replay enforcement AFTER verify+validate and BEFORE any paid content is served.
  const enforceReplay = async (args: {
    receiptJws: string;
    verify: any;
    proof: any;
    match?: any;
    fulfill?: any;
  }): Promise<{ ok: true; tupleKey: string } | { ok: false }> => {
    // Hardening: derive expSec from the tightest available bounds.
    const expSec = deriveReplayExpSec({
      nowSec,
      ttlSec,
      paymentRequiredExpSec: paymentRequiredHeaderPayload.expiresAt,
      proof: args.proof,
    });

    // If receipt is already expired by our derived bound, treat it as invalid/expired.
    if (expSec <= nowSec) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Payment receipt expired',
        ...(x402Debug
          ? {
              debug: {
                nowSec,
                expSec,
                receiptExp: args.proof?.exp ?? null,
                settlementExp: args.proof?.settlement?.expiresAt ?? null,
                paymentRequiredExp: paymentRequiredHeaderPayload.expiresAt,
              },
            }
          : {}),
      });
      return { ok: false };
    }

    const amountRaw = amountRawFromProofOrContract(args.proof, contract);

    // NOTE: tupleKey strips query params intentionally (see src/x402/tupleKey.ts)
    const pathWithQuery = `${resourcePathname}${reqQueryString(req)}`;

    // M5 Commit 1: If method is POST/PUT/PATCH, bind tupleKey to sha256(rawBodyBytes).
    const methodUpper = String(req.method || '').toUpperCase();
    const rawBodyBuf =
      isBodyBoundMethod(methodUpper) && Buffer.isBuffer((req as RawBodyRequest).rawBody)
        ? ((req as RawBodyRequest).rawBody as Buffer)
        : Buffer.alloc(0);

    const bodySha256 = isBodyBoundMethod(methodUpper) ? sha256HexBytes(rawBodyBuf) : undefined;

    const tupleKey = buildTupleKey({
      contract: `${contract.contractId}:${contract.contractVersion}`,
      nonce,
      amountRaw,

      payTo: contract.payTo,
      network: contract.network,
      tokenId: contract.asset?.tokenId,
      decimals: contract.asset?.decimals,

      method: req.method,
      path: pathWithQuery,

      contractId: contract.contractId,
      contractVersion: contract.contractVersion,
      merchantId: contract.merchantId,

      isFrozen: contract.isFrozen,

      // Only used for POST/PUT/PATCH; GET remains unchanged.
      bodySha256,
    });

    const decision = await replayStore.checkAndInsert({
      tupleKey,
      nowSec,
      expSec,
      receiptSha12: receiptSha12Fingerprint(args.receiptJws),
      kid: args.verify?.kid,
    });

    if (!decision.ok) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Payment already claimed (replay)',
        ...(x402Debug
          ? {
              debug: {
                tupleKey,
                seen: decision.entry,
                match: args.match,
                fulfill: args.fulfill,
              },
            }
          : {}),
      });
      return { ok: false };
    }

    return { ok: true, tupleKey };
  };

  const persistSourceVerificationOutcomeIfNeeded = (
    outcome: 'verified' | 'failed',
    reasonCode: string,
    reasonMessage: string,
  ) => {
    void completeSourceVerificationByNonce({
      nonce,
      outcome,
      actor: 'gateway',
      reasonCode,
      reasonMessage,
    }).catch((err) => {
      console.error('Failed to persist source verification outcome:', err);
    });
  };

  const persistPolicySatisfiedIfNeeded = (
    reasonCode: string,
    reasonMessage: string,
  ) => {
    void completePolicyEvaluationByNonce({
      nonce,
      fromState: 'SOURCE_VERIFIED',
      outcome: 'satisfied',
      actor: 'gateway',
      reasonCode,
      reasonMessage,
    }).catch((err) => {
      console.error('Failed to persist policy evaluation outcome:', err);
    });
  };

  const persistSettlementEntryIfNeeded = () => {
    void completeSettlementEntryByNonce({
      nonce,
      actor: 'gateway',
      requestedReasonCode: 'settlement_requested',
      requestedReasonMessage: 'Gateway initiated settlement workflow',
      pendingReasonCode: 'settlement_pending',
      pendingReasonMessage: 'Gateway entered settlement pending state',
    }).catch((err) => {
      console.error('Failed to persist settlement entry workflow:', err);
    });
  };

  const requirePolicySatisfiedIfGated = async (): Promise<
    | { ok: true }
    | { ok: false; responseSent: true }
  > => {
    if (resourcePathname !== '/paid-gated') {
      return { ok: true };
    }

    const challenge = await getChallengeStatusByNonce(nonce);

    if (!challenge.found) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Missing canonical challenge for gated route',
        ...(x402Debug ? { debug: { reason: 'missing_canonical_challenge' } } : {}),
      });
      return { ok: false, responseSent: true };
    }

    if (challenge.status !== 'POLICY_SATISFIED') {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Policy requirements not yet satisfied',
        ...(x402Debug
          ? { debug: { reason: 'policy_not_satisfied', challengeStatus: challenge.status } }
          : {}),
      });
      return { ok: false, responseSent: true };
    }

    return { ok: true };
  };

  const persistSettlementOutcomeIfNeeded = (
    outcome: 'confirmed' | 'failed_retryable' | 'failed_final',
    reasonCode: string,
    reasonMessage: string,
  ) => {
    void completeSettlementOutcomeByNonce({
      nonce,
      outcome,
      actor: 'gateway',
      reasonCode,
      reasonMessage,
    }).catch((err) => {
      console.error('Failed to persist settlement outcome:', err);
    });
  };

  const persistReleaseIfNeeded = (receiptJws: string) => {
    void completeReleaseByNonce({
      nonce,
      actor: 'gateway',
      reasonCode: 'resource_released',
      reasonMessage: 'Gateway released protected resource',
      receiptJws,
      responseHeaders: {
        'PAYMENT-RESPONSE': 'set',
      },
    }).catch((err) => {
      console.error('Failed to persist release:', err);
    });
  };

  const finalizeSuccessfulSettlementAndRelease = async (args: {
    receiptJws: string;
    settlementReasonMessage: string;
  }) => {
    try {
      const entry = await completeSettlementEntryByNonce({
        nonce,
        actor: 'gateway',
        requestedReasonCode: 'settlement_requested',
        requestedReasonMessage: 'Gateway initiated settlement workflow',
        pendingReasonCode: 'settlement_pending',
        pendingReasonMessage: 'Gateway entered settlement pending state',
      });

      if (!entry.updated && entry.reason !== 'already_in_target') {
        console.warn('Settlement entry did not advance as expected:', entry);
      }

      const outcome = await completeSettlementOutcomeByNonce({
        nonce,
        outcome: 'confirmed',
        actor: 'gateway',
        reasonCode: 'settlement_confirmed',
        reasonMessage: args.settlementReasonMessage,
      });

      if (!outcome.updated && outcome.reason !== 'already_in_target') {
        console.warn('Settlement outcome did not advance as expected:', outcome);
      }

      const release = await completeReleaseByNonce({
        nonce,
        actor: 'gateway',
        reasonCode: 'resource_released',
        reasonMessage: 'Gateway released protected resource',
        receiptJws: args.receiptJws,
        responseHeaders: {
          'PAYMENT-RESPONSE': 'set',
        },
      });

      if (!release.updated && release.reason !== 'already_in_target') {
        console.warn('Release did not advance as expected:', release);
      }
    } catch (err) {
      console.error('Failed to finalize settlement and release:', err);
    }
  };

  const paymentResponseHeaderPayloadBase = (args: { receiptJws: string; proof: any }) => ({
    version: 'x402-v2',
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    merchantId: contract.merchantId,
    resource: contract.resource,
    nonce,
    settled: true,
    receipt: {
      jws: args.receiptJws,
      payload: args.proof ?? null,
    },
  });

  const maybeSetPaymentResponseHeader = (shouldSet: boolean, receiptJws: string, proof: any) => {
    if (!shouldSet) return;
    const payload = paymentResponseHeaderPayloadBase({ receiptJws, proof });
    const respB64 = b64json(payload);
    res.setHeader('PAYMENT-RESPONSE', respB64);
    if (legacyHeaders) res.setHeader('X-PAYMENT-RESPONSE', respB64);
  };

  // ---------------------------------------------------------------------------
  // PATCH: If client provides a receipt JWS, verify it and serve directly.
  // This avoids the “new nonce every request” treadmill.
  // ---------------------------------------------------------------------------
  if (clientReceiptJws) {
    try {
      // Verify (signature) first so nonce comes from a trusted payload
      const v0 = await verifyReceiptJwsLocal(clientReceiptJws);
      assertCcdPltProofV1(v0.payload);

      const receiptNonce =
        typeof v0.payload?.nonce === 'string' && v0.payload.nonce.length > 0 ? v0.payload.nonce : null;

      if (!receiptNonce) {
        return reply402({
          ok: false,
          paid: false,
          paymentRequired: paymentRequiredBody,
          error: 'Invalid payment receipt',
          ...(x402Debug ? { debug: { reason: 'receipt missing nonce in payload' } } : {}),
        });
      }

      // Rebuild PR based on receipt nonce (so errors/pending remain coherent)
      rebuildPaymentRequired(receiptNonce);

      await persistProofWorkflowForCurrentNonceIfNeeded(
        'client_receipt_submitted',
        'client_receipt_verification_started',
      );

      // Full validate with expected nonce = receipt nonce
      const out = await verifyAndValidateProof({ receiptJws: clientReceiptJws, expectedNonce: receiptNonce });
      const verify = out.verify;
      const proof = out.proof;

      persistSourceVerificationOutcomeIfNeeded(
        'verified',
        'client_receipt_verified',
        'Client-provided receipt verified successfully',
      );

      persistPolicySatisfiedIfNeeded(
        'policy_implicit_allow',
        'Client receipt satisfied implicit allow policy',
      );

      const clientPolicyGate = await requirePolicySatisfiedIfGated();
      if (!clientPolicyGate.ok) return;

      // M2 pending semantics (keep exact behavior)
      if (replyPendingFromVerifiedProof({ label: 'client', verify, proof })) return;

      // Replay protection BEFORE serving any paid content
      const replay = await enforceReplay({ receiptJws: clientReceiptJws, verify, proof });
      if (!replay.ok) return;

      void sendReleaseCheckToOrchestrator({
        challengeId: nonce,
        nonce,
      });

      // Serve locally or proxy upstream
      if ((contract.mode ?? 'local') === 'proxy') {
        try {
          const upstream = await fetchFromUpstream({ req, contract, resourcePathname });

          if (upstream.ok) {
            await finalizeSuccessfulSettlementAndRelease({
              receiptJws: clientReceiptJws,
              settlementReasonMessage:
                'Gateway accepted finalized settlement for client-provided receipt',
            });
          }

          maybeSetPaymentResponseHeader(upstream.ok, clientReceiptJws, proof);
          return applyUpstreamResponse(res, upstream);
        } catch (e: any) {
          console.error('Proxy error (client receipt):', e);
          return res.status(502).json({
            ok: false,
            error: 'Upstream proxy error',
            ...(x402Debug ? { debug: { message: String(e?.message ?? e) } } : {}),
          });
        }
      }

      // Stage 4.5: finalize canonical lifecycle on successful local release.
      await finalizeSuccessfulSettlementAndRelease({
        receiptJws: clientReceiptJws,
        settlementReasonMessage:
          'Gateway accepted finalized settlement for client-provided receipt',
      });

      maybeSetPaymentResponseHeader(true, clientReceiptJws, proof);

      return res.status(200).json({
        ok: true,
        paid: true,
        nonce,
        resource: 'secret-data',
        contract: {
          contractId: contract.contractId,
          contractVersion: contract.contractVersion,
          isFrozen: contract.isFrozen,
          mode: contract.mode ?? 'local',
        },
        verify,
        ...(x402Debug
          ? { debug: { receiptSource: directReceiptJws ? 'x402-receipt' : 'payment-signature.receipt.jws' } }
          : {}),
      });
    } catch (err: any) {
      // Best-effort: if receipt decodes, we can attempt pending semantics with coherent nonce.
      let receiptNonceCandidate: string | null = null;
      try {
        const parts = String(clientReceiptJws || '').split('.');
        if (parts.length >= 2) {
          const payload = parseB64Json(parts[1]); // parseB64Json already base64url-tolerant
          receiptNonceCandidate =
            typeof payload?.nonce === 'string' && payload.nonce.length > 0 ? payload.nonce : null;
        }
      } catch {
        receiptNonceCandidate = null;
      }

      if (receiptNonceCandidate) {
        rebuildPaymentRequired(receiptNonceCandidate);
        const repliedPending = await tryReplyPendingSettlement({
          receiptJws: clientReceiptJws,
          label: 'client',
          expectedNonce: receiptNonceCandidate,
        });
        if (repliedPending) return;
      }

      const message =
        err?.name === 'ReceiptVerifyError'
          ? String(err.message)
          : err?.name === 'ProofPayloadError' || err instanceof ProofPayloadError
            ? proofErrorToString(err)
            : String(err?.message ?? err);

      persistSourceVerificationOutcomeIfNeeded(
        'failed',
        'client_receipt_invalid',
        `Client-provided receipt failed verification: ${message}`,
      );

      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Invalid payment receipt',
        ...(x402Debug ? { debug: { reason: message } } : {}),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // DEV BYPASS (Phase B harness):
  // M4: allow per-request receipt injection via header (preferred),
  //     otherwise fall back to env-based devReceiptJws.
  // ---------------------------------------------------------------------------
  const injectedReceiptJws = getInjectedDevReceiptJws(req);
  const effectiveDevReceiptJws = injectedReceiptJws ?? devReceiptJws;

  if (effectiveDevReceiptJws) {
    if (devReceiptRequiresPaymentSignature && !paymentSignatureB64) {
      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'PAYMENT-SIGNATURE required (dev harness)',
        ...(x402Debug ? { debug: { devReceiptRequiresPaymentSignature: true } } : {}),
      });
    }

    await persistProofWorkflowForCurrentNonceIfNeeded(
      'dev_receipt_submitted',
      'dev_receipt_verification_started',
    );

    let verify: any;
    let proof: any;
    try {
      // In dev harness we bind to the current nonce (from query/sig/random) exactly as before.
      const out = await verifyAndValidateProof({ receiptJws: effectiveDevReceiptJws, expectedNonce: nonce });
      verify = out.verify;
      proof = out.proof;
    } catch (err: any) {
      // M2: if receipt verifies but is pending/non-finalized, return explicit pending semantics.
      const repliedPending = await tryReplyPendingSettlement({
        receiptJws: effectiveDevReceiptJws,
        label: 'dev',
        expectedNonce: nonce,
      });
      if (repliedPending) return;

      const message =
        err?.name === 'ReceiptVerifyError'
          ? String(err.message)
          : err?.name === 'ProofPayloadError' || err instanceof ProofPayloadError
            ? proofErrorToString(err)
            : String(err?.message ?? err);

      persistSourceVerificationOutcomeIfNeeded(
        'failed',
        'dev_receipt_invalid',
        `Dev receipt failed verification: ${message}`,
      );

      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Invalid payment receipt (dev harness)',
        ...(x402Debug ? { debug: { reason: message } } : {}),
      });
    }

    persistSourceVerificationOutcomeIfNeeded(
      'verified',
      'dev_receipt_verified',
      'Dev receipt verified successfully',
    );

    persistPolicySatisfiedIfNeeded(
      'policy_implicit_allow',
      'Dev receipt satisfied implicit allow policy',
    );

    const devPolicyGate = await requirePolicySatisfiedIfGated();
    if (!devPolicyGate.ok) return;

    // M2 tweak: post-verify guard (in case validation does not throw on pending)
    // KEEP EXACTLY AS-IS (NO REGRESSION).
    if (replyPendingFromVerifiedProof({ label: 'dev', verify, proof })) return;

    // Replay protection BEFORE serving any paid content
    const replay = await enforceReplay({ receiptJws: effectiveDevReceiptJws, verify, proof });
    if (!replay.ok) return;

    void sendReleaseCheckToOrchestrator({
      challengeId: nonce,
      nonce,
    });

    // Serve locally or proxy upstream
    if ((contract.mode ?? 'local') === 'proxy') {
      try {
        const upstream = await fetchFromUpstream({ req, contract, resourcePathname });

        if (upstream.ok) {
          await finalizeSuccessfulSettlementAndRelease({
            receiptJws: effectiveDevReceiptJws,
            settlementReasonMessage:
              'Gateway accepted finalized settlement for dev receipt',
          });
        }

        // M1 hardening: only emit PAYMENT-RESPONSE if the paid content is a success response.
        maybeSetPaymentResponseHeader(upstream.ok, effectiveDevReceiptJws, proof);

        return applyUpstreamResponse(res, upstream);
      } catch (e: any) {
        console.error('Proxy error (dev harness):', e);
        return res.status(502).json({
          ok: false,
          error: 'Upstream proxy error (dev harness)',
          ...(x402Debug ? { debug: { message: String(e?.message ?? e) } } : {}),
        });
      }
    }

    // local mode
    // Stage 4.5: finalize canonical lifecycle on successful local release.
    await finalizeSuccessfulSettlementAndRelease({
      receiptJws: effectiveDevReceiptJws,
      settlementReasonMessage:
        'Gateway accepted finalized settlement for dev receipt',
    });

    maybeSetPaymentResponseHeader(true, effectiveDevReceiptJws, proof);

    return res.status(200).json({
      ok: true,
      paid: true,
      nonce,
      resource: 'secret-data',
      contract: {
        contractId: contract.contractId,
        contractVersion: contract.contractVersion,
        isFrozen: contract.isFrozen,
        mode: contract.mode ?? 'local',
      },
      verify,
      devHarness: true,
      ...(injectedReceiptJws ? { devReceiptSource: 'header' } : { devReceiptSource: 'env' }),
    });
  }

  // 1) Call CRP (match + fulfill). Transport/JSON errors are gateway errors.
  let match: any;
  let fulfill: any;

  const matchReq: MatchPaymentRequest = {
    merchantId: contract.merchantId,
    nonce,
    network: contract.network,
    payTo: contract.payTo,
    amount: contract.amount,
    asset: contract.asset,
  };

  try {
    match = await crpClient.matchPayment(matchReq);
    fulfill = await crpClient.fulfillPayment(matchReq);
  } catch (err) {
    console.error('Error calling CRP:', err);

    persistSourceVerificationOutcomeIfNeeded(
      'failed',
      'crp_match_fulfill_error',
      `Gateway error while checking payment: ${String(err)}`,
    );

    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Gateway error while checking payment',
      ...(x402Debug ? { debug: { message: String(err) } } : {}),
    });
  }

  // 1b) If CRP indicates the chain event is already consumed (409 event_claimed),
  // treat as a normal unpaid condition (NOT a gateway error).
  if (fulfill?.httpStatus === 409 && fulfill?.reason === 'event_claimed') {
    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Payment already claimed (event_claimed)',
      ...(x402Debug ? { debug: { fulfill, match } } : {}),
    });
  }

  // 2) Decide if we have a fulfilled payment + receipt JWS.
  const m = fulfill?.match; // may be undefined
  const receiptJws = m?.receipt?.jws ?? null;

  const isPaid =
    fulfill?.ok === true && (fulfill?.count ?? 0) >= 1 && m?.status === 'fulfilled' && !!receiptJws;

  if (!isPaid) {
    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      ...(x402Debug ? { debug: { match, fulfill } } : {}),
    });
  }

  // 3) Verify FIRST. If verify fails, return 402 and DO NOT set PAYMENT-RESPONSE.
  let verify: any;
  let proof: any;
  try {
    const out = await verifyAndValidateProof({ receiptJws: receiptJws!, expectedNonce: nonce });
    verify = out.verify;
    proof = out.proof;
  } catch (err: any) {
    // M2: if receipt verifies but is pending/non-finalized, return explicit pending semantics.
    const repliedPending = await tryReplyPendingSettlement({
      receiptJws: receiptJws!,
      label: 'real',
      expectedNonce: nonce,
      match,
      fulfill,
    });
    if (repliedPending) return;

    const message =
      err?.name === 'ReceiptVerifyError'
        ? String(err.message)
        : err?.name === 'ProofPayloadError' || err instanceof ProofPayloadError
          ? proofErrorToString(err)
          : String(err?.message ?? err);

    persistSourceVerificationOutcomeIfNeeded(
      'failed',
      'real_receipt_invalid',
      `Facilitator receipt failed verification: ${message}`,
    );

    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Invalid payment receipt',
      ...(x402Debug ? { debug: { reason: message, match, fulfill } } : {}),
    });
  }

  persistSourceVerificationOutcomeIfNeeded(
    'verified',
    'real_receipt_verified',
    'Facilitator receipt verified successfully',
  );

  persistPolicySatisfiedIfNeeded(
    'policy_implicit_allow',
    'Facilitator receipt satisfied implicit allow policy',
  );

  const realPolicyGate = await requirePolicySatisfiedIfGated();
  if (!realPolicyGate.ok) return;

  // M2 tweak: post-verify guard (in case validation does not throw on pending)
  // KEEP EXACTLY AS-IS (NO REGRESSION).
  if (replyPendingFromVerifiedProof({ label: 'real', verify, proof, match, fulfill })) return;

  // Replay protection BEFORE serving any paid content
  const replay = await enforceReplay({ receiptJws: receiptJws!, verify, proof, match, fulfill });
  if (!replay.ok) return;

  void sendReleaseCheckToOrchestrator({
    challengeId: nonce,
    nonce,
  });

  // Serve locally or proxy upstream
  if ((contract.mode ?? 'local') === 'proxy') {
    try {
      const upstream = await fetchFromUpstream({ req, contract, resourcePathname });

      if (upstream.ok) {
        await finalizeSuccessfulSettlementAndRelease({
          receiptJws: receiptJws!,
          settlementReasonMessage:
            'Gateway accepted finalized settlement for facilitator receipt',
        });
      }

      // M1 hardening: only emit PAYMENT-RESPONSE if the paid content is a success response.
      maybeSetPaymentResponseHeader(upstream.ok, receiptJws!, proof);

      return applyUpstreamResponse(res, upstream);
    } catch (e: any) {
      console.error('Proxy error:', e);
      return res.status(502).json({
        ok: false,
        error: 'Upstream proxy error',
        ...(x402Debug ? { debug: { message: String(e?.message ?? e) } } : {}),
      });
    }
  }

  // local mode
  // Stage 4.5: finalize canonical lifecycle on successful local release.
  await finalizeSuccessfulSettlementAndRelease({
    receiptJws: receiptJws!,
    settlementReasonMessage:
      'Gateway accepted finalized settlement for facilitator receipt',
  });

  maybeSetPaymentResponseHeader(true, receiptJws!, proof);

  return res.status(200).json({
    ok: true,
    paid: true,
    nonce,
    resource: 'secret-data',
    contract: {
      contractId: contract.contractId,
      contractVersion: contract.contractVersion,
      isFrozen: contract.isFrozen,
      mode: contract.mode ?? 'local',
    },
    verify,
    ...(x402Debug ? { debug: { match, fulfill } } : {}),
  });
}

type GatedPolicyEvidence = {
  nonce?: string;
  policyKind?: string;
  region?: string;
  claims?: {
    ageOver?: number;
    ageAtLeast?: number;
    [k: string]: unknown;
  };
  subjectRef?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  externalValidationRef?: string | null;
  signature?: string | null;
};

function getPaidGatedContract(): ContractDefinition {
  return contractResolver.resolveByResource({
    method: 'GET',
    pathname: '/paid-gated',
  });
}

function evaluatePaidGatedPolicy(args: {
  nonce: string;
  policyEvidence: GatedPolicyEvidence | null | undefined;
}):
  | { ok: true; policyStatus: 'POLICY_SATISFIED'; region: string; minimumAge: number; actualAge: number }
  | { ok: false; code: string; reason: string; message: string } {
  const { nonce, policyEvidence } = args;

  if (!policyEvidence) {
    return {
      ok: false,
      code: 'missing_policy_evidence',
      reason: 'missing_policy_evidence',
      message: 'Policy evidence is required for this resource.',
    };
  }

  if (typeof policyEvidence.nonce !== 'string' || policyEvidence.nonce.length === 0) {
    return {
      ok: false,
      code: 'invalid_policy_evidence',
      reason: 'invalid_policy_evidence',
      message: 'Policy evidence is missing nonce.',
    };
  }

  if (policyEvidence.nonce !== nonce) {
    return {
      ok: false,
      code: 'policy_binding_mismatch',
      reason: 'policy_binding_mismatch',
      message: 'Policy evidence nonce does not match the issued challenge.',
    };
  }

  if (policyEvidence.policyKind !== 'composite') {
    return {
      ok: false,
      code: 'invalid_policy_evidence',
      reason: 'invalid_policy_evidence',
      message: 'Policy evidence must declare policyKind="composite" for this route.',
    };
  }

  const contract = getPaidGatedContract();
  const policy: any = (contract as any).policy ?? null;
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];
  const ageRule = rules.find((r: any) => r?.kind === 'age_min_by_region');

  if (!ageRule) {
    return {
      ok: false,
      code: 'policy_not_supported',
      reason: 'policy_not_supported',
      message: 'No supported age_min_by_region rule found on /paid-gated contract.',
    };
  }

  const region = typeof policyEvidence.region === 'string' ? policyEvidence.region : '';
  if (!region) {
    return {
      ok: false,
      code: 'invalid_policy_evidence',
      reason: 'invalid_policy_evidence',
      message: 'Policy evidence is missing region.',
    };
  }

  const thresholds = ageRule?.thresholds ?? {};
  const defaultDecision = ageRule?.defaultDecision ?? 'deny';
  const minimumAge = thresholds[region];

  if (minimumAge == null) {
    if (defaultDecision === 'allow') {
      return {
        ok: true,
        policyStatus: 'POLICY_SATISFIED',
        region,
        minimumAge: 0,
        actualAge: 0,
      };
    }

    return {
      ok: false,
      code: 'region_not_allowed',
      reason: 'region_not_allowed',
      message: `Region ${region} is not allowed by policy.`,
    };
  }

  const claims = policyEvidence.claims ?? {};
  const actualAge =
    typeof claims.ageOver === 'number'
      ? claims.ageOver
      : typeof claims.ageAtLeast === 'number'
        ? claims.ageAtLeast
        : null;

  if (actualAge == null) {
    return {
      ok: false,
      code: 'invalid_policy_evidence',
      reason: 'invalid_policy_evidence',
      message: 'Policy evidence must include a numeric age claim.',
    };
  }

  if (actualAge < minimumAge) {
    return {
      ok: false,
      code: 'age_requirement_not_met',
      reason: 'age_requirement_not_met',
      message: `Access denied: region ${region} requires age >= ${minimumAge}.`,
    };
  }

  return {
    ok: true,
    policyStatus: 'POLICY_SATISFIED',
    region,
    minimumAge,
    actualAge,
  };
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

// Existing local/demo endpoint (still supported)
app.get('/paid', async (req, res) => handleX402(req, res, '/paid'));
app.get('/paid-gated', async (req, res) => handleX402(req, res, '/paid-gated'));

app.post('/paid-gated/redeem', async (req, res) => {
  const body = req.body ?? {};
  const nonce = typeof body.nonce === 'string' ? body.nonce : '';
  const policyEvidence = (body as any).policyEvidence ?? null;

  const persistPolicyFailedIfNeeded = (
    reasonCode: string,
    reasonMessage: string,
  ) => {
    void completePolicyEvaluationByNonce({
      nonce,
      fromState: 'ISSUED',
      outcome: 'failed',
      actor: 'gateway',
      reasonCode,
      reasonMessage,
    }).catch((err) => {
      console.error('Failed to persist policy evaluation outcome:', err);
    });
  };

  const persistPolicySatisfiedForRedeemIfNeeded = (
    reasonCode: string,
    reasonMessage: string,
  ) => {
    void completePolicyEvaluationByNonce({
      nonce,
      fromState: 'ISSUED',
      outcome: 'satisfied',
      actor: 'gateway',
      reasonCode,
      reasonMessage,
    }).catch((err) => {
      console.error('Failed to persist policy evaluation outcome:', err);
    });
  };

  if (!nonce) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_request',
      reason: 'invalid_request',
      message: 'Request body must include nonce.',
    });
  }

  const result = evaluatePaidGatedPolicy({ nonce, policyEvidence });

  if (!result.ok) {
    persistPolicyFailedIfNeeded(result.code, result.message);

    const status = result.code === 'policy_binding_mismatch' ? 409 : 403;
    return res.status(status).json({
      ok: false,
      nonce,
      code: result.code,
      reason: result.reason,
      message: result.message,
      policyStatus: 'POLICY_FAILED',
    });
  }

  persistPolicySatisfiedForRedeemIfNeeded(
    'policy_satisfied',
    `Policy satisfied for region ${result.region} with age ${result.actualAge}.`,
  );

  return res.status(200).json({
    ok: true,
    nonce,
    access: 'policy-satisfied',
    policyStatus: 'POLICY_SATISFIED',
    region: result.region,
    minimumAge: result.minimumAge,
    actualAge: result.actualAge,
  });
});

// Generic edge gateway route: /x402/... (regex because path-to-regexp v6 rejects '/x402/*')
// Example: GET /x402/premium?nonce=...  -> resolves contract for GET /premium
// Example: GET /x402/paid/demo.pdf      -> resolves contract for GET /paid/demo.pdf (matches /paid/*)
app.all(/^\/x402(?:\/.*)?$/, async (req, res) => {
  const pathname = reqPathname(req);
  const resourcePathname = stripX402Prefix(pathname);
  return handleX402(req, res, resourcePathname);
});

// -----------------------------------------------------------------------------
// Fallback 404
// -----------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not found',
    method: req.method,
    url: req.url,
  });
});

// -----------------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------------

app.listen(port, host, () => {
  console.log(`payfi-gateway-demo HTTP server listening on http://${host}:${port}`);
});
