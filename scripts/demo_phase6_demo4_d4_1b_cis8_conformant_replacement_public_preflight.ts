/**
 * PR #312 Gate 3 — controlled public-only replacement preflight.
 *
 * This runner rechecks the pinned public sources, Solana Devnet genesis,
 * finalized Concordium Testnet contract/schema/owner trust anchors, and the
 * replacement key's ownerOfKey status. It cannot read private material, sign,
 * construct or submit a transaction, mutate CIS-8/CIS-8004, or perform D4-1C.
 */

import { createHash } from "node:crypto";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR,
  buildDemo4D41bReplacementCanonicalMessageV1,
  buildDemo4D41bReplacementOwnerOfKeyParameterV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION,
  validateDemo4D41bReplacementPublicPreflightV1,
  type Demo4D41bReplacementPublicPreflightEvidenceV1,
} from "../src/phase6/demo4Cis8ConformantReplacementPreflight";

import {
  validateDemo4D41bOwnerOfKeyPostconditionV1,
} from "../src/phase6/demo4Cis8ActingKeyRegistration";

type UnknownRecord = Record<string, unknown>;

type LoadedSdk = {
  readonly sdk: any;
  readonly nodeSdk: any;
  readonly grpc: any;
};

type Snapshot = {
  readonly finalizedBlock: unknown;
  readonly finalizedBlockHash: string;
  readonly finalizedBlockHeight: string;
  readonly observedAt: string;
  readonly genesisHash: string;
  readonly genesisHashBytes: Uint8Array;
};

type InspectedSchema = {
  readonly version: number;
  readonly entrypoints: readonly string[];
  readonly eventSchemaPresent: boolean;
};

const SCRIPT_TYPE =
  "demo.phase6.demo4D41bCis8ConformantReplacementPublicPreflight.v1";

const PUBLIC_KEY_ENV =
  "DEMO4_D4_1B_REPLACEMENT_PUBLIC_KEY_HEX";

const runtimeState = {
  environmentRead: false,
  normativeSourceFetched: false,
  solanaCaipSourceFetched: false,
  solanaGenesisQueried: false,
  concordiumNetworkCalled: false,
  contractInvokedReadOnly: false,
  privateKeyRead: false,
  walletRead: false,
  signingAttempted: false,
  signerCreated: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  cis8Mutated: false,
  cis8004Mutated: false,
  d4_1cAttachmentPerformed: false,
  productionActivation: false,
};

function asRecord(value: unknown): UnknownRecord | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : null;
}

function requireAccepted<T>(
  result: {
    readonly ok: boolean;
    readonly reason: string;
    readonly value?: T;
  },
  prefix: string,
): T {
  if (result.ok !== true || result.value === undefined) {
    throw new Error(`${prefix}:${result.reason}`);
  }
  return result.value;
}

function replacementPublicKey(): Uint8Array {
  runtimeState.environmentRead = true;

  const value = process.env[PUBLIC_KEY_ENV];

  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{64}$/.test(value)
  ) {
    throw new Error("invalid_replacement_public_key_hex");
  }

  return Uint8Array.from(Buffer.from(value, "hex"));
}

function sha256Hex(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchSourceHash(
  url: string,
  source: "normative" | "solana_caip",
): Promise<string> {
  if (source === "normative") {
    runtimeState.normativeSourceFetched = true;
  } else {
    runtimeState.solanaCaipSourceFetched = true;
  }

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `${source}_source_fetch_failed:${response.status}`,
    );
  }

  const bytes = new Uint8Array(
    await response.arrayBuffer(),
  );

  if (bytes.length === 0) {
    throw new Error(`${source}_source_empty`);
  }

  return sha256Hex(bytes);
}

