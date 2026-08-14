/**
 * PR #314 — Demo4 D4-1C controlled external-reference attachment runner.
 *
 * Public read-only Testnet preflight implementation is wired but dispatch-locked.
 *
 * The preflight implementation may construct a Concordium gRPC client and
 * perform only finalized public reads when separately authorized later.
 * Bounded wallet/signer and exactly-one transaction execution machinery is
 * implemented but dispatch-locked by default. Payment remains absent. The
 * bounded contract dry-run remains independently dispatch-locked.
 */

import {
  createHash,
} from "node:crypto";

import {
  Buffer,
} from "node:buffer";

import {
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";

import {
  dirname,
  isAbsolute,
  resolve,
} from "node:path";


import {
  DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE,
  DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE,
  buildDemo4D41cControlledExecutionPlanV1,
  authorizeDemo4D41cControlledExecutionV1,
  validateDemo4D41cControlledExecutionActivationV1,
  validateDemo4D41cFutureFinalizedObservationV1,
  validateDemo4D41cLivePreExecutionObservationV1,
} from "../src/phase6/demo4Cis8004ExternalReferenceAttachmentControlledExecution";

import {
  buildDemo4D41cAttachmentCandidateV1,
  buildDemo4D41cNormalizedExternalReferenceV1,
  serializeDemo4D41cSetExternalReferenceParameterV1,
} from "../src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight";

import {
  normalizeConcordiumCis8004DecodedAgentOfResultForTestV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

export const DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED =
  false as const;

export const DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED =
  false as const;

export const DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED =
  false as const;

export const DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_AVAILABLE =
  true as const;

export const DEMO4_D4_1C_DRY_RUN_IMPLEMENTATION_AVAILABLE =
  true as const;

function dryRunDispatchEnabled():
boolean {
  return Boolean(
    DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED,
  );
}

function executeDispatchEnabled():
boolean {
  return Boolean(
    DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED,
  );
}

const runtimeState = {
  environmentRead:
    false,

  filesystemRead:
    false,

  filesystemWrite:
    false,

  networkCalled:
    false,

  contractDryRunPerformed:
    false,

  readOnlyStateQueryCount:
    0,

  privateKeyRead:
    false,

  walletRead:
    false,

  signerCreated:
    false,

  transactionConstructed:
    false,

  transactionSigningAttempted:
    false,

  transactionSubmissionAttempted:
    false,

  submissionAttempts:
    0,

  transactionSubmitted:
    false,

  transactionFinalized:
    false,

  automaticRetryAttempted:
    false,

  paymentAttempted:
    false,

  d4_1cPerformed:
    false,
};

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

function modeFromEnvironment():
"inspect" | "preflight" | "dry-run" | "execute" | "invalid" {
  const raw =
    exactEnv(
      "DEMO4_D4_1C_MODE",
    );

  if (
    raw ===
      undefined ||
    raw ===
      "inspect"
  ) {
    return "inspect";
  }

  if (
    raw ===
      "preflight"
  ) {
    return "preflight";
  }

  if (
    raw ===
      "dry-run"
  ) {
    return "dry-run";
  }

  if (
    raw ===
      "execute"
  ) {
    return "execute";
  }

  return "invalid";
}

type UnknownRecord =
  Record<string, unknown>;

function livePreExecutionDispatchEnabled():
boolean {
  return DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED;
}

function asRecord(
  value:
    unknown,
): UnknownRecord | null {
  if (
    value ===
      null ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function sha256Hex(
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

function schemaBuffer(
  embeddedSchema:
    any,
): Buffer {
  const normalize = (
    candidate:
      unknown,
  ): Buffer | null => {
    if (
      Buffer.isBuffer(
        candidate,
      )
    ) {
      return Buffer.from(
        candidate,
      );
    }

    if (
      candidate instanceof
        Uint8Array
    ) {
      return Buffer.from(
        new Uint8Array(
          candidate.buffer,
          candidate.byteOffset,
          candidate.byteLength,
        ),
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

    return null;
  };

  const direct =
    normalize(
      embeddedSchema,
    );

  if (
    direct !==
      null
  ) {
    return direct;
  }

  const record =
    asRecord(
      embeddedSchema,
    );

  if (
    record !==
      null &&
    "buffer" in
      record &&
    record.buffer !==
      embeddedSchema
  ) {
    const wrapped =
      normalize(
        record.buffer,
      );

    if (
      wrapped !==
        null
    ) {
      return wrapped;
    }
  }

  throw new Error(
    "invalid_embedded_schema_bytes",
  );
}

export function normalizeDemo4D41cEmbeddedSchemaBytesForTestV1(
  embeddedSchema:
    unknown,
): Buffer {
  return schemaBuffer(
    embeddedSchema,
  );
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
    unknown[] = [
      value,
  ];

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
      // Continue through supported SDK representations.
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
      typeof candidate !==
        "string"
    ) {
      continue;
    }

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

  return null;
}

function moduleReferenceHex(
  value:
    unknown,
  sdk:
    any,
): string {
  const normalized =
    lowerHex64(
      value,
      [
        (
          input,
        ) =>
          sdk.ModuleReference
            ?.toHexString
            ?.(input),

        (
          input,
        ) =>
          sdk.ModuleReference
            ?.toString
            ?.(input),
      ],
    );

  if (
    normalized ===
      null
  ) {
    throw new Error(
      "invalid_module_reference",
    );
  }

  return normalized;
}

function blockHashHex(
  value:
    unknown,
  sdk:
    any,
): string {
  const normalized =
    lowerHex64(
      value,
      [
        (
          input,
        ) =>
          sdk.BlockHash
            ?.toHexString
            ?.(input),

        (
          input,
        ) =>
          sdk.BlockHash
            ?.toString
            ?.(input),
      ],
    );

  if (
    normalized ===
      null
  ) {
    throw new Error(
      "invalid_finalized_block_hash",
    );
  }

  return normalized;
}

function decimalQuantity(
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

function tokenIdU64LittleEndianHex(
  tokenId:
    number,
): string {
  if (
    !Number.isSafeInteger(
      tokenId,
    ) ||
    tokenId <
      0
  ) {
    throw new Error(
      "invalid_agent_token_id",
    );
  }

  const bytes =
    Buffer.alloc(
      8,
    );

  bytes.writeBigUInt64LE(
    BigInt(
      tokenId,
    ),
    0,
  );

  return bytes.toString(
    "hex",
  );
}

function externalKeyForSchema(
  externalKey: {
    readonly namespace:
      string;

    readonly keyType:
      string;

    readonly publicKeyHex:
      string;
  },
) {
  if (
    !/^[0-9a-f]{64}$/.test(
      externalKey.publicKeyHex,
    )
  ) {
    throw new Error(
      "invalid_external_public_key",
    );
  }

  return {
    namespace:
      externalKey.namespace,

    key_type:
      externalKey.keyType,

    public_key:
      Array.from(
        Buffer.from(
          externalKey.publicKeyHex,
          "hex",
        ),
        (
          byte,
        ) =>
          BigInt(
            byte,
          ),
      ),
  };
}

function externalReferenceForSchema(
  _sdk:
    any,
  candidate:
    ReturnType<
      typeof buildDemo4D41cAttachmentCandidateV1
    >,
) {
  return {
    contract_address: {
      index:
        BigInt(
          candidate
            .externalReference
            .contract
            .index,
        ),

      subindex:
        BigInt(
          candidate
            .externalReference
            .contract
            .subindex,
        ),
    },

    kind: {
      Cis8: [
        externalKeyForSchema(
          candidate
            .externalReference
            .externalKey,
        ),
      ],
    },
  };
}

export function buildDemo4D41cExternalReferenceSchemaValueForTestV1() {
  return externalReferenceForSchema(
    undefined,
    buildDemo4D41cAttachmentCandidateV1(),
  );
}

function ownerOfKeyForSchema(
  candidate:
    ReturnType<
      typeof buildDemo4D41cAttachmentCandidateV1
    >,
) {
  return {
    external_key:
      externalKeyForSchema(
        candidate
          .cis8
          .externalKey,
      ),
  };
}

function setExternalReferenceForSchema(
  sdk:
    any,
  candidate:
    ReturnType<
      typeof buildDemo4D41cAttachmentCandidateV1
    >,
) {
  return {
    token_id:
      tokenIdU64LittleEndianHex(
        candidate
          .cis8004
          .tokenId,
      ),

    external_reference: {
      Some: [
        externalReferenceForSchema(
          sdk,
          candidate,
        ),
      ],
    },
  };
}

function exactArrayBufferFromBytes(
  value:
    Uint8Array,
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

function parameterBytes(
  parameter:
    any,
  sdk:
    any,
): Buffer {
  return Buffer.from(
    sdk.Parameter
      .toBuffer(
        parameter,
      ),
  );
}

function optionIsNone(
  value:
    unknown,
): boolean {
  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null
  ) {
    return false;
  }

  const keys =
    Object.keys(
      record,
    );

  return (
    keys.length ===
      1 &&
    keys[0] ===
      "None" &&
    Array.isArray(
      record.None,
    ) &&
    record.None.length ===
      0
  );
}

async function invokeDecodedReadOnly(
  input: {
    readonly sdk:
      any;

    readonly client:
      any;

    readonly finalizedBlock:
      unknown;

    readonly contract:
      unknown;

    readonly contractName:
      string;

    readonly entrypoint:
      string;

    readonly parameter:
      unknown;

    readonly embeddedSchema:
      any;
  },
): Promise<unknown> {
  runtimeState.networkCalled =
    true;

  runtimeState.readOnlyStateQueryCount +=
    1;

  const contractName =
    input.sdk
      .ContractName
      .fromStringUnchecked(
        input.contractName,
      );

  const entrypointName =
    input.sdk
      .EntrypointName
      .fromString(
        input.entrypoint,
      );

  const invocation =
    await input.client
      .invokeContract(
        {
          method:
            input.sdk
              .ReceiveName
              .fromString(
                [
                  input.contractName,
                  input.entrypoint,
                ].join(
                  ".",
                ),
              ),

          contract:
            input.contract,

          parameter:
            input.parameter,
        },

        input.finalizedBlock,
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
      `read_only_invocation_failed:${input.entrypoint}`,
    );
  }

  const rawReturnValue =
    input.sdk
      .unwrap(
        invocation
          .returnValue,
      );

  return input.sdk
    .deserializeReceiveReturnValue(
      input.sdk
        .ReturnValue
        .toBuffer(
          rawReturnValue,
        ),
      schemaBuffer(
        input.embeddedSchema,
      ),
      contractName,
      entrypointName,
    );
}

export async function runDemo4D41cPublicReadPreflightV1() {
  if (
    livePreExecutionDispatchEnabled() !==
      true
  ) {
    throw new Error(
      "live_preexecution_dispatch_locked",
    );
  }

  if (
    DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED !==
      false ||
    DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED !==
      false
  ) {
    throw new Error(
      "unsafe_adjacent_dispatch_state",
    );
  }

  runtimeState.readOnlyStateQueryCount =
    0;

  const candidate =
    buildDemo4D41cAttachmentCandidateV1();

  const profile =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  const publicReadProfile =
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE;

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

  const credentials =
    grpc
      .credentials
      .createSsl();

  const client =
    new nodeSdk
      .ConcordiumGRPCNodeClient(
        publicReadProfile.grpc.host,
        publicReadProfile.grpc.port,
        credentials,
      );

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

  const finalizedBlockHash =
    blockHashHex(
      finalizedBlock,
      sdk,
    );

  const finalizedBlockHeight =
    decimalQuantity(
      blockInfo.blockHeight ??
      consensus
        .lastFinalizedBlockHeight,
    );

  const cis8004Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8004
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8004
            .contract
            .subindex,
        ),
      );

  const cis8004Instance =
    await client
      .getInstanceInfo(
        cis8004Contract,
        finalizedBlock,
      );

  if (
    cis8004Instance ===
      null ||
    cis8004Instance ===
      undefined
  ) {
    throw new Error(
      "cis8004_contract_not_found",
    );
  }

  const cis8004Module =
    moduleReferenceHex(
      cis8004Instance.sourceModule,
      sdk,
    );

  if (
    cis8004Module !==
      profile
        .cis8004
        .moduleReference
  ) {
    throw new Error(
      "cis8004_module_reference_mismatch",
    );
  }

  const cis8004Schema =
    await client
      .getEmbeddedSchema(
        cis8004Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8004Schema ===
      null ||
    cis8004Schema ===
      undefined
  ) {
    throw new Error(
      "cis8004_embedded_schema_unavailable",
    );
  }

  const cis8004SchemaBuffer =
    schemaBuffer(
      cis8004Schema,
    );

  const cis8004SchemaSha256 =
    sha256Hex(
      cis8004SchemaBuffer,
    );

  if (
    cis8004SchemaBuffer.length !==
      publicReadProfile
        .cis8004
        .embeddedSchemaByteLength ||
    cis8004SchemaSha256 !==
      publicReadProfile
        .cis8004
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8004_embedded_schema_mismatch",
    );
  }

  const cis8004ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8004
          .contractName,
      );

  const agentOfEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      );

  const agentOfParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      agentOfEntrypoint,
      tokenIdU64LittleEndianHex(
        candidate
          .cis8004
          .tokenId,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const agentDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      parameter:
        agentOfParameter,
      embeddedSchema:
        cis8004Schema,
    });

  const agentRecord =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
      agentDecoded,
    );

  if (
    agentRecord ===
      null
  ) {
    throw new Error(
      "cis8004_agent_287_missing",
    );
  }

  const reverseEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      );

  const reverseParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      reverseEntrypoint,
      externalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const reverseDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      parameter:
        reverseParameter,
      embeddedSchema:
        cis8004Schema,
    });

  if (
    !optionIsNone(
      reverseDecoded,
    )
  ) {
    throw new Error(
      "external_reference_already_attached_or_malformed",
    );
  }

  const cis8Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8
            .contract
            .subindex,
        ),
      );

  const cis8Instance =
    await client
      .getInstanceInfo(
        cis8Contract,
        finalizedBlock,
      );

  if (
    cis8Instance ===
      null ||
    cis8Instance ===
      undefined
  ) {
    throw new Error(
      "cis8_contract_not_found",
    );
  }

  const cis8Module =
    moduleReferenceHex(
      cis8Instance.sourceModule,
      sdk,
    );

  if (
    cis8Module !==
      candidate
        .cis8
        .moduleReference
  ) {
    throw new Error(
      "cis8_module_reference_mismatch",
    );
  }

  const cis8Schema =
    await client
      .getEmbeddedSchema(
        cis8Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8Schema ===
      null ||
    cis8Schema ===
      undefined
  ) {
    throw new Error(
      "cis8_embedded_schema_unavailable",
    );
  }

  const cis8SchemaBuffer =
    schemaBuffer(
      cis8Schema,
    );

  const cis8SchemaSha256 =
    sha256Hex(
      cis8SchemaBuffer,
    );

  if (
    cis8SchemaBuffer.length !==
      publicReadProfile
        .cis8
        .embeddedSchemaByteLength ||
    cis8SchemaSha256 !==
      publicReadProfile
        .cis8
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8_embedded_schema_mismatch",
    );
  }

  const cis8ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8
          .contractName,
      );

  const ownerOfKeyEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      );

  const ownerOfKeyParameter =
    sdk.serializeUpdateContractParameters(
      cis8ContractName,
      ownerOfKeyEntrypoint,
      ownerOfKeyForSchema(
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8SchemaBuffer,
      ),
    );

  const ownerDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8Contract,
      contractName:
        candidate
          .cis8
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      parameter:
        ownerOfKeyParameter,
      embeddedSchema:
        cis8Schema,
    });

  const ownerRecord =
    normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1(
      ownerDecoded,
    );

  if (
    ownerRecord ===
      null
  ) {
    throw new Error(
      "cis8_external_key_unregistered",
    );
  }

  if (
    ownerRecord.proofScheme !==
      publicReadProfile
        .cis8
        .proofScheme
  ) {
    throw new Error(
      "cis8_proof_scheme_mismatch",
    );
  }

  const setExternalReferenceEntrypoint =
    sdk.EntrypointName
      .fromString(
        candidate
          .cis8004
          .entrypoint,
      );

  const sdkParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      setExternalReferenceEntrypoint,
      setExternalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const sdkParameterBytes =
    parameterBytes(
      sdkParameter,
      sdk,
    );

  const deterministicParameterBytes =
    Buffer.from(
      serializeDemo4D41cSetExternalReferenceParameterV1(
        candidate,
      ),
    );

  if (
    sdkParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    deterministicParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    !sdkParameterBytes.equals(
      deterministicParameterBytes,
    )
  ) {
    throw new Error(
      "sdk_parameter_byte_equivalence_failed",
    );
  }

  const sdkParameterSha256 =
    sha256Hex(
      sdkParameterBytes,
    );

  if (
    sdkParameterSha256 !==
      publicReadProfile
        .parameterSha256
  ) {
    throw new Error(
      "sdk_parameter_sha256_mismatch",
    );
  }

  const externalKeyMatches =
    ownerRecord.externalKey.namespace ===
      candidate.cis8.externalKey.namespace &&
    ownerRecord.externalKey.keyType ===
      candidate.cis8.externalKey.keyType &&
    ownerRecord.externalKey.publicKeyHex ===
      candidate.cis8.externalKey.publicKeyHex;

  const observation = {
    network:
      profile.network,

    finalizedSnapshot: {
      finalized:
        true,

      finalizedBlockHash,

      finalizedBlockHeight,

      singleFinalizedSnapshotBound:
        true,
    },

    cis8004: {
      contract: {
        ...candidate
          .cis8004
          .contract,
      },

      moduleReference:
        cis8004Module,

      embeddedSchemaByteLength:
        cis8004SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8004SchemaSha256,

      schemaPresent:
        true,

      tokenId:
        agentRecord.tokenId,

      tokenPresent:
        true,

      status:
        agentRecord.status,

      ownerAccount:
        agentRecord.ownerAccount,

      agentUri:
        agentRecord.agentUri,

      metadataHash:
        agentRecord.metadataHash,

      externalReferencePresent:
        agentRecord.externalReference !==
          null,

      revokedAtPresent:
        agentRecord.revokedAt !==
          null,

      revocationReasonPresent:
        agentRecord.revocationReason !==
          null,
    },

    reverseReference: {
      completeExternalReferenceCompared:
        true,

      alreadyAttached:
        false,

      unique:
        true,
    },

    cis8: {
      contract: {
        ...candidate
          .cis8
          .contract,
      },

      moduleReference:
        cis8Module,

      embeddedSchemaByteLength:
        cis8SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8SchemaSha256,

      status:
        ownerRecord.status,

      registered:
        true,

      ownerAccount:
        ownerRecord.owner,

      externalKey: {
        namespace:
          ownerRecord
            .externalKey
            .namespace,

        keyType:
          ownerRecord
            .externalKey
            .keyType,

        publicKeyHex:
          ownerRecord
            .externalKey
            .publicKeyHex,
      },

      completeExternalKeyMatch:
        externalKeyMatches,
    },

    parameter: {
      deterministicByteLength:
        deterministicParameterBytes.length,

      deterministicSha256:
        sha256Hex(
          deterministicParameterBytes,
        ),

      sdkSerializedByteLength:
        sdkParameterBytes.length,

      sdkSerializedSha256:
        sdkParameterSha256,

      exactSdkByteEquivalence:
        sdkParameterBytes.equals(
          deterministicParameterBytes,
        ),
    },

    dryRunBoundary: {
      capabilityDefined:
        true,

      authorizationPresent:
        false,

      invocationAttempted:
        false,

      performed:
        false,

      attachedCcd:
        "0",

      energySafetyCap:
        "100000",
    },

    safety: {
      readOnlyStateQueryCount:
        runtimeState
          .readOnlyStateQueryCount,

      stateMutationPerformed:
        false,

      privateKeyRead:
        runtimeState.privateKeyRead,

      walletRead:
        runtimeState.walletRead,

      signerCreated:
        runtimeState.signerCreated,

      transactionConstructed:
        runtimeState
          .transactionConstructed,

      transactionSigned:
        runtimeState
          .transactionSigningAttempted,

      transactionSubmitted:
        runtimeState
          .transactionSubmitted,

      paymentAttempted:
        runtimeState
          .paymentAttempted,

      d4_1cPerformed:
        runtimeState
          .d4_1cPerformed,
    },
  };

  const validated =
    validateDemo4D41cLivePreExecutionObservationV1(
      observation,
    );

  if (
    !validated.ok
  ) {
    throw new Error(
      `live_preexecution_validation_failed:${validated.reason}`,
    );
  }

  return validated.value;
}


