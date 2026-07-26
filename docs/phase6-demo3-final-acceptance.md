# Phase 6 Demo3 Final Acceptance

## PR #304 — Controlled Agent Registry Composition and Phase 6 Closure

**Branch:** `feat/phase6-demo3-final-acceptance-v1`
**Primary repository:** `payfi-gateway-demo`
**Status:** Controlled six-path final acceptance complete; no-payment preflight complete; controlled live-settlement execution passed
**Production activation:** Disabled
**Release-path change:** None
**Package lock:** Frozen and unchanged

---

## 1. Purpose

PR #304 is the final Phase 6 acceptance rung for the x402 XCF Agent Registry project.

It demonstrates that the existing Phase 5 agent-delegated authorization lifecycle can be composed with the Phase 6 Agent Registry trust model at the Gateway boundary, using:

- Phase 5 buyer signature verification;
- Phase 5 agent proof-of-possession verification;
- Phase 5 delegation lifecycle enforcement;
- CIS-8004 Agent Registry evidence;
- CIS-8 external-key evidence;
- Agent Card integrity and capability evidence;
- finalized-evidence freshness checks;
- append-only Phase 6 authorization auditing;
- buyer-policy evaluation;
- bounded-use delegation claims; and
- the existing x402 payment, receipt, release, and replay boundaries.

The PR does not introduce a new production registry architecture. It supplies one tightly guarded, Gateway-owned controlled-evidence provider that injects evidence through the already established Phase 6 transport interfaces.

The provider exists only to make the final composed lifecycle deterministic and auditable while the currently available Concordium Testnet token `0` cannot serve as a complete positive Agent Card fixture.

---

## 2. Final Acceptance Boundary

PR #304 proves the following composed ordering:

1. Phase 5 buyer-signature verification
2. Phase 5 agent proof-of-possession verification
3. Phase 5 delegation-contract verification
4. Phase 5 lifecycle validity evaluation
5. Phase 5 revocation evaluation
6. Agent Registry reference validation
7. CIS-8004 registry lookup
8. Phase 5 acting-key to registry-key binding
9. CIS-8 external-key lookup
10. Agent Card retrieval
11. Agent Card hash verification
12. Agent capability evaluation
13. finalized-evidence freshness evaluation
14. append-only Phase 6 authorization audit
15. buyer-policy evaluation
16. bounded-use delegation claim
17. payment-eligibility handoff
18. settlement
19. receipt redemption
20. protected-resource release
21. replay rejection

The controlled final-acceptance harness stops before settlement, receipt issuance, release, and replay mutation.

The separate Demo3 runner contains an explicitly guarded live-settlement continuation, but that continuation is not entered unless:

    PHASE6_DEMO3_PREFLIGHT_ONLY=false

The runner defaults to:

    PHASE6_DEMO3_PREFLIGHT_ONLY=true

---

## 3. Files in Scope

### New files

- `src/phase6/demo3ControlledEvidenceProvider.ts`
- `scripts/demo_phase6_demo3_controlled_evidence.ts`
- `scripts/ci_phase6_demo3_final_acceptance.ts`
- `scripts/demo_x402_v2_agent_registry_demo3_e2e.sh`
- `docs/phase6-demo3-final-acceptance.md`
- `db/migrations/004_phase6_owner_account_binding_authorization_audit.sql`
- `db/migrations/005_phase6_freshness_source_authorization_audit.sql`

### Modified files

- `src/server.ts`
- `src/phase6/agentRegistryIdentityKeyBinding.ts`
- `src/phase6/agentRegistryConditionalGatingComposition.ts`
- `src/db/phase6AgentRegistryAuthorizationAuditStore.ts`
- `scripts/ci_phase6_agent_registry_conditional_gating_composition.ts`
- `docs/phase6-agent-registry-conditional-gating-composition.md`
- `package.json`

### Frozen file

- `package-lock.json`

