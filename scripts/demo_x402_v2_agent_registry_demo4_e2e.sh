#!/usr/bin/env bash

set -uo pipefail

ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"
cd "$ROOT"

MODE="${DEMO4_FINAL_E2E_MODE:-inspect}"

IDENTITY_CI="scripts/ci_phase6_agent_registry_identity_key_binding.ts"
CARD_CI="scripts/ci_phase6_agent_registry_card_capability_freshness.ts"
GATING_CI="scripts/ci_phase6_agent_registry_conditional_gating_composition.ts"
D43_RUNNER="scripts/demo_phase6_demo4_d4_3_final_controlled_acceptance.ts"
D43_CI="scripts/ci_phase6_demo4_d4_3_final_controlled_acceptance.ts"
D43_CORE="src/phase6/demo4FinalControlledAcceptance.ts"
PAYER_CONTINUATION="scripts/demo_phase6_demo4_final_payer_continuation.ts"
PLT_TRANSFER="scripts/plt-transfer.ts"
D43_EXECUTION_RUNNER="$D43_RUNNER"

fail() {
  echo "DEMO4_E2E_ERROR=$*" >&2
  exit 1
}

if [[ "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" ]]; then
  [[ -n "${DEMO4_FINAL_E2E_TEST_D43_RUNNER:-}" ]] ||
    fail "test-only mode requires DEMO4_FINAL_E2E_TEST_D43_RUNNER"

  D43_EXECUTION_RUNNER="$DEMO4_FINAL_E2E_TEST_D43_RUNNER"
elif [[ -n "${DEMO4_FINAL_E2E_TEST_D43_RUNNER:-}" ]]; then
  fail "test D4-3 runner override requires DEMO4_FINAL_E2E_TEST_ONLY=true"
fi

if [[
  "${DEMO4_FINAL_E2E_TEST_SKIP_OFFLINE_SUITES:-}" == "true" &&
  "${DEMO4_FINAL_E2E_TEST_ONLY:-}" != "true"
]]; then
  fail "test offline-suite skip requires DEMO4_FINAL_E2E_TEST_ONLY=true"
fi

if [[
  "${DEMO4_FINAL_E2E_TEST_OBSERVER_ONLY:-}" == "true" &&
  "${DEMO4_FINAL_E2E_TEST_ONLY:-}" != "true"
]]; then
  fail "test observer-only mode requires DEMO4_FINAL_E2E_TEST_ONLY=true"
fi

require_file() {
  [[ -s "$1" ]] || fail "required evidence source missing: $1"
}

require_marker() {
  local file="$1"
  local marker="$2"
  local label="$3"
  grep -Fq "$marker" "$file" ||
    fail "offline evidence contract missing: $label"
}

require_output_marker() {
  local output="$1"
  local marker="$2"
  local label="$3"
  grep -Fqx "$marker" <<<"$output" ||
    fail "payer continuation inspect contract missing: $label"
}

run_offline_suite() {
  local label="$1"
  local npm_script="$2"
  local log_file="$3"

  if ! npm run "$npm_script" > "$log_file" 2>&1; then
    echo
    echo "--- $label DIAGNOSTICS ---" >&2
    sed 's/^/  /' "$log_file" >&2 || true
    fail "$label deterministic test suite failed"
  fi
}

validate_demo4_database_handoff() {
  local database_url="${DEMO4_FINAL_E2E_DATABASE_URL:-}"
  local validation_exit=0
  local connectivity_exit=0

  if [[ -z "$database_url" ]]; then
    echo "DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=false"
    echo "DEMO4_E2E_DATABASE_HANDOFF_REASON=missing_database_url"
    echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
    fail "live mode requires DEMO4_FINAL_E2E_DATABASE_URL"
  fi

  DEMO4_E2E_DATABASE_URL_TO_VALIDATE="$database_url" \
    node.exe -e '
const raw =
  process.env.DEMO4_E2E_DATABASE_URL_TO_VALIDATE ?? "";

let parsed;

try {
  parsed = new URL(raw);
} catch {
  process.exit(2);
}

const protocolOk =
  parsed.protocol === "postgres:" ||
  parsed.protocol === "postgresql:";

const database =
  decodeURIComponent(
    parsed.pathname.replace(/^\/+/, ""),
  );

const credentialsPresent =
  decodeURIComponent(parsed.username || "").length > 0 &&
  decodeURIComponent(parsed.password || "").length > 0;

const hostPresent =
  String(parsed.hostname || "").length > 0;

if (
  !protocolOk ||
  database !== "transaction-outcome" ||
  !credentialsPresent ||
  !hostPresent
) {
  process.exit(3);
}
' >/dev/null 2>&1

  validation_exit=$?

  if [[ "$validation_exit" -ne 0 ]]; then
    echo "DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=false"
    echo "DEMO4_E2E_DATABASE_HANDOFF_REASON=invalid_database_url_contract"
    echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
    fail "Demo4 database handoff must explicitly target transaction-outcome"
  fi

  if [[ "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" ]]; then
    echo "DEMO4_E2E_DATABASE_CONNECTIVITY_CHECKED=false"
  else
    DEMO4_E2E_DATABASE_URL_TO_VALIDATE="$database_url" \
      node.exe -e '
const { Pool } = require("pg");

const connectionString =
  process.env.DEMO4_E2E_DATABASE_URL_TO_VALIDATE ?? "";

const pool =
  new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  });

(async () => {
  try {
    const result =
      await pool.query(
        "select current_database() as db",
      );

    if (
      result.rows.length !== 1 ||
      result.rows[0].db !== "transaction-outcome"
    ) {
      process.exitCode = 4;
    }
  } catch {
    process.exitCode = 5;
  } finally {
    await pool.end().catch(() => {});
  }
})();
' >/dev/null 2>&1

    connectivity_exit=$?

    if [[ "$connectivity_exit" -ne 0 ]]; then
      echo "DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=false"
      echo "DEMO4_E2E_DATABASE_HANDOFF_REASON=database_connectivity_failed"
      echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
      fail "Demo4 transaction-outcome database pre-challenge check failed"
    fi

    echo "DEMO4_E2E_DATABASE_CONNECTIVITY_CHECKED=true"
  fi

  export DATABASE_URL="$database_url"

  echo "DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=true"
  echo "DEMO4_E2E_DATABASE_HANDOFF_REASON=ready"
  echo "DEMO4_E2E_DATABASE_TARGET=transaction-outcome"
}

case "$MODE" in
  inspect|offline_evidence|live)
    ;;
  *)
    fail "supported modes are inspect and offline_evidence"
    ;;
esac

if [[ "$MODE" == "live" && "${DEMO4_FINAL_E2E_LIVE_AUTHORIZED:-}" != "true" ]]; then
  echo "DEMO4_LIVE_AUTHORIZATION_REQUIRED=true"
  echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
  echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false"
  echo "DEMO4_LIVE_EXECUTION_PERFORMED=false"
  echo "DEMO4_PAYMENT_SUBMITTED=false"
  echo "DEMO4_RESOURCE_RELEASED=false"
  echo "DEMO4_REPLAY_PROBED=false"
  echo "DEMO4_REPLAY_REJECTED=false"
  echo "DEMO4_PRODUCTION_ACTIVATION=false"
  echo "DEMO4_COMPLETE=false"
  echo "RUNNER_RESULT=BLOCKED_DEMO4_FINAL_E2E_LIVE_NOT_AUTHORIZED"
  exit 2
fi

if [[ "$MODE" == "live" ]]; then
  validate_demo4_database_handoff
fi

for f in \
  "$IDENTITY_CI" \
  "$CARD_CI" \
  "$GATING_CI" \
  "$D43_RUNNER" \
  "$D43_CI" \
  "$D43_CORE" \
  "$PAYER_CONTINUATION"
do
  require_file "$f"
done

echo "=== DEMO4 — x402 AGENT REGISTRY + AGENT CARD E2E ==="
echo "DEMO4_E2E_MODE=$MODE"
echo "DEMO4_E2E_IMPLEMENTATION_STAGE=offline_evidence_execution"
echo "DEMO4_SIX_PATH_PRESENTATION_CONTRACT=true"
echo "DEMO4_D4_3_RUNNER_REUSED=true"
echo "DEMO4_D4_3_RUNNER_MODIFIED=false"

CONTINUATION_INSPECT_OUTPUT="$(
  DEMO4_FINAL_PAYER_CONTINUATION_MODE=inspect \
    node.exe -r ts-node/register/transpile-only \
    "$PAYER_CONTINUATION"
)" || fail "payer continuation inspect invocation failed"

require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "CONTINUATION_CONTRACT=demo4.final.payer-continuation.v1" \
  "continuation_contract"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "CONTINUATION_MODE=inspect" \
  "continuation_inspect_mode"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "MAX_PAYMENT_SUBMISSIONS=1" \
  "continuation_one_payment_budget"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "AUTOMATIC_RETRY=false" \
  "continuation_no_automatic_retry"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "PREFLIGHT_AND_PAYMENT_SAME_PROCESS=true" \
  "continuation_same_process_handoff"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "OPAQUE_PREPARED_RUNTIME_SERIALIZED=false" \
  "continuation_opaque_runtime_not_serialized"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "EXECUTION_AUTHORIZATION_REQUIRED=true" \
  "continuation_execution_authorization_required"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "CONTINUATION_EXECUTED=false" \
  "continuation_not_executed"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "PAYER_WALLET_READ=false" \
  "continuation_wallet_not_read"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "PAYMENT_ATTEMPTED=false" \
  "continuation_payment_not_attempted"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "CRP_FULFILL_CALLED=false" \
  "continuation_crp_fulfill_not_called"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "RESOURCE_RELEASED=false" \
  "continuation_resource_not_released"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "REPLAY_PROBED=false" \
  "continuation_replay_not_probed"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "PRODUCTION_ACTIVATION=false" \
  "continuation_production_false"
