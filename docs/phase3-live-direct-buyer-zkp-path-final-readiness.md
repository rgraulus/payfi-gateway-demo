# Phase 3 Live Direct Buyer ZKP Path — Final Readiness Wrap-up

## Purpose

This document closes the re-baselined Phase 3 Live Direct Buyer ZKP Path.

It records what Phase 3 now proves, how to run the controlled demo, what safety boundaries remain intentionally closed, and what work belongs to follow-on phases.

This is a documentation and release-readiness wrap-up only.

It does not introduce new runtime behavior, new release-path behavior, new decoder activation, new CRP fulfill activation, or new production release semantics.

---

## Phase 3 Closing Statement

Phase 3 proves that the Gateway can support a wallet-backed Direct Buyer ZKP conditional access flow for an x402-gated resource.

The completed Phase 3 path demonstrates:

```text
Gateway issues x402 PAYMENT-REQUIRED + policy requirements
→ Buyer submits wallet-backed Direct Buyer authorization proof
→ Gateway verifies proof binding and policy satisfaction
→ Eligible buyer can proceed to controlled release
→ Ineligible buyer is denied before release
→ PAYMENT-RESPONSE is emitted only in the eligible + valid payment condition
→ Replay is rejected
```

The controlled release demo added in PR #260 is the functional finish line for the re-baselined Phase 3 scope.

Phase 3 should be understood as the Direct Buyer ZKP foundation, not as the final production settlement-release implementation.

---

## What Phase 3 Proves

Phase 3 proves the following core capabilities.

### 1. Gateway-issued challenge and policy requirements

The Gateway can issue a gated x402 `PAYMENT-REQUIRED` response for `/paid-gated`.

The response includes the payment requirement and the policy requirements needed to satisfy conditional access.

The challenge is bound to the Gateway-controlled payment/resource context.

### 2. Wallet-backed Direct Buyer authorization proof

The buyer can submit a wallet-backed authorization proof to `/paid-gated/redeem`.

The proof is treated as authorization evidence for satisfying the policy requirements attached to the gated resource.

### 3. Challenge-bound proof verification

The Gateway verifies that the submitted authorization proof is bound to the expected challenge.

The verified path distinguishes between:

```text
proof verifies and policy passes
proof verifies but policy fails
proof/challenge binding fails
proof is missing or malformed
```

### 4. Eligible and ineligible buyer behavior

Phase 3 demonstrates both positive and negative business behavior.

Eligible buyer path:

```text
EU buyer
age 21
proof verifies
policy satisfied
release can proceed after valid payment/receipt condition
```

Ineligible buyer path:

```text
US buyer
age 18
proof verifies
policy fails
release remains blocked
```

This is important because Phase 3 is not merely a positive-path demo. It proves that policy failure blocks release even when proof verification itself succeeds.

### 5. Controlled x402 release behavior

The controlled demo proves that the Gateway can release the protected resource only when the buyer is eligible and the payment/receipt condition is satisfied.

In the controlled demo:

```text
eligible buyer + valid finalized receipt condition
→ HTTP 200
→ PAYMENT-RESPONSE emitted
→ protected resource returned
```

For the ineligible buyer:

```text
ineligible buyer + receipt attempt
→ HTTP 402
→ no PAYMENT-RESPONSE
→ protected resource not returned
```

### 6. Replay rejection

The controlled demo proves replay rejection on the eligible buyer receipt path.

A previously used receipt/nonce combination is rejected and does not produce a second resource release.

### 7. Safety boundaries

Phase 3 keeps production boundaries explicit.

The controlled demo proves the Gateway behavior while keeping these fields false:

```text
productionRelease: false
crpCalled: false
crpFulfillCalled: false
canonicalReleasePersisted: false
rawProofPrinted: false
rawReceiptPrinted: false
```

This is intentional.

Phase 3 demonstrates controlled release readiness, not full production settlement-release execution.

---

## Controlled Demo Runbook

The primary Phase 3 close-out demo is the PR #260 controlled Live Direct Buyer release demo.

### Prerequisites

Start from a clean checkout on `main`.

A local captured wallet proof file is required:

```bash
.local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json
```

This file is local/private material and must never be committed.

The local development JWKS private key is also private material and must never be committed:

```bash
scripts/.dev_jwks_ed25519_private.pem
```

The harness expects local Concordium verifier configuration through:

```bash
PHASE3_GRPC_HOST=127.0.0.1
PHASE3_GRPC_PORT=20001
PHASE3_CONCORDIUM_NETWORK=testnet
```

### Disabled guard check

The harness is local-only and must not run unless explicitly enabled.

Run:

```bash
npm run phase3:controlled-live-direct-buyer-release-demo-test
```

Expected result:

```text
ok: false
code: harness_disabled
HARNESS_DISABLED_EXIT=2
rawProofPrinted: false
rawReceiptPrinted: false
```

### Controlled demo command

Run:

```bash
PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_HARNESS=true \
PHASE3_GRPC_HOST=127.0.0.1 \
PHASE3_GRPC_PORT=20001 \
PHASE3_CONCORDIUM_NETWORK=testnet \
npm run phase3:controlled-live-direct-buyer-release-demo-test -- "$PRIVATE_PROOF"
```

### Expected controlled demo result

Expected top-level result:

```text
ok: true
harness: phase3.controlledLiveDirectBuyerReleaseDemo.v1
gatewayPolicyGateEnabled: true
gatewayReleaseEnabled: true
gatewayTestReleaseOnly: true
gatewayProductionReleaseEnabled: false
liveDirectBuyerControlledReleaseDemoEnabled: true
allowParsedOnlyPolicy: true
requireLiveZkp: true
allowDevHarness: true
```

Expected eligible buyer result:

```text
redeemStatus: 200
policyStatus: POLICY_SATISFIED
region: EU
minimumAge: 18
actualAge: 21
verifierOk: true
verifierStage: verified
verifierChallengeBinding: walletChallenge
policyAllowed: true
syntheticReceiptMinted: true
releaseStatus: 200
paymentResponseEmitted: true
releasedResource: secret-data
replayRejected: true
productionRelease: false
crpCalled: false
crpFulfillCalled: false
canonicalReleasePersisted: false
```

Expected ineligible buyer result:

```text
redeemStatus: 403
policyStatus: POLICY_FAILED
code: age_requirement_not_met
reason: age_requirement_not_met
verifierOk: true
verifierStage: verified
verifierChallengeBinding: walletChallenge
policyVerifierAllowed: true
syntheticReceiptMinted: true
releaseStatus: 402
paymentResponseEmitted: false
resourceReleased: false
```

Expected leakage safety:

```text
rawProofPrinted: false
rawReceiptPrinted: false
```

---

## Recommended Phase 3 Validation Set

The following validation set was used to close Phase 3.

### Controlled demo

```bash
PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_HARNESS=true \
PHASE3_GRPC_HOST=127.0.0.1 \
PHASE3_GRPC_PORT=20001 \
PHASE3_CONCORDIUM_NETWORK=testnet \
npm run phase3:controlled-live-direct-buyer-release-demo-test -- "$PRIVATE_PROOF"
```

### Production release preflight regression

```bash
npm run phase3:live-direct-buyer-production-release-preflight-with-decoded-result-selftest
```

Expected:

```text
ok: true
productionReleasePreflightStatus: not_authorized_dry_run_only
productionReleasePreflightReady: false
productionReleaseAuthorized: false
productionRelease: false
sideEffectFree: true
```

### Decoded result consumption dry-run regression

```bash
npm run phase3:live-direct-buyer-decoded-result-consumption-dry-run-selftest
```

Expected:

```text
ok: true
status: dry_run_consumption_observed
decodedResultObservedByReleaseDecisionDryRun: true
decoderResultReleaseConsumable: false
releaseDecisionMutatedByDecoderResult: false
productionRelease: false
sideEffectFree: true
```

### Test-only real decoder invocation regression

```bash
npm run phase3:live-direct-buyer-test-only-real-decoder-invocation-selftest
```

Expected:

```text
ok: true
status: test_only_real_decoder_invocation_observed
realDecoderInvoked: true
realDecoderInvocationRoute: test_only_sanitized_fixture_input_no_release
decoderResultReleaseConsumable: false
productionReleaseAllowedAfterInvocation: false
sideEffectFree: true
```

### Gateway seam-result regression

```bash
PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_SEAM_RESULT_CONTRACT_PREFLIGHT_HARNESS=true \
PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_GATE_OPEN=true \
PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION=true \
PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_CALL_CONTRACT=true \
PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_INVOCATION_SEAM=true \
PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_SEAM_RESULT_CONTRACT=true \
PHASE3_GRPC_HOST=127.0.0.1 \
PHASE3_GRPC_PORT=20001 \
PHASE3_CONCORDIUM_NETWORK=testnet \
npm run phase3:live-direct-buyer-receipt-decoder-adapter-test-only-seam-result-contract-preflight-test -- "$PRIVATE_PROOF"
```

Expected:

```text
ok: true
actualGatewayStillReturns402: true
actualGatewayPaymentResponseEmitted: false
resourceReleased: false
paymentReleaseAttempted: false
paymentResponseEmitted: false
adapterInvoked: false
crpCalled: false
crpFulfillCalled: false
replayTouched: false
canonicalReleasePersisted: false
productionReleaseAuthorized: false
productionRelease: false
sideEffectFree: true
rawProofPrinted: false
rawReceiptPrinted: false
```

---

## What Remains Intentionally Out of Scope for Phase 3

Phase 3 does not claim full production x402 settlement-release execution.

The following are intentionally out of scope:

```text
real CRP fulfill execution in the release path
real CRP receipt JWS driving production release
production receipt decoder consuming live receipt material
decoded receipt becoming release-consumable
release decision consuming real decoded receipt result
canonical production release persistence
production replay mutation/persistence
production release switch activation
full live settlement-backed x402 release
agent-driven delegated authorization
```

