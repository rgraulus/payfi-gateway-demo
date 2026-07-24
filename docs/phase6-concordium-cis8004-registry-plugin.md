# Phase 6 Concordium CIS-8004 Registry Plugin

## Status

This document defines the implementation and safety boundary for Phase 6
PR #300.

PR #300 is the third finite Phase 6 implementation rung. It consumes the
versioned Agent Registry trust contracts accepted in PR #298 and the
Gateway-owned resolver seam accepted in PR #299.

This checkpoint is:

- read-only;
- direct-chain;
- Concordium Testnet specific;
- pinned to one trusted CIS-8004 registry instance and module;
- based on one finalized snapshot per lookup;
- deterministic under the injected transport harness;
- fail-closed;
- independent of Gateway runtime wiring;
- independent of Phase 5 authorization composition;
- independent of payment settlement;
- not production activation.

The permanent deterministic acceptance marker for this rung is:

    PR300_DETERMINISTIC_ACCEPTANCE=true

That marker means the plugin, resolver integration, normalization contract, and
fail-closed matrix passed the deterministic PR #300 harness.

It does not mean that:

- Phase 5 acting-agent identity has been bound to a registry token;
- a native registry key or CIS-8 key has been verified;
- an Agent Card has been retrieved or hashed;
- registry capabilities have been evaluated;
- freshness thresholds have been enforced;
- Gateway conditional gating has changed;
- payment or resource release has been activated.

## Relationship to PR #298

PR #298 froze:

- `AgentRegistryRequirementV1`;
- `AgentRegistryReferenceV1`;
- `AgentRegistryTrustResultV1`;
- strict runtime validators;
- registry trust reason codes;
- architecture ownership invariants.

PR #300 does not modify the PR #298 trust-contract source.

The plugin emits values that must still pass:

    validateAgentRegistryRequirementV1
    validateAgentRegistryReferenceV1
    validateAgentRegistryTrustResultV1

A TypeScript type assertion, Concordium SDK return type, or decoded smart
contract value is not accepted as trusted Gateway evidence without runtime
validation.

## Relationship to PR #299

PR #299 introduced:

- `AgentRegistryResolverV1`;
- `AgentRegistryResolverRequestV1`;
- `AgentRegistryResolverUnavailableV1`;
- `AgentRegistryResolverSeamResultV1`;
- `resolveAgentRegistryTrustForGatewayV1`;
- a deterministic fixture resolver;
- registry-coordinate and token-identity binding;
- optional module-reference pin enforcement.

PR #300 consumes that seam rather than bypassing it.

The resolver mode surface is widened from only:

    fixture_only

to:

    fixture_only
    concordium_cis8004

The existing fixture-only PR #299 behavior remains permanent regression
coverage.

## Goal

PR #300 proves that a Concordium-specific Registry Plugin can read trusted
CIS-8004 state directly from a Concordium node, normalize it into the PR #298
trust-result contract, and pass it through the PR #299 Gateway-owned resolver
adapter without granting the plugin authority over Gateway policy, Phase 5
state, payment, receipts, replay state, or resource release.

The plugin must fail closed when:

- the network is unsupported;
- the registry contract is not trusted;
- the configured module pin does not match;
- the registry instance is missing;
- the latest-finalized snapshot cannot be established;
- the contract view invocation fails;
- the network operation times out;
- the decoded value is malformed;
- status and revocation facts contradict each other;
- owner facts are malformed;
- the returned token identity differs from the requested token;
- the transport throws;
- a normalized result fails the PR #298 validator.

## Single proof obligation

PR #300 passes when:

> A validated Gateway-authored registry requirement and canonical CIS-8004
> reference can be submitted through the PR #299 resolver seam to a
> Concordium-mode plugin; the plugin can obtain one latest-finalized Testnet
> snapshot, verify the trusted registry coordinates and module reference, invoke
> the CIS-8004 `agentOf` view at that snapshot, normalize Active, Revoked, or
> Missing state into the PR #298 trust-result contract, preserve owner and Agent
> Card on-chain facts without overstating identity, key, capability, or Agent
> Card verification, fail closed on every unavailable, malformed,
> contradictory, substituted, or mismatched condition, and perform no
> transaction, signing, persistence, Gateway runtime, Phase 5, payment, receipt,
> replay, release, or production action.

