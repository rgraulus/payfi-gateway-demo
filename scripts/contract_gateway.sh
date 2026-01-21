#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3005}"
NONCE="${NONCE:-bb-test}"

URL="$BASE/paid?nonce=$NONCE"
echo "[contract] calling: $URL"

TMP_HEADERS="$(mktemp)"
TMP_BODY="$(mktemp)"
TMP_JSON="$(mktemp)"

cleanup() {
  rm -f "$TMP_HEADERS" "$TMP_BODY" "$TMP_JSON"
}
trap cleanup EXIT

HTTP_STATUS="$(curl -sS -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}" "$URL")"
echo "[contract] status=$HTTP_STATUS"

if [[ "$HTTP_STATUS" != "402" ]]; then
  echo "Expected 402, got $HTTP_STATUS"
  echo "--- headers ---"; cat "$TMP_HEADERS"
  echo "--- body ---"; cat "$TMP_BODY"
  exit 1
fi

# Extract PAYMENT-REQUIRED (case-insensitive)
PAYREQ="$(grep -i '^PAYMENT-REQUIRED:' "$TMP_HEADERS" | head -n1 | sed -E 's/^[^:]+:\s*//')"
if [[ -z "${PAYREQ:-}" ]]; then
  echo "Missing PAYMENT-REQUIRED header"
  echo "--- headers ---"; cat "$TMP_HEADERS"
  exit 1
fi

decode_b64() {
  # GNU coreutils: base64 -d ; macOS: base64 -D
  if base64 --help 2>&1 | grep -q -- "-d"; then
    printf "%s" "$1" | base64 -d
  else
    printf "%s" "$1" | base64 -D
  fi
}

JSON="$(decode_b64 "$PAYREQ")"
echo "[contract] PAYMENT-REQUIRED decoded JSON:"
echo "$JSON" | sed 's/^/  /'

# Write decoded JSON to a temp file (avoid node '-' stdin conflicts)
printf "%s" "$JSON" > "$TMP_JSON"

# Validate required fields + nonce match (no jq dependency)
NONCE="$NONCE" node -e '
  const fs = require("fs");

  const p = process.argv[1];
  let s = fs.readFileSync(p, "utf8");

  // Defensive cleanup for Windows/Git Bash:
  s = s.replace(/^\uFEFF/, "").trim();

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    console.error("PAYMENT-REQUIRED is not valid JSON (no object bounds found)");
    process.exit(1);
  }
  s = s.slice(first, last + 1);

  let obj;
  try {
    obj = JSON.parse(s);
  } catch (e) {
    console.error("PAYMENT-REQUIRED is not valid JSON");
    console.error("Raw:", JSON.stringify(s));
    process.exit(1);
  }

  const required = [
    "version","contractId","contractVersion","isFrozen",
    "merchantId","resource","nonce","issuedAt","expiresAt",
    "network","asset","amount","payTo","attestations"
  ];

  for (const k of required) {
    if (!(k in obj)) {
      console.error("Missing key:", k);
      process.exit(1);
    }
  }

  if (obj.version !== "x402-v2") {
    console.error("version must be x402-v2; got:", obj.version);
    process.exit(1);
  }

  if (obj.nonce !== process.env.NONCE) {
    console.error("nonce mismatch. expected:", process.env.NONCE, "got:", obj.nonce);
    process.exit(1);
  }

  if (!String(obj.contractId).startsWith("cid_")) {
    console.error("contractId must start with cid_");
    process.exit(1);
  }

  if (obj.isFrozen !== true) {
    console.error("isFrozen must be true in frozen mode");
    process.exit(1);
  }

  if (!obj.resource || typeof obj.resource.method !== "string" || typeof obj.resource.path !== "string") {
    console.error("resource must have method/path");
    process.exit(1);
  }

  if (!obj.asset || typeof obj.asset.tokenId !== "string" || typeof obj.asset.decimals !== "number") {
    console.error("asset must include tokenId (string) and decimals (number)");
    process.exit(1);
  }

  console.log("[contract] PASS: required fields + nonce match");
' "$TMP_JSON"

echo "[contract] DONE"
