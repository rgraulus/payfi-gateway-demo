#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:3005}"
FACILITATOR_URL="${FACILITATOR_URL:-http://127.0.0.1:8080}"
RESOURCE="${RESOURCE:-/paid}"

# If NONCE is set, we will force the gateway to use it by calling /paid?nonce=...
# Otherwise, we call /paid and read the nonce out of PAYMENT-REQUIRED.
NONCE="${NONCE:-}"

# retry settings for step 3 (gateway can transiently return 402/error before it returns 200)
RETRY_MAX="${RETRY_MAX:-10}"
RETRY_SLEEP_SECS="${RETRY_SLEEP_SECS:-1}"

jq_or_cat() {
  if command -v jq >/dev/null 2>&1; then jq; else cat; fi
}

echo "== Step 1: Request protected resource (expect 402 + PAYMENT-REQUIRED, unless already paid) =="

STEP1_URL="$GATEWAY_URL$RESOURCE"
if [[ -n "$NONCE" ]]; then
  STEP1_URL="$STEP1_URL?nonce=$NONCE"
fi

# Capture headers + body
resp1="$(mktemp)"
hdr1="$(mktemp)"
curl -sS -D "$hdr1" -o "$resp1" "$STEP1_URL" || true
code1="$(awk 'NR==1{print $2}' "$hdr1" 2>/dev/null || echo "")"

payment_required_b64="$(grep -i '^PAYMENT-REQUIRED:' "$hdr1" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
x_payment_required_b64="$(grep -i '^X-PAYMENT-REQUIRED:' "$hdr1" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
payment_required_b64="${payment_required_b64:-$x_payment_required_b64}"

payment_response_b64="$(grep -i '^PAYMENT-RESPONSE:' "$hdr1" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
x_payment_response_b64="$(grep -i '^X-PAYMENT-RESPONSE:' "$hdr1" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
payment_response_b64="${payment_response_b64:-$x_payment_response_b64}"

if [[ "$code1" == "200" ]]; then
  echo "Step 1 returned 200 (already paid)."
  if [[ -n "$payment_response_b64" ]]; then
    echo "$payment_response_b64" | base64 -d 2>/dev/null | jq_or_cat
  else
    cat "$resp1" | jq_or_cat
  fi
  rm -f "$resp1" "$hdr1"
  exit 0
fi

if [[ "$code1" != "402" ]]; then
  echo "Expected 402 or 200 in Step 1, got: ${code1:-unknown}"
  echo "--- headers ---"; cat "$hdr1"
  echo "--- body ---"; cat "$resp1"
  rm -f "$resp1" "$hdr1"
  exit 1
fi

if [[ -z "$payment_required_b64" ]]; then
  echo "ERROR: Step 1 returned 402 but no PAYMENT-REQUIRED header found."
  echo "--- headers ---"; cat "$hdr1"
  echo "--- body ---"; cat "$resp1"
  rm -f "$resp1" "$hdr1"
  exit 1
fi

# Decode PAYMENT-REQUIRED JSON
pr_json="$(echo "$payment_required_b64" | base64 -d 2>/dev/null || true)"
if [[ -z "$pr_json" ]]; then
  echo "ERROR: Could not base64-decode PAYMENT-REQUIRED."
  echo "PAYMENT-REQUIRED(raw)=$payment_required_b64"
  rm -f "$resp1" "$hdr1"
  exit 1
fi

echo "$pr_json" | jq_or_cat

# If NONCE wasn't forced, capture it from PAYMENT-REQUIRED
if [[ -z "$NONCE" ]]; then
  if command -v jq >/dev/null 2>&1; then
    NONCE="$(echo "$pr_json" | jq -r '.nonce')"
  else
    # very rough fallback
    NONCE="$(echo "$pr_json" | sed -n 's/.*"nonce"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  fi
fi

if [[ -z "$NONCE" || "$NONCE" == "null" ]]; then
  echo "ERROR: Could not determine nonce."
  rm -f "$resp1" "$hdr1"
  exit 1
fi

# Pull fields needed for fulfill call from PAYMENT-REQUIRED
if command -v jq >/dev/null 2>&1; then
  MERCHANT_ID="$(echo "$pr_json" | jq -r '.merchantId')"
  NETWORK="$(echo "$pr_json" | jq -r '.network')"
  PAY_TO="$(echo "$pr_json" | jq -r '.payTo')"
  AMOUNT="$(echo "$pr_json" | jq -r '.amount')"
  ASSET_JSON="$(echo "$pr_json" | jq -c '.asset')"
else
  MERCHANT_ID="demo-merchant"
  NETWORK="concordium:testnet"
  PAY_TO=""
  AMOUNT="0.05"
  ASSET_JSON='{"type":"PLT","tokenId":"EUDemo","decimals":6}'
fi

rm -f "$resp1" "$hdr1"

echo
echo "== Step 2: 'Pay' by fulfilling via facilitator (demo path) =="
req2="$(mktemp)"
cat >"$req2" <<JSON
{
  "merchantId": "$MERCHANT_ID",
  "nonce": "$NONCE",
  "network": "$NETWORK",
  "requireEvent": true,
  "asset": $ASSET_JSON,
  "amount": "$AMOUNT",
  "payTo": "$PAY_TO"
}
JSON

cat "$req2" | jq_or_cat
echo

curl -sS "$FACILITATOR_URL/v1/crp/payments/fulfill" \
  -H 'content-type: application/json' \
  -d @"$req2" | jq_or_cat

rm -f "$req2"

echo
echo "== Step 3: Retry resource (expect 200 + PAYMENT-RESPONSE) =="

attempt=1
while true; do
  resp3="$(mktemp)"
  hdr3="$(mktemp)"
  curl -sS -D "$hdr3" -o "$resp3" "$GATEWAY_URL$RESOURCE?nonce=$NONCE" || true
  code3="$(awk 'NR==1{print $2}' "$hdr3" 2>/dev/null || echo "")"

  if [[ "$code3" == "200" ]]; then
    prsp="$(grep -i '^PAYMENT-RESPONSE:' "$hdr3" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
    xprsp="$(grep -i '^X-PAYMENT-RESPONSE:' "$hdr3" | tail -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
    prsp="${prsp:-$xprsp}"

    echo "OK (200) on attempt $attempt"
    echo "--- headers ---"
    sed -n '1,25p' "$hdr3"

    echo
    echo "--- body ---"
    cat "$resp3" | jq_or_cat

    if [[ -n "$prsp" ]]; then
      echo
      echo "--- decoded PAYMENT-RESPONSE ---"
      echo "$prsp" | base64 -d 2>/dev/null | jq_or_cat
    fi

    rm -f "$resp3" "$hdr3"
    break
  fi

  if (( attempt >= RETRY_MAX )); then
    echo "Expected 200, got: ${code3:-unknown} after $RETRY_MAX attempts"
    echo "--- headers ---"; cat "$hdr3"
    echo "--- body ---"; cat "$resp3"
    rm -f "$resp3" "$hdr3"
    exit 1
  fi

  rm -f "$resp3" "$hdr3"
  attempt=$((attempt + 1))
  sleep "$RETRY_SLEEP_SECS"
done
