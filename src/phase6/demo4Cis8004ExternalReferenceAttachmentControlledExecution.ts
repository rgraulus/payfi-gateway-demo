/**
 * PR #314 — Demo4 D4-1C controlled external-reference attachment.
 *
 * Initial deterministic/offline implementation slice.
 *
 * This module consumes the frozen PR #313 Gate E handoff and defines the
 * fail-closed authorization and finalized-postcondition contracts for the
 * future single CIS-8004.setExternalReference transaction.
 *
 * It performs no environment, filesystem, network, wallet, signer,
 * transaction, payment, settlement, receipt, release, or production action.
 */

import {
  createHash,
} from "node:crypto";

import {
  DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE,
  DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT,
  DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN,
  DEMO4_D4_1C_GATE_E_PR314_HANDOFF,
  buildDemo4D41cAttachmentCandidateV1,
  buildDemo4D41cNormalizedExternalReferenceV1,
  completeDemo4D41cExternalKeyIdEqualsV1,
  serializeDemo4D41cSetExternalReferenceParameterV1,
  type Demo4D41cExternalKeyIdV1,
  type Demo4D41cExternalReferenceV1,
} from "./demo4Cis8004ExternalReferenceAttachmentPreflight";

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_TYPE =
  "xcf.demo4.d4-1c.cis8004-external-reference-attachment-controlled-execution" as const;

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_VERSION =
  "1" as const;

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_STAGE =
  "initial_deterministic_offline_execute_locked" as const;

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_MODES =
  Object.freeze([
    "inspect",
    "preflight",
    "dry-run",
    "execute",
  ] as const);

export const DEMO4_D4_1C_NON_AUTHORIZING_PREEXECUTION_CAPABILITIES =
  Object.freeze({
    finalizedSnapshotReadDefined:
      true,

    cis8004AgentOfRecheckDefined:
      true,

    reverseReferenceRecheckDefined:
      true,

    cis8OwnerOfKeyRecheckDefined:
      true,

    deployedSchemaRecheckDefined:
      true,

    sdkParameterEquivalenceRecheckDefined:
      true,

    dryRunCapabilityDefined:
      true,

    livePreExecutionDispatchAuthorized:
      false,

    dryRunDispatchAuthorized:
      false,

    walletReadAuthorized:
      false,

    signerCreationAuthorized:
      false,

    transactionConstructionAuthorized:
      false,

    transactionSigningAuthorized:
      false,

    transactionSubmissionAuthorized:
      false,

    paymentAuthorized:
      false,

    d4_1cMutationAuthorized:
      false,
  });

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE =
  Object.freeze({
    network:
      DEMO4_D4_1C_GATE_E_PR314_HANDOFF
        .exactTarget
        .network,

    environment:
      "controlled_concordium_testnet",

    cis8004:
      Object.freeze({
        contractName:
          "CIS-8004",

        contract:
          DEMO4_D4_1C_GATE_E_PR314_HANDOFF
            .exactTarget
            .cis8004
            .contract,

        moduleReference:
          DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT
            .cis8004
            .moduleReference,

        embeddedSchemaSha256:
          DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT
            .cis8004
            .embeddedSchema
            .sha256,

        tokenId:
          DEMO4_D4_1C_GATE_E_PR314_HANDOFF
            .exactTarget
            .cis8004
            .tokenId,

        ownerAccount:
          DEMO4_D4_1C_GATE_E_PR314_HANDOFF
            .exactTarget
            .cis8004
            .ownerAccount,

        agentCard:
          DEMO4_D4_1C_GATE_E_PR314_HANDOFF
            .exactTarget
            .cis8004
            .agentCard,

        receiveName:
          "CIS-8004.setExternalReference",
      }),

    cis8:
      DEMO4_D4_1C_GATE_E_PR314_HANDOFF
        .exactTarget
        .cis8,

    parameter:
      DEMO4_D4_1C_GATE_E_PR314_HANDOFF
        .exactTarget
        .parameter,

    energySafetyCap:
      "100000",

    priorDryRunUsedEnergy:
      DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN
        .invocation
        .usedEnergy,

    submissionLimit:
      1,

    automaticRetry:
      false,

    zeroCcdRequired:
      true,
  });

export const DEMO4_D4_1C_CONTROLLED_EXECUTION_SAFETY =
  Object.freeze({
    testnetOnly:
      true,

    exactlyOneSubmission:
      true,

    automaticRetry:
      false,

    zeroCcdRequired:
      true,

    executeDispatchEnabled:
      false,

    privateKeyReadAuthorized:
      false,

    walletReadAuthorized:
      false,

    signerCreationAuthorized:
      false,

    transactionConstructionAuthorized:
      false,

    transactionSigningAuthorized:
      false,

    transactionSubmissionAuthorized:
      false,

    paymentAuthorized:
      false,

    settlementAuthorized:
      false,

    receiptIssuanceAuthorized:
      false,

    gatewayRuntimeActivationAuthorized:
      false,

    protectedResourceReleaseAuthorized:
      false,

    productionActivationAuthorized:
      false,
  });

