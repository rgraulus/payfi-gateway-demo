# Phase 5 Agent Delegation Lifecycle — Final Acceptance

## Status

PR #297 is the final Phase 5 acceptance checkpoint for the controlled agent-delegated authorization path.

This checkpoint completes the finite Phase 5 PR ladder established by PR #287. It does not activate production authorization, release a protected resource, perform a payment, or introduce Agent Registry lookup.

The final consolidated acceptance command is:

```bash
npm run phase5:agent-delegation-lifecycle-e2e
```

This command:

1. Applies the idempotent Phase 5 lifecycle migration.
2. Verifies that all lifecycle tables exist.
3. Runs the isolated lifecycle and durable-store harness.
4. Runs the enabled-Gateway final-acceptance matrix.
5. Confirms that production activation and Agent Registry lookup remain disabled.

---

## Goal

The goal of PR #297 is to prove that an already cryptographically verified, buyer-authorized agent delegation can be evaluated and enforced against its current lifecycle state before it becomes eligible for settlement or release.

The accepted runtime sequence is:

1. Load the canonical challenge and frozen route contract.
2. Validate the outer authorization envelope.
3. Verify the buyer delegation credential and signature.
4. Verify the agent proof of possession.
5. Verify the signed runtime bindings.
6. Evaluate current-time delegation validity.
7. Check durable revocation state.
8. Evaluate the existing buyer policy.
9. Atomically claim bounded delegation use.
10. Persist the canonical policy transition.
11. Continue into the existing settlement and release path.

Invalid cryptographic, lifecycle, revocation, or policy authorization must not consume a delegation use.

---

## Scope

PR #297 adds:

* A pure delegation lifecycle evaluator.
* Durable delegation revocation state.
* Durable bounded-use counters.
* Durable per-challenge use claims.
* Same-challenge idempotency.
* Atomic `maxUses` enforcement.
* Concurrent one-use enforcement.
* Lifecycle integration in the controlled Gateway runtime.
* An isolated lifecycle and durable-store harness.
* An enabled-Gateway final-acceptance harness.
* A consolidated E2E acceptance entrypoint.
* This final-acceptance document.

The implementation files are:

* `db/migrations/002_phase5_agent_delegation_lifecycle.sql`
* `src/phase5/agentDelegationLifecycle.ts`
* `src/db/phase5AgentDelegationLifecycleStore.ts`
* `src/phase5/agentRuntimeAuthorization.ts`
* `src/server.ts`
* `scripts/ci_phase5_agent_delegation_lifecycle.ts`
* `scripts/ci_phase5_final_acceptance.ts`
* `scripts/demo_x402_v2_agent_delegated_lifecycle_e2e.sh`
* `docs/phase5-agent-delegation-lifecycle-final-acceptance.md`

The package entrypoints are:

```text
phase5:agent-delegation-lifecycle-test
phase5:final-acceptance-test
phase5:agent-delegation-lifecycle-e2e
```

---

## Explicit non-goals

PR #297 does not:

* Activate production agent authorization.
* Activate protected-resource release.
* Submit or fulfill a payment.
* Emit `PAYMENT-RESPONSE`.
* Replace the existing settlement or replay protections.
* Add Agent Registry lookup.
* Resolve agent keys from a registry.
* Resolve buyer delegation credentials from a registry.
* Remove any existing fallback.
* Alter the frozen route contracts.
* Begin Phase 6.

Agent Registry integration remains a Phase 6 concern.

---

## Runtime activation boundary

Lifecycle enforcement is controlled by:

```text
PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED=true
```

It is subordinate to both existing controlled Phase 5 runtime flags:

```text
PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED=true
PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED=true
```

Lifecycle enforcement is active only when all three flags are true.

When lifecycle enforcement is disabled, the PR #296 controlled cryptographic runtime behavior is preserved.

The runtime remains non-production:

```text
productionActivation=false
agentRegistryLookupAttempted=false
```

The lifecycle-store failure injection used by the final-acceptance harness is also disabled by default and requires a specific test-only flag and an exact delegation ID.

