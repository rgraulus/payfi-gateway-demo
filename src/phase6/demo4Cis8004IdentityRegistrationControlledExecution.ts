import {
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,
  buildDemo4D41aCis8004RegistrationParameterV1,
  type Demo4D41aCis8004RegistrationParameterV1,
  type Demo4D41aCis8004RegistrationPreflightResultV1,
} from "./demo4Cis8004IdentityRegistrationPreflight";

export const DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE =
  "xcf.demo4.d4-1a.cis8004-registration-controlled-execution" as const;

export const DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION =
  "1" as const;

export const DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES =
  Object.freeze([
    "inspect",
    "dry_run",
    "execute",
  ] as const);

export type Demo4D41aCis8004ControlledExecutionModeV1 =
  (typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES)[number];

export const DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE =
  Object.freeze({
    network:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.network,

    environment:
      "controlled_concordium_testnet",

    grpc:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.grpc,

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

        entrypoint:
          "register",

        receiveName:
          "CIS-8004.register",
      }),

    ownerAccount:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE.ownerAccount,

    canonicalParameter:
      Object.freeze({
        byteLength:
          106,

        sha256:
          "4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b",
      }),

    agentCard:
      Object.freeze({
        uri:
          "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

        metadataHashHex:
          "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
      }),

    submissionLimit:
      1,

    automaticRetry:
      false,

    protectedTokenIds:
      Object.freeze([
        "0",
        "5",
      ] as const),

    evidencePath:
      "docs/evidence/demo4-d4-1a-cis8004-registration-evidence.json",
  });

export const DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_SAFETY =
  Object.freeze({
    testnetOnly:
      true,

    exactlyOneSubmission:
      true,

    automaticRetry:
      false,

    externalReferencePresent:
      false,

    initialMetadataEntryCount:
      0,

    d4_1cAuthorized:
      false,

    revocationAuthorized:
      false,

    gatewayRuntimeActivation:
      false,

    protectedResourceRelease:
      false,

    paymentAttempt:
      false,

    settlementAttempt:
      false,

    receiptIssuance:
      false,
  });

export type Demo4D41aCis8004ControlledExecutionFailureReasonV1 =
  | "invalid_mode"
  | "invalid_boolean_literal"
  | "testnet_only_gate_required"
  | "network_gate_required"
  | "dry_run_gate_forbidden"
  | "dry_run_gate_required"
  | "private_key_gate_forbidden"
  | "private_key_gate_required"
  | "wallet_gate_forbidden"
  | "wallet_gate_required"
  | "execution_gate_forbidden"
  | "execution_gate_required"
  | "evidence_write_gate_forbidden"
  | "evidence_write_gate_required"
  | "automatic_retry_gate_forbidden"
  | "preflight_rejected"
  | "preflight_handoff_invalid"
  | "dry_run_rejected"
  | "dry_run_target_mismatch"
  | "dry_run_parameter_mismatch"
  | "dry_run_not_side_effect_free"
  | "execute_mode_required"
  | "submission_attempt_limit_exceeded"
  | "pre_state_not_finalized"
  | "protected_token_precondition_failed"
  | "submission_authorization_invalid"
  | "finalization_required"
  | "transaction_hash_invalid"
  | "fresh_token_required"
  | "protected_token_mutation_detected"
  | "registration_event_mismatch"
  | "ownership_postcondition_failed"
  | "unsafe_finalized_evidence";

export type Demo4D41aCis8004ControlledExecutionFailureV1 = {
  readonly ok:
    false;

  readonly status:
    "rejected";

  readonly reason:
    Demo4D41aCis8004ControlledExecutionFailureReasonV1;
};

export type Demo4D41aCis8004ControlledExecutionSuccessV1<T> = {
  readonly ok:
    true;

  readonly status:
    "accepted";

  readonly reason:
    "accepted";

  readonly value:
    T;
};

