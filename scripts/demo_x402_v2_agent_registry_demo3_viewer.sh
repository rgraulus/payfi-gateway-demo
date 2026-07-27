#!/usr/bin/env bash

set -uo pipefail

ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "$ROOT"

ENGINEERING_RUNNER="scripts/demo_x402_v2_agent_registry_demo3_e2e.sh"

RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)-$$}"
DEMO3_VIEWER_LOG_DIR="${DEMO3_VIEWER_LOG_DIR:-.tmp/demo3-viewer-logs}"
DEMO3_VIEWER_VERBOSE="${DEMO3_VIEWER_VERBOSE:-false}"
DEMO_PACE_SECONDS="${DEMO_PACE_SECONDS:-0.35}"

LOG_FILE="$DEMO3_VIEWER_LOG_DIR/demo3-viewer-$RUN_ID.log"
STATE_FILE="$DEMO3_VIEWER_LOG_DIR/demo3-viewer-$RUN_ID.state"

mkdir -p "$DEMO3_VIEWER_LOG_DIR"
: > "$LOG_FILE"
: > "$STATE_FILE"

fail() {
  echo
  echo "DEMO FAILED"
  echo "  $*" >&2
  echo "  Detailed engineering log: $LOG_FILE" >&2
  rm -f "$STATE_FILE"
  exit 1
}

pause_demo() {
  if [[ "$DEMO_PACE_SECONDS" != "0" ]]; then
    sleep "$DEMO_PACE_SECONDS"
  fi
}

rule() {
  printf '%s\n' \
    "================================================================"
}

heading() {
  echo
  rule
  echo " $*"
  rule
  pause_demo
}

mark() {
  local key="$1"

  if ! grep -qxF "$key" "$STATE_FILE" 2>/dev/null; then
    printf '%s\n' "$key" >> "$STATE_FILE"
  fi
}

path_result() {
  local path_number="$1"
  local title="$2"
  local testing="$3"
  local expected="$4"
  local observed="$5"
  local importance="$6"

  echo
  echo "PATH $path_number OF 6 — $title"
  echo "  WHAT WE ARE TESTING"
  echo "    $testing"
  echo "  EXPECTED RESULT"
  echo "    $expected"
  echo "  OBSERVED RESULT"
  echo "    $observed"
  echo "  WHY IT MATTERS"
  echo "    $importance"
  pause_demo
}

case "$DEMO3_VIEWER_VERBOSE" in
  true|false)
    ;;

  *)
    fail "DEMO3_VIEWER_VERBOSE must be exactly true or false"
    ;;
esac

