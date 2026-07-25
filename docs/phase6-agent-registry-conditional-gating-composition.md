# Phase 6 Agent Registry Conditional Gating Composition

## Status

PR #303 controlled Gateway composition checkpoint.

- Runtime integration: implemented
- Production activation: disabled
- Database migration: not applied automatically
- Payment execution: unchanged
- Receipt issuance: unchanged
- Replay handling: unchanged
- Protected-resource release: unchanged
- Gateway remains the final authorization and release authority

## Purpose

PR #303 composes the Phase 6 Agent Registry trust work into the existing Phase 5 agent-delegated authorization lifecycle for the controlled `GET /paid-gated` flow.

The composition requires an acting agent to satisfy both:

1. the existing Phase 5 buyer-authorized delegation requirements; and
2. the Gateway-authored Phase 6 Agent Registry trust policy.

Agent Registry trust is evaluated after Phase 5 cryptographic, lifecycle, and revocation checks, but before buyer-policy evaluation and before any bounded-use claim is consumed.

The Agent Registry does not authorize payment, issue a receipt, mutate replay state, or release a protected resource. It contributes authenticated and policy-checked agent trust evidence to the Gateway’s authorization decision.

## Finite Phase 6 Position

PR #303 is the sixth rung in the finite Phase 6 implementation ladder:

1. PR #298 — Agent Registry trust contract
2. PR #299 — controlled Agent Registry resolver seam
3. PR #300 — Concordium CIS-8004 registry plugin
4. PR #301 — registry identity and acting-agent key binding
5. PR #302 — Agent Card integrity, capability, and freshness policy
6. PR #303 — Gateway conditional-gating composition
7. PR #304 — Demo3 and final Phase 6 acceptance

Phase 6 stops after PR #304. No additional implementation rung is implied by this document.

## Runtime Boundary

The Phase 6 composition is controlled by:

```text
PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_ENABLED=true
```

The feature is off by default.

Phase 6 conditional gating is active only when:

- `PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_ENABLED=true`; and
- the existing Phase 5 delegation lifecycle enforcement path is active.

Enabling Phase 6 does not bypass or weaken any Phase 5 requirement.

## Protected Route

The controlled integration applies to:

```text
POST /paid-gated/redeem
```

The request continues to carry the Phase 5 authorization proof and may additionally provide an Agent Registry reference:

```json
{
  "nonce": "<canonical challenge nonce>",
  "authorizationProof": {
    "...": "Phase 5 agent-delegated authorization envelope"
  },
  "agentRegistryReference": {
    "type": "xcf.agent-registry.reference",
    "version": "1.0.0",
    "registryStandard": "CIS-8004",
    "network": "ccd:testnet",
    "registryContract": {
      "index": "12802",
      "subindex": 0
    },
    "agentTokenId": "<canonical token identifier>",
    "tokenAddress": "<canonical registry token address>"
  }
}
```

The claimant supplies the registry identity pointer.

The claimant does not supply or control:

- the trusted registry allowlist;
- the pinned registry module;
- the required registry status;
- the required Agent Card capabilities;
- the evidence-age policy;
- the revalidation threshold;
- the owner-binding policy;
- the acting-key-binding policy; or
- the final authorization decision.

Those requirements remain Gateway-authored policy.

## Runtime Evaluation Order

The controlled runtime order is:

1. Phase 5 cryptographic preflight
2. Phase 5 delegation lifecycle validation
3. Phase 5 revocation check
4. Phase 6 Agent Registry resolution
5. Phase 6 registry identity and acting-key binding
6. Phase 6 Agent Card integrity, capability, and freshness evaluation
7. Phase 6 sanitized audit persistence
8. Buyer-policy evaluation
9. Atomic bounded-use claim
10. Payment eligibility

This ordering is security-critical.

A Phase 6 denial, revalidation requirement, resolver failure, binding failure, Agent Card failure, or audit-persistence failure stops processing before buyer-policy evaluation and before bounded-use consumption.

