# Phase 6 Agent Registry Trust Contract and Architecture Invariants

## Status

This document defines the implementation boundary for Phase 6 PR #298.

PR #298 is the first finite Phase 6 implementation rung after the completed
Phase 5 PR #297 baseline. It freezes the versioned Agent Registry requirement,
reference, normalized trust-result, validation, reason-code, and component
ownership contracts that later Phase 6 work must consume.

This checkpoint is:

- contract-only;
- test-only;
- deterministic;
- side-effect free;
- independent of Gateway runtime behavior;
- independent of live Agent Registry access;
- independent of payment settlement;
- not production activation.

The final acceptance marker for this rung is:

    PR298_PHASE6_CONTRACT_ACCEPTANCE=true

That marker means the contract checkpoint passed. It does not mean that a live
Agent Registry resolver or Gateway integration exists.

## Phase 6 purpose

Phase 5 established the agent-delegated x402 authorization baseline:

- buyer-signed delegation;
- agent proof of possession;
- exact runtime binding;
- current-clock validity;
- durable revocation;
- atomic bounded-use enforcement;
- buyer-policy ordering;
- finalized payment settlement;
- receipt-gated resource release;
- replay prevention.

Phase 6 adds an independent accountability input: registry-recognized agent
trust.

The eventual Gateway release decision will require independent satisfaction of:

    buyer eligibility
    +
    valid buyer-to-agent delegation
    +
    registry-recognized agent accountability
    +
    finalized payment settlement
    =
    Gateway may release the protected resource

Registry recognition does not replace buyer policy, delegation, payment
settlement, replay protection, or the Gateway release decision.

## Contract surface

The implementation is defined in:

    src/phase6/agentRegistryTrustContract.ts

It exports three versioned contracts:

1. `AgentRegistryRequirementV1`
2. `AgentRegistryReferenceV1`
3. `AgentRegistryTrustResultV1`

All three use:

    version: "1.0.0"
    registryStandard: "CIS-8004"

## AgentRegistryRequirementV1

The requirement contract expresses the registry policy authored or compiled by
the Gateway side.

It includes:

- whether registry trust is required;
- trusted registry coordinates;
- required active status;
- Agent Card integrity requirements;
- required capability identifiers;
- owner-account binding requirements;
- verified-owner-identity requirements;
- external-key policy;
- maximum evidence age;
- optional indexer-lag tolerance;
- release-time revalidation threshold.

The Agent Registry record and Agent Card do not author Gateway policy.

The Gateway remains responsible for deciding which registry facts are required
for a protected route, merchant, contract, or authorization policy.

## AgentRegistryReferenceV1

The reference contract identifies the registry agent that the submitted
authorization claims to represent.

Canonical identity is the complete tuple:

    network
    + registry contract index
    + registry contract subindex
    + AgentTokenId
    + CAIP-19-shaped token address

The following fields are optional aliases or transport hints only:

- `tokenAddressBase58`;
- `didAlias`;
- `resolverHint`.

They must never replace the canonical identity tuple.

A display name, DID alias, Agent Card URL, wallet address, or short token label
must not independently become the authoritative registry identity.

## AgentRegistryTrustResultV1

The trust-result contract contains normalized and sanitized registry facts that
an external Agent Registry Plugin or Service may return in a later rung.

It includes:

- canonical registry identity;
- registry state;
- owner-account facts;
- owner-identity assurance;
- Agent Card integrity facts;
- agent-key binding facts;
- capability results;
- finalized-block and wall-clock freshness;
- sanitized evidence hash;
- deterministic trust reason.

The result is an input to Gateway policy composition.

It is never:

- a payment receipt;
- a settlement command;
- a Gateway state mutation;
- a resource-release instruction;
- blanket authorization for an agent;
- a reputation score;
- legal or regulatory certification.

## Canonical registry identity

The authoritative registry identity consists of:

- `network`;
- `registryContract.index`;
- `registryContract.subindex`;
- `agentTokenId`;
- `tokenAddress`.

All binding and substitution checks in later Phase 6 work must resolve back to
this tuple.

Optional aliases may assist discovery or interoperability, but they must not
override or weaken the canonical identity.

## Owner account and identity assurance

Owner-account binding and owner-identity assurance are intentionally separate.