---

## Durable lifecycle schema

Migration `002_phase5_agent_delegation_lifecycle.sql` creates three lifecycle tables using idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements.

### `phase5_agent_delegation_revocations`

Stores durable revocation records bound to:

* Revocation ID.
* Delegation ID.
* Credential hash.
* Revocation timestamp.
* Reason code.
* Optional reason message.
* Optional metadata.

The credential hash is constrained to a lowercase, 64-character hexadecimal value.

### `phase5_agent_delegation_usage`

Stores durable bounded-use state for a verified delegation credential:

* Credential hash.
* Delegation ID.
* Revocation ID.
* Buyer key version.
* Agent key version.
* Maximum allowed uses.
* Consumed-use count.

The database constraints require:

```text
buyer_key_version > 0
agent_key_version > 0
max_uses > 0
0 <= consumed_uses <= max_uses
```

### `phase5_agent_delegation_use_claims`

Stores the atomic use claim associated with a canonical challenge:

* Credential hash.
* Canonical challenge ID.
* Challenge nonce.
* Use number.
* Creation timestamp.

Unique constraints enforce:

* One claim per challenge nonce.
* One claim per canonical challenge.
* One claim per credential and use-number sequence.

These constraints support same-challenge idempotency and prevent duplicate use consumption.

---

## Lifecycle decisions

The pure lifecycle evaluator produces explicit decisions including:

```text
lifecycle_ready
delegation_not_yet_valid
delegation_expired
lifecycle_contract_mismatch
cryptographic_delegation_not_verified
```

The durable lifecycle store produces explicit decisions including:

```text
not_revoked
delegation_revoked
revocation_record_mismatch
claimed
already_claimed
delegation_use_exhausted
usage_contract_mismatch
challenge_missing
```

A successful claim occurs only after:

* Cryptographic authorization succeeds.
* The current-time lifecycle check succeeds.
* Durable revocation state is clear.
* Buyer policy evaluates to allow.

---

## Canonical processing order

The lifecycle integration preserves the following security-sensitive order:

1. Canonical challenge and contract validation.
2. Outer envelope validation.
3. Buyer credential and signature verification.
4. Agent proof-of-possession verification.
5. Signed runtime-binding verification.
6. Current-time lifecycle validity.
7. Durable revocation check.
8. Buyer-policy evaluation.
9. Atomic bounded-use claim.
10. Canonical persistence.
11. Existing settlement and release processing.

This order ensures that:

* Invalid cryptographic authorization consumes no use.
* Invalid lifecycle state consumes no use.
* Revoked delegation consumes no use.
* Buyer-policy denial consumes no use.
* A successful bounded-use claim occurs before payment eligibility.
* Store failure fails closed before release eligibility.

---

## Same-challenge retry behavior

A successfully authorized canonical challenge transitions to `POLICY_SATISFIED`.

Lifecycle enforcement permits that exact canonical challenge to be presented again so the durable claim store can determine whether it is an idempotent retry.

For the same credential and same canonical challenge:

```text
reason=already_claimed
usageClaimCreated=false
usageClaimIdempotent=true
usageCount=1
totalClaimCount=1
```

The consumed-use counter remains unchanged.

A fresh canonical challenge using an exhausted credential is rejected with:

```text
delegation_use_exhausted
```

The fresh rejected challenge does not create another use claim or increment the consumed-use counter.

---

## Canonical satisfied-challenge retry seam

Before PR #297, canonical runtime preflight accepted only challenges in the `ISSUED` state.

After a successful lifecycle claim, the canonical challenge is already in `POLICY_SATISFIED`. That prevented the durable claim store from recognizing an exact same-challenge retry.

PR #297 adds a narrowly scoped retry allowance:

```text
allowSatisfiedChallengeRetry
```

The Gateway enables this allowance only when lifecycle enforcement is active.

The allowance does not independently authorize the retry. It permits the request to reach the durable lifecycle store, which remains the authority for determining whether the request is:

* The existing idempotent claim.
* A conflicting claim.
* An exhausted delegation.
* A revoked delegation.
* A lifecycle-contract mismatch.

