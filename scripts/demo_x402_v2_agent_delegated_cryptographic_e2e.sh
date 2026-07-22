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

WORKDIR="${WORKDIR:-.demo-x402-v2-agent-delegated-cryptographic-e2e}"

KEYDIR="$WORKDIR/cryptographic-keys"
GATEWAY_LOG="$WORKDIR/gateway.log"
GATEWAY_PID=""

PHASE5_BUYER_ID="${PHASE5_BUYER_ID:-buyer:phase5-agent-delegated-demo}"
PHASE5_AGENT_ID="${PHASE5_AGENT_ID:-agent:local-demo:phase5-agent-delegated-e2e}"
PHASE5_DEMO2_PREFLIGHT_ONLY="${PHASE5_DEMO2_PREFLIGHT_ONLY:-false}"
GATEWAY_DATABASE_URL="${GATEWAY_DATABASE_URL:-postgres://postgres:pg@127.0.0.1:5432/transaction-outcome}"
PHASE5_LIFECYCLE_MIGRATION="${PHASE5_LIFECYCLE_MIGRATION:-db/migrations/002_phase5_agent_delegation_lifecycle.sql}"

LIFECYCLE_MIGRATION_LOG="$WORKDIR/lifecycle-migration.log"
KEY_BUNDLE_HELPER_LOG="$WORKDIR/key-bundle-helper.json"
KEY_BUNDLE_HELPER_ERR="$WORKDIR/key-bundle-helper.err"
FINAL_CANONICAL_STATE_LOG="$WORKDIR/final-canonical-state.log"
POSITIVE_TRANSITION_CHAIN_LOG="$WORKDIR/positive-transition-chain.log"

mkdir -p "$WORKDIR"

