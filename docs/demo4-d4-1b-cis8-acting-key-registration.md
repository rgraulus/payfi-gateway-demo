# Demo4 D4-1B — Controlled CIS-8 Acting-Key Registration

## 1. Purpose

Demo4 D4-1B provisions one fresh Demo4-specific Ed25519 acting key in the deployed Concordium Testnet CIS-8 registry.

The registration establishes an on-chain relationship between:

* the frozen Concordium owner account;
* the Demo4 agent’s public acting key;
* the controlled XCF namespace;
* the selected Ed25519 proof scheme.

D4-1B is a controlled Testnet provisioning rung. It is not a payment, authorization, settlement, resource-release, or production-activation feature.

The implementation must perform at most one live `registerExternalKey` transaction.

## 2. Position in the finite Demo4 ladder

The finite Demo4 sequence is:

1. D4-1A — CIS-8004 native identity and Agent Card

   * Completed baseline.
   * Agent Card publicly hosted and hash-pinned.
   * No CIS-8004 external reference yet.

2. D4-1B — CIS-8 acting-key registration

   * Current rung.
   * Generate one fresh Demo4 acting key.
   * Register its public key in CIS-8.
   * Do not update CIS-8004.

3. D4-1C — CIS-8004 external-reference update

   * Separate future rung.
   * Call `setExternalReference`.
   * Bind the CIS-8004 agent identity to the CIS-8 acting key registered here.

4. D4-2 — Registered-agent authorization preflight

   * Exercise the composed registration and authorization path.
   * No payment.

5. D4-3 — Final controlled acceptance

   * Exactly one `0.050101 EUDemo` Concordium Testnet payment.
   * Final cross-system acceptance.

This ladder is finite and must not be expanded without explicit re-baselining.

## 3. Goal

D4-1B must register one fresh, recoverable, Demo4-specific Ed25519 acting key in the deployed Concordium Testnet CIS-8 contract and produce sanitized, reproducible evidence that:

* the key was generated through the existing Phase 5 key-bundle workflow;
* the public key belongs to the frozen Demo4 agent identity;
* the corresponding private key remained local, ignored, and untracked;
* the agent private key signed the correct CIS-8 canonical message;
* the frozen Concordium owner wallet submitted the registration;
* the transaction finalized successfully;
* exactly one matching `ExternalKeyRegistered` event was emitted;
* a finalized `ownerOfKey` query resolved the acting key to the expected owner;
* no payment occurred;
* no CIS-8004 mutation occurred;
* no production activation occurred.

## 4. Explicit non-goals

D4-1B must not:

* make an x402 payment;
* transfer EUDemo;
* transfer CCD except unavoidable Testnet transaction fees;
* update the CIS-8004 agent identity;
* call `setExternalReference`;
* modify the hosted Agent Card;
* change Gateway runtime behavior;
* change authorization behavior;
* change resource-release behavior;
* change settlement behavior;
* change receipt behavior;
* change replay protection;
* change database persistence;
* add a database migration;
* introduce production activation;
* add a dependency;
* modify `package-lock.json`;
* register the old static Phase 5 fixture key;
* perform D4-1C, D4-2, or D4-3 work.

## 5. Frozen trust anchors

### 5.1 Network

Canonical internal network:

`ccd:4221332d34e1694168c2a0c0b3fd0f27`

Accepted compatibility aliases may be normalized through the existing Phase 6 network-normalization seam, but only the canonical value may be emitted.

Official Concordium Testnet node:

* Host: `grpc.testnet.concordium.com`
* Port: `20000`
* TLS: required

The controlled live path must not fall back to:

* a local node;
* an insecure node;
* Concordium Mainnet;
* an alternate network;
* a temporary fixture;
* controlled evidence after live evidence fails.

The full 32-byte Testnet genesis hash must be resolved from consensus at runtime and used in the CIS-8 canonical message.

The full genesis hash must not be confused with the shorter canonical CAIP-style network identifier.

### 5.2 CIS-8 registry

* Contract address: `<12801,0>`
* Contract name: `CIS-8`
* Module reference: `5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da`
* Registration entrypoint: `registerExternalKey`
* Ownership query: `ownerOfKey`
* Expected schema version: `3`

Any contract, module, schema, or entrypoint mismatch is a hard stop.

### 5.3 Frozen owner

Concordium owner account:

`4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`

The wallet export used during controlled execution must contain this exact address.

The wallet address must be compared before signer construction or transaction construction.

A mismatch is a hard stop.

### 5.4 Agent identity

* Display name: `XCF Demo4 Registered Agent`
* Logical agent ID: `agent:xcf:demo4:registered`
* Capability: `resource.premium.read`
* Production status: `false`
* Identity status: `Active`