## Implementation surface

The plugin implementation is:

    src/phase6/concordiumCis8004RegistryPlugin.ts

The deterministic acceptance harness is:

    scripts/ci_phase6_concordium_cis8004_registry_plugin.ts

The controlled seam extension is:

    src/phase6/agentRegistryResolverSeam.ts

This document is:

    docs/phase6-concordium-cis8004-registry-plugin.md

The final package command entries are added in:

    package.json

No dependency installation is required.

`package-lock.json` must remain unchanged.

## Trusted Testnet configuration

The frozen PR #300 trusted configuration is:

    network: ccd:testnet
    registryStandard: CIS-8004
    registry contract: <12802,0>
    module reference:
      2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41
    contract name: CIS-8004
    view entrypoint: agentOf
    gRPC host: grpc.testnet.concordium.com
    gRPC port: 20000
    TLS: true
    timeout: 10000 milliseconds
    transport: direct_chain

The exported configuration is:

    CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG

The gRPC endpoint is transport configuration.

It is not the trust anchor.

The trust anchors are:

- the Gateway-authored network;
- the exact registry contract coordinate;
- the exact module reference;
- the required CIS-8004 standard.

Changing an endpoint must not implicitly change which registry instance or
module is trusted.

## Resolver identity

The plugin resolver identity is:

    kind: xcf.agent-registry.resolver
    version: 1.0.0
    mode: concordium_cis8004

The implementation class is:

    ConcordiumCis8004RegistryPluginV1

It is structurally compatible with:

    AgentRegistryResolverV1

The resolver operation remains:

    resolve(request): Promise<unknown>

The `unknown` return boundary remains intentional.

The Gateway-owned seam validates the result after the plugin returns it.

## Read transport

The transport contract is:

    ConcordiumCis8004ReadTransportV1

The direct implementation is:

    ConcordiumGrpcCis8004ReadTransportV1

The transport kind is:

    direct_chain

The transport exposes only:

    read(request): Promise<unknown>

It does not expose:

- register;
- transfer;
- revoke;
- upgrade;
- update;
- submit;
- sign;
- persist;
- cache;
- release.

The deterministic harness asserts that the direct transport prototype exposes
only the `read` operation.

## Direct Concordium SDK boundary

The direct transport uses the existing repository dependencies:

- `@concordium/web-sdk`;
- `@concordium/web-sdk/nodejs`;
- `@grpc/grpc-js`.

No new package is introduced.

The transport uses a Concordium gRPC node directly.

It does not use:

- Concordium Indexer as an authority;
- hosted MCP as a runtime dependency;
- HTTP registry lookup;
- a hosted Agent Registry resolver;
- a database;
- a local cache;
- a filesystem fixture;
- a wallet;
- a signing key.

Indexer and MCP tooling may be used separately for discovery or diagnostics,
but they are not part of the PR #300 runtime trust path.

## One finalized snapshot

A transport lookup captures one latest-finalized block value.

That exact block value is reused for:

1. block information;
2. registry instance information;
3. embedded module schema retrieval;
4. CIS-8004 `agentOf` invocation.

The transport rejects a snapshot unless the block information states:

    finalized: true

The normalized snapshot carries:

- finalized block hash;
- finalized block height;
- block slot time as `observedAt`;
- `finalized: true`.

The same block is used for every normalized registry fact returned by one
lookup.

PR #300 does not combine:

- instance data from one block;
- schema data from another block;
- registry data from a third block.

## Contract and module checks

The configured registry coordinate is converted to a Concordium contract
address and queried at the captured finalized block.

The instance must exist.

The instance source module is normalized to a lowercase 64-character hex
reference.

The final read result must match the pinned module reference exactly.

A module mismatch fails closed with:

    agent_registry_contract_mismatch

The result is never accepted merely because the configured contract coordinate
exists.

## CIS-8004 view invocation

PR #300 uses one CIS-8004 view:

    CIS-8004.agentOf

The deployed schema establishes that the parameter is an eight-byte token ID
encoded as a byte list.

The implementation converts the canonical decimal `agentTokenId` to:

- unsigned 64-bit range;
- eight bytes;
- little-endian order;
- lowercase hexadecimal input for SDK schema serialization.

