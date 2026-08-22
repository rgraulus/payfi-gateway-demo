#!/usr/bin/env bash

set -uo pipefail

ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"
cd "$ROOT"

ENGINEERING_RUNNER="${DEMO4_ENGINEERING_RUNNER:-scripts/demo_x402_v2_agent_registry_demo4_e2e.sh}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)-$$}"
LOG_DIR="${DEMO4_VIEWER_LOG_DIR:-.tmp/demo4-viewer-logs}"
LOG_FILE="$LOG_DIR/demo4-viewer-$RUN_ID.log"
STATE_FILE="$LOG_DIR/demo4-viewer-$RUN_ID.state"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"
: > "$STATE_FILE"

fail() {
  echo
  echo "DEMO FAILED"
  echo "  $*" >&2
  echo "  Engineering log: $LOG_FILE" >&2
  rm -f "$STATE_FILE"
  exit 1
}

mark() {
  grep -qxF "$1" "$STATE_FILE" 2>/dev/null ||
    printf '%s\n' "$1" >> "$STATE_FILE"
}

rule() {
  printf '%s\n' "================================================================"
}

heading() {
  echo
  rule
  echo " $*"
  rule
}

[[ -s "$ENGINEERING_RUNNER" ]] ||
  fail "Demo4 engineering runner not found"

heading "DEMO4 — CONCORDIUM AGENT REGISTRY IN AN x402 PAYMENT FLOW"

cat <<'TEXT'
THE STORY

An AI agent is attempting to purchase a protected digital resource
on behalf of a buyer.

Before payment is allowed, the Gateway must establish that:

  • the buyer genuinely authorized the agent;
  • the agent controls its acting key;
  • that acting key matches the key registered for the agent;
  • the Agent Card is authentic, capable, and fresh;
  • the buyer satisfies the resource policy; and
  • the payment settles successfully.

CORE MESSAGE

Concordium's Agent Registry turns agent identity, acting-key ownership,
Agent Card integrity, capabilities, and freshness into enforceable
authorization gates inside the x402 payment flow.

TEXT

echo
heading "SIX DEMONSTRATED PATHS"

cat <<'TEXT'
PATH 1 OF 6 — INVALID BUYER AUTHORIZATION
PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION
PATH 3 OF 6 — REGISTERED ACTING-KEY MISMATCH
PATH 4 OF 6 — INVALID OR TAMPERED AGENT CARD
PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER
PATH 6 OF 6 — VALID REGISTERED AGENT + ELIGIBLE BUYER
TEXT

echo
heading "ACTUAL ENGINEERING EXECUTION STARTS HERE"

cat <<'TEXT'
The results below are produced by the actual Demo4 engineering flow.
Paths 1–5 execute fail-closed authorization cases.
Path 6 executes the live Concordium Testnet payment lifecycle.
TEXT