export type Demo4D41cControlledExecutionResultV1<T> =
  | {
      readonly ok:
        true;

      readonly value:
        T;
    }
  | {
      readonly ok:
        false;

      readonly reason:
        string;
    };

type UnknownRecord =
  Record<string, unknown>;

function rejected(
  reason:
    string,
): Demo4D41cControlledExecutionResultV1<never> {
  return {
    ok:
      false,

    reason,
  };
}

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

function isLowerHex64(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{64}$/.test(
      value,
    )
  );
}

function isDecimalQuantity(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^(0|[1-9][0-9]*)$/.test(
      value,
    )
  );
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

function sameContract(
  left:
    unknown,
  right:
    unknown,
): boolean {
  if (
    !isRecord(
      left,
    ) ||
    !isRecord(
      right,
    )
  ) {
    return false;
  }

  return (
    String(
      left.index,
    ) ===
      String(
        right.index,
      ) &&
    String(
      left.subindex,
    ) ===
      String(
        right.subindex,
      )
  );
}

function completeExternalReferenceEquals(
  left:
    unknown,
  right:
    Demo4D41cExternalReferenceV1,
): boolean {
  if (
    !isRecord(
      left,
    ) ||
    left.kind !==
      "CIS-8" ||
    !sameContract(
      left.contract,
      right.contract,
    ) ||
    !isRecord(
      left.externalKey,
    )
  ) {
    return false;
  }

  const leftExternalKey =
    left.externalKey;

  if (
    typeof leftExternalKey.namespace !==
      "string" ||
    typeof leftExternalKey.keyType !==
      "string" ||
    typeof leftExternalKey.publicKeyHex !==
      "string"
  ) {
    return false;
  }

  return completeDemo4D41cExternalKeyIdEqualsV1(
    {
      namespace:
        leftExternalKey.namespace,

      keyType:
        leftExternalKey.keyType,

      publicKeyHex:
        leftExternalKey.publicKeyHex,
    },
    right.externalKey,
  );
}

export const DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE =
  Object.freeze({
    implementationDefined:
      true,

    dispatchAuthorized:
      false,

    grpc:
      Object.freeze({
        host:
          "grpc.testnet.concordium.com",

        port:
          20_000,

        tls:
          true,
      }),

    singleLatestFinalizedSnapshot:
      true,

    cis8004:
      Object.freeze({
        embeddedSchemaByteLength:
          5_700,

        embeddedSchemaSha256:
          DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .embeddedSchemaSha256,

        agentOfEntrypoint:
          "agentOf",

        reverseLookupEntrypoint:
          "agentByExternalReference",
      }),

    cis8:
      Object.freeze({
        embeddedSchemaByteLength:
          1_918,

        embeddedSchemaSha256:
          "11312a179a14634042795bb2e075552af1d94eef18b7fc96f680d5a335e23b7e",

        ownerOfKeyEntrypoint:
          "ownerOfKey",

        proofScheme:
          "solana-ed25519",
      }),

    expectedReadOnlyStateQueryCount:
      3,

    parameterByteLength:
      117,

    parameterSha256:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .parameter
        .sha256,

    dryRunAuthorized:
      false,

    walletReadAuthorized:
      false,

    signerCreationAuthorized:
      false,

    transactionConstructionAuthorized:
      false,

    transactionSigningAuthorized:
      false,

    transactionSubmissionAuthorized:
      false,

    paymentAuthorized:
      false,

    d4_1cMutationAuthorized:
      false,
  });

export type Demo4D41cControlledExecutionPlanV1 =
  Readonly<{
    type:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_TYPE;

    version:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_VERSION;

    stage:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_STAGE;

    status:
      "controlled_execution_implementation_locked";

    sourceHandoffStatus:
      "pr314_controlled_attachment_preflight_ready";

    network:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE.network;

    cis8004:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE.cis8004;

    cis8:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE.cis8;

    parameter:
      Readonly<{
        byteLength:
          117;

        sha256:
          string;

        deterministicBytesReverified:
          true;
      }>;

    submissionLimit:
      1;

    submissionAttemptsBefore:
      0;

    remainingSubmissionAttempts:
      1;

    automaticRetryAuthorized:
      false;

    zeroCcdRequired:
      true;

    separateExecutionAuthorizationRequired:
      true;

    transactionExecutionAuthorized:
      false;

    d4_1cAttachmentAuthorized:
      false;

    executeDispatchEnabled:
      false;
  }>;

