# Phase 5 Agent Proof-of-Possession Verifier Seam

## Status

PR #295 implementation contract.

- Phase: Phase 5 — Agent-Driven ZKP Implementation
- PR: #295
- Scope: agent proof-of-possession verifier seam
- Mode: `test_fixture_only`
- Runtime activation: disabled
- Production activation: false
- Next finite rung: PR #296 — controlled runtime cryptographic composition / Demo 2

## Purpose

PR #295 adds a test-only cryptographic seam proving that an acting agent controls the Ed25519 private key corresponding to the agent public key embedded in a buyer-signed delegation credential.

The completed verification chain is:

```text
PR #293 delegation credential contract is valid
    ↓
PR #294 buyer delegation signature is mathematically valid
    ↓
the agent public key is covered by the buyer signature
    ↓
the agent proof statement matches the credential and expected challenge
    ↓
the agent signature verifies against the embedded Ed25519 public key
    ↓
agentProofOfPossessionVerified = true
```

A successful result proves mathematical possession of the delegated agent key for the signed statement.

It does not establish that either the buyer or agent key is trusted, that the represented identities are real, that the delegation is currently valid, or that a payment or protected-resource release is authorized.

## Finite Phase 5 Ladder

The relevant Phase 5 sequence is:

1. PR #292 — controlled Agent-Delegated x402 v2 E2E baseline
2. PR #293 — Buyer-to-Agent Delegation Credential Contract
3. PR #294 — buyer delegation signature verifier seam
4. PR #295 — agent proof-of-possession verifier seam
5. PR #296 — controlled runtime cryptographic composition / Demo 2
6. PR #297 — revocation, bounded use, replay/lifecycle enforcement, and Phase 5 closure

Agent Registry work belongs to Phase 6.

Production activation is outside Phase 5.

## Trust Boundary

PR #295 establishes only the following cryptographic facts:

* the PR #293 delegation credential satisfies its structural contract;
* the PR #294 detached buyer signature verifies mathematically;
* the agent public JWK is included in the buyer-signed credential;
* the PoP statement is structurally valid and RFC 8785 canonicalizable;
* the statement is bound to the validated credential;
* the statement is bound to the delegated agent identity and key ID;
* the statement is bound to the expected audience and challenge;
* the detached agent signature verifies using the public key embedded in the buyer-signed credential.

PR #295 deliberately does not establish:

* buyer verification-key trust;
* buyer identity authentication;
* buyer key ownership outside the mathematical signature result;
* agent identity authentication;
* agent-key trust or registry status;
* current authorization;
* current-time validity;
* revocation status;
* remaining-use availability;
* bounded-use consumption;
* replay-state mutation;
* Gateway authorization;
* payment authority;
* CRP settlement;
* receipt issuance;
* protected-resource release;
* production activation.

## Cryptographic Model

### Buyer signature

PR #294 verifies the detached buyer signature over the exact RFC 8785 canonical UTF-8 representation of the inner delegation credential.

The outer buyer proof object is not included in its own signing input.

The stable SHA-256 credential hash produced by the PR #293 validator becomes a signed binding inside the agent PoP statement.

### Agent signature

PR #295 verifies a detached Ed25519 signature over the exact RFC 8785 canonical UTF-8 representation of the inner PoP `statement`.

The outer agent `proof` object is not included in its own signing input.

The caller cannot supply an independent agent verification key. The verifier obtains the agent public JWK exclusively from:

```text
delegationDocument.credential.subject.agentPublicKeyJwk
```

Because that JWK is contained in the buyer-signed credential, successful PR #294 verification establishes that the buyer signature covered the exact delegated agent public key.

This is a mathematical binding, not a trust or identity assertion.

## Agent Proof Document Contract

The agent proof document has exactly two top-level properties:

```json
{
  "statement": {},
  "proof": {}
}
```

Unknown or additional properties are rejected.

### Signed statement

