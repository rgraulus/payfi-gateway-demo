# Phase 3 — x402/ZKP Binding Contract and Delegated Agent Model v1

## 1. Executive Summary

This document defines the Phase 3 design contract for binding Concordium ZKP identity proofs to x402 payment-gated requests.

The immediate goal is to move from a successful local proof-verification milestone to a production-credible Gateway enforcement model. PR #88 proved that a Concordium Browser Wallet `VerifiablePresentation` can be verified locally against live Concordium testnet data. PR #89 documented that validation.

PR #90 should now define the binding contract that determines when a verified ZKP proof is valid for a specific x402 challenge, merchant, resource, policy, payment tuple, business terms, and delegated-agent authorization scope.

The central principle is:

> Payment proof, eligibility proof, delegation proof, and business-terms proof are separate logical proofs. Gateway release requires all required proofs to be valid and bound to the same x402 challenge context.

This document is design-only. It does not modify Gateway runtime behavior, CRP behavior, `/paid-gated`, settlement validation, or production policy enforcement.

---

## 2. Current Validated State

The current implementation has validated the following path:

```text
Concordium Browser Wallet
→ raw Buyer Wallet VerifiablePresentation
→ local proof shape checker
→ getPublicData(...)
→ getCryptographicParameters(...)
→ verifyPresentation(...)
→ verified request returned
```

The live verification result confirmed:

```text
liveVerification.ok: true
liveVerification.stage: verified
network: testnet
grpcHost: 127.0.0.1
grpcPort: 20001
credentialCount: 1
verifiedRequestKeys:
  - challenge
  - credentialStatements
rawProofPrinted: false
exit: 0
```

This proves that the direct Buyer Wallet ZKP path is technically viable.

It does **not** yet prove Gateway enforcement. Specifically, it does not yet prove that the verified proof is bound to a particular x402 nonce, merchant, resource, contract, amount, asset, payee, expiry window, business terms, or delegated-agent authorization scope.

---

## 3. Objective of PR #90

PR #90 should define the design contract for:

1. Direct Buyer Wallet x402/ZKP proof binding.
2. Future Delegated Agent proof submission.
3. Standards and interoperability hooks.
4. Dynamic x402 v2 business terms binding.

The objective is to define how the Gateway will eventually answer:

```text
Is this a valid Concordium ZKP proof?
Is this proof bound to this exact x402 challenge?
Is this proof valid for this merchant and resource?
Is this proof valid for this exact payment tuple?
Is this proof valid under the required policy?
Is this proof fresh and non-replayed?
If an Agent submitted it, is the Agent authorized to act for the Buyer?
Are the accepted business terms also bound to the same challenge?
```

PR #90 should be docs-only.

---

## 4. Non-Goals

PR #90 should not implement:

- Gateway enforcement.
- CRP changes.
- `/paid-gated` release changes.
- Production policy verifier changes.
- Dynamic business terms enforcement.
- Agent Registry integration.
- ERC-8004 implementation.
- CAIP-122 / SIWx implementation.
- VerifiablePresentationV1 migration.
- Concordium Verifier Service integration.
- New payment settlement logic.
- Raw proof storage in Git.

It should define the contract that later implementation PRs will follow.

---

## 5. Core Security Principle

A verified proof is not sufficient by itself.

A ZKP can prove that a Buyer satisfies a condition, such as age or residency, but the Gateway must also know that the proof was generated for the exact x402 challenge currently being evaluated.

The proof must not be reusable across:

- merchants
- resources
- HTTP methods
- contract IDs
- payment amounts
- assets
- payees
- chain identities
- expiry windows
- agent sessions
- delegated scopes
- business terms

Therefore, the binding contract must ensure:

```text
verified ZKP proof
+ active x402 challenge
+ payment tuple
+ policy requirements
+ optional delegation authorization
+ optional business terms hash
= one indivisible authorization context
```

---

## 6. Direct Buyer Wallet Proof Model

The direct Buyer model answers:

```text
Is this Buyer eligible for this exact x402 request?
```

The current successful live verification validates the proof cryptographically. The next step is to bind the proof to the x402 challenge.

### 6.1 Actors