export function buildDemo4D41cControlledExecutionPlanV1():
Demo4D41cControlledExecutionPlanV1 {
  const handoff =
    DEMO4_D4_1C_GATE_E_PR314_HANDOFF;

  const profile =
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE;

  const gateC =
    DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT;

  const gateD =
    DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN;

  if (
    handoff.established !==
      true ||
    handoff.status !==
      "pr314_controlled_attachment_preflight_ready" ||
    handoff.nextRequiredStep !==
      "pr314_controlled_set_external_reference_requires_separate_authorization" ||
    handoff.futureExecutionBoundary
      .separateAuthorizationRequired !==
      true ||
    handoff.futureExecutionBoundary
      .futureSubmissionCeiling !==
      1 ||
    handoff.futureExecutionBoundary
      .submissionAttemptsBeforePr314 !==
      0 ||
    handoff.futureExecutionBoundary
      .zeroCcdRequired !==
      true ||
    handoff.futureExecutionBoundary
      .automaticRetryAuthorized !==
      false ||
    handoff.futureExecutionBoundary
      .transactionExecutionAuthorized !==
      false ||
    handoff.futureExecutionBoundary
      .d4_1cAttachmentAuthorized !==
      false
  ) {
    throw new Error(
      "unsafe_or_invalid_pr313_gate_e_handoff",
    );
  }

  if (
    gateC.established !==
      true ||
    gateC.finalizedPublicPreflightPassed !==
      true ||
    gateC.cis8004.tokenId !==
      287 ||
    gateC.cis8004.observedStatus !==
      "Active" ||
    gateC.cis8004.ownerMatches !==
      true ||
    gateC.cis8004.agentCardUriMatches !==
      true ||
    gateC.cis8004.agentCardHashMatches !==
      true ||
    gateC.cis8004.externalReferencePresent !==
      false ||
    gateC.exactExternalReferenceUniqueness
      .alreadyAttached !==
      false ||
    gateC.exactExternalReferenceUniqueness
      .unique !==
      true ||
    gateC.cis8.completeExternalKeyMatch !==
      true ||
    gateC.cis8.registered !==
      true ||
    gateC.cis8.observedStatus !==
      "Active" ||
    gateC.cis8.ownerMatches !==
      true
  ) {
    throw new Error(
      "unsafe_or_invalid_gate_c_binding",
    );
  }

  if (
    gateD.established !==
      true ||
    gateD.setExternalReferenceDryRunAttempted !==
      true ||
    gateD.setExternalReferenceDryRunSucceeded !==
      true ||
    gateD.invocation.attachedCcd !==
      "0" ||
    gateD.invocation.energySafetyCap !==
      "100000" ||
    gateD.invocation.automaticRetryAttempted !==
      false ||
    gateD.stateVerification.postDryRunStateUnchanged !==
      true ||
    gateD.stateMutationPerformed !==
      false ||
    gateD.transactionConstructed !==
      false ||
    gateD.transactionSubmitted !==
      false ||
    gateD.paymentAttempted !==
      false ||
    gateD.d4_1cPerformed !==
      false
  ) {
    throw new Error(
      "unsafe_or_invalid_gate_d_binding",
    );
  }

  if (
    profile.cis8004.tokenId !==
      handoff.exactTarget.cis8004.tokenId ||
    profile.cis8004.ownerAccount !==
      handoff.exactTarget.cis8004.ownerAccount ||
    profile.cis8.ownerAccount !==
      handoff.exactTarget.cis8.ownerAccount
  ) {
    throw new Error(
      "preflight_profile_handoff_mismatch",
    );
  }

  const candidate =
    buildDemo4D41cAttachmentCandidateV1();

  const normalizedReference =
    buildDemo4D41cNormalizedExternalReferenceV1(
      candidate,
    );

  if (
    !completeDemo4D41cExternalKeyIdEqualsV1(
      normalizedReference.externalKey,
      candidate.cis8.externalKey,
    )
  ) {
    throw new Error(
      "complete_external_key_id_mismatch",
    );
  }

  const parameterBytes =
    serializeDemo4D41cSetExternalReferenceParameterV1(
      candidate,
    );

  const parameterSha256 =
    sha256Hex(
      parameterBytes,
    );

  if (
    parameterBytes.length !==
      handoff.exactTarget.parameter.byteLength ||
    parameterBytes.length !==
      117 ||
    parameterSha256 !==
      handoff.exactTarget.parameter.sha256
  ) {
    throw new Error(
      "deterministic_parameter_binding_mismatch",
    );
  }

  return Object.freeze({
    type:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_TYPE,

    version:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_VERSION,

    stage:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_STAGE,

    status:
      "controlled_execution_implementation_locked",

    sourceHandoffStatus:
      handoff.status,

    network:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .network,

    cis8004:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .cis8004,

    cis8:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .cis8,

    parameter:
      Object.freeze({
        byteLength:
          117,

        sha256:
          parameterSha256,

        deterministicBytesReverified:
          true,
      }),

    submissionLimit:
      1,

    submissionAttemptsBefore:
      0,

    remainingSubmissionAttempts:
      1,

    automaticRetryAuthorized:
      false,

    zeroCcdRequired:
      true,

    separateExecutionAuthorizationRequired:
      true,

    transactionExecutionAuthorized:
      false,

    d4_1cAttachmentAuthorized:
      false,

    executeDispatchEnabled:
      false,
  });
}