Expected SHA-256:

    1e5f4fe8365c1f890ab75137fa7e6aff0acacdad74624b49a03de15ce1d82626

---

## 4. Controlled Evidence Provider

The controlled provider is implemented in:

    src/phase6/demo3ControlledEvidenceProvider.ts

It:

- defaults off;
- requires the complete frozen activation guard;
- accepts one Gateway-owned temporary public-evidence manifest;
- validates the manifest against a closed schema;
- recognizes only three enumerated scenarios;
- constructs only the existing CIS-8004, CIS-8, and Agent Card transports;
- does not authorize a request;
- does not evaluate buyer policy;
- does not persist an authorization decision;
- does not consume a bounded-use claim;
- does not call CRP;
- does not submit a payment;
- does not issue or decode a receipt;
- does not mutate replay state;
- does not release a protected resource;
- does not sign anything; and
- cannot activate production behavior.

### Supported controlled scenarios

The provider accepts exactly:

- `positive`
- `acting_key_mismatch`
- `tampered_agent_card`

No unknown scenario is accepted.

No controlled-to-live fallback exists.

No live-to-controlled fallback exists.

A missing, malformed, incoherent, or untrusted manifest causes the provider to remain inactive or return a rejected status.

### Manifest contract

The manifest type is:

    xcf.phase6.demo3-controlled-evidence-manifest

The manifest version is:

    1.0.0

The closed schema contains only the expected top-level fields:

- `type`
- `version`
- `scenario`
- `registry`
- `cis8`
- `agentCard`

The provider validates:

- manifest type and version;
- exact object shape;
- scenario membership;
- registry evidence;
- trusted registry identity;
- CIS-8 evidence;
- trusted CIS-8 contract identity;
- Agent Card evidence;
- scenario coherence;
- expected Agent Card hash;
- delivered Agent Card hash; and
- controlled public-evidence consistency.

The manifest establishes only internal public-evidence coherence.

The existing Phase 6 identity-key-binding stage remains responsible for deciding whether the registry/CIS-8 key matches the Phase 5 verified acting key.

---

## 5. Gateway Activation Guard

The Gateway exposes exactly two Demo3 controlled-evidence environment variables:

    PHASE6_DEMO3_CONTROLLED_EVIDENCE_ENABLED
    PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_PATH

The provider is active only when all required guards are satisfied, including:

- development/test-harness execution;
- `X402_ALLOW_DEV_HARNESS=true`;
- Phase 5 delegated runtime enabled;
- Phase 5 cryptographic delegation enabled;
- Phase 5 lifecycle enforcement enabled;
- Phase 6 conditional Agent Registry gating enabled;
- Demo3 controlled evidence explicitly enabled;
- a valid controlled-evidence manifest path;
- a successfully loaded and validated manifest; and
- all production and release activation switches remaining false.

The controlled provider reports:

- whether it was requested;
- whether it is active;
- provider status;
- provider reason;
- selected scenario;
- whether the manifest loaded;
- whether the path was accepted; and
- `productionActivation: false`.

Representative active health status:

    status: active
    reason: controlled_evidence_active
    manifestLoaded: true
    manifestPathAccepted: true
    productionActivation: false

---

## 6. Controlled Evidence Generator

The controlled manifest helper is:

    scripts/demo_phase6_demo3_controlled_evidence.ts

Usage:

    ts-node --transpile-only \
      scripts/demo_phase6_demo3_controlled_evidence.ts \
      --key-bundle <phase5-cryptographic-key-bundle.json> \
      --scenario <positive|acting_key_mismatch|tampered_agent_card> \
      --out <.tmp/pr304-demo3-<run-id>/<manifest>.json>

The helper:

- consumes the public portion of the temporary Phase 5 key bundle;
- never reads private-key material;
- never prints private-key material;
- requires output beneath a unique PR #304 temporary directory;
- creates one closed-schema public-evidence manifest;
- validates the generated manifest;
- does not call the Gateway;
- does not call Concordium;
- does not call CRP;
- does not access settlement;
- does not persist authorization state;
- does not mutate replay state;
- does not request a receipt;
- does not release the protected resource; and
- does not activate production behavior.

### Scenario construction

#### `positive`

- registry key matches the verified Phase 5 acting key;
- delivered Agent Card matches the expected hash;
- required capabilities are present;
- finalized freshness evidence is accepted.

#### `acting_key_mismatch`

- the controlled registry/CIS-8 evidence is internally coherent;
- the registry acting key intentionally differs from the verified Phase 5 acting key;
- Agent Card bytes still match the expected hash;
- rejection occurs at the existing identity-key-binding stage.

#### `tampered_agent_card`

- registry and CIS-8 key evidence are coherent;
- the registry key matches the verified Phase 5 acting key;
- the delivered Agent Card bytes intentionally differ from the bytes used to compute the expected registry hash;
- rejection occurs at the Agent Card integrity stage.

---

## 7. Six-Path Final Acceptance Matrix

The controlled final-acceptance harness is:

    scripts/ci_phase6_demo3_final_acceptance.ts

Package command:

    npm run phase6:demo3-final-acceptance-test

The harness executes six cases over real Gateway HTTP request boundaries.

It starts the Gateway four times because the controlled manifest is frozen at process startup and the three provider scenarios require distinct controlled evidence.

### Path 1 — Invalid buyer signature

Expected and observed:

- request rejected;
- reason: `buyer_signature_verification_failed`;
- agent proof not treated as sufficient;
- Agent Registry lookup not attempted;
- Phase 6 composition not reached;
- no Phase 6 audit row;
- no buyer-policy evaluation;
- no bounded-use claim;
- no payment;
- no receipt;
- no release.

This proves that registry evidence cannot rescue an invalid buyer signature.

### Path 2 — Invalid agent proof-of-possession

Expected and observed:

- buyer signature verified;
- acting key remained bound by the buyer signature;
- agent proof-of-possession failed;
- reason: `agent_proof_verification_failed`;
- Agent Registry lookup not attempted;
- Phase 6 composition not reached;
- no Phase 6 audit row;
- no buyer-policy evaluation;
- no bounded-use claim;
- no payment;
- no receipt;
- no release.

This proves that registry evidence cannot replace the agent’s possession of the delegated acting key.

### Path 3 — Acting-key mismatch

Expected and observed:

- Phase 5 cryptographic verification passed;
- CIS-8004 registry lookup occurred;
- registry key did not match the Phase 5 verified acting key;
- reason: `agent_registry_key_mismatch`;
- CIS-8 lookup did not proceed;
- Agent Card fetch did not proceed;
- sanitized denial audit persisted;
- buyer policy was not evaluated;
- bounded use was not consumed;
- no payment;
- no receipt;
- no release.

This proves that a valid buyer-signed delegation is insufficient when the acting key is not the key established by the registry evidence.

### Path 4 — Tampered Agent Card

Expected and observed:

- Phase 5 cryptographic verification passed;
- CIS-8004 registry lookup occurred;
- acting-key binding passed;
- CIS-8 lookup occurred;
- Agent Card fetch occurred;
- delivered Agent Card hash differed from the expected hash;
- reason: `agent_card_hash_mismatch`;
- integrity verification was false;
- sanitized denial audit persisted;
- buyer policy was not evaluated;
- bounded use was not consumed;
- no payment;
- no receipt;
- no release.

This proves that a registry-authorized key cannot authorize payment when the associated Agent Card integrity contract fails.

### Path 5 — Valid registry agent with ineligible buyer

Expected and observed:

- Phase 5 cryptographic verification passed;
- lifecycle validity passed;
- revocation check passed;
- registry lookup passed;
- key binding passed;
- Agent Card integrity passed;
- required capabilities passed;
- freshness checks passed;
- Phase 6 decision was `allowed`;
- Phase 6 reason was `accepted`;
- append-only audit persisted;
- payment-eligibility handoff was present;
- buyer policy evaluated to deny;
- reason: `age_requirement_not_met`;
- bounded use was not consumed;
- no payment;
- no receipt;
- no release.

This proves that Agent Registry authorization does not override the buyer-policy gate.

### Path 6 — Valid registry agent with eligible buyer

Expected and observed:

- Phase 5 cryptographic verification passed;
- lifecycle validity passed;
- revocation check passed;
- registry lookup passed;
- key binding passed;
- Agent Card integrity passed;
- capability policy passed;
- freshness checks passed;
- Phase 6 decision was `allowed`;
- Phase 6 reason was `accepted`;
- append-only audit persisted;
- payment-eligibility handoff was present;
- buyer policy evaluated to allow;
- current authorization was established;
- one bounded-use claim was created;
- delegation use count became `1`;
- delegation maximum uses remained `1`;
- payment was not attempted by the controlled harness;
- receipt was not issued;
- protected resource was not released.

This proves the complete authorization path up to the payment-eligibility boundary.

---

## 8. Append-Only Phase 6 Audit

The final-acceptance harness verifies that Phase 6 authorization evidence is retained in the append-only audit store.

For each controlled run:

- Paths 1 and 2 produce no Phase 6 audit rows because they fail before Phase 6.
- Paths 3 and 4 produce sanitized denial rows.
- Paths 5 and 6 produce allowed rows.
- Four audit rows are retained for the six-path matrix.
- Raw proof material is not persisted.
- Private key material is not persisted.
- No update is attempted.
- No delete is attempted.
- No truncate is attempted.

The audit includes sanitized evidence covering:

- registry identity;
- agent token identity;
- token address;
- registry status;
- owner-account binding;
- owner-identity assurance;
- finalized block identity;
- evidence observation time;
- evidence age;
- freshness source;
- source-aware indexer lag;
- expected and actual Agent Card hashes;
- Agent Card byte length;
- Agent Card integrity;
- required capabilities;
- missing capabilities;
- capability decision;
- key-binding requirement;
- key-binding result;
- binding type;
- key fingerprint;
- whether registry evidence was captured; and
- final authorization decision.

---

## 9. Owner-Account Evidence Correction

Migration:

    db/migrations/004_phase6_owner_account_binding_authorization_audit.sql

SHA-256:

    e391a4be931d77165b00a38a789654130cf8beec0518b6eea3e4b2ca0c846a8e

The production-shaped CIS-8004 plugin establishes an on-chain owner account. It does not independently establish a verified human identity behind that account.

Accordingly, the allowed audit profile requires:

    owner_account IS NOT NULL
    owner_account_bound = true
    owner_identity_assurance = 'not_evaluated'

It must not claim:

    owner_identity_assurance = 'verified'

This correction preserves truthful evidence semantics while retaining the actual authorization requirement: the registry token must have a bound owner account.

Migration `003` remains immutable.

Migration `004` preserves existing append-only audit rows.

---

## 10. Source-Aware Freshness Correction

Migration:

    db/migrations/005_phase6_freshness_source_authorization_audit.sql

SHA-256:

    40eceb8f33f36ea804f045f8a627d3dc79d33b230b5450461b99985136920f82

The audit now persists:

    freshness_source

Accepted values are:

- `fixture`
- `direct_chain`
- `auditable_resolver`

Freshness semantics are source-aware.

### Direct-chain evidence

Direct-chain evidence does not pass through an indexer. Therefore:

    freshness_source = 'direct_chain'
    indexer_lag_blocks IS NULL

A value of zero would incorrectly imply that an indexer was involved and measured.

### Fixture and auditable-resolver evidence

