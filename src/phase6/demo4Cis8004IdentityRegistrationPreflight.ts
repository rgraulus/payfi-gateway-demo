/**
 * Demo4 D4-1A — side-effect-free CIS-8004 identity-registration preflight.
 *
 * This module freezes and validates the exact public inputs for a future
 * controlled Concordium Testnet CIS-8004.register transaction. It contains no
 * environment, filesystem, network, wallet, key, signer, transaction, payment,
 * persistence, Gateway, settlement, receipt, replay, authorization, or
 * production-activation behavior.
 */

import { Buffer } from "node:buffer";

import {
  PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
} from "./concordiumNetworkNormalization";

export const DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE =
  "xcf.demo4.d4-1a.cis8004-registration-preflight" as const;

export const DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION =
  "1" as const;

export const DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE =
  Object.freeze({
    network:
      PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,

    environment:
      "controlled_concordium_testnet",

    grpc:
      Object.freeze({
        host:
          "grpc.testnet.concordium.com",

        port:
          20_000,

        tls:
          true,
      }),

    registry:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              "12802",

            subindex:
              "0",
          }),

        contractName:
          "CIS-8004",

        moduleReference:
          "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41",

        registerEntrypoint:
          "register",
      }),

    ownerAccount:
      "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

    agentCard:
      Object.freeze({
        repository:
          "rgraulus/xcf-demo4-agent-card",

        commit:
          "45e2187d9d832fa1b7819bd8a2284e39cefbff06",

        file:
          "agent-card.json",

        blob:
          "f89c4dd61ef6bb50dc407a865f20229512ac2dd0",

        uri:
          "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

        byteLength:
          282,

        uriUtf8ByteLength:
          63,

        sha256:
          "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
      }),

    deployedSchema:
      Object.freeze({
        moduleSchemaByteLength:
          5_700,

        moduleSchemaSha256:
          "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",

        registerParameterSchemaByteLength:
          374,

        registerParameterSchemaSha256:
          "0c90202dd63de2f031f3fcaec8dbd9d7194ac33cc12b7276bcdb349d76811fe9",
      }),

    canonicalSerialization:
      Object.freeze({
        parameterByteLength:
          106,

        parameterSha256:
          "4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b",
      }),

    pr309Guard:
      Object.freeze({
        disposition:
          "SUPERSEDE_BEFORE_D4_1C",

        replacementProfileStatus:
          "UNRESOLVED_FAIL_CLOSED",

        existingRegistrationAttachable:
          false,

        existingXcfPhase5ReferenceMustNotBeAttached:
          true,

        cis8004PreparationMayProceedWithoutExistingExternalReference:
          true,

        d4_1cBlocked:
          true,
      }),
  } as const);

export const DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY =
  Object.freeze({
    sideEffectFree:
      true,

    environmentRead:
      false,

    filesystemRead:
      false,

    filesystemWrite:
      false,

    networkCalled:
      false,

    contractInvoked:
      false,

    dryRunCalled:
      false,

    privateKeyRead:
      false,

    walletRead:
      false,

    signerCreated:
      false,

    signingAttempted:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    cis8004Mutated:
      false,

    cis8Mutated:
      false,

    externalReferenceUpdated:
      false,

    databaseMutated:
      false,

    gatewayRuntimeActivated:
      false,

    protectedResourceReleased:
      false,

    settlementAttempted:
      false,

    receiptIssued:
      false,

    replayStateMutated:
      false,

    authorizationDecided:
      false,

    productionActivation:
      false,
  } as const);

export type Demo4D41aNoneV1 = {
  readonly None:
    readonly [];
};

export type Demo4D41aSomeV1<T> = {
  readonly Some:
    readonly [T];
};

export type Demo4D41aOptionV1<T> =
  | Demo4D41aNoneV1
  | Demo4D41aSomeV1<T>;

export type Demo4D41aCis8004RegistrationParameterV1 = {
  readonly agent_uri:
    Demo4D41aSomeV1<
      typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.agentCard.uri
    >;

  readonly external_reference:
    Demo4D41aNoneV1;

  readonly initial_metadata:
    readonly [];

  readonly metadata_hash:
    Demo4D41aSomeV1<
      readonly [
        readonly number[],
      ]
    >;
};

