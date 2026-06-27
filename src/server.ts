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
import {
  RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES,
  RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT,
  RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES,
} from './phase3/receiptDecodeMetadataBoundary';

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

// Phase 3 controlled Live Direct Buyer release demo seam.
// OFF by default. This is a route/demo-scoped activation marker for the
// composed eligible/ineligible buyer demo. It must not bypass the existing
// policy, receipt, replay, or runtime release guards.
const phase3LiveDirectBuyerControlledReleaseDemoEnabled =
  String(process.env.PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED ?? '').toLowerCase() === 'true';

// Phase 3 production release dry-run audit seam.
// OFF by default. PR #178 exposes a would-execute audit signal only.
// This does not authorize production release or CRP fulfill.
const phase3GatewayProductionReleaseDryRunEnabled =
  String(process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED ?? '').toLowerCase() === 'true';

// Phase 4 real CRP fulfill invocation boundary.
// OFF by default. This harness-only seam may observe/attempt CRP fulfill,
// but must not authorize production release, emit PAYMENT-RESPONSE, mutate replay,
// persist canonical release, or release protected resources.
const phase4RealCrpFulfillInvocationBoundaryHarness =
  String(process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS ?? '').toLowerCase() === 'true';

const phase4RealCrpFulfillInvocationBoundaryEnabled =
  phase4RealCrpFulfillInvocationBoundaryHarness === true &&
  String(process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED ?? '').toLowerCase() === 'true';

// Phase 4 real receipt JWS handoff contract.
// OFF by default. This harness-only seam may classify receipt JWS handoff
// metadata from CRP fulfill, but must not decode, verify, consume for release,
// emit PAYMENT-RESPONSE, mutate replay, persist canonical release, or release resources.
const phase4RealReceiptJwsHandoffContractHarness =
  String(process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS ?? '').toLowerCase() === 'true';

const phase4RealReceiptJwsHandoffContractEnabled =
  phase4RealReceiptJwsHandoffContractHarness === true &&
  String(process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED ?? '').toLowerCase() === 'true';

// Phase 4 real receipt JWS decode preflight.
// OFF by default. This harness-only seam may syntactically decode compact JWS
// header/payload metadata from the CRP receipt handoff, but must not verify,
// consume for release, emit PAYMENT-RESPONSE, mutate replay, persist canonical
// release, or release resources.
const phase4RealReceiptJwsDecodePreflightHarness =
  String(process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS ?? '').toLowerCase() === 'true';

const phase4RealReceiptJwsDecodePreflightEnabled =
  phase4RealReceiptJwsDecodePreflightHarness === true &&
  String(process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED ?? '').toLowerCase() === 'true';

const phase3GatewayProductionReleaseResultConsumptionEnabled =
  String(process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED ?? '').toLowerCase() ===
  'true';

