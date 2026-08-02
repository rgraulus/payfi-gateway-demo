/**
 * Demo4 D4-1B — side-effect-free CIS-8 acting-key registration core.
 *
 * This module contains only deterministic validation, canonical-message
 * construction, parameter shaping, finalized-result validation, and sanitized
 * evidence hashing. It performs no filesystem, environment, network, wallet,
 * signing, transaction, payment, persistence, Gateway, release, settlement,
 * receipt, replay, authorization, or production-activation work.
 */

import { createHash } from "node:crypto";

import {
  PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
  normalizePhase6ConcordiumTestnetNetworkV1,
} from "./concordiumNetworkNormalization";

export const DEMO4_D4_1B_CORE_TYPE =
  "xcf.demo4.d4-1b.cis8-acting-key-registration-core" as const;

export const DEMO4_D4_1B_CORE_VERSION = "1" as const;
export const DEMO4_D4_1B_CANONICAL_DOMAIN = "CIS-8/v1/canonical" as const;

export const DEMO4_D4_1B_MODES = [
  "inspect",
  "signed_preflight",
  "execute",
] as const;

export type Demo4D41bModeV1 = (typeof DEMO4_D4_1B_MODES)[number];

export const DEMO4_D4_1B_PROFILE = Object.freeze({
  network: PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
  grpc: Object.freeze({
    host: "grpc.testnet.concordium.com",
    port: 20_000,
    tls: true,
  }),
  contract: Object.freeze({
    index: "12801",
    subindex: "0",
  }),
  contractName: "CIS-8",
  moduleReference:
    "5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da",
  schemaVersion: 3,
  registerEntrypoint: "registerExternalKey",
  ownerOfKeyEntrypoint: "ownerOfKey",
  ownerAccount: "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  agentId: "agent:xcf:demo4:registered",
  agentKeyId: "agent-key:xcf:demo4:registered:ed25519-1",
  keyBundleContract: "phase5.demoCryptographicKeyBundle.v1",
  keyBundleMode: "controlled_cryptographic_demo2",
  externalNamespace: "xcf:phase5",
  externalKeyNamespace: "xcf:phase5",
  externalKeyType: "ed25519",
  proofScheme: "fetch-ai-ed25519",
  eventTag: 231,
  eventName: "ExternalKeyRegistered",
  staticFixturePublicKeyBase64Url:
    "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
} as const);

export const DEMO4_D4_1B_CORE_SAFETY = Object.freeze({
  sideEffectFree: true,
  environmentRead: false,
  filesystemRead: false,
  filesystemWrite: false,
  networkCalled: false,
  privateKeyRead: false,
  walletRead: false,
  signingAttempted: false,
  signerCreated: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  paymentAttempted: false,
  cis8004Mutated: false,
  externalReferenceUpdated: false,
  databaseMutated: false,
  gatewayRuntimeActivated: false,
  protectedResourceReleased: false,
  settlementAttempted: false,
  receiptIssued: false,
  replayStateMutated: false,
  authorizationDecided: false,
  productionActivation: false,
} as const);

type UnknownRecord = Record<string, unknown>;

type FailureCode =
  | "invalid_mode"
  | "invalid_boolean_literal"
  | "testnet_only_gate_required"
  | "private_key_gate_forbidden"
  | "private_key_gate_required"
  | "wallet_gate_forbidden"
  | "wallet_gate_required"
  | "execution_gate_forbidden"
  | "execution_gate_required"
  | "invalid_manifest"
  | "wrong_agent_id"
  | "wrong_agent_key_id"
  | "invalid_public_jwk"
  | "private_jwk_material_present"
  | "wrong_public_key_id"
  | "malformed_ed25519_key"
  | "static_fixture_key_forbidden"
  | "invalid_private_key_reference"
  | "invalid_network"
  | "wrong_contract"
  | "wrong_module"
  | "wrong_contract_name"
  | "wrong_schema_version"
  | "wrong_owner"
  | "wrong_grpc_endpoint"
  | "tls_required"
  | "missing_register_entrypoint"
  | "missing_ownerofkey_entrypoint"
  | "missing_event_schema"
  | "invalid_account_bytes"
  | "invalid_contract_coordinate"
  | "invalid_genesis_hash"
  | "invalid_external_namespace"
  | "invalid_external_key_namespace"
  | "invalid_external_key_type"
  | "invalid_proof_scheme"
  | "invalid_signature"
  | "invalid_canonical_input"
  | "wrong_event_contract"
  | "wrong_event_tag"
  | "wrong_event_variant"
  | "invalid_event_shape"
  | "wrong_event_owner"
  | "wrong_event_external_key"
  | "wrong_event_proof_scheme"
  | "wrong_event_metadata"
  | "ownerofkey_not_registered"
  | "invalid_ownerofkey_shape"
  | "wrong_ownerofkey_owner"
  | "invalid_evidence"
  | "forbidden_evidence_material"
  | "evidence_serialization_failed";