export type Demo4D41cControlledExecutionActivationV1 =
  Readonly<{
    status:
      "inspect_only_execute_locked";

    mode:
      "inspect";

    transactionExecutionAuthorized:
      false;

    d4_1cAttachmentAuthorized:
      false;

    sensitiveCapabilitiesEnabled:
      false;
  }>;

export function validateDemo4D41cControlledExecutionActivationV1(
  input:
    unknown,
): Demo4D41cControlledExecutionResultV1<
  Demo4D41cControlledExecutionActivationV1
> {
  if (
    !isRecord(
      input,
    )
  ) {
    return rejected(
      "invalid_activation",
    );
  }

  if (
    input.mode !==
      "inspect" &&
    input.mode !==
      "execute"
  ) {
    return rejected(
      "invalid_mode",
    );
  }

  const booleans = [
    input.explicitControlledExecutionAuthorizationConfirmed,
    input.walletReadEnabled,
    input.signerCreationEnabled,
    input.transactionConstructionEnabled,
    input.transactionSigningEnabled,
    input.transactionSubmissionEnabled,
    input.paymentEnabled,
  ];

  if (
    booleans.some(
      (value) =>
        typeof value !==
          "boolean",
    )
  ) {
    return rejected(
      "invalid_boolean_literal",
    );
  }

  if (
    input.mode ===
      "execute"
  ) {
    return rejected(
      "execute_dispatch_locked",
    );
  }

  if (
    input.explicitControlledExecutionAuthorizationConfirmed !==
      false ||
    input.walletReadEnabled !==
      false ||
    input.signerCreationEnabled !==
      false ||
    input.transactionConstructionEnabled !==
      false ||
    input.transactionSigningEnabled !==
      false ||
    input.transactionSubmissionEnabled !==
      false ||
    input.paymentEnabled !==
      false
  ) {
    return rejected(
      "initial_slice_capability_forbidden",
    );
  }

  return {
    ok:
      true,

    value:
      Object.freeze({
        status:
          "inspect_only_execute_locked",

        mode:
          "inspect",

        transactionExecutionAuthorized:
          false,

        d4_1cAttachmentAuthorized:
          false,

        sensitiveCapabilitiesEnabled:
          false,
      }),
  };
}


export type Demo4D41cExecutionAuthorizationV1 =
  Readonly<{
    status:
      "controlled_execution_authorized";

    testnetOnly:
      true;

    transactionExecutionAuthorized:
      true;

    d4_1cAttachmentAuthorized:
      true;

    walletReadAuthorized:
      true;

    signerCreationAuthorized:
      true;

    transactionConstructionAuthorized:
      true;

    transactionSigningAuthorized:
      true;

    transactionSubmissionAuthorized:
      true;

    paymentAuthorized:
      false;

    submissionLimit:
      1;

    submissionAttemptsBefore:
      0;

    remainingSubmissionAttempts:
      1;

    automaticRetryAuthorized:
      false;

    zeroCcdRequired:
      true;
  }>;

export function authorizeDemo4D41cControlledExecutionV1(
  input:
    unknown,
): Demo4D41cControlledExecutionResultV1<
  Demo4D41cExecutionAuthorizationV1
