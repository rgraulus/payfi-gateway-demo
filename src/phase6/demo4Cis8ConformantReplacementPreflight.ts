/**
 * PR #312 Gate 3 — deterministic public/private preflight contract for the
 * proposal-conformant Demo 4 D4-1B CIS-8 replacement registration.
 *
 * This pure core performs no environment, filesystem, network, wallet,
 * private-key, signing, contract, transaction, payment, or production work.
 * Gate 3 may produce a bounded Gate 4 handoff, but cannot submit anything.
 */

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR,
  buildDemo4D41bReplacementCanonicalMessageV1,
} from "./demo4Cis8ConformantReplacementProfile";

export const DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE =
  "xcf.demo4.d4-1b.cis8-conformant-replacement-preflight" as const;

export const DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION =
  "1" as const;

export const DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE =
  Object.freeze({
    sourcePins:
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,

    replacementProfile:
      DEMO4_D4_1B_REPLACEMENT_PROFILE,

    deployedContract: Object.freeze({
      network:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.concordiumNetwork,

      grpc: Object.freeze({
        host: "grpc.testnet.concordium.com",
        port: 20_000,
        tls: true,
      }),

      contract:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.contract,

      contractName:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.contractName,

      moduleReference:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.moduleReference,

      schemaVersion: 3,

      registerEntrypoint:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.registerEntrypoint,

      ownerOfKeyEntrypoint:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerOfKeyEntrypoint,

      ownerAccount:
        DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount,

      eventSchemaRequired: true,
    }),

    authorizationPolicy: Object.freeze({
      gate3TransactionSubmissionAllowed: false,
      gate4SubmissionLimit: 1,
      submissionAttemptsBefore: 0,
      automaticRetryAuthorized: false,
      zeroCcdRequired: true,
      cis8004TokenId: "287",
      cis8004MutationAllowed: false,
      d4_1cAttachmentAllowed: false,
      historicalRegistrationRevocationAllowed: false,
    }),
  } as const);

export const DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY =
  Object.freeze({
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
    d4_1cAttachmentPerformed: false,
    historicalRegistrationRevoked: false,
    gatewayRuntimeCalled: false,
    paymentAttempted: false,
    productionActivation: false,
  } as const);

export type Demo4D41bReplacementPreflightFailureReasonV1 =
  | "invalid_evidence"
  | "source_pin_drift"
  | "solana_genesis_drift"
  | "chain_state_not_finalized"
  | "invalid_finalized_block_height"
  | "wrong_network"
  | "wrong_contract"
  | "wrong_module_reference"
  | "wrong_contract_name"
  | "wrong_schema_version"
  | "wrong_owner_account"
  | "invalid_owner_account_bytes"
  | "invalid_concordium_genesis_hash"
  | "wrong_grpc_endpoint"
  | "tls_required"
  | "missing_register_entrypoint"
  | "missing_ownerofkey_entrypoint"
  | "missing_event_schema"
  | "invalid_public_key"
  | "replacement_key_already_registered"
  | "canonical_message_mismatch"
  | "registration_parameter_mismatch"
  | "private_preflight_required"
  | "signature_not_locally_verified"
  | "invalid_signature_length"
  | "submission_attempt_limit_exceeded"
  | "automatic_retry_forbidden"
  | "unsafe_authorization_state";

export type Demo4D41bReplacementPreflightFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason:
    Demo4D41bReplacementPreflightFailureReasonV1;
};

export type Demo4D41bReplacementPreflightSuccessV1<T> = {
  readonly ok: true;
  readonly status: "accepted";
  readonly reason: "accepted";
  readonly value: T;
};

export type Demo4D41bReplacementPreflightResultV1<T> =
  | Demo4D41bReplacementPreflightSuccessV1<T>
  | Demo4D41bReplacementPreflightFailureV1;

