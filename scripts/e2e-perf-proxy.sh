#!/usr/bin/env bash
# scripts/e2e-perf-proxy.sh
# Canonical AUTORUN payment flow (PROXY mode) — PERF variant
# - Intentionally kept very close to scripts/e2e-autorun-proxy.sh
# - Changes vs autorun:
#   (1) Default TMPDIR is separated: .tmp/e2e-perf-proxy
#   (2) WAIT FOR INDEX uses txHash-based query (limit=1) for lower load and cleaner match
#   (3) PERF instrumentation: human-friendly phase timings
#   (4) PERF: reduce disk churn in poll loops (keep last response on disk; periodic snapshots)
#   (5) PERF: reduce “poll boundary tax” via single double-tap repoll (200ms) before sleeping full interval
#   (6) PERF: support fractional POLL_INTERVAL_SECS (e.g., 0.2) safely (ms-based bookkeeping)
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://127.0.0.1:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
MERCHANT="${MERCHANT:-demo-merchant}"

RESOURCE_PATH="${RESOURCE_PATH:-/premium}"
X402_PREFIX="${X402_PREFIX:-/x402}"
GATED_PATH="${GATED_PATH:-${X402_PREFIX}${RESOURCE_PATH}}"

PAYER_CMD="${PAYER_CMD:-npm run --silent payer:plt:perf --}"
WALLET_EXPORT="${WALLET_EXPORT:-keys/wallet.export}"

POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"
FULFILL_MAX_ATTEMPTS="${FULFILL_MAX_ATTEMPTS:-5}"

# Double-tap repoll delay (seconds). Kept small to reduce boundary tax without increasing steady-state load much.
DOUBLE_TAP_DELAY_SECS="${DOUBLE_TAP_DELAY_SECS:-0.2}"

TMPDIR="${TMPDIR:-$PWD/.tmp/e2e-perf-proxy}"
mkdir -p "$TMPDIR"

PR_JSON="$TMPDIR/pr.json"
PAYMENT_REQ_JSON="$TMPDIR/payment.req.json"
PAYMENT_RESP_JSON="$TMPDIR/payment.resp.json"
FULFILL_RESP_JSON="$TMPDIR/fulfill.resp.json"
PAID_RESP="$TMPDIR/gated.response.txt"
BASE64_ERR="$TMPDIR/base64.err"
SEARCH_JSON="$TMPDIR/search.json"
REDEEM_RESP="$TMPDIR/redeem.response.txt"
PAYER_STDERR="$TMPDIR/payer.stderr.txt"
IDX_JSON="$TMPDIR/index.poll.json"

IDX_TMP_JSON="$TMPDIR/.index.tmp.json"
SEARCH_TMP_JSON="$TMPDIR/.search.tmp.json"

JQ_BIN="jq"
command -v jq.exe >/dev/null 2>&1 && JQ_BIN="jq.exe"

winpath() { cygpath -w "$1"; }

PR_JSON_WIN="$(winpath "$PR_JSON")"
PAYMENT_REQ_JSON_WIN="$(winpath "$PAYMENT_REQ_JSON")"
PAYMENT_RESP_JSON_WIN="$(winpath "$PAYMENT_RESP_JSON")"
FULFILL_RESP_JSON_WIN="$(winpath "$FULFILL_RESP_JSON")"
PAID_RESP_WIN="$(winpath "$PAID_RESP")"
BASE64_ERR_WIN="$(winpath "$BASE64_ERR")"
SEARCH_JSON_WIN="$(winpath "$SEARCH_JSON")"
REDEEM_RESP_WIN="$(winpath "$REDEEM_RESP")"
IDX_JSON_WIN="$(winpath "$IDX_JSON")"
IDX_TMP_JSON_WIN="$(winpath "$IDX_TMP_JSON")"
SEARCH_TMP_JSON_WIN="$(winpath "$SEARCH_TMP_JSON")"

die() { echo "ERROR: $*" >&2; exit 1; }