---

## Clock and expiry precedence

The isolated lifecycle harness directly certifies:

```text
delegation_not_yet_valid
delegation_expired
```

In the enabled Gateway, a signed delegation credential must cover the entire canonical challenge validity window.

For the reachable expired-request fixture, the existing structural authorization verifier evaluates canonical challenge expiry before delegation expiry. The Gateway therefore rejects the request with:

```text
challenge_expired
```

This is an intentional precedence rule.

It would be incorrect to weaken the existing structural authorization verifier merely to force the request into the later lifecycle evaluator.

Both expiry paths consume zero bounded uses.

---

## Durable revocation behavior

The Gateway checks durable revocation state after current-time lifecycle validity and before buyer-policy evaluation.

A matching revocation record produces:

```text
delegation_revoked
```

The accepted revoked result includes:

```text
canonicalStatus=POLICY_FAILED
usageCreated=false
claimCount=0
releaseStatus=NOT_RELEASED
boundedUseConsumed=false
```

A revocation record that does not match the verified lifecycle contract is rejected with:

```text
revocation_record_mismatch
```

Revocation is checked again inside the atomic claim transaction to prevent a race in which a delegation becomes revoked between the initial check and use consumption.

---

## Atomic bounded-use behavior

The durable store uses serializable transactions and locking to enforce bounded use.

For the first valid use:

```text
reason=claimed
usageClaimCreated=true
usageClaimIdempotent=false
```

For an exact same-challenge retry:

```text
reason=already_claimed
usageClaimCreated=false
usageClaimIdempotent=true
```

For a fresh challenge after the delegation has reached `maxUses`:

```text
reason=delegation_use_exhausted
```

The isolated harness also certifies concurrent `maxUses=1` enforcement.

When two distinct canonical challenges attempt to consume the same one-use delegation concurrently:

* Exactly one request is claimed.
* Exactly one request is rejected as exhausted.
* The final consumed-use count is one.
* The final durable claim count is one.

---

## Fail-closed lifecycle-store behavior

The Gateway catches lifecycle-store exceptions and returns:

```text
HTTP 503
code=phase5_delegation_lifecycle_store_error
reason=phase5_delegation_lifecycle_store_error
policyStatus=POLICY_NOT_EVALUATED
```

The final-acceptance harness uses a narrowly scoped test-only failure injection:

```text
PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY=true
PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY_DELEGATION_ID=<exact-delegation-id>
```

The injection is inactive unless:

1. The explicit test-only enable flag is `true`.
2. A non-empty target delegation ID is configured.
3. The verified lifecycle contract contains that exact delegation ID.

The injected failure occurs before database connection or mutation.

The accepted fail-closed outcome is:

```text
canonicalStatus=ISSUED
claimCount=0
releaseStatus=NOT_RELEASED
boundedUseConsumed=false
productionActivation=false
agentRegistryLookupAttempted=false
```

The canonical state remains `ISSUED` because the lifecycle state could not be verified or claimed.

---

## Isolated lifecycle certification

Run:

```bash
npm run phase5:agent-delegation-lifecycle-test
```

The isolated harness certifies 16 cases.

### 1. Current-time delegation is valid

Expected:

```text
lifecycle_ready
```

### 2. Not-yet-valid delegation is rejected

Expected:

```text
delegation_not_yet_valid
```

### 3. Expired delegation is rejected

Expected:

```text
delegation_expired
```

### 4. Lifecycle-contract mismatch is rejected

Expected:

```text
lifecycle_contract_mismatch
```

### 5. Missing cryptographic prerequisite is rejected

Expected:

```text
cryptographic_delegation_not_verified
```

### 6. Absence of durable revocation is accepted

Expected:

```text
not_revoked
```

### 7. Durable revocation is rejected

Expected:

```text
delegation_revoked
```

### 8. Revocation-record mismatch is rejected

Expected:

```text
revocation_record_mismatch
```

### 9. First bounded use is atomically claimed

Expected:

```text
claimed
```

