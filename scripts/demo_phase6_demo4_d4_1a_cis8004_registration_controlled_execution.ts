/**
 * PR #311 — Demo4 D4-1A controlled CIS-8004 identity registration runner.
 *
 * This runner implements guarded inspect and read-only dry-run modes,
 * finalized Registered-event and pre/post agentOf verification, and controlled
 * single-submission orchestration. Execute dispatch is wired but still requires
 * explicit execute activation, wallet, evidence, and operator authorization.
 *
 * No automatic retry is permitted.
 */

import {
  createHash,
} from "node:crypto";

import {
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";

import {
  basename,
  dirname,
  isAbsolute,
  resolve,
} from "node:path";

import {
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE,
  authorizeDemo4D41aCis8004SubmissionV1,
  buildDemo4D41aCis8004ControlledExecutionPlanV1,
  buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1,
  validateDemo4D41aCis8004ControlledExecutionActivationV1,
  validateDemo4D41aCis8004DryRunObservationV1,
} from "../src/phase6/demo4Cis8004IdentityRegistrationControlledExecution";

import {
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,
  buildDemo4D41aCis8004RegistrationParameterV1,
  buildDemo4D41aCis8004RegistrationPreflightV1,
} from "../src/phase6/demo4Cis8004IdentityRegistrationPreflight";

import {
  normalizeConcordiumCis8004DecodedAgentOfResultForTestV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

type UnknownRecord =
  Record<string, unknown>;

type Snapshot = {
  readonly finalizedBlock:
    unknown;

  readonly finalizedBlockHash:
    string;

  readonly finalizedBlockHeight:
    string;

  readonly observedAt:
    string;

  readonly genesisHash:
    string;
};

type InspectedSchema = {
  readonly version:
    number;

  readonly matchedEntrypoints:
    readonly string[];

  readonly eventSchemaPresent:
    boolean;

  readonly parsed:
    unknown;
};

type ProtectedTokenId =
  | "0"
  | "5";

type Cis8004AgentRecord =
  ReturnType<
    typeof normalizeConcordiumCis8004DecodedAgentOfResultForTestV1
  >;

type AgentTokenSnapshot<
  TTokenId extends string =
    string,
> = {
  readonly tokenId:
    TTokenId;

  readonly record:
    Cis8004AgentRecord;

  readonly snapshotSha256:
    string;
};

type ProtectedTokenSnapshot =
  AgentTokenSnapshot<
    ProtectedTokenId
  >;

type RegisteredEventObservation = {
  readonly tokenId:
    string;

  readonly owner:
    string;

  readonly agentUri:
    string;

  readonly metadataHashHex:
    string;

  readonly externalReferencePresent:
    boolean;

  readonly initialMetadataEntryCount:
    0;
};

type FinalizedFreshTokenVerification = {
  readonly registrationEvent:
    RegisteredEventObservation;

  readonly freshTokenProof:
    Readonly<{
      tokenId:
        string;

      tokenAbsentAtPreState:
        true;

      preStateFinalized:
        true;

      preStateFinalizedBlockHash:
        string;
    }>;

  readonly ownershipPostcondition:
    Readonly<{
      tokenId:
        string;

      registrationExists:
        true;

      owner:
        string;

      agentUri:
        string;

      metadataHashHex:
        string;

      finalized:
        true;

      finalizedBlockHash:
        string;
    }>;

  readonly protectedTokens:
    Readonly<{
      token0Unchanged:
        true;

      token5Unchanged:
        true;
    }>;
};

type Inspection = {
  readonly sdk:
    any;

  readonly client:
    any;

  readonly snapshot:
    Snapshot;

  readonly contractAddress:
    unknown;

  readonly embeddedSchema:
    any;

  readonly schema:
    InspectedSchema;

  readonly protectedToken0:
    ProtectedTokenSnapshot;

  readonly protectedToken5:
    ProtectedTokenSnapshot;

  readonly moduleReference:
    string;

  readonly ownerAccount:
    unknown;

  readonly serializedParameter:
    unknown;

  readonly parameterBuffer:
    Buffer;

  readonly controlledPlan:
    any;
};

const SCRIPT_TYPE =
  "demo.phase6.demo4D41aCis8004ControlledExecution.v1";

const IMPLEMENTATION_STAGE =
  "post_finalization_recovery_decoder_ready_execute_locked" as const;

const REGISTERED_EVENT_TAG =
  240 as const;

const DRY_RUN_ENERGY_SAFETY_CAP =
  100_000n;

const FINALIZATION_TIMEOUT_MS =
  180_000;

const TRANSACTION_EXPIRY_MINUTES =
  5;

const MAX_WALLET_BYTES =
  1_000_000;

const EXECUTE_DISPATCH_ENABLED =
  false as const;

const runtimeState = {
  environmentRead:
    false,

  networkCalled:
    false,

  contractInvoked:
    false,

  dryRunCalled:
    false,

  readOnlyStateQueryCount:
    0,

  protectedTokenQueryCount:
    0,

  freshTokenVerificationQueryCount:
    0,

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

  transactionSubmissionAttempted:
    false,

  submissionAttempts:
    0,

  transactionSubmitted:
    false,

  transactionFinalized:
    false,

  evidenceWritten:
    false,

  automaticRetryAttempted:
    false,
};

function asRecord(
  value:
    unknown,
): UnknownRecord | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  )
    ? value as UnknownRecord
    : null;
}

function exactEnv(
  name:
    string,
): string | undefined {
  runtimeState.environmentRead =
    true;

  const value =
    process.env[name];

  return (
    value ===
      undefined ||
    value.length ===
      0
  )
    ? undefined
    : value;
}

function requireAccepted<T>(
  result: {
    readonly ok:
      boolean;

    readonly reason:
      string;

    readonly value?:
      T;
  },
  prefix:
    string,
): T {
  if (
    result.ok !==
      true ||
    result.value ===
      undefined
  ) {
    throw new Error(
      `${prefix}:${result.reason}`,
    );
  }

  return result.value;
}

function activation():
any {
  return requireAccepted(
    validateDemo4D41aCis8004ControlledExecutionActivationV1({
      mode:
        exactEnv(
          "DEMO4_D4_1A_MODE",
        ),

      testnetOnly:
        exactEnv(
          "DEMO4_D4_1A_TESTNET_ONLY",
        ),

      networkReadEnabled:
        exactEnv(
          "DEMO4_D4_1A_NETWORK_READ_ENABLED",
        ),

      dryRunEnabled:
        exactEnv(
          "DEMO4_D4_1A_DRY_RUN_ENABLED",
        ),

      privateKeyReadEnabled:
        exactEnv(
          "DEMO4_D4_1A_PRIVATE_KEY_READ_ENABLED",
        ),

      walletReadEnabled:
        exactEnv(
          "DEMO4_D4_1A_WALLET_READ_ENABLED",
        ),

      executionEnabled:
        exactEnv(
          "DEMO4_D4_1A_EXECUTION_ENABLED",
        ),

      evidenceWriteEnabled:
        exactEnv(
          "DEMO4_D4_1A_EVIDENCE_WRITE_ENABLED",
        ),

      automaticRetryEnabled:
        exactEnv(
          "DEMO4_D4_1A_AUTOMATIC_RETRY_ENABLED",
        ),
    }),
    "activation_rejected",
  );
}

async function loadSdk(): Promise<{
  readonly sdk:
    any;

  readonly nodeSdk:
    any;

  readonly grpc:
    any;
}> {
  const [
    sdk,
    nodeSdk,
    grpc,
  ] =
    await Promise.all([
      import(
        "@concordium/web-sdk"
      ),

      import(
        "@concordium/web-sdk/nodejs"
      ),

      import(
        "@grpc/grpc-js"
      ),
    ]);

  return {
    sdk,
    nodeSdk,
    grpc,
  };
}