# -------- Perf timing helpers (human-friendly) --------
now_ms() {
  local t
  t="$(date +%s%3N 2>/dev/null || true)"
  if [[ -n "${t:-}" && "$t" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$t"
  else
    printf '%s000\n' "$(date +%s)"
  fi
}
fmt_ms() { awk -v ms="${1:-0}" 'BEGIN{ printf "%.3fs", (ms/1000.0) }'; }
print_timing() {
  local label="$1" start="$2" end="$3"
  local dur="$(( end - start ))"
  echo "Timing: ${label}=$(fmt_ms "$dur")"
}

# Convert seconds string (supports 0.2) -> integer milliseconds (e.g., 200)
secs_to_ms() {
  local s="${1:-0}"
  awk -v s="$s" 'BEGIN{
    # allow "0.2", "1", "1.0"
    ms = int((s+0) * 1000 + 0.5);
    if (ms < 0) ms = 0;
    print ms;
  }'
}

T_SCRIPT_START="$(now_ms)"

backoff_sleep() {
  local attempt="${1:-1}"
  local secs="$(( 2 ** (attempt-1) ))"
  (( secs < 1 )) && secs=1
  (( secs > BACKOFF_MAX_SECS )) && secs="$BACKOFF_MAX_SECS"
  sleep "$secs"
}

double_tap_sleep() {
  local s="${1:-0.2}"
  sleep "$s"
}

# Optional flag: print payer command and exit (handy sanity check)
if [[ "${1:-}" == "--print-payer-cmd" ]]; then
  # If compiled helper exists, we prefer it (faster, no ts-node dependency).
  PERF_JS="$PWD/dist-perf/scripts/plt-transfer-perf.js"
  if [[ -f "$PERF_JS" ]]; then
    echo "PAYER_CMD=node $(cygpath -w "$PERF_JS")"
  else
    echo "PAYER_CMD=$PAYER_CMD"
  fi
  exit 0
fi

# ---- Step 0: Fetch PAYMENT-REQUIRED from Gateway for the PROXY route ----
echo "Fetching PAYMENT-REQUIRED from: $GW$GATED_PATH"
curl -sS -i "$GW$GATED_PATH" | tr -d '\r' > "$PAID_RESP"

PR_B64="$(awk -F': ' 'tolower($1)=="payment-required"{print $2}' "$PAID_RESP" | head -n 1)"
[[ -n "${PR_B64:-}" ]] || {
  echo "---- first 60 lines of response ----"
  sed -n '1,60p' "$PAID_RESP"
  die "missing PAYMENT-REQUIRED header from $GW$GATED_PATH"
}

echo "Decoding PR into: $PR_JSON"
rm -f "$PR_JSON" "$BASE64_ERR"
if ! printf '%s' "$PR_B64" | base64 -d > "$PR_JSON" 2>"$BASE64_ERR"; then
  echo "base64 stderr:"; cat "$BASE64_ERR" || true
  echo "Header value (first 80 chars): ${PR_B64:0:80}"
  die "base64 -d failed decoding PAYMENT-REQUIRED"
fi
[[ -s "$PR_JSON" ]] || die "PR JSON file not created or empty: $PR_JSON"

"$JQ_BIN" '{nonce,issuedAt,expiresAt,contractId,resource,network,asset,amount,payTo}' "$PR_JSON_WIN"

PR_NONCE="$("$JQ_BIN" -r '.nonce' "$PR_JSON_WIN")"
[[ -n "$PR_NONCE" && "$PR_NONCE" != "null" ]] || die "PR nonce missing"
echo "PR_NONCE=$PR_NONCE"

# ---- Step 1: Create CRP payment from THAT SAME PR (same nonce) ----
CREATE_REQ="$("$JQ_BIN" -c '
  . as $pr
  | . + {
      expiry: (($pr.expiresAt|tonumber) | todateiso8601),
      metadata: { contract: {
        contractId: $pr.contractId,
        contractVersion: $pr.contractVersion,
        isFrozen: $pr.isFrozen,
        merchantId: $pr.merchantId,
        resource: $pr.resource,
        network: $pr.network,
        asset: $pr.asset,
        amount: $pr.amount,
        payTo: $pr.payTo
      }}
    }
' "$PR_JSON_WIN")"

printf '%s\n' "$CREATE_REQ" > "$PAYMENT_REQ_JSON"
[[ -s "$PAYMENT_REQ_JSON" ]] || die "payment request JSON not created or empty: $PAYMENT_REQ_JSON"
echo "Request file ready: $PAYMENT_REQ_JSON (bytes=$(wc -c < "$PAYMENT_REQ_JSON"))"

CREATE_RESP="$(curl -sS -X POST "$CRP/v1/crp/payments" \
  -H 'content-type: application/json' \
  -d @"$PAYMENT_REQ_JSON_WIN")"

echo "$CREATE_RESP" | "$JQ_BIN" .
echo "$CREATE_RESP" > "$PAYMENT_RESP_JSON"

CRP_NONCE="$(echo "$CREATE_RESP" | "$JQ_BIN" -r '.payment.nonce')"
[[ "$CRP_NONCE" == "$PR_NONCE" ]] || die "CRP nonce differs from PR nonce (PR=$PR_NONCE CRP=$CRP_NONCE)"
echo "NONCE=$CRP_NONCE"

# ---- Step 2: AUTORUN pay from wallet using payer helper, capture tx hash ----
[[ -f "$WALLET_EXPORT" ]] || die "wallet export not found: $WALLET_EXPORT"

TOKEN_ID="$("$JQ_BIN" -r '.asset.tokenId' "$PR_JSON_WIN")"
AMOUNT="$("$JQ_BIN" -r '.amount' "$PR_JSON_WIN")"
PAY_TO="$("$JQ_BIN" -r '.payTo' "$PR_JSON_WIN")"
[[ -n "$TOKEN_ID" && "$TOKEN_ID" != "null" ]] || die "missing PR.asset.tokenId"
[[ -n "$AMOUNT" && "$AMOUNT" != "null" ]] || die "missing PR.amount"
[[ -n "$PAY_TO" && "$PAY_TO" != "null" ]] || die "missing PR.payTo"

echo
echo "=== AUTORUN PLT TRANSFER ==="
echo "wallet=$WALLET_EXPORT"
echo "to=$PAY_TO tokenId=$TOKEN_ID amount=$AMOUNT memo=$CRP_NONCE"

# Prefer compiled helper if present (keeps perf variant firewalled)
PERF_JS="$PWD/dist-perf/scripts/plt-transfer-perf.js"
if [[ -f "$PERF_JS" ]]; then
  PAYER_RUN=(node "$(cygpath -w "$PERF_JS")")
else
  # shell words in PAYER_CMD (e.g. npm run ...) => eval path
  PAYER_RUN=()
fi

T_PAYER_START="$(now_ms)"

# Default: wait (current behavior). Set PAYER_WAIT=0 to overlap finalization with the rest of the flow.
PAYER_WAIT_FLAG="$([[ "${PAYER_WAIT:-1}" == "1" ]] && echo "--wait" || echo "--no-wait")"

# Optional perf shortcut: pass decimals if set (e.g., PAYER_DECIMALS=6)
PAYER_DECIMALS_FLAG=()
if [[ -n "${PAYER_DECIMALS:-}" ]]; then
  PAYER_DECIMALS_FLAG=( --decimals "$PAYER_DECIMALS" )
fi

if [[ -f "$PERF_JS" ]]; then
  TX="$("${PAYER_RUN[@]}" \
    --wallet "$WALLET_EXPORT" \
    --to "$PAY_TO" \
    --tokenId "$TOKEN_ID" \
    --amount "$AMOUNT" \
    --memo "$CRP_NONCE" \
    "${PAYER_DECIMALS_FLAG[@]}" \
    $PAYER_WAIT_FLAG \
    2>"$PAYER_STDERR" | tr -d '\r\n[:space:]' || true)"
else
  TX="$($PAYER_CMD \
    --wallet "$WALLET_EXPORT" \
    --to "$PAY_TO" \
    --tokenId "$TOKEN_ID" \
    --amount "$AMOUNT" \
    --memo "$CRP_NONCE" \
    "${PAYER_DECIMALS_FLAG[@]}" \
    $PAYER_WAIT_FLAG \
    2>"$PAYER_STDERR" | tr -d '\r\n[:space:]' || true)"
fi

T_PAYER_END="$(now_ms)"
print_timing "payer_wait" "$T_PAYER_START" "$T_PAYER_END"

if [[ -z "${TX:-}" ]]; then
  echo "---- payer stderr ----"
  sed -n '1,200p' "$PAYER_STDERR" || true
  die "payer helper did not produce a tx hash on stdout"
fi
echo "TX_HASH=$TX"

# ---- Step 2.5: WAIT FOR INDEX ----
echo
echo "=== WAIT FOR INDEX ==="
echo "Waiting for facilitator index to see tx=$TX (max ${POLL_MAX_SECS}s)..."

T_INDEX_START="$(now_ms)"

POLL_INTERVAL_MS="$(secs_to_ms "$POLL_INTERVAL_SECS")"
DOUBLE_TAP_DELAY_MS="$(secs_to_ms "$DOUBLE_TAP_DELAY_SECS")"
MAX_WAIT_MS="$(( POLL_MAX_SECS * 1000 ))"

start_ms="$(now_ms)"
deadline_ms="$(( start_ms + MAX_WAIT_MS ))"

found="0"
polls=0
last_snapshot_ms="$start_ms"

IDX_URL="$CRP/v1/crp/plt/search?network=concordium:testnet&txHash=$TX&limit=1"

idx_resp=""
index_try_match() {
  printf '%s' "$idx_resp" > "$IDX_TMP_JSON"
  "$JQ_BIN" -e --arg tx "$TX" '
    (.events // []) | any(
      .tx_hash == $tx
      or .txHash == $tx
      or .transaction_hash == $tx
      or .transactionHash == $tx
    )
  ' "$IDX_TMP_JSON_WIN" >/dev/null 2>&1
}

while (( $(now_ms) < deadline_ms )); do
  polls=$((polls + 1))
  idx_resp="$(curl -sS "$IDX_URL" | tr -d '\r' || true)"

  if index_try_match; then
    found="1"
    printf '%s' "$idx_resp" > "$IDX_JSON"
    break
  fi

  # Double-tap: quick repoll to reduce boundary tax
  if [[ "$DOUBLE_TAP_DELAY_MS" -gt 0 ]]; then
    double_tap_sleep "$DOUBLE_TAP_DELAY_SECS"
    idx_resp="$(curl -sS "$IDX_URL" | tr -d '\r' || true)"
    if index_try_match; then
      found="1"
      printf '%s' "$idx_resp" > "$IDX_JSON"
      break
    fi
  fi

  # periodic snapshot every ~10s (based on wall-clock)
  now_loop_ms="$(now_ms)"
  if (( now_loop_ms - last_snapshot_ms >= 10000 )); then
    elapsed_ms="$(( now_loop_ms - start_ms ))"
    echo "  still waiting... ($(awk -v ms="$elapsed_ms" 'BEGIN{printf "%.1f", ms/1000.0}')s)"
    printf '%s' "$idx_resp" > "$IDX_JSON"
    last_snapshot_ms="$now_loop_ms"
  fi

  sleep "$POLL_INTERVAL_SECS"
done

T_INDEX_END="$(now_ms)"
print_timing "index_wait" "$T_INDEX_START" "$T_INDEX_END"

if [[ "$found" != "1" ]]; then
  echo "---- last index poll ----"
  printf '%s' "$idx_resp" > "$IDX_JSON" || true
  cat "$IDX_JSON" || true
  die "timed out waiting for tx to appear in /v1/crp/plt/search (tx=$TX)"
fi

echo "Index OK (tx visible)"

# ---- Step 3: Fulfill ----
echo
echo "=== FULFILL ==="
T_FULFILL_START="$(now_ms)"

FULFILL_OK="0"
for attempt in $(seq 1 "$FULFILL_MAX_ATTEMPTS"); do
  if "$JQ_BIN" -c --arg tx "$TX" '. + {txHash:$tx}' "$PAYMENT_REQ_JSON_WIN" \
    | curl -fsS -X POST "$CRP/v1/crp/payments/fulfill" \
        -H 'content-type: application/json' \
        -d @- \
    | tee "$FULFILL_RESP_JSON" \
    | "$JQ_BIN" . >/dev/null; then

    if "$JQ_BIN" -e '.ok == true' "$FULFILL_RESP_JSON_WIN" >/dev/null 2>&1; then
      FULFILL_OK="1"
      break
    fi

    reason="$("$JQ_BIN" -r '.reason // ""' "$FULFILL_RESP_JSON_WIN" 2>/dev/null || true)"
    [[ -n "$reason" ]] && echo "Fulfill reason: $reason"
  else
    echo "Fulfill HTTP error (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  fi

  echo "Fulfill not ready yet (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  backoff_sleep "$attempt"
done

T_FULFILL_END="$(now_ms)"
print_timing "fulfill" "$T_FULFILL_START" "$T_FULFILL_END"

[[ "$FULFILL_OK" == "1" ]] || {
  echo "---- last fulfill response ----"
  cat "$FULFILL_RESP_JSON" || true
  die "fulfill did not return ok:true after retries"
}
echo "Fulfill OK"

# ---- Step 4: Poll for JWS ----
echo
echo "=== POLL FOR RECEIPT ==="
T_RECEIPT_START="$(now_ms)"

start_ms="$(now_ms)"
deadline_ms="$(( start_ms + MAX_WAIT_MS ))"
attempt=0
JWS=""

SEARCH_URL="$CRP/v1/crp/payments/search?merchantId=$MERCHANT&nonce=$CRP_NONCE&status=fulfilled&limit=1"
search_resp=""
last_snapshot_ms="$start_ms"

receipt_try_extract() {
  printf '%s' "$search_resp" > "$SEARCH_TMP_JSON"
  JWS="$("$JQ_BIN" -r '.matches[0].receipt.jws // ""' "$SEARCH_TMP_JSON_WIN" 2>/dev/null || true)"
  [[ -n "${JWS:-}" && "${JWS:-}" != "null" ]]
}

while (( $(now_ms) < deadline_ms )); do
  attempt=$((attempt + 1))
  search_resp="$(curl -sS "$SEARCH_URL" | tr -d '\r' || true)"

  if receipt_try_extract; then
    printf '%s' "$search_resp" > "$SEARCH_JSON"
    break
  fi

  if [[ "$DOUBLE_TAP_DELAY_MS" -gt 0 ]]; then
    double_tap_sleep "$DOUBLE_TAP_DELAY_SECS"
    search_resp="$(curl -sS "$SEARCH_URL" | tr -d '\r' || true)"
    if receipt_try_extract; then
      printf '%s' "$search_resp" > "$SEARCH_JSON"
      break
    fi
  fi

  now_loop_ms="$(now_ms)"
  if (( now_loop_ms - last_snapshot_ms >= 5000 )); then
    echo "Waiting for receipt... (${attempt} polls)"
    printf '%s' "$search_resp" > "$SEARCH_JSON"
    last_snapshot_ms="$now_loop_ms"
  fi

  sleep "$POLL_INTERVAL_SECS"
done

T_RECEIPT_END="$(now_ms)"
print_timing "receipt_wait" "$T_RECEIPT_START" "$T_RECEIPT_END"

[[ -n "${JWS:-}" && "${JWS:-}" != "null" ]] || {
  echo "---- last search ----"
  printf '%s' "$search_resp" > "$SEARCH_JSON" || true
  cat "$SEARCH_JSON" || true
  die "timed out waiting for receipt.jws (POLL_MAX_SECS=$POLL_MAX_SECS)"
}

echo "$JWS" | awk -F. '{print "JWS parts:", NF}' | grep -q "3" || die "receipt.jws not a compact JWS"

# ---- Step 5: Redeem ----
echo
echo "=== REDEEM (PROXY) ==="
T_REDEEM_START="$(now_ms)"

REDEEM_URL="$GW$GATED_PATH?nonce=$CRP_NONCE"
curl -fsS -i "$REDEEM_URL" -H "x402-receipt: $JWS" | tr -d '\r' > "$REDEEM_RESP"

T_REDEEM_END="$(now_ms)"
print_timing "redeem" "$T_REDEEM_START" "$T_REDEEM_END"

if ! awk 'NR==1{print}' "$REDEEM_RESP" | grep -qE 'HTTP/[0-9.]+ 200'; then
  echo "---- redeem response (first 60 lines) ----"
  sed -n '1,60p' "$REDEEM_RESP"
  die "redeem did not return HTTP 200"
fi

if ! grep -q 'UPSTREAM_OK' "$REDEEM_RESP"; then
  echo "---- redeem response (first 80 lines) ----"
  sed -n '1,80p' "$REDEEM_RESP"
  die "redeem response missing UPSTREAM_OK (proxy did not forward or upstream not running)"
fi

method_upper="$(printf '%s' "${METHOD_OVERRIDE:-GET}" | tr '[:lower:]' '[:upper:]')"
if ! grep -q "UPSTREAM_OK ${method_upper} ${RESOURCE_PATH}" "$REDEEM_RESP"; then
  if ! grep -q "UPSTREAM_OK ${method_upper} " "$REDEEM_RESP"; then
    echo "---- redeem response (first 80 lines) ----"
    sed -n '1,80p' "$REDEEM_RESP"
    die "redeem response did not look like upstream echo (unexpected body)"
  fi
fi

echo
echo "BOOM ✅  proxy paid resource unlocked"

T_SCRIPT_END="$(now_ms)"
print_timing "total_script" "$T_SCRIPT_START" "$T_SCRIPT_END"