export type Demo4D41bFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason: FailureCode;
};

export type Demo4D41bSuccessV1<T> = {
  readonly ok: true;
  readonly status: "accepted";
  readonly reason: "accepted";
  readonly value: T;
};

export type Demo4D41bResultV1<T> =
  | Demo4D41bSuccessV1<T>
  | Demo4D41bFailureV1;

export type Demo4D41bActivationDecisionV1 = {
  readonly mode: Demo4D41bModeV1;
  readonly testnetOnly: true;
  readonly mayReadPrivateKey: boolean;
  readonly mayReadWallet: boolean;
  readonly mayCreateSigner: boolean;
  readonly maySign: boolean;
  readonly mayConstructTransaction: boolean;
  readonly maySubmitTransaction: boolean;
};

export type Demo4D41bValidatedPublicKeyV1 = {
  readonly jwk: {
    readonly kty: "OKP";
    readonly crv: "Ed25519";
    readonly x: string;
    readonly kid: string;
  };
  readonly bytes: Uint8Array;
  readonly base64Url: string;
  readonly hex: string;
  readonly fingerprint: string;
};

export type Demo4D41bValidatedKeyBundleV1 = {
  readonly contract: typeof DEMO4_D4_1B_PROFILE.keyBundleContract;
  readonly mode: typeof DEMO4_D4_1B_PROFILE.keyBundleMode;
  readonly agentId: typeof DEMO4_D4_1B_PROFILE.agentId;
  readonly agentKeyId: typeof DEMO4_D4_1B_PROFILE.agentKeyId;
  readonly privateKeyFile: string;
  readonly publicKey: Demo4D41bValidatedPublicKeyV1;
};

export type Demo4D41bCanonicalMessageInputV1 = {
  readonly ownerAccountBytes: Uint8Array;
  readonly contractIndex: string | number | bigint;
  readonly contractSubindex: string | number | bigint;
  readonly genesisHashBytes: Uint8Array;
  readonly externalNamespace: string;
  readonly externalKeyNamespace: string;
  readonly externalKeyType: string;
  readonly publicKeyBytes: Uint8Array;
  readonly proofScheme: string;
};

export type Demo4D41bCanonicalMessageV1 = {
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly hex: string;
  readonly sha256: string;
};

export type Demo4D41bRegistrationParameterV1 = {
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
};

export type Demo4D41bOwnerOfKeyParameterV1 = {
  readonly external_key: {
    readonly namespace: string;
    readonly key_type: string;
    readonly public_key: readonly number[];
  };
};

export type Demo4D41bTrustAnchorInputV1 = {
  readonly network: unknown;
  readonly contractIndex: unknown;
  readonly contractSubindex: unknown;
  readonly moduleReference: unknown;
  readonly contractName: unknown;
  readonly schemaVersion: unknown;
  readonly ownerAccount: unknown;
  readonly grpcHost: unknown;
  readonly grpcPort: unknown;
  readonly grpcTls: unknown;
  readonly entrypoints: readonly unknown[] | null;
  readonly eventSchemaPresent: unknown;
};