function lowerHex64(
  value:
    unknown,
  helpers:
    readonly (
      (
        input:
          unknown,
      ) => unknown
    )[] =
      [],
): string | null {
  const candidates:
    unknown[] =
      [value];

  for (
    const helper
    of helpers
  ) {
    try {
      candidates.push(
        helper(
          value,
        ),
      );
    } catch {
      // Try the next supported representation.
    }
  }

  const record =
    asRecord(
      value,
    );

  if (
    record !==
      null
  ) {
    candidates.push(
      record.value,
      record.hex,
      record.hash,
      record.moduleRef,
      record.moduleReference,
    );
  }

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        "string"
    ) {
      const normalized =
        candidate
          .toLowerCase()
          .replace(
            /^0x/,
            "",
          );

      if (
        /^[0-9a-f]{64}$/.test(
          normalized,
        )
      ) {
        return normalized;
      }
    }
  }

  return null;
}

function blockHashHex(
  value:
    unknown,
  sdk:
    any,
): string {
  const valueHex =
    lowerHex64(
      value,
      [
        (
          input,
        ) =>
          sdk.BlockHash?.toHexString?.(input),

        (
          input,
        ) =>
          sdk.BlockHash?.toString?.(input),
      ],
    );

  if (
    valueHex ===
      null
  ) {
    throw new Error(
      "invalid_block_hash",
    );
  }

  return valueHex;
}

function moduleReferenceHex(
  value:
    unknown,
  sdk:
    any,
): string {
  const valueHex =
    lowerHex64(
      value,
      [
        (
          input,
        ) =>
          sdk.ModuleReference?.toHexString?.(input),

        (
          input,
        ) =>
          sdk.ModuleReference?.toString?.(input),
      ],
    );

  if (
    valueHex ===
      null
  ) {
    throw new Error(
      "invalid_module_reference",
    );
  }

  return valueHex;
}

function safeBlockHeight(
  value:
    unknown,
): string {
  if (
    typeof value ===
      "bigint" &&
    value >=
      0n
  ) {
    return value.toString(
      10,
    );
  }

  if (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value >=
      0
  ) {
    return String(
      value,
    );
  }

  if (
    typeof value ===
      "string" &&
    /^(0|[1-9][0-9]*)$/.test(
      value,
    )
  ) {
    return value;
  }

  throw new Error(
    "invalid_finalized_block_height",
  );
}

function safeTimestamp(
  value:
    unknown,
): string {
  const date =
    value instanceof
      Date
      ? value
      : (
          typeof value ===
            "string" ||
          typeof value ===
            "number"
        )
        ? new Date(
            value,
          )
        : null;

  if (
    date ===
      null ||
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      "invalid_finalized_block_time",
    );
  }

  return date.toISOString();
}

async function loadSnapshot(
  client:
    any,
  sdk:
    any,
): Promise<Snapshot> {
  runtimeState.networkCalled =
    true;

  const consensus =
    await client
      .getConsensusStatus();

  const finalizedBlock =
    consensus
      ?.lastFinalizedBlock;

  if (
    finalizedBlock ===
      null ||
    finalizedBlock ===
      undefined
  ) {
    throw new Error(
      "missing_latest_finalized_block",
    );
  }

  const blockInfo =
    await client
      .getBlockInfo(
        finalizedBlock,
      );

  if (
    blockInfo ===
      null ||
    blockInfo ===
      undefined ||
    blockInfo.finalized !==
      true
  ) {
    throw new Error(
      "non_finalized_snapshot",
    );
  }

  return {
    finalizedBlock,

    finalizedBlockHash:
      blockHashHex(
        finalizedBlock,
        sdk,
      ),

    finalizedBlockHeight:
      safeBlockHeight(
        blockInfo.blockHeight ??
          consensus
            .lastFinalizedBlockHeight,
      ),

    observedAt:
      safeTimestamp(
        blockInfo.blockSlotTime,
      ),

    genesisHash:
      blockHashHex(
        consensus.genesisBlock,
        sdk,
      ),
  };
}

function schemaBuffer(
  embeddedSchema:
    any,
): Buffer {
  const candidate =
    embeddedSchema
      ?.buffer ??
    embeddedSchema;

  if (
    Buffer.isBuffer(
      candidate,
    )
  ) {
    return candidate;
  }

  if (
    candidate instanceof
      Uint8Array
  ) {
    return Buffer.from(
      candidate,
    );
  }

  if (
    candidate instanceof
      ArrayBuffer
  ) {
    return Buffer.from(
      new Uint8Array(
        candidate,
      ),
    );
  }

  if (
    ArrayBuffer.isView(
      candidate,
    )
  ) {
    return Buffer.from(
      new Uint8Array(
        candidate.buffer,
        candidate.byteOffset,
        candidate.byteLength,
      ),
    );
  }

  throw new Error(
    "embedded_schema_buffer_invalid",
  );
}

function exactBuffer(
  value:
    unknown,
  sdk:
    any,
): Buffer {
  if (
    Buffer.isBuffer(
      value,
    )
  ) {
    return Buffer.from(
      value,
    );
  }

  if (
    value instanceof
      Uint8Array
  ) {
    return Buffer.from(
      value,
    );
  }

  if (
    value instanceof
      ArrayBuffer
  ) {
    return Buffer.from(
      new Uint8Array(
        value,
      ),
    );
  }

  try {
    return Buffer.from(
      sdk.Parameter
        .toBuffer(
          value,
        ),
    );
  } catch {
    throw new Error(
      "unable_to_obtain_parameter_bytes",
    );
  }
}

function hashHex(
  value:
    Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}

function registrationParameterForSchema(
  parameter:
    ReturnType<
      typeof buildDemo4D41aCis8004RegistrationParameterV1
    >,
): unknown {
  return {
    agent_uri:
      parameter.agent_uri,

    external_reference:
      parameter.external_reference,

    initial_metadata:
      parameter.initial_metadata,

    metadata_hash: {
      Some:
        parameter
          .metadata_hash
          .Some
          .map(
            (
              bytes,
            ) =>
              Array.from(
                bytes,
                (
                  byte,
                ) =>
                  BigInt(
                    byte,
                  ),
              ),
          ),
    },
  };
}

function canonicalPreflightEvidence(
  snapshot:
    Snapshot,
  moduleReference:
    string,
): UnknownRecord {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  return {
    type:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,

    finalized:
      true,

    finalizedBlockHeight:
      snapshot
        .finalizedBlockHeight,

    network:
      profile.network,

    contractIndex:
      profile
        .registry
        .contract
        .index,

    contractSubindex:
      profile
        .registry
        .contract
        .subindex,

    contractName:
      profile
        .registry
        .contractName,

    registerEntrypoint:
      profile
        .registry
        .registerEntrypoint,

    moduleReference,

    ownerAccount:
      profile.ownerAccount,

    agentCardUri:
      profile
        .agentCard
        .uri,

    agentCardUriUtf8ByteLength:
      profile
        .agentCard
        .uriUtf8ByteLength,

    agentCardByteLength:
      profile
        .agentCard
        .byteLength,

    agentCardSha256:
      profile
        .agentCard
        .sha256,

    metadataHashByteLength:
      32,

    moduleSchemaByteLength:
      profile
        .deployedSchema
        .moduleSchemaByteLength,

    moduleSchemaSha256:
      profile
        .deployedSchema
        .moduleSchemaSha256,

    registerParameterSchemaByteLength:
      profile
        .deployedSchema
        .registerParameterSchemaByteLength,

    registerParameterSchemaSha256:
      profile
        .deployedSchema
        .registerParameterSchemaSha256,

    deterministicSerialization:
      true,

    parameterByteLength:
      profile
        .canonicalSerialization
        .parameterByteLength,

    parameterSha256:
      profile
        .canonicalSerialization
        .parameterSha256,

    externalReferencePresent:
      false,

    initialMetadataEntryCount:
      0,

    pr309Disposition:
      profile
        .pr309Guard
        .disposition,

    replacementProfileStatus:
      profile
        .pr309Guard
        .replacementProfileStatus,

    existingRegistrationAttachable:
      false,

    existingXcfPhase5ReferenceMustNotBeAttached:
      true,

    d4_1cBlocked:
      true,

    safety:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
  };
}


