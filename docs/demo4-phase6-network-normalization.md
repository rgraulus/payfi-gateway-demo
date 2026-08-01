# Demo4 D4-1A — Phase 6 Concordium Network Normalization

## Status

Test-only implementation seam for Demo4 D4-1A.

This rung introduces a pure normalization boundary for Concordium network identifiers and Phase 6 Agent Registry token addresses. It does not integrate the seam into the live Gateway path and does not create or submit a Concordium transaction.

## Purpose

Phase 6 currently encounters multiple identifiers for Concordium Testnet:

- Canonical CAIP-2 identifier: `ccd:4221332d34e1694168c2a0c0b3fd0f27`
- Existing payment-network alias: `concordium:testnet`
- Temporary Phase 6 alias: `ccd:testnet`

Existing Phase 6 trust, resolver, Agent Card, handoff, evidence-hash, and audit surfaces compare and propagate network values as raw strings.

Without a normalization boundary, values that refer to the same Concordium Testnet network can fail equality checks or be persisted under different representations.

This seam establishes one canonical Phase 6 representation before any Demo4 provisioning helper or live CIS-8004 registration transaction is introduced.

## Canonical Network

The only canonical network emitted by this seam is:

    ccd:4221332d34e1694168c2a0c0b3fd0f27

The canonical value is reused from `src/chainId.ts`.

The seam must not introduce an independent copy of the Concordium Testnet genesis hash.

## Accepted Network Inputs

The seam accepts exactly these Concordium Testnet representations:

    ccd:4221332d34e1694168c2a0c0b3fd0f27
    concordium:testnet
    ccd:testnet

Each accepted representation normalizes to:

    ccd:4221332d34e1694168c2a0c0b3fd0f27

Input handling must be deterministic and side-effect free.

## Rejected Network Inputs

The seam fails closed for:

- an empty value;
- a non-string value;
- malformed network identifiers;
- unknown Concordium networks;
- unsupported aliases;
- Concordium Mainnet aliases;
- the canonical Concordium Mainnet CAIP-2 identifier;
- values that merely resemble one of the accepted identifiers;
- identifiers with appended or prepended material.

Examples that must be rejected include:

    ccd:testnet-other
    concordium:testnet-other
    ccd:mainnet
    concordium:mainnet
    ccd:9dd9ca4d19e9393877d2c44b70f89acb
    ethereum:1
    testnet

Mainnet is deliberately rejected because this Demo4 rung is pinned to Concordium Testnet.

## Token-Address Normalization

Phase 6 Agent Registry references contain a `tokenAddress` whose network appears before the first `/`.

Examples currently used by Phase 6 include:

    ccd:testnet/cis8004:5
    ccd:testnet/cis2:12802-0-0

The normalization seam must:

1. identify the network prefix before the first `/`;
2. normalize that prefix using the Testnet-only network rules;
3. preserve the token-address suffix after the first `/`;
4. emit the token address with the canonical Testnet prefix;
5. reject malformed or unsupported values before any resolver or transport call.

For example:

    ccd:testnet/cis8004:5

normalizes to:

    ccd:4221332d34e1694168c2a0c0b3fd0f27/cis8004:5

Likewise:

    concordium:testnet/cis2:12802-0-0

normalizes to:

    ccd:4221332d34e1694168c2a0c0b3fd0f27/cis2:12802-0-0

The seam does not reinterpret or rewrite the token namespace or token payload after the first `/`.

In particular, it does not convert between:

- `cis2:...`
- `cis8004:...`
- any future supported asset namespace

The existing Phase 6 registry-contract validators remain responsible for their current conservative token-address shape checks.

## Network and Token-Address Coherence

When a Phase 6 registry identity contains both:

- a standalone `network`; and
- a network-prefixed `tokenAddress`;

both values must resolve to the same canonical Testnet network.

The seam must reject an identity when:

- the standalone network is invalid;
- the token-address network is invalid;
- either value refers to Mainnet;
- either value refers to an unknown network;
- the two values do not resolve to the same canonical network;
- the token address is malformed.

A successful normalization result must contain:

    network:
    ccd:4221332d34e1694168c2a0c0b3fd0f27

    tokenAddress prefix:
    ccd:4221332d34e1694168c2a0c0b3fd0f27/

## Pure-Seam Requirements

The implementation must be:

- deterministic;
- synchronous;
- side-effect free;
- independent of environment variables;
- independent of network access;
- independent of database access;
- independent of wallet or signer access;
- independent of Gateway runtime state;
- safe to exercise entirely through a CI harness.

The seam must not:

- call Concordium gRPC;
- invoke a smart contract;
- construct a transaction;
- sign a payload;
- submit a transaction;
- mutate registry state;
- perform a payment;
- issue a receipt;
- release a resource;
- persist audit evidence;
- change production activation.

## Result Contract

The implementation must use an explicit result contract rather than silently falling back to an input value.

A successful result must expose the canonical value.

A rejected result must expose a stable, closed failure reason and must not expose a partially normalized identity as accepted output.