The accepted token range is:

    0 through 18446744073709551615

Values outside the unsigned 64-bit range fail closed.

The SDK:

- serializes the update-contract parameter from the embedded schema;
- performs a read-only `invokeContract`;
- decodes the return value from the same embedded schema.

No transaction is submitted.

`invokeContract` is a simulation/view operation, not a state-changing contract
update.

## Decoded `agentOf` shape

The decoded result is an option.

Missing state is represented by:

    None

Existing state is represented by:

    Some(AgentRecord)

The normalized record includes:

- token ID;
- owner account;
- optional Agent URI;
- optional metadata hash;
- optional external reference;
- optional agent wallet;
- Active or Revoked status;
- registration time;
- optional revocation time;
- optional revocation reason.

On-chain metadata is required to have the expected decoded array shape, but
PR #300 does not interpret it as authorization policy.

## Strict decoded-record validation

The decoded record is rejected unless:

- all expected record fields are present;
- no unexpected field is present;
- the token ID is exactly eight bytes;
- the owner account is a compact non-empty identifier;
- the status is exactly Active or Revoked;
- optional fields use the expected Concordium option shape;
- the metadata hash is exactly 32 bytes when present;
- registration and revocation times normalize to ISO timestamps;
- on-chain metadata has the expected array shape.

The plugin also rejects contradictory state.

An Active record must have:

    revokedAt: null
    revocationReason: null

A Revoked record must have:

    revokedAt: non-null

Malformed or contradictory decoded data is not silently converted to Missing.

It fails closed as resolver unavailable.

## Normalized Active result

An Active record maps to:

    state.status: Active
    state.ownerAccount: on-chain owner
    state.ownerAccountBound: true
    state.ownerIdentityAssurance: not_evaluated
    state.agentWallet: on-chain optional wallet
    agentCard.uri: on-chain optional URI
    agentCard.hash: on-chain optional metadata hash
    agentCard.integrityVerified: false
    freshness.source: direct_chain
    freshness.indexerLagBlocks: null
    evidenceHash: null

An Active record may produce:

    verified: true
    reason: agent_registry_verified

only for the PR #300 base profile.

## PR #300 base verification profile

PR #300 can verify an Active registry result only when:

- the registry requirement is mandatory;
- the trusted registry matches the pinned network and contract;
- a configured trusted-registry module pin is absent or matches;
- the reference uses the CIS-8004 standard;
- the record is Active;
- owner-account binding is available when required;
- Agent Card integrity is not required;
- no capability is required;
- verified owner identity is not required;
- the external key policy is `optional`;
- the finalized snapshot is structurally complete.

This rung does not satisfy requirements that demand:

- Agent Card integrity;
- registry-declared capabilities;
- verified owner identity;
- a required external key;
- a forbidden external-key policy decision.

Those concerns belong to later finite rungs.

## Normalized Revoked result

A Revoked record maps to a coherent negative trust result:

    status: resolved
    verified: false
    reason: agent_registry_revoked
    state.status: Revoked
    registryTrustSatisfied: false

The owner, wallet, Agent URI, metadata hash, and finalized snapshot may remain
available as normalized facts.

A revoked result is not transformed into resolver unavailability.

It is valid negative registry evidence.

## Normalized Missing result

A decoded `None` maps to a coherent negative trust result:

    status: resolved
    verified: false
    reason: agent_not_registered
    state.status: Missing
    registryTrustSatisfied: false

Missing state contains no owner, wallet, Agent Card, or module-derived agent
record.

Missing is used only for a valid decoded `None`.

Malformed data is never silently mapped to Missing.

## Owner facts

PR #300 records the on-chain owner account.

It sets:

    ownerAccountBound: true

because the owner is part of the returned registry record for that token.

It sets:

    ownerIdentityAssurance: not_evaluated

because PR #300 does not prove that the owner satisfies a Concordium identity
policy or is the Phase 5 buyer or acting agent.

Owner-account presence is not equivalent to verified owner identity.

## Agent wallet facts

The optional registry agent wallet is normalized as an on-chain fact.

PR #300 does not prove that:

- the Phase 5 acting agent controls that wallet;
- the wallet signed the current challenge;
- the wallet signed buyer delegation;
- the wallet is authorized for the requested resource;
- the wallet is bound through CIS-8.