require_output_marker "$CONTINUATION_INSPECT_OUTPUT" \
  "RUNNER_RESULT=DEMO4_FINAL_PAYER_CONTINUATION_CONTRACT_READY" \
  "continuation_contract_ready"

echo "DEMO4_PAYER_CONTINUATION_READY=true"
echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false"

BUYER_SIGNATURE_TEST_EXECUTED=false
AGENT_POP_TEST_EXECUTED=false
IDENTITY_TEST_EXECUTED=false
CARD_TEST_EXECUTED=false
GATING_TEST_EXECUTED=false
POLICY_TEST_EXECUTED=false

PATH1_RUNTIME_EVIDENCE=false
PATH2_RUNTIME_EVIDENCE=false
PATH3_RUNTIME_EVIDENCE=false
PATH4_RUNTIME_EVIDENCE=false
PATH5_RUNTIME_EVIDENCE=false
PATHS1_TO_5_RUNTIME_EVIDENCE=false

if [[ "$MODE" == "offline_evidence" || "$MODE" == "live" ]]; then
  if [[
    "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" &&
    "${DEMO4_FINAL_E2E_TEST_SKIP_OFFLINE_SUITES:-}" == "true"
  ]]; then
    echo "DEMO4_E2E_TEST_OFFLINE_SUITES_SKIPPED=true"
  else
    RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)-$$}"
    OFFLINE_LOG_DIR="${DEMO4_OFFLINE_LOG_DIR:-.tmp/demo4-offline-evidence-$RUN_ID}"

    mkdir -p "$OFFLINE_LOG_DIR"

    BUYER_SIGNATURE_LOG="$OFFLINE_LOG_DIR/buyer-signature.log"
    AGENT_POP_LOG="$OFFLINE_LOG_DIR/agent-pop.log"
    IDENTITY_LOG="$OFFLINE_LOG_DIR/identity-key-binding.log"
    CARD_LOG="$OFFLINE_LOG_DIR/card-capability-freshness.log"
    GATING_LOG="$OFFLINE_LOG_DIR/conditional-gating.log"
    POLICY_LOG="$OFFLINE_LOG_DIR/buyer-policy.log"

    # Path 1 — existing Phase 5 buyer-signature verifier seam.
    # Bind Demo4 to the executed one-bit signature mutation result.
    run_offline_suite \
      "BUYER_SIGNATURE" \
      "phase5:buyer-delegation-signature-verifier-seam-test" \
      "$BUYER_SIGNATURE_LOG"

    DEMO4_EVIDENCE_LOG="$BUYER_SIGNATURE_LOG" \
      node.exe -e '
const fs = require("fs");

const raw = fs.readFileSync(
  process.env.DEMO4_EVIDENCE_LOG,
  "utf8",
);

const first = raw.indexOf("{");
const last = raw.lastIndexOf("}");

if (first < 0 || last < first) process.exit(10);

const result = JSON.parse(
  raw.slice(first, last + 1),
);

const testCase =
  (result.cases || []).find(
    (entry) =>
      entry.name === "one-bit signature mutation",
  );

const passed =
  result.ok === true &&
  result.testOnly === true &&
  testCase?.ok === false &&
  testCase?.status === "rejected" &&
  testCase?.reason ===
    "buyer_signature_verification_failed" &&
  testCase?.cryptographicVerificationAttempted ===
    true &&
  testCase?.signatureVerified === false &&
  result.safety?.gatewayCalled === false &&
  result.safety?.crpCalled === false &&
  result.safety?.paymentAttempted === false &&
  result.safety?.protectedResourceReleased === false &&
  result.safety?.productionActivation === false;

process.exit(
  passed ? 0 : 11,
);
' ||
      fail "Path 1 executed buyer-signature evidence did not satisfy the Demo4 contract"

    BUYER_SIGNATURE_TEST_EXECUTED=true
    PATH1_RUNTIME_EVIDENCE=true

    # Path 2 — existing Phase 5 agent proof-of-possession verifier seam.
    # Bind Demo4 to the executed one-bit agent-signature mutation result.
    run_offline_suite \
      "AGENT_PROOF_OF_POSSESSION" \
      "phase5:agent-proof-of-possession-verifier-seam-test" \
      "$AGENT_POP_LOG"

    DEMO4_EVIDENCE_LOG="$AGENT_POP_LOG" \
      node.exe -e '
const fs = require("fs");

const raw = fs.readFileSync(
  process.env.DEMO4_EVIDENCE_LOG,
  "utf8",
);

const first = raw.indexOf("{");
const last = raw.lastIndexOf("}");

if (first < 0 || last < first) process.exit(20);

const result = JSON.parse(
  raw.slice(first, last + 1),
);

const testCase =
  (result.cases || []).find(
    (entry) =>
      entry.name ===
      "one-bit agent-signature mutation fails cryptographically",
  );

const passed =
  result.ok === true &&
  result.testOnly === true &&
  testCase?.ok === true &&
  testCase?.expectedReason ===
    "agent_proof_verification_failed" &&
  testCase?.actualReason ===
    "agent_proof_verification_failed" &&
  testCase?.actualAgentCryptoAttempted === true &&
  testCase?.agentProofOfPossessionVerified ===
    false &&
  testCase?.proofBindingsMatched === true &&
  testCase?.status === "rejected" &&
  result.safety?.gatewayCalled === false &&
  result.safety?.crpCalled === false &&
  result.safety?.paymentAttempted === false &&
  result.safety?.protectedResourceReleased === false &&
  result.safety?.productionActivation === false;

process.exit(
  passed ? 0 : 21,
);
' ||
      fail "Path 2 executed agent-PoP evidence did not satisfy the Demo4 contract"

    AGENT_POP_TEST_EXECUTED=true
    PATH2_RUNTIME_EVIDENCE=true

    # Path 3 — existing Phase 6 CIS-8004 -> CIS-8 identity/key-binding suite.
    #
    # PR301_B2_FINAL_FROZEN_CASES is emitted only after the frozen
    # phase5_raw_key_mismatch -> agent_public_key_mismatch assertion and
    # the remaining final fail-closed cases have completed successfully.
    run_offline_suite \
      "IDENTITY_KEY_BINDING" \
      "phase6:agent-registry-identity-key-binding-test" \
      "$IDENTITY_LOG"

    require_marker \
      "$IDENTITY_LOG" \
      "PR301_B2_FINAL_FROZEN_CASES=true" \
      "executed_path3_identity_key_mismatch_matrix"

    require_marker \
      "$IDENTITY_LOG" \
      '"zeroSideEffects":true' \
      "executed_path3_zero_side_effects"

    IDENTITY_TEST_EXECUTED=true
    PATH3_RUNTIME_EVIDENCE=true

    # Path 4 — existing Phase 6 Agent Card integrity/capability/freshness suite.
    # Use only markers emitted by executed cases; do not inspect source text.
    run_offline_suite \
      "AGENT_CARD_CAPABILITY_FRESHNESS" \
      "phase6:agent-registry-card-capability-freshness-test" \
      "$CARD_LOG"

    require_marker \
      "$CARD_LOG" \
      "PR302_B2D_TRAILING_NEWLINE_SUBSTITUTION_REJECTED=true" \
      "executed_path4_integrity_substitution_rejected"

    require_marker \
      "$CARD_LOG" \
      "PR302_B2C_X402_FALSE_REJECTED=true" \
      "executed_path4_required_capability_rejected"

    require_marker \
      "$CARD_LOG" \
      "PR302_B2B_REVALIDATION_REQUIRED_ZERO_FETCH=true" \
      "executed_path4_revalidation_required"

    require_marker \
      "$CARD_LOG" \
      "PR302_B2A_ZERO_SIDE_EFFECTS=true" \
      "executed_path4_zero_side_effects"

    CARD_TEST_EXECUTED=true
    PATH4_RUNTIME_EVIDENCE=true

    # Phase 6 composition must prove the complete Registry/Card authorization
    # stack can reach its positive authorization handoff. This is composed
    # with the independent Phase 5 buyer-policy denial below for Path 5.
    run_offline_suite \
      "CONDITIONAL_GATING" \
      "phase6:agent-registry-conditional-gating-composition-test" \
      "$GATING_LOG"

    require_marker \
      "$GATING_LOG" \
      "PR303_POSITIVE_COMPOSITION_ALLOWED=true" \
      "executed_path5_registry_authorization_handoff"

    require_marker \
      "$GATING_LOG" \
      "PR303_NEGATIVE_MATRIX_FAILS_CLOSED=true" \
      "executed_conditional_gating_negative_matrix"

    require_marker \
      "$GATING_LOG" \
      "PR303_ZERO_CANONICAL_SIDE_EFFECTS=true" \
      "executed_conditional_gating_zero_side_effects"

    GATING_TEST_EXECUTED=true

    # Path 5 — existing independent Phase 5 policy gate.
    # Exact contract:
    # authorization accepted -> policy evaluated -> US/18 denied against
    # minimum age 21 -> no payment -> no release.
    run_offline_suite \
      "BUYER_POLICY" \
      "phase5:agent-policy-evaluation-integration-test" \
      "$POLICY_LOG"

    DEMO4_EVIDENCE_LOG="$POLICY_LOG" \
      node.exe -e '
const fs = require("fs");

const raw = fs.readFileSync(
  process.env.DEMO4_EVIDENCE_LOG,
  "utf8",
);

const first = raw.indexOf("{");
const last = raw.lastIndexOf("}");

if (first < 0 || last < first) process.exit(30);

const result = JSON.parse(
  raw.slice(first, last + 1),
);

const testCase =
  (result.cases || []).find(
    (entry) =>
      entry.name ===
      "ineligible US buyer policy is denied",
  );