export type Demo4D41aCis8004ControlledExecutionResultV1<T> =
  | Demo4D41aCis8004ControlledExecutionSuccessV1<T>
  | Demo4D41aCis8004ControlledExecutionFailureV1;

export type Demo4D41aCis8004ControlledExecutionActivationDecisionV1 = {
  readonly mode:
    Demo4D41aCis8004ControlledExecutionModeV1;

  readonly testnetOnly:
    true;

  readonly mayReadNetwork:
    true;

  readonly mayDryRun:
    boolean;

  readonly mayReadPrivateKey:
    boolean;

  readonly mayReadWallet:
    boolean;

  readonly mayCreateSigner:
    boolean;

  readonly maySign:
    boolean;

  readonly mayConstructTransaction:
    boolean;

  readonly maySubmitTransaction:
    boolean;

  readonly mayWriteEvidence:
    boolean;

  readonly automaticRetryAuthorized:
    false;
};

export type Demo4D41aCis8004ControlledExecutionPlanV1 = {
  readonly type:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE;

  readonly version:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION;

  readonly status:
    "controlled_execution_ready";

  readonly sourcePreflight:
    Readonly<{
      type:
        typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE;

      version:
        typeof DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION;

      status:
        "preflight_passed";

      transactionExecutionAuthorized:
        false;
    }>;

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network;

  readonly registry:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry;

  readonly ownerAccount:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount;

  readonly registrationParameter:
    Demo4D41aCis8004RegistrationParameterV1;

  readonly canonicalParameter:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter;

  readonly submissionLimit:
    1;

  readonly automaticRetryAuthorized:
    false;

  readonly protectedTokenIds:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.protectedTokenIds;

  readonly evidencePath:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.evidencePath;

  readonly transactionExecutionAuthorized:
    false;
};

export type Demo4D41aCis8004DryRunObservationV1 = {
  readonly ok:
    boolean;

  readonly finalizedState:
    boolean;

  readonly network:
    string;

  readonly contract:
    Readonly<{
      index:
        string;

      subindex:
        string;
    }>;

  readonly receiveName:
    string;

  readonly parameterByteLength:
    number;

  readonly parameterSha256:
    string;

  readonly usedEnergy:
    string;

  readonly returnValuePresent:
    boolean;

  readonly walletRead:
    boolean;

  readonly privateKeyRead:
    boolean;

  readonly signerCreated:
    boolean;

  readonly signingAttempted:
    boolean;

  readonly transactionConstructed:
    boolean;

  readonly transactionSubmitted:
    boolean;

  readonly automaticRetryAttempted:
    boolean;
};

export type Demo4D41aCis8004ValidatedDryRunV1 = {
  readonly status:
    "dry_run_passed";

  readonly finalizedState:
    true;

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network;

  readonly contract:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry.contract;

  readonly receiveName:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry.receiveName;

  readonly parameterByteLength:
    106;

  readonly parameterSha256:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter.sha256;

  readonly usedEnergy:
    string;

  readonly sideEffectFree:
    true;
};

export type Demo4D41aCis8004ExecutionPreStateV1 = {
  readonly finalized:
    boolean;

  readonly protectedToken0Present:
    boolean;

  readonly protectedToken5Present:
    boolean;
};

export type Demo4D41aCis8004SubmissionAuthorizationV1 = {
  readonly status:
    "submission_authorized";

  readonly mode:
    "execute";

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network;

  readonly ownerAccount:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount;

  readonly submissionLimit:
    1;

  readonly submissionAttemptsBefore:
    0;

  readonly remainingSubmissionAttempts:
    1;

  readonly automaticRetryAuthorized:
    false;

  readonly transactionExecutionAuthorized:
    true;
};