async function fetchSolanaDevnetGenesisHash(): Promise<string> {
  runtimeState.solanaGenesisQueried = true;

  const response = await fetch(
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetRpc,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getGenesisHash",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `solana_genesis_query_failed:${response.status}`,
    );
  }

  const parsed: unknown = await response.json();
  const record = asRecord(parsed);

  if (
    record === null ||
    record.jsonrpc !== "2.0" ||
    typeof record.result !== "string" ||
    record.result.length === 0
  ) {
    throw new Error("invalid_solana_genesis_response");
  }

  return record.result;
}

async function recheckPublicSourcePins(): Promise<{
  readonly normativeHtmlSha256: string;
  readonly solanaCaipHtmlSha256: string;
  readonly solanaDevnetGenesisHash: string;
}> {
  const [
    normativeHtmlSha256,
    solanaCaipHtmlSha256,
    solanaDevnetGenesisHash,
  ] = await Promise.all([
    fetchSourceHash(
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeUrl,
      "normative",
    ),
    fetchSourceHash(
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaCaipUrl,
      "solana_caip",
    ),
    fetchSolanaDevnetGenesisHash(),
  ]);

  if (
    normativeHtmlSha256 !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeHtmlSha256
  ) {
    throw new Error("normative_source_pin_drift");
  }

  if (
    solanaCaipHtmlSha256 !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaCaipHtmlSha256
  ) {
    throw new Error("solana_caip_source_pin_drift");
  }

  if (
    solanaDevnetGenesisHash !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetGenesisHash
  ) {
    throw new Error("solana_devnet_genesis_drift");
  }

  return {
    normativeHtmlSha256,
    solanaCaipHtmlSha256,
    solanaDevnetGenesisHash,
  };
}

async function loadSdk(): Promise<LoadedSdk> {
  const [sdk, nodeSdk, grpc] =
    await Promise.all([
      import("@concordium/web-sdk"),
      import("@concordium/web-sdk/nodejs"),
      import("@grpc/grpc-js"),
    ]);

  return {
    sdk,
    nodeSdk,
    grpc,
  };
}

function lowerHex64(
  value: unknown,
  helpers: readonly (
    (input: unknown) => unknown
  )[] = [],
): string | null {
  const candidates: unknown[] = [value];

  for (const helper of helpers) {
    try {
      candidates.push(helper(value));
    } catch {
      // Try the next supported representation.
    }
  }

  const record = asRecord(value);

  if (record !== null) {
    candidates.push(
      record.value,
      record.hex,
      record.hash,
      record.moduleRef,
      record.moduleReference,
    );
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized =
      candidate.toLowerCase().replace(/^0x/, "");

    if (/^[0-9a-f]{64}$/.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

function blockHashHex(
  value: unknown,
  sdk: any,
): string {
  const hex = lowerHex64(
    value,
    [
      (input) =>
        sdk.BlockHash?.toHexString?.(input),
      (input) =>
        sdk.BlockHash?.toString?.(input),
    ],
  );

  if (hex === null) {
    throw new Error("invalid_block_hash");
  }

  return hex;
}

function moduleReferenceHex(
  value: unknown,
  sdk: any,
): string {
  const hex = lowerHex64(
    value,
    [
      (input) =>
        sdk.ModuleReference?.toHexString?.(input),
      (input) =>
        sdk.ModuleReference?.toString?.(input),
    ],
  );

  if (hex === null) {
    throw new Error("invalid_module_reference");
  }

  return hex;
}

function safeBlockHeight(value: unknown): string {
  if (
    typeof value === "bigint" &&
    value >= 0n
  ) {
    return value.toString(10);
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }

  if (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value)
  ) {
    return value;
  }

  throw new Error("invalid_finalized_block_height");
}

function safeTimestamp(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" ||
          typeof value === "number"
        ? new Date(value)
        : null;

  if (
    date === null ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error("invalid_finalized_block_time");
  }

  return date.toISOString();
}

async function loadSnapshot(
  client: any,
  sdk: any,
): Promise<Snapshot> {
  runtimeState.concordiumNetworkCalled = true;

  const consensus =
    await client.getConsensusStatus();

  const finalizedBlock =
    consensus?.lastFinalizedBlock;

  if (
    finalizedBlock === null ||
    finalizedBlock === undefined
  ) {
    throw new Error("missing_latest_finalized_block");
  }

  const blockInfo =
    await client.getBlockInfo(finalizedBlock);

  if (
    blockInfo === null ||
    blockInfo === undefined ||
    blockInfo.finalized !== true
  ) {
    throw new Error("non_finalized_snapshot");
  }

  const genesisHash =
    blockHashHex(consensus.genesisBlock, sdk);

  return {
    finalizedBlock,
    finalizedBlockHash:
      blockHashHex(finalizedBlock, sdk),
    finalizedBlockHeight:
      safeBlockHeight(
        blockInfo.blockHeight ??
          consensus.lastFinalizedBlockHeight,
      ),
    observedAt:
      safeTimestamp(blockInfo.blockSlotTime),
    genesisHash,
    genesisHashBytes:
      Uint8Array.from(
        Buffer.from(genesisHash, "hex"),
      ),
  };
}

function schemaBuffer(
  embeddedSchema: any,
): ArrayBuffer {
  const value = embeddedSchema?.buffer;

  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const copy = new Uint8Array(value.byteLength);

    copy.set(
      new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      ),
    );

    return copy.buffer;
  }

  throw new Error("invalid_embedded_schema_buffer");
}

