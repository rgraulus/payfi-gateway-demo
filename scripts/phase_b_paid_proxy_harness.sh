#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Phase B/C harness: paid proxy + replay protection + query-policy regression
#
# M4 (restartless):
# - No "restart gateway with new env receipt" loop.
# - We mint a dev receipt and inject it per request using:
#     X402-DEV-RECEIPT-JWS: <JWS>
#
# Gateway requirements for this harness:
# - Gateway already running on BASE
# - X402_ALLOW_DEV_HARNESS=true
# - NODE_ENV != production
# - CRP_JWKS_URL should point at the issuer this script starts (default 127.0.0.1:8088)
# -----------------------------------------------------------------------------

BASE="${BASE:-http://127.0.0.1:3005}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3010}"

# Capture whether NONCE was explicitly provided (important!)
NONCE_WAS_SET="false"
if [[ -n "${NONCE+x}" ]]; then
  NONCE_WAS_SET="true"
fi

# Default is to pause after ACTION REQUIRED (kept for compatibility; no restart needed)
WAIT_FOR_USER="${WAIT_FOR_USER:-true}"
WAIT_SECS="${WAIT_SECS:-60}"

JWKS_HOST="${JWKS_HOST:-127.0.0.1}"
JWKS_PORT="${JWKS_PORT:-8088}"

# Replay regression expectations
REPLAY_EXPECT_ERROR_SUBSTR="${REPLAY_EXPECT_ERROR_SUBSTR:-Payment already claimed (replay)}"
REPLAY_QUERY_EXTRA_KEY="${REPLAY_QUERY_EXTRA_KEY:-z}"
REPLAY_QUERY_EXTRA_VAL="${REPLAY_QUERY_EXTRA_VAL:-1}"

# Decide NONCE
if [[ "${NONCE_WAS_SET}" == "true" ]]; then
  NONCE="${NONCE}"
else
  if [[ "${WAIT_FOR_USER}" == "false" ]]; then
    # Non-interactive run: default to a unique nonce to avoid accidental replay on reruns.
    NONCE="bb-$(date +%s)-$$-$RANDOM"
  else
    # Interactive run: keep stable default
    NONCE="bb-test"
  fi
fi

# Warn if user explicitly pinned NONCE=bb-test in non-interactive mode.
if [[ "${WAIT_FOR_USER}" == "false" && "${NONCE_WAS_SET}" == "true" && "${NONCE}" == "bb-test" ]]; then
  echo "[harness] WARNING: WAIT_FOR_USER=false with NONCE=bb-test will fail on back-to-back runs due to replay protection." >&2
  echo "[harness]          Use a unique NONCE (e.g. NONCE=bb-\$(date +%s)) or omit NONCE to auto-generate." >&2
fi

echo "[harness] BASE=$BASE"
echo "[harness] NONCE=$NONCE"
echo "[harness] expecting upstream on :$UPSTREAM_PORT"
echo "[harness] starting dev JWKS issuer on $JWKS_HOST:$JWKS_PORT ..."

TMP_HEADERS_1="$(mktemp)"
TMP_BODY_1="$(mktemp)"
TMP_HEADERS_2="$(mktemp)"
TMP_BODY_2="$(mktemp)"
TMP_HEADERS_3="$(mktemp)"
TMP_BODY_3="$(mktemp)"
TMP_HEADERS_4="$(mktemp)"
TMP_BODY_4="$(mktemp)"
TMP_HEADERS_5="$(mktemp)"
TMP_BODY_5="$(mktemp)"
TMP_HEADERS_6="$(mktemp)"
TMP_BODY_6="$(mktemp)"
TMP_HEADERS_7="$(mktemp)"
TMP_BODY_7="$(mktemp)"
TMP_HEADERS_8="$(mktemp)"
TMP_BODY_8="$(mktemp)"
TMP_HEADERS_9="$(mktemp)"
TMP_BODY_9="$(mktemp)"
TMP_ISSUER_LOG="$(mktemp)"
TMP_MINT_JSON="$(mktemp)"

ISSUER_PID=""

