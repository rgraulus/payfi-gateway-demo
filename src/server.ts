// src/server.ts
//
// x402 v2 alignment + C3/C4 enforcement:
// - Default to standard headers only: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
// - Optional legacy X-* headers behind X402_LEGACY_HEADERS=true
// - Parse PAYMENT-SIGNATURE (base64 JSON). If it contains `nonce`, we’ll reuse it.
// - C3: NEVER emit PAYMENT-RESPONSE headers unless local receipt verify succeeds.
// - C4: If payment exists but receipt verification fails: 402 + PAYMENT-REQUIRED with clearer error.
// - If CRP calls fail (transport/JSON): 402 + PAYMENT-REQUIRED with "Gateway error while checking payment"
// - If CRP returns event_claimed (409): 402 + PAYMENT-REQUIRED with "Payment already claimed (event_claimed)"
// - Debug details only when X402_DEBUG=true
//
// Phase A wiring:
// - Load contracts from config/contracts.json
// - Resolve /paid -> ContractDefinition
// - Build PAYMENT-REQUIRED header payload from contract (frozen shape)

import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID } from 'crypto';

import { CrpClient, MatchPaymentRequest } from './crpClient';
import {
  loadContracts,
  resolveContract,
  buildPaymentRequiredPayload,
  b64jsonHeader,
  ContractDefinition,
} from './contracts';

const app = express();
app.use(bodyParser.json());

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3005);