export type Demo4D41aCis8004RegistrationPreflightEvidenceV1 = {
  readonly type:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE;

  readonly version:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION;

  readonly finalized:
    true;

  readonly finalizedBlockHeight:
    string;

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.network;

  readonly contractIndex:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry.contract.index;

  readonly contractSubindex:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry.contract.subindex;

  readonly contractName:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry.contractName;

  readonly registerEntrypoint:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry.registerEntrypoint;

  readonly moduleReference:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry.moduleReference;

  readonly ownerAccount:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.ownerAccount;

  readonly agentCardUri:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.agentCard.uri;

  readonly agentCardUriUtf8ByteLength:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.agentCard.uriUtf8ByteLength;

  readonly agentCardByteLength:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.agentCard.byteLength;

  readonly agentCardSha256:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.agentCard.sha256;

  readonly metadataHashByteLength:
    32;

  readonly moduleSchemaByteLength:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.deployedSchema.moduleSchemaByteLength;

  readonly moduleSchemaSha256:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.deployedSchema.moduleSchemaSha256;

  readonly registerParameterSchemaByteLength:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.deployedSchema.registerParameterSchemaByteLength;

  readonly registerParameterSchemaSha256:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.deployedSchema.registerParameterSchemaSha256;

  readonly deterministicSerialization:
    true;

  readonly parameterByteLength:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.canonicalSerialization.parameterByteLength;

  readonly parameterSha256:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.canonicalSerialization.parameterSha256;

  readonly externalReferencePresent:
    false;

  readonly initialMetadataEntryCount:
    0;

  readonly pr309Disposition:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.pr309Guard.disposition;

  readonly replacementProfileStatus:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.pr309Guard.replacementProfileStatus;

  readonly existingRegistrationAttachable:
    false;

  readonly existingXcfPhase5ReferenceMustNotBeAttached:
    true;

  readonly d4_1cBlocked:
    true;

  readonly safety:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY;
};

export type Demo4D41aCis8004RegistrationPreflightPlanV1 = {
  readonly type:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE;

  readonly version:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION;

  readonly status:
    "preflight_passed";

  readonly nextStage:
    "controlled_execution_pr";

  readonly transactionExecutionAuthorized:
    false;

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.network;

  readonly registry:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.registry;

  readonly ownerAccount:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.ownerAccount;

  readonly registrationParameter:
    Demo4D41aCis8004RegistrationParameterV1;

  readonly serialization:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.canonicalSerialization;

  readonly pr309Guard:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.pr309Guard;

  readonly safety:
    typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY;
};

export type Demo4D41aCis8004RegistrationPreflightFailureReasonV1 =
  | "invalid_evidence_shape"
  | "wrong_type"
  | "wrong_version"
  | "finalized_snapshot_required"
  | "invalid_finalized_block_height"
  | "wrong_network"
  | "wrong_contract"
  | "wrong_contract_name"
  | "wrong_register_entrypoint"
  | "wrong_module_reference"
  | "wrong_owner_account"
  | "wrong_agent_card_uri"
  | "wrong_agent_card_uri_length"
  | "wrong_agent_card_byte_length"
  | "wrong_agent_card_hash"
  | "wrong_metadata_hash_length"
  | "wrong_module_schema_length"
  | "wrong_module_schema_hash"
  | "wrong_register_schema_length"
  | "wrong_register_schema_hash"
  | "serialization_not_deterministic"
  | "wrong_parameter_length"
  | "wrong_parameter_hash"
  | "external_reference_must_be_absent"
  | "initial_metadata_must_be_empty"
  | "wrong_pr309_disposition"
  | "replacement_profile_must_fail_closed"
  | "existing_registration_must_not_be_attachable"
  | "xcf_phase5_reference_must_not_be_attached"
  | "d4_1c_must_remain_blocked"
  | "unsafe_preflight_evidence";

export type Demo4D41aCis8004RegistrationPreflightFailureV1 = {
  readonly ok:
    false;

  readonly status:
    "rejected";

  readonly reason:
    Demo4D41aCis8004RegistrationPreflightFailureReasonV1;
};

export type Demo4D41aCis8004RegistrationPreflightSuccessV1 = {
  readonly ok:
    true;

  readonly status:
    "accepted";

  readonly reason:
    "accepted";

  readonly evidence:
    Demo4D41aCis8004RegistrationPreflightEvidenceV1;

  readonly plan:
    Demo4D41aCis8004RegistrationPreflightPlanV1;
};

export type Demo4D41aCis8004RegistrationPreflightResultV1 =
  | Demo4D41aCis8004RegistrationPreflightSuccessV1
  | Demo4D41aCis8004RegistrationPreflightFailureV1;

type UnknownRecord =
  Record<string, unknown>;