function boundedDryRunEnergy(
  value:
    unknown,
): bigint {
  if (
    typeof value ===
      "bigint"
  ) {
    if (
      value <
        0n
    ) {
      throw new Error(
        "invalid_dry_run_energy",
      );
    }

    return value;
  }

  if (
    typeof value ===
      "number"
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value <
        0
    ) {
      throw new Error(
        "invalid_dry_run_energy",
      );
    }

    return BigInt(
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
    return BigInt(
      value,
    );
  }

  const record =
    asRecord(
      value,
    );

  if (
    record !==
      null &&
    "value" in
      record &&
    record.value !==
      value
  ) {
    return boundedDryRunEnergy(
      record.value,
    );
  }

  throw new Error(
    "invalid_dry_run_energy",
  );
}

export async function runDemo4D41cBoundedDryRunInvocationForTestV1(
  input: {
    readonly sdk:
      any;

    readonly client:
      any;

    readonly finalizedBlock:
      any;

    readonly ownerAccount:
      any;

    readonly contractAddress:
      any;

    readonly parameter:
      any;
  },
) {
  const energySafetyCap =
    100_000n;

  let attemptCount =
    0;

  attemptCount +=
    1;

  if (
    attemptCount !==
      1
  ) {
    throw new Error(
      "dry_run_attempt_ceiling_exceeded",
    );
  }

  const zeroCcd =
    input.sdk
      .CcdAmount
      .zero();

  const energy =
    input.sdk
      .Energy
      .create(
        energySafetyCap,
      );

  const invocation =
    await input.client
      .invokeContract(
        {
          invoker:
            input.ownerAccount,

          contract:
            input.contractAddress,

          method:
            input.sdk
              .ReceiveName
              .fromString(
                "CIS-8004.setExternalReference",
              ),

          parameter:
            input.parameter,

          amount:
            zeroCcd,

          energy,
        },

        input.finalizedBlock,
      );

  if (
    invocation ===
      null ||
    invocation ===
      undefined ||
    invocation.tag !==
      "success"
  ) {
    throw new Error(
      "set_external_reference_dry_run_failed",
    );
  }

  const usedEnergy =
    boundedDryRunEnergy(
      invocation.usedEnergy ??
      invocation.energyUsed,
    );

  if (
    usedEnergy >
      energySafetyCap
  ) {
    throw new Error(
      "dry_run_energy_exceeds_safety_cap",
    );
  }

  return Object.freeze({
    attemptCount:
      1 as const,

    succeeded:
      true as const,

    usedEnergy:
      usedEnergy.toString(
        10,
      ),

    energySafetyCap:
      "100000" as const,

    zeroCcdAttached:
      true as const,

    automaticRetryAttempted:
      false as const,

    returnValuePresent:
      invocation.returnValue !==
        null &&
      invocation.returnValue !==
        undefined,
  });
}

