
# ProofPath — M0 Readiness & Conformance Report v1.0

**Project:** ProofPath — Every agent action. Proven.
**Product positioning:** Independent Accountability for Agent Commerce
**Milestone:** M0 — Technical Readiness and Conformance
**Assessment date:** October 31, 2026
**Hackathon start:** November 2, 2026
**Decision:** CONDITIONAL GO
**Status:** M0 investigation completed; identified implementation gates remain open

---

## 1. Executive Summary

ProofPath extends the existing Concordium-native x402 V2 XCF infrastructure with independently verifiable, portable, post-transaction accountability evidence.

Its purpose is to establish and preserve evidence concerning:

1. Registered agent identity and ownership.
2. Delegated or otherwise authenticated agent authority.
3. Exact commercial terms and transaction binding.
4. Finalized blockchain payment.
5. Seller-authenticated delivery.
6. Independent verification and dispute investigation.

ProofPath is not a replacement for the Gateway, Facilitator, Orchestrator, or Concordium payment infrastructure.

The existing Gateway remains responsible for transaction-time resource release decisions. ProofPath produces and verifies evidence after, or independently of, those decisions.

### M0 conclusion

Twelve investigation steps were completed against the established XCF source baselines and live Concordium Testnet.

The investigation confirmed:

- Existing XCF repository baselines are available and clean.
- A registered Demo4 buyer agent exists on Concordium Testnet.
- The agent is active and has a populated on-chain wallet assignment.
- The deployed Registry exposes native CIS-8004 wallet read and update entrypoints.
- Direct wallet and wallet-nonce read invocations succeed.
- Registry observations can be tied to a specific finalized block.
- The existing Gateway contains reusable Registry and identity-verification components.
- The established XCF payment engine can remain unchanged.

Three material requirements remain unresolved:

**TRUST-01:** The current deployed Registry module reference differs from the module references pinned by the existing Gateway and Demo4 configurations. The authority and provenance of the current deployment have not yet been established.

**SELLER-01:** A distinct registered seller agent, its receiving wallet, authorized service endpoint, and their binding to the actual x402 transaction have not yet been demonstrated.

**ID-01:** Existing ZKP verification supports buyer eligibility but does not yet establish verified-human identity assurance cryptographically bound to the registered agent owner's account.

### Decision

**CONDITIONAL GO for PP-01 and independent-verifier development.**

The outstanding requirements must remain explicit acceptance gates for any demonstration or claim that depends on them.

A conditional go does not constitute approval of an unrecognized Registry module, verified-human ownership, or independent seller authorization.

---

## 2. Assessment Scope

M0 evaluated the technical foundation required before implementing the four approved ProofPath packages:

| Package | Purpose |
|---|---|
| PP-01 | Versioned evidence schema, provenance, portable manifest, audit trail |
| PP-02 | Buyer/seller Registry identity, owner assurance, wallet and endpoint binding |
| PP-03 | Independent receipt, settlement, authorization, binding and delivery verification |
| PP-04 | Separate ProofPath application, viewer, real Testnet demonstration and acceptance |

M0 was limited to:

- Repository and source inspection.
- Existing contract and implementation discovery.
- Live read-only Concordium Testnet observations.
- Registry method capability inspection.
- Identity-assurance gap analysis.
- Conformance and risk classification.

M0 did not authorize:

- Source-code modifications to existing XCF components.
- Wallet signing.
- Blockchain state-changing transactions.
- PLT payments.
- Identity credential presentations.
- Trust-pin replacement.
- Production deployment or release.

No live payment or seller delivery was executed during M0.

---

## 3. Source Baselines

The following repository baselines were established during M0:

| Component | Repository | Baseline commit |
|---|---|---|
| Gateway | payfi-gateway-demo | dbc78721d30e2c5e40d75ac607f7be0ab500ccd3 |
| Facilitator / CRP | xcf-concordium-facilitator | 530b53c88eb7715beac3cb0afb1c8c277f5535b9 |
| Orchestrator | xcf-orchestrator | 49d3b100c36a2d465021a5ee0e0f21bc3062203e |

All three baseline repositories were observed on `main` and clean during the initial M0 assessment.

Subsequent Gateway inspections confirmed the expected Gateway commit and clean state.

The final terminal verification confirmed:

- Branch: `main`
- Remote tracking: `origin/main`
- Working directory: clean

These commits define the M0 inspected source baseline.