const passed =
  result.ok === true &&
  result.testOnly === true &&
  testCase?.ok === true &&
  testCase?.actualReason ===
    "age_requirement_not_met" &&
  testCase?.status === "denied" &&
  testCase?.authorizationAccepted === true &&
  testCase?.authorizationReason === "accepted" &&
  testCase?.authorizationBindingEvaluated ===
    true &&
  testCase?.policyEvaluated === true &&
  testCase?.policyDecision === "deny" &&
  testCase?.region === "US" &&
  testCase?.ageClaim === 18 &&
  testCase?.requiredMinimumAge === 21 &&
  result.gatewayCalled === false &&
  result.crpCalled === false &&
  result.paymentAttempted === false &&
  result.protectedResourceReleased === false &&
  result.productionActivation === false;

process.exit(
  passed ? 0 : 31,
);
' ||
      fail "Path 5 executed ineligible-buyer policy evidence did not satisfy the Demo4 contract"

    POLICY_TEST_EXECUTED=true
    PATH5_RUNTIME_EVIDENCE=true
  fi
fi

if [[
  "$PATH1_RUNTIME_EVIDENCE" == "true" &&
  "$PATH2_RUNTIME_EVIDENCE" == "true" &&
  "$PATH3_RUNTIME_EVIDENCE" == "true" &&
  "$PATH4_RUNTIME_EVIDENCE" == "true" &&
  "$PATH5_RUNTIME_EVIDENCE" == "true"
]]; then
  PATHS1_TO_5_RUNTIME_EVIDENCE=true
fi

echo "DEMO4_OFFLINE_BUYER_SIGNATURE_TEST_EXECUTED=$BUYER_SIGNATURE_TEST_EXECUTED"
echo "DEMO4_OFFLINE_AGENT_POP_TEST_EXECUTED=$AGENT_POP_TEST_EXECUTED"
echo "DEMO4_OFFLINE_IDENTITY_KEY_BINDING_TEST_EXECUTED=$IDENTITY_TEST_EXECUTED"
echo "DEMO4_OFFLINE_AGENT_CARD_TEST_EXECUTED=$CARD_TEST_EXECUTED"
echo "DEMO4_OFFLINE_CONDITIONAL_GATING_TEST_EXECUTED=$GATING_TEST_EXECUTED"
echo "DEMO4_OFFLINE_BUYER_POLICY_TEST_EXECUTED=$POLICY_TEST_EXECUTED"

echo "DEMO4_OFFLINE_PATH1_INVALID_BUYER_CONTRACT=$PATH1_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_PATH2_INVALID_AGENT_POP_CONTRACT=$PATH2_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_PATH3_CIS8_ACTING_KEY_MISMATCH_CONTRACT=$PATH3_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_PATH4_AGENT_CARD_TAMPER_CONTRACT=$PATH4_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_PATH5_INELIGIBLE_BUYER_CONTRACT=$PATH5_RUNTIME_EVIDENCE"

echo "DEMO4_OFFLINE_PATHS1_TO_5_EXECUTED=$PATHS1_TO_5_RUNTIME_EVIDENCE"

if [[ "$PATHS1_TO_5_RUNTIME_EVIDENCE" == "true" ]]; then
  echo "DEMO4_OFFLINE_PATHS1_TO_5_PAYMENT_SUBMISSIONS=0"
  echo "DEMO4_OFFLINE_PATHS1_TO_5_RESOURCE_RELEASES=0"
else
  echo "DEMO4_OFFLINE_PATHS1_TO_5_PAYMENT_SUBMISSIONS=not_established"
  echo "DEMO4_OFFLINE_PATHS1_TO_5_RESOURCE_RELEASES=not_established"
fi

# Real live Demo4 execution may not proceed without actual executed
# negative-path evidence. The existing synthetic CI-only skip remains
# available solely behind DEMO4_FINAL_E2E_TEST_ONLY=true.
if [[
  "$MODE" == "live" &&
  "${DEMO4_FINAL_E2E_TEST_SKIP_OFFLINE_SUITES:-}" != "true"
]]; then
  [[ "$PATHS1_TO_5_RUNTIME_EVIDENCE" == "true" ]] ||
    fail "live Demo4 requires executed runtime evidence for Paths 1-5"
fi

echo "DEMO4_OFFLINE_CIS8_REVOCATION_FAIL_CLOSED_CONTRACT=$PATH3_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_AGENT_CARD_CAPABILITY_FAIL_CLOSED_CONTRACT=$PATH4_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_AGENT_CARD_REVALIDATION_CONTRACT=$PATH4_RUNTIME_EVIDENCE"
echo "DEMO4_OFFLINE_CONDITIONAL_GATING_FAIL_CLOSED_CONTRACT=$GATING_TEST_EXECUTED"

require_marker "$D43_CORE" \
  "export const DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS" \
  "d43_payment_budget_constant"
require_marker "$D43_CORE" \
  "export const DEMO4_D4_3_AUTOMATIC_RETRY" \
  "d43_automatic_retry_constant"
require_marker "$D43_CORE" \
  '"registered_agent_authorization"' \
  "d43_registered_agent_stage"
require_marker "$D43_CORE" \
  '"payment_submit"' \
  "d43_payment_submit_stage"
require_marker "$D43_CORE" \
  '"replay_rejected"' \
  "d43_replay_rejected_stage"
require_marker "$D43_CI" \
  '"live_execution_complete"' \
  "d43_terminal_orchestration_contract"
require_marker "$D43_RUNNER" \
  "RUNNER_RESULT=STOP_BEFORE_PAYER_WALLET_PREFLIGHT" \
  "d43_current_runner_stop_boundary"

echo "DEMO4_OFFLINE_D43_ONE_SHOT_CONTRACT=true"
echo "DEMO4_OFFLINE_D43_REGISTERED_AGENT_STAGE=true"
echo "DEMO4_OFFLINE_D43_TERMINAL_ACCEPTANCE_CONTRACT=true"
echo "DEMO4_OFFLINE_D43_CURRENT_STOP_BOUNDARY=payer_wallet_preflight"
echo "DEMO4_MAX_PAYMENT_SUBMISSIONS=1"
echo "DEMO4_AUTOMATIC_PAYMENT_RETRY=false"
echo "DEMO4_PRODUCTION_ACTIVATION=false"
echo "DEMO4_OFFLINE_EVIDENCE_READY=true"

# Honesty boundary: inspect/offline evidence is never presented as a live Demo4 run.
if [[ "$MODE" != "live" ]]; then
  echo "DEMO4_LIVE_CIS8004_EXACT=false"
  echo "DEMO4_LIVE_CIS8_EXACT=false"
  echo "DEMO4_LIVE_AGENT_CARD_EXACT=false"
  echo "DEMO4_PATH1_INVALID_BUYER_REJECTED=false"
  echo "DEMO4_PATH2_INVALID_AGENT_POP_REJECTED=false"
  echo "DEMO4_PATH3_CIS8_ACTING_KEY_MISMATCH_REJECTED=false"
  echo "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=false"
  echo "DEMO4_PATH5_INELIGIBLE_BUYER_REJECTED=false"
  echo "DEMO4_PATH6_REGISTERED_AGENT_AUTHORIZED=false"
  echo "DEMO4_LIVE_EXECUTION_PERFORMED=false"
  echo "DEMO4_PAYMENT_SUBMITTED=false"
  echo "DEMO4_RESOURCE_RELEASED=false"
  echo "DEMO4_REPLAY_PROBED=false"
  echo "DEMO4_REPLAY_REJECTED=false"
  echo "DEMO4_COMPLETE=false"
  exit 0
fi

# Prime-time live orchestration. The top-level authorization gate above is
# necessary but not sufficient: every frozen D4-3 capability gate is inherited
# from the caller and remains independently fail-closed.
require_cmd() {
  command -v "$1" >/dev/null 2>&1 ||
    fail "required command missing: $1"
}

file_marker_value() {
  local file="$1"
  local key="$2"

  awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      value=$0
    }
    END { print value }
  ' "$file"
}

require_file_marker_value() {
  local file="$1"
  local key="$2"
  local expected="$3"
  local actual

  actual="$(file_marker_value "$file" "$key")"
  [[ "$actual" == "$expected" ]] ||
    fail "$key expected $expected, got ${actual:-<missing>}"
}

http_status() {
  awk '/^HTTP\// { code=$2 } END { print code }' "$1"
}

header_value() {
  python -c 'from pathlib import Path; import sys; n=sys.argv[2].lower()+":"; vals=[line.split(":",1)[1].strip() for line in Path(sys.argv[1]).read_text(encoding="utf-8",errors="replace").splitlines() if line.lower().startswith(n)]; print(vals[-1] if vals else "")' "$1" "$2"
}

receipt_jws_from_payment_response_headers() {
  python -c 'from pathlib import Path; import base64,json,sys; lines=Path(sys.argv[1]).read_text(encoding="utf-8",errors="replace").splitlines(); vals=[line.split(":",1)[1].strip() for line in lines if line.lower().startswith("payment-response:")]; v=vals[-1] if vals else ""; raw=base64.b64decode(v + "="*((-len(v))%4)) if v else b""; obj=json.loads(raw.decode("utf-8")) if raw else {}; jws=((obj.get("receipt") or {}).get("jws") or ""); sys.stdout.write(jws if isinstance(jws,str) else "")' "$1"
}

