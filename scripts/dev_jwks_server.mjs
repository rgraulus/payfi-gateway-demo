#!/usr/bin/env node
/**
 * scripts/dev_jwks_server.mjs
 *
 * Dev-only JWKS issuer + receipt mint endpoint for local gateway regression harness.
 *
 * Endpoints:
 *  - GET  /                         -> simple OK
 *  - GET  /.well-known/jwks.json     -> JWKS (public Ed25519 key)
 *  - GET  /mint?...                 -> returns JSON { jws, kid, payloadPreview }
 *
 * /mint query params (required by harness / gateway semantics):
 *  nonce, contractId, contractVersion, isFrozen, merchantId,
 *  method, path, network, tokenId, decimals, amount, payTo
 *
 * Phase D additions:
 *  settlementStatus = finalized | pending   (default: finalized)
 *  ttlSec = integer seconds (default: 300)
 */

import http from "http";
import { randomBytes, createHash } from "crypto";
import { URL } from "url";

// jose is ESM-friendly here (.mjs)
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
} from "jose";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8088);

// Stable dev key id used in earlier runs
const KID = "dev-local-1";

// Small helpers
function json(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function text(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function toBool(s) {
  const v = String(s ?? "").toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function requireParam(u, name) {
  const v = u.searchParams.get(name);
  if (v === null || v === "") throw new Error(`missing query param: ${name}`);
  return v;
}

function requireInt(u, name) {
  const raw = requireParam(u, name);
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid int param: ${name}=${raw}`);
  return n;
}

function requireNumber(u, name) {
  const raw = requireParam(u, name);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`invalid number param: ${name}=${raw}`);
  return n;
}

function randomHex32() {
  return randomBytes(32).toString("hex");
}

function sha256HexPrefix(input, n) {
  const hex = createHash("sha256").update(String(input), "utf8").digest("hex");
  return hex.slice(0, Math.max(0, Math.min(hex.length, n)));
}

/**
 * Convert decimal string amount + decimals into "amountRaw" integer string.
 * Example: amount="0.050101", decimals=6 -> "50101"
 *
 * This is intentionally strict and deterministic for tests.
 */
function amountToRaw(amountStr, decimals) {
  const s = String(amountStr).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`invalid amount format: ${amountStr}`);

  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);

  // Avoid BigInt issues by constructing string
  const rawStr = `${whole}${fracPadded}`.replace(/^0+/, "") || "0";
  return rawStr;
}

// ---------------------------------------------------------------------------
// Key material (generated per process run; that’s fine for harness)
// ---------------------------------------------------------------------------

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const pubJwk = await exportJWK(publicKey);

// Ensure JWKS includes expected metadata
pubJwk.kid = KID;
pubJwk.use = "sig";
pubJwk.alg = "EdDSA";

// ---------------------------------------------------------------------------
// Mint logic
// ---------------------------------------------------------------------------

function buildProofFromMintUrl(u) {
  // Required contract/payment fields
  const nonce = requireParam(u, "nonce");
  const contractId = requireParam(u, "contractId");
  const contractVersion = requireParam(u, "contractVersion");
  const isFrozenRaw = requireParam(u, "isFrozen");
  const isFrozen = toBool(isFrozenRaw);
  if (isFrozen === null) throw new Error(`invalid boolean param: isFrozen=${isFrozenRaw}`);

  const merchantId = requireParam(u, "merchantId");
  const method = requireParam(u, "method").toUpperCase();
  const path = requireParam(u, "path"); // expected to already be decoded by URL

  const network = requireParam(u, "network");
  const tokenId = requireParam(u, "tokenId");
  const decimals = requireInt(u, "decimals");
  const amount = requireParam(u, "amount");
  const payTo = requireParam(u, "payTo");

  // Phase D controls
  const settlementStatus = String(u.searchParams.get("settlementStatus") || "finalized").toLowerCase();
  const ttlSecRaw = u.searchParams.get("ttlSec");
  const ttlSec = ttlSecRaw ? Number(ttlSecRaw) : 300;
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : 300;

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttl;

  // Derived fields
  const amountRaw = amountToRaw(amount, decimals);

  // Keep chain fields stable-ish; can be random without breaking validation
  // Use deterministic-looking hashes for readability.
  const transactionHash = u.searchParams.get("transactionHash") || "36e915afacc211388c9fafa3ccc680ff4a5b892aed8f6482355f4ba9cf0a6b03";
  const blockHash = u.searchParams.get("blockHash") || "4ff2b6731b09684d4b41909af43ccf0d793a632dc8cad4ce5ac83de7a6ce18f5";
  const blockHeightRaw = u.searchParams.get("blockHeight");
  const blockHeight = blockHeightRaw ? Number(blockHeightRaw) : 123456;

  const proof = {
    proofVersion: "ccd-plt-proof@v1",

    contract: {
      contractId,
      contractVersion,
      isFrozen,
      merchantId,
      resource: { method, path },
      network,
      asset: {
        type: "PLT",
        tokenId,
        decimals,
      },
      amount,
      payTo,
    },

    nonce,

    // Phase D: finalized vs pending settlement
    settlement:
      settlementStatus === "pending"
        ? {
            status: "pending",
            expiresAt: expSec,
          }
        : {
            status: "finalized",
            settledAt: nowSec,
            expiresAt: expSec,
          },

    chain: {
      transactionHash,
      blockHash,
      blockHeight,
    },

    paymentEvent: {
      kind: "plt.transfer",
      tokenId,
      amountRaw,
      to: payTo,
    },

    // iat/exp are added by SignJWT below, but keeping these in preview helps debugging
    _meta: {
      nowSec,
      expSec,
      ttlSec: ttl,
      settlementStatus,
      receiptSha12: null, // filled after signing
    },
  };

  return { proof, nowSec, expSec, settlementStatus, ttlSec: ttl };
}

async function mintJws(u) {
  const { proof, nowSec, expSec } = buildProofFromMintUrl(u);

  // Remove any non-standard / debugging fields from the signed payload
  // (keep _meta out of the signed proof to match strict validators)
  const { _meta, ...signedProof } = proof;

  const jws = await new SignJWT(signedProof)
    .setProtectedHeader({ alg: "EdDSA", kid: KID })
    .setIssuedAt(nowSec)
    .setExpirationTime(expSec)
    .sign(privateKey);

  return { jws, preview: proof };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      return text(res, 200, `DEV_JWKS_OK on ${HOST}:${PORT}\n`);
    }

    if (req.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      return json(res, 200, { keys: [pubJwk] });
    }

    if (req.method === "GET" && url.pathname === "/mint") {
      const out = await mintJws(url);

      // Attach receipt sha prefix for diagnostics (not used by harness)
      const sha12 = sha256HexPrefix(out.jws, 12);

      // Return minimal shape that harness expects + a small preview
      const payloadPreview = out.preview;
      payloadPreview._meta.receiptSha12 = sha12;

      return json(res, 200, {
        ok: true,
        kid: KID,
        jws: out.jws,
        payloadPreview,
      });
    }

    return json(res, 404, { ok: false, error: "Not found", method: req.method, path: url.pathname });
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  // Keep output simple; harness redirects this to a temp log file.
  // This is still handy if you run it manually.
  // eslint-disable-next-line no-console
  console.log(`[dev_jwks_server] listening on http://${HOST}:${PORT}`);
});