## Trusted Concordium Registry Policy

The controlled Gateway policy pins the Concordium Testnet CIS-8004 registry:

```text
Network:            ccd:testnet
Contract index:     12802
Contract subindex:  0
Module reference:   2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41
Required status:    Active
```

The composition requires:

- a trusted registry network;
- the exact trusted registry contract coordinate;
- the pinned module reference;
- a coherent active registry record;
- the expected Agent Token identity;
- owner-account binding;
- verified owner-identity assurance;
- acting-agent key binding;
- Agent Card integrity;
- exact required capabilities;
- acceptable finalized evidence freshness; and
- zero actual direct-chain indexer lag for payment eligibility.

A registry lookup result is not trusted merely because it was returned by a resolver. The normalized result must pass the Gateway’s contract, identity, snapshot, module, binding, capability, and freshness checks.

## Acting-Agent Key Binding

The composition binds the Phase 5 acting agent to the resolved registry identity.

The binding verifies that:

- the Phase 5 credential identity is preserved;
- the Phase 5 acting-agent identity matches the expected agent;
- the acting-agent key identity is preserved;
- the expected Agent Token ID matches the resolved registry token;
- the registry result comes from the trusted registry;
- identity and key evidence refer to the same finalized snapshot; and
- the accepted key fingerprint is derived deterministically.

The controlled Concordium path uses the Phase 6 CIS-8 acting-key-binding policy introduced by PR #301.

A registry identity cannot substitute a different acting agent or acting key.

## Agent Card Policy

The Gateway requires the following exact capabilities:

```text
x402.payment.authorize
resource.premium.read
```

The capability mappings are Gateway-authored:

- `x402.payment.authorize` must be declared through the supported x402 capability field.
- `resource.premium.read` must be declared as the exact OASF skill.

Capability matching is exact and case-sensitive.

The following do not satisfy the policy:

- case-substituted capability names;
- prefixed or suffixed capability names;
- endpoint names that merely resemble a capability;
- descriptive text;
- inferred capabilities;
- duplicate or contradictory declarations;
- unsupported capability mappings; or
- claimant-authored capability rules.

The Agent Card cannot author, relax, or override Gateway policy.

## Freshness and Revalidation

The Gateway-authored policy uses:

```text
Maximum evidence age:                 300 seconds
Revalidate-before-release threshold:  120 seconds
Required direct-chain indexer lag:    0 blocks
```

The composition evaluates evidence against the Gateway’s controlled clock.

Possible outcomes are:

- `allowed`
- `denied`
- `revalidation_required`

Evidence older than the revalidation threshold cannot proceed directly to buyer-policy evaluation.

Evidence beyond the hard maximum fails closed.

Future timestamps, calculated-age mismatches, missing lag data where required, positive direct-chain lag, and inconsistent finalized snapshots are rejected.

## Decision Semantics

### Allowed

An `allowed` result means that the Phase 6 registry, identity, acting-key, Agent Card, capability, and freshness requirements were satisfied.

It does not mean that:

- buyer policy has been satisfied;
- bounded use has been claimed;
- payment has been executed;
- settlement has completed;
- a receipt has been issued; or
- the protected resource has been released.

The allowed result produces only a normalized payment-eligibility handoff for subsequent Gateway-controlled processing.

### Denied

A `denied` result stops before buyer-policy evaluation and bounded-use consumption.

The controlled route returns an authorization denial without attempting payment or release.

### Revalidation Required

A `revalidation_required` result indicates that fresh Agent Registry evidence must be obtained before processing may continue.

No buyer-policy evaluation, bounded-use claim, payment attempt, receipt issuance, replay mutation, or resource release occurs.

## Payment-Eligibility Handoff

The positive handoff contains:

- the Phase 5-bound payment tuple;
- sanitized Agent Registry authorization evidence;
- the registry identity;
- owner-account and owner-identity assurance;
- finalized evidence metadata;
- acting-key-binding metadata;
- exact required and satisfied capabilities;
- Agent Card integrity facts;
- the Gateway decision time; and
- explicit safety indicators.

The payment tuple is derived exclusively from the accepted Phase 5 runtime context.

The Agent Registry reference or Agent Card cannot rewrite:

- resource method;
- resource path;
- contract ID;
- contract version;
- merchant ID;
- network;
- asset;
- amount;
- pay-to address; or
- nonce.

The PR #303 harness proves that the same normalized positive handoff can be consumed by mocked Concordium and alternate settlement adapters without either adapter executing payment.

## Sanitized Append-Only Audit

PR #303 introduces:

```text
public.phase6_agent_registry_authorization_audit
```

Migration:

```text
db/migrations/003_phase6_agent_registry_authorization_audit.sql
```

The migration is not applied automatically by the application or test harness.

The audit table is append-only.

Database triggers reject:

- `UPDATE`
- `DELETE`
- `TRUNCATE`

Multiple audit rows may exist for the same challenge and nonce because revalidation and repeated controlled authorization evaluations are distinct observations.

The audit record may include:

- challenge ID;
- nonce;
- merchant ID;
- decision;
- reason;
- registry network;
- registry contract;
- Agent Token ID;
- token address;
- finalized block height;
- finalized block hash;
- observation time;
- evidence age;
- indexer lag;
- expected Agent Card hash;
- actual Agent Card hash;
- Agent Card byte length;
- integrity result;
- required capability IDs;
- satisfied capability IDs;
- missing capability IDs;
- acting-key-binding type;
- acting-key fingerprint;
- owner account;
- owner-identity assurance;
- evidence hash;
- registry lookup indicators;
- CIS-8 lookup indicators; and
- Agent Card fetch indicators.

The audit layer must never persist:

- raw Agent Card bytes;
- raw Agent Card JSON;
- private keys;
- public-key material beyond the normalized fingerprint;
- buyer signatures;
- agent proof-of-possession signatures;
- raw delegation proofs;
- receipt JWS values;
- `PAYMENT-RESPONSE` values; or
- settlement secrets.

An audit-persistence failure fails closed before buyer-policy evaluation.

## Failure Handling

The composition fails closed for:

- missing or malformed registry references;
- untrusted registry networks;
- untrusted registry contracts;
- module-reference mismatches;
- resolver unavailability;
- resolver exceptions;
- malformed resolver output;
- missing registry identities;
- revoked agents;
- token substitution;
- Phase 5 identity mismatch;
- acting-key mismatch;
- CIS-8 lookup failure;
- inactive acting-key registration;
- Agent Card fetch failure;
- redirect responses;
- unsupported media types;
- invalid content length;
- oversized Agent Cards;
- malformed UTF-8;
- malformed JSON;
- unsupported Agent Card schemas;
- Agent Card hash mismatches;
- missing required capabilities;
- stale evidence;
- future evidence timestamps;
- finalized-snapshot mismatches;
- positive direct-chain indexer lag;
- audit-context failures; and
- audit-persistence failures.

No failure path consumes bounded use or changes payment, receipt, replay, settlement, or release state.

## HTTP Behavior

The controlled runtime uses the following high-level mapping:

- registry authorization denied: `403`
- fresh registry evidence required: `409`
- registry composition or audit persistence unavailable: `503`
- invalid Gateway-authored audit context: `500`

The response includes sanitized Phase 6 status and safety indicators when Phase 6 evaluation was attempted.

Raw Agent Card data, raw proofs, keys, receipt material, and payment-response material are not returned.

## Safety Invariants

PR #303 preserves these invariants:

```text
Gateway final release authority:     preserved
Phase 5 authorization requirements:  preserved
Buyer-policy authority:              preserved
Bounded-use atomicity:               preserved
CRP behavior:                        unchanged
Payment execution:                   not introduced
Receipt issuance:                    not introduced
Replay mutation:                     not introduced
Protected-resource release:          not introduced
Settlement-rail portability:         preserved
Production activation:               false
```

