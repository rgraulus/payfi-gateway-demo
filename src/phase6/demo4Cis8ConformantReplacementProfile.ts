import { createHash } from "node:crypto";

export const DEMO4_D4_1B_REPLACEMENT_CORE_TYPE =
  "xcf.demo4.d4-1b.cis8-conformant-replacement-profile-core" as const;
export const DEMO4_D4_1B_REPLACEMENT_CORE_VERSION = "1" as const;
export const DEMO4_D4_1B_CIS8_CANONICAL_DOMAIN =
  "CIS-8/v1/canonical" as const;

export const DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS = Object.freeze({
  normativeProfile: "cis8_draft_2026_05_25",
  normativeStatus: "Draft",
  normativeUrl: "https://proposals.concordium.com/CIS/cis-8.html",
  normativeHtmlSha256:
    "6216474e04464b33de77dd79df8d90d9fe231635aacd4ecf89507e1d2c74546b",
  solanaCaipUrl: "https://namespaces.chainagnostic.org/solana/caip2",
  solanaCaipHtmlSha256:
    "5598020d520135b0b1d84ad89833785eb7f425b40620941e02d29b69165a12ad",
  solanaDevnetRpc: "https://api.devnet.solana.com",
  solanaDevnetGenesisHash:
    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  solanaDevnetCaip2:
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  observedOn: "2026-08-03",
  requiresGate3DriftCheck: true,
} as const);

export const DEMO4_D4_1B_REPLACEMENT_PROFILE = Object.freeze({
  profileId:
    "xcf.demo4.d4-1b.cis8.solana-devnet.conformant-replacement.v1",
  externalBlockchain: "solana",
  externalNetwork: "devnet",
  externalNamespace:
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetCaip2,
  externalKeyNamespace:
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetCaip2,
  externalKeyType: "ed25519",
  publicKeyByteLength: 32,
  proofScheme: "solana-ed25519",
  signatureByteLength: 64,
  metadataCount: 0,
  concordiumNetwork: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  contract: Object.freeze({
    index: "12801",
    subindex: "0",
  }),
  contractName: "CIS-8",
  moduleReference:
    "5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da",
  registerEntrypoint: "registerExternalKey",
  ownerOfKeyEntrypoint: "ownerOfKey",
  ownerAccount: "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  canonicalDomain: DEMO4_D4_1B_CIS8_CANONICAL_DOMAIN,
  canonicalStringLengthBytes: 2,
  canonicalBytestringLengthBytes: 2,
  canonicalIntegerEndianness: "little",
  cis8004TokenId: "287",
  cis8004MutationAllowed: false,
  d4_1cAttachmentAllowed: false,
  historicalRegistrationRetained: true,
  oldRegistrationCanonical: false,
  replacementKeyStatus: "not_generated_gate1",
  actualParameterStatus:
    "pending_gate3_key_and_signature",
} as const);

export const DEMO4_D4_1B_REPLACEMENT_FLEXIBILITY_POLICY = Object.freeze({
  versionedNormativeAdapter: true,
  versionedParameterCodec: true,
  versionedCanonicalBuilder: true,
  versionedProofAdapter: true,
  versionedContractCompatibilityAdapter: true,
  runtimeProfileOverridesAllowed: false,
  failClosedOnNormativeSourceDrift: true,
  failClosedOnCaipSourceDrift: true,
  failClosedOnGenesisDrift: true,
  failClosedOnContractSchemaDrift: true,
  renewedGate1ReviewRequiredForMaterialChange: true,
  renewedGate2VectorsRequiredForMaterialChange: true,
  renewedGate3PreflightRequiredForMaterialChange: true,
} as const);

export const DEMO4_D4_1B_REPLACEMENT_CORE_SAFETY = Object.freeze({
  sideEffectFree: true,
  environmentRead: false,
  filesystemRead: false,
  filesystemWrite: false,
  networkCalled: false,
  privateKeyRead: false,
  walletRead: false,
  keyGenerated: false,
  signingAttempted: false,
  signerCreated: false,
  contractInvoked: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  cis8Mutated: false,
  cis8004Mutated: false,
  externalReferenceUpdated: false,
  gatewayRuntimeCalled: false,
  paymentAttempted: false,
  settlementAttempted: false,
  receiptIssued: false,
  protectedResourceReleased: false,
  replayStateMutated: false,
  productionActivation: false,
} as const);