### 10. Same-challenge retry is idempotent

Expected:

```text
already_claimed
```

### 11. Fresh challenge after exhaustion is rejected

Expected:

```text
delegation_use_exhausted
```

### 12. Durable usage snapshot is correct

Expected:

```text
consumed=1
max=1
claims=1
```

### 13. Revocation is rechecked during claim

Expected:

```text
delegation_revoked
```

### 14. Durable usage-contract mismatch is rejected

Expected:

```text
usage_contract_mismatch
```

### 15. Concurrent `maxUses=1` enforcement is atomic

Expected:

```text
one claimed and one exhausted
```

### 16. Missing canonical challenge is rejected

Expected:

```text
challenge_missing
```

The passing summary is:

```text
totalCases=16
passedCases=16
failedCases=0
```

The required completion marker is:

```text
PR297_LIFECYCLE_HARNESS_COMPLETE=true
```

The harness also certifies zero residual test records:

```text
PR297_LIFECYCLE_HARNESS_RESIDUAL_CHALLENGES=0
PR297_LIFECYCLE_HARNESS_RESIDUAL_REVOCATIONS=0
PR297_LIFECYCLE_HARNESS_RESIDUAL_USAGE=0
PR297_LIFECYCLE_HARNESS_RESIDUAL_CLAIMS=0
```

The isolated harness additionally certifies:

```text
paymentAttempted=false
crpCalled=false
protectedResourceReleased=false
agentRegistryLookupAttempted=false
productionActivation=false
```

---

## Enabled-Gateway final acceptance

Run:

```bash
npm run phase5:final-acceptance-test
```

The enabled-Gateway harness certifies eight cases.

### 1. Valid current delegation

Expected:

```text
accepted=true
reason=policy_satisfied
usageCount=1
maxUses=1
policyStatus=POLICY_SATISFIED
releaseStatus=NOT_RELEASED
```

### 2. Buyer-policy denial consumes no use

Expected:

```text
rejected=true
reason=age_requirement_not_met
policyStatus=POLICY_FAILED
usageCreated=false
claimCount=0
releaseStatus=NOT_RELEASED
```

### 3. Revoked delegation consumes no use

Expected:

```text
rejected=true
reason=delegation_revoked
canonicalStatus=POLICY_FAILED
usageCreated=false
claimCount=0
releaseStatus=NOT_RELEASED
```

### 4. Same nonce is idempotent

Expected:

```text
accepted=true
usageClaimReason=already_claimed
usageClaimCreated=false
usageClaimIdempotent=true
usageCount=1
totalClaimCount=1
```

### 5. Fresh nonce after exhaustion is rejected

Expected:

```text
rejected=true
reason=delegation_use_exhausted
usageCount=1
maxUses=1
totalClaimCount=1
releaseStatus=NOT_RELEASED
```

### 6. Not-yet-valid delegation consumes no use

Expected:

```text
rejected=true
reason=delegation_not_yet_valid
canonicalStatus=POLICY_FAILED
claimCount=0
releaseStatus=NOT_RELEASED
```

### 7. Expired request consumes no use

Expected Gateway precedence:

```text
rejected=true
reason=challenge_expired
canonicalStatus=POLICY_FAILED
claimCount=0
releaseStatus=NOT_RELEASED
```

### 8. Lifecycle-store failure fails closed

Expected:

```text
rejected=true
reason=phase5_delegation_lifecycle_store_error
policyStatus=POLICY_NOT_EVALUATED
canonicalStatus=ISSUED
claimCount=0
releaseStatus=NOT_RELEASED
```

The passing summary is:

```text
matrixCases=8
passedCases=8
```

Required completion markers:

```text
PR297_FINAL_ACCEPTANCE_POSITIVE_CURRENT=true
PR297_FINAL_ACCEPTANCE_POLICY_DENY_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_REVOKED_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_SAME_NONCE_IDEMPOTENT=true
PR297_FINAL_ACCEPTANCE_FRESH_NONCE_EXHAUSTED=true
PR297_FINAL_ACCEPTANCE_NOT_YET_VALID_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_EXPIRED_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_STORE_FAILURE_FAILS_CLOSED=true
PR297_FINAL_ACCEPTANCE_CLEANUP_COMPLETE=true
```

