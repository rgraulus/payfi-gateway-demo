# Demo4 Corrective Rebaseline

## Registered-Agent Extension

Project: x402 XCF
Repository: payfi-gateway-demo
Status: Corrective execution rebaseline
Date: August 2, 2026
Environment: Concordium Testnet
Production activation: Out of scope and disabled

## 1. Purpose

This document freezes the evidence-based status of Demo4 after reconciling:

* the revised Demo4 Scope & Rationale;
* the actual contents and purpose of PR 306;
* the published Demo4 Agent Card;
* the completed CIS-8 acting-key transaction;
* the absence of a Demo4 CIS-8004 registration transaction;
* the deployed CIS-8004 and CIS-8 contract references;
* the designated Demo4 owner account;
* repository evidence;
* finalized chain evidence;
* Browser Wallet activity;
* and local transaction-index evidence.

This is a corrective status and execution rebaseline.

It does not:

* reopen Phase 6;
* invalidate Demo3;
* rewrite merged Git history;
* reverse the completed CIS-8 transaction;
* authorize a new contract transaction;
* approve a CIS-8 identity profile;
* approve key generation or signing;
* or expand Demo4 beyond its frozen three-rung plan.

The purpose is to replace an inaccurate stage-completion assumption with a precise, finite, and auditable execution baseline.

## 2. Executive Rebaseline Decision

The following project interpretation is frozen.

### 2.1 Phase 6 remains complete

Phase 6 and Demo3 remain complete and closed.

Demo3 accurately established:

* complete registry-aware authorization using controlled positive identity evidence;
* independent live CIS-8004 registry grounding;
* live Concordium Testnet settlement;
* CRP fulfillment and receipt redemption;
* protected-resource release;
* and replay rejection.

Demo4 remains a separate post-Phase 6 operational-evidence extension.

No Demo4 correction changes the historical Phase 6 claim or Definition of Done.

### 2.2 PR 306 was not D4-1A provisioning

PR 306 implemented a pure Concordium network and token-address normalization seam.

It did not:

* create or publish the Demo4 Agent Card;
* register a CIS-8004 identity;
* submit a CIS-8004 transaction;
* obtain a Demo4 token ID;
* register a CIS-8 external key;
* attach an external reference;
* authorize payment;
* or change the production release path.

PR 306 was previously described as Demo4 D4-1A even though its implemented scope was preparatory normalization only.

The corrected interpretation is:

PR 306 is D4-0 — Concordium Network Normalization.

This document does not rename or rewrite the merged pull request. It corrects how that work is mapped into the remaining Demo4 execution plan.

### 2.3 D4-1A is partially complete

The Agent Card preparation and publication portion of D4-1A is complete.

The CIS-8004 registration portion of D4-1A was not performed.

Therefore D4-1A as a whole is not complete.

### 2.4 D4-1B contains a real finalized CIS-8 registration

PR 307 completed one controlled CIS-8 registerExternalKey transaction.

That transaction is real, finalized, and independently evidenced.

However, the registration’s suitability as the canonical Demo4 CIS-8 identity profile has not yet been approved under the revised Demo4 scope.

The transaction must be preserved as historical and chain evidence while its profile disposition is decided.

### 2.5 D4-1C has not started

No CIS-8004 Demo4 token exists to which the CIS-8 external reference could have been attached.

No setExternalReference transaction was performed.

D4-1C remains blocked.

## 3. Authoritative Evidence Ledger

## 3.1 Designated owner account

The designated Demo4 owner and transaction-sender account is:

4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7

This is the established XCF Concordium Testnet direct-buyer account used in prior project demonstrations.

Any canonical Demo4 CIS-8004 identity and CIS-8 ownership relationship must be owned or explicitly controlled by the XCF project under the approved provisioning procedure.

## 3.2 Concordium network

Canonical network:

ccd:4221332d34e1694168c2a0c0b3fd0f27

Human-readable environment:

Concordium Testnet

## 3.3 CIS-8004 registry

Contract:

<12802,0>

Module reference:

2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41

Contract name:

CIS-8004

Existing read entrypoint used by the Phase 6 plugin:

agentOf

Public token 0 remains protected shared baseline infrastructure and must not be modified.

Token 5 is an unrelated existing record and must not be used as the Demo4 identity.

## 3.4 CIS-8 registry

Contract:

<12801,0>

Module reference:

5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da

Contract name:

CIS-8

Completed write entrypoint:

registerExternalKey

## 3.5 Canonical Demo4 Agent Card

Repository:

https://github.com/rgraulus/xcf-demo4-agent-card

Commit:

45e2187d9d832fa1b7819bd8a2284e39cefbff06

Commit message:

Publish frozen Demo4 Agent Card

File:

agent-card.json

Public HTTPS URI:

https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json

Exact UTF-8 byte length:

282

Exact SHA-256:

6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38

Final newline:

Present

Git blob SHA:

f89c4dd61ef6bb50dc407a865f20229512ac2dd0

The live GitHub Pages response was independently verified to:

* return HTTP 200;
* return application/json with UTF-8 encoding;
* contain exactly 282 bytes;
* include the final newline;
* match the committed file byte-for-byte;
* and produce the expected SHA-256 hash.

The Agent Card declares:

* name: XCF Demo4 Registered Agent;
* type: EIP-8004 registration version 1;
* x402 support: true;
* active: true;
* service: xcf-premium-resource;
* required skill: resource.premium.read.

The Agent Card publication and exact-byte integrity requirements are therefore satisfied.

## 3.6 D4-1B CIS-8 transaction

Transaction hash:

949a25947e645cca59a6a529859ba8fcbf160a0122d31406dc0eb45cc7d87093

Finalized block hash:

0506c203c157a2e676694e46a85e23f364409b90f3d615dcf034ba01f89a52cd

Finalized block height:

46287110

Transaction sender and resulting owner:

4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7

Target:

CIS-8 contract <12801,0>

Entrypoint:

registerExternalKey

Attached CCD:

0

Transaction fee:

12.691094 CCD

Recorded external namespace:

xcf:phase5

Recorded key type:

ed25519

Recorded proof scheme:

fetch-ai-ed25519

Registered public key:

e9d34013c5d042e38e8f8c43f0d7e2c326eafe70b40647319d39ade5ea8c18ad

Public key Base64URL:

6dNAE8XQQuOOj4xD8Nfiwybq_nC0BkcxnTmt5eqMGK0

Public key fingerprint:

sha256:5064708a2081db6539f9e4043a1635fa0ab1633c97a67f5ced705a2fc73ce619

Logical agent identifier:

agent:xcf:demo4:registered

Logical agent-key identifier:

agent-key:xcf:demo4:registered:ed25519-1

The transaction is finalized and the CIS-8 ownerOfKey postcondition was independently verified as Active and owned by the designated XCF Testnet account.

## 4. Historical Investigation Findings

## 4.1 No repository evidence of completed CIS-8004 provisioning

The payfi-gateway-demo repository contains no authoritative evidence of:

* a Demo4 CIS-8004 registration transaction;
* a Demo4 CIS-8004 token ID;
* a CIS-8004 registration evidence artifact;
* a finalized CIS-8004 ownership result for the Demo4 identity;
* or a setExternalReference transaction.

Historical repository inspection found that the first exact Demo4 identity and acting-key anchors entered the repository through D4-1B.

## 4.2 Browser Wallet activity

The designated owner’s Browser Wallet activity contains the August 1, 2026 contract update corresponding to the D4-1B CIS-8 registerExternalKey transaction.

The user positively confirmed that there is no other contract-update activity in that Browser Wallet account that could represent a separate CIS-8004 registration.

The August 1 transaction cannot be D4-1A because it targeted:

<12801,0>

and invoked:

CIS-8.registerExternalKey

A D4-1A native identity registration would have required a distinct update to:

<12802,0>

No such transaction was identified.

## 4.3 Bounded finalized CIS-8004 reads

A read-only finalized scan of CIS-8004 token IDs 0 through 32 found:

* 33 registered records;
* no missing records;
* no read errors;
* no records owned by the designated Demo4 owner;
* no records containing the Demo4 Agent Card URI;
* no records containing the Demo4 Agent Card hash;
* and no owner, URI, and hash full match.

This scan was bounded and is not, by itself, proof that no higher token ID exists.

## 4.4 Local transaction-index evidence

The local transaction-outcome database contains approximately 46.26 million block-summary rows.

The index:

* has a usable height index;
* covers through block 46314821;
* contains the known D4-1B transaction at block 46287110;
* and therefore covers the relevant D4-1B period.

