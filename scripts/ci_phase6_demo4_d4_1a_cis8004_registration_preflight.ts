/**
 * PR #310 — Demo4 D4-1A CIS-8004 identity-registration preflight CI harness.
 *
 * This harness exercises only the deterministic, side-effect-free preflight
 * core. It performs no filesystem access beyond loading this source file, no
 * environment-dependent decision, no network or contract call, no dry-run,
 * no wallet or key access, no signing, no transaction construction or
 * submission, no payment, and no production activation.
 */

import assert from "node:assert/strict";

import {
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,
  buildDemo4D41aCis8004RegistrationParameterV1,
  buildDemo4D41aCis8004RegistrationPreflightV1,
  validateDemo4D41aCis8004RegistrationPreflightEvidenceV1,
  type Demo4D41aCis8004RegistrationPreflightEvidenceV1,
  type Demo4D41aCis8004RegistrationPreflightFailureReasonV1,
} from "../src/phase6/demo4Cis8004IdentityRegistrationPreflight";

const PROFILE =
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

const SAFETY =
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY;

type MutableEvidence =
  Record<string, unknown>;

function buildValidEvidence():
Demo4D41aCis8004RegistrationPreflightEvidenceV1 {
  return {
    type:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,

    finalized:
      true,

    finalizedBlockHeight:
      "46326694",

    network:
      PROFILE.network,

    contractIndex:
      PROFILE.registry.contract.index,

    contractSubindex:
      PROFILE.registry.contract.subindex,

    contractName:
      PROFILE.registry.contractName,

    registerEntrypoint:
      PROFILE.registry.registerEntrypoint,

    moduleReference:
      PROFILE.registry.moduleReference,

    ownerAccount:
      PROFILE.ownerAccount,

    agentCardUri:
      PROFILE.agentCard.uri,

    agentCardUriUtf8ByteLength:
      PROFILE.agentCard.uriUtf8ByteLength,

    agentCardByteLength:
      PROFILE.agentCard.byteLength,

    agentCardSha256:
      PROFILE.agentCard.sha256,

    metadataHashByteLength:
      32,

    moduleSchemaByteLength:
      PROFILE.deployedSchema.moduleSchemaByteLength,

    moduleSchemaSha256:
      PROFILE.deployedSchema.moduleSchemaSha256,

    registerParameterSchemaByteLength:
      PROFILE.deployedSchema.registerParameterSchemaByteLength,

    registerParameterSchemaSha256:
      PROFILE.deployedSchema.registerParameterSchemaSha256,

    deterministicSerialization:
      true,

    parameterByteLength:
      PROFILE.canonicalSerialization.parameterByteLength,

    parameterSha256:
      PROFILE.canonicalSerialization.parameterSha256,

    externalReferencePresent:
      false,

    initialMetadataEntryCount:
      0,

    pr309Disposition:
      PROFILE.pr309Guard.disposition,

    replacementProfileStatus:
      PROFILE.pr309Guard.replacementProfileStatus,

    existingRegistrationAttachable:
      false,

    existingXcfPhase5ReferenceMustNotBeAttached:
      true,

    d4_1cBlocked:
      true,

    safety:
      SAFETY,
  };
}

function cloneEvidence():
MutableEvidence {
  const evidence =
    buildValidEvidence();

  return {
    ...evidence,

    safety: {
      ...evidence.safety,
    },
  };
}