Any subsequent ProofPath implementation should preserve these boundaries unless a separately reviewed change is explicitly approved.

---

## 4. Live Concordium Testnet Evidence

### 4.1 Registered Demo4 agent

The established Demo4 buyer-agent reference is:

| Property | Value |
|---|---|
| Network | ccd:testnet |
| Registry standard | CIS-8004 |
| Registry contract | <12802,0> |
| Agent token ID | 287 |
| Token address | ccd:testnet/cis2:12802-0-287 |

The Registry was queried using the existing Concordium gRPC read transport.

### 4.2 Finalized blockchain observation

The successful live read returned:

| Property | Observed value |
|---|---|
| Finalized block height | 50185706 |
| Finalized block hash | 5b723a5fd202f40a5b8c6dd44c68668c04bcefce78807d5985af9e35c5d0dadb |
| Block timestamp | 2026-10-31T06:56:25.957Z |
| Finalized | true |
| Agent present | true |
| Agent status | Active |

### 4.3 Agent ownership and wallet

The registered owner account was:

`4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`

The `agent_wallet` returned by `agentOf` was the same account.

This establishes that the deployed Registry returned a populated wallet assignment for the existing Demo4 agent at the observed finalized state.

It does not establish:

- A separate seller-agent identity.
- A seller's authorization to receive an x402 payment.
- Verified-human identity assurance.
- A complete historical chain of ownership.
- The current module's inclusion in an approved trust policy.

### 4.4 Native Registry capabilities

A live contract instance inspection reported 21 exposed methods, including:

- `CIS-8004.agentOf`
- `CIS-8004.getAgentWallet`
- `CIS-8004.getAgentWalletNonce`
- `CIS-8004.setAgentWallet`
- `CIS-8004.upgrade`

The advertised methods establish interface availability, not conformance of every method's security behavior.

### 4.5 Direct wallet reads

The subsequent live read returned:

`getAgentWallet = Some(4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7)`

The `getAgentWalletNonce` invocation also succeeded.

Its decoded value was not printed because the inspection script attempted to serialize a JavaScript `BigInt` using ordinary `JSON.stringify()`.

Therefore:

- Direct wallet read: PASS.
- Direct nonce invocation: PASS.
- Nonce-value reporting: INCOMPLETE.
- Wallet authorization and nonce enforcement: NOT TESTED.

No additional nonce-read exercise is required merely to conclude M0.

---

## 5. Registry Module Trust Investigation

### 5.1 Observed module references

Three distinct module references were identified.

**Earlier Demo4 D4-2 reference:**

`33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833`

**Gateway default trusted reference:**

`4195e865dc2e4d0da10fc4b2315efedc068b932d050c60f2947dbb5c886f33ac`

**Observed live Testnet module reference:**

`142462ff638f53b7bbeae8911d23579ed23e5e3c7e9a0353606019628121a5c6`

The live reference matched neither source-pinned value.

### 5.2 Source investigation

The investigation found:

- The earlier Demo4 reference in D4-1C and D4-2 artifacts.
- The default reference in the Registry plug-in and final acceptance readiness configuration.
- No occurrence of the live module reference in the source and documentation paths searched.
- Registry-related Git history extending from July through August 2026.
- Explicit module-reference enforcement in the existing Registry trust plug-in.

The Gateway trust plug-in rejects a Registry result when the observed module reference differs from its configured trusted reference.

The rejection reason is:

`agent_registry_contract_mismatch`

Consequently, the successful direct Registry read must not be represented as successful end-to-end Gateway Registry trust verification.

### 5.3 Interpretation

The cause of the module discrepancy remains unknown.

A subsequent authorized upgrade is possible, but was not established by M0 evidence.

The contract's advertised `upgrade` method does not, by itself, prove that an authorized upgrade occurred.

### 5.4 TRUST-01 acceptance conditions

Before ProofPath treats the current module as an authoritative Registry trust anchor, it must establish:

1. Authenticated on-chain deployment and, where applicable, upgrade provenance.
2. The module associated with the relevant contract and finalized block.
3. The authority responsible for any module transition.
4. Compatibility of the required CIS-8004 record and wallet semantics.
5. A documented and reviewed trust policy.

The module must not be silently added to an allowlist merely because a direct read succeeded.

Historical verification must use the module and Registry state applicable to the transaction's historical context, with an appropriate authenticated historical trust policy.

**TRUST-01 status: OPEN — BLOCKING for production-equivalent trusted Registry claims.**