```json
{
  "proofType": "xcf.concordium.agent-proof-of-possession.v1",
  "proofVersion": "1.0.0",
  "delegationId": "delegation-pr295-pop-001",
  "credentialHash": "<64-character lowercase SHA-256>",
  "agentId": "agent:demo:pr295:001",
  "agentKeyId": "agent-key-pr295-001",
  "audience": "xcf-gateway:demo",
  "challenge": {
    "nonce": "agent-pop-challenge-pr295-001",
    "challengeHash": "<64-character lowercase SHA-256>",
    "issuedAt": 1780000000,
    "expiresAt": 1780000300
  }
}
```

The statement requires exactly:

* `proofType`
* `proofVersion`
* `delegationId`
* `credentialHash`
* `agentId`
* `agentKeyId`
* `audience`
* `challenge`

The nested challenge requires exactly:

* `nonce`
* `challengeHash`
* `issuedAt`
* `expiresAt`

### Detached proof

```json
{
  "signatureAlgorithm": "Ed25519",
  "canonicalizationAlgorithm": "RFC8785",
  "verificationMethod": "agent-key-pr295-001",
  "signatureValue": "<canonical base64url Ed25519 signature>"
}
```

The proof requires exactly:

* `signatureAlgorithm`
* `canonicalizationAlgorithm`
* `verificationMethod`
* `signatureValue`

The signature must decode from canonical, unpadded base64url to exactly 64 bytes.

## Challenge Semantics

PR #295 reuses the established Phase 5 challenge vocabulary:

```text
challenge.nonce
challenge.challengeHash
challenge.issuedAt
challenge.expiresAt
```

All four fields are included in the agent-signed canonical statement.

The expected challenge is supplied separately by the caller and must match the signed statement exactly.

### Structural requirements

* `nonce` must be a non-empty bounded string.
* `challengeHash` must be a 64-character lowercase SHA-256 hex string.
* `issuedAt` must be a non-negative safe integer.
* `expiresAt` must be a non-negative safe integer.
* `expiresAt` must be greater than `issuedAt`.

### Clock boundary

PR #295 does not compare either timestamp with the current clock.

The timestamps are:

* structurally validated;
* included in the agent signature;
* compared exactly with the caller-supplied expected challenge.

They are not used to establish current validity.

Therefore, even after successful proof verification:

```text
validityEvaluatedAgainstClock = false
currentAuthorizationEstablished = false
```

Current-time enforcement remains part of PR #297.

## Verifier Input

The exported verifier input is:

```ts
export interface AgentProofOfPossessionExpectedChallenge {
  readonly nonce: string;
  readonly challengeHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface AgentProofOfPossessionVerificationInput {
  readonly delegationDocument: unknown;

  readonly buyerVerificationKey:
    | BuyerDelegationVerificationKey
    | null;

  readonly proofDocument: unknown;

  readonly expectedChallenge:
    | AgentProofOfPossessionExpectedChallenge
    | null;
}
```

The input deliberately excludes:

* an independent agent verification key;
* `nowSec`;
* a Gateway client;
* a CRP client;
* a database or persistence adapter;
* a replay store;
* an Agent Registry client;
* a wallet or payment adapter;
* runtime feature flags.

## Verification Order

The verifier is fail-closed and evaluates inputs in the following order.

### 1. PR #293 and PR #294 prerequisite verification

The verifier first calls:

```ts
verifyBuyerDelegationSignature(...)
```

When PR #293 or PR #294 rejects:

* its exact reason is preserved;
* PoP parsing does not begin;
* agent cryptographic verification is not attempted;
* `agentProofOfPossessionVerified` remains false.

### 2. Required agent proof

A missing `proofDocument` returns:

```text
missing_agent_proof
```

### 3. Exact PoP document contract

The verifier validates:

* exact object keys;
* required string and timestamp shapes;
* proof type;
* proof version;
* signature algorithm;
* canonicalization algorithm.

