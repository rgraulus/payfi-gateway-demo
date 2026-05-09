#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS on Windows can rewrite paths unexpectedly.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://localhost:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
DB_CONTAINER="${DB_CONTAINER:-xcf-pg}"
DB_NAME="${DB_NAME:-transaction-outcome}"
DB_USER="${DB_USER:-postgres}"

WALLET_PATH="${WALLET_PATH:-./keys/wallet.export}"
TOKEN_ID="${TOKEN_ID:-EUDemo}"

POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"
FULFILL_MAX_ATTEMPTS="${FULFILL_MAX_ATTEMPTS:-5}"

WORKDIR="${WORKDIR:-.demo-prepared-agent-gated-e2e}"

# Prepared-agent defaults.
# Use a CAIP-10-shaped subject when possible:
#   ccd:<genesis-hash>:<account-or-agent-subject>
AGENT_REGION="${AGENT_REGION:-EU}"
AGENT_AGE_OVER="${AGENT_AGE_OVER:-21}"
AGENT_SUBJECT_ACCOUNT_ID="${AGENT_SUBJECT_ACCOUNT_ID:-ccd:4221332d34e1694168c2a0c0b3fd0f27:demo-agent}"
AGENT_ISSUER="${AGENT_ISSUER:-demo-prepared-agent}"

mkdir -p "$WORKDIR"

cleanup() {
  rm -f \
    "$WORKDIR"/gated-headers.txt \
    "$WORKDIR"/gated-body.json \
    "$WORKDIR"/gated-pr.json \
    "$WORKDIR"/auth-positive.json \
    "$WORKDIR"/auth-positive-response.txt \
    "$WORKDIR"/crp-create.json \
    "$WORKDIR"/plt-search.json \
    "$WORKDIR"/payments-search-all.json \
    "$WORKDIR"/fulfill-response.txt \
    "$WORKDIR"/redeem-response.txt
}
trap cleanup EXIT

say() {
  echo
  echo ">>> $*"
}

fail() {
  echo
  echo "ERROR: $*" >&2
  exit 1
}

backoff_sleep() {
  local attempt="${1:-1}"
  local secs="$(( 2 ** (attempt-1) ))"
  (( secs < 1 )) && secs=1
  (( secs > BACKOFF_MAX_SECS )) && secs="$BACKOFF_MAX_SECS"
  sleep "$secs"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_cmd curl
require_cmd jq
require_cmd docker
require_cmd npm
require_cmd python
require_cmd base64

[[ -f "$WALLET_PATH" ]] || fail "Wallet file not found at $WALLET_PATH"

echo
echo "============================================================"
echo " Concordium Conditional Access Demo — Prepared Agent E2E"
echo " Scenario: Online alcohol purchase"
echo " Agent mode: prepared authorizationProof + Concordium payment"
echo "============================================================"
echo
echo "Prepared agent defaults"
echo "  Region:           $AGENT_REGION"
echo "  AgeOver:          $AGENT_AGE_OVER"
echo "  SubjectAccountId: $AGENT_SUBJECT_ACCOUNT_ID"
echo "  Issuer:           $AGENT_ISSUER"
echo

say "Issuing gated x402 challenge"
curl -sS -D "$WORKDIR/gated-headers.txt" -o "$WORKDIR/gated-body.json" "$GW/paid-gated" >/dev/null

PR_B64="$(awk -F': ' 'tolower($1)=="payment-required"{print $2}' "$WORKDIR/gated-headers.txt" | tr -d '\r')"
[[ -n "$PR_B64" ]] || fail "Gateway did not return PAYMENT-REQUIRED header"

printf '%s' "$PR_B64" | base64 -d > "$WORKDIR/gated-pr.json"

NONCE="$(jq -r '.nonce' "$WORKDIR/gated-pr.json")"
CONTRACT_ID="$(jq -r '.contractId' "$WORKDIR/gated-pr.json")"
MERCHANT_ID="$(jq -r '.merchantId' "$WORKDIR/gated-pr.json")"
PAY_TO="$(jq -r '.payTo' "$WORKDIR/gated-pr.json")"
AMOUNT="$(jq -r '.amount' "$WORKDIR/gated-pr.json")"
CHAIN_ID="$(jq -r '.chain_id // empty' "$WORKDIR/gated-pr.json")"

[[ -n "$NONCE" && "$NONCE" != "null" ]] || fail "PAYMENT-REQUIRED missing nonce"
[[ -n "$CONTRACT_ID" && "$CONTRACT_ID" != "null" ]] || fail "PAYMENT-REQUIRED missing contractId"
[[ -n "$MERCHANT_ID" && "$MERCHANT_ID" != "null" ]] || fail "PAYMENT-REQUIRED missing merchantId"
[[ -n "$PAY_TO" && "$PAY_TO" != "null" ]] || fail "PAYMENT-REQUIRED missing payTo"
[[ -n "$AMOUNT" && "$AMOUNT" != "null" ]] || fail "PAYMENT-REQUIRED missing amount"

echo "Challenge issued"
echo "  Nonce:      $NONCE"
echo "  ContractId: $CONTRACT_ID"
echo "  ChainId:    ${CHAIN_ID:-<missing>}"
echo "  Amount:     $AMOUNT"
echo "  PayTo:      $PAY_TO"

say "Policy requirements advertised by Gateway"
jq '.policyRequirements' "$WORKDIR/gated-pr.json"

if [[ "$(jq -r '.policyRequirements.required // false' "$WORKDIR/gated-pr.json")" != "true" ]]; then
  fail "Expected policyRequirements.required=true for /paid-gated"
fi

say "Submitting prepared-agent authorizationProof"
jq -n \
  --arg nonce "$NONCE" \
  --arg subject "$AGENT_SUBJECT_ACCOUNT_ID" \
  --arg issuer "$AGENT_ISSUER" \
  --arg region "$AGENT_REGION" \
  --argjson ageOver "$AGENT_AGE_OVER" \
  '{
    nonce: $nonce,
    authorizationProof: {
      type: "agent_attestation_v1",
      nonce: $nonce,
      policyKind: "composite",
      subjectAccountId: $subject,
      issuer: $issuer,
      claims: {
        region: $region,
        ageOver: $ageOver
      },
      signature: "demo-signature-placeholder"
    }
  }' > "$WORKDIR/auth-positive.json"

