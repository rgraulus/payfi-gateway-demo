# Phase 4 Final Demo Composition Design Checkpoint

## Purpose

This checkpoint defines the final Phase 4 demo-composition target.

The goal is to turn the proven Phase 3 Direct Buyer ZKP Path and the proven Phase 4 Settlement / Receipt / Release Path into a live, end-to-end x402 v2 demo script.

This is a design checkpoint only.

It does not:

- add a new runtime path;
- change Gateway behavior;
- change CRP/facilitator behavior;
- execute a live payment;
- call CRP fulfill;
- emit `PAYMENT-RESPONSE`;
- release a protected resource;
- mutate replay/canonical persistence;
- enable production release;
- activate production;
- print raw receipt JWS material;
- print raw `PAYMENT-RESPONSE` material;
- print raw Direct Buyer proof material.

## Agreed Phase 4 Final Objective

The final Phase 4 objective is:

```text
Create a live, end-to-end x402 v2 demo script that extends the existing
./scripts/demo_human_gated.sh flow and replaces the human-gated policy step
with the Direct Buyer ZKP Path, composed with the Phase 4 settlement /
receipt / release path.
```

This is not Phase 5 and not production activation.

The agreed framing is:

```text
Phase 3: Live Direct Buyer ZKP Path
Phase 4: Settlement Path + Final Demo Composition
Final Phase 4 goal: live end-to-end x402 v2 Direct Buyer demo
```

## Inspection Summary

The following scripts were inspected:

```text
scripts/demo_human_gated.sh
scripts/demo_prepared_agent_gated_auth.sh
scripts/demo_prepared_agent_gated_e2e.sh
scripts/ci_phase3_controlled_live_direct_buyer_release_demo.ts
scripts/ci_phase4_controlled_live_rehearsal_execution_happy_path.ts
```

The package scripts confirm the relevant existing harnesses:

```text
phase3:controlled-live-direct-buyer-release-demo-test
phase4:controlled-live-rehearsal-execution-happy-path-test
```

## Key Finding

The existing `demo_human_gated.sh` already contains the live E2E settlement spine:

```text
issue PAYMENT-REQUIRED
→ submit policy evidence
→ create CRP payment record
→ submit Concordium PLT payment
→ wait for indexed transfer
→ call CRP fulfill
→ fetch receipt JWS
→ submit receipt JWS to Gateway
→ Gateway releases protected resource
→ read canonical state
→ read transition chain
```

Therefore, the Final Demo Composition does not need to reinvent the settlement path.

The replacement point is the current manual policy step.

## Exact Replacement Point

The current human-gated script performs:

```text
manual buyer input
→ manual region / age policy evidence
→ POST /paid-gated/redeem with policyEvidence
```

The final demo script should replace that with:

```text
Direct Buyer wallet proof capture
→ runtime challenge binding
→ authorizationProof construction
→ POST /paid-gated/redeem with authorizationProof
```

The downstream settlement/release flow should remain structurally close to the existing E2E demo scripts.

## Relevant Existing Flows

### Baseline Human-Gated E2E Flow

Source:

```text
scripts/demo_human_gated.sh
```

Useful parts to preserve:

```text
Git Bash / MSYS path guards
GW / CRP / DB / wallet env defaults
workdir cleanup
PAYMENT-REQUIRED header extraction
gated-pr.json decoding
CRP payment payload construction
CRP payment create
payer:plt invocation
indexed transfer polling
CRP fulfill retry loop
receipt JWS polling
Gateway receipt redeem
canonical DB state query
transition-chain DB query
```

Parts to replace:

```text
manual region prompt
manual age prompt
policyEvidence JSON body
human pause before Concordium payment
```

### Prepared-Agent E2E Flow

Source:

```text
scripts/demo_prepared_agent_gated_e2e.sh
```

Useful parts to preserve or mirror:

```text
non-interactive authorization defaults
authorizationProof POST shape
policyRequirements verification
CRP payment payload includes policy metadata
full CRP / PLT / receipt / redeem E2E spine
```

Parts not sufficient for final composition:

```text
prepared-agent authorizationProof uses a placeholder demo signature
prepared-agent mode is not the Direct Buyer ZKP Path
```

### Phase 3 Direct Buyer Demo

Source:

```text
scripts/ci_phase3_controlled_live_direct_buyer_release_demo.ts
```