function collectSchemaFacts(
  value: unknown,
  strings: Set<string>,
  keys: Set<string>,
  seen: WeakSet<object>,
): void {
  if (typeof value === "string") {
    strings.add(value);
    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (value instanceof Map) {
    for (const [key, entry] of value.entries()) {
      if (typeof key === "string") {
        keys.add(key);
        strings.add(key);
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

  if (Array.isArray(value)) {
    for (const entry of value) {
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
    const [key, entry] of Object.entries(
      value as UnknownRecord,
    )
  ) {
    keys.add(key);

    collectSchemaFacts(
      entry,
      strings,
      keys,
      seen,
    );
  }
}

function schemaVersion(
  parsed: unknown,
): number {
  const record = asRecord(parsed);

  const candidates = [
    record?.version,
    record?.schemaVersion,
    record?.type,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate)
    ) {
      return candidate;
    }

    if (typeof candidate === "string") {
      const match =
        candidate.match(/(?:^|[^0-9])([0-3])$/);

      if (match !== null) {
        return Number(match[1]);
      }
    }
  }

  throw new Error(
    "unable_to_determine_schema_version",
  );
}

function inspectSchema(
  embeddedSchema: any,
  sdk: any,
): InspectedSchema {
  let parsed: unknown;

  try {
    parsed =
      sdk.parseRawModuleSchema(embeddedSchema);
  } catch {
    throw new Error(
      "embedded_schema_parse_failed",
    );
  }

  const strings = new Set<string>();
  const keys = new Set<string>();

  collectSchemaFacts(
    parsed,
    strings,
    keys,
    new WeakSet<object>(),
  );

  const allNames =
    new Set([...strings, ...keys]);

  const entrypoints = [
    DEMO4_D4_1B_REPLACEMENT_PROFILE
      .registerEntrypoint,
    DEMO4_D4_1B_REPLACEMENT_PROFILE
      .ownerOfKeyEntrypoint,
  ].filter((name) => allNames.has(name));

  if (
    !allNames.has(
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contractName,
    )
  ) {
    throw new Error(
      "missing_cis8_contract_schema",
    );
  }

  const eventSchemaPresent = [
    "event",
    "events",
    "Event",
    "Events",
  ].some((name) => keys.has(name));

  return {
    version: schemaVersion(parsed),
    entrypoints,
    eventSchemaPresent,
  };
}

function ownerParameterForSchema(
  parameter: {
    readonly external_key: {
      readonly namespace: string;
      readonly key_type: string;
      readonly public_key: readonly number[];
    };
  },
): unknown {
  return {
    external_key: {
      namespace:
        parameter.external_key.namespace,
      key_type:
        parameter.external_key.key_type,
      public_key:
        parameter.external_key.public_key.map(
          (byte) => BigInt(byte),
        ),
    },
  };
}

async function queryOwnerOfKey(
  client: any,
  sdk: any,
  snapshot: Snapshot,
  contractAddress: unknown,
  embeddedSchema: any,
  publicKey: Uint8Array,
): Promise<"unregistered"> {
  const parameterShape = requireAccepted(
    buildDemo4D41bReplacementOwnerOfKeyParameterV1(
      publicKey,
    ),
    "ownerofkey_parameter_rejected",
  );

  const contractName =
    sdk.ContractName.fromStringUnchecked(
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contractName,
    );

  const entrypointName =
    sdk.EntrypointName.fromString(
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .ownerOfKeyEntrypoint,
    );

  const parameter =
    sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      ownerParameterForSchema(parameterShape),
      schemaBuffer(embeddedSchema),
    );

  runtimeState.contractInvokedReadOnly = true;

  const invocation =
    await client.invokeContract(
      {
        method:
          sdk.ReceiveName.fromString(
            [
              DEMO4_D4_1B_REPLACEMENT_PROFILE
                .contractName,
              DEMO4_D4_1B_REPLACEMENT_PROFILE
                .ownerOfKeyEntrypoint,
            ].join("."),
          ),
        contract: contractAddress,
        parameter,
      },
      snapshot.finalizedBlock,
    );

  if (
    invocation === null ||
    invocation === undefined ||
    invocation.tag !== "success" ||
    invocation.returnValue === null ||
    invocation.returnValue === undefined
  ) {
    throw new Error(
      "cis8_ownerofkey_invocation_failed",
    );
  }

  const decoded =
    sdk.deserializeReceiveReturnValue(
      sdk.ReturnValue.toBuffer(
        sdk.unwrap(invocation.returnValue),
      ),
      schemaBuffer(embeddedSchema),
      contractName,
      entrypointName,
    );

  const postcondition =
    validateDemo4D41bOwnerOfKeyPostconditionV1(
      decoded,
    );

  if (postcondition.ok) {
    throw new Error(
      "replacement_key_already_registered",
    );
  }

  if (
    postcondition.reason !==
      "ownerofkey_not_registered"
  ) {
    throw new Error(
      `invalid_ownerofkey_result:${postcondition.reason}`,
    );
  }

  return "unregistered";
}

export type ConcordiumValidatedExecutionContext = {
  readonly sdk: any;
  readonly client: any;
  readonly snapshot: Snapshot;
  readonly contractAddress: unknown;
  readonly embeddedSchema: any;
  readonly ownerAccount: unknown;
};

export type ConcordiumInspectionHooks = {
  readonly validatedContext?: (
    context: ConcordiumValidatedExecutionContext,
  ) => Promise<void>;
};

export type ConcordiumInspectionFacts = {
  readonly snapshot: Snapshot;
  readonly moduleReference: string;
  readonly schema: InspectedSchema;
  readonly ownerAccountBytesHex: string;
  readonly ownerOfKeyStatus: "unregistered";
};

export async function inspectConcordiumPublicState(
  publicKey: Uint8Array,
  hooks: ConcordiumInspectionHooks = {},
): Promise<ConcordiumInspectionFacts> {
  const { sdk, nodeSdk, grpc } =
    await loadSdk();

  const deployed =
    DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE
      .deployedContract;

  const client =
    new nodeSdk.ConcordiumGRPCNodeClient(
      deployed.grpc.host,
      deployed.grpc.port,
      grpc.credentials.createSsl(),
    );

  try {
    const snapshot =
      await loadSnapshot(client, sdk);

    const contractAddress =
      sdk.ContractAddress.create(
        BigInt(deployed.contract.index),
        BigInt(deployed.contract.subindex),
      );

    const instanceInfo =
      await client.getInstanceInfo(
        contractAddress,
        snapshot.finalizedBlock,
      );

    if (
      instanceInfo === null ||
      instanceInfo === undefined
    ) {
      throw new Error("cis8_contract_not_found");
    }

    const moduleReference =
      moduleReferenceHex(
        instanceInfo.sourceModule,
        sdk,
      );

    if (
      moduleReference !==
        deployed.moduleReference
    ) {
      throw new Error(
        "deployed_module_reference_drift",
      );
    }

    const embeddedSchema =
      await client.getEmbeddedSchema(
        instanceInfo.sourceModule,
        snapshot.finalizedBlock,
      );

    if (
      embeddedSchema === null ||
      embeddedSchema === undefined
    ) {
      throw new Error(
        "cis8_embedded_schema_unavailable",
      );
    }

    const schema =
      inspectSchema(embeddedSchema, sdk);

    const ownerAccount =
      sdk.AccountAddress.fromBase58(
        deployed.ownerAccount,
      );

    const ownerInfo =
      await client.getAccountInfo(
        ownerAccount,
        snapshot.finalizedBlock,
      );

    if (
      ownerInfo === null ||
      ownerInfo === undefined
    ) {
      throw new Error(
        "owner_account_not_found",
      );
    }

    const ownerAccountBytes =
      Uint8Array.from(
        sdk.AccountAddress.toBuffer(
          ownerAccount,
        ),
      );

    if (ownerAccountBytes.length !== 32) {
      throw new Error(
        "invalid_owner_account_bytes",
      );
    }

    const ownerOfKeyStatus =
      await queryOwnerOfKey(
        client,
        sdk,
        snapshot,
        contractAddress,
        embeddedSchema,
        publicKey,
      );

    await hooks.validatedContext?.({
      sdk,
      client,
      snapshot,
      contractAddress,
      embeddedSchema,
      ownerAccount,
    });

    return {
      snapshot,
      moduleReference,
      schema,
      ownerAccountBytesHex:
        Buffer.from(ownerAccountBytes)
          .toString("hex"),
      ownerOfKeyStatus,
    };
  } finally {
    if (typeof client.close === "function") {
      client.close();
    }
  }
}

function buildValidatedEvidence(
  publicKey: Uint8Array,
  sources: {
    readonly normativeHtmlSha256: string;
    readonly solanaCaipHtmlSha256: string;
    readonly solanaDevnetGenesisHash: string;
  },
  inspection: ConcordiumInspectionFacts,
): Demo4D41bReplacementPublicPreflightEvidenceV1 {
  const deployed =
    DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE
      .deployedContract;

  const canonical = requireAccepted(
    buildDemo4D41bReplacementCanonicalMessageV1({
      concordiumAccountBytes:
        Uint8Array.from(
          Buffer.from(
            inspection.ownerAccountBytesHex,
            "hex",
          ),
        ),
      concordiumGenesisHashBytes:
        inspection.snapshot.genesisHashBytes,
      publicKeyBytes: publicKey,
    }),
    "canonical_message_rejected",
  );

  const candidate = {
    type:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE,
    version:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION,

    normativeHtmlSha256:
      sources.normativeHtmlSha256,
    solanaCaipHtmlSha256:
      sources.solanaCaipHtmlSha256,
    solanaDevnetGenesisHash:
      sources.solanaDevnetGenesisHash,

    finalized: true,
    finalizedBlockHeight:
      inspection.snapshot.finalizedBlockHeight,

    network: deployed.network,
    contractIndex:
      deployed.contract.index,
    contractSubindex:
      deployed.contract.subindex,
    moduleReference:
      inspection.moduleReference,
    contractName:
      deployed.contractName,
    schemaVersion:
      inspection.schema.version,
    ownerAccount:
      deployed.ownerAccount,
    ownerAccountBytesHex:
      inspection.ownerAccountBytesHex,
    concordiumGenesisHashBytesHex:
      Buffer.from(
        inspection.snapshot.genesisHashBytes,
      ).toString("hex"),

    grpcHost: deployed.grpc.host,
    grpcPort: deployed.grpc.port,
    grpcTls: true,

    entrypoints:
      inspection.schema.entrypoints,
    eventSchemaPresent:
      inspection.schema.eventSchemaPresent,

    replacementPublicKeyHex:
      Buffer.from(publicKey).toString("hex"),
    ownerOfKeyStatus:
      inspection.ownerOfKeyStatus,

    canonicalMessageByteLength:
      canonical.byteLength,
    canonicalMessageSha256:
      canonical.sha256,

    expectedRegistrationParameterByteLength:
      DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR
        .registrationParameterByteLength,
    privatePreflightRequired: true,

    safety:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY,
  } as const;

  return requireAccepted(
    validateDemo4D41bReplacementPublicPreflightV1(
      candidate,
    ),
    "public_preflight_rejected",
  );
}

function runtimeSafetyResult(): UnknownRecord {
  return {
    environmentRead:
      runtimeState.environmentRead,
    normativeSourceFetched:
      runtimeState.normativeSourceFetched,
    solanaCaipSourceFetched:
      runtimeState.solanaCaipSourceFetched,
    solanaGenesisQueried:
      runtimeState.solanaGenesisQueried,
    concordiumNetworkCalled:
      runtimeState.concordiumNetworkCalled,
    contractInvokedReadOnly:
      runtimeState.contractInvokedReadOnly,

    filesystemRead: false,
    filesystemWrite: false,
    privateKeyRead:
      runtimeState.privateKeyRead,
    walletRead:
      runtimeState.walletRead,
    keyGenerated: false,
    signingAttempted:
      runtimeState.signingAttempted,
    signerCreated:
      runtimeState.signerCreated,
    transactionConstructed:
      runtimeState.transactionConstructed,
    transactionSubmitted:
      runtimeState.transactionSubmitted,
    cis8Mutated:
      runtimeState.cis8Mutated,
    cis8004Mutated:
      runtimeState.cis8004Mutated,
    d4_1cAttachmentPerformed:
      runtimeState.d4_1cAttachmentPerformed,
    evidenceWritten: false,
    gatewayRuntimeCalled: false,
    paymentAttempted: false,
    settlementAttempted: false,
    receiptIssued: false,
    protectedResourceReleased: false,
    replayStateMutated: false,
    productionActivation:
      runtimeState.productionActivation,
  };
}

function errorReason(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const safe =
    message
      .replace(
        /[A-Za-z]:\\[^\s"'<>]+/g,
        "[local-path]",
      )
      .replace(
        /\/(?:[^/\s]+\/)+[^/\s]+/g,
        "[local-path]",
      )
      .slice(0, 300);

  return safe.length === 0
    ? "unknown_error"
    : safe;
}

async function main(): Promise<void> {
  const publicKey =
    replacementPublicKey();

  const sources =
    await recheckPublicSourcePins();

  const inspection =
    await inspectConcordiumPublicState(
      publicKey,
    );

  const evidence =
    buildValidatedEvidence(
      publicKey,
      sources,
      inspection,
    );

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: SCRIPT_TYPE,
        gate: 3,
        implementationStage:
          "controlled_public_preflight",
        environment:
          "public_read_only_testnet",
        evidence,
        observation: {
          finalizedBlockHash:
            inspection.snapshot
              .finalizedBlockHash,
          observedAt:
            inspection.snapshot.observedAt,
        },
        runtime:
          runtimeSafetyResult(),
        nextRequiredStep:
          "controlled_private_preflight",
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          script: SCRIPT_TYPE,
          gate: 3,
          implementationStage:
            "controlled_public_preflight",
          reason: errorReason(error),
          runtime:
            runtimeSafetyResult(),
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  });
}