function assertRejected(
  input:
    unknown,
  expectedReason:
    Demo4D41aCis8004RegistrationPreflightFailureReasonV1,
): void {
  const validated =
    validateDemo4D41aCis8004RegistrationPreflightEvidenceV1(
      input,
    ) as {
      readonly ok: boolean;
      readonly status: string;
      readonly reason: string;
    };

  assert.equal(
    validated.ok,
    false,
    `expected rejection for ${expectedReason}`,
  );

  assert.equal(
    validated.status,
    "rejected",
    `expected rejected status for ${expectedReason}`,
  );

  assert.equal(
    validated.reason,
    expectedReason,
  );

  const built =
    buildDemo4D41aCis8004RegistrationPreflightV1(
      input,
    ) as {
      readonly ok: boolean;
      readonly status: string;
      readonly reason: string;
    };

  assert.equal(
    built.ok,
    false,
    `builder must reject ${expectedReason}`,
  );

  assert.equal(
    built.status,
    "rejected",
  );

  assert.equal(
    built.reason,
    expectedReason,
  );
}

function withMutation(
  key:
    string,
  value:
    unknown,
): MutableEvidence {
  return {
    ...cloneEvidence(),
    [key]:
      value,
  };
}

function assertProfile():
void {
  assert.equal(
    PROFILE.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );

  assert.deepEqual(
    PROFILE.registry.contract,
    {
      index:
        "12802",
      subindex:
        "0",
    },
  );

  assert.equal(
    PROFILE.registry.contractName,
    "CIS-8004",
  );

  assert.equal(
    PROFILE.registry.registerEntrypoint,
    "register",
  );

  assert.equal(
    PROFILE.registry.moduleReference,
    "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41",
  );

  assert.equal(
    PROFILE.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    PROFILE.agentCard.uri,
    "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",
  );

  assert.equal(
    PROFILE.agentCard.uriUtf8ByteLength,
    63,
  );

  assert.equal(
    PROFILE.agentCard.byteLength,
    282,
  );

  assert.equal(
    PROFILE.agentCard.sha256,
    "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
  );

  assert.equal(
    PROFILE.deployedSchema.moduleSchemaByteLength,
    5700,
  );

  assert.equal(
    PROFILE.deployedSchema.moduleSchemaSha256,
    "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
  );

  assert.equal(
    PROFILE.deployedSchema.registerParameterSchemaByteLength,
    374,
  );

  assert.equal(
    PROFILE.deployedSchema.registerParameterSchemaSha256,
    "0c90202dd63de2f031f3fcaec8dbd9d7194ac33cc12b7276bcdb349d76811fe9",
  );

  assert.equal(
    PROFILE.canonicalSerialization.parameterByteLength,
    106,
  );

  assert.equal(
    PROFILE.canonicalSerialization.parameterSha256,
    "4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b",
  );

  assert.equal(
    PROFILE.pr309Guard.disposition,
    "SUPERSEDE_BEFORE_D4_1C",
  );

  assert.equal(
    PROFILE.pr309Guard.replacementProfileStatus,
    "UNRESOLVED_FAIL_CLOSED",
  );
}

function assertSafety():
void {
  const entries =
    Object.entries(
      SAFETY,
    );

  assert.ok(
    entries.length >
      1,
  );

  for (
    const [
      key,
      value,
    ] of entries
  ) {
    assert.equal(
      typeof value,
      "boolean",
      `safety.${key} must be boolean`,
    );

    assert.equal(
      value,
      key ===
        "sideEffectFree",
      `unexpected safety flag safety.${key}`,
    );
  }
}

function assertCanonicalParameter():
void {
  const parameterA =
    buildDemo4D41aCis8004RegistrationParameterV1();

  const parameterB =
    buildDemo4D41aCis8004RegistrationParameterV1();

  assert.deepEqual(
    parameterA,
    parameterB,
  );

  assert.deepEqual(
    parameterA.agent_uri,
    {
      Some: [
        PROFILE.agentCard.uri,
      ],
    },
  );

  assert.deepEqual(
    parameterA.external_reference,
    {
      None: [],
    },
  );

  assert.deepEqual(
    parameterA.initial_metadata,
    [],
  );

  assert.ok(
    Array.isArray(
      parameterA.metadata_hash.Some,
    ),
  );

  assert.equal(
    parameterA.metadata_hash.Some.length,
    1,
  );

  assert.equal(
    parameterA.metadata_hash.Some[0].length,
    32,
  );

  assert.deepEqual(
    parameterA.metadata_hash.Some[0],
    [
      106, 198, 105, 149,
      14, 155, 24, 196,
      68, 229, 73, 71,
      70, 21, 192, 206,
      101, 85, 145, 11,
      30, 89, 171, 106,
      89, 147, 81, 207,
      49, 225, 12, 56,
    ],
  );
}

