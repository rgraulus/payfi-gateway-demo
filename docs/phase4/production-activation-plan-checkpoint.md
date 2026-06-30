# Phase 4 Production Activation Plan Checkpoint

## Purpose

This document defines the production activation plan checkpoint following the completed Phase 4 controlled live/testnet release-readiness sequence.

This is a planning checkpoint only.

It does not:

- activate production release;
- change production release flags;
- execute a mainnet payment;
- execute a new testnet payment;
- call live CRP/facilitator services;
- start Gateway, CRP, wallet-proxy, Postgres, Concordium node, or orchestrator services;
- add a new execution harness;
- reuse consumed rehearsal nonces;
- authorize uncontrolled live CRP fulfill;
- print raw receipt JWS material;
- print raw `PAYMENT-RESPONSE` material.

## Activation Status

Current decision:

```text
production activation: not active
production release flags: must remain unchanged in this PR
activation authorization: planning only
activation execution: deferred
```

This checkpoint exists to define what must be true before a future production activation PR can be considered.

## Background

Phase 4 has reached controlled live/testnet release-readiness.

The merged evidence chain is:

| PR | Purpose | Outcome |
| --- | --- | --- |
| #278 | Live rehearsal runbook checkpoint | Operator procedure captured before execution |
| #279 | Controlled live rehearsal execution preflight | Non-mutating execution preflight established |
| #280 | Controlled live/testnet rehearsal execution happy path | Positive live/testnet path proven |
| #281 | Consolidated live rehearsal fail-closed evidence | Negative/fail-closed cases proven |
| #282 | Live rehearsal outcome / release-readiness checkpoint | Release-readiness boundary documented |
| #283 | Final production activation decision checkpoint | Production activation explicitly deferred |

The current project posture is:

```text
controlled live/testnet happy path: proven
fail-closed behavior: proven
release-readiness boundary: documented
production activation: explicitly deferred
```

## Objective

The objective of this plan is to define the minimum safe requirements for a future production activation PR.

A future production activation PR must be able to answer:

```text
What exactly is being activated?
Where is it being activated?
Which flags/configuration are changing?
What confirms readiness before activation?
What confirms success after activation?
What are the stop conditions?
What is the rollback procedure?
What material must never be logged or committed?
```

## Activation Decision Boundary

This plan does not authorize activation.

A future activation PR requires a separate explicit decision with all required production inputs filled in and reviewed.

The activation decision must be recorded as one of:

```text
decision: do not activate
decision: activate testnet production-like environment only
decision: activate mainnet production environment
```

If the decision is not explicit, the default is:

```text
decision: do not activate
```

## Proposed Future Activation Scope

A future production activation PR, if authorized, should be scoped narrowly.

Recommended future scope:

```text
one environment
one network
one contract tuple
one merchant/resource tuple
one asset tuple
one activation window
one rollback procedure
one post-activation verification checklist
```

The future PR should not combine unrelated architecture changes, new receipt parsing work, new harness ladders, or unrelated refactors.

## Required Production Inputs

Before activation can be considered, the following inputs must be filled in.

### Environment

```text
target environment: TBD
environment owner: TBD
operator: TBD
activation window: TBD
rollback owner: TBD
```

Allowed environment decision values:

```text
testnet-production-like
mainnet-production
do-not-activate
```

Default:

```text
do-not-activate
```

### Network

```text
network: TBD
network genesis index: TBD
chain id: TBD
```

Stop if any network value is ambiguous.

### Contract

```text
contract id: TBD
contract version: TBD
contract frozen status: TBD
contract owner/authority: TBD
```

Stop if the contract ID or version does not exactly match the intended activation target.

### Merchant / Resource

```text
merchant id: TBD
resource method: TBD
resource path: TBD
resource host/base URL: TBD
```

Stop if the merchant/resource tuple is ambiguous.

### Asset

```text
asset type: TBD
asset token id: TBD
asset decimals: TBD
amount: TBD
amount raw: TBD
```

Stop if amount conversion cannot be independently verified.

### Pay-To / Settlement Target

```text
payTo address: TBD
settlement recipient owner: TBD
settlement recipient verification method: TBD
```

Stop if the pay-to address is ambiguous or not operator-confirmed.

### CRP / Facilitator

