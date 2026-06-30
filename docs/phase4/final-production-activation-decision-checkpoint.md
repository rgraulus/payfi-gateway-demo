# Phase 4 Final Production Activation Decision Checkpoint

## Purpose

This checkpoint records the final Phase 4 production activation decision after the controlled live/testnet rehearsal sequence.

This is a decision checkpoint only. It does not perform production activation, does not change production flags, does not add a new release harness, and does not extend the Phase 4 ladder.

## Decision

The current decision is:

```text
Do not activate production release in this PR.
Stop at controlled live/testnet release-readiness.
Require a separate, explicit production activation plan before any production/mainnet activation.
```

This decision preserves the successful Phase 4 outcome while avoiding an implicit or accidental move from controlled testnet readiness into production activation.

## Decision Rationale

Phase 4 has successfully proven the controlled live/testnet rehearsal path and the important fail-closed cases around that path.

The evidence now supports this conclusion:

```text
controlled live/testnet happy path: proven
consolidated fail-closed evidence: proven
release-readiness checkpoint: reached
production release: still disabled
production activation: not authorized by this checkpoint
```

The project is therefore ready to record controlled testnet release-readiness as achieved, but production activation remains a separate decision requiring explicit operator authorization and a separate activation plan.

## Evidence Chain

The relevant merged Phase 4 evidence sequence is:

| PR   | Purpose                                                | Outcome                                      |
| ---- | ------------------------------------------------------ | -------------------------------------------- |
| #278 | Live rehearsal runbook checkpoint                      | Operator procedure captured before execution |
| #279 | Controlled live rehearsal execution preflight          | Non-mutating execution preflight established |
| #280 | Controlled live/testnet rehearsal execution happy path | Positive live/testnet path proven            |
| #281 | Consolidated live rehearsal fail-closed evidence       | Negative/fail-closed cases proven            |
| #282 | Live rehearsal outcome / release-readiness checkpoint  | Release-readiness boundary documented        |

Together, these PRs establish the Phase 4 controlled rehearsal baseline:

1. The operator procedure exists.
2. The execution preflight exists.
3. The positive controlled live/testnet path works.
4. The key negative cases fail closed.
5. The release-readiness boundary is documented.
6. Production activation remains explicitly separate.

## What Is Proven

The following are proven in the controlled live/testnet rehearsal context:

* Gateway can issue the payment requirement for the controlled path.
* Gateway can redeem the policy envelope.
* A real testnet PLT transfer can be correlated through CRP fulfill.
* CRP can return a real receipt JWS.
* Gateway can consume the actual CRP receipt shape.
* Gateway can hand off, decode, and verify the receipt JWS.
* Gateway can verify JWKS/signature trust.
* Gateway can verify settlement state.
* Gateway can verify tuple binding.
* Gateway can make the release decision.
* Gateway can emit `PAYMENT-RESPONSE`.
* Gateway can release the protected resource.
* Gateway can persist replay/canonical release state.
* Gateway blocks second use after release.
* Missing operator acknowledgement fails closed.
* Malformed controlled transaction hash fails closed before runtime calls.
* Not-ready settlement state fails closed.
* Receipt trust/signature failure fails closed.
* Tuple-binding failure fails closed.

## What Is Not Authorized

This checkpoint does not authorize:

* production release activation;
* automatic production cutover;
* mainnet execution;
* uncontrolled live CRP fulfill;
* new buyer payment execution;
* reuse of consumed rehearsal nonces;
* bypass of operator acknowledgements;
* bypass of preflight/runbook steps;
* production flag changes;
* release of protected resources outside the controlled testnet rehearsal path;
* logging of raw receipt JWS material;
* logging of raw `PAYMENT-RESPONSE` material;
* storing or committing private key material;
* treating testnet readiness as equivalent to production approval.

## Production Activation Boundary

Production activation is intentionally outside this PR.

Any future production activation must be handled as a separate explicitly authorized plan. That plan must identify, at minimum:

* the exact production release objective;
* the intended environment;
* the intended network;
* the intended contract ID and contract version;
* the intended asset configuration;
* the intended merchant/resource tuple;
* the production release flags to be changed;
* the rollback procedure;
* the stop conditions;
* the observability/monitoring expectations;
* the expected receipt `kid` and JWKS source;
* replay/canonical persistence configuration;
* private-material handling guarantees;
* raw receipt/JWS logging guarantees;
* raw `PAYMENT-RESPONSE` logging guarantees;
* post-activation verification steps.

No production activation should proceed without that separate plan.

## Required Stop Conditions

Stop before production activation if any of the following are true:

* Gateway health is not green.
* Gateway readiness is not green.
* CRP/facilitator readiness is not green.
* JWKS readiness is not green.
* Expected receipt `kid` is not confirmed.
* Contract ID is ambiguous.
* Contract version is ambiguous.
* Network or genesis index is ambiguous.
* Asset ID, decimals, or amount are ambiguous.
* Merchant ID is ambiguous.
* Resource path or method is ambiguous.
* Pay-to address is ambiguous.
* Replay/canonical persistence configuration is ambiguous.
* Production release flags are not explicitly reviewed.
* Rollback procedure is not acknowledged.
* Stop conditions are not acknowledged.
* Operator cannot distinguish controlled testnet rehearsal from production activation.
* Raw receipt/JWS material would be printed.
* Raw `PAYMENT-RESPONSE` material would be printed.
* Private key material could be logged, committed, or exposed.

## Current Final State

The intended final state after this checkpoint is:

```text
Phase 4 controlled live/testnet rehearsal: complete
Phase 4 fail-closed evidence: complete
Phase 4 release-readiness checkpoint: complete
Production release activation: not authorized
Production activation plan: required separately if desired
```

## Decision Outcome

The project stops here for production activation purposes.

Phase 4 may be considered complete for controlled live/testnet release-readiness, while production activation remains explicitly deferred.

## Next Step

If the project owner decides to proceed toward production activation later, create a separate PR with an explicit production activation plan.

Recommended future PR name, only if explicitly authorized:

```text
production activation plan checkpoint
```

That future PR should be planning-only unless production activation is explicitly authorized in writing.
