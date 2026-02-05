#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS on Windows will rewrite "/paid" into "C:/Program Files/Git/paid"
# when invoking Windows binaries (jq.exe, etc.). Disable that globally.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://127.0.0.1:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"

REQUESTED_NONCE="${1:-${NONCE:-e2e-$(date +%s)-$RANDOM}}"

E2E_POLL_SECS="${E2E_POLL_SECS:-180}"          # bumped default; 90s is often too tight for manual payment
E2E_POLL_INTERVAL="${E2E_POLL_INTERVAL:-1}"
E2E_SKIP_HEALTH="${E2E_SKIP_HEALTH:-0}"
E2E_SOFT_FAIL="${E2E_SOFT_FAIL:-0}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required command: $1"; exit 1; }; }
die() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARN:  $*" >&2; }
note() { echo "==> $*"; }

need curl
need jq
need python

# Fix: make urlencode() actually consume stdin reliably under MSYS/Git Bash.
# The prior version *should* work, but we saw ENC_REQ_NONCE become empty in practice.
# This version reads from stdin OR argv[1], so bash pipes are robust.
urlencode() {
  python - "$@" <<'PY'
import sys, urllib.parse
s = ""
if len(sys.argv) > 1 and sys.argv[1] is not None:
    s = sys.argv[1]
else:
    s = sys.stdin.read()
s = (s or "").strip()
print(urllib.parse.quote(s, safe=""))
PY
}

HDRS="./.e2e_hdrs.txt"
BODY="./.e2e_body.txt"
HDRS2="./.e2e_hdrs2.txt"
BODY2="./.e2e_body2.txt"
cleanup() { rm -f "$HDRS" "$BODY" "$HDRS2" "$BODY2" || true; }
trap cleanup EXIT

echo "GW=$GW"
echo "CRP=$CRP"
echo "REQUESTED_NONCE=$REQUESTED_NONCE"
echo "POLL=${E2E_POLL_SECS}s interval=${E2E_POLL_INTERVAL}s"
echo

if [[ "$E2E_SKIP_HEALTH" != "1" ]]; then
  note "0) Health checks"
  echo "-- gateway /healthz"
  curl -sS "$GW/healthz" | jq .
  echo "-- gateway /readyz"
  curl -sS "$GW/readyz" | jq .
  echo "-- facilitator /healthz"
  curl -sS "$CRP/healthz" | jq .
  echo "-- CRP /v1/crp/health"
  curl -sS "$CRP/v1/crp/health" | jq .
  echo "-- CRP /v1/crp/consensus"
  curl -sS "$CRP/v1/crp/consensus" | jq .
  echo
fi

# Use argv mode (more reliable than pipe on MSYS)
ENC_REQ_NONCE="$(urlencode "$REQUESTED_NONCE")"
[[ -n "${ENC_REQ_NONCE:-}" ]] || die "urlencode() produced empty string for REQUESTED_NONCE='$REQUESTED_NONCE'"

note "1) Request paid resource to get PAYMENT-REQUIRED (expects 402)"
rm -f "$HDRS" "$BODY"
HTTP_CODE="$(curl -sS -D "$HDRS" -o "$BODY" -w '%{http_code}' "$GW/paid?nonce=$ENC_REQ_NONCE" || true)"
echo "HTTP=$HTTP_CODE"

REQ_JSON="$(
python - <<'PY'
import base64, json
from pathlib import Path

hdr = Path("./.e2e_hdrs.txt").read_bytes().decode("iso-8859-1", errors="replace")
val = ""
for line in hdr.splitlines():
    if ":" not in line:
        continue
    k, v = line.split(":", 1)
    if k.strip().lower() == "payment-required":
        val = v.strip()
        break

if not val:
    print("")
else:
    raw = base64.b64decode(val)
    obj = json.loads(raw)
    print(json.dumps(obj))
PY
)"

if [[ -z "${REQ_JSON:-}" ]]; then
  echo "--- headers (first 200 lines) ---"; sed -n '1,200p' "$HDRS" || true
  echo "--- body (first 2000 chars) ---"; head -c 2000 "$BODY"; echo
  die "no PAYMENT-REQUIRED header found (expected on 402)"