> {
  if (
    !isRecord(
      input,
    )
  ) {
    return rejected(
      "invalid_execution_authorization",
    );
  }

  const requiredBooleanFields = [
    "explicitControlledExecutionAuthorizationConfirmed",
    "d4_1cAttachmentAuthorizationConfirmed",
    "testnetOnly",
    "walletReadEnabled",
    "signerCreationEnabled",
    "transactionConstructionEnabled",
    "transactionSigningEnabled",
    "transactionSubmissionEnabled",
    "paymentEnabled",
    "automaticRetryAuthorized",
    "zeroCcdRequired",
    "executeDispatchEnabled",
  ] as const;

  for (
    const field
    of requiredBooleanFields
  ) {
    if (
      typeof input[field] !==
        "boolean"
    ) {
      return rejected(
        "invalid_execution_boolean_literal",
      );
    }
  }

  if (
    input.mode !==
      "execute"
  ) {
    return rejected(
      "execution_mode_required",
    );
  }

  if (
    input.executeDispatchEnabled !==
      true
  ) {
    return rejected(
      "execute_dispatch_locked",
    );
  }

  if (
    input.explicitControlledExecutionAuthorizationConfirmed !==
      true ||
    input.d4_1cAttachmentAuthorizationConfirmed !==
      true
  ) {
    return rejected(
      "explicit_d4_1c_execution_authorization_required",
    );
  }

  if (
    input.testnetOnly !==
      true
  ) {
    return rejected(
      "testnet_only_required",
    );
  }

  if (
    input.walletReadEnabled !==
      true ||
    input.signerCreationEnabled !==
      true ||
    input.transactionConstructionEnabled !==
      true ||
    input.transactionSigningEnabled !==
      true ||
    input.transactionSubmissionEnabled !==
      true
  ) {
    return rejected(
      "required_execution_capability_not_authorized",
    );
  }

  if (
    input.paymentEnabled !==
      false
  ) {
    return rejected(
      "payment_must_remain_disabled",
    );
  }

  if (
    input.submissionLimit !==
      1 ||
    input.submissionAttemptsBefore !==
      0 ||
    input.automaticRetryAuthorized !==
      false ||
    input.zeroCcdRequired !==
      true
  ) {
    return rejected(
      "unsafe_submission_authorization",
    );
  }

  return {
    ok:
      true,

    value:
      Object.freeze({
        status:
          "controlled_execution_authorized",

        testnetOnly:
          true,

        transactionExecutionAuthorized:
          true,

        d4_1cAttachmentAuthorized:
          true,

        walletReadAuthorized:
          true,

        signerCreationAuthorized:
          true,

        transactionConstructionAuthorized:
          true,

        transactionSigningAuthorized:
          true,

        transactionSubmissionAuthorized:
          true,

        paymentAuthorized:
          false,

        submissionLimit:
          1,

        submissionAttemptsBefore:
          0,

        remainingSubmissionAttempts:
          1,

        automaticRetryAuthorized:
          false,

        zeroCcdRequired:
          true,
      }),
  };
}

export type Demo4D41cLivePreExecutionEvidenceV1 =
  Readonly<{
    status:
      "live_preexecution_readiness_confirmed";

    network:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE.network;

    finalizedSnapshot:
      Readonly<{
        finalized:
          true;

        finalizedBlockHash:
          string;

        finalizedBlockHeight:
          string;

        singleFinalizedSnapshotBound:
          true;
      }>;

    cis8004:
      Readonly<{
        moduleReference:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .moduleReference;

        embeddedSchemaSha256:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .embeddedSchemaSha256;

        schemaPresent:
          true;

        tokenId:
          "287";

        tokenPresent:
          true;

        status:
          "Active";

        ownerAccount:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .ownerAccount;

        agentUri:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .agentCard
            .uri;

        metadataHash:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .agentCard
            .sha256;

        externalReferencePresent:
          false;

        revokedAtPresent:
          false;

        revocationReasonPresent:
          false;
      }>;

    reverseReference:
      Readonly<{
        completeExternalReferenceCompared:
          true;

        alreadyAttached:
          false;

        unique:
          true;
      }>;

    cis8:
      Readonly<{
        moduleReference:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8
            .moduleReference;

        status:
          "Active";

        registered:
          true;

        ownerAccount:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8
            .ownerAccount;

        externalKey:
          Demo4D41cExternalKeyIdV1;

        completeExternalKeyMatch:
          true;
      }>;

    parameter:
      Readonly<{
        deterministicByteLength:
          117;

        deterministicSha256:
          string;

        sdkSerializedByteLength:
          117;

        sdkSerializedSha256:
          string;

        exactSdkByteEquivalence:
          true;
      }>;

    dryRunBoundary:
      Readonly<{
        capabilityDefined:
          true;

        authorizationPresent:
          false;

        invocationAttempted:
          false;

        performed:
          false;

        attachedCcd:
          "0";

        energySafetyCap:
          "100000";
      }>;

    safety:
      Readonly<{
        readOnlyStateQueryCount:
          3;

        stateMutationPerformed:
          false;

        privateKeyRead:
          false;

        walletRead:
          false;

        signerCreated:
          false;

        transactionConstructed:
          false;

        transactionSigned:
          false;

        transactionSubmitted:
          false;

        paymentAttempted:
          false;

        d4_1cPerformed:
          false;
      }>;
  }>;

export function validateDemo4D41cLivePreExecutionObservationV1(
  input:
    unknown,
): Demo4D41cControlledExecutionResultV1<
  Demo4D41cLivePreExecutionEvidenceV1
