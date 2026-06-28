# Phase 4 Live Cutover Readiness Checkpoint

Status: readiness checkpoint only
Scope: documentation / operator checklist
Release activation: not enabled
Live/testnet external dependency execution: not performed in this PR

## Purpose

This checkpoint records what Phase 4 now proves after PR #274 and defines the finite readiness criteria before any live/testnet cutover rehearsal.

The goal is to prevent the controlled receipt release work from becoming an open-ended guard ladder. Phase 4 now has enough mock-controlled composition coverage to move from internal proof to operator readiness.

## What Phase 4 Now Proves

Phase 4 proves the Gateway can compose the real receipt release path in a controlled harness:

```text
CRP fulfill invocation boundary
→ receipt JWS handoff
→ receipt JWS decode
→ receipt JWS signature/JWKS verification
→ finalized settlement verification
→ tuple binding verification
→ release eligibility composition
→ replay/canonical persistence readiness
→ release decision readiness
→ controlled receipt release execution
```

The controlled execution seam is covered by the following finite set:

```text
#271 controlled release execution happy path
#272 settlement not-ready guard
#273 signature/JWKS failure guard
#274 tuple-binding mismatch guard
```

Together these prove:

* a verified, finalized, tuple-bound receipt can release the protected resource in controlled harness mode
* pending/non-finalized settlement fails closed
* invalid receipt signature/JWKS trust fails closed
* receipt/payment requirement tuple mismatch fails closed
* replay mutation is only allowed in the ready execution path
* canonical release persistence is only allowed in the ready execution path
* `PAYMENT-RESPONSE` is only emitted in the ready execution path
* protected resource release is only allowed in the ready execution path

## Current Phase 4 Runnable Surface

The Phase 4 script surface includes:

```text
phase4:real-crp-fulfill-invocation-boundary-test
phase4:real-receipt-jws-handoff-contract-test
phase4:real-receipt-jws-decode-preflight-test
phase4:real-receipt-jws-signature-verification-preflight-test
phase4:real-receipt-settlement-verification-preflight-test
phase4:real-receipt-tuple-binding-verification-preflight-test
phase4:real-receipt-release-eligibility-composition-preflight-test
phase4:real-receipt-replay-canonical-persistence-preflight-test
phase4:real-receipt-release-decision-preflight-test
phase4:controlled-real-receipt-release-execution-harness-test
phase4:controlled-real-receipt-release-execution-not-ready-guard-test
phase4:controlled-real-receipt-release-execution-signature-guard-test
phase4:controlled-real-receipt-release-execution-tuple-binding-guard-test
```

## What Remains Unproven

The following are intentionally not proven by the controlled mock harnesses:

* live CRP service availability
* live CRP fulfill response shape under real deployment conditions
* live CRP receipt JWS issuer behavior
* live CRP JWKS endpoint availability
* live JWKS key rotation behavior
* real expected `kid` configuration
* real finalized settlement data source behavior
* real testnet transaction finality timing
* real replay/canonical persistence backend behavior in the target deployment mode
* operator runbook readiness
* rollback procedure under live/testnet rehearsal conditions

These belong to a future live/testnet cutover rehearsal, not this checkpoint.

## Required Live/Testnet Rehearsal Inputs

Before a live/testnet rehearsal PR is attempted, the operator must identify and verify:

* `CRP_BASE_URL`
* `CRP_JWKS_URL`
* expected receipt `kid`
* expected receipt signing algorithm
* expected receipt issuer/audience assumptions
* expected payment network
* expected PLT asset token id and decimals
* expected merchant id
* expected payTo account
* expected finalized settlement status field
* expected transaction hash field
* replay backend mode
* canonical release persistence backend mode

## Required Flags

The rehearsal plan must explicitly state which flags remain disabled and which flags may be enabled.

Production-facing release flags must remain disabled until the rehearsal has passed:

```text
PHASE3_GATEWAY_RELEASE_ENABLED=false
PHASE3_GATEWAY_TEST_RELEASE_ONLY=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=false
```

Phase 4 harness/preflight flags may be enabled only in the controlled rehearsal environment:

```text
PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS=true
PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED=true
PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS=true
PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED=true
PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED=true
PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_HARNESS=true
PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED=true
PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS=true
PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED=true
```

## Fail-Closed Expectations

A live/testnet rehearsal must fail closed if any of the following occur:

* CRP fulfill is unavailable
* receipt JWS is missing
* receipt JWS compact shape is invalid
* receipt decode fails
* receipt signature verification fails
* JWKS lookup fails
* expected `kid` does not match
* settlement is not finalized
* tuple binding does not exactly match the payment requirement
* release eligibility is not ready
* replay mutation is not ready
* canonical release persistence is not ready
* release decision is not ready

Fail-closed means:

* no protected resource release
* no `PAYMENT-RESPONSE`
* no replay mutation
* no canonical release persistence
* no production release authorization

## Rollback / Disable Procedure

If a rehearsal behaves unexpectedly, disable Phase 4 execution by setting:

```text
PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED=false
```

If needed, also disable the upstream Phase 4 preflight chain by setting the corresponding `PHASE4_*_ENABLED` flags to `false`.

Production-facing release flags must remain disabled unless a later release activation PR explicitly changes that policy.

## Recommended Next Finite Rung

This checkpoint does not perform live/testnet execution.

Recommended next PR:

```text
#276 — Phase 4 live/testnet cutover rehearsal harness
```

Expected #276 scope:

* consume real CRP/JWKS/testnet dependencies in a controlled rehearsal mode
* require explicit operator-provided env configuration
* preserve fail-closed behavior
* avoid production release activation
* report readiness diagnostics without broadening the guard ladder

## Non-Goals for This Checkpoint

This PR does not:

* call real CRP/testnet services
* enable production release
* alter `src/server.ts`
* alter replay behavior
* alter canonical persistence behavior
* alter protected resource release behavior
* add another controlled-execution negative guard