```text
CRP base URL: TBD
CRP health endpoint: TBD
CRP JWKS URL: TBD
expected receipt kid: TBD
receipt issuer: TBD
```

Stop if JWKS readiness is not green or the expected `kid` is not confirmed.

### Gateway

```text
Gateway base URL: TBD
Gateway health endpoint: TBD
Gateway readyz endpoint: TBD
Gateway operator: TBD
```

Stop if Gateway health or readiness is not green.

### Replay / Canonical Persistence

```text
replay backend: TBD
canonical persistence backend: TBD
database host/reference: TBD
persistence owner: TBD
backup/restore expectation: TBD
```

Stop if replay or canonical persistence behavior is ambiguous.

## Production Flag Inventory

The future activation PR must explicitly review all release-relevant flags.

Current planning expectation for this PR:

```text
no flag changes in this PR
```

Future activation PR must list intended values for at least:

```text
PHASE3_GATEWAY_RELEASE_ENABLED=TBD
PHASE3_GATEWAY_TEST_RELEASE_ONLY=TBD
PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=TBD
PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=TBD

PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS=TBD
PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED=TBD
```

The future PR must also confirm whether any of the following Phase 4 receipt path flags are required for the target environment:

```text
PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED=TBD
PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED=TBD
PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED=TBD
PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED=TBD
```

Stop if any production-facing flag is changed without explicit operator authorization.

## Pre-Activation Readiness Checklist

A future activation PR must include a completed checklist.

### Repository Readiness

```text
[ ] main synced with origin/main
[ ] feature branch created from clean main
[ ] worktree clean before activation patch
[ ] no backup artifacts
[ ] no raw/private/secret material
[ ] private-material grep clean
[ ] diff check clean
```

### Runtime Readiness

```text
[ ] Gateway health green
[ ] Gateway readyz green
[ ] CRP/facilitator health green
[ ] CRP JWKS reachable
[ ] expected receipt kid present
[ ] replay backend intentionally configured
[ ] canonical persistence intentionally configured
[ ] database connectivity confirmed if applicable
[ ] monitoring/observability confirmed
```

### Tuple Readiness

```text
[ ] network confirmed
[ ] network genesis index confirmed
[ ] chain id confirmed
[ ] contract id confirmed
[ ] contract version confirmed
[ ] asset id confirmed
[ ] asset decimals confirmed
[ ] amount confirmed
[ ] amountRaw independently verified
[ ] merchant id confirmed
[ ] resource method confirmed
[ ] resource path confirmed
[ ] payTo address confirmed
```

### Operator Readiness

```text
[ ] activation objective acknowledged
[ ] activation scope acknowledged
[ ] rollback procedure acknowledged
[ ] stop conditions acknowledged
[ ] raw receipt/JWS logging prohibition acknowledged
[ ] raw PAYMENT-RESPONSE logging prohibition acknowledged
[ ] private-material handling acknowledged
[ ] operator can distinguish testnet rehearsal from production activation
```

## Activation Execution Design

This checkpoint does not execute activation.

A future activation PR must define the exact execution design before any flag change.

Required sections for the future activation PR:

```text
1. activation objective
2. activation environment
3. exact config/flag diff
4. pre-activation checks
5. activation command sequence
6. post-activation verification
7. rollback command sequence
8. stop conditions
9. evidence capture rules
10. private-material handling rules
```

## Post-Activation Verification Requirements

A future activation PR must define how success will be verified.

Minimum expected verification:

```text
Gateway health remains green
Gateway readyz remains green
CRP health remains green
JWKS remains green
expected kid remains present
payment requirement issued correctly
receipt JWS consumed correctly
settlement verified correctly
tuple binding verified correctly
release decision produced correctly
PAYMENT-RESPONSE emitted only when expected
protected resource released only when expected
replay/canonical persistence updated only when expected
second use blocked
raw receipt/JWS not printed
raw PAYMENT-RESPONSE not printed
production flags match intended values
```

## Rollback Requirements

A future activation PR must include rollback commands before activation begins.

Rollback must define how to return to:

```text
production release disabled
controlled release disabled
no new release attempts
Gateway restored to prior known-good config
CRP/JWKS configuration restored if changed
replay/canonical persistence state understood
operator notified
```

Rollback must also define how to verify rollback:

```text
Gateway health green
Gateway readyz green
production release flag disabled
controlled release flag disabled
no PAYMENT-RESPONSE emitted for unpaid request
protected resource not released for unpaid request
logs contain no raw receipt/JWS material
logs contain no raw PAYMENT-RESPONSE material
```

## Stop Conditions

Stop immediately before activation if any of the following are true:

```text
Gateway health is not green
Gateway readyz is not green
CRP/facilitator health is not green
CRP JWKS is unreachable
expected receipt kid is missing
network is ambiguous
network genesis index is ambiguous
chain id is ambiguous
contract id is ambiguous
contract version is ambiguous
asset id or decimals are ambiguous
amount or amountRaw is ambiguous
merchant/resource tuple is ambiguous
payTo address is ambiguous
replay/canonical persistence is ambiguous
operator acknowledgements are missing
rollback procedure is missing
monitoring/observability is missing
private-material check is not clean
raw receipt/JWS could be printed
raw PAYMENT-RESPONSE could be printed
production flags differ from the reviewed activation plan
```

Stop immediately during or after activation if any of the following occur:

```text
unexpected release
unexpected PAYMENT-RESPONSE
unexpected protected resource release
unexpected replay/canonical mutation
receipt signature verification failure
settlement verification failure
tuple-binding mismatch
second-use replay not blocked
Gateway health degrades
CRP health degrades
JWKS readiness degrades
raw receipt/JWS appears in logs
raw PAYMENT-RESPONSE appears in logs
private material appears in logs or repository state
```

## Evidence Capture Rules

Evidence must be sanitized.

Allowed evidence:

```text
status codes
boolean readiness fields
receipt present: true/false
receipt JWS present: true/false
receipt payload present: true/false
signature verified: true/false
settlement status
tuple binding status
release decision status
replay/canonical status
production flag values
hashes or redacted identifiers where safe
```

Disallowed evidence:

```text
raw signing keys
wallet recovery material
raw receipt JWS
raw PAYMENT-RESPONSE
database passwords
full connection strings containing passwords
unredacted private environment files
```

## Private-Material Checks

Before any future activation PR is committed, run the project-standard private-material sweep against the changed files and relevant source/documentation directories.

Expected result:

```text
no private-material hits
```

If private material is found, stop and do not commit.

## Planning PR Acceptance Criteria

This planning checkpoint is complete when:

```text
[ ] production activation remains disabled
[ ] no production flags are changed
[ ] no new live payment is executed
[ ] no live CRP call is made
[ ] no new execution harness is added
[ ] exact required production inputs are listed
[ ] pre-activation checklist is documented
[ ] rollback requirements are documented
[ ] stop conditions are documented
[ ] evidence capture rules are documented
[ ] private-material rules are documented
```

## Future Activation PR Acceptance Criteria

A future activation PR must not proceed until:

```text
[ ] project owner explicitly authorizes activation
[ ] environment is identified
[ ] network is identified
[ ] contract tuple is identified
[ ] asset tuple is identified
[ ] merchant/resource tuple is identified
[ ] payTo address is confirmed
[ ] CRP/JWKS/kid are confirmed
[ ] Gateway health/readyz are confirmed
[ ] replay/canonical persistence is confirmed
[ ] exact flag/config diff is reviewed
[ ] rollback procedure is ready
[ ] stop conditions are acknowledged
[ ] evidence capture rules are acknowledged
[ ] private-material checks are clean
```

## Current Decision

The current decision remains:

```text
production activation planning: authorized
production activation execution: not authorized
production release flags: unchanged
future activation PR: required before any activation
```

## Recommended Next Step After This PR

After this planning checkpoint is merged, the project owner should choose one of the following:

```text
Option A: stop at production activation plan completed
Option B: fill in the TBD production inputs
Option C: create a separate production activation dry-run plan
Option D: create a separately authorized production activation PR
```

Default recommendation:

```text
Option A: stop at production activation plan completed
```

## Final Statement

This checkpoint converts the production activation discussion into a concrete plan without activating production.

It preserves the Phase 4 completion boundary:

```text
controlled live/testnet readiness: complete
production activation plan: documented
production activation execution: not authorized
```

Any future activation must be explicit, scoped, reversible, observable, and separately authorized.