export async function runDemo4D41cContractDryRunV1() {
  if (
    dryRunDispatchEnabled() !==
      true
  ) {
    throw new Error(
      "dry_run_dispatch_locked",
    );
  }

  if (
    DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED !==
      false ||
    DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED !==
      false
  ) {
    throw new Error(
      "unsafe_adjacent_dispatch_state",
    );
  }

  runtimeState.contractDryRunPerformed =
    false;

  runtimeState.readOnlyStateQueryCount =
    0;

  const candidate =
    buildDemo4D41cAttachmentCandidateV1();

  const profile =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  const publicReadProfile =
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE;

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

  const credentials =
    grpc
      .credentials
      .createSsl();

  const client =
    new nodeSdk
      .ConcordiumGRPCNodeClient(
        publicReadProfile.grpc.host,
        publicReadProfile.grpc.port,
        credentials,
      );

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

  const finalizedBlockHash =
    blockHashHex(
      finalizedBlock,
      sdk,
    );

  const finalizedBlockHeight =
    decimalQuantity(
      blockInfo.blockHeight ??
      consensus
        .lastFinalizedBlockHeight,
    );

  const cis8004Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8004
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8004
            .contract
            .subindex,
        ),
      );

  const cis8004Instance =
    await client
      .getInstanceInfo(
        cis8004Contract,
        finalizedBlock,
      );

  if (
    cis8004Instance ===
      null ||
    cis8004Instance ===
      undefined
  ) {
    throw new Error(
      "cis8004_contract_not_found",
    );
  }

  const cis8004Module =
    moduleReferenceHex(
      cis8004Instance.sourceModule,
      sdk,
    );

  if (
    cis8004Module !==
      profile
        .cis8004
        .moduleReference
  ) {
    throw new Error(
      "cis8004_module_reference_mismatch",
    );
  }

  const cis8004Schema =
    await client
      .getEmbeddedSchema(
        cis8004Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8004Schema ===
      null ||
    cis8004Schema ===
      undefined
  ) {
    throw new Error(
      "cis8004_embedded_schema_unavailable",
    );
  }

  const cis8004SchemaBuffer =
    schemaBuffer(
      cis8004Schema,
    );

  const cis8004SchemaSha256 =
    sha256Hex(
      cis8004SchemaBuffer,
    );

  if (
    cis8004SchemaBuffer.length !==
      publicReadProfile
        .cis8004
        .embeddedSchemaByteLength ||
    cis8004SchemaSha256 !==
      publicReadProfile
        .cis8004
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8004_embedded_schema_mismatch",
    );
  }

  const cis8004ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8004
          .contractName,
      );

  const agentOfEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      );

  const agentOfParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      agentOfEntrypoint,
      tokenIdU64LittleEndianHex(
        candidate
          .cis8004
          .tokenId,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const agentDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      parameter:
        agentOfParameter,
      embeddedSchema:
        cis8004Schema,
    });

  const agentRecord =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
      agentDecoded,
    );

  if (
    agentRecord ===
      null
  ) {
    throw new Error(
      "cis8004_agent_287_missing",
    );
  }

  const reverseEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      );

  const reverseParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      reverseEntrypoint,
      externalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const reverseDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      parameter:
        reverseParameter,
      embeddedSchema:
        cis8004Schema,
    });

  if (
    !optionIsNone(
      reverseDecoded,
    )
  ) {
    throw new Error(
      "external_reference_already_attached_or_malformed",
    );
  }

  const cis8Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8
            .contract
            .subindex,
        ),
      );

  const cis8Instance =
    await client
      .getInstanceInfo(
        cis8Contract,
        finalizedBlock,
      );

  if (
    cis8Instance ===
      null ||
    cis8Instance ===
      undefined
  ) {
    throw new Error(
      "cis8_contract_not_found",
    );
  }

  const cis8Module =
    moduleReferenceHex(
      cis8Instance.sourceModule,
      sdk,
    );

  if (
    cis8Module !==
      candidate
        .cis8
        .moduleReference
  ) {
    throw new Error(
      "cis8_module_reference_mismatch",
    );
  }

  const cis8Schema =
    await client
      .getEmbeddedSchema(
        cis8Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8Schema ===
      null ||
    cis8Schema ===
      undefined
  ) {
    throw new Error(
      "cis8_embedded_schema_unavailable",
    );
  }

  const cis8SchemaBuffer =
    schemaBuffer(
      cis8Schema,
    );

  const cis8SchemaSha256 =
    sha256Hex(
      cis8SchemaBuffer,
    );

  if (
    cis8SchemaBuffer.length !==
      publicReadProfile
        .cis8
        .embeddedSchemaByteLength ||
    cis8SchemaSha256 !==
      publicReadProfile
        .cis8
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8_embedded_schema_mismatch",
    );
  }

  const cis8ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8
          .contractName,
      );

  const ownerOfKeyEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      );

  const ownerOfKeyParameter =
    sdk.serializeUpdateContractParameters(
      cis8ContractName,
      ownerOfKeyEntrypoint,
      ownerOfKeyForSchema(
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8SchemaBuffer,
      ),
    );

  const ownerDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8Contract,
      contractName:
        candidate
          .cis8
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      parameter:
        ownerOfKeyParameter,
      embeddedSchema:
        cis8Schema,
    });

  const ownerRecord =
    normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1(
      ownerDecoded,
    );

  if (
    ownerRecord ===
      null
  ) {
    throw new Error(
      "cis8_external_key_unregistered",
    );
  }

  if (
    ownerRecord.proofScheme !==
      publicReadProfile
        .cis8
        .proofScheme
  ) {
    throw new Error(
      "cis8_proof_scheme_mismatch",
    );
  }

  const setExternalReferenceEntrypoint =
    sdk.EntrypointName
      .fromString(
        candidate
          .cis8004
          .entrypoint,
      );

  const sdkParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      setExternalReferenceEntrypoint,
      setExternalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const sdkParameterBytes =
    parameterBytes(
      sdkParameter,
      sdk,
    );

  const deterministicParameterBytes =
    Buffer.from(
      serializeDemo4D41cSetExternalReferenceParameterV1(
        candidate,
      ),
    );

  if (
    sdkParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    deterministicParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    !sdkParameterBytes.equals(
      deterministicParameterBytes,
    )
  ) {
    throw new Error(
      "sdk_parameter_byte_equivalence_failed",
    );
  }

  const sdkParameterSha256 =
    sha256Hex(
      sdkParameterBytes,
    );

  if (
    sdkParameterSha256 !==
      publicReadProfile
        .parameterSha256
  ) {
    throw new Error(
      "sdk_parameter_sha256_mismatch",
    );
  }

  const externalKeyMatches =
    ownerRecord.externalKey.namespace ===
      candidate.cis8.externalKey.namespace &&
    ownerRecord.externalKey.keyType ===
      candidate.cis8.externalKey.keyType &&
    ownerRecord.externalKey.publicKeyHex ===
      candidate.cis8.externalKey.publicKeyHex;

  const observation = {
    network:
      profile.network,

    finalizedSnapshot: {
      finalized:
        true,

      finalizedBlockHash,

      finalizedBlockHeight,

      singleFinalizedSnapshotBound:
        true,
    },

    cis8004: {
      contract: {
        ...candidate
          .cis8004
          .contract,
      },

      moduleReference:
        cis8004Module,

      embeddedSchemaByteLength:
        cis8004SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8004SchemaSha256,

      schemaPresent:
        true,

      tokenId:
        agentRecord.tokenId,

      tokenPresent:
        true,

      status:
        agentRecord.status,

      ownerAccount:
        agentRecord.ownerAccount,

      agentUri:
        agentRecord.agentUri,

      metadataHash:
        agentRecord.metadataHash,

      externalReferencePresent:
        agentRecord.externalReference !==
          null,

      revokedAtPresent:
        agentRecord.revokedAt !==
          null,

      revocationReasonPresent:
        agentRecord.revocationReason !==
          null,
    },

    reverseReference: {
      completeExternalReferenceCompared:
        true,

      alreadyAttached:
        false,

      unique:
        true,
    },

    cis8: {
      contract: {
        ...candidate
          .cis8
          .contract,
      },

      moduleReference:
        cis8Module,

      embeddedSchemaByteLength:
        cis8SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8SchemaSha256,

      status:
        ownerRecord.status,

      registered:
        true,

      ownerAccount:
        ownerRecord.owner,

      externalKey: {
        namespace:
          ownerRecord
            .externalKey
            .namespace,

        keyType:
          ownerRecord
            .externalKey
            .keyType,

        publicKeyHex:
          ownerRecord
            .externalKey
            .publicKeyHex,
      },

      completeExternalKeyMatch:
        externalKeyMatches,
    },

    parameter: {
      deterministicByteLength:
        deterministicParameterBytes.length,

      deterministicSha256:
        sha256Hex(
          deterministicParameterBytes,
        ),

      sdkSerializedByteLength:
        sdkParameterBytes.length,

      sdkSerializedSha256:
        sdkParameterSha256,

      exactSdkByteEquivalence:
        sdkParameterBytes.equals(
          deterministicParameterBytes,
        ),
    },

    dryRunBoundary: {
      capabilityDefined:
        true,

      authorizationPresent:
        false,

      invocationAttempted:
        false,

      performed:
        false,

      attachedCcd:
        "0",

      energySafetyCap:
        "100000",
    },

    safety: {
      readOnlyStateQueryCount:
        runtimeState
          .readOnlyStateQueryCount,

      stateMutationPerformed:
        false,

      privateKeyRead:
        runtimeState.privateKeyRead,

      walletRead:
        runtimeState.walletRead,

      signerCreated:
        runtimeState.signerCreated,

      transactionConstructed:
        runtimeState
          .transactionConstructed,

      transactionSigned:
        runtimeState
          .transactionSigningAttempted,

      transactionSubmitted:
        runtimeState
          .transactionSubmitted,

      paymentAttempted:
        runtimeState
          .paymentAttempted,

      d4_1cPerformed:
        runtimeState
          .d4_1cPerformed,
    },
  };

  const validated =
    validateDemo4D41cLivePreExecutionObservationV1(
      observation,
    );

  if (
    !validated.ok
  ) {
    throw new Error(
      `live_preexecution_validation_failed:${validated.reason}`,
    );
  }


  const ownerAccount =
    sdk.AccountAddress
      .fromBase58(
        profile
          .cis8004
          .ownerAccount,
      );

  runtimeState.contractDryRunPerformed =
    true;

  const dryRun =
    await runDemo4D41cBoundedDryRunInvocationForTestV1({
      sdk,
      client,
      finalizedBlock,
      ownerAccount,
      contractAddress:
        cis8004Contract,
      parameter:
        sdkParameter,
    });

  if (
    dryRun.attemptCount !==
      1 ||
    dryRun.succeeded !==
      true ||
    dryRun.zeroCcdAttached !==
      true ||
    dryRun.energySafetyCap !==
      "100000" ||
    dryRun.automaticRetryAttempted !==
      false
  ) {
    throw new Error(
      "dry_run_postcondition_failed",
    );
  }

  return Object.freeze({
    status:
      "bounded_contract_dry_run_succeeded" as const,

    network:
      profile.network,

    finalizedSnapshot:
      Object.freeze({
        finalized:
          true as const,

        finalizedBlockHash,

        finalizedBlockHeight,

        singleFinalizedSnapshotBound:
          true as const,
      }),

    cis8004:
      Object.freeze({
        contract:
          Object.freeze({
            ...candidate
              .cis8004
              .contract,
          }),

        moduleReference:
          cis8004Module,

        embeddedSchemaByteLength:
          cis8004SchemaBuffer.length,

        embeddedSchemaSha256:
          cis8004SchemaSha256,

        tokenId:
          agentRecord.tokenId,

        ownerAccount:
          agentRecord.ownerAccount,

        status:
          agentRecord.status,

        externalReferencePresent:
          false as const,
      }),

    reverseReference:
      Object.freeze({
        alreadyAttached:
          false as const,

        unique:
          true as const,
      }),

    cis8:
      Object.freeze({
        contract:
          Object.freeze({
            ...candidate
              .cis8
              .contract,
          }),

        moduleReference:
          cis8Module,

        embeddedSchemaByteLength:
          cis8SchemaBuffer.length,

        embeddedSchemaSha256:
          cis8SchemaSha256,

        status:
          ownerRecord.status,

        registered:
          true as const,

        ownerAccount:
          ownerRecord.owner,

        completeExternalKeyMatch:
          externalKeyMatches,
      }),

    parameter:
      Object.freeze({
        deterministicByteLength:
          deterministicParameterBytes.length,

        deterministicSha256:
          sha256Hex(
            deterministicParameterBytes,
          ),

        sdkSerializedByteLength:
          sdkParameterBytes.length,

        sdkSerializedSha256:
          sdkParameterSha256,

        exactSdkByteEquivalence:
          sdkParameterBytes.equals(
            deterministicParameterBytes,
          ),
      }),

    invocation:
      dryRun,

    safety:
      Object.freeze({
        readOnlyStateQueryCount:
          runtimeState
            .readOnlyStateQueryCount,

        contractDryRunPerformed:
          runtimeState
            .contractDryRunPerformed,

        stateMutationPerformed:
          false as const,

        privateKeyRead:
          runtimeState
            .privateKeyRead,

        walletRead:
          runtimeState
            .walletRead,

        signerCreated:
          runtimeState
            .signerCreated,

        transactionConstructed:
          runtimeState
            .transactionConstructed,

        transactionSigned:
          runtimeState
            .transactionSigningAttempted,

        transactionSubmitted:
          runtimeState
            .transactionSubmitted,

        automaticRetryAttempted:
          runtimeState
            .automaticRetryAttempted,

        paymentAttempted:
          runtimeState
            .paymentAttempted,

        d4_1cPerformed:
          runtimeState
            .d4_1cPerformed,
      }),
  });
}


