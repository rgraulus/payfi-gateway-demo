// scripts/dev_jwks_server.mjs
//
// Dev JWKS issuer + receipt JWS minting for Phase B (real proof payload).
// This server is used ONLY by the Phase B paid-path harness.
//
// It serves:
// - GET /.well-known/jwks.json  (public key set)
// - GET /mint?nonce=...&contractId=...&contractVersion=...&isFrozen=...&merchantId=...&method=...&path=...&network=...&tokenId=...&decimals=...&amount=...&payTo=...
//   -> returns { jws, payload }
//
// The minted JWS payload is the FULL CcdPltProofV1 object, matching src/proofPayload.ts.
//
// Notes:
// - Uses EdDSA (Ed25519) via jose.
// - Deterministic amountRaw computed from amount+decimals.
// - This is a DEV tool; do NOT use in production.

import http from 'node:http';
import { URL } from 'node:url';
import { createHash } from 'node:crypto';

import { exportJWK, SignJWT, generateKeyPair } from 'jose';

// -----------------------------
// Utils
// -----------------------------
function json(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj, null, 2), 'utf8');
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function bad(res, msg, extra = {}) {
  json(res, 400, { ok: false, error: msg, ...extra });
}

function reqStr(q, k) {
  const v = q.get(k);
  if (!v) throw new Error(`missing query param: ${k}`);
  return v;
}

function optStr(q, k) {
  const v = q.get(k);
  return v && v.length ? v : null;
}

function reqInt(q, k) {
  const s = reqStr(q, k);
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid integer for ${k}: "${s}"`);
  return n;
}

function reqBool(q, k) {
  const s = reqStr(q, k).toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  throw new Error(`invalid boolean for ${k}: "${s}"`);
}

// Strict decimal parsing -> integer base units string
function amountToRawUnits(amount, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`decimals must be integer in [0,18], got ${decimals}`);
  }

  const s = String(amount ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`amount must be non-negative decimal string, got "${amount}"`);
  }

  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    throw new Error(`amount has too many decimal places: ${frac.length} > ${decimals} (amount="${amount}")`);
  }

  const fracPadded = frac.padEnd(decimals, '0');
  const raw = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
  return raw;
}

// Simple dev-only deterministic tx hash (not real chain data)
function devTxHash(input) {
  return createHash('sha256').update(input).digest('hex');
}

// -----------------------------
// Key material (generated on boot)
// -----------------------------
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8088);
const KID = process.env.KID ?? 'dev-local-1';

// Generate an ephemeral Ed25519 keypair on startup
const { publicKey, privateKey } = await generateKeyPair('Ed25519');

const jwkPub = await exportJWK(publicKey);
jwkPub.use = 'sig';
jwkPub.alg = 'EdDSA';
jwkPub.kid = KID;

const jwks = { keys: [jwkPub] };

// -----------------------------
// Mint
// -----------------------------
async function mintReceiptJws(payload) {
  // Sign the proof payload as the entire JWT payload
  const now = Math.floor(Date.now() / 1000);

  // Ensure there is an iat/exp at top-level JWT claims for jose verification hygiene.
  // We keep proof fields separate, but it's fine to include standard claims too.
  const iat = payload?.settlement?.settledAt ?? now;
  const exp = payload?.settlement?.expiresAt ?? now + 300;

  const jws = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', kid: KID })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(privateKey);

  return jws;
}

// -----------------------------
// HTTP server
// -----------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

    if (url.pathname === '/.well-known/jwks.json') {
      return json(res, 200, jwks);
    }

    if (url.pathname === '/mint') {
      const q = url.searchParams;

      const nonce = reqStr(q, 'nonce');

      // Contract binding
      const contractId = reqStr(q, 'contractId');
      const contractVersion = reqStr(q, 'contractVersion');
      const isFrozen = reqBool(q, 'isFrozen');

      const merchantId = reqStr(q, 'merchantId');
      const method = reqStr(q, 'method').toUpperCase();
      const path = reqStr(q, 'path');

      const network = reqStr(q, 'network');

      const tokenId = reqStr(q, 'tokenId');
      const decimals = reqInt(q, 'decimals');
      const amount = reqStr(q, 'amount');
      const payTo = reqStr(q, 'payTo');

      const settledAt = Math.floor(Date.now() / 1000);
      const expiresAt = settledAt + 300;

      const amountRaw = amountToRawUnits(amount, decimals);

      // Build the proof payload (must match src/proofPayload.ts)
      const proof = {
        proofVersion: 'ccd-plt-proof@v1',

        contract: {
          contractId,
          contractVersion,
          isFrozen,

          merchantId,
          resource: { method, path },

          network,
          asset: { type: 'PLT', tokenId, decimals },

          amount,
          payTo,
        },

        nonce,

        settlement: {
          status: 'finalized',
          settledAt,
          expiresAt,
        },

        chain: {
          transactionHash: devTxHash(`${nonce}:${contractId}:${amountRaw}:${payTo}`),
          blockHash: devTxHash(`block:${nonce}:${contractId}`),
          blockHeight: 123456,
        },

        paymentEvent: {
          kind: 'plt.transfer',
          tokenId,
          amountRaw,
          to: payTo,
        },
      };

      const jws = await mintReceiptJws(proof);

      return json(res, 200, { ok: true, jws, payload: proof, kid: KID });
    }

    return json(res, 404, { ok: false, error: 'not found', path: url.pathname });
  } catch (e) {
    return bad(res, String(e?.message ?? e));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[dev-jwks] listening on http://${HOST}:${PORT}`);
  console.log(`[dev-jwks] jwks at http://${HOST}:${PORT}/.well-known/jwks.json (kid=${KID})`);
  console.log(`[dev-jwks] mint at http://${HOST}:${PORT}/mint?...`);
});