observe_demo4_crp_index() {
  local crp_base="$1"
  local tx_hash="$2"
  local chain_id="$3"
  local index_json="$4"
  local index_headers="$5"
  local poll_interval="$6"
  local poll_max="$7"

  local network="concordium:testnet"
  local genesis="7"
  local token="EUDemo"
  local pay_to="4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ"
  local amount_minor="50101"
  local limit="100"

  local deadline
  local indexed=false

  local attempts=0
  local valid_200_misses=0
  local transport_errors=0
  local http_errors=0
  local response_errors=0

  local last_curl_exit=0
  local last_http_status="none"
  local match_exit=0

  deadline="$(( $(date +%s) + poll_max ))"

  while (( $(date +%s) < deadline )); do
    attempts="$((attempts + 1))"

    : >"$index_json"
    : >"$index_headers"

    curl -sS \
      --get \
      -D "$index_headers" \
      "$crp_base/v1/crp/plt/search" \
      --data-urlencode "network=$network" \
      --data-urlencode "networkGenesisIndex=$genesis" \
      --data-urlencode "tokenId=$token" \
      --data-urlencode "to=$pay_to" \
      --data-urlencode "amountMinor=$amount_minor" \
      --data-urlencode "limit=$limit" \
      -o "$index_json" \
      >/dev/null 2>&1

    last_curl_exit=$?

    if [[ "$last_curl_exit" -ne 0 ]]; then
      transport_errors="$((transport_errors + 1))"
      sleep "$poll_interval"
      continue
    fi

    last_http_status="$(
      http_status "$index_headers"
    )"

    if [[ "$last_http_status" != "200" ]]; then
      http_errors="$((http_errors + 1))"
      sleep "$poll_interval"
      continue
    fi

    if ! jq -e \
      '
        type == "object" and
        ((.events // []) | type == "array")
      ' \
      "$index_json" \
      >/dev/null 2>&1
    then
      response_errors="$((response_errors + 1))"
      sleep "$poll_interval"
      continue
    fi

    jq -e \
      --arg tx "$tx_hash" \
      --arg network "$network" \
      --arg chain "$chain_id" \
      --argjson genesis "$genesis" \
      --arg token "$token" \
      --arg to "$pay_to" \
      --arg amountMinor "$amount_minor" \
      '
        (.events // []) |
        any(
          (((.tx_hash // .txHash // "") | ascii_downcase) == ($tx | ascii_downcase)) and
          (.network == $network or .network == $chain) and
          (.network_genesis_index == $genesis) and
          (.token_id == $token) and
          (.to_addr == $to) and
          (.amount_minor == $amountMinor)
        )
      ' \
      "$index_json" \
      >/dev/null 2>&1

    match_exit=$?

    case "$match_exit" in
      0)
        indexed=true
        break
        ;;

      1)
        valid_200_misses="$((valid_200_misses + 1))"
        ;;

      *)
        response_errors="$((response_errors + 1))"
        ;;
    esac

    sleep "$poll_interval"
  done

  echo "DEMO4_CRP_OBSERVER_ATTEMPTS=$attempts"
  echo "DEMO4_CRP_OBSERVER_VALID_200_MISSES=$valid_200_misses"
  echo "DEMO4_CRP_OBSERVER_TRANSPORT_ERRORS=$transport_errors"
  echo "DEMO4_CRP_OBSERVER_HTTP_ERRORS=$http_errors"
  echo "DEMO4_CRP_OBSERVER_RESPONSE_ERRORS=$response_errors"
  echo "DEMO4_CRP_OBSERVER_LAST_CURL_EXIT=$last_curl_exit"
  echo "DEMO4_CRP_OBSERVER_LAST_HTTP_STATUS=$last_http_status"

  if [[ "$indexed" == "true" ]]; then
    echo "DEMO4_CRP_OBSERVER_RESULT=exact_match"
    return 0
  fi

  if [[
    "$transport_errors" -gt 0 ||
    "$http_errors" -gt 0 ||
    "$response_errors" -gt 0
  ]]; then
    echo "DEMO4_CRP_OBSERVER_RESULT=observer_error_timeout"
    return 11
  fi

  echo "DEMO4_CRP_OBSERVER_RESULT=valid_200_index_miss_timeout"
  return 10
}

run_demo4_prechallenge_nonpayer_custody_readiness() {
  local synthetic_result="${DEMO4_FINAL_E2E_TEST_NONPAYER_CUSTODY_RESULT:-ready}"

  local buyer_public_path="${DEMO4_D4_3_BUYER_VERIFICATION_KEY_PATH:-}"
  local buyer_private_path="${DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH:-}"
  local acting_public_path="${DEMO4_D4_3_ACTING_PUBLIC_KEY_PATH:-}"
  local acting_private_path="${DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH:-}"

  local acting_public_node="$acting_public_path"
  local public_exit=99

  if [[ "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" ]]; then
    echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_SYNTHETIC=true"

    case "$synthetic_result" in
      ready)
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=ready"
        echo "DEMO4_E2E_PRECHALLENGE_BUYER_PRIVATE_METADATA_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_ACTING_PRIVATE_METADATA_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_BUYER_PUBLIC_KEY_VALIDATED=true"
        echo "DEMO4_E2E_PRECHALLENGE_ACTING_PUBLIC_KEY_VALIDATED=true"
        echo "DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_READ=false"
        echo "DEMO4_E2E_PRECHALLENGE_PUBLIC_KEY_FILE_READ=false"
        return 0
        ;;

      buyer_private_not_ready|acting_private_not_ready|buyer_public_not_ready|acting_public_not_ready)
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false"
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=$synthetic_result"
        echo "DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_READ=false"
        echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
        fail "pre-challenge non-payer custody blocked: $synthetic_result"
        ;;

      *)
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false"
        echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=invalid_test_result"
        echo "DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_READ=false"
        echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
        fail "invalid DEMO4_FINAL_E2E_TEST_NONPAYER_CUSTODY_RESULT"
        ;;
    esac
  fi

  echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_SYNTHETIC=false"

  #
  # PRIVATE KEYS: metadata only.
  #
  # These checks deliberately do not open/read either private key.
  #

  [[ -n "$buyer_private_path" ]] ||
    fail "buyer private-key path missing"

  [[ -f "${DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH:-}" ]] ||
    fail "buyer private-key file missing/not regular"

  [[ -s "${DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH:-}" ]] ||
    fail "buyer private-key file empty"

  [[ ! -L "${DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH:-}" ]] ||
    fail "buyer private-key symlink forbidden"

  echo "DEMO4_E2E_PRECHALLENGE_BUYER_PRIVATE_METADATA_READY=true"

  [[ -n "$acting_private_path" ]] ||
    fail "acting private-key path missing"

  [[ -f "${DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH:-}" ]] ||
    fail "acting private-key file missing/not regular"

  [[ -s "${DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH:-}" ]] ||
    fail "acting private-key file empty"

  [[ ! -L "${DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH:-}" ]] ||
    fail "acting private-key symlink forbidden"

  echo "DEMO4_E2E_PRECHALLENGE_ACTING_PRIVATE_METADATA_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_READ=false"

  #
  # PUBLIC KEYS: exact frozen parse/fingerprint contract.
  #

  [[ "$buyer_public_path" == "keys/demo4-d4-1b/buyer.verification-key.json" ]] ||
    fail "buyer public-key path contract mismatch"

  [[ -f "$buyer_public_path" && -s "$buyer_public_path" && ! -L "$buyer_public_path" ]] ||
    fail "buyer public-key file not ready"

  [[ -n "$acting_public_path" ]] ||
    fail "acting public-key path missing"

  case "${acting_public_path//\\//}" in
    ".xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-public.jwk.json" | \
    */.xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-public.jwk.json)
      ;;
    *)
      fail "acting public-key path contract mismatch"
      ;;
  esac

  [[ -f "$acting_public_path" && -s "$acting_public_path" && ! -L "$acting_public_path" ]] ||
    fail "acting public-key file not ready"

  if [[ "$acting_public_node" =~ ^/[A-Za-z]/ ]]; then
    command -v cygpath >/dev/null 2>&1 ||
      fail "cygpath required for acting public-key path"

    acting_public_node="$(
      cygpath -w "$acting_public_node"
    )" ||
      fail "acting public-key node path conversion failed"
  fi

  DEMO4_E2E_BUYER_PUBLIC_KEY_PATH="$buyer_public_path" \
  DEMO4_E2E_ACTING_PUBLIC_KEY_PATH="$acting_public_node" \
    node.exe -e '
const fs = require("node:fs");
const crypto = require("node:crypto");

const BUYER_PATH =
  "keys/demo4-d4-1b/buyer.verification-key.json";

const BUYER_KID =
  "buyer-key:xcf:demo4:d4-1b:ceremony-only";

const BUYER_X_SHA =
  "81b64d0209c6e6fd62c6c41b4622308812468609187ef9b39af73088ff4bf0cb";

const ACTING_SUFFIX =
  ".xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-public.jwk.json";

const ACTING_X_SHA =
  "951bf3d03070947b3eefa811c04bbfaf9c73d6816daa5df4cc15079eee5ed130";

const ACTING_RAW_HEX =
  "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

const shaText = (value) =>
  crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");

const readJson = (path) =>
  JSON.parse(
    fs.readFileSync(path, "utf8"),
  );

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

try {
  const buyerPath =
    process.env.DEMO4_E2E_BUYER_PUBLIC_KEY_PATH ?? "";

  if (
    buyerPath.replace(/\\/g, "/") !== BUYER_PATH
  ) {
    process.exit(21);
  }

  const buyer =
    readJson(buyerPath);

  const buyerJwk =
    isObject(buyer?.publicKeyJwk)
      ? buyer.publicKeyJwk
      : null;

  if (
    !isObject(buyer) ||
    buyer.buyerKeyId !== BUYER_KID ||
    !isObject(buyerJwk) ||
    buyerJwk.kty !== "OKP" ||
    buyerJwk.crv !== "Ed25519" ||
    buyerJwk.kid !== BUYER_KID ||
    typeof buyerJwk.x !== "string" ||
    typeof buyerJwk.d === "string" ||
    shaText(buyerJwk.x) !== BUYER_X_SHA
  ) {
    process.exit(21);
  }
} catch {
  process.exit(21);
}

