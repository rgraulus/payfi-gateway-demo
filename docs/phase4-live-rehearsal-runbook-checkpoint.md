# Phase 4 Live Rehearsal Runbook Checkpoint

Status: runbook checkpoint only
Scope: documentation / operator procedure
Release activation: not enabled
Live/testnet execution: not performed in this PR
CRP fulfill invocation: not performed in this PR
Protected resource release: not performed in this PR

## Purpose

This checkpoint turns the Phase 4 live/testnet readiness bridge into a concrete operator runbook for the first controlled live/testnet rehearsal.

It builds on:

```text
#275 — Phase 4 live cutover readiness checkpoint
#276 — Phase 4 live stack readiness harness
#277 — Phase 4 live/testnet rehearsal input contract
```

The goal is to make the next execution-facing PR finite, deliberate, and safe.

This PR does not execute the live/testnet rehearsal. It documents the order of operations, required inputs, stop conditions, rollback expectations, and validation commands that must be satisfied before rehearsal execution is attempted.

## Current Phase 4 Position

Phase 4 has already proven the controlled receipt release path in harness mode:

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

The controlled execution seam is covered by:

```text
#271 — controlled receipt release execution happy path
#272 — controlled receipt execution not-ready guard
#273 — controlled receipt execution signature/JWKS failure guard
#274 — controlled receipt execution tuple-binding mismatch guard
```

The live/testnet readiness bridge now includes:

```text
#275 — readiness checkpoint and finite criteria
#276 — live stack readiness harness
#277 — live rehearsal input contract
```

Together these establish that the next step should be a controlled live/testnet rehearsal, not another open-ended mock guard ladder.

## Non-Goals

This checkpoint does not:

* change `src/server.ts`
* add or modify runtime release behavior
* start services
* call live services
* call CRP fulfill
* execute a buyer payment
* emit `PAYMENT-RESPONSE`
* release protected resources
* mutate replay state
* persist canonical release state
* enable production release
* add another controlled negative guard

## Required Operator Inputs

Before a live/testnet rehearsal is attempted, the operator must provide and validate the following inputs.

### Service / Dependency Inputs

```text
DATABASE_URL
GATEWAY_BASE_URL
ORCHESTRATOR_BASE_URL
ORCHESTRATOR_API_KEY
CRP_BASE_URL
CRP_JWKS_URL
```

### Receipt Trust Inputs

```text
PHASE4_LIVE_REHEARSAL_EXPECTED_KID
X402_EXPECTED_KID
```

At least one expected receipt `kid` must be configured. The preferred rehearsal-specific variable is:

```text
PHASE4_LIVE_REHEARSAL_EXPECTED_KID
```

### Replay Backend Inputs

```text
X402_REPLAY_BACKEND
```

Allowed values:

```text
memory
redis
```

If `X402_REPLAY_BACKEND=redis`, one of the following must also be configured:

```text
X402_REDIS_URL
REDIS_URL
```

### Production Release Flags

Production-facing release flags must be explicitly disabled:

```text
PHASE3_GATEWAY_RELEASE_ENABLED=false
PHASE3_GATEWAY_TEST_RELEASE_ONLY=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=false
```

A rehearsal must not rely on unset production flags. They must be explicitly set to `false`.

### Resource / Payment Tuple Inputs

```text
PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD
PHASE4_LIVE_REHEARSAL_RESOURCE_PATH
PHASE4_LIVE_REHEARSAL_CONTRACT_ID
PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION
PHASE4_LIVE_REHEARSAL_MERCHANT_ID
PHASE4_LIVE_REHEARSAL_NETWORK
PHASE4_LIVE_REHEARSAL_CHAIN_ID
PHASE4_LIVE_REHEARSAL_ASSET_TYPE
PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID
PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS
PHASE4_LIVE_REHEARSAL_AMOUNT
PHASE4_LIVE_REHEARSAL_PAY_TO
```

Canonical current rehearsal values:

```text
PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD=GET
PHASE4_LIVE_REHEARSAL_RESOURCE_PATH=/paid-gated
PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION=1.0.0
PHASE4_LIVE_REHEARSAL_MERCHANT_ID=demo-merchant
PHASE4_LIVE_REHEARSAL_NETWORK=concordium:testnet
PHASE4_LIVE_REHEARSAL_ASSET_TYPE=PLT
PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID=EUDemo
PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS=6
PHASE4_LIVE_REHEARSAL_AMOUNT=0.050101
```

