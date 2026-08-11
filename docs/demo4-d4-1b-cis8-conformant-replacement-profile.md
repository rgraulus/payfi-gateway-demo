# Demo 4 D4-1B — CIS-8 Conformant Replacement Profile

## Status

**Gate 5 technical closure complete — D4-1B finalized registration verified and PR #312 execution permanently locked; Git closure remains pending.**

This document defines the proposal-conformant CIS-8 replacement registration profile for Demo 4 D4-1B.

No external key has been generated, no signature has been produced, and no Concordium transaction has been constructed or submitted during Gate 1.

## Purpose

The existing D4-1B CIS-8 registration remains preserved as historical Testnet evidence, but it is not the canonical profile for attachment to CIS-8004 token `287`.

The replacement registration defined here is based on the current Concordium CIS-8 proposal and uses a Solana Devnet Ed25519 identity profile.

D4-1C attachment remains a separate, blocked step.

## Fixed Five-Gate Ladder

The D4-1B replacement work follows this finite ladder:

1. **Gate 1 — freeze exact replacement profile and expected parameter**
2. **Gate 2 — offline contract tests and side-effect-free dry run**
3. **Gate 3 — public/private preflight and exactly-one-submission authorization**
4. **Gate 4 — one controlled Testnet registration**
5. **Gate 5 — finalized evidence, regression, documentation, and commit**

This pull request must not expand that ladder.

## Normative Source Pins

Gate 1 freezes the following source observations:

| Source                                  | Frozen value                                                       |
| --------------------------------------- | ------------------------------------------------------------------ |
| CIS-8 profile                           | `cis8_draft_2026_05_25`                                            |
| CIS-8 status                            | `Draft`                                                            |
| CIS-8 URL                               | `https://proposals.concordium.com/CIS/cis-8.html`                  |
| CIS-8 HTML SHA-256                      | `6216474e04464b33de77dd79df8d90d9fe231635aacd4ecf89507e1d2c74546b` |
| Solana CAIP-2 URL                       | `https://namespaces.chainagnostic.org/solana/caip2`                |
| Solana CAIP-2 HTML SHA-256              | `5598020d520135b0b1d84ad89833785eb7f425b40620941e02d29b69165a12ad` |
| Solana Devnet RPC                       | `https://api.devnet.solana.com`                                    |
| Solana Devnet genesis hash              | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`                     |
| Derived Solana Devnet CAIP-2 identifier | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`                          |
| Observation date                        | `2026-08-03`                                                       |

All normative and network source pins must be checked again at Gate 3 before any private-key use or submission authorization.

## Frozen Replacement Profile

| Field                    | Frozen value                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| Profile ID               | `xcf.demo4.d4-1b.cis8.solana-devnet.conformant-replacement.v1`     |
| External blockchain      | `solana`                                                           |
| External network         | `devnet`                                                           |
| External namespace       | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`                          |
| External-key namespace   | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`                          |
| External-key type        | `ed25519`                                                          |
| Public-key length        | `32` bytes                                                         |
| Proof scheme             | `solana-ed25519`                                                   |
| Signature length         | `64` bytes                                                         |
| Metadata entries         | `0`                                                                |
| Concordium network       | `ccd:4221332d34e1694168c2a0c0b3fd0f27`                             |
| CIS-8 contract           | `<12801,0>`                                                        |
| Contract name            | `CIS-8`                                                            |
| Module reference         | `5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da` |
| Registration entrypoint  | `registerExternalKey`                                              |
| Ownership entrypoint     | `ownerOfKey`                                                       |
| Owner account            | `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`               |
| Canonical domain         | `CIS-8/v1/canonical`                                               |
| String length prefix     | 2-byte little-endian                                               |
| Bytestring length prefix | 2-byte little-endian                                               |
| CIS-8004 token           | `287`                                                              |

The external namespace and external-key namespace are intentionally identical.

Runtime profile overrides are not permitted.

## Expected Parameter Contract

The expected `registerExternalKey` parameter contains:

1. External-key namespace
2. External-key type
3. External public key
4. Proof scheme
5. Proof signature
6. Metadata

The canonical signing message contains the following fields in order:

1. Canonical domain
2. Concordium owner account bytes
3. CIS-8 contract index
4. CIS-8 contract subindex
5. Concordium genesis hash
6. External namespace
7. External-key namespace
8. External-key type
9. External public key
10. Proof scheme

The canonical message is signed directly with the Solana Ed25519 key.

Gate 1 does not contain an actual public key or signature. The actual registration parameter remains pending Gate 3 key and signature preparation.

## Deterministic Gate 1 Vector

Gate 1 uses sanitized deterministic bytes only.

| Vector                         | Frozen result                                                      |
| ------------------------------ | ------------------------------------------------------------------ |
| Canonical-message length       | `239` bytes                                                        |
| Canonical-message SHA-256      | `cfed230d434a028f043d30423d94b92339ddb0094085d118a3d5941c9316f23a` |
| Registration-parameter length  | `168` bytes                                                        |
| Registration-parameter SHA-256 | `547be748447fd7d34fed085fa7815a1f3125184caf5d331a45abdcc47d28e13f` |

The evidence artifact intentionally excludes the raw deterministic public-key and signature vectors.

## Historical Registration Disposition

The existing CIS-8 registration is classified as:

`SUPERSEDE_BEFORE_D4_1C`

The existing registration:

* remains on-chain;
* remains preserved as historical Testnet evidence;
* is not treated as the canonical CIS-8 profile;
* must not be attached to CIS-8004 token `287`;
* is not authorized for immediate revocation;
* does not authorize D4-1C to proceed.

CIS-8004 token `287` remains unchanged.

## Controlled Flexibility and Drift Policy

The implementation supports versioned adapters for:

* the normative CIS-8 profile;
* canonical-message construction;
* parameter serialization;
* proof handling;
* deployed-contract compatibility.

The implementation must fail closed on:

* CIS-8 normative-source drift;
* Solana CAIP-2 source drift;
* Solana Devnet genesis drift;
* deployed CIS-8 contract-schema drift.

Any material change requires:

1. renewed Gate 1 review;
2. updated deterministic Gate 2 vectors and tests;
3. renewed Gate 3 public/private preflight;
4. renewed explicit authorization before Gate 4.

Flexibility must not become an implicit runtime override.

## Gate 1 Validation

The permanent Gate 1 CI harness completed successfully with:

* `10` tests passed;
* `0` tests failed;
* `10` accepted cases;
* `19` rejection cases;
* exact source-pin validation;
* exact replacement-profile validation;
* historical and nonconformant-profile rejection;
* exact canonical-vector validation;
* exact parameter-vector validation;
* malformed key- and signature-length rejection;
* static side-effect-free validation.

## Safety Boundary

During Gate 1:

* no environment-dependent profile override was read;
* no private key was read;
* no wallet was read;
* no key was generated;
* no signing was attempted;
* no signer was created;
* no contract was invoked;
* no transaction was constructed;
* no transaction was submitted;
* no CIS-8 state was mutated;
* no CIS-8004 state was mutated;
* no external reference was updated;
* no Gateway runtime was called;
* no payment or settlement was attempted;
* no receipt was issued;
* no protected resource was released;
* no production activation occurred.

## Gate 1 Artifacts

* `src/phase6/demo4Cis8ConformantReplacementProfile.ts`
* `scripts/ci_phase6_demo4_d4_1b_cis8_conformant_replacement_profile.ts`
* `docs/demo4-d4-1b-cis8-conformant-replacement-profile.md`
* `docs/evidence/demo4-d4-1b-cis8-conformant-replacement-profile.json`

Frozen artifact hashes before documentation:

| Artifact          | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Gate 1 core       | `833c38d553405e24fecf4a9243ad9136ddb1bc5a33b1be172482a9a017517c0a` |
| Gate 1 CI harness | `faa5682137cf6f31a579279daf66b7b4254c4e5e398c543535749aed438d5875` |
| Gate 1 evidence   | `5312fdb2bef4d702da5eb3bd0041bbe6eaffb11ccf1c5afa3a4095d8cf1f2ab4` |

## Next Gate

## Gate 2 — Offline Contract Tests and Side-Effect-Free Dry Run

**Gate 2 complete.**

Gate 2 exercised the frozen Gate 1 profile entirely offline using deterministic synthetic bytes.

The permanent Gate 2 harness is:

`scripts/ci_phase6_demo4_d4_1b_cis8_conformant_replacement_offline_contract.ts`

The permanent npm command is:

`npm run phase6:demo4-d4-1b-cis8-conformant-replacement-offline-contract-test`

### Offline Contract Coverage

Gate 2 verified:

* construction of the canonical CIS-8 signing message;
* construction of the `registerExternalKey` parameter;
* construction of the `ownerOfKey` lookup parameter;
* exact agreement between the lookup key and registration key;
* frozen external namespace and key namespace;
* `ed25519` external-key type;
* `solana-ed25519` proof scheme;
* empty metadata;
* deterministic repeatability;
* isolation of returned results from later input mutation;
* rejection of malformed `ownerOfKey` public-key lengths;
* static exclusion of live, private-key, signing, network, contract, and transaction surfaces.

### Gate 2 Results

| Result                               | Value  |
| ------------------------------------ | ------ |
| Tests                                | `5`    |
| Passed                               | `5`    |
| Failed                               | `0`    |
| Accepted cases                       | `10`   |
| Rejection cases                      | `3`    |
| Canonical message verified           | `true` |
| Registration parameter verified      | `true` |
| `ownerOfKey` parameter verified      | `true` |
| Deterministic repeatability verified | `true` |
| Input isolation verified             | `true` |
| Malformed lookup rejected            | `true` |
| Side-effect-free dry run             | `true` |

The frozen deterministic vector remained unchanged:

| Vector                         | Result                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| Canonical-message length       | `239` bytes                                                        |
| Canonical-message SHA-256      | `cfed230d434a028f043d30423d94b92339ddb0094085d118a3d5941c9316f23a` |
| Registration-parameter length  | `168` bytes                                                        |
| Registration-parameter SHA-256 | `547be748447fd7d34fed085fa7815a1f3125184caf5d331a45abdcc47d28e13f` |

### Gate 2 Safety Result

During Gate 2:

* no actual external public key was used;
* no actual signature was used;
* no private key was read;
* no wallet was read;
* no key was generated;
* no signing was attempted;
* no contract was invoked;
* no transaction was constructed;
* no transaction was submitted;
* no CIS-8 state was mutated;
* no CIS-8004 state was mutated;
* CIS-8004 token `287` remained unchanged;
* no D4-1C attachment was performed;
* no Gateway runtime was called;
* no payment or production path was activated.

### Gate 2 Evidence

The permanent Gate 2 evidence artifact is:

`docs/evidence/demo4-d4-1b-cis8-conformant-replacement-offline-contract.json`

Its SHA-256 at Gate 2 completion is:

`28c86a0bc09472c64a32ef460b7a7b31a0cf7469c9b0de423ae3c221ea9bd978`

## Next Gate

Gate 3 is limited to:

**public/private preflight and exactly-one-submission authorization.**

Gate 3 must fail closed unless all of the following are satisfied:

1. The pinned CIS-8 normative source is rechecked for drift.
2. The pinned Solana CAIP-2 source is rechecked for drift.
3. The Solana Devnet genesis hash is rechecked.
4. The deployed Concordium CIS-8 contract and schema are confirmed compatible.
5. The exact replacement key provenance and custody model are established.
6. The actual public key is confirmed as a 32-byte Solana Ed25519 key.
7. The canonical signing bytes are derived from the frozen profile.
8. The resulting signature is exactly 64 bytes.
9. The exact registration parameter is derived and reviewed.
10. All safety and target guards pass.
11. Explicit authorization is provided for exactly one Gate 4 Testnet submission.