Useful parts to reuse conceptually:

```text
wallet/direct-buyer proof-backed policy evidence
normalizeWalletProofCapture
runtime challenge construction from PAYMENT-REQUIRED
challenge hash binding
authorizationProof construction
POST /paid-gated/redeem with authorizationProof
eligible POLICY_SATISFIED path
ineligible POLICY_FAILED path
replay rejection expectations
raw proof not printed
```

Parts not sufficient for final composition:

```text
it starts its own controlled demo Gateway
it starts a dev JWKS issuer
it uses synthetic finalized receipt minting
it does not claim broad production CRP fulfill execution
it does not use the real live/testnet CRP/PLT/receipt spine
```

### Phase 4 Happy Path Harness

Source:

```text
scripts/ci_phase4_controlled_live_rehearsal_execution_happy_path.ts
```

Useful parts to preserve as safety expectations:

```text
safe-by-default gating
explicit operator acknowledgements
production release disabled
raw receipt JWS not printed
raw PAYMENT-RESPONSE not printed
real receipt verification
release decision
PAYMENT-RESPONSE emission
protected resource release
replay/canonical persistence
second-use block
```

Parts not directly suited as the user-facing demo script:

```text
it is a CI-style harness
it requires many explicit harness env vars
it is not a simple human-readable demo script
it is not an extension of demo_human_gated.sh
```

## Design Decision

The next implementation PR should add a sibling demo script, not mutate `demo_human_gated.sh` first.

Recommended script name:

```text
scripts/demo_x402_v2_direct_buyer_e2e.sh
```

Alternative acceptable name:

```text
scripts/demo_direct_buyer_zkp_gated_e2e.sh
```

Preferred package script, if one is added:

```text
demo:x402-v2-direct-buyer-e2e
```

The existing human-gated script remains the baseline.

## Proposed Final Demo Flow

The final demo script should perform:

```text
1. Validate local tools and required inputs.
2. Validate wallet file exists.
3. Validate Direct Buyer proof capture file exists.
4. Issue /paid-gated x402 challenge.
5. Decode PAYMENT-REQUIRED into gated-pr.json.
6. Validate policyRequirements.required=true.
7. Build runtime challenge from PAYMENT-REQUIRED.
8. Bind Direct Buyer proof to runtime challenge.
9. POST /paid-gated/redeem with authorizationProof.
10. Require POLICY_SATISFIED.
11. Build CRP payment payload from PAYMENT-REQUIRED.
12. Create CRP payment record.
13. Submit Concordium PLT payment using payer:plt.
14. Wait for indexed PLT transfer.
15. Call CRP fulfill with txHash and nonce.
16. Fetch receipt JWS from CRP.
17. Submit receipt JWS to Gateway using x402-receipt.
18. Require 200 OK and protected resource release.
19. Require PAYMENT-RESPONSE emission.
20. Run second-use replay check.
21. Require second use to return 402.
22. Read final canonical state from Postgres.
23. Read transition chain from Postgres.
24. Print sanitized completion summary.
```

## Direct Buyer Proof Input

The final script should accept a local Direct Buyer wallet proof capture file.

Recommended env var:

```text
DIRECT_BUYER_PROOF_PATH
```

Default:

```text
./fixtures/phase3/live-direct-buyer-proof.local.json
```

The default may be changed if the repository already uses a different local-only proof capture path.

The script must not print the raw proof.

Allowed output:

```text
proof file present: true
proof normalized: true
authorizationProof submitted: true
verifier ok: true
verifier stage: verified
challenge binding: walletChallenge
raw proof printed: false
```

Disallowed output:

```text
raw Direct Buyer proof
raw private key material
wallet export material
wallet recovery material
raw receipt JWS
raw PAYMENT-RESPONSE
database password
full password-bearing connection string
```

## Authorization Proof Construction

The implementation should reuse the Phase 3 Direct Buyer proof shape.

Conceptual request body:

```json
{
  "nonce": "<runtime nonce>",
  "authorizationProof": {
    "...": "Direct Buyer proof bound to the runtime PAYMENT-REQUIRED challenge"
  }
}
```

The final script should not use the old `policyEvidence` body.

Old body to replace:

```json
{
  "nonce": "<runtime nonce>",
  "policyEvidence": {
    "nonce": "<runtime nonce>",
    "policyKind": "composite",
    "region": "EU",
    "claims": {
      "ageOver": 21
    }
  }
}
```

