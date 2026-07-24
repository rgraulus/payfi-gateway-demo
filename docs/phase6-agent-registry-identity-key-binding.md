# Phase 6 Agent Registry Identity-Key Binding

## Status

This document defines the implementation and safety boundary for Phase 6
PR #301.

PR #301 is the fourth finite Phase 6 implementation rung. It consumes:

- the Agent Registry trust contracts accepted in PR #298;
- the controlled Gateway resolver seam accepted in PR #299;
- the Concordium CIS-8004 Registry Plugin accepted in PR #300;
- the accepted Phase 5 cryptographic buyer-to-agent delegation result.

This checkpoint is:

- test-only;
- read-only;
- fail-closed;
- bound to one finalized snapshot;
- limited to an external CIS-8 Ed25519 key;
- independent of Gateway runtime wiring;
- independent of Phase 5 state mutation;
- independent of payment settlement;
- independent of receipt issuance;
- independent of replay mutation;
- not production activation.

## Goal

PR #301 proves that the exact Ed25519 acting key accepted by Phase 5 can be
bound to the exact external CIS-8 key referenced by a canonical Active
CIS-8004 agent record.

A successful result requires all of the following:

1. The Phase 5 cryptographic delegation result is accepted.
2. The credential hash, `agentId`, and `agentKeyId` match the supplied
   buyer-signed delegation credential.
3. The acting-agent JWK is canonical Ed25519 key material and decodes to
   exactly 32 bytes.
4. The CIS-8004 token record is Active and matches the expected AgentTokenId.
5. The external reference is a structured CIS-8 reference.
6. The referenced CIS-8 contract matches the trusted pinned contract.
7. The referenced external key type is `ed25519`.
8. `ownerOfKey` is read at the same finalized snapshot.
9. The CIS-8 registration is present and Active.
10. The CIS-8 registration owner equals the CIS-8004 token owner.
11. Namespace, key type, and public-key bytes equal the referenced
    `ExternalKeyId`.
12. The CIS-8 public-key bytes equal the accepted Phase 5 acting-key bytes.

The diagnostic key fingerprint is:

    sha256:<lowercase hexadecimal SHA-256 of the raw 32-byte key>

The fingerprint is evidence metadata. It does not replace the structured
CIS-8 `ExternalKeyId`.

## Single proof obligation

PR #301 passes when:

> An accepted Phase 5 buyer-to-agent cryptographic delegation can be matched
> to the exact expected CIS-8004 token and owner, the token's structured CIS-8
> reference can be resolved at the same finalized block through the pinned
> read-only CIS-8 transport, the returned Active registration can be matched
> by owner, namespace, key type, external identifier, and raw Ed25519 key
> bytes, every missing, malformed, unsupported, revoked, substituted,
> mismatched, unavailable, timed-out, forged, or native-binding claim fails
> closed, and no Gateway runtime, Phase 5 lifecycle, replay, payment, receipt,
> persistence, signing, release, or production state changes.

## Policy behavior

The external-key policy is:

    required
    optional
    forbidden

Its behavior is:

- `required` plus a valid CIS-8 binding accepts;
- `required` plus a missing or invalid binding fails closed;
- `optional` plus a missing reference preserves a valid base trust result;
- `optional` plus a valid present reference verifies and carries the binding;
- `optional` plus an invalid present reference fails closed;
- `forbidden` plus a missing reference preserves a valid base trust result;
- `forbidden` plus a present reference fails closed.

A present assertion is never silently ignored.

## Native-key boundary

PR #301 does not claim native Concordium account-key binding.

The Phase 5 proof establishes external Ed25519 proof-of-possession. It does not
establish control of a Concordium account credential key.

A native reference or native verified-binding claim therefore fails closed as:

    native_binding_not_supported

The `native` enum value remains reserved for a future finite implementation
rung with its own proof contract.

## Implementation surface

The identity-key binding implementation is:

    src/phase6/agentRegistryIdentityKeyBinding.ts

The permanent deterministic harness is:

    scripts/ci_phase6_agent_registry_identity_key_binding.ts

The structured CIS-8004 external-reference surface is defined in:

    src/phase6/concordiumCis8004RegistryPlugin.ts

The PR #300 regression fixture is updated in:

    scripts/ci_phase6_concordium_cis8004_registry_plugin.ts

This document is:

    docs/phase6-agent-registry-identity-key-binding.md

The permanent package command is:

    npm run phase6:agent-registry-identity-key-binding-test

No dependency installation is required.

`package-lock.json` must remain unchanged.

## Trusted Testnet configuration

The pinned CIS-8004 identity source remains:

    network: ccd:testnet
    CIS-8004 contract: <12802,0>
    CIS-8004 module:
      2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41

The pinned CIS-8 key source is:

    network: ccd:testnet
    CIS-8 contract: <12801,0>
    CIS-8 module:
      5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da
    view entrypoint: ownerOfKey
    transport: direct_chain
    access: read-only

## Deterministic coverage

The permanent harness covers:

- exact CIS-8 success;
- canonical key fingerprint;
- required, optional, and forbidden policy behavior;
- missing and malformed external references;
- unsupported reference kind and key type;
- wrong CIS-8 contract;
- malformed Phase 5 credential and JWK;
- credential-hash, agent-identity, and agent-key-identity substitution;
- unverified and forged registry trust results;
- native-binding rejection;
- registry token, owner, status, and snapshot substitution;
- transport unavailability, exception, malformed result, and timeout;
- missing, revoked, and malformed CIS-8 registration;
- CIS-8 owner mismatch;
- namespace, key-type, external-id, and raw-key substitution;
- canonical same-snapshot behavior;
- zero side effects.

## Safety boundary

PR #301 does not:

- modify Gateway routes or server behavior;
- mutate Phase 5 delegation lifecycle state;
- consume bounded use;
- mutate replay state;
- call UFX or CRP;
- attempt payment;
- issue a receipt;
- emit a payment response;
- release a protected resource;
- submit a Concordium transaction;
- use a signing key;
- persist canonical state;
- enable production behavior.

The binder produces trust evidence only. Final Gateway policy and release
authority remain outside this PR.