export type Demo4D41aCis8004FinalizedExecutionObservationV1 = {
  readonly submissionAuthorization:
    Demo4D41aCis8004SubmissionAuthorizationV1;

  readonly submissionAttempts:
    number;

  readonly automaticRetryAttempted:
    boolean;

  readonly transaction:
    Readonly<{
      hash:
        string;

      finalized:
        boolean;

      finalizedBlockHash:
        string;

      energyCost:
        string;

      costMicroCcd:
        string;

      transactionType:
        string;
    }>;

  readonly registrationEvent:
    Readonly<{
      tokenId:
        string;

      owner:
        string;

      agentUri:
        string;

      metadataHashHex:
        string;

      externalReferencePresent:
        boolean;

      initialMetadataEntryCount:
        number;
    }>;

  readonly freshTokenProof:
    Readonly<{
      readonly tokenId:
        string;

      readonly tokenAbsentAtPreState:
        boolean;

      readonly preStateFinalized:
        boolean;

      readonly preStateFinalizedBlockHash:
        string;
    }>;

  readonly ownershipPostcondition:
    Readonly<{
      tokenId:
        string;

      registrationExists:
        boolean;

      owner:
        string;

      agentUri:
        string;

      metadataHashHex:
        string;

      finalized:
        boolean;

      finalizedBlockHash:
        string;
    }>;

  readonly protectedTokens:
    Readonly<{
      token0Unchanged:
        boolean;

      token5Unchanged:
        boolean;
    }>;

  readonly safety:
    Readonly<{
      gatewayRuntimeActivated:
        boolean;

      protectedResourceReleased:
        boolean;

      paymentAttempted:
        boolean;

      settlementAttempted:
        boolean;

      receiptIssued:
        boolean;

      d4_1cAttached:
        boolean;

      revocationAttempted:
        boolean;
    }>;
};

export type Demo4D41aCis8004SanitizedFinalizedEvidenceV1 = {
  readonly type:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE;

  readonly version:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION;

  readonly status:
    "finalized_registration_confirmed";

  readonly network:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network;

  readonly registry:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry;

  readonly ownerAccount:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount;

  readonly canonicalParameter:
    typeof DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter;

  readonly transaction:
    Demo4D41aCis8004FinalizedExecutionObservationV1["transaction"];

  readonly registration:
    Demo4D41aCis8004FinalizedExecutionObservationV1["registrationEvent"];

  readonly freshTokenProof:
    Demo4D41aCis8004FinalizedExecutionObservationV1["freshTokenProof"];

  readonly ownershipPostcondition:
    Demo4D41aCis8004FinalizedExecutionObservationV1["ownershipPostcondition"];

  readonly protectedTokens:
    Readonly<{
      token0Unchanged:
        true;

      token5Unchanged:
        true;
    }>;

  readonly safety:
    Readonly<{
      exactlyOneSubmissionAttempted:
        true;

      automaticRetryAttempted:
        false;

      externalReferencePresent:
        false;

      initialMetadataEntryCount:
        0;

      gatewayRuntimeActivated:
        false;

      protectedResourceReleased:
        false;

      paymentAttempted:
        false;

      settlementAttempted:
        false;

      receiptIssued:
        false;

      d4_1cAttached:
        false;

      revocationAttempted:
        false;
    }>;
};

function failure<T>(
  reason:
    Demo4D41aCis8004ControlledExecutionFailureReasonV1,
): Demo4D41aCis8004ControlledExecutionResultV1<T> {
  return Object.freeze({
    ok:
      false,

    status:
      "rejected",

    reason,
  });
}

function success<T>(
  value:
    T,
): Demo4D41aCis8004ControlledExecutionResultV1<T> {
  return Object.freeze({
    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    value,
  });
}

function literalBoolean(
  value:
    unknown,
): boolean | null {
  if (
    value === true ||
    value === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === undefined
  ) {
    return false;
  }

  return null;
}