A bounded search around the D4-1B period found no plain-text candidate containing:

* the Demo4 Agent Card URI;
* the Demo4 Agent Card hash;
* or the designated owner together with the CIS-8004 contract index.

Serialized contract parameters and event data may not always be present as searchable plain text. This result therefore supports, but does not independently prove, the absence conclusion.

## 4.5 Evidence-based absence conclusion

The combined evidence is sufficient for the corrective project baseline:

* no CIS-8004 transaction artifact exists in the repository;
* no Demo4 token ID exists in project evidence;
* no matching CIS-8004 record was found in the bounded read;
* no candidate appeared in the indexed relevant block window;
* the only relevant Browser Wallet contract update is the CIS-8 transaction;
* and the user confirmed there is no separate CIS-8004 contract update in the designated account activity.

The project will therefore proceed on the basis that:

D4-1A CIS-8004 registration was not performed.

This is an operational project conclusion based on all available evidence. It is not a claim that no unrelated record could exist anywhere on Testnet.

## 5. Corrected Demo4 Status Ledger

| Work item                                    | Corrected status              | Notes                                               |
| -------------------------------------------- | ----------------------------- | --------------------------------------------------- |
| Phase 6                                      | Complete and closed           | Not reopened by Demo4                               |
| Demo3                                        | Complete                      | Historical controlled-plus-live settlement baseline |
| D4-0                                         | Complete                      | PR 306 network-normalization seam                   |
| D4-1A Agent Card design                      | Complete                      | Exact card content frozen                           |
| D4-1A Agent Card publication                 | Complete                      | Public HTTPS endpoint verified                      |
| D4-1A exact-byte hash                        | Complete                      | SHA-256 independently verified                      |
| D4-1A CIS-8004 registration                  | Not performed                 | No transaction or token ID                          |
| D4-1A finalized native-identity verification | Not performed                 | Depends on registration                             |
| D4-1B CIS-8 transaction                      | Complete as an on-chain event | PR 307, finalized                                   |
| D4-1B profile approval                       | Pending                       | Must be reconciled with revised scope               |
| D4-1B canonical Demo4 suitability            | Pending                       | Retain, supersede, or revoke decision required      |
| D4-1C external-reference attachment          | Not started                   | Blocked by D4-1A and profile decision               |
| D4-2 authorization preflight                 | Not started                   | No payment permitted                                |
| D4-3 final acceptance                        | Not started                   | Exactly one payment only after approval             |

## 6. Corrected Finite Execution Plan

Demo4 retains three finite rungs.

D4-1A, D4-1B, and D4-1C remain sub-stages of the single D4-1 provisioning rung.

No fourth Demo4 rung is introduced by this correction.

## 6.1 D4-0 — Network normalization

Status:

Complete.

Implemented by:

PR 306.

Purpose:

* normalize Concordium network identifiers;
* normalize token-address representations;
* establish safe preparatory seams;
* and preserve existing Phase 6 behavior.

D4-0 performs no live identity provisioning.

## 6.2 D4-1 — Staged Demo-Owned Agent Registry Provisioning

### D4-1A — Native CIS-8004 identity and Agent Card

Current status:

Partially complete.

Already complete:

* public agent name;
* canonical Agent Card;
* exact card bytes;
* capability declaration;
* public HTTPS hosting;
* HTTP 200 verification;
* exact SHA-256 calculation;
* and stable publication evidence.

Still required before D4-1A completion:

* approve the final D4-1A registration runbook;
* confirm the owner account;
* confirm the exact URI and metadata hash;
* confirm the registration entrypoint and parameter schema;
* confirm the external reference will be absent at initial registration;
* define the incorrect-registration rollback or recovery procedure;
* obtain explicit transaction authorization;
* submit exactly one controlled CIS-8004 registration attempt;
* retain the resulting transaction hash and token ID;
* wait for finalization;
* independently read the resulting record;
* verify Active status;
* verify owner;
* verify URI;
* verify metadata hash;
* verify contract and module references;
* verify external reference is absent;
* and retain a sanitized D4-1A evidence artifact.

Payment behavior:

No payment.

### D4-1B — CIS-8 acting-key registration

Current status:

Transaction complete; profile disposition pending.

The completed transaction must not be discarded or repeated automatically.