export type Demo4D41bValidatedEventV1 = {
  readonly owner: typeof DEMO4_D4_1B_PROFILE.ownerAccount;
  readonly publicKeyBase64Url: string;
  readonly publicKeyHex: string;
  readonly proofScheme: typeof DEMO4_D4_1B_PROFILE.proofScheme;
  readonly metadata: readonly never[];
};

const MAX_U16 = 0xffff;
const MAX_U32 = 0xffff_ffff;
const MAX_U64 = (1n << 64n) - 1n;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const HEX_32_PATTERN = /^[0-9a-f]{64}$/;

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  "d",
  "privatejwk",
  "privatekey",
  "privatekeyfile",
  "privatekeypath",
  "privatepem",
  "rawsignature",
  "signature",
  "wallet",
  "walletpath",
  "walletexport",
  "seed",
  "mnemonic",
  "secret",
  "secrets",
  "credential",
  "credentials",
  "processevironment",
  "processenv",
  "environmentvariables",
  "rawparameter",
  "rawregistrationparameter",
]);

function success<T>(value: T): Demo4D41bSuccessV1<T> {
  return { ok: true, status: "accepted", reason: "accepted", value };
}

function failure(reason: FailureCode): Demo4D41bFailureV1 {
  return { ok: false, status: "rejected", reason };
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function nonEmptyString(value: unknown, maxLength = 512): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }
  return value;
}

function exactBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }
  if (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "number" &&
        Number.isInteger(entry) &&
        entry >= 0 &&
        entry <= 255,
    )
  ) {
    return Uint8Array.from(value);
  }
  return null;
}

function canonicalBase64UrlBytes(value: unknown): Uint8Array | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return null;
  }
  try {
    const bytes = Buffer.from(value, "base64url");
    return bytes.length > 0 && bytes.toString("base64url") === value
      ? Uint8Array.from(bytes)
      : null;
  } catch {
    return null;
  }
}

function canonicalBigIntBytes(
  value: unknown,
): Uint8Array | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const bytes: number[] = [];

  for (const entry of value) {
    if (
      typeof entry !== "bigint" ||
      entry < 0n ||
      entry > 255n
    ) {
      return null;
    }

    bytes.push(Number(entry));
  }

  return Uint8Array.from(bytes);
}

