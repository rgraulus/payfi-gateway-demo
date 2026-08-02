# Demo4 D4-1B CIS-8 Profile-Conformance Decision

## 1. Purpose

This document records the formal Demo4 D4-1B CIS-8 profile-conformance decision required by the corrective Demo4 rebaseline.

It determines whether the finalized D4-1B CIS-8 registration may be:

* retained as the canonical Demo4 CIS-8 profile;
* attached to the future Demo4 CIS-8004 identity;
* superseded by a proposal-conformant replacement;
* revoked and replaced;
* or treated as a reason to stop Demo4.

This decision is evidence-driven and fail-closed.

It does not construct, sign, dry-run, or submit a transaction.

It does not access the D4-1B ceremony key, a Concordium wallet, or other private material.

It does not mutate CIS-8, CIS-8004, Gateway runtime state, payment state, receipt state, replay state, or production configuration.

## 2. Decision summary

The finalized D4-1B transaction remains valid historical Concordium Testnet evidence.

However, the registered external-key profile must not be retained as the canonical Demo4 CIS-8 profile.

The disposition is:

`SUPERSEDE_BEFORE_D4_1C`

The following decisions are frozen:

* Existing transaction preserved: `true`
* Existing evidence preserved: `true`
* Existing registration retained as canonical Demo4 profile: `false`
* Existing registration attached to the future CIS-8004 identity: `false`
* Immediate revocation authorized: `false`
* Replacement profile required before D4-1C: `true`
* Replacement profile currently selected: `false`
* D4-1C allowed to proceed: `false`
* Demo4 project-level stop required: `false`
* Production activation authorized: `false`

The replacement profile must represent a genuine, explicitly selected external-blockchain identity.

No replacement CAIP-2 namespace may be inferred from the key algorithm, proof-scheme name, or the existing internal XCF namespace.

## 3. Why this decision is necessary

PR #307 registered a fresh Demo4 Ed25519 acting key in the deployed Concordium Testnet CIS-8 contract.

The transaction finalized successfully, emitted the expected registration event, and produced a successful finalized `ownerOfKey` result.

The registration used:

* External namespace: `xcf:phase5`
* External-key namespace: `xcf:phase5`
* Key type: `ed25519`
* Proof scheme: `fetch-ai-ed25519`

The corrective Demo4 rebaseline subsequently required a formal decision on whether this combination was suitable as the canonical Demo4 CIS-8 profile.

The review found that the registered key is an application-level XCF agent acting key generated through the Phase 5 controlled cryptographic key-bundle workflow.

No repository evidence establishes that the key is:

* a Fetch.ai wallet key;
* a Fetch.ai account key;
* a key used on FetchHub;
* a Solana account key;
* a Concordium account signing key;
* or a key used by another identified external blockchain.

The `xcf:phase5` namespace describes an internal project and lifecycle context.

It does not identify an external blockchain.

Therefore, the existing registration cannot truthfully serve as the canonical external-chain identity for Demo4.

## 4. Status of the finalized D4-1B transaction

### 4.1 Transaction facts

The existing registration remains a finalized Concordium Testnet transaction.

Frozen evidence anchors:

* Transaction hash: `949a25947e645cca59a6a529859ba8fcbf160a0122d31406dc0eb45cc7d87093`
* Finalized block hash: `0506c203c157a2e676694e46a85e23f364409b90f3d615dcf034ba01f89a52cd`
* Finalized block height: `46287110`
* CIS-8 contract: `<12801,0>`
* Module reference: `5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da`
* Owner account: `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`
* Attached CCD: zero
* Matching registration events: exactly one
* Finalized owner postcondition: satisfied

### 4.2 Acting-key facts

Frozen acting-key evidence:

* Agent ID: `agent:xcf:demo4:registered`
* Agent-key ID: `agent-key:xcf:demo4:registered:ed25519-1`
* Public key:
  `e9d34013c5d042e38e8f8c43f0d7e2c326eafe70b40647319d39ade5ea8c18ad`
* Public-key fingerprint:
  `sha256:5064708a2081db6539f9e4043a1635fa0ab1633c97a67f5ced705a2fc73ce619`
* Public-key type: Ed25519
* Public-key length: 32 bytes
* Proof length: 64 bytes
* Canonical-message length: 193 bytes
* Canonical-message SHA-256:
  `sha256:09d6e43e745b3aa4c1e3749416d2f58ed89d0634b78180aaaeb3c216865dc377`