Before it is accepted as the canonical Demo4 D4-1B profile, the project must formally decide whether the registered combination is proposal-conformant under the approved CIS-8 revision.

The review must cover:

* proposal revision;
* proposal status;
* profile identifier;
* canonical-message version;
* domain-separation semantics;
* external namespace;
* key type;
* proof scheme;
* public-key encoding;
* signature encoding;
* expected byte lengths;
* canonical-message compatibility with an approved reference or official builder;
* key-custody approval;
* and rotation or supersession procedure.

Possible dispositions are limited to:

1. Retain as canonical Demo4 D4-1B registration.
2. Preserve as historical evidence and supersede with a new approved registration.
3. Preserve as historical evidence and revoke under an approved procedure.
4. Stop because the proposal or deployed contract cannot support an approved Demo4 profile.

No disposition may be selected implicitly.

No new key, proof, registration, revocation, or replacement is authorized by this document.

Payment behavior:

No payment.

### D4-1C — Attach the verified external reference

Current status:

Not started and blocked.

D4-1C may begin only after:

* D4-1A CIS-8004 registration is complete;
* the canonical Demo4 token ID is independently verified;
* the D4-1B profile disposition is formally approved;
* an Active CIS-8 ownerOfKey result is independently verified;
* the CIS-8 owner matches the CIS-8004 owner;
* the exact ExternalKeyId is frozen;
* the configured CIS-8 contract is verified;
* uniqueness and cross-contract requirements are understood;
* the setExternalReference ABI and runbook are verified;
* and explicit transaction authorization is obtained.

D4-1C must then:

* submit one controlled setExternalReference transaction;
* wait for finalization;
* independently read the CIS-8004 record;
* verify the exact CIS-8 contract coordinate;
* verify the complete ExternalKeyId;
* verify owner continuity;
* verify Active status;
* and retain a sanitized provisioning evidence record covering D4-1A, D4-1B, and D4-1C.

Payment behavior:

No payment.

## 6.3 D4-2 — Registered-Agent Authorization Preflight

Status:

Not started.

D4-2 begins only after D4-1 has fully passed.

It must prove, without payment:

* buyer delegation verification;
* acting-agent proof-of-possession;
* lifecycle and revocation enforcement;
* live finalized CIS-8004 resolution;
* pinned registry and module validation;
* live CIS-8 key resolution;
* complete identity-to-key binding;
* live Agent Card retrieval;
* exact-byte integrity verification;
* capability verification;
* freshness and revalidation;
* sanitized append-only audit persistence;
* buyer-policy evaluation;
* bounded-use eligibility;
* no controlled registry evidence in the positive path;
* no controlled CIS-8 evidence in the positive path;
* no controlled Agent Card evidence in the positive path;
* payment attempted false;
* receipt requested false;
* resource released false;
* and production activation false.

D4-2 must stop before payment submission.

## 6.4 D4-3 — Demo4 Final Acceptance and Viewer

Status:

Not started.

D4-3 begins only after D4-2 passes.

The successful path must use:

* the actual XCF-owned CIS-8004 identity;
* the approved live CIS-8 binding;
* the actual acting-agent private key;
* the live hosted Agent Card;
* finalized chain evidence;
* actual buyer delegation;
* normal Gateway authorization;
* the existing settlement spine;
* and no controlled positive identity evidence.

D4-3 may submit exactly one payment:

Asset:

EUDemo

Amount:

0.050101

Network:

Concordium Testnet

It must then prove:

* payment finalization;
* CRP indexing;
* CRP fulfillment;
* signed receipt issuance;
* protected-resource release once;
* bounded-use consumption once;
* replay rejection;
* final canonical-state verification;
* final audit verification;
* regression preservation;
* cleanup;
* and production activation false.

Demo4 closes after D4-3.

## 7. D4-1B Profile-Conformance Decision Gate

The D4-1B transaction is the only substantial unresolved policy and standards decision in the current baseline.

The following facts are established:

* the transaction finalized;
* the ownership proof verified locally;
* the key was registered in CIS-8;
* ownerOfKey returned the designated XCF account;
* the public key is known;
* the transaction evidence is retained;
* and no payment or CIS-8004 mutation occurred.

The following facts are not yet approved:

* whether xcf:phase5 is a proposal-conformant namespace;
* whether fetch-ai-ed25519 is a proposal-conformant proof scheme for that namespace;
* whether the namespace, key type, and proof scheme form an approved profile;
* whether the canonical message matches the approved proposal revision;
* whether an official or approved reference builder produces identical bytes;
* whether the profile may be enabled by Gateway policy;
* and whether the existing registration should be retained, superseded, or revoked.

Until this gate is resolved:

* the registration remains historical finalized evidence;
* it must not be attached to the new CIS-8004 identity;
* it must not be described as the approved canonical Demo4 profile;
* it must not be silently reused by D4-2;
* and it must not be automatically replaced or revoked.

## 8. Frozen Safety Boundaries

The following boundaries are effective immediately.

### 8.1 Project boundaries

* Phase 6 remains complete and closed.
* Demo3 remains valid.
* Demo4 remains post-Phase 6 work.
* The extension stops after D4-3.
* The finite three-rung plan is preserved.
* D4-1A, D4-1B, and D4-1C are sub-stages, not additional rungs.

### 8.2 Registry boundaries

* CIS-8004 remains the agent identity root.
* CIS-8 remains the external acting-key ownership proof.
* Existing deployed Testnet contracts are reused unless proven unusable.
* Public token 0 must not be modified.
* Token 5 must not be repurposed.
* No arbitrary existing token may be substituted for the XCF-owned Demo4 identity.
* Registry reads must use finalized state.
* No registry write may occur automatically during Gateway startup, testing, request handling, or payment execution.

### 8.3 Agent Card boundaries

* The canonical card is the exact 282-byte hosted file identified in this document.
* The Gateway must hash the bytes actually retrieved from the live HTTPS URI.
* Locally cached bytes may not replace failed live retrieval.
* Request-supplied Agent Card evidence is prohibited.
* Any byte-changing update requires an explicit update procedure and new on-chain evidence.
* The required capability remains Gateway-authored.

### 8.4 CIS-8 profile boundaries

* The approved proposal revision and proposal status must be recorded.
* Profile-specific values must be centralized.
* Unknown profile identifiers fail closed.
* Unknown proof schemes fail closed.
* Unknown key types fail closed.
* Unsupported encodings fail closed.
* No generic Ed25519 fallback is permitted.
* No mixed namespace and proof-scheme shortcut is permitted merely because the contract accepts the bytes.
* The complete ExternalKeyId must be compared, not only public-key bytes.
* The acting proof-of-possession key must match the live CIS-8 public key.
* The CIS-8 owner must match the relevant CIS-8004 owner.

### 8.5 Operational authorization boundaries

Separate explicit authorization is required before:

* creating a corrective implementation branch;
* modifying repository files;
* generating or designating a new private key;
* accessing protected private-key material;
* constructing a canonical ownership proof;
* signing;
* creating a wallet transaction;
* performing a transaction dry-run;
* submitting a CIS-8004 registration;
* submitting a CIS-8 registration;
* revoking or superseding the existing CIS-8 registration;
* submitting setExternalReference;
* staging;
* committing;
* pushing;
* creating a pull request;
* merging;
* deleting branches;
* or submitting the D4-3 payment.

A prior authorization may not be silently reused for a later operational action.

### 8.6 Payment boundaries

* D4-1 performs no payment.
* D4-2 performs no payment.
* Negative paths perform no payment.
* D4-3 may submit exactly one canonical payment.
* The existing CRP, receipt, release, and replay implementation must be reused.
* No new payment architecture may be introduced.
* Production activation remains false.

## 9. Non-Goals of the Corrective Rebaseline

This corrective work will not:

* reopen Phase 6;
* redesign the Gateway;
* introduce a new identity standard;
* introduce a private XCF replacement for CIS-8;
* introduce a DID method;
* introduce a new Agent Card schema without proven necessity;
* introduce a new capability language;
* introduce a new registry abstraction without proven necessity;
* introduce a new payment rail;
* introduce a new receipt format;
* introduce a new release mechanism;
* introduce a new replay mechanism;
* trust registration status alone;
* allow request-supplied trust evidence;
* use controlled evidence in the successful Demo4 path;
* fall back from registered evidence to controlled evidence;
* fall back from controlled evidence to registered evidence;
* operate on Mainnet;
* claim production readiness;
* or extend the plan beyond D4-3.

## 10. Immediate Corrective Sequence

The next work must proceed in this order.

### Step 1 — Freeze this rebaseline