const DEMO4_D4_1C_MAX_WALLET_BYTES =
  1_000_000 as const;

const DEMO4_D4_1C_TRANSACTION_EXPIRY_MINUTES =
  5 as const;

const DEMO4_D4_1C_FINALIZATION_TIMEOUT_MS =
  180_000 as const;

function safeDemo4D41cExecutionWalletPathV1():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1C_CONTROLLED_EXECUTION_WALLET_PATH",
    );

  if (
    configured ===
      undefined ||
    configured.length ===
      0
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
    metadata.isSymbolicLink()
  ) {
    throw new Error(
      "wallet_path_symlink_forbidden",
    );
  }

  if (
    !metadata.isFile() ||
    metadata.size <=
      0 ||
    metadata.size >
      DEMO4_D4_1C_MAX_WALLET_BYTES
  ) {
    throw new Error(
      "invalid_wallet_file",
    );
  }

  const canonical =
    realpathSync(
      absolute,
    );

  const canonicalParent =
    realpathSync(
      dirname(
        absolute,
      ),
    );

  if (
    dirname(
      canonical,
    ) !==
      canonicalParent
  ) {
    throw new Error(
      "wallet_path_escape",
    );
  }

  return canonical;
}

function assertFullDemo4D41cExecutionAuthorizationV1(
  authorization:
    unknown,
): void {
  const record =
    asRecord(
      authorization,
    );

  if (
    record ===
      null ||
    record.status !==
      "controlled_execution_authorized" ||
    record.testnetOnly !==
      true ||
    record.transactionExecutionAuthorized !==
      true ||
    record.d4_1cAttachmentAuthorized !==
      true ||
    record.walletReadAuthorized !==
      true ||
    record.signerCreationAuthorized !==
      true ||
    record.transactionConstructionAuthorized !==
      true ||
    record.transactionSigningAuthorized !==
      true ||
    record.transactionSubmissionAuthorized !==
      true ||
    record.paymentAuthorized !==
      false ||
    record.submissionLimit !==
      1 ||
    record.submissionAttemptsBefore !==
      0 ||
    record.remainingSubmissionAttempts !==
      1 ||
    record.automaticRetryAuthorized !==
      false ||
    record.zeroCcdRequired !==
      true
  ) {
    throw new Error(
      "invalid_controlled_execution_authorization",
    );
  }
}

function loadDemo4D41cExecutionWalletV1(
  sdk:
    any,
  authorization:
    unknown,
) {
  assertFullDemo4D41cExecutionAuthorizationV1(
    authorization,
  );

  const walletPath =
    safeDemo4D41cExecutionWalletPathV1();

  const walletText =
    readFileSync(
      walletPath,
      "utf8",
    );

  runtimeState.filesystemRead =
    true;

  runtimeState.walletRead =
    true;

  runtimeState.privateKeyRead =
    true;

  let wallet:
    any;

  try {
    wallet =
      sdk.parseWallet(
        walletText,
      );
  } catch {
    throw new Error(
      "wallet_parse_failed",
    );
  }

  const walletAddress =
    wallet
      ?.value
      ?.address;

  if (
    typeof walletAddress !==
      "string" ||
    walletAddress !==
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .cis8004
        .ownerAccount
  ) {
    throw new Error(
      "wallet_owner_mismatch",
    );
  }

  const sender =
    sdk.AccountAddress
      .fromBase58(
        walletAddress,
      );

  const signer =
    sdk.buildAccountSigner(
      wallet,
    );

  runtimeState.signerCreated =
    true;

  return Object.freeze({
    sender,
    signer,
  });
}

export function demo4D41cTransactionEnergyAllowanceFromDryRunV1(
  value:
    unknown,
): bigint {
  const usedEnergy =
    boundedDryRunEnergy(
      value,
    );

  const cap =
    100_000n;

  if (
    usedEnergy >
      cap
  ) {
    throw new Error(
      "dry_run_energy_exceeds_safety_cap",
    );
  }

  const percentageMargin =
    usedEnergy /
      5n;

  const minimumMargin =
    1_000n;

  const margin =
    percentageMargin >
      minimumMargin
      ? percentageMargin
      : minimumMargin;

  const candidate =
    usedEnergy +
    margin;

  return candidate >
    cap
    ? cap
    : candidate;
}

type Demo4D41cSubmissionStateV1 = {
  transactionConstructed:
    boolean;

  transactionSigningAttempted:
    boolean;

  transactionSubmissionAttempted:
    boolean;

  submissionAttempts:
    number;

  transactionSubmitted:
    boolean;

  automaticRetryAttempted:
    boolean;
};

function assertDemo4D41cSingleSubmissionAvailableV1(
  authorization:
    unknown,
  state:
    Demo4D41cSubmissionStateV1,
): void {
  assertFullDemo4D41cExecutionAuthorizationV1(
    authorization,
  );

  if (
    state.transactionSubmissionAttempted ===
      true ||
    state.transactionSubmitted ===
      true ||
    state.submissionAttempts !==
      0 ||
    state.automaticRetryAttempted ===
      true
  ) {
    throw new Error(
      "duplicate_submission_forbidden",
    );
  }
}