---

## 6. Seller-Agent Conformance — SELLER-01

### 6.1 Established capabilities

M0 confirmed that the deployed Registry supports:

- Registered agent records.
- Owner-account reporting.
- Populated agent wallet reporting.
- Native wallet query entrypoints.
- Finalized-block observations.

These provide the technical foundation for a native seller-payment binding.

### 6.2 Outstanding requirements

M0 did not yet establish a separately registered seller agent.

SELLER-01 must demonstrate the relationship among:

- Seller Registry contract and token ID.
- Seller agent status and owner.
- Seller agent's registered wallet.
- Seller's authenticated service endpoint.
- Actual x402 merchant `payTo`.
- Actual finalized PLT settlement recipient.
- Relevant Registry state at transaction time.

A matching string in two configuration files is insufficient.

The binding must be supported by authenticated Registry evidence, an appropriate endpoint-control mechanism, and transaction-specific evidence.

The Registry's Agent Card or metadata hash can support exact-content integrity, but does not alone prove service-endpoint control.

The seller endpoint must be authenticated independently, for example through a valid signature or other explicitly reviewed endpoint-authorization mechanism.

### 6.3 SELLER-01 acceptance conditions

SELLER-01 passes only when:

1. A distinct seller agent is established on Testnet.
2. Its Registry status and ownership are independently verified.
3. Its registered wallet is independently retrieved.
4. Its wallet matches the intended x402 `payTo`.
5. The finalized payment recipient matches the required transaction terms.
6. The seller service endpoint is authenticated.
7. A seller delivery receipt can be cryptographically attributed to an authorized seller identity or key.
8. Relevant historical and module-trust checks succeed.

**SELLER-01 status: PARTIAL — native prerequisites verified; complete seller binding open.**

---

## 7. Human Owner Identity Assurance — ID-01

### 7.1 Existing Phase 3 capability

The existing XCF Gateway includes:

- A live Concordium ZKP verifier adapter.
- A verifiable-presentation envelope.
- Challenge and wallet-challenge binding fields.
- Optional wallet account-address metadata.
- Model A buyer eligibility verification.
- Credential statement verification.
- Explicit account-binding status reporting.

This is reusable reference infrastructure.

### 7.2 Existing verified claim

The established Phase 3 verification model focuses on buyer eligibility.

Model A's successful eligibility evaluation requires:

- Verified proof.
- Verified challenge.
- Verified credential statements.

Its eligibility success condition does not independently require proof that the credential subject is the registered agent owner's account.

The account-binding status is reported separately.

### 7.3 Registry owner-assurance limitation

The Phase 6 trust contract defines:

- `not_evaluated`
- `verified`

The current Registry plug-in produces:

`ownerIdentityAssurance = not_evaluated`

The existence of a `verified` enum value does not mean that verified-human owner assurance has actually been established.

The Registry's owner-account field establishes an account relationship, not a verified real-world human identity.

### 7.4 Required ProofPath identity binding

A future ProofPath owner-assurance adapter must establish:

1. The agent's authenticated Registry ownership at the relevant time.
2. A verified presentation or other approved identity-assurance artifact.
3. An authenticated binding between the relevant account and the identity assurance.
4. A challenge and purpose binding that prevents unrelated proof reuse.
5. Evidence provenance, verifier policy, and applicable assurance limitations.
6. A privacy-preserving audit record without unnecessary disclosure of credential contents.

Any legal identity-identification or disclosure claim additionally requires an explicit issuer, trust, authorization, privacy, and legal disclosure model.

Identity verification, account control, and permission to disclose identity must not be conflated.

### 7.5 Permitted claim levels

**L1 — Account-backed ownership**

Supported where authenticated Registry ownership evidence is valid.

Permitted claim:

"The agent was registered to this Concordium account at the verified blockchain state."

**L2 — Verified-human owner assurance**

Not yet demonstrated.

Not permitted until account-bound identity evidence and the relevant trust policy are independently validated.

A production-grade or legally compelled identity-disclosure claim must not be inferred from a successful age or region proof.

**ID-01 status: OPEN — L1 supported; L2 not established.**

---

## 8. XCF Integration Boundary

ProofPath must preserve the established XCF system responsibilities.

### Gateway

- Issues and processes x402 V2 payment challenges.
- Enforces transaction-time gating.
- Determines resource release.
- Verifies the applicable transaction-time receipt and policy requirements.

### Facilitator / CRP