function collectSchemaFacts(
  value:
    unknown,
  strings:
    Set<string>,
  keys:
    Set<string>,
  seen:
    WeakSet<object>,
): void {
  if (
    typeof value ===
      "string"
  ) {
    strings.add(
      value,
    );

    return;
  }

  if (
    typeof value !==
      "object" ||
    value ===
      null
  ) {
    return;
  }

  if (
    seen.has(
      value,
    )
  ) {
    return;
  }

  seen.add(
    value,
  );

  if (
    value instanceof
      Map
  ) {
    for (
      const [
        key,
        entry,
      ]
      of value.entries()
    ) {
      if (
        typeof key ===
          "string"
      ) {
        keys.add(
          key,
        );

        strings.add(
          key,
        );
      }

      collectSchemaFacts(
        entry,
        strings,
        keys,
        seen,
      );
    }

    return;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    for (
      const entry
      of value
    ) {
      collectSchemaFacts(
        entry,
        strings,
        keys,
        seen,
      );
    }

    return;
  }

  for (
    const [
      key,
      entry,
    ]
    of Object.entries(
      value as
        UnknownRecord,
    )
  ) {
    keys.add(
      key,
    );

    collectSchemaFacts(
      entry,
      strings,
      keys,
      seen,
    );
  }
}

function schemaVersion(
  parsed:
    unknown,
): number {
  const record =
    asRecord(
      parsed,
    );

  const candidates =
    [
      record?.version,
      record?.schemaVersion,
      record?.type,
    ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        "number" &&
      Number.isInteger(
        candidate,
      )
    ) {
      return candidate;
    }

    if (
      typeof candidate ===
        "string"
    ) {
      const match =
        candidate.match(
          /(?:^|[^0-9])([0-3])$/,
        );

      if (
        match !==
          null
      ) {
        return Number(
          match[1],
        );
      }
    }
  }

  throw new Error(
    "unable_to_determine_schema_version",
  );
}

function inspectSchema(
  embeddedSchema:
    any,
  sdk:
    any,
): InspectedSchema {
  let parsed:
    unknown;

  try {
    parsed =
      sdk.parseRawModuleSchema(
        embeddedSchema,
      );
  } catch {
    throw new Error(
      "embedded_schema_parse_failed",
    );
  }

  const strings =
    new Set<string>();

  const keys =
    new Set<string>();

  collectSchemaFacts(
    parsed,
    strings,
    keys,
    new WeakSet<object>(),
  );

  const allNames =
    new Set([
      ...strings,
      ...keys,
    ]);

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  if (
    !allNames.has(
      profile
        .registry
        .contractName,
    )
  ) {
    throw new Error(
      "missing_cis8004_contract_schema",
    );
  }

  const entrypointCandidates =
    [
      profile
        .registry
        .registerEntrypoint,
      "agent_of",
      "agents_by_owner",
      "agentOf",
      "agentsByOwner",
      "ownerOf",
      "balanceOf",
      "tokenMetadata",
      "supports",
    ];

  const matchedEntrypoints =
    entrypointCandidates
      .filter(
        (
          name,
        ) =>
          allNames.has(
            name,
          ),
      );

  if (
    !matchedEntrypoints.includes(
      profile
        .registry
        .registerEntrypoint,
    )
  ) {
    throw new Error(
      "missing_cis8004_register_schema",
    );
  }

  const eventSchemaPresent =
    [
      "event",
      "events",
      "Event",
      "Events",
    ]
      .some(
        (
          name,
        ) =>
          keys.has(
            name,
          ),
      );

  return {
    version:
      schemaVersion(
        parsed,
      ),

    matchedEntrypoints,

    eventSchemaPresent,

    parsed,
  };
}


function tokenIdToU64LittleEndianHex(
  tokenId:
    string,
): string {
  if (
    !/^(0|[1-9][0-9]*)$/.test(
      tokenId,
    )
  ) {
    throw new Error(
      `cis8004_token_id_invalid:${tokenId}`,
    );
  }

  let remaining =
    BigInt(
      tokenId,
    );

  if (
    remaining >
      0xffffffffffffffffn
  ) {
    throw new Error(
      `cis8004_token_id_out_of_range:${tokenId}`,
    );
  }

  const bytes =
    Buffer.alloc(
      8,
    );

  for (
    let index =
      0;
    index <
      bytes.length;
    index +=
      1
  ) {
    bytes[index] =
      Number(
        remaining &
          0xffn,
      );

    remaining >>=
      8n;
  }

  return bytes.toString(
    "hex",
  );
}

function protectedTokenSnapshotSha256(
  record:
    Cis8004AgentRecord,
): string {
  return hashHex(
    Buffer.from(
      JSON.stringify(
        record,
      ),
      "utf8",
    ),
  );
}

async function queryAgentAtFinalizedSnapshot<
  TTokenId extends string,
>(
  sdk:
    any,
  client:
    any,
  snapshot:
    Snapshot,
  contractAddress:
    unknown,
  embeddedSchema:
    any,
  tokenId:
    TTokenId,
): Promise<
  AgentTokenSnapshot<TTokenId>
> {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  const contractName =
    sdk.ContractName
      .fromStringUnchecked(
        profile
          .registry
          .contractName,
      );

  const entrypointName =
    sdk.EntrypointName
      .fromString(
        "agentOf",
      );

  const parameter =
    sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      tokenIdToU64LittleEndianHex(
        tokenId,
      ),
      schemaBuffer(
        embeddedSchema,
      ),
    );

  runtimeState.contractInvoked =
    true;

  runtimeState.readOnlyStateQueryCount +=
    1;

  if (
    tokenId === "0" ||
    tokenId === "5"
  ) {
    runtimeState.protectedTokenQueryCount +=
      1;
  } else {
    runtimeState.freshTokenVerificationQueryCount +=
      1;
  }

  const invocation =
    await client
      .invokeContract(
        {
          method:
            sdk.ReceiveName
              .fromString(
                [
                  profile
                    .registry
                    .contractName,
                  "agentOf",
                ].join(
                  ".",
                ),
              ),

          contract:
            contractAddress,

          parameter,
        },

        snapshot
          .finalizedBlock,
      );

  if (
    invocation ===
      null ||
    invocation ===
      undefined ||
    invocation.tag !==
      "success" ||
    invocation.returnValue ===
      null ||
    invocation.returnValue ===
      undefined
  ) {
    throw new Error(
      `cis8004_agentof_invocation_failed:${tokenId}`,
    );
  }

  const rawReturnValue =
    sdk.unwrap(
      invocation
        .returnValue,
    );

  const decoded =
    sdk.deserializeReceiveReturnValue(
      sdk.ReturnValue
        .toBuffer(
          rawReturnValue,
        ),
      schemaBuffer(
        embeddedSchema,
      ),
      contractName,
      entrypointName,
    );

  const record =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
      decoded,
    );

  if (
    record !==
      null &&
    record.tokenId !==
      tokenId
  ) {
    throw new Error(
      `cis8004_agentof_token_id_mismatch:${tokenId}`,
    );
  }

  return {
    tokenId,

    record,

    snapshotSha256:
      protectedTokenSnapshotSha256(
        record,
      ),
  };
}

function safeProtectedTokenSummary(
  snapshot:
    ProtectedTokenSnapshot,
): UnknownRecord {
  const record =
    snapshot.record;

  if (
    record ===
      null
  ) {
    return {
      tokenId:
        snapshot.tokenId,

      present:
        false,

      snapshotSha256:
        snapshot
          .snapshotSha256,
    };
  }

  return {
    tokenId:
      snapshot.tokenId,

    present:
      true,

    snapshotSha256:
      snapshot
        .snapshotSha256,

    ownerAccount:
      record
        .ownerAccount,

    status:
      record
        .status,

    agentUri:
      record
        .agentUri,

    metadataHash:
      record
        .metadataHash,

    externalReferencePresent:
      record
        .externalReference !==
          null,
  };
}