if ! [[ "$DEMO_PACE_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  fail "DEMO_PACE_SECONDS must be zero or a positive number"
fi

[[ -s "$ENGINEERING_RUNNER" ]] ||
  fail "The frozen Demo3 engineering runner was not found"

heading "DEMO3 — CONCORDIUM AGENT REGISTRY IN AN x402 PAYMENT FLOW"

cat <<'INTRO'
THE STORY

An AI agent is attempting to purchase a protected digital resource
on behalf of a buyer.

Before payment is allowed, the Gateway must establish that:

  1. the buyer genuinely authorized the agent;
  2. the agent controls its delegated acting key;
  3. that key matches the key registered for the agent;
  4. the Agent Card is authentic, capable, and fresh;
  5. the buyer satisfies the protected-resource policy; and
  6. the payment finalizes successfully.

CORE MESSAGE

Concordium's Agent Registry is not merely an identity directory.
Registry identity, key ownership, metadata integrity, capabilities,
and freshness become enforceable prerequisites inside the x402 flow.
INTRO

pause_demo

heading "WHAT THIS DEMO WILL RUN"

cat <<'PATHS'
  PATH 1 — Invalid buyer signature
           Reject before Agent Registry evaluation or payment.

  PATH 2 — Invalid agent proof-of-possession
           Reject before buyer policy or payment.

  PATH 3 — Acting-key mismatch
           Reject because the executing key is not the registered key.

  PATH 4 — Tampered Agent Card
           Reject because the delivered card fails integrity binding.

  PATH 5 — Valid registered agent, ineligible buyer
           Agent authorization passes, but buyer policy denies payment.

  PATH 6 — Valid registered agent, eligible buyer
           Submit one real Testnet payment, obtain the receipt,
           release the resource, and reject replay.
PATHS

echo
echo "PAYMENT NOTICE"
echo "  Network:                Concordium Testnet"
echo "  Asset:                  EUDemo"
echo "  Amount:                 0.050101 EUDemo"
echo "  Payments in Paths 1–5:  none"
echo "  Payments in Path 6:     exactly one"
echo "  Production activation:  disabled"
echo
echo "EVIDENCE NOTICE"
echo "  Live evidence verifies the deployed CIS-8004 registry-read boundary."
echo "  Controlled evidence supplies the complete CIS-8004, CIS-8, and"
echo "  Agent Card positive and negative matrix."
echo "  Testnet token 0 is not claimed as a complete positive Agent Card."
echo
echo "Detailed engineering evidence will be retained at:"
echo "  $LOG_FILE"

pause_demo

heading "BEGINNING LIVE AND CONTROLLED DEMONSTRATION"

controlled_gateway_count=0

PHASE6_DEMO3_PREFLIGHT_ONLY=false \
bash "$ENGINEERING_RUNNER" 2>&1 |
while IFS= read -r line || [[ -n "$line" ]]
do
  printf '%s\n' "$line" >> "$LOG_FILE"

  if [[ "$DEMO3_VIEWER_VERBOSE" == "true" ]]; then
    printf '  [engineering] %s\n' "$line"
  fi

  case "$line" in
    *"Live token-0 registry smoke passed: true"*)
      mark "live_registry"
      echo
      echo "LIVE REGISTRY GROUNDING — PASSED"
      echo "  The deployed Concordium CIS-8004 registry-read boundary,"
      echo "  pinned module identity, and finalized snapshot were verified."
      pause_demo
      ;;

    *">>> Running controlled six-path PR #304 final acceptance"*)
      echo
      echo "Preparing the six-path authorization matrix..."
      echo "  Controlled fixtures and isolated Gateways are being initialized."
      ;;

    *"payfi-gateway-demo HTTP server listening on http://127.0.0.1:3150"*)
      controlled_gateway_count=$(( controlled_gateway_count + 1 ))

      if (( controlled_gateway_count <= 4 )); then
        echo "  Controlled environment $controlled_gateway_count of 4 ready."
      fi
      ;;

    *"PR304_PATH1_INVALID_BUYER_SIGNATURE_REJECTED=true"*)
      mark "path1"
      path_result \
        "1" \
        "INVALID BUYER SIGNATURE" \
        "Whether a forged buyer delegation can reach Agent Registry evaluation." \
        "Reject before registry evaluation, buyer policy, or payment." \
        "Buyer signature rejected; Agent Registry not reached; payment not attempted." \
        "An agent cannot invent or alter the buyer's delegated authority."
      ;;

    *"PR304_PATH2_INVALID_AGENT_POP_REJECTED=true"*)
      mark "path2"
      path_result \
        "2" \
        "INVALID AGENT PROOF-OF-POSSESSION" \
        "Whether an agent can use a delegated key that it does not control." \
        "Reject before buyer policy or payment." \
        "Agent possession proof rejected; policy not evaluated; payment not attempted." \
        "Delegation is useless unless the acting agent proves control of its key."
      ;;

    *"PR304_PATH3_AGENT_REGISTRY_KEY_MISMATCH_AUDITED=true"*)
      mark "path3"
      path_result \
        "3" \
        "ACTING-KEY MISMATCH" \
        "Whether a valid agent proof can use a key different from the registered key." \
        "Reject at the Agent Registry identity-to-key binding boundary and audit it." \
        "Registered key mismatch rejected; sanitized append-only audit recorded." \
        "The executing key must be the key bound to the registered agent identity."
      ;;

    *"PR304_PATH4_AGENT_CARD_HASH_MISMATCH_AUDITED=true"*)
      mark "path4"
      path_result \
        "4" \
        "TAMPERED AGENT CARD" \
        "Whether modified agent metadata can pass after registry key verification." \
        "Reject when delivered Agent Card bytes do not match the registered hash." \
        "Agent Card integrity mismatch rejected; sanitized audit recorded." \
        "Registered identity and key ownership cannot legitimize altered metadata."
      ;;

    *"PR304_PATH5_INELIGIBLE_BUYER_NO_CONSUMPTION=true"*)
      mark "path5"
      path_result \
        "5" \
        "VALID AGENT, INELIGIBLE BUYER" \
        "Whether Agent Registry authorization can override buyer eligibility policy." \
        "Authorize the agent, deny the buyer, and do not enter payment." \
        "Registry checks passed; buyer policy denied; bounded use and payment remained untouched." \
        "A trustworthy agent does not inherit permission to bypass buyer policy."
      ;;

    *"PR304_PATH6_ELIGIBLE_BUYER_BOUNDED_USE_CONSUMED=true"*)
      mark "path6_authorized"
      echo
      echo "PATH 6 AUTHORIZATION CHECKPOINT — PASSED"
      echo "  Buyer delegation:          verified"
      echo "  Agent proof-of-possession: verified"
      echo "  Registered key binding:    matched"
      echo "  Agent Card integrity:      verified"
      echo "  Required capabilities:     present"
      echo "  Freshness evidence:        accepted"
      echo "  Buyer policy:              satisfied"
      echo "  Bounded use:               consumed once"
      echo
      echo "  The authorized x402 payment continuation may now proceed."
      pause_demo
      ;;

    *"PR304_PHASE6_APPEND_ONLY_AUDIT_RETAINED=true"*)
      mark "audit"
      ;;

    *"Entering explicitly enabled Demo3 live-settlement phase"*)
      mark "payment_phase"
      heading "PATH 6 — AUTHORIZED x402 PAYMENT CONTINUATION"
      echo "All authorization and policy gates have passed."
      echo "The demo will now submit exactly one real Testnet payment."
      pause_demo
      ;;

    *"Wallet prerequisite present: true"*)
      echo
      echo "SETTLEMENT PREPARATION"
      echo "  Preparing the isolated live-settlement environment."
      ;;

    *"Lifecycle storage ready: true"*)
      echo "  [1/4] Delegation lifecycle storage ready."
      ;;

    *"Temporary cryptographic key bundle generated: true"*)
      echo "  [2/4] Ephemeral authorization keys prepared."
      ;;

    *"Controlled Demo3 positive manifest generated: true"*)
      echo "  [3/4] Positive Agent Registry evidence prepared."
      ;;

    *">>> Checking service readiness"*)
      echo "  [4/4] Dedicated Gateway started; checking service readiness."
      ;;

    *">>> LIVE PATH 1 OF 4 - Invalid buyer signature"*)
      echo
      echo "SETTLEMENT SAFETY REVALIDATION"
      echo "  Safety check 1 of 3: invalid buyer signature rejected before payment."
      ;;

    *">>> LIVE PATH 2 OF 4 - Invalid agent proof-of-possession"*)
      echo "  Safety check 2 of 3: invalid agent proof rejected before payment."
      ;;

    *">>> LIVE PATH 3 OF 4 - Authenticated agent with ineligible buyer"*)
      echo "  Safety check 3 of 3: ineligible buyer denied before payment."
      ;;

    *">>> LIVE PATH 4 OF 4 - Authenticated agent with eligible buyer"*)
      echo "  Safety checks complete."
      echo "  Eligible buyer and registered agent accepted."
      echo "  Preparing the one-time x402 payment challenge."
      ;;

    *">>> Building CRP payment payload"*)
      echo "  Preparing the CRP-bound payment payload."
      ;;

    *">>> Creating CRP payment record"*)
      echo "  Creating the one-time CRP payment record."
      ;;

    *">>> Submitting Concordium PLT payment"*)
      echo
      echo "  Submitting 0.050101 EUDemo and waiting for Concordium finalization..."
      ;;

    *"PLT transfer submitted: true"*)
      mark "payment_submitted"
      echo
      echo "  [1/6] Testnet PLT payment submitted and finalization requested."
      pause_demo
      ;;

    *">>> Waiting for indexed transfer"*)
      echo "        Waiting for the CRP indexer to observe the finalized transfer..."
      ;;

    *"Indexed transfer found: true"*)
      mark "payment_indexed"
      echo "  [2/6] Finalized transfer found by the CRP indexer."
      pause_demo
      ;;

    *">>> Fulfilling CRP receipt"*)
      echo "        Requesting CRP fulfillment for the finalized transfer..."
      ;;

    *"CRP fulfill ok: true"*)
      mark "crp_fulfilled"
      echo "  [3/6] Concordium Receipt Protocol payment fulfilled."
      pause_demo
      ;;

    *">>> Fetching receipt JWS"*)
      echo "        Fetching the signed receipt..."
      ;;

    *"Receipt JWS present: true"*)
      mark "receipt_present"
      echo "  [4/6] Receipt obtained; raw receipt material remains hidden."
      pause_demo
      ;;

    *">>> Redeeming against protected resource"*)
      echo "        Redeeming the receipt against the protected resource..."
      ;;

    *"PATH 4 RESULT - PAYMENT FINALIZED AND RESOURCE RELEASED"*)
      mark "resource_released"
      echo "  [5/6] Receipt redeemed and protected resource released."
      pause_demo
      ;;

    *">>> Checking replay / second use"*)
      echo "        Verifying replay protection..."
      ;;

    *"Replay blocked: true"*)
      mark "replay_blocked"
      echo "  [6/6] Replay or second receipt use rejected."
      path_result \
        "6" \
        "VALID AGENT, ELIGIBLE BUYER, SUCCESSFUL PAYMENT" \
        "Whether the complete Agent Registry-authorized x402 lifecycle succeeds." \
        "Authorize, pay once, obtain a receipt, release once, and reject replay." \
        "Payment finalized; CRP fulfilled; receipt redeemed; resource released; replay blocked." \
        "Registry trust becomes an enforceable gate in a real payment transaction."
      ;;

    *">>> Verifying final canonical state"*)
      echo
      echo "  Verifying final canonical state and append-only audit evidence..."
      ;;

    *"Final result: x402 v2 Agent Registry Demo3 complete"*)
      mark "final_result"
      ;;

    *"PR304_CONTROLLED_LIVE_PAYMENT_ACCEPTANCE_PASSED=true"*)
      mark "live_acceptance"
      ;;
  esac