function beginDemo4D41cSingleSubmissionAttemptV1(
  authorization:
    unknown,
  state:
    Demo4D41cSubmissionStateV1,
): void {
  assertDemo4D41cSingleSubmissionAvailableV1(
    authorization,
    state,
  );

  state.transactionConstructed =
    true;

  state.transactionSigningAttempted =
    true;

  state.transactionSubmissionAttempted =
    true;

  state.submissionAttempts =
    1;
}

export async function runDemo4D41cSingleSubmissionForTestV1(
  input: {
    readonly authorization:
      unknown;

    readonly sdk:
      any;

    readonly contract:
      any;

    readonly entrypoint:
      any;

    readonly serializer:
      (
        value:
          unknown,
      ) => ArrayBuffer;

    readonly parameter:
      unknown;

    readonly sender:
      unknown;

    readonly signer:
      unknown;

    readonly energyAllowance:
      bigint;

    readonly state?:
      Demo4D41cSubmissionStateV1;
  },
) {
  if (
    input.energyAllowance <=
      0n ||
    input.energyAllowance >
      100_000n
  ) {
    throw new Error(
      "transaction_energy_allowance_out_of_bounds",
    );
  }

  const state =
    input.state ??
    runtimeState;

  assertDemo4D41cSingleSubmissionAvailableV1(
    input.authorization,
    state,
  );

  const metadata = {
    senderAddress:
      input.sender,

    energy:
      input.sdk
        .Energy
        .create(
          input.energyAllowance,
        ),

    expiry:
      input.sdk
        .TransactionExpiry
        .futureMinutes(
          DEMO4_D4_1C_TRANSACTION_EXPIRY_MINUTES,
        ),
  };

  beginDemo4D41cSingleSubmissionAttemptV1(
    input.authorization,
    state,
  );

  const transactionHash =
    await input.contract
      .createAndSendUpdateTransaction(
        input.entrypoint,
        input.serializer,
        metadata,
        input.parameter,
        input.signer,
      );

  state.transactionSubmitted =
    true;

  return Object.freeze({
    transactionHash,

    zeroCcdAttached:
      true as const,

    submissionAttempts:
      state.submissionAttempts,

    automaticRetryAttempted:
      state.automaticRetryAttempted,
  });
}

function pluginExternalReferenceMatchesCandidateV1(
  value:
    unknown,
  candidate:
    ReturnType<
      typeof buildDemo4D41cAttachmentCandidateV1
    >,
): boolean {
  const reference =
    asRecord(
      value,
    );

  const contractAddress =
    asRecord(
      reference
        ?.contractAddress,
    );

  const externalKeyId =
    asRecord(
      reference
        ?.externalKeyId,
    );

  return (
    reference !==
      null &&
    reference.kind ===
      "CIS-8" &&
    contractAddress !==
      null &&
    String(
      contractAddress.index,
    ) ===
      String(
        candidate
          .externalReference
          .contract
          .index,
      ) &&
    String(
      contractAddress.subindex,
    ) ===
      String(
        candidate
          .externalReference
          .contract
          .subindex,
      ) &&
    externalKeyId !==
      null &&
    externalKeyId.namespace ===
      candidate
        .externalReference
        .externalKey
        .namespace &&
    externalKeyId.keyType ===
      candidate
        .externalReference
        .externalKey
        .keyType &&
    externalKeyId.publicKeyHex ===
      candidate
        .externalReference
        .externalKey
        .publicKeyHex
  );
}

function reverseLookupTokenIdV1(
  value:
    unknown,
): string {
  const option =
    asRecord(
      value,
    );

  const decoded =
    (
      option !==
        null &&
      Array.isArray(
        option.Some,
      ) &&
      option.Some.length ===
        1
    )
      ? option.Some[0]
      : value;

  if (
    typeof decoded ===
      "bigint"
  ) {
    return decoded.toString(
      10,
    );
  }

  if (
    typeof decoded ===
      "number" &&
    Number.isSafeInteger(
      decoded,
    ) &&
    decoded >=
      0
  ) {
    return String(
      decoded,
    );
  }

  if (
    typeof decoded ===
      "string" &&
    /^(0|[1-9][0-9]*)$/.test(
      decoded,
    )
  ) {
    return decoded;
  }

  let bytes:
    Buffer | null =
    null;

  if (
    Buffer.isBuffer(
      decoded,
    )
  ) {
    bytes =
      Buffer.from(
        decoded,
      );
  } else if (
    decoded instanceof
      Uint8Array
  ) {
    bytes =
      Buffer.from(
        decoded,
      );
  } else if (
    Array.isArray(
      decoded,
    )
  ) {
    const normalized =
      decoded.map(
        (
          item,
        ) =>
          typeof item ===
            "bigint"
            ? Number(
                item,
              )
            : item,
      );

    if (
      normalized.every(
        (
          item,
        ) =>
          Number.isInteger(
            item,
          ) &&
          item >=
            0 &&
          item <=
            255,
      )
    ) {
      bytes =
        Buffer.from(
          normalized,
        );
    }
  }

  if (
    bytes !==
      null &&
    bytes.length ===
      8
  ) {
    return bytes
      .readBigUInt64LE(
        0,
      )
      .toString(
        10,
      );
  }

  if (
    bytes !==
      null &&
    bytes.length ===
      9 &&
    bytes[0] ===
      8
  ) {
    return bytes
      .subarray(
        1,
      )
      .readBigUInt64LE(
        0,
      )
      .toString(
        10,
      );
  }

  throw new Error(
    "reverse_lookup_token_id_unrecognized",
  );
}


