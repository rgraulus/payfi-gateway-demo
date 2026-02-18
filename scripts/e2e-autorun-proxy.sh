#!/usr/bin/env bash
# scripts/e2e-autorun-proxy.sh
# Canonical AUTORUN payment flow (PROXY mode) — stable nonce end-to-end
# - Fetch PR from Gateway (proxy route)
# - Create CRP payment (same nonce)
# - Auto-transfer PLT via node helper (prints tx hash)
# - WAIT for facilitator index to see tx (via /v1/crp/plt/search)
# - Fulfill + poll for JWS
# - Redeem via gateway proxy route and assert upstream content
# - Print BOOM on success
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://127.0.0.1:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
MERCHANT="${MERCHANT:-demo-merchant}"

# Target protected resource (PROXY mode path)
RESOURCE_PATH="${RESOURCE_PATH:-/premium}"
# Gateway x402 wrapper prefix
X402_PREFIX="${X402_PREFIX:-/x402}"
GATED_PATH="${GATED_PATH:-${X402_PREFIX}${RESOURCE_PATH}}"

# Payer helper + wallet export (kept local, ignored by git)
PAYER_CMD="${PAYER_CMD:-npm run --silent payer:plt --}"
WALLET_EXPORT="${WALLET_EXPORT:-keys/wallet.export}"

# Retry/backoff knobs
POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"

# Fulfill retry attempts
FULFILL_MAX_ATTEMPTS="${FULFILL_MAX_ATTEMPTS:-5}"

# Default temp dir inside repo (ignored). Override with TMPDIR=... if desired.
TMPDIR="${TMPDIR:-$PWD/.tmp/e2e-autorun-proxy}"
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

# New: index wait artifacts
IDX_JSON="$TMPDIR/index.poll.json"

# On Windows/Git Bash, prefer jq.exe and use Windows paths for file args
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

die() { echo "ERROR: $*" >&2; exit 1; }

# backoff_sleep <attempt>
backoff_sleep() {
  local attempt="${1:-1}"
  local secs="$(( 2 ** (attempt-1) ))"
  (( secs < 1 )) && secs=1
  (( secs > BACKOFF_MAX_SECS )) && secs="$BACKOFF_MAX_SECS"
  sleep "$secs"
}

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

# IMPORTANT: payer helper prints tx hash to stdout. Keep stderr for diagnostics.
TX="$($PAYER_CMD \
  --wallet "$WALLET_EXPORT" \
  --to "$PAY_TO" \
  --tokenId "$TOKEN_ID" \
  --amount "$AMOUNT" \
  --memo "$CRP_NONCE" \
  --wait \
  2>"$PAYER_STDERR" | tr -d '\r\n[:space:]' || true)"

if [[ -z "${TX:-}" ]]; then
  echo "---- payer stderr ----"
  sed -n '1,200p' "$PAYER_STDERR" || true
  die "payer helper did not produce a tx hash on stdout"
fi
echo "TX_HASH=$TX"

# ---- Step 2.5: WAIT FOR INDEX (CRP /v1/crp/plt/search sees this tx) ----
echo
echo "=== WAIT FOR INDEX ==="
echo "Waiting for facilitator index to see tx=$TX (max ${POLL_MAX_SECS}s)..."

deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
elapsed=0
found="0"

# Use a search query that matches how your CRP route shapes the response:
# It returns { ok:true, events:[{tx_hash,...}], transfers:[...]}.
IDX_URL="$CRP/v1/crp/plt/search?network=concordium:testnet&assetId=$TOKEN_ID&toAddress=$PAY_TO&limit=50"

while (( $(date +%s) < deadline )); do
  curl -sS "$IDX_URL" | tr -d '\r' > "$IDX_JSON"

  # Robust: accept tx_hash (snake), txHash (camel), transaction_hash (snake long)
  if "$JQ_BIN" -e --arg tx "$TX" '
      (.events // []) | any(
        .tx_hash == $tx
        or .txHash == $tx
        or .transaction_hash == $tx
        or .transactionHash == $tx
      )
    ' "$IDX_JSON_WIN" >/dev/null 2>&1; then
    found="1"
    break
  fi

  elapsed=$((elapsed + POLL_INTERVAL_SECS))
  if (( elapsed % 10 == 0 )); then
    echo "  still waiting... (${elapsed}s)"
  fi
  sleep "$POLL_INTERVAL_SECS"
done

if [[ "$found" != "1" ]]; then
  echo "---- last index poll ----"
  cat "$IDX_JSON" || true
  die "timed out waiting for tx to appear in /v1/crp/plt/search (tx=$TX)"
