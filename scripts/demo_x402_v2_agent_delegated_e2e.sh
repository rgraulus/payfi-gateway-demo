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
PHASE5_AUTHORIZATION_PROOF_TYPE="${PHASE5_AUTHORIZATION_PROOF_TYPE:-xcf.concordium.authorization.agent-delegated.v1}"

POSITIVE_BUYER_REGION="${POSITIVE_BUYER_REGION:-EU}"
POSITIVE_BUYER_AGE_OVER="${POSITIVE_BUYER_AGE_OVER:-21}"

NEGATIVE_BUYER_REGION="${NEGATIVE_BUYER_REGION:-US}"
NEGATIVE_BUYER_AGE_OVER="${NEGATIVE_BUYER_AGE_OVER:-18}"

POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"
FULFILL_MAX_ATTEMPTS="${FULFILL_MAX_ATTEMPTS:-5}"

WORKDIR="${WORKDIR:-.demo-x402-v2-agent-delegated-e2e}"

mkdir -p "$WORKDIR"

cleanup() {
  rm -f \
    "$WORKDIR"/gateway-health.json \
    "$WORKDIR"/negative-gated-headers.txt \
    "$WORKDIR"/negative-gated-body.json \
    "$WORKDIR"/negative-gated-pr.json \
    "$WORKDIR"/negative-agent-delegated-auth.json \
    "$WORKDIR"/negative-auth-headers.txt \
    "$WORKDIR"/negative-auth-body.json \
    "$WORKDIR"/negative-blocked-headers.txt \
    "$WORKDIR"/negative-blocked-body.json \
    "$WORKDIR"/positive-gated-headers.txt \
    "$WORKDIR"/positive-gated-body.json \
    "$WORKDIR"/positive-gated-pr.json \
    "$WORKDIR"/positive-agent-delegated-auth.json \
    "$WORKDIR"/positive-auth-headers.txt \
    "$WORKDIR"/positive-auth-body.json \
    "$WORKDIR"/positive-crp-create.json \
    "$WORKDIR"/positive-crp-create-headers.txt \
    "$WORKDIR"/positive-crp-create-body.json \
    "$WORKDIR"/positive-plt-search.json \
    "$WORKDIR"/positive-payments-search-all.json \
    "$WORKDIR"/positive-fulfill-response.txt \
    "$WORKDIR"/positive-redeem-headers.txt \
    "$WORKDIR"/positive-redeem-body.json \
    "$WORKDIR"/positive-replay-headers.txt \
    "$WORKDIR"/positive-replay-body.json

  # Remove the generated work directory when it is empty.
  # A caller-supplied WORKDIR containing other files is left untouched.
  rmdir "$WORKDIR" 2>/dev/null || true
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

http_status() {
  local headers="$1"
  awk 'toupper($0) ~ /^HTTP\// { code=$2 } END { print code }' "$headers" | tr -d '\r'
}

header_value() {
  local headers="$1"
  local name="$2"
  awk -F': ' -v wanted="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')" \
    'tolower($1)==wanted { value=$2 } END { gsub(/\r/, "", value); print value }' "$headers"
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
echo " x402 v2 Agent-Delegated E2E Demo — Engineering Autorun"
echo " Scenario: gated online purchase"
echo " Resource: /paid-gated engineering protected resource"
echo " Positive path: buyer satisfies policy, pays, and resource releases"
echo " Negative path: buyer fails policy before payment"
echo "============================================================"
echo
echo "Demo configuration"
echo "  Gateway:                  $GW"
echo "  CRP:                      $CRP"
echo "  DB container:             $DB_CONTAINER"
echo "  TokenId:                  $TOKEN_ID"
echo "  Authorization proof type: $PHASE5_AUTHORIZATION_PROOF_TYPE"
echo "  Delegation verification:  controlled fixture only"
echo "  Agent Registry lookup:    disabled"
echo "  Phase 5 production mode:  disabled"
echo "  Positive buyer:           $POSITIVE_BUYER_REGION / ageOver=$POSITIVE_BUYER_AGE_OVER"
echo "  Negative buyer:           $NEGATIVE_BUYER_REGION / ageOver=$NEGATIVE_BUYER_AGE_OVER"
echo

say "Checking service readiness"
curl -fsS "$GW/healthz" \
  | tee "$WORKDIR/gateway-health.json" >/dev/null \
  || fail "Gateway health check failed at $GW/healthz"

curl -fsS "$CRP/v1/crp/health" >/dev/null \
  || fail "CRP health check failed at $CRP/v1/crp/health"

jq -e \
  --arg proofType "$PHASE5_AUTHORIZATION_PROOF_TYPE" \
  '
    .phase5.agentDelegatedRuntimeEnabled == true and
    .phase5.mode == "controlled_e2e_demo" and
    .phase5.authorizationProofType == $proofType and
    .phase5.cryptographicDelegationVerification == false and
    .phase5.agentRegistryLookupAttempted == false and
    .phase5.productionActivation == false
  ' "$WORKDIR/gateway-health.json" >/dev/null \
  || fail "Gateway Phase 5 controlled runtime is not enabled or honesty flags are invalid"

echo "Service readiness: ok"
echo "Phase 5 controlled runtime enabled: true"
echo "Cryptographic delegation verification: false"
echo "Agent Registry lookup attempted: false"
echo "Phase 5 production activation: false"

issue_challenge() {
  local prefix="$1"

  curl -sS -D "$WORKDIR/$prefix-gated-headers.txt" -o "$WORKDIR/$prefix-gated-body.json" "$GW/paid-gated" >/dev/null

  local status
  status="$(http_status "$WORKDIR/$prefix-gated-headers.txt")"
  [[ "$status" == "402" ]] || fail "$prefix: expected initial /paid-gated response to be 402 PAYMENT-REQUIRED, got $status"

  local pr_b64
  pr_b64="$(header_value "$WORKDIR/$prefix-gated-headers.txt" "payment-required")"
  [[ -n "$pr_b64" ]] || fail "$prefix: Gateway did not return PAYMENT-REQUIRED header"

  printf '%s' "$pr_b64" | base64 -d > "$WORKDIR/$prefix-gated-pr.json"

  jq -e '.nonce and .contractId and .merchantId and .payTo and .amount and .resource.path == "/paid-gated"' \
    "$WORKDIR/$prefix-gated-pr.json" >/dev/null \
    || fail "$prefix: PAYMENT-REQUIRED missing required /paid-gated fields"

  if [[ "$(jq -r '.policyRequirements.required // false' "$WORKDIR/$prefix-gated-pr.json")" != "true" ]]; then
    fail "$prefix: expected policyRequirements.required=true"
  fi

  jq -e \
    --arg proofType "$PHASE5_AUTHORIZATION_PROOF_TYPE" \
    '.policyRequirements.acceptedProofTypes | index($proofType) != null' \
    "$WORKDIR/$prefix-gated-pr.json" >/dev/null \
    || fail "$prefix: Gateway did not advertise the canonical Phase 5 delegated proof type"

  local nonce
  local amount
  local pay_to
  nonce="$(jq -r '.nonce' "$WORKDIR/$prefix-gated-pr.json")"
  amount="$(jq -r '.amount' "$WORKDIR/$prefix-gated-pr.json")"
  pay_to="$(jq -r '.payTo' "$WORKDIR/$prefix-gated-pr.json")"

  echo "$prefix challenge issued"
  echo "  Nonce:  $nonce"
  echo "  Amount: $amount"
  echo "  PayTo:  $pay_to"
}

build_agent_delegated_auth() {
  local prefix="$1"
  local region="$2"
  local age_over="$3"

  npm exec -- ts-node --transpile-only scripts/demo_agent_delegated_authorization_proof.ts \
    --payment-required "$WORKDIR/$prefix-gated-pr.json" \
    --out "$WORKDIR/$prefix-agent-delegated-auth.json" \
    --region "$region" \
    --age-over "$age_over"
}

submit_agent_delegated_auth() {
  local prefix="$1"

  curl -sS -D "$WORKDIR/$prefix-auth-headers.txt" -o "$WORKDIR/$prefix-auth-body.json" \
    -X POST "$GW/paid-gated/redeem" \
    -H 'content-type: application/json' \
    --data-binary @"$WORKDIR/$prefix-agent-delegated-auth.json" >/dev/null

  local status
  status="$(http_status "$WORKDIR/$prefix-auth-headers.txt")"
  echo "$prefix Agent-delegated authorization status: $status"
}

payment_signature_b64() {
  local nonce="$1"
  node -e "process.stdout.write(Buffer.from(JSON.stringify({ nonce: process.argv[1] }), 'utf8').toString('base64'))" "$nonce"
}

say "Negative buyer path — fail before payment"
issue_challenge "negative"
build_agent_delegated_auth "negative" "$NEGATIVE_BUYER_REGION" "$NEGATIVE_BUYER_AGE_OVER"
submit_agent_delegated_auth "negative"

NEGATIVE_AUTH_STATUS="$(http_status "$WORKDIR/negative-auth-headers.txt")"
[[ "$NEGATIVE_AUTH_STATUS" == "403" ]] || fail "negative path expected 403 before payment, got $NEGATIVE_AUTH_STATUS"

jq -e '.ok == false and .policyStatus == "POLICY_FAILED"' "$WORKDIR/negative-auth-body.json" >/dev/null \
  || fail "negative path expected POLICY_FAILED"

jq -e '
  .reason == "age_requirement_not_met" and
  .phase5.cryptographicDelegationVerification == false and
  .phase5.agentRegistryLookupAttempted == false and
  .phase5.productionActivation == false
' "$WORKDIR/negative-auth-body.json" >/dev/null \
  || fail "negative path expected controlled Phase 5 fail-closed audit"

NEGATIVE_NONCE="$(jq -r '.nonce' "$WORKDIR/negative-gated-pr.json")"
NEGATIVE_PAYMENT_SIGNATURE="$(payment_signature_b64 "$NEGATIVE_NONCE")"

curl -sS -D "$WORKDIR/negative-blocked-headers.txt" -o "$WORKDIR/negative-blocked-body.json" \
  "$GW/paid-gated?nonce=$NEGATIVE_NONCE" \
  -H "PAYMENT-SIGNATURE: $NEGATIVE_PAYMENT_SIGNATURE" >/dev/null

NEGATIVE_BLOCKED_STATUS="$(http_status "$WORKDIR/negative-blocked-headers.txt")"
NEGATIVE_PAYMENT_RESPONSE="$(header_value "$WORKDIR/negative-blocked-headers.txt" "payment-response")"

[[ "$NEGATIVE_BLOCKED_STATUS" == "402" ]] || fail "negative protected resource check expected 402, got $NEGATIVE_BLOCKED_STATUS"
[[ -z "$NEGATIVE_PAYMENT_RESPONSE" ]] || fail "negative path must not emit PAYMENT-RESPONSE"
if jq -e '.resource == "secret-data"' "$WORKDIR/negative-blocked-body.json" >/dev/null 2>&1; then
  fail "negative path must not release protected resource"
fi

echo "Negative buyer path result"
echo "  POLICY_FAILED: true"
echo "  payment attempted: false"
echo "  CRP fulfill attempted: false"
echo "  PAYMENT-RESPONSE emitted: false"
echo "  protected resource released: false"

say "Positive buyer path — authorize, pay, settle, release"
issue_challenge "positive"
build_agent_delegated_auth "positive" "$POSITIVE_BUYER_REGION" "$POSITIVE_BUYER_AGE_OVER"
submit_agent_delegated_auth "positive"

POSITIVE_AUTH_STATUS="$(http_status "$WORKDIR/positive-auth-headers.txt")"
[[ "$POSITIVE_AUTH_STATUS" == "200" ]] || fail "positive path expected 200 policy satisfaction, got $POSITIVE_AUTH_STATUS"

jq -e '.ok == true and .policyStatus == "POLICY_SATISFIED"' "$WORKDIR/positive-auth-body.json" >/dev/null \
  || fail "positive path expected POLICY_SATISFIED"
jq -e \
  --arg proofType "$PHASE5_AUTHORIZATION_PROOF_TYPE" \
  '
    .verifier.ok == true and
    .verifier.authorizationProofType == $proofType and
    .verifier.rawProofPrinted == false and
    .verifier.cryptographicDelegationVerification == false and
    .verifier.agentRegistryLookupAttempted == false and
    .verifier.productionActivation == false and
    .phase5.mode == "controlled_e2e_demo" and
    .phase5.cryptographicDelegationVerification == false and
    .phase5.agentRegistryLookupAttempted == false and
    .phase5.productionActivation == false
  ' "$WORKDIR/positive-auth-body.json" >/dev/null \
  || fail "positive path expected controlled agent-delegated authorization honesty markers"

POSITIVE_NONCE="$(jq -r '.nonce' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_MERCHANT_ID="$(jq -r '.merchantId' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_PAY_TO="$(jq -r '.payTo' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_AMOUNT="$(jq -r '.amount' "$WORKDIR/positive-gated-pr.json")"

say "Building CRP payment payload"
WORKDIR="$WORKDIR" python - <<'PY'
import json, datetime, os, pathlib
workdir = pathlib.Path(os.environ["WORKDIR"])
pr = json.loads((workdir / "positive-gated-pr.json").read_text(encoding="utf-8"))
payload = {
    "merchantId": pr["merchantId"],
    "nonce": pr["nonce"],
    "network": pr["network"],
    "asset": pr["asset"],
    "amount": pr["amount"],
    "payTo": pr["payTo"],
    "expiry": datetime.datetime.fromtimestamp(
        pr["expiresAt"],
        datetime.timezone.utc,
    ).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
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
(workdir / "positive-crp-create.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
print("CRP payment payload written")
PY

say "Creating CRP payment record"
curl -sS -D "$WORKDIR/positive-crp-create-headers.txt" -o "$WORKDIR/positive-crp-create-body.json" \
  -X POST "$CRP/v1/crp/payments" \
  -H 'content-type: application/json' \
  --data-binary @"$WORKDIR/positive-crp-create.json" >/dev/null

POSITIVE_CRP_CREATE_STATUS="$(http_status "$WORKDIR/positive-crp-create-headers.txt")"
[[ "$POSITIVE_CRP_CREATE_STATUS" == "200" ]] || fail "CRP payment create expected 200, got $POSITIVE_CRP_CREATE_STATUS"

say "Submitting Concordium PLT payment"
TX="$(npm run -s payer:plt -- \
  --wallet "$WALLET_PATH" \
  --to "$POSITIVE_PAY_TO" \
  --tokenId "$TOKEN_ID" \
  --amount "$POSITIVE_AMOUNT" \
  --memo "$POSITIVE_NONCE" \
  --wait)"

[[ -n "$TX" ]] || fail "Payer helper did not return a tx hash"
echo "PLT transfer submitted"
echo "  TxHash: $TX"

say "Waiting for indexed transfer"
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
while (( $(date +%s) < deadline )); do
  if curl -sS "$CRP/v1/crp/plt/search?network=concordium:testnet&txHash=$TX&limit=1" \
    | tee "$WORKDIR/positive-plt-search.json" >/dev/null; then
    if jq -e --arg tx "$TX" '.events | any(.tx_hash == $tx or .txHash == $tx)' "$WORKDIR/positive-plt-search.json" >/dev/null; then
      break
    fi
  fi
  sleep "$POLL_INTERVAL_SECS"
done

jq -e --arg tx "$TX" '.events | any(.tx_hash == $tx or .txHash == $tx)' "$WORKDIR/positive-plt-search.json" >/dev/null \
  || fail "Indexed transfer not found before timeout"

echo "Indexed transfer found: true"

say "Fulfilling CRP receipt"
FULFILL_OK="0"
for attempt in $(seq 1 "$FULFILL_MAX_ATTEMPTS"); do
  if jq -n \
    --arg tx "$TX" \
    --arg nonce "$POSITIVE_NONCE" \
    --slurpfile req "$WORKDIR/positive-crp-create.json" \
    '($req[0] + {txHash:$tx, nonce:$nonce})' \
  | curl -fsS -X POST "$CRP/v1/crp/payments/fulfill" \
      -H 'content-type: application/json' \
      -d @- \
  | tee "$WORKDIR/positive-fulfill-response.txt" >/dev/null; then
    if jq -e '.ok == true' "$WORKDIR/positive-fulfill-response.txt" >/dev/null 2>&1; then
      FULFILL_OK="1"
      break
    fi
  fi
  echo "Fulfill not ready yet (attempt $attempt/$FULFILL_MAX_ATTEMPTS). Backing off..."
  backoff_sleep "$attempt"
done

[[ "$FULFILL_OK" == "1" ]] || fail "CRP fulfill did not succeed"
echo "CRP fulfill ok: true"

say "Fetching receipt JWS"
deadline="$(( $(date +%s) + POLL_MAX_SECS ))"
RECEIPT_JWS=""
while (( $(date +%s) < deadline )); do
  curl -sS "$CRP/v1/crp/payments/search?merchantId=$POSITIVE_MERCHANT_ID&network=concordium:testnet&limit=20" \
    | tee "$WORKDIR/positive-payments-search-all.json" >/dev/null

  RECEIPT_JWS="$(jq -r '.matches[] | select(.nonce == "'"$POSITIVE_NONCE"'") | .receipt.jws // ""' "$WORKDIR/positive-payments-search-all.json")"
  if [[ -n "$RECEIPT_JWS" && "$RECEIPT_JWS" != "null" ]]; then
    break
  fi
  sleep "$POLL_INTERVAL_SECS"
done

[[ -n "$RECEIPT_JWS" && "$RECEIPT_JWS" != "null" ]] || fail "Could not extract receipt JWS"
echo "Receipt JWS present: true"
echo "Raw receipt JWS printed: false"

say "Redeeming against protected resource"
curl -sS -D "$WORKDIR/positive-redeem-headers.txt" -o "$WORKDIR/positive-redeem-body.json" \
  "$GW/paid-gated?nonce=$POSITIVE_NONCE" \
  -H "x402-receipt: $RECEIPT_JWS" >/dev/null

POSITIVE_REDEEM_STATUS="$(http_status "$WORKDIR/positive-redeem-headers.txt")"
POSITIVE_PAYMENT_RESPONSE="$(header_value "$WORKDIR/positive-redeem-headers.txt" "payment-response")"

[[ "$POSITIVE_REDEEM_STATUS" == "200" ]] || fail "positive final redeem expected 200, got $POSITIVE_REDEEM_STATUS"
[[ -n "$POSITIVE_PAYMENT_RESPONSE" ]] || fail "positive final redeem must emit PAYMENT-RESPONSE"
jq -e '.ok == true and .paid == true and .resource == "secret-data"' "$WORKDIR/positive-redeem-body.json" >/dev/null \
  || fail "positive final redeem must release engineering protected resource"

echo "Positive buyer path result"
echo "  POLICY_SATISFIED: true"
echo "  receipt JWS present: true"
echo "  PAYMENT-RESPONSE emitted: true"
echo "  raw PAYMENT-RESPONSE printed: false"
echo "  protected resource released: true"
echo "  protected resource value: secret-data"

say "Checking replay / second use"
curl -sS -D "$WORKDIR/positive-replay-headers.txt" -o "$WORKDIR/positive-replay-body.json" \
  "$GW/paid-gated?nonce=$POSITIVE_NONCE" \
  -H "x402-receipt: $RECEIPT_JWS" >/dev/null

POSITIVE_REPLAY_STATUS="$(http_status "$WORKDIR/positive-replay-headers.txt")"
POSITIVE_REPLAY_PAYMENT_RESPONSE="$(header_value "$WORKDIR/positive-replay-headers.txt" "payment-response")"

[[ "$POSITIVE_REPLAY_STATUS" == "402" ]] || fail "positive replay expected 402, got $POSITIVE_REPLAY_STATUS"
[[ -z "$POSITIVE_REPLAY_PAYMENT_RESPONSE" ]] || fail "positive replay must not emit PAYMENT-RESPONSE"
if jq -e '.resource == "secret-data"' "$WORKDIR/positive-replay-body.json" >/dev/null 2>&1; then
  fail "positive replay must not release protected resource"
fi

echo "Replay blocked: true"

say "Reading final canonical state"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c \
"SELECT nonce, status, release_status, updated_at
 FROM payment_challenges
 WHERE nonce IN ('$NEGATIVE_NONCE', '$POSITIVE_NONCE')
 ORDER BY updated_at ASC;"

say "Reading positive transition chain"
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
 WHERE pc.nonce = '$POSITIVE_NONCE'
 ORDER BY gst.created_at ASC;"

echo
echo "============================================================"
echo "Final result: x402 v2 Agent-Delegated E2E demo complete"
echo "  Negative buyer path: failed before payment"
echo "  Positive buyer path: released engineering protected resource"
echo "  Replay: blocked"
echo "============================================================"