- **Buyer:** human user with Concordium Browser Wallet and identity credential.
- **Merchant:** party exposing a paid or policy-gated resource.
- **Gateway:** x402 enforcement point.
- **Concordium:** identity/ZKP and, optionally, payment settlement network.
- **CRP:** Concordium Rail Plugin / facilitator for settlement and receipts.
- **Orchestrator:** internal control plane for future multi-client and multi-rail workflows.

### 6.2 Direct Buyer proof flow

Conceptual flow:

```text
1. Buyer requests protected resource.
2. Gateway returns x402 402 challenge with payment and policy requirements.
3. Gateway or client derives a canonical ZKP challenge object.
4. Buyer Wallet generates VerifiablePresentation against the challenge.
5. Client submits authorization proof to Gateway.
6. Gateway verifies ZKP cryptographically.
7. Gateway verifies challenge binding.
8. Gateway verifies payment proof / receipt.
9. Gateway releases only if all required checks pass.
```

---

## 7. x402/ZKP Binding Contract

The x402/ZKP binding contract defines the fields that must be included in the canonical challenge context and therefore bound to the proof.

At minimum, the challenge context should include:

```text
type
version
x402Version
merchantId
resource.method
resource.path
contractId
contractVersion
network
chain_id
asset.type
asset.tokenId
asset.decimals
amount
amountMinor
payTo
nonce
issuedAt
expiresAt
policy.policyId
policy.policyVersion
policy.requirementsHash
businessTerms.termsId
businessTerms.termsVersion
businessTerms.termsHash
```

For direct Buyer proof, the subject may be implicit in the credential proof, but the envelope should still support:

```text
buyerSubjectRef
buyerAccountAddress
buyerAccountId
buyerCaip10AccountId
```

For future delegated-agent proof, the binding context must also support:

```text
agentSubjectRef
agentAccountAddress
agentAccountId
agentCaip10AccountId
delegationId
delegationScopeHash
delegationExpiresAt
delegationNonce
agentSessionId
agentRegistryRef
```

---

## 8. Canonical Challenge Fields

The Gateway should define a canonical challenge object with strict field semantics.

### 8.1 Required v1 fields

Suggested v1 object:

```json
{
  "type": "xcf.x402.zkp.challenge",
  "version": "1.0.0",
  "x402Version": "x402-v2",
  "merchantId": "demo-merchant",
  "resource": {
    "method": "GET",
    "path": "/paid-gated"
  },
  "contract": {
    "contractId": "cid_...",
    "contractVersion": "1.0.0",
    "isFrozen": true
  },
  "network": "concordium:testnet",
  "chain_id": "ccd:<genesis-hash>",
  "asset": {
    "type": "PLT",
    "tokenId": "EUDemo",
    "decimals": 6
  },
  "amount": "0.050101",
  "amountMinor": "50101",
  "payTo": "<merchant-account>",
  "nonce": "<x402-nonce>",
  "issuedAt": 1779289373,
  "expiresAt": 1779291173,
  "policy": {
    "policyId": "age-region-v1",
    "policyVersion": "1.0.0",
    "requirementsHash": "<sha256>"
  },
  "businessTerms": {
    "termsId": null,
    "termsVersion": null,
    "termsHash": null
  }
}
```

### 8.2 Field rules

- `amount` should remain human-readable decimal for x402 compatibility.
- `amountMinor` should be included for exact deterministic matching.
- `chain_id` should use the canonical Concordium chain identifier already emitted in receipts.
- Native Concordium fields must be preserved for SDK compatibility.
- CAIP-style fields may be included for cross-chain interoperability.
- `expiresAt` must be included and enforced.
- Policy requirements must be represented by stable IDs/hashes, not loose prose.

---

## 9. Challenge Canonicalization and Hashing

The challenge object should be canonicalized and hashed before being passed into the wallet proof challenge field.

The recommended model is:

```text
canonicalChallengeJson = canonical_json(challenge)
challengeHash = sha256(canonicalChallengeJson)
walletChallenge = challengeHash
```

### 9.1 Why hash instead of passing arbitrary JSON?

Hashing avoids:

- wallet challenge length constraints
- inconsistent JSON rendering
- accidental leakage of unnecessary business details
- incompatible challenge serialization across clients

### 9.2 Canonicalization rules to define

A later implementation PR should define:

- deterministic JSON key ordering
- UTF-8 encoding
- string-only representation for decimal and minor-unit amounts
- seconds-based integer timestamps
- no undefined values
- explicit nulls only for allowed optional fields
- SHA-256 hash
- hex or base64url output

Recommendation:

```text
Use SHA-256 over deterministic canonical JSON and encode as lowercase hex unless Concordium wallet APIs require a different challenge format.
```

---

## 10. Authorization Proof Envelope

The Gateway should not receive a raw presentation alone. It should receive an authorization envelope that includes safe metadata and the proof.

### 10.1 Direct Buyer authorization envelope

Suggested v1 shape:

```json
{
  "type": "xcf.concordium.authorization.direct-buyer.v1",
  "challenge": { "...": "canonical challenge object" },
  "challengeHash": "<sha256>",
  "proofType": "concordium.VerifiablePresentation",
  "presentation": { "...": "Concordium presentation" },
  "wallet": {
    "network": "testnet",
    "selectedChain": "..."
  },
  "submittedAt": "2026-05-21T00:00:00.000Z"
}
```

### 10.2 Envelope validation rules

Gateway should reject the envelope if:

- `type` is unknown.
- `challengeHash` does not match the canonical challenge.
- challenge `nonce` does not match active x402 nonce.
- challenge expired.
- `presentation` is missing.
- proof type is unsupported.
- verified presentation challenge does not match `challengeHash`.
- policy statements do not satisfy Gateway requirements.

---

## 11. Gateway Verification Rules

For direct Buyer verification, Gateway must perform these checks before policy can be considered satisfied:

1. Parse authorization envelope.
2. Validate envelope type and version.
3. Recompute challenge hash.
4. Confirm challenge hash matches envelope.
5. Confirm challenge nonce matches the active x402 challenge.
6. Confirm merchant/resource/contract/payment tuple match active challenge.
7. Confirm challenge has not expired.
8. Verify presentation cryptographically using Concordium SDK or approved verifier service.
9. Confirm verified challenge equals expected challenge hash.
10. Confirm verified credential statements satisfy required policy.
11. Confirm proof has not been replayed.
12. Store policy verification result on the challenge record.
13. Allow Gateway release only after both policy and payment checks pass.

The Gateway must fail closed if any check fails.

---

## 12. Replay Protection Model

Replay protection must operate at multiple layers.

### 12.1 x402 nonce replay

The x402 nonce must remain single-use for the protected resource/payment tuple.

### 12.2 ZKP proof replay

The ZKP proof must bind to:

- x402 nonce
- merchantId
- method
- path
- contractId
- amount
- asset
- payTo
- chain_id
- expiresAt
- policy hash
- optional businessTermsHash
- optional agent/delegation fields

### 12.3 Delegated-agent replay

For delegated flows, replay protection must also bind:

- agent identity
- delegationId
- delegationScopeHash
- delegationExpiresAt
- agent session ID
- agent signature
- request hash

### 12.4 Replay storage

Gateway should store replay markers for:

```text
challenge nonce
challengeHash
proof hash
agent delegation nonce/session
receipt/proof settlement tuple
```

---

## 13. Delegated Agent Model v1

The Delegated Agent Model answers:

```text
Is this Buyer eligible, and is this Agent authorized to act for this Buyer for this exact x402 request?
```

The direct Buyer flow proves only eligibility. The delegated flow must prove both eligibility and authority.

### 13.1 Design-level goal

The Delegated Agent Model should support agentic commerce where:

- Buyer remains the identity root.
- Agent may act at runtime.
- Buyer private credential material is not exposed to the Agent.
- Agent authority is scoped, time-limited, and replay-protected.
- Gateway can verify Buyer eligibility and Agent authorization separately.
- Payment proof remains separate from identity/delegation proof.

---

## 14. Actors and Trust Relationships

### 14.1 Buyer

The Buyer is the human identity subject and may hold:

- Concordium identity credential
- Browser Wallet account
- Web3 ID credential
- eligibility attributes
- policy-related ZKP capability