### 4. Canonical statement generation

The inner `statement` is RFC 8785 canonicalized.

Its SHA-256 hash is exposed as:

```text
proofStatementHash
```

### 5. Expected challenge validation

A missing or structurally invalid expected challenge returns:

```text
missing_agent_expected_challenge
```

### 6. Credential and identity bindings

The verifier compares the signed statement against the validated delegation credential in this order:

1. delegation ID
2. credential hash
3. agent identity
4. agent key ID
5. audience

### 7. Challenge bindings

The verifier compares:

1. challenge nonce
2. challenge hash
3. challenge `issuedAt`
4. challenge `expiresAt`

### 8. Verification-method binding

The detached proof’s `verificationMethod` must equal the delegated `agentKeyId`.

### 9. Signature encoding

The detached signature must be canonical, unpadded base64url and decode to exactly 64 bytes.

### 10. Embedded agent-key import

The verifier imports only the Ed25519 public JWK contained inside the buyer-signed delegation credential.

### 11. Agent signature verification

The verifier performs Ed25519 verification over the canonical UTF-8 PoP statement bytes.

Only after a successful cryptographic verification does the result expose:

```text
agentProofOfPossessionVerified = true
```

## Reason Codes

The PR #295 result reason type includes every PR #293 and PR #294 reason without translation.

This preserves predecessor behavior exactly.

### PR #295-specific reasons

```text
missing_agent_proof
invalid_agent_proof_shape
unsupported_agent_proof_type
unsupported_agent_proof_version
unsupported_agent_signature_algorithm
unsupported_agent_canonicalization_algorithm
missing_agent_expected_challenge
delegation_id_mismatch
credential_hash_mismatch
agent_identity_mismatch
agent_key_id_mismatch
agent_proof_audience_mismatch
agent_challenge_nonce_mismatch
agent_challenge_hash_mismatch
agent_challenge_issued_at_mismatch
agent_challenge_expires_at_mismatch
agent_verification_method_mismatch
invalid_agent_signature_encoding
agent_proof_verification_failed
agent_proof_verification_error
```

### Deliberately omitted reasons

There is no separate `missing_agent_signature_value` reason.

A missing signature field violates the exact proof shape and returns:

```text
invalid_agent_proof_shape
```

There is no public `agent_proof_canonicalization_failed` reason.

After exact schema validation, the statement contains only supported JSON-safe values. Unexpected canonicalization or cryptographic infrastructure exceptions use:

```text
agent_proof_verification_error
```

There is no caller-facing independent-agent-key error because no independent agent verification key is accepted.

## Result Semantics

Important result fields include:

```ts
delegationContractValidated
buyerSignatureVerified
agentPublicKeyBoundByBuyerSignature

credentialHash
delegationId
agentId
agentKeyId

proofStatementValidated
canonicalProofStatementPresent
proofStatementHash

expectedChallengePresent

delegationIdMatched
credentialHashMatched
agentIdentityMatched
agentKeyIdMatched
audienceMatched

challengeNonceMatched
challengeHashMatched
challengeIssuedAtMatched
challengeExpiresAtMatched

verificationMethodMatched
proofBindingsMatched

agentCryptographicVerificationAttempted
agentProofOfPossessionVerified
```

### `agentPublicKeyBoundByBuyerSignature`

This field means:

* the delegation credential passed its contract;
* the buyer signature verified;
* the agent public key was obtained from the buyer-signed credential.

It does not mean that the agent key is trusted or registered.

### `proofBindingsMatched`

This field means that all structural statement bindings matched:

* delegation ID;
* credential hash;
* agent identity;
* agent key ID;
* audience;
* all four challenge fields;
* verification method.

It does not mean that the signature encoding or signature itself is valid.

For example, a proof may have:

```text
proofBindingsMatched = true
agentProofOfPossessionVerified = false
```