> {
  if (
    !isRecord(
      input,
    ) ||
    !isRecord(
      input.finalizedSnapshot,
    ) ||
    !isRecord(
      input.cis8004,
    ) ||
    !isRecord(
      input.reverseReference,
    ) ||
    !isRecord(
      input.cis8,
    ) ||
    !isRecord(
      input.parameter,
    ) ||
    !isRecord(
      input.dryRunBoundary,
    ) ||
    !isRecord(
      input.safety,
    )
  ) {
    return rejected(
      "invalid_live_preexecution_observation_shape",
    );
  }

  const expected =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  if (
    input.network !==
      expected.network ||
    input.finalizedSnapshot.finalized !==
      true ||
    !isLowerHex64(
      input.finalizedSnapshot.finalizedBlockHash,
    ) ||
    !isDecimalQuantity(
      input.finalizedSnapshot.finalizedBlockHeight,
    ) ||
    input.finalizedSnapshot.singleFinalizedSnapshotBound !==
      true
  ) {
    return rejected(
      "finalized_snapshot_revalidation_failed",
    );
  }

  if (
    !sameContract(
      input.cis8004.contract,
      expected.cis8004.contract,
    ) ||
    input.cis8004.moduleReference !==
      expected.cis8004.moduleReference ||
    input.cis8004.embeddedSchemaByteLength !==
      5700 ||
    input.cis8004.embeddedSchemaSha256 !==
      expected.cis8004.embeddedSchemaSha256 ||
    input.cis8004.schemaPresent !==
      true ||
    input.cis8004.tokenId !==
      "287" ||
    input.cis8004.tokenPresent !==
      true ||
    input.cis8004.status !==
      "Active" ||
    input.cis8004.ownerAccount !==
      expected.cis8004.ownerAccount ||
    input.cis8004.agentUri !==
      expected.cis8004.agentCard.uri ||
    input.cis8004.metadataHash !==
      expected.cis8004.agentCard.sha256 ||
    input.cis8004.externalReferencePresent !==
      false ||
    input.cis8004.revokedAtPresent !==
      false ||
    input.cis8004.revocationReasonPresent !==
      false
  ) {
    return rejected(
      "cis8004_live_revalidation_failed",
    );
  }

  if (
    input.reverseReference.completeExternalReferenceCompared !==
      true ||
    input.reverseReference.alreadyAttached !==
      false ||
    input.reverseReference.unique !==
      true
  ) {
    return rejected(
      "reverse_reference_live_revalidation_failed",
    );
  }

  const cis8ExternalKeyRecord =
    isRecord(
      input.cis8.externalKey,
    )
      ? input.cis8.externalKey
      : null;

  const cis8ExternalKey =
    cis8ExternalKeyRecord !==
      null &&
    typeof cis8ExternalKeyRecord.namespace ===
      "string" &&
    typeof cis8ExternalKeyRecord.keyType ===
      "string" &&
    typeof cis8ExternalKeyRecord.publicKeyHex ===
      "string"
      ? {
          namespace:
            cis8ExternalKeyRecord.namespace,

          keyType:
            cis8ExternalKeyRecord.keyType,

          publicKeyHex:
            cis8ExternalKeyRecord.publicKeyHex,
        }
      : null;

  if (
    !sameContract(
      input.cis8.contract,
      expected.cis8.contract,
    ) ||
    input.cis8.moduleReference !==
      expected.cis8.moduleReference ||
    input.cis8.embeddedSchemaByteLength !==
      1918 ||
    input.cis8.embeddedSchemaSha256 !==
      "11312a179a14634042795bb2e075552af1d94eef18b7fc96f680d5a335e23b7e" ||
    input.cis8.status !==
      "Active" ||
    input.cis8.registered !==
      true ||
    input.cis8.ownerAccount !==
      expected.cis8.ownerAccount ||
    input.cis8.completeExternalKeyMatch !==
      true ||
    cis8ExternalKey ===
      null ||
    !completeDemo4D41cExternalKeyIdEqualsV1(
      cis8ExternalKey,
      expected.cis8.externalKey,
    )
  ) {
    return rejected(
      "cis8_live_revalidation_failed",
    );
  }

  if (
    input.parameter.deterministicByteLength !==
      117 ||
    input.parameter.deterministicSha256 !==
      expected.parameter.sha256 ||
    input.parameter.sdkSerializedByteLength !==
      117 ||
    input.parameter.sdkSerializedSha256 !==
      expected.parameter.sha256 ||
    input.parameter.exactSdkByteEquivalence !==
      true
  ) {
    return rejected(
      "deployed_schema_parameter_revalidation_failed",
    );
  }

  if (
    input.dryRunBoundary.capabilityDefined !==
      true ||
    input.dryRunBoundary.authorizationPresent !==
      false ||
    input.dryRunBoundary.invocationAttempted !==
      false ||
    input.dryRunBoundary.performed !==
      false ||
    input.dryRunBoundary.attachedCcd !==
      "0" ||
    input.dryRunBoundary.energySafetyCap !==
      "100000"
  ) {
    return rejected(
      "dry_run_boundary_must_remain_locked",
    );
  }

  if (
    input.safety.readOnlyStateQueryCount !==
      3 ||
    input.safety.stateMutationPerformed !==
      false ||
    input.safety.privateKeyRead !==
      false ||
    input.safety.walletRead !==
      false ||
    input.safety.signerCreated !==
      false ||
    input.safety.transactionConstructed !==
      false ||
    input.safety.transactionSigned !==
      false ||
    input.safety.transactionSubmitted !==
      false ||
    input.safety.paymentAttempted !==
      false ||
    input.safety.d4_1cPerformed !==
      false
  ) {
    return rejected(
      "unsafe_live_preexecution_observation",
    );
  }

  return {
    ok:
      true,

    value:
      Object.freeze({
        status:
          "live_preexecution_readiness_confirmed",

        network:
          expected.network,

        finalizedSnapshot:
          Object.freeze({
            finalized:
              true,

            finalizedBlockHash:
              input.finalizedSnapshot.finalizedBlockHash,

            finalizedBlockHeight:
              input.finalizedSnapshot.finalizedBlockHeight,

            singleFinalizedSnapshotBound:
              true,
          }),

        cis8004:
          Object.freeze({
            moduleReference:
              expected.cis8004.moduleReference,

            embeddedSchemaSha256:
              expected.cis8004.embeddedSchemaSha256,

            schemaPresent:
              true,

            tokenId:
              "287",

            tokenPresent:
              true,

            status:
              "Active",

            ownerAccount:
              expected.cis8004.ownerAccount,

            agentUri:
              expected.cis8004.agentCard.uri,

            metadataHash:
              expected.cis8004.agentCard.sha256,

            externalReferencePresent:
              false,

            revokedAtPresent:
              false,

            revocationReasonPresent:
              false,
          }),

        reverseReference:
          Object.freeze({
            completeExternalReferenceCompared:
              true,

            alreadyAttached:
              false,

            unique:
              true,
          }),

        cis8:
          Object.freeze({
            moduleReference:
              expected.cis8.moduleReference,

            status:
              "Active",

            registered:
              true,

            ownerAccount:
              expected.cis8.ownerAccount,

            externalKey:
              expected.cis8.externalKey,

            completeExternalKeyMatch:
              true,
          }),

        parameter:
          Object.freeze({
            deterministicByteLength:
              117,

            deterministicSha256:
              expected.parameter.sha256,

            sdkSerializedByteLength:
              117,

            sdkSerializedSha256:
              expected.parameter.sha256,

            exactSdkByteEquivalence:
              true,
          }),

        dryRunBoundary:
          Object.freeze({
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
          }),

        safety:
          Object.freeze({
            readOnlyStateQueryCount:
              3,

            stateMutationPerformed:
              false,

            privateKeyRead:
              false,

            walletRead:
              false,

            signerCreated:
              false,

            transactionConstructed:
              false,

            transactionSigned:
              false,

            transactionSubmitted:
              false,

            paymentAttempted:
              false,

            d4_1cPerformed:
              false,
          }),
      }),
  };
}

