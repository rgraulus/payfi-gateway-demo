#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Phase C harness: paid proxy + replay protection + query-order canonicalization
#
# Key improvements:
# - Non-interactive runs can auto-generate a unique nonce to avoid accidental replays.
# - Expanded replay attempts: reorder, decoration, duplicate keys, encoding variants.
# -----------------------------------------------------------------------------

BASE="${BASE:-http://127.0.0.1:3005}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3010}"

# Capture whether NONCE was explicitly provided (important!)
NONCE_WAS_SET="false"
if [[ -n "${NONCE+x}" ]]; then
  NONCE_WAS_SET="true"
fi

# Default is to pause after ACTION REQUIRED
WAIT_FOR_USER="${WAIT_FOR_USER:-true}"
WAIT_SECS="${WAIT_SECS:-60}"

# AUTO_START_GATEWAY:
# - If true and WAIT_FOR_USER=false, we will NOT pause for manual restart.
# - We do not attempt to kill existing gateway processes; we only proceed if
#   /healthz indicates the expected receipt fingerprint is already active.
AUTO_START_GATEWAY="${AUTO_START_GATEWAY:-false}"

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
    NONCE="bb-$(date +%s)-$$-$RANDOM"
  else
    NONCE="bb-test"
  fi
fi

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
TMP_ISSUER_LOG="$(mktemp)"
TMP_MINT_JSON="$(mktemp)"

ISSUER_PID=""

