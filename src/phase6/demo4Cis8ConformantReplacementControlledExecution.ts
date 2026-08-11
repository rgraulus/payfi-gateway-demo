import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
} from "./demo4Cis8ConformantReplacementProfile";

import type {
  Demo4D41bReplacementExecutionPreflightEvidenceBindingV1,
} from "./demo4Cis8ConformantReplacementExecutionPreflight";

export const DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_TYPE =
  "xcf.demo4.d4-1b.cis8-conformant-replacement-controlled-execution-evidence" as const;

export const DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_VERSION =
  "1" as const;

type UnknownRecord =
  Record<string, unknown>;

export type Demo4D41bReplacementControlledExecutionResultV1<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type Demo4D41bReplacementControlledExecutionAuthorizationV1 = {
  readonly status:
    "controlled_execution_authorized";

  readonly testnetOnly: true;

  readonly network:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.concordiumNetwork;

  readonly ownerAccount:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

  readonly submissionLimit: 1;
  readonly submissionAttemptsBefore: 0;
  readonly remainingSubmissionAttempts: 1;

  readonly automaticRetryAuthorized: false;
  readonly zeroCcdRequired: true;

  readonly transactionExecutionAuthorized: true;
  readonly evidenceWriteAuthorized: true;

  readonly executionPreflightRunnerOutputSha256:
    string;

  readonly gate4AuthorizationArtifactSha256:
    string;

  readonly preflightCheckpointSha256:
    string;

  readonly cis8004Token287MutationAuthorized:
    false;

  readonly d4_1cAttachmentAuthorized:
    false;

  readonly historicalRegistrationRevocationAuthorized:
    false;
};

function rejected<T>(
  reason: string,
): Demo4D41bReplacementControlledExecutionResultV1<T> {
  return {
    ok: false,
    reason,
  };
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sha256Hex(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{64}$/.test(value)
  );
}

function validExecutionPreflightEvidence(
  value: unknown,
): value is Demo4D41bReplacementExecutionPreflightEvidenceBindingV1 {
  if (!isRecord(value)) {
    return false;
  }

  return (
    sha256Hex(
      value.publicPreflightArtifactSha256,
    ) &&
    sha256Hex(
      value.privatePreflightArtifactSha256,
    ) &&
    typeof value.replacementPublicKeyHex === "string" &&
    /^[0-9a-f]{64}$/.test(
      value.replacementPublicKeyHex,
    ) &&
    value.ownerOfKeyStatus === "unregistered" &&
    value.canonicalMessageByteLength === 249 &&
    sha256Hex(
      value.canonicalMessageSha256,
    ) &&
    value.signatureByteLength === 64 &&
    value.signatureLocallyVerified === true &&
    value.registrationParameterByteLength === 180 &&
    sha256Hex(
      value.registrationParameterSha256,
    ) &&
    value.privateKeyMaterialIncluded === false &&
    value.rawSignatureIncluded === false &&
    value.walletMaterialIncluded === false &&
    value.walletRead === false &&
    value.transactionConstructed === false &&
    value.transactionSubmitted === false
  );
}

export type Demo4D41bReplacementValidatedRegistrationEventV1 = {
  readonly owner:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;
  readonly publicKeyHex: string;
};

function replacementEventBytesV1(
  value: unknown,
): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const output =
    new Uint8Array(value.length);

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const entry =
      value[index];

    const numeric =
      typeof entry === "bigint"
        ? Number(entry)
        : entry;

    if (
      typeof numeric !== "number" ||
      !Number.isInteger(numeric) ||
      numeric < 0 ||
      numeric > 255
    ) {
      return null;
    }

    output[index] =
      numeric;
  }

  return output;
}