function parseMode(
  value:
    unknown,
): Demo4D41aCis8004ControlledExecutionModeV1 | null {
  const candidate =
    value === undefined
      ? "inspect"
      : value;

  if (
    typeof candidate === "string" &&
    (
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES as readonly string[]
    ).includes(candidate)
  ) {
    return candidate as Demo4D41aCis8004ControlledExecutionModeV1;
  }

  return null;
}

function sameContract(
  value:
    Readonly<{
      index:
        string;

      subindex:
        string;
    }>,
): boolean {
  return (
    value.index ===
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .registry
        .contract
        .index &&
    value.subindex ===
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .registry
        .contract
        .subindex
  );
}

function nonEmptyString(
  value:
    unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

export function validateDemo4D41aCis8004ControlledExecutionActivationV1(
  input: {
    readonly mode?:
      unknown;

    readonly testnetOnly?:
      unknown;

    readonly networkReadEnabled?:
      unknown;

    readonly dryRunEnabled?:
      unknown;

    readonly privateKeyReadEnabled?:
      unknown;

    readonly walletReadEnabled?:
      unknown;

    readonly executionEnabled?:
      unknown;

    readonly evidenceWriteEnabled?:
      unknown;

    readonly automaticRetryEnabled?:
      unknown;
  },
): Demo4D41aCis8004ControlledExecutionResultV1<
  Demo4D41aCis8004ControlledExecutionActivationDecisionV1
> {
  const mode =
    parseMode(
      input.mode,
    );

  if (
    mode === null
  ) {
    return failure(
      "invalid_mode",
    );
  }

  const testnetOnly =
    literalBoolean(
      input.testnetOnly,
    );

  const networkRead =
    literalBoolean(
      input.networkReadEnabled,
    );

  const dryRun =
    literalBoolean(
      input.dryRunEnabled,
    );

  const privateKeyRead =
    literalBoolean(
      input.privateKeyReadEnabled,
    );

  const walletRead =
    literalBoolean(
      input.walletReadEnabled,
    );

  const execution =
    literalBoolean(
      input.executionEnabled,
    );

  const evidenceWrite =
    literalBoolean(
      input.evidenceWriteEnabled,
    );

  const automaticRetry =
    literalBoolean(
      input.automaticRetryEnabled,
    );

  if (
    testnetOnly === null ||
    networkRead === null ||
    dryRun === null ||
    privateKeyRead === null ||
    walletRead === null ||
    execution === null ||
    evidenceWrite === null ||
    automaticRetry === null
  ) {
    return failure(
      "invalid_boolean_literal",
    );
  }

  if (
    testnetOnly !== true
  ) {
    return failure(
      "testnet_only_gate_required",
    );
  }

  if (
    networkRead !== true
  ) {
    return failure(
      "network_gate_required",
    );
  }

  if (
    automaticRetry === true
  ) {
    return failure(
      "automatic_retry_gate_forbidden",
    );
  }

  if (
    mode === "inspect"
  ) {
    if (dryRun === true) return failure("dry_run_gate_forbidden");
    if (privateKeyRead === true) return failure("private_key_gate_forbidden");
    if (walletRead === true) return failure("wallet_gate_forbidden");
    if (execution === true) return failure("execution_gate_forbidden");
    if (evidenceWrite === true) return failure("evidence_write_gate_forbidden");

    return success(
      Object.freeze({
        mode,

        testnetOnly:
          true,

        mayReadNetwork:
          true,

        mayDryRun:
          false,

        mayReadPrivateKey:
          false,

        mayReadWallet:
          false,

        mayCreateSigner:
          false,

        maySign:
          false,

        mayConstructTransaction:
          false,

        maySubmitTransaction:
          false,

        mayWriteEvidence:
          false,

        automaticRetryAuthorized:
          false,
      }),
    );
  }

  if (
    dryRun !== true
  ) {
    return failure(
      "dry_run_gate_required",
    );
  }

  if (
    mode === "dry_run"
  ) {
    if (privateKeyRead === true) return failure("private_key_gate_forbidden");
    if (walletRead === true) return failure("wallet_gate_forbidden");
    if (execution === true) return failure("execution_gate_forbidden");
    if (evidenceWrite === true) return failure("evidence_write_gate_forbidden");

    return success(
      Object.freeze({
        mode,

        testnetOnly:
          true,

        mayReadNetwork:
          true,

        mayDryRun:
          true,

        mayReadPrivateKey:
          false,

        mayReadWallet:
          false,

        mayCreateSigner:
          false,

        maySign:
          false,

        mayConstructTransaction:
          false,

        maySubmitTransaction:
          false,

        mayWriteEvidence:
          false,

        automaticRetryAuthorized:
          false,
      }),
    );
  }

  if (
    privateKeyRead !== true
  ) {
    return failure(
      "private_key_gate_required",
    );
  }

  if (
    walletRead !== true
  ) {
    return failure(
      "wallet_gate_required",
    );
  }

  if (
    execution !== true
  ) {
    return failure(
      "execution_gate_required",
    );
  }

  if (
    evidenceWrite !== true
  ) {
    return failure(
      "evidence_write_gate_required",
    );
  }

  return success(
    Object.freeze({
      mode:
        "execute",

      testnetOnly:
        true,

      mayReadNetwork:
        true,

      mayDryRun:
        true,

      mayReadPrivateKey:
        true,

      mayReadWallet:
        true,

      mayCreateSigner:
        true,

      maySign:
        true,

      mayConstructTransaction:
        true,

      maySubmitTransaction:
        true,

      mayWriteEvidence:
        true,

      automaticRetryAuthorized:
        false,
    }),
  );
}

export function buildDemo4D41aCis8004ControlledExecutionPlanV1(
  preflight:
    Demo4D41aCis8004RegistrationPreflightResultV1,
): Demo4D41aCis8004ControlledExecutionResultV1<
  Demo4D41aCis8004ControlledExecutionPlanV1
> {
  if (
    preflight.ok !== true
  ) {
    return failure(
      "preflight_rejected",
    );
  }

  if (
    preflight.status !== "accepted" ||
    preflight.plan.status !== "preflight_passed" ||
    preflight.plan.nextStage !== "controlled_execution_pr" ||
    preflight.plan.transactionExecutionAuthorized !== false ||
    preflight.plan.network !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network ||
    preflight.plan.ownerAccount !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount
  ) {
    return failure(
      "preflight_handoff_invalid",
    );
  }

  return success(
    Object.freeze({
      type:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE,

      version:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION,

      status:
        "controlled_execution_ready",

      sourcePreflight:
        Object.freeze({
          type:
            DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,

          version:
            DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,

          status:
            "preflight_passed",

          transactionExecutionAuthorized:
            false,
        }),

      network:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network,

      registry:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry,

      ownerAccount:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount,

      registrationParameter:
        buildDemo4D41aCis8004RegistrationParameterV1(),

      canonicalParameter:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter,

      submissionLimit:
        1,

      automaticRetryAuthorized:
        false,

      protectedTokenIds:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.protectedTokenIds,

      evidencePath:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.evidencePath,

      transactionExecutionAuthorized:
        false,
    }),
  );
}

export function validateDemo4D41aCis8004DryRunObservationV1(
  input:
    Demo4D41aCis8004DryRunObservationV1,
): Demo4D41aCis8004ControlledExecutionResultV1<
  Demo4D41aCis8004ValidatedDryRunV1
> {
  if (
    input.ok !== true ||
    input.finalizedState !== true
  ) {
    return failure(
      "dry_run_rejected",
    );
  }

  if (
    input.network !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network ||
    sameContract(
      input.contract,
    ) !== true ||
    input.receiveName !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .registry
        .receiveName
  ) {
    return failure(
      "dry_run_target_mismatch",
    );
  }

  if (
    input.parameterByteLength !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .canonicalParameter
        .byteLength ||
    input.parameterSha256 !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .canonicalParameter
        .sha256
  ) {
    return failure(
      "dry_run_parameter_mismatch",
    );
  }

  if (
    input.walletRead === true ||
    input.privateKeyRead === true ||
    input.signerCreated === true ||
    input.signingAttempted === true ||
    input.transactionConstructed === true ||
    input.transactionSubmitted === true ||
    input.automaticRetryAttempted === true
  ) {
    return failure(
      "dry_run_not_side_effect_free",
    );
  }

  return success(
    Object.freeze({
      status:
        "dry_run_passed",

      finalizedState:
        true,

      network:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network,

      contract:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
          .registry
          .contract,

      receiveName:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
          .registry
          .receiveName,

      parameterByteLength:
        106,

      parameterSha256:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
          .canonicalParameter
          .sha256,

      usedEnergy:
        input.usedEnergy,

      sideEffectFree:
        true,
    }),
  );
}

export function authorizeDemo4D41aCis8004SubmissionV1(
  input: {
    readonly activation:
      Demo4D41aCis8004ControlledExecutionActivationDecisionV1;

    readonly plan:
      Demo4D41aCis8004ControlledExecutionPlanV1;

    readonly dryRun:
      Demo4D41aCis8004ValidatedDryRunV1;

    readonly preState:
      Demo4D41aCis8004ExecutionPreStateV1;

    readonly submissionAttemptsBefore:
      number;
  },
): Demo4D41aCis8004ControlledExecutionResultV1<
  Demo4D41aCis8004SubmissionAuthorizationV1
> {
  if (
    input.activation.mode !== "execute" ||
    input.activation.maySubmitTransaction !== true ||
    input.activation.mayWriteEvidence !== true ||
    input.activation.automaticRetryAuthorized !== false
  ) {
    return failure(
      "execute_mode_required",
    );
  }

  if (
    input.plan.transactionExecutionAuthorized !== false ||
    input.plan.submissionLimit !== 1 ||
    input.plan.automaticRetryAuthorized !== false ||
    input.dryRun.status !== "dry_run_passed"
  ) {
    return failure(
      "submission_authorization_invalid",
    );
  }

  if (
    input.submissionAttemptsBefore !== 0
  ) {
    return failure(
      "submission_attempt_limit_exceeded",
    );
  }

  if (
    input.preState.finalized !== true
  ) {
    return failure(
      "pre_state_not_finalized",
    );
  }

  if (
    input.preState.protectedToken0Present !== true ||
    input.preState.protectedToken5Present !== true
  ) {
    return failure(
      "protected_token_precondition_failed",
    );
  }

  return success(
    Object.freeze({
      status:
        "submission_authorized",

      mode:
        "execute",

      network:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network,

      ownerAccount:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount,

      submissionLimit:
        1,

      submissionAttemptsBefore:
        0,

      remainingSubmissionAttempts:
        1,

      automaticRetryAuthorized:
        false,

      transactionExecutionAuthorized:
        true,
    }),
  );
}

export function buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1(
  input:
    Demo4D41aCis8004FinalizedExecutionObservationV1,
): Demo4D41aCis8004ControlledExecutionResultV1<
  Demo4D41aCis8004SanitizedFinalizedEvidenceV1
> {
  if (
    input.submissionAuthorization.status !== "submission_authorized" ||
    input.submissionAuthorization.transactionExecutionAuthorized !== true ||
    input.submissionAuthorization.automaticRetryAuthorized !== false
  ) {
    return failure(
      "submission_authorization_invalid",
    );
  }

  if (
    input.submissionAttempts !== 1
  ) {
    return failure(
      "submission_attempt_limit_exceeded",
    );
  }

  if (
    input.automaticRetryAttempted === true
  ) {
    return failure(
      "unsafe_finalized_evidence",
    );
  }

  if (
    input.transaction.finalized !== true ||
    input.freshTokenProof.preStateFinalized !== true ||
    input.ownershipPostcondition.finalized !== true
  ) {
    return failure(
      "finalization_required",
    );
  }

  if (
    nonEmptyString(
      input.transaction.hash,
    ) !== true ||
    nonEmptyString(
      input.transaction.finalizedBlockHash,
    ) !== true ||
    nonEmptyString(
      input.ownershipPostcondition.finalizedBlockHash,
    ) !== true ||
    nonEmptyString(
      input.freshTokenProof.preStateFinalizedBlockHash,
    ) !== true
  ) {
    return failure(
      "transaction_hash_invalid",
    );
  }

  if (
    input.transaction.finalizedBlockHash !==
      input.ownershipPostcondition.finalizedBlockHash ||
    input.freshTokenProof.preStateFinalizedBlockHash ===
      input.transaction.finalizedBlockHash
  ) {
    return failure(
      "finalization_required",
    );
  }

  if (
    input.registrationEvent.tokenId === "0" ||
    input.registrationEvent.tokenId === "5" ||
    nonEmptyString(
      input.registrationEvent.tokenId,
    ) !== true ||
    input.freshTokenProof.tokenId !==
      input.registrationEvent.tokenId ||
    input.freshTokenProof.tokenAbsentAtPreState !== true
  ) {
    return failure(
      "fresh_token_required",
    );
  }

  if (
    input.protectedTokens.token0Unchanged !== true ||
    input.protectedTokens.token5Unchanged !== true
  ) {
    return failure(
      "protected_token_mutation_detected",
    );
  }

  if (
    input.registrationEvent.owner !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount ||
    input.registrationEvent.agentUri !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.agentCard.uri ||
    input.registrationEvent.metadataHashHex !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .agentCard
        .metadataHashHex ||
    input.registrationEvent.externalReferencePresent !== false ||
    input.registrationEvent.initialMetadataEntryCount !== 0
  ) {
    return failure(
      "registration_event_mismatch",
    );
  }

  if (
    input.ownershipPostcondition.tokenId !==
      input.registrationEvent.tokenId ||
    input.ownershipPostcondition.registrationExists !== true ||
    input.ownershipPostcondition.owner !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount ||
    input.ownershipPostcondition.agentUri !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.agentCard.uri ||
    input.ownershipPostcondition.metadataHashHex !==
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .agentCard
        .metadataHashHex
  ) {
    return failure(
      "ownership_postcondition_failed",
    );
  }

  if (
    input.safety.gatewayRuntimeActivated === true ||
    input.safety.protectedResourceReleased === true ||
    input.safety.paymentAttempted === true ||
    input.safety.settlementAttempted === true ||
    input.safety.receiptIssued === true ||
    input.safety.d4_1cAttached === true ||
    input.safety.revocationAttempted === true
  ) {
    return failure(
      "unsafe_finalized_evidence",
    );
  }

  return success(
    Object.freeze({
      type:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE,

      version:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION,

      status:
        "finalized_registration_confirmed",

      network:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network,

      registry:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.registry,

      ownerAccount:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount,

      canonicalParameter:
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter,

      transaction:
        Object.freeze({
          ...input.transaction,
        }),

      registration:
        Object.freeze({
          ...input.registrationEvent,
        }),

      freshTokenProof:
        Object.freeze({
          ...input.freshTokenProof,
        }),

      ownershipPostcondition:
        Object.freeze({
          ...input.ownershipPostcondition,
        }),

      protectedTokens:
        Object.freeze({
          token0Unchanged:
            true,

          token5Unchanged:
            true,
        }),

      safety:
        Object.freeze({
          exactlyOneSubmissionAttempted:
            true,

          automaticRetryAttempted:
            false,

          externalReferencePresent:
            false,

          initialMetadataEntryCount:
            0,

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
        }),
    }),
  );
}
