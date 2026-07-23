# Phase 6 Controlled Agent Registry Resolver Seam

## Status

This document defines the implementation boundary for Phase 6 PR #299.

PR #299 is the second finite Phase 6 implementation rung. It consumes the
versioned Agent Registry contracts accepted in PR #298 and introduces a
controlled Gateway-owned resolver seam.

This checkpoint is:

- fixture-only;
- test-only;
- deterministic;
- fail-closed;
- side-effect free;
- independent of live CIS-8004 access;
- independent of Gateway runtime wiring;
- independent of Phase 5 lifecycle state;
- independent of payment settlement;
- not production activation.

The final acceptance marker for this rung is:

    PR299_PHASE6_RESOLVER_SEAM_ACCEPTANCE=true

That marker means the controlled resolver seam passed its permanent fixture
harness. It does not mean that a live Concordium Agent Registry Plugin exists.

## Relationship to PR #298

PR #298 froze:

- `AgentRegistryRequirementV1`;
- `AgentRegistryReferenceV1`;
- `AgentRegistryTrustResultV1`;
- strict runtime validators;
- registry trust reason codes;
- architecture ownership invariants.

PR #299 consumes those contracts without modifying them.

The resolver seam uses:

    validateAgentRegistryRequirementV1
    validateAgentRegistryReferenceV1
    validateAgentRegistryTrustResultV1

Every requirement, reference, and resolver output is validated at runtime.

A TypeScript type declaration from an external resolver is not treated as a
trust decision.

## Goal

PR #299 proves that the Gateway can safely call an injected Agent Registry
resolver through a narrow interface and consume its output without granting
that resolver authority over:

- Gateway policy;
- buyer delegation;
- Phase 5 lifecycle state;
- bounded-use mutation;
- replay state;
- payment settlement;
- receipt issuance;
- final resource release.

The seam must fail closed when:

- the requirement is invalid;
- a required registry reference is missing;
- the reference is malformed;
- the referenced registry is not trusted;
- the resolver is unavailable;
- the resolver throws;
- the resolver returns malformed output;
- the resolved registry identity differs from the requested identity;
- a configured module-reference pin does not match.

## Single proof obligation

PR #299 passes when:

> A validated Gateway-authored registry requirement and, when required, a
> validated canonical registry reference can be submitted to a fixture-only
> resolver through a Gateway-owned adapter; every returned value is validated
> using the PR #298 trust-result contract; untrusted, unavailable, malformed,
> thrown, and substituted results fail closed; coherent positive and negative
> trust facts remain distinguishable; and no live registry, Gateway runtime,
> Phase 5 state, payment, receipt, replay, or release behavior changes.

## Implementation surface

The implementation is defined in:

    src/phase6/agentRegistryResolverSeam.ts

It exports:

- resolver constants;
- resolver request contract;
- resolver interface;
- explicit unavailable-result contract;
- deterministic fixture resolver;
- Gateway-owned resolver adapter;
- resolver-seam result contract;
- resolver-seam statuses and reasons.

## Resolver interface

The controlled resolver interface is:

    AgentRegistryResolverV1

Its frozen identity is:

    kind: "xcf.agent-registry.resolver"
    version: "1.0.0"
    mode: "fixture_only"

Its operation is:

    resolve(request): Promise<unknown>

The return type is intentionally `unknown`.

This preserves the trust boundary between a resolver implementation and the
Gateway. The Gateway must validate the returned value before it can be treated
as an `AgentRegistryTrustResultV1`.

An implementation cannot bypass runtime validation by claiming that its return
value already has the correct TypeScript type.

## Resolver request

The resolver receives:

    AgentRegistryResolverRequestV1

Its frozen fields are:

- `type`;
- `version`;
- validated `requirement`;
- validated `reference`.

The request type literal is:

    xcf.agent-registry.resolve-request

The request does not contain:

- a Phase 5 authorization envelope;
- buyer identity;
- acting-agent identity;
- acting-agent public keys;
- challenge state;
- nonce or replay state;
- payment tuples;
- settlement evidence;
- resource content;
- release instructions.

Those inputs belong to later finite Phase 6 rungs.

## Gateway-owned adapter

The Gateway-side controlled adapter is:

    resolveAgentRegistryTrustForGatewayV1

The adapter executes this deterministic order:

1. Validate the Gateway-authored requirement.
2. Return `not_required` when registry trust is optional.
3. Require a reference when registry trust is mandatory.
4. Validate the canonical registry reference.
5. Match the reference against the trusted-registry allowlist.
6. Accept only the fixture-only resolver shape in PR #299.
7. Invoke the resolver inside guarded exception handling.
8. Detect an explicit unavailable result.
9. Validate all other returned values using PR #298.
10. Bind the normalized result back to the requested registry coordinates.
11. Bind the normalized result back to the requested token identity.
12. Enforce a configured module-reference pin.
13. Return normalized trust facts without authorizing payment or release.

Preflight failures occur before resolver invocation.

## Resolver-seam statuses

The seam exposes five statuses:

    not_required
    resolved
    rejected
    unavailable
    invalid_result

### `not_required`

The Gateway-authored requirement is structurally valid and registry trust is
not required.

The resolver is not invoked.

This status does not establish registry trust. It records that the separately
authored requirement did not require registry resolution.

### `resolved`

The resolver was invoked and returned a structurally valid, identity-bound,
trusted-registry result.

A resolved result may be either:

    verified: true

or:

    verified: false

`resolved` means the resolver boundary succeeded. It does not mean the
registry policy passed.

### `rejected`

The operation failed closed because of a requirement, reference, allowlist,
registry-coordinate, token-identity, or module-reference mismatch.

### `unavailable`

The resolver was not usable, explicitly reported unavailable, or threw an
exception.

### `invalid_result`

The resolver returned a value that did not satisfy the PR #298 normalized
trust-result contract.

## Resolver success versus registry trust

The following states remain distinct:

    resolver completed successfully
    !=
    registry trust satisfied
    !=
    Gateway authorization accepted
    !=
    payment eligible
    !=
    protected resource released

A coherent revoked result may therefore produce:

    status: "resolved"
    reason: "agent_registry_revoked"
    registryTrustSatisfied: false

This is intentional.

The Registry Plugin supplies facts. The Gateway applies policy.

## Seam result contract

The adapter returns:

    AgentRegistryResolverSeamResultV1

The result includes:

- `ok`;
- seam status;
- deterministic reason;
- requirement validation reason;
- reference validation reason;
- trust-result validation reason;
- validated requirement;
- validated reference;
- matched trusted-registry entry;
- validated trust result;
- `registryTrustSatisfied`;
- resolver invocation markers;
- explicit safety markers.

Rejected, unavailable, and invalid-result outcomes do not expose a normalized
trust result.

Resolved outcomes preserve the validated positive or negative trust result.

## Trusted-registry allowlist

The trusted-registry allowlist is authored by the Gateway through
`AgentRegistryRequirementV1`.

PR #299 performs exact matching on:

- network;
- registry contract index;
- registry contract subindex.

Aliases and transport hints are not allowlist authority.

The following cannot substitute for the trusted-registry coordinates:

- DID alias;
- Base58 token-address alias;
- resolver hint;
- Agent Card URI;
- display name;
- owner account;
- agent wallet;
- fixture configuration.

An unmatched network or contract fails before resolver invocation with:

    untrusted_registry_contract

## Module-reference pinning

A trusted-registry entry may include:

    moduleReference

When present, the normalized trust result must contain the exact same module
reference.

A mismatch fails closed with:

    agent_registry_contract_mismatch

PR #299 does not retrieve or verify a real Concordium module reference.

It only enforces exact equality between:

- the Gateway-authored pin; and
- the normalized fixture trust result.

Live module-reference acquisition belongs to PR #300.

## Registry-result binding

After structural validation, the resolver result is bound to the submitted
reference.

### Registry-coordinate binding

The result must match the reference on:

- network;
- contract index;
- contract subindex.

A mismatch returns:

    agent_registry_contract_mismatch

### Token-identity binding

The result must match the reference on:

- `agentTokenId`;
- `tokenAddress`.

A mismatch returns:

    agent_registry_identity_mismatch

This protects the seam against a resolver returning a valid trust result for a
different registry token.

This check does not establish that the Phase 5 acting agent key is the same key
associated with the registry token.

Acting-agent and key binding remain deferred to PR #301.

## Deterministic fixture resolver

PR #299 includes:

    DeterministicAgentRegistryFixtureResolverV1

It supports three deterministic behaviors:

    result
    unavailable
    throw

### `result`

Returns the configured unknown value.

That value is still validated by the Gateway-owned adapter.