export type Demo4D41cFutureFinalizedEvidenceV1 =
  Readonly<{
    status:
      "finalized_external_reference_attachment_confirmed";

    network:
      typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE.network;

    submissionAttempts:
      1;

    automaticRetryAttempted:
      false;

    zeroCcdAttached:
      true;

    transaction:
      Readonly<{
        hash:
          string;

        finalized:
          true;

        finalizedBlockHash:
          string;

        finalizedBlockHeight:
          string;

        transactionType:
          "update";
      }>;

    postAgent:
      Readonly<{
        tokenId:
          "287";

        ownerAccount:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .ownerAccount;

        agentUri:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .agentCard
            .uri;

        metadataHash:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8004
            .agentCard
            .sha256;

        status:
          "Active";

        externalReference:
          Demo4D41cExternalReferenceV1;

        revokedAt:
          null;

        revocationReason:
          null;
      }>;

    reverseLookupTokenId:
      "287";

    cis8PostState:
      Readonly<{
        status:
          "Active";

        ownerAccount:
          typeof DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8
            .ownerAccount;

        externalKey:
          Demo4D41cExternalKeyIdV1;

        proofScheme:
          "solana-ed25519";
      }>;

    safety:
      Readonly<{
        exactlyOneSubmissionAttempted:
          true;

        cis8Mutated:
          false;

        paymentAttempted:
          false;

        settlementAttempted:
          false;

        receiptIssued:
          false;

        gatewayRuntimeActivated:
          false;

        protectedResourceReleased:
          false;

        replayStateMutated:
          false;

        productionActivation:
          false;
      }>;
  }>;

export function validateDemo4D41cFutureFinalizedObservationV1(
  input:
    unknown,
): Demo4D41cControlledExecutionResultV1<
  Demo4D41cFutureFinalizedEvidenceV1