### 14.2 Agent

The Agent is the runtime actor submitting requests. It may be:

- local user-controlled agent
- hosted AI agent
- delegated commerce agent
- MCP tool or service
- third-party x402 client

The Agent should not need access to Buyer private identity material.

### 14.3 Merchant / Gateway

The Gateway is the authoritative release point. It decides whether policy, payment, and delegation requirements are satisfied.

### 14.4 Concordium

Concordium provides:

- identity credential infrastructure
- ZKP proof generation and verification path
- public credential metadata
- cryptographic parameters
- optional settlement rail
- possible verifier service / Verify & Pay abstraction
- possible agent identity roadmap components

---

## 15. Buyer Eligibility vs Agent Authorization vs Payment Settlement

These must remain separate logical layers.

### 15.1 Buyer eligibility proof

Answers:

```text
Does the Buyer satisfy the policy?
```

Examples:

- age minimum
- EU residency
- jurisdiction
- KYC/compliance attribute
- human-backed credential

### 15.2 Agent authorization proof

Answers:

```text
Is this Agent allowed to act for this Buyer for this request?
```

Examples:

- Buyer-signed mandate
- delegated session
- Agent credential
- Agent Registry status
- scoped authorization
- spending limit
- merchant/resource scope
- expiry

### 15.3 Payment settlement proof

Answers:

```text
Was the required payment settled or authorized?
```

Examples:

- x402 receipt
- PLT transfer
- facilitator receipt
- Base/USDC payment proof
- future lock/escrow proof

### 15.4 Gateway release decision

Gateway releases only when all required layers pass:

```text
eligibility proof valid
+ delegation proof valid when Agent acts
+ payment proof valid
+ business terms bound
+ replay checks pass
= release allowed
```

---

## 16. Delegation Primitives Under Consideration

PR #90 should not choose a final primitive prematurely. It should define the candidate primitives and ask Concordium to confirm the canonical direction.

Possible primitives:

1. Buyer wallet-signed mandate.
2. Buyer pre-approved Agent session.
3. Agent-held delegated credential.
4. Agent IDP credential.
5. Concordium Agent Registry entry or badge.
6. Concordium-native smart contract registry.
7. ERC-8004-compatible registry reference.
8. CAIP-122 / SIWx-style session proof.
9. Hybrid Buyer proof + Agent authorization bundle.
10. Concordium verifier-service mediated delegation.

### 16.1 Minimal viable delegated model

Recommended starting point:

```text
Buyer eligibility remains proven by Buyer-controlled credential material.
Agent authorization is represented as a separate scoped mandate or session proof.
Gateway verifies both against the same x402 challenge.
```

This avoids giving the Agent access to Buyer private identity material.

---

## 17. Delegated Runtime Proof-Generation Options

The critical open question is who generates or submits the ZKP at runtime.

### Option A — Buyer wallet generates proof live

The Buyer wallet remains online and generates a proof per request.

Pros:
- strongest privacy model
- closest to current validated path

Cons:
- not truly autonomous agentic commerce

### Option B — Buyer pre-generates scoped proof

Buyer generates a proof or proof capability for a limited session.

Pros:
- supports semi-autonomous agent flow

Cons:
- replay and expiry handling become critical

### Option C — Agent submits Buyer proof plus mandate

Agent submits a Buyer proof generated earlier plus an Agent authorization proof.

Pros:
- clear separation between eligibility and delegation

Cons:
- requires careful challenge/session binding

### Option D — Agent has delegated credential

Agent holds an identity credential or delegation credential linked to Buyer.

Pros:
- strong runtime autonomy

Cons:
- requires Concordium canonical delegation model

### Option E — Verifier service mediates proof

Agent calls a Concordium or merchant verifier service.

Pros:
- hides wallet/API complexity from Gateway

Cons:
- introduces service trust and availability model

PR #90 should document these options and mark Concordium alignment as required before implementation.

---

## 18. Delegated Authorization Envelope

A future delegated envelope may look like:

```json
{
  "type": "xcf.concordium.authorization.delegated-agent.v1",
  "challenge": { "...": "canonical challenge object" },
  "challengeHash": "<sha256>",
  "buyerProof": {
    "proofType": "concordium.VerifiablePresentation",
    "presentation": {}
  },
  "agentAuthorization": {
    "agentSubjectRef": "...",
    "agentAccountId": "...",
    "delegationId": "...",
    "delegationScopeHash": "...",
    "delegationExpiresAt": 1779291173,
    "agentSignature": "..."
  },
  "agentRegistryRef": null,
  "siwxSessionRef": null,
  "submittedAt": "2026-05-21T00:00:00.000Z"
}
```

Gateway must verify:

```text
Buyer proof valid
Buyer proof bound to challengeHash
Agent authorization valid
Agent authorization bound to challengeHash
Delegation scope covers merchant/resource/action/payment/terms
Delegation has not expired
Agent signature valid
Replay checks pass
```

---

## 19. Standards and Interoperability Alignment

The design should be Concordium-first without becoming Concordium-only.

### 19.1 x402 v2 compatibility

The binding contract must preserve x402 v2 semantics:

- 402 response remains payment-required challenge.
- Payment proof remains logically distinct from authorization proof.
- Gateway remains final release authority.
- Receipt/payment validation remains separate from policy verification.
- Future third-party facilitators should be able to understand policy/proof requirements.

### 19.2 CAIP-2 chain identifiers

Use CAIP-2-style chain identifiers where helpful for cross-chain interoperability.

Candidate dual representation, pending Concordium/x402 alignment:

```text
network: concordium:testnet
chain_id: ccd:<genesis-hash>
caip2ChainId: ccd:<genesis-hash>
```

Native fields remain necessary for Concordium SDK compatibility. The exact CAIP-2 representation for Concordium should be confirmed before treating it as canonical.

### 19.3 CAIP-10 account identifiers

For account identity, support both native Concordium account addresses and CAIP-10-style identifiers.

Example fields:

```text
buyerAccountAddress
buyerCaip10AccountId
agentAccountAddress
agentCaip10AccountId
```

Do not force CAIP-10 onto fields where Concordium SDK expects native formats.

### 19.4 CAIP-122 / SIWx hooks

The delegated-agent envelope should reserve fields for wallet/session authentication:

```text
walletAuthType
siwxSessionId
siwxProof
sessionExpiresAt
```

PR #90 does not implement CAIP-122 or SIWx. It only reserves a clean extension point.

### 19.5 ERC-8004 / Agent Registry hooks

The delegated model should support a future Agent Registry reference:

```text
agentRegistryRef
agentRegistryType
agentRegistryChainId
agentRegistryEntryHash
```

This could later map to:

- ERC-8004-compatible registry metadata
- Concordium-native registry metadata
- third-party agent trust registries
- hybrid representations

PR #90 should not choose the registry implementation.

### 19.6 Concordium wallet APIs

Current validated path uses Browser Wallet `requestVerifiablePresentation(...)`.

Open question:

```text
Should future Gateway integrations use current VerifiablePresentation, VerifiablePresentationV1, requestVerifiablePresentationV1, or a Concordium verifier-service abstraction?
```

PR #90 should preserve the validated current path while documenting the V1/verifier-service alignment question.

### 19.7 Linux Foundation x402 direction

The design should avoid private assumptions that would make XCF incompatible with broader x402 direction.

Recommended principle:

```text
Identity/compliance proof requirements should be expressible as x402-compatible authorization requirements without forcing every payment rail to be Concordium-settled.
```

This preserves the two strategic lanes:

1. Concordium as identity/compliance middleware for any x402 rail.
2. Full Concordium payment + proof + settlement flow.

---

## 20. Dynamic Business Terms and Contract Evolution

Current XCF contracts are mostly static:

```text
merchantId
resource method/path
network
asset
amount
payTo
policy
```

x402 v2 agentic commerce will require richer business terms:

- delivery conditions
- refund terms
- fulfillment conditions
- usage limits
- subscription/session scope
- spending limits
- jurisdictional requirements
- agent authority scope
- service-level terms
- conditional release rules

The binding contract must not assume that route + amount + asset are the complete business contract.

### 20.1 Terms hash model

Future dynamic terms should be represented with fields such as:

```text
termsId
termsVersion
termsHash
termsUri
termsSchema
termsIssuedAt
termsExpiresAt
```

Optional specialized hashes:

```text
fulfillmentPolicyHash
refundPolicyHash
delegationScopeHash
usageLimitHash
jurisdictionPolicyHash
```

### 20.2 Binding rule

The ZKP challenge should eventually bind to:

```text
static x402 tuple
+ policy requirements hash
+ businessTermsHash
+ optional delegationScopeHash
```

### 20.3 Phase 3 scope

For Phase 3 v1:

```text
Bind ZKP to current static x402 payment/policy tuple.
Reserve businessTerms fields for future x402 v2 expansion.
Do not implement dynamic terms enforcement yet.
```

This prevents a design dead end without overloading the current implementation.

---

## 21. x402 Transport Options

The proof can be transported in several ways:

1. Separate header.
2. Request body field.
3. PAYMENT-SIGNATURE extension.
4. PAYMENT-RESPONSE extension.
5. Separate authorizationProof object.
6. Verifier-service URL flow.

Recommended v1 direction:

```text
Keep payment proof and authorization proof logically separate, even if transported together.
```

Possible future header:

```text
X-CONCORDIUM-AUTHORIZATION-PROOF: <base64url-json>
```

Possible future body field:

```json
{
  "payment": {},
  "authorizationProof": {}
}
```

The Gateway should not treat payment proof as policy proof.

---

## 22. Concordium Alignment Questions

Before implementing delegated-agent enforcement, align with Concordium on:

1. What is the canonical delegated-agent model?
2. Is Buyer always the verified identity root?
3. Who generates the proof at runtime?
4. What delegation primitive should third-party x402 implementers build against?
5. Should Gateway verify current `VerifiablePresentation`, `VerifiablePresentationV1`, or call a verifier service?
6. What proof request JSON shape is canonical?
7. Which fields must be challenge-bound to prevent replay?
8. How should x402 carry identity proof?
9. Can Concordium ZKP be used independently from Concordium settlement?
10. What identifier formats should be canonical?
11. How should Agent Registry / ERC-8004 concepts map to Concordium?
12. What parts are production-ready versus roadmap?
13. What is the minimal viable delegated-agent flow Concordium wants partners to implement first?
14. How should non-compatible or legacy agents be onboarded or rejected?
15. What dynamic business terms model does Concordium expect for Verify & Pay?

---

## 23. Recommended PR Sequence After PR #90

Recommended sequence:

```text
PR #90 — docs: x402/ZKP binding contract + delegated agent model v1
PR #91 — implement pure challenge builder/hash utility
PR #92 — implement authorization proof envelope parser/validator
PR #93 — implement isolated direct Buyer verifier adapter
PR #94 — design/implement delegated-agent verifier skeleton or local harness
PR #95 — add Gateway-facing policy verification integration behind explicit guard
PR #96+ — evolve dynamic terms, delegation primitive, and x402 transport integration
```

Implementation should remain linear and low-risk.

---

## 24. Acceptance Criteria for PR #90

PR #90 is complete when it:

- Documents the validated direct Buyer proof path.
- Defines the x402/ZKP binding problem.
- Defines canonical challenge fields.
- Defines challenge hashing/canonicalization requirements.
- Defines direct Buyer authorization envelope.
- Defines Gateway verification rules.
- Defines replay protection requirements.
- Documents Delegated Agent Model v1 at design level.
- Separates Buyer eligibility, Agent authorization, payment settlement, and business terms.
- Includes standards/interoperability hooks.
- Includes dynamic business terms hooks.
- Lists Concordium alignment questions.
- Recommends the next implementation PR sequence.
- Does not introduce runtime code changes.
- Does not include raw proof material.

---

## 25. Bottom Line

PR #88 proved:

```text
We can verify a Concordium Buyer ZKP.
```

PR #90 should define:

```text
How a verified Concordium ZKP authorizes this exact x402 request, under this exact policy, for this exact payment tuple, and eventually through this exact delegated Agent relationship.
```

That is the difference between a successful ZKP proof demo and a production-credible x402 Gateway enforcement model.