* review this document;
* correct only factual inaccuracies;
* confirm the status ledger;
* confirm the safety boundaries;
* stage, commit, and merge through a separately authorized documentation-only workflow.

No chain action is included.

### Step 2 — Resolve D4-1B profile disposition

Prepare a no-mutation profile decision record covering:

* the authoritative CIS-8 proposal revision;
* proposal status;
* allowed identity profile;
* namespace;
* key type;
* proof scheme;
* canonical-message version;
* domain separation;
* encodings;
* byte lengths;
* approved compatibility reference;
* existing D4-1B conformity;
* and retain, supersede, revoke, or stop disposition.

No private-key access or chain action is included in the initial analysis.

### Step 3 — Prepare D4-1A registration

Only after the relevant design inputs are frozen:

* inspect the deployed CIS-8004 module and registration ABI;
* prepare the registration parameter;
* confirm external reference absent;
* confirm owner and wallet procedure;
* prepare evidence and rollback requirements;
* create a safe no-submission preflight;
* and request explicit transaction authorization.

### Step 4 — Execute and verify D4-1A

After explicit authorization:

* submit exactly one CIS-8004 registration attempt;
* wait for finalization;
* record the transaction and token ID;
* independently verify the finalized record;
* and retain sanitized evidence.

### Step 5 — Complete or correct D4-1B

Follow the approved profile disposition.

No action is taken when the existing registration is approved for retention.

A supersession or revocation path requires a separate reviewed runbook and explicit authorization.

### Step 6 — Execute and verify D4-1C

After D4-1A and D4-1B pass:

* attach the exact approved ExternalKeyId;
* wait for finalization;
* independently verify the complete relationship;
* and close D4-1 provisioning.

### Step 7 — Continue to D4-2 and D4-3

Proceed with:

* no-payment registered-agent authorization preflight;
* then exactly-one-payment final acceptance;
* then formal Demo4 closure.

## 11. Rebaseline Exit Criteria

This corrective rebaseline is complete when:

* the factual status ledger is approved;
* PR 306 is mapped to D4-0;
* Agent Card publication evidence is recorded;
* D4-1A registration is explicitly marked not performed;
* the D4-1B transaction is preserved without premature profile approval;
* D4-1C is explicitly blocked;
* tokens 0 and 5 are excluded;
* Phase 6 closure is preserved;
* the finite D4-1 through D4-3 sequence is frozen;
* authorization gates are explicit;
* no chain mutation has occurred;
* and the next action is the D4-1B profile-conformance decision.

## 12. Current Demonstrated Claim

At this rebaseline point, the project may accurately state:

The XCF project has published and independently verified a canonical Demo4 Agent Card and has completed one finalized CIS-8 external-key registration owned by the designated XCF Concordium Testnet account. The Demo4 CIS-8004 native identity has not yet been registered, the CIS-8 registration has not yet been approved as the canonical Demo4 identity profile, and no external reference, registered-agent authorization preflight, or Demo4 payment has been completed.

The project must not yet claim:

* a complete Demo4 identity;
* a Demo4 CIS-8004 token;
* a complete CIS-8004 to CIS-8 binding;
* an approved proposal-conformant Demo4 CIS-8 profile;
* registered-agent payment eligibility;
* or successful Demo4 final acceptance.

## 13. Final Rebaseline Statement

The project has recovered a clear and finite execution baseline.

The principal historical error was a stage-label and completion-assumption error:

* preparatory network normalization was treated as completed D4-1A;
* Agent Card publication occurred separately;
* CIS-8004 registration did not occur;
* and D4-1B proceeded under the assumption that D4-1A was complete.

The evidence does not indicate a failure of the Phase 6 architecture, Demo3, the Gateway settlement path, CRP, receipts, release, or replay protection.

The correction is therefore targeted:

* preserve Phase 6 closure;
* preserve the verified Agent Card;
* preserve the finalized D4-1B evidence;
* resolve the CIS-8 profile decision;
* perform the missing D4-1A CIS-8004 registration under explicit controls;
* attach the approved external reference through D4-1C;
* complete the no-payment D4-2 preflight;
* complete exactly one D4-3 Testnet payment;
* and stop.

D4-1C remains blocked.

No new CIS-8004 registration is authorized by this document.

No key action, signing action, contract transaction, payment, production activation, or publication action is authorized by this document.
