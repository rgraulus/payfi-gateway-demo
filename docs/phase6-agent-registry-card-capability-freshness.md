# Phase 6 Agent Registry Card Capability and Freshness Policy

## Status

This document freezes the contract implemented by PR #302:

> `phase6: verify Agent Card capability and freshness policy`

PR #302 adds a test-only, side-effect-free verification layer for Agent Card integrity, Gateway-controlled capability policy, and Agent Registry evidence freshness.

The verifier consumes:

1. a validated Agent Registry requirement;
2. the preserved verified Agent Registry trust result produced by PR #300;
3. the separately accepted identity-key-binding result produced by PR #301;
4. Gateway-authored capability mapping rules;
5. a deterministic current time;
6. an optional read-only Agent Card transport.

PR #302 does not wire this verifier into a Gateway request path and does not activate payment, settlement, receipt, replay, persistence, release, or production behavior.

## PR scope

The PR #302 implementation is limited to four files:

- `src/phase6/agentRegistryCardCapabilityFreshness.ts`
- `scripts/ci_phase6_agent_registry_card_capability_freshness.ts`
- `docs/phase6-agent-registry-card-capability-freshness.md`
- `package.json`

The package lock must remain unchanged:

```text
package-lock.json
SHA-256:
1e5f4fe8365c1f890ab75137fa7e6aff0acacdad74624b49a03de15ce1d82626
```

The permanent deterministic harness runs with:

```bash
npm run phase6:agent-registry-card-capability-freshness-test
```

## Contract boundary

PR #302 evaluates independent evidence objects rather than merging upstream trust layers.

The intended trust sequence is:

```text
PR300 preserved Agent Registry trust result
        +
PR301 accepted identity-key-binding result
        +
PR302 Agent Card, capability, and freshness verification
        =
independent PR302 verification decision
```

PR #302 does not repair a rejected upstream result.

PR #302 does not enrich or replace the preserved PR #300 result.

PR #302 returns a separate sanitized decision containing the independently verified Agent Card, capability, and freshness outcomes.

## Inputs

The verifier accepts the following logical inputs.

### Agent Registry requirement

The requirement is validated with the existing Phase 6 Agent Registry trust contract.

Relevant fields include:

- trusted registry coordinates;
- required registry status;
- `requireAgentCardIntegrity`;
- `requiredCapabilities`;
- owner-account binding policy;
- verified-owner-identity policy;
- external-key policy;
- maximum evidence age;
- optional revalidation threshold;
- optional maximum indexer lag.

### Preserved PR #300 trust result

The Agent Registry trust result must:

- be contract-valid;
- be verified;
- use reason `agent_registry_verified`;
- identify an `Active` Agent Registry record;
- match a trusted registry network;
- match a trusted registry contract;
- match the trusted module reference;
- satisfy the required owner-account policy;
- satisfy the required owner-identity policy;
- carry finalized freshness evidence.

### Accepted PR #301 identity-key-binding result

The identity-key-binding result must:

- be contract-valid;
- be test-only;
- be accepted;
- match the requirement’s external-key policy;
- state that its binding was evaluated;
- state that its base Agent Registry trust was verified;
- state that the base trust result was preserved;
- identify the same agent token;
- identify the same owner account;
- contain no side-effect claims.

### Gateway capability mappings

Capability mappings are authored by the Gateway.

The Agent Card supplies declarations only.

The Agent Card does not determine which declarations satisfy Gateway policy.

### Deterministic time

The verifier receives a deterministic current timestamp.

It does not read wall-clock time internally when calculating evidence age.

### Optional Agent Card transport

The verifier may receive a read-only Agent Card transport.

Supported implementations include:

- the deterministic fixture transport;
- the hardened HTTPS transport.

A bounded `data:application/json;base64` URI does not require a transport.

## Preserved trust layering

The PR #300 trust result must remain unenriched.

The accepted base result must retain:

```text
agentCard.integrityVerified = false

keyBinding.required = false
keyBinding.verified = false
keyBinding.bindingType = null
keyBinding.keyFingerprint = null

capabilities.required = []
capabilities.satisfied = []
capabilities.missing = []
capabilities.policySatisfied = true
```

