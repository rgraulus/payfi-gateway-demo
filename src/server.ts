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
import {
  type GatedPolicyEvidence,
} from './policyVerifier';
import {
  verifyConcordiumZkpAuthorizationEnvelope,
} from './phase3/concordiumZkpVerifier';
import {
  verifyPhase3Policy,
} from './phase3/policyVerifier';
import {
  validatePhase3DemoChallengeBinding,
} from './phase3/demoChallengeBinding';
import bodyParser from 'body-parser';
import { randomUUID, createHash } from 'crypto';

import { CrpClient, MatchPaymentRequest } from './crpClient';
import { buildPaymentRequiredPayload, b64jsonHeader, ContractDefinition, LoadedContractDefinition } from './contracts';
import { resolveConcordiumChain } from './chainId';
import { FileContractResolver } from './contractResolver';
import { buildSiwChallenge } from './siw/challenge';
import { getSiwChallenge, isSiwChallengeExpired, putSiwChallenge } from './siw/challengeStore';
import { createSiwSession, getSiwSession, isSiwSessionExpired } from './siw/sessionStore';
import { getConcordiumAccountInfo } from './siw/concordiumAccountLookup';
import { getSiwVerifierForChainId } from './siw/registry';
import type { SiwAuthChallenge } from './siw/types';
import type { SiwVerifyProofInput } from './siw/types';
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
import {
  buildPhase3RuntimeVerifiedReceiptDecision,
} from './phase3/runtimeVerifiedReceiptDecision';
import {
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
} from './phase3/x402ReceiptPaymentSignal';

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
const siwSessionTtlSec = Number(process.env.X402_SIW_SESSION_TTL_SEC ?? 3600);
const concordiumGrpcTestnetHost = process.env.CONCORDIUM_GRPC_TESTNET_HOST ?? '127.0.0.1';
const concordiumGrpcTestnetPort = Number(process.env.CONCORDIUM_GRPC_TESTNET_PORT ?? 20000);
const concordiumGrpcMainnetHost = process.env.CONCORDIUM_GRPC_MAINNET_HOST ?? '127.0.0.1';
const concordiumGrpcMainnetPort = Number(process.env.CONCORDIUM_GRPC_MAINNET_PORT ?? 20000);

// Phase 3 Gateway policy gate skeleton.
// OFF by default. This prevents the existing /paid-gated demo path from becoming
// active unless explicitly enabled for controlled Phase 3 testing.
const phase3GatewayPolicyGateEnabled =
  String(process.env.PHASE3_GATEWAY_POLICY_GATE_ENABLED ?? '').toLowerCase() === 'true';

// Phase 3 Gateway release seam.
// OFF by default. PR #129 exposes the seam but does not enable runtime release.
const phase3GatewayReleaseEnabled =
  String(process.env.PHASE3_GATEWAY_RELEASE_ENABLED ?? '').toLowerCase() === 'true';

// Phase 3 test-only release guard.
// OFF by default. PR #130A proves the release flag alone is insufficient.
const phase3GatewayTestReleaseOnly =
  String(process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY ?? '').toLowerCase() === 'true';

// Phase 3 production release switch seam.
// OFF by default. PR #173 exposes the explicit production-release switch,
// but intentionally does not authorize production release yet.
const phase3GatewayProductionReleaseEnabled =
  String(process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED ?? '').toLowerCase() === 'true';

// Phase 3 production release dry-run audit seam.
// OFF by default. PR #178 exposes a would-execute audit signal only.
// This does not authorize production release or CRP fulfill.
const phase3GatewayProductionReleaseDryRunEnabled =
  String(process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED ?? '').toLowerCase() === 'true';

// PR #100 demo controls.
// Both remain conservative by default:
// - parsed-only policy satisfaction is NOT accepted unless explicitly enabled.
// - live ZKP verification is NOT required until explicitly enabled by a later PR.
const phase3AllowParsedOnlyPolicy =
  String(process.env.PHASE3_ALLOW_PARSED_ONLY_POLICY ?? '').toLowerCase() === 'true';
const phase3RequireLiveZkp =
  String(process.env.PHASE3_REQUIRE_LIVE_ZKP ?? '').toLowerCase() === 'true';

// Test-only fault injection used by the Phase 3 negative release harness.
// This must never be active in production and is additionally guarded by
// PHASE3_GATEWAY_TEST_RELEASE_ONLY at the enforcement site.
const phase3TestForceRuntimeDecisionContextMismatch =
  String(process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH ?? '').toLowerCase() === 'true';

// PR #100 demo requirement, aligned with existing Phase 3 harness fixtures.
// Do not treat this as production policy discovery; live policy derivation belongs in a later PR.
const phase3DirectBuyerDemoRequirement = {
  policyId: 'age-region-v1',
  policyVersion: '1.0.0',
  requirementsHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};


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

const SIW_SESSION_HEADER = 'x-siw-session-id';

// Load contracts once at startup via resolver (fail fast if frozen mismatch)
let contractResolver: ContractResolver;
let contracts: LoadedContractDefinition[] = [];

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

function normalizeSiwMessage(value: string): string {
  return String(value).replace(/\r\n/g, '\n');
}

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