function replacementEventAccountV1(
  value: unknown,
): string | null {
  if (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128
  ) {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.length === 1
  ) {
    return replacementEventAccountV1(
      value[0],
    );
  }

  if (!isRecord(value)) {
    return null;
  }

  for (
    const key of [
      "Account",
      "account",
      "address",
      "value",
      "Some",
      "owner",
    ]
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key,
      )
    ) {
      const nested =
        replacementEventAccountV1(
          value[key],
        );

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function replacementEventExternalKeyV1(
  value: unknown,
): {
  readonly namespace: string;
  readonly keyType: string;
  readonly publicKey: Uint8Array;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const namespace =
    value.namespace;

  const keyType =
    value.key_type ??
    value.keyType;

  const publicKey =
    replacementEventBytesV1(
      value.public_key ??
      value.publicKey,
    );

  if (
    typeof namespace !== "string" ||
    namespace.length === 0 ||
    typeof keyType !== "string" ||
    keyType.length === 0 ||
    publicKey === null
  ) {
    return null;
  }

  return {
    namespace,
    keyType,
    publicKey,
  };
}

function replacementEventDecimalU64V1(
  value: unknown,
): string | null {
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

  return null;
}

function replacementEventContractMatchesV1(
  value: unknown,
): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    replacementEventDecimalU64V1(
      value.index,
    ) ===
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contract.index &&
    replacementEventDecimalU64V1(
      value.subindex,
    ) ===
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contract.subindex
  );
}

function replacementEventPayloadV1(
  value: unknown,
): UnknownRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const named =
    value[
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .eventName
    ];

  if (named === undefined) {
    return value;
  }

  if (Array.isArray(named)) {
    if (named.length !== 1) {
      return null;
    }

    return isRecord(named[0])
      ? named[0]
      : null;
  }

  return isRecord(named)
    ? named
    : null;
}

function replacementEventBytesEqualV1(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function replacementEventHexV1(
  value: Uint8Array,
): string {
  return Array.from(
    value,
    (byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
  ).join("");
}

export function validateDemo4D41bReplacementRegistrationEventV1(
  input: {
    readonly tag: unknown;
    readonly contract: unknown;
    readonly decoded: unknown;
    readonly expectedPublicKey: Uint8Array;
  },
): Demo4D41bReplacementControlledExecutionResultV1<
  Demo4D41bReplacementValidatedRegistrationEventV1
> {
  if (
    input.tag !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .eventTag
  ) {
    return rejected(
      "wrong_event_tag",
    );
  }

  if (
    !replacementEventContractMatchesV1(
      input.contract,
    )
  ) {
    return rejected(
      "wrong_event_contract",
    );
  }

  const payload =
    replacementEventPayloadV1(
      input.decoded,
    );

  if (payload === null) {
    return rejected(
      "wrong_event_variant",
    );
  }

  const owner =
    replacementEventAccountV1(
      payload.owner,
    );

  const externalKey =
    replacementEventExternalKeyV1(
      payload.external_key ??
      payload.externalKey,
    );

  if (
    owner === null ||
    externalKey === null
  ) {
    return rejected(
      "invalid_event_shape",
    );
  }

  if (
    owner !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .ownerAccount
  ) {
    return rejected(
      "wrong_event_owner",
    );
  }

  const expectedPublicKey =
    replacementEventBytesV1(
      input.expectedPublicKey,
    );

  if (
    expectedPublicKey === null ||
    expectedPublicKey.length !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .publicKeyByteLength ||
    externalKey.namespace !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .externalKeyNamespace ||
    externalKey.keyType !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .externalKeyType ||
    !replacementEventBytesEqualV1(
      externalKey.publicKey,
      expectedPublicKey,
    )
  ) {
    return rejected(
      "wrong_event_external_key",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      owner:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      publicKeyHex:
        replacementEventHexV1(
          expectedPublicKey,
        ),
    }),
  };
}

export type Demo4D41bReplacementValidatedOwnerOfKeyV1 = {
  readonly owner:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;
  readonly ownerOfKeyStatus:
    "registered";
};

function replacementOwnerOfKeyPresentValueV1(
  value: unknown,
): unknown | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (!isRecord(value)) {
    return value;
  }

  if (
    value.found === false ||
    value.status === "not_found" ||
    Object.prototype.hasOwnProperty.call(
      value,
      "None",
    )
  ) {
    return null;
  }

  for (
    const key of [
      "Some",
      "owner",
      "value",
      "result",
      "registration",
    ]
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key,
      )
    ) {
      return value[key];
    }
  }

  return value;
}