Gate 3 does not itself authorize:

* a Concordium transaction submission;
* CIS-8004 token `287` mutation;
* D4-1C attachment;
* revocation of the historical registration;
* Gateway activation;
* payment, settlement, receipt, or protected-resource release.

## Gate 3 — Implementation Checkpoint

**Gates 1–3 are technically complete, and the bounded Gate 4 exactly-one-submission authorization remains recorded. Gate 4 execution is intentionally blocked on an external CIS-8 draft/deployment compatibility dependency. No transaction has been constructed, signed, or submitted.**

The replacement key was generated under restricted custody. The authorized
private preflight produced and locally verified one signature over the pinned
`cis8_draft_2026_05_25_u16` canonical message. A real read-only execution
preflight reached contract `<12801,0>` and failed safely. The failure consumed no
submission attempt and performed no wallet read, transaction construction,
transaction signing, transaction submission, CIS-8 mutation, or CIS-8004
mutation.

The permanent Gate 3 core is:

`src/phase6/demo4Cis8ConformantReplacementPreflight.ts`

The permanent Gate 3 CI harness is:

`scripts/ci_phase6_demo4_d4_1b_cis8_conformant_replacement_preflight.ts`

The permanent npm command is:

`npm run phase6:demo4-d4-1b-cis8-conformant-replacement-preflight-test`

### Implemented Gate 3 Contracts

The checkpoint implements and tests:

* public-preflight evidence validation;
* normative CIS-8 source-pin validation;
* Solana CAIP-2 and Devnet-genesis validation;
* finalized Concordium chain-state requirements;
* deployed CIS-8 contract, module, schema, owner, TLS, entrypoint, and event checks;
* replacement-key shape and live `ownerOfKey` status requirements;
* canonical-message recomputation using the frozen two-byte codec;
* expected registration-parameter length validation;
* private-preflight evidence validation;
* public/private key-binding requirements;
* exact 64-byte signature requirement;
* mandatory local signature-verification evidence;
* registration-parameter length and SHA-256 shape validation;
* exclusion of private-key, raw-signature, and wallet material from evidence;
* bounded exactly-one-submission authorization for Gate 4;
* zero prior submission attempts;
* no automatic retry;
* zero CCD requirement;
* retention of CIS-8004 token `287`;
* prohibition of D4-1C attachment and historical-registration revocation.

### Gate 3 Checkpoint Results

| Result                                      | Value  |
| ------------------------------------------- | ------ |
| Tests                                       | `45`   |
| Passed                                      | `45`   |
| Failed                                      | `0`    |
| Accepted cases                              | `4`    |
| Rejection cases                             | `41`   |
| Public-preflight validator tested           | `true` |
| Private-preflight evidence validator tested | `true` |
| One-submission handoff contract tested      | `true` |
| Static side-effect scan passed              | `true` |
| Public-preflight runner implemented         | `true` |
| Public-preflight offline CI                 | `9/9`  |
| Live public preflight executed              | `true`  |

### Checkpoint Artifact Pins

| Artifact                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| Gate 3 preflight core       | `43e9f1e652c4f853ce5174803c867ad01614dfcafcef3f4ede22691da25ee8de` |
| Gate 3 CI harness           | `cfc7abe508ba1328f0df108c41dd382981aff55ad9349c3276541427e31f41a7` |
| Public-preflight runner     | `9f45626753a1957f76b7e586aaeea9376418dbc3915e15d5eb26d57751d4da29` |
| Public-preflight CI harness | `936bac57b649be44506a8f15fb3cbbd54d366e7ad91cde2a978fd40ce26e12bc` |
| `package.json`              | `3883b1ccedd305a431048ab16d65d37c495382a2e5054915ed3c28d5c3258f15` |
| Gate 3 checkpoint evidence  | `8633d1933024d76702eaa388ffb7b7507c8250b6dee76bf7bfee84ad7013ea9f` |