function assertAcceptedPreflight():
void {
  const evidence =
    buildValidEvidence();

  const validated =
    validateDemo4D41aCis8004RegistrationPreflightEvidenceV1(
      evidence,
    );

  assert.equal(
    validated.ok,
    true,
  );

  if (
    validated.ok !==
      true
  ) {
    assert.fail(
      `expected accepted validation, received ${validated.reason}`,
    );
  }

  assert.equal(
    validated.evidence,
    evidence,
  );

  const result =
    buildDemo4D41aCis8004RegistrationPreflightV1(
      evidence,
    );

  assert.equal(
    result.ok,
    true,
  );

  if (
    result.ok !==
      true
  ) {
    assert.fail(
      "expected accepted preflight result",
    );
  }

  assert.equal(
    result.status,
    "accepted",
  );

  assert.equal(
    result.reason,
    "accepted",
  );

  assert.deepEqual(
    result.evidence,
    evidence,
  );

  assert.equal(
    result.plan.type,
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,
  );

  assert.equal(
    result.plan.version,
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,
  );

  assert.equal(
    result.plan.status,
    "preflight_passed",
  );

  assert.equal(
    result.plan.nextStage,
    "controlled_execution_pr",
  );

  assert.equal(
    result.plan.transactionExecutionAuthorized,
    false,
  );

  assert.equal(
    result.plan.network,
    PROFILE.network,
  );

  assert.deepEqual(
    result.plan.registry,
    PROFILE.registry,
  );

  assert.equal(
    result.plan.ownerAccount,
    PROFILE.ownerAccount,
  );

  assert.deepEqual(
    result.plan.registrationParameter,
    buildDemo4D41aCis8004RegistrationParameterV1(),
  );

  assert.deepEqual(
    result.plan.serialization,
    PROFILE.canonicalSerialization,
  );

  assert.deepEqual(
    result.plan.pr309Guard,
    PROFILE.pr309Guard,
  );

  assert.deepEqual(
    result.plan.safety,
    SAFETY,
  );
}

