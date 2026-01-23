#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3005}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3010}"
NONCE="${NONCE:-bb-test}"

JWKS_HOST="${JWKS_HOST:-127.0.0.1}"
JWKS_PORT="${JWKS_PORT:-8088}"
WAIT_SECS="${WAIT_SECS:-60}"

# Default pause after ACTION REQUIRED
WAIT_FOR_USER="${WAIT_FOR_USER:-true}"

# Mint a non-finalized receipt
SETTLEMENT_STATUS="${SETTLEMENT_STATUS:-pending}"
TTL_SEC="${TTL_SEC:-300}"

echo "[phase-d] BASE=$BASE"
echo "[phase-d] NONCE=$NONCE"
echo "[phase-d] expecting upstream on :$UPSTREAM_PORT"
echo "[phase-d] starting dev JWKS issuer on $JWKS_HOST:$JWKS_PORT ..."
echo "[phase-d] settlementStatus=$SETTLEMENT_STATUS ttlSec=$TTL_SEC"

TMP_HEADERS_1="$(mktemp)"
TMP_BODY_1="$(mktemp)"
TMP_HEADERS_2="$(mktemp)"
TMP_BODY_2="$(mktemp)"
TMP_ISSUER_LOG="$(mktemp)"
TMP_MINT_JSON="$(mktemp)"

ISSUER_PID=""

cleanup() {
  rm -f "$TMP_HEADERS_1" "$TMP_BODY_1" "$TMP_HEADERS_2" "$TMP_BODY_2" "$TMP_ISSUER_LOG" "$TMP_MINT_JSON" || true
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
  echo "[phase-d] ERROR: JWKS issuer did not become ready at $JWKS_URL"
  echo "[phase-d] issuer log:"
  sed 's/^/  /' "$TMP_ISSUER_LOG" || true
  exit 1
fi

echo "[phase-d] JWKS_URL=$JWKS_URL"

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
  echo "[phase-d] status $label=$got"
  if [[ "$got" != "$want" ]]; then
    echo "Expected $want on request $label"
    echo "--- headers ---"; cat "$headers"
    echo "--- body ---"; cat "$body"
    exit 1
  fi
}

assert_header_absent() {
  local name="$1"
  local headers="$2"
  local label="$3"

  if grep -qi "^${name}:" "$headers"; then
    echo "[phase-d] ERROR: unexpected ${name} header present on $label (must be absent)"
    echo "--- headers ---"; cat "$headers"
    exit 1
  fi
}

# --------------------------------------------------------------------
# Request #1: expect 402 + PAYMENT-REQUIRED (this gives us contract fields)
# --------------------------------------------------------------------
URL1="${BASE}/x402/premium?nonce=${NONCE}"
echo "[phase-d] request #1 (expect 402): $URL1"
curl -sS "$URL1" -D "$TMP_HEADERS_1" -o "$TMP_BODY_1" >/dev/null || true
assert_status "402" "$TMP_HEADERS_1" "#1" "$TMP_BODY_1"

PR_B64="$(get_header "PAYMENT-REQUIRED" "$TMP_HEADERS_1")"
if [[ -z "$PR_B64" ]]; then
  echo "Missing PAYMENT-REQUIRED header on request #1"
  echo "--- headers ---"; cat "$TMP_HEADERS_1"
  exit 1
fi

# Build mint URL from PAYMENT-REQUIRED then append settlementStatus=pending
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

# Append Phase D flags
MINT_URL="${MINT_URL}&settlementStatus=${SETTLEMENT_STATUS}&ttlSec=${TTL_SEC}"

echo "[phase-d] minting NON-FINALIZED receipt via: $MINT_URL"
curl -fsS "$MINT_URL" > "$TMP_MINT_JSON"

RECEIPT_JWS="$(node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(o.jws||"")' "$TMP_MINT_JSON")"
if [[ -z "$RECEIPT_JWS" ]]; then
  echo "[phase-d] ERROR: mint did not return jws"
  cat "$TMP_MINT_JSON"
  exit 1
fi
echo "[phase-d] got RECEIPT_JWS (len=${#RECEIPT_JWS})"

# --------------------------------------------------------------------
# ACTION REQUIRED: restart gateway with dev harness enabled (using pending receipt)
# --------------------------------------------------------------------
echo
echo "[phase-d] ACTION REQUIRED:"
echo "  Restart your gateway (Terminal A) with these env vars set:"
echo
printf "  X402_ALLOW_DEV_HARNESS=true \\\\\n"
printf "  CRP_JWKS_URL=\"%s\" \\\\\n" "$JWKS_URL"
printf "  X402_DEV_RECEIPT_JWS=\"%s\" \\\\\n" "$RECEIPT_JWS"
printf "  X402_DEV_RECEIPT_REQUIRE_SIG=true \\\\\n"
printf "  npm run dev\n"
echo

if [[ "${WAIT_FOR_USER}" == "true" ]]; then
  echo "[phase-d] Pausing now. Restart the gateway in Terminal A, then press Enter to continue..."
  read -r _
fi

echo "[phase-d] Waiting up to ${WAIT_SECS}s for /healthz to report devHarness.enabled=true ..."

ok="false"
for _ in $(seq 1 $((WAIT_SECS * 10))); do
  if curl -fsS "${BASE}/healthz" 2>/dev/null | node -e '
    let d=""; process.stdin.on("data",c=>d+=c);
    process.stdin.on("end",()=>{ try{
      const j=JSON.parse(d);
      process.exit(j?.devHarness?.enabled===true ? 0 : 1);
    }catch{process.exit(1)}});' >/dev/null 2>&1; then
    ok="true"
    break
  fi
  sleep 0.1
done

if [[ "$ok" != "true" ]]; then
  echo "[phase-d] ERROR: gateway did not report devHarness.enabled=true in time."
  exit 1
fi

echo "[phase-d] OK: gateway devHarness.enabled=true"

# --------------------------------------------------------------------
# Request #2: paid attempt with pending receipt must be rejected:
# - expect 402
# - must include PAYMENT-REQUIRED
# - MUST NOT include PAYMENT-RESPONSE
# --------------------------------------------------------------------
SIG_B64="$(payment_signature_b64)"
URL2="${BASE}/x402/premium?nonce=${NONCE}"
echo "[phase-d] request #2 (expect 402; NO PAYMENT-RESPONSE): $URL2"
curl -sS -H "PAYMENT-SIGNATURE: ${SIG_B64}" "$URL2" -D "$TMP_HEADERS_2" -o "$TMP_BODY_2" >/dev/null || true
assert_status "402" "$TMP_HEADERS_2" "#2" "$TMP_BODY_2"

PR2="$(get_header "PAYMENT-REQUIRED" "$TMP_HEADERS_2")"
if [[ -z "$PR2" ]]; then
  echo "[phase-d] ERROR: missing PAYMENT-REQUIRED on #2"
  echo "--- headers ---"; cat "$TMP_HEADERS_2"
  exit 1
fi

assert_header_absent "PAYMENT-RESPONSE" "$TMP_HEADERS_2" "#2"
# (Legacy header should also be absent)
assert_header_absent "X-PAYMENT-RESPONSE" "$TMP_HEADERS_2" "#2"

echo "[phase-d] PASS: pending/non-finalized receipt rejected (402) and PAYMENT-RESPONSE not emitted"
echo "[phase-d] DONE"