Phase 6 contributes authorization evidence. It does not become a payment processor or release authority.

## Controlled Test Harness

Harness:

```text
scripts/ci_phase6_agent_registry_conditional_gating_composition.ts
```

Intended package command:

```text
phase6:agent-registry-conditional-gating-composition-test
```

The harness proves:

```text
PR303_POSITIVE_COMPOSITION_ALLOWED=true
PR303_NEGATIVE_MATRIX_FAILS_CLOSED=true
PR303_APPEND_ONLY_SANITIZED_AUDIT_PERSISTED=true
PR303_PERSISTENCE_FAILURE_DENIES_BEFORE_POLICY=true
PR303_SETTLEMENT_ADAPTER_PORTABILITY=true
PR303_ZERO_CANONICAL_SIDE_EFFECTS=true
```

The negative matrix covers failures at the resolver, identity/key-binding, Agent Card, freshness/revalidation, and persistence boundaries.

The harness uses controlled fixtures and mocked transports. It does not execute payment or release a protected resource.

## Regression Validation

The integrated implementation was validated against:

- Phase 5 buyer-policy integration;
- Phase 5 runtime authorization composition;
- Phase 5 cryptographic runtime composition;
- Phase 5 delegation lifecycle enforcement;
- Phase 5 final acceptance;
- Phase 6 Agent Registry trust contract;
- Phase 6 resolver seam;
- Phase 6 Concordium CIS-8004 plugin;
- Phase 6 identity and acting-key binding;
- Phase 6 Agent Card capability and freshness policy; and
- Phase 6 conditional-gating composition.

The Phase 5 lifecycle harness completed all 16 cases with zero residual challenge, revocation, usage, or claim records.

## Compile-Only Trust-Contract Correction

Runtime integration caused the TypeScript compiler to load the previously merged Agent Registry trust-contract module as part of normal Gateway startup.

Three rejection helpers required explicit generic type arguments so that passing `null` would not cause TypeScript to infer the generic result type as `null`.

The correction is compile-only:

```text
buildValidationResult<AgentRegistryRequirementV1>(...)
buildValidationResult<AgentRegistryReferenceV1>(...)
buildValidationResult<AgentRegistryTrustResultV1>(...)
```

It does not change:

- validation decisions;
- reason codes;
- normalized values;
- runtime side effects;
- registry policy;
- payment behavior; or
- release behavior.

## Files

PR #303 contains the original seven-file implementation scope plus one explicitly authorized compile-only exception:

```text
src/phase6/agentRegistryConditionalGatingComposition.ts
src/db/phase6AgentRegistryAuthorizationAuditStore.ts
db/migrations/003_phase6_agent_registry_authorization_audit.sql
src/server.ts
scripts/ci_phase6_agent_registry_conditional_gating_composition.ts
docs/phase6-agent-registry-conditional-gating-composition.md
package.json
src/phase6/agentRegistryTrustContract.ts
```

`package-lock.json` must remain unchanged.

## Non-Goals

PR #303 does not:

- activate production release;
- execute a payment;
- invoke CRP fulfill;
- issue a receipt;
- emit `PAYMENT-RESPONSE`;
- mutate replay state;
- replace buyer policy;
- replace Phase 5 delegation verification;
- make the Agent Registry a release authority;
- make an Agent Card authoritative policy;
- introduce an orchestrator requirement;
- apply the database migration automatically; or
- complete the final Phase 6 Demo3 acceptance rung.

## Next Finite Step

The next and final Phase 6 rung is PR #304:

```text
Demo3 and final Phase 6 acceptance
```

PR #304 must validate the complete controlled Agent Registry-aware authorization flow while preserving the same Gateway authority, fail-closed behavior, sanitized evidence boundaries, and production-disabled posture.