The capability value `policySatisfied: true` is a neutral result because no capability requirements were evaluated by the preserved PR #300 layer.

It is not evidence that the PR #302 capability requirement has been satisfied.

PR #302 rejects a base trust result that attempts to pre-assert:

- verified Agent Card integrity;
- a verified external key binding;
- required capability satisfaction;
- non-empty required capability claims;
- non-empty satisfied capability claims;
- non-empty missing capability claims.

The verified CIS-8 identity-key binding remains exclusively in the separate accepted PR #301 result.

## Cross-result coherence

The verifier requires the PR #300 and PR #301 results to remain coherent.

The following values must match:

- agent token ID;
- owner account;
- trusted network;
- trusted registry contract;
- trusted registry module reference.

For required external-key policy, the PR #301 result must prove:

- reason `accepted`;
- an external key reference was present;
- registry and CIS-8 evidence came from the same snapshot;
- the CIS-8 lookup was attempted;
- the CIS-8 registration was active;
- key binding was required;
- key binding was verified;
- binding type was `CIS-8`;
- a non-null key fingerprint was returned.

For optional external-key policy, the accepted result may represent either:

- a verified CIS-8 binding; or
- `accepted_without_external_key`.

For forbidden external-key policy, the accepted result must represent:

- `accepted_without_external_key`;
- no external reference;
- no CIS-8 lookup;
- no active CIS-8 registration claim;
- no verified key binding;
- no binding type;
- no key fingerprint.

Cross-result incoherence fails before Agent Card retrieval.

Examples include:

- agent token mismatch;
- owner-account mismatch;
- snapshot mismatch;
- CIS-8 lookup not attempted;
- inactive CIS-8 registration;
- unpreserved base trust;
- unevaluated binding;
- unverified accepted binding;
- untrusted registry coordinates;
- untrusted module reference;
- forged PR #301 side-effect claims.

## Processing order

The verifier applies the following order:

1. validate the Agent Registry requirement;
2. validate the preserved PR #300 trust result;
3. require a verified and active base trust decision;
4. reject forged enrichment of the preserved trust result;
5. validate the accepted PR #301 identity-key-binding result;
6. validate Gateway capability rules;
7. validate deterministic time and transport settings;
8. enforce cross-result coherence;
9. evaluate freshness;
10. decide whether Agent Card retrieval is required;
11. retrieve exact Agent Card bytes;
12. hash the exact bytes;
13. compare the exact hash;
14. decode UTF-8;
15. parse JSON;
16. validate the consumed Agent Card subset;
17. evaluate Gateway-controlled capability rules;
18. emit a deterministic sanitized result.

Freshness and cross-result failures occur before Agent Card retrieval.

## Freshness evaluation

Freshness is evaluated before any Agent Card fetch.

The calculated evidence age is:

```text
floor((deterministicNow - observedAt) / 1000)
```

The calculated value must exactly equal the supplied `evidenceAgeSeconds`.

Freshness evidence must contain:

- a canonical observation timestamp;
- an observation timestamp that is not in the future;
- a finalized block height;
- a finalized block hash;
- source-coherent indexer lag.

## Freshness thresholds

The age thresholds are inclusive.

When a revalidation threshold is configured:

```text
age <= revalidation threshold
```

The verifier continues.

```text
revalidation threshold < age <= maximum evidence age
```

The verifier returns:

```text
status: revalidation_required
reason: agent_registry_revalidation_required
```

```text
age > maximum evidence age
```

The verifier rejects with stale evidence.

Revalidation and hard-stale decisions perform zero Agent Card fetches.

## Direct-chain freshness

For `direct_chain` evidence:

- `indexerLagBlocks` may be `null`;
- `indexerLagBlocks` may be `0`;
- a positive indexer lag is incoherent and rejected.

Direct-chain evidence must still contain finalized block height, finalized block hash, and canonical observation time.

## Auditable-resolver freshness

For `auditable_resolver` evidence:

- indexer lag is required when `maxIndexerLagBlocks` is configured;
- lag equal to the configured maximum is accepted;
- lag greater than the configured maximum is rejected;
- missing lag is rejected when the policy requires it.

## Fixture freshness

Fixture evidence is permitted only for deterministic harness coverage.

Fixture evidence does not establish:

- a live-chain success claim;
- a production registry success claim;
- production readiness.

## Agent Card requirement

An Agent Card must be retrieved and verified when either condition is true:

```text
requireAgentCardIntegrity = true
```

or:

```text
requiredCapabilities.length > 0
```

Capability verification always requires an integrity-protected Agent Card.

When neither condition is true, the verifier may return:

```text
accepted_without_agent_card
```

without fetching an Agent Card.

When retrieval is required, the preserved Agent Registry result must contain:

- an Agent Card URI;
- an expected lowercase SHA-256 hash.

A missing URI or missing hash fails closed.

## Supported URI forms

PR #302 supports:

- `https:`;
- bounded `data:application/json;base64` URIs.

PR #302 does not support:

- `http:`;
- `ipfs:`;
- `file:`;
- `ftp:`;
- `javascript:`;
- unknown URI schemes.

Unsupported schemes fail without invoking a transport.

## Data URI rules

A data URI must use the exact supported form:

```text
data:application/json;base64,<payload>
```

The payload must:

- be valid base64;
- decode within the configured byte ceiling;
- contain non-empty bytes;
- pass exact SHA-256 verification;
- pass strict UTF-8 decoding;
- contain valid JSON;
- satisfy the Agent Card consumed-field contract.

A data URI does not set `agentCardNetworkCalled` to `true`.

## Hardened HTTPS transport

The HTTPS transport performs a read-only `GET`.

It applies:

- `redirect: manual`;
- `credentials: omit`;
- no authorization-header injection;
- no cookie-header injection;
- a JSON-only `Accept` header;
- a deterministic timeout;
- a declared response-size limit;
- a streamed response-size limit.

The HTTPS URI must:

- use `https:`;
- contain no username;
- contain no password;
- contain no fragment.

The transport rejects:

- redirects;
- non-2xx HTTP status;
- unsupported media type;
- malformed `Content-Length`;
- unsafe or non-integer `Content-Length`;
- declared response size above the limit;
- streamed response size above the limit;
- missing response body;
- empty response body;
- timeout;
- fetch exception.

The accepted response media type must be:

- `application/json`; or
- an `application/*+json` media type.

Parameters such as a UTF-8 charset are permitted.

## Network-call indicator

The result includes:

```text
agentCardNetworkCalled
```

This value is `true` only when the actual hardened HTTPS transport path was invoked.

It remains `false` for:

- deterministic transport fixtures;
- `data:` URIs;
- no-card decisions;
- validation failures occurring before transport;
- freshness failures occurring before transport;
- cross-result failures occurring before transport.

## Exact-byte integrity

SHA-256 integrity is evaluated over the exact retrieved bytes.

The verifier:

1. receives exact bytes;
2. applies the byte-size ceiling;
3. computes SHA-256 over the exact bytes;
4. encodes the digest as lowercase hexadecimal;
5. compares it to the registered expected hash;
6. parses the bytes only after exact equality.

The verifier does not canonicalize JSON before hashing.

The following byte changes therefore produce different integrity evidence:

- trailing newline;
- leading newline;
- altered whitespace;
- reordered properties;
- alternate escaping;
- semantically equivalent JSON reserialization;
- any additional or removed byte.

A semantic match is not an integrity match.

## UTF-8 and JSON parsing

After hash equality, the verifier applies strict fatal UTF-8 decoding.

Invalid UTF-8 is rejected.

The verifier then applies strict JSON parsing.

Malformed JSON is rejected.

A hash match only proves that the received bytes match the registered bytes. It does not prove that those bytes form a valid Agent Card.

For that reason, malformed UTF-8 or malformed JSON may have:

```text
integrityVerified: true
```

while still producing a rejected verification decision.

## Consumed Agent Card subset