`ownerAccountBound` means that normalized registry evidence binds the registry
record to the stated owner account.

`ownerIdentityAssurance: "verified"` is a stronger fact and requires:

- a present owner account;
- `ownerAccountBound: true`;
- separate identity-assurance evidence.

A registry owner account must not automatically be represented as:

- a verified natural person;
- a verified business;
- the buyer;
- the payer;
- the acting agent;
- the agent wallet;
- the merchant.

The contract preserves these distinctions so later policy composition cannot
silently collapse different trust relationships.

## Agent Card integrity

An Agent Card is a declared metadata artifact.

Its integrity may be represented by:

- URI;
- lowercase SHA-256 hash;
- integrity-verification result.

An integrity-verified Agent Card does not become the capability authority.

Integrity proves that the evaluated artifact matches the expected artifact. It
does not prove that every statement in the artifact is true, authorized, or
sufficient for Gateway policy.

PR #298 represents Agent Card facts structurally. It does not:

- retrieve an Agent Card;
- hash an Agent Card;
- parse an Agent Card;
- authenticate an Agent Card publisher;
- apply Agent Card declarations to Gateway release policy.

## Capability policy

The trust result distinguishes:

- capabilities required by policy;
- capabilities satisfied;
- capabilities missing;
- the resulting capability-policy status.

Gateway policy remains authoritative.

A registry record or Agent Card may declare capabilities, but those declarations
must not independently authorize a protected action.

A verified trust result requires:

- every required capability to be represented in `satisfied`;
- no required capability to be represented in `missing`;
- `policySatisfied: true`.

Contradictory capability sets fail closed.

## Agent-key binding

The contract reserves two normalized binding types:

    native
    CIS-8

When key binding is verified, both the binding type and key fingerprint must be
present.

When a later Gateway-authored requirement makes key binding mandatory, a
verified registry result must include a verified binding.

The eventual purpose of this binding is to establish that the acting Phase 5
agent key is the same key, or an explicitly authorized external key, associated
with the canonical registry agent.

PR #298 does not perform:

- native registry-key verification;
- CIS-8 lookup;
- CIS-8 signature verification;
- delegation-key substitution checks;
- cryptographic proof verification.

## Registry state

The normalized registry state supports:

- `Active`;
- `Revoked`;
- `Missing`;
- `Unknown`.

A verified trust result requires `Active`.

A revoked, missing, unknown, malformed, or unsupported registry result must not
be represented as verified.

Registry recognition is a current-state fact. Historical registration alone is
not enough.

## Freshness

Registry state is time-sensitive and must not be represented as timeless.

The trust result reserves:

- evidence source;
- finalized block height;
- finalized block hash;
- observation timestamp;
- evidence age;
- indexer lag;
- freshness result.

The permitted evidence sources are:

- `fixture`;
- `direct_chain`;
- `auditable_resolver`.

The `fixture` source exists only for deterministic contract testing. It must
never be presented as live chain authority.

PR #298 validates freshness shape and internal coherence. It does not query:

- a Concordium node;
- an Indexer;
- MCP;
- a hosted resolver;
- a registry service;
- any blockchain network.

## Validation model

The module exposes three pure validators:

    validateAgentRegistryRequirementV1
    validateAgentRegistryReferenceV1
    validateAgentRegistryTrustResultV1

Validation is deterministic and fail-closed.

The validation precedence is:

1. root object and exact-key validation;
2. frozen type literal;
3. frozen version literal;
4. supported registry standard;
5. nested exact-key validation;
6. primitive type and format validation;
7. uniqueness validation;
8. cross-field coherence validation.

Unknown keys fail closed.

Malformed optional values are rejected rather than silently coerced.

The validators return contract-validation results with explicit literal safety
fields showing that no runtime side effect occurred.

## Contract validation result

Each validator returns an `AgentRegistryContractValidationResult<T>` containing:

- `ok`;
- accepted or rejected status;
- contract-only mode;
- contract kind;
- deterministic validation reason;
- validated value or `null`;
- explicit safety fields.

The safety fields remain false:

- `gatewayCalled`;
- `registryNetworkCalled`;
- `ufxCalled`;
- `crpCalled`;
- `paymentAttempted`;
- `receiptIssued`;
- `paymentResponseEmitted`;
- `resourceReleased`;
- `stateMutated`;
- `agentRegistryLookupAttempted`;
- `productionActivation`.

Structural contract acceptance must not be confused with live registry
verification or runtime authorization.

## Structural rules

The validators enforce:

- exact object keys;
- frozen type and version literals;
- CIS-8004 as the only supported initial standard;
- non-empty trimmed strings;
- canonical non-negative decimal contract index;
- safe non-negative integer contract subindex;
- canonical non-negative decimal `AgentTokenId`;
- lowercase 64-character hexadecimal hashes when present;
- positive safe-integer freshness thresholds;
- revalidation threshold not exceeding maximum evidence age;
- no duplicate trusted-registry entries;
- no duplicate capability identifiers;
- absent or valid optional fields;
- no silent coercion.

PR #298 deliberately performs only conservative network and token-address shape
validation.

Full validation of the following is deferred:

- CAIP-2 semantics;
- CAIP-19 semantics;
- Concordium contract existence;
- Concordium module references;
- DID resolution;
- CIS-8004 state;
- CIS-8 bindings;
- real Agent Card semantics.

Those checks require authoritative libraries, pinned network configuration, and
live or auditable resolver behavior from later finite rungs.

## Trust-result coherence

A result with `verified: true` requires:

- reason `agent_registry_verified`;
- registry state `Active`;
- fresh evidence;
- capability policy satisfied;
- no missing required capabilities;
- every required capability represented as satisfied;
- verified key binding when key binding is marked required.

Additional invariants include:

- verified owner identity requires a bound and present owner account;
- verified key binding requires a binding type and fingerprint;
- verified Agent Card integrity requires a URI and hash;
- block height and block hash are either both present or both absent;
- fresh evidence requires an observation timestamp and evidence age;
- a failed result cannot use `agent_registry_verified`;
- satisfied and missing capability sets must not overlap;
- capability results must account for every required capability;
- contradictory positive and negative facts fail closed.

Requirement-to-result composition is not implemented in PR #298.

For example, whether Agent Card integrity is mandatory depends on the separately
validated Gateway-authored requirement. That composition belongs to later
Phase 6 Gateway work.

## Registry trust reason-code freeze

The initial normalized registry trust vocabulary is:

    agent_registry_verified
    missing_registry_reference
    invalid_registry_reference
    unsupported_registry_standard
    untrusted_registry_contract
    agent_not_registered
    agent_registry_revoked
    agent_registry_status_invalid
    agent_registry_contract_mismatch
    agent_registry_identity_mismatch
    agent_registry_owner_mismatch
    agent_registry_key_mismatch
    agent_card_missing
    agent_card_fetch_failed
    agent_card_hash_mismatch
    agent_capability_missing
    agent_capability_scope_mismatch
    agent_registry_evidence_stale
    agent_registry_resolver_unavailable
    agent_registry_result_invalid

Freezing these reasons prevents later resolvers and adapters from inventing
incompatible control vocabularies.

Most reasons are not produced by a live implementation in PR #298 because no
live implementation exists in this rung.

## Contract-validation reasons

The pure PR #298 validators use a separate structural-validation vocabulary:

    valid
    invalid_object_shape
    unsupported_type
    unsupported_version
    unsupported_registry_standard
    invalid_registry_requirement
    invalid_registry_reference
    invalid_registry_trust_result
    incoherent_registry_trust_result

This separation avoids confusing malformed contract input with a validly
structured runtime trust denial.

## Historical Phase 3 placeholders

Earlier Phase 3 structures include placeholder fields such as:

    agentRegistryRef
    cis8004TokenRef
    cis8ExternalKeyRef
    agentCardHash
    agentDid
    agentRegistryContract
    agentRegistryTokenId

Those fields are historical context only.

PR #298 does not promote, map, or bridge them automatically into the
authoritative Phase 6 model.

Any compatibility adapter must be explicit and separately scoped after the
Phase 6 contracts are accepted.

## Component ownership invariants

### XCF Gateway

The Gateway owns:

- x402 route and `PAYMENT-REQUIRED` construction;
- Conditional Gating;
- buyer policy;
- delegation and proof-of-possession composition;
- authorization lifecycle and bounded-use enforcement;
- registry-result policy composition;
- canonical authorization state;
- replay enforcement;
- settlement-receipt verification;
- final resource release.

The Gateway does not own:

- CIS-8004 chain mechanics;
- registry resolution mechanics;
- settlement-rail-specific proof generation.

### Agent Registry Plugin or Service

The Registry Plugin owns:

- trusted registry resolution;
- current active or revoked state;
- owner facts;
- Agent Card integrity facts;
- capability facts;
- optional key-binding facts;
- finalized freshness evidence;
- authenticated or signed normalized trust results.

It does not own:

- Gateway policy;
- buyer delegation;
- bounded-use mutation;
- payment settlement;
- resource release.

### UFX Facilitator

UFX owns:

- payment-intent handling;
- idempotency and expiry;
- settlement-rail selection;
- settlement verification or execution coordination;
- settlement normalization;
- signed settlement results.

UFX does not own:

- buyer policy;
- agent delegation policy;
- Registry policy;
- final resource release.

### Settlement Rail Plugin

A Settlement Rail Plugin owns chain- or scheme-specific settlement mechanics
and evidence.

The Concordium CRP is the Concordium reference settlement plugin.

A Settlement Rail Plugin does not own:

- Conditional Gating;
- Agent Registry policy;
- final resource release.

### Optional Orchestrator

The existing Orchestrator is not required for Phase 6.

It may be introduced only for separately approved long-running workflow needs.

It must not become:

- a mandatory Phase 6 hop;
- a source of Gateway authorization truth;
- a release authority.

## Independent authorization and settlement inputs

The Agent Registry Plugin and UFX remain separate branches:

                            XCF Gateway
                           /           \
              registry trust             settlement
                     |                       |
          Agent Registry Plugin             UFX
                                             |
                                  Settlement Rail Plugin
                                             |
                                  Concordium reference: CRP

The Gateway eventually verifies and composes two independent results:

    AgentRegistryTrustResult
    SettlementReceipt

Neither result alone authorizes release.

Registry trust is an authorization input.

Settlement evidence is a payment input.

The Gateway composes both with its local Conditional Gating, delegation,
lifecycle, binding, and replay decisions.

## Machine-assertable architecture invariants

The source module exports:

    PHASE6_AGENT_REGISTRY_ARCHITECTURE_INVARIANTS

This immutable object freezes the principal ownership and safety facts for
machine assertion by the permanent harness.

It confirms that:

- the Gateway owns final release;
- the Registry Plugin provides trust facts only;
- UFX owns settlement coordination;
- settlement rails own chain-specific mechanics only;
- the Orchestrator is not required;
- live registry lookup is false;
- Gateway runtime modification is false;
- payment is not attempted;
- a receipt is not issued;
- a protected resource is not released;
- production activation is false.

## Permanent harness

The permanent harness is:

    scripts/ci_phase6_agent_registry_trust_contract.ts

It freezes 24 focused cases:

- 6 accepted contract cases;
- 18 rejected malformed or contradictory cases.

It verifies:

- requirement contract acceptance;
- reference contract acceptance;
- verified trust-result acceptance;
- coherent denied-result acceptance;
- exact-key rejection;
- unsupported version rejection;
- unsupported registry-standard rejection;
- trusted-registry uniqueness;
- canonical contract and token identifiers;
- token-address shape;
- capability coherence;
- owner-binding coherence;
- key-binding coherence;
- freshness coherence;
- hash formatting;
- architecture ownership invariants;
- zero runtime side effects.

The harness freezes 20 Agent Registry trust reason codes.

The npm entrypoint is:

    npm run phase6:agent-registry-trust-contract-test

## Acceptance markers