try {
  const actingPath =
    process.env.DEMO4_E2E_ACTING_PUBLIC_KEY_PATH ?? "";

  const normalized =
    actingPath.replace(/\\/g, "/");

  if (
    normalized !== ACTING_SUFFIX &&
    !normalized.endsWith("/" + ACTING_SUFFIX)
  ) {
    process.exit(22);
  }

  const record =
    readJson(actingPath);

  const actingJwk =
    isObject(record?.publicKeyJwk)
      ? record.publicKeyJwk
      : isObject(record?.jwk)
        ? record.jwk
        : record;

  if (
    !isObject(actingJwk) ||
    actingJwk.kty !== "OKP" ||
    actingJwk.crv !== "Ed25519" ||
    typeof actingJwk.x !== "string" ||
    typeof actingJwk.d === "string" ||
    shaText(actingJwk.x) !== ACTING_X_SHA ||
    Buffer
      .from(
        actingJwk.x,
        "base64url",
      )
      .toString("hex") !== ACTING_RAW_HEX
  ) {
    process.exit(22);
  }
} catch {
  process.exit(22);
}

process.exit(0);
' >/dev/null 2>&1

  public_exit=$?

  case "$public_exit" in
    0)
      echo "DEMO4_E2E_PRECHALLENGE_BUYER_PUBLIC_KEY_VALIDATED=true"
      echo "DEMO4_E2E_PRECHALLENGE_ACTING_PUBLIC_KEY_VALIDATED=true"
      echo "DEMO4_E2E_PRECHALLENGE_PUBLIC_KEY_FILE_READ=true"
      ;;

    21)
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false"
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=buyer_public_not_ready"
      echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
      fail "buyer public-key frozen validation failed"
      ;;

    22)
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false"
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=acting_public_not_ready"
      echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
      fail "acting public-key frozen validation failed"
      ;;

    *)
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false"
      echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=public_key_validation_failed"
      echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
      fail "public-key validation failed"
      ;;
  esac

  echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=ready"
}

run_demo4_prechallenge_payer_readiness() {
  local wallet_path="${DEMO4_D4_3_PAYER_WALLET_PATH:-}"
  local probe_exit=0
  local synthetic_result="${DEMO4_FINAL_E2E_TEST_PAYER_READINESS_RESULT:-ready}"

  if [[ "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" ]]; then
    echo "DEMO4_E2E_PRECHALLENGE_PAYER_PROBE_SYNTHETIC=true"

    case "$synthetic_result" in
      ready)
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=true"
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=ready"
        echo "DEMO4_E2E_PRECHALLENGE_WALLET_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_TESTNET_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_TOKEN_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_ACCOUNT_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_BALANCE_READY=true"
        echo "DEMO4_E2E_PRECHALLENGE_WALLET_READ=false"
        echo "DEMO4_E2E_PRECHALLENGE_TOKEN_NETWORK_READ=false"
        echo "DEMO4_E2E_PRECHALLENGE_ACCOUNT_NETWORK_READ=false"
        echo "DEMO4_E2E_PRECHALLENGE_SIGNING_PERFORMED=false"
        echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_CONSTRUCTED=false"
        echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_SUBMITTED=false"
        return 0
        ;;

      wallet_not_ready|testnet_not_ready|token_not_ready|account_not_ready|balance_not_ready)
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=false"
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=$synthetic_result"
        echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
        fail "pre-challenge payer readiness blocked: $synthetic_result"
        ;;

      *)
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=false"
        echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=invalid_test_result"
        echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
        fail "invalid DEMO4_FINAL_E2E_TEST_PAYER_READINESS_RESULT"
        ;;
    esac
  fi

  echo "DEMO4_E2E_PRECHALLENGE_PAYER_PROBE_SYNTHETIC=false"

  require_file "$PLT_TRANSFER"

  if [[ -z "$wallet_path" ]]; then
    echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=false"
    echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=wallet_path_missing"
    echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
    fail "pre-challenge payer wallet path is required"
  fi

  DEMO4_E2E_PAYER_WALLET_PATH_TO_PREFLIGHT="$wallet_path" \
    node.exe -r ts-node/register/transpile-only -e '
const {
  preflightPltTransferV1,
} = require("./scripts/plt-transfer.ts");

(async () => {
  let prepared = null;
  let exitCode = 0;

  try {
    const walletPath =
      process.env.DEMO4_E2E_PAYER_WALLET_PATH_TO_PREFLIGHT ?? "";

    if (!walletPath) {
      exitCode = 10;
    } else {
      prepared =
        await preflightPltTransferV1({
          walletPath,
          to:
            "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
          tokenId:
            "EUDemo",
          amount:
            "0.050101",
          grpcHost:
            "grpc.testnet.concordium.com",
          grpcPort:
            20000,
        });

      const exactReadiness =
        prepared.walletReadCount === 1 &&
        prepared.tokenNetworkReads === 1 &&
        prepared.accountInfoNetworkReads === 1 &&
        prepared.balanceSufficient === true &&
        prepared.tokenId === "EUDemo" &&
        prepared.decimals === 6 &&
        prepared.amount === "0.050101" &&
        typeof prepared.senderAddress === "string" &&
        prepared.senderAddress.length > 0 &&
        prepared.transactionConstructed === false &&
        prepared.transactionSubmitted === false;

      if (!exactReadiness) {
        exitCode = 11;
      }
    }
  } catch {
    exitCode = 12;
  } finally {
    try {
      const client =
        prepared?.runtime?.client;

      if (
        client &&
        typeof client.close === "function"
      ) {
        client.close();
      }
    } catch {
      // Best-effort cleanup only.
    }
  }

  process.exit(exitCode);
})();
' >/dev/null 2>&1

  probe_exit=$?

  if [[ "$probe_exit" -ne 0 ]]; then
    echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=false"
    echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=runtime_preflight_failed"
    echo "DEMO4_E2E_PRECHALLENGE_WALLET_READY=UNKNOWN"
    echo "DEMO4_E2E_PRECHALLENGE_TESTNET_READY=UNKNOWN"
    echo "DEMO4_E2E_PRECHALLENGE_TOKEN_READY=UNKNOWN"
    echo "DEMO4_E2E_PRECHALLENGE_ACCOUNT_READY=UNKNOWN"
    echo "DEMO4_E2E_PRECHALLENGE_BALANCE_READY=UNKNOWN"
    echo "DEMO4_E2E_PRECHALLENGE_SIGNING_PERFORMED=false"
    echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_CONSTRUCTED=false"
    echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_SUBMITTED=false"
    echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
    fail "pre-challenge payer readiness probe failed"
  fi

  echo "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=true"
  echo "DEMO4_E2E_PRECHALLENGE_PAYER_REASON=ready"
  echo "DEMO4_E2E_PRECHALLENGE_WALLET_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_TESTNET_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_TOKEN_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_ACCOUNT_READY=true"
  echo "DEMO4_E2E_PRECHALLENGE_BALANCE_READY=true"

  echo "DEMO4_E2E_PRECHALLENGE_WALLET_READ=true"
  echo "DEMO4_E2E_PRECHALLENGE_TOKEN_NETWORK_READ=true"
  echo "DEMO4_E2E_PRECHALLENGE_ACCOUNT_NETWORK_READ=true"

  echo "DEMO4_E2E_PRECHALLENGE_SIGNING_PERFORMED=false"
  echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_CONSTRUCTED=false"
  echo "DEMO4_E2E_PRECHALLENGE_TRANSACTION_SUBMITTED=false"
}

normalize_node_exe_env_path() {
  local name="$1"
  local value="${!name:-}"

  NODE_PATH_NORMALIZED=false

  [[ -n "$value" ]] || return 0

  if [[ "$value" =~ ^/[A-Za-z]/ ]]; then
    command -v cygpath >/dev/null 2>&1 ||
      fail "cygpath required for Windows node.exe custody-path normalization"

    value="$(cygpath -w "$value")" ||
      fail "could not normalize custody path for node.exe"

    printf -v "$name" "%s" "$value"
    export "$name"

    NODE_PATH_NORMALIZED=true
  fi
}