Proposed Demo4 acting-key ID:

`agent-key:xcf:demo4:registered:ed25519-1`

This identifier must be explicitly confirmed before the irreversible key-generation ceremony.

The old fixture identifier `agent-key-demo-001` must not be reused.

### 5.5 External-key profile

* Namespace: `xcf:phase5`
* Key type: `ed25519`
* Proof scheme: `fetch-ai-ed25519`
* Registration metadata: empty list

The namespace is an XCF-controlled extension. It must not be represented as a universally standardized CIS-8 or CAIP namespace.

The proof-scheme identifier is included in the signed canonical message and must remain unchanged across:

* local signing;
* signed dry-run;
* transaction execution;
* finalized evidence;
* D4-1C external-reference construction;
* D4-2 authorization preflight;
* D4-3 final acceptance.

## 6. Fresh-key requirement

The existing Phase 5 static fixture public key is not eligible for on-chain registration.

Its characteristics are:

* Ed25519;
* 32 bytes;
* every byte equal to `0x07`;
* base64url value `BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc`.

No recoverable matching private key was established for that fixture.

The implementation must therefore:

1. Generate one fresh Demo4-specific Ed25519 key bundle.
2. Use the existing Phase 5 key-bundle helper directly.
3. Store the bundle only under `keys/demo4-d4-1b/`.
4. Keep that directory ignored, local, and untracked.
5. Retain the same generated key through D4-3.
6. Refuse overwriting or regenerating an existing complete bundle.
7. Delete the ceremony material only after D4-3 and separate explicit cleanup authorization.

The existing Demo2 wrapper must not be used because its exit trap deletes its temporary key directory.

## 7. Key-ceremony rules

The key ceremony must satisfy all of the following:

* explicit authorization is obtained before generation;
* the confirmed agent ID is used;
* the confirmed Demo4 agent-key ID is used;
* the output directory does not already exist;
* the helper creates the files exclusively;
* private key material is never printed;
* private JWK fields are never emitted into public output;
* the public key is verified as Ed25519;
* the public key is exactly 32 bytes;
* the public key is not the static `0x07` fixture;
* the generated manifest contains no private JWK field;
* the associated private PEM remains local;
* the same key is reused throughout the remaining Demo4 rungs.

The ceremony must not pass private key material through:

* command-line arguments;
* environment variables;
* tracked files;
* logs;
* evidence artifacts;
* process-environment dumps.

## 8. CIS-8 ABI

### 8.1 Registration entrypoint

Contract receive name:

`CIS-8.registerExternalKey`

### 8.2 Registration parameter

The registration parameter contains:

* `external_key`

  * `namespace`
  * `key_type`
  * `public_key`
* `proof`

  * `scheme`
  * `signature`
* `metadata`

The final parameter must be serialized through the deployed embedded module schema.

The implementation must not manually encode the final contract parameter when schema-based serialization is available.

### 8.3 Return value

`registerExternalKey` has no declared return value.

Successful registration must not be inferred from a returned key identifier or ownership object.

Authoritative success requires all three of the following:

1. Successful transaction finalization.
2. Exactly one matching `ExternalKeyRegistered` event.
3. A finalized `ownerOfKey` query returning the frozen owner.

### 8.4 Registration event

* Event tag: `231`
* Event name: `ExternalKeyRegistered`

Expected event fields:

* `owner`
* `external_key`
* `proof_scheme`
* `metadata`

Expected nested external-key fields:

* `namespace`
* `key_type`
* `public_key`

Metadata items, when present, contain:

* `key`
* `value`

For D4-1B, metadata must be exactly an empty list.

## 9. Canonical proof construction

The acting-key private key signs the raw CIS-8 canonical message using Ed25519.

The canonical message binds at least:

* the `CIS-8/v1/canonical` domain;
* the 32-byte owner account;
* the CIS-8 contract index;
* the CIS-8 contract subindex;
* the full 32-byte Concordium Testnet genesis hash;
* the controlled external namespace;
* the external-key namespace;
* the key type;
* the public key;
* the proof scheme.

The implementation must preserve the validated CIS-8 integer encoding and length-prefix rules.

Ed25519 signing requirements:

* sign the raw canonical message;
* do not manually pre-hash the message;
* do not specify an RSA, ECDSA, or digest algorithm;
* do not convert the Ed25519 signature to another format;
* do not include the generated signature in tracked evidence.

Required local validation sequence:

1. Import the agent private PKCS#8 PEM.
2. Derive the public key from the private key.
3. Export or normalize the derived public key as an Ed25519 JWK.
4. Compare the derived public JWK with the manifest JWK.
5. Build the canonical message deterministically.
6. Sign the raw canonical message.
7. Verify the signature locally with the derived public key.
8. Build the registration parameter.
9. Run a read-only `registerExternalKey` invocation using the frozen owner as invoker.
10. Require successful invocation before transaction construction.

Failure of the signed dry-run is a hard stop.

## 10. Execution modes

The controlled script exposes exactly three explicit modes.

### 10.1 Inspect mode

Mode value:

`inspect`

This is the default mode.

Allowed behavior:

* read the public key-bundle manifest;
* inspect the public JWK;
* normalize the network;
* connect to the official Testnet endpoint;
* verify the contract instance;
* verify the module reference;
* verify the schema and required entrypoints;
* verify the owner account exists;
* query `ownerOfKey`;
* derive public-only hashes and fingerprints;
* report sanitized public inspection results.

Forbidden behavior:

* reading a private PEM;
* reading a wallet export;
* constructing an account signer;
* creating a signature;
* constructing a transaction;
* signing a transaction;
* submitting a transaction;
* writing tracked evidence.

### 10.2 Signed-preflight mode

Mode value:

`signed_preflight`

This mode requires explicit authorization for local private-key access.

Allowed behavior:

* everything permitted in inspect mode;
* resolve and validate the private PEM path;
* read the private PEM;
* derive and compare the public key;
* build the canonical message;
* create the Ed25519 proof;
* verify the proof locally;
* perform a signed read-only `registerExternalKey` invocation;
* capture dry-run energy usage;
* calculate a bounded transaction-energy allowance.

Forbidden behavior:

* reading a wallet export;
* constructing a Concordium account signer;
* constructing a live transaction;
* signing a live transaction;
* submitting a transaction;
* writing finalized registration evidence.

### 10.3 Execute mode

Mode value:

`execute`

This mode requires separate explicit authorization for:

* wallet reading;
* account-signer construction;
* transaction construction;
* transaction signing;
* transaction submission;
* the one Testnet CIS-8 state mutation.

Execute mode must:

1. Repeat all public inspection checks.
2. Repeat all signed-preflight checks.
3. Read the wallet only after those checks pass.
4. Compare the wallet address before constructing the signer.
5. Re-query `ownerOfKey`.
6. Require that the acting key remains unregistered.
7. Re-run the signed dry-run at the latest finalized block.
8. Construct one zero-amount `registerExternalKey` update.
9. Sign and submit exactly once.
10. Wait for finalization.
11. Validate the finalized update summary.
12. Decode and validate the registration event.
13. Run and validate the finalized `ownerOfKey` post-query.
14. Build sanitized evidence.
15. Write evidence only to the explicitly approved path.

There must be no automatic retry after an ambiguous submission result.

## 11. Activation contract

The controlled script uses the following environment contract:

* `DEMO4_D4_1B_MODE=inspect|signed_preflight|execute`
* `DEMO4_D4_1B_PRIVATE_KEY_READ_ENABLED=true`
* `DEMO4_D4_1B_WALLET_READ_ENABLED=true`
* `DEMO4_D4_1B_EXECUTION_ENABLED=true`
* `DEMO4_D4_1B_TESTNET_ONLY=true`
* `DEMO4_D4_1B_KEY_BUNDLE_PATH=<path>`
* `DEMO4_D4_1B_WALLET_PATH=<path>`
* `DEMO4_D4_1B_EVIDENCE_PATH=<path>`

Boolean activation values must use exact literal matching.

Only the exact string `true` is accepted.

The following must not be treated as true:

* `1`
* `yes`
* `on`
* `TRUE`
* `True`
* any non-empty string
* any omitted value

Execute mode must fail unless all applicable gates are exactly `true`.

There must be:

* no implicit mode selection;
* no hidden live fallback;
* no reuse of production activation flags;
* no controlled-evidence fallback after a live failure.

## 12. Pure-core boundary

The core module is:

`src/phase6/demo4Cis8ActingKeyRegistration.ts`

It must remain side-effect-free.

It may contain:

* frozen D4-1B constants;
* public types;
* canonical-message construction;
* manifest validation;
* public-key validation;
* registration-parameter construction;
* schema-location helpers;
* registration-event decoding and validation;
* ownership-postcondition validation;
* evidence sanitization;
* deterministic evidence canonicalization;
* evidence hashing;
* activation and mode validation;
* explicit safety-boundary declarations.

It must not:

* read environment variables;
* read files;
* write files;
* connect to a network;
* read a wallet;
* import a private PEM from disk;
* construct a signer;
* submit a transaction;
* mutate a database;
* interact with Gateway runtime;
* perform a payment;
* decide authorization;
* release a resource;
* issue a receipt;
* perform settlement;
* mutate replay state.