function normalizedMetadataHashHex(
  value:
    unknown,
): string {
  if (
    typeof value ===
      "string"
  ) {
    return value
      .replace(
        /^0x/i,
        "",
      )
      .toLowerCase();
  }

  if (
    value instanceof
      Uint8Array
  ) {
    return Buffer
      .from(
        value,
      )
      .toString(
        "hex",
      );
  }

  if (
    Array.isArray(
      value,
    ) &&
    value.every(
      (
        item,
      ) =>
        Number.isInteger(
          item,
        ) &&
        Number(
          item,
        ) >=
          0 &&
        Number(
          item,
        ) <=
          255,
    )
  ) {
    return Buffer
      .from(
        value as number[],
      )
      .toString(
        "hex",
      );
  }

  return "";
}

function registeredEventPayload(
  decoded:
    unknown,
): unknown {
  const record =
    asRecord(
      decoded,
    );

  if (
    record ===
      null
  ) {
    throw new Error(
      "registration_event_shape_invalid",
    );
  }

  const candidate =
    record.Registered ??
    record.registered;

  if (
    Array.isArray(
      candidate,
    ) &&
    candidate.length ===
      1
  ) {
    return candidate[0];
  }

  if (
    candidate !==
      undefined
  ) {
    return candidate;
  }

  throw new Error(
    "registration_event_registered_variant_missing",
  );
}

function decimalContractAddressComponent(
  value:
    unknown,
): string | null {
  let candidate =
    value;

  const seen =
    new Set<unknown>();

  for (
    let depth =
      0;
    depth <
      12;
    depth +=
      1
  ) {
    if (
      candidate ===
        null ||
      candidate ===
        undefined ||
      seen.has(
        candidate,
      )
    ) {
      return null;
    }

    seen.add(
      candidate,
    );

    if (
      typeof candidate ===
        "bigint" &&
      candidate >=
        0n
    ) {
      return candidate.toString(
        10,
      );
    }

    if (
      typeof candidate ===
        "number" &&
      Number.isSafeInteger(
        candidate,
      ) &&
      candidate >=
        0
    ) {
      return candidate.toString(
        10,
      );
    }

    if (
      typeof candidate ===
        "string" &&
      /^(0|[1-9][0-9]*)$/.test(
        candidate,
      )
    ) {
      return candidate;
    }

    const record =
      asRecord(
        candidate,
      );

    if (
      record ===
        null
    ) {
      return null;
    }

    candidate =
      record.value ??
      record.amount ??
      record.number;
  }

  return null;
}

function contractAddressParts(
  value:
    unknown,
): {
  readonly index:
    string;

  readonly subindex:
    string;
} | null {
  const queue:
    unknown[] =
      [
        value,
      ];

  const seen =
    new Set<unknown>();

  while (
    queue.length >
      0 &&
    seen.size <
      40
  ) {
    const candidate =
      queue.shift();

    if (
      candidate ===
        null ||
      candidate ===
        undefined ||
      seen.has(
        candidate,
      )
    ) {
      continue;
    }

    seen.add(
      candidate,
    );

    const record =
      asRecord(
        candidate,
      );

    if (
      record ===
        null
    ) {
      continue;
    }

    const rawIndex =
      record.index ??
      record.contractIndex;

    const rawSubindex =
      record.subindex ??
      record.subIndex ??
      record.contractSubindex ??
      record.contractSubIndex;

    if (
      rawIndex !==
        undefined &&
      rawSubindex !==
        undefined
    ) {
      const index =
        decimalContractAddressComponent(
          rawIndex,
        );

      const subindex =
        decimalContractAddressComponent(
          rawSubindex,
        );

      if (
        index !==
          null &&
        subindex !==
          null
      ) {
        return {
          index,
          subindex,
        };
      }
    }

    queue.push(
      record.value,
      record.address,
      record.contract,
      record.contractAddress,
      record.instance,
    );
  }

  return null;
}

function contractAddressMatches(
  _sdk:
    any,
  actual:
    unknown,
  expected:
    unknown,
): boolean {
  const actualParts =
    contractAddressParts(
      actual,
    );

  const expectedParts =
    contractAddressParts(
      expected,
    );

  return (
    actualParts !==
      null &&
    expectedParts !==
      null &&
    actualParts.index ===
      expectedParts.index &&
    actualParts.subindex ===
      expectedParts.subindex
  );
}

function readU64LittleEndianDecimal(
  bytes:
    Buffer,
): string {
  if (
    bytes.length !==
      8
  ) {
    throw new Error(
      "registered_event_token_id_length_invalid",
    );
  }

  let value =
    0n;

  for (
    let index =
      bytes.length - 1;
    index >=
      0;
    index -=
      1
  ) {
    value =
      (
        value <<
          8n
      ) |
      BigInt(
        bytes[
          index
        ],
      );
  }

  return value
    .toString(
      10,
    );
}

function decodeRegisteredEventBytes(
  inspection:
    Inspection,
  value:
    Buffer,
): RegisteredEventObservation {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  let offset =
    0;

  if (
    value.length <
      2 ||
    value[
      offset
    ] !==
      REGISTERED_EVENT_TAG
  ) {
    throw new Error(
      "registered_event_tag_invalid",
    );
  }

  offset +=
    1;

  const tokenIdByteLength =
    value[
      offset
    ];

  offset +=
    1;

  if (
    tokenIdByteLength !==
      8 ||
    offset +
      tokenIdByteLength >
      value.length
  ) {
    throw new Error(
      "registered_event_token_id_encoding_invalid",
    );
  }

  const tokenId =
    readU64LittleEndianDecimal(
      value.subarray(
        offset,
        offset +
          tokenIdByteLength,
      ),
    );

  offset +=
    tokenIdByteLength;

  const ownerByteLength =
    32;

  if (
    offset +
      ownerByteLength >
      value.length
  ) {
    throw new Error(
      "registered_event_owner_truncated",
    );
  }

  const ownerBytes =
    value.subarray(
      offset,
      offset +
        ownerByteLength,
    );

  offset +=
    ownerByteLength;

  const expectedOwnerBytes =
    Buffer.from(
      inspection
        .sdk
        .AccountAddress
        .toBuffer(
          inspection
            .ownerAccount,
        ),
    );

  if (
    !ownerBytes.equals(
      expectedOwnerBytes,
    )
  ) {
    throw new Error(
      "registered_event_owner_mismatch",
    );
  }

  if (
    offset >=
      value.length ||
    value[
      offset
    ] !==
      1
  ) {
    throw new Error(
      "registered_event_agent_uri_missing",
    );
  }

  offset +=
    1;

  if (
    offset +
      4 >
      value.length
  ) {
    throw new Error(
      "registered_event_agent_uri_length_truncated",
    );
  }

  const uriByteLength =
    value.readUInt32LE(
      offset,
    );

  offset +=
    4;

  if (
    uriByteLength <=
      0 ||
    offset +
      uriByteLength >
      value.length
  ) {
    throw new Error(
      "registered_event_agent_uri_length_invalid",
    );
  }

  const agentUri =
    value
      .subarray(
        offset,
        offset +
          uriByteLength,
      )
      .toString(
        "utf8",
      );

  offset +=
    uriByteLength;

  if (
    agentUri !==
      profile
        .agentCard
        .uri
  ) {
    throw new Error(
      "registered_event_agent_uri_mismatch",
    );
  }

  if (
    offset >=
      value.length ||
    value[
      offset
    ] !==
      1
  ) {
    throw new Error(
      "registered_event_metadata_hash_missing",
    );
  }

  offset +=
    1;

  const metadataHashByteLength =
    32;

  if (
    offset +
      metadataHashByteLength >
      value.length
  ) {
    throw new Error(
      "registered_event_metadata_hash_truncated",
    );
  }

  const metadataHashHex =
    value
      .subarray(
        offset,
        offset +
          metadataHashByteLength,
      )
      .toString(
        "hex",
      );

  offset +=
    metadataHashByteLength;

  if (
    metadataHashHex !==
      profile
        .agentCard
        .metadataHashHex
  ) {
    throw new Error(
      "registered_event_metadata_hash_mismatch",
    );
  }

  if (
    offset >=
      value.length ||
    value[
      offset
    ] !==
      0
  ) {
    throw new Error(
      "registered_event_external_reference_present",
    );
  }

  offset +=
    1;

  const timestampByteLength =
    8;

  if (
    offset +
      timestampByteLength !==
      value.length
  ) {
    throw new Error(
      "registered_event_trailing_bytes_invalid",
    );
  }

  const registeredAt =
    value.readBigUInt64LE(
      offset,
    );

  if (
    registeredAt <=
      0n
  ) {
    throw new Error(
      "registered_event_timestamp_invalid",
    );
  }

  return {
    tokenId,

    owner:
      profile
        .ownerAccount,

    agentUri,

    metadataHashHex,

    externalReferencePresent:
      false,

    initialMetadataEntryCount:
      0,
  };
}