export type Demo4D41bReplacementPublicPreflightEvidenceV1 = {
  readonly type:
    typeof DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE;
  readonly version:
    typeof DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION;

  readonly normativeHtmlSha256: string;
  readonly solanaCaipHtmlSha256: string;
  readonly solanaDevnetGenesisHash: string;

  readonly finalized: boolean;
  readonly finalizedBlockHeight: string;

  readonly network: string;
  readonly contractIndex: string;
  readonly contractSubindex: string;
  readonly moduleReference: string;
  readonly contractName: string;
  readonly schemaVersion: number;
  readonly ownerAccount: string;
  readonly ownerAccountBytesHex: string;
  readonly concordiumGenesisHashBytesHex: string;

  readonly grpcHost: string;
  readonly grpcPort: number;
  readonly grpcTls: boolean;

  readonly entrypoints: readonly string[];
  readonly eventSchemaPresent: boolean;

  readonly replacementPublicKeyHex: string;
  readonly ownerOfKeyStatus: "unregistered";

  readonly canonicalMessageByteLength: number;
  readonly canonicalMessageSha256: string;

  readonly expectedRegistrationParameterByteLength: number;
  readonly privatePreflightRequired: true;

  readonly safety:
    typeof DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY;
};

export type Demo4D41bReplacementPrivatePreflightEvidenceV1 = {
  readonly publicPreflight:
    Demo4D41bReplacementPublicPreflightEvidenceV1;

  readonly publicKeyMatchesPrivateKey: true;
  readonly signatureByteLength: 64;
  readonly signatureLocallyVerified: true;

  readonly registrationParameterByteLength: number;
  readonly registrationParameterSha256: string;

  readonly privateKeyMaterialIncluded: false;
  readonly rawSignatureIncluded: false;
  readonly walletMaterialIncluded: false;
};

export type Demo4D41bReplacementGate4AuthorizationV1 = {
  readonly status: "gate4_submission_authorized";
  readonly transactionExecutionAuthorized: false;
  readonly gate4SubmissionLimit: 1;
  readonly submissionAttemptsBefore: 0;
  readonly remainingSubmissionAttempts: 1;
  readonly automaticRetryAuthorized: false;
  readonly zeroCcdRequired: true;
  readonly cis8004Token287MutationAuthorized: false;
  readonly d4_1cAttachmentAuthorized: false;
  readonly historicalRegistrationRevocationAuthorized: false;
};

type UnknownRecord = Record<string, unknown>;

const HEX_32_PATTERN = /^[0-9a-f]{64}$/;
const DECIMAL_HEIGHT_PATTERN = /^(0|[1-9][0-9]*)$/;

function accepted<T>(
  value: T,
): Demo4D41bReplacementPreflightSuccessV1<T> {
  return {
    ok: true,
    status: "accepted",
    reason: "accepted",
    value,
  };
}