The operator must confirm the active `contractId`, `chainId`, and `payTo` account before any rehearsal execution.

## Git Bash / MSYS Requirement

When running the rehearsal input contract from Git Bash/MSYS, leading-slash resource paths such as `/paid-gated` can be path-converted before reaching Node/npm.

Therefore, Git Bash/MSYS runs must include:

```text
MSYS_NO_PATHCONV=1
```

The #277 input-contract harness explicitly validates this condition when a Git Bash/MSYS runtime is detected.

## Required Pre-Rehearsal Validation Sequence

The first controlled live/testnet rehearsal must not be attempted until the following sequence passes.

### Step 1 — Confirm Repository Cleanliness

```bash
git switch main
git fetch --prune
git pull --ff-only
git status -sb
```

Expected:

```text
## main...origin/main
```

### Step 2 — Confirm Live Stack Readiness

Run the #276 live stack readiness harness against the externally running local/live stack:

```bash
PHASE4_LIVE_STACK_READINESS_HARNESS=true \
PHASE4_LIVE_STACK_READINESS_EXPECTED_KID="kid-dev-1" \
PHASE4_LIVE_STACK_READINESS_REQUIRE_EXPECTED_KID=true \
CRP_BASE_URL="http://127.0.0.1:8080" \
CRP_JWKS_URL="http://127.0.0.1:8080/.well-known/jwks.json" \
ORCHESTRATOR_BASE_URL="http://localhost:8090" \
GATEWAY_BASE_URL="http://localhost:3005" \
npm run phase4:live-stack-readiness-harness-test
```

Expected result:

```text
ok: true
wallet-proxy health: ok
crp health: ok
crp jwks: ok
orchestrator health: ok
gateway health: ok
gateway readyz: ok
production release flags: false
safety.nonMutating: true
```

This step may call health/JWKS endpoints. It must not call CRP fulfill, execute payment, release resources, or mutate replay/canonical state.

### Step 3 — Confirm Rehearsal Input Contract

Run the #277 input-contract harness:

```bash
MSYS_NO_PATHCONV=1 \
PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT=true \
PHASE4_LIVE_REHEARSAL_INTENT="readiness_only" \
DATABASE_URL="postgres://postgres:pg@localhost:5432/transaction-outcome" \
GATEWAY_BASE_URL="http://localhost:3005" \
ORCHESTRATOR_BASE_URL="http://localhost:8090" \
ORCHESTRATOR_API_KEY="dev-internal-key" \
CRP_BASE_URL="http://127.0.0.1:8080" \
CRP_JWKS_URL="http://127.0.0.1:8080/.well-known/jwks.json" \
PHASE4_LIVE_REHEARSAL_EXPECTED_KID="kid-dev-1" \
X402_REPLAY_BACKEND="memory" \
PHASE3_GATEWAY_RELEASE_ENABLED="false" \
PHASE3_GATEWAY_TEST_RELEASE_ONLY="false" \
PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED="false" \
PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED="false" \
PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD="GET" \
PHASE4_LIVE_REHEARSAL_RESOURCE_PATH="/paid-gated" \
PHASE4_LIVE_REHEARSAL_CONTRACT_ID="<confirmed-contract-id>" \
PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION="1.0.0" \
PHASE4_LIVE_REHEARSAL_MERCHANT_ID="demo-merchant" \
PHASE4_LIVE_REHEARSAL_NETWORK="concordium:testnet" \
PHASE4_LIVE_REHEARSAL_CHAIN_ID="<confirmed-chain-id>" \
PHASE4_LIVE_REHEARSAL_ASSET_TYPE="PLT" \
PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID="EUDemo" \
PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS="6" \
PHASE4_LIVE_REHEARSAL_AMOUNT="0.050101" \
PHASE4_LIVE_REHEARSAL_PAY_TO="<confirmed-payTo-account>" \
npm run phase4:live-rehearsal-input-contract-test
```

Expected result:

```text
ok: true
contract: phase4.liveRehearsalInputContract.v1
mode: input_contract_only
networkCalls: false
crpFulfillCalled: false
paymentAttempted: false
paymentResponseEmitted: false
protectedResourceReleased: false
replayTouched: false
canonicalReleasePersisted: false
productionReleaseEnabled: false
```

This step must not make network calls.

### Step 4 — Operator Go / No-Go

The operator may proceed to a future execution-facing rehearsal PR only if:

```text
#276 live stack readiness passes
#277 input contract passes
production release flags are explicitly false
expected kid is confirmed
contract id is confirmed
chain id is confirmed
payTo account is confirmed
resource path survives shell/runtime boundary unchanged
replay backend mode is intentional
rollback procedure is understood
```

If any item is uncertain, the rehearsal must stop before execution.

## Stop Conditions

A live/testnet rehearsal must stop before execution if any of the following are true:

* repo is not clean
* live stack readiness fails
* input contract fails
* expected `kid` is missing or mismatched
* CRP JWKS is unavailable
* Gateway `/readyz` is not healthy
* wallet-proxy is unhealthy
* Orchestrator health fails
* production release flags are not explicitly false
* `PHASE4_LIVE_REHEARSAL_RESOURCE_PATH` is not preserved as `/paid-gated`
* `MSYS_NO_PATHCONV=1` is missing under Git Bash/MSYS
* contract id is unknown or unconfirmed
* chain id is unknown or unconfirmed
* payTo account is unknown or unconfirmed
* replay backend mode is unknown or unintended
* operator cannot describe rollback steps

## Expected Fail-Closed Behavior for Future Execution Rehearsal

When the future live/testnet rehearsal execution PR is attempted, the system must fail closed if any of the following occur:

* CRP fulfill is unavailable
* receipt JWS is missing
* receipt JWS compact shape is invalid
* receipt decode fails
* receipt signature verification fails
* JWKS lookup fails
* expected `kid` does not match
* settlement is not finalized
* tuple binding does not match the payment requirement
* release eligibility is not ready
* replay mutation is not ready
* canonical release persistence is not ready
* release decision is not ready

Fail-closed means:

```text
no protected resource release
no PAYMENT-RESPONSE
no replay mutation
no canonical release persistence
no production release authorization
```

## Rollback / Disable Procedure

If rehearsal behavior is unexpected, stop the rehearsal and disable Phase 4 execution flags.

Primary disable flag:

```text
PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED=false
```

If needed, also disable the upstream Phase 4 preflight chain:

```text
PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED=false
PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED=false
PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED=false
PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED=false
```

Production-facing release flags must remain disabled:

```text
PHASE3_GATEWAY_RELEASE_ENABLED=false
PHASE3_GATEWAY_TEST_RELEASE_ONLY=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=false
PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=false
```

## Operator Notes

### Services

The #276 live stack readiness harness assumes services are already running externally.

It does not start:

```text
Gateway
Facilitator / CRP
Orchestrator
wallet-proxy
Postgres
Concordium node
```

### Health Checks

The rehearsal readiness path expects:

```text
wallet-proxy /v0/health healthy=true
CRP /healthz ok
CRP /.well-known/jwks.json exposes expected kid
Orchestrator /healthz ok
Gateway /healthz exposes Phase 3 and Phase 4 status
Gateway /readyz ok and jwksOk=true
```

### Resource Path

The canonical resource path for this rehearsal is:

```text
/paid-gated
```

Under Git Bash/MSYS, always include:

```text
MSYS_NO_PATHCONV=1
```

### Production Activation

This runbook is not a production activation plan.

Production release activation requires a later explicit PR and must not be inferred from this checkpoint.

## Recommended Next Finite Rung

Recommended next PR:

```text
#279 — Phase 4 controlled live rehearsal execution preflight
```

Expected #279 scope:

* consume the #278 runbook as the operator procedure
* require #276 and #277 validation first
* perform only the smallest execution-facing rehearsal preflight
* preserve production release flags disabled
* preserve fail-closed behavior
* avoid broadening into full production activation

## Completion Criteria for This Checkpoint

This checkpoint is complete when:

* this runbook is added
* no code or runtime behavior changes are included
* no live/testnet execution is performed
* no release activation flags are changed
* the document clearly states required inputs, validation sequence, stop conditions, and rollback procedure