cleanup() {
  rm -f \
    "$TMP_HEADERS_1" "$TMP_BODY_1" \
    "$TMP_HEADERS_2" "$TMP_BODY_2" \
    "$TMP_HEADERS_3" "$TMP_BODY_3" \
    "$TMP_HEADERS_4" "$TMP_BODY_4" \
    "$TMP_HEADERS_5" "$TMP_BODY_5" \
    "$TMP_HEADERS_6" "$TMP_BODY_6" \
    "$TMP_HEADERS_7" "$TMP_BODY_7" \
    "$TMP_HEADERS_8" "$TMP_BODY_8" \
    "$TMP_HEADERS_9" "$TMP_BODY_9" \
    "$TMP_ISSUER_LOG" "$TMP_MINT_JSON" || true
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

# Wait for JWKS endpoint to respond
for _ in $(seq 1 100); do
  if curl -fsS "$JWKS_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! curl -fsS "$JWKS_URL" >/dev/null 2>&1; then
  echo
  echo "[harness] ERROR: JWKS issuer did not become ready at $JWKS_URL"
  echo "[harness] issuer log:"
  sed 's/^/  /' "$TMP_ISSUER_LOG" || true
  exit 1
fi

echo "[harness] JWKS_URL=$JWKS_URL"

# Helper: extract a header (case-insensitive) from a curl headers file.
get_header() {
  local name="$1"
  grep -i -m1 "^${name}:" "$2" | sed -E "s/^${name}:[[:space:]]*//I" | tr -d '\r'
}

# Helper: base64(JSON({nonce})) for PAYMENT-SIGNATURE
payment_signature_b64() {
  NONCE="$NONCE" node -e 'process.stdout.write(Buffer.from(JSON.stringify({nonce:process.env.NONCE}),"utf8").toString("base64"))'
}

# Helper: assert status code for a given headers file
assert_status() {
  local want="$1"
  local headers="$2"
  local label="$3"
  local body="$4"

  local got
  got="$(head -n1 "$headers" | awk '{print $2}' | tr -d '\r')"
  echo "[harness] status $label=$got"
  if [[ "$got" != "$want" ]]; then
    echo "Expected $want on request $label"
    echo "--- headers ---"; cat "$headers"
    echo "--- body ---"; cat "$body"
    exit 1
  fi
}

# Helper: assert 402 contains PAYMENT-REQUIRED and replay error substring
assert_replay_402() {
  local headers="$1"
  local body="$2"
  local label="$3"

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

# Helper: wait for gateway to be ready (dev harness allowed, jwksUrl matches)
wait_for_gateway() {
  echo "[harness] Waiting up to ${WAIT_SECS}s for gateway /healthz allowDevHarness=true and jwksUrl=${JWKS_URL} ..."
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
      ok="true"
      break
    fi
    sleep 0.1
  done

  if [[ "$ok" != "true" ]]; then
    echo "[harness] ERROR: gateway /healthz did not report allowDevHarness=true + jwksUrl match in time."
    echo "[harness]        Make sure gateway is started with:"
    echo "[harness]          X402_ALLOW_DEV_HARNESS=true"
    echo "[harness]          NODE_ENV!=production"
    echo "[harness]          CRP_JWKS_URL=${JWKS_URL}"
    exit 1
  fi
  echo "[harness] OK: gateway dev harness allowed + jwksUrl matched"
}

# --------------------------------------------------------------------
# Request #1: expect 402 + PAYMENT-REQUIRED (this gives us the contract)
# --------------------------------------------------------------------
URL1="${BASE}/x402/premium?nonce=${NONCE}"
echo "[harness] request #1 (expect 402): $URL1"
curl -sS "$URL1" -D "$TMP_HEADERS_1" -o "$TMP_BODY_1" >/dev/null || true
assert_status "402" "$TMP_HEADERS_1" "#1" "$TMP_BODY_1"

PR_B64="$(get_header "PAYMENT-REQUIRED" "$TMP_HEADERS_1")"
if [[ -z "$PR_B64" ]]; then
  echo "Missing PAYMENT-REQUIRED header on request #1"
  echo "--- headers ---"; cat "$TMP_HEADERS_1"
  exit 1
fi

# Decode PAYMENT-REQUIRED b64 -> JSON and build mint URL
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

echo "[harness] minting receipt via: $MINT_URL"
curl -fsS "$MINT_URL" > "$TMP_MINT_JSON"

RECEIPT_JWS="$(node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(o.jws||"")' "$TMP_MINT_JSON")"
if [[ -z "$RECEIPT_JWS" ]]; then
  echo "[harness] ERROR: mint did not return jws"
  cat "$TMP_MINT_JSON"
  exit 1
fi
echo "[harness] got RECEIPT_JWS (len=${#RECEIPT_JWS})"

# Ensure gateway is ready and pointed at this issuer
wait_for_gateway

# --------------------------------------------------------------------
# Request #2: expect 200 + PAYMENT-RESPONSE + upstream body
# (inject receipt per request via X402-DEV-RECEIPT-JWS)
# --------------------------------------------------------------------
SIG_B64="$(payment_signature_b64)"
URL2="${BASE}/x402/premium?nonce=${NONCE}"
echo "[harness] request #2 (expect 200 + proxy content): $URL2"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL2" -D "$TMP_HEADERS_2" -o "$TMP_BODY_2" >/dev/null || true
assert_status "200" "$TMP_HEADERS_2" "#2" "$TMP_BODY_2"

RESP_B64="$(get_header "PAYMENT-RESPONSE" "$TMP_HEADERS_2")"
if [[ -z "$RESP_B64" ]]; then
  echo "Missing PAYMENT-RESPONSE header on request #2"
  echo "--- headers ---"; cat "$TMP_HEADERS_2"
  exit 1
fi

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
if (!got) {
  console.error("PAYMENT-RESPONSE missing receipt.jws");
  process.exit(1);
}
if (got !== want) {
  console.error("PAYMENT-RESPONSE receipt.jws mismatch");
  process.exit(1);
}
process.exit(0);
NODE

echo "[harness] PAYMENT-RESPONSE validated"

if ! grep -q "UPSTREAM_OK" "$TMP_BODY_2"; then
  echo "Expected upstream body to contain UPSTREAM_OK"
  echo "--- body ---"; cat "$TMP_BODY_2"
  exit 1
fi

echo "[harness] PASS: paid-path proxy worked + PAYMENT-RESPONSE validated"

# --------------------------------------------------------------------
# Request #3: replay test (same URL, same signature, same injected receipt)
# --------------------------------------------------------------------
URL3="$URL2"
echo "[harness] request #3 (replay attempt, expect 402): $URL3"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL3" -D "$TMP_HEADERS_3" -o "$TMP_BODY_3" >/dev/null || true
assert_status "402" "$TMP_HEADERS_3" "#3" "$TMP_BODY_3"
assert_replay_402 "$TMP_HEADERS_3" "$TMP_BODY_3" "#3"
echo "[harness] PASS: replay rejected with 402 + PAYMENT-REQUIRED"

# --------------------------------------------------------------------
# Request #4-#9: query decoration / reorder / duplicates / encoding variants
# --------------------------------------------------------------------
URL4="${BASE}/x402/premium?${REPLAY_QUERY_EXTRA_KEY}=${REPLAY_QUERY_EXTRA_VAL}&nonce=${NONCE}"
echo "[harness] request #4 (replay attempt, expect 402): $URL4"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL4" -D "$TMP_HEADERS_4" -o "$TMP_BODY_4" >/dev/null || true
assert_status "402" "$TMP_HEADERS_4" "#4" "$TMP_BODY_4"
assert_replay_402 "$TMP_HEADERS_4" "$TMP_BODY_4" "#4"

URL5="${BASE}/x402/premium?nonce=${NONCE}&${REPLAY_QUERY_EXTRA_KEY}=${REPLAY_QUERY_EXTRA_VAL}"
echo "[harness] request #5 (replay attempt, expect 402): $URL5"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL5" -D "$TMP_HEADERS_5" -o "$TMP_BODY_5" >/dev/null || true
assert_status "402" "$TMP_HEADERS_5" "#5" "$TMP_BODY_5"
assert_replay_402 "$TMP_HEADERS_5" "$TMP_BODY_5" "#5"

URL6="${BASE}/x402/premium?nonce=${NONCE}&${REPLAY_QUERY_EXTRA_KEY}=1&${REPLAY_QUERY_EXTRA_KEY}=2"
echo "[harness] request #6 (replay attempt, expect 402): $URL6"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL6" -D "$TMP_HEADERS_6" -o "$TMP_BODY_6" >/dev/null || true
assert_status "402" "$TMP_HEADERS_6" "#6" "$TMP_BODY_6"
assert_replay_402 "$TMP_HEADERS_6" "$TMP_BODY_6" "#6"

URL7="${BASE}/x402/premium?nonce=${NONCE}&${REPLAY_QUERY_EXTRA_KEY}=1&${REPLAY_QUERY_EXTRA_KEY}=1"
echo "[harness] request #7 (replay attempt, expect 402): $URL7"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL7" -D "$TMP_HEADERS_7" -o "$TMP_BODY_7" >/dev/null || true
assert_status "402" "$TMP_HEADERS_7" "#7" "$TMP_BODY_7"
assert_replay_402 "$TMP_HEADERS_7" "$TMP_BODY_7" "#7"

URL8="${BASE}/x402/premium?nonce=${NONCE}&${REPLAY_QUERY_EXTRA_KEY}=%31"
echo "[harness] request #8 (replay attempt, expect 402): $URL8"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL8" -D "$TMP_HEADERS_8" -o "$TMP_BODY_8" >/dev/null || true
assert_status "402" "$TMP_HEADERS_8" "#8" "$TMP_BODY_8"
assert_replay_402 "$TMP_HEADERS_8" "$TMP_BODY_8" "#8"

URL9="${BASE}/x402/premium?nonce=${NONCE}&nonce=${NONCE}&${REPLAY_QUERY_EXTRA_KEY}=1"
echo "[harness] request #9 (replay attempt, expect 402): $URL9"
curl -sS \
  -H "PAYMENT-SIGNATURE: ${SIG_B64}" \
  -H "X402-DEV-RECEIPT-JWS: ${RECEIPT_JWS}" \
  "$URL9" -D "$TMP_HEADERS_9" -o "$TMP_BODY_9" >/dev/null || true
assert_status "402" "$TMP_HEADERS_9" "#9" "$TMP_BODY_9"
assert_replay_402 "$TMP_HEADERS_9" "$TMP_BODY_9" "#9"

echo "[harness] PASS: query decoration/reorder variants rejected (tupleKey canonical path/query policy)"
echo "[harness] DONE"
