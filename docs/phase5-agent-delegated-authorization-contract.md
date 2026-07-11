# Phase 5 — Agent-Delegated x402 v2 Authorization Contract

## 1. Purpose

Phase 5 extends the completed Phase 4 Direct Buyer x402 v2 demo into an Agent-driven implementation.

Phase 4 proved the Direct Buyer path end-to-end:

* Direct Buyer proof is bound to a Gateway-issued challenge.
* Negative buyer path fails before payment.
* Positive buyer path satisfies policy.
* Real Concordium testnet PLT payment is submitted.
* CRP stream/index path observes the transfer.
* CRP fulfill generates a real receipt JWS.
* Gateway verifies the receipt.
* PAYMENT-RESPONSE is emitted.
* Protected resource is released.
* Replay is blocked.

Phase 5 keeps that settlement/release spine and changes the authorization actor model.

The Direct Buyer path asks:

Can the buyer prove policy eligibility directly?

The Agent-driven path asks:

Can an agent prove it is authorized to act for a buyer who satisfies the policy, for this exact x402 challenge, merchant, resource, contract, payment tuple, scope, and time window?

## 2. Phase 5 Re-Baseline

The revised roadmap is:

Phase 3 -> Phase 4 -> Phase 5 -> Phase 6

Phase 3 established the Direct Buyer ZKP foundation.

Phase 4 composed that foundation with the real settlement and receipt-release path.

Phase 5 starts from the completed Phase 4 demo spine and introduces agent-delegated authorization.

Phase 6 should add the Concordium Agent Registry after the Agent-driven implementation exists.

This means Phase 5 should not reopen the completed settlement path. It should reuse the Phase 4 spine:

* CRP payment create
* real Concordium testnet PLT transfer
* stream/index observation
* CRP fulfill
* real receipt JWS
* Gateway verification
* PAYMENT-RESPONSE
* protected resource release
* replay block

The Phase 5 objective is to preserve the same end-to-end demo result while changing the authorization actor from a Direct Buyer proof flow to an Agent-delegated proof flow.

## 3. x402 v2 Alignment

Phase 5 must remain compatible with the x402 v2 transport and settlement model.

The agent-delegated authorization envelope is an XCF / Concordium-specific authorization extension. It must not fork the x402 v2 payment flow.

The following boundaries must remain intact:

* The resource server / Gateway issues the payment challenge.
* The Gateway remains the policy and release control point.
* PAYMENT-REQUIRED remains the challenge carrier.
* PAYMENT-SIGNATURE remains the payment payload carrier.
* PAYMENT-RESPONSE remains the successful settlement/release response.
* The Facilitator / CRP remains the settlement and receipt issuer.
* Agent-delegated authorization is an extension around policy authorization, not a replacement for x402 settlement.

Phase 5 should align with the x402 v2 extension model:

x402 core transport + XCF Concordium authorization extension

The extension must be:

* explicit
* typed
* challenge-bound
* merchant-bound
* resource-bound
* contract-bound
* payment-tuple-bound
* scoped
* expiring
* replay-safe

The Agent-driven model must preserve the same core x402 flow:

1. Client or agent requests protected resource.
2. Gateway returns 402 plus PAYMENT-REQUIRED.
3. Client or agent prepares authorization and payment material.
4. Facilitator / CRP verifies or settles payment.
5. Gateway emits PAYMENT-RESPONSE only after release is authorized.

## 4. Relationship to the Phase 4 Demo

Phase 4 delivered the one-command Direct Buyer x402 v2 E2E demo.

The Phase 4 final result is:

Final result: x402 v2 Direct Buyer E2E demo complete
Negative buyer path: failed before payment
Positive buyer path: released engineering protected resource
Replay: blocked

Phase 5 should keep this final demonstration pattern.

The target Phase 5 result should eventually become:

Final result: x402 v2 Agent-Delegated E2E demo complete
Negative agent path: failed before payment
Positive agent path: released engineering protected resource
Replay: blocked

PR #287 does not build that full demo yet. It defines the authorization contract that later PRs will implement.

## 5. PR #287 Boundary

PR #287 only defines the metadata contract and validates fixtures.

PR #287 does not:

* change Gateway release behavior
* call Gateway
* call CRP
* create CRP payments
* submit Concordium PLT transfers
* fulfill receipts
* generate receipt JWS
* emit PAYMENT-RESPONSE
* release protected resources
* enable production activation
* add the Concordium Agent Registry
* implement autonomous agent behavior
* implement multi-agent marketplace logic

The purpose of PR #287 is to make the Phase 5 contract explicit before runtime behavior changes.

## 6. Agent-Delegated Authorization Envelope

Phase 5 introduces:

xcf.concordium.authorization.agent-delegated.v1

This envelope is the Agent-driven counterpart to the Phase 4 Direct Buyer authorization proof.

