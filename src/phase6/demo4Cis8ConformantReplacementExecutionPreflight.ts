type UnknownRecord =
  Record<string, unknown>;

export type Demo4D41bReplacementExecutionPreflightResultV1<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type Demo4D41bReplacementExecutionPreflightPlanV1 = {
  readonly status:
    "execution_preflight_authorized";

  readonly testnetOnly: true;
  readonly zeroCcdRequired: true;
  readonly energySafetyCap: "100000";

  readonly submissionAttemptsBefore: 0;
  readonly remainingSubmissionAttempts: 1;
  readonly automaticRetryAuthorized: false;

  readonly finalizedNetworkReadAuthorized: true;
  readonly replacementPrivateKeyReadAuthorized: true;
  readonly cis8MessageSigningAuthorized: true;
  readonly registerExternalKeyDryRunAuthorized: true;

  readonly walletReadAuthorized: false;
  readonly accountSignerCreationAuthorized: false;
  readonly transactionConstructionAuthorized: false;
  readonly transactionSigningAuthorized: false;
  readonly transactionSubmissionAuthorized: false;
  readonly submissionAttemptConsumptionAuthorized: false;
};

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function rejected<T>(
  reason: string,
): Demo4D41bReplacementExecutionPreflightResultV1<T> {
  return {
    ok: false,
    reason,
  };
}

export function authorizeDemo4D41bReplacementExecutionPreflightV1(
  input: unknown,
): Demo4D41bReplacementExecutionPreflightResultV1<
  Demo4D41bReplacementExecutionPreflightPlanV1
> {
  if (!isRecord(input)) {
    return rejected("invalid_authorization");
  }

  if (
    input.explicitExecutionPreflightAuthorizationConfirmed !==
      true ||
    input.testnetOnly !== true ||
    input.zeroCcdRequired !== true
  ) {
    return rejected(
      "unsafe_authorization_state",
    );
  }

  if (
    input.submissionAttemptsBefore !== 0 ||
    input.remainingSubmissionAttempts !== 1
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
    input.walletReadEnabled !== false ||
    input.accountSignerCreationEnabled !== false ||
    input.transactionConstructionEnabled !== false ||
    input.transactionSigningEnabled !== false ||
    input.transactionSubmissionEnabled !== false ||
    input.submissionAttemptConsumptionEnabled !== false
  ) {
    return rejected(
      "transaction_boundary_violation",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      status:
        "execution_preflight_authorized",

      testnetOnly: true,
      zeroCcdRequired: true,
      energySafetyCap: "100000",

      submissionAttemptsBefore: 0,
      remainingSubmissionAttempts: 1,
      automaticRetryAuthorized: false,

      finalizedNetworkReadAuthorized: true,
      replacementPrivateKeyReadAuthorized: true,
      cis8MessageSigningAuthorized: true,
      registerExternalKeyDryRunAuthorized: true,

      walletReadAuthorized: false,
      accountSignerCreationAuthorized: false,
      transactionConstructionAuthorized: false,
      transactionSigningAuthorized: false,
      transactionSubmissionAuthorized: false,
      submissionAttemptConsumptionAuthorized: false,
    }),
  };
}

function findValues(
  value: unknown,
  target: string,
  found: unknown[] = [],
): unknown[] {
  if (Array.isArray(value)) {
    for (const child of value) {
      findValues(child, target, found);
    }
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === target) {
        found.push(child);
      }

      findValues(child, target, found);
    }
  }

  return found;
}

export type Demo4D41bReplacementExecutionPreflightArtifactBindingV1 = {
  readonly authorizationArtifactSha256: string;
  readonly authorizationInputCheckpointSha256: string;

  readonly gate4SubmissionLimit: 1;
  readonly submissionAttemptsBefore: 0;
  readonly remainingSubmissionAttempts: 1;

  readonly transactionExecutionAuthorized: false;
  readonly automaticRetryAuthorized: false;
  readonly zeroCcdRequired: true;

  readonly transactionConstructed: false;
  readonly transactionSigned: false;
  readonly transactionSubmitted: false;
};