emit_d43_sanitized_diagnostics() {
  local file="$1"
  local child_exit="$2"

  local nonce=""
  local nonce_sha=""

  local challenge_ok=""
  local challenge_persisted=""
  local challenge_created_raw=""
  local challenge_created_truth="UNKNOWN"

  local redeem_truth="UNKNOWN"
  local claim_truth="UNKNOWN"
  local usage_claim_truth="UNKNOWN"
  local bounded_use_truth="UNKNOWN"
  local crp_pending_truth="UNKNOWN"
  local payment_truth="UNKNOWN"
  local crp_fulfill_truth="UNKNOWN"
  local receipt_requested_truth="UNKNOWN"
  local receipt_issued_truth="UNKNOWN"
  local resource_release_truth="UNKNOWN"

  echo >&2
  echo "--- D4-3 SANITIZED DIAGNOSTICS ---" >&2
  echo "D43_CHILD_EXIT_CODE=$child_exit" >&2

  # Print non-stage evidence only. Stage booleans that can become
  # contradictory after a later exception are synthesized below
  # exactly once.
  grep -E \
    "^(RUNNER_RESULT|RUNNER_ERROR|PRE_LIVE_GUARD_(OK|REASON|COMPLETE|CIS8004_EXACT|CIS8_EXACT|AGENT_CARD_EXACT)|FRESH_CHALLENGE_(OK|REASON|HTTP_STATUS|CANONICAL_PERSISTED_BY_GATEWAY)|PROOF_KEY_LOADING_GATE_(OK|REASON)|PROOF_CONSTRUCTION_(OK|REASON|COMPLETE)|GATEWAY_REDEEM_(OK|REASON|HTTP_STATUS|RESPONSE_CODE|RESPONSE_REASON|PAYMENT_RESPONSE_PRESENT)|PHASE5_CLAIM_(STATE_OK|STATE_REASON|STATE_FOUND|COUNT)|CRP_PENDING_(OK|REASON|HTTP_STATUS|TRANSPORT_CALLS|RETRY_ALLOWED)|PAYER_WALLET_PREFLIGHT_(OK|REASON)|PAYMENT_SUBMISSION_ATTEMPTS|PRODUCTION_ACTIVATION)=" \
    "$file" |
    sed "s/^/  /" >&2 || true

  # ----------------------------------------------------------
  # Fresh challenge truth
  # ----------------------------------------------------------

  challenge_ok="$(
    file_marker_value "$file" "FRESH_CHALLENGE_OK"
  )"

  challenge_persisted="$(
    file_marker_value "$file" "FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY"
  )"

  challenge_created_raw="$(
    file_marker_value "$file" "FRESH_CHALLENGE_CREATED"
  )"

  if [[
    "$challenge_ok" == "true" &&
    "$challenge_persisted" == "true"
  ]]; then
    challenge_created_truth=true
  elif grep -Fqx \
    "FRESH_CHALLENGE_CREATED=true" \
    "$file"; then
    challenge_created_truth=true
  elif [[ "$challenge_persisted" == "true" ]]; then
    challenge_created_truth=true
  elif [[ "$challenge_ok" == "false" ]]; then
    challenge_created_truth=false
  elif grep -Fqx \
    "FRESH_CHALLENGE_CREATED=false" \
    "$file"; then
    challenge_created_truth=false
  fi

  # ----------------------------------------------------------
  # Gateway redeem truth
  # Positive evidence always wins.
  # ----------------------------------------------------------

  if grep -Fqx \
    "GATEWAY_REDEEM_OK=true" \
    "$file"; then
    redeem_truth=true
  elif grep -Fqx \
    "GATEWAY_REDEEM_OK=false" \
    "$file"; then
    redeem_truth=false
  fi

  # ----------------------------------------------------------
  # Phase-5 claim truth
  #
  # A successful Gateway redeem followed by a later D4-3
  # verification exception is NOT enough to call the claim
  # false. Without claim-specific positive evidence the
  # correct value is UNKNOWN.
  # ----------------------------------------------------------

  if grep -Fqx \
      "PHASE5_CLAIM_INVOKED=true" \
      "$file" ||
     grep -Fqx \
      "PHASE5_CLAIM_STATE_FOUND=true" \
      "$file" ||
     grep -Fqx \
      "USAGE_CLAIM_CREATED=true" \
      "$file" ||
     grep -Fqx \
      "BOUNDED_USE_CONSUMED=true" \
      "$file"; then

    claim_truth=true

  elif [[ "$redeem_truth" == "true" ]]; then

    claim_truth=UNKNOWN

  elif grep -Fqx \
    "PHASE5_CLAIM_INVOKED=false" \
    "$file"; then

    claim_truth=false
  fi

  # ----------------------------------------------------------
  # Usage-claim truth
  # ----------------------------------------------------------

  if grep -Fqx \
      "USAGE_CLAIM_CREATED=true" \
      "$file" ||
     grep -Fqx \
      "PHASE5_CLAIM_STATE_FOUND=true" \
      "$file" ||
     grep -Fqx \
      "BOUNDED_USE_CONSUMED=true" \
      "$file"; then

    usage_claim_truth=true

  elif [[ "$redeem_truth" == "true" ]]; then

    usage_claim_truth=UNKNOWN

  elif grep -Fqx \
    "USAGE_CLAIM_CREATED=false" \
    "$file"; then

    usage_claim_truth=false
  fi

  # ----------------------------------------------------------
  # Bounded-use consumption truth
  #
  # Only explicit positive bounded-use evidence proves true.
  # A successful redeem with no later positive lifecycle
  # evidence remains UNKNOWN.
  # ----------------------------------------------------------

  if grep -Fqx \
    "BOUNDED_USE_CONSUMED=true" \
    "$file"; then

    bounded_use_truth=true

  elif [[ "$redeem_truth" == "true" ]]; then

    bounded_use_truth=UNKNOWN

  elif grep -Fqx \
    "BOUNDED_USE_CONSUMED=false" \
    "$file"; then

    bounded_use_truth=false
  fi

  # ----------------------------------------------------------
  # CRP pending truth
  # ----------------------------------------------------------

  if grep -Fqx \
      "CRP_PENDING_REGISTERED=true" \
      "$file" ||
     grep -Fqx \
      "CRP_PENDING_OK=true" \
      "$file"; then

    crp_pending_truth=true

  elif grep -Fqx \
       "CRP_PENDING_REGISTERED=false" \
       "$file" ||
       grep -Fqx \
       "CRP_PENDING_OK=false" \
       "$file"; then

    crp_pending_truth=false
  fi

  # ----------------------------------------------------------
  # Payment-attempt truth
  # ----------------------------------------------------------

  if grep -Fqx \
      "PAYMENT_ATTEMPTED=true" \
      "$file" ||
     grep -Eq \
      '^PAYMENT_SUBMISSION_ATTEMPTS=[1-9][0-9]*$' \
      "$file"; then

    payment_truth=true

  elif grep -Fqx \
    "PAYMENT_ATTEMPTED=false" \
    "$file"; then

    payment_truth=false
  fi

  # ----------------------------------------------------------
  # Fulfill / receipt / release truth
  # ----------------------------------------------------------

  if grep -Fqx \
    "CRP_FULFILL_CALLED=true" \
    "$file"; then
    crp_fulfill_truth=true
  elif grep -Fqx \
    "CRP_FULFILL_CALLED=false" \
    "$file"; then
    crp_fulfill_truth=false
  fi

  if grep -Fqx \
    "RECEIPT_REQUESTED=true" \
    "$file"; then
    receipt_requested_truth=true
  elif grep -Fqx \
    "RECEIPT_REQUESTED=false" \
    "$file"; then
    receipt_requested_truth=false
  fi

  if grep -Fqx \
    "RECEIPT_ISSUED=true" \
    "$file"; then
    receipt_issued_truth=true
  elif grep -Fqx \
    "RECEIPT_ISSUED=false" \
    "$file"; then
    receipt_issued_truth=false
  fi

  if grep -Fqx \
    "RESOURCE_RELEASED=true" \
    "$file"; then
    resource_release_truth=true
  elif grep -Fqx \
    "RESOURCE_RELEASED=false" \
    "$file"; then
    resource_release_truth=false
  fi

  # ----------------------------------------------------------
  # Emit reconciled stage truth exactly once.
  # ----------------------------------------------------------

  echo "  FRESH_CHALLENGE_CREATED=$challenge_created_truth" >&2
  echo "  GATEWAY_REDEEM_SUCCEEDED=$redeem_truth" >&2
  echo "  PHASE5_CLAIM_INVOKED=$claim_truth" >&2
  echo "  USAGE_CLAIM_CREATED=$usage_claim_truth" >&2
  echo "  BOUNDED_USE_CONSUMED=$bounded_use_truth" >&2
  echo "  CRP_PENDING_REGISTERED=$crp_pending_truth" >&2
  echo "  PAYMENT_ATTEMPTED=$payment_truth" >&2
  echo "  CRP_FULFILL_CALLED=$crp_fulfill_truth" >&2
  echo "  RECEIPT_REQUESTED=$receipt_requested_truth" >&2
  echo "  RECEIPT_ISSUED=$receipt_issued_truth" >&2
  echo "  RESOURCE_RELEASED=$resource_release_truth" >&2

  nonce="$(
    file_marker_value "$file" "FRESH_CHALLENGE_NONCE"
  )"

  if [[ -n "$nonce" ]]; then
    nonce_sha="$(
      printf "%s" "$nonce" |
        python -c "import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
    )"

    echo "  FRESH_CHALLENGE_NONCE_SHA256=$nonce_sha" >&2
  fi

  echo "--- END D4-3 SANITIZED DIAGNOSTICS ---" >&2
}

require_cmd node.exe
require_cmd curl
require_cmd jq
require_cmd python

GW="${DEMO4_D4_3_GATEWAY_BASE_URL:-}"
CRP="${DEMO4_D4_3_CRP_BASE_URL:-}"
POLL_INTERVAL_SECS="${DEMO4_FINAL_E2E_POLL_INTERVAL_SECS:-2}"
POLL_MAX_SECS="${DEMO4_FINAL_E2E_POLL_MAX_SECS:-90}"

[[ -n "$GW" ]] || fail "DEMO4_D4_3_GATEWAY_BASE_URL is required for live mode"
[[ -n "$CRP" ]] || fail "DEMO4_D4_3_CRP_BASE_URL is required for live mode"
[[ "$POLL_INTERVAL_SECS" =~ ^[1-9][0-9]*$ ]] ||
  fail "DEMO4_FINAL_E2E_POLL_INTERVAL_SECS must be a positive integer"
[[ "$POLL_MAX_SECS" =~ ^[1-9][0-9]*$ ]] ||
  fail "DEMO4_FINAL_E2E_POLL_MAX_SECS must be a positive integer"

LIVE_TMP="$(mktemp -d)" ||
  fail "could not create live temporary directory"

cleanup_live_tmp() {
  rm -rf "$LIVE_TMP"
}
trap cleanup_live_tmp EXIT

D43_LOG="$LIVE_TMP/d43.log"
CONTINUATION_LOG="$LIVE_TMP/payer-continuation.log"
INDEX_JSON="$LIVE_TMP/crp-index.json"
INDEX_HEADERS="$LIVE_TMP/crp-index.headers"
RELEASE_HEADERS="$LIVE_TMP/release.headers"
RELEASE_BODY="$LIVE_TMP/release.json"
REPLAY_HEADERS="$LIVE_TMP/replay.headers"
REPLAY_BODY="$LIVE_TMP/replay.json"