> {
  if (
    !isRecord(
      input,
    ) ||
    !isRecord(
      input.transaction,
    ) ||
    !isRecord(
      input.postAgent,
    ) ||
    !isRecord(
      input.cis8PostState,
    ) ||
    !isRecord(
      input.safety,
    )
  ) {
    return rejected(
      "invalid_finalized_observation_shape",
    );
  }

  const expected =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  const expectedReference =
    buildDemo4D41cNormalizedExternalReferenceV1();

  if (
    input.submissionAttempts !==
      1 ||
    input.automaticRetryAttempted !==
      false ||
    input.zeroCcdAttached !==
      true
  ) {
    return rejected(
      "submission_safety_postcondition_failed",
    );
  }

  if (
    !isLowerHex64(
      input.transaction.hash,
    ) ||
    input.transaction.finalized !==
      true ||
    !isLowerHex64(
      input.transaction.finalizedBlockHash,
    ) ||
    !isDecimalQuantity(
      input.transaction.finalizedBlockHeight,
    ) ||
    input.transaction.transactionType !==
      "update"
  ) {
    return rejected(
      "invalid_finalized_transaction",
    );
  }

  if (
    input.postAgent.tokenId !==
      "287" ||
    input.postAgent.ownerAccount !==
      expected.cis8004.ownerAccount ||
    input.postAgent.agentUri !==
      expected.cis8004.agentCard.uri ||
    input.postAgent.metadataHash !==
      expected.cis8004.agentCard.sha256 ||
    input.postAgent.status !==
      "Active" ||
    input.postAgent.revokedAt !==
      null ||
    input.postAgent.revocationReason !==
      null ||
    !completeExternalReferenceEquals(
      input.postAgent.externalReference,
      expectedReference,
    )
  ) {
    return rejected(
      "cis8004_postcondition_failed",
    );
  }

  if (
    input.reverseLookupTokenId !==
      "287"
  ) {
    return rejected(
      "reverse_lookup_postcondition_failed",
    );
  }

  const cis8ExternalKeyRecord =
    isRecord(
      input.cis8PostState.externalKey,
    )
      ? input.cis8PostState.externalKey
      : null;

  const cis8ExternalKey =
    cis8ExternalKeyRecord !==
      null &&
    typeof cis8ExternalKeyRecord.namespace ===
      "string" &&
    typeof cis8ExternalKeyRecord.keyType ===
      "string" &&
    typeof cis8ExternalKeyRecord.publicKeyHex ===
      "string"
      ? {
          namespace:
            cis8ExternalKeyRecord.namespace,

          keyType:
            cis8ExternalKeyRecord.keyType,

          publicKeyHex:
            cis8ExternalKeyRecord.publicKeyHex,
        }
      : null;

  if (
    input.cis8PostState.status !==
      "Active" ||
    input.cis8PostState.ownerAccount !==
      expected.cis8.ownerAccount ||
    input.cis8PostState.proofScheme !==
      "solana-ed25519" ||
    cis8ExternalKey ===
      null ||
    !completeDemo4D41cExternalKeyIdEqualsV1(
      cis8ExternalKey,
      expected.cis8.externalKey,
    )
  ) {
    return rejected(
      "cis8_immutability_postcondition_failed",
    );
  }

  if (
    input.safety.exactlyOneSubmissionAttempted !==
      true ||
    input.safety.cis8Mutated !==
      false ||
    input.safety.paymentAttempted !==
      false ||
    input.safety.settlementAttempted !==
      false ||
    input.safety.receiptIssued !==
      false ||
    input.safety.gatewayRuntimeActivated !==
      false ||
    input.safety.protectedResourceReleased !==
      false ||
    input.safety.replayStateMutated !==
      false ||
    input.safety.productionActivation !==
      false
  ) {
    return rejected(
      "unsafe_finalized_evidence",
    );
  }

  return {
    ok:
      true,

    value:
      Object.freeze({
        status:
          "finalized_external_reference_attachment_confirmed",

        network:
          expected.network,

        submissionAttempts:
          1,

        automaticRetryAttempted:
          false,

        zeroCcdAttached:
          true,

        transaction:
          Object.freeze({
            hash:
              input.transaction.hash,

            finalized:
              true,

            finalizedBlockHash:
              input.transaction.finalizedBlockHash,

            finalizedBlockHeight:
              input.transaction.finalizedBlockHeight,

            transactionType:
              "update",
          }),

        postAgent:
          Object.freeze({
            tokenId:
              "287",

            ownerAccount:
              expected.cis8004.ownerAccount,

            agentUri:
              expected.cis8004.agentCard.uri,

            metadataHash:
              expected.cis8004.agentCard.sha256,

            status:
              "Active",

            externalReference:
              expectedReference,

            revokedAt:
              null,

            revocationReason:
              null,
          }),

        reverseLookupTokenId:
          "287",

        cis8PostState:
          Object.freeze({
            status:
              "Active",

            ownerAccount:
              expected.cis8.ownerAccount,

            externalKey:
              expected.cis8.externalKey,

            proofScheme:
              "solana-ed25519",
          }),

        safety:
          Object.freeze({
            exactlyOneSubmissionAttempted:
              true,

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
          }),
      }),
  };
}