Those checks belong to PR #301.

## Agent Card facts

The optional Agent URI and metadata hash are carried as on-chain facts.

PR #300 does not:

- fetch the URI;
- render the URI;
- execute URI content;
- follow redirects;
- parse an Agent Card;
- hash fetched bytes;
- compare fetched bytes to the on-chain hash;
- evaluate capabilities from the card.

The URI is opaque untrusted text.

The metadata hash is an opaque on-chain 32-byte fact.

The plugin therefore always sets:

    agentCard.integrityVerified: false

A URI may contain hostile or malformed content.

It must never be rendered or executed by the PR #300 plugin or harness.

## Key binding

PR #300 does not verify:

- native registry key control;
- an agent-wallet signature;
- CIS-8 external-key binding;
- a key fingerprint;
- Phase 5 proof of possession;
- buyer delegation signature continuity.

The normalized key-binding result remains:

    verified: false
    bindingType: null
    keyFingerprint: null

The PR #300 base profile requires:

    externalKeyPolicy: optional

PR #301 owns registry identity and acting-agent key binding.

## Capability policy

PR #300 does not retrieve or evaluate Agent Card capabilities.

The base profile therefore requires:

    requiredCapabilities: []

When capabilities are required, the result fails closed with:

    agent_capability_missing

PR #302 owns Agent Card capability evaluation.

## Freshness semantics

PR #300 records direct-chain finalized evidence.

The normalized fields are:

- `source: direct_chain`;
- finalized block height;
- finalized block hash;
- block slot time;
- calculated evidence age;
- `indexerLagBlocks: null`.

No Indexer is used, so Indexer lag is not fabricated.

The PR #300 `fresh` marker means that the direct-chain snapshot is structurally
complete and finalized.

PR #300 does not enforce:

- `maxEvidenceAgeSeconds`;
- `maxIndexerLagBlocks`;
- `revalidateBeforeReleaseIfOlderThanSeconds`;
- release-time revalidation;
- stale-node policy.

Those policy checks belong to PR #302 and PR #303.

## Timeout behavior

The complete transport read is wrapped in the configured timeout.

The default timeout is:

    10000 milliseconds

A timeout returns the explicit resolver-unavailable contract.

The Gateway-owned seam then returns:

    status: unavailable
    reason: agent_registry_resolver_unavailable

PR #300 does not retry.

A separate retry policy is not introduced.

## Fail-closed result classes

### Unsupported network or contract

The PR #299 Gateway-owned allowlist rejects an unsupported network or contract
before resolver invocation.

Expected result:

    status: rejected
    reason: untrusted_registry_contract
    resolverInvoked: false

### Registry contract mismatch

A normalized result whose network or contract differs from the pinned
configuration fails with:

    agent_registry_contract_mismatch

### Module mismatch

A returned module reference that differs from the pinned module fails with:

    agent_registry_contract_mismatch

### Token substitution

A returned record token ID that differs from the requested `agentTokenId` fails
with:

    agent_registry_identity_mismatch

The PR #299 adapter performs the final identity-binding check.

### Missing contract

A missing registry instance maps to resolver unavailability.

### Invocation failure

An unsuccessful `agentOf` invocation maps to resolver unavailability.

### Transport exception

A transport exception maps to resolver unavailability.

### Timeout

A transport timeout maps to resolver unavailability.

### Malformed result

A malformed transport result maps to resolver unavailability.

### Contradictory result

A contradictory status, revocation, owner, or record shape maps to resolver
unavailability.

None of these failures:

- mutates state;
- attempts payment;
- issues a receipt;
- releases a resource.

## Seam invocation markers

The seam result distinguishes:

    resolverInvoked
    fixtureResolverInvoked
    concordiumResolverInvoked
    registryNetworkCalled
    agentRegistryLookupAttempted

For the deterministic fixture resolver:

    fixtureResolverInvoked: true
    concordiumResolverInvoked: false
    registryNetworkCalled: false
    agentRegistryLookupAttempted: false

For a Concordium-mode resolver invocation:

    fixtureResolverInvoked: false
    concordiumResolverInvoked: true
    registryNetworkCalled: true
    agentRegistryLookupAttempted: true

These markers account for crossing the Concordium resolver boundary.