export const DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR = Object.freeze({
  ownerAccountBytesHex:
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  concordiumGenesisHashBytesHex:
    "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f",
  publicKeyBytesHex:
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  signatureBytesHex:
    "202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f" +
    "404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f",
  canonicalMessageByteLength: 239,
  canonicalMessageSha256:
    "cfed230d434a028f043d30423d94b92339ddb0094085d118a3d5941c9316f23a",
  registrationParameterByteLength: 168,
  registrationParameterSha256:
    "547be748447fd7d34fed085fa7815a1f3125184caf5d331a45abdcc47d28e13f",
} as const);

type UnknownRecord = Record<string, unknown>;

export type Demo4D41bReplacementFailureCodeV1 =
  | "invalid_source_pin_shape"
  | "normative_source_drift"
  | "solana_caip_source_drift"
  | "solana_rpc_drift"
  | "solana_genesis_drift"
  | "solana_caip2_drift"
  | "invalid_profile_shape"
  | "profile_mismatch"
  | "invalid_account_bytes"
  | "invalid_genesis_hash"
  | "invalid_contract_coordinate"
  | "invalid_public_key"
  | "invalid_signature"
  | "serialization_length_exceeded"
  | "serialization_failed";

export type Demo4D41bReplacementFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason: Demo4D41bReplacementFailureCodeV1;
};

export type Demo4D41bReplacementSuccessV1<T> = {
  readonly ok: true;
  readonly status: "accepted";
  readonly reason: "accepted";
  readonly value: T;
};

export type Demo4D41bReplacementResultV1<T> =
  | Demo4D41bReplacementSuccessV1<T>
  | Demo4D41bReplacementFailureV1;

export type Demo4D41bReplacementCanonicalMessageV1 = {
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly hex: string;
  readonly sha256: string;
};

export type Demo4D41bReplacementRegistrationParameterV1 = {
  readonly external_key: {
    readonly namespace: typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace;
    readonly key_type: typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyType;
    readonly public_key: readonly number[];
  };
  readonly proof: {
    readonly scheme: typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.proofScheme;
    readonly signature: readonly number[];
  };
  readonly metadata: readonly [];
};

export type Demo4D41bReplacementExpectedParameterContractV1 = {
  readonly parameter: Demo4D41bReplacementRegistrationParameterV1;
  readonly serializedBytes: Uint8Array;
  readonly serializedHex: string;
  readonly byteLength: number;
  readonly sha256: string;
};

function accepted<T>(value: T): Demo4D41bReplacementSuccessV1<T> {
  return {
    ok: true,
    status: "accepted",
    reason: "accepted",
    value,
  };
}

function rejected(
  reason: Demo4D41bReplacementFailureCodeV1,
): Demo4D41bReplacementFailureV1 {
  return {
    ok: false,
    status: "rejected",
    reason,
  };
}

function asRecord(value: unknown): UnknownRecord | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }
  return value as UnknownRecord;
}

function exactBytes(value: unknown, expectedLength: number): Uint8Array | null {
  if (!(value instanceof Uint8Array) || value.length !== expectedLength) {
    return null;
  }
  return Uint8Array.from(value);
}

function sha256Hex(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function encodeU16Length(value: number): Buffer | null {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff) {
    return null;
  }
  const encoded = Buffer.alloc(2);
  encoded.writeUInt16LE(value, 0);
  return encoded;
}

function encodeString(value: string): Buffer | null {
  const bytes = Buffer.from(value, "utf8");
  const length = encodeU16Length(bytes.length);
  if (length === null) {
    return null;
  }
  return Buffer.concat([length, bytes]);
}

function encodeBytes(value: Uint8Array): Buffer | null {
  const length = encodeU16Length(value.length);
  if (length === null) {
    return null;
  }
  return Buffer.concat([length, Buffer.from(value)]);
}

function encodeU64Le(value: string): Buffer | null {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    return null;
  }
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > 0xffffffffffffffffn) {
    return null;
  }
  const encoded = Buffer.alloc(8);
  encoded.writeBigUInt64LE(parsed, 0);
  return encoded;
}