bash "$ENGINEERING_RUNNER" 2>&1 |
while IFS= read -r line || [[ -n "$line" ]]
do
  printf '%s\n' "$line" >> "$LOG_FILE"

  case "$line" in
    "DEMO4_PAYER_CONTINUATION_READY=true")
      mark payer_continuation_ready
      ;;

    "DEMO4_OFFLINE_PATH1_INVALID_BUYER_CONTRACT=true")
      mark path1_presented
      echo
      echo "PATH 1 OF 6 — INVALID BUYER AUTHORIZATION"
      echo
      echo "  RESULT  REJECTED — buyer signature invalid"
      echo "  EFFECT  Agent Registry and payment not reached"
      ;;

    "DEMO4_OFFLINE_PATH2_INVALID_AGENT_POP_CONTRACT=true")
      mark path2_presented
      echo
      echo "PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION"
      echo
      echo "  RESULT  REJECTED — proof-of-possession invalid"
      echo "  EFFECT  Authorization and payment stop immediately"
      ;;

    "DEMO4_OFFLINE_PATH3_CIS8_ACTING_KEY_MISMATCH_CONTRACT=true")
      mark path3_presented
      echo
      echo "PATH 3 OF 6 — REGISTERED ACTING-KEY MISMATCH"
      echo
      echo "  RESULT  REJECTED — acting key does not match"
      echo "  EFFECT  Payment not attempted"
      ;;

    "DEMO4_OFFLINE_PATH4_AGENT_CARD_TAMPER_CONTRACT=true")
      mark path4_presented
      echo
      echo "PATH 4 OF 6 — INVALID OR TAMPERED AGENT CARD"
      echo
      echo "  RESULT  REJECTED — Agent Card validation failed"
      echo "  EFFECT  Payment not attempted"
      ;;

    "DEMO4_OFFLINE_PATH5_INELIGIBLE_BUYER_CONTRACT=true")
      mark path5_presented
      echo
      echo "PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER"
      echo
      echo "  RESULT  REJECTED — buyer policy not satisfied"
      echo "  EFFECT  Agent authorization passes, but payment is blocked"
      ;;

    "DEMO4_LIVE_CIS8004_EXACT=true")
      mark live_cis8004
      ;;

    "DEMO4_LIVE_CIS8_EXACT=true")
      mark live_cis8
      ;;

    "DEMO4_LIVE_AGENT_CARD_EXACT=true")
      mark live_agent_card
      ;;

    "DEMO4_PATH1_INVALID_BUYER_REJECTED=true")
      mark path1
      ;;

    "DEMO4_PATH2_INVALID_AGENT_POP_REJECTED=true")
      mark path2
      ;;

    "DEMO4_PATH3_CIS8_ACTING_KEY_MISMATCH_REJECTED=true")
      mark path3
      ;;

    "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=true")
      mark path4
      ;;

    "DEMO4_PATH5_INELIGIBLE_BUYER_REJECTED=true")
      mark path5
      ;;

    "DEMO4_PATH6_REGISTERED_AGENT_AUTHORIZED=true")
      mark path6
      echo
      rule
      echo " PATH 6 OF 6 — VALID REGISTERED AGENT + ELIGIBLE BUYER"
      rule
      echo
      echo "  Agent Registry identity:   VERIFIED"
      echo "  CIS-8 acting key:          VERIFIED"
      echo "  Agent Card:                VERIFIED"
      echo "  Buyer policy:              SATISFIED"
      echo
      echo "  [1/6] x402 payment authorized"
      echo
      echo "        Preparing and submitting Testnet payment..."
      ;;

    "DEMO4_PAYMENT_SUBMITTED=true")
      mark payment
      echo "  [2/6] One Concordium Testnet payment submitted"
      echo
      echo "        Waiting for transaction finalization..."
      echo "        Confirming settlement with the Facilitator..."
      ;;

    "DEMO4_PAYMENT_FINALIZED=true")
      mark payment_finalized
      ;;

    "DEMO4_CRP_INDEXED=true")
      mark crp_indexed
      echo "  [3/6] Transaction finalized and settlement observed"
      echo
      echo "        Verifying signed receipt..."
      ;;

    "DEMO4_GATEWAY_OWNED_FULFILL_RELEASE=true")
      mark gateway_owned_fulfill_release
      ;;

    "DEMO4_PAYMENT_RESPONSE_EMITTED=true")
      mark payment_response
      ;;

    "DEMO4_RECEIPT_JWS_PRESENT=true")
      mark receipt
      echo "  [4/6] Signed receipt verified"
      ;;

    "DEMO4_RESOURCE_RELEASED=true")
      mark release
      echo "  [5/6] Protected resource released"
      echo
      echo "        Verifying replay protection..."
      ;;

    "DEMO4_REPLAY_REJECTED=true")
      mark replay
      echo "  [6/6] Replay rejected"
      echo
      echo "  RESULT — SUCCESS"
      ;;

    "DEMO4_PRODUCTION_ACTIVATION=false")
      mark production_false
      ;;
    "DEMO4_PRODUCTION_ACTIVATION=true")
      mark production_true
      ;;
    "DEMO4_COMPLETE=true")
      mark complete
      ;;
  esac
done

ENGINEERING_EXIT=${PIPESTATUS[0]}

(( ENGINEERING_EXIT == 0 )) ||
  fail "underlying engineering runner failed"

if grep -qxF "production_true" "$STATE_FILE"; then
  fail "production activation contradiction detected"
fi

REQUIRED_MARKERS=(
  payer_continuation_ready
  path1_presented
  path2_presented
  path3_presented
  path4_presented
  path5_presented
  live_cis8004
  live_cis8
  live_agent_card
  path1
  path2
  path3
  path4
  path5
  path6
  payment
  payment_finalized
  crp_indexed
  gateway_owned_fulfill_release
  payment_response
  receipt
  release
  replay
  production_false
  complete
)

for marker in "${REQUIRED_MARKERS[@]}"
do
  grep -qxF "$marker" "$STATE_FILE" ||
    fail "required Demo4 evidence marker missing: $marker"
done

PAYMENT_COUNT="$(
  grep -cF "DEMO4_PAYMENT_SUBMITTED=true" "$LOG_FILE" || true
)"

[[ "$PAYMENT_COUNT" == "1" ]] ||
  fail "Expected exactly one payment submission, observed $PAYMENT_COUNT"

heading "DEMO4 COMPLETE"

cat <<'TEXT'
  Unsafe cases rejected:        5 of 5
  Valid case completed:         1 of 1

  Concordium Testnet payments:  1
  Protected-resource releases:  1
  Replay:                       REJECTED
  Production activation:        DISABLED

DEMONSTRATED LIFECYCLE

  Buyer authorization
    -> Agent proof-of-possession
    -> CIS-8004 registered agent identity
    -> CIS-8 acting-key binding
    -> Agent Card integrity / capability / freshness
    -> Buyer policy
    -> Concordium Testnet payment
    -> Settlement and signed receipt
    -> Protected-resource release
    -> Replay rejection
TEXT

echo
echo "DEMO PASSED"

rm -f "$STATE_FILE"