function publicKeyBytes(value: unknown): Uint8Array | null {
  const direct = exactBytes(value);
  if (direct !== null) {
    return direct;
  }

  const decodedBigInts =
    canonicalBigIntBytes(value);

  if (decodedBigInts !== null) {
    return decodedBigInts;
  }

  if (typeof value !== "string") {
    return null;
  }
  if (HEX_32_PATTERN.test(value)) {
    return Uint8Array.from(Buffer.from(value, "hex"));
  }
  return canonicalBase64UrlBytes(value);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function literalBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function parseMode(value: unknown): Demo4D41bModeV1 | null {
  if (value === undefined) {
    return "inspect";
  }
  return typeof value === "string" &&
    (DEMO4_D4_1B_MODES as readonly string[]).includes(value)
    ? (value as Demo4D41bModeV1)
    : null;
}

export function validateDemo4D41bActivationV1(input: {
  readonly mode?: unknown;
  readonly testnetOnly?: unknown;
  readonly privateKeyReadEnabled?: unknown;
  readonly walletReadEnabled?: unknown;
  readonly executionEnabled?: unknown;
}): Demo4D41bResultV1<Demo4D41bActivationDecisionV1> {
  const mode = parseMode(input.mode);
  if (mode === null) {
    return failure("invalid_mode");
  }

  const testnetOnly = literalBoolean(input.testnetOnly);
  const privateKeyRead = literalBoolean(input.privateKeyReadEnabled);
  const walletRead = literalBoolean(input.walletReadEnabled);
  const execution = literalBoolean(input.executionEnabled);

  if (
    testnetOnly === null ||
    privateKeyRead === null ||
    walletRead === null ||
    execution === null
  ) {
    return failure("invalid_boolean_literal");
  }
  if (testnetOnly !== true) {
    return failure("testnet_only_gate_required");
  }

  if (mode === "inspect") {
    if (privateKeyRead === true) return failure("private_key_gate_forbidden");
    if (walletRead === true) return failure("wallet_gate_forbidden");
    if (execution === true) return failure("execution_gate_forbidden");
    return success({
      mode,
      testnetOnly: true,
      mayReadPrivateKey: false,
      mayReadWallet: false,
      mayCreateSigner: false,
      maySign: false,
      mayConstructTransaction: false,
      maySubmitTransaction: false,
    });
  }

  if (privateKeyRead !== true) {
    return failure("private_key_gate_required");
  }

  if (mode === "signed_preflight") {
    if (walletRead === true) return failure("wallet_gate_forbidden");
    if (execution === true) return failure("execution_gate_forbidden");
    return success({
      mode,
      testnetOnly: true,
      mayReadPrivateKey: true,
      mayReadWallet: false,
      mayCreateSigner: false,
      maySign: true,
      mayConstructTransaction: false,
      maySubmitTransaction: false,
    });
  }

  if (walletRead !== true) {
    return failure("wallet_gate_required");
  }
  if (execution !== true) {
    return failure("execution_gate_required");
  }
  return success({
    mode,
    testnetOnly: true,
    mayReadPrivateKey: true,
    mayReadWallet: true,
    mayCreateSigner: true,
    maySign: true,
    mayConstructTransaction: true,
    maySubmitTransaction: true,
  });
}

export function validateDemo4D41bPublicJwkV1(
  value: unknown,
  expectedKeyId = DEMO4_D4_1B_PROFILE.agentKeyId,
): Demo4D41bResultV1<Demo4D41bValidatedPublicKeyV1> {
  const record = asRecord(value);
  if (record === null) {
    return failure("invalid_public_jwk");
  }
  if (hasOwn(record, "d")) {
    return failure("private_jwk_material_present");
  }
  if (record.kty !== "OKP" || record.crv !== "Ed25519") {
    return failure("invalid_public_jwk");
  }
  if (record.kid !== expectedKeyId) {
    return failure("wrong_public_key_id");
  }

  const bytes = canonicalBase64UrlBytes(record.x);
  if (bytes === null || bytes.length !== 32) {
    return failure("malformed_ed25519_key");
  }
  const base64Url = Buffer.from(bytes).toString("base64url");
  if (base64Url === DEMO4_D4_1B_PROFILE.staticFixturePublicKeyBase64Url) {
    return failure("static_fixture_key_forbidden");
  }
  const hex = Buffer.from(bytes).toString("hex");
  const fingerprint = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

  return success({
    jwk: { kty: "OKP", crv: "Ed25519", x: base64Url, kid: expectedKeyId },
    bytes,
    base64Url,
    hex,
    fingerprint,
  });
}

export function validateDemo4D41bKeyBundleManifestV1(
  value: unknown,
): Demo4D41bResultV1<Demo4D41bValidatedKeyBundleV1> {
  const root = asRecord(value);
  const agent = root === null ? null : asRecord(root.agent);
  if (root === null || agent === null) {
    return failure("invalid_manifest");
  }
  if (
    root.contract !== DEMO4_D4_1B_PROFILE.keyBundleContract ||
    root.mode !== DEMO4_D4_1B_PROFILE.keyBundleMode ||
    root.privateMaterialTemporary !== true ||
    root.privateMaterialPrinted !== false ||
    root.gatewayCalled !== false ||
    root.crpCalled !== false ||
    root.paymentAttempted !== false ||
    root.protectedResourceReleased !== false ||
    root.agentRegistryLookupAttempted !== false ||
    root.productionActivation !== false
  ) {
    return failure("invalid_manifest");
  }
  if (agent.agentId !== DEMO4_D4_1B_PROFILE.agentId) {
    return failure("wrong_agent_id");
  }
  if (agent.agentKeyId !== DEMO4_D4_1B_PROFILE.agentKeyId) {
    return failure("wrong_agent_key_id");
  }

  const publicKey = validateDemo4D41bPublicJwkV1(agent.publicKeyJwk);
  if (!publicKey.ok) {
    return publicKey;
  }
  const privateKeyFile = nonEmptyString(agent.privateKeyFile, 260);
  if (privateKeyFile === null) {
    return failure("invalid_private_key_reference");
  }

  return success({
    contract: DEMO4_D4_1B_PROFILE.keyBundleContract,
    mode: DEMO4_D4_1B_PROFILE.keyBundleMode,
    agentId: DEMO4_D4_1B_PROFILE.agentId,
    agentKeyId: DEMO4_D4_1B_PROFILE.agentKeyId,
    privateKeyFile,
    publicKey: publicKey.value,
  });
}

function normalizedNetwork(value: unknown): string | null {
  const result: unknown = normalizePhase6ConcordiumTestnetNetworkV1(value);
  if (typeof result === "string") {
    return result;
  }
  const record = asRecord(result);
  if (record === null || record.ok !== true) {
    return null;
  }
  for (const key of ["canonicalNetwork", "network", "value"]) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }
  return null;
}

