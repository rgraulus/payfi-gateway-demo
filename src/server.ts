// src/server.ts
//
// Phase B: Gateway/Proxy (edge) model via /x402/... while keeping /paid local mode.
// - Challenge: 402 + PAYMENT-REQUIRED (Phase A frozen via contract registry)
// - Paid: 200 + PAYMENT-RESPONSE (Phase B frozen shape)
// - Proxy mode: after verification, forward request to upstream (payment-unaware)
//
// C3/C4 still apply: NEVER emit PAYMENT-RESPONSE unless receipt verify succeeds.
//
// DEV-ONLY PAID-PATH HARNESS (hardened; off by default):
// - Requires X402_ALLOW_DEV_HARNESS=true AND NODE_ENV != production
// - If enabled and X402_DEV_RECEIPT_JWS is set, we skip CRP calls and use that receipt JWS.
// - Still requires local JWKS verification and (by default) requires PAYMENT-SIGNATURE header.
// - This lets us test "paid path" + proxying without automating chain payment yet.

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

  // Avoid leaking host / content-length; fetch will set them
  forwarded.delete('host');
  forwarded.delete('content-length');

  const method = req.method.toUpperCase();
  const hasBody = !(method === 'GET' || method === 'HEAD');

  // NOTE: This demo assumes JSON bodies for non-GET requests.
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
    devHarness: {
      enabled: !!devReceiptJws,
      allowDevHarness,
      nodeEnv: process.env.NODE_ENV ?? null,
      requiresPaymentSignature: devReceiptRequiresPaymentSignature,
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

  // ---------------------------------------------------------------------------
  // DEV BYPASS (Phase B harness): If devReceiptJws is set, skip CRP calls.
  // Hardened by:
  // - X402_ALLOW_DEV_HARNESS=true
  // - NODE_ENV != production
  // Still enforces:
  // - PAYMENT-SIGNATURE must be present (unless disabled)
  // - receipt must verify locally via JWKS (C3/C4 behavior preserved)
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

    // Verify injected receipt FIRST (C3/C4)
    let verify: any;
    try {
      verify = await verifyReceiptJwsLocal(devReceiptJws);
    } catch (err: any) {
      const message = err?.name === 'ReceiptVerifyError' ? String(err.message) : String(err);
      return reply402({
        ok: false,
        paid: false,
        paymentRequired: paymentRequiredBody,
        error: 'Invalid payment receipt (dev harness)',
        ...(x402Debug ? { debug: { reason: message } } : {}),
      });
    }

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
        payload: null,
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
  let verify: any;
  try {
    verify = await verifyReceiptJwsLocal(receiptJws!);
  } catch (err: any) {
    const message = err?.name === 'ReceiptVerifyError' ? String(err.message) : String(err);

    return reply402({
      ok: false,
      paid: false,
      paymentRequired: paymentRequiredBody,
      error: 'Invalid payment receipt',
      ...(x402Debug ? { debug: { reason: message, match, fulfill } } : {}),
    });
  }

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
      payload: m?.receipt?.payload ?? null,
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