when all bindings match but the signature is malformed or cryptographically invalid.

### `agentCryptographicVerificationAttempted`

This field becomes true only after:

* PR #293 passes;
* PR #294 passes;
* the PoP document passes structural validation;
* the expected challenge is present and valid;
* every credential, identity, audience, challenge, and verification-method binding matches;
* the signature encoding is valid;
* the embedded public key imports successfully.

## Permanent Public Vectors

PR #295 commits public verification material only.

No buyer or agent private key is exported, printed, or committed.

The vectors were generated using ephemeral in-memory Ed25519 keypairs. Only public JWKs, signatures, canonical statement bytes, and hashes were written.

### Frozen values

```text
credentialHash:
76cb86a7e5f9f10d14ebe723ffb5ae828dfa3fd32ccbb6e273593e1e2cfd8dab

proofStatementHash:
d490f75b52057b31ff840d3db56762e7b03ec51c11f584c906cbf356d7ebd374
```

### Frozen files

| File                                                                        | Bytes | SHA-256                                                            |
| --------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `fixtures/phase5/agent-proof-of-possession/delegation.valid.example.json`   |  1944 | `10a1c8e4800e2867f962906d0623ae9fe5dfbfb3518bfbdd2255026f83bee7a6` |
| `fixtures/phase5/agent-proof-of-possession/buyer.verification-key.json`     |   267 | `8577dd60f82538bd88125734e7e251fe06303ea5f03ce565ebc9b0cd3ff8873b` |
| `fixtures/phase5/agent-proof-of-possession/agent-proof.valid.example.json`  |   855 | `cc696b22f321650e818fa4ba6d641fe9bcce5dcce2010bd693861ccf09b50b0f` |
| `fixtures/phase5/agent-proof-of-possession/agent-proof.valid.canonical.txt` |   489 | `b5bf39160918f1f417b4f4d944286d41d6180ef81f9b2f3137f4a311c3e4307f` |
| `fixtures/phase5/agent-proof-of-possession/agent-proof.valid.sha256.txt`    |    65 | `295cb0ac06bf9aec861d819bb2395d6e90f37bb279ec0789eecf8fc58e6e36ec` |

All committed PR #295 JSON and text vectors are forced to LF through `.gitattributes`.

## Permanent Harness

Run:

```bash
npm run phase5:agent-proof-of-possession-verifier-seam-test
```

The permanent harness enforces exactly 24 cases:

* 2 positive cases;
* 22 negative cases;
* 4 cases that reach agent cryptographic verification;
* 2 cases with successful agent proof-of-possession.

Expected summary:

```text
ok = true
caseCount = 24
positiveCount = 2
negativeCount = 22
agentCryptoAttemptCount = 4
agentCryptoVerifiedCount = 2
```

## Test Matrix

### Positive cases

1. Valid buyer signature plus valid agent proof-of-possession.
2. Recursive PoP key reordering remains RFC 8785 stable.

### Preserved predecessor failures

3. PR #293 credential-contract rejection is preserved.
4. PR #294 buyer-signature rejection is preserved.

Neither predecessor-failure case reaches agent cryptographic verification.

### PoP contract and algorithm failures

5. Missing agent proof.
6. Invalid proof shape.
7. Unsupported proof type.
8. Unsupported proof version.
9. Unsupported signature algorithm.
10. Unsupported canonicalization algorithm.
11. Missing expected challenge.
12. Invalid canonical agent-signature encoding.

### Binding failures

13. Delegation ID mismatch.
14. Credential hash mismatch.
15. Agent identity mismatch.
16. Agent key ID mismatch.
17. Audience mismatch.
18. Challenge nonce mismatch.
19. Challenge hash mismatch.
20. Challenge `issuedAt` mismatch.
21. Challenge `expiresAt` mismatch.
22. Verification-method mismatch.

### Cryptographic failures