This boundary is important.

Phase 3 proves the Direct Buyer ZKP conditional access foundation and controlled release behavior. It does not claim that real finalized settlement evidence is already driving production release.

---

## Phase 3 Definition of Done

Phase 3 is considered done when the following are true:

```text
1. Gateway can issue policy-bound x402 PAYMENT-REQUIRED for a gated resource.
2. Buyer can submit wallet-backed Direct Buyer authorization proof.
3. Gateway verifies proof binding.
4. Gateway evaluates policy satisfaction.
5. Eligible buyer can satisfy policy.
6. Ineligible buyer fails policy.
7. Controlled demo releases only for eligible buyer with valid payment/receipt condition.
8. Controlled demo blocks ineligible buyer release.
9. Replay is rejected.
10. PAYMENT-RESPONSE is emitted only in the authorized release path.
11. Raw proof and raw receipt material are not printed.
12. Production release, CRP fulfill, and canonical persistence remain explicitly disabled.
13. Follow-on production and agent-driven scopes are clearly documented.
```

PR #260 satisfies the functional demo portion of this Definition of Done.

PR #261 records the release-readiness wrap-up and forward-path boundaries.

---

## Forward Path: Phase 3E — Extended Agent-driven ZKP Path

Phase 3E extends the Phase 3 Direct Buyer foundation into an Agent-driven ZKP path.

Phase 3 asks:

```text
Can the buyer prove eligibility?
```

Phase 3E asks:

```text
Can an agent prove it is authorized to act for an eligible buyer?
```

Phase 3E should reuse the Phase 3 Gateway, challenge, policy, proof-verification, release-guard, negative-path, and leakage-safety patterns.

The major addition is delegated authorization.

An Agent-driven authorization envelope should prove:

```text
agent identity
buyer identity or buyer commitment
buyer policy proof
delegation or consent
scope
expiry
challenge binding
merchant binding
resource binding
payment tuple binding
replay protection fields
```

Phase 3E should demonstrate at least:

```text
authorized agent + eligible buyer → release allowed in controlled mode
authorized agent + ineligible buyer → release blocked
unauthorized agent + eligible buyer → release blocked
wrong resource/payment tuple → release blocked
replay attempt → release blocked
```

Phase 3E is not part of the Phase 3 close-out. It is a follow-on extension track.

---

## Forward Path: Phase 4 — Live Settlement Receipt Release Path

Phase 4 completes the production settlement-release side.

Phase 3 asks:

```text
Can a buyer prove eligibility and unlock controlled gated x402 access?
```

Phase 4 asks:

```text
Can real finalized settlement evidence drive production release?
```

Phase 4 should focus on:

```text
real CRP fulfill invocation
real receipt JWS handoff
production receipt decoder activation
receipt signature verification
receipt payload decoding
finalized settlement verification
exact tuple binding
production replay mutation
canonical release persistence
production release execution
live settlement E2E harness
```

A successful Phase 4 path should eventually prove:

```text
Gateway issues PAYMENT-REQUIRED
buyer pays on Concordium / PLT
CRP observes finalized settlement
Gateway obtains real CRP receipt JWS
Gateway verifies and decodes receipt
Gateway verifies exact tuple binding
Gateway performs replay mutation
Gateway persists canonical release
Gateway emits PAYMENT-RESPONSE
Gateway releases protected resource
replay attempt is rejected
```

Phase 4 is not part of the Phase 3 close-out. It is the next production-release execution phase.

---

## Relationship Between Phase 3, Phase 3E, and Phase 4

The recommended naming and scope split is:

```text
Phase 3  — Direct Buyer ZKP Path
Phase 3E — Extended Agent-driven ZKP Path
Phase 4  — Live Settlement Receipt Release Path
```

The relationship is:

```text
Phase 3:
Direct Buyer proves eligibility.

Phase 3E:
Authorized Agent proves delegated buyer authority.

Phase 4:
Live settlement receipt proves payment completion and authorizes production release.
```

These are related but distinct tracks.

Phase 3E extends who can act.

Phase 4 completes how real settlement authorizes release.

They should not be mixed into the Phase 3 close-out.

---

## Final Release-readiness Assessment

Phase 3 is ready to close as the Direct Buyer ZKP foundation.

It proves:

```text
wallet-backed Direct Buyer authorization
challenge-bound policy proof
eligible/ineligible policy behavior
controlled x402 release
PAYMENT-RESPONSE boundary
replay rejection
safety boundaries
```

It does not yet prove:

```text
live CRP fulfill production release
real receipt decoder production consumption
canonical production release persistence
agent-driven delegated authorization
```

That is the correct and intentional boundary.

Phase 3 should close cleanly here, and future work should proceed through the explicitly named follow-on tracks:

```text
Phase 3E — Extended Agent-driven ZKP Path
Phase 4 — Live Settlement Receipt Release Path
```