export function validateDemo4D41bReplacementOwnerOfKeyRegisteredV1(
  decoded: unknown,
): Demo4D41bReplacementControlledExecutionResultV1<
  Demo4D41bReplacementValidatedOwnerOfKeyV1
> {
  const present =
    replacementOwnerOfKeyPresentValueV1(
      decoded,
    );

  if (present === null) {
    return rejected(
      "ownerofkey_not_registered",
    );
  }

  const owner =
    replacementEventAccountV1(
      present,
    );

  if (owner === null) {
    return rejected(
      "invalid_ownerofkey_shape",
    );
  }

  if (
    owner !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .ownerAccount
  ) {
    return rejected(
      "wrong_ownerofkey_owner",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      owner:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      ownerOfKeyStatus:
        "registered",
    }),
  };
}

export function authorizeDemo4D41bReplacementControlledExecutionV1(
  input: unknown,
): Demo4D41bReplacementControlledExecutionResultV1<
  Demo4D41bReplacementControlledExecutionAuthorizationV1
> {
  if (
    !isRecord(input) ||
    !validExecutionPreflightEvidence(
      input.executionPreflight,
    )
  ) {
    return rejected(
      "invalid_execution_preflight_evidence",
    );
  }

  if (
    input
      .explicitControlledExecutionAuthorizationConfirmed !==
      true ||
    input.testnetOnly !== true
  ) {
    return rejected(
      "controlled_execution_authorization_required",
    );
  }

  if (
    input.submissionAttemptsBefore !== 0
  ) {
    return rejected(
      "submission_attempt_limit_exceeded",
    );
  }

  if (
    input.automaticRetryAuthorized !== false
  ) {
    return rejected(
      "automatic_retry_forbidden",
    );
  }

  if (
    input.zeroCcdRequired !== true
  ) {
    return rejected(
      "zero_ccd_required",
    );
  }

  if (
    input.walletReadEnabled !== true ||
    input.accountSignerCreationEnabled !== true ||
    input.transactionConstructionEnabled !== true ||
    input.transactionSigningEnabled !== true ||
    input.transactionSubmissionEnabled !== true ||
    input.evidenceWriteEnabled !== true
  ) {
    return rejected(
      "controlled_execution_capability_incomplete",
    );
  }

  if (
    input.cis8004Token287MutationAuthorized !== false ||
    input.d4_1cAttachmentAuthorized !== false ||
    input.historicalRegistrationRevocationAuthorized !==
      false
  ) {
    return rejected(
      "adjacent_mutation_authorization_forbidden",
    );
  }

  if (
    !sha256Hex(
      input.executionPreflightRunnerOutputSha256,
    ) ||
    !sha256Hex(
      input.gate4AuthorizationArtifactSha256,
    ) ||
    !sha256Hex(
      input.preflightCheckpointSha256,
    )
  ) {
    return rejected(
      "invalid_execution_provenance",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      status:
        "controlled_execution_authorized",

      testnetOnly: true,

      network:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .concordiumNetwork,

      ownerAccount:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      submissionLimit: 1,
      submissionAttemptsBefore: 0,
      remainingSubmissionAttempts: 1,

      automaticRetryAuthorized: false,
      zeroCcdRequired: true,

      transactionExecutionAuthorized: true,
      evidenceWriteAuthorized: true,

      executionPreflightRunnerOutputSha256:
        input.executionPreflightRunnerOutputSha256,

      gate4AuthorizationArtifactSha256:
        input.gate4AuthorizationArtifactSha256,

      preflightCheckpointSha256:
        input.preflightCheckpointSha256,

      cis8004Token287MutationAuthorized:
        false,

      d4_1cAttachmentAuthorized:
        false,

      historicalRegistrationRevocationAuthorized:
        false,
    }),
  };
}