The permanent implementation-checkpoint evidence artifact is:

`docs/evidence/demo4-d4-1b-cis8-conformant-replacement-preflight-implementation-checkpoint.json`

### Public-Preflight Runner Implementation

The controlled public-only runner is:

`scripts/demo_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight.ts`

Its deterministic offline CI harness is:

`scripts/ci_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight.ts`

The permanent offline command is:

`npm run phase6:demo4-d4-1b-cis8-conformant-replacement-public-preflight-test`

The runner accepts only the public environment binding
`DEMO4_D4_1B_REPLACEMENT_PUBLIC_KEY_HEX`. It contains no private-key, wallet,
signing, transaction-construction, submission, or mutation path.

The offline harness passed `9/9` tests: `7` accepted contract checks and `2`
fail-closed rejection checks. It made no network call.

### Completed Live Public Preflight and Custody

The controlled replacement key was generated as an Ed25519 key and placed
under restricted local custody outside the repository. The public-key files,
custody manifest, and file ACLs were verified. The private-key file exists,
but its contents have not been read.

The accepted live public-only preflight recorded:

* replacement public key
  `a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3`;
* public-key fingerprint
  `sha256:5d511cae7ba80cd00156857fb1d7e1f21524db131d3b4c7cf144b28f25319dee`;
* frozen CIS-8 HTML SHA-256
  `6216474e04464b33de77dd79df8d90d9fe231635aacd4ecf89507e1d2c74546b`;
* frozen Solana CAIP-2 HTML SHA-256
  `5598020d520135b0b1d84ad89833785eb7f425b40620941e02d29b69165a12ad`;
* Solana Devnet genesis
  `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`;
* finalized Concordium Testnet block height
  `46403851`;
* finalized block hash
  `ddc5b3fbec71862da5e8a68977c945f6785660b49ee6e35883d056b84640a01f`;
* CIS-8 contract `<12801,0>`;
* module reference
  `5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da`;
* live `ownerOfKey` result `unregistered`;
* actual canonical-message byte length
  `239`;
* actual canonical-message SHA-256
  `b0acea11559abd39d87a6d4a2c1ae106b346f1b3995fa59529cb7a2aadcf5d9c`;
* expected registration-parameter byte length
  `168`;
* sanitized public-preflight evidence SHA-256
  `03d74dd4c69cffbf75baf35fd2f0b69f03046353794a1a04b9ec2decf87bf9a9`;
* public-preflight runner SHA-256
  `9f45626753a1957f76b7e586aaeea9376418dbc3915e15d5eb26d57751d4da29`;
* public-preflight CI SHA-256
  `936bac57b649be44506a8f15fb3cbbd54d366e7ad91cde2a978fd40ce26e12bc`;
* Gate 3 checkpoint evidence SHA-256
  `8633d1933024d76702eaa388ffb7b7507c8250b6dee76bf7bfee84ad7013ea9f`.

The repaired public-preflight CI passes `10` tests: `8` accepted cases and
`2` rejection cases.

No private-key contents, wallet material, signature, transaction, contract
mutation, CIS-8004 mutation, D4-1C attachment, payment action, or production
activation occurred.

### Completed Controlled Private Preflight

The separately authorized controlled private preflight completed offline.

The replacement private key was read from restricted local custody solely to
derive its public key, sign the single frozen 239-byte CIS-8 canonical message,
verify that Ed25519 signature locally, and derive the expected 168-byte
registration parameter.

The accepted results are:

* public/private key binding confirmed;
* canonical-message SHA-256
  `b0acea11559abd39d87a6d4a2c1ae106b346f1b3995fa59529cb7a2aadcf5d9c`;
* signature byte length `64`;
* local signature verification `true`;
* registration-parameter byte length `168`;
* registration-parameter SHA-256
  `c66eddb8af51d38d4dadcba1d2b353c8935637052b06531e247a3c8613f7fe97`;
