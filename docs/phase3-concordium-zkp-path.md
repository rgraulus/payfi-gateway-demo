# Phase 3 — Concordium ZKP Path for Agent-Driven x402 Conditional Access

## Status

Draft v0.1 — Phase 3A local proof-contract scaffolding.

This document defines the initial proof-contract direction for Phase 3. It is intentionally scoped to documentation and fixtures only. No Gateway runtime behavior, payment logic, CRP behavior, or release logic is changed in Phase 3A PR 1.

## Phase 2 Baseline

Phase 2 completed the Agent-Driven Conditional Gating Demo.

The Gateway now supports:

- `policyRequirements` in the `/paid-gated` x402 challenge.
- `authorizationProof` submitted to `/paid-gated/redeem`.
- A `policyVerifier.ts` verifier adapter seam.
- Verifier audit metadata surfaced in `/paid-gated/redeem`.
- Explicit gated authorization readiness before `/paid-gated` release.
- A hardened release invariant: payment proof alone cannot implicitly satisfy policy for `/paid-gated`.
- A prepared-agent full E2E demo proving policy authorization, Concordium PLT payment, CRP receipt, and final protected resource release.

Phase 3 starts from that working foundation.

## Phase 3 Objective

Phase 3 replaces the current demo-level `agent_attestation_v1` authorization proof with a Concordium-compatible ZKP proof path.

The primary target is the Delegated Model:

```text
Buyer = verified identity root / delegator
Agent = runtime proof generator / proof submitter / execution actor
Gateway = verifier + release authority
Concordium = identity, ZKP, and compliance trust layer
```

## Core Role Model

In the delegated model:

```text
Agent = runtime proof generator / proof submitter
Buyer = verified identity root / delegator
```

The Agent is the actor responding to the x402 challenge at runtime. However, the policy being proven may be about the Buyer, not the Agent.

For example, in an age-gated purchase:

```text
The Buyer is the person whose age/region eligibility matters.
The Agent is the software actor executing the transaction.
```

Therefore, the proof package must eventually establish both:

1. Buyer eligibility.
2. Agent authorization.

The Agent may generate or assemble the proof at runtime, but only because the Buyer previously delegated a safe, scoped proof capability or mandate to that Agent.

## Proof Facts Required for Delegated Release

A final delegated proof path should establish:

1. **Buyer eligibility** — The Buyer satisfies the policy, for example EU >= 18 or US >= 21.
2. **Delegation validity** — The Buyer authorized the Agent to act within a bounded scope.
3. **Agent authenticity** — The Agent proves it controls the key identified in the delegation.
4. **Request binding** — The proof is bound to the x402 nonce, merchant, resource, contract, amount, asset, payee, and expiration.
5. **Payment validity** — The authorization proof alone is not enough. `/paid-gated` release still requires a finalized payment proof.

## Phase 3A Scope

Phase 3A PR 1 defines local proof-contract scaffolding.

In scope:

- Documentation.
- Draft proof request fixture.
- Direct Buyer-wallet proof envelope placeholder.
- Delegated Agent proof envelope placeholder.

Out of scope:

- Real ZKP generation.
- Real ZKP verification.
- Gateway runtime changes.
- CRP changes.
- Payment changes.
- Release logic changes.
- Soliciting Concordium feedback.

Concordium feedback should come after Phase 3B establishes a direct Buyer-wallet proof baseline.

## Proof Types

### `concordium_zkp_v1`

Direct Buyer-wallet proof path.

In this model:

```text
Buyer wallet generates proof.
Gateway verifies proof.
No Agent delegation is involved yet.
```

This is the first real proof-generation baseline for Phase 3B.

### `concordium_delegated_zkp_v1`

Delegated Agent proof path.

In this model:

```text
Agent submits proof at runtime.
Buyer remains identity root.
Delegation links Buyer to Agent.
Agent signs nonce/request.
Gateway verifies the entire proof bundle.
```

This is the primary target for agent-driven conditional access, but it should be implemented after the direct Buyer-wallet proof path is understood.

## CAIP Identifier Strategy

Use CAIP-style identifiers where they represent chain or account identity.

Recommended:

```text
CAIP-2:
  chain_id = ccd:<genesisHash>

CAIP-10:
  subjectAccountId = ccd:<genesisHash>:<accountAddress>
  buyerAccountId = ccd:<genesisHash>:<buyerAccount>
  agentAccountId = ccd:<genesisHash>:<agentAccount>
```

Do not force CAIP identifiers onto fields that are not chain/account/session identity fields.

Good CAIP candidates:

- `chain_id`
- `subjectAccountId`
- `buyerAccountId`
- `agentAccountId`
- `issuerAccountId`
- `delegateeAccountId`

Not necessary for:

- `policyKind`
- `verifierType`
- `reasonCode`
- `proofRequestId`
- demo labels

## Draft `policyRequirements` Extension

Future Phase 3 `policyRequirements` may advertise a richer Concordium ZKP proof request.

```json
{
  "required": true,
  "policyVersion": "v1",
  "policyKind": "composite",
  "acceptedProofTypes": [
    "concordium_zkp_v1",
    "concordium_delegated_zkp_v1"
  ],
  "concordiumZkp": {
    "proofRequestId": "age_min_by_region_v1",
    "chain_id": "ccd:<genesisHash>",
    "rules": [
      {
        "kind": "age_min_by_region",
        "thresholds": {
          "EU": 18,
          "US": 21
        },
        "regionSource": "credential_or_policy_input",
        "defaultDecision": "deny"
      }
    ],
    "bindings": {
      "nonce": true,
      "merchantId": true,
      "resource": true,
      "contractId": true,
      "amount": true,
      "asset": true,
      "payTo": true,
      "expiresAt": true
    }
  }
}
```

## Phase 3 Roadmap

### Phase 3A — Proof Contract and Fixtures

Define the proof contract locally.

Deliverables:

- This document.
- Proof request fixture.
- Direct Buyer-wallet proof placeholder.
- Delegated Agent proof placeholder.

### Phase 3B — Direct Buyer Wallet Proof Path

Use the funded Buyer wallet to generate and validate a real proof baseline.

This proves the identity-root path. It is not yet delegation, but the Delegated Model depends on it.

### Phase 3C — `concordium_zkp_v1` Verifier Adapter

Extend the verifier adapter to accept real Concordium proof input.

Initial implementation may be fixture-level structural validation. Later implementation should perform real cryptographic verification.

### Phase 3D — Delegated Proof Bundle

Implement `concordium_delegated_zkp_v1`.

The verifier must validate:

- buyer eligibility proof;
- delegation validity;
- agent nonce signature;
- scope binding;
- challenge binding.

### Phase 3E — Clueless / Legacy Agent Handling

Enhance 402 responses for agents that cannot satisfy Concordium ZKP requirements.

Potential additions:

- onboarding pointer;
- verifier-service pointer;
- docs URL;
- fallback policy;
- unverified premium tier;
- deny mode.

## Summary

Phase 3 is guided by one central rule:

```text
The Agent acts at runtime.
The Buyer remains the verified identity root.
The Gateway verifies the chain of trust.
```