They do not assert:

- that the lookup succeeded;
- that the agent was Active;
- that registry trust was satisfied;
- that payment was eligible;
- that release occurred.

Preflight failures before resolver invocation keep all resolver and network
markers false.

The deterministic transport call count separately verifies whether a test case
reached the injected read transport.

## Safety fields

Every PR #300 seam outcome preserves these unrelated side-effect fields as
false:

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
    productionActivation=false

The deterministic harness also asserts:

    transactionSubmitted=false
    signingKeyUsed=false
    persistenceUsed=false

A registry lookup is an authorization-input operation.

It is not:

- a settlement;
- a receipt;
- a release instruction;
- a state mutation.

## Deterministic permanent harness

The permanent deterministic harness is:

    scripts/ci_phase6_concordium_cis8004_registry_plugin.ts

It uses an injected counting read transport.

It does not depend on:

- Internet access;
- a Concordium node;
- MCP;
- Indexer;
- a database;
- a wallet;
- an Agent Card host;
- a signing key.

The deterministic command is:

    npm run phase6:concordium-cis8004-registry-plugin-test

The package command runs the harness through `ts-node --transpile-only`.

## Deterministic acceptance matrix

The harness freezes 20 cases:

- 6 positive normalization cases;
- 13 negative or fail-closed cases;
- 1 read-only transport-surface case.

### Positive cases

1. Active record resolves from one finalized snapshot.
2. Owner account and wallet are normalized.
3. Trusted module reference is preserved.
4. Agent URI and hash remain opaque, unverified facts.
5. Finalized hash, height, and observation time are normalized.
6. Every fact uses one transport snapshot.

### Negative cases

1. Revoked record maps to a coherent negative result.
2. Missing token maps to `agent_not_registered`.
3. Unsupported network fails before transport.
4. Wrong contract fails before transport.
5. Module mismatch fails closed.
6. Missing contract maps to unavailable.
7. `agentOf` invocation failure maps to unavailable.
8. Timeout maps to unavailable.
9. Malformed transport result fails closed.
10. Contradictory status and revocation facts fail closed.
11. Malformed owner facts fail closed.
12. Token substitution is rejected by the Gateway adapter.
13. Transport exception maps to unavailable.

### Safety case

The direct transport prototype exposes only:

    read

No write method is exposed.

## Deterministic acceptance markers

The harness emits:

    PR300_PINNED_TESTNET_CONFIGURATION=true
    PR300_DIRECT_CHAIN_READ_TRANSPORT=true
    PR300_ONE_FINALIZED_SNAPSHOT=true
    PR300_ACTIVE_RECORD_NORMALIZED=true
    PR300_REVOKED_RECORD_NORMALIZED=true
    PR300_MISSING_RECORD_NORMALIZED=true
    PR300_OWNER_ACCOUNT_BOUND=true
    PR300_MODULE_PIN_ENFORCED=true
    PR300_AGENT_CARD_FACTS_OPAQUE=true
    PR300_AGENT_CARD_INTEGRITY_NOT_CLAIMED=true
    PR300_FINALIZED_HASH_HEIGHT_TIME_PRESENT=true
    PR300_UNSUPPORTED_NETWORK_PRETRANSPORT=true
    PR300_WRONG_CONTRACT_PRETRANSPORT=true
    PR300_MODULE_MISMATCH_FAILS_CLOSED=true
    PR300_CONTRACT_MISSING_FAILS_CLOSED=true
    PR300_INVOCATION_FAILURE_FAILS_CLOSED=true
    PR300_TIMEOUT_FAILS_CLOSED=true
    PR300_MALFORMED_RESULT_FAILS_CLOSED=true
    PR300_CONTRADICTORY_RESULT_FAILS_CLOSED=true
    PR300_TOKEN_SUBSTITUTION_REJECTED=true
    PR300_TRANSPORT_EXCEPTION_UNAVAILABLE=true
    PR300_GATEWAY_RUNTIME_CHANGED=false
    PR300_PHASE5_STATE_MUTATED=false
    PR300_CANONICAL_STATE_MUTATED=false
    PR300_UFX_CALLED=false
    PR300_CRP_CALLED=false
    PR300_PAYMENT_ATTEMPTED=false
    PR300_RECEIPT_ISSUED=false
    PR300_PAYMENT_RESPONSE_EMITTED=false
    PR300_RESOURCE_RELEASED=false
    PR300_PRODUCTION_ACTIVATION=false
    PR300_DETERMINISTIC_ACCEPTANCE=true

