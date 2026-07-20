# Phase 5 Buyer Delegation Signature Verifier Seam

## Status

- Phase: 5 — Agent-Delegated x402 v2
- Pull request: #294
- Contract version: `phase5.buyerDelegationSignatureVerifier.v1`
- Mode: `test_fixture_only`
- Cryptographic primitive: Ed25519
- Canonicalization: RFC 8785 / JSON Canonicalization Scheme
- Hash algorithm: SHA-256
- Runtime activation: disabled
- Production activation: disabled
- Next finite rung: PR #295 — agent proof-of-possession

## Executive summary

PR #294 adds an isolated, test-only verifier seam that cryptographically verifies the buyer's detached Ed25519 signature over the exact canonical buyer-to-agent delegation credential bytes frozen by PR #293.

PR #293 established:

- the buyer-to-agent delegation credential structure;
- the complete set of signed claims;
- strict metadata validation;
- the RFC 8785 canonical representation;
- the detached-proof boundary;
- the stable credential SHA-256 hash;
- buyer and agent key identifiers;
- delegated scope, validity, usage, replay, and lifecycle metadata.

PR #294 consumes that existing contract. It does not redefine or duplicate the PR #293 validator or canonicalization algorithm.

A successful PR #294 result proves only that the detached signature was produced by the private key corresponding to the supplied Ed25519 public key.

It does not establish that the supplied public key is trusted, registered, controlled by the claimed buyer, or authorized for production release.

## Goal

The finite goal of PR #294 is:

> Given a structurally valid PR #293 buyer-to-agent delegation credential and a supplied test-fixture Ed25519 buyer verification key whose key identifier matches the credential, verify the detached buyer signature over the exact RFC 8785 canonical credential bytes.

The implementation must fail closed for malformed credentials, malformed keys, mismatched key identifiers, modified signed claims, modified signatures, and incorrect public keys.

## Explicit trust boundary

A successful result may report:

```text
contractValidated: true
verificationKeyMatched: true
cryptographicVerificationAttempted: true
signatureVerified: true
```

It must still report:

```text
verificationKeyTrustEstablished: false
buyerIdentityAuthenticated: false
buyerKeyOwnershipEstablished: false
agentProofOfPossessionVerified: false
gatewayCalled: false
crpCalled: false
paymentAttempted: false
receiptJwsPrinted: false
paymentResponsePrinted: false
protectedResourceReleased: false
replayStateMutated: false
agentRegistryLookupAttempted: false
productionActivation: false
```

The distinction is intentional:

- `signatureVerified: true` establishes mathematical signature validity.
- `verificationKeyTrustEstablished: false` means the key has not been resolved through a trusted buyer-key registry, identity system, DID resolver, Concordium account-key resolver, wallet, or certificate chain.
- `buyerIdentityAuthenticated: false` means the claimed buyer identity has not been independently authenticated.
- `buyerKeyOwnershipEstablished: false` means possession or ownership of the supplied buyer key has not been established outside the signature itself.
- `agentProofOfPossessionVerified: false` preserves PR #295 as the next finite rung.

## Relationship to PR #293

PR #294 imports and calls:

```ts
validateBuyerToAgentDelegationCredentialContract(...)
```

An accepted PR #293 result provides:

- `canonicalCredentialPresent: true`
- `canonicalCredential`
- `credentialHash`
- `buyerId`
- `buyerKeyId`

The verifier signs and verifies the UTF-8 bytes of `canonicalCredential`.

It does not:

- call `JSON.stringify` as the signing representation;
- canonicalize the outer document;
- include the detached `proof` object in the signed bytes;
- recompute a second credential contract;
- weaken any PR #293 structural validation.

A PR #293 rejection is returned before any cryptographic operation. The exact PR #293 reason code is preserved.

## Files

### Verifier implementation

```text
src/phase5/buyerDelegationSignatureVerifier.ts
```

### Permanent test harness