export function bindDemo4D41bReplacementExecutionPreflightArtifactsV1(
  input: unknown,
): Demo4D41bReplacementExecutionPreflightResultV1<
  Demo4D41bReplacementExecutionPreflightArtifactBindingV1
> {
  if (
    !isRecord(input) ||
    !isRecord(input.authorizationArtifact) ||
    !isRecord(input.checkpoint) ||
    typeof input.authorizationArtifactSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(
      input.authorizationArtifactSha256,
    )
  ) {
    return rejected("invalid_artifact_binding");
  }

  const artifact = input.authorizationArtifact;
  const checkpoint = input.checkpoint;

  if (
    artifact.status !== "authorized" ||
    artifact.gate !== 4 ||
    !isRecord(artifact.authorization) ||
    !isRecord(artifact.sourceHashes)
  ) {
    return rejected(
      "invalid_gate4_authorization_artifact",
    );
  }

  const authorization = artifact.authorization;

  if (
    authorization.status !==
      "gate4_submission_authorized" ||
    authorization.gate4SubmissionLimit !== 1 ||
    authorization.submissionAttemptsBefore !== 0 ||
    authorization.remainingSubmissionAttempts !== 1 ||
    authorization.transactionExecutionAuthorized !== false ||
    authorization.automaticRetryAuthorized !== false ||
    authorization.zeroCcdRequired !== true
  ) {
    return rejected(
      "unsafe_gate4_authorization_state",
    );
  }

  const statuses = findValues(
    checkpoint,
    "checkpointStatus",
  );

  const nextSteps = findValues(
    checkpoint,
    "nextRequiredStep",
  );

  if (
    statuses.length !== 1 ||
    statuses[0] !==
      "gate4_exactly_one_submission_authorized_execution_preflight_pending" ||
    nextSteps.length !== 1 ||
    nextSteps[0] !==
      "controlled_gate4_execution_preflight_requires_separate_authorization"
  ) {
    return rejected(
      "checkpoint_not_ready_for_execution_preflight",
    );
  }

  if (
    !isRecord(checkpoint.actualGate3State) ||
    checkpoint.actualGate3State
      .explicitRealGate4AuthorizationConfirmed !== true ||
    !isRecord(checkpoint.gate4AuthorizationState)
  ) {
    return rejected(
      "checkpoint_authorization_missing",
    );
  }

  const state =
    checkpoint.gate4AuthorizationState;

  if (
    state.authorizationArtifactSha256 !==
      input.authorizationArtifactSha256 ||
    state.status !==
      "gate4_submission_authorized" ||
    state.gate4SubmissionLimit !== 1 ||
    state.submissionAttemptsBefore !== 0 ||
    state.remainingSubmissionAttempts !== 1 ||
    state.transactionExecutionAuthorized !== false ||
    state.automaticRetryAuthorized !== false ||
    state.zeroCcdRequired !== true ||
    state.transactionConstructed !== false ||
    state.transactionSigned !== false ||
    state.transactionSubmitted !== false ||
    typeof state.authorizationInputCheckpointSha256 !==
      "string" ||
    state.authorizationInputCheckpointSha256 !==
      artifact.sourceHashes.gate3CheckpointSha256
  ) {
    return rejected(
      "checkpoint_artifact_binding_mismatch",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      authorizationArtifactSha256:
        input.authorizationArtifactSha256,

      authorizationInputCheckpointSha256:
        state.authorizationInputCheckpointSha256,

      gate4SubmissionLimit: 1,
      submissionAttemptsBefore: 0,
      remainingSubmissionAttempts: 1,

      transactionExecutionAuthorized: false,
      automaticRetryAuthorized: false,
      zeroCcdRequired: true,

      transactionConstructed: false,
      transactionSigned: false,
      transactionSubmitted: false,
    }),
  };
}