## PR #298 and PR #299 regressions

PR #300 must preserve:

    npm run phase6:agent-registry-trust-contract-test
    npm run phase6:agent-registry-resolver-seam-test

The PR #299 harness must continue to report:

    mode: fixture_only
    registryNetworkCalled: false
    agentRegistryLookupAttempted: false

The Concordium plugin must consume the seam without changing fixture-only
semantics.

## Opt-in live smoke

PR #300 also requires one local, opt-in live smoke before merge.

The package command is:

    npm run phase6:concordium-cis8004-registry-plugin-live-smoke

The live smoke must not run automatically in CI.

It must require an explicit opt-in marker.

The live smoke verifies:

1. direct TLS gRPC connectivity to the configured Testnet endpoint;
2. one latest-finalized block;
3. the configured registry contract exists at that block;
4. the instance module matches the pinned module reference;
5. the embedded schema is available at that block;
6. `agentOf` for known token `0` decodes as an existing record;
7. the existing record status is Active at smoke time;
8. `agentOf` for token `18446744073709551615` decodes as Missing;
9. every read uses the same finalized block;
10. no transaction is submitted;
11. no signing key is loaded;
12. no Agent URI is fetched;
13. output is sanitized.

The live smoke may fail when:

- the Testnet node is unavailable;
- the trusted registry deployment changes;
- the pinned module no longer matches;
- the known live fixture changes state;
- the known missing token becomes registered.

Such a failure must not weaken the deterministic harness or silently update a
trust anchor.

The trust anchors require explicit reviewed source changes.

## Live fixture handling

The known live fixture for the pre-merge smoke is:

    active token ID: 0

The absent-token probe is:

    18446744073709551615

The live smoke treats Agent URI content as opaque.

It must not print or render hostile URI payloads beyond sanitized bounded
diagnostics.

A revoked live record is not required for the smoke because the deterministic
harness permanently freezes the Revoked mapping.

## Component ownership invariants

### Gateway

The Gateway owns:

- registry requirements;
- trusted-registry policy;
- canonical registry references;
- resolver-result validation;
- result-to-reference binding;
- Phase 5 authorization composition;
- buyer policy;
- lifecycle ordering;
- replay enforcement;
- payment eligibility;
- receipt verification;
- final resource release.

PR #300 does not wire the plugin into the Gateway runtime.

### Concordium CIS-8004 Registry Plugin

The plugin owns:

- trusted Concordium transport configuration;
- finalized direct-chain reads;
- contract and module observation;
- `agentOf` invocation;
- decoded-record validation;
- normalization into registry trust facts;
- fail-closed resolver availability.

The plugin does not own:

- Gateway policy;
- Phase 5 delegation policy;
- acting-agent authorization;
- bounded-use mutation;
- replay mutation;
- payment settlement;
- receipt issuance;
- final resource release.

### UFX

UFX remains outside PR #300.

The plugin does not invoke UFX.

### Settlement Rail Plugin

Settlement rails remain outside PR #300.

The plugin does not invoke CRP or another payment rail.

### Orchestrator

The Orchestrator is not required for PR #300.

### Indexer and MCP

Indexer and MCP services are not runtime trust dependencies for PR #300.

## Explicit non-goals

PR #300 does not add:

- Gateway route integration;
- `src/server.ts` changes;
- runtime middleware registration;
- Phase 5 authorization composition;
- Phase 5 source changes;
- Phase 3 source changes;
- buyer-to-agent registry binding;
- acting-agent-to-token binding;
- native key verification;
- CIS-8 external-key verification;
- owner identity verification;
- Agent Card retrieval;
- Agent Card byte hashing;
- Agent Card integrity verification;
- Agent Card capability parsing;
- capability-policy evaluation;
- evidence-age threshold enforcement;
- Indexer-lag enforcement;
- release-time revalidation;
- retry policy;
- caching;
- persistence;
- database tables;
- database migrations;
- HTTP endpoints;
- MCP runtime integration;
- Indexer runtime integration;
- hosted resolver deployment;
- registry registration;
- registry transfer;
- registry revocation;
- registry upgrade;
- transaction submission;
- wallet access;
- private-key access;
- signing;
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

