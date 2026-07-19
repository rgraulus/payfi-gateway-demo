# Phase 5 — Buyer-to-Agent Delegation Credential Contract

## 1. Purpose

PR #293 defines the canonical buyer-to-agent delegation credential contract for the Phase 5 Agent-Delegated x402 v2 path.

The credential allows a buyer to express a bounded delegation to a specific agent for a specific merchant, protected resource, contract, network, asset, amount, recipient, validity window, usage limit, replay domain, and lifecycle context.

PR #293 is deliberately contract-only.

It defines and validates:

* the credential document shape;
* the buyer and agent identity metadata;
* the agent public-key metadata;
* the delegated x402 scope;
* the validity, usage, replay, and lifecycle claims;
* the detached proof metadata;
* the RFC 8785 canonical signing representation;
* the stable SHA-256 credential digest;
* strict fail-closed reason codes;
* frozen positive and negative test vectors.

PR #293 does not cryptographically verify the buyer signature and does not prove that the agent possesses the delegated private key.

Those capabilities remain finite follow-on work.

## 2. Phase 5 Context

PR #292 established the controlled Agent-Delegated x402 v2 end-to-end composition baseline.

That baseline proved that the existing structural delegation envelope, buyer-policy checks, real Concordium testnet payment, CRP receipt, protected-resource release, and replay protection could be composed safely.

PR #292 did not establish cryptographic authenticity for the buyer-to-agent delegation itself.

PR #293 is the first implementation step after that baseline checkpoint.

It freezes the credential that later cryptographic rungs will verify.

## 3. PR #293 Boundary

PR #293 is limited to the delegation credential contract and its deterministic validation surface.

It does not:

* verify an Ed25519 buyer signature;
* resolve or trust a buyer public key;
* verify agent proof-of-possession;
* invoke the Gateway;
* invoke the CRP facilitator;
* attempt payment;
* print a CRP receipt JWS;
* emit a `PAYMENT-RESPONSE`;
* release a protected resource;
* persist canonical release state;
* perform an Agent Registry lookup;
* enforce revocation;
* activate production behavior.

The contract result exposes these boundaries explicitly so metadata validation cannot be mistaken for cryptographic authorization or runtime release eligibility.

## 4. Contract Identity

The credential contract uses the following fixed identifiers:

| Property                   | Value                                         |
| -------------------------- | --------------------------------------------- |
| Credential type            | `xcf.concordium.delegation.buyer-to-agent.v1` |
| Credential version         | `1.0.0`                                       |
| Contract mode              | `contract_only`                               |
| Signature algorithm        | `Ed25519`                                     |
| Canonicalization algorithm | `RFC8785`                                     |
| Hash algorithm             | `SHA-256`                                     |
| Amount mode                | `exact`                                       |
| Allowed action             | `authorize_payment_and_resource_access`       |
| Replay domain              | `xcf.concordium.delegation.buyer-to-agent.v1` |

The permanent CI harness identifies the test surface as:

```text
phase5:buyer-to-agent-delegation-credential-contract-test
```

Its contract identifier is:

```text
phase5.buyerToAgentDelegationCredential.v1
```

## 5. Credential Document Shape

The top-level credential document contains exactly two properties:

```json
{
  "credential": {},
  "proof": {}
}
```

The validator is strict and fail-closed.

Unknown, missing, or structurally unexpected properties are rejected rather than ignored.

The `credential` object contains the complete set of claims intended to be covered by the buyer signature.

The outer `proof` object carries detached signature metadata and signature material. It is not included in its own signing input.

## 6. Signed Credential Claims

The signed `credential` object contains exactly these properties:

```text
credentialType
credentialVersion
delegationId
issuer
subject
scope
validity
usage
replay
lifecycle
```

Only this inner object is canonicalized and hashed.

The outer document and detached `proof` object are not part of the stable credential digest.

## 7. Credential Type and Version

`credentialType` must equal:

```text
xcf.concordium.delegation.buyer-to-agent.v1
```