const EVIDENCE_KEYS =
  Object.freeze([
    "type",
    "version",
    "finalized",
    "finalizedBlockHeight",
    "network",
    "contractIndex",
    "contractSubindex",
    "contractName",
    "registerEntrypoint",
    "moduleReference",
    "ownerAccount",
    "agentCardUri",
    "agentCardUriUtf8ByteLength",
    "agentCardByteLength",
    "agentCardSha256",
    "metadataHashByteLength",
    "moduleSchemaByteLength",
    "moduleSchemaSha256",
    "registerParameterSchemaByteLength",
    "registerParameterSchemaSha256",
    "deterministicSerialization",
    "parameterByteLength",
    "parameterSha256",
    "externalReferencePresent",
    "initialMetadataEntryCount",
    "pr309Disposition",
    "replacementProfileStatus",
    "existingRegistrationAttachable",
    "existingXcfPhase5ReferenceMustNotBeAttached",
    "d4_1cBlocked",
    "safety",
  ] as const);

const SAFETY_KEYS =
  Object.freeze(
    Object.keys(
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
    ).sort(),
  );

function isRecord(
  value:
    unknown,
): value is UnknownRecord {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function hasExactKeys(
  value:
    UnknownRecord,
  expectedKeys:
    readonly string[],
): boolean {
  const actualKeys =
    Object.keys(
      value,
    ).sort();

  const expected =
    [...expectedKeys]
      .sort();

  return (
    actualKeys.length ===
      expected.length &&
    actualKeys.every(
      (
        key,
        index,
      ) =>
        key ===
        expected[
          index
        ],
    )
  );
}

function isCanonicalPositiveIntegerString(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^[1-9][0-9]*$/.test(
      value,
    )
  );
}

function reject(
  reason:
    Demo4D41aCis8004RegistrationPreflightFailureReasonV1,
): Demo4D41aCis8004RegistrationPreflightFailureV1 {
  return Object.freeze({
    ok:
      false,

    status:
      "rejected",

    reason,
  });
}

function validateSafety(
  value:
    unknown,
): value is typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY {
  if (
    !isRecord(
      value,
    ) ||
    !hasExactKeys(
      value,
      SAFETY_KEYS,
    )
  ) {
    return false;
  }

  for (
    const [
      key,
      expected,
    ] of Object.entries(
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
    )
  ) {
    if (
      value[
        key
      ] !==
        expected
    ) {
      return false;
    }
  }

  return true;
}

function metadataHashBytes(): readonly number[] {
  return Object.freeze(
    Array.from(
      Buffer.from(
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .agentCard
          .sha256,
        "hex",
      ),
    ),
  );
}

export function buildDemo4D41aCis8004RegistrationParameterV1():
Demo4D41aCis8004RegistrationParameterV1 {
  const hashBytes =
    metadataHashBytes();

  if (
    hashBytes.length !==
      32
  ) {
    throw new Error(
      "invalid_frozen_agent_card_hash",
    );
  }

  return Object.freeze({
    agent_uri:
      Object.freeze({
        Some:
          Object.freeze([
            DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
              .agentCard
              .uri,
          ]),
      }),

    external_reference:
      Object.freeze({
        None:
          Object.freeze(
            [],
          ),
      }),

    initial_metadata:
      Object.freeze(
        [],
      ),

    metadata_hash:
      Object.freeze({
        Some:
          Object.freeze([
            hashBytes,
          ]),
      }),
  });
}