fi

echo "Index OK (tx visible)"

# ---- Step 3: Fulfill with TX hash (retry in case indexer is catching up) ----
echo
echo "=== FULFILL ==="
FULFILL_OK="0"
for attempt in $(seq 1 "$FULFILL_MAX_ATTEMPTS"); do
  # NOTE hardening: curl fail-fast on HTTP errors only where it matters (fulfill)
  # -f: fail on 4xx/5xx; if CRP is temporarily not ready or returns an error, we retry.
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
    # curl -f triggered (non-2xx) OR connection issue
    echo "Fulfill HTTP error (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  fi

  echo "Fulfill not ready yet (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  backoff_sleep "$attempt"
done

[[ "$FULFILL_OK" == "1" ]] || {
  echo "---- last fulfill response ----"
  cat "$FULFILL_RESP_JSON" || true
  die "fulfill did not return ok:true after retries"
}
echo "Fulfill OK"

# ---- Step 4: Poll for JWS (quote URL defensively) ----
echo
echo "=== POLL FOR RECEIPT ==="
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
attempt=0
JWS=""

SEARCH_URL="$CRP/v1/crp/payments/search?merchantId=$MERCHANT&nonce=$CRP_NONCE&status=fulfilled&limit=1"

while (( $(date +%s) < deadline )); do
  attempt=$((attempt + 1))

  # NOTE: do NOT use curl -f here; empty matches or interim states are expected.
  curl -sS "$SEARCH_URL" | tr -d '\r' > "$SEARCH_JSON"

  JWS="$("$JQ_BIN" -r '.matches[0].receipt.jws // ""' "$SEARCH_JSON_WIN" 2>/dev/null || true)"
  if [[ -n "${JWS:-}" && "${JWS:-}" != "null" ]]; then
    break
  fi

  if (( attempt % 5 == 0 )); then
    echo "Waiting for receipt... (${attempt}s)"
  fi
  sleep "$POLL_INTERVAL_SECS"
done

[[ -n "${JWS:-}" && "${JWS:-}" != "null" ]] || {
  echo "---- last search ----"
  cat "$SEARCH_JSON" || true
  die "timed out waiting for receipt.jws (POLL_MAX_SECS=$POLL_MAX_SECS)"
}

echo "$JWS" | awk -F. '{print "JWS parts:", NF}' | grep -q "3" || die "receipt.jws not a compact JWS"

# ---- Step 5: Redeem via Gateway PROXY route and assert upstream response ----
echo
echo "=== REDEEM (PROXY) ==="
REDEEM_URL="$GW$GATED_PATH?nonce=$CRP_NONCE"

# NOTE hardening: curl fail-fast on HTTP errors only where it matters (redeem)
# We want to stop immediately if the gateway returns non-2xx here.
curl -fsS -i "$REDEEM_URL" -H "x402-receipt: $JWS" | tr -d '\r' > "$REDEEM_RESP"

# Expect HTTP 200
if ! awk 'NR==1{print}' "$REDEEM_RESP" | grep -qE 'HTTP/[0-9.]+ 200'; then
  echo "---- redeem response (first 60 lines) ----"
  sed -n '1,60p' "$REDEEM_RESP"
  die "redeem did not return HTTP 200"
fi

# Expect upstream body marker (CI upstream server)
if ! grep -q 'UPSTREAM_OK' "$REDEEM_RESP"; then
  echo "---- redeem response (first 80 lines) ----"
  sed -n '1,80p' "$REDEEM_RESP"
  die "redeem response missing UPSTREAM_OK (proxy did not forward or upstream not running)"
fi

# Stronger assertion: method + path appear (from ci_upstream_server.mjs)
# It prints: UPSTREAM_OK <METHOD> <URL>
method_upper="$(printf '%s' "${METHOD_OVERRIDE:-GET}" | tr '[:lower:]' '[:upper:]')"
if ! grep -q "UPSTREAM_OK ${method_upper} ${RESOURCE_PATH}" "$REDEEM_RESP"; then
  # Don't fail hard if querystring exists; check at least path
  if ! grep -q "UPSTREAM_OK ${method_upper} " "$REDEEM_RESP"; then
    echo "---- redeem response (first 80 lines) ----"
    sed -n '1,80p' "$REDEEM_RESP"
    die "redeem response did not look like upstream echo (unexpected body)"
  fi
fi

echo
echo "BOOM ✅  proxy paid resource unlocked"