done

ENGINEERING_EXIT=${PIPESTATUS[0]}

if (( ENGINEERING_EXIT != 0 )); then
  echo
  echo "The underlying engineering runner failed."
  echo "Review the retained log:"
  echo "  $LOG_FILE"
  rm -f "$STATE_FILE"
  exit "$ENGINEERING_EXIT"
fi

REQUIRED_MARKERS=(
  "live_registry"
  "path1"
  "path2"
  "path3"
  "path4"
  "path5"
  "path6_authorized"
  "audit"
  "payment_phase"
  "payment_submitted"
  "payment_indexed"
  "crp_fulfilled"
  "receipt_present"
  "resource_released"
  "replay_blocked"
  "final_result"
)

MISSING_MARKERS=0

for marker in "${REQUIRED_MARKERS[@]}"
do
  if ! grep -qxF "$marker" "$STATE_FILE"; then
    echo "ERROR: required viewer evidence marker missing: $marker" >&2
    MISSING_MARKERS=1
  fi
done

PAYMENT_SUBMIT_COUNT="$(
  grep -cF \
    "PLT transfer submitted: true" \
    "$LOG_FILE" \
  || true
)"

[[ "$PAYMENT_SUBMIT_COUNT" == "1" ]] ||
  fail "Expected exactly one payment submission, observed $PAYMENT_SUBMIT_COUNT"