export function validateDemo4D41aCis8004RegistrationPreflightEvidenceV1(
  input:
    unknown,
):
  | {
      readonly ok:
        true;

      readonly evidence:
        Demo4D41aCis8004RegistrationPreflightEvidenceV1;
    }
  | Demo4D41aCis8004RegistrationPreflightFailureV1 {
  if (
    !isRecord(
      input,
    ) ||
    !hasExactKeys(
      input,
      EVIDENCE_KEYS,
    )
  ) {
    return reject(
      "invalid_evidence_shape",
    );
  }

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  if (
    input.type !==
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE
  ) {
    return reject(
      "wrong_type",
    );
  }

  if (
    input.version !==
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION
  ) {
    return reject(
      "wrong_version",
    );
  }

  if (
    input.finalized !==
      true
  ) {
    return reject(
      "finalized_snapshot_required",
    );
  }

  if (
    !isCanonicalPositiveIntegerString(
      input.finalizedBlockHeight,
    )
  ) {
    return reject(
      "invalid_finalized_block_height",
    );
  }

  if (
    input.network !==
      profile.network
  ) {
    return reject(
      "wrong_network",
    );
  }

  if (
    input.contractIndex !==
      profile.registry.contract.index ||
    input.contractSubindex !==
      profile.registry.contract.subindex
  ) {
    return reject(
      "wrong_contract",
    );
  }

  if (
    input.contractName !==
      profile.registry.contractName
  ) {
    return reject(
      "wrong_contract_name",
    );
  }

  if (
    input.registerEntrypoint !==
      profile.registry.registerEntrypoint
  ) {
    return reject(
      "wrong_register_entrypoint",
    );
  }

  if (
    input.moduleReference !==
      profile.registry.moduleReference
  ) {
    return reject(
      "wrong_module_reference",
    );
  }

  if (
    input.ownerAccount !==
      profile.ownerAccount
  ) {
    return reject(
      "wrong_owner_account",
    );
  }

  if (
    input.agentCardUri !==
      profile.agentCard.uri
  ) {
    return reject(
      "wrong_agent_card_uri",
    );
  }

  if (
    input.agentCardUriUtf8ByteLength !==
      profile.agentCard.uriUtf8ByteLength
  ) {
    return reject(
      "wrong_agent_card_uri_length",
    );
  }

  if (
    input.agentCardByteLength !==
      profile.agentCard.byteLength
  ) {
    return reject(
      "wrong_agent_card_byte_length",
    );
  }

  if (
    input.agentCardSha256 !==
      profile.agentCard.sha256
  ) {
    return reject(
      "wrong_agent_card_hash",
    );
  }

  if (
    input.metadataHashByteLength !==
      32
  ) {
    return reject(
      "wrong_metadata_hash_length",
    );
  }

  if (
    input.moduleSchemaByteLength !==
      profile.deployedSchema.moduleSchemaByteLength
  ) {
    return reject(
      "wrong_module_schema_length",
    );
  }

  if (
    input.moduleSchemaSha256 !==
      profile.deployedSchema.moduleSchemaSha256
  ) {
    return reject(
      "wrong_module_schema_hash",
    );
  }

  if (
    input.registerParameterSchemaByteLength !==
      profile.deployedSchema.registerParameterSchemaByteLength
  ) {
    return reject(
      "wrong_register_schema_length",
    );
  }

  if (
    input.registerParameterSchemaSha256 !==
      profile.deployedSchema.registerParameterSchemaSha256
  ) {
    return reject(
      "wrong_register_schema_hash",
    );
  }

  if (
    input.deterministicSerialization !==
      true
  ) {
    return reject(
      "serialization_not_deterministic",
    );
  }

  if (
    input.parameterByteLength !==
      profile.canonicalSerialization.parameterByteLength
  ) {
    return reject(
      "wrong_parameter_length",
    );
  }

  if (
    input.parameterSha256 !==
      profile.canonicalSerialization.parameterSha256
  ) {
    return reject(
      "wrong_parameter_hash",
    );
  }

  if (
    input.externalReferencePresent !==
      false
  ) {
    return reject(
      "external_reference_must_be_absent",
    );
  }

  if (
    input.initialMetadataEntryCount !==
      0
  ) {
    return reject(
      "initial_metadata_must_be_empty",
    );
  }

  if (
    input.pr309Disposition !==
      profile.pr309Guard.disposition
  ) {
    return reject(
      "wrong_pr309_disposition",
    );
  }

  if (
    input.replacementProfileStatus !==
      profile.pr309Guard.replacementProfileStatus
  ) {
    return reject(
      "replacement_profile_must_fail_closed",
    );
  }

  if (
    input.existingRegistrationAttachable !==
      false
  ) {
    return reject(
      "existing_registration_must_not_be_attachable",
    );
  }

  if (
    input.existingXcfPhase5ReferenceMustNotBeAttached !==
      true
  ) {
    return reject(
      "xcf_phase5_reference_must_not_be_attached",
    );
  }

  if (
    input.d4_1cBlocked !==
      true
  ) {
    return reject(
      "d4_1c_must_remain_blocked",
    );
  }

  if (
    !validateSafety(
      input.safety,
    )
  ) {
    return reject(
      "unsafe_preflight_evidence",
    );
  }

  return Object.freeze({
    ok:
      true,

    evidence:
      input as Demo4D41aCis8004RegistrationPreflightEvidenceV1,
  });
}

export function buildDemo4D41aCis8004RegistrationPreflightV1(
  input:
    unknown,
): Demo4D41aCis8004RegistrationPreflightResultV1 {
  const validated =
    validateDemo4D41aCis8004RegistrationPreflightEvidenceV1(
      input,
    );

  if (
    validated.ok !==
      true
  ) {
    return validated;
  }

  const plan:
    Demo4D41aCis8004RegistrationPreflightPlanV1 =
    Object.freeze({
      type:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,

      version:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,

      status:
        "preflight_passed",

      nextStage:
        "controlled_execution_pr",

      transactionExecutionAuthorized:
        false,

      network:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .network,

      registry:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .registry,

      ownerAccount:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .ownerAccount,

      registrationParameter:
        buildDemo4D41aCis8004RegistrationParameterV1(),

      serialization:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .canonicalSerialization,

      pr309Guard:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE
          .pr309Guard,

      safety:
        DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
    });

  return Object.freeze({
    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    evidence:
      validated.evidence,

    plan,
  });
}