function rejected(
  reason:
    Demo4D41bReplacementPreflightFailureReasonV1,
): Demo4D41bReplacementPreflightFailureV1 {
  return {
    ok: false,
    status: "rejected",
    reason,
  };
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function exactSafety(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const expected = Object.entries(
    DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY,
  );

  return (
    Object.keys(value).length === expected.length &&
    expected.every(
      ([key, expectedValue]) =>
        value[key] === expectedValue,
    )
  );
}

function bytesFromHex32(
  value: unknown,
): Uint8Array | null {
  if (
    typeof value !== "string" ||
    !HEX_32_PATTERN.test(value)
  ) {
    return null;
  }

  return Uint8Array.from(
    Buffer.from(value, "hex"),
  );
}

function validatePublicEnvelopeAndTrustAnchors(
  input: UnknownRecord,
):
  | Demo4D41bReplacementPreflightFailureReasonV1
  | null {
  if (
    input.type !==
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE ||
    input.version !==
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION
  ) {
    return "invalid_evidence";
  }

  const profile =
    DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE;

  const pins =
    profile.sourcePins;

  const contract =
    profile.deployedContract;

  if (
    input.normativeHtmlSha256 !==
      pins.normativeHtmlSha256 ||
    input.solanaCaipHtmlSha256 !==
      pins.solanaCaipHtmlSha256
  ) {
    return "source_pin_drift";
  }

  if (
    input.solanaDevnetGenesisHash !==
      pins.solanaDevnetGenesisHash
  ) {
    return "solana_genesis_drift";
  }

  if (input.finalized !== true) {
    return "chain_state_not_finalized";
  }

  if (
    typeof input.finalizedBlockHeight !==
      "string" ||
    !DECIMAL_HEIGHT_PATTERN.test(
      input.finalizedBlockHeight,
    )
  ) {
    return "invalid_finalized_block_height";
  }

  try {
    if (
      BigInt(input.finalizedBlockHeight) <= 0n
    ) {
      return "invalid_finalized_block_height";
    }
  } catch {
    return "invalid_finalized_block_height";
  }

  if (input.network !== contract.network) {
    return "wrong_network";
  }

  if (
    input.contractIndex !==
      contract.contract.index ||
    input.contractSubindex !==
      contract.contract.subindex
  ) {
    return "wrong_contract";
  }

  if (
    input.moduleReference !==
      contract.moduleReference
  ) {
    return "wrong_module_reference";
  }

  if (
    input.contractName !==
      contract.contractName
  ) {
    return "wrong_contract_name";
  }

  if (
    input.schemaVersion !==
      contract.schemaVersion
  ) {
    return "wrong_schema_version";
  }

  if (
    input.ownerAccount !==
      contract.ownerAccount
  ) {
    return "wrong_owner_account";
  }

  if (
    input.grpcHost !==
      contract.grpc.host ||
    input.grpcPort !==
      contract.grpc.port
  ) {
    return "wrong_grpc_endpoint";
  }

  if (input.grpcTls !== true) {
    return "tls_required";
  }

  if (
    !Array.isArray(input.entrypoints) ||
    !input.entrypoints.every(
      (value) =>
        typeof value === "string",
    )
  ) {
    return "invalid_evidence";
  }

  if (
    !input.entrypoints.includes(
      contract.registerEntrypoint,
    )
  ) {
    return "missing_register_entrypoint";
  }

  if (
    !input.entrypoints.includes(
      contract.ownerOfKeyEntrypoint,
    )
  ) {
    return "missing_ownerofkey_entrypoint";
  }

  if (
    input.eventSchemaPresent !== true
  ) {
    return "missing_event_schema";
  }

  return null;
}

function validatePublicKeyAndCanonicalContract(
  input: UnknownRecord,
):
  | Demo4D41bReplacementPreflightFailureReasonV1
  | null {
  const publicKey = bytesFromHex32(
    input.replacementPublicKeyHex,
  );

  if (publicKey === null) {
    return "invalid_public_key";
  }

  if (
    input.ownerOfKeyStatus !==
      "unregistered"
  ) {
    return "replacement_key_already_registered";
  }

  const ownerBytes = bytesFromHex32(
    input.ownerAccountBytesHex,
  );

  if (ownerBytes === null) {
    return "invalid_owner_account_bytes";
  }

  const genesisBytes = bytesFromHex32(
    input.concordiumGenesisHashBytesHex,
  );

  if (genesisBytes === null) {
    return "invalid_concordium_genesis_hash";
  }

  const canonical =
    buildDemo4D41bReplacementCanonicalMessageV1({
      concordiumAccountBytes:
        ownerBytes,

      concordiumGenesisHashBytes:
        genesisBytes,

      publicKeyBytes:
        publicKey,
    });

  if (
    canonical.ok !== true ||
    input.canonicalMessageByteLength !==
      canonical.value.byteLength ||
    input.canonicalMessageSha256 !==
      canonical.value.sha256
  ) {
    return "canonical_message_mismatch";
  }

  if (
    input.expectedRegistrationParameterByteLength !==
      DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR
        .registrationParameterByteLength
  ) {
    return "registration_parameter_mismatch";
  }

  if (
    input.privatePreflightRequired !==
      true
  ) {
    return "private_preflight_required";
  }

  if (!exactSafety(input.safety)) {
    return "unsafe_authorization_state";
  }

  return null;
}

export function validateDemo4D41bReplacementPublicPreflightV1(
  input: unknown,
): Demo4D41bReplacementPreflightResultV1<
  Demo4D41bReplacementPublicPreflightEvidenceV1
> {
  if (!isRecord(input)) {
    return rejected("invalid_evidence");
  }

  const trustAnchorFailure =
    validatePublicEnvelopeAndTrustAnchors(input);

  if (trustAnchorFailure !== null) {
    return rejected(trustAnchorFailure);
  }

  const canonicalFailure =
    validatePublicKeyAndCanonicalContract(input);

  if (canonicalFailure !== null) {
    return rejected(canonicalFailure);
  }

  return accepted(
    input as unknown as
      Demo4D41bReplacementPublicPreflightEvidenceV1,
  );
}

export function validateDemo4D41bReplacementPrivatePreflightV1(
  input: unknown,
): Demo4D41bReplacementPreflightResultV1<
  Demo4D41bReplacementPrivatePreflightEvidenceV1
> {
  if (
    !isRecord(input) ||
    !isRecord(input.publicPreflight)
  ) {
    return rejected("invalid_evidence");
  }

  const publicResult =
    validateDemo4D41bReplacementPublicPreflightV1(
      input.publicPreflight,
    );

  if (publicResult.ok !== true) {
    return rejected(publicResult.reason);
  }

  if (
    input.publicKeyMatchesPrivateKey !== true
  ) {
    return rejected("invalid_evidence");
  }

  if (
    input.signatureByteLength !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .signatureByteLength
  ) {
    return rejected("invalid_signature_length");
  }

  if (
    input.signatureLocallyVerified !== true
  ) {
    return rejected(
      "signature_not_locally_verified",
    );
  }

  if (
    input.registrationParameterByteLength !==
      DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR
        .registrationParameterByteLength ||
    typeof input.registrationParameterSha256 !==
      "string" ||
    !HEX_32_PATTERN.test(
      input.registrationParameterSha256,
    )
  ) {
    return rejected(
      "registration_parameter_mismatch",
    );
  }

  if (
    input.privateKeyMaterialIncluded !== false ||
    input.rawSignatureIncluded !== false ||
    input.walletMaterialIncluded !== false
  ) {
    return rejected(
      "unsafe_authorization_state",
    );
  }

  return accepted(
    input as unknown as
      Demo4D41bReplacementPrivatePreflightEvidenceV1,
  );
}

export type Demo4D41bReplacementGate4AuthorizationInputV1 = {
  readonly privatePreflight: unknown;

  readonly explicitGate4SubmissionAuthorizationConfirmed:
    unknown;

  readonly submissionAttemptsBefore:
    unknown;

  readonly automaticRetryAuthorized:
    unknown;

  readonly zeroCcdRequired:
    unknown;

  readonly cis8004TokenId:
    unknown;

  readonly cis8004Token287MutationAuthorized:
    unknown;

  readonly d4_1cAttachmentAuthorized:
    unknown;

  readonly historicalRegistrationRevocationAuthorized:
    unknown;
};

export function authorizeDemo4D41bReplacementSingleSubmissionV1(
  input: unknown,
): Demo4D41bReplacementPreflightResultV1<
  Demo4D41bReplacementGate4AuthorizationV1
> {
  if (
    !isRecord(input) ||
    !isRecord(input.privatePreflight)
  ) {
    return rejected("invalid_evidence");
  }

  const privateResult =
    validateDemo4D41bReplacementPrivatePreflightV1(
      input.privatePreflight,
    );

  if (privateResult.ok !== true) {
    return rejected(privateResult.reason);
  }

  if (
    input
      .explicitGate4SubmissionAuthorizationConfirmed !==
    true
  ) {
    return rejected(
      "unsafe_authorization_state",
    );
  }

  if (input.submissionAttemptsBefore !== 0) {
    return rejected(
      "submission_attempt_limit_exceeded",
    );
  }

  if (input.automaticRetryAuthorized !== false) {
    return rejected(
      "automatic_retry_forbidden",
    );
  }

  const policy =
    DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE
      .authorizationPolicy;

  if (
    input.zeroCcdRequired !== true ||
    input.cis8004TokenId !==
      policy.cis8004TokenId ||
    input.cis8004Token287MutationAuthorized !==
      false ||
    input.d4_1cAttachmentAuthorized !==
      false ||
    input.historicalRegistrationRevocationAuthorized !==
      false
  ) {
    return rejected(
      "unsafe_authorization_state",
    );
  }

  const authorization:
    Demo4D41bReplacementGate4AuthorizationV1 =
      Object.freeze({
        status:
          "gate4_submission_authorized",

        transactionExecutionAuthorized:
          false,

        gate4SubmissionLimit:
          policy.gate4SubmissionLimit,

        submissionAttemptsBefore:
          0,

        remainingSubmissionAttempts:
          1,

        automaticRetryAuthorized:
          false,

        zeroCcdRequired:
          true,

        cis8004Token287MutationAuthorized:
          false,

        d4_1cAttachmentAuthorized:
          false,

        historicalRegistrationRevocationAuthorized:
          false,
      });

  return accepted(authorization);
}