fi

echo "$REQ_JSON" | jq .

TUPLE_NONCE="$(echo "$REQ_JSON" | jq -r '.nonce')"
[[ -n "$TUPLE_NONCE" && "$TUPLE_NONCE" != "null" ]] || die "PAYMENT-REQUIRED missing nonce"

if [[ "$TUPLE_NONCE" != "$REQUESTED_NONCE" ]]; then
  warn "Gateway issued a different tuple nonce than requested."
  echo "  requested: $REQUESTED_NONCE"
  echo "  tuple:     $TUPLE_NONCE"
  echo
fi

MERCHANT_ID="$(echo "$REQ_JSON" | jq -r '.merchantId')"
METHOD="$(echo "$REQ_JSON" | jq -r '.resource.method')"
PATH_="$(echo "$REQ_JSON" | jq -r '.resource.path')"
NETWORK="$(echo "$REQ_JSON" | jq -r '.network')"
ASSET_TYPE="$(echo "$REQ_JSON" | jq -r '.asset.type')"
TOKEN_ID="$(echo "$REQ_JSON" | jq -r '.asset.tokenId')"
DECIMALS="$(echo "$REQ_JSON" | jq -r '.asset.decimals')"
AMOUNT="$(echo "$REQ_JSON" | jq -r '.amount')"
PAY_TO="$(echo "$REQ_JSON" | jq -r '.payTo')"
CONTRACT_ID="$(echo "$REQ_JSON" | jq -r '.contractId')"
CONTRACT_VERSION="$(echo "$REQ_JSON" | jq -r '.contractVersion')"
IS_FROZEN="$(echo "$REQ_JSON" | jq -r '.isFrozen')"

AMOUNT_RAW="$(python - <<PY
from decimal import Decimal
amt = Decimal("${AMOUNT}")
dec = int("${DECIMALS}")
print(int(amt * (Decimal(10) ** dec)))
PY
)"

echo
echo "Derived tuple:"
echo "  merchantId: $MERCHANT_ID"
echo "  nonce:      $TUPLE_NONCE"
echo "  resource:   $METHOD $PATH_"
echo "  network:    $NETWORK"
echo "  asset:      $ASSET_TYPE tokenId=$TOKEN_ID decimals=$DECIMALS"
echo "  amount:     $AMOUNT  (amountRaw=$AMOUNT_RAW)"
echo "  payTo:      $PAY_TO"
echo "  contractId: $CONTRACT_ID"
echo

[[ "$METHOD" == "GET" && "$PATH_" == "/paid" ]] || die "expected GET /paid, got: $METHOD $PATH_"
[[ "$ASSET_TYPE" == "PLT" ]] || die "expected asset.type=PLT, got: $ASSET_TYPE"

note "2) Create pending CRP payment record"
EXPIRY="2030-01-01T00:00:00.000Z"

# Build payload with python (avoids any jq.exe argument conversion surprises)
CREATE_PAYLOAD="$(
python - <<PY
import json
payload = {
  "merchantId": "${MERCHANT_ID}",
  "nonce": "${TUPLE_NONCE}",
  "network": "${NETWORK}",
  "asset": {"type": "${ASSET_TYPE}", "tokenId": "${TOKEN_ID}", "decimals": int("${DECIMALS}")},
  "amount": "${AMOUNT}",
  "payTo": "${PAY_TO}",
  "expiry": "${EXPIRY}",
  "policy": {},
  "metadata": {
    "contract": {
      "contractId": "${CONTRACT_ID}",
      "contractVersion": "${CONTRACT_VERSION}",
      "isFrozen": bool(str("${IS_FROZEN}").lower() == "true"),
      "merchantId": "${MERCHANT_ID}",
      "resource": {"method": "${METHOD}", "path": "${PATH_}"},
      "network": "${NETWORK}",
      "asset": {"type": "${ASSET_TYPE}", "tokenId": "${TOKEN_ID}", "decimals": int("${DECIMALS}")},
      "amount": "${AMOUNT}",
      "payTo": "${PAY_TO}",
    }
  }
}
print(json.dumps(payload))
PY
)"

