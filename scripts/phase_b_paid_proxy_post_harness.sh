#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Phase B/C harness (POST):
# - paid proxy + replay protection
# - uses per-request injected receipt:
#     X402-DEV-RECEIPT-JWS: <JWS>
#
# Requires:
# - Gateway running on BASE with:
#     X402_ALLOW_DEV_HARNESS=true
#     NODE_ENV != production
#     CRP_JWKS_URL pointing at issuer this script starts (default 127.0.0.1:8088)
# - Upstream running on UPSTREAM_PORT (default 3010)
# -----------------------------------------------------------------------------

BASE="${BASE:-http://127.0.0.1:3005}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3010}"

NONCE_WAS_SET="false"
if [[ -n "${NONCE+x}" ]]; then NONCE_WAS_SET="true"; fi

WAIT_FOR_USER="${WAIT_FOR_USER:-true}"
WAIT_SECS="${WAIT_SECS:-60}"

JWKS_HOST="${JWKS_HOST:-127.0.0.1}"
JWKS_PORT="${JWKS_PORT:-8088}"

REPLAY_EXPECT_ERROR_SUBSTR="${REPLAY_EXPECT_ERROR_SUBSTR:-Payment already claimed (replay)}"

# POST body (stable)
POST_BODY="${POST_BODY:-{\"hello\":\"world\",\"n\":1}}"

if [[ "${NONCE_WAS_SET}" == "true" ]]; then
  NONCE="${NONCE}"
else
  if [[ "${WAIT_FOR_USER}" == "false" ]]; then
    NONCE="bb-post-$(date +%s)-$$-$RANDOM"
  else
    NONCE="bb-post-test"
  fi
fi

echo "[post-harness] BASE=$BASE"
echo "[post-harness] NONCE=$NONCE"
echo "[post-harness] BODY=$POST_BODY"
echo "[post-harness] expecting upstream on :$UPSTREAM_PORT"
echo "[post-harness] starting dev JWKS issuer on $JWKS_HOST:$JWKS_PORT ..."

TMP_HEADERS_1="$(mktemp)"; TMP_BODY_1="$(mktemp)"
TMP_HEADERS_2="$(mktemp)"; TMP_BODY_2="$(mktemp)"
TMP_HEADERS_3="$(mktemp)"; TMP_BODY_3="$(mktemp)"
TMP_ISSUER_LOG="$(mktemp)"; TMP_MINT_JSON="$(mktemp)"

ISSUER_PID=""