export async function runDemo4D41cControlledExecutionV1(
  authorization:
    unknown,
) {
  assertFullDemo4D41cExecutionAuthorizationV1(
    authorization,
  );

  if (
    executeDispatchEnabled() !==
      true
  ) {
    throw new Error(
      "execute_dispatch_locked",
    );
  }

  if (
    DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED !==
      false ||
    DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED !==
      false
  ) {
    throw new Error(
      "unsafe_adjacent_dispatch_state",
    );
  }

  runtimeState.readOnlyStateQueryCount =
    0;

  const candidate =
    buildDemo4D41cAttachmentCandidateV1();

  const profile =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  const publicReadProfile =
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE;

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

  const credentials =
    grpc
      .credentials
      .createSsl();

  const client =
    new nodeSdk
      .ConcordiumGRPCNodeClient(
        publicReadProfile.grpc.host,
        publicReadProfile.grpc.port,
        credentials,
      );

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

  const finalizedBlockHash =
    blockHashHex(
      finalizedBlock,
      sdk,
    );

  const finalizedBlockHeight =
    decimalQuantity(
      blockInfo.blockHeight ??
      consensus
        .lastFinalizedBlockHeight,
    );

  const cis8004Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8004
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8004
            .contract
            .subindex,
        ),
      );

  const cis8004Instance =
    await client
      .getInstanceInfo(
        cis8004Contract,
        finalizedBlock,
      );

  if (
    cis8004Instance ===
      null ||
    cis8004Instance ===
      undefined
  ) {
    throw new Error(
      "cis8004_contract_not_found",
    );
  }

  const cis8004Module =
    moduleReferenceHex(
      cis8004Instance.sourceModule,
      sdk,
    );

  if (
    cis8004Module !==
      profile
        .cis8004
        .moduleReference
  ) {
    throw new Error(
      "cis8004_module_reference_mismatch",
    );
  }

  const cis8004Schema =
    await client
      .getEmbeddedSchema(
        cis8004Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8004Schema ===
      null ||
    cis8004Schema ===
      undefined
  ) {
    throw new Error(
      "cis8004_embedded_schema_unavailable",
    );
  }

  const cis8004SchemaBuffer =
    schemaBuffer(
      cis8004Schema,
    );

  const cis8004SchemaSha256 =
    sha256Hex(
      cis8004SchemaBuffer,
    );

  if (
    cis8004SchemaBuffer.length !==
      publicReadProfile
        .cis8004
        .embeddedSchemaByteLength ||
    cis8004SchemaSha256 !==
      publicReadProfile
        .cis8004
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8004_embedded_schema_mismatch",
    );
  }

  const cis8004ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8004
          .contractName,
      );

  const agentOfEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      );

  const agentOfParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      agentOfEntrypoint,
      tokenIdU64LittleEndianHex(
        candidate
          .cis8004
          .tokenId,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const agentDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,
      parameter:
        agentOfParameter,
      embeddedSchema:
        cis8004Schema,
    });

  const agentRecord =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
      agentDecoded,
    );

  if (
    agentRecord ===
      null
  ) {
    throw new Error(
      "cis8004_agent_287_missing",
    );
  }

  const reverseEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      );

  const reverseParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      reverseEntrypoint,
      externalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const reverseDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8004Contract,
      contractName:
        candidate
          .cis8004
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,
      parameter:
        reverseParameter,
      embeddedSchema:
        cis8004Schema,
    });

  if (
    !optionIsNone(
      reverseDecoded,
    )
  ) {
    throw new Error(
      "external_reference_already_attached_or_malformed",
    );
  }

  const cis8Contract =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .cis8
            .contract
            .index,
        ),

        BigInt(
          candidate
            .cis8
            .contract
            .subindex,
        ),
      );

  const cis8Instance =
    await client
      .getInstanceInfo(
        cis8Contract,
        finalizedBlock,
      );

  if (
    cis8Instance ===
      null ||
    cis8Instance ===
      undefined
  ) {
    throw new Error(
      "cis8_contract_not_found",
    );
  }

  const cis8Module =
    moduleReferenceHex(
      cis8Instance.sourceModule,
      sdk,
    );

  if (
    cis8Module !==
      candidate
        .cis8
        .moduleReference
  ) {
    throw new Error(
      "cis8_module_reference_mismatch",
    );
  }

  const cis8Schema =
    await client
      .getEmbeddedSchema(
        cis8Instance.sourceModule,
        finalizedBlock,
      );

  if (
    cis8Schema ===
      null ||
    cis8Schema ===
      undefined
  ) {
    throw new Error(
      "cis8_embedded_schema_unavailable",
    );
  }

  const cis8SchemaBuffer =
    schemaBuffer(
      cis8Schema,
    );

  const cis8SchemaSha256 =
    sha256Hex(
      cis8SchemaBuffer,
    );

  if (
    cis8SchemaBuffer.length !==
      publicReadProfile
        .cis8
        .embeddedSchemaByteLength ||
    cis8SchemaSha256 !==
      publicReadProfile
        .cis8
        .embeddedSchemaSha256
  ) {
    throw new Error(
      "cis8_embedded_schema_mismatch",
    );
  }

  const cis8ContractName =
    sdk.ContractName
      .fromStringUnchecked(
        candidate
          .cis8
          .contractName,
      );

  const ownerOfKeyEntrypoint =
    sdk.EntrypointName
      .fromString(
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      );

  const ownerOfKeyParameter =
    sdk.serializeUpdateContractParameters(
      cis8ContractName,
      ownerOfKeyEntrypoint,
      ownerOfKeyForSchema(
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8SchemaBuffer,
      ),
    );

  const ownerDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,
      finalizedBlock,
      contract:
        cis8Contract,
      contractName:
        candidate
          .cis8
          .contractName,
      entrypoint:
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,
      parameter:
        ownerOfKeyParameter,
      embeddedSchema:
        cis8Schema,
    });

  const ownerRecord =
    normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1(
      ownerDecoded,
    );

  if (
    ownerRecord ===
      null
  ) {
    throw new Error(
      "cis8_external_key_unregistered",
    );
  }

  if (
    ownerRecord.proofScheme !==
      publicReadProfile
        .cis8
        .proofScheme
  ) {
    throw new Error(
      "cis8_proof_scheme_mismatch",
    );
  }

  const setExternalReferenceEntrypoint =
    sdk.EntrypointName
      .fromString(
        candidate
          .cis8004
          .entrypoint,
      );

  const sdkParameter =
    sdk.serializeUpdateContractParameters(
      cis8004ContractName,
      setExternalReferenceEntrypoint,
      setExternalReferenceForSchema(
        sdk,
        candidate,
      ),
      exactArrayBufferFromBytes(
        cis8004SchemaBuffer,
      ),
    );

  const sdkParameterBytes =
    parameterBytes(
      sdkParameter,
      sdk,
    );

  const deterministicParameterBytes =
    Buffer.from(
      serializeDemo4D41cSetExternalReferenceParameterV1(
        candidate,
      ),
    );

  if (
    sdkParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    deterministicParameterBytes.length !==
      publicReadProfile
        .parameterByteLength ||
    !sdkParameterBytes.equals(
      deterministicParameterBytes,
    )
  ) {
    throw new Error(
      "sdk_parameter_byte_equivalence_failed",
    );
  }

  const sdkParameterSha256 =
    sha256Hex(
      sdkParameterBytes,
    );

  if (
    sdkParameterSha256 !==
      publicReadProfile
        .parameterSha256
  ) {
    throw new Error(
      "sdk_parameter_sha256_mismatch",
    );
  }

  const externalKeyMatches =
    ownerRecord.externalKey.namespace ===
      candidate.cis8.externalKey.namespace &&
    ownerRecord.externalKey.keyType ===
      candidate.cis8.externalKey.keyType &&
    ownerRecord.externalKey.publicKeyHex ===
      candidate.cis8.externalKey.publicKeyHex;

  const observation = {
    network:
      profile.network,

    finalizedSnapshot: {
      finalized:
        true,

      finalizedBlockHash,

      finalizedBlockHeight,

      singleFinalizedSnapshotBound:
        true,
    },

    cis8004: {
      contract: {
        ...candidate
          .cis8004
          .contract,
      },

      moduleReference:
        cis8004Module,

      embeddedSchemaByteLength:
        cis8004SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8004SchemaSha256,

      schemaPresent:
        true,

      tokenId:
        agentRecord.tokenId,

      tokenPresent:
        true,

      status:
        agentRecord.status,

      ownerAccount:
        agentRecord.ownerAccount,

      agentUri:
        agentRecord.agentUri,

      metadataHash:
        agentRecord.metadataHash,

      externalReferencePresent:
        agentRecord.externalReference !==
          null,

      revokedAtPresent:
        agentRecord.revokedAt !==
          null,

      revocationReasonPresent:
        agentRecord.revocationReason !==
          null,
    },

    reverseReference: {
      completeExternalReferenceCompared:
        true,

      alreadyAttached:
        false,

      unique:
        true,
    },

    cis8: {
      contract: {
        ...candidate
          .cis8
          .contract,
      },

      moduleReference:
        cis8Module,

      embeddedSchemaByteLength:
        cis8SchemaBuffer.length,

      embeddedSchemaSha256:
        cis8SchemaSha256,

      status:
        ownerRecord.status,

      registered:
        true,

      ownerAccount:
        ownerRecord.owner,

      externalKey: {
        namespace:
          ownerRecord
            .externalKey
            .namespace,

        keyType:
          ownerRecord
            .externalKey
            .keyType,

        publicKeyHex:
          ownerRecord
            .externalKey
            .publicKeyHex,
      },

      completeExternalKeyMatch:
        externalKeyMatches,
    },

    parameter: {
      deterministicByteLength:
        deterministicParameterBytes.length,

      deterministicSha256:
        sha256Hex(
          deterministicParameterBytes,
        ),

      sdkSerializedByteLength:
        sdkParameterBytes.length,

      sdkSerializedSha256:
        sdkParameterSha256,

      exactSdkByteEquivalence:
        sdkParameterBytes.equals(
          deterministicParameterBytes,
        ),
    },

    dryRunBoundary: {
      capabilityDefined:
        true,

      authorizationPresent:
        false,

      invocationAttempted:
        false,

      performed:
        false,

      attachedCcd:
        "0",

      energySafetyCap:
        "100000",
    },

    safety: {
      readOnlyStateQueryCount:
        runtimeState
          .readOnlyStateQueryCount,

      stateMutationPerformed:
        false,

      privateKeyRead:
        runtimeState.privateKeyRead,

      walletRead:
        runtimeState.walletRead,

      signerCreated:
        runtimeState.signerCreated,

      transactionConstructed:
        runtimeState
          .transactionConstructed,

      transactionSigned:
        runtimeState
          .transactionSigningAttempted,

      transactionSubmitted:
        runtimeState
          .transactionSubmitted,

      paymentAttempted:
        runtimeState
          .paymentAttempted,

      d4_1cPerformed:
        runtimeState
          .d4_1cPerformed,
    },
  };

  const validated =
    validateDemo4D41cLivePreExecutionObservationV1(
      observation,
    );

  if (
    !validated.ok
  ) {
    throw new Error(
      `live_preexecution_validation_failed:${validated.reason}`,
    );
  }



  const wallet =
    loadDemo4D41cExecutionWalletV1(
      sdk,
      authorization,
    );

  const energyAllowance =
    demo4D41cTransactionEnergyAllowanceFromDryRunV1(
      profile
        .priorDryRunUsedEnergy,
    );

  runtimeState.networkCalled =
    true;

  const contract =
    await sdk.Contract
      .create(
        client,
        cis8004Contract,
      );

  const executionParameter =
    setExternalReferenceForSchema(
      sdk,
      candidate,
    );

  const executionSerializer =
    (
      value:
        unknown,
    ): ArrayBuffer => {
      const serialized =
        sdk.serializeUpdateContractParameters(
          cis8004ContractName,
          setExternalReferenceEntrypoint,
          value,
          exactArrayBufferFromBytes(
            cis8004SchemaBuffer,
          ),
        );

      const bytes =
        parameterBytes(
          serialized,
          sdk,
        );

      if (
        bytes.length !==
          117 ||
        sha256Hex(
          bytes,
        ) !==
          publicReadProfile
            .parameterSha256 ||
        !bytes.equals(
          deterministicParameterBytes,
        )
      ) {
        throw new Error(
          "execution_parameter_binding_failed",
        );
      }

      return exactArrayBufferFromBytes(
        bytes,
      );
    };

  const submitted =
    await runDemo4D41cSingleSubmissionForTestV1({
      authorization,
      sdk,
      contract,

      entrypoint:
        setExternalReferenceEntrypoint,

      serializer:
        executionSerializer,

      parameter:
        executionParameter,

      sender:
        wallet.sender,

      signer:
        wallet.signer,

      energyAllowance,
    });

  const transactionHash =
    submitted
      .transactionHash;

  const submittedFinalization =
    await client
      .waitForTransactionFinalization(
        transactionHash,
        DEMO4_D4_1C_FINALIZATION_TIMEOUT_MS,
      );

  const submittedSummary =
    submittedFinalization
      .summary;

  if (
    !sdk.isKnown(
      submittedSummary,
    )
  ) {
    throw new Error(
      "unknown_finalized_summary",
    );
  }

  if (
    !sdk.isSuccessTransaction(
      submittedSummary,
    )
  ) {
    const submittedRejectReason =
      sdk.isRejectTransaction(
        submittedSummary,
      )
        ? String(
            submittedSummary
              .rejectReason
              ?.tag ??
            "unknown",
          )
        : "not_success";

    throw new Error(
      `set_external_reference_transaction_failed:${submittedRejectReason}`,
    );
  }

  if (
    !sdk.isUpdateContractSummary(
      submittedSummary,
    )
  ) {
    throw new Error(
      "finalized_summary_not_contract_update",
    );
  }

  const submittedSender =
    Buffer.from(
      sdk.AccountAddress
        .toBuffer(
          submittedSummary.sender,
        ),
    );

  const expectedSubmittedSender =
    Buffer.from(
      sdk.AccountAddress
        .toBuffer(
          wallet.sender,
        ),
    );

  if (
    !submittedSender.equals(
      expectedSubmittedSender,
    )
  ) {
    throw new Error(
      "finalized_sender_mismatch",
    );
  }

  runtimeState.transactionFinalized =
    true;

  runtimeState.d4_1cPerformed =
    true;

  const submittedTransactionHashHex =
    String(
      sdk.TransactionHash
        .toHexString(
          transactionHash,
        ),
    )
      .toLowerCase()
      .replace(
        /^0x/,
        "",
      );

  const submittedFinalizedBlock =
    submittedFinalization
      .blockHash;

  const submittedFinalizedBlockHash =
    blockHashHex(
      submittedFinalizedBlock,
      sdk,
    );

  const submittedFinalizedBlockInfo =
    await client
      .getBlockInfo(
        submittedFinalizedBlock,
      );

  if (
    submittedFinalizedBlockInfo ===
      null ||
    submittedFinalizedBlockInfo ===
      undefined ||
    submittedFinalizedBlockInfo.finalized !==
      true
  ) {
    throw new Error(
      "transaction_block_not_finalized",
    );
  }

  const submittedFinalizedBlockHeight =
    decimalQuantity(
      submittedFinalizedBlockInfo
        .blockHeight,
    );

  const postCis8004Instance =
    await client
      .getInstanceInfo(
        cis8004Contract,
        submittedFinalizedBlock,
      );

  if (
    postCis8004Instance ===
      null ||
    postCis8004Instance ===
      undefined ||
    moduleReferenceHex(
      postCis8004Instance.sourceModule,
      sdk,
    ) !==
      cis8004Module
  ) {
    throw new Error(
      "post_cis8004_module_drift",
    );
  }

  const postCis8Instance =
    await client
      .getInstanceInfo(
        cis8Contract,
        submittedFinalizedBlock,
      );

  if (
    postCis8Instance ===
      null ||
    postCis8Instance ===
      undefined ||
    moduleReferenceHex(
      postCis8Instance.sourceModule,
      sdk,
    ) !==
      cis8Module
  ) {
    throw new Error(
      "post_cis8_module_drift",
    );
  }

  const postAgentDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,

      finalizedBlock:
        submittedFinalizedBlock,

      contract:
        cis8004Contract,

      contractName:
        candidate
          .cis8004
          .contractName,

      entrypoint:
        publicReadProfile
          .cis8004
          .agentOfEntrypoint,

      parameter:
        agentOfParameter,

      embeddedSchema:
        cis8004Schema,
    });

  const postAgent =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
      postAgentDecoded,
    );

  if (
    postAgent ===
      null ||
    !pluginExternalReferenceMatchesCandidateV1(
      postAgent
        .externalReference,
      candidate,
    )
  ) {
    throw new Error(
      "post_external_reference_mismatch",
    );
  }

  const postReverseDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,

      finalizedBlock:
        submittedFinalizedBlock,

      contract:
        cis8004Contract,

      contractName:
        candidate
          .cis8004
          .contractName,

      entrypoint:
        publicReadProfile
          .cis8004
          .reverseLookupEntrypoint,

      parameter:
        reverseParameter,

      embeddedSchema:
        cis8004Schema,
    });

  const reverseLookupTokenId =
    reverseLookupTokenIdV1(
      postReverseDecoded,
    );

  if (
    reverseLookupTokenId !==
      "287"
  ) {
    throw new Error(
      "post_reverse_lookup_mismatch",
    );
  }

  const postOwnerDecoded =
    await invokeDecodedReadOnly({
      sdk,
      client,

      finalizedBlock:
        submittedFinalizedBlock,

      contract:
        cis8Contract,

      contractName:
        candidate
          .cis8
          .contractName,

      entrypoint:
        publicReadProfile
          .cis8
          .ownerOfKeyEntrypoint,

      parameter:
        ownerOfKeyParameter,

      embeddedSchema:
        cis8Schema,
    });

  const postOwner =
    normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1(
      postOwnerDecoded,
    );

  if (
    postOwner ===
      null ||
    postOwner.status !==
      "Active" ||
    postOwner.owner !==
      candidate
        .cis8
        .ownerAccount ||
    postOwner.proofScheme !==
      publicReadProfile
        .cis8
        .proofScheme ||
    postOwner.externalKey.namespace !==
      candidate
        .cis8
        .externalKey
        .namespace ||
    postOwner.externalKey.keyType !==
      candidate
        .cis8
        .externalKey
        .keyType ||
    postOwner.externalKey.publicKeyHex !==
      candidate
        .cis8
        .externalKey
        .publicKeyHex
  ) {
    throw new Error(
      "post_cis8_binding_changed",
    );
  }

  const finalizedObservation = {
    submissionAttempts:
      runtimeState
        .submissionAttempts,

    automaticRetryAttempted:
      runtimeState
        .automaticRetryAttempted,

    zeroCcdAttached:
      submitted
        .zeroCcdAttached,

    transaction: {
      hash:
        submittedTransactionHashHex,

      finalized:
        true,

      finalizedBlockHash:
        submittedFinalizedBlockHash,

      finalizedBlockHeight:
        submittedFinalizedBlockHeight,

      transactionType:
        "update",
    },

    postAgent: {
      tokenId:
        postAgent
          .tokenId,

      ownerAccount:
        postAgent
          .ownerAccount,

      agentUri:
        postAgent
          .agentUri,

      metadataHash:
        postAgent
          .metadataHash,

      status:
        postAgent
          .status,

      externalReference:
        buildDemo4D41cNormalizedExternalReferenceV1(),

      revokedAt:
        postAgent
          .revokedAt,

      revocationReason:
        postAgent
          .revocationReason,
    },

    reverseLookupTokenId,

    cis8PostState: {
      status:
        postOwner
          .status,

      ownerAccount:
        postOwner
          .owner,

      externalKey: {
        namespace:
          postOwner
            .externalKey
            .namespace,

        keyType:
          postOwner
            .externalKey
            .keyType,

        publicKeyHex:
          postOwner
            .externalKey
            .publicKeyHex,
      },

      proofScheme:
        postOwner
          .proofScheme,
    },

    safety: {
      exactlyOneSubmissionAttempted:
        runtimeState
          .submissionAttempts ===
        1,

      cis8Mutated:
        false,

      paymentAttempted:
        false,

      settlementAttempted:
        false,

      receiptIssued:
        false,

      gatewayRuntimeActivated:
        false,

      protectedResourceReleased:
        false,

      replayStateMutated:
        false,

      productionActivation:
        false,
    },
  };

  const finalizedObservationValidation =
    validateDemo4D41cFutureFinalizedObservationV1(
      finalizedObservation,
    );

  if (
    finalizedObservationValidation.ok !==
      true
  ) {
    throw new Error(
      "finalized_d4_1c_validation_failed",
    );
  }

  const finalizedExecutionEvidence =
    finalizedObservationValidation
      .value;

  return Object.freeze({
    evidence:
      finalizedExecutionEvidence,

    transactionEnergyAllowance:
      energyAllowance.toString(
        10,
      ),

    privateKeyRead:
      runtimeState
        .privateKeyRead,

    walletRead:
      runtimeState
        .walletRead,

    signerCreated:
      runtimeState
        .signerCreated,

    transactionConstructed:
      runtimeState
        .transactionConstructed,

    transactionSigned:
      runtimeState
        .transactionSigningAttempted,

    transactionSubmitted:
      runtimeState
        .transactionSubmitted,

    transactionFinalized:
      runtimeState
        .transactionFinalized,

    submissionAttempts:
      runtimeState
        .submissionAttempts,

    automaticRetryAttempted:
      runtimeState
        .automaticRetryAttempted,

    d4_1cPerformed:
      runtimeState
        .d4_1cPerformed,
  });
}