(( MISSING_MARKERS == 0 )) ||
  fail "One or more required Demo3 evidence markers were not observed"

heading "DEMO3 CAPABILITY SUMMARY"

cat <<'SUMMARY'
  [PASS] Live Concordium CIS-8004 registry boundary verified
  [PASS] Invalid buyer authorization rejected before registry and payment
  [PASS] Invalid agent possession proof rejected before policy and payment
  [PASS] Acting-key mismatch rejected and audited
  [PASS] Tampered Agent Card rejected and audited
  [PASS] Registry-valid agent could not override buyer policy
  [PASS] Eligible buyer and registered agent authorized
  [PASS] Exactly one 0.050101 EUDemo Testnet payment submitted
  [PASS] Finalized transfer indexed and CRP fulfilled
  [PASS] Receipt redeemed and protected resource released
  [PASS] Bounded-use authorization consumed once
  [PASS] Replay or second use rejected
  [PASS] Append-only sanitized authorization audit retained
  [PASS] Production activation remained disabled
SUMMARY

echo
echo "DEMO PASSED"
echo
echo "The complete demonstrated lifecycle was:"
echo
echo "  buyer authorization"
echo "    -> agent proof-of-possession"
echo "    -> Agent Registry identity and key binding"
echo "    -> Agent Card integrity, capability, and freshness"
echo "    -> buyer policy"
echo "    -> Concordium Testnet payment"
echo "    -> CRP receipt"
echo "    -> protected-resource release"
echo "    -> replay rejection"
echo
echo "Detailed engineering log:"
echo "  $LOG_FILE"
echo
echo "PR305_DEMO3_VIEWER_PAYMENT_SUBMISSION_COUNT=$PAYMENT_SUBMIT_COUNT"
echo "PR305_DEMO3_VIEWER_PRODUCTION_ACTIVATION=false"
echo "PR305_DEMO3_VIEWER_COMPLETE=true"

rm -f "$STATE_FILE"