- Manages Concordium payment challenge and settlement evidence.
- Provides signed JWS receipts under the established proof profile.
- Supplies finalized payment evidence.

### Orchestrator

- Supports internal payment-proof and release-check orchestration.
- Does not replace the Gateway's release authority.

### Concordium Registry and acting-key infrastructure

- Supplies agent identity, ownership, wallet and key-related evidence under their respective standards and deployments.

### ProofPath

- Consumes independently verifiable evidence.
- Produces a versioned portable transaction manifest.
- Checks agent identity, authorization, terms, payment and delivery binding.
- Reports independent verification outcomes.
- Enables audit and dispute investigation.

ProofPath must not:

- Modify a prior Gateway release decision.
- Treat an Orchestrator advisory result as definitive payment settlement.
- Treat a valid JWS signature as proof of transaction binding.
- Treat a current Registry owner as necessarily the historical owner.
- Treat a delivered resource as necessarily accepted or satisfactory to the buyer.
- Claim human verification without validated owner-account identity assurance.

This separation is an architectural invariant.

---

## 9. Independent Verification Requirements

PP-03 must independently verify the existing `ccd-plt-proof@v1` receipt family.

Successful cryptographic signature verification is necessary but insufficient.

The verifier must check, as applicable:

- Trusted signer and key.
- Receipt format and cryptographic validity.
- Network and asset.
- Payment amount.
- Merchant and recipient.
- Transaction identity and commercial terms.
- Finalized blockchain settlement.
- Relevant challenge and expiration constraints.
- Delegated agent authority.
- Registry identity and historical status.
- Seller wallet and endpoint authorization.
- Seller delivery-attestation authenticity.
- Binding of delivery to the exact purchase.

The verifier must fail closed when required evidence is absent, inconsistent, stale, untrusted, or unrelated.

### Adversarial acceptance case

The approved ProofPath scenario includes two genuine payments:

- Transaction A: €5.
- Transaction B: €25.

Substituting Transaction A's valid signed receipt into Transaction B's commercial package must fail independent verification.

The reason must reflect a transaction-binding failure rather than incorrectly classifying the valid signature as invalid.

This is a mandatory PP-03 acceptance condition.

---

## 10. Portable Evidence and Audit Trail Requirements

PP-01 will establish a versioned evidence manifest including:

- Schema and version.
- Transaction identifier.
- Source-system provenance.
- Buyer and seller agent references.
- Relevant contract and module references.
- Commercial terms and binding information.
- Payment proof references.
- Finalized blockchain evidence.
- Delegation evidence references.
- Seller delivery evidence.
- Evidence timestamps and integrity commitments.
- Verification outcomes and structured failure reasons.

Public and restricted evidence must be separated.

Private keys, raw identity credentials and unnecessarily sensitive identity data must not be published in portable public packages.

The audit-trail profile is intended to support transaction-level traceability and Article 12-aligned recordkeeping concepts where relevant.

No claim of complete EU AI Act compliance is made.

The manifest must distinguish:

- An authenticated source observation.
- An independently validated assertion.
- A claim awaiting verification.
- A claim that failed verification.

A manifest must not promote unverified metadata into trusted evidence.

---

## 11. M0 Conformance Matrix

| ID | Requirement | M0 outcome |
|---|---|---|
| BASE-01 | Clean, identified XCF baselines | PASS |
| REG-01 | Live Testnet Registry reachable | PASS |
| REG-02 | Finalized Registry snapshot | PASS |
| REG-03 | Existing Demo4 agent active | PASS |
| REG-04 | Owner account and wallet populated | PASS |
| REG-05 | Native wallet methods advertised | PASS |
| REG-06 | Native wallet and nonce reads invoke successfully | PASS |
| TRUST-01 | Current module provenance and trust approval | OPEN |
| SELLER-01 | Complete registered seller, payee and endpoint binding | PARTIAL |
| ID-01 | Verified-human owner-account assurance | OPEN |
| PAY-01 | Existing finalized x402 payment infrastructure identified | BASELINE ESTABLISHED |
| VERIFY-01 | Standalone ProofPath verification demonstrated | NOT STARTED |
| EVID-01 | Portable manifest and audit trail implemented | NOT STARTED |
| DEMO-01 | End-to-end ProofPath Testnet demonstration | NOT STARTED |

A PASS indicates the specified M0 observation or test succeeded.

It does not imply that the entire ProofPath capability is implemented.

