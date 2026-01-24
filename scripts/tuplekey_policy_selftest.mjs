#!/usr/bin/env node
import crypto from "crypto";

function canonicalize(value) {
  if (value === null) return null;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (t === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      const v = value[k];
      if (v === undefined) continue;
      out[k] = canonicalize(v);
    }
    return out;
  }
  return undefined;
}

function stripQuery(path) {
  if (!path) return path;
  const s = String(path);
  const i = s.indexOf("?");
  return i === -1 ? s : s.slice(0, i);
}

function buildTupleKey(input) {
  const tuple = {
    v: 4,
    contract: input.contract,
    nonce: input.nonce,
    amountRaw: input.amountRaw,

    payTo: input.payTo,
    network: input.network,
    tokenId: input.tokenId,
    decimals: input.decimals,

    method: input.method ? String(input.method).toUpperCase() : undefined,
    path: stripQuery(input.path),

    qPolicy: "ignored",
    q: "",

    contractId: input.contractId,
    contractVersion: input.contractVersion,
    merchantId: input.merchantId,

    isFrozen: input.isFrozen ?? true,
  };

  const canonical = JSON.stringify(canonicalize(tuple));
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function assertEq(a, b, msg) {
  if (a !== b) {
    console.error("FAIL:", msg);
    console.error("  a:", a);
    console.error("  b:", b);
    process.exit(1);
  }
}

function assertNe(a, b, msg) {
  if (a === b) {
    console.error("FAIL:", msg);
    console.error("  both:", a);
    process.exit(1);
  }
}

const base = {
  contract: "cid:1.0.0",
  nonce: "bb-test",
  amountRaw: "50101",
  payTo: "acct1",
  network: "ccd:testnet",
  tokenId: "EUDemo",
  decimals: 6,
  method: "GET",
  contractId: "cid",
  contractVersion: "1.0.0",
  merchantId: "demo-merchant",
  isFrozen: true,
};

// Query is ignored: all these must match
const k1 = buildTupleKey({ ...base, path: "/premium?nonce=bb-test" });
const k2 = buildTupleKey({ ...base, path: "/premium?z=1&nonce=bb-test" });
const k3 = buildTupleKey({ ...base, path: "/premium?nonce=bb-test&z=1" });
const k4 = buildTupleKey({ ...base, path: "/premium?nonce=bb-test&z=%31" });
assertEq(k1, k2, "query decoration should not change tupleKey");
assertEq(k1, k3, "query reorder should not change tupleKey");
assertEq(k1, k4, "encoded query value should not change tupleKey");

// Method must bind
const kGet = buildTupleKey({ ...base, method: "GET", path: "/premium?nonce=bb-test" });
const kPost = buildTupleKey({ ...base, method: "POST", path: "/premium?nonce=bb-test" });
assertNe(kGet, kPost, "method change must change tupleKey");

// Path must bind
const kPremium = buildTupleKey({ ...base, path: "/premium?nonce=bb-test" });
const kOther = buildTupleKey({ ...base, path: "/other?nonce=bb-test" });
assertNe(kPremium, kOther, "path change must change tupleKey");

// Contract binding must bind
const kFrozen = buildTupleKey({ ...base, isFrozen: true, path: "/premium?nonce=bb-test" });
const kNotFrozen = buildTupleKey({ ...base, isFrozen: false, path: "/premium?nonce=bb-test" });
assertNe(kFrozen, kNotFrozen, "isFrozen change must change tupleKey");

console.log("OK: tupleKey policy selftest passed");
