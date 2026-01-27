#!/usr/bin/env node
/**
 * scripts/dev_jwks_server.mjs
 *
 * Dev-only JWKS issuer + receipt mint endpoint for local gateway regression harness.
 *
 * Endpoints:
 *  - GET  /                         -> simple OK
 *  - GET  /.well-known/jwks.json     -> JWKS (public Ed25519 key)
 *  - GET  /mint?...                 -> returns JSON { ok, kid, jws, payloadPreview }
 *
 * /mint query params (required by harness / gateway semantics):
 *  nonce, contractId, contractVersion, isFrozen, merchantId,
 *  method, path, network, tokenId, decimals, amount, payTo
 *
 * Phase D additions:
 *  settlementStatus = finalized | pending   (default: finalized)
 *  ttlSec = integer seconds (default: 300)
 *
 * NOTE (Node 22+):
 * - Use Node crypto KeyObject APIs (NOT WebCrypto CryptoKey exportJWK).
 * - Persist the Ed25519 private key to disk so JWKS is stable across runs.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, createHash, generateKeyPairSync, createPrivateKey, createPublicKey } from "crypto";
import { URL } from "url";
import { SignJWT } from "jose";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8088);

// Stable dev key id used in earlier runs
const KID = "dev-local-1";

// Resolve scripts directory (works in ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persisted key path (this file already exists in your repo)
const KEY_PATH = process.env.DEV_JWKS_KEY_PATH || path.join(__dirname, ".dev_jwks_ed25519_private.pem");

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

  const rawStr = `${whole}${fracPadded}`.replace(/^0+/, "") || "0";
  return rawStr;
}

// ---------------------------------------------------------------------------
// Key material (stable on disk)
// ---------------------------------------------------------------------------

function loadOrCreateKeypair() {
  // If key exists, load it.
  if (fs.existsSync(KEY_PATH)) {
    const pem = fs.readFileSync(KEY_PATH, "utf8");
    const privateKey = createPrivateKey(pem);
    const publicKey = createPublicKey(privateKey);
    return { publicKey, privateKey, loaded: true };
  }

  // Else create once and persist.
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  // Export private key in PKCS8 PEM
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  fs.writeFileSync(KEY_PATH, pem, { encoding: "utf8", mode: 0o600 });

  return { publicKey, privateKey, loaded: false };
}

const { publicKey, privateKey, loaded } = loadOrCreateKeypair();

// Export public JWK from Node KeyObject (stable across runs)
const pubJwk = publicKey.export({ format: "jwk" });
pubJwk.kid = KID;
pubJwk.use = "sig";
pubJwk.alg = "EdDSA";

console.log(`[dev_jwks_server] key: ${loaded ? "loaded" : "created"} ${KEY_PATH}`);

// ---------------------------------------------------------------------------
// Mint logic
// ---------------------------------------------------------------------------

function buildProofFromMintUrl(u) {
  const nonce = requireParam(u, "nonce");
  const contractId = requireParam(u, "contractId");
  const contractVersion = requireParam(u, "contractVersion");

  const isFrozenRaw = requireParam(u, "isFrozen");
  const isFrozen = toBool(isFrozenRaw);
  if (isFrozen === null) throw new Error(`invalid boolean param: isFrozen=${isFrozenRaw}`);

  const merchantId = requireParam(u, "merchantId");
  const method = requireParam(u, "method").toUpperCase();
  const pathParam = requireParam(u, "path");

  const network = requireParam(u, "network");
  const tokenId = requireParam(u, "tokenId");
  const decimals = requireInt(u, "decimals");
  const amount = requireParam(u, "amount");
  const payTo = requireParam(u, "payTo");

  const settlementStatus = String(u.searchParams.get("settlementStatus") || "finalized").toLowerCase();
  const ttlSecRaw = u.searchParams.get("ttlSec");
  const ttlSec = ttlSecRaw ? Number(ttlSecRaw) : 300;
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : 300;

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttl;

  const amountRaw = amountToRaw(amount, decimals);

  const transactionHash =
    u.searchParams.get("transactionHash") ||
    "36e915afacc211388c9fafa3ccc680ff4a5b892aed8f6482355f4ba9cf0a6b03";
  const blockHash =
    u.searchParams.get("blockHash") ||
    "4ff2b6731b09684d4b41909af43ccf0d793a632dc8cad4ce5ac83de7a6ce18f5";
  const blockHeightRaw = u.searchParams.get("blockHeight");
  const blockHeight = blockHeightRaw ? Number(blockHeightRaw) : 123456;

  const proof = {
    proofVersion: "ccd-plt-proof@v1",

    contract: {
      contractId,
      contractVersion,
      isFrozen,
      merchantId,
      resource: { method, path: pathParam },
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

    settlement:
      settlementStatus === "pending"
        ? { status: "pending", expiresAt: expSec }
        : { status: "finalized", settledAt: nowSec, expiresAt: expSec },

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

    _meta: {
      nowSec,
      expSec,
      ttlSec: ttl,
      settlementStatus,
      receiptSha12: null,
    },
  };

  return { proof, nowSec, expSec };
}

async function mintJws(u) {
  const { proof, nowSec, expSec } = buildProofFromMintUrl(u);

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
      const sha12 = sha256HexPrefix(out.jws, 12);

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
  console.log(`[dev_jwks_server] listening on http://${HOST}:${PORT}`);
});