function matchingRegisteredEvent(
  inspection:
    Inspection,
  summary:
    any,
): RegisteredEventObservation {
  const logs =
    inspection
      .sdk
      .getSummaryContractUpdateLogs(
        summary,
      );

  const matches:
    RegisteredEventObservation[] =
      [];

  for (
    const log of
      logs
  ) {
    if (
      !inspection
        .sdk
        .isKnown(
          log,
        )
    ) {
      throw new Error(
        "unknown_contract_update_log",
      );
    }

    if (
      !contractAddressMatches(
        inspection.sdk,
        log.address,
        inspection.contractAddress,
      )
    ) {
      continue;
    }

    if (
      !Array.isArray(
        log.events,
      )
    ) {
      throw new Error(
        "contract_update_log_events_missing",
      );
    }

    for (
      const event of
        log.events
    ) {
      const bytes =
        Buffer.from(
          inspection
            .sdk
            .ContractEvent
            .toBuffer(
              event,
            ),
        );

      if (
        bytes.length ===
          0 ||
        bytes[
          0
        ] !==
          REGISTERED_EVENT_TAG
      ) {
        continue;
      }

      matches.push(
        decodeRegisteredEventBytes(
          inspection,
          bytes,
        ),
      );
    }
  }

  if (
    matches.length !==
      1
  ) {
    throw new Error(
      `registration_event_count_invalid:${matches.length}`,
    );
  }

  return matches[
    0
  ];
}

async function verifyFinalizedFreshTokenSeam(
  inspection:
    Inspection,
  preSnapshot:
    Snapshot,
  postSnapshot:
    Snapshot,
  summary:
    any,
): Promise<
  FinalizedFreshTokenVerification
> {
  const event =
    matchingRegisteredEvent(
      inspection,
      summary,
    );

  if (
    event.tokenId ===
      "0" ||
    event.tokenId ===
      "5"
  ) {
    throw new Error(
      "protected_token_id_emitted",
    );
  }

  const preRegistration =
    await queryAgentAtFinalizedSnapshot(
      inspection.sdk,
      inspection.client,
      preSnapshot,
      inspection.contractAddress,
      inspection.embeddedSchema,
      event.tokenId,
    );

  if (
    preRegistration.record !==
      null
  ) {
    throw new Error(
      "event_token_present_at_pre_state",
    );
  }

  const postRegistration =
    await queryAgentAtFinalizedSnapshot(
      inspection.sdk,
      inspection.client,
      postSnapshot,
      inspection.contractAddress,
      inspection.embeddedSchema,
      event.tokenId,
    );

  if (
    postRegistration.record ===
      null
  ) {
    throw new Error(
      "event_token_missing_at_post_state",
    );
  }

  const postToken0 =
    await queryAgentAtFinalizedSnapshot(
      inspection.sdk,
      inspection.client,
      postSnapshot,
      inspection.contractAddress,
      inspection.embeddedSchema,
      "0",
    );

  const postToken5 =
    await queryAgentAtFinalizedSnapshot(
      inspection.sdk,
      inspection.client,
      postSnapshot,
      inspection.contractAddress,
      inspection.embeddedSchema,
      "5",
    );

  if (
    postToken0.snapshotSha256 !==
      inspection
        .protectedToken0
        .snapshotSha256 ||
    postToken5.snapshotSha256 !==
      inspection
        .protectedToken5
        .snapshotSha256
  ) {
    throw new Error(
      "protected_token_mutation_detected",
    );
  }

  const postRecord =
    postRegistration.record;

  const postMetadataHashHex =
    normalizedMetadataHashHex(
      postRecord.metadataHash,
    );

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  if (
    postRecord.tokenId !==
      event.tokenId ||
    postRecord.ownerAccount !==
      profile.ownerAccount ||
    postRecord.agentUri !==
      profile.agentCard.uri ||
    postMetadataHashHex !==
      profile.agentCard.metadataHashHex ||
    postRecord.externalReference !==
      null
  ) {
    throw new Error(
      "ownership_postcondition_mismatch",
    );
  }

  if (
    preSnapshot.finalizedBlockHash ===
      postSnapshot.finalizedBlockHash
  ) {
    throw new Error(
      "pre_post_finalized_blocks_not_distinct",
    );
  }

  return {
    registrationEvent:
      event,

    freshTokenProof: {
      tokenId:
        event.tokenId,

      tokenAbsentAtPreState:
        true,

      preStateFinalized:
        true,

      preStateFinalizedBlockHash:
        preSnapshot
          .finalizedBlockHash,
    },

    ownershipPostcondition: {
      tokenId:
        event.tokenId,

      registrationExists:
        true,

      owner:
        postRecord.ownerAccount,

      agentUri:
        postRecord.agentUri,

      metadataHashHex:
        postMetadataHashHex,

      finalized:
        true,

      finalizedBlockHash:
        postSnapshot
          .finalizedBlockHash,
    },

    protectedTokens: {
      token0Unchanged:
        true,

      token5Unchanged:
        true,
    },
  };
}

async function inspectPublicState():
Promise<Inspection> {
  const {
    sdk,
    nodeSdk,
    grpc,
  } =
    await loadSdk();

  const credentials =
    grpc
      .credentials
      .createSsl();

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  const client =
    new nodeSdk
      .ConcordiumGRPCNodeClient(
        profile.grpc.host,
        profile.grpc.port,
        credentials,
      );

  const snapshot =
    await loadSnapshot(
      client,
      sdk,
    );

  const contractAddress =
    sdk.ContractAddress
      .create(
        BigInt(
          profile
            .registry
            .contract
            .index,
        ),

        BigInt(
          profile
            .registry
            .contract
            .subindex,
        ),
      );

  const instanceInfo =
    await client
      .getInstanceInfo(
        contractAddress,
        snapshot.finalizedBlock,
      );

  if (
    instanceInfo ===
      null ||
    instanceInfo ===
      undefined
  ) {
    throw new Error(
      "cis8004_contract_not_found",
    );
  }

  const moduleReference =
    moduleReferenceHex(
      instanceInfo.sourceModule,
      sdk,
    );

  if (
    moduleReference !==
      profile
        .registry
        .moduleReference
  ) {
    throw new Error(
      "cis8004_module_reference_mismatch",
    );
  }

  const embeddedSchema =
    await client
      .getEmbeddedSchema(
        instanceInfo.sourceModule,
        snapshot.finalizedBlock,
      );

  if (
    embeddedSchema ===
      null ||
    embeddedSchema ===
      undefined
  ) {
    throw new Error(
      "cis8004_embedded_schema_unavailable",
    );
  }

  const schema =
    inspectSchema(
      embeddedSchema,
      sdk,
    );

  const ownerAccount =
    sdk.AccountAddress
      .fromBase58(
        profile.ownerAccount,
      );

  const ownerInfo =
    await client
      .getAccountInfo(
        ownerAccount,
        snapshot.finalizedBlock,
      );

  if (
    ownerInfo ===
      null ||
    ownerInfo ===
      undefined
  ) {
    throw new Error(
      "owner_account_not_found",
    );
  }

  const registrationParameter =
    buildDemo4D41aCis8004RegistrationParameterV1();

  const contractName =
    sdk.ContractName
      .fromStringUnchecked(
        profile
          .registry
          .contractName,
      );

  const entrypointName =
    sdk.EntrypointName
      .fromString(
        profile
          .registry
          .registerEntrypoint,
      );

  const serializedParameter =
    sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      registrationParameterForSchema(
        registrationParameter,
      ),
      schemaBuffer(
        embeddedSchema,
      ),
    );

  const parameterBuffer =
    exactBuffer(
      serializedParameter,
      sdk,
    );

  if (
    parameterBuffer.length !==
      profile
        .canonicalSerialization
        .parameterByteLength
  ) {
    throw new Error(
      "canonical_parameter_length_mismatch",
    );
  }

  if (
    hashHex(
      parameterBuffer,
    ) !==
      profile
        .canonicalSerialization
        .parameterSha256
  ) {
    throw new Error(
      "canonical_parameter_hash_mismatch",
    );
  }

  const preflight =
    buildDemo4D41aCis8004RegistrationPreflightV1(
      canonicalPreflightEvidence(
        snapshot,
        moduleReference,
      ),
    );

  const controlledPlan =
    requireAccepted(
      buildDemo4D41aCis8004ControlledExecutionPlanV1(
        preflight,
      ),
      "controlled_plan_rejected",
    );

  const protectedToken0 =
    await queryAgentAtFinalizedSnapshot(
      sdk,
      client,
      snapshot,
      contractAddress,
      embeddedSchema,
      "0",
    );

  const protectedToken5 =
    await queryAgentAtFinalizedSnapshot(
      sdk,
      client,
      snapshot,
      contractAddress,
      embeddedSchema,
      "5",
    );

  return {
    sdk,
    client,
    snapshot,
    contractAddress,
    embeddedSchema,
    schema,
    protectedToken0,
    protectedToken5,
    moduleReference,
    ownerAccount,
    serializedParameter,
    parameterBuffer,
    controlledPlan,
  };
}

