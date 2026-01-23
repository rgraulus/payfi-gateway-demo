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
//
// DEV-ONLY PAID-PATH HARNESS (hardened; off by default):
// - Requires X402_ALLOW_DEV_HARNESS=true AND NODE_ENV != production
// - If enabled and X402_DEV_RECEIPT_JWS is set, we skip CRP calls and use that receipt JWS.
// - Still requires local JWKS verification + proof payload validation.
//
// OPTIONAL HARDENING:
// - When X402_ALLOW_DEV_HARNESS=true, /healthz includes non-secret dev receipt metadata:
//   jwksUrl, receipt sha256 prefix, kid, iat/exp — but NEVER the full receipt JWS.
//
// Phase C:
// - Deterministic tuple key + in-memory replay cache
// - Enforce replay protection immediately after verifyAndValidateProof succeeds
//   and BEFORE emitting PAYMENT-RESPONSE.
//
// Hardening (Phase C.1):
// - Replay cache expiry uses the tightest bound:
//     expSec = min(receipt.exp, proof.settlement.expiresAt, paymentRequired.expiresAtSec, now+ttlSec)
// - If derived expSec <= nowSec, treat as expired and 402 (never emit PAYMENT-RESPONSE).

import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID, createHash } from 'crypto';

import { CrpClient, MatchPaymentRequest } from './crpClient';
import {
  loadContracts,
  resolveContract,
  buildPaymentRequiredPayload,
  b64jsonHeader,
  ContractDefinition,
} from './contracts';

import type { ContractBinding, HttpMethod } from './proofPayload';
import {
  assertCcdPltProofV1,
  validateCcdPltProofAgainstContract,
  ProofPayloadError,
} from './proofPayload';

// Phase C modules
import { buildTupleKey } from './x402/tupleKey';
import { ReplayCache } from './x402/replayCache';
import { receiptSha12 as receiptSha12Fingerprint } from './x402/receiptFingerprint';

const app = express();
app.use(bodyParser.json());

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3005);