function serializeFrozenExternalKey(
  publicKeyBytes: Uint8Array,
): Buffer | null {
  const namespace = encodeString(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace,
  );
  const keyType = encodeString(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyType,
  );
  const publicKey = encodeBytes(publicKeyBytes);

  if (namespace === null || keyType === null || publicKey === null) {
    return null;
  }

  return Buffer.concat([namespace, keyType, publicKey]);
}

export function validateDemo4D41bReplacementSourcePinsV1(
  value: unknown,
): Demo4D41bReplacementResultV1<
  typeof DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS
> {
  const record = asRecord(value);
  if (record === null) {
    return rejected("invalid_source_pin_shape");
  }
  if (
    record.normativeProfile !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeProfile ||
    record.normativeStatus !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeStatus ||
    record.normativeUrl !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeUrl ||
    record.normativeHtmlSha256 !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.normativeHtmlSha256
  ) {
    return rejected("normative_source_drift");
  }
  if (
    record.solanaCaipUrl !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaCaipUrl ||
    record.solanaCaipHtmlSha256 !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaCaipHtmlSha256
  ) {
    return rejected("solana_caip_source_drift");
  }
  if (
    record.solanaDevnetRpc !==
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetRpc
  ) {
    return rejected("solana_rpc_drift");
  }
  if (
    record.solanaDevnetGenesisHash !==
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetGenesisHash
  ) {
    return rejected("solana_genesis_drift");
  }
  if (
    record.solanaDevnetCaip2 !==
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.solanaDevnetCaip2
  ) {
    return rejected("solana_caip2_drift");
  }
  if (
    record.observedOn !==
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS.observedOn ||
    record.requiresGate3DriftCheck !== true
  ) {
    return rejected("invalid_source_pin_shape");
  }
  return accepted(DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS);
}

export function validateDemo4D41bReplacementProfileV1(
  value: unknown,
): Demo4D41bReplacementResultV1<
  typeof DEMO4_D4_1B_REPLACEMENT_PROFILE
> {
  const record = asRecord(value);
  if (record === null) {
    return rejected("invalid_profile_shape");
  }

  const contract = asRecord(record.contract);
  if (contract === null) {
    return rejected("invalid_profile_shape");
  }

  const expected = DEMO4_D4_1B_REPLACEMENT_PROFILE;
  const matches =
    record.profileId === expected.profileId &&
    record.externalBlockchain === expected.externalBlockchain &&
    record.externalNetwork === expected.externalNetwork &&
    record.externalNamespace === expected.externalNamespace &&
    record.externalKeyNamespace === expected.externalKeyNamespace &&
    record.externalKeyType === expected.externalKeyType &&
    record.publicKeyByteLength === expected.publicKeyByteLength &&
    record.proofScheme === expected.proofScheme &&
    record.signatureByteLength === expected.signatureByteLength &&
    record.metadataCount === expected.metadataCount &&
    record.concordiumNetwork === expected.concordiumNetwork &&
    contract.index === expected.contract.index &&
    contract.subindex === expected.contract.subindex &&
    record.contractName === expected.contractName &&
    record.moduleReference === expected.moduleReference &&
    record.registerEntrypoint === expected.registerEntrypoint &&
    record.ownerOfKeyEntrypoint === expected.ownerOfKeyEntrypoint &&
    record.ownerAccount === expected.ownerAccount &&
    record.canonicalDomain === expected.canonicalDomain &&
    record.canonicalStringLengthBytes === expected.canonicalStringLengthBytes &&
    record.canonicalBytestringLengthBytes ===
      expected.canonicalBytestringLengthBytes &&
    record.canonicalIntegerEndianness ===
      expected.canonicalIntegerEndianness &&
    record.cis8004TokenId === expected.cis8004TokenId &&
    record.cis8004MutationAllowed === false &&
    record.d4_1cAttachmentAllowed === false &&
    record.historicalRegistrationRetained === true &&
    record.oldRegistrationCanonical === false &&
    record.replacementKeyStatus === expected.replacementKeyStatus &&
    record.actualParameterStatus === expected.actualParameterStatus;

  if (!matches) {
    return rejected("profile_mismatch");
  }

  return accepted(DEMO4_D4_1B_REPLACEMENT_PROFILE);
}

export function buildDemo4D41bReplacementCanonicalMessageV1(input: {
  readonly concordiumAccountBytes: Uint8Array;
  readonly concordiumGenesisHashBytes: Uint8Array;
  readonly publicKeyBytes: Uint8Array;
}): Demo4D41bReplacementResultV1<
  Demo4D41bReplacementCanonicalMessageV1
