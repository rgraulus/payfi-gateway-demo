# Phase 5 Cryptographic Runtime Composition and Demo2

## Status

PR #296 implements the controlled cryptographic runtime composition for the Phase 5 agent-delegated x402 flow.

This PR composes the previously completed Phase 5 cryptographic building blocks into the Gateway runtime and demonstrates them through a controlled end-to-end Demo2 flow.

PR #296 is intentionally limited to cryptographic composition and controlled demonstration. It does not establish production trust, current authorization, revocation enforcement, bounded-use enforcement, Agent Registry integration, or production activation.

## Phase 5 ladder position

The finite Phase 5 implementation ladder is:

1. PR #287 — agent-delegated authorization envelope contract
2. PR #288 — structural agent delegation verifier seam
3. PR #289 — canonical challenge, scope, expiry, and payment-tuple binding
4. PR #290 — buyer policy evaluation integration
5. PR #291 — controlled pre-payment agent-driven Demo1 decision
6. PR #292 — controlled runtime authorization and Phase 4 settlement composition
7. PR #293 — buyer-to-agent delegation credential contract
8. PR #294 — buyer Ed25519 signature verification
9. PR #295 — agent proof-of-possession verification
10. PR #296 — controlled cryptographic runtime composition and Demo2
11. PR #297 — lifecycle, revocation, bounded-use, and final Phase 5 acceptance

Agent Registry integration remains deferred to Phase 6.

## Objective

PR #296 proves that the Gateway can safely compose:

* the canonical x402 challenge;
* the frozen resource and payment contract;
* the Phase 5 agent-delegated authorization envelope;
* the buyer-signed delegation credential;
* the buyer Ed25519 signature verifier;
* the buyer-authorized agent public key;
* the agent proof-of-possession verifier;
* the signed delegation-to-runtime binding verifier;
* buyer policy evaluation;
* canonical policy-state persistence;
* the existing Phase 4 settlement spine; and
* protected-resource release and replay protection.

The runtime must reject invalid cryptographic authorization before evaluating buyer policy or entering any payment or settlement operation.

## Controlled runtime modes

The Phase 5 runtime uses the following controls:

* PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED
* PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED
* PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH

The supported mode combinations are:

| Base runtime | Cryptographic runtime | Result                                                 |
| ------------ | --------------------- | ------------------------------------------------------ |
| Disabled     | Disabled              | Phase 5 agent runtime disabled                         |
| Enabled      | Disabled              | Demo1 structural controlled mode                       |
| Disabled     | Enabled               | Cryptographic flag is ineffective and must fail closed |
| Enabled      | Enabled               | Demo2 controlled cryptographic mode                    |

The cryptographic buyer verification key is loaded when the Gateway starts. The Gateway does not receive the buyer or agent private keys.

## Demo2 authorization envelope

The agent-delegated authorization envelope includes a cryptographic proof bundle under:

```
authorizationProof.cryptographicProofs
```

The bundle contains:

```
delegationCredential
```

and:

```
agentProofOfPossession
```

The delegation credential contains the buyer-signed delegated authority, including:

* buyer identity and buyer key identity;
* delegated agent identity and agent key identity;
* delegated agent public key;
* resource and contract scope;
* exact payment tuple;
* validity window;
* usage limit;
* replay audience;
* credential nonce;
* lifecycle metadata; and
* detached buyer signature proof.

The agent proof-of-possession document contains:

* delegation identity;
* delegation credential hash;
* agent identity;
* agent key identity;
* runtime audience;
* canonical challenge nonce;
* canonical challenge hash;
* challenge issued-at value;
* challenge expiry value; and
* detached agent signature proof.

## Required runtime verification order

The controlled cryptographic runtime follows this order:

1. Recover and validate the canonical challenge.
2. Resolve the frozen resource and payment contract.
3. Reconstruct the expected canonical challenge context.
4. Validate the outer agent-delegated authorization envelope.
5. Require the cryptographic proof bundle.
6. Validate the PR #293 buyer-to-agent credential contract.
7. Verify the PR #294 buyer Ed25519 signature.
8. Recover the buyer-authorized agent public key.
9. Verify the PR #295 agent proof-of-possession.
10. Bind the verified signed credential to the active runtime context.
11. Evaluate buyer policy.
12. Persist the canonical policy outcome.
13. Permit the existing settlement path only after cryptographic authorization and policy success.

Buyer policy must never be evaluated before the required cryptographic verification succeeds.

## Cryptographic binding requirements