The envelope must prove two things:

1. The buyer satisfies the policy.
2. The agent is authorized to act for that buyer in this exact x402 context.

Both must be true.

If either condition fails, the Gateway must deny before payment and release.

## 7. Required Top-Level Fields

A valid agentAuthorizationProof.v1 envelope must include:

* authorizationProofType
* agent
* buyer
* delegation
* scope
* policyEvidence
* challenge
* replay
* safety

Each top-level field exists to preserve a specific safety boundary.

| Field                  | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| authorizationProofType | Explicitly identifies the envelope version.                                     |
| agent                  | Identifies the actor presenting the proof.                                      |
| buyer                  | Identifies or commits to the buyer on whose behalf the agent acts.              |
| delegation             | Represents buyer authority granted to the agent.                                |
| scope                  | Limits where the delegation can be used.                                        |
| policyEvidence         | Represents the buyer eligibility proof.                                         |
| challenge              | Binds authorization to the live x402 challenge.                                 |
| replay                 | Defines the replay key dimensions.                                              |
| safety                 | Confirms the metadata-only harness does not call runtime payment/release paths. |

## 8. Agent Identity

The envelope must explicitly identify the agent.

Required fields:

* agent.agentId
* agent.agentKind

Optional future-compatible fields:

* agent.agentAccount
* agent.agentPublicKey
* agent.agentDid
* agent.serviceIdentity

The Gateway must never infer the agent from transport state alone.

The agent identity must be explicit because later PRs will need to answer:

Is this specific agent allowed to act for this specific buyer in this specific x402 context?

## 9. Buyer Binding

The envelope must explicitly represent the buyer or buyer commitment.

Required fields:

* buyer.buyerCommitment
* buyer.policySubject

Optional future-compatible fields:

* buyer.buyerAccount
* buyer.walletProofSubject

The buyer binding must support Concordium wallet proof / ZKP policy evidence without requiring raw personal data disclosure.

The goal is not to expose the buyer’s full identity. The goal is to bind the agent authorization to the policy subject that satisfies the Seller/Merchant’s requirements.

## 10. Delegation

The envelope must prove that the buyer delegated authority to the agent.

Required fields:

* delegation.delegationId
* delegation.delegationType
* delegation.delegationIssuedAt
* delegation.delegationExpiresAt
* delegation.delegationProofPresent
* delegation.delegationProofPrinted

The delegation must be bindable to:

* the agent
* the buyer or buyer commitment
* the merchant
* the resource
* the contract
* the payment tuple
* the challenge
* the allowed action
* the expiry window

PR #287 uses fixture metadata only.

Later PRs may replace fixture delegation with one or more of:

* signed buyer consent
* wallet-issued delegation token
* verifiable credential
* scoped capability
* account-bound permission
* registry-backed authority

The key requirement is that delegation must not be open-ended.

## 11. Scope

Agent authority must be scoped.

Required scope fields:

* scope.merchantId
* scope.resource.method
* scope.resource.path
* scope.contractId
* scope.contractVersion
* scope.network
* scope.asset.type
* scope.asset.tokenId
* scope.asset.decimals
* scope.amount
* scope.payTo
* scope.allowedAction
* scope.maxUses

A valid agent-delegated proof for one merchant must not be reusable for another merchant.

A valid agent-delegated proof for one resource must not be reusable for another resource.

A valid agent-delegated proof for one payment tuple must not be reusable for another payment tuple.

A valid agent-delegated proof for one challenge must not be reusable for another challenge.

The Phase 5 scope model should bind the agent to the same x402 payment tuple already proven in Phase 4:

* merchantId
* resource method/path
* contractId
* contractVersion
* network
* asset
* amount
* payTo
* nonce
* challengeHash

## 12. Policy Evidence

The policy evidence proves the buyer satisfies the Seller/Merchant policy.

Required fields:

* policyEvidence.proofType
* policyEvidence.claims
* policyEvidence.rawProofPrinted

For the Phase 5 demo baseline, the claims mirror the Direct Buyer policy model:

* region
* ageOver

The policy evidence is obtained from the buyer wallet proof model and must remain privacy-preserving.

Raw proof material must not be printed by fixtures, harnesses, or demo output.

A valid agent is not enough. The buyer must still satisfy the policy.

This means the Gateway must eventually enforce:

* authorized agent plus eligible buyer -> policy satisfied
* authorized agent plus ineligible buyer -> blocked
* unauthorized agent plus eligible buyer -> blocked

## 13. Challenge Binding

The envelope must be bound to the live Gateway-issued challenge.

Required fields:

* challenge.nonce
* challenge.challengeHash
* challenge.issuedAt
* challenge.expiresAt

The challengeHash binds the authorization proof to the x402 PAYMENT-REQUIRED challenge.