curl -sS -i -X POST "$GW/paid-gated/redeem" \
  -H 'content-type: application/json' \
  --data-binary @"$WORKDIR/auth-positive.json" \
  | tee "$WORKDIR/auth-positive-response.txt"

grep -q '200 OK' "$WORKDIR/auth-positive-response.txt" || fail "Expected prepared-agent authorizationProof to succeed"
grep -q '"policyStatus":"POLICY_SATISFIED"' "$WORKDIR/auth-positive-response.txt" || fail "Expected POLICY_SATISFIED"
grep -q '"type":"demo_policy_verifier_v1"' "$WORKDIR/auth-positive-response.txt" || fail "Expected verifier audit type"

echo
echo "Result: PREPARED AGENT AUTHORIZATION SATISFIED"

say "Building CRP payment payload"
WORKDIR="$WORKDIR" python - <<'PY'
import json, datetime, os, pathlib
workdir = pathlib.Path(os.environ["WORKDIR"])
pr = json.loads((workdir / "gated-pr.json").read_text())
payload = {
    "merchantId": pr["merchantId"],
    "nonce": pr["nonce"],
    "network": pr["network"],
    "asset": pr["asset"],
    "amount": pr["amount"],
    "payTo": pr["payTo"],
    "expiry": datetime.datetime.utcfromtimestamp(pr["expiresAt"]).replace(microsecond=0).isoformat() + "Z",
    "metadata": {
        "contract": {
            "contractId": pr["contractId"],
            "contractVersion": pr["contractVersion"],
            "isFrozen": pr["isFrozen"],
            "merchantId": pr["merchantId"],
            "resource": pr["resource"],
            "network": pr["network"],
            "asset": pr["asset"],
            "amount": pr["amount"],
            "payTo": pr["payTo"],
            "attestations": pr.get("attestations", []),
            "policyRequired": pr.get("policyRequired"),
            "policyVersion": pr.get("policyVersion"),
            "policyKind": pr.get("policyKind"),
            "chain_id": pr.get("chain_id"),
        }
    }
}
(workdir / "crp-create.json").write_text(json.dumps(payload, indent=2))
print(f"Wrote {workdir}/crp-create.json")
PY

say "Creating Concordium payment record"
CRP_CREATE_RESPONSE="$(curl -sS -i -X POST "$CRP/v1/crp/payments" \
  -H 'content-type: application/json' \
  --data-binary @"$WORKDIR/crp-create.json")"

