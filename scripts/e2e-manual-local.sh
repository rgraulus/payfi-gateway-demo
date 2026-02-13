#!/usr/bin/env bash
# Canonical manual payment flow (local mode) — stable nonce end-to-end
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://127.0.0.1:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
MERCHANT="${MERCHANT:-demo-merchant}"

# Default temp dir inside repo (ignored). Override with TMPDIR=... if desired.
TMPDIR="${TMPDIR:-$PWD/.tmp/e2e-manual-local}"
mkdir -p "$TMPDIR"

PR_JSON="$TMPDIR/pr.json"
PAYMENT_REQ_JSON="$TMPDIR/payment.req.json"
PAYMENT_RESP_JSON="$TMPDIR/payment.resp.json"
FULFILL_RESP_JSON="$TMPDIR/fulfill.resp.json"
PAID_RESP="$TMPDIR/paid.response.txt"
BASE64_ERR="$TMPDIR/base64.err"

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

echo "Fetching PAYMENT-REQUIRED from: $GW/paid"

curl -sS -i "$GW/paid" | tr -d '\r' > "$PAID_RESP"

PR_B64="$(awk -F': ' 'tolower($1)=="payment-required"{print $2}' "$PAID_RESP" | head -n 1)"
if [[ -z "${PR_B64:-}" ]]; then
  echo "ERROR: missing PAYMENT-REQUIRED header from $GW/paid"
  echo "---- first 60 lines of response ----"
  sed -n '1,60p' "$PAID_RESP"
  exit 1
fi

echo "Decoding PR into: $PR_JSON"
rm -f "$PR_JSON" "$BASE64_ERR"
if ! printf '%s' "$PR_B64" | base64 -d > "$PR_JSON" 2>"$BASE64_ERR"; then
  echo "ERROR: base64 -d failed decoding PAYMENT-REQUIRED"
  echo "base64 stderr:"
  cat "$BASE64_ERR" || true
  echo "Header value (first 80 chars): ${PR_B64:0:80}"
  exit 1
fi

[[ -s "$PR_JSON" ]] || { echo "ERROR: PR JSON file not created or empty: $PR_JSON"; exit 1; }

"$JQ_BIN" '{nonce,issuedAt,expiresAt,contractId,resource,network,asset,amount,payTo}' "$PR_JSON_WIN"

PR_NONCE="$("$JQ_BIN" -r '.nonce' "$PR_JSON_WIN")"
[[ -n "$PR_NONCE" && "$PR_NONCE" != "null" ]] || { echo "ERROR: PR nonce missing"; exit 1; }
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

# Guard: prove curl can read the request file
if [[ ! -s "$PAYMENT_REQ_JSON" ]]; then
  echo "ERROR: payment request JSON not created or empty: $PAYMENT_REQ_JSON"
  ls -la "$TMPDIR" || true
  exit 1
fi
echo "Request file ready: $PAYMENT_REQ_JSON (bytes=$(wc -c < "$PAYMENT_REQ_JSON"))"

CREATE_RESP="$(curl -sS -X POST "$CRP/v1/crp/payments" \
  -H 'content-type: application/json' \
  -d @"$PAYMENT_REQ_JSON_WIN")"

echo "$CREATE_RESP" | "$JQ_BIN" .
echo "$CREATE_RESP" > "$PAYMENT_RESP_JSON"

CRP_NONCE="$(echo "$CREATE_RESP" | "$JQ_BIN" -r '.payment.nonce')"
[[ "$CRP_NONCE" == "$PR_NONCE" ]] || {
  echo "ERROR: CRP nonce differs from PR nonce"
  echo "  PR:  $PR_NONCE"
  echo "  CRP: $CRP_NONCE"
  exit 1
}
echo "NONCE=$CRP_NONCE"

# Step 2: pay from wallet (fresh)
echo
echo "=== WALLET PAYMENT INSTRUCTIONS ==="
"$JQ_BIN" -r '"tokenId=\(.asset.tokenId) decimals=\(.asset.decimals) amount=\(.amount) payTo=\(.payTo) network=\(.network) nonce=\(.nonce)"' "$PR_JSON_WIN"
echo
echo "Send the transfer now."
echo

read -r -p "Paste TX hash here and press ENTER: " TX
TX="$(printf '%s' "$TX" | tr -d '[:space:]')"
[[ -n "$TX" ]] || { echo "ERROR: TX hash empty"; exit 1; }

# Step 3: fulfill with TX hash
"$JQ_BIN" -c --arg tx "$TX" '. + {txHash:$tx}' "$PAYMENT_REQ_JSON_WIN" \
| curl -sS -X POST "$CRP/v1/crp/payments/fulfill" \
    -H 'content-type: application/json' \
    -d @- \
| tee "$FULFILL_RESP_JSON" \
| "$JQ_BIN" .

# Step 4: fetch JWS and redeem immediately (avoid expiry)
JWS="$(curl -sS "$CRP/v1/crp/payments/search?merchantId=$MERCHANT&nonce=$CRP_NONCE&status=fulfilled&limit=1" \
  | "$JQ_BIN" -r '.matches[0].receipt.jws')"

echo "$JWS" | awk -F. '{print "JWS parts:", NF}' | grep -q "3" || {
  echo "ERROR: receipt.jws not a compact JWS"
  exit 1
}

curl -iS "$GW/paid?nonce=$CRP_NONCE" -H "x402-receipt: $JWS"