* private-preflight evidence SHA-256
  `2ce07e1ef8bb236a2b3089a9b6515efd8e02a906008f6f592c95d76a38675a8e`;
* private-preflight runner SHA-256
  `f878156c7d3dbe668df1fd50cdb375accca643e57b9a4c9eaa1bbacea460ebba`;
* private-preflight CI SHA-256
  `fbfbc48d2427110a90de9d8cab1146ae7960c4ecce12cba7dc499b077b0d1221`;
* Gate 3 checkpoint SHA-256
  `24499449e9d6bf4aa38673dd2b09bc0883b928aa42da26c4b01c384997fe204a`.

The evidence contains no private-key material, raw signature, or wallet
material. No network, contract invocation, transaction construction,
transaction submission, CIS-8 mutation, CIS-8004 mutation, D4-1C attachment,
historical-registration revocation, payment action, or production activation
occurred.

### Gate 4 Exactly-One-Submission Authorization

The explicit Gate 4 authorization decision has been recorded as a bounded
exactly-one controlled Concordium Testnet submission authorization.

The authorization contract establishes:

* authorization status `gate4_submission_authorized`;
* submission limit `1`;
* prior submission attempts `0`;
* remaining submission attempts `1`;
* transaction execution authorization `false`;
* automatic retry authorization `false`;
* zero CCD requirement `true`;
* CIS-8004 token 287 mutation authorization `false`;
* D4-1C attachment authorization `false`; and
* historical-registration revocation authorization `false`.

Authorization evidence and implementation hashes:

* authorization artifact SHA-256
  `92dd5c04ec0b55542418ac04655c4d17216578b4f515629d7d0f3b5d640140bc`;
* authorization runner SHA-256
  `b31440f200ae73ea2715aac166b0c7697149abefe4d7e33bab71ea98fbaa6f39`;
* authorization CI SHA-256
  `f5de0d2e527af252e04aa6e7f55c636b0fae129261e4b111251d7ea86d4c7730`;
* Gate 4 checkpoint SHA-256
  `cdb9583344a4d507f595b5a59465b4dc1f2e44b124a8d385320efb2dbe3aafa0`;
* package manifest SHA-256
  `be53945bbff5d0c360bee04423ea828c45bce0701c53e6690deb8cfb90e00322`.

This authorization does not itself construct, sign, or submit a transaction.
A controlled Gate 4 execution preflight remains separately authorization-gated.

### Actual Gate 3 State

The following Gate 3 facts are now established:

* all frozen public sources and network trust anchors were rechecked;
* the finalized Concordium CIS-8 contract was inspected;
* the replacement key was observed live as `unregistered`;
* the replacement Ed25519 key was generated under restricted custody;
* the private key was read only during the authorized offline preflight;
* the replacement public/private key binding was confirmed;
* one canonical CIS-8 signature was generated;
* the signature was verified locally;
* the 168-byte registration parameter was derived;
* no wallet material was read;
* no transaction was constructed or submitted; and
* the bounded Gate 4 exactly-one-submission authorization remains recorded, while transaction execution authorization remains `false`.

### Gate 3 and Gate 4 Parking Safety Checkpoint

At this formally parked checkpoint:

* the pinned May 25, 2026 CIS-8 draft remains the normative target;
* the replacement key exists under restricted custody;
* the authorized private preflight read the replacement private key;
* one draft/u16 canonical message was signed and verified locally;
* the recorded draft/u16 canonical message is `239` bytes;
* the equivalent deployed/u32 canonical message is `249` bytes;
* the two canonical messages are not byte-equivalent and do not share a hash;
* the normative registration parameter is `168` bytes;
* the deployed embedded-schema serialization is `180` bytes;
* one real read-only `registerExternalKey` dry-run reached `<12801,0>` and was rejected;
* the exact live reject code was not captured and is not inferred as finalized evidence;
* the failed read-only dry-run consumed no transaction-submission attempt;
* the exactly-one-submission authorization remains preserved;
* no wallet material was read;
* no transaction was constructed, signed, or submitted;
* no CIS-8 or CIS-8004 state was mutated;
* CIS-8004 token `287` remains unchanged;
* no D4-1C attachment was performed;
* the historical registration remains retained; and
* no Gateway, payment, settlement, receipt, release, or production path was activated.