export type Demo4D41bReplacementExecutionPreflightEvidenceBindingV1 = {
  readonly publicPreflightArtifactSha256: string;
  readonly privatePreflightArtifactSha256: string;

  readonly replacementPublicKeyHex: string;
  readonly ownerAccountBytesHex: string;
  readonly concordiumGenesisHashBytesHex: string;

  readonly ownerOfKeyStatus: "unregistered";

  readonly canonicalMessageByteLength: 249;
  readonly canonicalMessageSha256: string;

  readonly signatureByteLength: 64;
  readonly signatureLocallyVerified: true;

  readonly registrationParameterByteLength: 180;
  readonly registrationParameterSha256: string;

  readonly privateKeyMaterialIncluded: false;
  readonly rawSignatureIncluded: false;
  readonly walletMaterialIncluded: false;

  readonly walletRead: false;
  readonly transactionConstructed: false;
  readonly transactionSubmitted: false;
};

export function bindDemo4D41bReplacementExecutionPreflightEvidenceV1(
  input: unknown,
): Demo4D41bReplacementExecutionPreflightResultV1<
  Demo4D41bReplacementExecutionPreflightEvidenceBindingV1
> {
  if (
    !isRecord(input) ||
    !isRecord(input.publicPreflightArtifact) ||
    !isRecord(input.privatePreflightArtifact) ||
    !isRecord(input.gate4AuthorizationArtifact) ||
    typeof input.publicPreflightArtifactSha256 !==
      "string" ||
    typeof input.privatePreflightArtifactSha256 !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      input.publicPreflightArtifactSha256,
    ) ||
    !/^[0-9a-f]{64}$/.test(
      input.privatePreflightArtifactSha256,
    )
  ) {
    return rejected(
      "invalid_evidence_binding",
    );
  }

  const publicArtifact =
    input.publicPreflightArtifact;

  const privateArtifact =
    input.privatePreflightArtifact;

  const authorizationArtifact =
    input.gate4AuthorizationArtifact;

  if (
    publicArtifact.type !==
      "xcf.demo4.d4-1b.cis8-conformant-replacement-public-preflight-evidence" ||
    publicArtifact.version !== "1" ||
    publicArtifact.status !== "accepted" ||
    publicArtifact.gate !== 3 ||
    publicArtifact.environment !==
      "controlled_public_read_only_testnet" ||
    !isRecord(publicArtifact.evidence) ||
    privateArtifact.status !== "accepted" ||
    privateArtifact.gate !== 3 ||
    !isRecord(privateArtifact.evidence) ||
    !isRecord(privateArtifact.facts) ||
    !isRecord(privateArtifact.runtime) ||
    !isRecord(privateArtifact.sourceHashes) ||
    authorizationArtifact.status !== "authorized" ||
    authorizationArtifact.gate !== 4 ||
    !isRecord(authorizationArtifact.authorization) ||
    !isRecord(authorizationArtifact.sourceHashes)
  ) {
    return rejected(
      "invalid_evidence_artifact",
    );
  }

  const publicEvidence =
    publicArtifact.evidence;

  const privateEvidence =
    privateArtifact.evidence;

  const privateFacts =
    privateArtifact.facts;

  const privateRuntime =
    privateArtifact.runtime;

  const privateSourceHashes =
    privateArtifact.sourceHashes;

  const authorization =
    authorizationArtifact.authorization;

  const authorizationSourceHashes =
    authorizationArtifact.sourceHashes;

  if (
    privateSourceHashes
      .publicPreflightEvidenceSha256 !==
      input.publicPreflightArtifactSha256 ||
    authorizationSourceHashes
      .privatePreflightEvidenceSha256 !==
      input.privatePreflightArtifactSha256
  ) {
    return rejected(
      "evidence_hash_chain_mismatch",
    );
  }

  if (
    !isRecord(privateEvidence.publicPreflight) ||
    privateEvidence.publicPreflight
      .replacementPublicKeyHex !==
      publicEvidence.replacementPublicKeyHex ||
    privateEvidence.publicPreflight
      .ownerAccountBytesHex !==
      publicEvidence.ownerAccountBytesHex ||
    privateEvidence.publicPreflight
      .concordiumGenesisHashBytesHex !==
      publicEvidence.concordiumGenesisHashBytesHex ||
    privateEvidence.publicPreflight
      .canonicalMessageSha256 !==
      publicEvidence.canonicalMessageSha256 ||
    privateEvidence.publicPreflight
      .ownerOfKeyStatus !== "unregistered"
  ) {
    return rejected(
      "nested_public_evidence_mismatch",
    );
  }

  if (
    typeof publicEvidence.replacementPublicKeyHex !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      publicEvidence.replacementPublicKeyHex,
    ) ||
    typeof publicEvidence.ownerAccountBytesHex !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      publicEvidence.ownerAccountBytesHex,
    ) ||
    typeof publicEvidence
      .concordiumGenesisHashBytesHex !== "string" ||
    !/^[0-9a-f]{64}$/.test(
      publicEvidence
        .concordiumGenesisHashBytesHex,
    ) ||
    publicEvidence.ownerOfKeyStatus !==
      "unregistered" ||
    publicEvidence.canonicalMessageByteLength !==
      249 ||
    typeof publicEvidence.canonicalMessageSha256 !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      publicEvidence.canonicalMessageSha256,
    )
  ) {
    return rejected(
      "invalid_public_evidence",
    );
  }

  if (
    privateEvidence.publicKeyMatchesPrivateKey !==
      true ||
    privateEvidence.signatureByteLength !== 64 ||
    privateEvidence.signatureLocallyVerified !==
      true ||
    privateEvidence.registrationParameterByteLength !==
      180 ||
    typeof privateEvidence
      .registrationParameterSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(
      privateEvidence
        .registrationParameterSha256,
    ) ||
    privateEvidence.privateKeyMaterialIncluded !==
      false ||
    privateEvidence.rawSignatureIncluded !== false ||
    privateEvidence.walletMaterialIncluded !== false
  ) {
    return rejected(
      "invalid_private_evidence",
    );
  }

  if (
    privateFacts.canonicalMessageByteLength !==
      249 ||
    privateFacts.canonicalMessageSha256 !==
      publicEvidence.canonicalMessageSha256 ||
    privateFacts.signatureByteLength !== 64 ||
    privateFacts.signatureLocallyVerified !== true ||
    privateFacts.registrationParameterByteLength !==
      180 ||
    privateFacts.registrationParameterSha256 !==
      privateEvidence.registrationParameterSha256
  ) {
    return rejected(
      "private_evidence_facts_mismatch",
    );
  }

  if (
    privateRuntime.walletRead !== false ||
    privateRuntime.networkCalled !== false ||
    privateRuntime.contractInvoked !== false ||
    privateRuntime.transactionConstructed !== false ||
    privateRuntime.transactionSubmitted !== false ||
    privateRuntime.cis8Mutated !== false ||
    privateRuntime.cis8004Mutated !== false
  ) {
    return rejected(
      "unsafe_private_preflight_runtime",
    );
  }

  if (
    authorization.status !==
      "gate4_submission_authorized" ||
    authorization.gate4SubmissionLimit !== 1 ||
    authorization.submissionAttemptsBefore !== 0 ||
    authorization.remainingSubmissionAttempts !== 1 ||
    authorization.transactionExecutionAuthorized !==
      false ||
    authorization.automaticRetryAuthorized !== false ||
    authorization.zeroCcdRequired !== true
  ) {
    return rejected(
      "unsafe_gate4_authorization_state",
    );
  }

  return {
    ok: true,

    value: Object.freeze({
      publicPreflightArtifactSha256:
        input.publicPreflightArtifactSha256,

      privatePreflightArtifactSha256:
        input.privatePreflightArtifactSha256,

      replacementPublicKeyHex:
        publicEvidence.replacementPublicKeyHex,

      ownerAccountBytesHex:
        publicEvidence.ownerAccountBytesHex,

      concordiumGenesisHashBytesHex:
        publicEvidence
          .concordiumGenesisHashBytesHex,

      ownerOfKeyStatus: "unregistered",

      canonicalMessageByteLength: 249,
      canonicalMessageSha256:
        publicEvidence.canonicalMessageSha256,

      signatureByteLength: 64,
      signatureLocallyVerified: true,

      registrationParameterByteLength: 180,
      registrationParameterSha256:
        privateEvidence
          .registrationParameterSha256,

      privateKeyMaterialIncluded: false,
      rawSignatureIncluded: false,
      walletMaterialIncluded: false,

      walletRead: false,
      transactionConstructed: false,
      transactionSubmitted: false,
    }),
  };
}