### `unavailable`

Returns the explicit unavailable-result contract:

    type: "xcf.agent-registry.resolver-unavailable"
    version: "1.0.0"
    status: "unavailable"
    reason: "agent_registry_resolver_unavailable"

### `throw`

Throws a deterministic fixture exception.

The Gateway adapter catches the exception and returns:

    status: "unavailable"
    reason: "resolver_exception"

The exception is not allowed to escape into payment, release, or runtime logic.

## Fixture-only boundary

The fixture resolver is a test double.

It does not use:

- `fetch`;
- Axios;
- HTTP;
- gRPC;
- Concordium SDK;
- Concordium node access;
- Indexer access;
- MCP;
- hosted resolver access;
- filesystem reads;
- database access;
- environment-configured endpoints;
- timers;
- retries;
- real Testnet registry coordinates;
- credentials.

The fixture resolver must not be represented as a live CIS-8004 implementation.

## Deterministic reasons

PR #299 reuses the PR #298 trust vocabulary where appropriate:

    missing_registry_reference
    invalid_registry_reference
    unsupported_registry_standard
    untrusted_registry_contract
    agent_registry_resolver_unavailable
    agent_registry_result_invalid
    agent_registry_contract_mismatch
    agent_registry_identity_mismatch

The seam introduces only the minimum additional reasons:

    not_required
    invalid_registry_requirement
    resolver_exception

A large parallel reason vocabulary is deliberately avoided.

## Requirement validation

Malformed or unsupported requirements fail before any resolver call.

A requirement failure records the PR #298 structural validation reason.

Unsupported registry standards preserve:

    unsupported_registry_standard

Other malformed requirement failures map to:

    invalid_registry_requirement

An optional valid requirement returns `not_required`.

## Reference validation

A mandatory requirement without a reference fails with:

    missing_registry_reference

A malformed reference fails with:

    invalid_registry_reference

An unsupported reference standard fails with:

    unsupported_registry_standard

No resolver call occurs for these cases.

## Resolver unavailability

PR #299 distinguishes two fixture-only unavailable paths.

### Explicit unavailable result

The resolver returns the exact unavailable-result contract.

The adapter returns:

    status: "unavailable"
    reason: "agent_registry_resolver_unavailable"

### Resolver exception

The resolver throws during invocation.

The adapter returns:

    status: "unavailable"
    reason: "resolver_exception"

Neither path:

- mutates canonical state;
- consumes bounded use;
- touches replay state;
- attempts payment;
- issues a receipt;
- releases a resource.

## Malformed resolver output

Every resolver output other than the exact unavailable contract is passed to:

    validateAgentRegistryTrustResultV1

A malformed value returns:

    status: "invalid_result"
    reason: "agent_registry_result_invalid"

The underlying PR #298 validation reason remains available through:

    trustResultValidationReason

This preserves useful diagnostics without treating malformed resolver output as
a normalized registry trust denial.

## Coherent negative trust facts

PR #299 preserves coherent negative normalized results.

Examples include:

- revoked registry agent;
- missing registry agent.

These results are structurally valid and identity-bound.

They therefore return:

    status: "resolved"
    registryTrustSatisfied: false

They must never be transformed into:

- an allow decision;
- payment eligibility;
- receipt eligibility;
- resource release.

## Permanent harness

The permanent harness is:

    scripts/ci_phase6_agent_registry_resolver_seam.ts

It freezes 16 cases:

- 4 controlled or resolved cases;
- 12 fail-closed cases.

## Accepted cases

The accepted cases are:

1. Optional requirement bypasses the resolver.
2. Trusted pinned registry resolves a verified result.
3. Coherent revoked result is preserved.
4. Coherent missing-agent result is preserved.

Only the verified result produces:

    registryTrustSatisfied: true

The coherent revoked and missing-agent results produce:

    registryTrustSatisfied: false

## Fail-closed cases

The rejected or unavailable cases are:

1. Unsupported requirement version.
2. Required trust without a reference.
3. Malformed reference.
4. Unsupported reference standard.
5. Untrusted registry network.
6. Untrusted registry contract.
7. Explicit resolver unavailability.
8. Resolver exception.
9. Malformed resolver output.
10. Registry-contract substitution.
11. Token-identity substitution.
12. Pinned module-reference mismatch.

The harness verifies that preflight failures do not invoke the resolver.

## Invocation accounting