async function dryRun(
  inspection:
    Inspection,
): Promise<any> {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  runtimeState.dryRunCalled =
    true;

  runtimeState.contractInvoked =
    true;

  const invocation =
    await inspection.client
      .invokeContract(
        {
          invoker:
            inspection.ownerAccount,

          contract:
            inspection
              .contractAddress,

          method:
            inspection
              .sdk
              .ReceiveName
              .fromString(
                [
                  profile
                    .registry
                    .contractName,

                  profile
                    .registry
                    .registerEntrypoint,
                ].join(
                  ".",
                ),
              ),

          parameter:
            inspection
              .serializedParameter,

          amount:
            inspection
              .sdk
              .CcdAmount
              .zero(),

          energy:
            inspection
              .sdk
              .Energy
              .create(
                DRY_RUN_ENERGY_SAFETY_CAP,
              ),
        },

        inspection
          .snapshot
          .finalizedBlock,
      );

  if (
    invocation ===
      null ||
    invocation ===
      undefined ||
    invocation.tag !==
      "success"
  ) {
    const reason =
      asRecord(
        invocation,
      )?.reason ??
      "unknown";

    throw new Error(
      `cis8004_register_dry_run_failed:${String(reason)}`,
    );
  }

  const usedEnergyValue =
    invocation.usedEnergy ??
    invocation.energyUsed ??
    0n;

  const usedEnergy =
    typeof usedEnergyValue ===
      "bigint"
      ? usedEnergyValue
      : BigInt(
          String(
            usedEnergyValue,
          ),
        );

  return requireAccepted(
    validateDemo4D41aCis8004DryRunObservationV1({
      ok:
        true,

      finalizedState:
        true,

      network:
        profile.network,

      contract:
        profile
          .registry
          .contract,

      receiveName:
        [
          profile
            .registry
            .contractName,

          profile
            .registry
            .registerEntrypoint,
        ].join(
          ".",
        ),

      parameterByteLength:
        inspection
          .parameterBuffer
          .length,

      parameterSha256:
        hashHex(
          inspection
            .parameterBuffer,
        ),

      usedEnergy:
        usedEnergy
          .toString(
            10,
          ),

      returnValuePresent:
        invocation.returnValue !==
          null &&
        invocation.returnValue !==
          undefined,

      walletRead:
        false,

      privateKeyRead:
        false,

      signerCreated:
        false,

      signingAttempted:
        false,

      transactionConstructed:
        false,

      transactionSubmitted:
        false,

      automaticRetryAttempted:
        false,
    }),
    "dry_run_observation_rejected",
  );
}

function safeWalletPath():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1A_WALLET_PATH",
    );

  if (
    configured ===
      undefined
  ) {
    throw new Error(
      "missing_wallet_path",
    );
  }

  if (
    configured.includes(
      "\0",
    )
  ) {
    throw new Error(
      "invalid_wallet_path",
    );
  }

  const absolute =
    isAbsolute(
      configured,
    )
      ? configured
      : resolve(
          process.cwd(),
          configured,
        );

  const metadata =
    lstatSync(
      absolute,
    );

  if (
    !metadata.isFile()
  ) {
    throw new Error(
      "wallet_path_not_regular_file",
    );
  }

  if (
    metadata.isSymbolicLink()
  ) {
    throw new Error(
      "wallet_path_symlink_forbidden",
    );
  }

  if (
    metadata.size <=
      0 ||
    metadata.size >
      MAX_WALLET_BYTES
  ) {
    throw new Error(
      "wallet_size_invalid",
    );
  }

  const canonical =
    realpathSync(
      absolute,
    );

  const parentCanonical =
    realpathSync(
      dirname(
        absolute,
      ),
    );

  if (
    dirname(
      canonical,
    ) !==
      parentCanonical
  ) {
    throw new Error(
      "wallet_path_escape",
    );
  }

  return canonical;
}

function safeEvidencePath():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1A_EVIDENCE_PATH",
    );

  if (
    configured ===
      undefined
  ) {
    throw new Error(
      "missing_evidence_path",
    );
  }

  if (
    configured.includes(
      "\0",
    )
  ) {
    throw new Error(
      "invalid_evidence_path",
    );
  }

  const absolute =
    isAbsolute(
      configured,
    )
      ? configured
      : resolve(
          process.cwd(),
          configured,
        );

  const parentCanonical =
    realpathSync(
      dirname(
        absolute,
      ),
    );

  if (
    dirname(
      absolute,
    ) !==
      parentCanonical
  ) {
    throw new Error(
      "evidence_path_escape",
    );
  }

  try {
    lstatSync(
      absolute,
    );

    throw new Error(
      "evidence_path_already_exists",
    );
  } catch (
    error:
      unknown
  ) {
    const record =
      asRecord(
        error,
      );

    if (
      record?.code !==
        "ENOENT"
    ) {
      throw error;
    }
  }

  return absolute;
}

function safeWalletSigner(
  inspection:
    Inspection,
): {
  readonly signer:
    any;

  readonly sender:
    unknown;
} {
  const walletPath =
    safeWalletPath();

  const walletText =
    readFileSync(
      walletPath,
      "utf8",
    );

  runtimeState.walletRead =
    true;

  runtimeState.privateKeyRead =
    true;

  let walletExport:
    any;

  try {
    walletExport =
      inspection
        .sdk
        .parseWallet(
          walletText,
        );
  } catch {
    throw new Error(
      "wallet_parse_failed",
    );
  }

  const walletAddress =
    walletExport
      ?.value
      ?.address;

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  if (
    typeof walletAddress !==
      "string" ||
    walletAddress !==
      profile.ownerAccount
  ) {
    throw new Error(
      "wallet_owner_mismatch",
    );
  }

  const sender =
    inspection
      .sdk
      .AccountAddress
      .fromBase58(
        walletAddress,
      );

  const signer =
    inspection
      .sdk
      .buildAccountSigner(
        walletExport,
      );

  runtimeState.signerCreated =
    true;

  return {
    signer,
    sender,
  };
}

function exactArrayBufferFromBuffer(
  value:
    Buffer,
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.length,
    );

  copy.set(
    value,
  );

  return copy.buffer;
}

function registrationSerializer(
  inspection:
    Inspection,
): (
  input:
    unknown,
) => ArrayBuffer {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  const contractName =
    inspection
      .sdk
      .ContractName
      .fromStringUnchecked(
        profile
          .registry
          .contractName,
      );

  const entrypointName =
    inspection
      .sdk
      .EntrypointName
      .fromString(
        profile
          .registry
          .registerEntrypoint,
      );

  return (
    input:
      unknown,
  ): ArrayBuffer => {
    const parameter =
      inspection
        .sdk
        .serializeUpdateContractParameters(
          contractName,
          entrypointName,
          input,
          schemaBuffer(
            inspection
              .embeddedSchema,
          ),
        );

    const bytes =
      exactBuffer(
        parameter,
        inspection.sdk,
      );

    return exactArrayBufferFromBuffer(
      bytes,
    );
  };
}

