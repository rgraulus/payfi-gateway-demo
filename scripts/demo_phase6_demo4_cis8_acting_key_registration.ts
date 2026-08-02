/**
 * Demo4 D4-1B — controlled CIS-8 acting-key registration.
 *
 * Current implementation stage: public `inspect` plus guarded
 * `signed_preflight` mode.
 *
 * Inspect mode is read-only and public-only. Signed-preflight mode first
 * completes the same finalized Testnet inspection, then—only behind the exact
 * private-key-read gate—resolves the manifest-declared private PKCS#8 PEM,
 * derives and matches its public JWK, signs and locally verifies the raw CIS-8
 * canonical message, schema-serializes the registration parameter, and runs a
 * read-only `registerExternalKey` invocation with a bounded energy cap.
 *
 * `execute` remains fail-closed. This file does not read a wallet, create an
 * account signer, construct or submit a transaction, write evidence, make a
 * payment, mutate CIS-8/CIS-8004, call Gateway runtime, release a resource,
 * settle, issue a receipt, mutate replay state, make an authorization decision,
 * or activate production behavior.
 */

import {
  createPrivateKey,
  createPublicKey,
  sign as signEd25519,
  verify as verifyEd25519,
  type KeyObject,
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
  DEMO4_D4_1B_PROFILE,
  buildDemo4D41bCanonicalMessageV1,
  buildDemo4D41bOwnerOfKeyParameterV1,
  buildDemo4D41bRegistrationParameterV1,
  validateDemo4D41bActivationV1,
  validateDemo4D41bKeyBundleManifestV1,
  validateDemo4D41bOwnerOfKeyPostconditionV1,
  validateDemo4D41bTrustAnchorsV1,
  type Demo4D41bModeV1,
  type Demo4D41bValidatedKeyBundleV1,
  validateDemo4D41bRegistrationEventV1,
  validateDemo4D41bSanitizedEvidenceV1,
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
  readonly parsed: unknown;
};

type PublicInspection = {
  readonly sdk: any;
  readonly client: any;
  readonly manifest: Demo4D41bValidatedKeyBundleV1;
  readonly manifestFile: string;
  readonly snapshot: Snapshot;
  readonly contractAddress: unknown;
  readonly embeddedSchema: any;
  readonly schema: InspectedSchema;
  readonly moduleReference: string;
  readonly ownerAccount: unknown;
  readonly ownerOfKeyDecoded: unknown;
  readonly ownerOfKeyStatus:
    | "unregistered"
    | "registered";
};

type SignedPreflight = {
  readonly privateKeyFile: string;
  readonly canonicalMessageByteLength: number;
  readonly canonicalMessageSha256: string;
  readonly signatureByteLength: number;
  readonly signatureLocallyVerified: true;
  readonly usedEnergy: string;
  readonly transactionEnergyAllowance: string;
  readonly energySafetyCap: string;
  readonly registrationParameter: unknown;
};

const SCRIPT_TYPE =
  "demo.phase6.demo4D41bCis8ActingKeyRegistration.v1";

const IMPLEMENTATION_STAGE =
  "controlled_execute" as const;

const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_PRIVATE_KEY_BYTES = 16 * 1024;
const MAX_WALLET_BYTES = 2 * 1024 * 1024;
const FINALIZATION_TIMEOUT_MS = 180_000;
const TRANSACTION_EXPIRY_MINUTES = 5;
const DRY_RUN_ENERGY_SAFETY_CAP = 100_000n;
const DRY_RUN_ENERGY_MINIMUM_MARGIN = 1_000n;

const runtimeState = {
  publicInspectionCompleted: false,
  privateKeyRead: false,
  signatureCreated: false,
  signatureLocallyVerified: false,
  dryRunCalled: false,
  walletRead: false,
  signerCreated: false,
  transactionConstructed: false,
  transactionSubmissionAttempted: false,
  transactionSubmitted: false,
  transactionFinalized: false,
  cis8MutationConfirmed: false,
  evidenceWritten: false,
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
  if (
    result.ok !== true ||
    result.value === undefined
  ) {
    throw new Error(`${prefix}:${result.reason}`);
  }
  return result.value;
}

function exactEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0
    ? undefined
    : value;
}

function activation(): {
  readonly mode: Demo4D41bModeV1;
  readonly mayReadPrivateKey: boolean;
  readonly mayReadWallet: boolean;
  readonly mayCreateSigner: boolean;
  readonly maySign: boolean;
  readonly mayConstructTransaction: boolean;
  readonly maySubmitTransaction: boolean;
} {
  const decision = requireAccepted(
    validateDemo4D41bActivationV1({
      mode: exactEnv("DEMO4_D4_1B_MODE"),
      testnetOnly:
        exactEnv("DEMO4_D4_1B_TESTNET_ONLY"),
      privateKeyReadEnabled:
        exactEnv(
          "DEMO4_D4_1B_PRIVATE_KEY_READ_ENABLED",
        ),
      walletReadEnabled:
        exactEnv(
          "DEMO4_D4_1B_WALLET_READ_ENABLED",
        ),
      executionEnabled:
        exactEnv("DEMO4_D4_1B_EXECUTION_ENABLED"),
    }),
    "activation_rejected",
  );

  return decision;
}

function safeManifestPath(): string {
  const configured =
    exactEnv("DEMO4_D4_1B_KEY_BUNDLE_PATH");

  if (configured === undefined) {
    throw new Error("missing_key_bundle_path");
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);

  const metadata = lstatSync(absolute);

  if (!metadata.isFile()) {
    throw new Error("key_bundle_path_not_regular_file");
  }

  if (metadata.isSymbolicLink()) {
    throw new Error("key_bundle_path_symlink_forbidden");
  }

  if (
    metadata.size <= 0 ||
    metadata.size > MAX_MANIFEST_BYTES
  ) {
    throw new Error("key_bundle_manifest_size_invalid");
  }

  const canonical = realpathSync(absolute);
  const parentCanonical =
    realpathSync(dirname(absolute));

  if (
    dirname(canonical) !== parentCanonical
  ) {
    throw new Error("key_bundle_path_escape");
  }

  return canonical;
}