New body target:

```json
{
  "nonce": "<runtime nonce>",
  "authorizationProof": {
    "type": "<Direct Buyer proof type>",
    "challenge": "<runtime challenge>",
    "challengeHash": "<runtime challenge hash>",
    "presentation": {
      "claims": {
        "region": "EU",
        "ageOver": 21
      }
    }
  }
}
```

The exact proof shape should come from existing Phase 3 normalization code.

## Implementation Shape for Next PR

The next implementation PR should probably add:

```text
scripts/demo_x402_v2_direct_buyer_e2e.sh
scripts/demo_direct_buyer_authorization_proof.ts
package.json
```

The shell script should own the readable demo flow.

The TypeScript helper should own Direct Buyer proof normalization and runtime authorizationProof construction.

Rationale:

```text
Bash is already used for the existing live E2E demo flow.
TypeScript already owns the Phase 3 proof normalization helpers.
Keeping proof construction in TypeScript avoids fragile jq-only proof rewriting.
```

The helper should:

```text
read gated-pr.json
read DIRECT_BUYER_PROOF_PATH
normalize the captured wallet proof
build the runtime challenge from PAYMENT-REQUIRED
compute the challenge binding/hash consistently with Phase 3
write authorizationProof request JSON to the demo workdir
not print raw proof
```

Recommended helper output file:

```text
$WORKDIR/direct-buyer-auth.json
```

## Proposed Workdir

Recommended workdir:

```text
.demo-x402-v2-direct-buyer-e2e
```

The workdir may contain sanitized intermediate files:

```text
gated-headers.txt
gated-body.json
gated-pr.json
direct-buyer-auth.json
direct-buyer-auth-response.txt
crp-create.json
plt-search.json
payments-search-all.json
fulfill-response.txt
redeem-response.txt
replay-response.txt
```

The workdir must not contain:

```text
raw private keys
wallet export copies
raw Direct Buyer proof copies unless explicitly local-only and gitignored
raw receipt JWS logs intended for commit
raw PAYMENT-RESPONSE logs intended for commit
```

## Required Environment Defaults

Recommended defaults:

```bash
GW="${GW:-http://localhost:3005}"
CRP="${CRP:-http://127.0.0.1:8080}"
DB_CONTAINER="${DB_CONTAINER:-xcf-pg}"
DB_NAME="${DB_NAME:-transaction-outcome}"
DB_USER="${DB_USER:-postgres}"

WALLET_PATH="${WALLET_PATH:-./keys/wallet.export}"
TOKEN_ID="${TOKEN_ID:-EUDemo}"

DIRECT_BUYER_PROOF_PATH="${DIRECT_BUYER_PROOF_PATH:-./fixtures/phase3/live-direct-buyer-proof.local.json}"

POLL_MAX_SECS="${POLL_MAX_SECS:-90}"
POLL_INTERVAL_SECS="${POLL_INTERVAL_SECS:-1}"
BACKOFF_MAX_SECS="${BACKOFF_MAX_SECS:-8}"
FULFILL_MAX_ATTEMPTS="${FULFILL_MAX_ATTEMPTS:-5}"

WORKDIR="${WORKDIR:-.demo-x402-v2-direct-buyer-e2e}"
```

The script should preserve Git Bash / MSYS guards:

```bash
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'
```

## Safety Boundaries

The final demo script must remain controlled live/testnet.

It must not:

```text
enable production release
activate production
target mainnet by default
print raw receipt JWS
print raw PAYMENT-RESPONSE
print raw Direct Buyer proof
copy wallet export files into the workdir
commit local proof captures
commit private material
bypass policy verification
bypass receipt verification
bypass replay protection
```

## Required Happy-Path Assertions

The final demo should assert:

```text
PAYMENT-REQUIRED header present
PAYMENT-REQUIRED nonce present
PAYMENT-REQUIRED contractId present
PAYMENT-REQUIRED merchantId present
PAYMENT-REQUIRED payTo present
PAYMENT-REQUIRED amount present
policyRequirements.required=true
Direct Buyer authorization redeem returns 200 OK
policyStatus=POLICY_SATISFIED
verifier ok=true
rawProofPrinted=false
CRP payment create returns 200 OK
payer:plt returns tx hash
indexed transfer is found
CRP fulfill returns ok=true
receipt JWS is present
Gateway final receipt redeem returns 200 OK
PAYMENT-RESPONSE is emitted
protected resource is released
second use returns 402
second use does not emit PAYMENT-RESPONSE
second use does not release protected resource
canonical state is RELEASED
```