> {
  const owner = exactBytes(input.concordiumAccountBytes, 32);
  if (owner === null) {
    return rejected("invalid_account_bytes");
  }
  const genesis = exactBytes(input.concordiumGenesisHashBytes, 32);
  if (genesis === null) {
    return rejected("invalid_genesis_hash");
  }
  const publicKey = exactBytes(
    input.publicKeyBytes,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.publicKeyByteLength,
  );
  if (publicKey === null) {
    return rejected("invalid_public_key");
  }

  const contractIndex = encodeU64Le(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.contract.index,
  );
  const contractSubindex = encodeU64Le(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.contract.subindex,
  );
  if (contractIndex === null || contractSubindex === null) {
    return rejected("invalid_contract_coordinate");
  }

  const externalNamespace = encodeString(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.externalNamespace,
  );
  const externalKey = serializeFrozenExternalKey(publicKey);
  const proofScheme = encodeString(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.proofScheme,
  );
  if (
    externalNamespace === null ||
    externalKey === null ||
    proofScheme === null
  ) {
    return rejected("serialization_length_exceeded");
  }

  const domain = Buffer.from(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.canonicalDomain,
    "ascii",
  );
  if (domain.length !== 18) {
    return rejected("serialization_failed");
  }

  const bytes = Buffer.concat([
    domain,
    Buffer.from(owner),
    contractIndex,
    contractSubindex,
    Buffer.from(genesis),
    externalNamespace,
    externalKey,
    proofScheme,
  ]);

  return accepted({
    bytes: Uint8Array.from(bytes),
    byteLength: bytes.length,
    hex: bytes.toString("hex"),
    sha256: sha256Hex(bytes),
  });
}

export function buildDemo4D41bReplacementExpectedParameterContractV1(
  input: {
    readonly publicKeyBytes: Uint8Array;
    readonly signatureBytes: Uint8Array;
  },
): Demo4D41bReplacementResultV1<
  Demo4D41bReplacementExpectedParameterContractV1
> {
  const publicKey = exactBytes(
    input.publicKeyBytes,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.publicKeyByteLength,
  );
  if (publicKey === null) {
    return rejected("invalid_public_key");
  }
  const signature = exactBytes(
    input.signatureBytes,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.signatureByteLength,
  );
  if (signature === null) {
    return rejected("invalid_signature");
  }

  const externalKey = serializeFrozenExternalKey(publicKey);
  const proofScheme = encodeString(
    DEMO4_D4_1B_REPLACEMENT_PROFILE.proofScheme,
  );
  const encodedSignature = encodeBytes(signature);
  const metadataCount = encodeU16Length(0);
  if (
    externalKey === null ||
    proofScheme === null ||
    encodedSignature === null ||
    metadataCount === null
  ) {
    return rejected("serialization_length_exceeded");
  }

  const serialized = Buffer.concat([
    externalKey,
    proofScheme,
    encodedSignature,
    metadataCount,
  ]);

  const parameter: Demo4D41bReplacementRegistrationParameterV1 = {
    external_key: {
      namespace:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace,
      key_type:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyType,
      public_key: Object.freeze(Array.from(publicKey)),
    },
    proof: {
      scheme: DEMO4_D4_1B_REPLACEMENT_PROFILE.proofScheme,
      signature: Object.freeze(Array.from(signature)),
    },
    metadata: Object.freeze([] as const),
  };

  return accepted({
    parameter,
    serializedBytes: Uint8Array.from(serialized),
    serializedHex: serialized.toString("hex"),
    byteLength: serialized.length,
    sha256: sha256Hex(serialized),
  });
}

export function buildDemo4D41bReplacementOwnerOfKeyParameterV1(
  publicKeyValue: Uint8Array,
): Demo4D41bReplacementResultV1<{
  readonly external_key: {
    readonly namespace: typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace;
    readonly key_type: typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyType;
    readonly public_key: readonly number[];
  };
}> {
  const publicKey = exactBytes(
    publicKeyValue,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.publicKeyByteLength,
  );
  if (publicKey === null) {
    return rejected("invalid_public_key");
  }

  return accepted({
    external_key: {
      namespace:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace,
      key_type:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyType,
      public_key: Object.freeze(Array.from(publicKey)),
    },
  });
}