The permanent harness emits:

    PR298_AGENT_REGISTRY_REQUIREMENT_CONTRACT=true
    PR298_AGENT_REGISTRY_REFERENCE_CONTRACT=true
    PR298_AGENT_REGISTRY_TRUST_RESULT_CONTRACT=true
    PR298_AGENT_REGISTRY_REASON_CODES_FROZEN=true
    PR298_ARCHITECTURE_INVARIANTS_FROZEN=true
    PR298_GATEWAY_RELEASE_AUTHORITY_PRESERVED=true
    PR298_UFX_SETTLEMENT_AUTHORITY_PRESERVED=true
    PR298_SETTLEMENT_RAIL_BOUNDARY_PRESERVED=true
    PR298_ORCHESTRATOR_REQUIRED=false
    PR298_LIVE_REGISTRY_LOOKUP=false
    PR298_GATEWAY_RUNTIME_CHANGED=false
    PR298_PAYMENT_ATTEMPTED=false
    PR298_RESOURCE_RELEASED=false
    PR298_PRODUCTION_ACTIVATION=false
    PR298_PHASE6_CONTRACT_ACCEPTANCE=true

The final marker does not claim live registry integration.

## Explicit PR #298 non-goals

PR #298 does not add:

- an `AgentRegistryResolver` interface;
- a fixture resolver;
- a trusted-registry runtime allowlist;
- live CIS-8004 access;
- Concordium node access;
- Indexer access;
- MCP access;
- hosted resolver calls;
- Testnet registry coordinates;
- DID resolution;
- live Concordium Badge parsing;
- Agent Card retrieval;
- Agent Card SHA-256 execution;
- capability evaluation against Gateway policy;
- CIS-8 resolution or verification;
- `src/server.ts` changes;
- Phase 5 source changes;
- database migrations;
- registry persistence or caching;
- bounded-use changes;
- replay changes;
- UFX changes;
- CRP changes;
- Facilitator changes;
- Orchestrator changes;
- payment execution;
- receipt issuance;
- `PAYMENT-RESPONSE`;
- protected-resource release;
- production activation.

## Protected paths

PR #298 must not modify:

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

## Security and confidentiality

The contract and harness must not contain or print:

- private keys;
- seed phrases;
- private JWK values;
- registry write credentials;
- raw buyer proofs;
- raw receipt JWS;
- complete `PAYMENT-RESPONSE`;
- sensitive protected-resource content.

Only sanitized hashes, public identifiers, deterministic reasons, and
test-only metadata are appropriate.

## Relationship to Phase 5

PR #298 consumes the completed PR #297 baseline without reopening it.

Phase 6 must preserve the accepted Phase 5 contracts for:

- buyer delegation;
- buyer signature verification;
- agent proof of possession;
- runtime authorization binding;
- lifecycle validity;
- revocation;
- bounded-use enforcement;
- buyer-policy ordering;
- payment eligibility;
- receipt-gated release;
- replay prevention.

Registry work is not a reason to redesign or relocate proven Phase 5 logic.

Conditional Gating remains in the Gateway.

## Finite Phase 6 ladder

Phase 6 is frozen at seven implementation rungs:

1. Registry trust contract and architecture invariants.
2. Controlled Gateway registry resolver seam.
3. Concordium CIS-8004 Registry Plugin.
4. Registry identity and agent-key binding.
5. Agent Card, capability, and freshness policy.
6. Gateway Conditional Gating composition.
7. Demo3 and final acceptance.

A new idea must fit one of these rungs, replace a lower-priority item, or be
deferred.

An eighth rung must not be added merely for:

- restatement;
- duplicated preflight;
- activation preparation;
- speculative infrastructure;
- documentation-only decomposition.

## Handoff to PR #299

The next finite rung is PR #299:

    controlled Gateway Agent Registry resolver seam

PR #299 may consume the accepted PR #298 contracts and introduce:

- an `AgentRegistryResolver` interface;
- deterministic test-only resolver results;
- trusted-registry allowlist checks;
- fail-closed missing behavior;
- fail-closed malformed behavior;
- fail-closed unavailable behavior.

PR #299 must still avoid:

- live chain access;
- live hosted resolver access;
- Gateway release-path behavior changes;
- payment or settlement changes;
- production activation.

## Stop rule

PR #298 stops when the following are accepted:

- the three versioned contracts;
- exact-shape validators;
- structural and coherence rules;
- registry trust reason vocabulary;
- architecture ownership invariants;
- permanent 24-case harness;
- package command;
- implementation-focused documentation.

Do not add:

- live lookup;
- runtime composition;
- persistence;
- caching;
- payment behavior;
- receipt behavior;
- release behavior;
- production behavior;

merely because the contract harness is green.