The deployed contract and the pinned draft expose compatible logical surfaces
but materially different parameter and canonical-proof codecs. PR #312 remains
fail-closed while awaiting a draft-compatible Testnet target, reproducible
contract artifact, or authoritative compatibility guidance from Concordium.

This parking checkpoint does not change the five-gate scope. Gate 4 still
requires exactly one controlled Concordium Testnet registration with no
automatic retry, followed by the Gate 5 finalized evidence and permanent
execution lock.
## Next Controlled Step

The next required step is to obtain one of the following from Concordium:

1. a Testnet CIS-8 contract compatible with the pinned
   `cis8_draft_2026_05_25_u16` profile;
2. reference contract source or a reproducible Wasm artifact implementing that
   profile; or
3. authoritative compatibility guidance identifying the approved execution
   profile and target.

After receiving that input, Gate 3 compatibility checks and the controlled
execution preflight must be renewed before Gate 4. The existing authorization
continues to permit at most one controlled Testnet registration, with no
automatic retry. Until the compatibility dependency is resolved, no
transaction may be constructed, signed, or submitted.

PR #312 remains in progress under its unchanged five-gate scope. This is a
green, intentional external-dependency parking checkpoint—not PR completion and
not a validation or regression failure.

## Gate 5 Closure — Finalized Replacement Registration and Permanent Execution Lock

### Historical parking checkpoint superseded

The preceding compatibility-parking checkpoint is retained above as a historical record of the fail-closed state that existed before authoritative compatibility guidance was received.

That checkpoint was superseded by direct Concordium clarification that the intended CIS-8 framing uses four-byte/u32 little-endian length fields. PR #312 therefore rebaselined the replacement profile to that clarified framing before any live submission occurred.

The resulting frozen replacement registration uses:

* canonical-message byte length `249`;
* canonical-message SHA-256 `0ddf866d95e84776c45fc2b0dd831e2e3ebe1fde74a18de7a689e4c47ea7e288`;
* registration-parameter byte length `180`; and
* registration-parameter SHA-256 `e00d66de097b671ae9fdec63779bd75907ecefa036299ef338b380e6996384d1`.

### Gate 4 finalized registration

The single authorized Gate 4 Concordium Testnet registration completed successfully.

Finalized anchors:

* transaction hash `24101c5247e753dcf2c0efae9e924ddefad6f2004e9a3814118caece5e2c2cb9`;
* finalized block hash `b6f16b9f149a63acbd7db09e511f0048e8d910d8406c7219c4b0f06b5c4bdc7a`;
* finalized block height `46671596`;
* CIS-8 contract `<12801,0>`;
* deployed module reference `e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61`;
* replacement public key `a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3`;
* owner `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`;
* finalized `ownerOfKey` status `registered`; and
* finalized controlled-execution evidence SHA-256 `03b7a9f810d1a27ef0dbc6dd1278053848029dd903b64d9d81e409dfb68bce9c`.

Exactly one submission attempt was used. The submission allowance is exhausted (`1/1` used, `0` remaining), and no automatic retry occurred or is permitted.

### Independent Gate 5 finalized-state verification

Gate 5 performed a separate fresh, public, read-only Concordium Testnet verification after the Gate 4 transaction had finalized.

The independent snapshot was:

* finalized block hash `e27250d8ca263524dff2f5bfff3b30fe9606371c270f8e9bffcf887d5bd76839`;
* finalized block height `46678224`; and
* later than the Gate 4 finalization height `46671596`.

At that fresh finalized snapshot:

* `<12801,0>` still resolved to module `e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61`;
* the replacement public key remained `registered`;
* `ownerOfKey` returned the expected owner `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`; and
* the read performed no wallet access, private-key access, signing, transaction construction, transaction submission, CIS-8 mutation, CIS-8004 mutation, payment action, or production activation.