## Required Negative / Fail-Closed Checks

The final demo script does not need to repeat the full Phase 4 fail-closed matrix.

However, it should include at least one user-visible negative proof:

```text
second-use replay is rejected
```

Optional later extension:

```text
wrong nonce Direct Buyer proof is rejected before payment
```

That optional negative should not be included in the first implementation unless it remains simple.

## Proposed PR Ladder To Finish Phase 4

The remaining Phase 4 ladder should stay finite.

Recommended:

```text
#285 — final demo composition design checkpoint
#286 — add Direct Buyer x402 v2 E2E demo script
#287 — run/prove final live/testnet demo and add closeout checkpoint
```

Compression is allowed if #286 succeeds cleanly:

```text
#285 — final demo composition design checkpoint
#286 — add/prove final Direct Buyer demo script and close Phase 4
```

Do not add another long preflight ladder unless a concrete implementation defect requires it.

## #286 Proposed Scope

PR #286 should add the actual script and helper.

Expected files:

```text
scripts/demo_x402_v2_direct_buyer_e2e.sh
scripts/demo_direct_buyer_authorization_proof.ts
package.json
```

Expected package script:

```json
{
  "demo:x402-v2-direct-buyer-e2e": "./scripts/demo_x402_v2_direct_buyer_e2e.sh"
}
```

Expected validation before live run:

```text
bash -n scripts/demo_x402_v2_direct_buyer_e2e.sh
ts-node --transpile-only scripts/demo_direct_buyer_authorization_proof.ts --help
package.json parse check
git diff --check
private-material grep
```

Expected live/testnet validation when explicitly run by operator:

```text
MSYS_NO_PATHCONV=1 DIRECT_BUYER_PROOF_PATH=<local-proof-file> npm run demo:x402-v2-direct-buyer-e2e
```

## Open Questions for #286

The implementation PR must answer:

```text
1. What is the canonical local proof-capture file path?
2. Can the proof helper import Phase 3 helpers directly without side effects?
3. Does the proof helper need to reimplement only the small stable subset?
4. Should the final script require a pre-existing external Gateway/CRP stack?
5. Should the final script perform a health/readiness check before issuing the challenge?
6. Should PAYMENT-SIGNATURE include only nonce, or nonce plus txHash and networkGenesisIndex?
7. Should final receipt redeem use only x402-receipt, or both PAYMENT-SIGNATURE and x402-receipt?
```

Recommended defaults:

```text
1. require DIRECT_BUYER_PROOF_PATH explicitly if no stable local fixture exists
2. import Phase 3 helpers if safe
3. otherwise add a narrow helper with copied stable logic
4. require externally running Gateway/CRP stack
5. yes, add lightweight health checks
6. include nonce at minimum
7. use x402-receipt and include PAYMENT-SIGNATURE nonce for consistency
```

## Current Decision

The current decision is:

```text
Proceed with Phase 4 Final Demo Composition.
Do not call it Phase 5.
Do not treat it as production activation.
Start with a sibling demo script.
Reuse the existing human/prepared-agent E2E settlement spine.
Replace only the human/prepared-agent authorization step with the Direct Buyer ZKP path.
Preserve all Phase 4 safety boundaries.
```

## Definition of Done for Final Phase 4

Phase 4 is complete when:

```text
a controlled live/testnet x402 v2 Direct Buyer demo script exists
the script extends the existing human-gated E2E shape
the script uses Direct Buyer authorizationProof instead of policyEvidence
the script performs real testnet PLT settlement
the script obtains a real CRP receipt JWS
the Gateway verifies receipt/settlement/tuple
the Gateway emits PAYMENT-RESPONSE
the Gateway releases the protected resource
second use is blocked
production release remains disabled
raw proof/receipt/payment-response material is not printed
private-material checks are clean
```

## Final Statement

This checkpoint defines the final composition step for Phase 4.

The final implementation should be small, direct, and demonstrable:

```text
Phase 3 Direct Buyer ZKP Path
+
Phase 4 Settlement / Receipt / Release Path
+
existing human-gated demo structure
=
live end-to-end x402 v2 Direct Buyer demo
```