`credentialVersion` must equal:

```text
1.0.0
```

Unsupported types and versions fail closed with stable reason codes.

The contract does not silently upgrade or reinterpret credentials from another version.

## 8. Delegation Identifier

`delegationId` is a non-empty compact identifier for the delegation credential instance.

The identifier is part of the signed payload and therefore contributes to the canonical credential and SHA-256 digest.

Changing the delegation identifier changes the canonical representation and digest.

## 9. Buyer Issuer

The `issuer` object identifies the buyer that is intended to sign the delegation:

```json
{
  "buyerId": "buyer:demo:001",
  "buyerKeyId": "buyer-key-demo-001"
}
```

`buyerId` identifies the buyer principal.

`buyerKeyId` identifies the buyer verification key that a later cryptographic verifier is expected to use.

PR #293 validates only the presence and shape of these identifiers.

It does not retrieve the buyer key and does not verify a signature with it.

## 10. Agent Subject

The `subject` object identifies the delegated agent and the public key that will later be used for agent proof-of-possession:

```json
{
  "agentId": "agent:demo:001",
  "agentKeyId": "agent-key-demo-001",
  "agentPublicKeyJwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "<base64url-encoded 32-byte key>",
    "kid": "agent-key-demo-001",
    "use": "sig",
    "alg": "EdDSA"
  }
}
```

The agent public key must be an Ed25519 OKP JWK.

Required properties are:

* `kty` equal to `OKP`;
* `crv` equal to `Ed25519`;
* `x` containing a canonical base64url representation of exactly 32 bytes.

Optional metadata, when present, is constrained as follows:

* `kid` must equal `agentKeyId`;
* `use` must equal `sig`;
* `alg` must equal `EdDSA`.

PR #293 validates this public-key metadata but does not challenge the agent or prove possession of the corresponding private key.

## 11. Delegated Scope

The `scope` object binds the delegation to one exact x402 authorization context.

It contains:

```text
merchantId
resource
contract
network
asset
amount
payTo
allowedAction
```

A credential is not a general-purpose authorization token.

It is valid only for the exact bounded scope encoded in these signed fields.

## 12. Merchant and Protected Resource

`merchantId` identifies the merchant for which the delegation is intended.

The protected resource is represented by:

```json
{
  "method": "GET",
  "path": "/paid-gated"
}
```

Both the HTTP method and resource path are signed claims.

An agent cannot substitute another method or resource without changing the credential digest and invalidating a future signature verification.

## 13. Contract Binding

The `contract` object contains:

```json
{
  "contractId": "cid_demo_contract_001",
  "contractVersion": "1.0.0"
}
```

The delegation is therefore bound to a specific contract identity and version.

A later runtime verifier must compare these signed values with the resolved contract context before allowing the delegation to authorize payment or resource access.

## 14. Network and Asset Binding

The valid fixture binds the delegation to:

```text
network: concordium:testnet
asset type: PLT
token ID: EUDemo
decimals: 6
```

The asset object is:

```json
{
  "type": "PLT",
  "tokenId": "EUDemo",
  "decimals": 6
}
```

The validator requires a supported PLT asset shape, a non-empty token identifier, and a valid decimal count.

## 15. Amount Constraint

The amount constraint is exact:

```json
{
  "mode": "exact",
  "value": "0.050101"
}
```

The decimal representation must:

* be positive;
* use the supported exact mode;
* be compatible with the declared asset decimals;
* avoid an ambiguous or unsupported numeric representation.

The valid Phase 5 credential is therefore authorized only for exactly `0.050101` EUDemo.

## 16. Payment Recipient and Allowed Action

`payTo` binds the credential to the intended Concordium recipient address.

The valid fixture uses:

```text
4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ
```

`allowedAction` must equal:

```text
authorize_payment_and_resource_access
```

The action is intentionally explicit.

A value such as `authorize_payment_only` is outside the contract and fails closed as an invalid scope.

## 17. Validity Window