An agent-delegated authorization proof must not be reusable across challenges.

The challenge binding prevents an agent from taking valid proof material from one payment/resource context and replaying it into another.

## 14. Expiry

Phase 5 must represent two expiry windows:

* delegation.delegationExpiresAt
* challenge.expiresAt

Both matter.

Delegation expiry answers:

Is the agent still authorized by the buyer?

Challenge expiry answers:

Is this Gateway-issued x402 challenge still valid?

The Gateway must eventually reject stale delegation and stale challenge material.

PR #287 only requires these fields to exist and be validated in fixtures.

## 15. Replay Protection

Replay protection must include agent and delegation dimensions.

Required fields:

* replay.replayKeyVersion
* replay.replayKeyFields

The replay key fields must include at least:

* agent.agentId
* buyer.buyerCommitment
* delegation.delegationId
* scope.merchantId
* scope.resource.method
* scope.resource.path
* scope.contractId
* scope.contractVersion
* scope.network
* scope.asset.tokenId
* scope.amount
* scope.payTo
* challenge.nonce
* challenge.challengeHash

This prevents valid delegated proof material from being reused across:

* agents
* buyers
* delegations
* merchants
* resources
* contracts
* payment tuples
* challenges

Replay protection becomes more important in the Agent-driven model because the proof-bearing actor is no longer necessarily the buyer directly.

## 16. Safety Fields

Required fields:

* safety.gatewayCalled
* safety.crpCalled
* safety.paymentAttempted
* safety.receiptJwsPrinted
* safety.paymentResponsePrinted
* safety.productionActivation

For PR #287 fixtures and harnesses, all of these must remain safe:

* gatewayCalled: false
* crpCalled: false
* paymentAttempted: false
* receiptJwsPrinted: false
* paymentResponsePrinted: false
* productionActivation: false

If any of these fields is true in PR #287 fixtures, the harness must fail.

PR #287 is metadata-only. It must not touch runtime payment or release.

## 17. Positive Path Target

Phase 5 must eventually prove:

authorized agent
plus eligible buyer
plus valid delegation
plus correct scope
plus live challenge binding
plus valid payment/receipt
equals protected resource released

The eventual positive path should be:

1. GET /paid-gated.
2. Gateway returns PAYMENT-REQUIRED plus policyRequirements plus challenge.
3. Agent obtains or holds delegated buyer authority.
4. Agent submits agentAuthorizationProof to /paid-gated/redeem.
5. Gateway verifies agent identity.
6. Gateway verifies buyer delegation.
7. Gateway verifies buyer policy proof.
8. Gateway verifies challenge binding.
9. Gateway verifies resource binding.
10. Gateway verifies merchant binding.
11. Gateway verifies payment tuple binding.
12. Gateway verifies expiry.
13. Gateway verifies replay safety.
14. Gateway records POLICY_SATISFIED.
15. Payment/receipt condition is satisfied through the Phase 4 settlement spine.
16. Gateway emits PAYMENT-RESPONSE.
17. Gateway returns the protected resource.

## 18. Negative Path Targets

Phase 5 must include negative-path coverage from the start.

Important failure cases:

* missing agent identity -> blocked
* agent identity mismatch -> blocked
* missing delegation -> blocked
* expired delegation -> blocked
* delegation not scoped to merchant -> blocked
* delegation not scoped to resource -> blocked
* delegation not scoped to payment tuple -> blocked
* wrong nonce/challengeHash -> blocked
* buyer policy proof invalid -> blocked
* buyer policy proof valid but policy not satisfied -> blocked
* authorized agent plus ineligible buyer -> blocked
* unauthorized agent plus eligible buyer -> blocked
* proof replay attempted -> blocked
* delegation replay attempted -> blocked
* resource substitution attempted -> blocked
* merchant substitution attempted -> blocked
* payment amount substitution attempted -> blocked
* raw proof leakage attempted -> blocked

PR #287 validates a small subset of these at metadata-fixture level only:

* valid fixture accepted
* missing agent rejected
* wrong scope rejected
* unsafe side-effect flags rejected

## 19. Gateway Role

The Gateway remains the release authority.

The Gateway should not simply trust that an agent says it is authorized. It must verify the authorization envelope.

The Gateway’s eventual Phase 5 responsibility becomes:

1. Issue x402 challenge and policyRequirements.
2. Accept agentAuthorizationProof.
3. Verify proof envelope shape.
4. Verify challenge binding.
5. Verify buyer policy proof.
6. Verify agent identity.
7. Verify delegation or consent.
8. Verify delegation scope.
9. Verify delegation expiry.
10. Verify resource/payment tuple binding.
11. Evaluate policy.
12. Persist POLICY_SATISFIED or failure state.
13. Block release unless policy, delegation, and payment conditions are satisfied.

This preserves the Gateway as the control point while allowing agents to participate safely.