After the buyer signature and agent proof-of-possession have been verified, the runtime binding verifier requires the signed delegation to match the active authorization request.

The composed binding includes:

* verified delegation document identity;
* outer delegation identity;
* buyer policy subject;
* delegated agent identity;
* frozen contract identity and version;
* resource method and path;
* merchant identity;
* network;
* asset type;
* token identifier;
* asset decimals;
* exact amount;
* payment destination;
* allowed action;
* maximum usage count;
* replay audience;
* canonical challenge window; and
* challenge-bound agent proof.

A mismatch is rejected before buyer policy evaluation.

## Static validity containment

PR #296 verifies that the signed credential validity window contains the complete canonical challenge window.

The following statement may therefore be true:

* credentialValidityCoversChallenge equals true

This is a static comparison between signed values and canonical challenge values.

PR #296 does not evaluate the credential against the current wall clock.

The following statement must remain false:

* validityEvaluatedAgainstClock equals false

Current-time enforcement belongs to PR #297.

## Four-path Demo2 matrix

Demo2 exercises four distinct paths.

| Path                              | Cryptographic result | Policy result | Payment and release              |
| --------------------------------- | -------------------- | ------------- | -------------------------------- |
| Invalid buyer signature           | Rejected             | Not evaluated | No payment and no release        |
| Invalid agent proof-of-possession | Rejected             | Not evaluated | No payment and no release        |
| Valid agent and ineligible buyer  | Accepted             | Denied        | No payment and no release        |
| Valid agent and eligible buyer    | Accepted             | Allowed       | Settlement and release permitted |

### Path 1 — invalid buyer signature

The script first generates a fully valid cryptographic authorization envelope for an otherwise eligible buyer.

It then:

1. copies the valid envelope to a separate file;
2. decodes the buyer Ed25519 signature;
3. changes exactly one signature bit;
4. re-encodes the signature as canonical base64url;
5. confirms that no other JSON field changed; and
6. submits the mutated envelope.

Expected result:

* HTTP status 403;
* reason buyer_signature_verification_failed;
* delegation contract validated;
* buyer signature not verified;
* agent public key not accepted as buyer-bound;
* agent proof-of-possession not accepted;
* cryptographic delegation verification false;
* buyer policy not evaluated;
* policy decision not_evaluated;
* no CRP payment;
* no payment transfer;
* no CRP fulfillment;
* no receipt;
* no PAYMENT-RESPONSE;
* no protected-resource release; and
* no production activation.

The test uses policy-eligible buyer evidence so the rejection is isolated to the invalid buyer signature.

### Path 2 — invalid agent proof-of-possession

The script first generates a fully valid cryptographic authorization envelope for an otherwise eligible buyer and valid delegated agent.

It then:

1. copies the valid envelope to a separate file;
2. decodes the agent Ed25519 signature;
3. changes exactly one signature bit;
4. re-encodes the signature as canonical base64url;
5. confirms that no other JSON field changed; and
6. submits the mutated envelope.

Expected result:

* HTTP status 403;
* reason agent_proof_verification_failed;
* delegation contract validated;
* buyer signature verified;
* agent public key bound by the buyer signature;
* agent proof-of-possession not verified;
* cryptographic delegation verification false;
* buyer policy not evaluated;
* policy decision not_evaluated;
* no CRP payment;
* no payment transfer;
* no CRP fulfillment;
* no receipt;
* no PAYMENT-RESPONSE;
* no protected-resource release; and
* no production activation.

The test uses policy-eligible buyer evidence so the rejection is isolated to the invalid agent proof.

### Path 3 — authenticated agent and ineligible buyer

The complete cryptographic chain succeeds:

* credential contract validated;
* buyer signature verified;
* delegated agent key bound by the buyer signature;
* agent proof-of-possession verified;
* signed runtime bindings matched; and
* cryptographic delegation verification accepted.

The buyer policy evidence is then evaluated.

The Demo2 ineligible-buyer case uses:

* region US;
* ageOver 18; and
* required minimum age 21.

Expected result:

* cryptographic authorization accepted;
* buyer policy evaluated;
* buyer policy denied;
* canonical state POLICY_FAILED;
* no CRP payment;
* no payment transfer;
* no CRP fulfillment;
* no receipt;
* no PAYMENT-RESPONSE;
* no protected-resource release; and
* no production activation.

This path proves that valid agent cryptography cannot substitute for buyer policy eligibility.

### Path 4 — authenticated agent and eligible buyer

The complete cryptographic chain succeeds and the buyer satisfies policy.