Fixture and auditable-resolver evidence retain an explicit zero-lag requirement:

    freshness_source IN ('fixture', 'auditable_resolver')
    indexer_lag_blocks = 0

Migrations `003` and `004` remain immutable.

Migration `005` preserves existing rows; pre-existing rows may retain a null freshness source.

---

## 11. Identity-Key-Binding Snapshot Correction

The Phase 6 identity-key-binding implementation was narrowed to compare the normalized trust/freshness snapshot rather than relying on unstable object-shape equality.

The binding stage requires:

- finalized registry evidence;
- a consistent normalized trust snapshot;
- a matching agent token reference;
- a matching registry/CIS-8 key;
- the expected binding type; and
- a stable key fingerprint.

The direct registry snapshot must indicate:

    finalized: true

This correction preserves the intended trust contract while removing false mismatches caused by representation differences.

---

## 12. Live CIS-8004 Token-0 Smoke

Package command:

    npm run phase6:concordium-cis8004-registry-plugin-live-smoke

The read-only live smoke verifies the pinned Concordium Testnet CIS-8004 registry contract:

    network: ccd:testnet
    contract index: 12802
    contract subindex: 0

It checks:

- active token `0`;
- missing-token behavior;
- pinned module reference;
- finalized snapshot evidence;
- owner-account presence;
- agent-wallet presence;
- Agent URI presence;
- metadata-hash presence; and
- read-only safety boundaries.

The live smoke does not:

- submit a transaction;
- use a signing key;
- fetch the Agent URI;
- persist data;
- alter Gateway runtime state;
- mutate Phase 5 state;
- attempt payment;
- issue a receipt;
- release a resource; or
- activate production behavior.

Token `0` is suitable for validating the live CIS-8004 registry-read boundary.

It is not claimed as the complete positive Agent Card acceptance fixture because the live smoke intentionally does not fetch the Agent URI or compose the CIS-8 and Agent Card stages.

The controlled provider supplies the deterministic positive, key-mismatch, and tampered-card compositions separately.

---

## 13. Demo3 Runner

The Demo3 runner is:

    scripts/demo_x402_v2_agent_registry_demo3_e2e.sh

Package command:

    npm run demo:x402-v2-agent-registry-demo3-e2e

The runner defaults to safe preflight mode:

    PHASE6_DEMO3_PREFLIGHT_ONLY=true

### Preflight mode

Preflight mode executes:

1. live read-only CIS-8004 token-0 smoke;
2. controlled six-path PR #304 final acceptance; and
3. a clean exit before the managed live-settlement phase.

Preflight mode explicitly reports:

- managed live-settlement phase executed: false;
- CRP payment created: false;
- PLT payment attempted: false;
- receipt requested: false;
- protected resource released: false; and
- production activation: false.

Completion sentinel:

    PR304_DEMO3_PREFLIGHT_COMPLETE=true

### Live-settlement mode

Live settlement is entered only when explicitly requested:

    PHASE6_DEMO3_PREFLIGHT_ONLY=false \
      npm run demo:x402-v2-agent-registry-demo3-e2e

This mode must not be run casually.

Before running it, the operator must confirm:

- the Gateway is not already running on the managed port;
- the facilitator is healthy;
- the stream worker is running;
- the wallet proxy and Concordium node are healthy;
- the configured wallet exists;
- the buyer wallet has sufficient EUDemo and CCD;
- the merchant destination is correct;
- the payment amount is the intended test amount;
- the transaction is a test payment;
- the TTL window is sufficient;
- no unrelated live rehearsal is in progress; and
- explicit authorization has been given to submit the PLT transfer.

The full-run continuation:

1. applies the existing Phase 5 lifecycle migration idempotently;
2. creates temporary Phase 5 cryptographic keys;
3. generates a controlled positive Demo3 manifest;
4. starts a dedicated Gateway with Phase 5 and Phase 6 guards enabled;
5. verifies the controlled health contract;
6. repeats four live-settlement safety paths:
   - invalid buyer signature;
   - invalid agent proof;
   - valid registry agent with ineligible buyer;
   - valid registry agent with eligible buyer;