function decimalU64(value: unknown): string | null {
  try {
    let parsed: bigint;
    if (typeof value === "bigint") {
      parsed = value;
    } else if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || value < 0) return null;
      parsed = BigInt(value);
    } else if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
      parsed = BigInt(value);
    } else {
      return null;
    }
    return parsed >= 0n && parsed <= MAX_U64 ? parsed.toString(10) : null;
  } catch {
    return null;
  }
}

export function validateDemo4D41bTrustAnchorsV1(
  input: Demo4D41bTrustAnchorInputV1,
): Demo4D41bResultV1<typeof DEMO4_D4_1B_PROFILE> {
  if (normalizedNetwork(input.network) !== DEMO4_D4_1B_PROFILE.network) {
    return failure("invalid_network");
  }
  if (
    decimalU64(input.contractIndex) !== DEMO4_D4_1B_PROFILE.contract.index ||
    decimalU64(input.contractSubindex) !== DEMO4_D4_1B_PROFILE.contract.subindex
  ) {
    return failure("wrong_contract");
  }
  if (input.moduleReference !== DEMO4_D4_1B_PROFILE.moduleReference) {
    return failure("wrong_module");
  }
  if (input.contractName !== DEMO4_D4_1B_PROFILE.contractName) {
    return failure("wrong_contract_name");
  }
  if (input.schemaVersion !== DEMO4_D4_1B_PROFILE.schemaVersion) {
    return failure("wrong_schema_version");
  }
  if (input.ownerAccount !== DEMO4_D4_1B_PROFILE.ownerAccount) {
    return failure("wrong_owner");
  }
  if (
    input.grpcHost !== DEMO4_D4_1B_PROFILE.grpc.host ||
    input.grpcPort !== DEMO4_D4_1B_PROFILE.grpc.port
  ) {
    return failure("wrong_grpc_endpoint");
  }
  if (input.grpcTls !== true) {
    return failure("tls_required");
  }
  if (
    input.entrypoints === null ||
    !input.entrypoints.includes(DEMO4_D4_1B_PROFILE.registerEntrypoint)
  ) {
    return failure("missing_register_entrypoint");
  }
  if (!input.entrypoints.includes(DEMO4_D4_1B_PROFILE.ownerOfKeyEntrypoint)) {
    return failure("missing_ownerofkey_entrypoint");
  }
  if (input.eventSchemaPresent !== true) {
    return failure("missing_event_schema");
  }
  return success(DEMO4_D4_1B_PROFILE);
}

function encodeU64Le(value: string | number | bigint): Buffer | null {
  const decimal = decimalU64(value);
  if (decimal === null) {
    return null;
  }
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(decimal), 0);
  return buffer;
}

function encodeU16LengthPrefixedBytes(value: Uint8Array): Buffer | null {
  if (value.length > MAX_U16) {
    return null;
  }
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16LE(value.length, 0);
  return Buffer.concat([prefix, Buffer.from(value)]);
}

function encodeU32LengthPrefixedBytes(value: Uint8Array): Buffer | null {
  if (value.length > MAX_U32) {
    return null;
  }
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(value.length, 0);
  return Buffer.concat([prefix, Buffer.from(value)]);
}

