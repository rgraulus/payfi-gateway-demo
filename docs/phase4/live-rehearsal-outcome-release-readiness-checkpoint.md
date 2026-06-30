# Phase 4 Live Rehearsal Outcome / Release-Readiness Checkpoint

## Purpose

This checkpoint records the outcome of the Phase 4 controlled live/testnet rehearsal sequence and states the release-readiness boundary after PR #280 and PR #281.

This is a documentation checkpoint only. It does not add a new execution path, does not enable production release, and does not extend the Phase 4 ladder with another preflight unless a concrete release-readiness gap is identified.

## Scope

This checkpoint covers:

* the controlled live/testnet happy path proven by PR #280;
* the consolidated fail-closed evidence proven by PR #281;
* the current release-readiness state after those merges;
* the explicit boundaries that remain before any production activation decision.

This checkpoint does not:

* perform a new live payment;
* reuse the consumed #280 happy-path nonce;
* call live CRP/facilitator services;
* start Gateway, CRP, wallet-proxy, Postgres, or Concordium node services;
* enable production release;
* print raw receipt JWS material;
* print raw `PAYMENT-RESPONSE` material.

## Phase 4 Evidence Baseline

The current Phase 4 evidence sequence is:

| PR   | Purpose                                                | Outcome                                      |
| ---- | ------------------------------------------------------ | -------------------------------------------- |
| #278 | Live rehearsal runbook checkpoint                      | Operator procedure captured before execution |
| #279 | Controlled live rehearsal execution preflight          | Non-mutating execution preflight established |
| #280 | Controlled live/testnet rehearsal execution happy path | Positive path proven and merged              |
| #281 | Consolidated live rehearsal fail-closed evidence       | Negative/fail-closed cases proven and merged |

Together, these PRs establish the controlled live rehearsal baseline:

1. The runbook exists.
2. The preflight gate exists.
3. The controlled live/testnet happy path works.
4. Important negative cases fail closed.

## PR #280 Outcome: Controlled Live/Testnet Happy Path

PR #280 proved the bounded live/testnet happy path:

```text
real testnet PLT transfer
→ CRP fulfill
→ real receipt JWS
→ Gateway receipt handoff
→ decode
→ signature/JWKS verification
→ settlement verification
→ tuple binding
→ release decision
→ PAYMENT-RESPONSE
→ protected resource release
→ replay/canonical persistence
→ second-use block
```

The positive rehearsal established that the Gateway can consume the actual CRP receipt shape and complete the controlled release flow when all required inputs, acknowledgements, and runtime conditions are satisfied.

Key outcome:

```text
first use: released
second use: blocked
production release: disabled
raw receipt/JWS: not printed
raw PAYMENT-RESPONSE: not printed
```

## PR #281 Outcome: Consolidated Fail-Closed Evidence

PR #281 proved the important negative cases around the now-working path.

The consolidated evidence harness confirmed:

* the #280 disabled/default path is side-effect free;
* #280 release mode refuses a missing operator planned-release acknowledgement before runtime calls;
* #280 release mode refuses a malformed controlled transaction hash before runtime calls;
* the existing controlled release not-ready guard fails closed;
* the existing signature/JWKS guard fails closed;
* the existing tuple-binding guard fails closed.

The enabled #281 run confirmed:

```text
buildsNewReleasePath=false
performsNewLivePayment=false
callsLiveCrp=false
requiresExternallyRunningStack=false
reusesConsumedHappyPathNonceForRelease=false
enablesProductionRelease=false
```

It also confirmed:

```text
paymentResponseEmittedByThisHarness=false
protectedResourceReleasedByThisHarness=false
liveReplayTouchedByThisHarness=false
liveCanonicalReleasePersistedByThisHarness=false
rawReceiptPrinted=false
rawPaymentResponsePrinted=false
productionReleaseEnabled=false
```

## Release-Readiness Assessment

### Ready / Proven

The following are now proven in the controlled live/testnet rehearsal context:

* Gateway can issue and redeem the payment requirement for the controlled live rehearsal path.
* A real testnet PLT transfer can be correlated through CRP fulfill.
* CRP can return a real receipt JWS for the controlled payment.
* Gateway can hand off, decode, and verify the receipt JWS.
* Gateway can verify settlement state.
* Gateway can verify tuple binding against the issued payment requirement.
* Gateway can make the release decision.
* Gateway can emit `PAYMENT-RESPONSE`.
* Gateway can release the protected resource.
* Gateway can persist replay/canonical release state.
* Gateway blocks second use after release.
* Missing or invalid release prerequisites fail closed.
* Trust failures fail closed.
* Tuple-binding failures fail closed.
* Not-ready settlement state fails closed.

### Not Yet Authorized / Not Changed

The following remain intentionally not authorized by this checkpoint:

* production release activation;
* automatic production cutover;
* mainnet execution;
* uncontrolled live CRP fulfill;
* reuse of consumed rehearsal nonces;
* bypass of operator acknowledgements;
* printing or storing raw receipt/JWS material in logs;
* printing or storing raw `PAYMENT-RESPONSE` material in logs.

## Production Release Boundary

The project is now at a release-readiness checkpoint, not at automatic production activation.

A future production activation decision must still be explicit and separate. That decision should require:

* explicit operator authorization;
* explicit production release flag change;
* confirmed rollback procedure;
* confirmed stop conditions;
* confirmed production configuration;
* confirmed monitoring/observability expectations;
* confirmation that testnet-only rehearsal assumptions do not silently carry into production/mainnet operation;
* confirmation that no raw private material, receipt JWS, or payment-response material is logged.

## Stop Conditions Before Production Activation

Do not proceed to any production activation if any of the following are true:

* Gateway readiness is not green.
* CRP/facilitator readiness is not green.
* JWKS readiness is not green.
* Expected receipt `kid` is not confirmed.
* Contract ID, version, network, asset, amount, merchant, resource, nonce, or pay-to values are ambiguous.
* Replay/canonical persistence is not configured intentionally.
* Production release flags are not explicitly reviewed.
* Rollback procedure is not acknowledged.
* Stop conditions are not acknowledged.
* Raw receipt/JWS material would be printed.
* Raw `PAYMENT-RESPONSE` material would be printed.
* The operator cannot distinguish testnet rehearsal from production activation.

## Decision

Phase 4 has crossed the controlled live/testnet rehearsal milestone:

```text
positive path: proven
negative/fail-closed evidence: proven
production release: still disabled
release-readiness: checkpoint reached
production activation: requires a separate explicit decision
```

## Recommended Next Finite Rung

The next finite rung should be one explicit decision checkpoint, not another open-ended harness ladder:

```text
#283 — final production activation decision checkpoint
```

Recommended #283 scope:

* document the final production activation decision;
* identify the exact flag/config changes that would be required;
* identify rollback and stop conditions;
* state whether the project is stopping at controlled testnet readiness or proceeding to a separately authorized production activation PR.

#283 should not perform production activation unless the operator explicitly authorizes that action.