7. creates the positive CRP payment record;
8. submits the Concordium PLT transfer with `--wait`;
9. waits for the indexed transfer;
10. fulfills CRP;
11. fetches the receipt JWS;
12. redeems the protected resource;
13. requires `PAYMENT-RESPONSE`;
14. verifies the protected resource payload;
15. retries the receipt to verify replay rejection; and
16. captures final canonical state and transition evidence.

The controlled provider and the Demo3 runner still report:

    productionActivation: false

The live runner exercises the existing payment/release path. It does not create a new production activation mode.

---

## 14. Package Entry Points

PR #304 adds:

    "phase6:demo3-final-acceptance-test":
      "ts-node --transpile-only scripts/ci_phase6_demo3_final_acceptance.ts"

    "demo:x402-v2-agent-registry-demo3-e2e":
      "bash scripts/demo_x402_v2_agent_registry_demo3_e2e.sh"

The existing live smoke remains:

    "phase6:concordium-cis8004-registry-plugin-live-smoke":
      "ts-node --transpile-only scripts/ci_phase6_concordium_cis8004_registry_plugin.ts --live-smoke"

`package-lock.json` is unchanged.

---

## 15. Validated Commands

### Controlled six-path acceptance

    npm run phase6:demo3-final-acceptance-test

Expected completion sentinels include:

    PR304_PATH1_INVALID_BUYER_SIGNATURE_REJECTED=true
    PR304_PATH2_INVALID_AGENT_POP_REJECTED=true
    PR304_PATH3_AGENT_REGISTRY_KEY_MISMATCH_AUDITED=true
    PR304_PATH4_AGENT_CARD_HASH_MISMATCH_AUDITED=true
    PR304_PATH5_INELIGIBLE_BUYER_NO_CONSUMPTION=true
    PR304_PATH6_ELIGIBLE_BUYER_BOUNDED_USE_CONSUMED=true
    PR304_PHASE6_APPEND_ONLY_AUDIT_RETAINED=true
    PR304_FINAL_ACCEPTANCE_NO_PAYMENT_OR_RELEASE=true
    PR304_PHASE6_FINAL_ACCEPTANCE_COMPLETE=true
    PR304_FINAL_ACCEPTANCE_CLEANUP_COMPLETE=true

### Safe Demo3 preflight

    PHASE6_DEMO3_PREFLIGHT_ONLY=true \
      npm run demo:x402-v2-agent-registry-demo3-e2e

Expected completion sentinel:

    PR304_DEMO3_PREFLIGHT_COMPLETE=true

### Live registry smoke only

    npm run phase6:concordium-cis8004-registry-plugin-live-smoke

### Full controlled live-settlement runner

Do not run without explicit authorization:

    PHASE6_DEMO3_PREFLIGHT_ONLY=false \
      npm run demo:x402-v2-agent-registry-demo3-e2e

---

## 16. Acceptance Evidence

The package-level command validation completed successfully.

Observed controlled final-acceptance result:

    matrixCases: 6
    passedCases: 6
    gatewayStartCount: 4

Observed safety result:

    crpCalled: false
    paymentAttempted: false
    receiptIssued: false
    paymentResponseEmitted: false
    replayStateMutated: false
    protectedResourceReleased: false
    productionActivation: false

Observed audit result:

    appendOnly: true
    retainedRowCount: 4
    rawMaterialPersisted: false
    updateAttempted: false
    deleteAttempted: false
    truncateAttempted: false

Observed temporary-key result:

    temporary: true
    printed: false
    persistedToRepository: false

Observed process cleanup:

- Gateway port `3005` clean;
- harness Gateway port `3150` clean;
- temporary Gateway processes stopped;
- temporary key material removed;
- package lock unchanged; and
- `git diff --check` clean.