CREATE_OUT="$(curl -sS -X POST "$CRP/v1/crp/payments" -H 'content-type: application/json' -d "$CREATE_PAYLOAD")"
echo "$CREATE_OUT" | jq '{ok, reason, payment: {nonce: .payment.nonce, status: .payment.status}}'

# Guard: confirm the stored resource.path is EXACTLY "/paid"
CHECK_PATH="$(curl -sS "$CRP/v1/crp/payments/search?limit=25" \
  | jq -r --arg n "$TUPLE_NONCE" '.matches[] | select(.nonce==$n) | .metadata.contract.resource.path' \
  | head -n 1)"

if [[ "$CHECK_PATH" != "/paid" ]]; then
  die "CRP stored metadata.contract.resource.path='$CHECK_PATH' (expected '/paid'). MSYS path conversion is still happening somewhere."
fi

echo
note "3) Manual payment step"
echo "Send a PLT transfer on Concordium testnet with:"
echo "  tokenId:   $TOKEN_ID"
echo "  decimals:  $DECIMALS"
echo "  amount:    $AMOUNT"
echo "  amountRaw: $AMOUNT_RAW"
echo "  to:        $PAY_TO"
echo
echo "When ready, paste the transaction hash (preferred), or press ENTER to just start polling."
read -r -p "TX hash (hex) [ENTER to skip]: " USER_TX

# Normalize tx a bit (strip whitespace)
USER_TX="$(printf '%s' "${USER_TX:-}" | tr -d '[:space:]')"

MATCH_PAYLOAD="$(python - <<PY
import json
print(json.dumps({
  "merchantId":"${MERCHANT_ID}",
  "nonce":"${TUPLE_NONCE}",
  "network":"${NETWORK}",
  "asset":{"type":"${ASSET_TYPE}","tokenId":"${TOKEN_ID}","decimals":int("${DECIMALS}")},
  "amount":"${AMOUNT}",
  "payTo":"${PAY_TO}",
}))
PY
)"

FULFILL_PAYLOAD_BASE="$(python - <<PY
import json
print(json.dumps({
  "merchantId":"${MERCHANT_ID}",
  "nonce":"${TUPLE_NONCE}",
  "network":"${NETWORK}",
  "asset":{"type":"${ASSET_TYPE}","tokenId":"${TOKEN_ID}","decimals":int("${DECIMALS}")},
  "amount":"${AMOUNT}",
  "payTo":"${PAY_TO}",
}))
PY
)"

# If user provided a tx hash, immediately call fulfill once.
if [[ -n "${USER_TX:-}" ]]; then
  note "3b) Fulfill using provided tx hash (POST /v1/crp/payments/fulfill)"
  # Basic sanity (hex, length >= 16)
  if ! echo "$USER_TX" | grep -Eq '^[0-9a-fA-F]{16,}$'; then
    warn "Provided tx hash doesn't look like hex: '$USER_TX' (continuing anyway)."
  fi

  FULFILL_PAYLOAD="$(python - <<PY
import json
base = json.loads('''$FULFILL_PAYLOAD_BASE''')
base["chain"] = {"transactionHash": "${USER_TX}"}
print(json.dumps(base))
PY
)"
  FULFILL_OUT="$(curl -sS -X POST "$CRP/v1/crp/payments/fulfill" -H 'content-type: application/json' -d "$FULFILL_PAYLOAD" || true)"
  if echo "$FULFILL_OUT" | jq -e . >/dev/null 2>&1; then
    echo "$FULFILL_OUT" | jq '{ok, reason, count, match: {status: .match.status, nonce: .match.nonce}, receiptPresent: (.match.receipt!=null)}'
  else
    warn "Non-JSON fulfill response (will continue polling):"
    echo "$FULFILL_OUT"
  fi
  echo
fi

note "4) Poll CRP until fulfilled (POST /v1/crp/payments/match; and attempt fulfill if pending)"
deadline=$(( $(date +%s) + E2E_POLL_SECS ))
last_out=""
STATUS=""
RECEIPT_JWS=""
TX=""