23. One-bit mutation of an otherwise valid 64-byte agent signature.
24. Mutation of the signed PoP statement while updating the caller’s expected challenge to match the mutation.

Case 24 ensures that all structural bindings pass before Ed25519 verification fails. This proves that statement mutation is rejected by the agent signature rather than by an earlier binding check.

Every case asserts:

* exact expected reason;
* expected status;
* expected agent-cryptography attempt state;
* `agentProofOfPossessionVerified`;
* the full false safety contract.

## Safety Contract

The following fields remain false for every positive and negative result:

```text
buyerVerificationKeyTrustEstablished
buyerIdentityAuthenticated
buyerKeyOwnershipEstablished

agentIdentityAuthenticated
agentKeyTrustEstablished

currentAuthorizationEstablished
validityEvaluatedAgainstClock
revocationChecked
boundedUseConsumed
challengeReplayStateMutated

gatewayCalled
crpCalled
paymentAttempted
receiptJwsPrinted
paymentResponsePrinted
protectedResourceReleased
agentRegistryLookupAttempted
productionActivation
```

The verifier also always reports:

```text
mode = test_fixture_only
testOnly = true
```

## Files Added or Modified

PR #295 is limited to ten changed files.

### Modified

```text
.gitattributes
package.json
```

### Added

```text
docs/phase5-agent-proof-of-possession-verifier-seam.md
src/phase5/agentProofOfPossessionVerifier.ts
scripts/ci_phase5_agent_proof_of_possession_verifier_seam.ts
fixtures/phase5/agent-proof-of-possession/delegation.valid.example.json
fixtures/phase5/agent-proof-of-possession/buyer.verification-key.json
fixtures/phase5/agent-proof-of-possession/agent-proof.valid.example.json
fixtures/phase5/agent-proof-of-possession/agent-proof.valid.canonical.txt
fixtures/phase5/agent-proof-of-possession/agent-proof.valid.sha256.txt
```

`package-lock.json` remains unchanged.

No predecessor source, harness, documentation, or fixture file is modified.

## Validation Commands

### Permanent harness

```bash
npm run phase5:agent-proof-of-possession-verifier-seam-test
```

### Targeted compilation

```bash
npx tsc \
  --noEmit \
  --pretty false \
  --skipLibCheck \
  --target ES2020 \
  --module Node16 \
  --moduleResolution Node16 \
  --esModuleInterop \
  src/phase5/agentProofOfPossessionVerifier.ts \
  scripts/ci_phase5_agent_proof_of_possession_verifier_seam.ts
```

### Predecessor regressions

```bash
npm run phase5:buyer-to-agent-delegation-credential-contract-test

npm run phase5:buyer-delegation-signature-verifier-seam-test
```

### Diff hygiene

```bash
git diff --check
git status -sb
```

## Definition of Done for PR #295

PR #295 is complete when:

* the PR #293 credential contract is preserved;
* the PR #294 buyer signature result is preserved;
* the agent verification key is obtained only from the buyer-signed credential;
* the PoP statement is RFC 8785 canonicalized;
* all credential and challenge bindings are fail-closed;
* the detached agent Ed25519 signature is verified;
* a valid fixture returns `agentProofOfPossessionVerified: true`;
* mutation and mismatch cases return exact stable reasons;
* all safety and non-authorization fields remain false;
* the permanent 24-case harness passes;
* predecessor files remain unchanged;
* `package-lock.json` remains unchanged;
* no private key material is committed;
* no runtime or production path is activated.

## Next Finite Rung

PR #296 may consume the PR #295 cryptographic result inside the controlled Phase 5 runtime composition and Demo 2 path.

PR #296 must not reinterpret PR #295 as a complete authorization decision.

The composition must continue to distinguish:

```text
mathematical credential and signature verification
```

from:

```text
current, enforceable runtime authorization
```

Revocation, bounded use, replay/lifecycle enforcement, and Phase 5 closure remain explicitly reserved for PR #297.