---

## 17. Explicit Non-Goals

PR #304 does not:

- create a new Agent Registry standard;
- create a second registry resolver architecture;
- replace the Concordium CIS-8004 plugin;
- make token `0` a complete positive Agent Card fixture;
- fetch the live token `0` Agent URI in the smoke test;
- enable uncontrolled network fallback;
- enable controlled evidence in production;
- enable automatic controlled-to-live fallback;
- enable automatic live-to-controlled fallback;
- authorize based only on registry ownership;
- treat owner-account presence as verified human identity;
- bypass Phase 5 buyer signatures;
- bypass Phase 5 agent proof-of-possession;
- bypass lifecycle validity;
- bypass revocation checks;
- bypass bounded-use enforcement;
- bypass buyer policy;
- change the payment asset or amount;
- change the existing settlement implementation;
- change receipt verification;
- change replay semantics;
- activate a production release path; or
- modify `package-lock.json`.

---

## 18. Security and Honesty Properties

The final Demo3 composition preserves the following properties:

### Cryptographic ordering

Registry lookup occurs only after the Phase 5 buyer signature and agent proof-of-possession have succeeded.

### Registry-key binding

A valid registry token is insufficient unless the key established by registry/CIS-8 evidence matches the Phase 5 verified acting key.

### Agent Card integrity

A registry-authorized key is insufficient when the delivered Agent Card does not match the hash bound by the registry evidence.

### Capability enforcement

A valid card is insufficient unless the required capabilities are present.

### Freshness enforcement

Authorization requires finalized, timely, source-aware evidence.

### Buyer-policy independence

Agent authorization does not imply buyer eligibility.

### Bounded use

The ineligible buyer path consumes no use. The eligible authorization path consumes exactly one bounded use.

### Append-only audit

Phase 6 decisions retain sanitized evidence and cannot be silently updated or deleted through the audit interface.

### No raw proof persistence

Raw cryptographic proof material and private key material are not persisted in the Phase 6 audit.

### Production honesty

All controlled components report:

    productionActivation: false

---

## 19. Current Completion Status

Completed:

- controlled evidence provider;
- closed manifest schema;
- three deterministic evidence scenarios;
- Gateway integration;
- health reporting;
- identity-key-binding correction;
- owner-account audit correction;
- source-aware freshness correction;
- append-only audit persistence;
- six-path final-acceptance harness;
- controlled helper;
- safe preflight runner;
- live token-0 smoke composition;
- package entry points;
- package-level command validation;
- no-payment acceptance;
- process cleanup validation; and
- frozen package-lock validation.

Not yet completed:

- explicitly authorized full controlled live-settlement execution;
- final consolidated repository validation after documentation;
- staging;
- commit;
- push;
- pull request update;
- merge; and
- branch cleanup.

---

## 20. Phase 6 Closure Statement

PR #304 provides the final controlled acceptance evidence for the Phase 6 Agent Registry project.

The acceptance proves that:

- invalid buyer cryptography stops before registry evaluation;
- invalid agent possession stops before registry evaluation;
- an acting-key mismatch is denied and audited;
- a tampered Agent Card is denied and audited;
- a registry-valid agent cannot override an ineligible buyer;
- a registry-valid agent with an eligible buyer reaches the bounded payment-eligibility boundary;
- Phase 6 audit evidence is append-only and sanitized;
- owner-account and freshness semantics are represented truthfully;
- the live Concordium CIS-8004 registry-read surface remains independently verifiable;
- controlled evidence remains explicitly guarded and non-production; and
- settlement and release remain separate, explicit, operator-controlled actions.

Subject to the final consolidated validation and the separately authorized controlled live-settlement run, this PR closes the finite Phase 6 Agent Registry implementation ladder without introducing an indefinitely extensible chain of additional preflight PRs.