---

## 12. Implementation Entry Criteria

### PP-01 — Evidence Schema and Audit Trail

**GO**

May begin with:

- Versioned manifest.
- Evidence provenance taxonomy.
- Public/restricted evidence separation.
- Registry and payment proof reference definitions.
- Historical snapshot representation.
- Failure and negative-path events.
- Audit-trail export structure.

Unverified module or identity claims must remain explicitly untrusted.

### PP-02 — Agent Identity and Seller Binding

**CONDITIONAL GO**

May begin with interface and test design.

Must not declare SELLER-01 or L2 ID-01 complete without the required live and authenticated evidence.

### PP-03 — Independent Verifier

**GO for implementation; conditional acceptance**

May begin with deterministic receipt, terms, binding, finality and negative-path verification.

Must enforce the TRUST-01 gate when its result depends on the Registry.

Historical identity and module-state evidence must be evaluated against a documented policy.

### PP-04 — Application and Live Demo

**CONDITIONAL GO for preparation**

Viewer and demo scripting may proceed.

Final live acceptance requires:

- Actual finalized Testnet payment.
- Authenticated buyer and seller roles.
- Transaction-specific evidence.
- Seller delivery attestation.
- Independent verification.
- Explicit reporting of any unresolved L2 identity limitation.

No unsupported verified-human identity claim may appear in the final demo.

---

## 13. Risk Register

### R-01 — Unrecognized Registry module

**Severity:** High
**Related gate:** TRUST-01

Risk: The verifier accepts data from a deployed module whose authority or compatibility is not established.

Mitigation:

- Establish authenticated module provenance.
- Review required method semantics.
- Use a versioned module-trust policy.
- Bind historical claims to the appropriate finalized state.
- Fail closed for unknown modules.

### R-02 — False human-owner verification

**Severity:** High
**Related gate:** ID-01

Risk: Account ownership or buyer-eligibility ZKP is incorrectly presented as verified-human owner assurance.

Mitigation:

- Separate L1 from L2.
- Require authenticated account/credential binding.
- Define issuer and assurance policy.
- Preserve privacy and disclosure boundaries.
- Explicitly label unavailable assurance.

### R-03 — Seller impersonation or payee substitution

**Severity:** High
**Related gate:** SELLER-01

Risk: An apparently registered seller endpoint directs payment to an unrelated wallet.

Mitigation:

- Verify seller Registry identity.
- Verify registered wallet.
- Bind `payTo` to finalized settlement recipient.
- Authenticate endpoint control.
- Bind seller delivery attestations to the transaction.

### R-04 — Valid but unrelated receipt

**Severity:** High
**Related gate:** VERIFY-01

Risk: A cryptographically valid receipt is accepted for the wrong transaction.

Mitigation:

- Verify exact commercial terms and transaction linkage.
- Include explicit receipt-substitution negative tests.
- Fail closed on mismatches.

### R-05 — Current-state versus historical-state confusion

**Severity:** High
**Related gates:** TRUST-01, VERIFY-01

Risk: A subsequent ownership change or module upgrade incorrectly changes the interpretation of a historical purchase.

Mitigation:

- Record transaction-relevant finalized block identifiers.
- Retrieve or authenticate historical Registry state.
- Apply historical trust policy.
- Avoid using present-day ownership as historical proof.

### R-06 — Overclaiming delivery

**Severity:** Medium
**Related gate:** DEMO-01

Risk: Seller attestation is confused with buyer receipt, acceptance, quality or satisfaction.

Mitigation:

- Separate payment finality, seller-attested delivery, buyer receipt and buyer satisfaction claims.
- Report only what the available evidence supports.

---

## 14. Hackathon Execution Recommendation

Proceed with the four previously approved implementation packages.

Do not introduce a new infrastructure workstream or an open-ended sequence of Gateway PRs.

### Recommended sequence

**M1 — PP-01**

Complete the evidence schema, provenance model and independent audit-trail contract.

**M2 — PP-03**

Implement the standalone verifier, including finalized receipt validation and receipt-substitution rejection.

**M3 — PP-02**

Complete buyer/seller Registry binding, endpoint authentication, identity-assurance claim classification, and signed seller delivery evidence.

**M4 — PP-04**

Execute a real Concordium Testnet agent-to-agent commerce scenario and display independently verifiable results.

**M5 — Final hardening**

Complete acceptance testing, evidence packaging, documentation and submission readiness.