echo "$CRP_CREATE_RESPONSE"
printf '%s' "$CRP_CREATE_RESPONSE" | grep -q '200 OK' || fail "CRP payment create did not succeed"

say "Submitting Concordium PLT payment"
TX="$(npm run -s payer:plt -- \
  --wallet "$WALLET_PATH" \
  --to "$PAY_TO" \
  --tokenId "$TOKEN_ID" \
  --amount "$AMOUNT" \
  --memo "$NONCE" \
  --wait)"

[[ -n "$TX" ]] || fail "Payer helper did not return a tx hash"
echo "PLT transfer submitted"
echo "  TxHash: $TX"

say "Waiting for indexed transfer"
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
while (( $(date +%s) < deadline )); do
  if curl -sS "$CRP/v1/crp/plt/search?network=concordium:testnet&txHash=$TX&limit=1" \
    | tee "$WORKDIR/plt-search.json" \
    | jq -e --arg tx "$TX" '.events | any(.tx_hash == $tx or .txHash == $tx)' >/dev/null; then
    break
  fi
  sleep "$POLL_INTERVAL_SECS"
done

jq -e --arg tx "$TX" '.events | any(.tx_hash == $tx or .txHash == $tx)' "$WORKDIR/plt-search.json" >/dev/null \
  || fail "Indexed transfer not found before timeout"

jq -e --arg tx "$TX" '{ok, event: (.events[] | select(.tx_hash == $tx or .txHash == $tx))}' "$WORKDIR/plt-search.json"

say "Fulfilling receipt"
FULFILL_OK="0"
for attempt in $(seq 1 "$FULFILL_MAX_ATTEMPTS"); do
  if jq -n \
    --arg tx "$TX" \
    --arg nonce "$NONCE" \
    --slurpfile req "$WORKDIR/crp-create.json" \
    '($req[0] + {txHash:$tx, nonce:$nonce})' \
  | curl -fsS -X POST "$CRP/v1/crp/payments/fulfill" \
      -H 'content-type: application/json' \
      -d @- \
  | tee "$WORKDIR/fulfill-response.txt" \
  | jq . >/dev/null; then
    if jq -e '.ok == true' "$WORKDIR/fulfill-response.txt" >/dev/null 2>&1; then
      FULFILL_OK="1"
      break
    fi
  fi
  echo "Fulfill not ready yet (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  backoff_sleep "$attempt"
done

[[ "$FULFILL_OK" == "1" ]] || fail "CRP fulfill did not succeed"

say "Fetching receipt"
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
RECEIPT_JWS=""
while (( $(date +%s) < deadline )); do
  curl -sS "$CRP/v1/crp/payments/search?merchantId=$MERCHANT_ID&network=concordium:testnet&limit=20" \
  | tee "$WORKDIR/payments-search-all.json" \
  | jq '.matches[] | select(.nonce == "'"$NONCE"'")'

  RECEIPT_JWS="$(jq -r '.matches[] | select(.nonce == "'"$NONCE"'") | .receipt.jws // ""' "$WORKDIR/payments-search-all.json")"
  if [[ -n "$RECEIPT_JWS" && "$RECEIPT_JWS" != "null" ]]; then
    break
  fi
  sleep "$POLL_INTERVAL_SECS"
done

[[ -n "$RECEIPT_JWS" && "$RECEIPT_JWS" != "null" ]] || fail "Could not extract receipt JWS"

say "Redeeming against protected resource"
curl -sS -i "$GW/paid-gated?nonce=$NONCE" \
  -H "x402-receipt: $RECEIPT_JWS" | tee "$WORKDIR/redeem-response.txt"

grep -q '200 OK' "$WORKDIR/redeem-response.txt" || fail "Final redeem did not succeed"

say "Reading final canonical state"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c \
"SELECT nonce, status, release_status, updated_at
 FROM payment_challenges
 WHERE nonce = '$NONCE';"

say "Reading transition chain"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c \
"SELECT
   gst.created_at,
   gst.from_state,
   gst.to_state,
   gst.actor,
   gst.reason_code,
   gst.reason_message
 FROM gateway_state_transitions gst
 JOIN payment_challenges pc
   ON pc.challenge_id = gst.challenge_id
 WHERE pc.nonce = '$NONCE'
 ORDER BY gst.created_at ASC;"

echo
echo "Final result: RELEASED"
echo "Prepared-agent gated E2E demo complete."