function encodeLengthPrefixedString(value: string): Buffer | null {
  return encodeU32LengthPrefixedBytes(Buffer.from(value, "utf8"));
}

function validFreshPublicKey(value: Uint8Array): boolean {
  return (
    value.length === 32 &&
    Buffer.from(value).toString("base64url") !==
      DEMO4_D4_1B_PROFILE.staticFixturePublicKeyBase64Url
  );
}

export function buildDemo4D41bCanonicalMessageV1(
  input: Demo4D41bCanonicalMessageInputV1,
): Demo4D41bResultV1<Demo4D41bCanonicalMessageV1> {
  const owner = exactBytes(input.ownerAccountBytes);
  if (owner === null || owner.length !== 32) {
    return failure("invalid_account_bytes");
  }
  const contractIndex = encodeU64Le(input.contractIndex);
  const contractSubindex = encodeU64Le(input.contractSubindex);
  if (contractIndex === null || contractSubindex === null) {
    return failure("invalid_contract_coordinate");
  }
  const genesis = exactBytes(input.genesisHashBytes);
  if (genesis === null || genesis.length !== 32) {
    return failure("invalid_genesis_hash");
  }
  if (input.externalNamespace !== DEMO4_D4_1B_PROFILE.externalNamespace) {
    return failure("invalid_external_namespace");
  }
  if (input.externalKeyNamespace !== DEMO4_D4_1B_PROFILE.externalKeyNamespace) {
    return failure("invalid_external_key_namespace");
  }
  if (input.externalKeyType !== DEMO4_D4_1B_PROFILE.externalKeyType) {
    return failure("invalid_external_key_type");
  }
  const key = exactBytes(input.publicKeyBytes);
  if (key === null || !validFreshPublicKey(key)) {
    return failure("malformed_ed25519_key");
  }
  if (input.proofScheme !== DEMO4_D4_1B_PROFILE.proofScheme) {
    return failure("invalid_proof_scheme");
  }

  const externalNamespace = encodeLengthPrefixedString(input.externalNamespace);
  const keyNamespace = encodeLengthPrefixedString(input.externalKeyNamespace);
  const keyType = encodeLengthPrefixedString(input.externalKeyType);
  const publicKey = encodeU32LengthPrefixedBytes(key);
  const proofScheme = encodeLengthPrefixedString(input.proofScheme);
  if (
    externalNamespace === null ||
    keyNamespace === null ||
    keyType === null ||
    publicKey === null ||
    proofScheme === null
  ) {
    return failure("invalid_canonical_input");
  }

  const domain = Buffer.from(DEMO4_D4_1B_CANONICAL_DOMAIN, "ascii");
  if (domain.length !== 18) {
    return failure("invalid_canonical_input");
  }
  const bytes = Buffer.concat([
    domain,
    Buffer.from(owner),
    contractIndex,
    contractSubindex,
    Buffer.from(genesis),
    externalNamespace,
    keyNamespace,
    keyType,
    publicKey,
    proofScheme,
  ]);

  return success({
    bytes: Uint8Array.from(bytes),
    byteLength: bytes.length,
    hex: bytes.toString("hex"),
    sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  });
}

export function buildDemo4D41bRegistrationParameterV1(
  publicKeyValue: Uint8Array,
  signatureValue: Uint8Array,
): Demo4D41bResultV1<Demo4D41bRegistrationParameterV1> {
  const key = exactBytes(publicKeyValue);
  if (key === null || !validFreshPublicKey(key)) {
    return failure("malformed_ed25519_key");
  }
  const signature = exactBytes(signatureValue);
  if (signature === null || signature.length !== 64) {
    return failure("invalid_signature");
  }
  return success({
    external_key: {
      namespace: DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      key_type: DEMO4_D4_1B_PROFILE.externalKeyType,
      public_key: Object.freeze(Array.from(key)),
    },
    proof: {
      scheme: DEMO4_D4_1B_PROFILE.proofScheme,
      signature: Object.freeze(Array.from(signature)),
    },
    metadata: Object.freeze([]),
  });
}