```text
scripts/ci_phase5_buyer_delegation_signature_verifier_seam.ts
```

### Public test vectors

```text
fixtures/phase5/delegation-signature/
  buyer-signature.valid.verification-key.json
  buyer-signature.invalid.wrong-verification-key.json
  buyer-signature.valid.signature.txt
```

### Package command

```text
npm run phase5:buyer-delegation-signature-verifier-seam-test
```

## Input contract

The verifier accepts:

```ts
interface BuyerDelegationSignatureVerificationInput {
  document: unknown;
  verificationKey: BuyerDelegationVerificationKey | null;
}
```

The verification key contract is:

```ts
interface BuyerDelegationVerificationKey {
  buyerKeyId: string;
  publicKeyJwk: {
    kty: "OKP";
    crv: "Ed25519";
    x: string;
    kid?: string;
    use?: "sig";
    alg?: "EdDSA";
  };
  source: "test_fixture_only";
}
```

The verifier does not perform network key discovery.

## Verification sequence

The fail-closed sequence is:

1. Validate the document through the PR #293 contract validator.
2. Preserve and return any PR #293 rejection reason.
3. Require a supplied buyer verification key.
4. Read the credential buyer key identifier.
5. Read the detached proof `verificationMethod`.
6. Compare the supplied `buyerKeyId` with both identifiers.
7. If present, compare the JWK `kid` with the credential buyer key identifier.
8. Strictly validate the supplied Ed25519 JWK.
9. Strictly decode the detached signature as canonical base64url.
10. Require the signature to decode to exactly 64 bytes.
11. Convert the already validated JWK to Node's JWK API representation.
12. Create a Node public key object.
13. Verify the Ed25519 signature over the UTF-8 canonical credential bytes.
14. Return a structured verified or rejected result.
15. Keep every trust, runtime, payment, release, and production flag false.

Key-ID mismatches and malformed keys fail before Ed25519 verification.

## Result contract

The result differentiates structural validation, key matching, cryptographic execution, signature validity, and trust:

```ts
interface BuyerDelegationSignatureVerificationResult {
  ok: boolean;
  status: "verified" | "rejected";
  reason: BuyerDelegationSignatureVerificationReasonCode;
  mode: "test_fixture_only";
  testOnly: true;

  contractValidated: boolean;
  contractReason: BuyerToAgentDelegationReasonCode;

  canonicalCredentialPresent: boolean;
  credentialHash: string | null;

  buyerId: string | null;
  buyerKeyId: string | null;
  verificationMethod: string | null;

  verificationKeyPresent: boolean;
  verificationKeySource: "test_fixture_only" | null;
  verificationKeyMatched: boolean;

  cryptographicVerificationAttempted: boolean;
  signatureVerified: boolean;

  verificationKeyTrustEstablished: false;
  buyerIdentityAuthenticated: false;
  buyerKeyOwnershipEstablished: false;
  agentProofOfPossessionVerified: false;

  gatewayCalled: false;
  crpCalled: false;
  paymentAttempted: false;
  receiptJwsPrinted: false;
  paymentResponsePrinted: false;
  protectedResourceReleased: false;
  replayStateMutated: false;
  agentRegistryLookupAttempted: false;
  productionActivation: false;
}
```

## PR #294 reason codes

PR #294 introduces:

```text
missing_buyer_verification_key
buyer_verification_key_id_mismatch
invalid_buyer_verification_key
buyer_signature_verification_failed
buyer_signature_verification_error
```

All PR #293 contract reason codes remain valid verifier outcomes and are preserved exactly when structural validation fails.

### Reason precedence

The effective precedence is:

1. PR #293 credential-contract rejection
2. `missing_buyer_verification_key`
3. `buyer_verification_key_id_mismatch`
4. `invalid_buyer_verification_key`
5. `buyer_signature_verification_failed`
6. `buyer_signature_verification_error`
7. `accepted`

`buyer_signature_verification_error` is reserved for an unexpected cryptographic API failure. Ordinary invalid signatures return `buyer_signature_verification_failed`.