PR #300 must not modify:

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

PR #300 is limited to exactly five files:

1. `src/phase6/agentRegistryResolverSeam.ts`
2. `src/phase6/concordiumCis8004RegistryPlugin.ts`
3. `scripts/ci_phase6_concordium_cis8004_registry_plugin.ts`
4. `docs/phase6-concordium-cis8004-registry-plugin.md`
5. `package.json`

`package-lock.json` is not in scope.

## Package commands

The deterministic permanent command is:

    npm run phase6:concordium-cis8004-registry-plugin-test

The opt-in live command is:

    npm run phase6:concordium-cis8004-registry-plugin-live-smoke

Adding these commands must not change `package-lock.json`.

The live command must remain opt-in and must not become a required CI network
dependency.

## Validation plan

Before commit, PR #300 requires:

1. Targeted compilation of the PR #298 contract, PR #299 seam, plugin, and
   deterministic harness.
2. PR #298 trust-contract regression.
3. PR #299 fixture-seam regression.
4. PR #300 deterministic 20-case harness.
5. One explicitly opted-in local live smoke.
6. Exact five-file scope audit.
7. Protected-path audit.
8. Dependency and lockfile audit.
9. Direct-chain read-only surface audit.
10. Transaction and signing-key audit.
11. Agent Card non-fetch audit.
12. Secret and private-material audit.
13. Documentation contamination audit.
14. CR-byte and trailing-whitespace audit.
15. `git diff --check`.
16. Complete unstaged diff review.
17. Staged-integrity review before commit.

The Phase 5 lifecycle E2E demo remains excluded from PR #300 because this rung
must not attempt payment or release.

## Deferred to PR #301

PR #301 owns registry identity and acting-agent key binding.

That rung may address:

- binding the Phase 5 acting agent to the registry token;
- native registry-key verification;
- CIS-8 external-key binding;
- owner mismatch;
- agent-account mismatch;
- cross-input token substitution;
- proof-of-possession continuity.

PR #300 binds the resolver result to the submitted registry reference.

It does not bind the Phase 5 acting agent to that reference.

## Deferred to PR #302

PR #302 owns:

- Agent Card retrieval;
- exact-byte hashing;
- Agent Card integrity verification;
- capability-policy evaluation;
- evidence-age policy;
- Indexer-lag policy when applicable;
- stale-node policy;
- release-time revalidation.

## Deferred to PR #303

PR #303 owns Gateway Conditional Gating composition.

That rung may connect registry trust to:

- Phase 5 authorization;
- buyer policy;
- lifecycle ordering;
- bounded-use ordering;
- payment eligibility;
- receipt-gated resource release.

PR #300 does not wire the plugin into the Gateway runtime.

## Definition of Done

PR #300 is complete when:

- the resolver seam accepts `concordium_cis8004` without regressing
  `fixture_only`;
- the trusted Testnet configuration is pinned;
- the direct gRPC read transport exists;
- one finalized snapshot is reused for all lookup reads;
- `agentOf` is serialized and decoded from the embedded schema;
- Active state normalizes correctly;
- Revoked state normalizes as coherent negative evidence;
- Missing state normalizes as coherent negative evidence;
- owner facts are preserved without claiming identity assurance;
- Agent URI and metadata hash remain opaque, unverified facts;
- module mismatch fails closed;
- contract, invocation, timeout, malformed, contradictory, and transport
  failures fail closed;
- token substitution is rejected;
- the deterministic 20-case harness passes;
- PR #298 and PR #299 regressions pass;
- one local opt-in live smoke passes before merge;
- no write, signing, persistence, Gateway runtime, Phase 5, payment, receipt,
  replay, release, or production behavior is introduced;
- only the approved five files are changed;
- `package-lock.json` is unchanged;
- the final diff and staged state pass review.

## Next finite rung

The next finite rung is:

    PR #301 — Registry identity and acting-agent key binding

PR #301 must consume the normalized PR #300 facts.

It must not move Agent Card retrieval, capability evaluation, freshness policy,
or Gateway runtime composition backward into PR #300.