cleanup() {
  rm -f "$TMP_HEADERS_1" "$TMP_BODY_1" "$TMP_HEADERS_2" "$TMP_BODY_2" \
        "$TMP_HEADERS_3" "$TMP_BODY_3" "$TMP_ISSUER_LOG" "$TMP_MINT_JSON" || true
  if [[ -n "${ISSUER_PID}" ]]; then
    kill "${ISSUER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Upstream must be running
curl -sS "http://127.0.0.1:${UPSTREAM_PORT}/" >/dev/null

# Start issuer in background
HOST="${JWKS_HOST}" PORT="${JWKS_PORT}" NONCE="${NONCE}" \
  node scripts/dev_jwks_server.mjs >"$TMP_ISSUER_LOG" 2>&1 &
ISSUER_PID=$!

JWKS_URL="http://${JWKS_HOST}:${JWKS_PORT}/.well-known/jwks.json"
MINT_BASE="http://${JWKS_HOST}:${JWKS_PORT}/mint"

for _ in $(seq 1 100); do
  if curl -fsS "$JWKS_URL" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
if ! curl -fsS "$JWKS_URL" >/dev/null 2>&1; then
  echo
  echo "[post-harness] ERROR: JWKS issuer did not become ready at $JWKS_URL"
  echo "[post-harness] issuer log:"
  sed 's/^/  /' "$TMP_ISSUER_LOG" || true
  exit 1
fi

echo "[post-harness] JWKS_URL=$JWKS_URL"

get_header() {
  local name="$1"
  grep -i -m1 "^${name}:" "$2" | sed -E "s/^${name}:[[:space:]]*//I" | tr -d '\r'
}

payment_signature_b64() {
  NONCE="$NONCE" node -e 'process.stdout.write(Buffer.from(JSON.stringify({nonce:process.env.NONCE}),"utf8").toString("base64"))'
}

assert_status() {
  local want="$1"; local headers="$2"; local label="$3"; local body="$4"
  local got
  got="$(head -n1 "$headers" | awk '{print $2}' | tr -d '\r')"
  echo "[post-harness] status $label=$got"
  if [[ "$got" != "$want" ]]; then
    echo "Expected $want on request $label"
    echo "--- headers ---"; cat "$headers"
    echo "--- body ---"; cat "$body"
    exit 1
  fi
}

assert_replay_402() {
  local headers="$1"; local body="$2"; local label="$3"
  local pr
  pr="$(get_header "PAYMENT-REQUIRED" "$headers")"
  if [[ -z "$pr" ]]; then
    echo "Missing PAYMENT-REQUIRED header on replay request ($label)"
    echo "--- headers ---"; cat "$headers"
    exit 1
  fi
  if ! grep -q "$REPLAY_EXPECT_ERROR_SUBSTR" "$body"; then
    echo "Expected replay response body to contain: $REPLAY_EXPECT_ERROR_SUBSTR"
    echo "--- body ---"; cat "$body"
    exit 1
  fi
}

wait_for_gateway() {
  echo "[post-harness] Waiting up to ${WAIT_SECS}s for gateway /healthz allowDevHarness=true and jwksUrl=${JWKS_URL} ..."
  local ok="false"
  for _ in $(seq 1 $((WAIT_SECS * 10))); do
    if curl -fsS "${BASE}/healthz" 2>/dev/null | JWKS_URL="${JWKS_URL}" node -e '
      let d=""; process.stdin.on("data",c=>d+=c);
      process.stdin.on("end",()=>{ try{
        const j=JSON.parse(d);
        const allow = j?.devHarness?.allowDevHarness===true;
        const env = String(j?.devHarness?.nodeEnv||"").toLowerCase();
        const notProd = env !== "production";
        const jwks = String(j?.jwksUrl||"");
        process.exit(allow && notProd && jwks === process.env.JWKS_URL ? 0 : 1);
      }catch{process.exit(1)}});' >/dev/null 2>&1; then
      ok="true"; break
    fi
    sleep 0.1
  done
  if [[ "$ok" != "true" ]]; then
    echo "[post-harness] ERROR: gateway /healthz did not report allowDevHarness=true + jwksUrl match in time."
    echo "[post-harness] Start gateway with:"
    echo "[post-harness]   X402_ALLOW_DEV_HARNESS=true"
    echo "[post-harness]   NODE_ENV!=production"
    echo "[post-harness]   CRP_JWKS_URL=${JWKS_URL}"
    exit 1
  fi
  echo "[post-harness] OK: gateway dev harness allowed + jwksUrl matched"
}

# --------------------------------------------------------------------
# Request #1: POST unpaid => 402 + PAYMENT-REQUIRED
# --------------------------------------------------------------------
URL1="${BASE}/x402/premium?nonce=${NONCE}"
echo "[post-harness] request #1 (expect 402): POST $URL1"
curl -sS -X POST \
  -H "Content-Type: application/json" \
  --data "$POST_BODY" \
  "$URL1" -D "$TMP_HEADERS_1" -o "$TMP_BODY_1" >/dev/null || true
assert_status "402" "$TMP_HEADERS_1" "#1" "$TMP_BODY_1"

PR_B64="$(get_header "PAYMENT-REQUIRED" "$TMP_HEADERS_1")"
if [[ -z "$PR_B64" ]]; then
  echo "Missing PAYMENT-REQUIRED header on request #1"
  echo "--- headers ---"; cat "$TMP_HEADERS_1"
  exit 1
fi

# Decode PAYMENT-REQUIRED -> build mint URL
MINT_URL="$(
  PR_B64="$PR_B64" MINT_BASE="$MINT_BASE" node - <<'NODE'
function normalizeB64(s){
  s = String(s||"").trim().replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  return s;
}
const prB64 = process.env.PR_B64;
const mintBase = process.env.MINT_BASE;

const json = Buffer.from(normalizeB64(prB64), 'base64').toString('utf8');
const pr = JSON.parse(json);

const required = [
  pr.contractId, pr.contractVersion,
  pr.merchantId,
  pr.resource?.method, pr.resource?.path,
  pr.network,
  pr.asset?.tokenId,
  pr.asset?.decimals,
  pr.amount,
  pr.payTo,
  pr.nonce,
];
if (required.some(v => v === undefined || v === null || v === "")) {
  throw new Error("PAYMENT-REQUIRED missing required fields");
}
if (typeof pr.isFrozen !== "boolean") {
  throw new Error("PAYMENT-REQUIRED missing isFrozen boolean");
}

const u = new URL(mintBase);
u.searchParams.set('nonce', pr.nonce);
u.searchParams.set('contractId', pr.contractId);
u.searchParams.set('contractVersion', pr.contractVersion);
u.searchParams.set('isFrozen', String(pr.isFrozen));
u.searchParams.set('merchantId', pr.merchantId);
u.searchParams.set('method', String(pr.resource.method).toUpperCase());
u.searchParams.set('path', String(pr.resource.path));
u.searchParams.set('network', pr.network);
u.searchParams.set('tokenId', pr.asset.tokenId);
u.searchParams.set('decimals', String(pr.asset.decimals));
u.searchParams.set('amount', pr.amount);
u.searchParams.set('payTo', pr.payTo);

process.stdout.write(u.toString());
NODE
)"