const crpBaseUrl = (process.env.CRP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const jwksUrl = process.env.CRP_JWKS_URL ?? `${crpBaseUrl}/.well-known/jwks.json`;

const expectedKid = process.env.X402_EXPECTED_KID;

const x402Debug = String(process.env.X402_DEBUG ?? '').toLowerCase() === 'true';
const legacyHeaders = String(process.env.X402_LEGACY_HEADERS ?? '').toLowerCase() === 'true';

const ttlSec = Number(process.env.X402_TTL_SEC ?? 300);
const contractsPath = process.env.X402_CONTRACTS_PATH ?? 'config/contracts.json';

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

// Phase C: replay cache (in-memory, lazy purge)
const replayCache = new ReplayCache();

// Load contracts once at startup (fail fast if frozen mismatch)
let contracts: ContractDefinition[] = [];
try {
  ({ contracts } = loadContracts(contractsPath));
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

  res.setHeader(
    'Access-Control-Allow-Headers',
    legacyHeaders
      ? 'Content-Type,PAYMENT-SIGNATURE,X-PAYMENT-SIGNATURE'
      : 'Content-Type,PAYMENT-SIGNATURE',
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

async function proxyToUpstream(args: {
  req: express.Request;
  res: express.Response;
  contract: ContractDefinition;
  resourcePathname: string;
}) {
  const { req, res, contract, resourcePathname } = args;

  if (!contract.upstream?.baseUrl) {
    return res.status(500).json({ ok: false, error: 'proxy mode missing upstream.baseUrl' });
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

  res.status(upstreamResp.status);

  upstreamResp.headers.forEach((value, key) => {
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
      return;
    }
    res.setHeader(key, value);
  });

  const buf = await upstreamResp.arrayBuffer();
  res.send(Buffer.from(buf));
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

// Phase C: extract amountRaw for tuple key from proof when possible, else from contract
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
// Phase C hardening helpers
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
// Health / readiness
// -----------------------------------------------------------------------------

app.get('/healthz', (_req, res) => {
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
    replayCache: {
      size: replayCache.size(),
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
  // Resolve contract based on the underlying resource path (e.g. /premium)
  let contract: ContractDefinition;
  try {
    contract = resolveContract(contracts, { method: req.method, pathname: resourcePathname });
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

  const nonceFromQuery =
    typeof req.query.nonce === 'string' && req.query.nonce.length > 0 ? req.query.nonce : null;

  const nonceFromSig =
    typeof paymentSignature?.nonce === 'string' && paymentSignature.nonce.length > 0
      ? paymentSignature.nonce
      : null;

  const nonce = nonceFromQuery ?? nonceFromSig ?? `demo-${randomUUID()}`;

  const nowSec = Math.floor(Date.now() / 1000);

  const paymentRequiredHeaderPayload = buildPaymentRequiredPayload({
    contract,
    nonce,
    issuedAtSec: nowSec,
    expiresAtSec: nowSec + ttlSec,
  });

  const paymentRequiredBody = {
    ...paymentRequiredHeaderPayload,
    facilitator: crpBaseUrl,
    description: `Payment required for ${contract.resource.method.toUpperCase()} ${contract.resource.path}`,
  };

  const matchReq: MatchPaymentRequest = {
    merchantId: contract.merchantId,
    nonce,
    network: contract.network,
    payTo: contract.payTo,
    amount: contract.amount,
    asset: contract.asset,
  };

  // Precompute header value so every 402 uses the same payload
  const prB64 = b64jsonHeader(paymentRequiredHeaderPayload);

  // Helper to issue a "payment required" response consistently
  const reply402 = (body: any) => {
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

  // Helper: once we have a receipt JWS, verify signature + enforce proof payload semantics.
  const verifyAndValidateProof = async (receiptJws: string) => {
    const verify = await verifyReceiptJwsLocal(receiptJws);

    // Phase B (real): require ccd-plt-proof@v1 in receipt payload
    const payload = verify.payload;

    assertCcdPltProofV1(payload);

    validateCcdPltProofAgainstContract({
      proof: payload,
      expected: {
        nonce,
        contract: toContractBinding(contract),
        nowSec,
      },
    });

    return { verify, proof: payload };
  };

  // Phase C: enforce replay AFTER verify+validate and BEFORE PAYMENT-RESPONSE
  const enforceReplay = (args: {
    receiptJws: string;
    verify: any;
    proof: any;
    match?: any;
    fulfill?: any;
  }): boolean => {
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
      return false;
    }

    const amountRaw = amountRawFromProofOrContract(args.proof, contract);

    // Bind tuple to request method + canonicalized path(+query) (tupleKey.ts canonicalizes query order)
    const pathWithQuery = `${resourcePathname}${reqQueryString(req)}`;

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
    });

    const decision = replayCache.checkAndInsert({
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
      return false;
    }

    return true;
  };

  // ---------------------------------------------------------------------------
  // DEV BYPASS (Phase B harness): If devReceiptJws is set, skip CRP calls.
  // Hardened by:
  // - X402_ALLOW_DEV_HARNESS=true
  // - NODE_ENV != production
  // Still enforces:
  // - PAYMENT-SIGNATURE must be present (unless disabled)
  // - receipt must verify locally via JWKS
  // - receipt payload must be valid ccd-plt-proof@v1 bound to contract+nonce
  // ---------------------------------------------------------------------------
  if (devReceiptJws) {
    if (devReceiptRequiresPaymentSignature && !paymentSignatureB64) {
      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'PAYMENT-SIGNATURE required (dev harness)',
        ...(x402Debug ? { debug: { devReceiptRequiresPaymentSignature: true } } : {}),
      });
    }

    let verify: any;
    let proof: any;
    try {
      const out = await verifyAndValidateProof(devReceiptJws);
      verify = out.verify;
      proof = out.proof;
    } catch (err: any) {
      const message =
        err?.name === 'ReceiptVerifyError'
          ? String(err.message)
          : err?.name === 'ProofPayloadError' || err instanceof ProofPayloadError
            ? proofErrorToString(err)
            : String(err?.message ?? err);

      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Invalid payment receipt (dev harness)',
        ...(x402Debug ? { debug: { reason: message } } : {}),
      });
    }

    // Phase C: replay protection BEFORE PAYMENT-RESPONSE
    if (!enforceReplay({ receiptJws: devReceiptJws, verify, proof })) return;

    // Frozen PAYMENT-RESPONSE shape (Phase B)
    const paymentResponseHeaderPayload = {
      version: 'x402-v2',
      contractId: contract.contractId,
      contractVersion: contract.contractVersion,
      merchantId: contract.merchantId,
      resource: contract.resource,
      nonce,
      settled: true,
      receipt: {
        jws: devReceiptJws,
        payload: proof ?? null,
      },
    };

    const respB64 = b64json(paymentResponseHeaderPayload);
    res.setHeader('PAYMENT-RESPONSE', respB64);
    if (legacyHeaders) res.setHeader('X-PAYMENT-RESPONSE', respB64);

    if ((contract.mode ?? 'local') === 'proxy') {
      try {
        return await proxyToUpstream({ req, res, contract, resourcePathname });
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
    });
  }

  // 1) Call CRP (match + fulfill). Transport/JSON errors are gateway errors.
  let match: any;
  let fulfill: any;

  try {
    match = await crpClient.matchPayment(matchReq);
    fulfill = await crpClient.fulfillPayment(matchReq);
  } catch (err) {
    console.error('Error calling CRP:', err);
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
    fulfill?.ok === true &&
    (fulfill?.count ?? 0) >= 1 &&
    m?.status === 'fulfilled' &&
    !!receiptJws;

  if (!isPaid) {
    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      ...(x402Debug ? { debug: { match, fulfill } } : {}),
    });
  }

  // 3) C3/C4: Verify FIRST. If verify fails, return 402 (invalid receipt) and DO NOT set PAYMENT-RESPONSE.
  // Phase B (real): also enforce proof payload semantics.
  let verify: any;
  let proof: any;
  try {
    const out = await verifyAndValidateProof(receiptJws!);
    verify = out.verify;
    proof = out.proof;
  } catch (err: any) {
    const message =
      err?.name === 'ReceiptVerifyError'
        ? String(err.message)
        : err?.name === 'ProofPayloadError' || err instanceof ProofPayloadError
          ? proofErrorToString(err)
          : String(err?.message ?? err);

    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Invalid payment receipt',
      ...(x402Debug ? { debug: { reason: message, match, fulfill } } : {}),
    });
  }

  // Phase C: replay protection BEFORE PAYMENT-RESPONSE
  if (!enforceReplay({ receiptJws: receiptJws!, verify, proof, match, fulfill })) return;

  // 4) Only after verification succeeds do we emit PAYMENT-RESPONSE headers.
  // Phase B: Frozen PAYMENT-RESPONSE shape.
  const paymentResponseHeaderPayload = {
    version: 'x402-v2',
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    merchantId: contract.merchantId,
    resource: contract.resource,
    nonce,
    settled: true,
    receipt: {
      jws: receiptJws!,
      payload: proof ?? null,
    },
  };

  const respB64 = b64json(paymentResponseHeaderPayload);
  res.setHeader('PAYMENT-RESPONSE', respB64);
  if (legacyHeaders) res.setHeader('X-PAYMENT-RESPONSE', respB64);

  // Serve locally or proxy upstream
  if ((contract.mode ?? 'local') === 'proxy') {
    try {
      return await proxyToUpstream({ req, res, contract, resourcePathname });
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

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

// Existing local/demo endpoint (still supported)
app.get('/paid', async (req, res) => handleX402(req, res, '/paid'));

// Generic edge gateway route: /x402/... (regex because path-to-regexp v6 rejects '/x402/*')
// Example: GET /x402/premium?nonce=...  -> resolves contract for GET /premium
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

app.listen(port, () => {
  console.log(`payfi-gateway-demo HTTP server listening on http://localhost:${port}`);
});