### 4.3 Historical-evidence conclusion

The transaction must not be described as:

* nonexistent;
* reverted;
* malformed chain history;
* an unsuccessful submission;
* or evidence that the deployed CIS-8 contract failed.

The deployed contract accepted and finalized the submitted profile.

The conformance problem is semantic suitability for the canonical Demo4 identity, not transaction finality.

## 5. Evidence reviewed

The decision uses the following repository evidence:

* `docs/demo4-corrective-rebaseline.md`
* `docs/demo4-d4-1b-cis8-acting-key-registration.md`
* `docs/evidence/demo4-d4-1b-cis8-registration-evidence.json`
* `src/phase6/demo4Cis8ActingKeyRegistration.ts`
* `scripts/demo_phase6_demo4_cis8_acting_key_registration.ts`
* `scripts/ci_phase6_demo4_cis8_acting_key_registration.ts`
* `scripts/demo_phase5_cryptographic_key_bundle.ts`
* `src/phase5/agentCryptographicDelegationBindingVerifier.ts`
* `scripts/ci_phase5_agent_cryptographic_runtime_composition.ts`
* `scripts/demo_phase6_demo3_controlled_evidence.ts`
* `src/phase6/concordiumNetworkNormalization.ts`

Relevant merged commits include:

* D4-1B implementation and evidence:
  `c69d21d83dcad06dd48b2898f76d022aacd6b160`
* Corrective Demo4 rebaseline:
  `10576fec6141940d96d114136a4f00f72f0eb2b1`

## 6. Authoritative CIS-8 reference snapshot

The conformance review uses the Concordium CIS-8 technical reference maintained in:

* Repository: `Concordium/concordium.github.io`
* Path:
  `source/mainnet/technical-reference/agent-registry/cis-8.rst`
* Reviewed repository commit:
  `ecad927df321126dbde4e996c475e0faea3cfda1`
* Reviewed file blob:
  `3aedbbb7ac261f2547038ea09d966fdb53a8126c`

The reviewed reference defines a CIS-8 binding as a cryptographically proven relationship between a Concordium account and a public key from an external chain.

It defines the external-key namespace as a CAIP-2 chain identifier.

Examples include:

* `eip155:1`
* `solana:mainnet`
* other chain-specific namespace and reference combinations

It separately defines:

* the key type;
* the public key;
* the proof scheme;
* and the canonical bytes signed by the external key.

The reference recognizes `ed25519` as a key type and `fetch-ai-ed25519` as a supported proof scheme.

Recognition of those two fields does not by itself establish that a particular key belongs to Fetch.ai or another external blockchain.

## 7. Existing Phase 2 CAIP-2 architecture rule

The project’s Phase 2 CAIP-2 normalization work established that:

* canonical chain identity must use a valid CAIP-2 identifier;
* internal network labels may be accepted only as migration aliases;
* aliases must normalize immediately at system boundaries;
* canonical chain identity must be propagated internally;
* display labels must remain separate from protocol identifiers;
* and human-readable or internal labels must not become security anchors.

For Concordium Testnet, the established canonical chain ID is:

`ccd:4221332d34e1694168c2a0c0b3fd0f27`

The D4-1B value `xcf:phase5` is not the canonical Concordium Testnet chain ID.

More importantly, it does not identify any other evidenced external blockchain.

## 8. Acting-key provenance finding

### 8.1 Positive repository evidence

The registered key is tied to the Phase 5 application cryptographic workflow through:

* Key-bundle contract:
  `phase5.demoCryptographicKeyBundle.v1`
* Key-bundle mode:
  `controlled_cryptographic_demo2`
* Agent ID:
  `agent:xcf:demo4:registered`
* Agent-key ID:
  `agent-key:xcf:demo4:registered:ed25519-1`

The D4-1B design document describes the key as:

* a fresh Demo4-specific acting key;
* generated using the existing Phase 5 key-bundle workflow;
* retained locally for the Demo4 flow;
* and controlled as application ceremony material.

### 8.2 Missing external-chain provenance

The repository review found no evidence that the key was:

* generated by a Fetch.ai wallet;
* generated by a Solana wallet;
* generated as a Concordium account key;
* derived from an external-chain account;
* associated with a Fetch.ai address;
* associated with a Cosmos address;
* associated with a Solana address;
* or registered on another external blockchain.