The harness uses a counting fixture resolver.

It records:

- call count;
- last request.

Cases rejected before resolver invocation assert:

    resolverCalls: 0
    resolverInvoked: false
    fixtureResolverInvoked: false

Cases reaching the fixture boundary assert:

    resolverCalls: 1
    resolverInvoked: true
    fixtureResolverInvoked: true

Fixture invocation is not a live registry lookup.

## Safety fields

Every seam result freezes the following safety fields:

    registryNetworkCalled=false
    gatewayRuntimeCalled=false
    gatewayRuntimeChanged=false
    phase5StateMutated=false
    canonicalStateMutated=false
    boundedUseConsumed=false
    replayStateMutated=false
    ufxCalled=false
    crpCalled=false
    paymentAttempted=false
    receiptIssued=false
    paymentResponseEmitted=false
    resourceReleased=false
    agentRegistryLookupAttempted=false
    productionActivation=false

`agentRegistryLookupAttempted` remains false because PR #299 performs no live
registry lookup.

The fixture resolver invocation is represented separately.

## Acceptance markers

The permanent harness emits:

    PR299_AGENT_REGISTRY_RESOLVER_INTERFACE=true
    PR299_GATEWAY_RESOLVER_ADAPTER=true
    PR299_DETERMINISTIC_FIXTURE_RESOLVER=true
    PR299_TRUSTED_REGISTRY_ALLOWLIST_ENFORCED=true
    PR299_MISSING_REFERENCE_FAILS_CLOSED=true
    PR299_MALFORMED_RESULT_FAILS_CLOSED=true
    PR299_RESOLVER_UNAVAILABLE_FAILS_CLOSED=true
    PR299_RESOLVER_EXCEPTION_FAILS_CLOSED=true
    PR299_NEGATIVE_TRUST_RESULT_PRESERVED=true
    PR299_RESULT_IDENTITY_BINDING_ENFORCED=true
    PR299_LIVE_REGISTRY_LOOKUP=false
    PR299_GATEWAY_RUNTIME_CHANGED=false
    PR299_PHASE5_STATE_MUTATED=false
    PR299_PAYMENT_ATTEMPTED=false
    PR299_RESOURCE_RELEASED=false
    PR299_PRODUCTION_ACTIVATION=false
    PR299_PHASE6_RESOLVER_SEAM_ACCEPTANCE=true

These markers prove only the fixture-only seam checkpoint.

## Component ownership invariants

### Gateway

The Gateway owns:

- requirement validation;
- reference validation;
- trusted-registry policy;
- resolver-result validation;
- result-to-reference binding;
- future authorization composition;
- final resource release.

### Agent Registry resolver or plugin

The resolver supplies normalized registry evidence.

It does not own:

- Gateway policy;
- buyer policy;
- delegation policy;
- Phase 5 lifecycle state;
- bounded-use mutation;
- payment settlement;
- final resource release.

### UFX

UFX remains outside PR #299.

The resolver seam does not invoke UFX.

### Settlement Rail Plugin

Settlement rails remain outside PR #299.

The resolver seam does not invoke CRP or another settlement rail.

### Orchestrator

The Orchestrator is not required for PR #299.

## Explicit non-goals

PR #299 does not add:

- live CIS-8004 lookup;
- Concordium node access;
- Indexer access;
- MCP access;
- hosted resolver access;
- Testnet registry configuration;
- real module-reference verification;
- finalized on-chain registry evidence;
- network timeout policy;
- retry policy;
- caching;
- persistence;
- database migrations;
- DID resolution;
- Agent Card retrieval;
- Agent Card hashing;
- capability-policy evaluation;
- freshness-threshold enforcement;
- release-time revalidation;
- Phase 5 acting-agent identity binding;
- acting-agent key binding;
- native registry-key verification;
- CIS-8 verification;
- `src/server.ts` changes;
- Gateway route changes;
- Phase 5 source changes;
- Phase 3 source changes;
- canonical-state mutation;
- bounded-use consumption;
- replay mutation;
- UFX calls;
- CRP calls;
- payment execution;
- receipt issuance;
- `PAYMENT-RESPONSE`;
- protected-resource release;
- production activation.

## Protected paths

PR #299 must not modify:

- `src/phase6/agentRegistryTrustContract.ts`;
- `src/server.ts`;
- `src/phase5/**`;
- `src/phase3/**`;
- `src/db/**`;
- `db/migrations/**`;
- `config/contracts.json`;
- `package-lock.json`;
- `scripts/demo_*`.