cleanup() {
  if [[ -n "$GATEWAY_PID" ]]; then
    kill "$GATEWAY_PID" >/dev/null 2>&1 || true
    wait "$GATEWAY_PID" >/dev/null 2>&1 || true
    GATEWAY_PID=""
  fi

  rm -rf "$KEYDIR"

  rm -f \
    "$WORKDIR"/gateway-health.json \
    "$WORKDIR"/gateway.log \
    "$WORKDIR"/lifecycle-migration.log \
    "$WORKDIR"/final-canonical-state.log \
    "$WORKDIR"/positive-transition-chain.log \
    "$WORKDIR"/*-helper.json \
    "$WORKDIR"/*-helper.err \
    "$WORKDIR"/negative-gated-headers.txt \
    "$WORKDIR"/negative-gated-body.json \
    "$WORKDIR"/negative-gated-pr.json \
    "$WORKDIR"/negative-agent-delegated-structural-auth.json \
    "$WORKDIR"/negative-agent-delegated-auth.json \
    "$WORKDIR"/negative-auth-headers.txt \
    "$WORKDIR"/negative-auth-body.json \
    "$WORKDIR"/negative-blocked-headers.txt \
    "$WORKDIR"/negative-blocked-body.json \
    "$WORKDIR"/positive-gated-headers.txt \
    "$WORKDIR"/positive-gated-body.json \
    "$WORKDIR"/positive-gated-pr.json \
    "$WORKDIR"/positive-agent-delegated-structural-auth.json \
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
    "$WORKDIR"/positive-replay-body.json \
    "$WORKDIR"/invalid-buyer-signature-gated-headers.txt \
    "$WORKDIR"/invalid-buyer-signature-gated-body.json \
    "$WORKDIR"/invalid-buyer-signature-gated-pr.json \
    "$WORKDIR"/invalid-buyer-signature-agent-delegated-structural-auth.json \
    "$WORKDIR"/invalid-buyer-signature-agent-delegated-auth.json \
    "$WORKDIR"/invalid-buyer-signature-agent-delegated-auth-tampered.json \
    "$WORKDIR"/invalid-buyer-signature-auth-headers.txt \
    "$WORKDIR"/invalid-buyer-signature-auth-body.json \
    "$WORKDIR"/invalid-buyer-signature-blocked-headers.txt \
    "$WORKDIR"/invalid-buyer-signature-blocked-body.json \
    "$WORKDIR"/invalid-agent-pop-gated-headers.txt \
    "$WORKDIR"/invalid-agent-pop-gated-body.json \
    "$WORKDIR"/invalid-agent-pop-gated-pr.json \
    "$WORKDIR"/invalid-agent-pop-agent-delegated-structural-auth.json \
    "$WORKDIR"/invalid-agent-pop-agent-delegated-auth.json \
    "$WORKDIR"/invalid-agent-pop-agent-delegated-auth-tampered.json \
    "$WORKDIR"/invalid-agent-pop-auth-headers.txt \
    "$WORKDIR"/invalid-agent-pop-auth-body.json \
    "$WORKDIR"/invalid-agent-pop-blocked-headers.txt \
    "$WORKDIR"/invalid-agent-pop-blocked-body.json

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

if [[ "$PHASE5_DEMO2_PREFLIGHT_ONLY" != "true" ]]; then
  [[ -f "$WALLET_PATH" ]] || fail "Wallet file not found at $WALLET_PATH"
fi

[[ -f "node_modules/ts-node/dist/bin.js" ]] || fail "Local ts-node executable was not found"
[[ -f "$PHASE5_LIFECYCLE_MIGRATION" ]] || fail "Phase 5 lifecycle migration was not found: $PHASE5_LIFECYCLE_MIGRATION"

if curl -fsS "$GW/healthz" >/dev/null 2>&1; then
  fail "A Gateway is already reachable at $GW. Stop it before running the managed Demo2 autorun."
fi

say "Preparing PR #297 delegation lifecycle storage"

if ! docker exec \
  -i \
  "$DB_CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$PHASE5_LIFECYCLE_MIGRATION" \
  > "$LIFECYCLE_MIGRATION_LOG" \
  2>&1
then
  echo
  echo "Lifecycle migration diagnostics:" >&2
  sed 's/^/  /' "$LIFECYCLE_MIGRATION_LOG" >&2 || true
  fail "Phase 5 lifecycle migration failed"
fi

echo "Lifecycle storage ready: true"
echo "Lifecycle enforcement will be active: true"

say "Generating temporary Demo2 cryptographic keys"

if ! npm exec -- ts-node --transpile-only \
  scripts/demo_phase5_cryptographic_key_bundle.ts \
  --out-dir "$KEYDIR" \
  --buyer-id "$PHASE5_BUYER_ID" \
  --agent-id "$PHASE5_AGENT_ID" \
  > "$KEY_BUNDLE_HELPER_LOG" \
  2> "$KEY_BUNDLE_HELPER_ERR"
then
  echo
  echo "Cryptographic key helper diagnostics:" >&2
  sed 's/^/  /' "$KEY_BUNDLE_HELPER_ERR" >&2 || true
  sed 's/^/  /' "$KEY_BUNDLE_HELPER_LOG" >&2 || true
  fail "Temporary Demo2 cryptographic key generation failed"
fi

jq -e '
  .ok == true and
  .privateMaterialTemporary == true and
  .privateMaterialPrinted == false and
  .productionActivation == false
' "$KEY_BUNDLE_HELPER_LOG" >/dev/null || {
  echo
  echo "Unexpected cryptographic key helper result:" >&2
  sed 's/^/  /' "$KEY_BUNDLE_HELPER_LOG" >&2 || true
  fail "Temporary Demo2 key helper returned an invalid result"
}

echo "Temporary cryptographic key bundle generated: true"
echo "Private key material printed: false"

BUYER_VERIFICATION_KEY_PATH="$KEYDIR/buyer.verification-key.json"

[[ -f "$BUYER_VERIFICATION_KEY_PATH" ]]   || fail "Controlled buyer verification key was not generated"

say "Starting dedicated Demo2 Gateway"

DATABASE_URL="$GATEWAY_DATABASE_URL" \
PHASE3_GATEWAY_POLICY_GATE_ENABLED=true \
PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED=true \
PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED=true \
PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED=true \
PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH="$BUYER_VERIFICATION_KEY_PATH" \
  node.exe \
    node_modules/ts-node/dist/bin.js \
    src/server.ts \
    >"$GATEWAY_LOG" 2>&1 &

GATEWAY_PID=$!

deadline="$(( $(date +%s) + 45 ))"

while (( $(date +%s) < deadline )); do
  if curl -fsS "$GW/healthz" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$GATEWAY_PID" >/dev/null 2>&1; then
    echo
    echo "Dedicated Gateway exited before becoming ready:" >&2
    sed 's/^/  /' "$GATEWAY_LOG" >&2 || true
    fail "Dedicated Demo2 Gateway failed during startup"
  fi

  sleep 1
done

if ! curl -fsS "$GW/healthz" >/dev/null 2>&1; then
  echo
  echo "Dedicated Gateway did not become ready:" >&2
  sed 's/^/  /' "$GATEWAY_LOG" >&2 || true
  fail "Dedicated Demo2 Gateway readiness timed out"
fi

echo
echo "============================================================"
echo " x402 v2 Agent-Delegated Cryptographic E2E Demo - Demo2"
echo " Scenario: gated online purchase"
echo " Resource: /paid-gated engineering protected resource"
echo
echo " PATH 1 OF 4 - Invalid buyer signature"
echo "   Expected: reject before policy; no payment or release"
echo " PATH 2 OF 4 - Invalid agent proof-of-possession"
echo "   Expected: reject before policy; no payment or release"
echo " PATH 3 OF 4 - Authenticated agent, ineligible buyer"
echo "   Expected: policy denial before payment; no release"
echo " PATH 4 OF 4 - Authenticated agent, eligible buyer"
echo "   Expected: lifecycle authorization first; payment and release in the full run"
echo "============================================================"
echo
echo "Demo configuration"
echo "  Gateway:                  $GW"
echo "  CRP:                      $CRP"
echo "  DB container:             $DB_CONTAINER"
echo "  TokenId:                  $TOKEN_ID"
echo "  Authorization proof type: $PHASE5_AUTHORIZATION_PROOF_TYPE"
echo "  Delegation verification:  controlled cryptographic Demo2"
echo "  Lifecycle enforcement:    enabled - PR #297"
echo "  Agent Registry lookup:    disabled"
echo "  Phase 5 production mode:  disabled"
echo "  Positive buyer:           $POSITIVE_BUYER_REGION / ageOver=$POSITIVE_BUYER_AGE_OVER"
echo "  Negative buyer:           $NEGATIVE_BUYER_REGION / ageOver=$NEGATIVE_BUYER_AGE_OVER"
echo "  Preflight only:           $PHASE5_DEMO2_PREFLIGHT_ONLY"
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
    .phase5.cryptographicDelegationRuntimeEnabled == true and
    .phase5.cryptographicDelegationRuntimeActive == true and
    .phase5.delegationLifecycleEnforcementEnabled == true and
    .phase5.delegationLifecycleEnforcementActive == true and
    .phase5.buyerVerificationKeyPathConfigured == true and
    .phase5.buyerVerificationKeyLoaded == true and
    .phase5.mode == "controlled_e2e_demo" and
    .phase5.authorizationProofType == $proofType and
    .phase5.cryptographicDelegationVerification == false and
    .phase5.agentRegistryLookupAttempted == false and
    .phase5.productionActivation == false
  ' "$WORKDIR/gateway-health.json" >/dev/null \
  || fail "Gateway Phase 5 controlled runtime is not enabled or honesty flags are invalid"

echo "Service readiness: ok"
echo "Phase 5 controlled runtime enabled: true"
echo "Cryptographic runtime active: true"
echo "Delegation lifecycle enforcement enabled: true"
echo "Delegation lifecycle enforcement active: true"
echo "Buyer verification key loaded: true"
echo "Per-request cryptographic verification pending: true"
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

  echo "$prefix challenge issued: true"
  echo "  Challenge nonce generated: true"
  echo "  Payment amount: $amount $TOKEN_ID"
  echo "  Payment destination bound: true"
}

build_agent_delegated_auth() {
  local prefix="$1"
  local region="$2"
  local age_over="$3"

  local structural_log="$WORKDIR/$prefix-structural-helper.json"
  local structural_err="$WORKDIR/$prefix-structural-helper.err"
  local cryptographic_log="$WORKDIR/$prefix-cryptographic-helper.json"
  local cryptographic_err="$WORKDIR/$prefix-cryptographic-helper.err"

  if ! npm exec -- ts-node --transpile-only \
    scripts/demo_agent_delegated_authorization_proof.ts \
    --payment-required "$WORKDIR/$prefix-gated-pr.json" \
    --out "$WORKDIR/$prefix-agent-delegated-structural-auth.json" \
    --region "$region" \
    --age-over "$age_over" \
    --agent-id "$PHASE5_AGENT_ID" \
    --policy-subject "$PHASE5_BUYER_ID" \
    > "$structural_log" \
    2> "$structural_err"
  then
    echo
    echo "$prefix structural helper diagnostics:" >&2
    sed 's/^/  /' "$structural_err" >&2 || true
    sed 's/^/  /' "$structural_log" >&2 || true
    fail "$prefix structural authorization helper failed"
  fi

  jq -e '
    .ok == true and
    .rawProofPrinted == false and
    .paymentAttempted == false and
    .productionActivation == false
  ' "$structural_log" >/dev/null || {
    echo
    echo "$prefix unexpected structural helper result:" >&2
    sed 's/^/  /' "$structural_log" >&2 || true
    fail "$prefix structural authorization helper returned an invalid result"
  }

  echo "$prefix structural authorization envelope built: true"

  if ! npm exec -- ts-node --transpile-only \
    scripts/demo_agent_delegated_cryptographic_authorization_proof.ts \
    --input "$WORKDIR/$prefix-agent-delegated-structural-auth.json" \
    --key-bundle "$KEYDIR/phase5-cryptographic-key-bundle.json" \
    --out "$WORKDIR/$prefix-agent-delegated-auth.json" \
    > "$cryptographic_log" \
    2> "$cryptographic_err"
  then
    echo
    echo "$prefix cryptographic helper diagnostics:" >&2
    sed 's/^/  /' "$cryptographic_err" >&2 || true
    sed 's/^/  /' "$cryptographic_log" >&2 || true
    fail "$prefix cryptographic authorization helper failed"
  fi

  jq -e '
    .ok == true and
    .delegationContractValidated == true and
    .buyerSignatureVerified == true and
    .agentProofOfPossessionVerified == true and
    .privateMaterialPrinted == false and
    .paymentAttempted == false and
    .productionActivation == false
  ' "$cryptographic_log" >/dev/null || {
    echo
    echo "$prefix unexpected cryptographic helper result:" >&2
    sed 's/^/  /' "$cryptographic_log" >&2 || true
    fail "$prefix cryptographic authorization helper returned an invalid result"
  }

  echo "$prefix cryptographic delegation proof built: true"
}

submit_agent_delegated_auth() {
  local prefix="$1"
  local body_path="${2:-$WORKDIR/$prefix-agent-delegated-auth.json}"

  curl -sS -D "$WORKDIR/$prefix-auth-headers.txt" -o "$WORKDIR/$prefix-auth-body.json" \
    -X POST "$GW/paid-gated/redeem" \
    -H 'content-type: application/json' \
    --data-binary @"$body_path" >/dev/null

  local status
  status="$(http_status "$WORKDIR/$prefix-auth-headers.txt")"
  echo "$prefix Agent-delegated authorization status: $status"
}

payment_signature_b64() {
  local nonce="$1"
  node -e "process.stdout.write(Buffer.from(JSON.stringify({ nonce: process.argv[1] }), 'utf8').toString('base64'))" "$nonce"
}

tamper_signature_byte() {
  local input_path="$1"
  local target="$2"
  local output_path="$3"

  INPUT_PATH="$input_path" \
  TARGET_SIGNATURE="$target" \
  OUTPUT_PATH="$output_path" \
  python - <<'PY_MUTATE_SIGNATURE'
import base64
import copy
import json
import os
from pathlib import Path

input_path = Path(
    os.environ["INPUT_PATH"]
)

output_path = Path(
    os.environ["OUTPUT_PATH"]
)

target = os.environ[
    "TARGET_SIGNATURE"
]

signature_paths = {
    "buyer": (
        "authorizationProof",
        "cryptographicProofs",
        "delegationCredential",
        "proof",
        "signatureValue",
    ),
    "agent": (
        "authorizationProof",
        "cryptographicProofs",
        "agentProofOfPossession",
        "proof",
        "signatureValue",
    ),
}

if target not in signature_paths:
    raise SystemExit(
        f"unsupported signature target: {target}"
    )

signature_path = signature_paths[target]

source = json.loads(
    input_path.read_text(
        encoding="utf-8"
    )
)

mutated = copy.deepcopy(
    source
)

cursor = mutated

for field in signature_path[:-1]:
    child = cursor.get(field)

    if not isinstance(child, dict):
        raise SystemExit(
            "missing object at "
            + ".".join(
                signature_path[:-1]
            )
        )

    cursor = child

signature_field = signature_path[-1]
signature = cursor.get(
    signature_field
)

if not isinstance(signature, str) or not signature:
    raise SystemExit(
        "missing signature at "
        + ".".join(signature_path)
    )

padding = "=" * (
    -len(signature) % 4
)

try:
    decoded = bytearray(
        base64.urlsafe_b64decode(
            signature + padding
        )
    )
except Exception as error:
    raise SystemExit(
        f"signature decoding failed: {error}"
    )

if len(decoded) != 64:
    raise SystemExit(
        "expected 64-byte Ed25519 signature, "
        f"got {len(decoded)}"
    )

# Flip exactly one bit while preserving valid base64url encoding.
decoded[-1] ^= 0x01

tampered_signature = (
    base64.urlsafe_b64encode(
        bytes(decoded)
    )
    .decode("ascii")
    .rstrip("=")
)

if tampered_signature == signature:
    raise SystemExit(
        "signature mutation produced no change"
    )

cursor[signature_field] = (
    tampered_signature
)


def changed_paths(
    left,
    right,
    prefix=(),
):
    if type(left) is not type(right):
        return [prefix]

    if isinstance(left, dict):
        differences = []

        for key in sorted(
            set(left) | set(right)
        ):
            if key not in left or key not in right:
                differences.append(
                    prefix + (key,)
                )
                continue

            differences.extend(
                changed_paths(
                    left[key],
                    right[key],
                    prefix + (key,),
                )
            )

        return differences

    if isinstance(left, list):
        if len(left) != len(right):
            return [prefix]

        differences = []

        for index, (
            left_item,
            right_item,
        ) in enumerate(
            zip(left, right)
        ):
            differences.extend(
                changed_paths(
                    left_item,
                    right_item,
                    prefix + (str(index),),
                )
            )

        return differences

    return (
        []
        if left == right
        else [prefix]
    )


differences = changed_paths(
    source,
    mutated,
)

if differences != [signature_path]:
    rendered = [
        ".".join(item)
        for item in differences
    ]

    raise SystemExit(
        "unexpected mutated fields: "
        + json.dumps(rendered)
    )

output_path.write_text(
    json.dumps(
        mutated,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
    newline="",
)

print(
    f"{target} signature mutation: true"
)

print(
    "mutated field: "
    + ".".join(signature_path)
)

print(
    "valid base64url signature length preserved: true"
)

print(
    "non-signature document fields preserved: true"
)

print(
    "private material printed: false"
)
PY_MUTATE_SIGNATURE
}

assert_cryptographic_rejection() {
  local prefix="$1"
  local expected_reason="$2"
  local expected_buyer_signature_verified="$3"
  local expected_agent_key_bound="$4"

  local status

  status="$(
    http_status \
      "$WORKDIR/$prefix-auth-headers.txt"
  )"

  [[ "$status" == "403" ]] \
    || fail "$prefix: expected cryptographic rejection status 403, got $status"

  jq -e \
    --arg reason "$expected_reason" \
    --argjson buyerSignatureVerified "$expected_buyer_signature_verified" \
    --argjson agentKeyBound "$expected_agent_key_bound" \
    '
      .ok == false and
      .code == $reason and
      .reason == $reason and
      .policyStatus == "POLICY_FAILED" and
      .policyDecision == null and

      .verifier.ok == false and
      .verifier.authorizationAccepted == false and
      .verifier.authorizationReason == $reason and
      .verifier.canonicalChallengeAccepted == true and
      .verifier.contractBindingAccepted == true and
      .verifier.policyEvaluated == false and
      .verifier.policyDecision == "not_evaluated" and
      .verifier.rawProofPrinted == false and

      .verifier.cryptographicDelegationVerification == false and
      .verifier.delegationContractValidated == true and
      .verifier.buyerSignatureVerified == $buyerSignatureVerified and
      .verifier.agentPublicKeyBoundByBuyerSignature == $agentKeyBound and
      .verifier.agentProofOfPossessionVerified == false and
      .verifier.cryptographicAuthorizationReason == $reason and
      .verifier.cryptographicBindingReason == null and
      (.verifier.cryptographicMismatchFields | length) == 0 and

      .verifier.verifiedDelegationDocumentMatched == false and
      .verifier.outerDelegationIdentityBound == false and
      .verifier.buyerPolicySubjectBound == false and
      .verifier.signedScopeBound == false and
      .verifier.signedPaymentTupleBound == false and
      .verifier.credentialValidityCoversChallenge == false and
      .verifier.signedUsageBound == false and
      .verifier.signedReplayBound == false and

      .verifier.buyerVerificationKeyTrustEstablished == false and
      .verifier.buyerIdentityAuthenticated == false and
      .verifier.currentAuthorizationEstablished == false and
      .verifier.validityEvaluatedAgainstClock == false and
      .verifier.revocationChecked == false and
      .verifier.boundedUseConsumed == false and
      .verifier.agentRegistryLookupAttempted == false and
      .verifier.productionActivation == false and

      .phase5.policyStateMutated == true and
      .phase5.cryptographicDelegationRuntimeEnabled == true and
      .phase5.cryptographicDelegationRuntimeActive == true and
      .phase5.buyerVerificationKeyLoaded == true and
      .phase5.cryptographicDelegationVerification == false and
      .phase5.delegationContractValidated == true and
      .phase5.buyerSignatureVerified == $buyerSignatureVerified and
      .phase5.agentPublicKeyBoundByBuyerSignature == $agentKeyBound and
      .phase5.agentProofOfPossessionVerified == false and
      .phase5.credentialValidityCoversChallenge == false and
      .phase5.buyerVerificationKeyTrustEstablished == false and
      .phase5.buyerIdentityAuthenticated == false and
      .phase5.currentAuthorizationEstablished == false and
      .phase5.validityEvaluatedAgainstClock == false and
      .phase5.revocationChecked == false and
      .phase5.boundedUseConsumed == false and
      .phase5.agentRegistryLookupAttempted == false and
      .phase5.productionActivation == false
    ' "$WORKDIR/$prefix-auth-body.json" \
    >/dev/null \
    || fail "$prefix: cryptographic rejection contract did not match"
}

assert_protected_resource_not_released() {
  local prefix="$1"

  local nonce
  local payment_signature
  local status
  local payment_response

  nonce="$(
    jq -r \
      '.nonce' \
      "$WORKDIR/$prefix-gated-pr.json"
  )"

  payment_signature="$(
    payment_signature_b64 \
      "$nonce"
  )"

  curl -sS \
    -D "$WORKDIR/$prefix-blocked-headers.txt" \
    -o "$WORKDIR/$prefix-blocked-body.json" \
    "$GW/paid-gated?nonce=$nonce" \
    -H "PAYMENT-SIGNATURE: $payment_signature" \
    >/dev/null

  status="$(
    http_status \
      "$WORKDIR/$prefix-blocked-headers.txt"
  )"

  payment_response="$(
    header_value \
      "$WORKDIR/$prefix-blocked-headers.txt" \
      "payment-response"
  )"

  [[ "$status" == "402" ]] \
    || fail "$prefix: rejected path expected protected-resource status 402, got $status"

  [[ -z "$payment_response" ]] \
    || fail "$prefix: rejected path must not emit PAYMENT-RESPONSE"

  if jq -e \
    '.resource == "secret-data"' \
    "$WORKDIR/$prefix-blocked-body.json" \
    >/dev/null 2>&1
  then
    fail "$prefix: rejected path must not release protected resource"
  fi
}

say "PATH 1 OF 4 - Invalid buyer signature"
echo "Viewer guide: the buyer-signed delegation is intentionally tampered."
echo "Expected outcome: cryptographic rejection before policy; no payment and no release."

issue_challenge \
  "invalid-buyer-signature"

build_agent_delegated_auth \
  "invalid-buyer-signature" \
  "$POSITIVE_BUYER_REGION" \
  "$POSITIVE_BUYER_AGE_OVER"

tamper_signature_byte \
  "$WORKDIR/invalid-buyer-signature-agent-delegated-auth.json" \
  "buyer" \
  "$WORKDIR/invalid-buyer-signature-agent-delegated-auth-tampered.json"

submit_agent_delegated_auth \
  "invalid-buyer-signature" \
  "$WORKDIR/invalid-buyer-signature-agent-delegated-auth-tampered.json"

assert_cryptographic_rejection \
  "invalid-buyer-signature" \
  "buyer_signature_verification_failed" \
  false \
  false

assert_protected_resource_not_released \
  "invalid-buyer-signature"

INVALID_BUYER_SIGNATURE_NONCE="$(
  jq -r \
    '.nonce' \
    "$WORKDIR/invalid-buyer-signature-gated-pr.json"
)"

echo "PATH 1 RESULT - REJECTED SAFELY"
echo "  structurally valid envelope generated first: true"
echo "  buyer signature verification failed: true"
echo "  policy evaluated: false"
echo "  policy decision: not_evaluated"
echo "  payment attempted: false"
echo "  CRP fulfill attempted: false"
echo "  PAYMENT-RESPONSE emitted: false"
echo "  protected resource released: false"

say "PATH 2 OF 4 - Invalid agent proof-of-possession"
echo "Viewer guide: the buyer delegation is valid, but the agent proof is intentionally tampered."
echo "Expected outcome: cryptographic rejection before policy; no payment and no release."

issue_challenge \
  "invalid-agent-pop"

build_agent_delegated_auth \
  "invalid-agent-pop" \
  "$POSITIVE_BUYER_REGION" \
  "$POSITIVE_BUYER_AGE_OVER"

tamper_signature_byte \
  "$WORKDIR/invalid-agent-pop-agent-delegated-auth.json" \
  "agent" \
  "$WORKDIR/invalid-agent-pop-agent-delegated-auth-tampered.json"

submit_agent_delegated_auth \
  "invalid-agent-pop" \
  "$WORKDIR/invalid-agent-pop-agent-delegated-auth-tampered.json"

assert_cryptographic_rejection \
  "invalid-agent-pop" \
  "agent_proof_verification_failed" \
  true \
  true

assert_protected_resource_not_released \
  "invalid-agent-pop"

INVALID_AGENT_POP_NONCE="$(
  jq -r \
    '.nonce' \
    "$WORKDIR/invalid-agent-pop-gated-pr.json"
)"

echo "PATH 2 RESULT - REJECTED SAFELY"
echo "  buyer signature verified: true"
echo "  agent public key bound by buyer signature: true"
echo "  agent proof-of-possession verification failed: true"
echo "  policy evaluated: false"
echo "  policy decision: not_evaluated"
echo "  payment attempted: false"
echo "  CRP fulfill attempted: false"
echo "  PAYMENT-RESPONSE emitted: false"
echo "  protected resource released: false"

say "PATH 3 OF 4 - Authenticated agent with ineligible buyer"
echo "Viewer guide: both signatures are valid, so buyer policy is evaluated."
echo "Expected outcome: policy denial before payment; no receipt and no release."
issue_challenge "negative"
build_agent_delegated_auth "negative" "$NEGATIVE_BUYER_REGION" "$NEGATIVE_BUYER_AGE_OVER"
submit_agent_delegated_auth "negative"

NEGATIVE_AUTH_STATUS="$(http_status "$WORKDIR/negative-auth-headers.txt")"
[[ "$NEGATIVE_AUTH_STATUS" == "403" ]] || fail "negative path expected 403 before payment, got $NEGATIVE_AUTH_STATUS"

jq -e '.ok == false and .policyStatus == "POLICY_FAILED"' "$WORKDIR/negative-auth-body.json" >/dev/null \
  || fail "negative path expected POLICY_FAILED"

jq -e '
  .reason == "age_requirement_not_met" and
  .verifier.ok == false and
  .verifier.policyEvaluated == true and
  .verifier.rawProofPrinted == false and

  .verifier.cryptographicDelegationVerification == true and
  .verifier.delegationContractValidated == true and
  .verifier.buyerSignatureVerified == true and
  .verifier.agentPublicKeyBoundByBuyerSignature == true and
  .verifier.agentProofOfPossessionVerified == true and

  .verifier.verifiedDelegationDocumentMatched == true and
  .verifier.outerDelegationIdentityBound == true and
  .verifier.buyerPolicySubjectBound == true and
  .verifier.signedScopeBound == true and
  .verifier.signedPaymentTupleBound == true and
  .verifier.credentialValidityCoversChallenge == true and
  .verifier.signedUsageBound == true and
  .verifier.signedReplayBound == true and

  .verifier.buyerVerificationKeyTrustEstablished == false and
  .verifier.buyerIdentityAuthenticated == false and
  .verifier.currentAuthorizationEstablished == false and
  .verifier.validityEvaluatedAgainstClock == true and
  .verifier.revocationChecked == true and
  .verifier.boundedUseConsumed == false and
  .verifier.agentRegistryLookupAttempted == false and
  .verifier.productionActivation == false and

  .phase5.cryptographicDelegationRuntimeEnabled == true and
  .phase5.cryptographicDelegationRuntimeActive == true and
  .phase5.buyerVerificationKeyLoaded == true and
  .phase5.cryptographicDelegationVerification == true and
  .phase5.delegationContractValidated == true and
  .phase5.buyerSignatureVerified == true and
  .phase5.agentPublicKeyBoundByBuyerSignature == true and
  .phase5.agentProofOfPossessionVerified == true and
  .phase5.credentialValidityCoversChallenge == true and
  .phase5.buyerVerificationKeyTrustEstablished == false and
  .phase5.buyerIdentityAuthenticated == false and
  .phase5.currentAuthorizationEstablished == false and
  .phase5.validityEvaluatedAgainstClock == true and
    .phase5.credentialCurrentlyValid == true and
  .phase5.revocationChecked == true and
    .phase5.delegationRevoked == false and
  .phase5.boundedUseConsumed == false and
  .phase5.agentRegistryLookupAttempted == false and
  .phase5.productionActivation == false
' "$WORKDIR/negative-auth-body.json" >/dev/null \
  || fail "negative path expected verified cryptographic delegation followed by policy denial"

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

echo "PATH 3 RESULT - POLICY DENIED SAFELY"
echo "  cryptographic delegation verified: true"
echo "  signed runtime bindings matched: true"
echo "  POLICY_FAILED: true"
echo "  payment attempted: false"
echo "  CRP fulfill attempted: false"
echo "  PAYMENT-RESPONSE emitted: false"
echo "  protected resource released: false"

say "PATH 4 OF 4 - Authenticated agent with eligible buyer"
echo "Viewer guide: cryptography, lifecycle, and policy must all pass before payment."

if [[ "$PHASE5_DEMO2_PREFLIGHT_ONLY" == "true" ]]; then
  echo "Expected outcome: authorization and bounded-use claim succeed; payment is intentionally skipped."
else
  echo "Expected outcome: finalized payment, receipt redemption, release, then replay rejection."
fi
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
    .verifier.authorizationAccepted == true and
    .verifier.canonicalChallengeAccepted == true and
    .verifier.contractBindingAccepted == true and
    .verifier.policyEvaluated == true and
    .verifier.rawProofPrinted == false and

    .verifier.cryptographicDelegationVerification == true and
    .verifier.delegationContractValidated == true and
    .verifier.buyerSignatureVerified == true and
    .verifier.agentPublicKeyBoundByBuyerSignature == true and
    .verifier.agentProofOfPossessionVerified == true and

    .verifier.verifiedDelegationDocumentMatched == true and
    .verifier.outerDelegationIdentityBound == true and
    .verifier.buyerPolicySubjectBound == true and
    .verifier.signedScopeBound == true and
    .verifier.signedPaymentTupleBound == true and
    .verifier.credentialValidityCoversChallenge == true and
    .verifier.signedUsageBound == true and
    .verifier.signedReplayBound == true and

    .verifier.buyerVerificationKeyTrustEstablished == false and
    .verifier.buyerIdentityAuthenticated == false and
    .verifier.currentAuthorizationEstablished == true and
    .verifier.validityEvaluatedAgainstClock == true and
    .verifier.revocationChecked == true and
    .verifier.boundedUseConsumed == true and
    .verifier.agentRegistryLookupAttempted == false and
    .verifier.productionActivation == false and

    .phase5.mode == "controlled_e2e_demo" and
    .phase5.cryptographicDelegationRuntimeEnabled == true and
    .phase5.cryptographicDelegationRuntimeActive == true and
    .phase5.buyerVerificationKeyLoaded == true and
    .phase5.cryptographicDelegationVerification == true and
    .phase5.delegationContractValidated == true and
    .phase5.buyerSignatureVerified == true and
    .phase5.agentPublicKeyBoundByBuyerSignature == true and
    .phase5.agentProofOfPossessionVerified == true and
    .phase5.credentialValidityCoversChallenge == true and
    .phase5.buyerVerificationKeyTrustEstablished == false and
    .phase5.buyerIdentityAuthenticated == false and
    .phase5.currentAuthorizationEstablished == true and
    .phase5.validityEvaluatedAgainstClock == true and
    .phase5.credentialCurrentlyValid == true and
    .phase5.revocationChecked == true and
    .phase5.delegationRevoked == false and
    .phase5.boundedUseChecked == true and
    .phase5.boundedUseConsumed == true and
    .phase5.usageClaimReason == "claimed" and
    .phase5.usageClaimCreated == true and
    .phase5.usageClaimIdempotent == false and
    .phase5.delegationUseCount == 1 and
    .phase5.delegationMaxUses == 1 and
    .phase5.delegationUseNumber == 1 and
    .phase5.lifecyclePolicyStateMutated == true and
    .phase5.agentRegistryLookupAttempted == false and
    .phase5.productionActivation == false
  ' "$WORKDIR/positive-auth-body.json" >/dev/null \
  || fail "positive path expected verified cryptographic delegation and controlled policy satisfaction"

POSITIVE_NONCE="$(jq -r '.nonce' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_MERCHANT_ID="$(jq -r '.merchantId' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_PAY_TO="$(jq -r '.payTo' "$WORKDIR/positive-gated-pr.json")"
POSITIVE_AMOUNT="$(jq -r '.amount' "$WORKDIR/positive-gated-pr.json")"

if [[ "$PHASE5_DEMO2_PREFLIGHT_ONLY" == "true" ]]; then
  echo
  echo "============================================================"
  echo "Demo2 no-payment preflight complete"
  echo "  dedicated Gateway started: true"
  echo "  temporary buyer key loaded: true"
  echo "  invalid buyer signature rejection verified: true"
  echo "  invalid agent proof rejection verified: true"
  echo "  cryptographic rejection before policy verified: true"
  echo "  negative cryptographic authorization verified: true"
  echo "  negative policy denial verified: true"
  echo "  positive cryptographic authorization verified: true"
  echo "  delegation lifecycle enforcement active: true"
  echo "  positive current authorization established: true"
  echo "  positive bounded-use claim created: true"
  echo "  positive delegation use count: 1 / 1"
  echo "  positive policy satisfaction verified: true"
  echo "  payment and release intentionally skipped: true"
  echo "  CRP payment created: false"
  echo "  PLT payment attempted: false"
  echo "  receipt requested: false"
  echo "  protected resource released: false"
  echo "  production activation: false"
  echo "============================================================"
  exit 0
fi

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
print("Payment request prepared: true")
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
echo "PLT transfer submitted: true"
echo "  Transaction identifier captured: true"
echo "  Raw transaction hash printed: false"

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

echo "PATH 4 RESULT - PAYMENT FINALIZED AND RESOURCE RELEASED"
echo "  cryptographic delegation verified: true"
echo "  signed runtime bindings matched: true"
echo "  delegation lifecycle enforcement active: true"
echo "  current authorization established: true"
echo "  bounded-use claim created: true"
echo "  delegation use count: 1 / 1"
echo "  POLICY_SATISFIED: true"
echo "  receipt JWS present: true"
echo "  PAYMENT-RESPONSE emitted: true"
echo "  raw PAYMENT-RESPONSE printed: false"
echo "  protected resource released: true"
echo "  protected resource payload verified: true"

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

say "Verifying final canonical state"

if ! docker exec \
  -i \
  "$DB_CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -P pager=off \
  -c \
"SELECT nonce, status, release_status, updated_at
 FROM payment_challenges
 WHERE nonce IN (
   '$INVALID_BUYER_SIGNATURE_NONCE',
   '$INVALID_AGENT_POP_NONCE',
   '$NEGATIVE_NONCE',
   '$POSITIVE_NONCE'
 )
 ORDER BY updated_at ASC;" \
  > "$FINAL_CANONICAL_STATE_LOG" \
  2>&1
then
  echo
  echo "Final canonical-state diagnostics:" >&2
  sed 's/^/  /' "$FINAL_CANONICAL_STATE_LOG" >&2 || true
  fail "Could not read final canonical challenge state"
fi

[[ -s "$FINAL_CANONICAL_STATE_LOG" ]] \
  || fail "Final canonical-state evidence was empty"

echo "Final canonical challenge states captured: true"
echo "Raw canonical database rows printed: false"

say "Verifying positive transition chain"

if ! docker exec \
  -i \
  "$DB_CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -P pager=off \
  -c \
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
 ORDER BY gst.created_at ASC;" \
  > "$POSITIVE_TRANSITION_CHAIN_LOG" \
  2>&1
then
  echo
  echo "Positive transition-chain diagnostics:" >&2
  sed 's/^/  /' "$POSITIVE_TRANSITION_CHAIN_LOG" >&2 || true
  fail "Could not read the positive canonical transition chain"
fi

[[ -s "$POSITIVE_TRANSITION_CHAIN_LOG" ]] \
  || fail "Positive transition-chain evidence was empty"

echo "Positive canonical transition chain captured: true"
echo "Raw transition database rows printed: false"

echo
echo "============================================================"
echo "Final result: x402 v2 Agent-Delegated Cryptographic Demo2 complete"
echo "  PR #297 lifecycle enforcement: active"
echo "  PATH 1 - Invalid buyer signature: rejected before policy; no payment"
echo "  PATH 2 - Invalid agent proof: rejected before policy; no payment"
echo "  PATH 3 - Ineligible buyer: policy denied before payment"
echo "  PATH 4 - Eligible buyer: payment finalized and resource released"
echo "  Canonical state and transition evidence: captured"
echo "  Replay after release: blocked"
echo "  Agent Registry lookup: disabled"
echo "  Production activation: false"
echo "============================================================"