export type Demo4D41bReplacementFinalizedExecutionObservationV1 = {
  readonly authorization:
    Demo4D41bReplacementControlledExecutionAuthorizationV1;

  readonly executionPreflight:
    Demo4D41bReplacementExecutionPreflightEvidenceBindingV1;

  readonly submissionAttempts: number;
  readonly automaticRetryAttempted: boolean;

  readonly preState: Readonly<{
    finalized: boolean;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
    ownerOfKeyStatus: string;
  }>;

  readonly dryRun: Readonly<{
    deterministicParameterByteLength: number;
    deterministicParameterSha256: string;
    sdkSerializedParameterByteLength: number;
    sdkSerializedParameterSha256: string;
    exactSdkByteEquivalence: boolean;
    usedEnergy: string;
    transactionEnergyAllowance: string;
    zeroCcdAttached: boolean;
  }>;

  readonly transaction: Readonly<{
    hash: string;
    finalized: boolean;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
    energyCost: string;
    costMicroCcd: string;
    transactionType: string;
  }>;

  readonly registrationEvent: Readonly<{
    owner: string;
    publicKeyHex: string;
  }>;

  readonly ownershipPostcondition: Readonly<{
    owner: string;
    ownerOfKeyStatus: string;
    finalized: boolean;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
  }>;

  readonly safety: Readonly<{
    exactlyOneSubmissionAttempted: boolean;
    automaticRetryAttempted: boolean;
    zeroCcdAttached: boolean;
    cis8004Token287Mutated: boolean;
    d4_1cAttached: boolean;
    historicalRegistrationRevoked: boolean;
    gatewayRuntimeActivated: boolean;
    paymentAttempted: boolean;
    settlementAttempted: boolean;
    receiptIssued: boolean;
    protectedResourceReleased: boolean;
    replayStateMutated: boolean;
    productionActivation: boolean;
  }>;
};

export type Demo4D41bReplacementSanitizedFinalizedEvidenceV1 = {
  readonly type:
    typeof DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_TYPE;

  readonly version:
    typeof DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_VERSION;

  readonly status:
    "finalized_registration_confirmed";

  readonly network:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.concordiumNetwork;

  readonly registry: Readonly<{
    contract:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.contract;
    contractName:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.contractName;
    moduleReference:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.moduleReference;
    registerEntrypoint:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.registerEntrypoint;
    ownerOfKeyEntrypoint:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerOfKeyEntrypoint;
  }>;

  readonly ownerAccount:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

  readonly provenance: Readonly<{
    executionPreflightRunnerOutputSha256: string;
    gate4AuthorizationArtifactSha256: string;
    preflightCheckpointSha256: string;
  }>;

  readonly preState: Readonly<{
    finalized: true;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
    ownerOfKeyStatus: "unregistered";
  }>;

  readonly proof: Readonly<{
    scheme:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.proofScheme;
    canonicalMessageByteLength: 249;
    canonicalMessageSha256: string;
    signatureByteLength: 64;
    signatureLocallyVerified: true;
    registrationParameterByteLength: 180;
    registrationParameterSha256: string;
    exactSdkByteEquivalence: true;
    dryRunUsedEnergy: string;
    transactionEnergyAllowance: string;
    zeroCcdAttached: true;
  }>;

  readonly transaction: Readonly<{
    hash: string;
    finalized: true;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
    energyCost: string;
    costMicroCcd: string;
    transactionType: "update";
  }>;

  readonly registrationEvent: Readonly<{
    owner:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;
    publicKeyHex: string;
  }>;

  readonly ownershipPostcondition: Readonly<{
    owner:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;
    ownerOfKeyStatus: "registered";
    finalized: true;
    finalizedBlockHash: string;
    finalizedBlockHeight: string;
  }>;

  readonly safety: Readonly<{
    exactlyOneSubmissionAttempted: true;
    automaticRetryAttempted: false;
    zeroCcdAttached: true;
    cis8004Token287Mutated: false;
    d4_1cAttached: false;
    historicalRegistrationRevoked: false;
    gatewayRuntimeActivated: false;
    paymentAttempted: false;
    settlementAttempted: false;
    receiptIssued: false;
    protectedResourceReleased: false;
    replayStateMutated: false;
    productionActivation: false;
  }>;
};