function readManifest(
  manifestPath: string,
): Demo4D41bValidatedKeyBundleV1 {
  let parsed: unknown;

  try {
    parsed = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    );
  } catch {
    throw new Error("invalid_key_bundle_json");
  }

  return requireAccepted(
    validateDemo4D41bKeyBundleManifestV1(parsed),
    "key_bundle_rejected",
  );
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
    if (
      typeof candidate === "string"
    ) {
      const normalized =
        candidate.toLowerCase().replace(/^0x/, "");

      if (/^[0-9a-f]{64}$/.test(normalized)) {
        return normalized;
      }
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
    const copy = new Uint8Array(
      value.byteLength,
    );

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

    if (
      typeof candidate === "string"
    ) {
      const match =
        candidate.match(/(?:^|[^0-9])([0-3])$/);

      if (match !== null) {
        return Number(match[1]);
      }
    }
  }

  throw new Error("unable_to_determine_schema_version");
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
    throw new Error("embedded_schema_parse_failed");
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
    DEMO4_D4_1B_PROFILE.registerEntrypoint,
    DEMO4_D4_1B_PROFILE.ownerOfKeyEntrypoint,
  ].filter((name) => allNames.has(name));

  const contractNamePresent =
    allNames.has(DEMO4_D4_1B_PROFILE.contractName);

  if (!contractNamePresent) {
    throw new Error("missing_cis8_contract_schema");
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
    parsed,
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
): Promise<{
  readonly decoded: unknown;
  readonly status:
    | "unregistered"
    | "registered";
}> {
  const parameterShape = requireAccepted(
    buildDemo4D41bOwnerOfKeyParameterV1(
      publicKey,
    ),
    "ownerofkey_parameter_rejected",
  );

  const contractName =
    sdk.ContractName.fromStringUnchecked(
      DEMO4_D4_1B_PROFILE.contractName,
    );

  const entrypointName =
    sdk.EntrypointName.fromString(
      DEMO4_D4_1B_PROFILE.ownerOfKeyEntrypoint,
    );

  const parameter =
    sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      ownerParameterForSchema(parameterShape),
      schemaBuffer(embeddedSchema),
    );

  const invocation =
    await client.invokeContract(
      {
        method:
          sdk.ReceiveName.fromString(
            [
              DEMO4_D4_1B_PROFILE.contractName,
              DEMO4_D4_1B_PROFILE
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

  const rawReturnValue =
    sdk.unwrap(invocation.returnValue);

  const decoded =
    sdk.deserializeReceiveReturnValue(
      sdk.ReturnValue.toBuffer(rawReturnValue),
      schemaBuffer(embeddedSchema),
      contractName,
      entrypointName,
    );

  const postcondition =
    validateDemo4D41bOwnerOfKeyPostconditionV1(
      decoded,
    );

  if (postcondition.ok) {
    return {
      decoded,
      status: "registered",
    };
  }

  if (
    postcondition.reason !==
      "ownerofkey_not_registered"
  ) {
    throw new Error(
      `invalid_ownerofkey_result:${postcondition.reason}`,
    );
  }

  return {
    decoded,
    status: "unregistered",
  };
}

async function publicInspection(
  manifestPath: string,
  manifest: Demo4D41bValidatedKeyBundleV1,
): Promise<PublicInspection> {
  const { sdk, nodeSdk, grpc } =
    await loadSdk();

  const credentials =
    grpc.credentials.createSsl();

  const client =
    new nodeSdk.ConcordiumGRPCNodeClient(
      DEMO4_D4_1B_PROFILE.grpc.host,
      DEMO4_D4_1B_PROFILE.grpc.port,
      credentials,
    );

  try {
    const snapshot =
      await loadSnapshot(client, sdk);

    const contractAddress =
      sdk.ContractAddress.create(
        BigInt(
          DEMO4_D4_1B_PROFILE.contract.index,
        ),
        BigInt(
          DEMO4_D4_1B_PROFILE.contract.subindex,
        ),
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

    requireAccepted(
      validateDemo4D41bTrustAnchorsV1({
        network: DEMO4_D4_1B_PROFILE.network,
        contractIndex:
          DEMO4_D4_1B_PROFILE.contract.index,
        contractSubindex:
          DEMO4_D4_1B_PROFILE.contract.subindex,
        moduleReference,
        contractName:
          DEMO4_D4_1B_PROFILE.contractName,
        schemaVersion: schema.version,
        ownerAccount:
          DEMO4_D4_1B_PROFILE.ownerAccount,
        grpcHost:
          DEMO4_D4_1B_PROFILE.grpc.host,
        grpcPort:
          DEMO4_D4_1B_PROFILE.grpc.port,
        grpcTls: true,
        entrypoints: schema.entrypoints,
        eventSchemaPresent:
          schema.eventSchemaPresent,
      }),
      "trust_anchor_rejected",
    );

    const ownerAccount =
      sdk.AccountAddress.fromBase58(
        DEMO4_D4_1B_PROFILE.ownerAccount,
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
      throw new Error("owner_account_not_found");
    }

    const ownerOfKey =
      await queryOwnerOfKey(
        client,
        sdk,
        snapshot,
        contractAddress,
        embeddedSchema,
        manifest.publicKey.bytes,
      );

    runtimeState.publicInspectionCompleted = true;

    return {
      sdk,
      client,
      manifest,
      manifestFile: basename(manifestPath),
      snapshot,
      contractAddress,
      embeddedSchema,
      schema,
      moduleReference,
      ownerAccount,
      ownerOfKeyDecoded:
        ownerOfKey.decoded,
      ownerOfKeyStatus:
        ownerOfKey.status,
    };
  } catch (error: unknown) {
    if (
      typeof client.close === "function"
    ) {
      client.close();
    }
    throw error;
  }
}

function closeInspection(
  inspection: PublicInspection,
): void {
  if (
    typeof inspection.client.close === "function"
  ) {
    inspection.client.close();
  }
}

function publicResult(
  inspection: PublicInspection,
): UnknownRecord {
  return {
    ok: true,
    script: SCRIPT_TYPE,
    implementationStage:
      IMPLEMENTATION_STAGE,
    mode: "inspect",
    environment:
      "controlled_concordium_testnet",
    network:
      DEMO4_D4_1B_PROFILE.network,
    grpc: {
      host:
        DEMO4_D4_1B_PROFILE.grpc.host,
      port:
        DEMO4_D4_1B_PROFILE.grpc.port,
      tls: true,
    },
    manifest: {
      file: inspection.manifestFile,
      contract:
        inspection.manifest.contract,
      mode:
        inspection.manifest.mode,
      agentId:
        inspection.manifest.agentId,
      agentKeyId:
        inspection.manifest.agentKeyId,
      publicKeyBase64Url:
        inspection.manifest.publicKey.base64Url,
      publicKeyHex:
        inspection.manifest.publicKey.hex,
      publicKeyFingerprint:
        inspection.manifest.publicKey.fingerprint,
      privateKeyRead: false,
    },
    registry: {
      contract:
        DEMO4_D4_1B_PROFILE.contract,
      contractName:
        DEMO4_D4_1B_PROFILE.contractName,
      moduleReference:
        inspection.moduleReference,
      schemaVersion:
        inspection.schema.version,
      registerEntrypointPresent:
        inspection.schema.entrypoints.includes(
          DEMO4_D4_1B_PROFILE
            .registerEntrypoint,
        ),
      ownerOfKeyEntrypointPresent:
        inspection.schema.entrypoints.includes(
          DEMO4_D4_1B_PROFILE
            .ownerOfKeyEntrypoint,
        ),
      eventSchemaPresent:
        inspection.schema.eventSchemaPresent,
      ownerAccount:
        DEMO4_D4_1B_PROFILE.ownerAccount,
      ownerAccountExists: true,
      ownerOfKeyStatus:
        inspection.ownerOfKeyStatus,
    },
    snapshot: {
      finalizedBlockHash:
        inspection.snapshot.finalizedBlockHash,
      finalizedBlockHeight:
        inspection.snapshot.finalizedBlockHeight,
      observedAt:
        inspection.snapshot.observedAt,
      finalized: true,
      genesisHash:
        inspection.snapshot.genesisHash,
    },
    safety: {
      publicInspectionCompleted: true,
      keyBundleManifestRead: true,
      privateKeyRead: false,
      walletRead: false,
      signatureCreated: false,
      signerCreated: false,
      transactionConstructed: false,
      transactionSubmitted: false,
      paymentAttempted: false,
      cis8Mutated: false,
      cis8004Mutated: false,
      externalReferenceUpdated: false,
      evidenceWritten: false,
      databaseMutated: false,
      gatewayRuntimeCalled: false,
      protectedResourceReleased: false,
      settlementAttempted: false,
      receiptIssued: false,
      replayStateMutated: false,
      authorizationDecided: false,
      productionActivation: false,
    },
  };
}



function safeWalletPath(): string {
  const configured =
    exactEnv("DEMO4_D4_1B_WALLET_PATH");

  if (configured === undefined) {
    throw new Error("missing_wallet_path");
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);

  const metadata = lstatSync(absolute);

  if (!metadata.isFile()) {
    throw new Error("wallet_path_not_regular_file");
  }

  if (metadata.isSymbolicLink()) {
    throw new Error("wallet_path_symlink_forbidden");
  }

  if (
    metadata.size <= 0 ||
    metadata.size > MAX_WALLET_BYTES
  ) {
    throw new Error("wallet_size_invalid");
  }

  const canonical = realpathSync(absolute);
  const parentCanonical =
    realpathSync(dirname(absolute));

  if (dirname(canonical) !== parentCanonical) {
    throw new Error("wallet_path_escape");
  }

  return canonical;
}

function safeEvidencePath(): string {
  const configured =
    exactEnv("DEMO4_D4_1B_EVIDENCE_PATH");

  if (configured === undefined) {
    throw new Error("missing_evidence_path");
  }

  if (configured.includes("\0")) {
    throw new Error("invalid_evidence_path");
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);

  const parent = realpathSync(dirname(absolute));

  if (dirname(absolute) !== parent) {
    throw new Error("evidence_path_escape");
  }

  try {
    lstatSync(absolute);
    throw new Error("evidence_path_already_exists");
  } catch (error: unknown) {
    const record = asRecord(error);
    if (record?.code !== "ENOENT") {
      throw error;
    }
  }

  return absolute;
}

function safePrivateKeyPath(
  manifestPath: string,
  privateKeyFile: string,
): string {
  if (
    isAbsolute(privateKeyFile) ||
    privateKeyFile.includes("\0")
  ) {
    throw new Error("invalid_private_key_reference");
  }

  const ceremonyDirectory =
    realpathSync(dirname(manifestPath));

  const candidate = resolve(
    ceremonyDirectory,
    privateKeyFile,
  );

  if (dirname(candidate) !== ceremonyDirectory) {
    throw new Error("private_key_path_escape");
  }

  const metadata = lstatSync(candidate);

  if (!metadata.isFile()) {
    throw new Error("private_key_not_regular_file");
  }

  if (metadata.isSymbolicLink()) {
    throw new Error("private_key_symlink_forbidden");
  }

  if (
    metadata.size <= 0 ||
    metadata.size > MAX_PRIVATE_KEY_BYTES
  ) {
    throw new Error("private_key_size_invalid");
  }

  const canonical = realpathSync(candidate);

  if (
    dirname(canonical) !== ceremonyDirectory
  ) {
    throw new Error("private_key_path_escape");
  }

  return canonical;
}

function importMatchedPrivateKey(
  privateKeyPath: string,
  manifest: Demo4D41bValidatedKeyBundleV1,
): {
  readonly privateKey: KeyObject;
  readonly publicKey: KeyObject;
} {
  const privatePem = readFileSync(
    privateKeyPath,
    "utf8",
  );

  runtimeState.privateKeyRead = true;

  let privateKey: KeyObject;

  try {
    privateKey = createPrivateKey({
      key: privatePem,
      format: "pem",
    });
  } catch {
    throw new Error("invalid_private_pkcs8_pem");
  }

  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("private_key_not_ed25519");
  }

  const publicKey = createPublicKey(privateKey);
  const exported = publicKey.export({
    format: "jwk",
  });
  const jwk = asRecord(exported);

  if (
    jwk === null ||
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    jwk.x !== manifest.publicKey.base64Url ||
    Object.prototype.hasOwnProperty.call(jwk, "d")
  ) {
    throw new Error("private_public_key_mismatch");
  }

  return {
    privateKey,
    publicKey,
  };
}

function registrationParameterForSchema(
  parameter: {
    readonly external_key: {
      readonly namespace: string;
      readonly key_type: string;
      readonly public_key: readonly number[];
    };
    readonly proof: {
      readonly scheme: string;
      readonly signature: readonly number[];
    };
    readonly metadata: readonly never[];
  },
): unknown {
  return {
    external_key: {
      namespace: parameter.external_key.namespace,
      key_type: parameter.external_key.key_type,
      public_key: parameter.external_key.public_key.map(
        (byte) => BigInt(byte),
      ),
    },
    proof: {
      scheme: parameter.proof.scheme,
      signature: parameter.proof.signature.map(
        (byte) => BigInt(byte),
      ),
    },
    metadata: [],
  };
}

function safeEnergy(
  value: unknown,
  sdk: any,
): bigint {
  const candidates: unknown[] = [value];
  const record = asRecord(value);

  if (record !== null) {
    candidates.push(record.value, record.energy);
  }

  for (const helperName of [
    "toJSON",
    "toString",
    "toUnwrappedJSON",
  ]) {
    try {
      const helper = sdk.Energy?.[helperName];
      if (typeof helper === "function") {
        candidates.push(helper(value));
      }
    } catch {
      // Continue through supported representations.
    }
  }

  for (const candidate of candidates) {
    if (
      typeof candidate === "bigint" &&
      candidate >= 0n
    ) {
      return candidate;
    }

    if (
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0
    ) {
      return BigInt(candidate);
    }

    if (
      typeof candidate === "string" &&
      /^(0|[1-9][0-9]*)$/.test(candidate)
    ) {
      return BigInt(candidate);
    }
  }

  throw new Error("invalid_dry_run_energy");
}

function boundedEnergyAllowance(
  usedEnergy: bigint,
): bigint {
  if (usedEnergy > DRY_RUN_ENERGY_SAFETY_CAP) {
    throw new Error("dry_run_energy_exceeds_safety_cap");
  }

  const percentageMargin = usedEnergy / 5n;
  const margin =
    percentageMargin >
      DRY_RUN_ENERGY_MINIMUM_MARGIN
      ? percentageMargin
      : DRY_RUN_ENERGY_MINIMUM_MARGIN;

  const candidate = usedEnergy + margin;

  return candidate > DRY_RUN_ENERGY_SAFETY_CAP
    ? DRY_RUN_ENERGY_SAFETY_CAP
    : candidate;
}

async function signedPreflight(
  inspection: PublicInspection,
  manifestPath: string,
): Promise<SignedPreflight> {
  const privateKeyPath = safePrivateKeyPath(
    manifestPath,
    inspection.manifest.privateKeyFile,
  );

  const keys = importMatchedPrivateKey(
    privateKeyPath,
    inspection.manifest,
  );

  const accountBytes = Uint8Array.from(
    inspection.sdk.AccountAddress.toBuffer(
      inspection.ownerAccount,
    ),
  );

  const canonical = requireAccepted(
    buildDemo4D41bCanonicalMessageV1({
      ownerAccountBytes: accountBytes,
      contractIndex:
        DEMO4_D4_1B_PROFILE.contract.index,
      contractSubindex:
        DEMO4_D4_1B_PROFILE.contract.subindex,
      genesisHashBytes:
        inspection.snapshot.genesisHashBytes,
      externalNamespace:
        DEMO4_D4_1B_PROFILE.externalNamespace,
      externalKeyNamespace:
        DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      externalKeyType:
        DEMO4_D4_1B_PROFILE.externalKeyType,
      publicKeyBytes:
        inspection.manifest.publicKey.bytes,
      proofScheme:
        DEMO4_D4_1B_PROFILE.proofScheme,
    }),
    "canonical_message_rejected",
  );

  const message = Buffer.from(canonical.bytes);
  const signature = signEd25519(
    null,
    message,
    keys.privateKey,
  );

  runtimeState.signatureCreated = true;

  if (signature.length !== 64) {
    throw new Error("invalid_ed25519_signature_length");
  }

  if (
    !verifyEd25519(
      null,
      message,
      keys.publicKey,
      signature,
    )
  ) {
    throw new Error("local_signature_verification_failed");
  }

  runtimeState.signatureLocallyVerified = true;

  const parameterShape = requireAccepted(
    buildDemo4D41bRegistrationParameterV1(
      inspection.manifest.publicKey.bytes,
      Uint8Array.from(signature),
    ),
    "registration_parameter_rejected",
  );

  const contractName =
    inspection.sdk.ContractName.fromStringUnchecked(
      DEMO4_D4_1B_PROFILE.contractName,
    );

  const entrypointName =
    inspection.sdk.EntrypointName.fromString(
      DEMO4_D4_1B_PROFILE.registerEntrypoint,
    );

  const parameter =
    inspection.sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      registrationParameterForSchema(
        parameterShape,
      ),
      schemaBuffer(inspection.embeddedSchema),
    );

  runtimeState.dryRunCalled = true;

  const invocation =
    await inspection.client.invokeContract(
      {
        invoker: inspection.ownerAccount,
        contract: inspection.contractAddress,
        method:
          inspection.sdk.ReceiveName.fromString(
            [
              DEMO4_D4_1B_PROFILE.contractName,
              DEMO4_D4_1B_PROFILE
                .registerEntrypoint,
            ].join("."),
          ),
        parameter,
        amount: inspection.sdk.CcdAmount.zero(),
        energy: inspection.sdk.Energy.create(
          DRY_RUN_ENERGY_SAFETY_CAP,
        ),
      },
      inspection.snapshot.finalizedBlock,
    );

  if (
    invocation === null ||
    invocation === undefined
  ) {
    throw new Error(
      "register_external_key_dry_run_failed:result_unavailable",
    );
  }

  if (invocation.tag !== "success") {
    const failure = invocation as any;

    const reasonTag =
      typeof failure.reason?.tag === "string"
        ? failure.reason.tag
        : "unknown";

    const rejectReason =
      Number.isSafeInteger(
        failure.reason?.rejectReason,
      )
        ? String(failure.reason.rejectReason)
        : "none";

    let decodedError = "unavailable";

    if (
      failure.returnValue !== null &&
      failure.returnValue !== undefined
    ) {
      try {
        const rawError =
          inspection.sdk.unwrap(
            failure.returnValue,
          );

        const decoded =
          inspection.sdk.deserializeReceiveError(
            inspection.sdk.ReturnValue.toBuffer(
              rawError,
            ),
            schemaBuffer(
              inspection.embeddedSchema,
            ),
            contractName,
            entrypointName,
          );

        const serialized = JSON.stringify(
          decoded,
          (_key, value) =>
            typeof value === "bigint"
              ? value.toString(10)
              : value,
        );

        decodedError = (
          serialized ?? "null"
        )
          .replace(/[\\r\\n\\t]/g, " ")
          .slice(0, 512);
      } catch {
        decodedError = "decode_failed";
      }
    }

    let failureEnergy = "unknown";

    try {
      failureEnergy = safeEnergy(
        failure.usedEnergy,
        inspection.sdk,
      ).toString(10);
    } catch {
      failureEnergy = "invalid";
    }

    throw new Error(
      [
        "register_external_key_dry_run_failed",
        `reason_tag=${reasonTag}`,
        `reject_reason=${rejectReason}`,
        `decoded_error=${decodedError}`,
        `used_energy=${failureEnergy}`,
      ].join(":"),
    );
  }

  const usedEnergy = safeEnergy(
    invocation.usedEnergy,
    inspection.sdk,
  );

  const allowance = boundedEnergyAllowance(
    usedEnergy,
  );

  return {
    privateKeyFile: basename(privateKeyPath),
    canonicalMessageByteLength:
      canonical.byteLength,
    canonicalMessageSha256:
      canonical.sha256,
    signatureByteLength:
      signature.length,
    signatureLocallyVerified: true,
    usedEnergy: usedEnergy.toString(10),
    transactionEnergyAllowance:
      allowance.toString(10),
    energySafetyCap:
      DRY_RUN_ENERGY_SAFETY_CAP.toString(10),
    registrationParameter:
      registrationParameterForSchema(parameterShape),
  };
}


function exactArrayBuffer(
  value: Uint8Array,
): ArrayBuffer {
  const copy = Uint8Array.from(value);
  return copy.buffer;
}

function contractAddressMatches(
  sdk: any,
  left: unknown,
  right: unknown,
): boolean {
  try {
    return sdk.ContractAddress.equals(left, right);
  } catch {
    const leftRecord = asRecord(left);
    const rightRecord = asRecord(right);

    return (
      leftRecord !== null &&
      rightRecord !== null &&
      String(leftRecord.index) ===
        String(rightRecord.index) &&
      String(leftRecord.subindex) ===
        String(rightRecord.subindex)
    );
  }
}

function eventSchemaType(
  inspection: PublicInspection,
): unknown {
  const parsed =
    asRecord(inspection.schema.parsed);

  const moduleRecord =
    asRecord(parsed?.module) ?? parsed;

  const rawContracts =
    moduleRecord?.contracts;

  let contract: UnknownRecord | null;

  if (rawContracts instanceof Map) {
    contract = asRecord(
      rawContracts.get(
        DEMO4_D4_1B_PROFILE.contractName,
      ),
    );
  } else {
    const contracts =
      asRecord(rawContracts);

    contract =
      contracts === null
        ? null
        : asRecord(
            contracts[
              DEMO4_D4_1B_PROFILE
                .contractName
            ],
          );
  }

  const event = contract?.event;

  if (event === null || event === undefined) {
    throw new Error(
      "cis8_event_schema_type_unavailable",
    );
  }

  return event;
}

function safeWalletSigner(
  inspection: PublicInspection,
): {
  readonly signer: any;
  readonly sender: unknown;
} {
  const walletPath = safeWalletPath();

  runtimeState.walletRead = true;

  const walletText =
    readFileSync(walletPath, "utf8");

  let walletExport: any;

  try {
    walletExport =
      inspection.sdk.parseWallet(walletText);
  } catch {
    throw new Error("wallet_parse_failed");
  }

  const walletAddress =
    walletExport?.value?.address;

  if (
    typeof walletAddress !== "string" ||
    walletAddress !==
      DEMO4_D4_1B_PROFILE.ownerAccount
  ) {
    throw new Error("wallet_owner_mismatch");
  }

  const sender =
    inspection.sdk.AccountAddress.fromBase58(
      walletAddress,
    );

  const signer =
    inspection.sdk.buildAccountSigner(
      walletExport,
    );

  runtimeState.signerCreated = true;

  return {
    signer,
    sender,
  };
}

function registrationSerializer(
  inspection: PublicInspection,
): (input: unknown) => ArrayBuffer {
  const contractName =
    inspection.sdk.ContractName
      .fromStringUnchecked(
        DEMO4_D4_1B_PROFILE.contractName,
      );

  const entrypointName =
    inspection.sdk.EntrypointName.fromString(
      DEMO4_D4_1B_PROFILE.registerEntrypoint,
    );

  return (input: unknown): ArrayBuffer => {
    const parameter =
      inspection.sdk
        .serializeUpdateContractParameters(
          contractName,
          entrypointName,
          input,
          schemaBuffer(
            inspection.embeddedSchema,
          ),
        );

    return exactArrayBuffer(
      inspection.sdk.Parameter.toBuffer(
        parameter,
      ),
    );
  };
}

async function queryRegisteredOwnerOfKey(
  inspection: PublicInspection,
  snapshot: Snapshot,
): Promise<{
  readonly decoded: unknown;
  readonly owner:
    typeof DEMO4_D4_1B_PROFILE.ownerAccount;
}> {
  const parameterShape = requireAccepted(
    buildDemo4D41bOwnerOfKeyParameterV1(
      inspection.manifest.publicKey.bytes,
    ),
    "ownerofkey_parameter_rejected",
  );

  const contractName =
    inspection.sdk.ContractName
      .fromStringUnchecked(
        DEMO4_D4_1B_PROFILE.contractName,
      );

  const entrypointName =
    inspection.sdk.EntrypointName.fromString(
      DEMO4_D4_1B_PROFILE
        .ownerOfKeyEntrypoint,
    );

  const parameter =
    inspection.sdk
      .serializeUpdateContractParameters(
        contractName,
        entrypointName,
        ownerParameterForSchema(
          parameterShape,
        ),
        schemaBuffer(
          inspection.embeddedSchema,
        ),
      );

  const invocation =
    await inspection.client.invokeContract(
      {
        method:
          inspection.sdk.ReceiveName.fromString(
            [
              DEMO4_D4_1B_PROFILE.contractName,
              DEMO4_D4_1B_PROFILE
                .ownerOfKeyEntrypoint,
            ].join("."),
          ),
        contract:
          inspection.contractAddress,
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
      "post_registration_ownerofkey_failed",
    );
  }

  const rawReturnValue =
    inspection.sdk.unwrap(
      invocation.returnValue,
    );

  const decoded =
    inspection.sdk
      .deserializeReceiveReturnValue(
        inspection.sdk.ReturnValue.toBuffer(
          rawReturnValue,
        ),
        schemaBuffer(
          inspection.embeddedSchema,
        ),
        contractName,
        entrypointName,
      );

  const postcondition = requireAccepted(
    validateDemo4D41bOwnerOfKeyPostconditionV1(
      decoded,
    ),
    "ownerofkey_postcondition_rejected",
  );

  return {
    decoded,
    owner: postcondition.owner,
  };
}

function matchingRegistrationEvent(
  inspection: PublicInspection,
  summary: any,
): {
  readonly owner:
    typeof DEMO4_D4_1B_PROFILE.ownerAccount;
  readonly publicKeyBase64Url: string;
  readonly publicKeyHex: string;
  readonly proofScheme:
    typeof DEMO4_D4_1B_PROFILE.proofScheme;
  readonly metadata: readonly never[];
} {
  const logs =
    inspection.sdk
      .getSummaryContractUpdateLogs(
        summary,
      );

  const schemaType =
    eventSchemaType(inspection);

  const matches: Array<{
    readonly owner:
      typeof DEMO4_D4_1B_PROFILE
        .ownerAccount;
    readonly publicKeyBase64Url: string;
    readonly publicKeyHex: string;
    readonly proofScheme:
      typeof DEMO4_D4_1B_PROFILE
        .proofScheme;
    readonly metadata: readonly never[];
  }> = [];

  for (const log of logs) {
    if (!inspection.sdk.isKnown(log)) {
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

    for (const event of log.events) {
      const bytes =
        inspection.sdk.ContractEvent
          .toBuffer(event);

      if (
        bytes.length === 0 ||
        bytes[0] !==
          DEMO4_D4_1B_PROFILE.eventTag
      ) {
        continue;
      }

      let decoded: unknown;

      try {
        decoded =
          inspection.sdk.ContractEvent
            .parseWithSchemaType(
              event,
              schemaType,
            );
      } catch {
        throw new Error(
          "registration_event_decode_failed",
        );
      }

      matches.push(
        requireAccepted(
          validateDemo4D41bRegistrationEventV1({
            tag: bytes[0],
            contract: log.address,
            decoded,
            expectedPublicKey:
              inspection.manifest.publicKey
                .bytes,
          }),
          "registration_event_rejected",
        ),
      );
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `registration_event_count_invalid:${matches.length}`,
    );
  }

  return matches[0];
}

async function executeRegistration(
  inspection: PublicInspection,
  manifestPath: string,
): Promise<UnknownRecord> {
  if (
    inspection.ownerOfKeyStatus !==
      "unregistered"
  ) {
    throw new Error(
      "acting_key_already_registered",
    );
  }

  const latestSnapshot =
    await loadSnapshot(
      inspection.client,
      inspection.sdk,
    );

  const latestOwnerOfKey =
    await queryOwnerOfKey(
      inspection.client,
      inspection.sdk,
      latestSnapshot,
      inspection.contractAddress,
      inspection.embeddedSchema,
      inspection.manifest.publicKey.bytes,
    );

  if (
    latestOwnerOfKey.status !==
      "unregistered"
  ) {
    throw new Error(
      "acting_key_already_registered",
    );
  }

  const evidencePath = safeEvidencePath();

  const latestInspection: PublicInspection = {
    ...inspection,
    snapshot: latestSnapshot,
    ownerOfKeyDecoded:
      latestOwnerOfKey.decoded,
    ownerOfKeyStatus:
      latestOwnerOfKey.status,
  };

  const preflight =
    await signedPreflight(
      latestInspection,
      manifestPath,
    );

  const wallet =
    safeWalletSigner(latestInspection);

  if (
    runtimeState.transactionSubmissionAttempted
  ) {
    throw new Error(
      "duplicate_submission_forbidden",
    );
  }

  const contract =
    await inspection.sdk.Contract.create(
      inspection.client,
      inspection.contractAddress,
    );

  const entrypoint =
    inspection.sdk.EntrypointName.fromString(
      DEMO4_D4_1B_PROFILE.registerEntrypoint,
    );

  const metadata = {
    senderAddress: wallet.sender,
    energy:
      inspection.sdk.Energy.create(
        BigInt(
          preflight
            .transactionEnergyAllowance,
        ),
      ),
    expiry:
      inspection.sdk.TransactionExpiry
        .futureMinutes(
          TRANSACTION_EXPIRY_MINUTES,
        ),
  };

  runtimeState.transactionConstructed = true;
  runtimeState.transactionSubmissionAttempted =
    true;

  const transactionHash =
    await contract
      .createAndSendUpdateTransaction(
        entrypoint,
        registrationSerializer(
          latestInspection,
        ),
        metadata,
        preflight.registrationParameter,
        wallet.signer,
      );

  runtimeState.transactionSubmitted = true;

  const transactionHashHex =
    inspection.sdk.TransactionHash
      .toHexString(transactionHash);

  const finalized =
    await inspection.client
      .waitForTransactionFinalization(
        transactionHash,
        FINALIZATION_TIMEOUT_MS,
      );

  runtimeState.transactionFinalized = true;

  if (
    !inspection.sdk.isKnown(
      finalized.summary,
    )
  ) {
    throw new Error(
      "unknown_finalized_summary",
    );
  }

  const summary = finalized.summary;

  if (
    !inspection.sdk.isSuccessTransaction(
      summary,
    )
  ) {
    const reason =
      inspection.sdk.isRejectTransaction(
        summary,
      )
        ? String(
            summary.rejectReason?.tag ??
              "unknown",
          )
        : "not_success";

    throw new Error(
      `registration_transaction_failed:${reason}`,
    );
  }

  if (
    !inspection.sdk.isUpdateContractSummary(
      summary,
    )
  ) {
    throw new Error(
      "finalized_summary_not_contract_update",
    );
  }

  const finalizedSender =
    Buffer.from(
      inspection.sdk.AccountAddress.toBuffer(
        summary.sender,
      ),
    );

  const expectedSender =
    Buffer.from(
      inspection.sdk.AccountAddress.toBuffer(
        inspection.ownerAccount,
      ),
    );

  if (
    !finalizedSender.equals(expectedSender)
  ) {
    throw new Error(
      "finalized_sender_mismatch",
    );
  }

  const event =
    matchingRegistrationEvent(
      inspection,
      summary,
    );

  const postSnapshot =
    await loadSnapshot(
      inspection.client,
      inspection.sdk,
    );

  const ownership =
    await queryRegisteredOwnerOfKey(
      inspection,
      postSnapshot,
    );

  runtimeState.cis8MutationConfirmed = true;

  const finalizedBlockHash =
    inspection.sdk.BlockHash.toHexString(
      finalized.blockHash,
    );

  const evidence = {
    type:
      "xcf.demo4.d4-1b.cis8-acting-key-registration-evidence",
    version: "1",
    mode: "controlled_execute",
    environment:
      "controlled_concordium_testnet",
    network:
      DEMO4_D4_1B_PROFILE.network,
    registry: {
      contract:
        DEMO4_D4_1B_PROFILE.contract,
      contractName:
        DEMO4_D4_1B_PROFILE.contractName,
      moduleReference:
        inspection.moduleReference,
      ownerAccount:
        DEMO4_D4_1B_PROFILE.ownerAccount,
    },
    actingKey: {
      agentId:
        inspection.manifest.agentId,
      agentKeyId:
        inspection.manifest.agentKeyId,
      publicKeyBase64Url:
        inspection.manifest.publicKey
          .base64Url,
      publicKeyHex:
        inspection.manifest.publicKey.hex,
      publicKeyFingerprint:
        inspection.manifest.publicKey
          .fingerprint,
    },
    proof: {
      scheme:
        DEMO4_D4_1B_PROFILE.proofScheme,
      canonicalMessageByteLength:
        preflight
          .canonicalMessageByteLength,
      canonicalMessageSha256:
        preflight
          .canonicalMessageSha256,
      proofByteLength:
        preflight.signatureByteLength,
      locallyVerified: true,
      dryRunUsedEnergy:
        preflight.usedEnergy,
      transactionEnergyAllowance:
        preflight
          .transactionEnergyAllowance,
    },
    transaction: {
      hash: transactionHashHex,
      finalized: true,
      finalizedBlockHash,
      energyCost:
        safeEnergy(
          summary.energyCost,
          inspection.sdk,
        ).toString(10),
      costMicroCcd:
        String(summary.cost),
      transactionType:
        String(summary.transactionType),
    },
    registrationEvent: event,
    ownershipPostcondition: {
      owner: ownership.owner,
      finalizedBlockHash:
        postSnapshot.finalizedBlockHash,
      finalizedBlockHeight:
        postSnapshot.finalizedBlockHeight,
      finalized: true,
    },
    safety: {
      exactlyOneSubmissionAttempted: true,
      zeroCcdAttached: true,
      paymentAttempted: false,
      cis8004Mutated: false,
      externalReferenceUpdated: false,
      databaseMutated: false,
      gatewayRuntimeCalled: false,
      protectedResourceReleased: false,
      settlementAttempted: false,
      receiptIssued: false,
      replayStateMutated: false,
      authorizationDecided: false,
      productionActivation: false,
    },
  };

  const validatedEvidence =
    requireAccepted(
      validateDemo4D41bSanitizedEvidenceV1(
        evidence,
      ),
      "evidence_rejected",
    );

  writeFileSync(
    evidencePath,
    `${validatedEvidence.canonicalJson}\n`,
    {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    },
  );

  runtimeState.evidenceWritten = true;

  return {
    ok: true,
    script: SCRIPT_TYPE,
    implementationStage:
      IMPLEMENTATION_STAGE,
    mode: "execute",
    environment:
      "controlled_concordium_testnet",
    network:
      DEMO4_D4_1B_PROFILE.network,
    registry: {
      contract:
        DEMO4_D4_1B_PROFILE.contract,
      ownerAccount:
        DEMO4_D4_1B_PROFILE.ownerAccount,
      ownerOfKeyStatus: "registered",
    },
    actingKey: {
      agentId:
        inspection.manifest.agentId,
      agentKeyId:
        inspection.manifest.agentKeyId,
      publicKeyFingerprint:
        inspection.manifest.publicKey
          .fingerprint,
    },
    transaction: {
      hash: transactionHashHex,
      finalized: true,
      finalizedBlockHash,
      energyCost:
        safeEnergy(
          summary.energyCost,
          inspection.sdk,
        ).toString(10),
      costMicroCcd:
        String(summary.cost),
    },
    registrationEvent: {
      count: 1,
      owner: event.owner,
      publicKeyFingerprint:
        inspection.manifest.publicKey
          .fingerprint,
      proofScheme:
        event.proofScheme,
      metadataCount:
        event.metadata.length,
    },
    ownershipPostcondition: {
      owner: ownership.owner,
      finalizedBlockHash:
        postSnapshot.finalizedBlockHash,
      finalizedBlockHeight:
        postSnapshot.finalizedBlockHeight,
    },
    evidence: {
      written: true,
      file: basename(evidencePath),
      evidenceHash:
        validatedEvidence.evidenceHash,
      privateMaterialIncluded: false,
      walletMaterialIncluded: false,
      rawParameterIncluded: false,
    },
    safety: {
      publicInspectionCompleted: true,
      privateKeyRead: true,
      walletRead: true,
      signatureCreated: true,
      signatureLocallyVerified: true,
      signerCreated: true,
      transactionConstructed: true,
      transactionSubmissionAttempted: true,
      transactionSubmitted: true,
      transactionFinalized: true,
      cis8Mutated: true,
      cis8004Mutated: false,
      externalReferenceUpdated: false,
      evidenceWritten: true,
      paymentAttempted: false,
      databaseMutated: false,
      gatewayRuntimeCalled: false,
      protectedResourceReleased: false,
      settlementAttempted: false,
      receiptIssued: false,
      replayStateMutated: false,
      authorizationDecided: false,
      productionActivation: false,
    },
  };
}

function signedPreflightResult(
  inspection: PublicInspection,
  preflight: SignedPreflight,
): UnknownRecord {
  return {
    ok: true,
    script: SCRIPT_TYPE,
    implementationStage:
      IMPLEMENTATION_STAGE,
    mode: "signed_preflight",
    environment:
      "controlled_concordium_testnet",
    network:
      DEMO4_D4_1B_PROFILE.network,
    manifest: {
      file: inspection.manifestFile,
      agentId: inspection.manifest.agentId,
      agentKeyId: inspection.manifest.agentKeyId,
      publicKeyFingerprint:
        inspection.manifest.publicKey.fingerprint,
      privateKeyFile:
        preflight.privateKeyFile,
      privateKeyRead: true,
      privateMaterialPrinted: false,
    },
    registry: {
      contract:
        DEMO4_D4_1B_PROFILE.contract,
      moduleReference:
        inspection.moduleReference,
      ownerAccount:
        DEMO4_D4_1B_PROFILE.ownerAccount,
      ownerOfKeyStatus:
        inspection.ownerOfKeyStatus,
    },
    snapshot: {
      finalizedBlockHash:
        inspection.snapshot.finalizedBlockHash,
      finalizedBlockHeight:
        inspection.snapshot.finalizedBlockHeight,
      genesisHash:
        inspection.snapshot.genesisHash,
      finalized: true,
    },
    canonicalMessage: {
      byteLength:
        preflight.canonicalMessageByteLength,
      sha256:
        preflight.canonicalMessageSha256,
      rawMessagePrinted: false,
    },
    signature: {
      byteLength:
        preflight.signatureByteLength,
      created: true,
      locallyVerified:
        preflight.signatureLocallyVerified,
      valuePrinted: false,
    },
    dryRun: {
      entrypoint:
        DEMO4_D4_1B_PROFILE.registerEntrypoint,
      invoker:
        DEMO4_D4_1B_PROFILE.ownerAccount,
      amountMicroCcd: "0",
      success: true,
      usedEnergy:
        preflight.usedEnergy,
      transactionEnergyAllowance:
        preflight.transactionEnergyAllowance,
      energySafetyCap:
        preflight.energySafetyCap,
      parameterPrinted: false,
    },
    safety: {
      publicInspectionCompleted: true,
      privateKeyRead: true,
      walletRead: false,
      signatureCreated: true,
      signatureLocallyVerified: true,
      signerCreated: false,
      transactionConstructed: false,
      transactionSubmitted: false,
      paymentAttempted: false,
      cis8Mutated: false,
      cis8004Mutated: false,
      externalReferenceUpdated: false,
      evidenceWritten: false,
      databaseMutated: false,
      gatewayRuntimeCalled: false,
      protectedResourceReleased: false,
      settlementAttempted: false,
      receiptIssued: false,
      replayStateMutated: false,
      authorizationDecided: false,
      productionActivation: false,
    },
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
  const decision = activation();

  const manifestPath =
    safeManifestPath();

  const manifest =
    readManifest(manifestPath);

  const inspection =
    await publicInspection(
      manifestPath,
      manifest,
    );

  try {
    if (decision.mode === "inspect") {
      console.log(
        JSON.stringify(
          publicResult(inspection),
          null,
          2,
        ),
      );
      return;
    }

    if (
      decision.mode === "signed_preflight"
    ) {
      if (
        decision.mayReadPrivateKey !== true ||
        decision.maySign !== true ||
        decision.mayReadWallet !== false ||
        decision.mayCreateSigner !== false ||
        decision.mayConstructTransaction !== false ||
        decision.maySubmitTransaction !== false
      ) {
        throw new Error(
          "invalid_signed_preflight_capabilities",
        );
      }

      if (
        inspection.ownerOfKeyStatus !==
          "unregistered"
      ) {
        throw new Error(
          "acting_key_already_registered",
        );
      }

      const preflight =
        await signedPreflight(
          inspection,
          manifestPath,
        );

      console.log(
        JSON.stringify(
          signedPreflightResult(
            inspection,
            preflight,
          ),
          null,
          2,
        ),
      );

      return;
    }

    if (
      decision.mode !== "execute" ||
      decision.mayReadPrivateKey !== true ||
      decision.mayReadWallet !== true ||
      decision.mayCreateSigner !== true ||
      decision.maySign !== true ||
      decision.mayConstructTransaction !== true ||
      decision.maySubmitTransaction !== true
    ) {
      throw new Error(
        "invalid_execute_capabilities",
      );
    }

    const result =
      await executeRegistration(
        inspection,
        manifestPath,
      );

    console.log(
      JSON.stringify(
        result,
        null,
        2,
      ),
    );
  } finally {
    closeInspection(inspection);
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        script: SCRIPT_TYPE,
        implementationStage:
          IMPLEMENTATION_STAGE,
        reason: errorReason(error),
        safety: {
          publicInspectionCompleted:
            runtimeState
              .publicInspectionCompleted,
          privateKeyRead:
            runtimeState.privateKeyRead,
          signatureCreated:
            runtimeState.signatureCreated,
          signatureLocallyVerified:
            runtimeState
              .signatureLocallyVerified,
          dryRunCalled:
            runtimeState.dryRunCalled,
          walletRead:
            runtimeState.walletRead,
          signerCreated:
            runtimeState.signerCreated,
          transactionConstructed:
            runtimeState
              .transactionConstructed,
          transactionSubmissionAttempted:
            runtimeState
              .transactionSubmissionAttempted,
          transactionSubmitted:
            runtimeState
              .transactionSubmitted,
          transactionFinalized:
            runtimeState
              .transactionFinalized,
          privateMaterialPrinted: false,
          walletMaterialPrinted: false,
          signaturePrinted: false,
          rawParameterPrinted: false,
          paymentAttempted: false,
          cis8Mutated:
            runtimeState
              .cis8MutationConfirmed,
          cis8004Mutated: false,
          externalReferenceUpdated: false,
          evidenceWritten:
            runtimeState.evidenceWritten,
          databaseMutated: false,
          gatewayRuntimeCalled: false,
          protectedResourceReleased: false,
          settlementAttempted: false,
          receiptIssued: false,
          replayStateMutated: false,
          authorizationDecided: false,
          productionActivation: false,
        },
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
});