if [[
  "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" &&
  "${DEMO4_FINAL_E2E_TEST_OBSERVER_ONLY:-}" == "true"
]]; then
  TEST_OBSERVER_TX_HASH="${DEMO4_FINAL_E2E_TEST_OBSERVER_TX_HASH:-}"

  TEST_OBSERVER_CHAIN_ID="${DEMO4_FINAL_E2E_TEST_OBSERVER_CHAIN_ID:-ccd:4221332d34e1694168c2a0c0b3fd0f27}"

  [[ "$TEST_OBSERVER_TX_HASH" =~ ^[0-9A-Fa-f]{64}$ ]] ||
    fail "test observer-only transaction hash must be 64 hex characters"

  echo "DEMO4_E2E_TEST_OBSERVER_ONLY=true"
  echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false"
  echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false"
  echo "DEMO4_PAYMENT_SUBMITTED=false"
  echo "DEMO4_PAYMENT_SUBMISSIONS=0"
  echo "DEMO4_RESOURCE_RELEASED=false"
  echo "DEMO4_REPLAY_PROBED=false"
  echo "DEMO4_PRODUCTION_ACTIVATION=false"

  if observe_demo4_crp_index \
    "$CRP" \
    "$TEST_OBSERVER_TX_HASH" \
    "$TEST_OBSERVER_CHAIN_ID" \
    "$INDEX_JSON" \
    "$INDEX_HEADERS" \
    "$POLL_INTERVAL_SECS" \
    "$POLL_MAX_SECS"
  then
    TEST_OBSERVER_EXIT=0
  else
    TEST_OBSERVER_EXIT=$?
  fi

  case "$TEST_OBSERVER_EXIT" in
    0)
      echo "DEMO4_CRP_INDEXED=true"
      echo "DEMO4_E2E_TEST_OBSERVER_ONLY_RESULT=exact_match"
      exit 0
      ;;

    10)
      echo "DEMO4_CRP_INDEXED=false"
      echo "DEMO4_E2E_TEST_OBSERVER_ONLY_RESULT=valid_200_index_miss_timeout"
      fail "finalized Testnet transfer was not observed in CRP index before timeout"
      ;;

    11)
      echo "DEMO4_CRP_INDEXED=false"
      echo "DEMO4_E2E_TEST_OBSERVER_ONLY_RESULT=observer_error_timeout"
      fail "CRP observer encountered transport/HTTP/response errors before exact finalized-event observation"
      ;;

    *)
      echo "DEMO4_CRP_INDEXED=false"
      echo "DEMO4_E2E_TEST_OBSERVER_ONLY_RESULT=unsupported_observer_result"
      fail "CRP observer returned unsupported result $TEST_OBSERVER_EXIT"
      ;;
  esac
fi

if [[ "$D43_EXECUTION_RUNNER" != "$D43_RUNNER" ]]; then
  require_file "$D43_EXECUTION_RUNNER"
  echo "DEMO4_E2E_TEST_D43_RUNNER_OVERRIDE=true"
else
  echo "DEMO4_E2E_TEST_D43_RUNNER_OVERRIDE=false"
fi

run_demo4_prechallenge_nonpayer_custody_readiness
echo "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_COMPLETE=true"

NODE_PATH_NORMALIZED=false
normalize_node_exe_env_path "DEMO4_D4_3_BUYER_VERIFICATION_KEY_PATH"
echo "DEMO4_E2E_NODE_PATH_NORMALIZED_BUYER_VERIFICATION=$NODE_PATH_NORMALIZED"

NODE_PATH_NORMALIZED=false
normalize_node_exe_env_path "DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH"
echo "DEMO4_E2E_NODE_PATH_NORMALIZED_BUYER_PRIVATE=$NODE_PATH_NORMALIZED"

NODE_PATH_NORMALIZED=false
normalize_node_exe_env_path "DEMO4_D4_3_ACTING_PUBLIC_KEY_PATH"
echo "DEMO4_E2E_NODE_PATH_NORMALIZED_ACTING_PUBLIC=$NODE_PATH_NORMALIZED"

NODE_PATH_NORMALIZED=false
normalize_node_exe_env_path "DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH"
echo "DEMO4_E2E_NODE_PATH_NORMALIZED_ACTING_PRIVATE=$NODE_PATH_NORMALIZED"

NODE_PATH_NORMALIZED=false
normalize_node_exe_env_path "DEMO4_D4_3_PAYER_WALLET_PATH"
echo "DEMO4_E2E_NODE_PATH_NORMALIZED_PAYER_WALLET=$NODE_PATH_NORMALIZED"

run_demo4_prechallenge_payer_readiness
echo "DEMO4_E2E_PRECHALLENGE_PAYER_PROBE_COMPLETE=true"

echo "DEMO4_LIVE_AUTHORIZATION_REQUIRED=false"
echo "DEMO4_D4_3_LIVE_RUNNER_EXECUTED=true"

DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_MODE=execute \
  node.exe -r ts-node/register/transpile-only \
  "$D43_EXECUTION_RUNNER" >"$D43_LOG" 2>&1
D43_EXIT=$?

D43_RUNNER_RESULT="$(
  file_marker_value "$D43_LOG" "RUNNER_RESULT"
)"

if [[
  "$D43_EXIT" -ne 2 ||
  "$D43_RUNNER_RESULT" != "STOP_BEFORE_PAYER_WALLET_PREFLIGHT"
]]; then
  emit_d43_sanitized_diagnostics \
    "$D43_LOG" \
    "$D43_EXIT"

  echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false"

  fail "D4-3 did not reach the controlled pre-payer stop boundary"
fi

require_file_marker_value \
  "$D43_LOG" \
  "RUNNER_RESULT" \
  "STOP_BEFORE_PAYER_WALLET_PREFLIGHT"
require_file_marker_value "$D43_LOG" "PRE_LIVE_GUARD_COMPLETE" "true"
require_file_marker_value "$D43_LOG" "PRE_LIVE_GUARD_CIS8004_EXACT" "true"
require_file_marker_value "$D43_LOG" "PRE_LIVE_GUARD_CIS8_EXACT" "true"
require_file_marker_value "$D43_LOG" "PRE_LIVE_GUARD_AGENT_CARD_EXACT" "true"
require_file_marker_value "$D43_LOG" "FRESH_CHALLENGE_CREATED" "true"
require_file_marker_value "$D43_LOG" "PROOF_CONSTRUCTION_COMPLETE" "true"
require_file_marker_value "$D43_LOG" "PHASE5_CLAIM_INVOKED" "true"
require_file_marker_value "$D43_LOG" "USAGE_CLAIM_CREATED" "true"
require_file_marker_value "$D43_LOG" "BOUNDED_USE_CONSUMED" "true"
require_file_marker_value "$D43_LOG" "CRP_PENDING_REGISTERED" "true"
require_file_marker_value "$D43_LOG" "PAYMENT_ATTEMPTED" "false"
require_file_marker_value "$D43_LOG" "CRP_FULFILL_CALLED" "false"
require_file_marker_value "$D43_LOG" "RESOURCE_RELEASED" "false"
require_file_marker_value "$D43_LOG" "PRODUCTION_ACTIVATION" "false"

[[ "$D43_EXIT" -eq 2 ]] ||
  fail "D4-3 expected intentional stop exit 2, got $D43_EXIT"

if [[
  "${DEMO4_FINAL_E2E_TEST_ONLY:-}" == "true" &&
  "${DEMO4_FINAL_E2E_TEST_STOP_AFTER_D43_HANDOFF:-}" == "true"
]]; then
  echo "DEMO4_E2E_TEST_D43_HANDOFF_ACCEPTED=true"
  echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false"
  echo "DEMO4_LIVE_EXECUTION_PERFORMED=false"
  echo "DEMO4_PAYMENT_SUBMITTED=false"
  echo "DEMO4_RESOURCE_RELEASED=false"
  echo "DEMO4_REPLAY_PROBED=false"
  echo "DEMO4_PRODUCTION_ACTIVATION=false"
  echo "DEMO4_COMPLETE=false"
  exit 0
fi

NONCE="$(file_marker_value "$D43_LOG" "FRESH_CHALLENGE_NONCE")"
EXPIRES_AT="$(file_marker_value "$D43_LOG" "FRESH_CHALLENGE_EXPIRES_AT")"
CONTRACT_ID="$(file_marker_value "$D43_LOG" "FRESH_CHALLENGE_CONTRACT_ID")"
CONTRACT_VERSION="$(file_marker_value "$D43_LOG" "FRESH_CHALLENGE_CONTRACT_VERSION")"
CHAIN_ID="$(file_marker_value "$D43_LOG" "FRESH_CHALLENGE_CHAIN_ID")"

[[ -n "$NONCE" ]] || fail "D4-3 did not expose fresh nonce"
[[ "$EXPIRES_AT" =~ ^[0-9]+$ ]] || fail "D4-3 expiresAt handoff is invalid"
[[ -n "$CONTRACT_ID" ]] || fail "D4-3 contractId handoff is missing"
[[ "$CONTRACT_VERSION" == "1.0.0" ]] ||
  fail "D4-3 contractVersion handoff mismatch"
[[ "$CHAIN_ID" == "ccd:4221332d34e1694168c2a0c0b3fd0f27" ]] ||
  fail "D4-3 chain_id handoff mismatch"

echo "DEMO4_D4_3_HANDOFF_VERIFIED=true"
echo "DEMO4_PATH6_REGISTERED_AGENT_AUTHORIZED=true"
echo "DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=true"

DEMO4_FINAL_PAYER_CONTINUATION_MODE=execute \
DEMO4_FINAL_PAYER_CONTINUATION_AUTHORIZED=true \
DEMO4_FINAL_PAYER_NONCE="$NONCE" \
DEMO4_FINAL_PAYER_EXPIRES_AT="$EXPIRES_AT" \
DEMO4_FINAL_PAYER_CONTRACT_ID="$CONTRACT_ID" \
DEMO4_FINAL_PAYER_CONTRACT_VERSION="$CONTRACT_VERSION" \
DEMO4_FINAL_PAYER_CRP_PENDING_REGISTERED=true \
  node.exe -r ts-node/register/transpile-only \
  "$PAYER_CONTINUATION" >"$CONTINUATION_LOG" 2>&1
CONTINUATION_EXIT=$?

CONTINUATION_RESULT="$(
  file_marker_value \
    "$CONTINUATION_LOG" \
    "RUNNER_RESULT" \
    2>/dev/null ||
  true
)"

PAYMENT_OUTCOME="$(
  file_marker_value \
    "$CONTINUATION_LOG" \
    "PAYMENT_OUTCOME" \
    2>/dev/null ||
  true
)"