The `validity` object contains integer Unix timestamps:

```json
{
  "issuedAt": 1780000000,
  "notBefore": 1780000000,
  "expiresAt": 1780000300
}
```

The contract requires:

```text
issuedAt <= notBefore < expiresAt
```

Each value must be a positive safe integer.

PR #293 validates the internal validity-window semantics.

It does not compare the window with a live runtime clock to authorize a request.

Runtime expiry enforcement remains a later integration responsibility.

## 18. Usage Constraint

The `usage` object contains:

```json
{
  "maxUses": 1
}
```

`maxUses` must be a positive safe integer.

The contract freezes the intended bounded-use claim, but PR #293 does not persist or consume usage state.

Replay and bounded-use enforcement remain outside this contract-only PR.

## 19. Replay Binding

The `replay` object contains:

```text
audience
domain
credentialNonce
```

The valid credential uses the contract credential type as its domain:

```text
xcf.concordium.delegation.buyer-to-agent.v1
```

The replay fields ensure that the credential includes an explicit intended audience, signing domain, and credential-specific nonce.

PR #293 validates their presence and shape.

It does not touch a replay store or mark the credential as consumed.

## 20. Lifecycle Metadata

The `lifecycle` object contains:

```text
revocationId
buyerKeyVersion
agentKeyVersion
```

The valid fixture carries positive integer key versions and a non-empty revocation identifier.

These fields reserve stable signed metadata for later key-rotation, revocation, and lifecycle enforcement.

PR #293 does not perform a revocation lookup and does not consult an Agent Registry.

## 21. Detached Proof

The outer `proof` object contains:

```json
{
  "signatureAlgorithm": "Ed25519",
  "canonicalizationAlgorithm": "RFC8785",
  "verificationMethod": "buyer-key-demo-001",
  "signatureValue": "<canonical base64url 64-byte signature>"
}
```

The validator requires:

* `signatureAlgorithm` equal to `Ed25519`;
* `canonicalizationAlgorithm` equal to `RFC8785`;
* `verificationMethod` equal to `issuer.buyerKeyId`;
* `signatureValue` to be a canonical unpadded base64url representation of exactly 64 bytes.

The valid fixture uses deterministic placeholder signature bytes.

Passing metadata validation does not mean the signature is cryptographically valid.

The result therefore always reports:

```text
signatureVerified: false
```

## 22. Signing Input Boundary

The exact signing input is the RFC 8785 canonical representation of the inner `credential` object.

Conceptually:

```text
signingInput = RFC8785(document.credential)
```

The following are excluded:

* the outer document wrapper;
* the `proof` property name;
* `proof.signatureAlgorithm`;
* `proof.canonicalizationAlgorithm`;
* `proof.verificationMethod`;
* `proof.signatureValue`.

Excluding the detached proof prevents the signature from recursively signing itself.

The buyer key identity remains part of the signed claims through:

```text
credential.issuer.buyerKeyId
```

## 23. RFC 8785 Canonicalization

The implementation uses JSON Canonicalization Scheme behavior defined by RFC 8785.

Canonicalization provides a deterministic JSON representation independent of object insertion order.

The permanent harness proves that recursively reversing object-key order produces the same canonical credential and the same SHA-256 digest.

The implementation dependency is pinned to a repository-compatible version of `canonicalize`.

Canonicalization failure is represented by the stable fail-closed reason:

```text
canonicalization_failed
```

## 24. Stable SHA-256 Credential Digest

The canonical UTF-8 credential is hashed with SHA-256.

Conceptually:

```text
credentialHash =
  lowercaseHex(
    SHA256(
      UTF8(
        RFC8785(document.credential)
      )
    )
  )
```

The stable digest is intended to bind the delegation credential to later cryptographic operations, including agent proof-of-possession.

PR #293 computes the digest but does not perform agent proof-of-possession verification.

The result therefore always reports:

```text
agentProofOfPossessionVerified: false
```

## 25. Frozen Positive Vector

The valid fixture is:

```text
fixtures/phase5/delegation/buyer-to-agent-delegation.valid.example.json
```

Its frozen canonical representation is:

```text
fixtures/phase5/delegation/buyer-to-agent-delegation.valid.canonical.txt
```

Its frozen digest is:

```text
fixtures/phase5/delegation/buyer-to-agent-delegation.valid.sha256.txt
```

The frozen canonical credential has:

```text
1184 UTF-8 bytes
```

The canonical vector file has one terminating LF and is therefore `1185` bytes on disk.

The frozen SHA-256 digest is:

```text
39d6a9381893f94b6d9cab674d50803eafba178ee8b164a0b790ca3cc8820a2e
```

The digest vector file contains the 64 lowercase hexadecimal characters followed by one LF.

## 26. Mutation Guarantees

The tracked harness freezes three important deterministic properties.

### 26.1 Recursive key reordering

Recursively reordering JSON object keys does not change:

* the RFC 8785 canonical credential;
* the SHA-256 credential digest.

### 26.2 Detached proof mutation

Replacing the detached placeholder signature with another correctly encoded 64-byte value does not change:

* the canonical credential;
* the credential digest.

This proves that the proof is excluded from its own signing input.

### 26.3 Signed-claim mutation

Changing `credential.delegationId` changes:

* the canonical credential;
* the credential digest.

This proves that signed claims are included in the stable binding.

## 27. Strict Validation Model

The validator is strict and fail-closed.

It validates exact object keys rather than accepting arbitrary extensions.

This protects the contract from:

* silently ignored fields;
* ambiguous version changes;
* inconsistent key metadata;
* malformed scope constraints;
* invalid temporal ordering;
* malformed replay or lifecycle metadata;
* unsupported proof metadata;
* non-canonical signature encodings.

A rejected credential does not produce a canonical credential or digest through the validation result.

Rejected results report:

```text
canonicalCredentialPresent: false
canonicalCredential: null
credentialHash: null
```

## 28. Stable Reason Codes

The contract exposes the following stable validation reasons:

```text
accepted
invalid_document_shape
unsupported_credential_type
unsupported_credential_version
unsupported_signature_algorithm
unsupported_canonicalization_algorithm
missing_delegation_id
missing_buyer_identity
missing_buyer_key_identity
missing_agent_identity
missing_agent_key_identity
missing_agent_public_key
invalid_agent_public_key
invalid_scope
invalid_amount_constraint
invalid_validity_window
invalid_usage_semantics
invalid_replay_semantics
invalid_lifecycle_metadata
missing_signature_value
invalid_signature_encoding
verification_method_mismatch
canonicalization_failed
```

These reasons distinguish structural metadata validation from later cryptographic and runtime decisions.

## 29. Focused Invalid Fixtures

PR #293 includes six focused invalid fixtures.

Each differs from the valid fixture at exactly one leaf value.

### 29.1 Missing buyer key identity

```text
buyer-to-agent-delegation.invalid.missing-buyer-key.json
```

Expected reason:

```text
missing_buyer_key_identity
```

### 29.2 Missing agent key identity

```text
buyer-to-agent-delegation.invalid.missing-agent-key.json
```

Expected reason:

```text
missing_agent_key_identity
```

### 29.3 Unsupported credential version

```text
buyer-to-agent-delegation.invalid.unsupported-version.json
```

Expected reason:

```text
unsupported_credential_version
```

### 29.4 Invalid delegated scope

```text
buyer-to-agent-delegation.invalid.scope.json
```

Expected reason:

```text
invalid_scope
```

### 29.5 Invalid validity window

```text
buyer-to-agent-delegation.invalid.validity-window.json
```

Expected reason:

```text
invalid_validity_window
```

### 29.6 Invalid signature encoding

```text
buyer-to-agent-delegation.invalid.signature-encoding.json
```

Expected reason:

```text
invalid_signature_encoding
```

## 30. Permanent CI Harness

The tracked harness is:

```text
scripts/ci_phase5_buyer_to_agent_delegation_credential_contract.ts
```

Its label is:

```text
phase5:buyer-to-agent-delegation-credential-contract-test
```

The harness proves:

* valid fixture acceptance;
* exact canonical-vector equality;
* exact digest-vector equality;
* independent SHA-256 verification;
* proof exclusion;
* recursive object-key ordering stability;
* detached-proof mutation stability;
* signed-claim mutation sensitivity;
* six exact fail-closed fixture reasons;
* preservation of all contract-only safety boundaries.

The harness makes no network calls and requires no Gateway, facilitator, database, wallet, or Concordium node.

## 31. Explicit Honesty and Safety Fields

Every result exposes explicit safety fields.

For PR #293 they remain:

```text
metadataOnly: true
signatureVerified: false
agentProofOfPossessionVerified: false
gatewayCalled: false
crpCalled: false
paymentAttempted: false
receiptJwsPrinted: false
paymentResponsePrinted: false
protectedResourceReleased: false
agentRegistryLookupAttempted: false
productionActivation: false
```

These fields prevent a caller from treating accepted metadata as proof of:

* buyer signature authenticity;
* agent key possession;
* payment authorization;
* settlement completion;
* protected-resource release;
* registry trust;
* production readiness.

## 32. Relationship to Existing Phase 5 Authorization

The existing Phase 5 agent-delegated authorization work established structural authorization, challenge binding, buyer-policy evaluation, and controlled runtime composition.

PR #293 does not replace those components.

It introduces a cryptographically meaningful credential format that can later be verified before those components rely on delegated authority.

The new credential is therefore a contract foundation, not a production authorization switch.

## 33. Definition of Done for PR #293

PR #293 is complete when:

1. The credential constants and TypeScript interfaces are frozen.
2. The strict fail-closed metadata validator is implemented.
3. Only the inner credential is canonicalized.
4. RFC 8785 canonicalization is deterministic.
5. SHA-256 produces the frozen lowercase hexadecimal digest.
6. The valid fixture is accepted.
7. The frozen canonical and digest vectors match exactly.
8. Recursive object-key reordering preserves the digest.
9. Detached-proof mutation preserves the digest.
10. Signed-claim mutation changes the digest.
11. All six focused invalid fixtures produce their exact reasons.
12. The tracked CI harness passes.
13. The package script invokes the tracked harness.
14. No Gateway, CRP, payment, release, persistence, registry, or production path changes are introduced.
15. The next finite rung remains cryptographic buyer-signature verification.

## 34. Finite Phase 5 Handoff

The next finite rung is:

```text
PR #294 — Cryptographic buyer signature verifier seam
```

PR #294 should consume the frozen PR #293 contract and:

* resolve or receive the intended buyer verification key through a controlled seam;
* verify the Ed25519 signature over the exact RFC 8785 credential bytes;
* preserve the stable SHA-256 binding;
* distinguish metadata acceptance from cryptographic acceptance;
* remain test-only and fail closed;
* avoid production activation.

Later finite rungs remain:

```text
PR #295 — Agent proof-of-possession
PR #296 — Runtime cryptographic integration and Demo2
PR #297 — Revocation, key lifecycle, bounded use, and Phase 5 closure
```

Agent Registry work remains outside Phase 5.

## 35. Summary

PR #293 freezes the buyer-to-agent delegation credential that the remaining Phase 5 cryptographic work will consume.

It establishes:

* a strict, versioned credential shape;
* explicit buyer and agent key identities;
* an embedded agent Ed25519 public key;
* exact x402 scope binding;
* bounded validity and usage metadata;
* replay and lifecycle claims;
* detached Ed25519 proof metadata;
* RFC 8785 canonical signing bytes;
* a stable SHA-256 credential digest;
* deterministic positive and negative vectors;
* explicit contract-only honesty boundaries.

It does not claim cryptographic verification, runtime authorization, payment eligibility, release eligibility, registry trust, or production activation.

The finite next step is PR #294.