---

## Consolidated acceptance

Run:

```bash
npm run phase5:agent-delegation-lifecycle-e2e
```

The wrapper:

1. Enables Git Bash/MSYS path protections.
2. Verifies that the configured PostgreSQL container is running.
3. Applies migration `002` using `ON_ERROR_STOP`.
4. Verifies all three lifecycle tables.
5. Runs the isolated lifecycle harness.
6. Runs the enabled-Gateway final-acceptance harness.
7. Prints the final Phase 5 safety-boundary markers.

Default database configuration:

```text
DB_CONTAINER=xcf-pg
DB_NAME=transaction-outcome
DB_USER=postgres
DATABASE_URL=postgres://postgres:pg@127.0.0.1:5432/transaction-outcome
```

The migration is idempotent and may be applied on every consolidated acceptance run.

Required consolidated markers:

```text
PR297_LIFECYCLE_ISOLATED_CERTIFICATION=true
PR297_LIFECYCLE_ENABLED_GATEWAY_CERTIFICATION=true
PR297_AGENT_DELEGATION_LIFECYCLE_E2E=true
PR297_PRODUCTION_ACTIVATION=false
PR297_AGENT_REGISTRY_LOOKUP=false
```

---

## Side-effect certification

The final acceptance explicitly certifies:

```text
gatewayCalled=true
crpCalled=false
paymentAttempted=false
paymentResponseEmitted=false
protectedResourceReleased=false
agentRegistryLookupAttempted=false
productionActivation=false
```

The Gateway is exercised, but the harness does not:

* Call the CRP facilitator.
* Create or fulfill a payment.
* Emit a `PAYMENT-RESPONSE`.
* Release the protected resource.
* Perform Agent Registry lookup.
* Activate production authorization.

All canonical challenges remain unreleased:

```text
releaseStatus=NOT_RELEASED
```

---

## Private-key material

The final-acceptance harness creates temporary Ed25519 buyer and agent identities.

Private key material remains in memory only.

The harness certifies:

```text
writtenToRepository=false
writtenToTemporaryFiles=false
printed=false
```

The buyer public verification key may be written to the harness work directory for controlled Gateway verification. Private keys are not written to repository or temporary files.

Harness cleanup removes all temporary files and restores the original environment.

---

## Failure semantics

### Cryptographic or structural failure

A request that fails before lifecycle evaluation is rejected without a use claim.

Examples include:

```text
authorization_binding_rejected
delegation_challenge_window_mismatch
challenge_expired
```

### Lifecycle validity failure

A not-yet-valid or expired delegation is rejected without a use claim.

Examples include:

```text
delegation_not_yet_valid
delegation_expired
```

### Revocation failure

A revoked delegation is rejected without a use claim:

```text
delegation_revoked
```

### Buyer-policy failure

A buyer-policy denial is persisted as `POLICY_FAILED` without a use claim:

```text
age_requirement_not_met
```

### Usage exhaustion

A fresh challenge presented after the delegation has consumed all permitted uses is rejected:

```text
delegation_use_exhausted
```

### Store failure

A lifecycle-store exception fails closed:

```text
HTTP 503
phase5_delegation_lifecycle_store_error
POLICY_NOT_EVALUATED
```

No canonical policy mutation or use claim occurs.

---

## Canonical-state expectations

The final acceptance establishes the following canonical-state behavior.

### Successful current authorization

```text
policyStatus=POLICY_SATISFIED
releaseStatus=NOT_RELEASED
```

### Buyer-policy denial

```text
policyStatus=POLICY_FAILED
releaseStatus=NOT_RELEASED
```

### Revoked delegation

```text
canonicalStatus=POLICY_FAILED
releaseStatus=NOT_RELEASED
```

### Not-yet-valid delegation

```text
canonicalStatus=POLICY_FAILED
releaseStatus=NOT_RELEASED
```