while true; do
  now=$(date +%s)
  if (( now > deadline )); then break; fi

  OUT="$(curl -sS -X POST "$CRP/v1/crp/payments/match" -H 'content-type: application/json' -d "$MATCH_PAYLOAD" || true)"
  last_out="$OUT"

  if ! echo "$OUT" | jq -e . >/dev/null 2>&1; then
    echo "  [poll] non-JSON/unreachable (waiting...)"
    sleep "$E2E_POLL_INTERVAL"
    continue
  fi

  STATUS="$(echo "$OUT" | jq -r '.match.status // empty')"
  RECEIPT_JWS="$(echo "$OUT" | jq -r '.match.receipt.jws // empty')"
  TX="$(echo "$OUT" | jq -r '.match.receipt.payload.chain.transactionHash // empty')"

  if [[ "$STATUS" == "fulfilled" && -n "$RECEIPT_JWS" ]]; then
    echo "FULFILLED ✅ tx=${TX:-unknown}"
    break
  fi

  # If pending and we have a tx hash (from user or from match receipt payload), try fulfill.
  # This makes the manual flow complete without needing a separate curl by the user.
  if [[ "$STATUS" == "pending" ]]; then
    # Prefer tx hash from user; else use any tx hinted in match response
    TRY_TX="${USER_TX:-}"
    if [[ -z "${TRY_TX:-}" && -n "${TX:-}" ]]; then
      TRY_TX="$TX"
    fi

    if [[ -n "${TRY_TX:-}" ]]; then
      echo "  [poll] status=pending; attempting fulfill with tx=${TRY_TX:0:16}…"
      FULFILL_PAYLOAD="$(python - <<PY
import json
base = json.loads('''$FULFILL_PAYLOAD_BASE''')
base["chain"] = {"transactionHash": "${TRY_TX}"}
print(json.dumps(base))
PY
)"
      _FULFILL_OUT="$(curl -sS -X POST "$CRP/v1/crp/payments/fulfill" -H 'content-type: application/json' -d "$FULFILL_PAYLOAD" || true)"
      # If fulfill worked, next match poll should become fulfilled
    else
      echo "  [poll] status=pending (no tx hash provided yet; waiting...)"
    fi
  else
    echo "  [poll] status=${STATUS:-<none>} (waiting...)"
  fi

  sleep "$E2E_POLL_INTERVAL"
done

if [[ "${STATUS:-}" != "fulfilled" ]]; then
  echo
  warn "did not observe fulfilled within poll window."
  echo "Last match response:"
  echo "$last_out" | jq . || echo "$last_out"
  if [[ "$E2E_SOFT_FAIL" != "1" ]]; then
    die "E2E failed (no fulfill observed). Set E2E_SOFT_FAIL=1 to continue."
  else
    warn "E2E_SOFT_FAIL=1 set: continuing."
  fi
fi

echo
note "5) Fetch paid resource (should be 200 + PAYMENT-RESPONSE)"
ENC_TUPLE_NONCE="$(urlencode "$TUPLE_NONCE")"
[[ -n "${ENC_TUPLE_NONCE:-}" ]] || die "urlencode() produced empty string for TUPLE_NONCE='$TUPLE_NONCE'"

rm -f "$HDRS2" "$BODY2"
HTTP_CODE2="$(curl -sS -D "$HDRS2" -o "$BODY2" -w '%{http_code}' "$GW/paid?nonce=$ENC_TUPLE_NONCE" || true)"
echo "HTTP=$HTTP_CODE2"

RESP_JSON="$(
python - <<'PY'
import base64, json
from pathlib import Path

hdr = Path("./.e2e_hdrs2.txt").read_bytes().decode("iso-8859-1", errors="replace")
val = ""
for line in hdr.splitlines():
    if ":" not in line:
        continue
    k, v = line.split(":", 1)
    if k.strip().lower() == "payment-response":
        val = v.strip()
        break

if not val:
    print("")
else:
    raw = base64.b64decode(val)
    obj = json.loads(raw)
    print(json.dumps(obj))
PY
)"

if [[ -n "${RESP_JSON:-}" ]]; then
  echo "Decoded PAYMENT-RESPONSE:"
  echo "$RESP_JSON" | jq .
else
  warn "No PAYMENT-RESPONSE header found. Body (first 2000 chars):"
  head -c 2000 "$BODY2"; echo
fi

echo
echo "Done."
