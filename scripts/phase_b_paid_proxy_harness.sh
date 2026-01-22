#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3005}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3010}"
NONCE="${NONCE:-bb-test}"

JWKS_PORT="${JWKS_PORT:-8088}"
JWKS_HOST="${JWKS_HOST:-127.0.0.1}"

# How long to wait for you to restart the gateway with dev harness enabled
WAIT_SECS="${WAIT_SECS:-60}"

echo "[harness] BASE=$BASE"
echo "[harness] NONCE=$NONCE"
echo "[harness] expecting upstream on :$UPSTREAM_PORT"

TMP_HEADERS_1="$(mktemp)"
TMP_BODY_1="$(mktemp)"
TMP_HEADERS_2="$(mktemp)"
TMP_BODY_2="$(mktemp)"
TMP_ISSUER_LOG="$(mktemp)"

cleanup() {
  rm -f "$TMP_HEADERS_1" "$TMP_BODY_1" "$TMP_HEADERS_2" "$TMP_BODY_2" "$TMP_ISSUER_LOG"
  if [[ -n "${ISSUER_PID:-}" ]]; then
    kill "$ISSUER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

decode_b64() {
  if base64 --help 2>&1 | grep -q -- "-d"; then
    printf "%s" "$1" | base64 -d
  else
    printf "%s" "$1" | base64 -D
  fi
}

# 0) Ensure upstream is up
if ! (curl -sS "http://127.0.0.1:${UPSTREAM_PORT}/" >/dev/null 2>&1); then
  echo "[harness] ERROR: upstream not reachable on http://127.0.0.1:${UPSTREAM_PORT}/"
  echo "[harness] Start it in another terminal:"
  echo "  node -e \"require('http').createServer((req,res)=>{res.setHeader('content-type','text/plain');res.end('UPSTREAM_OK '+req.url)}).listen(${UPSTREAM_PORT},()=>console.log('upstream on ${UPSTREAM_PORT}'))\""
  exit 1
fi

# 1) Start JWKS + receipt issuer
echo "[harness] starting dev JWKS issuer on ${JWKS_HOST}:${JWKS_PORT} ..."
( HOST="$JWKS_HOST" PORT="$JWKS_PORT" NONCE="$NONCE" node scripts/dev_jwks_server.mjs >"$TMP_ISSUER_LOG" 2>&1 ) &
ISSUER_PID=$!

# Wait for issuer to print vars
for _ in $(seq 1 80); do
  if grep -q '^JWKS_URL=' "$TMP_ISSUER_LOG" && grep -q '^RECEIPT_JWS=' "$TMP_ISSUER_LOG"; then
    break
  fi
  sleep 0.1
done

JWKS_URL="$(grep '^JWKS_URL=' "$TMP_ISSUER_LOG" | head -n1 | sed 's/^JWKS_URL=//')"
RECEIPT_JWS="$(grep '^RECEIPT_JWS=' "$TMP_ISSUER_LOG" | head -n1 | sed 's/^RECEIPT_JWS=//')"

if [[ -z "${JWKS_URL:-}" || -z "${RECEIPT_JWS:-}" ]]; then
  echo "[harness] ERROR: could not read JWKS_URL/RECEIPT_JWS from issuer"
  echo "--- issuer log ---"
  cat "$TMP_ISSUER_LOG"
  exit 1
fi

echo "[harness] JWKS_URL=$JWKS_URL"
echo "[harness] got RECEIPT_JWS (len=${#RECEIPT_JWS})"

# 2) You MUST restart the gateway so it sees these env vars (they cannot be injected via curl)
echo
echo "[harness] ACTION REQUIRED:"
echo "  Restart your gateway (Terminal A) with these env vars set:"
echo
echo "  CRP_JWKS_URL=\"$JWKS_URL\" \\"
echo "  X402_DEV_RECEIPT_JWS=\"$RECEIPT_JWS\" \\"
echo "  X402_DEV_RECEIPT_REQUIRE_SIG=true \\"
echo "  npm run dev"
echo
echo "[harness] Waiting up to ${WAIT_SECS}s for /healthz to report devHarness.enabled=true ..."
echo

# 3) Poll /healthz until devHarness.enabled is true
deadline=$(( $(date +%s) + WAIT_SECS ))
while :; do
  now=$(date +%s)
  if (( now > deadline )); then
    echo "[harness] ERROR: timed out waiting for gateway devHarness.enabled=true"
    echo "[harness] Hint: make sure you restarted the gateway process with the env vars printed above."
    exit 1
  fi

  health="$(curl -sS "$BASE/healthz" 2>/dev/null || true)"
  if [[ -n "$health" ]]; then
    enabled="$(node -e 'try{const o=JSON.parse(process.argv[1]);process.stdout.write(String(!!(o.devHarness&&o.devHarness.enabled)))}catch{process.stdout.write("false")}' "$health")"
    if [[ "$enabled" == "true" ]]; then
      echo "[harness] OK: gateway devHarness.enabled=true"
      break
    fi
  fi

  sleep 1
done

# 4) First request should be 402 (no PAYMENT-SIGNATURE)
URL1="$BASE/x402/premium?nonce=$NONCE"
echo "[harness] request #1 (expect 402): $URL1"

HTTP1="$(curl -sS -D "$TMP_HEADERS_1" -o "$TMP_BODY_1" -w "%{http_code}" "$URL1")"
echo "[harness] status #1=$HTTP1"
if [[ "$HTTP1" != "402" ]]; then
  echo "Expected 402 on first request"
  echo "--- headers ---"; cat "$TMP_HEADERS_1"
  echo "--- body ---"; cat "$TMP_BODY_1"
  exit 1
fi

PAYREQ_B64="$(grep -i '^PAYMENT-REQUIRED:' "$TMP_HEADERS_1" | head -n1 | sed -E 's/^[^:]+:\s*//')"
if [[ -z "${PAYREQ_B64:-}" ]]; then
  echo "Missing PAYMENT-REQUIRED header on first response"
  exit 1
fi

PAYREQ_JSON="$(decode_b64 "$PAYREQ_B64")"
CONTRACT_ID="$(node -e 'const o=JSON.parse(process.argv[1]);process.stdout.write(o.contractId||"")' "$PAYREQ_JSON")"
if [[ -z "${CONTRACT_ID:-}" ]]; then
  echo "Could not extract contractId from PAYMENT-REQUIRED"
  echo "$PAYREQ_JSON"
  exit 1
fi
echo "[harness] contractId=$CONTRACT_ID"

# 5) Second request should be 200 with PAYMENT-RESPONSE + upstream body, providing PAYMENT-SIGNATURE
PAY_SIG_JSON="$(node -e 'console.log(JSON.stringify({nonce: process.env.NONCE}))' NONCE="$NONCE")"
PAY_SIG_B64="$(printf "%s" "$PAY_SIG_JSON" | base64)"

echo "[harness] request #2 (expect 200 + proxy content): $URL1"
HTTP2="$(curl -sS -D "$TMP_HEADERS_2" -o "$TMP_BODY_2" -w "%{http_code}" -H "PAYMENT-SIGNATURE: $PAY_SIG_B64" "$URL1")"
echo "[harness] status #2=$HTTP2"

if [[ "$HTTP2" != "200" ]]; then
  echo "Expected 200 on paid-path request"
  echo "--- headers ---"; cat "$TMP_HEADERS_2"
  echo "--- body ---"; cat "$TMP_BODY_2"
  exit 1
fi

PAYRESP_B64="$(grep -i '^PAYMENT-RESPONSE:' "$TMP_HEADERS_2" | head -n1 | sed -E 's/^[^:]+:\s*//')"
if [[ -z "${PAYRESP_B64:-}" ]]; then
  echo "Missing PAYMENT-RESPONSE header on paid-path response"
  echo "--- headers ---"; cat "$TMP_HEADERS_2"
  exit 1
fi

PAYRESP_JSON="$(decode_b64 "$PAYRESP_B64")"

# Validate PAYMENT-RESPONSE fields
node - <<'NODE' "$PAYRESP_JSON" "$CONTRACT_ID" "$NONCE"
const [json, expectedCid, expectedNonce] = process.argv.slice(2);
let o;
try { o = JSON.parse(json); } catch { console.error("PAYMENT-RESPONSE decoded not JSON"); process.exit(1); }

const must = ["version","contractId","contractVersion","merchantId","resource","nonce","settled","receipt"];
for (const k of must) if (!(k in o)) { console.error("Missing key:", k); process.exit(1); }

if (o.version !== "x402-v2") { console.error("Bad version:", o.version); process.exit(1); }
if (o.contractId !== expectedCid) { console.error("contractId mismatch:", o.contractId, expectedCid); process.exit(1); }
if (o.nonce !== expectedNonce) { console.error("nonce mismatch:", o.nonce, expectedNonce); process.exit(1); }
if (o.settled !== true) { console.error("settled must be true"); process.exit(1); }
if (!o.receipt || typeof o.receipt.jws !== "string" || o.receipt.jws.length < 20) {
  console.error("receipt.jws missing/short"); process.exit(1);
}
console.log("[harness] PAYMENT-RESPONSE validated");
NODE

BODY2="$(cat "$TMP_BODY_2")"
echo "[harness] body #2:"
echo "$BODY2" | sed 's/^/  /'

if ! echo "$BODY2" | grep -q "UPSTREAM_OK"; then
  echo "[harness] ERROR: expected upstream content (UPSTREAM_OK) in body"
  exit 1
fi

echo "[harness] PASS: paid-path proxy worked + PAYMENT-RESPONSE validated"