### 8.3 Provenance classification

The frozen provenance classification is:

`APPLICATION_LEVEL_XCF_AGENT_ACTING_KEY`

The classification is not:

* `FETCH_AI_EXTERNAL_KEY`
* `SOLANA_EXTERNAL_KEY`
* `CONCORDIUM_ACCOUNT_KEY`
* `OTHER_VERIFIED_EXTERNAL_CHAIN_KEY`

## 9. Field-by-field conformance assessment

### 9.1 External namespace

Existing value:

`xcf:phase5`

Assessment:

`NONCONFORMANT_FOR_CANONICAL_DEMO4_CIS8_PROFILE`

Reason:

The value identifies an internal XCF project phase.

It does not identify an evidenced external blockchain.

A colon-delimited string is not sufficient to establish semantic CAIP-2 validity.

### 9.2 External-key namespace

Existing value:

`xcf:phase5`

Assessment:

`NONCONFORMANT_FOR_CANONICAL_DEMO4_CIS8_PROFILE`

Reason:

The external-key record repeats the same internal XCF lifecycle namespace rather than identifying the external chain on which the public key is used.

### 9.3 Key type

Existing value:

`ed25519`

Assessment:

`STRUCTURALLY_SUPPORTED_BUT_INSUFFICIENT`

Reason:

Ed25519 is a supported public-key type.

The algorithm does not establish blockchain provenance.

Many protocols and applications use Ed25519.

### 9.4 Proof scheme

Existing value:

`fetch-ai-ed25519`

Assessment:

`SUPPORTED_IDENTIFIER_WITH_UNSUPPORTED_PROVENANCE_BINDING`

Reason:

The proof-scheme identifier is recognized by the CIS-8 reference.

However, the repository contains no evidence that the registered key is a Fetch.ai identity or is used on a Fetch.ai external chain.

The scheme name must not be treated as proof of provenance.

### 9.5 Canonical-message structure

Existing domain:

`CIS-8/v1/canonical`

Existing local component order:

1. canonical domain;
2. Concordium owner account bytes;
3. CIS-8 contract index;
4. CIS-8 contract subindex;
5. Concordium genesis hash;
6. external namespace;
7. external-key namespace;
8. key type;
9. public key;
10. proof scheme.

Assessment:

`STRUCTURALLY_PLAUSIBLE_BUT_NOT_DISPOSITIVE`

Reason:

A deterministic canonical encoding cannot make an ineligible namespace semantically valid.

The current profile fails the provenance and namespace decision before an official-builder byte comparison could make it retainable.

An official-builder comparison remains required for any future replacement profile.

## 10. Why no namespace may be substituted automatically

The current evidence does not justify substituting:

* `cosmos:fetchhub-4`;
* `solana:mainnet`;
* `ccd:4221332d34e1694168c2a0c0b3fd0f27`;
* or another CAIP-2 identifier.

### 10.1 Fetch.ai substitution is not justified

The value `fetch-ai-ed25519` names a proof scheme.

It does not prove that the key:

* belongs to a Fetch.ai wallet;
* maps to a Fetch.ai account;
* is used on FetchHub;
* or has a valid Fetch.ai address representation.

### 10.2 Concordium substitution is not justified

The transaction executes on Concordium Testnet.

That does not make the registered external key a Concordium account key.

The frozen Concordium owner wallet and the application acting key perform different roles:

* the acting key signs the CIS-8 canonical proof;
* the Concordium owner wallet signs and submits the registry transaction.

The Concordium settlement chain must not be substituted for the missing external-key provenance.

### 10.3 Internal XCF substitution is not conformant

`xcf:phase5` may remain useful as:

* an internal application identifier;
* a key-bundle contract label;
* a lifecycle label;
* or application metadata.

It must not be used as the canonical external-blockchain security identity for D4-1C.

## 11. Retain decision

Decision:

`RETAIN_AS_CANONICAL_PROFILE=false`

The existing registration must not be used as the canonical Demo4 external-key reference.

The future CIS-8004 identity must not carry an external reference that points to:

* namespace `xcf:phase5`;
* key type `ed25519`;
* and the existing public key.

This prohibition remains in force even though:

* the transaction finalized;
* the signature verified;
* the event matched;
* and `ownerOfKey` resolved to the expected owner.