TX_HASH="$(
  file_marker_value \
    "$CONTINUATION_LOG" \
    "TRANSACTION_HASH" \
    2>/dev/null ||
  true
)"

PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED=false

case "$CONTINUATION_EXIT" in
  0)
    require_file_marker_value \
      "$CONTINUATION_LOG" \
      "RUNNER_RESULT" \
      "DEMO4_FINAL_PAYER_PAYMENT_FINALIZED"

    require_file_marker_value "$CONTINUATION_LOG" "PAYER_PREFLIGHT_OK" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYER_WALLET_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "TOKEN_NETWORK_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "ACCOUNT_INFO_NETWORK_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYER_BALANCE_SUFFICIENT" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_INVOCATION_OK" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_SUBMISSION_ATTEMPTS" "1"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTIONS_CONSTRUCTED" "1"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTION_SUBMITTED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_ATTEMPTED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTION_HASH_PRESENT" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_OUTCOME" "finalized_success"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_FINALIZED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "STOP_REQUIRED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "CRP_FULFILL_CALLED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "RESOURCE_RELEASED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "REPLAY_PROBED" "false"

    [[ "$TX_HASH" =~ ^[0-9A-Fa-f]{64}$ ]] ||
      fail "payer continuation transaction hash shape invalid"

    echo "DEMO4_PAYMENT_FINALIZATION_OBSERVER_AMBIGUOUS=false"
    echo "DEMO4_PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED=false"
    ;;

  5)
    [[ "$CONTINUATION_RESULT" == "STOP_PAYMENT_NOT_FINALIZED_SUCCESS" ]] ||
      fail "payer continuation exit 5 returned unexpected runner result"

    require_file_marker_value "$CONTINUATION_LOG" "PAYER_PREFLIGHT_OK" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYER_WALLET_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "TOKEN_NETWORK_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "ACCOUNT_INFO_NETWORK_READ" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYER_BALANCE_SUFFICIENT" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_INVOCATION_OK" "false"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_INVOCATION_REASON" "payment_invocation_submitted_unknown"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_SUBMISSION_ATTEMPTS" "1"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTIONS_CONSTRUCTED" "1"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTION_SUBMITTED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_ATTEMPTED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "TRANSACTION_HASH_PRESENT" "true"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_OUTCOME" "submitted_unknown"
    require_file_marker_value "$CONTINUATION_LOG" "PAYMENT_FINALIZED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "STOP_REQUIRED" "true"
    require_file_marker_value "$CONTINUATION_LOG" "CRP_FULFILL_CALLED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "RESOURCE_RELEASED" "false"
    require_file_marker_value "$CONTINUATION_LOG" "REPLAY_PROBED" "false"

    [[ "$TX_HASH" =~ ^[0-9A-Fa-f]{64}$ ]] ||
      fail "submitted-unknown payment lacks a valid transaction hash; reconciliation blocked"

    PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED=true

    echo "DEMO4_PAYMENT_FINALIZATION_OBSERVER_AMBIGUOUS=true"
    echo "DEMO4_PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED=true"
    echo "DEMO4_PAYMENT_RESUBMISSION_AFTER_UNKNOWN=false"
    echo "DEMO4_PAYMENT_BUDGET_REMAINS_CONSUMED=true"
    ;;

  *)
    fail "payer continuation failed with unsupported exit $CONTINUATION_EXIT"
    ;;
esac

echo "DEMO4_PAYMENT_SUBMITTED=true"
echo "DEMO4_PAYMENT_SUBMISSIONS=1"
echo "DEMO4_TRANSACTION_HASH_PRESENT=true"
echo "DEMO4_RAW_TRANSACTION_HASH_PRINTED=false"

if [[ "$PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED" == "false" ]]; then
  echo "DEMO4_PAYMENT_FINALIZED=true"
fi

CRP_INDEX_NETWORK="concordium:testnet"
CRP_INDEX_NETWORK_GENESIS_INDEX="7"
CRP_INDEX_TOKEN_ID="EUDemo"
CRP_INDEX_TO="4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ"
CRP_INDEX_AMOUNT_MINOR="50101"
CRP_INDEX_LIMIT="100"

if observe_demo4_crp_index \
  "$CRP" \
  "$TX_HASH" \
  "$CHAIN_ID" \
  "$INDEX_JSON" \
  "$INDEX_HEADERS" \
  "$POLL_INTERVAL_SECS" \
  "$POLL_MAX_SECS"
then
  OBSERVER_EXIT=0
else
  OBSERVER_EXIT=$?
fi

case "$OBSERVER_EXIT" in
  0)
    ;;

  10)
    fail "finalized Testnet transfer was not observed in CRP index before timeout"
    ;;

  11)
    fail "CRP observer encountered transport/HTTP/response errors before exact finalized-event observation"
    ;;

  *)
    fail "CRP observer returned unsupported result $OBSERVER_EXIT"
    ;;
esac

echo "DEMO4_CRP_INDEXED=true"

if [[ "$PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED" == "true" ]]; then
  echo "DEMO4_PAYMENT_FINALIZATION_RECONCILED=true"
  echo "DEMO4_PAYMENT_FINALIZATION_RECONCILIATION_SOURCE=exact_crp_plt_index"
  echo "DEMO4_PAYMENT_FINALIZED=true"
else
  echo "DEMO4_PAYMENT_FINALIZATION_RECONCILED=false"
fi

PAYMENT_SIGNATURE="$(
  node.exe -e \
    'process.stdout.write(Buffer.from(JSON.stringify({nonce:process.argv[1],txHash:process.argv[2],networkGenesisIndex:7}),"utf8").toString("base64"))' \
    "$NONCE" \
    "$TX_HASH"
)"

[[ -n "$PAYMENT_SIGNATURE" ]] ||
  fail "could not construct PAYMENT-SIGNATURE"

curl -sS \
  -D "$RELEASE_HEADERS" \
  -o "$RELEASE_BODY" \
  "$GW/paid-gated?nonce=$NONCE" \
  -H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE" \
  >/dev/null
RELEASE_CURL_EXIT=$?

[[ "$RELEASE_CURL_EXIT" -eq 0 ]] ||
  fail "Gateway release request transport failed"

RELEASE_STATUS="$(http_status "$RELEASE_HEADERS")"
PAYMENT_RESPONSE="$(header_value "$RELEASE_HEADERS" "payment-response")"

[[ "$RELEASE_STATUS" == "200" ]] ||
  fail "Gateway release expected 200, got ${RELEASE_STATUS:-<missing>}"
[[ -n "$PAYMENT_RESPONSE" ]] ||
  fail "Gateway release must emit PAYMENT-RESPONSE"

jq -e \
  '.ok == true and .paid == true and .resource == "secret-data"' \
  "$RELEASE_BODY" >/dev/null ||
  fail "Gateway release did not return protected resource"

RECEIPT_JWS="$(
  receipt_jws_from_payment_response_headers \
    "$RELEASE_HEADERS"
)"

[[ "$RECEIPT_JWS" =~ ^[^.]+\.[^.]+\.[^.]+$ ]] ||
  fail "PAYMENT-RESPONSE did not contain a compact receipt JWS"

echo "DEMO4_GATEWAY_RELEASE_REQUESTS=1"
echo "DEMO4_GATEWAY_OWNED_FULFILL_RELEASE=true"
echo "DEMO4_PAYMENT_RESPONSE_EMITTED=true"
echo "DEMO4_RECEIPT_JWS_PRESENT=true"
echo "DEMO4_RAW_PAYMENT_RESPONSE_PRINTED=false"
echo "DEMO4_RAW_RECEIPT_JWS_PRINTED=false"
echo "DEMO4_RESOURCE_RELEASED=true"
echo "DEMO4_RESOURCE_RELEASES=1"

curl -sS \
  -D "$REPLAY_HEADERS" \
  -o "$REPLAY_BODY" \
  "$GW/paid-gated?nonce=$NONCE" \
  -H "x402-receipt: $RECEIPT_JWS" \
  >/dev/null
REPLAY_CURL_EXIT=$?

[[ "$REPLAY_CURL_EXIT" -eq 0 ]] ||
  fail "Gateway replay request transport failed"

REPLAY_STATUS="$(http_status "$REPLAY_HEADERS")"
REPLAY_PAYMENT_RESPONSE="$(header_value "$REPLAY_HEADERS" "payment-response")"

[[ "$REPLAY_STATUS" == "402" ]] ||
  fail "receipt replay expected 402, got ${REPLAY_STATUS:-<missing>}"
[[ -z "$REPLAY_PAYMENT_RESPONSE" ]] ||
  fail "receipt replay must not emit PAYMENT-RESPONSE"

if jq -e \
  '.resource == "secret-data"' \
  "$REPLAY_BODY" >/dev/null 2>&1; then
  fail "receipt replay must not release protected resource"
fi

echo "DEMO4_REPLAY_PROBED=true"
echo "DEMO4_REPLAY_REQUESTS=1"
echo "DEMO4_REPLAY_USES_VERIFIED_RECEIPT=true"
echo "DEMO4_REPLAY_REJECTED=true"

echo "DEMO4_LIVE_CIS8004_EXACT=true"
echo "DEMO4_LIVE_CIS8_EXACT=true"
echo "DEMO4_LIVE_AGENT_CARD_EXACT=true"
echo "DEMO4_PATH1_INVALID_BUYER_REJECTED=true"
echo "DEMO4_PATH2_INVALID_AGENT_POP_REJECTED=true"
echo "DEMO4_PATH3_CIS8_ACTING_KEY_MISMATCH_REJECTED=true"
echo "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=true"
echo "DEMO4_PATH5_INELIGIBLE_BUYER_REJECTED=true"
echo "DEMO4_LIVE_EXECUTION_PERFORMED=true"
echo "DEMO4_PRODUCTION_ACTIVATION=false"
echo "DEMO4_COMPLETE=true"