The verifier consumes a bounded Agent Card subset.

The top-level consumed fields are:

- `type`;
- `name`;
- `services`;
- optional `x402Support`;
- optional `active`;
- optional `supportedTrust`.

Each service may contain:

- `name`;
- optional `endpoint`;
- optional `version`;
- optional `skills`;
- optional `domains`.

All consumed values are subject to type, length, and array-size limits.

The Agent Card `type` must exactly match the exported PR #302 registration-file type.

Malformed consumed fields or an unsupported schema type fail closed.

An Agent Card declaring:

```json
{
  "active": false
}
```

is rejected.

## Gateway-authored capability policy

The Agent Card supplies declarations.

The Gateway supplies policy.

Each required capability must have exactly one Gateway-authored mapping rule.

Supported mapping sources are:

- `x402_support`;
- `oasf_skill`;
- `oasf_domain`.

A required capability with no mapping is rejected.

A required capability with multiple mappings is rejected.

An unsupported mapping source is rejected.

These mapping-policy failures use:

```text
agent_capability_scope_mismatch
```

## x402 capability mapping

An `x402_support` rule requires the Agent Card to declare:

```json
{
  "x402Support": true
}
```

The value must be the Boolean value `true`.

A false, missing, malformed, or inferred value does not satisfy the rule.

## OASF skill mapping

An `oasf_skill` rule requires an exact entry in a service’s `skills` array.

Matching is:

- case-sensitive;
- exact;
- whole-string.

The verifier does not permit:

- prefix matching;
- suffix matching;
- substring matching;
- wildcard matching;
- case folding.

## OASF domain mapping

An `oasf_domain` rule requires an exact entry in a service’s `domains` array.

Matching is:

- case-sensitive;
- exact;
- whole-string.

## Non-authoritative fields

The verifier does not infer capabilities from:

- Agent Card name;
- service name;
- endpoint URL;
- service version;
- descriptive text;
- URL path;
- URL host;
- `supportedTrust`;
- unrelated fields.

For example, naming a service `resource.premium.read` does not satisfy an `oasf_skill` rule unless that exact value is also present in the `skills` array.

## Duplicate declarations

Duplicate skill or domain declarations across services are rejected as ambiguous capability scope.

The failure reason is:

```text
agent_capability_scope_mismatch
```

## Missing declarations

When a valid Gateway-authored rule exists but the exact declaration is absent, the failure reason is:

```text
agent_capability_missing
```

The result identifies:

- required capabilities;
- satisfied capabilities;
- missing capabilities;
- whether policy was satisfied.

## Result status

The result status is one of:

- `accepted`;
- `rejected`;
- `revalidation_required`.

Successful reasons include:

- `accepted`;
- `accepted_without_agent_card`.

The dedicated revalidation reason is:

- `agent_registry_revalidation_required`.

Relevant rejection reasons include:

- `agent_registry_result_invalid`;
- `agent_registry_key_mismatch`;
- `agent_registry_evidence_stale`;
- `agent_registry_status_invalid`;
- `agent_card_missing`;
- `agent_card_fetch_failed`;
- `agent_card_hash_mismatch`;
- `agent_capability_missing`;
- `agent_capability_scope_mismatch`.

Where applicable, a rejected upstream Agent Registry reason is preserved rather than converted into a success reason.

## Sanitized result

The PR #302 result contains:

- requirement-validation state;
- base-trust verification state;
- identity-key-binding acceptance state;
- trust-preservation state;
- the preserved Agent Registry trust result;
- the accepted identity-key-binding result;
- sanitized Agent Card retrieval evidence;
- expected hash;
- actual hash;
- fetched byte length;
- parsed schema type;
- integrity-verification state;
- capability decision;
- freshness decision;
- HTTPS network-call indicator;
- fixed side-effect indicators.

The result does not contain:

- raw Agent Card bytes;
- base64-encoded raw Agent Card bytes;
- decoded Agent Card text;
- the parsed Agent Card object;
- authorization secrets;
- cookies;
- signing keys.

## Safety invariants

Every PR #302 result fixes the following fields to `false`:

- `gatewayRuntimeChanged`;
- `phase5StateMutated`;
- `canonicalStateMutated`;
- `boundedUseConsumed`;
- `replayStateMutated`;
- `ufxCalled`;
- `crpCalled`;
- `paymentAttempted`;
- `receiptIssued`;
- `paymentResponseEmitted`;
- `resourceReleased`;
- `transactionSubmitted`;
- `signingKeyUsed`;
- `persistenceUsed`;
- `productionActivation`.

PR #302 therefore performs no:

- Gateway runtime change;
- Gateway route change;
- Phase 5 mutation;
- canonical-state mutation;
- bounded-use consumption;
- replay mutation;
- UFX call;
- CRP call;
- payment attempt;
- receipt creation;
- payment-response emission;
- resource release;
- transaction submission;
- signing-key use;
- persistence;
- production activation.

## Permanent deterministic coverage

The permanent PR #302 harness freezes coverage for:

- canonical input validation;
- authentic preserved PR #300 trust layering;
- separate accepted PR #301 key binding;
- exact-byte Agent Card success;
- deterministic HTTPS fixture success;
- bounded data URI success;
- no-card/no-capability success;
- preserved identity and key-binding evidence;
- zero side effects;
- revalidation threshold inclusivity;
- revalidation-required behavior;
- hard maximum evidence age;
- future observation timestamp;
- calculated-age mismatch;
- direct-chain positive-lag rejection;
- auditable-resolver lag threshold;
- missing resolver lag;
- excessive resolver lag;
- missing capability mapping;
- duplicate capability mapping;
- unsupported capability mapping;
- false x402 declaration;
- case substitution;
- prefix substitution;
- duplicate Agent Card declarations;
- endpoint and description non-authority;
- OASF domain success;
- OASF domain case substitution;
- missing Agent Card URI;
- missing Agent Card hash;
- unsupported URI scheme;
- trailing-newline byte substitution;
- semantically equivalent JSON substitution;
- malformed JSON;
- malformed UTF-8;
- unsupported Agent Card schema;
- inactive Agent Card;
- malformed data URI;
- oversized Agent Card;
- invalid media type;
- raw-card leakage prevention;
- forged base key-binding enrichment;
- forged base card-integrity enrichment;
- forged base capability satisfaction;
- agent-token mismatch;
- owner-account mismatch;
- snapshot mismatch;
- missing CIS-8 lookup;
- inactive CIS-8 registration;
- unpreserved Agent Registry trust;
- unevaluated identity binding;
- unverified accepted identity binding;
- forged PR #301 side-effect claims;
- untrusted registry coordinates;
- untrusted module reference;
- hardened HTTPS verifier integration;
- HTTPS redirect rejection;
- HTTPS media-type rejection;
- declared HTTPS size rejection;
- streamed HTTPS size rejection;
- non-success HTTP status;
- malformed content length;
- credentialed HTTPS URI rejection;
- fetch exception;
- fetch timeout.

## Required regression suite

PR #302 final validation includes the frozen predecessor harnesses:

```bash
npm run phase6:agent-registry-trust-contract-test
npm run phase6:agent-registry-resolver-seam-test
npm run phase6:concordium-cis8004-registry-plugin-test
npm run phase6:agent-registry-identity-key-binding-test
npm run phase6:agent-registry-card-capability-freshness-test
```

## Out of scope

PR #302 does not:

- wire this verifier into the Gateway server;
- add or modify a route;
- alter request handling;
- release a protected resource;
- issue a receipt;
- emit a payment response;
- attempt a payment;
- call CRP;
- call UFX;
- submit a Concordium transaction;
- mutate Agent Registry state;
- mutate Phase 5 state;
- consume bounded-use state;
- mutate replay state;
- persist Agent Card content;
- persist a verification result;
- add IPFS retrieval;
- support arbitrary URI schemes;
- infer capabilities from descriptive metadata;
- activate production behavior;
- claim live success from fixture evidence.

Any later runtime integration or production activation requires a separate, explicitly scoped and reviewed change.