cleanup() {
  rm -f "$TMP_HEADERS_1" "$TMP_BODY_1" "$TMP_HEADERS_2" "$TMP_BODY_2" \
        "$TMP_ISSUER_LOG" "$TMP_MINT_JSON" || true
  if [[ -n "${ISSUER_PID}" ]]; then
    kill "${ISSUER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

curl -sS "http://127.0.0.1:${UPSTREAM_PORT}/" >/dev/null

HOST="${JWKS_HOST}" PORT="${JWKS_PORT}" NONCE="${NONCE}" \
  node scripts/dev_jwks_server.mjs >"$TMP_ISSUER_LOG" 2>&1 &
ISSUER_PID=$!

JWKS_URL="http://${JWKS_HOST}:${JWKS_PORT}/.well-known/jwks.json"
MINT_BASE="http://${JWKS_HOST}:${JWKS_PORT}/mint"

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

get_header() {
  local name="$1"
  grep -i -m1 "^${name}:" "$2" | sed -E "s/^${name}:[[:space:]]*//I" | tr -d '\r'
}

payment_signature_b64() {
  NONCE="$NONCE" node -e 'process.stdout.write(Buffer.from(JSON.stringify({nonce:process.env.NONCE}),"utf8").toString("base64"))'
}

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

sha25612() {
  node -e 'const crypto=require("crypto"); const s=process.argv[1]||""; process.stdout.write(crypto.createHash("sha256").update(s,"utf8").digest("hex").slice(0,12));' "$1"
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

RECEIPT_SHA12="$(sha25612 "$RECEIPT_JWS")"
echo "[harness] minted receipt sha25612=${RECEIPT_SHA12}"

# --------------------------------------------------------------------
# ACTION REQUIRED: restart gateway with dev harness enabled
# --------------------------------------------------------------------
echo
echo "[harness] ACTION REQUIRED:"
echo "  Restart your gateway (Terminal A) with these env vars set:"
echo
printf "  X402_ALLOW_DEV_HARNESS=true \\\\\n"
printf "  CRP_JWKS_URL=\"%s\" \\\\\n" "$JWKS_URL"
printf "  X402_DEV_RECEIPT_JWS=\"%s\" \\\\\n" "$RECEIPT_JWS"
printf "  X402_DEV_RECEIPT_REQUIRE_SIG=true \\\\\n"
printf "  npm run dev\n"
echo

if [[ "${WAIT_FOR_USER}" == "true" ]]; then
  echo "[harness] Pausing now. Restart the gateway in Terminal A, then press Enter to continue..."
  read -r _
else
  if [[ "${AUTO_START_GATEWAY}" == "true" ]]; then
    echo "[harness] NOTE: WAIT_FOR_USER=false and AUTO_START_GATEWAY=true."
    echo "[harness]       This harness will proceed only if the gateway is already running with the expected dev receipt fingerprint."
    echo "[harness]       (It will not kill/restart a running gateway process.)"
  fi
fi

echo "[harness] Waiting up to ${WAIT_SECS}s for /healthz devHarness.enabled=true + receipt.sha25612=${RECEIPT_SHA12} ..."

ok="false"
for _ in $(seq 1 $((WAIT_SECS * 10))); do
  if curl -fsS "${BASE}/healthz" 2>/dev/null | RECEIPT_SHA12="${RECEIPT_SHA12}" node -e '
    let d=""; process.stdin.on("data",c=>d+=c);
    process.stdin.on("end",()=>{ try{
      const j=JSON.parse(d);
      const enabled = j?.devHarness?.enabled===true;
      const sha = j?.devHarness?.receipt?.sha25612 || null;
      process.exit(enabled && sha === process.env.RECEIPT_SHA12 ? 0 : 1);
    }catch{process.exit(1)}});' >/dev/null 2>&1; then
    ok="true"
    break
  fi
  sleep 0.1
done

if [[ "$ok" != "true" ]]; then
  echo "[harness] ERROR: gateway did not report devHarness.enabled=true with expected receipt fingerprint in time."
  echo "[harness]        If WAIT_FOR_USER=false, you must ensure the gateway is restarted with the printed env vars."
  exit 1
fi

echo "[harness] OK: gateway devHarness.enabled=true (and receipt fingerprint matched)"

# --------------------------------------------------------------------
# Request #2: expect 200 + PAYMENT-RESPONSE + upstream body
# --------------------------------------------------------------------
SIG_B64="$(payment_signature_b64)"
URL2="${BASE}/x402/premium?nonce=${NONCE}"
echo "[harness] request #2 (expect 200 + proxy content): $URL2"
curl -sS -H "PAYMENT-SIGNATURE: ${SIG_B64}" "$URL2" -D "$TMP_HEADERS_2" -o "$TMP_BODY_2" >/dev/null || true
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
# Replay attempts helper
# --------------------------------------------------------------------
do_replay_attempt() {
  local label="$1"
  local url="$2"

  local h b
  h="$(mktemp)"
  b="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$h' '$b' >/dev/null 2>&1 || true; cleanup" EXIT

  echo "[harness] request ${label} (replay attempt, expect 402): $url"
  curl -sS -H "PAYMENT-SIGNATURE: ${SIG_B64}" "$url" -D "$h" -o "$b" >/dev/null || true
  assert_status "402" "$h" "$label" "$b"
  assert_replay_402 "$h" "$b" "$label"
  rm -f "$h" "$b" >/dev/null 2>&1 || true
}

# --------------------------------------------------------------------
# Request #3: exact replay (same URL)
# --------------------------------------------------------------------
do_replay_attempt "#3" "$URL2"
echo "[harness] PASS: replay rejected with 402 + PAYMENT-REQUIRED"

# --------------------------------------------------------------------
# M3 “airtight” query bypass attempts:
# - reorder
# - decoration
# - duplicated keys
# - duplicate nonce (Express may parse as array)
# - encoding variants
# --------------------------------------------------------------------
K="$REPLAY_QUERY_EXTRA_KEY"
V="$REPLAY_QUERY_EXTRA_VAL"

do_replay_attempt "#4" "${BASE}/x402/premium?${K}=${V}&nonce=${NONCE}"
do_replay_attempt "#5" "${BASE}/x402/premium?nonce=${NONCE}&${K}=${V}"
do_replay_attempt "#6" "${BASE}/x402/premium?nonce=${NONCE}&${K}=${V}&${K}=$((V+1))"
do_replay_attempt "#7" "${BASE}/x402/premium?nonce=${NONCE}&${K}=${V}&${K}=${V}"   # dup key same value
do_replay_attempt "#8" "${BASE}/x402/premium?nonce=${NONCE}&${K}=%31"             # encoded '1'
do_replay_attempt "#9" "${BASE}/x402/premium?nonce=${NONCE}&nonce=${NONCE}&${K}=${V}" # dup nonce

echo "[harness] PASS: query decoration/reorder variants rejected (tupleKey canonical path policy)"
echo "[harness] DONE"