## Frozen canonical credential

The signed credential remains the PR #293 frozen vector:

```text
Canonical UTF-8 length:
1184 bytes

Credential SHA-256:
39d6a9381893f94b6d9cab674d50803eafba178ee8b164a0b790ca3cc8820a2e
```

The outer proof remains excluded from both the canonical credential and its stable hash.

Replacing the PR #293 placeholder signature with the real PR #294 detached signature therefore leaves the credential hash unchanged.

## Frozen public verification vectors

Only public material is committed.

### Valid verification-key file

```text
File:
buyer-signature.valid.verification-key.json

Bytes:
265

File SHA-256:
72f189359fd25e22f541a3bb01cbd1cd5658c84cb34687c883635eecb5547ecc
```

### Wrong verification-key file

```text
File:
buyer-signature.invalid.wrong-verification-key.json

Bytes:
265

File SHA-256:
b5e50b3a1af5480ec921c2d11f576eb6e4ccbe3d584dcf96158492c2cd31c9fb
```

### Valid detached-signature file

```text
File:
buyer-signature.valid.signature.txt

Bytes including terminal LF:
87

Canonical base64url characters:
86

Decoded signature bytes:
64

File SHA-256:
d7cec848be1679fbef7c8da0629c13d4a7bd9dc6a2b72fb978bc6a0c20ca9f2a
```

The valid and wrong public keys use the same expected buyer key identifier. This ensures the wrong-key test reaches cryptographic verification rather than failing at the identifier boundary.

## Private-key handling

The valid and wrong Ed25519 key pairs were generated in a one-time ignored local helper.

The helper:

- kept both private keys in process memory;
- exported only the public JWKs;
- wrote only public verification-key files and a detached signature;
- did not serialize a private JWK;
- did not write PEM private-key material;
- was stored under the ignored `.backups/` directory.

No buyer private key is committed.

The frozen public vectors and signature must not be regenerated accidentally. The permanent harness pins their complete file SHA-256 hashes.

## Permanent test matrix

The permanent harness executes 11 cases.

### Positive cases

1. Valid signature
   - PR #293 contract accepted
   - verification key matched
   - Ed25519 verification attempted
   - signature verified
   - frozen credential hash preserved

2. Recursive key reordering
   - object keys recursively reordered
   - RFC 8785 representation unchanged
   - credential hash unchanged
   - signature still verified

### Cryptographic negative cases

3. PR #293 placeholder signature
   - structurally valid
   - cryptographic verification attempted
   - rejected with `buyer_signature_verification_failed`

4. Wrong public key
   - key identifier still matches
   - structurally valid Ed25519 JWK
   - cryptographic verification attempted
   - rejected with `buyer_signature_verification_failed`

5. One-bit signature mutation
   - signature remains canonical 64-byte base64url
   - credential hash remains unchanged
   - rejected with `buyer_signature_verification_failed`

6. Signed-claim mutation
   - detached signature remains unchanged
   - credential hash changes
   - rejected with `buyer_signature_verification_failed`

### Pre-cryptographic negative cases

7. Missing verification key
   - rejected with `missing_buyer_verification_key`
   - cryptographic verification not attempted

8. Verification-key ID mismatch
   - rejected with `buyer_verification_key_id_mismatch`
   - cryptographic verification not attempted

9. Invalid verification JWK
   - rejected with `invalid_buyer_verification_key`
   - cryptographic verification not attempted

10. PR #293 contract rejection
    - exact `missing_buyer_key_identity` reason preserved
    - canonical credential absent
    - cryptographic verification not attempted

11. Proof verification-method mismatch
    - exact PR #293 `verification_method_mismatch` reason preserved
    - cryptographic verification not attempted

## Line-ending policy

Cryptographic vector bytes must be stable across Windows and Unix checkouts.

PR #294 adds narrow repository rules:

```gitattributes
fixtures/phase5/delegation/*.txt text eol=lf
fixtures/phase5/delegation-signature/*.txt text eol=lf
fixtures/phase5/delegation-signature/*.json text eol=lf
```

The first rule repairs the Windows checkout behavior discovered when the merged PR #293 canonical vector was converted to CRLF under `core.autocrlf=true`.

The PR #294 JSON key vectors are also LF-pinned because their complete file bytes are hash-pinned by the permanent harness.

Existing PR #293 JSON fixtures are semantic JSON inputs rather than byte vectors. They are parsed as JSON and are not required to use a particular working-tree line ending.

## Safety properties

PR #294 is test-only and side-effect free.

The verifier does not:

- modify `src/server.ts`;
- call Gateway routes;
- call the CRP facilitator;
- create or fulfill a payment;
- submit a Concordium transaction;
- read or write payment receipts;
- emit `PAYMENT-RESPONSE`;
- release a protected resource;
- mutate replay state;
- write a database;
- resolve a buyer key over a network;
- query an Agent Registry;
- authenticate a buyer identity;
- verify agent proof-of-possession;
- activate a runtime release path;
- activate production behavior.

## Explicit non-goals

The following remain outside PR #294:

- trusted buyer-key discovery;
- Concordium account-key lookup;
- browser-wallet integration;
- DID resolution;
- certificate-chain validation;
- buyer identity authentication;
- buyer key revocation;
- buyer key rotation enforcement;
- agent proof-of-possession;
- agent challenge signing;
- runtime cryptographic composition;
- Gateway authorization integration;
- payment execution;
- CRP settlement;
- protected-resource release;
- bounded-use persistence;
- replay-state persistence;
- Agent Registry integration;
- production activation.

## Exact pull-request scope

PR #294 is limited to eight files.

Modified:

```text
.gitattributes
package.json
```

Added:

```text
docs/phase5-buyer-delegation-signature-verifier-seam.md
src/phase5/buyerDelegationSignatureVerifier.ts
scripts/ci_phase5_buyer_delegation_signature_verifier_seam.ts
fixtures/phase5/delegation-signature/buyer-signature.valid.verification-key.json
fixtures/phase5/delegation-signature/buyer-signature.invalid.wrong-verification-key.json
fixtures/phase5/delegation-signature/buyer-signature.valid.signature.txt
```

`package-lock.json` is intentionally unchanged.

No existing PR #293 credential, fixture, canonical vector, or hash vector is modified.

## Definition of done

PR #294 is complete when:

1. PR #293 structural validation runs before cryptographic verification.
2. A real Ed25519 signature verifies over the exact frozen RFC 8785 bytes.
3. The frozen credential hash remains unchanged.
4. Recursive key reordering remains stable.
5. The detached proof remains excluded from the credential hash.
6. The PR #293 placeholder signature fails closed.
7. A wrong public key fails closed.
8. A one-bit signature mutation fails closed.
9. A signed-claim mutation fails closed.
10. Missing, mismatched, and malformed verification keys fail before crypto.
11. PR #293 rejection reasons remain exact.
12. No private key is committed.
13. The successful path reports `signatureVerified: true`.
14. The successful path does not claim key trust or buyer authentication.
15. Agent proof-of-possession remains false.
16. Gateway, CRP, payment, release, replay, registry, and production behavior remain inactive.
17. PR #293 and all previous Phase 5 regression harnesses remain green.
18. The final diff contains exactly the eight intended files.

## Finite ladder

The finite Phase 5 ladder remains:

- PR #292 — controlled Agent-Delegated x402 v2 E2E baseline — merged
- PR #293 — buyer-to-agent delegation credential contract — merged
- PR #294 — cryptographic buyer-signature verifier seam — current
- PR #295 — agent proof-of-possession
- PR #296 — controlled runtime cryptographic composition / Demo 2
- PR #297 — revocation, bounded use, and key lifecycle; close Phase 5

Agent Registry work remains Phase 6.