function decimalQuantity(
  value:
    unknown,
  helpers:
    readonly (
      (
        candidate:
          unknown,
      ) => unknown
    )[] =
      [],
): string {
  const candidates:
    unknown[] =
      [
        value,
        asRecord(
          value,
        )?.value,
      ];

  for (
    const helper of
      helpers
  ) {
    try {
      candidates.push(
        helper(
          value,
        ),
      );
    } catch {
      // Try the next representation.
    }
  }

  for (
    const candidate of
      candidates
  ) {
    if (
      typeof candidate ===
        "bigint" &&
      candidate >=
        0n
    ) {
      return candidate
        .toString(
          10,
        );
    }

    if (
      typeof candidate ===
        "number" &&
      Number.isSafeInteger(
        candidate,
      ) &&
      candidate >=
        0
    ) {
      return candidate
        .toString(
          10,
        );
    }

    if (
      typeof candidate ===
        "string" &&
      /^(0|[1-9][0-9]*)$/.test(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  throw new Error(
    "invalid_decimal_quantity",
  );
}

async function finalizedSnapshotAtBlock(
  inspection:
    Inspection,
  finalizedBlock:
    unknown,
): Promise<
  Snapshot
> {
  const blockInfo =
    await inspection
      .client
      .getBlockInfo(
        finalizedBlock,
      );

  if (
    blockInfo ===
      null ||
    blockInfo ===
      undefined ||
    blockInfo.finalized !==
      true
  ) {
    throw new Error(
      "transaction_block_not_finalized",
    );
  }

  return {
    finalizedBlock,

    finalizedBlockHash:
      blockHashHex(
        finalizedBlock,
        inspection.sdk,
      ),

    finalizedBlockHeight:
      safeBlockHeight(
        blockInfo
          .blockHeight,
      ),

    observedAt:
      safeTimestamp(
        blockInfo
          .blockSlotTime,
      ),

    genesisHash:
      inspection
        .snapshot
        .genesisHash,
  };
}

async function executeRegistrationOrchestration(
  decision:
    any,
  initialInspection:
    Inspection,
): Promise<
  UnknownRecord
> {
  if (
    EXECUTE_DISPATCH_ENABLED !==
      true
  ) {
    throw new Error(
      "registration_already_finalized_do_not_rerun",
    );
  }

  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  const preSnapshot =
    await loadSnapshot(
      initialInspection.client,
      initialInspection.sdk,
    );

  const protectedToken0 =
    await queryAgentAtFinalizedSnapshot(
      initialInspection.sdk,
      initialInspection.client,
      preSnapshot,
      initialInspection.contractAddress,
      initialInspection.embeddedSchema,
      "0",
    );

  const protectedToken5 =
    await queryAgentAtFinalizedSnapshot(
      initialInspection.sdk,
      initialInspection.client,
      preSnapshot,
      initialInspection.contractAddress,
      initialInspection.embeddedSchema,
      "5",
    );

  const refreshedPreflight =
    buildDemo4D41aCis8004RegistrationPreflightV1(
      canonicalPreflightEvidence(
        preSnapshot,
        initialInspection.moduleReference,
      ),
    );

  const refreshedPlan =
    requireAccepted(
      buildDemo4D41aCis8004ControlledExecutionPlanV1(
        refreshedPreflight,
      ),
      "controlled_plan_rejected",
    );

  const inspection:
    Inspection = {
      ...initialInspection,

      snapshot:
        preSnapshot,

      protectedToken0,

      protectedToken5,

      controlledPlan:
        refreshedPlan,
    };

  const validatedDryRun =
    await dryRun(
      inspection,
    );

  const submissionAuthorization =
    requireAccepted(
      authorizeDemo4D41aCis8004SubmissionV1({
        activation:
          decision,

        plan:
          inspection
            .controlledPlan,

        dryRun:
          validatedDryRun,

        preState: {
          finalized:
            true,

          protectedToken0Present:
            inspection
              .protectedToken0
              .record !==
                null,

          protectedToken5Present:
            inspection
              .protectedToken5
              .record !==
                null,
        },

        submissionAttemptsBefore:
          runtimeState
            .submissionAttempts,
      }),
      "submission_authorization_rejected",
    );

  const evidencePath =
    safeEvidencePath();

  const wallet =
    safeWalletSigner(
      inspection,
    );

  if (
    runtimeState
      .transactionSubmissionAttempted ||
    runtimeState
      .submissionAttempts !==
        0
  ) {
    throw new Error(
      "duplicate_submission_forbidden",
    );
  }

  const contract =
    await inspection
      .sdk
      .Contract
      .create(
        inspection.client,
        inspection.contractAddress,
      );

  const entrypoint =
    inspection
      .sdk
      .EntrypointName
      .fromString(
        profile
          .registry
          .registerEntrypoint,
      );

  const metadata = {
    senderAddress:
      wallet.sender,

    energy:
      inspection
        .sdk
        .Energy
        .create(
          DRY_RUN_ENERGY_SAFETY_CAP,
        ),

    expiry:
      inspection
        .sdk
        .TransactionExpiry
        .futureMinutes(
          TRANSACTION_EXPIRY_MINUTES,
        ),
  };

  const registrationParameter =
    registrationParameterForSchema(
      buildDemo4D41aCis8004RegistrationParameterV1(),
    );

  runtimeState.transactionConstructed =
    true;

  runtimeState.signingAttempted =
    true;

  runtimeState.transactionSubmissionAttempted =
    true;

  runtimeState.submissionAttempts =
    1;

  const transactionHash =
    await contract
      .createAndSendUpdateTransaction(
        entrypoint,
        registrationSerializer(
          inspection,
        ),
        metadata,
        registrationParameter,
        wallet.signer,
      );

  runtimeState.transactionSubmitted =
    true;

  const transactionHashHex =
    inspection
      .sdk
      .TransactionHash
      .toHexString(
        transactionHash,
      );

  const finalized =
    await inspection
      .client
      .waitForTransactionFinalization(
        transactionHash,
        FINALIZATION_TIMEOUT_MS,
      );

  runtimeState.transactionFinalized =
    true;

  if (
    !inspection
      .sdk
      .isKnown(
        finalized.summary,
      )
  ) {
    throw new Error(
      "unknown_finalized_summary",
    );
  }

  const summary =
    finalized.summary;

  if (
    !inspection
      .sdk
      .isSuccessTransaction(
        summary,
      )
  ) {
    const reason =
      inspection
        .sdk
        .isRejectTransaction(
          summary,
        )
        ? String(
            summary
              .rejectReason
              ?.tag ??
              "unknown",
          )
        : "not_success";

    throw new Error(
      `registration_transaction_failed:${reason}`,
    );
  }

  if (
    !inspection
      .sdk
      .isUpdateContractSummary(
        summary,
      )
  ) {
    throw new Error(
      "finalized_summary_not_contract_update",
    );
  }

  const finalizedSender =
    Buffer.from(
      inspection
        .sdk
        .AccountAddress
        .toBuffer(
          summary.sender,
        ),
    );

  const expectedSender =
    Buffer.from(
      inspection
        .sdk
        .AccountAddress
        .toBuffer(
          inspection
            .ownerAccount,
        ),
    );

  if (
    !finalizedSender.equals(
      expectedSender,
    )
  ) {
    throw new Error(
      "finalized_sender_mismatch",
    );
  }

  const postSnapshot =
    await finalizedSnapshotAtBlock(
      inspection,
      finalized.blockHash,
    );

  const verification =
    await verifyFinalizedFreshTokenSeam(
      inspection,
      preSnapshot,
      postSnapshot,
      summary,
    );

  const finalizedBlockHash =
    blockHashHex(
      finalized.blockHash,
      inspection.sdk,
    );

  if (
    finalizedBlockHash !==
      postSnapshot
        .finalizedBlockHash
  ) {
    throw new Error(
      "transaction_postcondition_block_mismatch",
    );
  }

  const sanitizedEvidence =
    requireAccepted(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        submissionAuthorization,

        submissionAttempts:
          runtimeState
            .submissionAttempts,

        automaticRetryAttempted:
          runtimeState
            .automaticRetryAttempted,

        transaction: {
          hash:
            transactionHashHex,

          finalized:
            true,

          finalizedBlockHash,

          energyCost:
            decimalQuantity(
              summary
                .energyCost,
              [
                (
                  value,
                ) =>
                  inspection
                    .sdk
                    .Energy
                    ?.toBigInt
                    ?.(
                      value,
                    ),
              ],
            ),

          costMicroCcd:
            String(
              summary.cost,
            ),

          transactionType:
            String(
              summary
                .transactionType,
            ),
        },

        registrationEvent:
          verification
            .registrationEvent,

        freshTokenProof:
          verification
            .freshTokenProof,

        ownershipPostcondition:
          verification
            .ownershipPostcondition,

        protectedTokens:
          verification
            .protectedTokens,

        safety: {
          gatewayRuntimeActivated:
            false,

          protectedResourceReleased:
            false,

          paymentAttempted:
            false,

          settlementAttempted:
            false,

          receiptIssued:
            false,

          d4_1cAttached:
            false,

          revocationAttempted:
            false,
        },
      }),
      "evidence_rejected",
    );

  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      sanitizedEvidence,
      null,
      2,
    )}\n`,
    {
      encoding:
        "utf8",

      flag:
        "wx",

      mode:
        0o600,
    },
  );

  runtimeState.evidenceWritten =
    true;

  return {
    ok:
      true,

    type:
      SCRIPT_TYPE,

    implementationStage:
      IMPLEMENTATION_STAGE,

    mode:
      "execute",

    network:
      profile.network,

    transaction: {
      hash:
        transactionHashHex,

      finalized:
        true,

      finalizedBlockHash,
    },

    registration: {
      tokenId:
        verification
          .registrationEvent
          .tokenId,

      owner:
        verification
          .registrationEvent
          .owner,

      agentUri:
        verification
          .registrationEvent
          .agentUri,

      externalReferencePresent:
        false,

      initialMetadataEntryCount:
        0,
    },

    freshTokenProof:
      verification
        .freshTokenProof,

    protectedTokens:
      verification
        .protectedTokens,

    evidence: {
      written:
        true,

      file:
        basename(
          evidencePath,
        ),

      privateMaterialIncluded:
        false,

      walletMaterialIncluded:
        false,

      rawParameterIncluded:
        false,
    },

    runtimeSafety: {
      ...runtimeState,
    },

    rawWalletPrinted:
      false,

    rawPrivateKeyPrinted:
      false,

    rawTransactionPayloadPrinted:
      false,
  };
}

function safeSummary(
  mode:
    string,
  inspection:
    Inspection,
  validatedDryRun?:
    any,
): UnknownRecord {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  return {
    ok:
      true,

    type:
      SCRIPT_TYPE,

    implementationStage:
      IMPLEMENTATION_STAGE,

    mode,

    network:
      profile.network,

    finalizedSnapshot: {
      blockHash:
        inspection
          .snapshot
          .finalizedBlockHash,

      blockHeight:
        inspection
          .snapshot
          .finalizedBlockHeight,

      observedAt:
        inspection
          .snapshot
          .observedAt,
    },

    registry: {
      contract:
        profile
          .registry
          .contract,

      contractName:
        profile
          .registry
          .contractName,

      registerEntrypoint:
        profile
          .registry
          .registerEntrypoint,

      moduleReference:
        inspection
          .moduleReference,
    },

    deployedSchema: {
      version:
        inspection
          .schema
          .version,

      matchedEntrypoints:
        inspection
          .schema
          .matchedEntrypoints,

      eventSchemaPresent:
        inspection
          .schema
          .eventSchemaPresent,
    },

    protectedTokens: {
      token0:
        safeProtectedTokenSummary(
          inspection
            .protectedToken0,
        ),

      token5:
        safeProtectedTokenSummary(
          inspection
            .protectedToken5,
        ),
    },

    ownerAccount:
      profile.ownerAccount,

    agentCard: {
      uri:
        profile
          .agentCard
          .uri,

      sha256:
        profile
          .agentCard
          .sha256,
    },

    canonicalParameter: {
      byteLength:
        inspection
          .parameterBuffer
          .length,

      sha256:
        hashHex(
          inspection
            .parameterBuffer,
        ),

      externalReferencePresent:
        false,

      initialMetadataEntryCount:
        0,
    },

    plan: {
      submissionLimit:
        inspection
          .controlledPlan
          .submissionLimit,

      automaticRetryAuthorized:
        inspection
          .controlledPlan
          .automaticRetryAuthorized,

      transactionExecutionAuthorized:
        inspection
          .controlledPlan
          .transactionExecutionAuthorized,
    },

    dryRun:
      validatedDryRun ===
        undefined
        ? {
            called:
              false,
          }
        : {
            called:
              true,

            status:
              validatedDryRun
                .status,

            usedEnergy:
              validatedDryRun
                .usedEnergy,

            sideEffectFree:
              validatedDryRun
                .sideEffectFree,
          },

    runtimeSafety: {
      ...runtimeState,
    },

    finalizationSeam: {
      registeredEventTag:
        REGISTERED_EVENT_TAG,

      genericAgentOfQuery:
        true,

      preStateAbsenceProof:
        true,

      postStateRegistrationProof:
        true,

      protectedTokenComparison:
        true,
    },

    orchestration: {
      implemented:
        true,

      dispatchEnabled:
        EXECUTE_DISPATCH_ENABLED,

      walletPathGuardImplemented:
        true,

      evidencePathGuardImplemented:
        true,

      exactlyOneSubmissionGuardImplemented:
        true,

      finalizedEvidenceBuilderIntegrated:
        true,
    },

    executeModeAvailable:
      false,

    executeModeStatus:
      "registration_already_finalized_do_not_rerun",

    explicitAuthorizationRequired:
      true,

    evidenceWritten:
      false,

    rawWalletPrinted:
      false,

    rawPrivateKeyPrinted:
      false,

    rawTransactionPayloadPrinted:
      false,
  };
}

async function main():
Promise<void> {
  const decision =
    activation();

  const inspection =
    await inspectPublicState();

  if (
    decision.mode ===
      "execute"
  ) {
    const executionResult =
      await executeRegistrationOrchestration(
        decision,
        inspection,
      );

    process.stdout.write(
      `${JSON.stringify(
        executionResult,
        null,
        2,
      )}\n`,
    );

    return;
  }

  if (
    decision.mode ===
      "inspect"
  ) {
    process.stdout.write(
      `${JSON.stringify(
        safeSummary(
          decision.mode,
          inspection,
        ),
        null,
        2,
      )}\n`,
    );

    return;
  }

  if (
    decision.mode !==
      "dry_run"
  ) {
    throw new Error(
      `unsupported_mode:${String(decision.mode)}`,
    );
  }

  const validatedDryRun =
    await dryRun(
      inspection,
    );

  process.stdout.write(
    `${JSON.stringify(
      safeSummary(
        decision.mode,
        inspection,
        validatedDryRun,
      ),
      null,
      2,
    )}\n`,
  );
}

main().catch(
  (
    error:
      unknown,
  ) => {
    const message =
      error instanceof
        Error
        ? error.message
        : String(
            error,
          );

    process.stderr.write(
      `${JSON.stringify(
        {
          ok:
            false,

          type:
            SCRIPT_TYPE,

          implementationStage:
            IMPLEMENTATION_STAGE,

          reason:
            message,

          runtimeSafety: {
            ...runtimeState,
          },

          automaticRetryAttempted:
            false,

          rawWalletPrinted:
            false,

          rawPrivateKeyPrinted:
            false,

          rawTransactionPayloadPrinted:
            false,
        },
        null,
        2,
      )}\n`,
    );

    process.exitCode =
      1;
  },
);