## 12. Supersede decision

Decision:

`SUPERSEDE_REQUIRED=true`

A replacement CIS-8 profile must be established before D4-1C can proceed.

The replacement must freeze:

* the genuine external blockchain;
* the authoritative CAIP-2 chain identifier;
* the external account or key provenance;
* the public-key type;
* the proof scheme;
* the canonical-message version;
* the canonical-message builder;
* the owner relationship;
* the custody model;
* and the intended relationship to the Demo4 agent.

The replacement must be independently reviewable before any private-key access, signing, wallet access, dry-run, or transaction construction.

## 13. Replacement-profile status

Current status:

`UNRESOLVED_FAIL_CLOSED`

This PR does not select the replacement chain or key.

The following questions remain open:

1. Which external blockchain is required by the Demo4 product and interoperability goal?
2. Which authoritative CAIP-2 identifier names that chain?
3. Which wallet or custody mechanism will control the external private key?
4. Will the replacement external key also become the active Phase 5 agent proof-of-possession key?
5. If not, how will the Gateway bind the application acting key to the CIS-8 external identity?
6. Which official or approved builder will produce the canonical CIS-8 bytes?
7. Which proof scheme is approved for that chain?
8. How will the external account or address be independently verified?
9. How will key continuity and rotation be handled?
10. How will the existing application-level key remain represented without being misclassified as an external-chain identity?

No implicit answer is permitted.

## 14. Revocation decision

Decision:

`IMMEDIATE_REVOCATION_AUTHORIZED=false`

This PR does not revoke the existing registration.

Reasons:

* revocation is a separate on-chain mutation;
* revocation requires explicit transaction authorization;
* the existing registration remains relevant historical evidence;
* no replacement profile is yet frozen;
* and cleanup must not precede the replacement and recovery design.

A later bounded remediation PR must decide whether to:

* leave the old registration on-chain as historical evidence;
* revoke it after the replacement finalizes;
* add clarifying metadata if supported and appropriate;
* or take another explicitly reviewed action.

No automatic revocation is allowed.

## 15. D4-1C decision

Decision:

`D4_1C_BLOCKED=true`

D4-1C must not call `setExternalReference` using the existing D4-1B registration.

The block remains until:

1. a replacement external-chain profile is selected;
2. the replacement profile passes a formal conformance review;
3. an official or approved builder reproduces the expected canonical bytes;
4. custody and signing procedures are approved;
5. the replacement CIS-8 registration is explicitly authorized;
6. the replacement transaction finalizes;
7. `ownerOfKey` independently confirms the expected owner;
8. D4-1A CIS-8004 registration is complete and independently verified;
9. and the exact D4-1C `ExternalKeyId` is frozen.

## 16. Effect on D4-1A

D4-1A CIS-8004 registration may be prepared independently of the replacement CIS-8 transaction, provided that:

* the initial CIS-8004 identity is registered without the invalid D4-1B external reference;
* no `xcf:phase5` external reference is attached;
* the Agent Card URI and hash remain the frozen Demo4 values;
* token-ID recovery and owner verification are independently proven;
* and D4-1C remains separately blocked.

The replacement-profile design should be understood before irreversible provisioning is resumed, but this decision does not declare the Agent Card or planned CIS-8004 identity invalid.

## 17. Effect on the Phase 5 acting key

The provenance finding is not a finding that the application acting key is cryptographically invalid.

The key remains valid evidence for its intended application-level role, subject to the existing Phase 5 and Demo4 controls.

This PR does not:

* rotate the application acting key;
* delete its ceremony material;
* access its private key;
* revoke its Phase 5 use;
* alter delegation verification;
* alter proof-of-possession verification;
* or change Gateway runtime behavior.

Any decision to retain or replace the application acting key in the agent delegation path is separate from the CIS-8 external-chain profile decision.

## 18. Positive significance of the discovery

The provenance result is a positive corrective discovery because it:

* identifies the exact semantic mismatch;
* avoids falsely attributing the key to Fetch.ai or another chain;
* preserves valid Phase 5 cryptographic work;
* preserves valid finalized chain evidence;
* prevents an invalid D4-1C attachment;
* narrows the remediation to identity classification and provisioning;
* and restores a finite, evidence-based execution path.

The project does not need to discard Phase 5, Phase 6, Demo3, the Agent Card, or the finalized D4-1B transaction.