function decimalQuantity(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value)
  );
}

export function buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1(
  input: Demo4D41bReplacementFinalizedExecutionObservationV1,
): Demo4D41bReplacementControlledExecutionResultV1<
  Demo4D41bReplacementSanitizedFinalizedEvidenceV1
> {
  const authorization =
    input.authorization;

  if (
    authorization.status !==
      "controlled_execution_authorized" ||
    authorization.transactionExecutionAuthorized !==
      true ||
    authorization.evidenceWriteAuthorized !== true ||
    authorization.submissionLimit !== 1 ||
    authorization.submissionAttemptsBefore !== 0 ||
    authorization.remainingSubmissionAttempts !== 1 ||
    authorization.automaticRetryAuthorized !== false ||
    authorization.zeroCcdRequired !== true
  ) {
    return rejected(
      "controlled_execution_authorization_invalid",
    );
  }

  if (
    input.submissionAttempts !== 1
  ) {
    return rejected(
      "submission_attempt_limit_exceeded",
    );
  }

  if (
    input.automaticRetryAttempted !== false ||
    input.safety.automaticRetryAttempted !== false
  ) {
    return rejected(
      "automatic_retry_forbidden",
    );
  }

  if (
    !validExecutionPreflightEvidence(
      input.executionPreflight,
    )
  ) {
    return rejected(
      "invalid_execution_preflight_evidence",
    );
  }

  if (
    input.preState.finalized !== true ||
    !sha256Hex(
      input.preState.finalizedBlockHash,
    ) ||
    !decimalQuantity(
      input.preState.finalizedBlockHeight,
    ) ||
    input.preState.ownerOfKeyStatus !==
      "unregistered"
  ) {
    return rejected(
      "invalid_finalized_pre_state",
    );
  }

  if (
    input.dryRun.deterministicParameterByteLength !==
      180 ||
    input.dryRun.sdkSerializedParameterByteLength !==
      180 ||
    input.dryRun.deterministicParameterSha256 !==
      input.executionPreflight.registrationParameterSha256 ||
    input.dryRun.sdkSerializedParameterSha256 !==
      input.executionPreflight.registrationParameterSha256 ||
    input.dryRun.exactSdkByteEquivalence !== true ||
    !decimalQuantity(
      input.dryRun.usedEnergy,
    ) ||
    !decimalQuantity(
      input.dryRun.transactionEnergyAllowance,
    ) ||
    input.dryRun.zeroCcdAttached !== true
  ) {
    return rejected(
      "dry_run_binding_mismatch",
    );
  }

  if (
    !sha256Hex(
      input.transaction.hash,
    ) ||
    input.transaction.finalized !== true ||
    !sha256Hex(
      input.transaction.finalizedBlockHash,
    ) ||
    !decimalQuantity(
      input.transaction.finalizedBlockHeight,
    ) ||
    !decimalQuantity(
      input.transaction.energyCost,
    ) ||
    !decimalQuantity(
      input.transaction.costMicroCcd,
    ) ||
    input.transaction.transactionType !==
      "update"
  ) {
    return rejected(
      "invalid_finalized_transaction",
    );
  }

  if (
    input.preState.finalizedBlockHash ===
      input.transaction.finalizedBlockHash
  ) {
    return rejected(
      "pre_post_finalized_blocks_not_distinct",
    );
  }

  if (
    input.registrationEvent.owner !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount ||
    input.registrationEvent.publicKeyHex !==
      input.executionPreflight.replacementPublicKeyHex
  ) {
    return rejected(
      "registration_event_mismatch",
    );
  }

  if (
    input.ownershipPostcondition.owner !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount ||
    input.ownershipPostcondition.ownerOfKeyStatus !==
      "registered" ||
    input.ownershipPostcondition.finalized !== true ||
    input.ownershipPostcondition.finalizedBlockHash !==
      input.transaction.finalizedBlockHash ||
    input.ownershipPostcondition.finalizedBlockHeight !==
      input.transaction.finalizedBlockHeight
  ) {
    return rejected(
      "ownership_postcondition_failed",
    );
  }

  if (
    input.safety.exactlyOneSubmissionAttempted !== true ||
    input.safety.zeroCcdAttached !== true ||
    input.safety.cis8004Token287Mutated !== false ||
    input.safety.d4_1cAttached !== false ||
    input.safety.historicalRegistrationRevoked !== false ||
    input.safety.gatewayRuntimeActivated !== false ||
    input.safety.paymentAttempted !== false ||
    input.safety.settlementAttempted !== false ||
    input.safety.receiptIssued !== false ||
    input.safety.protectedResourceReleased !== false ||
    input.safety.replayStateMutated !== false ||
    input.safety.productionActivation !== false
  ) {
    return rejected(
      "unsafe_finalized_evidence",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      type:
        DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_TYPE,

      version:
        DEMO4_D4_1B_REPLACEMENT_CONTROLLED_EXECUTION_VERSION,

      status:
        "finalized_registration_confirmed",

      network:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .concordiumNetwork,

      registry: Object.freeze({
        contract:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .contract,

        contractName:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .contractName,

        moduleReference:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .moduleReference,

        registerEntrypoint:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .registerEntrypoint,

        ownerOfKeyEntrypoint:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .ownerOfKeyEntrypoint,
      }),

      ownerAccount:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      provenance: Object.freeze({
        executionPreflightRunnerOutputSha256:
          authorization
            .executionPreflightRunnerOutputSha256,

        gate4AuthorizationArtifactSha256:
          authorization
            .gate4AuthorizationArtifactSha256,

        preflightCheckpointSha256:
          authorization
            .preflightCheckpointSha256,
      }),

      preState: Object.freeze({
        finalized: true,
        finalizedBlockHash:
          input.preState.finalizedBlockHash,
        finalizedBlockHeight:
          input.preState.finalizedBlockHeight,
        ownerOfKeyStatus:
          "unregistered",
      }),

      proof: Object.freeze({
        scheme:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .proofScheme,

        canonicalMessageByteLength:
          249,

        canonicalMessageSha256:
          input.executionPreflight
            .canonicalMessageSha256,

        signatureByteLength:
          64,

        signatureLocallyVerified:
          true,

        registrationParameterByteLength:
          180,

        registrationParameterSha256:
          input.executionPreflight
            .registrationParameterSha256,

        exactSdkByteEquivalence:
          true,

        dryRunUsedEnergy:
          input.dryRun.usedEnergy,

        transactionEnergyAllowance:
          input.dryRun
            .transactionEnergyAllowance,

        zeroCcdAttached:
          true,
      }),

      transaction: Object.freeze({
        hash:
          input.transaction.hash,

        finalized:
          true,

        finalizedBlockHash:
          input.transaction
            .finalizedBlockHash,

        finalizedBlockHeight:
          input.transaction
            .finalizedBlockHeight,

        energyCost:
          input.transaction.energyCost,

        costMicroCcd:
          input.transaction.costMicroCcd,

        transactionType:
          "update",
      }),

      registrationEvent: Object.freeze({
        owner:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .ownerAccount,

        publicKeyHex:
          input.executionPreflight
            .replacementPublicKeyHex,
      }),

      ownershipPostcondition: Object.freeze({
        owner:
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .ownerAccount,

        ownerOfKeyStatus:
          "registered",

        finalized:
          true,

        finalizedBlockHash:
          input.transaction
            .finalizedBlockHash,

        finalizedBlockHeight:
          input.transaction
            .finalizedBlockHeight,
      }),

      safety: Object.freeze({
        exactlyOneSubmissionAttempted:
          true,

        automaticRetryAttempted:
          false,

        zeroCcdAttached:
          true,

        cis8004Token287Mutated:
          false,

        d4_1cAttached:
          false,

        historicalRegistrationRevoked:
          false,

        gatewayRuntimeActivated:
          false,

        paymentAttempted:
          false,

        settlementAttempted:
          false,

        receiptIssued:
          false,

        protectedResourceReleased:
          false,

        replayStateMutated:
          false,

        productionActivation:
          false,
      }),
    }),
  };
}