echo "[post-harness] minting receipt via: $MINT_URL"
curl -fsS "$MINT_URL" > "$TMP_MINT_JSON"

RECEIPT_JWS="$(node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(o.jws||"")' "$TMP_MINT_JSON")"
if [[ -z "$RECEIPT_JWS" ]]; then
  echo "[post-harness] ERROR: mint did not return jws"
  cat "$TMP_MINT_JSON"
  exit 1
fi
echo "[post-harness] got RECEIPT_JWS (len=${#RECEIPT_JWS})"

wait_for_gateway

# --------------------------------------------------------------------
# Request #2: POST paid => 200 + PAYMENT-RESPONSE + upstream body
# --------------------------------------------------------------------
SIG_B64="$(payment_signature_b64)"
URL2="${BASE}/x402/premium?nonce=${NONCE}"
echo "[post-harness] request #2 (expect 200 + proxy content): POST $URL2"
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  --data "$POST_BODY" \
  "$URL2" -D "$TMP_HEADERS_2" -o "$TMP_BODY_2" >/dev/null || true
assert_status "200" "$TMP_HEADERS_2" "#2" "$TMP_BODY_2"

RESP_B64="$(get_header "PAYMENT-RESPONSE" "$TMP_HEADERS_2")"
if [[ -z "$RESP_B64" ]]; then
  echo "Missing PAYMENT-RESPONSE header on request #2"
  echo "--- headers ---"; cat "$TMP_HEADERS_2"
  exit 1
fi

# Validate that PAYMENT-RESPONSE includes the same receipt.jws
RESP_B64="$RESP_B64" RECEIPT_JWS="$RECEIPT_JWS" node - <<'NODE'
function normalizeB64(s){
  s = String(s||"").trim().replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  return s;
}
const respB64 = process.env.RESP_B64;
const want = process.env.RECEIPT_JWS;

const json = Buffer.from(normalizeB64(respB64), 'base64').toString('utf8');
const pr = JSON.parse(json);

const got = pr?.receipt?.jws || pr?.jws;
if (!got) process.exit(1);
if (got !== want) process.exit(1);
process.exit(0);
NODE

echo "[post-harness] PAYMENT-RESPONSE validated"

if ! grep -q "UPSTREAM_OK" "$TMP_BODY_2"; then
  echo "Expected upstream body to contain UPSTREAM_OK"
  echo "--- body ---"; cat "$TMP_BODY_2"
  exit 1
fi

echo "[post-harness] PASS: paid-path proxy worked + PAYMENT-RESPONSE validated"

# --------------------------------------------------------------------
# Request #3: replay (same URL + same body + same receipt) => 402
# --------------------------------------------------------------------
echo "[post-harness] request #3 (replay attempt, expect 402): POST $URL2"
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  --data "$POST_BODY" \
  "$URL2" -D "$TMP_HEADERS_3" -o "$TMP_BODY_3" >/dev/null || true
assert_status "402" "$TMP_HEADERS_3" "#3" "$TMP_BODY_3"
assert_replay_402 "$TMP_HEADERS_3" "$TMP_BODY_3" "#3"

echo "[post-harness] PASS: replay rejected with 402 + PAYMENT-REQUIRED"
echo "[post-harness] DONE"