It must correct the external-chain identity profile before continuing the CIS-8-to-CIS-8004 relationship.

## 19. Demo4 disposition

Decision:

`DEMO4_STOP_REQUIRED=false`

Demo4 remains viable.

The project may continue through the frozen ladder after the replacement profile is selected and provisioned.

The corrected remaining sequence is:

1. Complete PR #309 and merge this decision.
2. Select and approve a genuine external-chain profile.
3. Prepare D4-1A CIS-8004 registration.
4. Execute and verify D4-1A under separate authorization.
5. Execute the bounded D4-1B remediation or replacement.
6. Verify the replacement CIS-8 owner relationship.
7. Prepare D4-1C.
8. Execute and verify D4-1C under separate authorization.
9. Complete D4-2 with no payment.
10. Complete D4-3 with exactly one authorized Testnet payment.
11. Close Demo4.

## 20. Safety boundary

This PR is documentation and deterministic validation only.

It must not:

* access `keys/demo4-d4-1b/`;
* read the D4-1B private PEM;
* read a wallet export;
* create a signer;
* generate a new key;
* sign canonical bytes;
* invoke the CIS-8 contract;
* invoke the CIS-8004 contract;
* construct a transaction;
* submit a transaction;
* revoke a key;
* register a replacement key;
* call `setExternalReference`;
* mutate a database;
* call Gateway runtime;
* submit a payment;
* request or redeem a receipt;
* release a protected resource;
* mutate replay state;
* enable production activation;
* or modify an existing finalized evidence artifact.

## 21. Required permanent validation

The PR #309 harness must verify at least:

* the decision artifact uses a closed schema;
* the decision version is frozen;
* the existing transaction hash matches the D4-1B evidence;
* the existing public key matches the D4-1B evidence;
* the existing public-key fingerprint matches the D4-1B evidence;
* the existing owner matches the D4-1B evidence;
* the provenance classification is application-level;
* Fetch.ai external identity evidence is absent;
* Concordium external-key identity evidence is absent;
* `xcf:phase5` is rejected as the canonical external-chain namespace;
* `retainAsCanonicalProfile` is `false`;
* `attachToCis8004` is `false`;
* `disposition` is `SUPERSEDE_BEFORE_D4_1C`;
* `replacementProfileStatus` is `UNRESOLVED_FAIL_CLOSED`;
* `immediateRevocationAuthorized` is `false`;
* `d4_1cBlocked` is `true`;
* `demo4StopRequired` is `false`;
* no private path is included in the decision evidence;
* no raw signature is included;
* no wallet material is included;
* no transaction-construction data is included;
* no payment data is introduced;
* and the harness performs no side effects.

## 22. Files in PR #309

Expected PR scope:

* `docs/demo4-d4-1b-profile-conformance-decision.md`
* `docs/evidence/demo4-d4-1b-profile-conformance-decision.json`
* `scripts/ci_phase6_demo4_d4_1b_profile_conformance_decision.ts`
* `package.json`

`package.json` may receive exactly one script entry for the deterministic PR #309 harness.

No dependency changes are permitted.

`package-lock.json` must remain unchanged.

## 23. Definition of done

PR #309 is complete when:

* the provenance classification is frozen;
* the authoritative CIS-8 source snapshot is recorded;
* the Phase 2 CAIP-2 architecture rule is preserved;
* the field-by-field profile assessment is documented;
* retention is rejected;
* attachment to CIS-8004 is rejected;
* supersession is required;
* immediate revocation remains unauthorized;
* the replacement profile remains fail-closed and unresolved;
* D4-1C remains blocked;
* Demo4 remains viable;
* the deterministic evidence artifact is committed;
* the permanent harness passes;
* `package-lock.json` remains unchanged;
* no sensitive material is accessed;
* no chain action occurs;
* no payment occurs;
* no production activation occurs;
* and the repository scope is limited to the four approved files.

## 24. Final decision

The final PR #309 decision is:

`SUPERSEDE_BEFORE_D4_1C`

The existing D4-1B registration is preserved as truthful historical evidence of a finalized controlled Testnet registration.

It is not the canonical Demo4 external-chain profile.

It must not be attached to the future Demo4 CIS-8004 identity.

A genuine external-blockchain identity and proposal-conformant CIS-8 profile must be selected, verified, provisioned, and independently confirmed before D4-1C may proceed.
