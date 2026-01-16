// src/server.ts
//
// C4 polish: distinguish "invalid receipt / wrong kid / bad sig" from true gateway errors.
// - 402 responses NEVER include PAYMENT-RESPONSE headers (C3)
// - If payment exists but receipt verification fails: 402 + PAYMENT-REQUIRED with clearer error
// - If CRP calls fail: 402 + PAYMENT-REQUIRED with "Gateway error while checking payment"
// - Debug details only when X402_DEBUG=true

import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID } from 'crypto';

import { CrpClient, MatchPaymentRequest } from './crpClient';

const app = express();
app.use(bodyParser.json());

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3005);

const crpBaseUrl = (process.env.CRP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const jwksUrl = process.env.CRP_JWKS_URL ?? `${crpBaseUrl}/.well-known/jwks.json`;

const merchantId = process.env.CRP_MERCHANT_ID ?? 'demo-merchant';
const network = process.env.CRP_NETWORK ?? 'concordium:testnet';

const tokenId = process.env.CRP_TOKEN_ID ?? 'EUDemo';
const assetType = process.env.CRP_ASSET_TYPE ?? 'PLT';
const decimals = Number(process.env.CRP_DECIMALS ?? 6);

const amount = process.env.CRP_AMOUNT ?? '0.05';
const payTo =
  process.env.CRP_PAY_TO ?? '4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7';

// Optional: pin expected kid for demos (recommended)
const expectedKid = process.env.X402_EXPECTED_KID;

// Debug gating for response bodies (NOT headers)
const x402Debug = String(process.env.X402_DEBUG ?? '').toLowerCase() === 'true';

const crpClient = new CrpClient({ baseUrl: crpBaseUrl });

// -----------------------------------------------------------------------------
// CORS + no-store headers
// -----------------------------------------------------------------------------

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,PAYMENT-SIGNATURE,X-PAYMENT-SIGNATURE',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Expose-Headers',
    [
      'PAYMENT-REQUIRED',
      'PAYMENT-SIGNATURE',
      'PAYMENT-RESPONSE',
      'X-PAYMENT-REQUIRED',
      'X-PAYMENT-SIGNATURE',
      'X-PAYMENT-RESPONSE',
    ].join(','),
  );

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
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
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
    merchantId,
    network,
    crpBaseUrl,
    jwksUrl,
    asset: { type: assetType, tokenId, decimals },
    amount,
    payTo,
    x402Debug,
    expectedKid: expectedKid ?? null,
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
// C3: NEVER emit PAYMENT-RESPONSE headers unless local verify succeeds.
// C4: If receipt verify fails, return 402 with clearer "Invalid payment receipt" error.
// -----------------------------------------------------------------------------

app.get('/paid', async (req, res) => {
  const resource = '/paid';

  const nonce =
    typeof req.query.nonce === 'string' && req.query.nonce.length > 0
      ? req.query.nonce
      : `demo-${randomUUID()}`;

  const paymentRequired = {
    merchantId,
    nonce,
    network,
    payTo,
    asset: { type: assetType, tokenId, decimals },
    amount,
    facilitator: crpBaseUrl,
    resource,
    description: `Payment required for ${resource}`,
  };

  const matchReq: MatchPaymentRequest = {
    merchantId,
    nonce,
    network,
    payTo,
    amount,
    asset: { type: assetType, tokenId, decimals },
  };

  // Precompute header value so every 402 uses the same payload
  const prB64 = b64json(paymentRequired);

  // Helper to issue a "payment required" response consistently
  const reply402 = (body: any) => {
    res.setHeader('PAYMENT-REQUIRED', prB64);
    res.setHeader('X-PAYMENT-REQUIRED', prB64);
    return res.status(402).json(body);
  };

  // 1) Call CRP (match + fulfill). If this fails, it's a gateway error.
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
      paymentRequired,
      error: 'Gateway error while checking payment',
      ...(x402Debug ? { debug: { message: String(err) } } : {}),
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
      paymentRequired,
      ...(x402Debug ? { debug: { match, fulfill, paymentSignature: null } } : {}),
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
      paymentRequired,
      error: 'Invalid payment receipt',
      ...(x402Debug
        ? {
            debug: {
              reason: message,
              match,
              fulfill,
              expectedKid: expectedKid ?? null,
            },
          }
        : {}),
    });
  }

  // 4) Only after verification succeeds do we emit PAYMENT-RESPONSE headers.
  const paymentResponse = {
    jws: receiptJws!,
    payload: m?.receipt?.payload ?? null,
  };

  const respB64 = b64json(paymentResponse);
  res.setHeader('PAYMENT-RESPONSE', respB64);
  res.setHeader('X-PAYMENT-RESPONSE', respB64);

  return res.status(200).json({
    ok: true,
    paid: true,
    nonce,
    resource: 'secret-data',
    verify,
    ...(x402Debug ? { debug: { match, fulfill, paymentSignature: null } } : {}),
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