function toContractBinding(c: LoadedContractDefinition): ContractBinding {
  return {
    contractId: c.contractId,
    contractVersion: c.contractVersion,
    isFrozen: c.isFrozen,
    merchantId: c.merchantId,
    resource: { method: toHttpMethod(c.resource.method), path: c.resource.path },
    chain_id: c.chain_id,
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
      chain_id: c.chain_id,
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
    phase3: {
      gatewayPolicyGateEnabled: phase3GatewayPolicyGateEnabled,
      gatewayReleaseEnabled: phase3GatewayReleaseEnabled,
      gatewayTestReleaseOnly: phase3GatewayTestReleaseOnly,
      gatewayProductionReleaseEnabled: phase3GatewayProductionReleaseEnabled,
      gatewayProductionReleaseDryRunEnabled: phase3GatewayProductionReleaseDryRunEnabled,
      allowParsedOnlyPolicy: phase3AllowParsedOnlyPolicy,
      requireLiveZkp: phase3RequireLiveZkp,
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

function buildPolicyRequirements(contract: LoadedContractDefinition): Record<string, unknown> | null {
  const c: any = contract;
  if (c.policyRequired !== true) return null;

  const policy = c.policy ?? null;

  return {
    required: true,
    policyVersion: c.policyVersion ?? policy?.version ?? 'v1',
    policyKind: policy?.kind ?? 'unknown',
    rules: Array.isArray(policy?.rules) ? policy.rules : [],
    acceptedProofTypes: [
      'policy_evidence_v1',
      'agent_attestation_v1',
      'concordium_zkp_v1',
    ],
    ext: policy?.ext ?? {},
  };
}

function isPhase3GatewayPolicyGatePath(resourcePathname: string): boolean {
  return resourcePathname === '/paid-gated';
}

function replyPhase3GatewayPolicyGateDisabled(res: express.Response) {
  return res.status(404).json({
    ok: false,
    code: 'phase3_gateway_policy_gate_disabled',
    reason: 'phase3_gateway_policy_gate_disabled',
    message:
      'Phase 3 Gateway policy gate is disabled. Set PHASE3_GATEWAY_POLICY_GATE_ENABLED=true to enable this experimental path.',
    phase3: {
      gatewayPolicyGateEnabled: false,
    },
  });
}

async function handleX402(req: express.Request, res: express.Response, resourcePathname: string) {
  if (isPhase3GatewayPolicyGatePath(resourcePathname) && !phase3GatewayPolicyGateEnabled) {
    return replyPhase3GatewayPolicyGateDisabled(res);
  }

  // Resolve contract based on the underlying resource path (e.g. /premium or /paid/demo.pdf)
  let contract: LoadedContractDefinition;
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
    const chain = resolveConcordiumChain(contract.network);

    const policyRequirements = buildPolicyRequirements(contract);

    paymentRequiredHeaderPayload = {
      ...buildPaymentRequiredPayload({
        contract,
        nonce,
        issuedAtSec: nowSec,
        expiresAtSec: nowSec + ttlSec,
      }),
      chain_id: contract.chain_id,
      ...(policyRequirements ? { policyRequirements } : {}),
    };

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

  // Helper to issue a "payment required" response consistently.
  //
  // Generic x402 402 issuance remains best-effort: persistence is started
  // asynchronously so existing unpaid/payment-retry behavior stays unchanged.
  const reply402 = (body: any) => {
    void persistIssuedChallengeIfNeeded();
    res.setHeader('PAYMENT-REQUIRED', prB64);
    if (legacyHeaders) res.setHeader('X-PAYMENT-REQUIRED', prB64);
    return res.status(402).json(body);
  };

  // Guarded Phase 3 resources depend on canonical challenge state for policy
  // readiness and release decisions. For /paid-gated, make the normal 402
  // issuance path explicit: persist the canonical challenge before returning
  // PAYMENT-REQUIRED. The subsequent reply402() call reuses the same promise.
  const reply402AfterPersistingIssuedChallengeIfGated = async (body: any) => {
    if (resourcePathname === '/paid-gated') {
      await persistIssuedChallengeIfNeeded();
    }

    return reply402(body);
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

  const getGatedAuthorizationReadiness = async (): Promise<
    | {
        ok: true;
        status: 'POLICY_SATISFIED';
        challengeId?: string;
        releaseStatus?: string;
      }
    | {
        ok: false;
        reason: 'missing_canonical_challenge' | 'policy_not_satisfied';
        status?: string;
        challengeId?: string;
        releaseStatus?: string;
      }
  > => {
    const challenge = await getChallengeStatusByNonce(nonce);

    if (!challenge.found) {
      return {
        ok: false,
        reason: 'missing_canonical_challenge',
      };
    }

    if (challenge.status !== 'POLICY_SATISFIED') {
      return {
        ok: false,
        reason: 'policy_not_satisfied',
        status: challenge.status,
        challengeId: challenge.challengeId,
        releaseStatus: challenge.releaseStatus,
      };
    }

    return {
      ok: true,
      status: 'POLICY_SATISFIED',
      challengeId: challenge.challengeId,
      releaseStatus: challenge.releaseStatus,
    };
  };

  const requirePolicySatisfiedIfGated = async (): Promise<
    | { ok: true }
    | { ok: false; responseSent: true }
  > => {
    if (resourcePathname !== '/paid-gated') {
      return { ok: true };
    }

    const readiness = await getGatedAuthorizationReadiness();

    if (!readiness.ok && readiness.reason === 'missing_canonical_challenge') {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Missing canonical challenge for gated route',
        ...(x402Debug ? { debug: { reason: readiness.reason } } : {}),
      });
      return { ok: false, responseSent: true };
    }

    if (!readiness.ok) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Policy requirements not yet satisfied',
        ...(x402Debug
          ? {
              debug: {
                reason: readiness.reason,
                challengeStatus: readiness.status,
                challengeId: readiness.challengeId,
                releaseStatus: readiness.releaseStatus,
              },
            }
          : {}),
      });
      return { ok: false, responseSent: true };
    }

    return { ok: true };
  };

  const maybeServePhase3SyntheticTestRelease = async (): Promise<boolean> => {
    if (resourcePathname !== '/paid-gated') {
      return false;
    }

    if (!phase3GatewayReleaseEnabled || !phase3GatewayTestReleaseOnly) {
      return false;
    }

    const phase3RuntimeReceiptRequired = true;

    if (phase3RuntimeReceiptRequired && !clientReceiptJws) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Verified x402 receipt required before guarded Phase 3 runtime release',
        phase3: {
          gatewayPolicyGateEnabled: phase3GatewayPolicyGateEnabled,
          gatewayReleaseEnabled: phase3GatewayReleaseEnabled,
          gatewayTestReleaseOnly: phase3GatewayTestReleaseOnly,
          gatewayProductionReleaseEnabled: phase3GatewayProductionReleaseEnabled,
          runtimeReceiptRequired: true,
          receiptSignalPresent: false,
        },
        runtimeReleaseRecognition: {
          recognized: true,
          releaseDecisionRecognized: false,
          guardSatisfied:
            phase3GatewayReleaseEnabled === true && phase3GatewayTestReleaseOnly === true,
          blockedBy: 'missing_x402_receipt_signal',
          productionReleaseSwitchEnabled: phase3GatewayProductionReleaseEnabled,
          productionRelease: false,
          paymentResponseAllowed: false,
          resourceReleaseAllowed: false,
        },
        safety: {
          paymentResponseEmitted: false,
          crpCalled: false,
          crpFulfillCalled: false,
          replayTouched: false,
          canonicalReleasePersisted: false,
          rawProofPrinted: false,
          rawReceiptPrinted: false,
        },
      });
      return true;
    }

    if (phase3RuntimeReceiptRequired && clientReceiptJws) {
      return false;
    }

    const readiness = await getGatedAuthorizationReadiness();

    if (!readiness.ok && readiness.reason === 'missing_canonical_challenge') {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Missing canonical challenge for gated route',
        ...(x402Debug ? { debug: { reason: readiness.reason } } : {}),
      });
      return true;
    }

    if (!readiness.ok) {
      reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Policy requirements not yet satisfied',
        ...(x402Debug
          ? {
              debug: {
                reason: readiness.reason,
                challengeStatus: readiness.status,
                challengeId: readiness.challengeId,
                releaseStatus: readiness.releaseStatus,
              },
            }
          : {}),
      });
      return true;
    }

    res.status(200).json({
      ok: true,
      paid: true,
      nonce,
      access: 'phase3-synthetic-test-release',
      resource: '/paid-gated',
      synthetic: true,
      phase3: {
        gatewayPolicyGateEnabled: phase3GatewayPolicyGateEnabled,
        gatewayReleaseEnabled: phase3GatewayReleaseEnabled,
        gatewayTestReleaseOnly: phase3GatewayTestReleaseOnly,
        gatewayProductionReleaseEnabled: phase3GatewayProductionReleaseEnabled,
        guardedRuntimeReleaseRecognition: {
          recognized: true,
          releaseDecisionRecognized: true,
          guardSatisfied:
            phase3GatewayReleaseEnabled === true && phase3GatewayTestReleaseOnly === true,
          guard: 'PHASE3_GATEWAY_RELEASE_ENABLED && PHASE3_GATEWAY_TEST_RELEASE_ONLY',
          mode: 'synthetic-test-only',
          productionReleaseSwitchEnabled: phase3GatewayProductionReleaseEnabled,
          productionRelease: false,
          realReceiptRequiredBeforeProductionRelease: true,
        },
      },
      policy: {
        status: readiness.status,
        challengeId: readiness.challengeId ?? null,
        releaseStatus: readiness.releaseStatus ?? null,
      },
      runtimeReleaseRecognition: {
        recognized: true,
        releaseDecisionRecognized: true,
        guardSatisfied:
          phase3GatewayReleaseEnabled === true && phase3GatewayTestReleaseOnly === true,
        mode: 'synthetic-test-only',
        productionReleaseSwitchEnabled: phase3GatewayProductionReleaseEnabled,
        productionRelease: false,
        paymentResponseAllowed: false,
        resourceReleaseAllowed: true,
      },
      safety: {
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
    });

    return true;
  };

  if (await maybeServePhase3SyntheticTestRelease()) {
    return;
  }

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

  type CanonicalReleasePersistenceResult = {
    ok: boolean;
    canonicalReleasePersisted: boolean;
    reason: string;
    releaseReason: string | null;
    entryReason?: string | null;
    outcomeReason?: string | null;
  };

  const finalizeSuccessfulSettlementAndRelease = async (args: {
    receiptJws: string;
    settlementReasonMessage: string;
  }): Promise<CanonicalReleasePersistenceResult> => {
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

      const canonicalReleasePersisted =
        release.updated === true || release.reason === 'already_in_target';

      return {
        ok: canonicalReleasePersisted,
        canonicalReleasePersisted,
        reason: canonicalReleasePersisted
          ? 'canonical_release_persisted'
          : 'canonical_release_not_persisted',
        releaseReason: release.reason,
        entryReason: entry.reason,
        outcomeReason: outcome.reason,
      };
    } catch (err) {
      console.error('Failed to finalize settlement and release:', err);

      return {
        ok: false,
        canonicalReleasePersisted: false,
        reason: 'canonical_release_persistence_error',
        releaseReason: null,
      };
    }
  };

  const paymentResponseHeaderPayloadBase = (args: { receiptJws: string; proof: any }) => ({
    version: 'x402-v2',
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    merchantId: contract.merchantId,
    resource: contract.resource,
    chain_id: contract.chain_id,
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

  const phase3RuntimeVerifiedReceiptDecisionDebug = (
    proof: any,
    args: {
      enforced?: boolean;
      canonicalReleasePersistenceResult?: CanonicalReleasePersistenceResult | null;
    } = {},
  ) => {
    assertCcdPltProofV1(proof);

    const expectedContext = deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

    if (
      args.enforced === true &&
      resourcePathname === '/paid-gated' &&
      phase3GatewayTestReleaseOnly &&
      phase3TestForceRuntimeDecisionContextMismatch &&
      !isProd
    ) {
      expectedContext.nonce = `${expectedContext.nonce}:forced-phase3-runtime-mismatch`;
    }

    const decision = buildPhase3RuntimeVerifiedReceiptDecision({
      readiness: {
        ok: true,
        status: 'POLICY_SATISFIED',
        challengeId: nonce,
        releaseStatus: 'POLICY_SATISFIED',
      },
      proof,
      nowSec,
      expectedContext,
    });

    const decisionAny = decision as any;

    const productionReleaseCandidate =
      decision.ok === true &&
      decision.paymentResponseAllowed === true &&
      decision.resourceReleaseAllowed === true;

    const productionReleaseEligible =
      productionReleaseCandidate === true &&
      phase3GatewayProductionReleaseEnabled === true;

    const canonicalReleasePersistenceRequired =
      productionReleaseEligible === true;

    const canonicalReleasePersistenceSucceeded =
      args.canonicalReleasePersistenceResult?.canonicalReleasePersisted === true;

    const canonicalReleasePersistenceReady =
      canonicalReleasePersistenceRequired === true &&
      canonicalReleasePersistenceSucceeded === true;

    const canonicalReleasePersistedForProduction =
      canonicalReleasePersistenceRequired === true &&
      canonicalReleasePersistenceSucceeded === true;

    const productionReleaseExecutionPreflightRequired =
      canonicalReleasePersistenceReady === true;

    const productionReleaseExecutionMode = ((): 'disabled' | 'dry_run' | 'enabled' => {
      if (
        productionReleaseExecutionPreflightRequired === true &&
        phase3GatewayProductionReleaseDryRunEnabled === true
      ) {
        return 'dry_run';
      }

      return 'disabled';
    })();

    const productionReleaseDryRun =
      productionReleaseExecutionPreflightRequired === true &&
      productionReleaseExecutionMode === 'dry_run';

    const productionReleaseWouldExecute =
      productionReleaseDryRun === true;

    const productionReleaseDryRunAuditEvent =
      productionReleaseWouldExecute === true;

    const productionReleaseDryRunReason =
      productionReleaseDryRunAuditEvent === true
        ? 'production_release_would_execute'
        : null;

    const productionReleaseAdapterRequired =
      productionReleaseWouldExecute === true;

    const productionReleaseAdapterMode =
      productionReleaseAdapterRequired === true ? 'contract_only' : 'inactive';

    const productionReleaseAdapterReady = false;

    const productionReleaseAdapterWouldInvoke =
      productionReleaseAdapterRequired === true;

    const productionReleaseAdapterInvoked = false;

    const productionReleaseAdapterBlockedBy =
      productionReleaseAdapterRequired === true
        ? 'production_release_adapter_disabled'
        : null;

    const productionReleaseAdapterInputContract =
      productionReleaseAdapterRequired === true
        ? 'phase3.productionReleaseAdapter.input.v1'
        : null;

    const productionReleaseAdapterInputBuilt =
      productionReleaseAdapterRequired === true;

    const productionReleaseAdapterInputReady =
      productionReleaseAdapterInputBuilt === true;

    const productionReleaseAdapterInputBlockedBy =
      productionReleaseAdapterRequired === true && productionReleaseAdapterInputReady !== true
        ? 'production_release_adapter_input_not_ready'
        : null;

    const productionReleaseAdapterInputSanitized =
      productionReleaseAdapterInputBuilt === true;

    const productionReleaseAdapterInputJwsIncluded = false;

    const productionReleaseAdapterInputPreview =
      productionReleaseAdapterInputBuilt === true
        ? {
            contract: 'phase3.productionReleaseAdapter.input.v1',
            release: {
              mode: 'dry_run',
              wouldExecute: true,
              adapterMode: productionReleaseAdapterMode,
            },
            challenge: {
              nonce,
              challengeId: nonce,
            },
            resource: {
              method: proof.contract.resource.method,
              path: proof.contract.resource.path,
            },
            merchant: {
              merchantId: proof.contract.merchantId,
              payTo: expectedContext.payTo,
            },
            contractBinding: {
              contractId: proof.contract.contractId,
              contractVersion: proof.contract.contractVersion,
              isFrozen: proof.contract.isFrozen,
            },
            payment: {
              network: expectedContext.network,
              asset: expectedContext.asset,
              amount: expectedContext.amount,
              amountRaw: proof.paymentEvent.amountRaw,
            },
            receipt: {
              proofVersion: proof.proofVersion,
              settlementStatus: proof.settlement.status,
              txHash: null,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              productionReleaseAuthorized: false,
              adapterInvoked: false,
              crpFulfillCalled: false,
            },
          }
        : null;

    const productionReleaseAdapterRawProofIncluded = false;

    const productionReleaseAdapterRawReceiptIncluded = false;

    const productionReleaseAdapterNoopFunctionAvailable =
      productionReleaseAdapterInputBuilt === true;

    const productionReleaseAdapterNoopResultObserved =
      productionReleaseAdapterNoopFunctionAvailable === true;

    const productionReleaseAdapterNoopResultStatus =
      productionReleaseAdapterNoopResultObserved === true ? 'disabled' : 'inactive';

    const productionReleaseAdapterNoopResultReason =
      productionReleaseAdapterNoopResultObserved === true
        ? 'production_release_adapter_disabled'
        : null;

    const productionReleaseAdapterNoopSideEffectFree = true;

    const productionReleaseAdapterExternalCallAttempted = false;

    const productionReleaseAdapterNoopResult =
      productionReleaseAdapterNoopResultObserved === true
        ? {
            ok: false,
            status: 'disabled',
            reason: 'production_release_adapter_disabled',
            inputContract: productionReleaseAdapterInputContract,
            inputBuilt: productionReleaseAdapterInputBuilt,
            inputReady: productionReleaseAdapterInputReady,
            inputSanitized: productionReleaseAdapterInputSanitized,
            inputJwsIncluded: productionReleaseAdapterInputJwsIncluded,
            adapterInvoked: false,
            externalCallAttempted: false,
            productionReleaseAuthorized: false,
            crpFulfillCalled: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseAdapterDecisionObserved =
      productionReleaseAdapterNoopResultObserved === true;

    const productionReleaseAdapterDecisionStatus =
      productionReleaseAdapterDecisionObserved === true ? 'blocked' : 'inactive';

    const productionReleaseAdapterDecisionReason =
      productionReleaseAdapterDecisionObserved === true
        ? productionReleaseAdapterNoopResultReason
        : null;

    const productionReleaseAdapterDecisionBlockedBy =
      productionReleaseAdapterDecisionObserved === true
        ? productionReleaseAdapterNoopResultReason
        : null;

    const productionReleaseAdapterDecisionAllowsProductionRelease = false;

    const productionReleaseAdapterDecisionSideEffectFree =
      productionReleaseAdapterNoopSideEffectFree === true &&
      productionReleaseAdapterExternalCallAttempted === false &&
      productionReleaseAdapterInvoked === false;

    const productionReleaseAdapterDryRunInvocationRequired =
      productionReleaseAdapterDecisionObserved === true &&
      productionReleaseAdapterDecisionStatus === 'blocked' &&
      productionReleaseDryRun === true &&
      productionReleaseWouldExecute === true;

    const productionReleaseAdapterDryRunInvocationObserved =
      productionReleaseAdapterDryRunInvocationRequired === true;

    const productionReleaseAdapterDryRunInvocationMode =
      productionReleaseAdapterDryRunInvocationObserved === true ? 'dry_run' : 'inactive';

    const productionReleaseAdapterDryRunInvocationStatus =
      productionReleaseAdapterDryRunInvocationObserved === true ? 'would_invoke' : 'inactive';

    const productionReleaseAdapterDryRunInvocationReason =
      productionReleaseAdapterDryRunInvocationObserved === true
        ? 'production_release_adapter_dry_run_would_invoke'
        : null;

    const productionReleaseAdapterDryRunInvocationExternalCallAttempted = false;

    const productionReleaseAdapterDryRunInvocationSideEffectFree =
      productionReleaseAdapterDryRunInvocationExternalCallAttempted === false &&
      productionReleaseAdapterInvoked === false &&
      productionReleaseAdapterExternalCallAttempted === false;

    const productionReleaseAdapterDryRunInvocationResult =
      productionReleaseAdapterDryRunInvocationObserved === true
        ? {
            ok: false,
            status: 'would_invoke',
            reason: 'production_release_adapter_dry_run_would_invoke',
            mode: 'dry_run',
            adapterDecisionStatus: productionReleaseAdapterDecisionStatus,
            adapterDecisionReason: productionReleaseAdapterDecisionReason,
            inputContract: productionReleaseAdapterInputContract,
            inputBuilt: productionReleaseAdapterInputBuilt,
            inputReady: productionReleaseAdapterInputReady,
            inputSanitized: productionReleaseAdapterInputSanitized,
            inputJwsIncluded: productionReleaseAdapterInputJwsIncluded,
            adapterInvoked: false,
            externalCallAttempted: false,
            productionReleaseAuthorized: false,
            crpFulfillCalled: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseAdapterDryRunInvocationReceiptEmitted =
      productionReleaseAdapterDryRunInvocationObserved === true &&
      productionReleaseAdapterDryRunInvocationResult !== null;

    const productionReleaseAdapterDryRunInvocationReceiptContract =
      productionReleaseAdapterDryRunInvocationReceiptEmitted === true
        ? 'phase3.productionReleaseAdapter.dryRunInvocationReceipt.v1'
        : null;

    const productionReleaseAdapterDryRunInvocationReceiptReason =
      productionReleaseAdapterDryRunInvocationReceiptEmitted === true
        ? 'production_release_adapter_dry_run_invocation_recorded'
        : null;

    const productionReleaseAdapterDryRunInvocationReceiptSideEffectFree =
      productionReleaseAdapterDryRunInvocationReceiptEmitted === true
        ? productionReleaseAdapterDryRunInvocationSideEffectFree === true &&
          productionReleaseAdapterDryRunInvocationExternalCallAttempted === false &&
          productionReleaseAdapterInvoked === false &&
          productionReleaseAdapterExternalCallAttempted === false
        : true;

    const productionReleaseAdapterDryRunInvocationReceipt =
      productionReleaseAdapterDryRunInvocationReceiptEmitted === true
        ? {
            contract: productionReleaseAdapterDryRunInvocationReceiptContract,
            mode: 'dry_run',
            status: 'recorded',
            reason: productionReleaseAdapterDryRunInvocationReceiptReason,
            adapter: {
              decisionStatus: productionReleaseAdapterDecisionStatus,
              decisionReason: productionReleaseAdapterDecisionReason,
              invocationStatus: productionReleaseAdapterDryRunInvocationStatus,
              invocationReason: productionReleaseAdapterDryRunInvocationReason,
            },
            input: {
              contract: productionReleaseAdapterInputContract,
              built: productionReleaseAdapterInputBuilt,
              ready: productionReleaseAdapterInputReady,
              sanitized: productionReleaseAdapterInputSanitized,
              jwsIncluded: productionReleaseAdapterInputJwsIncluded,
              rawProofIncluded: productionReleaseAdapterRawProofIncluded,
              rawReceiptIncluded: productionReleaseAdapterRawReceiptIncluded,
            },
            safety: {
              adapterInvoked: false,
              externalCallAttempted: false,
              productionReleaseAuthorized: false,
              crpFulfillCalled: false,
              sideEffectFree: productionReleaseAdapterDryRunInvocationReceiptSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillRequestDraftRequired =
      productionReleaseWouldExecute === true &&
      productionReleaseAdapterDryRunInvocationReceiptEmitted === true;

    const productionReleaseCrpFulfillRequestDraftBuilt =
      productionReleaseCrpFulfillRequestDraftRequired === true &&
      productionReleaseAdapterInputPreview !== null &&
      productionReleaseAdapterInputSanitized === true &&
      productionReleaseAdapterInputJwsIncluded === false &&
      productionReleaseAdapterRawProofIncluded === false &&
      productionReleaseAdapterRawReceiptIncluded === false;

    const productionReleaseCrpFulfillRequestDraftContract =
      productionReleaseCrpFulfillRequestDraftBuilt === true
        ? 'phase3.productionRelease.crpFulfillRequestDraft.v1'
        : null;

    const productionReleaseCrpFulfillRequestDraftReason =
      productionReleaseCrpFulfillRequestDraftBuilt === true
        ? 'production_release_crp_fulfill_request_draft_built'
        : null;

    const productionReleaseCrpFulfillRequestDraftSanitized =
      productionReleaseCrpFulfillRequestDraftBuilt === true
        ? productionReleaseAdapterInputSanitized === true &&
          productionReleaseAdapterInputJwsIncluded === false &&
          productionReleaseAdapterRawProofIncluded === false &&
          productionReleaseAdapterRawReceiptIncluded === false
        : true;

    const productionReleaseCrpFulfillRequestDraftExternalCallAttempted = false;
    const productionReleaseCrpFulfillRequestDraftCrpCalled = false;
    const productionReleaseCrpFulfillRequestDraftCrpFulfillCalled = false;

    const productionReleaseCrpFulfillRequestDraft =
      productionReleaseCrpFulfillRequestDraftBuilt === true
        ? {
            contract: productionReleaseCrpFulfillRequestDraftContract,
            mode: 'dry_run',
            status: 'drafted',
            reason: productionReleaseCrpFulfillRequestDraftReason,
            target: {
              service: 'crp',
              operation: 'fulfill',
              method: 'POST',
              path: '/v1/crp/payments/fulfill',
            },
            request: {
              challengeId: productionReleaseAdapterInputPreview.challenge.challengeId,
              nonce: productionReleaseAdapterInputPreview.challenge.nonce,
              resource: {
                method: productionReleaseAdapterInputPreview.resource.method,
                path: productionReleaseAdapterInputPreview.resource.path,
              },
              merchant: {
                merchantId: productionReleaseAdapterInputPreview.merchant.merchantId,
                payTo: productionReleaseAdapterInputPreview.merchant.payTo,
              },
              contractBinding: {
                contractId: productionReleaseAdapterInputPreview.contractBinding.contractId,
                contractVersion: productionReleaseAdapterInputPreview.contractBinding.contractVersion,
                isFrozen: productionReleaseAdapterInputPreview.contractBinding.isFrozen,
              },
              payment: {
                network: productionReleaseAdapterInputPreview.payment.network,
                asset: productionReleaseAdapterInputPreview.payment.asset,
                amount: productionReleaseAdapterInputPreview.payment.amount,
                amountRaw: productionReleaseAdapterInputPreview.payment.amountRaw,
              },
              receipt: {
                proofVersion: productionReleaseAdapterInputPreview.receipt.proofVersion,
                settlementStatus: productionReleaseAdapterInputPreview.receipt.settlementStatus,
                txHash: productionReleaseAdapterInputPreview.receipt.txHash,
              },
            },
            source: {
              adapterInputContract: productionReleaseAdapterInputContract,
              adapterReceiptContract: productionReleaseAdapterDryRunInvocationReceiptContract,
              adapterReceiptReason: productionReleaseAdapterDryRunInvocationReceiptReason,
            },
            safety: {
              sanitized: productionReleaseCrpFulfillRequestDraftSanitized,
              jwsIncluded: false,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              adapterInvoked: false,
              externalCallAttempted: false,
              crpCalled: productionReleaseCrpFulfillRequestDraftCrpCalled,
              crpFulfillCalled: productionReleaseCrpFulfillRequestDraftCrpFulfillCalled,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillRequestDraftExternalCallAttempted === false &&
                productionReleaseCrpFulfillRequestDraftCrpCalled === false &&
                productionReleaseCrpFulfillRequestDraftCrpFulfillCalled === false,
            },
          }
        : null;

    const productionReleaseCrpFulfillRequestValidationRequired =
      productionReleaseCrpFulfillRequestDraftBuilt === true &&
      productionReleaseCrpFulfillRequestDraft !== null;

    const productionReleaseCrpFulfillRequestValidationErrors: string[] = [];

    if (productionReleaseCrpFulfillRequestValidationRequired === true) {
      const draft = productionReleaseCrpFulfillRequestDraft as any;

      const validationChecks: Array<[string, boolean]> = [
        ['contract_mismatch', draft?.contract === 'phase3.productionRelease.crpFulfillRequestDraft.v1'],
        ['mode_mismatch', draft?.mode === 'dry_run'],
        ['status_mismatch', draft?.status === 'drafted'],
        ['target_service_mismatch', draft?.target?.service === 'crp'],
        ['target_operation_mismatch', draft?.target?.operation === 'fulfill'],
        ['target_method_mismatch', draft?.target?.method === 'POST'],
        ['target_path_mismatch', draft?.target?.path === '/v1/crp/payments/fulfill'],
        ['missing_challenge_id', typeof draft?.request?.challengeId === 'string' && draft.request.challengeId.length > 0],
        ['missing_nonce', typeof draft?.request?.nonce === 'string' && draft.request.nonce.length > 0],
        ['resource_method_mismatch', draft?.request?.resource?.method === 'GET'],
        ['resource_path_mismatch', draft?.request?.resource?.path === '/paid-gated'],
        ['merchant_id_mismatch', draft?.request?.merchant?.merchantId === 'demo-merchant'],
        ['missing_pay_to', typeof draft?.request?.merchant?.payTo === 'string' && draft.request.merchant.payTo.length > 0],
        ['missing_contract_id', typeof draft?.request?.contractBinding?.contractId === 'string' && draft.request.contractBinding.contractId.length > 0],
        ['contract_version_mismatch', draft?.request?.contractBinding?.contractVersion === '1.0.0'],
        ['contract_not_frozen', draft?.request?.contractBinding?.isFrozen === true],
        ['network_mismatch', draft?.request?.payment?.network === 'concordium:testnet'],
        ['asset_type_mismatch', draft?.request?.payment?.asset?.type === 'PLT'],
        ['asset_token_mismatch', draft?.request?.payment?.asset?.tokenId === 'EUDemo'],
        ['asset_decimals_mismatch', draft?.request?.payment?.asset?.decimals === 6],
        ['amount_mismatch', draft?.request?.payment?.amount === '0.050101'],
        ['amount_raw_mismatch', draft?.request?.payment?.amountRaw === '50101'],
        ['receipt_proof_version_mismatch', draft?.request?.receipt?.proofVersion === 'ccd-plt-proof@v1'],
        ['receipt_settlement_status_mismatch', draft?.request?.receipt?.settlementStatus === 'finalized'],
        ['safety_not_sanitized', draft?.safety?.sanitized === true],
        ['jws_included', draft?.safety?.jwsIncluded === false],
        ['raw_proof_included', draft?.safety?.rawProofIncluded === false],
        ['raw_receipt_included', draft?.safety?.rawReceiptIncluded === false],
        ['adapter_invoked', draft?.safety?.adapterInvoked === false],
        ['external_call_attempted', draft?.safety?.externalCallAttempted === false],
        ['crp_called', draft?.safety?.crpCalled === false],
        ['crp_fulfill_called', draft?.safety?.crpFulfillCalled === false],
        ['production_release_authorized', draft?.safety?.productionReleaseAuthorized === false],
        ['production_release_true', draft?.safety?.productionRelease === false],
        ['side_effect_not_free', draft?.safety?.sideEffectFree === true],
      ];

      for (const [error, ok] of validationChecks) {
        if (!ok) {
          productionReleaseCrpFulfillRequestValidationErrors.push(error);
        }
      }
    }

    const productionReleaseCrpFulfillRequestValidationStatus =
      productionReleaseCrpFulfillRequestValidationRequired !== true
        ? 'inactive'
        : productionReleaseCrpFulfillRequestValidationErrors.length === 0
          ? 'valid'
          : 'invalid';

    const productionReleaseCrpFulfillRequestValidationReason =
      productionReleaseCrpFulfillRequestValidationStatus === 'valid'
        ? 'production_release_crp_fulfill_request_validation_valid'
        : productionReleaseCrpFulfillRequestValidationStatus === 'invalid'
          ? 'production_release_crp_fulfill_request_validation_failed'
          : null;

    const productionReleaseCrpFulfillRequestValidationReady =
      productionReleaseCrpFulfillRequestValidationRequired === true &&
      productionReleaseCrpFulfillRequestValidationStatus === 'valid';

    const productionReleaseCrpFulfillRequestValidationSideEffectFree =
      productionReleaseCrpFulfillRequestDraftExternalCallAttempted === false &&
      productionReleaseCrpFulfillRequestDraftCrpCalled === false &&
      productionReleaseCrpFulfillRequestDraftCrpFulfillCalled === false;

    const productionReleaseCrpFulfillExecutionRequired =
      productionReleaseCrpFulfillRequestValidationReady === true;

    const productionReleaseCrpFulfillExecutionClientAvailable =
      productionReleaseCrpFulfillExecutionRequired === true;

    const productionReleaseCrpFulfillExecutionMode = 'disabled';

    const productionReleaseCrpFulfillExecutionReady: boolean = false;

    const productionReleaseCrpFulfillExecutionBlockedBy =
      productionReleaseCrpFulfillExecutionRequired === true
        ? 'production_release_crp_fulfill_execution_disabled'
        : null;

    const productionReleaseCrpFulfillExecutionRecognizedButNotExecuted =
      productionReleaseCrpFulfillExecutionRequired === true;

    const productionReleaseCrpFulfillExecutionExternalCallAttempted = false;
    const productionReleaseCrpFulfillExecutionCrpCalled = false;
    const productionReleaseCrpFulfillExecutionCrpFulfillCalled = false;

    const productionReleaseCrpFulfillExecutionSideEffectFree =
      productionReleaseCrpFulfillExecutionExternalCallAttempted === false &&
      productionReleaseCrpFulfillExecutionCrpCalled === false &&
      productionReleaseCrpFulfillExecutionCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterScaffoldRequired =
      productionReleaseCrpFulfillExecutionRequired === true;

    const productionReleaseCrpFulfillClientAdapterScaffoldAvailable =
      productionReleaseCrpFulfillClientAdapterScaffoldRequired === true;

    const productionReleaseCrpFulfillClientAdapterScaffoldMode = 'disabled';

    const productionReleaseCrpFulfillClientAdapterScaffoldReady: boolean = false;

    const productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy =
      productionReleaseCrpFulfillClientAdapterScaffoldRequired === true
        ? 'production_release_crp_fulfill_client_adapter_scaffold_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterScaffoldWouldCall =
      productionReleaseCrpFulfillClientAdapterScaffoldRequired === true;

    const productionReleaseCrpFulfillClientAdapterScaffoldCalled = false;
    const productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree =
      productionReleaseCrpFulfillClientAdapterScaffoldCalled === false &&
      productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterContractRequired =
      productionReleaseCrpFulfillClientAdapterScaffoldRequired === true;

    const productionReleaseCrpFulfillClientAdapterContractAvailable =
      productionReleaseCrpFulfillClientAdapterContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterContract =
      productionReleaseCrpFulfillClientAdapterContractRequired === true
        ? 'phase3.productionRelease.crpFulfillClientAdapter.contract.v1'
        : null;

    const productionReleaseCrpFulfillClientAdapterContractMode =
      productionReleaseCrpFulfillClientAdapterContractRequired === true
        ? 'contract_only'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterContractReady: boolean = false;

    const productionReleaseCrpFulfillClientAdapterContractBlockedBy =
      productionReleaseCrpFulfillClientAdapterContractRequired === true
        ? 'production_release_crp_fulfill_client_adapter_contract_only'
        : null;

    const productionReleaseCrpFulfillClientAdapterContractInputRequired =
      productionReleaseCrpFulfillClientAdapterContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterContractResultRequired =
      productionReleaseCrpFulfillClientAdapterContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterContractInvoked = false;
    const productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterContractCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterContractSideEffectFree =
      productionReleaseCrpFulfillClientAdapterContractInvoked === false &&
      productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterContractCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterInputRequired =
      productionReleaseCrpFulfillClientAdapterContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterInputContract =
      productionReleaseCrpFulfillClientAdapterInputRequired === true
        ? 'phase3.productionRelease.crpFulfillClientAdapter.input.v1'
        : null;

    const productionReleaseCrpFulfillClientAdapterInputBuilt =
      productionReleaseCrpFulfillClientAdapterInputRequired === true &&
      productionReleaseCrpFulfillRequestDraftBuilt === true &&
      productionReleaseCrpFulfillRequestValidationReady === true;

    const productionReleaseCrpFulfillClientAdapterInputReady =
      productionReleaseCrpFulfillClientAdapterInputBuilt === true;

    const productionReleaseCrpFulfillClientAdapterInputBlockedBy =
      productionReleaseCrpFulfillClientAdapterInputRequired === true &&
      productionReleaseCrpFulfillClientAdapterInputReady !== true
        ? 'production_release_crp_fulfill_client_adapter_input_not_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterInputSanitized =
      productionReleaseCrpFulfillClientAdapterInputBuilt === true;

    const productionReleaseCrpFulfillClientAdapterInputJwsIncluded = false;
    const productionReleaseCrpFulfillClientAdapterInputRawProofIncluded = false;
    const productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded = false;

    const productionReleaseCrpFulfillClientAdapterInputPreview =
      productionReleaseCrpFulfillClientAdapterInputBuilt === true
        ? {
            contract: productionReleaseCrpFulfillClientAdapterInputContract,
            mode: 'dry_run',
            adapterContract: productionReleaseCrpFulfillClientAdapterContract,
            target: productionReleaseCrpFulfillRequestDraft?.target ?? null,
            request: productionReleaseCrpFulfillRequestDraft?.request ?? null,
            source: {
              crpFulfillRequestDraftContract: productionReleaseCrpFulfillRequestDraftContract,
              crpFulfillRequestValidationStatus: productionReleaseCrpFulfillRequestValidationStatus,
              crpFulfillRequestValidationReason: productionReleaseCrpFulfillRequestValidationReason,
            },
            safety: {
              sanitized: true,
              jwsIncluded: false,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              adapterInvoked: false,
              externalCallAttempted: false,
              crpCalled: false,
              crpFulfillCalled: false,
              productionReleaseAuthorized: false,
              productionRelease: false,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterInputCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterInputSideEffectFree =
      productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterInputCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled === false;

    const productionReleaseExecutionPreflightReady =
      productionReleaseExecutionPreflightRequired === true &&
      productionReleaseExecutionMode === 'dry_run';

    const productionReleaseExecutionBlockedBy =
      productionReleaseCandidate === true && phase3GatewayProductionReleaseEnabled !== true
        ? 'production_release_switch_disabled'
        : canonicalReleasePersistenceRequired === true && !canonicalReleasePersistenceReady
          ? 'canonical_release_persistence_not_ready'
          : productionReleaseExecutionPreflightRequired === true &&
              productionReleaseExecutionPreflightReady !== true
            ? 'production_release_execution_disabled'
            : null;

    const productionReleaseBlockedBy = productionReleaseExecutionBlockedBy;

    return {
      observed: true,
      enforced: args.enforced === true,
      decisionLayerOnly: args.enforced !== true,
      ok: decision.ok,
      readinessOk: decision.readinessOk,
      readinessStatus: decisionAny.readinessStatus ?? null,
      reason: decisionAny.reason ?? decisionAny.decision?.reason ?? null,
      paymentResponseAllowed: decision.paymentResponseAllowed,
      resourceReleaseAllowed: decision.resourceReleaseAllowed,
      productionReleaseSwitchEnabled: phase3GatewayProductionReleaseEnabled,
      productionReleaseSwitchRequired: true,
      productionReleaseCandidate,
      productionReleaseEligible,
      canonicalReleasePersistenceRequired,
      canonicalReleasePersistenceReady,
      canonicalReleasePersistenceReason:
        canonicalReleasePersistenceRequired === true
          ? (args.canonicalReleasePersistenceResult?.reason ?? null)
          : null,
      canonicalReleasePersistenceReleaseReason:
        canonicalReleasePersistenceRequired === true
          ? (args.canonicalReleasePersistenceResult?.releaseReason ?? null)
          : null,
      productionReleaseExecutionPreflightRequired,
      productionReleaseExecutionPreflightReady,
      productionReleaseExecutionMode,
      productionReleaseExecutionBlockedBy,
      productionReleaseExecutionRecognizedButNotExecuted:
        productionReleaseExecutionPreflightRequired === true &&
        productionReleaseExecutionPreflightReady !== true,
      productionReleaseDryRun,
      productionReleaseWouldExecute,
      productionReleaseDryRunAuditEvent,
      productionReleaseDryRunReason,
      productionReleaseAdapterRequired,
      productionReleaseAdapterMode,
      productionReleaseAdapterReady,
      productionReleaseAdapterWouldInvoke,
      productionReleaseAdapterInvoked,
      productionReleaseAdapterBlockedBy,
      productionReleaseAdapterInputContract,
      productionReleaseAdapterInputBuilt,
      productionReleaseAdapterInputReady,
      productionReleaseAdapterInputBlockedBy,
      productionReleaseAdapterInputSanitized,
      productionReleaseAdapterInputJwsIncluded,
      productionReleaseAdapterInputPreview,
      productionReleaseAdapterRawProofIncluded,
      productionReleaseAdapterRawReceiptIncluded,
      productionReleaseAdapterNoopFunctionAvailable,
      productionReleaseAdapterNoopResultObserved,
      productionReleaseAdapterNoopResultStatus,
      productionReleaseAdapterNoopResultReason,
      productionReleaseAdapterNoopSideEffectFree,
      productionReleaseAdapterExternalCallAttempted,
      productionReleaseAdapterNoopResult,
      productionReleaseAdapterDecisionObserved,
      productionReleaseAdapterDecisionStatus,
      productionReleaseAdapterDecisionReason,
      productionReleaseAdapterDecisionBlockedBy,
      productionReleaseAdapterDecisionAllowsProductionRelease,
      productionReleaseAdapterDecisionSideEffectFree,
      productionReleaseAdapterDryRunInvocationRequired,
      productionReleaseAdapterDryRunInvocationObserved,
      productionReleaseAdapterDryRunInvocationMode,
      productionReleaseAdapterDryRunInvocationStatus,
      productionReleaseAdapterDryRunInvocationReason,
      productionReleaseAdapterDryRunInvocationExternalCallAttempted,
      productionReleaseAdapterDryRunInvocationSideEffectFree,
      productionReleaseAdapterDryRunInvocationResult,
      productionReleaseAdapterDryRunInvocationReceiptEmitted,
      productionReleaseAdapterDryRunInvocationReceipt,
      productionReleaseAdapterDryRunInvocationReceiptContract,
      productionReleaseAdapterDryRunInvocationReceiptReason,
      productionReleaseAdapterDryRunInvocationReceiptSideEffectFree,
      productionReleaseCrpFulfillRequestDraftRequired,
      productionReleaseCrpFulfillRequestDraftBuilt,
      productionReleaseCrpFulfillRequestDraftContract,
      productionReleaseCrpFulfillRequestDraftReason,
      productionReleaseCrpFulfillRequestDraftSanitized,
      productionReleaseCrpFulfillRequestDraftExternalCallAttempted,
      productionReleaseCrpFulfillRequestDraftCrpCalled,
      productionReleaseCrpFulfillRequestDraftCrpFulfillCalled,
      productionReleaseCrpFulfillRequestDraft,
      productionReleaseCrpFulfillRequestValidationRequired,
      productionReleaseCrpFulfillRequestValidationReady,
      productionReleaseCrpFulfillRequestValidationStatus,
      productionReleaseCrpFulfillRequestValidationReason,
      productionReleaseCrpFulfillRequestValidationErrors,
      productionReleaseCrpFulfillRequestValidationSideEffectFree,
      productionReleaseCrpFulfillExecutionRequired,
      productionReleaseCrpFulfillExecutionClientAvailable,
      productionReleaseCrpFulfillExecutionMode,
      productionReleaseCrpFulfillExecutionReady,
      productionReleaseCrpFulfillExecutionBlockedBy,
      productionReleaseCrpFulfillExecutionRecognizedButNotExecuted,
      productionReleaseCrpFulfillExecutionExternalCallAttempted,
      productionReleaseCrpFulfillExecutionCrpCalled,
      productionReleaseCrpFulfillExecutionCrpFulfillCalled,
      productionReleaseCrpFulfillExecutionSideEffectFree,
      productionReleaseCrpFulfillClientAdapterScaffoldRequired,
      productionReleaseCrpFulfillClientAdapterScaffoldAvailable,
      productionReleaseCrpFulfillClientAdapterScaffoldMode,
      productionReleaseCrpFulfillClientAdapterScaffoldReady,
      productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy,
      productionReleaseCrpFulfillClientAdapterScaffoldWouldCall,
      productionReleaseCrpFulfillClientAdapterScaffoldCalled,
      productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled,
      productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree,
      productionReleaseCrpFulfillClientAdapterContractRequired,
      productionReleaseCrpFulfillClientAdapterContractAvailable,
      productionReleaseCrpFulfillClientAdapterContract,
      productionReleaseCrpFulfillClientAdapterContractMode,
      productionReleaseCrpFulfillClientAdapterContractReady,
      productionReleaseCrpFulfillClientAdapterContractBlockedBy,
      productionReleaseCrpFulfillClientAdapterContractInputRequired,
      productionReleaseCrpFulfillClientAdapterContractResultRequired,
      productionReleaseCrpFulfillClientAdapterContractInvoked,
      productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterContractCrpCalled,
      productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterContractSideEffectFree,
      productionReleaseCrpFulfillClientAdapterInputRequired,
      productionReleaseCrpFulfillClientAdapterInputContract,
      productionReleaseCrpFulfillClientAdapterInputBuilt,
      productionReleaseCrpFulfillClientAdapterInputReady,
      productionReleaseCrpFulfillClientAdapterInputBlockedBy,
      productionReleaseCrpFulfillClientAdapterInputSanitized,
      productionReleaseCrpFulfillClientAdapterInputJwsIncluded,
      productionReleaseCrpFulfillClientAdapterInputRawProofIncluded,
      productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded,
      productionReleaseCrpFulfillClientAdapterInputPreview,
      productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterInputCrpCalled,
      productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterInputSideEffectFree,
      productionReleaseBlockedBy,
      productionReleaseRecognizedButNotExecuted: productionReleaseEligible === true,
      productionRelease: false,
      paymentReleaseAttempted: decision.paymentReleaseAttempted,
      paymentResponseEmitted: decision.paymentResponseEmitted,
      crpCalled: decision.crpCalled,
      crpFulfillCalled: decision.crpFulfillCalled,
      replayTouched: decision.replayTouched,
      resourceReleased: decision.resourceReleased,
      canonicalReleasePersisted: canonicalReleasePersistedForProduction,
      rawProofPrinted: decision.rawProofPrinted,
      rawReceiptPrinted: decision.rawReceiptPrinted,
    };
  };

  const enforcePhase3RuntimeDecisionBeforeReleaseIfGated = (proof: any): { ok: true } | { ok: false } => {
    if (resourcePathname !== '/paid-gated') return { ok: true };

    const phase3RuntimeDecision = phase3RuntimeVerifiedReceiptDecisionDebug(proof, {
      enforced: true,
    });

    const authorized =
      phase3RuntimeDecision.ok === true &&
      phase3RuntimeDecision.paymentResponseAllowed === true &&
      phase3RuntimeDecision.resourceReleaseAllowed === true;

    if (authorized) return { ok: true };

    reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Phase 3 runtime decision rejected release',
      ...(x402Debug
        ? {
            debug: {
              blockedBy: 'phase3_runtime_decision_not_authorized',
              phase3RuntimeVerifiedReceiptDecision: phase3RuntimeDecision,
            },
          }
        : {}),
    });

    return { ok: false };
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

      // Non-gated resources may use payment verification as an implicit policy allow.
      // Gated resources must have policy satisfied explicitly via /paid-gated/redeem.
      if (resourcePathname !== '/paid-gated') {
        persistPolicySatisfiedIfNeeded(
          'policy_implicit_allow',
          'Client receipt satisfied implicit allow policy',
        );
      }

      const clientPolicyGate = await requirePolicySatisfiedIfGated();
      if (!clientPolicyGate.ok) return;

      const clientPhase3RuntimeGate = enforcePhase3RuntimeDecisionBeforeReleaseIfGated(proof);
      if (!clientPhase3RuntimeGate.ok) return;

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
      const canonicalPersistence = await finalizeSuccessfulSettlementAndRelease({
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
          ? {
              debug: {
                receiptSource: directReceiptJws ? 'x402-receipt' : 'payment-signature.receipt.jws',
                phase3RuntimeVerifiedReceiptDecision:
                  phase3RuntimeVerifiedReceiptDecisionDebug(proof, {
                    enforced: resourcePathname === '/paid-gated',
                    canonicalReleasePersistenceResult: canonicalPersistence,
                  }),
              },
            }
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

    // Non-gated resources may use payment verification as an implicit policy allow.
    // Gated resources must have policy satisfied explicitly via /paid-gated/redeem.
    if (resourcePathname !== '/paid-gated') {
      persistPolicySatisfiedIfNeeded(
        'policy_implicit_allow',
        'Dev receipt satisfied implicit allow policy',
      );
    }

    const devPolicyGate = await requirePolicySatisfiedIfGated();
    if (!devPolicyGate.ok) return;

    const devPhase3RuntimeGate = enforcePhase3RuntimeDecisionBeforeReleaseIfGated(proof);
    if (!devPhase3RuntimeGate.ok) return;

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
    const canonicalPersistence = await finalizeSuccessfulSettlementAndRelease({
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
      ...(x402Debug
        ? {
            debug: {
              phase3RuntimeVerifiedReceiptDecision:
                phase3RuntimeVerifiedReceiptDecisionDebug(proof, {
                  enforced: resourcePathname === '/paid-gated',
                  canonicalReleasePersistenceResult: canonicalPersistence,
                }),
            },
          }
        : {}),
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

    return reply402AfterPersistingIssuedChallengeIfGated({
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
    return reply402AfterPersistingIssuedChallengeIfGated({
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
    return reply402AfterPersistingIssuedChallengeIfGated({
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

  // Non-gated resources may use payment verification as an implicit policy allow.
  // Gated resources must have policy satisfied explicitly via /paid-gated/redeem.
  if (resourcePathname !== '/paid-gated') {
    persistPolicySatisfiedIfNeeded(
      'policy_implicit_allow',
      'Facilitator receipt satisfied implicit allow policy',
    );
  }

  const realPolicyGate = await requirePolicySatisfiedIfGated();
  if (!realPolicyGate.ok) return;

  const realPhase3RuntimeGate = enforcePhase3RuntimeDecisionBeforeReleaseIfGated(proof);
  if (!realPhase3RuntimeGate.ok) return;

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

function getPaidGatedContract(): LoadedContractDefinition {
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

function normalizePhase3DemoPresentationToPolicyEvidence(args: {
  nonce: string;
  authorizationProof: any;
}): GatedPolicyEvidence | null {
  const presentation = args.authorizationProof?.presentation;
  const claims =
    presentation && typeof presentation === 'object' && !Array.isArray(presentation)
      ? (presentation as any).claims
      : null;

  const region = typeof claims?.region === 'string' ? claims.region : undefined;
  const ageOver = typeof claims?.ageOver === 'number' ? claims.ageOver : undefined;
  const ageAtLeast = typeof claims?.ageAtLeast === 'number' ? claims.ageAtLeast : undefined;

  if (!region || (ageOver === undefined && ageAtLeast === undefined)) {
    return null;
  }

  return {
    nonce: args.nonce,
    policyKind: 'composite',
    region,
    claims: {
      ...(ageOver !== undefined ? { ageOver } : {}),
      ...(ageAtLeast !== undefined ? { ageAtLeast } : {}),
    },
    subjectRef:
      typeof args.authorizationProof?.wallet?.accountAddress === 'string'
        ? args.authorizationProof.wallet.accountAddress
        : undefined,
    issuer: 'phase3-direct-buyer-demo',
    externalValidationRef:
      typeof args.authorizationProof?.challengeHash === 'string'
        ? args.authorizationProof.challengeHash
        : null,
    signature: null,
  };
}


// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

app.get('/siw/challenge', async (req, res) => {
  const chainId =
    typeof req.query.chainId === 'string' && req.query.chainId.trim().length > 0
      ? req.query.chainId.trim()
      : 'concordium:testnet';

  const accountId =
    typeof req.query.accountId === 'string' && req.query.accountId.trim().length > 0
      ? req.query.accountId.trim()
      : '';

  const resourcePath =
    typeof req.query.resourcePath === 'string' && req.query.resourcePath.trim().length > 0
      ? req.query.resourcePath.trim()
      : '/paid';

  const resourceMethod =
    typeof req.query.resourceMethod === 'string' && req.query.resourceMethod.trim().length > 0
      ? req.query.resourceMethod.trim().toUpperCase()
      : 'GET';

  if (!accountId) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_request',
      reason: 'invalid_request',
      message: 'Query parameter accountId is required.',
    });
  }

  const verifier = getSiwVerifierForChainId(chainId);

  const challenge = buildSiwChallenge({
    chainId,
    accountId,
    scope: {
      resourcePath,
      resourceMethod,
    },
    ttlSec,
  });

  putSiwChallenge(challenge);

  return res.status(200).json({
    ok: true,
    siw: challenge,
    verifier: {
      available: verifier !== null,
      chainIdPrefix: verifier?.chainIdPrefix ?? null,
    },
  });
});

app.post('/siw/verify', async (req, res) => {
  const body = req.body ?? {};

  const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';

  const input: SiwVerifyProofInput = {
    chainId: typeof body.chainId === 'string' ? body.chainId.trim() : '',
    accountId: typeof body.accountId === 'string' ? body.accountId.trim() : '',
    message: typeof body.message === 'string' ? body.message : '',
    signature: body.signature,
  };

  if (!challengeId || !input.chainId || !input.accountId || !input.message || !input.signature) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_request',
      reason: 'invalid_request',
      message: 'challengeId, chainId, accountId, message, and signature are required.',
    });
  }

  const challenge: SiwAuthChallenge | null = getSiwChallenge(challengeId);

  if (!challenge) {
    return res.status(404).json({
      ok: false,
      code: 'unknown_challenge',
      reason: 'unknown_challenge',
      message: `No SIW challenge found for challengeId ${challengeId}.`,
    });
  }

  if (isSiwChallengeExpired(challenge)) {
    return res.status(410).json({
      ok: false,
      code: 'challenge_expired',
      reason: 'challenge_expired',
      message: `SIW challenge ${challengeId} has expired.`,
    });
  }

  if (challenge.chainId !== input.chainId) {
    return res.status(409).json({
      ok: false,
      code: 'challenge_binding_mismatch',
      reason: 'challenge_binding_mismatch',
      message: 'SIW challenge chainId does not match verification request.',
    });
  }

  if (challenge.accountId !== input.accountId) {
    return res.status(409).json({
      ok: false,
      code: 'challenge_binding_mismatch',
      reason: 'challenge_binding_mismatch',
      message: 'SIW challenge accountId does not match verification request.',
    });
  }

  if (normalizeSiwMessage(challenge.message) !== normalizeSiwMessage(input.message)) {
    return res.status(409).json({
      ok: false,
      code: 'challenge_binding_mismatch',
      reason: 'challenge_binding_mismatch',
      message: 'SIW challenge message does not match verification request.',
    });
  }

  let gatewayAccountInfo: unknown;
  try {
    gatewayAccountInfo = await getConcordiumAccountInfo(input.chainId, input.accountId, {
      testnet: {
        host: concordiumGrpcTestnetHost,
        port: concordiumGrpcTestnetPort,
      },
      mainnet: {
        host: concordiumGrpcMainnetHost,
        port: concordiumGrpcMainnetPort,
      },
    });
  } catch (err: any) {
    const lookupMessage = String(err?.message ?? err);

    if (lookupMessage.includes('Unsupported account identifier')) {
      return res.status(400).json({
        ok: false,
        code: 'invalid_account_identifier',
        reason: 'invalid_account_identifier',
        message: 'Account identifier is not a valid Concordium account address.',
      });
    }

    return res.status(502).json({
      ok: false,
      code: 'account_lookup_failed',
      reason: 'account_lookup_failed',
      message: lookupMessage,
    });
  }

  input.accountInfo = gatewayAccountInfo;

  const verifier = getSiwVerifierForChainId(input.chainId);

  if (!verifier) {
    return res.status(400).json({
      ok: false,
      code: 'unsupported_chain',
      reason: 'unsupported_chain',
      message: `No SIW verifier is registered for chainId ${input.chainId}.`,
    });
  }

  const result = await verifier.verify(input);

  if (!result.ok) {
    const status = result.code === 'not_implemented' ? 501 : 401;

    return res.status(status).json({
      ok: false,
      code: result.code,
      reason: result.code,
      message: result.message,
      verifier: {
        chainIdPrefix: verifier.chainIdPrefix,
      },
    });
  }

  const session = createSiwSession(challenge, siwSessionTtlSec);

  return res.status(200).json({
    ok: true,
    verifier: {
      chainIdPrefix: verifier.chainIdPrefix,
    },
    signerAccountId: result.signerAccountId,
    session: {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      accountId: session.accountId,
      chainId: session.chainId,
      scope: session.scope,
    },
  });
});

// Existing local/demo endpoint (still supported)
app.get('/paid', async (req, res) => {
  const rawSessionId = req.header(SIW_SESSION_HEADER);
  const sessionId = typeof rawSessionId === 'string' ? rawSessionId.trim() : '';

  if (!sessionId) {
    return handleX402(req, res, '/paid');
  }

  const session = getSiwSession(sessionId);

  if (!session || isSiwSessionExpired(session)) {
    return res.status(401).json({
      ok: false,
      code: 'invalid_siw_session',
      reason: 'invalid_siw_session',
      message: 'SIW session is missing, invalid, or expired.',
    });
  }

  const scopeMatches =
    session.scope.resourcePath === '/paid' &&
    String(session.scope.resourceMethod || '').toUpperCase() === 'GET';

  if (!scopeMatches) {
    return res.status(403).json({
      ok: false,
      code: 'siw_session_scope_mismatch',
      reason: 'siw_session_scope_mismatch',
      message: 'SIW session scope does not allow access to GET /paid.',
    });
  }

  return res.status(200).json({
    ok: true,
    paid: true,
    via: 'siw_session',
    session: {
      sessionId: session.sessionId,
      accountId: session.accountId,
      chainId: session.chainId,
      expiresAt: session.expiresAt,
      scope: session.scope,
    },
    data: {
      message: 'Hello from the paid resource',
      resource: '/paid',
    },
  });
});
app.get('/paid-gated', async (req, res) => handleX402(req, res, '/paid-gated'));

app.post('/paid-gated/redeem', async (req, res) => {
  if (!phase3GatewayPolicyGateEnabled) {
    return replyPhase3GatewayPolicyGateDisabled(res);
  }

  const body = req.body ?? {};
  const nonce = typeof body.nonce === 'string' ? body.nonce : '';
  const authorizationProof = (body as any).authorizationProof ?? null;

  const verifierResult = authorizationProof
    ? await verifyConcordiumZkpAuthorizationEnvelope(authorizationProof, {
        // Live ZKP verification is intentionally not invoked from this route yet.
        // The route first parses the envelope, then verifyPhase3Policy() enforces
        // PHASE3_REQUIRE_LIVE_ZKP by rejecting parsed-only proofs with
        // verified_proof_required.
        liveVerify: false,
        grpcHost: process.env.PHASE3_GRPC_HOST,
        grpcPort: process.env.PHASE3_GRPC_PORT ? Number(process.env.PHASE3_GRPC_PORT) : undefined,
        network: process.env.PHASE3_CONCORDIUM_NETWORK ?? 'testnet',
      })
    : null;

  const verifierAudit = verifierResult
    ? {
        ok: verifierResult.ok,
        type: 'concordium_zkp_authorization_v1',
        stage: verifierResult.stage,
        envelopeType: verifierResult.envelopeType ?? null,
        challengeHash: verifierResult.challengeHash ?? null,
        proofType: verifierResult.proofType ?? null,
        challengeBinding: verifierResult.challengeBinding ?? null,
        rawProofPrinted: verifierResult.rawProofPrinted,
        code: verifierResult.ok ? null : verifierResult.stage,
        reason: verifierResult.reason ?? null,
      }
    : {
        ok: false,
        type: 'concordium_zkp_authorization_v1',
        code: 'missing_authorization_proof',
        reason: 'missing_authorization_proof',
        rawProofPrinted: false,
      };

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

  const persistPolicySatisfiedForRedeemIfNeeded = async (
    reasonCode: string,
    reasonMessage: string,
  ): Promise<{
    ok: boolean;
    updated: boolean;
    reason: string;
    challengeId?: string;
    currentState?: string;
  }> => {
    try {
      let result = await completePolicyEvaluationByNonce({
        nonce,
        fromState: 'ISSUED',
        outcome: 'satisfied',
        actor: 'gateway',
        reasonCode,
        reasonMessage,
      });

      if (result.reason === 'missing') {
        const paidGatedContract = getPaidGatedContract();
        const nowSec = Math.floor(Date.now() / 1000);
        const issuedAtSec =
          typeof (challenge as any)?.issuedAt === 'number' ? (challenge as any).issuedAt : nowSec;
        const expiresAtSec =
          typeof (challenge as any)?.expiresAt === 'number' ? (challenge as any).expiresAt : nowSec + ttlSec;

        const policyRequirements = buildPolicyRequirements(paidGatedContract);

        const recoveredPaymentRequiredPayload = {
          ...buildPaymentRequiredPayload({
            contract: paidGatedContract,
            nonce,
            issuedAtSec,
            expiresAtSec,
          }),
          chain_id: paidGatedContract.chain_id,
          ...(policyRequirements ? { policyRequirements } : {}),
        };

        await persistIssuedChallenge({
          contract: paidGatedContract,
          nonce,
          paymentRequiredHeaderPayload: recoveredPaymentRequiredPayload,
        });

        result = await completePolicyEvaluationByNonce({
          nonce,
          fromState: 'ISSUED',
          outcome: 'satisfied',
          actor: 'gateway',
          reasonCode,
          reasonMessage,
        });
      }

      return {
        ok: result.updated || result.reason === 'already_in_target',
        updated: result.updated,
        reason: result.reason,
        challengeId: result.challengeId,
        currentState: result.currentState,
      };
    } catch (err) {
      console.error('Failed to persist policy evaluation outcome:', err);
      return {
        ok: false,
        updated: false,
        reason: 'persistence_error',
      };
    }
  };

  if (!nonce) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_request',
      reason: 'invalid_request',
      message: 'Request body must include nonce.',
      verifier: verifierAudit,
    });
  }

  if (!authorizationProof) {
    persistPolicyFailedIfNeeded(
      'missing_authorization_proof',
      'Authorization proof is required for this resource.',
    );

    return res.status(403).json({
      ok: false,
      nonce,
      code: 'missing_authorization_proof',
      reason: 'missing_authorization_proof',
      message: 'Authorization proof is required for this resource.',
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
    });
  }

  if (!verifierResult) {
    persistPolicyFailedIfNeeded(
      'verifier_failed',
      'Authorization proof verifier did not return a result.',
    );

    return res.status(403).json({
      ok: false,
      nonce,
      code: 'verifier_failed',
      reason: 'verifier_failed',
      message: 'Authorization proof verifier did not return a result.',
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
    });
  }

  const challenge = (authorizationProof as any).challenge;

  if (!challenge || typeof challenge !== 'object' || !(challenge as any).policy) {
    persistPolicyFailedIfNeeded(
      'invalid_authorization_challenge',
      'Authorization proof must include a valid Phase 3 challenge.',
    );

    return res.status(403).json({
      ok: false,
      nonce,
      code: 'invalid_authorization_challenge',
      reason: 'invalid_authorization_challenge',
      message: 'Authorization proof must include a valid Phase 3 challenge.',
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
    });
  }

  const policyDecision = verifyPhase3Policy({
    challenge,
    verifierResult,
    requirement: {
      ...phase3DirectBuyerDemoRequirement,
      requireVerifiedProof: phase3RequireLiveZkp,
      allowParsedOnly: phase3AllowParsedOnlyPolicy,
    },
    now: Math.floor(Date.now() / 1000),
  });

  if (!policyDecision.allowed) {
    persistPolicyFailedIfNeeded(
      policyDecision.code,
      policyDecision.reason ?? policyDecision.code,
    );

    const status = policyDecision.code === 'policy_mismatch' ? 409 : 403;
    return res.status(status).json({
      ok: false,
      nonce,
      code: policyDecision.code,
      reason: policyDecision.code,
      message: policyDecision.reason ?? policyDecision.code,
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
      policyDecision,
    });
  }

  const paidGatedContract = getPaidGatedContract();
  const challengeBinding = validatePhase3DemoChallengeBinding({
    nonce,
    challenge,
    contract: {
      merchantId: paidGatedContract.merchantId,
      resource: {
        method: 'GET',
        path: '/paid-gated',
      },
      contractId: paidGatedContract.contractId,
      contractVersion: paidGatedContract.contractVersion,
      isFrozen: paidGatedContract.isFrozen,
      network: paidGatedContract.network,
      chain_id: paidGatedContract.chain_id,
      asset: paidGatedContract.asset,
      amount: paidGatedContract.amount,
      payTo: paidGatedContract.payTo,
    },
  });
  if (!challengeBinding.ok) {
    persistPolicyFailedIfNeeded(challengeBinding.code, challengeBinding.message);

    return res.status(409).json({
      ok: false,
      nonce,
      code: challengeBinding.code,
      reason: challengeBinding.code,
      message: challengeBinding.message,
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
      policyDecision,
    });
  }

  const policyEvidence = normalizePhase3DemoPresentationToPolicyEvidence({
    nonce,
    authorizationProof,
  });
  const gatedPolicyResult = evaluatePaidGatedPolicy({ nonce, policyEvidence });

  if (!gatedPolicyResult.ok) {
    persistPolicyFailedIfNeeded(gatedPolicyResult.code, gatedPolicyResult.message);

    const status = gatedPolicyResult.code === 'policy_binding_mismatch' ? 409 : 403;
    return res.status(status).json({
      ok: false,
      nonce,
      code: gatedPolicyResult.code,
      reason: gatedPolicyResult.reason,
      message: gatedPolicyResult.message,
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
      policyDecision,
    });
  }

  const policyPersistence = await persistPolicySatisfiedForRedeemIfNeeded(
    'policy_satisfied',
    `Phase 3 policy satisfied with verifier stage ${verifierResult.stage}; age/region policy satisfied for ${gatedPolicyResult.region}.`,
  );

  if (!policyPersistence.ok && policyPersistence.reason !== 'persistence_error') {
    return res.status(409).json({
      ok: false,
      nonce,
      code: 'policy_persistence_failed',
      reason: policyPersistence.reason,
      message: 'Policy satisfied, but canonical policy state was not persisted.',
      policyStatus: 'POLICY_FAILED',
      verifier: verifierAudit,
      policyDecision,
      ...(x402Debug ? { debug: { policyPersistence } } : {}),
    });
  }

  return res.status(200).json({
    ok: true,
    nonce,
    access: 'policy-satisfied',
    policyStatus: 'POLICY_SATISFIED',
    region: gatedPolicyResult.region,
    minimumAge: gatedPolicyResult.minimumAge,
    actualAge: gatedPolicyResult.actualAge,
    verifier: verifierAudit,
    policyDecision,
    ...(x402Debug ? { debug: { policyPersistence } } : {}),
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