export function buildDemo4D41bOwnerOfKeyParameterV1(
  publicKeyValue: Uint8Array,
): Demo4D41bResultV1<Demo4D41bOwnerOfKeyParameterV1> {
  const key = exactBytes(publicKeyValue);
  if (key === null || !validFreshPublicKey(key)) {
    return failure("malformed_ed25519_key");
  }
  return success({
    external_key: {
      namespace: DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      key_type: DEMO4_D4_1B_PROFILE.externalKeyType,
      public_key: Object.freeze(Array.from(key)),
    },
  });
}

function extractAccount(value: unknown): string | null {
  const direct = nonEmptyString(value, 128);
  if (direct !== null) {
    return direct;
  }
  if (Array.isArray(value) && value.length === 1) {
    return extractAccount(value[0]);
  }
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  for (const key of ["Account", "account", "address", "value", "Some", "owner"]) {
    if (hasOwn(record, key)) {
      const nested = extractAccount(record[key]);
      if (nested !== null) {
        return nested;
      }
    }
  }
  return null;
}

function extractExternalKey(value: unknown): {
  readonly namespace: string;
  readonly keyType: string;
  readonly publicKey: Uint8Array;
} | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const namespace = nonEmptyString(record.namespace, 256);
  const keyType = nonEmptyString(record.key_type ?? record.keyType, 128);
  const key = publicKeyBytes(record.public_key ?? record.publicKey);
  return namespace !== null && keyType !== null && key !== null
    ? { namespace, keyType, publicKey: key }
    : null;
}

function contractMatches(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    decimalU64(record.index) === DEMO4_D4_1B_PROFILE.contract.index &&
    decimalU64(record.subindex) === DEMO4_D4_1B_PROFILE.contract.subindex
  );
}

function unwrapEvent(value: unknown): UnknownRecord | null {
  const root = asRecord(value);
  if (root === null) {
    return null;
  }

  const named =
    root[DEMO4_D4_1B_PROFILE.eventName];

  if (named === undefined) {
    return root;
  }

  if (Array.isArray(named)) {
    if (named.length !== 1) {
      return null;
    }

    return asRecord(named[0]);
  }

  return asRecord(named);
}

export function validateDemo4D41bRegistrationEventV1(input: {
  readonly tag: unknown;
  readonly contract: unknown;
  readonly decoded: unknown;
  readonly expectedPublicKey: Uint8Array;
}): Demo4D41bResultV1<Demo4D41bValidatedEventV1> {
  if (input.tag !== DEMO4_D4_1B_PROFILE.eventTag) {
    return failure("wrong_event_tag");
  }
  if (!contractMatches(input.contract)) {
    return failure("wrong_event_contract");
  }
  const payload = unwrapEvent(input.decoded);
  if (payload === null) {
    return failure("wrong_event_variant");
  }

  const owner = extractAccount(payload.owner);
  const externalKey = extractExternalKey(payload.external_key ?? payload.externalKey);
  const proofScheme = nonEmptyString(
    payload.proof_scheme ?? payload.proofScheme,
    128,
  );
  if (
    owner === null ||
    externalKey === null ||
    proofScheme === null ||
    !Array.isArray(payload.metadata)
  ) {
    return failure("invalid_event_shape");
  }
  if (owner !== DEMO4_D4_1B_PROFILE.ownerAccount) {
    return failure("wrong_event_owner");
  }

  const expected = exactBytes(input.expectedPublicKey);
  if (
    expected === null ||
    !validFreshPublicKey(expected) ||
    externalKey.namespace !== DEMO4_D4_1B_PROFILE.externalKeyNamespace ||
    externalKey.keyType !== DEMO4_D4_1B_PROFILE.externalKeyType ||
    !equalBytes(externalKey.publicKey, expected)
  ) {
    return failure("wrong_event_external_key");
  }
  if (proofScheme !== DEMO4_D4_1B_PROFILE.proofScheme) {
    return failure("wrong_event_proof_scheme");
  }
  if (payload.metadata.length !== 0) {
    return failure("wrong_event_metadata");
  }

  return success({
    owner: DEMO4_D4_1B_PROFILE.ownerAccount,
    publicKeyBase64Url: Buffer.from(expected).toString("base64url"),
    publicKeyHex: Buffer.from(expected).toString("hex"),
    proofScheme: DEMO4_D4_1B_PROFILE.proofScheme,
    metadata: Object.freeze([]),
  });
}