### Expired canonical challenge

```text
canonicalStatus=POLICY_FAILED
releaseStatus=NOT_RELEASED
```

### Lifecycle-store failure

```text
canonicalStatus=ISSUED
policyStatus=POLICY_NOT_EVALUATED
releaseStatus=NOT_RELEASED
```

The store-failure case remains `ISSUED` because the lifecycle state was not successfully verified or claimed.

---

## Security invariants

PR #297 certifies the following invariants:

1. An invalid delegation does not consume a use.
2. A not-yet-valid delegation does not consume a use.
3. An expired request does not consume a use.
4. A revoked delegation does not consume a use.
5. Buyer-policy denial does not consume a use.
6. A successful use is claimed atomically.
7. Same-challenge retries are idempotent.
8. Fresh challenges after exhaustion are rejected.
9. Concurrent one-use claims permit only one successful claim.
10. Revocation is rechecked during the claim transaction.
11. Lifecycle-store failure fails closed.
12. Store failure does not mutate canonical policy state.
13. No test case releases a protected resource.
14. No test case attempts a payment.
15. No test case invokes CRP.
16. No test case performs Agent Registry lookup.
17. No test case activates production authorization.
18. Private key material is not written or printed.
19. Harness cleanup leaves no residual lifecycle test records.
20. Existing PR #296 behavior is preserved when lifecycle enforcement is disabled.

---

## Definition of done

PR #297 is complete when:

* Migration `002` applies idempotently.
* All three lifecycle tables exist.
* The isolated lifecycle/store harness passes 16 of 16 cases.
* The enabled-Gateway harness passes 8 of 8 cases.
* All invalid cases consume zero unauthorized uses.
* Same-challenge retries are idempotent.
* Fresh challenges after exhaustion are rejected.
* Concurrent `maxUses=1` enforcement permits only one use.
* Revocation is rechecked during atomic claim.
* Store failure fails closed without canonical mutation.
* No payment or CRP side effect occurs.
* No `PAYMENT-RESPONSE` is emitted.
* No protected resource is released.
* No Agent Registry lookup occurs.
* Production activation remains false.
* Private key material remains protected.
* Harness cleanup leaves zero residual test records.
* The consolidated E2E entrypoint exits successfully.
* The repository’s predecessor Phase 5 tests remain green.
* The PR diff contains only the frozen PR #297 scope.

---

## Final accepted result

The consolidated acceptance run completed successfully with:

```text
Lifecycle tables present: 3/3

PR297_LIFECYCLE_HARNESS_COMPLETE=true
PR297_LIFECYCLE_ISOLATED_CERTIFICATION=true

matrixCases=8
passedCases=8

PR297_FINAL_ACCEPTANCE_POSITIVE_CURRENT=true
PR297_FINAL_ACCEPTANCE_POLICY_DENY_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_REVOKED_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_SAME_NONCE_IDEMPOTENT=true
PR297_FINAL_ACCEPTANCE_FRESH_NONCE_EXHAUSTED=true
PR297_FINAL_ACCEPTANCE_NOT_YET_VALID_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_EXPIRED_NO_CONSUMPTION=true
PR297_FINAL_ACCEPTANCE_STORE_FAILURE_FAILS_CLOSED=true
PR297_FINAL_ACCEPTANCE_CLEANUP_COMPLETE=true

PR297_LIFECYCLE_ENABLED_GATEWAY_CERTIFICATION=true
PR297_AGENT_DELEGATION_LIFECYCLE_E2E=true

PR297_PRODUCTION_ACTIVATION=false
PR297_AGENT_REGISTRY_LOOKUP=false
```

---

## Phase boundary

PR #297 closes Phase 5.

Any work involving:

* Agent Registry lookup.
* Registry-based agent-key resolution.
* Registry-based buyer-delegation discovery.
* Registry lifecycle or key rotation.
* Production authorization activation.
* Production protected-resource release.

belongs to Phase 6 or to a separately approved production-activation scope.

No PR #298 is required merely to restate, subdivide, or re-test the completed Phase 5 acceptance boundary.