External repositories remain unchanged:

- `xcf-concordium-facilitator`;
- `xcf-orchestrator`;
- `xcf-wallet-proxy`.

## Files in scope

PR #299 is limited to:

- `src/phase6/agentRegistryResolverSeam.ts`;
- `scripts/ci_phase6_agent_registry_resolver_seam.ts`;
- `docs/phase6-agent-registry-resolver-seam.md`;
- `package.json`.

## Package command

The permanent harness entrypoint is:

    npm run phase6:agent-registry-resolver-seam-test

Adding this command must not change `package-lock.json`.

## Validation plan

Before commit, PR #299 requires:

1. Targeted compilation of PR #298, the resolver seam, and the harness.
2. PR #298 contract-harness regression.
3. PR #299 resolver-seam harness.
4. Accepted Phase 5 test-only predecessor regression coverage.
5. Exact four-file scope audit.
6. Protected-path audit.
7. Dependency and network-call audit.
8. Secret and private-material audit.
9. Documentation contamination audit.
10. CR-byte and trailing-whitespace audit.
11. `git diff --check`.
12. Frozen `package-lock.json` hash verification.
13. Complete unstaged diff review.
14. Staged-integrity review before commit.

The live lifecycle E2E demo remains excluded because PR #299 must not attempt
payment or release.

## Deferred to PR #300

PR #300 may introduce the Concordium CIS-8004 Registry Plugin or Service.

That rung may address:

- trusted Testnet configuration;
- finalized registry-state reads;
- active and revoked state;
- owner facts;
- module reference from an authoritative source;
- freshness evidence;
- network timeout behavior;
- fail-closed live resolver availability.

PR #300 must consume the PR #299 resolver interface rather than bypassing it.

## Deferred to PR #301

PR #301 owns registry identity and acting-agent key binding.

That rung may address:

- binding the Phase 5 acting agent to the registry token;
- native-key binding;
- CIS-8 external-key binding;
- token substitution detection across authorization inputs;
- owner mismatch;
- agent-account mismatch.

The identity checks in PR #299 bind only the normalized resolver result to the
submitted registry reference.

They do not complete Phase 5 acting-agent binding.

## Deferred to PR #302

PR #302 owns:

- Agent Card retrieval;
- exact-byte hashing;
- capability-policy evaluation;
- evidence-age policy;
- indexer-lag policy;
- release-time revalidation.

## Deferred to PR #303

PR #303 owns Gateway Conditional Gating composition.

That rung may connect registry trust to:

- Phase 5 authorization;
- buyer policy;
- lifecycle ordering;
- bounded-use ordering;
- payment eligibility;
- receipt-gated release.

PR #299 does not wire the resolver seam into the Gateway runtime.

## Definition of Done

PR #299 is complete when:

- the resolver interface exists;
- the request contract exists;
- the Gateway-owned adapter exists;
- the deterministic fixture resolver exists;
- optional requirements bypass without resolver invocation;
- required missing references fail closed;
- malformed requirements and references fail closed;
- unsupported standards fail closed;
- untrusted registries fail before resolver invocation;
- unavailable and thrown resolver paths fail closed;
- malformed resolver output fails closed;
- registry-coordinate substitution fails closed;
- token-identity substitution fails closed;
- module-reference mismatch fails closed;
- positive and coherent negative trust facts remain distinguishable;
- no final Gateway authorization decision is made;
- no live registry lookup occurs;
- no Phase 5 state is mutated;
- no payment, receipt, replay, or release behavior changes;
- the permanent harness passes;
- the diff remains within the four-file ceiling;
- `package-lock.json` remains unchanged.

## Stop rule

Stop when the controlled fixture-only resolver seam and fail-closed harness are
accepted.

Do not add live Concordium access because the resolver interface is ready.

Do not add Testnet registry coordinates because the allowlist works.

Do not bind the Phase 5 acting-agent key because result-to-reference binding
works.

Do not fetch Agent Cards because normalized results are available.

Do not evaluate freshness or capabilities because the trust-result contract
contains those fields.

Do not wire `src/server.ts` because the fixture harness is green.

Do not add persistence, payment, receipt, replay, or release behavior.

The next finite rung is:

    PR #300 — Concordium CIS-8004 Registry Plugin
