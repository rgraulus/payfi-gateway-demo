# Demo4 D4-1A — CIS-8004 Identity Registration Preflight

## Status

PR #310 defines and validates the side-effect-free preflight contract for the first controlled Demo4 CIS-8004 identity registration.

The next stage is PR #311, the separately authorized controlled execution PR. PR #310 does not authorize, construct, sign, dry-run, submit, or retry a transaction.

## Purpose

This preflight freezes the exact Concordium Testnet registry identity, deployed schema, owner account, Agent Card anchors, canonical `CIS-8004.register` parameter, deterministic serialization result, PR #309 guard, and zero-side-effect safety boundary required before controlled execution.

A successful result means only that the evidence is internally consistent with the frozen D4-1A contract and that PR #311 may be prepared. It does not mean execution is authorized.

## Frozen trust anchors

- Network: `ccd:4221332d34e1694168c2a0c0b3fd0f27`
- Registry contract: `<12802,0>`
- Contract name: `CIS-8004`
- Registration entrypoint: `CIS-8004.register`
- Module reference: `2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41`
- Designated owner account: `4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7`
- gRPC endpoint: `grpc.testnet.concordium.com:20000` with TLS

The deployed module reference and embedded schema were read from finalized Testnet state. The embedded module schema is 5,700 bytes with SHA-256:

`cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d`

The deployed `register` parameter schema is 374 bytes with SHA-256:

`0c90202dd63de2f031f3fcaec8dbd9d7194ac33cc12b7276bcdb349d76811fe9`

## Canonical Agent Card anchors

- Repository: `rgraulus/xcf-demo4-agent-card`
- Commit: `45e2187d9d832fa1b7819bd8a2284e39cefbff06`
- File: `agent-card.json`
- Blob: `f89c4dd61ef6bb50dc407a865f20229512ac2dd0`
- Byte length: `282`
- URI: `https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json`
- URI UTF-8 byte length: `63`
- SHA-256: `6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38`

The Agent Card SHA-256 is represented in the contract parameter as exactly 32 bytes.

## Canonical registration parameter

The frozen D4-1A parameter is:

```json
{
  "agent_uri": {
    "Some": [
      "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json"
    ]
  },
  "external_reference": {
    "None": []
  },
  "initial_metadata": [],
  "metadata_hash": {
    "Some": [
      [
        106,
        198,
        105,
        149,
        14,
        155,
        24,
        196,
        68,
        229,
        73,
        71,
        70,
        21,
        192,
        206,
        101,
        85,
        145,
        11,
        30,
        89,
        171,
        106,
        89,
        147,
        81,
        207,
        49,
        225,
        12,
        56
      ]
    ]
  }
}
```

The following rules are mandatory:

- `agent_uri` must contain the canonical Agent Card URI.
- `metadata_hash` must contain the canonical 32-byte Agent Card SHA-256.
- `external_reference` must be absent.
- `initial_metadata` must be empty.
- No rejected `xcf:phase5` CIS-8 reference may be attached.

The canonical serialized parameter is deterministic:

- Byte length: `106`
- SHA-256: `4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b`

## PR #309 guard

PR #309 established the following disposition:

`SUPERSEDE_BEFORE_D4_1C`

The application-level XCF acting key does not currently have a truthful CAIP-2 namespace suitable for attachment. Therefore:

- the replacement profile remains fail-closed;
- the existing registration is not attachable;
- the rejected `xcf:phase5` reference must not be attached;
- D4-1C remains blocked;
- D4-1A may proceed without an initial external reference.

This PR does not revoke any existing identity or registration.

## Preflight evidence contract

Accepted evidence must prove all of the following:

- finalized-state provenance and a valid finalized block height;
- exact network, contract coordinate, contract name, entrypoint, and module reference;
- exact owner account;
- exact Agent Card URI, URI length, byte length, and SHA-256;
- exact module-schema and register-schema lengths and hashes;
- deterministic 106-byte serialization and its frozen SHA-256;
- absent external reference and empty initial metadata;
- the complete PR #309 guard;
- the complete zero-side-effect safety object.

A successful preflight plan returns:

- `status: "preflight_passed"`
- `nextStage: "controlled_execution_pr"`
- `transactionExecutionAuthorized: false`

## CI coverage

The PR #310 harness covers:

- accepted cases: `1`
- rejection cases: `31`

The rejection matrix includes malformed evidence, every frozen trust-anchor mismatch, non-finalized evidence, invalid serialization anchors, external-reference presence, non-empty initial metadata, each PR #309 guard violation, and unsafe side-effect evidence.

## Safety boundary

The implementation and harness are side-effect-free. They perform none of the following:

- environment reads;
- filesystem reads or writes at runtime;
- network calls;
- contract invocation or dry-run;
- private-key or wallet access;
- signer creation or signing;
- transaction construction or submission;
- payment;
- CIS-8004 or CIS-8 mutation;
- external-reference update;
- database mutation;
- Gateway activation;
- protected-resource release;
- settlement or receipt issuance;
- replay-state mutation;
- authorization decision;
- production activation.

PR #310 must not automatically retry any future live or ambiguous submission. Any execution belongs to PR #311 and requires separate explicit authorization.

## Token protections

- Public token `0` must not be modified.
- Unrelated token `5` must not be used.

## Files

- `src/phase6/demo4Cis8004IdentityRegistrationPreflight.ts`
- `scripts/ci_phase6_demo4_d4_1a_cis8004_registration_preflight.ts`
- `docs/demo4-d4-1a-cis8004-registration-preflight.md`

The package test command is added separately after this document is validated.

## Definition of done for PR #310

PR #310 is ready for review when:

1. the source contract is populated and importable;
2. the CI harness passes all 32 cases;
3. this document matches the frozen anchors and safety boundary;
4. the package test command runs the same harness;
5. no staging, commit, push, contract invocation, dry-run, signing, transaction construction, transaction submission, or payment has occurred without separate authorization.