const phase3GatewayProductionReleaseReceiptDecodeEnabled =
  String(process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_RECEIPT_DECODE_ENABLED ?? '').toLowerCase() ===
  'true';

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
      liveDirectBuyerControlledReleaseDemoEnabled: phase3LiveDirectBuyerControlledReleaseDemoEnabled,
      gatewayProductionReleaseDryRunEnabled: phase3GatewayProductionReleaseDryRunEnabled,
      allowParsedOnlyPolicy: phase3AllowParsedOnlyPolicy,
      requireLiveZkp: phase3RequireLiveZkp,
    },
    phase4: {
      realCrpFulfillInvocationBoundaryHarness:
        phase4RealCrpFulfillInvocationBoundaryHarness,
      realCrpFulfillInvocationBoundaryEnabled:
        phase4RealCrpFulfillInvocationBoundaryEnabled,
      realReceiptJwsHandoffContractHarness:
        phase4RealReceiptJwsHandoffContractHarness,
      realReceiptJwsHandoffContractEnabled:
        phase4RealReceiptJwsHandoffContractEnabled,
      realReceiptJwsDecodePreflightHarness:
        phase4RealReceiptJwsDecodePreflightHarness,
      realReceiptJwsDecodePreflightEnabled:
        phase4RealReceiptJwsDecodePreflightEnabled,
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

    const productionReleaseCrpFulfillClientAdapterNoopResultRequired =
      productionReleaseCrpFulfillClientAdapterInputReady === true;

    const productionReleaseCrpFulfillClientAdapterNoopResultObserved =
      productionReleaseCrpFulfillClientAdapterNoopResultRequired === true;

    const productionReleaseCrpFulfillClientAdapterNoopResultStatus =
      productionReleaseCrpFulfillClientAdapterNoopResultObserved === true ? 'disabled' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterNoopResultReason =
      productionReleaseCrpFulfillClientAdapterNoopResultObserved === true
        ? 'production_release_crp_fulfill_client_adapter_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterNoopResult =
      productionReleaseCrpFulfillClientAdapterNoopResultObserved === true
        ? {
            ok: false,
            status: productionReleaseCrpFulfillClientAdapterNoopResultStatus,
            reason: productionReleaseCrpFulfillClientAdapterNoopResultReason,
            inputContract: productionReleaseCrpFulfillClientAdapterInputContract,
            inputBuilt: productionReleaseCrpFulfillClientAdapterInputBuilt,
            inputReady: productionReleaseCrpFulfillClientAdapterInputReady,
            inputSanitized: productionReleaseCrpFulfillClientAdapterInputSanitized,
            inputJwsIncluded: productionReleaseCrpFulfillClientAdapterInputJwsIncluded,
            inputRawProofIncluded: productionReleaseCrpFulfillClientAdapterInputRawProofIncluded,
            inputRawReceiptIncluded: productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded,
            adapterInvoked: false,
            externalCallAttempted: false,
            crpCalled: false,
            crpFulfillCalled: false,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterNoopResultSideEffectFree =
      productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterDecisionGateRequired =
      productionReleaseCrpFulfillClientAdapterNoopResultObserved === true;

    const productionReleaseCrpFulfillClientAdapterDecisionGateObserved =
      productionReleaseCrpFulfillClientAdapterDecisionGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterDecisionGateStatus =
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true ? 'blocked' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterDecisionGateReason =
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true
        ? productionReleaseCrpFulfillClientAdapterNoopResultReason
        : null;

    const productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true
        ? productionReleaseCrpFulfillClientAdapterNoopResultReason
        : null;

    const productionReleaseCrpFulfillClientAdapterDecisionGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterDecisionGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterDecisionGate =
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true
        ? {
            status: productionReleaseCrpFulfillClientAdapterDecisionGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterDecisionGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy,
            noopResultStatus: productionReleaseCrpFulfillClientAdapterNoopResultStatus,
            noopResultReason: productionReleaseCrpFulfillClientAdapterNoopResultReason,
            inputContract: productionReleaseCrpFulfillClientAdapterNoopResult?.inputContract ?? null,
            inputReady: productionReleaseCrpFulfillClientAdapterNoopResult?.inputReady === true,
            allowsCrpFulfill: false,
            allowsProductionRelease: false,
            adapterInvoked: false,
            externalCallAttempted: false,
            crpCalled: false,
            crpFulfillCalled: false,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterDecisionGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterInvocationGateRequired =
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterInvocationGateObserved =
      productionReleaseCrpFulfillClientAdapterInvocationGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterInvocationGateMode =
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true ? 'disabled' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterInvocationGateStatus =
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true ? 'blocked' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterInvocationGateReason =
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true
        ? 'production_release_crp_fulfill_client_adapter_invocation_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterInvocationGateReason;

    const productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterInvocationGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterInvocationGateAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterInvocationGate =
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true
        ? {
            mode: productionReleaseCrpFulfillClientAdapterInvocationGateMode,
            status: productionReleaseCrpFulfillClientAdapterInvocationGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterInvocationGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy,
            decisionGateStatus: productionReleaseCrpFulfillClientAdapterDecisionGateStatus,
            decisionGateReason: productionReleaseCrpFulfillClientAdapterDecisionGateReason,
            decisionGateBlockedBy: productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy,
            inputContract: productionReleaseCrpFulfillClientAdapterDecisionGate?.inputContract ?? null,
            inputReady: productionReleaseCrpFulfillClientAdapterDecisionGate?.inputReady === true,
            allowsCrpFulfill: false,
            allowsProductionRelease: false,
            adapterInvoked: false,
            externalCallAttempted: false,
            crpCalled: false,
            crpFulfillCalled: false,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterInvocationGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired =
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired === true;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationMode =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true ? 'dry_run' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true ? 'would_invoke' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReason =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true
        ? 'production_release_crp_fulfill_client_adapter_dry_run_would_invoke'
        : null;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationResult =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true
        ? {
            ok: false,
            mode: productionReleaseCrpFulfillClientAdapterDryRunInvocationMode,
            status: productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus,
            reason: productionReleaseCrpFulfillClientAdapterDryRunInvocationReason,
            invocationGateMode: productionReleaseCrpFulfillClientAdapterInvocationGateMode,
            invocationGateStatus: productionReleaseCrpFulfillClientAdapterInvocationGateStatus,
            invocationGateReason: productionReleaseCrpFulfillClientAdapterInvocationGateReason,
            invocationGateBlockedBy: productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy,
            inputContract: productionReleaseCrpFulfillClientAdapterInvocationGate?.inputContract ?? null,
            inputReady: productionReleaseCrpFulfillClientAdapterInvocationGate?.inputReady === true,
            adapterInvoked: false,
            externalCallAttempted: false,
            crpCalled: false,
            crpFulfillCalled: false,
            allowsCrpFulfill: false,
            allowsProductionRelease: false,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree: true,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationSideEffectFree =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true
        ? 'phase3.productionRelease.crpFulfillClientAdapter.dryRunInvocationReceipt.v1'
        : null;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true
        ? 'production_release_crp_fulfill_client_adapter_dry_run_invocation_recorded'
        : null;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true
        ? {
            contract: productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract,
            mode: 'dry_run',
            status: 'recorded',
            reason: productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason,
            adapter: {
              invocationStatus: productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus,
              invocationReason: productionReleaseCrpFulfillClientAdapterDryRunInvocationReason,
              invocationGateStatus: productionReleaseCrpFulfillClientAdapterInvocationGateStatus,
              invocationGateReason: productionReleaseCrpFulfillClientAdapterInvocationGateReason,
              invocationGateBlockedBy: productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy,
            },
            input: {
              contract: productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.inputContract ?? null,
              ready: productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.inputReady === true,
            },
            safety: {
              adapterInvoked: false,
              externalCallAttempted: false,
              crpCalled: false,
              crpFulfillCalled: false,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree: true,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired =
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessReady =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessContract =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true
        ? 'phase3.productionRelease.crpFulfillClientAdapter.handoffReadiness.v1'
        : null;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessStatus =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true ? 'ready' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessReason =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true
        ? 'production_release_crp_fulfill_client_adapter_handoff_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessBlockedBy =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true
        ? 'production_release_crp_fulfill_client_adapter_execution_not_enabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterHandoffReadiness =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true
        ? {
            contract: productionReleaseCrpFulfillClientAdapterHandoffReadinessContract,
            status: productionReleaseCrpFulfillClientAdapterHandoffReadinessStatus,
            reason: productionReleaseCrpFulfillClientAdapterHandoffReadinessReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterHandoffReadinessBlockedBy,
            source: {
              receiptContract: productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract,
              receiptReason: productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason,
              receiptStatus:
                productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.status ?? null,
            },
            input: {
              contract:
                productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.input?.contract ?? null,
              ready:
                productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.input?.ready === true,
            },
            safety: {
              adapterInvoked: false,
              externalCallAttempted: false,
              crpCalled: false,
              crpFulfillCalled: false,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree: true,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterHandoffReadinessExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterHandoffReadinessSideEffectFree =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterHandoffReadinessExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterResultContractRequired =
      productionReleaseCrpFulfillClientAdapterHandoffReadinessReady === true;

    const productionReleaseCrpFulfillClientAdapterResultContractAvailable =
      productionReleaseCrpFulfillClientAdapterResultContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultContract =
      productionReleaseCrpFulfillClientAdapterResultContractRequired === true
        ? 'phase3.productionRelease.crpFulfillClientAdapter.resultContract.v1'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultContractMode =
      productionReleaseCrpFulfillClientAdapterResultContractRequired === true ? 'contract_only' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultContractReady = false;

    const productionReleaseCrpFulfillClientAdapterResultContractBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultContractRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_contract_only'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultContractExpectedShape =
      productionReleaseCrpFulfillClientAdapterResultContractRequired === true
        ? {
            ok: 'boolean',
            status: 'success|disabled|would_invoke|failed',
            reason: 'string|null',
            mode: 'contract_only|dry_run|live',
            httpStatus: 'number|null',
            crpStatus: 'string|null',
            receiptJwsPresent: 'boolean',
            receiptPayloadPresent: 'boolean',
            txHash: 'string|null',
            settlementStatus: 'string|null',
            errorCode: 'string|null',
            errorMessage: 'string|null',
            adapterInvoked: 'boolean',
            externalCallAttempted: 'boolean',
            crpCalled: 'boolean',
            crpFulfillCalled: 'boolean',
            productionReleaseAuthorized: 'boolean',
            productionRelease: 'boolean',
            sideEffectFree: 'boolean',
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultContractCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultContractAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultContractAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultContractSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultContractCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired =
      productionReleaseCrpFulfillClientAdapterResultContractAvailable === true;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired === true ? 'disabled' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_contract_noop_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterResultContractNoopResult =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired === true
        ? {
            ok: false,
            status: productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason,
            mode: productionReleaseCrpFulfillClientAdapterResultContractMode,
            httpStatus: null,
            crpStatus: null,
            receiptJwsPresent: false,
            receiptPayloadPresent: false,
            txHash: null,
            settlementStatus: null,
            errorCode: null,
            errorMessage: null,
            adapterInvoked: productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted,
            crpCalled: productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired =
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true ? 'blocked' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateReason =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled === false;

    const productionReleaseCrpFulfillClientAdapterResultDecisionGate =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true
        ? {
            status: productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultDecisionGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy,
            resultStatus: productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.status ?? null,
            resultReason: productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.reason ?? null,
            resultMode: productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.mode ?? null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.receiptPayloadPresent === true,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted,
            crpCalled: productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired =
      productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateStatus =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true ? 'blocked' : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateReason =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsProductionRelease === false;

    const productionReleaseCrpFulfillClientAdapterResultHandlingGate =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true
        ? {
            status: productionReleaseCrpFulfillClientAdapterResultHandlingGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultHandlingGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultHandlingGateBlockedBy,
            decisionGateStatus:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.status ?? null,
            decisionGateReason:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.reason ?? null,
            decisionGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.blockedBy ?? null,
            resultStatus:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultStatus ?? null,
            resultReason:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultReason ?? null,
            resultMode:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultMode ?? null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultDecisionGate?.receiptPayloadPresent === true,
            allowsResultConsumption:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateExternalCallAttempted,
            crpCalled:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultHandlingGateSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired =
      productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true
        ? 'contract_only'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_contract_only'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true
        ? {
            contract: 'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionContract.v1',
            mode: 'contract_only|dry_run|live',
            status: 'blocked|ready|consumed|failed',
            reason: 'string|null',
            source: {
              handlingGateStatus: 'string|null',
              handlingGateReason: 'string|null',
              handlingGateBlockedBy: 'string|null',
              decisionGateStatus: 'string|null',
              decisionGateReason: 'string|null',
              decisionGateBlockedBy: 'string|null',
              resultStatus: 'string|null',
              resultReason: 'string|null',
              resultMode: 'string|null',
            },
            result: {
              receiptJwsPresent: 'boolean',
              receiptPayloadPresent: 'boolean',
              txHash: 'string|null',
              settlementStatus: 'string|null',
            },
            safety: {
              allowsResultConsumption: 'boolean',
              allowsCrpFulfill: 'boolean',
              allowsProductionRelease: 'boolean',
              adapterInvoked: 'boolean',
              externalCallAttempted: 'boolean',
              crpCalled: 'boolean',
              crpFulfillCalled: 'boolean',
              productionReleaseAuthorized: 'boolean',
              productionRelease: 'boolean',
              sideEffectFree: 'boolean',
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionContract =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true
        ? {
            contract: 'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionContract.v1',
            mode: productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode,
            status: 'blocked',
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy,
            ready: productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady,
            expectedShape:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape,
            handlingGateStatus:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.status ?? null,
            handlingGateReason:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.reason ?? null,
            handlingGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.blockedBy ?? null,
            decisionGateStatus:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.decisionGateStatus ?? null,
            decisionGateReason:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.decisionGateReason ?? null,
            decisionGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.decisionGateBlockedBy ?? null,
            resultStatus:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.resultStatus ?? null,
            resultReason:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.resultReason ?? null,
            resultMode:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.resultMode ?? null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultHandlingGate?.receiptPayloadPresent === true,
            allowsResultConsumption:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted,
            crpCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true
        ? {
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy,
            consumptionContractMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode,
            consumptionContractReady:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady,
            consumptionContractBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy,
            consumptionContractAvailable:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable,
            handlingGateStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.handlingGateStatus ?? null,
            handlingGateReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.handlingGateReason ?? null,
            handlingGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.handlingGateBlockedBy ?? null,
            decisionGateStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.decisionGateStatus ?? null,
            decisionGateReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.decisionGateReason ?? null,
            decisionGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.decisionGateBlockedBy ?? null,
            resultStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.resultStatus ?? null,
            resultReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.resultReason ?? null,
            resultMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.resultMode ?? null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.receiptPayloadPresent === true,
            allowsResultConsumption:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted,
            crpCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true
        ? 'disabled'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_noop_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true
        ? {
            ok: false,
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason,
            mode: 'contract_only',
            decisionGateStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus,
            decisionGateReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason,
            decisionGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy,
            consumptionContractMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.consumptionContractMode ?? null,
            consumptionContractReady:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.consumptionContractReady === true,
            consumptionContractBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.consumptionContractBlockedBy ?? null,
            handlingGateStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.handlingGateStatus ?? null,
            handlingGateReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.handlingGateReason ?? null,
            handlingGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.handlingGateBlockedBy ?? null,
            resultStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate?.resultStatus ??
              null,
            resultReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate?.resultReason ??
              null,
            resultMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate?.resultMode ??
              null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
                ?.receiptPayloadPresent === true,
            resultConsumed:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed,
            receiptConsumed:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed,
            allowsResultConsumption:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted,
            crpCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true
        ? {
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy,
            noopResultStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus,
            noopResultReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason,
            noopResultMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.mode ??
              null,
            decisionGateStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.decisionGateStatus ?? null,
            decisionGateReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.decisionGateReason ?? null,
            decisionGateBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.decisionGateBlockedBy ?? null,
            consumptionContractMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.consumptionContractMode ?? null,
            consumptionContractReady:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.consumptionContractReady === true,
            consumptionContractBlockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.consumptionContractBlockedBy ?? null,
            resultStatus:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.resultStatus ??
              null,
            resultReason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.resultReason ??
              null,
            resultMode:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.resultMode ??
              null,
            receiptJwsPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.receiptJwsPresent === true,
            receiptPayloadPresent:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
                ?.receiptPayloadPresent === true,
            resultConsumed:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed,
            receiptConsumed:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed,
            allowsResultConsumption:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption,
            allowsCrpFulfill:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill,
            allowsProductionRelease:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease,
            adapterInvoked:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked,
            externalCallAttempted:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted,
            crpCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled,
            crpFulfillCalled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled,
            productionReleaseAuthorized: false,
            productionRelease: false,
            sideEffectFree:
              productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree,
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true
        ? 'recorded'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_dry_run_audit_recorded'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionDryRunAudit.v1',
            mode: 'dry_run',
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason,
            blockedBy: productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy,
            source: {
              handlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus,
              handlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason,
              handlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy,
              noopResultStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.noopResultStatus ?? null,
              noopResultReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.noopResultReason ?? null,
              noopResultMode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.noopResultMode ?? null,
              decisionGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.decisionGateStatus ?? null,
              decisionGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.decisionGateReason ?? null,
              decisionGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.decisionGateBlockedBy ?? null,
              consumptionContractMode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.consumptionContractMode ?? null,
              consumptionContractReady:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.consumptionContractReady === true,
              consumptionContractBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.consumptionContractBlockedBy ?? null,
              resultStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.resultStatus ?? null,
              resultReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.resultReason ?? null,
              resultMode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.resultMode ?? null,
            },
            result: {
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
                  ?.receiptPayloadPresent === true,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed,
            },
            audit: {
              wouldAuditResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_readiness_not_enabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact?.safety
        ?.sanitized === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact?.safety
        ?.rawProofIncluded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact?.safety
        ?.rawReceiptIncluded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact?.safety
        ?.jwsIncluded === false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay =
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumptionEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumptionEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateProductionReleaseAuthorizationEnabled = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReadinessGate.v1',
            mode: 'contract_only',
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy,
            source: {
              dryRunAuditStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus,
              dryRunAuditReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason,
              dryRunAuditBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy,
              dryRunAuditContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.contract ?? null,
              handlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.handlingGateStatus ?? null,
              handlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.handlingGateReason ?? null,
              handlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.handlingGateBlockedBy ?? null,
              noopResultStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.noopResultStatus ?? null,
              noopResultReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.noopResultReason ?? null,
              noopResultMode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.noopResultMode ?? null,
              resultStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.resultStatus ?? null,
              resultReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.resultReason ?? null,
              resultMode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.source?.resultMode ?? null,
            },
            audit: {
              dryRunAuditObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved,
              dryRunAuditSanitized:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized,
              wouldAuditResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay,
            },
            readiness: {
              resultConsumptionEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumptionEnabled,
              receiptConsumptionEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumptionEnabled,
              productionReleaseAuthorizationEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateProductionReleaseAuthorizationEnabled,
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease,
            },
            result: {
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.result?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
                  ?.result?.receiptPayloadPresent === true,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired === true &&
      phase3GatewayProductionReleaseResultConsumptionEnabled === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired !== true
        ? 'inactive'
        : productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled === true
          ? 'enabled'
          : 'blocked';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired !== true
        ? null
        : productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled === true
          ? 'production_release_crp_fulfill_client_adapter_result_consumption_enablement_enabled'
          : 'production_release_crp_fulfill_client_adapter_result_consumption_enablement_disabled';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled === true
        ? null
        : productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionEnablementGate.v1',
            mode: 'contract_only',
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy,
            enabled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            source: {
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus,
              readinessGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason,
              readinessGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy,
              readinessGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
                  ?.contract ?? null,
              dryRunAuditObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved,
              dryRunAuditSanitized:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized,
              wouldAuditResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay,
            },
            enablement: {
              flag: 'PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED',
              enabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease,
            },
            result: {
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
                  ?.result?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
                  ?.result?.receiptPayloadPresent === true,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true
        ? 'preflight_ready'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_activation_preflight_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightBlockedBy = null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionActivationPreflight.v1',
            mode: 'contract_only',
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightBlockedBy,
            source: {
              enablementGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus,
              enablementGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason,
              enablementGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
              enablementGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
                  ?.contract ?? null,
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus,
              dryRunAuditObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved,
              dryRunAuditSanitized:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay,
            },
            preflight: {
              enablementFlagObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
              resultConsumptionEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
              receiptJwsRequired: true,
              receiptPayloadRequired: true,
              finalizedSettlementRequired: true,
              tupleBindingRequired: true,
              replayProtectionRequired: true,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
                  ?.result?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
                  ?.result?.receiptPayloadPresent === true,
              finalizedSettlementVerified: false,
              tupleBindingVerified: false,
              replayProtectionChecked: false,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus ===
        'preflight_ready';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true
        ? 'disabled'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionNoopConsumer.v1',
            mode: 'contract_only',
            status: productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus,
            reason: productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy,
            source: {
              activationPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
              activationPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason,
              activationPreflightContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
                  ?.contract ?? null,
              enablementGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus,
              dryRunAuditObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved,
              dryRunAuditSanitized:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized,
            },
            requiredChecks: {
              receiptJwsRequired: true,
              receiptPayloadRequired: true,
              finalizedSettlementRequired: true,
              tupleBindingRequired: true,
              replayProtectionRequired: true,
            },
            consumer: {
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease,
            },
            result: {
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
                  ?.preflight?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
                  ?.preflight?.receiptPayloadPresent === true,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus === 'disabled';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionNoopConsumerHandlingGate.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy,
            source: {
              noopConsumerStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus,
              noopConsumerReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason,
              noopConsumerBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy,
              noopConsumerContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer?.contract ?? null,
              activationPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
              activationPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            },
            requiredChecks: {
              receiptJwsRequired: true,
              receiptPayloadRequired: true,
              finalizedSettlementRequired: true,
              tupleBindingRequired: true,
              replayProtectionRequired: true,
            },
            gate: {
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease,
            },
            result: {
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
                  ?.result?.receiptJwsPresent === true,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
                  ?.result?.receiptPayloadPresent === true,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus === 'blocked';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true
        ? 'preflight_ready'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_preflight_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy = null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired = true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired = true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptMaterialPreflight.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy,
            source: {
              noopConsumerHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus,
              noopConsumerHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason,
              noopConsumerHandlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy,
              noopConsumerHandlingGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
                  ?.contract ?? null,
              noopConsumerStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus,
              noopConsumerReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason,
              activationPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
              activationPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            },
            receiptMaterial: {
              receiptJwsRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired,
              receiptPayloadRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed,
            },
            preflight: {
              wouldRequireReceiptJws: true,
              wouldRequireReceiptPayload: true,
              wouldRequireFinalizedSettlement: true,
              wouldRequireTupleBinding: true,
              wouldRequireReplayProtection: true,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode,
              allowsReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree,
            },
          }
        : null;

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


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus === 'preflight_ready';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptMaterialHandlingGate.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy,
            source: {
              receiptMaterialPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus,
              receiptMaterialPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason,
              receiptMaterialPreflightBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy,
              receiptMaterialPreflightContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
                  ?.contract ?? null,
              noopConsumerHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus,
              noopConsumerHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            },
            receiptMaterial: {
              receiptJwsRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired,
              receiptPayloadRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed,
            },
            gate: {
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption,
              allowsReceiptHandling:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode,
              allowsReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus === 'blocked';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true
        ? 'preflight_ready'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_preflight_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy = null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired = true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodePreflight.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy,
            source: {
              receiptMaterialHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus,
              receiptMaterialHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason,
              receiptMaterialHandlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy,
              receiptMaterialHandlingGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
                  ?.contract ?? null,
              receiptMaterialPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus,
              receiptMaterialPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            },
            receiptDecode: {
              receiptJwsRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired,
              receiptPayloadRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired,
              receiptDecodeRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed,
            },
            preflight: {
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired,
              wouldRequireReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired,
              wouldRequirePayloadParse: true,
              wouldRequireFinalizedSettlement: true,
              wouldRequireTupleBinding: true,
              wouldRequireReplayProtection: true,
            },
            gate: {
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption,
              allowsReceiptHandling:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode,
              allowsReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus === 'preflight_ready';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecodeRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptHandling = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReplayTouched = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptHandling === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReplayTouched === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeHandlingGate.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateBlockedBy,
            source: {
              receiptDecodePreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus,
              receiptDecodePreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason,
              receiptDecodePreflightBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy,
              receiptDecodePreflightContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
                  ?.contract ?? null,
              receiptMaterialHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus,
              receiptMaterialHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason,
              receiptMaterialHandlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
            },
            receiptDecode: {
              receiptJwsRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsRequired,
              receiptPayloadRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadRequired,
              receiptDecodeRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecodeRequired,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsPresent,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadPresent,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadParsed,
            },
            gate: {
              allowsResultConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsResultConsumption,
              allowsReceiptConsumption:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptConsumption,
              allowsReceiptHandling:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptHandling,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptDecode,
              allowsReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptPayloadParse,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsProductionRelease,
            },
            safety: {
              sanitized: true,
              rawProofIncluded: false,
              rawReceiptIncluded: false,
              jwsIncluded: false,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpFulfillCalled,
              resultConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateResultConsumed,
              receiptConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptConsumed,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateStatus === 'blocked' &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateBlockedBy ===
        'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_handling_disabled';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true
        ? 'recorded'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_dry_run_audit_recorded'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_handling_disabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldAuditReceiptDecode =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptJws =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayload =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptDecode =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayloadParse =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireFinalizedSettlement =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireTupleBinding =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireNoReplay =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecodeRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecodeRequired;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsResultConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptHandling = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditResultConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptConsumed = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadPresent = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsProductionRelease = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawReceiptPrinted = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadPresent === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsResultConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptHandling === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditResultConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawReceiptPrinted === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAudit =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeDryRunAudit.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditBlockedBy,
            source: {
              receiptDecodeHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateStatus,
              receiptDecodeHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReason,
              receiptDecodeHandlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateBlockedBy,
              receiptDecodeHandlingGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGate
                  ?.contract ?? null,
              receiptDecodePreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus,
              receiptDecodePreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason,
              receiptDecodePreflightBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy,
              receiptDecodePreflightContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
                  ?.contract ?? null,
              receiptMaterialHandlingGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus,
              receiptMaterialHandlingGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason,
              receiptMaterialHandlingGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy,
            },
            audit: {
              wouldAuditReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldAuditReceiptDecode,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayload,
              wouldRequireReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptDecode,
              wouldRequireReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayloadParse,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireNoReplay,
            },
            receiptDecode: {
              receiptJwsRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsRequired,
              receiptPayloadRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadRequired,
              receiptDecodeRequired:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecodeRequired,
              receiptJwsPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsPresent,
              receiptPayloadPresent:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadPresent,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadParsed,
            },
            safety: {
              sanitized: true,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawReceiptPrinted,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpFulfillCalled,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReplayTouched,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditStatus === 'recorded' &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditSideEffectFree === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true
        ? 'blocked'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_readiness_gate_blocked'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_not_enabled'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditObserved;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditSanitized =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAudit
        ?.safety?.sanitized === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldAuditReceiptDecode =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldAuditReceiptDecode;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptJws =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptJws;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayload =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayload;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptDecode =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptDecode;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayloadParse =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayloadParse;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireFinalizedSettlement =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireFinalizedSettlement;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireTupleBinding =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireTupleBinding;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireNoReplay =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireNoReplay;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecodeEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParseEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerificationEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerificationEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayCheckEnabled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateProductionReleaseAuthorizationEnabled = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawReceiptPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawReceiptPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateProductionReleaseAuthorizationEnabled === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeReadinessGate.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateBlockedBy,
            ready:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReady,
            source: {
              dryRunAuditStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditStatus,
              dryRunAuditReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReason,
              dryRunAuditBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditBlockedBy,
              dryRunAuditContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAudit
                  ?.contract ?? null,
            },
            readiness: {
              dryRunAuditObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditObserved,
              dryRunAuditSanitized:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditSanitized,
              wouldAuditReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldAuditReceiptDecode,
              wouldRequireReceiptJws:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptJws,
              wouldRequireReceiptPayload:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayload,
              wouldRequireReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptDecode,
              wouldRequireReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayloadParse,
              wouldRequireFinalizedSettlement:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireFinalizedSettlement,
              wouldRequireTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireTupleBinding,
              wouldRequireNoReplay:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireNoReplay,
              receiptDecodeEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecodeEnabled,
              receiptPayloadParseEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParseEnabled,
              finalizedSettlementVerificationEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerificationEnabled,
              tupleBindingVerificationEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerificationEnabled,
              replayCheckEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayCheckEnabled,
              productionReleaseAuthorizationEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateProductionReleaseAuthorizationEnabled,
            },
            safety: {
              sanitized: true,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayTouched,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpFulfillCalled,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawReceiptPrinted,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateObserved === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired === true &&
      phase3GatewayProductionReleaseReceiptDecodeEnabled === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired !== true
        ? 'inactive'
        : productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled === true
          ? 'enabled'
          : 'blocked';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired !== true
        ? null
        : productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled === true
          ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_enablement_enabled'
          : 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_enablement_disabled';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled === true
        ? null
        : productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReason;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawReceiptPrinted = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawReceiptPrinted === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGate =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeEnablementGate.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateBlockedBy,
            enabled:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled,
            ready:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReady,
            source: {
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
              readinessGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReason,
              readinessGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateBlockedBy,
              readinessGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGate
                  ?.contract ?? null,
            },
            enablement: {
              flag: 'PHASE3_GATEWAY_PRODUCTION_RELEASE_RECEIPT_DECODE_ENABLED',
              enabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled,
              allowsReceiptDecode:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptDecode,
              allowsReceiptPayloadParse:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptPayloadParse,
              allowsFinalizedSettlementVerification:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsFinalizedSettlementVerification,
              allowsTupleBinding:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsTupleBinding,
              allowsReplayCheck:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReplayCheck,
              allowsCrpFulfill:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsCrpFulfill,
              allowsProductionRelease:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsProductionRelease,
            },
            safety: {
              sanitized: true,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReplayTouched,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpFulfillCalled,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawReceiptPrinted,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired === true
        ? 'preflight_ready'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_activation_preflight_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightBlockedBy = null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawReceiptPrinted = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawReceiptPrinted === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflight =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeActivationPreflight.v1',
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightBlockedBy,
            ready:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReady,
            source: {
              enablementGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus,
              enablementGateReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReason,
              enablementGateBlockedBy:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateBlockedBy,
              enablementGateEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled,
              enablementGateContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGate
                  ?.contract ?? null,
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
              readinessGateReady:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReady,
            },
            preflight: {
              enablementGateObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateObserved,
              receiptDecodeEnablementEnabled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled,
              receiptJwsRequired: true,
              receiptPayloadRequired: true,
              decoderImplementationRequired: true,
              decoderImplementationAvailable: false,
              receiptMaterialObservationAllowed: false,
              receiptDecodeAllowed: false,
              receiptPayloadParseAllowed: false,
              finalizedSettlementVerificationRemainsDownstream: true,
              tupleBindingRemainsDownstream: true,
              replayCheckRemainsDownstream: true,
            },
            safety: {
              sanitized: true,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReplayTouched,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpFulfillCalled,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawReceiptPrinted,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightSideEffectFree,
            },
          }
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus === 'preflight_ready';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true
        ? 'unavailable'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_noop_decoder_unavailable'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderBlockedBy =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_noop_decoder_unavailable'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawReceiptPrinted = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderSideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawReceiptPrinted === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoder =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true
        ? {
            contract:
              'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeNoopDecoder.v1',
            mode: 'no_op',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderBlockedBy,
            ready:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReady,
            source: {
              activationPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus,
              activationPreflightReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReason,
              activationPreflightContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflight
                  ?.contract ?? null,
              enablementGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus,
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
            },
            decoder: {
              implementationRequired: true,
              implementationAvailable: false,
              invocationAllowed: false,
              invocationObserved: false,
              receiptJwsAccepted: false,
              receiptPayloadAccepted: false,
            },
            safety: {
              sanitized: true,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReplayTouched,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpFulfillCalled,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawReceiptPrinted,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderSideEffectFree,
            },
          }
        : null;


    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderObserved === true &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderStatus === 'unavailable';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryObserved =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired === true;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReady = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryStatus =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired === true
        ? 'preflight_ready'
        : 'inactive';

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReason =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired === true
        ? 'production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_metadata_boundary_preflight_ready'
        : null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryBlockedBy = null;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialObservation = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialHandling = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialConsumption = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptDecode = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptPayloadParse = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsFinalizedSettlementVerification = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsTupleBinding = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReplayCheck = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsCrpFulfill = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsProductionRelease = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialObserved = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialHandled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialConsumed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptDecoded = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptPayloadParsed = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryFinalizedSettlementVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryTupleBindingVerified = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReplayTouched = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAdapterInvoked = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryExternalCallAttempted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpFulfillCalled = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawProofPrinted = false;
    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawReceiptPrinted = false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundarySideEffectFree =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialObservation === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialHandling === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialConsumption === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptDecode === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptPayloadParse === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsFinalizedSettlementVerification === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsTupleBinding === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReplayCheck === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsCrpFulfill === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsProductionRelease === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialObserved === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialHandled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialConsumed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptDecoded === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptPayloadParsed === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryFinalizedSettlementVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryTupleBindingVerified === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReplayTouched === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAdapterInvoked === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryExternalCallAttempted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpFulfillCalled === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawProofPrinted === false &&
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawReceiptPrinted === false;

    const productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundary =
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired === true
        ? {
            contract:
              RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT,
            mode: 'contract_only',
            status:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryStatus,
            reason:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReason,
            blockedBy:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryBlockedBy,
            ready:
              productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReady,
            source: {
              noopDecoderStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderStatus,
              noopDecoderReason:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReason,
              noopDecoderContract:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoder
                  ?.contract ?? null,
              activationPreflightStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus,
              enablementGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus,
              readinessGateStatus:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
            },
            decoderInput: {
              futureDecoderInputRequired: true,
              metadataOnly: true,
              inputObjectBuilt: false,
              decoderInvocationAllowed: false,
              decoderInvocationObserved: false,
              allowedMetadataCategories: [
                ...RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES,
              ],
              prohibitedReceiptMaterialCategories: [
                ...RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES,
              ],
              receiptJwsAccepted: false,
              receiptPayloadAccepted: false,
              receiptBytesAccepted: false,
              receiptObjectAccepted: false,
              transactionHashAccepted: false,
            },
            safety: {
              sanitized: true,
              receiptMaterialObserved:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialObserved,
              receiptMaterialHandled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialHandled,
              receiptMaterialConsumed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialConsumed,
              receiptDecoded:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptDecoded,
              receiptPayloadParsed:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptPayloadParsed,
              finalizedSettlementVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryFinalizedSettlementVerified,
              tupleBindingVerified:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryTupleBindingVerified,
              replayTouched:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReplayTouched,
              adapterInvoked:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAdapterInvoked,
              externalCallAttempted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryExternalCallAttempted,
              crpCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpCalled,
              crpFulfillCalled:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpFulfillCalled,
              rawProofPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawProofPrinted,
              rawReceiptPrinted:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawReceiptPrinted,
              productionReleaseAuthorized: false,
              productionRelease: false,
              sideEffectFree:
                productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundarySideEffectFree,
            },
          }
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
      productionReleaseCrpFulfillClientAdapterNoopResultRequired,
      productionReleaseCrpFulfillClientAdapterNoopResultObserved,
      productionReleaseCrpFulfillClientAdapterNoopResultStatus,
      productionReleaseCrpFulfillClientAdapterNoopResultReason,
      productionReleaseCrpFulfillClientAdapterNoopResult,
      productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled,
      productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterNoopResultSideEffectFree,
      productionReleaseCrpFulfillClientAdapterDecisionGateRequired,
      productionReleaseCrpFulfillClientAdapterDecisionGateObserved,
      productionReleaseCrpFulfillClientAdapterDecisionGateStatus,
      productionReleaseCrpFulfillClientAdapterDecisionGateReason,
      productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterDecisionGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterDecisionGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterDecisionGate,
      productionReleaseCrpFulfillClientAdapterDecisionGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterInvocationGateRequired,
      productionReleaseCrpFulfillClientAdapterInvocationGateObserved,
      productionReleaseCrpFulfillClientAdapterInvocationGateMode,
      productionReleaseCrpFulfillClientAdapterInvocationGateStatus,
      productionReleaseCrpFulfillClientAdapterInvocationGateReason,
      productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterInvocationGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterInvocationGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterInvocationGate,
      productionReleaseCrpFulfillClientAdapterInvocationGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationMode,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReason,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationResult,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationSideEffectFree,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason,
      productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessReady,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessContract,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessStatus,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessReason,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessBlockedBy,
      productionReleaseCrpFulfillClientAdapterHandoffReadiness,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpCalled,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterHandoffReadinessSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultContractRequired,
      productionReleaseCrpFulfillClientAdapterResultContractAvailable,
      productionReleaseCrpFulfillClientAdapterResultContract,
      productionReleaseCrpFulfillClientAdapterResultContractMode,
      productionReleaseCrpFulfillClientAdapterResultContractReady,
      productionReleaseCrpFulfillClientAdapterResultContractBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultContractExpectedShape,
      productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultContractCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultContractAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultContractAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultContractSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResult,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateReason,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultDecisionGate,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateStatus,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateReason,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultHandlingGate,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultHandlingGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContract,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumptionEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumptionEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateProductionReleaseAuthorizationEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecodeRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptJwsPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptHandling,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeHandlingGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAudit,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecodeRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldAuditReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptJws,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayload,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireFinalizedSettlement,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditWouldRequireNoReplay,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptJwsPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadPresent,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsResultConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptHandling,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditResultConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReceiptConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeDryRunAuditSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateDryRunAuditSanitized,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldAuditReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptJws,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayload,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireFinalizedSettlement,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateWouldRequireNoReplay,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecodeEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParseEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerificationEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerificationEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayCheckEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateProductionReleaseAuthorizationEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeReadinessGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateEnabled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGate,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeEnablementGateSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflight,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeActivationPreflightSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoder,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeNoopDecoderSideEffectFree,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRequired,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReady,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryStatus,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReason,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryBlockedBy,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundary,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialObservation,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialHandling,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptMaterialConsumption,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptDecode,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReceiptPayloadParse,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsFinalizedSettlementVerification,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsTupleBinding,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsReplayCheck,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsCrpFulfill,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAllowsProductionRelease,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialObserved,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialHandled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptMaterialConsumed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptDecoded,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReceiptPayloadParsed,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryFinalizedSettlementVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryTupleBindingVerified,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryReplayTouched,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryAdapterInvoked,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryExternalCallAttempted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryCrpFulfillCalled,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawProofPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundaryRawReceiptPrinted,
      productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodeMetadataBoundarySideEffectFree,
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

  if (
    resourcePathname === '/paid-gated' &&
    phase4RealCrpFulfillInvocationBoundaryEnabled === true
  ) {
    const phase4PolicyGate = await requirePolicySatisfiedIfGated();
    if (!phase4PolicyGate.ok) return;

    let phase4Fulfill: any = null;
    let phase4ErrorMessage: string | null = null;
    let phase4HttpStatus: number | null = null;
    let phase4CrpStatus: string | null = null;
    let phase4ReceiptJws: string | null = null;
    let phase4ReceiptJwsPresent = false;
    let phase4ReceiptJwsShapeValid = false;
    let phase4ReceiptJwsDecodePreflightRequired = false;
    let phase4ReceiptJwsDecodePreflightObserved = false;
    let phase4ReceiptJwsDecodePreflightStatus:
      | 'not_requested'
      | 'decoded'
      | 'missing'
      | 'invalid_shape'
      | 'decode_error'
      | 'unavailable' = 'not_requested';
    let phase4ReceiptJwsDecodePreflightErrorCode: string | null = null;
    let phase4ReceiptJwsCompactPartCount = 0;
    let phase4ReceiptJwsDecodedHeaderJson = false;
    let phase4ReceiptJwsDecodedPayloadJson = false;
    let phase4ReceiptJwsDecodedHeaderAlg: string | null = null;
    let phase4ReceiptJwsDecodedHeaderTyp: string | null = null;
    let phase4ReceiptJwsDecodedHeaderKid: string | null = null;
    let phase4ReceiptJwsDecodedPayloadReceiptVersion: string | null = null;
    let phase4ReceiptJwsDecodedPayloadTestOnly: boolean | null = null;
    let phase4ReceiptJwsDecodedPayloadReleaseConsumable: boolean | null = null;
    let phase4ReceiptJwsHandoffRequired = false;
    let phase4ReceiptJwsHandoffObserved = false;
    let phase4ReceiptJwsHandoffStatus: 'observed' | 'missing' | 'unavailable' = 'missing';
    let phase4BoundaryStatus: 'called' | 'unavailable' = 'called';

    try {
      phase4Fulfill = await crpClient.fulfillPayment(matchReq);
      phase4HttpStatus =
        typeof phase4Fulfill?.httpStatus === 'number' ? phase4Fulfill.httpStatus : null;
      phase4CrpStatus =
        typeof phase4Fulfill?.status === 'string' ? phase4Fulfill.status : null;

      phase4ReceiptJws =
        typeof phase4Fulfill?.match?.receipt?.jws === 'string'
          ? phase4Fulfill.match.receipt.jws
          : typeof phase4Fulfill?.receipt?.jws === 'string'
            ? phase4Fulfill.receipt.jws
            : typeof phase4Fulfill?.receiptJws === 'string'
              ? phase4Fulfill.receiptJws
              : null;

      phase4ReceiptJwsPresent = typeof phase4ReceiptJws === 'string' && phase4ReceiptJws.length > 0;
      phase4ReceiptJwsShapeValid =
        phase4ReceiptJwsPresent === true && String(phase4ReceiptJws).split('.').length === 3;

      if (phase4RealReceiptJwsHandoffContractEnabled === true) {
        phase4ReceiptJwsHandoffRequired = true;
        phase4ReceiptJwsHandoffObserved = phase4ReceiptJwsPresent === true;
        phase4ReceiptJwsHandoffStatus = phase4ReceiptJwsPresent === true ? 'observed' : 'missing';
      }
    } catch (err: any) {
      phase4BoundaryStatus = 'unavailable';
      phase4ErrorMessage = String(err?.message ?? err);
    }

    if (
      phase4RealReceiptJwsHandoffContractEnabled === true &&
      phase4BoundaryStatus === 'unavailable'
    ) {
      phase4ReceiptJwsHandoffRequired = true;
      phase4ReceiptJwsHandoffObserved = false;
      phase4ReceiptJwsHandoffStatus = 'unavailable';
    }

    const phase4BoundaryReason =
      phase4BoundaryStatus === 'unavailable'
        ? 'phase4_real_crp_fulfill_invocation_boundary_crp_unavailable'
        : phase4ReceiptJwsPresent === true
          ? 'phase4_real_crp_fulfill_invocation_boundary_receipt_observed_release_blocked'
          : 'phase4_real_crp_fulfill_invocation_boundary_called_release_blocked';

    if (phase4RealReceiptJwsDecodePreflightEnabled === true) {
      phase4ReceiptJwsDecodePreflightRequired = true;
      phase4ReceiptJwsCompactPartCount =
        typeof phase4ReceiptJws === 'string' ? phase4ReceiptJws.split('.').length : 0;

      if (phase4BoundaryStatus === 'unavailable') {
        phase4ReceiptJwsDecodePreflightStatus = 'unavailable';
      } else if (phase4ReceiptJwsPresent !== true) {
        phase4ReceiptJwsDecodePreflightStatus = 'missing';
      } else if (phase4ReceiptJwsShapeValid !== true || typeof phase4ReceiptJws !== 'string') {
        phase4ReceiptJwsDecodePreflightStatus = 'invalid_shape';
        phase4ReceiptJwsDecodePreflightErrorCode = 'invalid_compact_jws_shape';
      } else {
        try {
          const [phase4ReceiptJwsHeaderPart, phase4ReceiptJwsPayloadPart] =
            phase4ReceiptJws.split('.');
          const phase4ReceiptJwsDecodedHeader = JSON.parse(
            Buffer.from(phase4ReceiptJwsHeaderPart ?? '', 'base64url').toString('utf8'),
          );
          const phase4ReceiptJwsDecodedPayload = JSON.parse(
            Buffer.from(phase4ReceiptJwsPayloadPart ?? '', 'base64url').toString('utf8'),
          );

          phase4ReceiptJwsDecodedHeaderJson =
            typeof phase4ReceiptJwsDecodedHeader === 'object' &&
            phase4ReceiptJwsDecodedHeader !== null &&
            !Array.isArray(phase4ReceiptJwsDecodedHeader);
          phase4ReceiptJwsDecodedPayloadJson =
            typeof phase4ReceiptJwsDecodedPayload === 'object' &&
            phase4ReceiptJwsDecodedPayload !== null &&
            !Array.isArray(phase4ReceiptJwsDecodedPayload);

          if (phase4ReceiptJwsDecodedHeaderJson === true) {
            phase4ReceiptJwsDecodedHeaderAlg =
              typeof phase4ReceiptJwsDecodedHeader.alg === 'string'
                ? phase4ReceiptJwsDecodedHeader.alg
                : null;
            phase4ReceiptJwsDecodedHeaderTyp =
              typeof phase4ReceiptJwsDecodedHeader.typ === 'string'
                ? phase4ReceiptJwsDecodedHeader.typ
                : null;
            phase4ReceiptJwsDecodedHeaderKid =
              typeof phase4ReceiptJwsDecodedHeader.kid === 'string'
                ? phase4ReceiptJwsDecodedHeader.kid
                : null;
          }

          if (phase4ReceiptJwsDecodedPayloadJson === true) {
            phase4ReceiptJwsDecodedPayloadReceiptVersion =
              typeof phase4ReceiptJwsDecodedPayload.receiptVersion === 'string'
                ? phase4ReceiptJwsDecodedPayload.receiptVersion
                : null;
            phase4ReceiptJwsDecodedPayloadTestOnly =
              typeof phase4ReceiptJwsDecodedPayload.testOnly === 'boolean'
                ? phase4ReceiptJwsDecodedPayload.testOnly
                : null;
            phase4ReceiptJwsDecodedPayloadReleaseConsumable =
              typeof phase4ReceiptJwsDecodedPayload.releaseConsumable === 'boolean'
                ? phase4ReceiptJwsDecodedPayload.releaseConsumable
                : null;
          }

          phase4ReceiptJwsDecodePreflightObserved =
            phase4ReceiptJwsDecodedHeaderJson === true &&
            phase4ReceiptJwsDecodedPayloadJson === true;
          phase4ReceiptJwsDecodePreflightStatus =
            phase4ReceiptJwsDecodePreflightObserved === true ? 'decoded' : 'decode_error';
          phase4ReceiptJwsDecodePreflightErrorCode =
            phase4ReceiptJwsDecodePreflightObserved === true ? null : 'decoded_value_not_json_object';
        } catch (_err: any) {
          phase4ReceiptJwsDecodePreflightObserved = false;
          phase4ReceiptJwsDecodePreflightStatus = 'decode_error';
          phase4ReceiptJwsDecodePreflightErrorCode = 'invalid_base64url_or_json';
        }
      }
    }

    const phase4ReceiptJwsDecodePreflight =
      phase4RealReceiptJwsDecodePreflightEnabled === true
        ? {
            contract: 'phase4.realReceiptJwsDecodePreflight.v1',
            required: phase4ReceiptJwsDecodePreflightRequired,
            observed: phase4ReceiptJwsDecodePreflightObserved,
            enabled: true,
            status: phase4ReceiptJwsDecodePreflightStatus,
            source: 'phase4.realReceiptJwsHandoffContract.v1',
            compactPartCount: phase4ReceiptJwsCompactPartCount,
            receiptJwsPresent: phase4ReceiptJwsPresent,
            receiptJwsShapeValid: phase4ReceiptJwsShapeValid,
            decodedHeaderJson: phase4ReceiptJwsDecodedHeaderJson,
            decodedPayloadJson: phase4ReceiptJwsDecodedPayloadJson,
            header: {
              alg: phase4ReceiptJwsDecodedHeaderAlg,
              typ: phase4ReceiptJwsDecodedHeaderTyp,
              kid: phase4ReceiptJwsDecodedHeaderKid,
              rawPrinted: false,
            },
            payload: {
              receiptVersion: phase4ReceiptJwsDecodedPayloadReceiptVersion,
              testOnly: phase4ReceiptJwsDecodedPayloadTestOnly,
              releaseConsumable: phase4ReceiptJwsDecodedPayloadReleaseConsumable,
              rawPrinted: false,
            },
            errorCode: phase4ReceiptJwsDecodePreflightErrorCode,
            receiptJwsRawPrinted: false,
            receiptJwsPrinted: false,
            decodedHeaderRawPrinted: false,
            decodedPayloadRawPrinted: false,
            signatureVerified: false,
            verified: false,
            settlementVerified: false,
            tupleBindingVerified: false,
            releaseConsumable: false,
            consumedByReleaseDecision: false,
            releaseDecisionMutated: false,
            productionRelease: false,
            paymentResponseEmitted: false,
            resourceReleased: false,
            replayTouched: false,
            canonicalReleasePersisted: false,
            sideEffectFreeExceptCrpFulfillCall: true,
          }
        : null;

    const phase4ReceiptJwsHandoffContract =
      phase4RealReceiptJwsHandoffContractEnabled === true
        ? {
            contract: 'phase4.realReceiptJwsHandoffContract.v1',
            required: phase4ReceiptJwsHandoffRequired,
            observed: phase4ReceiptJwsHandoffObserved,
            enabled: true,
            status: phase4ReceiptJwsHandoffStatus,
            source: 'crp_fulfill',
            handoffObjectPresent: phase4ReceiptJwsHandoffObserved,
            receiptJwsPresent: phase4ReceiptJwsPresent,
            receiptJwsShapeValid: phase4ReceiptJwsShapeValid,
            receiptJwsRawPrinted: false,
            receiptJwsPrinted: false,
            rawReceiptPrinted: false,
            rawProofPrinted: false,
            decoded: false,
            verified: false,
            releaseConsumable: false,
            consumedByReleaseDecision: false,
            releaseDecisionMutated: false,
            productionRelease: false,
            paymentResponseEmitted: false,
            resourceReleased: false,
            replayTouched: false,
            canonicalReleasePersisted: false,
            sideEffectFreeExceptCrpFulfillCall: true,
          }
        : null;

    return reply402AfterPersistingIssuedChallengeIfGated({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Phase 4 real CRP fulfill invocation boundary active',
      phase4: {
        realCrpFulfillInvocationBoundary: {
          contract: 'phase4.realCrpFulfillInvocationBoundary.v1',
          required: true,
          observed: true,
          enabled: true,
          status: phase4BoundaryStatus,
          reason: phase4BoundaryReason,
          httpStatus: phase4HttpStatus,
          crpStatus: phase4CrpStatus,
          errorCode: phase4BoundaryStatus === 'unavailable' ? 'crp_unavailable' : null,
          errorMessage: phase4ErrorMessage,
          target: {
            service: 'crp',
            operation: 'fulfill',
            method: 'POST',
            path: '/v1/crp/payments/fulfill',
          },
          request: {
            merchantId: matchReq.merchantId,
            nonce: matchReq.nonce,
            network: matchReq.network,
            payTo: matchReq.payTo,
            amount: matchReq.amount,
            asset: matchReq.asset,
          },
          receipt: {
            jwsPresent: phase4ReceiptJwsPresent,
            jwsShapeValid: phase4ReceiptJwsShapeValid,
            rawPrinted: false,
          },
          ...(phase4ReceiptJwsHandoffContract
            ? { realReceiptJwsHandoffContract: phase4ReceiptJwsHandoffContract }
            : {}),
          ...(phase4ReceiptJwsDecodePreflight
            ? { realReceiptJwsDecodePreflight: phase4ReceiptJwsDecodePreflight }
            : {}),
          safety: {
            crpFulfillInvocationAttempted: true,
            externalCallAttempted: true,
            crpCalled: phase4BoundaryStatus !== 'unavailable',
            crpFulfillCalled: phase4BoundaryStatus !== 'unavailable',
            receiptJwsPresent: phase4ReceiptJwsPresent,
            receiptJwsShapeValid: phase4ReceiptJwsShapeValid,
            receiptJwsRawPrinted: false,
            rawProofPrinted: false,
            rawReceiptPrinted: false,
            productionRelease: false,
            resourceReleased: false,
            paymentResponseEmitted: false,
            canonicalReleasePersisted: false,
            replayTouched: false,
            sideEffectFreeExceptCrpFulfillCall: true,
          },
        },
      },
    });
  }

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
        // When explicitly required, activate the existing live Direct Buyer
        // verifier. Any SDK, network, presentation, or binding failure remains
        // fail-closed; no parsed-only fallback is permitted by the policy layer.
        liveVerify: phase3RequireLiveZkp,
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