M5 is a milestone, not a fifth implementation package.

The three unresolved M0 gates must be resolved when their dependent acceptance tests require them. They should not block unrelated schema and verifier implementation.

---

## 15. M0 Exit Decision

### Investigation exit

**PASS**

The planned M0 discovery and technical readiness investigation is complete.

### Full conformance exit

**NOT YET PASSED**

TRUST-01, SELLER-01 and ID-01 remain subject to their defined acceptance conditions.

### Hackathon entry

**CONDITIONAL GO**

ProofPath may begin implementation on November 2, 2026.

The project has sufficient demonstrated foundations to proceed without modifying the validated XCF transaction engine.

### Prohibited claims until resolved

The project must not claim:

- The current Registry module is approved solely because it is deployed.
- A complete seller payment and endpoint binding has been demonstrated.
- An agent owner has verified-human assurance based only on account ownership.
- A successful buyer-eligibility ZKP proves the identity of the registered owner.
- A signed receipt proves the exact transaction without binding checks.
- Seller-attested delivery proves buyer receipt or satisfaction.
- The proposed evidence profile provides complete regulatory compliance.

---

## 16. Final Assessment

M0 has achieved its primary purpose.

ProofPath now has:

- A clean and identified XCF source baseline.
- Direct evidence of live Concordium Testnet Registry functionality.
- Confirmed native agent-wallet capabilities.
- A usable historical-snapshot foundation.
- An established ZKP verification approach to evaluate for reuse.
- Explicitly documented module-trust, seller-binding and human-assurance gaps.
- A tightly scoped implementation sequence.

The principal implementation opportunity is no longer basic infrastructure discovery.

It is to assemble independently verifiable agent-commerce evidence, reject inconsistent or substituted claims, and present the result in a portable format that third parties can evaluate without relying on the original Gateway's assertion alone.

**Final M0 decision: CONDITIONAL GO.**

**Approved next milestone: M1 / PP-01 — Evidence Schema, Provenance and Audit Trail.**

---

## Appendix A — M0 Investigation Record

| Step | Investigation | Outcome |
|---|---|---|
| 1 | Source baseline and evidence discovery | PASS |
| 2 | Registry and identity semantics | PASS |
| 3 | Existing Demo4 Registry reference | PASS |
| 4 | Registry read mechanism | PASS |
| 5 | Live query configuration | PASS |
| 6 | Reader interface and gRPC configuration | PASS |
| 7 | Live finalized Registry read | PASS; trust mismatch discovered |
| 8 | Module provenance source investigation | COMPLETED; mismatch unresolved |
| 9 | Deployed Registry method inspection | PASS |
| 10 | Direct wallet and nonce reads | PASS; nonce logging incomplete |
| 11 | Identity-assurance implementation discovery | PASS |
| 12 | Owner-account identity-binding assessment | COMPLETED; ID-01 unresolved |

All twelve steps were observational or read-only.

No wallet operation, chain transaction or payment was executed as part of M0.

The current report is a synthesis of inspection outputs and established project baselines. It is not itself a cryptographically signed evidence package.

---

## Appendix B — Normative and Implementation References

### Concordium standards

- CIS-8004 Agent Registry draft:
  https://proposals.concordium.com/CIS/cis-8004.html

- CIS-8 acting-key and identity-key specification:
  https://proposals.concordium.com/CIS/cis-8.html

These references define intended standard behavior. Actual Testnet deployment conformance must be established separately.

### Existing implementation references

Gateway:

- `src/phase6/concordiumCis8004RegistryPlugin.ts`
- `src/phase6/agentRegistryTrustContract.ts`
- `src/phase6/agentRegistryConditionalGatingComposition.ts`
- `src/phase6/agentRegistryIdentityKeyBinding.ts`
- `src/phase6/demo4RegisteredAgentAuthorizationPreflight.ts`
- `src/phase6/demo4FinalAcceptanceReadiness.ts`
- `src/phase3/liveZkpVerifierAdapter.ts`
- `src/phase3/modelAEligibility.ts`
- `docs/phase3b-buyer-wallet-proof-discovery.md`

Additional baselines:

- `xcf-concordium-facilitator`
- `xcf-orchestrator`

### Project control documents

- ProofPath — Hackathon Architecture & Implementation Scope v1.1
- ProofPath — Technical Implementation Plan v1.0

These remain the approved project scope and implementation baseline.

---

**End of M0 Readiness & Conformance Report v1.0**