The sanitized Gate 5 verification artifact is:

* `docs/evidence/demo4-d4-1b-cis8-conformant-replacement-gate5-final-verification.json`
* SHA-256 `658d03009ab86475a241490d24b41a894a2e2b9c484088e0cf7a563997469bb2`.

### Permanent PR #312 execution lock

After the successful Gate 4 registration, the PR #312 live execution path was permanently locked as an XCF software safety control.

The lock has two regression-enforced layers:

* `EXECUTE_DISPATCH_ENABLED` is permanently `false`; and
* the operator-facing live controlled-execution npm entry point has been removed.

The controlled-execution test entry point remains available for regression coverage.

Current closure-hardening verification also records:

* controlled-execution regression suite: `19/19`;
* durable execution-preflight runner output promoted to `docs/evidence/demo4-d4-1b-cis8-conformant-replacement-execution-preflight-runner-output.json` (SHA-256 `b8730931e33fc0fe93e7d3b60b43817605ca06a2d8f873613b0703994bb1b366`); and
* current PR #312 implementation references to `.backups/pr312-*`: `0`.

The implementation retains one physical transaction-submission call as historical implementation machinery, but the PR #312 execution dispatch is locked and the live npm operator surface is absent.

The full Gate 5 regression matrix independently reconfirmed both lock layers after the finalized registration.

This permanent execution lock is an XCF/PR #312 software fuse. It does not claim that the Concordium registry entry itself can never be changed by some separately authorized future transaction.

### Full PR #312 Gate 5 regression

The complete bounded PR #312 Gate 5 regression matrix has passed.

Regression result:

* selected CI-only package scripts: `10`;
* passed scripts: `10`;
* failed scripts: `0`;
* initial guard failure: `false`;
* full regression failure: `false`;
* frozen surfaces changed: `false`;
* worktree changed by regression: `false`;
* Gate 5 evidence changed by regression: `false`;
* closure document changed by regression: `false`;
* execute dispatch locked: `true`;
* live controlled-execution npm entry point present: `false`;
* transaction-submission command run: `false`;
* Gate 4 submission attempts used: `1`;
* Gate 4 submission attempts remaining: `0`.

The passing matrix covered:

* controlled-execution authorization, finalized-evidence validation, and permanent-lock enforcement;
* execution dry-run;
* execution preflight;
* Gate 4 authorization;
* offline contract construction;
* public/private preflight core validation;
* controlled private-preflight regression;
* frozen replacement profile and four-byte/u32 codec;
* public-preflight fail-closed behavior; and
* the historical D4-1B profile-conformance decision.

The permanent controlled-execution harness passed `18/18` tests.

No selected regression invoked the live execution entry point or consumed a transaction-submission attempt.

`src/server.ts`, `config/contracts.json`, and `package-lock.json` remained unchanged.

`git diff --check` passed.

### D4-1B closure state

D4-1B on-chain provisioning, independent Gate 5 verification, permanent execution locking, closure evidence, documentation, and full technical regression are complete.

No D4-1C attachment has been performed.

CIS-8004 token `287` was not mutated by D4-1B Gate 4 or Gate 5.

No payment, settlement, receipt, protected-resource release, replay mutation, Gateway activation, or production activation occurred.

No additional D4-1B registration submission is permitted.

The Gate 4 submission allowance is permanently exhausted for this PR:

* submissions authorized: `1`;
* submissions used: `1`;
* submissions remaining: `0`;
* automatic retry permitted: `false`.

PR #312 now has only repository/Git closure remaining:

* complete bounded-diff review;
* secret and unintended-file review;
* explicit staging authorization;
* staged-diff review;
* explicit commit authorization;
* explicit push authorization;
* GitHub PR review/merge under the established manual workflow; and
* post-merge branch cleanup under separate authorization.

D4-1C remains a separate rung, PR, scope, and authorization sequence.
