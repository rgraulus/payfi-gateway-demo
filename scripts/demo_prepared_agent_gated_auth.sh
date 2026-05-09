#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS on Windows can rewrite paths unexpectedly.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

GW="${GW:-http://localhost:3005}"
WORKDIR="${WORKDIR:-.demo-prepared-agent-gated-auth}"

# Demo prepared-agent defaults.
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
    "$WORKDIR"/auth-negative.json \
    "$WORKDIR"/auth-negative-response.txt
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

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_cmd curl
require_cmd jq
require_cmd base64

echo
echo "============================================================"
echo " Concordium Conditional Access Demo — Prepared Agent Auth"
echo " Scenario: Online alcohol purchase"
echo " Agent mode: prepared authorizationProof"
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
CHAIN_ID="$(jq -r '.chain_id // empty' "$WORKDIR/gated-pr.json")"

[[ -n "$NONCE" && "$NONCE" != "null" ]] || fail "PAYMENT-REQUIRED missing nonce"
[[ -n "$CONTRACT_ID" && "$CONTRACT_ID" != "null" ]] || fail "PAYMENT-REQUIRED missing contractId"

echo "Challenge issued"
echo "  Nonce:      $NONCE"
echo "  ContractId: $CONTRACT_ID"
echo "  ChainId:    ${CHAIN_ID:-<missing>}"

say "Policy requirements advertised by Gateway"
jq '.policyRequirements' "$WORKDIR/gated-pr.json"

if [[ "$(jq -r '.policyRequirements.required // false' "$WORKDIR/gated-pr.json")" != "true" ]]; then
  fail "Expected policyRequirements.required=true for /paid-gated"
fi

say "Building prepared-agent authorizationProof"
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

cat "$WORKDIR/auth-positive.json" | jq .

say "Submitting prepared-agent authorizationProof"
curl -sS -i -X POST "$GW/paid-gated/redeem" \
  -H 'content-type: application/json' \
  --data-binary @"$WORKDIR/auth-positive.json" \
  | tee "$WORKDIR/auth-positive-response.txt"

grep -q '200 OK' "$WORKDIR/auth-positive-response.txt" || fail "Expected prepared-agent authorizationProof to succeed"
grep -q '"policyStatus":"POLICY_SATISFIED"' "$WORKDIR/auth-positive-response.txt" || fail "Expected POLICY_SATISFIED"
grep -q '"type":"demo_policy_verifier_v1"' "$WORKDIR/auth-positive-response.txt" || fail "Expected verifier audit type"

echo
echo "Result: PREPARED AGENT AUTHORIZATION SATISFIED"

say "Running negative nonce-binding check"
jq -n \
  --arg nonce "$NONCE" \
  --arg badNonce "wrong-$NONCE" \
  --arg subject "$AGENT_SUBJECT_ACCOUNT_ID" \
  --arg issuer "$AGENT_ISSUER" \
  --arg region "$AGENT_REGION" \
  --argjson ageOver "$AGENT_AGE_OVER" \
  '{
    nonce: $nonce,
    authorizationProof: {
      type: "agent_attestation_v1",
      nonce: $badNonce,
      policyKind: "composite",
      subjectAccountId: $subject,
      issuer: $issuer,
      claims: {
        region: $region,
        ageOver: $ageOver
      },
      signature: "demo-signature-placeholder"
    }
  }' > "$WORKDIR/auth-negative.json"

curl -sS -i -X POST "$GW/paid-gated/redeem" \
  -H 'content-type: application/json' \
  --data-binary @"$WORKDIR/auth-negative.json" \
  | tee "$WORKDIR/auth-negative-response.txt"

grep -q '409 Conflict' "$WORKDIR/auth-negative-response.txt" || fail "Expected nonce mismatch to return 409 Conflict"
grep -q '"code":"policy_binding_mismatch"' "$WORKDIR/auth-negative-response.txt" || fail "Expected policy_binding_mismatch"

echo
echo "Result: NEGATIVE NONCE-BINDING CHECK PASSED"
echo
echo "Prepared-agent gated authorization demo completed successfully."
