#!/usr/bin/env bash
# Canonical AUTORUN payment flow (local mode) — stable nonce end-to-end
# - Fetch PR from Gateway
# - Create CRP payment (same nonce)
# - Auto-transfer PLT via node helper (prints tx hash)
# - Fulfill + poll for JWS
# - Redeem and print BOOM on success
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://127.0.0.1:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
MERCHANT="${MERCHANT:-demo-merchant}"

# Payer helper + wallet export (kept local, ignored by git)
PAYER_CMD="${PAYER_CMD:-npm run --silent payer:plt --}"
WALLET_EXPORT="${WALLET_EXPORT:-keys/wallet.export}"

# Retry/backoff knobs
POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"

# Default temp dir inside repo (ignored). Override with TMPDIR=... if desired.
TMPDIR="${TMPDIR:-$PWD/.tmp/e2e-autorun-local}"
mkdir -p "$TMPDIR"

PR_JSON="$TMPDIR/pr.json"
PAYMENT_REQ_JSON="$TMPDIR/payment.req.json"
PAYMENT_RESP_JSON="$TMPDIR/payment.resp.json"
FULFILL_RESP_JSON="$TMPDIR/fulfill.resp.json"
PAID_RESP="$TMPDIR/paid.response.txt"
BASE64_ERR="$TMPDIR/base64.err"
SEARCH_JSON="$TMPDIR/search.json"
REDEEM_RESP="$TMPDIR/redeem.response.txt"

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

die() { echo "ERROR: $*" >&2; exit 1; }

# backoff_sleep <attempt>
backoff_sleep() {
  local attempt="${1:-1}"
  local secs="$(( 2 ** (attempt-1) ))"
  (( secs < 1 )) && secs=1
  (( secs > BACKOFF_MAX_SECS )) && secs="$BACKOFF_MAX_SECS"
  sleep "$secs"
}

echo "Fetching PAYMENT-REQUIRED from: $GW/paid"
curl -sS -i "$GW/paid" | tr -d '\r' > "$PAID_RESP"

PR_B64="$(awk -F': ' 'tolower($1)=="payment-required"{print $2}' "$PAID_RESP" | head -n 1)"
[[ -n "${PR_B64:-}" ]] || {
  echo "---- first 60 lines of response ----"
  sed -n '1,60p' "$PAID_RESP"
  die "missing PAYMENT-REQUIRED header from $GW/paid"
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

# Step 1: create CRP payment from THAT SAME PR (same nonce)
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

# Step 2: AUTORUN pay from wallet using payer helper, capture tx hash
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
  2>"$TMPDIR/payer.stderr.txt" | tr -d '\r\n[:space:]' || true)"

if [[ -z "${TX:-}" ]]; then
  echo "---- payer stderr ----"
  sed -n '1,200p' "$TMPDIR/payer.stderr.txt" || true
  die "payer helper did not produce a tx hash on stdout"
fi
echo "TX_HASH=$TX"

# Step 3: fulfill with TX hash (retry a bit in case indexer is catching up)
echo
echo "=== FULFILL ==="
FULFILL_OK="0"
for attempt in 1 2 3 4 5; do
  if "$JQ_BIN" -c --arg tx "$TX" '. + {txHash:$tx}' "$PAYMENT_REQ_JSON_WIN" \
    | curl -sS -X POST "$CRP/v1/crp/payments/fulfill" \
        -H 'content-type: application/json' \
        -d @- \
    | tee "$FULFILL_RESP_JSON" \
    | "$JQ_BIN" . >/dev/null; then

    # If ok true, we are good. Otherwise print reason and retry.
    if "$JQ_BIN" -e '.ok == true' "$FULFILL_RESP_JSON_WIN" >/dev/null 2>&1; then
      FULFILL_OK="1"
      break
    fi

    reason="$("$JQ_BIN" -r '.reason // ""' "$FULFILL_RESP_JSON_WIN" 2>/dev/null || true)"
    [[ -n "$reason" ]] && echo "Fulfill reason: $reason"
  fi

  echo "Fulfill not ready yet (attempt $attempt/5). Backing off..."
  backoff_sleep "$attempt"
done

[[ "$FULFILL_OK" == "1" ]] || {
  echo "---- last fulfill response ----"
  cat "$FULFILL_RESP_JSON" || true
  die "fulfill did not return ok:true after retries"
}
echo "Fulfill OK"

# Step 4: poll for JWS and redeem immediately (avoid expiry)
echo
echo "=== POLL FOR RECEIPT ==="
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
attempt=0
JWS=""

while (( $(date +%s) < deadline )); do
  attempt=$((attempt + 1))
  curl -sS "$CRP/v1/crp/payments/search?merchantId=$MERCHANT&nonce=$CRP_NONCE&status=fulfilled&limit=1" \
    | tr -d '\r' > "$SEARCH_JSON"

  JWS="$("$JQ_BIN" -r '.matches[0].receipt.jws // ""' "$SEARCH_JSON_WIN" 2>/dev/null || true)"
  if [[ -n "${JWS:-}" && "${JWS:-}" != "null" ]]; then
    break
  fi

  # optional: show brief progress every ~5s
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

echo
echo "=== REDEEM ==="
curl -sS -i "$GW/paid?nonce=$CRP_NONCE" -H "x402-receipt: $JWS" | tr -d '\r' > "$REDEEM_RESP"

# Success criteria: HTTP 200 and JSON body contains "paid":true
if ! awk 'NR==1{print}' "$REDEEM_RESP" | grep -qE 'HTTP/[0-9.]+ 200'; then
  echo "---- redeem response (first 60 lines) ----"
  sed -n '1,60p' "$REDEEM_RESP"
  die "redeem did not return HTTP 200"
fi

if ! grep -q '"paid":true' "$REDEEM_RESP"; then
  echo "---- redeem response (first 60 lines) ----"
  sed -n '1,60p' "$REDEEM_RESP"
  die "redeem response missing paid:true"
fi

echo
echo "BOOM ✅  paid resource unlocked"
