# Demo 4 D4-1A — CIS-8004 Registration Controlled Execution

## Status

**Completed**

PR #311 performs and proves one controlled Concordium Testnet invocation of:

```text
Contract:   <12802,0>
Contract:   CIS-8004
Entrypoint: register
Network:    ccd:4221332d34e1694168c2a0c0b3fd0f27
```

The registration finalized successfully, created CIS-8004 token `287`, and produced sanitized canonical evidence.

The runner is now locked against another execute-mode submission for this completed registration.

## Finite PR scope

This PR implements only the D4-1A identity-registration step:

1. Consume the frozen registration handoff established by PR #310.
2. Inspect the deployed CIS-8004 registry using public finalized-state reads.
3. Perform a side-effect-free dry run of the exact registration parameter.
4. Authorize no more than one Testnet submission.
5. Submit and finalize one `CIS-8004.register` transaction.
6. Recover the emitted registration event.
7. Prove that the registered token was absent immediately before the transaction.
8. Verify the finalized token owner and registration contents.
9. Verify that protected tokens `0` and `5` were unchanged.
10. Write sanitized finalized evidence.
11. Lock execute mode after the completed registration.

This PR does not attach D4-1C metadata, revoke an identity, activate Gateway runtime behavior, release a protected resource, attempt payment or settlement, or issue a receipt.

## Frozen registration profile

| Field                       | Value                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| Network                     | `ccd:4221332d34e1694168c2a0c0b3fd0f27`                             |
| Contract                    | `<12802,0>`                                                        |
| Contract name               | `CIS-8004`                                                         |
| Entrypoint                  | `register`                                                         |
| Owner account               | `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`               |
| Agent-card URI              | `https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json`  |
| Agent-card metadata SHA-256 | `6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38` |
| External reference          | Absent                                                             |
| Initial metadata entries    | `0`                                                                |
| Canonical parameter length  | `106` bytes                                                        |
| Canonical parameter SHA-256 | `4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b` |

Any mismatch in the network, contract, entrypoint, owner, parameter, agent-card identity, or safety gates is rejected.

## Execution modes

The controlled runner defines three modes.

### Inspect

Performs only public, read-only finalized-state inspection.

Inspect mode forbids:

* wallet access;
* private-key access;
* signer creation;
* transaction construction;
* signing;
* submission;
* evidence writing.

### Dry run

Invokes the exact contract update as a side-effect-free dry run.

Dry-run acceptance requires:

* the exact Testnet network;
* the exact `<12802,0>` target;
* the exact `CIS-8004.register` entrypoint;
* the exact 106-byte canonical parameter;
* successful execution;
* no state mutation;
* no transaction submission.

### Execute

Execute mode originally required every explicit elevated gate, a successful dry run, an authorized wallet, and an exactly-one-submission budget.

Following the successful finalized registration, execute dispatch is locked with:

```text
registration_already_finalized_do_not_rerun
```

The completed transaction must not be submitted again.

## Finalized Testnet result

| Field                | Result                                                             |
| -------------------- | ------------------------------------------------------------------ |
| Transaction hash     | `250c4c2fa8d2d0a9ecde1bc4e025ca32c23ca2cad94a6b788bafdf89a98ad2af` |
| Finalized block hash | `b8c908bbb11646be5c058f9a48a5276108d4deae65513e0b527e9352bc721510` |
| Transaction cost     | `15430833` microCCD (`15.430833` CCD)                                  |
| Registered token ID  | `287`                                                              |
| Finalized owner      | `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`               |
| Finalized status     | `finalized_registration_confirmed`                                 |
| Submission attempts  | Exactly `1`                                                        |
| Automatic retries    | `0`                                                                |

The transaction invoked `CIS-8004.register` with zero CCD transferred to the contract.

## Fresh-token proof

The registration proof is tied to the transaction’s finalized state transition.

### Pre-state

The transaction parent block was:

```text
7bfa47dcd0b10f9868809124a5a18072faf6d394fba49fb7d69ae51c1a3f5f0e
```

At that finalized pre-state:

```text
agentOf(287) = None
```

This proves that token `287` did not exist immediately before the registration transaction.

### Finalized post-state

At finalized block:

```text
b8c908bbb11646be5c058f9a48a5276108d4deae65513e0b527e9352bc721510
```

the registration exists and has:

```text
tokenId:          287
status:           Active
owner:            4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7
agentUri:         https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json
metadataHash:     6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38
externalReference: absent
```

The emitted `Registered` event and finalized `agentOf(287)` state agree.

## Protected-token invariants

Tokens `0` and `5` were queried at both the transaction parent block and the finalized transaction block.

Their normalized snapshots were unchanged:

```text
token 0 unchanged: true
token 5 unchanged: true
```

This guards against proving success from an unrelated or destructive registry transition.

## Finalized evidence

Canonical sanitized evidence is stored at:

```text
docs/evidence/demo4-d4-1a-cis8004-registration-evidence.json
```

Evidence SHA-256:

```text
179707dc6791d9edce8ddd2a04b90be207c8ffcb71aa311b8596294e24e974e7
```

The evidence records:

* the finalized transaction and block;
* transaction cost;
* the recovered token ID;
* owner and agent-card identity;
* canonical parameter properties;
* pre-state token absence;
* finalized ownership;
* unchanged protected tokens;
* exactly one submission attempt;
* absence of automatic retry;
* absence of adjacent payment, settlement, release, receipt, attachment, and revocation behavior.

The evidence excludes:

* private keys;
* wallet contents;
* signer material;
* raw signed transaction payloads;
* reusable authorization secrets.

The evidence file is created using exclusive-create semantics so an existing evidence artifact cannot be silently overwritten.

## Post-finalization recovery

The transaction finalized successfully before the initial runner could complete its local evidence step.

The failure was limited to SDK compatibility in post-finalization event and schema handling. No transaction retry was performed.

Recovery used only the already finalized transaction and public chain state.

The compatibility corrections were:

1. Contract update logs expose an `events` array:

   ```text
   { address, events }
   ```

   Event extraction therefore flattens `log.events`.

2. The CIS-8004 `Registered` event is decoded deterministically from its serialized bytes, including:

   * event tag `240`;
   * eight-byte little-endian token ID;
   * owner account bytes;
   * agent-card URI;
   * metadata hash;
   * absent external reference;
   * registration timestamp.

3. Contract addresses are compared structurally by normalized index and subindex rather than by incompatible SDK wrapper representations.

4. The embedded module schema exposes its binary content as an `ArrayBuffer`. It is converted through a `Uint8Array` before use as a Node `Buffer`.

5. The finalized-evidence builder returns the validated evidence object directly. The accepted object is serialized using deterministic canonical JSON.

These corrections allowed evidence reconstruction without wallet access, signing, construction, submission, or retry.

## Safety invariants

The implementation enforces the following boundaries:

* Concordium Testnet only.
* Exact contract and entrypoint only.
* Exact canonical parameter only.
* Explicit network-read authorization.
* Explicit dry-run authorization.
* Elevated execute gates required before the original submission.
* Exactly one submission attempt.
* Automatic retry forbidden.
* Finalization required.
* Pre-state token absence required.
* Finalized ownership required.
* Protected tokens `0` and `5` must remain unchanged.
* Evidence must contain no private wallet or signing material.
* Execute dispatch locked after successful registration.
* Gateway runtime activation remains false.
* Protected-resource release remains false.
* Payment and settlement remain false.
* Receipt issuance remains false.
* D4-1C attachment remains false.
* Revocation remains false.
* Production activation remains false.

## Repository artifacts

### Core contract

```text
src/phase6/demo4Cis8004IdentityRegistrationControlledExecution.ts
```

Defines:

* the frozen PR #311 profile;
* activation validation;
* inspect, dry-run, and execute plans;
* exactly-one-submission authorization;
* finalized evidence validation;
* fresh-token and protected-token invariants;
* forbidden adjacent side-effect checks.

### CI harness

```text
scripts/ci_phase6_demo4_d4_1a_cis8004_registration_controlled_execution.ts
```

Provides deterministic, offline validation of the controlled-execution contract.

### Controlled runner

```text
scripts/demo_phase6_demo4_d4_1a_cis8004_registration_controlled_execution.ts
```

Provides public inspection, dry-run support, the original controlled execution path, finalized-state verification, and the post-finalization execute lock.

### Finalized evidence

```text
docs/evidence/demo4-d4-1a-cis8004-registration-evidence.json
```

Contains the sanitized proof of the completed Testnet registration.

### Package scripts

```text
phase6:demo4-d4-1a-cis8004-registration-controlled-execution
phase6:demo4-d4-1a-cis8004-registration-controlled-execution-test
```

## Validation

Run the offline CI harness with:

```bash
npm run phase6:demo4-d4-1a-cis8004-registration-controlled-execution-test
```

Final result:

```text
accepted cases:  34
rejection cases: 65
tests:           22
passed:          22
failed:          0
```

The harness confirms that it performs no filesystem, network, wallet, key, signing, transaction, payment, settlement, Gateway release, or production side effects.

The default controlled runner invocation also fails closed unless the required activation gates are explicitly provided.

Public inspect mode remains operational and reports that execute mode is unavailable because the registration has already finalized.

## Completion criteria

PR #311 is complete when all of the following hold:

- [x] Frozen PR #310 registration handoff consumed.
- [x] Public registry inspection passes.
- [x] Exact side-effect-free dry run passes.
- [x] Testnet wallet owner and funding preflight passes.
- [x] Exactly one controlled transaction is submitted.
- [x] Transaction finalizes successfully.
- [x] `Registered` event yields token `287`.
- [x] Token `287` is absent at the parent block.
- [x] Token `287` is active at the finalized block.
- [x] Finalized owner and agent-card identity match.
- [x] Tokens `0` and `5` remain unchanged.
- [x] Sanitized canonical evidence is created and validated.
- [x] Automatic retry remains unused.
- [x] Execute mode is locked against duplicate submission.
- [x] All 22 offline tests pass.
- [x] No payment, settlement, resource release, receipt, attachment, revocation, or production activation occurs.

## Follow-on boundary

Any later work involving metadata attachment, identity revocation, Gateway identity resolution, payment authorization, settlement, receipt issuance, or protected-resource release belongs to a separate explicitly scoped PR.

PR #311 ends at the finalized and evidenced CIS-8004 registration of token `287`.