function assertAllRejections():
void {
  assertRejected(
    null,
    "invalid_evidence_shape",
  );

  assertRejected(
    withMutation(
      "type",
      "wrong.type",
    ),
    "wrong_type",
  );

  assertRejected(
    withMutation(
      "version",
      "2",
    ),
    "wrong_version",
  );

  assertRejected(
    withMutation(
      "finalized",
      false,
    ),
    "finalized_snapshot_required",
  );

  assertRejected(
    withMutation(
      "finalizedBlockHeight",
      "0",
    ),
    "invalid_finalized_block_height",
  );

  assertRejected(
    withMutation(
      "network",
      "concordium:testnet",
    ),
    "wrong_network",
  );

  assertRejected(
    withMutation(
      "contractIndex",
      "12803",
    ),
    "wrong_contract",
  );

  assertRejected(
    withMutation(
      "contractName",
      "CIS8004",
    ),
    "wrong_contract_name",
  );

  assertRejected(
    withMutation(
      "registerEntrypoint",
      "registerAgent",
    ),
    "wrong_register_entrypoint",
  );

  assertRejected(
    withMutation(
      "moduleReference",
      "0".repeat(
        64,
      ),
    ),
    "wrong_module_reference",
  );

  assertRejected(
    withMutation(
      "ownerAccount",
      "invalid-owner",
    ),
    "wrong_owner_account",
  );

  assertRejected(
    withMutation(
      "agentCardUri",
      "https://example.invalid/agent-card.json",
    ),
    "wrong_agent_card_uri",
  );

  assertRejected(
    withMutation(
      "agentCardUriUtf8ByteLength",
      62,
    ),
    "wrong_agent_card_uri_length",
  );

  assertRejected(
    withMutation(
      "agentCardByteLength",
      281,
    ),
    "wrong_agent_card_byte_length",
  );

  assertRejected(
    withMutation(
      "agentCardSha256",
      "0".repeat(
        64,
      ),
    ),
    "wrong_agent_card_hash",
  );

  assertRejected(
    withMutation(
      "metadataHashByteLength",
      31,
    ),
    "wrong_metadata_hash_length",
  );

  assertRejected(
    withMutation(
      "moduleSchemaByteLength",
      5699,
    ),
    "wrong_module_schema_length",
  );

  assertRejected(
    withMutation(
      "moduleSchemaSha256",
      "0".repeat(
        64,
      ),
    ),
    "wrong_module_schema_hash",
  );

  assertRejected(
    withMutation(
      "registerParameterSchemaByteLength",
      373,
    ),
    "wrong_register_schema_length",
  );

  assertRejected(
    withMutation(
      "registerParameterSchemaSha256",
      "0".repeat(
        64,
      ),
    ),
    "wrong_register_schema_hash",
  );

  assertRejected(
    withMutation(
      "deterministicSerialization",
      false,
    ),
    "serialization_not_deterministic",
  );

  assertRejected(
    withMutation(
      "parameterByteLength",
      105,
    ),
    "wrong_parameter_length",
  );

  assertRejected(
    withMutation(
      "parameterSha256",
      "0".repeat(
        64,
      ),
    ),
    "wrong_parameter_hash",
  );

  assertRejected(
    withMutation(
      "externalReferencePresent",
      true,
    ),
    "external_reference_must_be_absent",
  );

  assertRejected(
    withMutation(
      "initialMetadataEntryCount",
      1,
    ),
    "initial_metadata_must_be_empty",
  );

  assertRejected(
    withMutation(
      "pr309Disposition",
      "RETAIN",
    ),
    "wrong_pr309_disposition",
  );

  assertRejected(
    withMutation(
      "replacementProfileStatus",
      "RESOLVED",
    ),
    "replacement_profile_must_fail_closed",
  );

  assertRejected(
    withMutation(
      "existingRegistrationAttachable",
      true,
    ),
    "existing_registration_must_not_be_attachable",
  );

  assertRejected(
    withMutation(
      "existingXcfPhase5ReferenceMustNotBeAttached",
      false,
    ),
    "xcf_phase5_reference_must_not_be_attached",
  );

  assertRejected(
    withMutation(
      "d4_1cBlocked",
      false,
    ),
    "d4_1c_must_remain_blocked",
  );

  const unsafe =
    cloneEvidence();

  unsafe.safety = {
    ...(unsafe.safety as Record<string, unknown>),
    transactionConstructed:
      true,
  };

  assertRejected(
    unsafe,
    "unsafe_preflight_evidence",
  );
}

function main():
void {
  assertProfile();
  assertSafety();
  assertCanonicalParameter();
  assertAcceptedPreflight();
  assertAllRejections();

  console.log(
    "PR310_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TESTS_PASSED",
  );

  console.log(
    JSON.stringify(
      {
        acceptedCases:
          1,

        rejectionCases:
          31,

        canonicalParameter: {
          byteLength:
            PROFILE.canonicalSerialization.parameterByteLength,

          sha256:
            PROFILE.canonicalSerialization.parameterSha256,

          externalReferencePresent:
            false,

          initialMetadataEntryCount:
            0,
        },

        nextStage:
          "controlled_execution_pr",

        transactionExecutionAuthorized:
          false,

        safety:
          SAFETY,
      },
      null,
      2,
    ),
  );
}

main();