async function main():
Promise<void> {
  const mode =
    modeFromEnvironment();

  if (
    mode ===
      "preflight"
  ) {
    if (
      livePreExecutionDispatchEnabled() !==
        true
    ) {
      console.error(
        "PR314_LIVE_PREEXECUTION_BLOCKED=live_preexecution_dispatch_locked",
      );
      console.error(
        `LIVE_PREEXECUTION_DISPATCH_ENABLED=${DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED}`,
      );
      console.error(
        `PUBLIC_READ_IMPLEMENTATION_AVAILABLE=${DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_AVAILABLE}`,
      );
      console.error(
        "NETWORK_CALLED=false",
      );
      console.error(
        "TRANSACTION_EXECUTION_AUTHORIZED=false",
      );
      console.error(
        "D4_1C_ATTACHMENT_AUTHORIZED=false",
      );
      process.exitCode =
        2;
      return;
    }

    const evidence =
      await runDemo4D41cPublicReadPreflightV1();

    console.log(
      "PR314_LIVE_PREEXECUTION_READINESS_CONFIRMED=true",
    );
    console.log(
      `FINALIZED_BLOCK_HASH=${evidence.finalizedSnapshot.finalizedBlockHash}`,
    );
    console.log(
      `FINALIZED_BLOCK_HEIGHT=${evidence.finalizedSnapshot.finalizedBlockHeight}`,
    );
    console.log(
      `READ_ONLY_STATE_QUERY_COUNT=${evidence.safety.readOnlyStateQueryCount}`,
    );
    console.log(
      `PARAMETER_SHA256=${evidence.parameter.sdkSerializedSha256}`,
    );
    console.log(
      "CONTRACT_DRY_RUN_PERFORMED=false",
    );
    console.log(
      "PRIVATE_KEY_READ=false",
    );
    console.log(
      "WALLET_READ=false",
    );
    console.log(
      "SIGNER_CREATED=false",
    );
    console.log(
      "TRANSACTION_CONSTRUCTED=false",
    );
    console.log(
      "TRANSACTION_SIGNED=false",
    );
    console.log(
      "TRANSACTION_SUBMITTED=false",
    );
    console.log(
      "PAYMENT_ATTEMPTED=false",
    );
    console.log(
      "D4_1C_PERFORMED=false",
    );
    return;
  }

  if (
    mode ===
      "dry-run"
  ) {
    if (
      dryRunDispatchEnabled() !==
        true
    ) {
      console.error(
        "PR314_DRY_RUN_BLOCKED=dry_run_dispatch_locked",
      );
      console.error(
        `DRY_RUN_DISPATCH_ENABLED=${DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED}`,
      );
      console.error(
        `DRY_RUN_IMPLEMENTATION_AVAILABLE=${DEMO4_D4_1C_DRY_RUN_IMPLEMENTATION_AVAILABLE}`,
      );
      console.error(
        "NETWORK_CALLED=false",
      );
      console.error(
        "CONTRACT_DRY_RUN_PERFORMED=false",
      );
      console.error(
        "TRANSACTION_EXECUTION_AUTHORIZED=false",
      );
      console.error(
        "D4_1C_ATTACHMENT_AUTHORIZED=false",
      );
      process.exitCode =
        2;
      return;
    }

    const dryRun =
      await runDemo4D41cContractDryRunV1();

    console.log(
      "PR314_BOUNDED_CONTRACT_DRY_RUN_CONFIRMED=true",
    );
    console.log(
      `FINALIZED_BLOCK_HASH=${dryRun.finalizedSnapshot.finalizedBlockHash}`,
    );
    console.log(
      `FINALIZED_BLOCK_HEIGHT=${dryRun.finalizedSnapshot.finalizedBlockHeight}`,
    );
    console.log(
      `READ_ONLY_STATE_QUERY_COUNT=${dryRun.safety.readOnlyStateQueryCount}`,
    );
    console.log(
      `PARAMETER_BYTE_LENGTH=${dryRun.parameter.sdkSerializedByteLength}`,
    );
    console.log(
      `PARAMETER_SHA256=${dryRun.parameter.sdkSerializedSha256}`,
    );
    console.log(
      `EXACT_SDK_BYTE_EQUIVALENCE=${dryRun.parameter.exactSdkByteEquivalence}`,
    );
    console.log(
      `DRY_RUN_ATTEMPT_COUNT=${dryRun.invocation.attemptCount}`,
    );
    console.log(
      `DRY_RUN_USED_ENERGY=${dryRun.invocation.usedEnergy}`,
    );
    console.log(
      `DRY_RUN_ENERGY_SAFETY_CAP=${dryRun.invocation.energySafetyCap}`,
    );
    console.log(
      `ZERO_CCD_ATTACHED=${dryRun.invocation.zeroCcdAttached}`,
    );
    console.log(
      `AUTOMATIC_RETRY_ATTEMPTED=${dryRun.invocation.automaticRetryAttempted}`,
    );
    console.log(
      `CONTRACT_DRY_RUN_PERFORMED=${dryRun.safety.contractDryRunPerformed}`,
    );
    console.log(
      "PRIVATE_KEY_READ=false",
    );
    console.log(
      "WALLET_READ=false",
    );
    console.log(
      "SIGNER_CREATED=false",
    );
    console.log(
      "TRANSACTION_CONSTRUCTED=false",
    );
    console.log(
      "TRANSACTION_SIGNED=false",
    );
    console.log(
      "TRANSACTION_SUBMITTED=false",
    );
    console.log(
      "PAYMENT_ATTEMPTED=false",
    );
    console.log(
      "D4_1C_PERFORMED=false",
    );
    return;
  }

  if (
    mode ===
      "execute"
  ) {
    if (
      executeDispatchEnabled() !==
        true
    ) {
      console.error(
        "PR314_CONTROLLED_EXECUTION_BLOCKED=execute_dispatch_locked",
      );

      console.error(
        `EXECUTE_DISPATCH_ENABLED=${DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED}`,
      );

      console.error(
        "TRANSACTION_EXECUTION_AUTHORIZED=false",
      );

      console.error(
        "D4_1C_ATTACHMENT_AUTHORIZED=false",
      );

      process.exitCode =
        2;

      return;
    }

    const authorization =
      authorizeDemo4D41cControlledExecutionV1({
        mode:
          "execute",

        explicitControlledExecutionAuthorizationConfirmed:
          exactEnv(
            "DEMO4_D4_1C_EXECUTION_AUTHORIZED",
          ) ===
            "true",

        d4_1cAttachmentAuthorizationConfirmed:
          exactEnv(
            "DEMO4_D4_1C_ATTACHMENT_AUTHORIZED",
          ) ===
            "true",

        testnetOnly:
          exactEnv(
            "DEMO4_D4_1C_TESTNET_ONLY",
          ) ===
            "true",

        walletReadEnabled:
          exactEnv(
            "DEMO4_D4_1C_WALLET_READ_ENABLED",
          ) ===
            "true",

        signerCreationEnabled:
          exactEnv(
            "DEMO4_D4_1C_SIGNER_CREATION_ENABLED",
          ) ===
            "true",

        transactionConstructionEnabled:
          exactEnv(
            "DEMO4_D4_1C_TRANSACTION_CONSTRUCTION_ENABLED",
          ) ===
            "true",

        transactionSigningEnabled:
          exactEnv(
            "DEMO4_D4_1C_TRANSACTION_SIGNING_ENABLED",
          ) ===
            "true",

        transactionSubmissionEnabled:
          exactEnv(
            "DEMO4_D4_1C_TRANSACTION_SUBMISSION_ENABLED",
          ) ===
            "true",

        paymentEnabled:
          exactEnv(
            "DEMO4_D4_1C_PAYMENT_ENABLED",
          ) ===
            "true",

        submissionLimit:
          1,

        submissionAttemptsBefore:
          runtimeState
            .submissionAttempts,

        automaticRetryAuthorized:
          false,

        zeroCcdRequired:
          true,

        executeDispatchEnabled:
          true,
      });

    if (
      authorization.ok !==
        true
    ) {
      console.error(
        `PR314_CONTROLLED_EXECUTION_BLOCKED=${authorization.reason}`,
      );

      process.exitCode =
        2;

      return;
    }

    const executed =
      await runDemo4D41cControlledExecutionV1(
        authorization.value,
      );

    console.log(
      "PR314_D4_1C_FINALIZED=true",
    );

    console.log(
      `TRANSACTION_HASH=${executed.evidence.transaction.hash}`,
    );

    console.log(
      `FINALIZED_BLOCK_HASH=${executed.evidence.transaction.finalizedBlockHash}`,
    );

    console.log(
      `FINALIZED_BLOCK_HEIGHT=${executed.evidence.transaction.finalizedBlockHeight}`,
    );

    console.log(
      `TRANSACTION_ENERGY_ALLOWANCE=${executed.transactionEnergyAllowance}`,
    );

    console.log(
      `SUBMISSION_ATTEMPTS=${executed.submissionAttempts}`,
    );

    console.log(
      `AUTOMATIC_RETRY_ATTEMPTED=${executed.automaticRetryAttempted}`,
    );

    console.log(
      `D4_1C_PERFORMED=${executed.d4_1cPerformed}`,
    );

    console.log(
      "PAYMENT_ATTEMPTED=false",
    );

    return;
  }

  const activation =
    validateDemo4D41cControlledExecutionActivationV1({
      mode,

      explicitControlledExecutionAuthorizationConfirmed:
        false,

      walletReadEnabled:
        false,

      signerCreationEnabled:
        false,

      transactionConstructionEnabled:
        false,

      transactionSigningEnabled:
        false,

      transactionSubmissionEnabled:
        false,

      paymentEnabled:
        false,
    });

  if (
    activation.ok !==
      true
  ) {
    console.error(
      `PR314_CONTROLLED_EXECUTION_BLOCKED=${activation.reason}`,
    );
    console.error(
      `EXECUTE_DISPATCH_ENABLED=${DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED}`,
    );
    console.error(
      "TRANSACTION_EXECUTION_AUTHORIZED=false",
    );
    console.error(
      "D4_1C_ATTACHMENT_AUTHORIZED=false",
    );
    process.exitCode =
      2;
    return;
  }

  if (
    DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED !==
      false
  ) {
    throw new Error(
      "unexpected_execute_dispatch_state",
    );
  }

  const plan =
    buildDemo4D41cControlledExecutionPlanV1();

  console.log(
    "=== PR #314 D4-1C CONTROLLED EXECUTION INSPECT ===",
  );
  console.log(
    `STATUS=${plan.status}`,
  );
  console.log(
    `STAGE=${plan.stage}`,
  );
  console.log(
    `NETWORK=${plan.network}`,
  );
  console.log(
    `CIS8004_CONTRACT=<${plan.cis8004.contract.index},${plan.cis8004.contract.subindex}>`,
  );
  console.log(
    `AGENT_TOKEN_ID=${plan.cis8004.tokenId}`,
  );
  console.log(
    `CIS8_CONTRACT=<${plan.cis8.contract.index},${plan.cis8.contract.subindex}>`,
  );
  console.log(
    `PARAMETER_BYTE_LENGTH=${plan.parameter.byteLength}`,
  );
  console.log(
    `PARAMETER_SHA256=${plan.parameter.sha256}`,
  );
  console.log(
    `SUBMISSION_LIMIT=${plan.submissionLimit}`,
  );
  console.log(
    `SUBMISSION_ATTEMPTS_BEFORE=${plan.submissionAttemptsBefore}`,
  );
  console.log(
    `ZERO_CCD_REQUIRED=${plan.zeroCcdRequired}`,
  );
  console.log(
    `AUTOMATIC_RETRY_AUTHORIZED=${plan.automaticRetryAuthorized}`,
  );
  console.log(
    `SEPARATE_EXECUTION_AUTHORIZATION_REQUIRED=${plan.separateExecutionAuthorizationRequired}`,
  );
  console.log(
    `EXECUTE_DISPATCH_ENABLED=${DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED}`,
  );
  console.log(
    `TRANSACTION_EXECUTION_AUTHORIZED=${plan.transactionExecutionAuthorized}`,
  );
  console.log(
    `D4_1C_ATTACHMENT_AUTHORIZED=${plan.d4_1cAttachmentAuthorized}`,
  );
  console.log(
    `ENVIRONMENT_READ=${runtimeState.environmentRead}`,
  );
  console.log(
    `FILESYSTEM_READ=${runtimeState.filesystemRead}`,
  );
  console.log(
    `FILESYSTEM_WRITE=${runtimeState.filesystemWrite}`,
  );
  console.log(
    `NETWORK_CALLED=${runtimeState.networkCalled}`,
  );
  console.log(
    `CONTRACT_DRY_RUN_PERFORMED=${runtimeState.contractDryRunPerformed}`,
  );
  console.log(
    `PRIVATE_KEY_READ=${runtimeState.privateKeyRead}`,
  );
  console.log(
    `WALLET_READ=${runtimeState.walletRead}`,
  );
  console.log(
    `SIGNER_CREATED=${runtimeState.signerCreated}`,
  );
  console.log(
    `TRANSACTION_CONSTRUCTED=${runtimeState.transactionConstructed}`,
  );
  console.log(
    `TRANSACTION_SIGNED=${runtimeState.transactionSigningAttempted}`,
  );
  console.log(
    `TRANSACTION_SUBMISSION_ATTEMPTED=${runtimeState.transactionSubmissionAttempted}`,
  );
  console.log(
    `SUBMISSION_ATTEMPTS=${runtimeState.submissionAttempts}`,
  );
  console.log(
    `TRANSACTION_SUBMITTED=${runtimeState.transactionSubmitted}`,
  );
  console.log(
    `AUTOMATIC_RETRY_ATTEMPTED=${runtimeState.automaticRetryAttempted}`,
  );
  console.log(
    `PAYMENT_ATTEMPTED=${runtimeState.paymentAttempted}`,
  );
  console.log(
    `D4_1C_PERFORMED=${runtimeState.d4_1cPerformed}`,
  );
}