function ownerOfKeyPresentValue(value: unknown): unknown | null {
  if (value === null || value === undefined) {
    return null;
  }
  const record = asRecord(value);
  if (record === null) {
    return value;
  }
  if (
    record.found === false ||
    record.status === "not_found" ||
    hasOwn(record, "None")
  ) {
    return null;
  }
  for (const key of ["Some", "owner", "value", "result", "registration"]) {
    if (hasOwn(record, key)) {
      return record[key];
    }
  }
  return value;
}

export function validateDemo4D41bOwnerOfKeyPostconditionV1(
  decoded: unknown,
): Demo4D41bResultV1<{ readonly owner: typeof DEMO4_D4_1B_PROFILE.ownerAccount }> {
  const present = ownerOfKeyPresentValue(decoded);
  if (present === null) {
    return failure("ownerofkey_not_registered");
  }
  const owner = extractAccount(present);
  if (owner === null) {
    return failure("invalid_ownerofkey_shape");
  }
  if (owner !== DEMO4_D4_1B_PROFILE.ownerAccount) {
    return failure("wrong_ownerofkey_owner");
  }
  return success({ owner: DEMO4_D4_1B_PROFILE.ownerAccount });
}

function normalizedEvidenceKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenEvidence(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    return (
      lowered.includes("-----begin private key-----") ||
      lowered.includes("-----begin encrypted private key-----") ||
      lowered.includes("private-key.pem") ||
      lowered.includes("wallet-export") ||
      lowered.includes("seed phrase") ||
      lowered.includes("mnemonic phrase")
    );
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (seen.has(value)) {
    throw new Error("evidence_serialization_failed");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenEvidence(entry, seen));
  }
  for (const [key, entry] of Object.entries(value as UnknownRecord)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(normalizedEvidenceKey(key))) {
      return true;
    }
    if (containsForbiddenEvidence(entry, seen)) {
      return true;
    }
  }
  return false;
}

function canonicalizeJson(value: unknown, seen: WeakSet<object>): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new Error("evidence_serialization_failed");
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (seen.has(value)) {
    throw new Error("evidence_serialization_failed");
  }
  seen.add(value);
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = canonicalizeJson(entry, seen);
      return normalized === undefined ? null : normalized;
    });
  }
  const output: UnknownRecord = {};
  const record = value as UnknownRecord;
  for (const key of Object.keys(record).sort()) {
    const normalized = canonicalizeJson(record[key], seen);
    if (normalized !== undefined) {
      output[key] = normalized;
    }
  }
  return output;
}

export function canonicalizeDemo4D41bEvidenceV1(value: unknown): string {
  const normalized = canonicalizeJson(value, new WeakSet<object>());
  const serialized = JSON.stringify(normalized);
  if (typeof serialized !== "string") {
    throw new Error("evidence_serialization_failed");
  }
  return serialized;
}

export function hashDemo4D41bEvidenceV1(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeDemo4D41bEvidenceV1(value), "utf8")
    .digest("hex")}`;
}

export function validateDemo4D41bSanitizedEvidenceV1(
  value: unknown,
): Demo4D41bResultV1<{
  readonly canonicalJson: string;
  readonly evidenceHash: string;
}> {
  if (asRecord(value) === null) {
    return failure("invalid_evidence");
  }
  try {
    if (containsForbiddenEvidence(value, new WeakSet<object>())) {
      return failure("forbidden_evidence_material");
    }
    const canonicalJson = canonicalizeDemo4D41bEvidenceV1(value);
    const evidenceHash = `sha256:${createHash("sha256")
      .update(canonicalJson, "utf8")
      .digest("hex")}`;
    return success({ canonicalJson, evidenceHash });
  } catch {
    return failure("evidence_serialization_failed");
  }
}