The failure contract must distinguish at least:

- invalid network input;
- unsupported or unknown network;
- Mainnet not allowed;
- invalid token-address shape;
- invalid token-address network;
- network and token-address mismatch.

Thrown exceptions must not be required for normal validation failures.

## Relationship to `src/chainId.ts`

This Phase 6 seam must reuse the canonical Testnet constant from `src/chainId.ts`.

It may wrap existing generic Concordium chain-resolution behavior, but it must add the temporary Phase 6 alias:

    ccd:testnet

without changing the frozen payment-contract configuration.

The temporary alias belongs to the Phase 6 normalization boundary. It must not silently become a new payment-network identifier.

## Frozen Payment Configuration

This rung must not modify the existing payment-network values in frozen contract configuration.

Existing payment contracts may continue to use:

    concordium:testnet

This implementation is limited to Phase 6 Agent Registry identity normalization.

No migration of payment configuration is authorized by this rung.

## Initial Integration Boundary

This PR adds only:

- `src/phase6/concordiumNetworkNormalization.ts`;
- `scripts/ci_phase6_concordium_network_normalization.ts`;
- this documentation;
- the minimum `package.json` script required to run the dedicated harness.

This PR does not yet integrate normalization into:

- `agentRegistryTrustContract.ts`;
- `agentRegistryResolverSeam.ts`;
- `concordiumCis8004RegistryPlugin.ts`;
- `agentRegistryIdentityKeyBinding.ts`;
- `agentRegistryCardCapabilityFreshness.ts`;
- `agentRegistryConditionalGatingComposition.ts`;
- `phase6AgentRegistryAuthorizationAuditStore.ts`;
- the Gateway server;
- a provisioning helper;
- a live registration transaction.

Those integrations require a separately reviewed and bounded follow-on step.

## Dedicated CI Harness

The dedicated harness must prove the following matrix.

### Accepted network cases

- canonical Testnet CAIP-2 input;
- `concordium:testnet`;
- temporary `ccd:testnet`;
- deterministic repeated normalization.

### Rejected network cases

- empty input;
- whitespace-only input;
- non-string input;
- unknown network;
- malformed network;
- Mainnet alias;
- canonical Mainnet CAIP-2 identifier;
- near-match or suffixed alias.

### Accepted token-address cases

- canonical Testnet prefix with a `cis8004:` suffix;
- `concordium:testnet` prefix with a `cis8004:` suffix;
- temporary `ccd:testnet` prefix with a `cis8004:` suffix;
- canonical Testnet prefix with a `cis2:` suffix;
- alias prefix with a `cis2:` suffix;
- preservation of the suffix after canonicalization;
- deterministic repeated normalization.

### Rejected token-address cases

- empty input;
- non-string input;
- missing `/`;
- empty network prefix;
- empty token-address suffix;
- missing asset-namespace colon;
- unknown network prefix;
- Mainnet prefix;
- malformed network prefix;
- appended or prepended alias material.

### Coherence cases

- canonical network plus canonical token address;
- alias network plus alias token address;
- different accepted aliases resolving to the same canonical Testnet identity;
- invalid standalone network;
- invalid token-address network;
- Mainnet input;
- mismatched or unsupported network representations;
- no partial accepted result after failure.

### Safety assertions

The harness must affirm that it performed no:

- wallet access;
- signer creation;
- signing;
- transaction construction;
- transaction submission;
- payment;
- registry mutation;
- database mutation;
- Gateway runtime activation;
- resource release;
- production activation.

## Package Script

The minimum package script for this rung is:

    ci:phase6:concordium-network-normalization

The script must execute only the dedicated normalization harness.

It must not start the Gateway, facilitator, worker, database, wallet proxy, or Concordium transaction flow.

## Acceptance Criteria

This rung is complete when:

1. all three accepted Testnet network representations normalize to the canonical CAIP-2 identifier;
2. supported token-address prefixes normalize to the canonical Testnet prefix;
3. token-address suffixes are preserved;
4. malformed, unknown, and Mainnet values fail closed;
5. network and token-address coherence is enforced;
6. the dedicated CI harness passes;
7. the existing TypeScript checks remain green;
8. frozen payment configuration remains unchanged;
9. no runtime integration is introduced;
10. no wallet, signer, transaction, payment, or registry mutation occurs;
11. the repository diff contains only the authorized files and minimal package-script change.

## Deferred Work

After this pure seam is reviewed, a separately authorized step may integrate canonicalization at the Phase 6 boundaries that currently perform raw string comparisons and passthroughs.

Only after that integration is closed may D4-1A introduce:

- a CIS-8004 provisioning helper;
- explicit wallet-owner verification;
- live execution gating;
- transaction construction and signing;
- the single authorized CIS-8004 registration;
- finalized return-value and `Registered` event cross-checks;
- sanitized provisioning evidence.

The simulated token ID observed during read-only preflight is not reserved and is not the final Demo4 Agent Registry identity.