The Demo2 eligible-buyer case uses:

* region EU;
* ageOver 21; and
* required minimum age 18.

Expected authorization result:

* credential contract validated;
* buyer signature verified;
* delegated agent key bound by the buyer signature;
* agent proof-of-possession verified;
* signed runtime bindings matched;
* cryptographic delegation verification accepted;
* buyer policy evaluated;
* buyer policy allowed; and
* canonical state POLICY_SATISFIED.

In the full live Demo2 run, the existing Phase 4 settlement spine then performs:

1. CRP payment creation;
2. Concordium Testnet PLT transfer;
3. finalized transfer indexing;
4. CRP fulfillment;
5. receipt retrieval;
6. receipt-backed protected-resource redemption;
7. PAYMENT-RESPONSE emission;
8. canonical RELEASED persistence; and
9. replay rejection.

## Canonical failure semantics

A cryptographic rejection persists the canonical challenge as POLICY_FAILED even though buyer policy was not evaluated.

For a cryptographic rejection:

* policyStatus equals POLICY_FAILED;
* policyEvaluated equals false; and
* policyDecision equals not_evaluated.

POLICY_FAILED is the terminal canonical challenge state used for the failed authorization attempt. It does not claim that the buyer policy rules were evaluated.

The rejected challenge is not treated as retryable with a different proof.

## Trust boundary

PR #296 can establish mathematical verification and signed binding.

The following may be true:

* delegation contract validated;
* buyer signature verified;
* agent public key bound by buyer signature;
* agent proof-of-possession verified;
* verified delegation document matched;
* outer delegation identity bound;
* buyer policy subject bound;
* signed scope bound;
* signed payment tuple bound;
* credential validity covers challenge;
* signed usage value bound; and
* signed replay value bound.

The following must remain false:

* buyer verification key trust established;
* buyer identity authenticated;
* agent identity authenticated;
* current authorization established;
* validity evaluated against the current clock;
* revocation checked;
* bounded use consumed;
* Agent Registry lookup attempted; and
* production activation.

A mathematically valid signature proves that the holder of the corresponding private key signed the canonical bytes. PR #296 does not prove that the configured buyer public key belongs to a trusted or currently authorized real-world buyer.

## Lifecycle boundary

PR #296 carries and binds lifecycle-related values but does not enforce lifecycle state.

The signed credential includes:

* validity window;
* maximum usage count;
* revocation identifier;
* buyer key version; and
* agent key version.

PR #296 does not:

* compare validity against the current clock;
* consult a revocation source;
* consume a bounded-use counter;
* rotate or resolve key versions;
* mutate lifecycle state; or
* establish current authorization.

Those responsibilities are explicitly deferred to PR #297.

## Agent Registry boundary

No Agent Registry lookup is performed by PR #296.

The following value remains false in the controlled runtime and demo output:

* agentRegistryLookupAttempted

The delegated agent public key is accepted only as a key embedded in the buyer-signed delegation credential.

Registry-backed agent identity, reputation, discovery, key resolution, and registry lifecycle belong to Phase 6.

## Temporary key handling

Demo2 creates temporary Ed25519 key material for the controlled demonstration.

The key helper creates:

* a temporary buyer private key;
* a buyer public verification-key file;
* a temporary agent private key;
* an agent public key representation; and
* a key-bundle manifest.

Safety properties:

* private keys are temporary;
* private keys are never passed to the Gateway;
* private keys are never printed;
* private JWK material is rejected from generated authorization output;
* generated files are created exclusively;
* temporary material is removed by the demo cleanup handler;
* the Gateway receives only the buyer public verification-key path; and
* the buyer-authorized agent public key is carried inside the signed credential.

## Demo2 Gateway lifecycle

The Demo2 script manages a dedicated Gateway process.

It:

* refuses to start if its Gateway address is already reachable;
* generates the temporary key bundle before Gateway startup;
* starts the Gateway with both Phase 5 runtime flags enabled;
* supplies only the buyer public verification-key path;
* records the Gateway process identifier;
* terminates only the Gateway process that it started;
* removes temporary cryptographic material;
* removes generated work files; and
* leaves the external facilitator, worker, database, wallet-proxy, and Concordium infrastructure untouched.

## No-payment preflight

The Demo2 script supports a no-payment preflight through:

```
PHASE5_DEMO2_PREFLIGHT_ONLY=true
```

The preflight still performs:

* temporary key generation;
* dedicated Gateway startup;
* Gateway runtime health checks;
* valid cryptographic envelope construction;
* invalid buyer-signature rejection;
* invalid agent proof-of-possession rejection;
* valid cryptography plus buyer-policy denial;
* valid cryptography plus buyer-policy success;
* protected-resource non-release assertions for rejected paths; and
* cleanup verification.

The preflight stops after the positive authorization decision.

It does not perform:

* CRP payment creation;
* PLT transfer;
* CRP fulfillment;
* receipt retrieval;
* PAYMENT-RESPONSE emission;
* protected-resource release; or
* replay mutation.

Run the no-payment preflight with:

```
PHASE5_DEMO2_PREFLIGHT_ONLY=true npm run demo:x402-v2-agent-delegated-cryptographic-e2e
```

## Full live Demo2

The full controlled Demo2 run requires:

* facilitator health available at port 8080;
* wallet-proxy health available at port 3000;
* stream worker running before payment submission;
* PostgreSQL container xcf-pg available;
* funded Concordium Testnet buyer wallet;
* EUDemo PLT balance;
* CCD available for transaction fees; and
* port 3005 available for the dedicated Demo2 Gateway.

Run the full demo with:

```
npm run demo:x402-v2-agent-delegated-cryptographic-e2e
```

The full run executes the four-path authorization matrix and permits payment only for the final eligible-buyer path.

## Isolated composition test

The PR #296 isolated test exercises the cryptographic runtime binding verifier without Gateway, CRP, payment, receipt, release, registry, or production side effects.

Run it with:

```
npm run phase5:agent-cryptographic-runtime-composition-test
```

The accepted case requires an already verified cryptographic delegation and exact runtime bindings.

Negative cases cover:

* missing prerequisite cryptographic verification;
* malformed verified delegation document;
* verified-document mismatch;
* outer delegation identity mismatch;
* buyer policy-subject mismatch;
* agent identity mismatch;
* signed contract-scope mismatch;
* signed payment-tuple mismatch;
* signed validity mismatch;
* signed usage mismatch; and
* signed replay-audience mismatch.

## Validation evidence

PR #296 validation completed successfully.

### Isolated PR #296 harness

Result:

* 12 total cases;
* 1 accepted case;
* 11 rejected cases;
* no Gateway call;
* no CRP call;
* no payment attempt;
* no receipt output;
* no PAYMENT-RESPONSE output;
* no protected-resource release;
* no Agent Registry lookup; and
* no production activation.

### Four-path no-payment preflight

The expanded Demo2 preflight confirmed:

* invalid buyer signature rejected before policy;
* invalid agent proof rejected before policy;
* policy not evaluated for both cryptographic failures;
* valid agent plus ineligible buyer denied by policy;
* valid agent plus eligible buyer authorized;
* no CRP payment created;
* no PLT payment attempted;
* no receipt requested;
* no protected resource released;
* temporary keys removed;
* dedicated Gateway stopped; and
* facilitator remained healthy.

### Full live cryptographic Demo2

The controlled live Demo2 flow completed successfully on Concordium Testnet.

Observed settlement transaction:

```
236494e6530a1ed7e602b81b9b2b947c50a9e25c1f8c0c0fd0e8f9dc7ff0dd4f
```

Observed result:

* valid cryptography plus ineligible buyer rejected before payment;
* valid cryptography plus eligible buyer authorized;
* CRP payment created;
* EUDemo transfer finalized;
* transfer indexed;
* CRP fulfillment succeeded;
* receipt present but not printed;
* PAYMENT-RESPONSE present but not printed;
* protected resource released;
* replay blocked;
* negative canonical state POLICY_FAILED; and
* positive canonical state RELEASED.

Positive transition chain:

```
ISSUED
POLICY_SATISFIED
SETTLEMENT_REQUESTED
SETTLEMENT_PENDING
SETTLEMENT_CONFIRMED
RELEASED
```

### PR #287 through PR #295 regression ladder

All nine predecessor regressions passed:

* PR #287 — passed
* PR #288 — passed
* PR #289 — passed
* PR #290 — passed
* PR #291 — passed
* PR #292 — passed
* PR #293 — passed
* PR #294 — passed
* PR #295 — passed

### Existing Demo1 regression

The existing structural Demo1 end-to-end flow was rerun with the cryptographic runtime disabled.

Observed settlement transaction:

```
b693ae5dd9fc51394dd0ee93c7fac5e06d2a02d25b9b418af1d3600d7b1bf453
```

Observed result:

* structural Demo1 runtime remained available;
* ineligible buyer failed before payment;
* eligible buyer authorized;
* Testnet EUDemo transfer finalized;
* transfer indexed;
* CRP fulfillment succeeded;
* receipt present but not printed;
* PAYMENT-RESPONSE emitted but not printed;
* protected resource released;
* replay blocked; and
* the existing six-state positive transition chain remained intact.

This confirms that Demo2 did not regress Demo1.

## PR #296 file scope

PR #296 is limited to exactly nine files.

Modified files:

1. package.json
2. src/phase5/agentRuntimeAuthorization.ts
3. src/server.ts

New files:

4. src/phase5/agentCryptographicDelegationBindingVerifier.ts
5. scripts/ci_phase5_agent_cryptographic_runtime_composition.ts
6. scripts/demo_phase5_cryptographic_key_bundle.ts
7. scripts/demo_agent_delegated_cryptographic_authorization_proof.ts
8. scripts/demo_x402_v2_agent_delegated_cryptographic_e2e.sh
9. docs/phase5-cryptographic-runtime-composition-demo2.md

PR #296 does not modify:

* PR #293 credential-contract implementation;
* PR #294 buyer-signature verifier;
* PR #295 agent proof-of-possession verifier;
* existing Demo1 scripts;
* frozen x402 contracts;
* package-lock.json;
* facilitator code;
* database schema;
* wallet-proxy code; or
* Agent Registry code.

## Safety properties

PR #296 preserves these safety properties:

* cryptographic runtime is disabled by default;
* both Phase 5 runtime flags are required for Demo2;
* missing buyer verification key fails closed;
* invalid buyer signature fails closed;
* invalid agent proof fails closed;
* signed runtime mismatch fails closed;
* buyer policy runs only after cryptographic success;
* rejected authorization cannot enter payment;
* rejected authorization cannot enter CRP fulfillment;
* rejected authorization cannot receive a receipt;
* rejected authorization cannot emit PAYMENT-RESPONSE;
* rejected authorization cannot release the protected resource;
* no private key is printed;
* no raw receipt JWS is printed;
* no raw PAYMENT-RESPONSE is printed;
* no Agent Registry lookup occurs;
* no production activation occurs;
* package-lock.json remains unchanged; and
* existing Demo1 behavior remains available.

## Explicit non-goals

PR #296 does not provide:

* production buyer-key trust;
* buyer identity authentication;
* agent identity authentication;
* Agent Registry integration;
* current authorization resolution;
* wall-clock validity enforcement;
* revocation checking;
* bounded-use consumption;
* distributed replay-state consumption for the delegation credential;
* buyer or agent key rotation;
* production policy activation;
* production release activation;
* remote signer integration;
* hardware wallet integration;
* production key custody; or
* production operational hardening.

## Definition of done

PR #296 is complete when all of the following are true:

* the controlled cryptographic runtime is gated by explicit flags;
* the Gateway loads only the buyer public verification key;
* the buyer-signed credential is verified;
* the delegated agent public key is recovered from the verified credential;
* the agent proof-of-possession is verified;
* the signed credential is bound to the active canonical runtime context;
* invalid buyer signatures fail before policy;
* invalid agent proofs fail before policy;
* valid cryptography plus ineligible buyer fails before payment;
* valid cryptography plus eligible buyer can enter the existing settlement spine;
* the no-payment four-path preflight passes;
* the isolated PR #296 harness passes;
* the full controlled Demo2 path passes;
* PRs #287 through #295 remain green;
* the existing Demo1 live E2E remains green;
* temporary private keys are removed;
* no raw secret-bearing response values are printed;
* Agent Registry lookup remains disabled;
* lifecycle enforcement remains deferred;
* production activation remains false;
* package-lock.json remains unchanged; and
* the PR remains within the exact nine-file scope.

## Handoff to PR #297

PR #297 is the final Phase 5 lifecycle and acceptance rung.

It should address the capabilities deliberately excluded from PR #296:

* evaluation against the current clock;
* revocation checking;
* bounded-use consumption;
* lifecycle state mutation;
* challenge and credential use-state coordination;
* key-version and lifecycle handling;
* final Phase 5 acceptance criteria; and
* final confirmation that production activation remains a separate explicit decision.

PR #297 must preserve the PR #296 cryptographic ordering:

1. verify the buyer-signed delegation;
2. verify agent proof-of-possession;
3. bind the signed delegation to the canonical runtime;
4. enforce lifecycle and current authorization;
5. evaluate buyer policy;
6. persist the decision;
7. permit settlement only after all required checks succeed.

Agent Registry integration must remain a separate Phase 6 concern.