if (
  require.main ===
    module
) {
  void main().catch(
    (
      error:
        unknown,
    ) => {
      const message =
        error instanceof Error
          ? error.message
          : "unknown_runner_error";

      console.error(
        `PR314_RUNNER_FAILED=${message}`,
      );
      console.error(
        `NETWORK_CALLED=${runtimeState.networkCalled}`,
      );
      console.error(
        `READ_ONLY_STATE_QUERY_COUNT=${runtimeState.readOnlyStateQueryCount}`,
      );
      console.error(
        `CONTRACT_DRY_RUN_PERFORMED=${runtimeState.contractDryRunPerformed}`,
      );
      console.error(
        `PRIVATE_KEY_READ=${runtimeState.privateKeyRead}`,
      );
      console.error(
        `WALLET_READ=${runtimeState.walletRead}`,
      );
      console.error(
        `SIGNER_CREATED=${runtimeState.signerCreated}`,
      );
      console.error(
        `TRANSACTION_CONSTRUCTED=${runtimeState.transactionConstructed}`,
      );
      console.error(
        `TRANSACTION_SUBMITTED=${runtimeState.transactionSubmitted}`,
      );
      console.error(
        `PAYMENT_ATTEMPTED=${runtimeState.paymentAttempted}`,
      );
      console.error(
        `D4_1C_PERFORMED=${runtimeState.d4_1cPerformed}`,
      );

      process.exitCode =
        1;
    },
  );
}