Recommended safety declaration:

* no payment;
* no CIS-8004 mutation;
* no external-reference mutation;
* no Gateway runtime release;
* no production activation;
* no database persistence;
* no replay mutation;
* no receipt issuance;
* no settlement;
* no authorization decision;
* no wallet access by the core module;
* no private-key persistence by the core module.

## 13. Controlled-script boundary

The controlled script is:

`scripts/demo_phase6_demo4_cis8_acting_key_registration.ts`

All side effects belong in this script.

Its responsibilities include:

* mode selection;
* exact activation-gate enforcement;
* safe environment reads;
* bounded filesystem reads;
* public manifest loading;
* private-path containment checks;
* symlink and path-escape refusal;
* Testnet connection;
* consensus and finalized-block queries;
* contract and schema loading;
* `ownerOfKey` queries;
* private PEM import in authorized signed-preflight and execute modes;
* wallet parsing in authorized execute mode;
* signer construction after owner verification;
* signed read-only invocation;
* bounded energy calculation;
* exactly-one-transaction submission;
* finalization wait;
* update-summary validation;
* contract-log extraction;
* event decoding;
* post-registration ownership query;
* sanitized evidence output.

The script must not be imported into Gateway runtime.

## 14. Existing seams to reuse

The implementation should reuse:

* the Phase 6 Concordium network-normalization seam;
* the existing Phase 5 key-bundle generator;
* existing Phase 5 public-JWK and identity-continuity concepts;
* `parseWallet`;
* `buildAccountSigner`;
* `Contract.create`;
* `serializeUpdateContractParameters`;
* `invokeContract` or `contract.dryRun.invokeMethod`;
* `createAndSendUpdateTransaction`;
* `waitForTransactionFinalization`;
* `isUpdateContractSummary`;
* `getSummaryContractUpdateLogs`;
* `parseRawModuleSchema`;
* `ContractEvent.parseWithSchemaType`;
* `deserializeReceiveReturnValue` for `ownerOfKey`.

Do not duplicate network normalization, wallet parsing, or established key-bundle logic.

Do not use `concordium-client` 9.1.4 for current Testnet ABI discovery or live execution.

Use the direct `@concordium/web-sdk` path.

## 15. Public inspection sequence

Inspect mode must perform the following sequence:

1. Validate the selected mode.
2. Validate applicable activation flags.
3. Require the Testnet-only declaration.
4. Read the public key-bundle manifest.
5. Validate the manifest schema.
6. Validate the agent ID.
7. Validate the confirmed agent-key ID.
8. Validate the public JWK.
9. Require `OKP`.
10. Require curve `Ed25519`.
11. Require a 32-byte public key.
12. Reject a private JWK field.
13. Reject the static `0x07` fixture key.
14. Normalize the configured network.
15. Require canonical Concordium Testnet.
16. Connect to the official Testnet node using TLS.
17. Obtain the latest finalized block.
18. Obtain consensus information.
19. Resolve the full 32-byte genesis hash.
20. Load CIS-8 instance information.
21. Require contract `<12801,0>`.
22. Require the pinned module reference.
23. Load the embedded schema.
24. Parse the schema as version 3.
25. Require contract name `CIS-8`.
26. Require `registerExternalKey`.
27. Require `ownerOfKey`.
28. Require an event schema.
29. Query `ownerOfKey`.
30. Require the acting key to be unregistered.

Inspect mode must stop before any secret or wallet access.

## 16. Signed-preflight sequence

Signed-preflight mode must:

1. Complete the full public inspection.
2. Require `DEMO4_D4_1B_PRIVATE_KEY_READ_ENABLED=true`.
3. Resolve the private PEM path from the key-bundle manifest.
4. Require the path to remain within the approved ceremony directory.
5. Refuse symlinks.
6. Refuse path traversal.
7. Refuse path escape after canonical path resolution.
8. Import the PKCS#8 private PEM.
9. Derive its Ed25519 public key.
10. Normalize the derived public JWK.
11. Require exact equality with the manifest public JWK.
12. Build the CIS-8 canonical message.
13. Create the Ed25519 signature.
14. Verify the signature locally.
15. Construct the registration parameter.
16. Serialize the parameter through the deployed schema.
17. Invoke `registerExternalKey` read-only with the frozen owner as invoker.
18. Require invocation success.
19. Capture energy used.
20. Calculate a bounded transaction allowance.
21. Refuse execution if the energy exceeds the documented cap.

Signed-preflight mode must not read the wallet or construct a transaction.

## 17. Controlled execution sequence

Execute mode must follow this order:

1. Complete the full public inspection.
2. Complete the full signed preflight.
3. Require `DEMO4_D4_1B_WALLET_READ_ENABLED=true`.
4. Require `DEMO4_D4_1B_EXECUTION_ENABLED=true`.
5. Read the wallet export.
6. Parse the wallet.
7. Require exact wallet-address equality with the frozen owner.
8. Construct the account signer only after the address match.
9. Re-query `ownerOfKey`.
10. Require the acting key to remain unregistered.
11. Obtain the latest finalized block.
12. Re-run the signed dry-run.
13. Require dry-run success.
14. Require acceptable bounded energy.
15. Construct one update transaction.
16. Use entrypoint `registerExternalKey`.
17. Attach zero CCD to the contract update.
18. Use the frozen owner as sender.
19. Use a bounded energy allowance.
20. Use a default or explicitly bounded expiry.
21. Sign the update.
22. Submit exactly once.
23. Retain the transaction hash immediately.
24. Wait for transaction finalization.
25. Require successful account-transaction finalization.
26. Require an update-contract summary.
27. Extract logs through `getSummaryContractUpdateLogs`.
28. Select logs for contract `<12801,0>`.
29. Decode logs using the deployed event schema.
30. Require exactly one matching registration event.
31. Validate every event field.
32. Query `ownerOfKey` at or after finalization.
33. Require the returned owner to equal the frozen account.
34. Build sanitized evidence.
35. Calculate the evidence hash.
36. Write evidence only to the explicitly approved local path.

No second submission is permitted.

## 18. Finalized-event requirements

The matching finalized event must contain:

### Owner

`4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`

### External key

* Namespace: `xcf:phase5`
* Key type: `ed25519`
* Public key: exact generated 32-byte acting key

### Proof scheme

`fetch-ai-ed25519`

### Metadata

Exact empty list.

### Event count

Exactly one matching `ExternalKeyRegistered` event.

The following are hard failures:

* no matching event;
* more than one matching event;
* an event from the wrong contract;
* the wrong owner;
* the wrong namespace;
* the wrong key type;
* the wrong public key;
* the wrong proof scheme;
* non-empty metadata;
* missing expected fields;
* an ambiguous decoded event.

## 19. Post-registration ownership query

After successful finalization:

1. Invoke `ownerOfKey` against finalized chain state.
2. Decode the return value using the embedded schema.
3. Require a present owner.
4. Require exact equality with the frozen owner account.
5. Record the post-query finalized block hash.
6. Record the post-query finalized block height.
7. Include the sanitized result in evidence.

Event decoding alone is not sufficient.

The ownership query alone is not sufficient.

Both must succeed and agree.

## 20. Evidence artifact

The tracked evidence file is:

`docs/evidence/demo4-d4-1b-cis8-registration-evidence.json`

It must not be created until:

* controlled execution succeeds;
* the transaction finalizes;
* the event validates;
* the ownership post-query validates;
* the sanitized evidence has been reviewed;
* creation of the tracked evidence file is authorized.

Recommended evidence fields:

* `schemaVersion`
* `ceremonyId`
* `rung`
* `environment`
* `network`
* `fullGenesisHash`
* `contractAddress`
* `contractName`
* `moduleReference`
* `entrypoint`
* `ownerAccount`
* `agentId`
* `agentKeyId`
* `externalKey`

  * `namespace`
  * `keyType`
  * `publicKeyBase64Url`
  * `publicKeyFingerprint`
* `proofScheme`
* `metadata`
* `canonicalMessageSha256`
* `preflight`

  * `finalizedBlockHash`
  * `finalizedBlockHeight`
  * `moduleMatch`
  * `ownerExists`
  * `preExistingRegistrationAbsent`
  * `localSignatureVerified`
  * `signedDryRunSucceeded`
  * `energyUsed`
* `execution`

  * `transactionHash`
  * `submittedAt`
  * `finalizedAt`
  * `finalizedBlockHash`
  * `finalizedBlockHeight`
* `event`

  * `tag`
  * `name`
  * `owner`
  * `externalKey`
  * `proofScheme`
  * `metadata`
  * `exactMatch`
* `postcondition`

  * `ownerOfKeyStatus`
  * `returnedOwner`
  * `finalizedBlockHash`
  * `finalizedBlockHeight`
  * `exactMatch`
* `safety`

  * `noPayment`
  * `noCis8004Update`
  * `noExternalReferenceUpdate`
  * `noRuntimeRelease`
  * `noProductionActivation`
* `evidenceHash`

## 21. Evidence exclusions

The evidence artifact must not contain:

* private PEM contents;
* private JWK member `d`;
* the generated Ed25519 signature;
* the raw wallet export;
* account signing keys;
* wallet credentials;
* raw secret-bearing registration parameters;
* cookies;
* tokens;
* authentication material;
* database credentials;
* raw process-environment output;
* complete environment-variable dumps;
* unnecessary local wallet paths;
* unnecessary private-key paths.

Private paths should be omitted or represented only by non-sensitive labels where needed.

Evidence must clearly state that D4-1B is controlled Concordium Testnet provisioning.

Evidence must not claim:

* production custody;
* production activation;
* universal namespace interoperability;
* payment completion;
* CIS-8004 external-reference completion;
* final Demo4 completion.

## 22. Evidence canonicalization and hashing

Evidence hashing must follow the established Phase 6 canonicalization rule:

1. Recursively sort object keys.
2. Preserve array order.
3. Omit undefined object fields.
4. Preserve `null`.
5. Serialize with `JSON.stringify`.
6. Encode as UTF-8.
7. Compute SHA-256.
8. Emit the value as `sha256:<lowercase hex>`.

The `evidenceHash` field must be computed from the canonical sanitized evidence object according to the implemented Phase 6 evidence-hash convention.

The result must be deterministic.

## 23. CI acceptance requirements

The permanent CI harness is:

`scripts/ci_phase6_demo4_cis8_acting_key_registration.ts`

It must remain pure and deterministic.

It must not:

* access Testnet;
* read a wallet;
* read a private ceremony key;
* create a signer;
* submit a transaction;
* mutate the filesystem outside explicitly scoped temporary test data;
* mutate the database;
* import Gateway payment or release paths.

### 23.1 Positive cases

The CI harness should cover:

* canonical Testnet accepted;
* supported Testnet alias normalized to canonical Testnet;
* valid public Ed25519 manifest accepted;
* derived public key equality accepted;
* deterministic canonical-message construction;
* valid local signature verification;
* correct registration event accepted;
* correct post-query owner accepted;
* empty metadata accepted;
* deterministic evidence hash;
* evidence redaction;
* inspect mode default safety;
* explicit literal activation gates.

### 23.2 Negative cases

The CI harness should reject:

* Mainnet;
* unknown network;
* malformed network;
* wrong contract;
* wrong module;
* wrong schema version;
* missing registration entrypoint;
* missing ownership query;
* missing event schema;
* wrong owner;
* the static `0x07` fixture key;
* malformed Ed25519 key;
* non-Ed25519 key;
* private JWK material;
* manifest and derived-key mismatch;
* wrong agent ID;
* wrong agent-key ID;
* unsupported proof scheme;
* wrong namespace;
* non-empty metadata;
* already-registered acting key;
* failed local signature verification;
* signed dry-run failure;
* excessive energy;
* missing matching event;
* duplicate matching event;
* wrong event owner;
* wrong event public key;
* wrong event proof scheme;
* wrong event metadata;
* post-query owner mismatch;
* non-literal activation values;
* execute mode without every gate;
* a second submission attempt;
* retry after ambiguous submission;
* secret-bearing evidence.

### 23.3 Import and safety assertions

The CI harness should confirm:

* the core module has no filesystem access;
* the core module has no network access;
* the core module has no wallet access;
* no payment helper is imported;
* no server integration exists;
* no database integration exists;
* no release module is imported;
* no settlement module is imported;
* no receipt module is imported;
* no replay-mutation module is imported;
* inspect mode does not read secrets;
* inspect mode does not read a wallet;
* inspect mode does not construct a signer;
* inspect mode does not construct a transaction;
* signed-preflight mode cannot read a wallet;
* signed-preflight mode cannot submit;
* execute mode cannot submit more than once.

## 24. Validation ladder

### Gate 1 — Repository baseline

Require:

* expected feature branch;
* clean baseline before implementation;
* expected baseline files;
* no unexpected ceremony directory;
* no frozen-file differences.

### Gate 2 — Pure implementation

Run:

* targeted TypeScript checks;
* import-boundary checks;
* canonical-message vectors;
* manifest validation cases;
* activation-gate cases;
* event-validation cases;
* evidence-redaction cases;
* evidence-hash cases.

### Gate 3 — Permanent CI harness

Run the D4-1B CI package script and require all positive and negative acceptance markers.

Confirm that the CI run performs no chain, wallet, payment, database, or runtime mutation.

### Gate 4 — Live public inspection

Run against:

* the official Testnet node;
* TLS;
* the pinned contract;
* the pinned module;
* the deployed embedded schema.

Do not read:

* the private acting key;
* the owner wallet.

Require the new acting key to be absent from `ownerOfKey`.

### Gate 5 — Authorized key generation

Before key generation:

* explicitly confirm agent ID;
* explicitly confirm agent-key ID;
* obtain authorization;
* require the ceremony directory to be absent.

After generation:

* preserve the ignored local bundle;
* inspect only public facts;
* record the public fingerprint;
* do not print private material;
* do not invoke an automatic-cleanup wrapper.

### Gate 6 — Authorized signed preflight

Before signed preflight:

* obtain private-key-read authorization.

Then require:

* manifest and derived public key equality;
* deterministic canonical message;
* valid local Ed25519 signature;
* successful signed read-only invocation;
* acceptable energy.

No wallet access is permitted.

### Gate 7 — Authorized controlled execution

Before execution, obtain explicit authorization for:

* wallet reading;
* signer construction;
* transaction construction;
* transaction signing;
* exactly one transaction submission;
* the Testnet registry mutation.

Then require:

* exact owner-wallet match;
* immediate pre-submit registration-absence check;
* immediate signed dry-run success;
* zero attached contract amount;
* bounded energy;
* exactly one submission;
* successful finalization;
* exactly one matching event;
* matching `ownerOfKey` postcondition.

### Gate 8 — Evidence review

Review:

* every evidence field;
* every exclusion;
* transaction facts;
* finalized event facts;
* post-query facts;
* evidence hash;
* safety declarations.

Create the tracked evidence file only after successful review and authorization.

### Gate 9 — Git lifecycle

Separate authorization remains required for:

* staging;
* commit;
* push;
* PR publication actions;
* merge actions;
* local branch deletion;
* remote branch deletion;
* ceremony-key cleanup.

Never use `git add .` or `git add -A`.

## 25. Hard-stop conditions

Stop immediately before submission when any of the following occurs:

* the repository is on the wrong branch;
* the worktree contains unexpected changes;
* the network is not canonical Testnet;
* TLS is not in use;
* the full genesis hash cannot be resolved;
* the CIS-8 instance is missing;
* the deployed module differs;
* the embedded schema is unavailable;
* the schema version differs;
* `registerExternalKey` is missing;
* `ownerOfKey` is missing;
* the event schema is missing;
* the owner account is missing;
* the wallet address differs from the frozen owner;
* the acting-key manifest is malformed;
* the agent ID differs;
* the agent-key ID differs;
* the acting key is the old static fixture key;
* private JWK material appears in a public artifact;
* the derived public key differs from the manifest;
* the acting key is already registered;
* local signature verification fails;
* the signed dry-run fails;
* energy exceeds the approved cap;
* any activation gate is incomplete;
* transaction construction differs from the frozen registration;
* attached contract amount is non-zero;
* submission outcome is ambiguous;
* finalization fails;
* the finalized result is not a successful update-contract summary;
* the matching event count is not exactly one;
* any event field differs;
* `ownerOfKey` differs after finalization;
* evidence contains secret material;
* a payment is observed;
* a CIS-8004 update is observed;
* `setExternalReference` is observed;
* production activation is observed.

## 26. Recovery rules

### 26.1 Failure before submission

Any failure before transaction submission is non-mutating.

Correct the implementation or input and repeat the applicable preflight.

Do not regenerate the key unless the original ceremony failed before producing a complete valid bundle.

### 26.2 Ambiguous submission with a transaction hash

When a transaction hash is available:

* do not resubmit;
* query finalization using that hash;
* determine the actual chain result;
* continue only from confirmed chain state.

### 26.3 Ambiguous submission without a transaction hash

When submission may have occurred but no hash is available:

* do not resubmit;
* query `ownerOfKey`;
* inspect recent owner-account transactions;
* inspect recent CIS-8 contract events;
* prove absence before considering any further registration attempt.

### 26.4 Finalized failure

After a finalized failure:

* retain the same key bundle;
* retain the transaction hash;
* retain sanitized failure facts;
* diagnose the reject reason;
* do not rotate the acting key automatically;
* do not retry without a new authorization decision.

### 26.5 Successful registration with evidence-generation failure

When registration succeeded but evidence creation failed:

* do not submit another transaction;
* reconstruct evidence from the finalized transaction hash;
* decode the finalized logs;
* repeat the `ownerOfKey` query;
* preserve the same acting key;
* generate the sanitized evidence from confirmed public facts.

## 27. Repository scope

Approved new implementation files:

* `src/phase6/demo4Cis8ActingKeyRegistration.ts`
* `scripts/demo_phase6_demo4_cis8_acting_key_registration.ts`
* `scripts/ci_phase6_demo4_cis8_acting_key_registration.ts`
* `docs/demo4-d4-1b-cis8-acting-key-registration.md`

Conditional post-execution evidence file:

* `docs/evidence/demo4-d4-1b-cis8-registration-evidence.json`

Approved existing-file change:

* `package.json`

The `package.json` change must add only the required D4-1B script entries.

No dependency change is permitted.

## 28. Frozen files

Unless the scope is explicitly reopened, the following must not change:

* `src/server.ts`
* `config/contracts.json`
* `package-lock.json`
* database migrations
* Gateway payment handlers
* Gateway authorization handlers
* Gateway release logic
* CRP fulfillment logic
* settlement logic
* receipt handling
* replay protection
* Phase 5 baseline fixtures
* the hosted Agent Card
* existing D4-1A files

There is no incidental-file exception.

## 29. Windows and Git Bash requirements

The operator environment is Windows with Git Bash/MSYS2.

Shell blocks should use:

`set +e`

Do not use `set -e`.

Where MSYS path conversion could interfere, use:

`export MSYS_NO_PATHCONV=1`

`export MSYS2_ARG_CONV_EXCL='*'`

Resolve Node safely when needed:

`NODE_EXE="$(type -P node.exe 2>/dev/null)"`

If unresolved:

`NODE_EXE="$(type -P node)"`

The explicit Windows executable may be used when necessary:

`/c/Program Files/nodejs/node.exe`

Do not use `cmd.exe` wrappers that may open an interactive shell or report misleading success.

When Python patches an existing repository file, always use explicit UTF-8 reads and writes and preserve line endings intentionally.

## 30. TypeScript acceptance boundary

The repository has previously shown unrelated whole-repository TypeScript errors involving `src/demo-crp-client.ts`.

D4-1B acceptance therefore uses:

* targeted strict compilation for the new core and harness;
* the permanent D4-1B CI script;
* focused imports;
* focused runtime checks.

New D4-1B errors must not be hidden behind the pre-existing repository-wide issue.

D4-1B must not expand into an unrelated whole-repository TypeScript repair.

## 31. Security statement

D4-1B uses a trusted-owner, controlled-Testnet provisioning model.

The agent private key proves possession of the external acting key.

The Concordium owner wallet authorizes the on-chain CIS-8 registration transaction.

These roles must remain distinct:

* agent key: signs the CIS-8 canonical proof;
* owner wallet: signs and submits the Concordium transaction;
* CIS-8 registry: stores the owner-to-external-key relationship;
* evidence artifact: records sanitized public proof of finalized registration.

No private key, wallet secret, raw signature, or secret-bearing parameter may be committed.

## 32. Completion criteria

D4-1B is complete only when:

* the bounded implementation exists;
* the permanent CI harness passes;
* inspect mode is non-mutating by default;
* signed-preflight mode is fail-closed;
* execute mode is fail-closed;
* one fresh Demo4 key bundle has been generated;
* the private key remains local and ignored;
* the manifest and derived public key match;
* the signed dry-run succeeds;
* exactly one live CIS-8 registration transaction is submitted;
* the transaction finalizes successfully;
* exactly one matching `ExternalKeyRegistered` event is decoded;
* `ownerOfKey` returns the frozen owner;
* sanitized evidence is reviewed;
* the tracked evidence artifact is created only after authorization;
* no payment occurred;
* no CIS-8004 mutation occurred;
* no runtime release path changed;
* no production activation occurred;
* `src/server.ts` is unchanged;
* `config/contracts.json` is unchanged;
* `package-lock.json` is unchanged;
* only approved PR files changed;
* the PR is reviewed and merged through the established manual GitHub workflow.

## 33. D4-1C handoff

D4-1B stops after successful CIS-8 acting-key registration and evidence creation.

It must not construct or submit a CIS-8004 external-reference update.

The D4-1C handoff must preserve:

* the same agent ID;
* the same agent-key ID;
* the same external-key namespace;
* the same key type;
* the same public key;
* the same proof scheme;
* the D4-1B transaction hash;
* the finalized registration event;
* the confirmed `ownerOfKey` result;
* the retained local private key bundle.

D4-1C is a separate rung, branch, scope, authorization sequence, transaction, and PR.

## Post-registration inspection and duplicate-registration safety

After a successful controlled registration, inspect mode remains a public, read-only operation.
It reports ownerOfKeyStatus as registered when the acting key resolves to the frozen owner account, and as unregistered when no owner is present.

Signed-preflight and execute modes remain fail-closed for an already registered acting key.
They reject the registered state before private-key access, signature creation, wallet access, signer construction, transaction construction, or submission.

Execute mode also performs a fresh finalized ownerOfKey query before sensitive work.
Only a fresh unregistered result permits the single signed preflight and subsequent controlled transaction path.
No automatic retry or duplicate submission is permitted.