const crpBaseUrl = (process.env.CRP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const jwksUrl = process.env.CRP_JWKS_URL ?? `${crpBaseUrl}/.well-known/jwks.json`;

// Optional: pin expected kid for demos (recommended)
const expectedKid = process.env.X402_EXPECTED_KID;

// Debug gating for response bodies (NOT headers)
const x402Debug = String(process.env.X402_DEBUG ?? '').toLowerCase() === 'true';

// Optional legacy header support (X-*)
const legacyHeaders = String(process.env.X402_LEGACY_HEADERS ?? '').toLowerCase() === 'true';

// How long a PAYMENT-REQUIRED challenge is valid (seconds)
const ttlSec = Number(process.env.X402_TTL_SEC ?? 300);

// Contract registry path
const contractsPath = process.env.X402_CONTRACTS_PATH ?? 'config/contracts.json';

// Load contracts once at startup (fail fast if frozen mismatch)
let contracts: ContractDefinition[] = [];
try {
  ({ contracts } = loadContracts(contractsPath));
  console.log(`[contracts] loaded ${contracts.length} contract(s) from ${contractsPath}`);
  for (const c of contracts) {
    console.log(
      `[contracts] ${c.resource.method.toUpperCase()} ${c.resource.path} -> ${c.contractId} (v${c.contractVersion}, frozen=${c.isFrozen})`,
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

  // Allow clients to send PAYMENT-SIGNATURE. Optionally allow X-PAYMENT-SIGNATURE.
  res.setHeader(
    'Access-Control-Allow-Headers',
    legacyHeaders
      ? 'Content-Type,PAYMENT-SIGNATURE,X-PAYMENT-SIGNATURE'
      : 'Content-Type,PAYMENT-SIGNATURE',
  );

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  // Expose response headers so browser clients can read PAYMENT-REQUIRED / PAYMENT-RESPONSE.
  const exposed = ['PAYMENT-REQUIRED', 'PAYMENT-SIGNATURE', 'PAYMENT-RESPONSE'];
  if (legacyHeaders) exposed.push('X-PAYMENT-REQUIRED', 'X-PAYMENT-SIGNATURE', 'X-PAYMENT-RESPONSE');

  res.setHeader('Access-Control-Expose-Headers', exposed.join(','));

  // Prevent caching of challenge / receipt headers
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
  else if (pad !== 0) {
    // pad === 1 is invalid, but we’ll let Buffer throw for clearer error
  }
  return s;
}

function parseB64Json<T = any>(b64: string): T {
  const s = normalizeB64(b64);
  const json = Buffer.from(s, 'base64').toString('utf8');
  return JSON.parse(json) as T;
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

// -----------------------------------------------------------------------------
// Health / readiness
// -----------------------------------------------------------------------------

app.get('/healthz', (_req, res) => {
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
    contractsLoaded: contracts.map((c) => ({
      contractId: c.contractId,
      contractVersion: c.contractVersion,
      isFrozen: c.isFrozen,
      merchantId: c.merchantId,
      resource: c.resource,
      network: c.network,
      asset: c.asset,
      amount: c.amount,
      payTo: c.payTo,
      attestations: c.attestations ?? [],
    })),
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
// Canonical-ish x402 demo endpoint: /paid
//
// - If no nonce (or no fulfilled receipt): return 402 + PAYMENT-REQUIRED header
// - If nonce provided and facilitator finds/fulfills: return 200 + PAYMENT-RESPONSE header
// - On 200: verify receipt JWS locally via facilitator JWKS (NO /v1/verify call)
//
// x402 v2: client retries with PAYMENT-SIGNATURE. We parse it and reuse `nonce` if present.
// C3: NEVER emit PAYMENT-RESPONSE headers unless local verify succeeds.
// C4: If receipt verify fails, return 402 with clearer "Invalid payment receipt" error.
//
// Phase A:
// - Resolve contract from registry and build PAYMENT-REQUIRED header payload from contract
// -----------------------------------------------------------------------------
//
// IMPORTANT BEHAVIOR NOTE:
// - CRP can legitimately return non-2xx such as 409 event_claimed.
// - That is NOT a transport failure; we treat it as "not paid" and return 402 with a clearer error.
// - Only network/transport/JSON errors are labeled "Gateway error while checking payment".
//
// -----------------------------------------------------------------------------

app.get('/paid', async (req, res) => {
  // Resolve the contract for this request (method + pathname)
  let contract: ContractDefinition;
  try {
    contract = resolveContract(contracts, { method: req.method, url: req.originalUrl || req.url });
  } catch (e: any) {
    // Should never happen for /paid if registry is correct
    return res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }

  // Parse PAYMENT-SIGNATURE (base64 JSON). Not required for this demo flow,
  // but improves v2 compatibility (nonce continuity without query params).
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

  // Build Phase A frozen PAYMENT-REQUIRED header payload from the contract
  const nowSec = Math.floor(Date.now() / 1000);
  const paymentRequiredHeaderPayload = buildPaymentRequiredPayload({
    contract,
    nonce,
    issuedAtSec: nowSec,
    expiresAtSec: nowSec + ttlSec,
  });

  // For response bodies (DX), we can include extra info (NOT part of the frozen header)
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
      ...(x402Debug
        ? {
            debug: {
              reason: paymentSignatureParseError,
              paymentSignatureB64Present: true,
            },
          }
        : {}),
    });
  }

  // 1) Call CRP (match + fulfill). Transport/JSON errors are gateway errors.
  let match: any;
  let fulfill: any;

  try {
    match = await crpClient.matchPayment(matchReq);
    fulfill = await crpClient.fulfillPayment(matchReq);
  } catch (err) {
    console.error('Error calling CRP in /paid:', err);
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
      ...(x402Debug
        ? {
            debug: {
              match,
              fulfill,
              paymentSignature: paymentSignature ?? null,
              paymentSignatureB64Present: !!paymentSignatureB64,
            },
          }
        : {}),
    });
  }

  // 3) C3/C4: Verify FIRST. If verify fails, return 402 (invalid receipt) and DO NOT set PAYMENT-RESPONSE.
  let verify: any;
  try {
    verify = await verifyReceiptJwsLocal(receiptJws!);
  } catch (err: any) {
    // Receipt verification failures are not "gateway errors" — just invalid/untrusted payment proof.
    const message = err?.name === 'ReceiptVerifyError' ? String(err.message) : String(err);

    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Invalid payment receipt',
      ...(x402Debug
        ? {
            debug: {
              reason: message,
              match,
              fulfill,
              expectedKid: expectedKid ?? null,
              paymentSignature: paymentSignature ?? null,
              paymentSignatureB64Present: !!paymentSignatureB64,
            },
          }
        : {}),
    });
  }

  // 4) Only after verification succeeds do we emit PAYMENT-RESPONSE headers.
  const paymentResponse = {
    // Phase A spec: we only freeze that PAYMENT-RESPONSE is base64 JSON and includes settled fields.
    // We keep your current JWS-based payload for backward compatibility.
    jws: receiptJws!,
    payload: m?.receipt?.payload ?? null,

    // Additional Phase A stable identifiers (safe to include now)
    version: 'x402-v2',
    contractId: contract.contractId,
    merchantId: contract.merchantId,
    nonce,
    settled: true,
  };

  const respB64 = b64json(paymentResponse);
  res.setHeader('PAYMENT-RESPONSE', respB64);
  if (legacyHeaders) res.setHeader('X-PAYMENT-RESPONSE', respB64);

  return res.status(200).json({
    ok: true,
    paid: true,
    nonce,
    resource: 'secret-data',
    contract: {
      contractId: contract.contractId,
      contractVersion: contract.contractVersion,
      isFrozen: contract.isFrozen,
    },
    verify,
    ...(x402Debug
      ? {
          debug: {
            match,
            fulfill,
            paymentSignature: paymentSignature ?? null,
            paymentSignatureB64Present: !!paymentSignatureB64,
          },
        }
      : {}),
  });
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