## 20. What PR #287 Reuses

PR #287 reuses the completed Phase 4 baseline conceptually:

* /paid-gated challenge issuance
* policyRequirements structure
* challengeHash binding
* authorizationProof envelope model
* policy verifier seam
* POLICY_SATISFIED / POLICY_FAILED persistence model
* positive/negative harness pattern
* runtime release guard
* PAYMENT-RESPONSE checks
* replay rejection checks
* raw proof/receipt leakage checks
* one-command demo target

The goal is not to rebuild the system.

The goal is to define the Agent-driven authorization model that later PRs will implement.

## 21. PR #287 Fixtures

PR #287 should add these fixtures:

* fixtures/phase5/agent-delegated-authorization.valid.example.json
* fixtures/phase5/agent-delegated-authorization.invalid-missing-agent.example.json
* fixtures/phase5/agent-delegated-authorization.invalid-wrong-scope.example.json

The valid fixture should demonstrate the expected agentAuthorizationProof.v1 shape.

The invalid missing-agent fixture should prove the harness rejects envelopes without explicit agent identity.

The invalid wrong-scope fixture should prove the harness rejects envelopes not scoped to the Phase 4 /paid-gated payment context.

## 22. PR #287 Metadata-Only Harness

PR #287 should add:

scripts/ci_phase5_agent_delegated_authorization_contract.ts

The harness should:

* load the valid fixture
* assert all required top-level fields exist
* assert the envelope type is xcf.concordium.authorization.agent-delegated.v1
* assert agent identity exists
* assert buyer binding exists
* assert delegation exists and is not expired relative to fixture challenge time
* assert scope matches the Phase 4 demo contract baseline
* assert policy evidence exists
* assert challenge binding fields exist
* assert replay key fields include agent, buyer, delegation, scope, and challenge dimensions
* assert safety flags are false
* load invalid fixtures
* assert missing-agent fixture fails
* assert wrong-scope fixture fails
* print a safe summary only

The harness must not:

* call Gateway
* call CRP
* create payment records
* submit PLT transfers
* fulfill receipts
* generate receipt JWS
* emit PAYMENT-RESPONSE
* release protected resources
* enable production activation

## 23. PR #287 Definition of Done

PR #287 is complete when:

1. This Phase 5 contract document exists.
2. A valid fixture demonstrates the expected agentAuthorizationProof.v1 shape.
3. Invalid fixtures demonstrate missing-agent and wrong-scope failures.
4. A metadata-only CI harness validates the fixture shape.
5. The harness rejects invalid fixtures.
6. The harness confirms no Gateway call, CRP call, payment attempt, receipt JWS print, PAYMENT-RESPONSE print, or production activation.
7. No runtime release behavior changes.
8. No Phase 4 settlement/demo behavior changes.
9. No Concordium Agent Registry behavior is introduced.
10. The package script exists for running the metadata-only harness.

## 24. Finite Phase 5 PR Ladder

Suggested next PRs after #287:

* #287 — Agent-delegated authorization contract, fixtures, metadata-only harness
* #288 — Agent delegation verifier seam, test-only, no release change
* #289 — Agent challenge/scope/expiry binding checks
* #290 — Agent policy evaluation integration
* #291 — Agent-driven controlled demo harness
* #292 — Agent-driven x402 v2 E2E demo composition using Phase 4 settlement spine
* #293 — Phase 5 docs/runbook/checkpoint

Phase 6 should add the Concordium Agent Registry after the agent-driven path exists.

## 25. Strategic Framing

Phase 3 established the Direct Buyer ZKP foundation.

Phase 4 completed the Direct Buyer settlement/release demo composition.

Phase 5 extends that foundation into delegated, Agent-driven authorization.

This is strategically important because it moves the architecture from:

buyer proves eligibility directly

to:

authorized agents can safely act for eligible buyers

without weakening the Gateway’s control over policy, payment, replay, and release.

The Gateway remains the trust boundary and release authority.

The agent becomes an authorized presenter of proof, not an uncontrolled bypass around policy or payment enforcement.

## 26. PR #287 Summary

PR #287 starts Phase 5 by defining the agent-delegated authorization contract that will later replace the Direct Buyer authorization envelope in the Phase 4 one-command demo spine.

The PR does not implement runtime release.

It does not call CRP, submit payment, fulfill receipts, or touch production activation.

It defines the Phase 5 agentAuthorizationProof.v1 envelope, its x402 v2 compatibility requirements, its Concordium wallet/ZKP policy-evidence role, its delegation/scope/expiry/replay requirements, and the positive/negative cases that subsequent Phase 5 PRs must implement.

This keeps Phase 5 finite:

1. first define the contract
2. then add verifier seam
3. then add binding checks
4. then add policy integration
5. then compose the agent-driven demo
