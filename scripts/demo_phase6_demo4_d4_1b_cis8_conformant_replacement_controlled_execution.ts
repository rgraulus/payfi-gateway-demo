/**
 * PR #312 — Demo4 D4-1B CIS-8 conformant replacement controlled execution.
 *
 * Current implementation stage: Gate 5 finalized-registration lock.
 *
 * Gate 4 completed exactly one authorized Testnet registration. Execute
 * dispatch is permanently disabled for PR #312; the retained execution
 * machinery exists only as historical, regression-covered implementation.
 *
 * No automatic retry is permitted.
 */

import {
  createHash,
} from "node:crypto";

import {
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  isAbsolute,
  resolve,
} from "node:path";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  buildDemo4D41bReplacementOwnerOfKeyParameterV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  authorizeDemo4D41bReplacementControlledExecutionV1,
  buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1,
  validateDemo4D41bReplacementOwnerOfKeyRegisteredV1,
  validateDemo4D41bReplacementRegistrationEventV1,
} from "../src/phase6/demo4Cis8ConformantReplacementControlledExecution";

import {
  serializeReplacementRegistrationParameterV1,
} from "../src/phase6/demo4Cis8ConformantReplacementExecutionDryRun";

import {
  buildControlledPrivatePreflightV1,
} from "./demo_phase6_demo4_d4_1b_cis8_conformant_replacement_private_preflight";

import {
  inspectConcordiumPublicState,
} from "./demo_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight";

type UnknownRecord =
  Record<string, unknown>;

const SCRIPT_TYPE =
  "demo.phase6.demo4D41bCis8ConformantReplacementControlledExecution.v1";

const IMPLEMENTATION_STAGE =
  "gate5_finalized_registration_locked" as const;

const MAX_WALLET_BYTES =
  1_000_000;

const MAX_REPLACEMENT_PRIVATE_KEY_BYTES =
  65_536;

const TRANSACTION_EXPIRY_MINUTES =
  5;

const EXECUTE_DISPATCH_ENABLED =
  false as const;

const EXECUTION_PREFLIGHT_CAPTURE =
  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-execution-preflight-runner-output.json";

const PUBLIC_PREFLIGHT_ARTIFACT =
  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-public-preflight.json";

const PRIVATE_PREFLIGHT_ARTIFACT =
  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-private-preflight.json";

const GATE4_AUTHORIZATION_ARTIFACT =
  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-gate4-authorization.json";

const CURRENT_PREFLIGHT_CHECKPOINT =
  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-preflight-implementation-checkpoint.json";

const EXPECTED_EXECUTION_PREFLIGHT_SHA256 =
  "b8730931e33fc0fe93e7d3b60b43817605ca06a2d8f873613b0703994bb1b366";

const EXPECTED_PUBLIC_PREFLIGHT_SHA256 =
  "540a1048e2d2a36c21414231d6a8da661245c2ad845b47b1dd02ae7ce747ed6e";

const EXPECTED_PRIVATE_PREFLIGHT_SHA256 =
  "682c138801edced7020526699faddb5c3f5a1938598108a81d1ffc3ad52355e4";

const EXPECTED_GATE4_AUTHORIZATION_SHA256 =
  "b7022b2b82faa736c05e1fce595e2466ed103d73996dca6cc8b1fbd68e028023";

const EXPECTED_CURRENT_CHECKPOINT_SHA256 =
  "e0dd8efbdcc074d40a79de68710b95f9da68c9870dc71774f53144a7fc5c2866";

const EXPECTED_GATE3_INPUT_CHECKPOINT_SHA256 =
  "6533dfabe93e1af1d0f75801fe565ff56d9d353abc6aa704fb8ce38519696247";

const runtimeState = {
  environmentRead:
    false,

  filesystemRead:
    false,

  privateKeyRead:
    false,

  walletRead:
    false,

  signerCreated:
    false,

  cis8MessageSigningAttempted:
    false,

  signatureLocallyVerified:
    false,

  networkCalled:
    false,

  finalizedInspectionCompleted:
    false,

  dryRunCalled:
    false,

  dryRunSucceeded:
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

  evidenceWritten:
    false,

  automaticRetryAttempted:
    false,

  cis8Mutated:
    false,

  cis8004Mutated:
    false,
};

function exactEnv(
  name: string,
): string | undefined {
  runtimeState.environmentRead =
    true;

  const value =
    process.env[name];

  if (
    value === undefined ||
    value.length === 0
  ) {
    return undefined;
  }

  return value;
}

function sha256Hex(
  value: Buffer | string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
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

export function safeDemo4D41bReplacementPrivateKeyPathV1():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1B_REPLACEMENT_PRIVATE_KEY_FILE",
    );

  if (configured === undefined) {
    throw new Error(
      "missing_replacement_private_key_path",
    );
  }

  if (configured.includes("\0")) {
    throw new Error(
      "invalid_replacement_private_key_path",
    );
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(
          process.cwd(),
          configured,
        );

  const metadata =
    lstatSync(absolute);

  if (!metadata.isFile()) {
    throw new Error(
      "replacement_private_key_path_not_regular_file",
    );
  }

  if (metadata.isSymbolicLink()) {
    throw new Error(
      "replacement_private_key_symlink_forbidden",
    );
  }

  if (
    metadata.size <= 0 ||
    metadata.size >
      MAX_REPLACEMENT_PRIVATE_KEY_BYTES
  ) {
    throw new Error(
      "replacement_private_key_size_invalid",
    );
  }

  const canonical =
    realpathSync(absolute);

  const parentCanonical =
    realpathSync(
      dirname(absolute),
    );

  if (
    dirname(canonical) !==
      parentCanonical
  ) {
    throw new Error(
      "replacement_private_key_path_escape",
    );
  }

  return canonical;
}

export function safeDemo4D41bReplacementWalletPathV1():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1B_CONTROLLED_EXECUTION_WALLET_PATH",
    );

  if (configured === undefined) {
    throw new Error(
      "missing_wallet_path",
    );
  }

  if (configured.includes("\0")) {
    throw new Error(
      "invalid_wallet_path",
    );
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(
          process.cwd(),
          configured,
        );

  const metadata =
    lstatSync(absolute);

  if (!metadata.isFile()) {
    throw new Error(
      "wallet_path_not_regular_file",
    );
  }

  if (metadata.isSymbolicLink()) {
    throw new Error(
      "wallet_path_symlink_forbidden",
    );
  }

  if (
    metadata.size <= 0 ||
    metadata.size > MAX_WALLET_BYTES
  ) {
    throw new Error(
      "wallet_size_invalid",
    );
  }

  const canonical =
    realpathSync(absolute);

  const parentCanonical =
    realpathSync(
      dirname(absolute),
    );

  if (
    dirname(canonical) !==
      parentCanonical
  ) {
    throw new Error(
      "wallet_path_escape",
    );
  }

  return canonical;
}

export function safeDemo4D41bReplacementWalletSignerV1(
  context: {
    readonly sdk: any;
  },
): {
  readonly signer: any;
  readonly sender: unknown;
} {
  const walletPath =
    safeDemo4D41bReplacementWalletPathV1();

  const walletText =
    readFileSync(
      walletPath,
      "utf8",
    );

  runtimeState.walletRead =
    true;

  runtimeState.privateKeyRead =
    true;

  let walletExport:
    any;

  try {
    walletExport =
      context.sdk.parseWallet(
        walletText,
      );
  } catch {
    throw new Error(
      "wallet_parse_failed",
    );
  }

  const walletAddress =
    walletExport
      ?.value
      ?.address;

  if (
    typeof walletAddress !== "string" ||
    walletAddress !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount
  ) {
    throw new Error(
      "wallet_owner_mismatch",
    );
  }

  const sender =
    context.sdk.AccountAddress
      .fromBase58(
        walletAddress,
      );

  const signer =
    context.sdk.buildAccountSigner(
      walletExport,
    );

  runtimeState.signerCreated =
    true;

  return {
    signer,
    sender,
  };
}

export function safeDemo4D41bReplacementFinalizedEvidencePathV1():
string {
  const configured =
    exactEnv(
      "DEMO4_D4_1B_CONTROLLED_EXECUTION_EVIDENCE_PATH",
    );

  if (configured === undefined) {
    throw new Error(
      "missing_evidence_path",
    );
  }

  if (configured.includes("\0")) {
    throw new Error(
      "invalid_evidence_path",
    );
  }

  const absolute =
    isAbsolute(configured)
      ? configured
      : resolve(
          process.cwd(),
          configured,
        );

  const parentCanonical =
    realpathSync(
      dirname(absolute),
    );

  if (
    dirname(absolute) !==
      parentCanonical
  ) {
    throw new Error(
      "evidence_path_escape",
    );
  }

  try {
    lstatSync(absolute);

    throw new Error(
      "evidence_path_already_exists",
    );
  } catch (error: unknown) {
    const record =
      isRecord(error)
        ? error
        : null;

    if (
      record?.code !==
        "ENOENT"
    ) {
      throw error;
    }
  }

  return absolute;
}

function loadJsonArtifact(
  relativePath: string,
): {
  readonly value: UnknownRecord;
  readonly sha256: string;
} {
  const absolute =
    resolve(
      process.cwd(),
      relativePath,
    );

  runtimeState.filesystemRead =
    true;

  const raw =
    readFileSync(
      absolute,
    );

  const parsed =
    JSON.parse(
      raw.toString("utf8"),
    );

  if (!isRecord(parsed)) {
    throw new Error(
      "invalid_provenance_artifact",
    );
  }

  return {
    value:
      parsed,

    sha256:
      sha256Hex(raw),
  };
}

export function loadDemo4D41bReplacementControlledExecutionProvenanceV1() {
  const preflight =
    loadJsonArtifact(
      EXECUTION_PREFLIGHT_CAPTURE,
    );

  const authorization =
    loadJsonArtifact(
      GATE4_AUTHORIZATION_ARTIFACT,
    );

  const checkpoint =
    loadJsonArtifact(
      CURRENT_PREFLIGHT_CHECKPOINT,
    );

  const publicPreflight =
    loadJsonArtifact(
      PUBLIC_PREFLIGHT_ARTIFACT,
    );

  const privatePreflight =
    loadJsonArtifact(
      PRIVATE_PREFLIGHT_ARTIFACT,
    );

  if (
    preflight.sha256 !==
      EXPECTED_EXECUTION_PREFLIGHT_SHA256 ||
    publicPreflight.sha256 !==
      EXPECTED_PUBLIC_PREFLIGHT_SHA256 ||
    privatePreflight.sha256 !==
      EXPECTED_PRIVATE_PREFLIGHT_SHA256 ||
    authorization.sha256 !==
      EXPECTED_GATE4_AUTHORIZATION_SHA256 ||
    checkpoint.sha256 !==
      EXPECTED_CURRENT_CHECKPOINT_SHA256
  ) {
    throw new Error(
      "provenance_artifact_hash_drift",
    );
  }

  const artifactBinding =
    preflight.value.artifactBinding;

  const evidenceBinding =
    preflight.value.evidenceBinding;

  const authSourceHashes =
    authorization.value.sourceHashes;

  const authorizationDecision =
    authorization.value.authorization;

  const checkpointGate4 =
    checkpoint.value.gate4AuthorizationState;

  if (
    !isRecord(artifactBinding) ||
    !isRecord(evidenceBinding) ||
    !isRecord(authSourceHashes) ||
    !isRecord(authorizationDecision) ||
    !isRecord(checkpointGate4)
  ) {
    throw new Error(
      "invalid_provenance_chain_shape",
    );
  }

  if (
    authorization.value.status !== "authorized" ||
    authorizationDecision.status !== "gate4_submission_authorized" ||
    authorizationDecision.transactionExecutionAuthorized !== false ||
    authorizationDecision.gate4SubmissionLimit !== 1 ||
    authorizationDecision.submissionAttemptsBefore !== 0 ||
    authorizationDecision.remainingSubmissionAttempts !== 1 ||
    authorizationDecision.automaticRetryAuthorized !== false ||
    authorizationDecision.zeroCcdRequired !== true ||
    authorizationDecision.cis8004Token287MutationAuthorized !== false ||
    authorizationDecision.d4_1cAttachmentAuthorized !== false ||
    authorizationDecision.historicalRegistrationRevocationAuthorized !== false ||
    checkpointGate4.status !== "gate4_submission_authorized" ||
    checkpointGate4.gate4SubmissionLimit !== 1 ||
    checkpointGate4.submissionAttemptsBefore !== 0 ||
    checkpointGate4.remainingSubmissionAttempts !== 1 ||
    checkpointGate4.transactionExecutionAuthorized !== false ||
    checkpointGate4.automaticRetryAuthorized !== false ||
    checkpointGate4.zeroCcdRequired !== true ||
    checkpointGate4.transactionConstructed !== false ||
    checkpointGate4.transactionSigned !== false ||
    checkpointGate4.transactionSubmitted !== false
  ) {
    throw new Error(
      "unsafe_gate4_authorization_state",
    );
  }

  if (
    evidenceBinding.publicPreflightArtifactSha256 !==
      publicPreflight.sha256 ||
    evidenceBinding.privatePreflightArtifactSha256 !==
      privatePreflight.sha256
  ) {
    throw new Error(
      "preflight_evidence_artifact_binding_mismatch",
    );
  }

  if (
    artifactBinding.authorizationArtifactSha256 !==
      authorization.sha256 ||
    artifactBinding.authorizationInputCheckpointSha256 !==
      EXPECTED_GATE3_INPUT_CHECKPOINT_SHA256 ||
    authSourceHashes.gate3CheckpointSha256 !==
      EXPECTED_GATE3_INPUT_CHECKPOINT_SHA256 ||
    checkpointGate4.authorizationArtifactSha256 !==
      authorization.sha256 ||
    checkpointGate4.authorizationInputCheckpointSha256 !==
      EXPECTED_GATE3_INPUT_CHECKPOINT_SHA256
  ) {
    throw new Error(
      "provenance_chain_binding_mismatch",
    );
  }

  return Object.freeze({
    executionPreflightRunnerOutputSha256:
      preflight.sha256,

    publicPreflightArtifactSha256:
      publicPreflight.sha256,

    privatePreflightArtifactSha256:
      privatePreflight.sha256,

    gate4AuthorizationArtifactSha256:
      authorization.sha256,

    preflightCheckpointSha256:
      checkpoint.sha256,

    authorizationInputCheckpointSha256:
      EXPECTED_GATE3_INPUT_CHECKPOINT_SHA256,
  });
}

export function loadDemo4D41bReplacementControlledExecutionInputsV1() {
  const provenance =
    loadDemo4D41bReplacementControlledExecutionProvenanceV1();

  const preflight =
    loadJsonArtifact(
      EXECUTION_PREFLIGHT_CAPTURE,
    ).value;

  const plan = preflight.plan;
  const artifactBinding = preflight.artifactBinding;
  const evidenceBinding = preflight.evidenceBinding;
  const signedMaterial = preflight.signedMaterial;
  const finalizedInspection = preflight.finalizedInspection;
  const dryRun = preflight.dryRun;
  const runtime = preflight.runtime;

  if (
    !isRecord(plan) ||
    !isRecord(artifactBinding) ||
    !isRecord(evidenceBinding) ||
    !isRecord(signedMaterial) ||
    !isRecord(finalizedInspection) ||
    !isRecord(dryRun) ||
    !isRecord(runtime)
  ) {
    throw new Error(
      "invalid_execution_preflight_shape",
    );
  }

  if (
    plan.status !== "execution_preflight_authorized" ||
    plan.testnetOnly !== true ||
    plan.submissionAttemptsBefore !== 0 ||
    plan.remainingSubmissionAttempts !== 1 ||
    plan.automaticRetryAuthorized !== false ||
    plan.zeroCcdRequired !== true ||
    plan.transactionConstructionAuthorized !== false ||
    plan.transactionSigningAuthorized !== false ||
    plan.transactionSubmissionAuthorized !== false ||
    plan.submissionAttemptConsumptionAuthorized !== false ||
    artifactBinding.gate4SubmissionLimit !== 1 ||
    artifactBinding.submissionAttemptsBefore !== 0 ||
    artifactBinding.remainingSubmissionAttempts !== 1 ||
    artifactBinding.transactionExecutionAuthorized !== false ||
    artifactBinding.automaticRetryAuthorized !== false ||
    artifactBinding.zeroCcdRequired !== true ||
    artifactBinding.transactionConstructed !== false ||
    artifactBinding.transactionSigned !== false ||
    artifactBinding.transactionSubmitted !== false ||
    runtime.ownerOfKeyRecheckedUnregistered !== true ||
    runtime.dryRunSucceeded !== true ||
    runtime.walletRead !== false ||
    runtime.accountSignerCreated !== false ||
    runtime.transactionConstructed !== false ||
    runtime.transactionSigned !== false ||
    runtime.transactionSubmitted !== false ||
    runtime.submissionAttemptConsumed !== false
  ) {
    throw new Error(
      "unsafe_execution_preflight_state",
    );
  }

  if (
    finalizedInspection.moduleReference !==
      DEMO4_D4_1B_REPLACEMENT_PROFILE.moduleReference ||
    finalizedInspection.ownerOfKeyStatus !== "unregistered" ||
    evidenceBinding.ownerOfKeyStatus !== "unregistered" ||
    evidenceBinding.canonicalMessageByteLength !== 249 ||
    evidenceBinding.signatureByteLength !== 64 ||
    evidenceBinding.signatureLocallyVerified !== true ||
    evidenceBinding.registrationParameterByteLength !== 180 ||
    dryRun.deterministicParameterByteLength !== 180 ||
    dryRun.sdkSerializedParameterByteLength !== 180 ||
    dryRun.exactSdkByteEquivalence !== true ||
    dryRun.zeroCcdAttached !== true
  ) {
    throw new Error(
      "execution_preflight_binding_mismatch",
    );
  }

  if (
    evidenceBinding.replacementPublicKeyHex !== signedMaterial.publicKeyHex ||
    evidenceBinding.canonicalMessageByteLength !== signedMaterial.canonicalMessageByteLength ||
    evidenceBinding.canonicalMessageSha256 !== signedMaterial.canonicalMessageSha256 ||
    evidenceBinding.signatureByteLength !== signedMaterial.signatureByteLength ||
    evidenceBinding.signatureLocallyVerified !== signedMaterial.signatureLocallyVerified ||
    evidenceBinding.registrationParameterByteLength !== signedMaterial.registrationParameterByteLength ||
    evidenceBinding.registrationParameterSha256 !== signedMaterial.registrationParameterSha256 ||
    evidenceBinding.privateKeyMaterialIncluded !== false ||
    evidenceBinding.rawSignatureIncluded !== false ||
    evidenceBinding.walletMaterialIncluded !== false ||
    signedMaterial.privateKeyMaterialIncluded !== false ||
    signedMaterial.rawSignatureIncluded !== false ||
    signedMaterial.walletMaterialIncluded !== false ||
    dryRun.deterministicParameterSha256 !== evidenceBinding.registrationParameterSha256 ||
    dryRun.sdkSerializedParameterSha256 !== evidenceBinding.registrationParameterSha256 ||
    dryRun.energySafetyCap !== "100000"
  ) {
    throw new Error(
      "execution_preflight_material_coherence_mismatch",
    );
  }

  return Object.freeze({
    provenance,
    evidenceBinding,
    signedMaterial,
    finalizedInspection,
    dryRun,
  });
}

function prepareDemo4D41bReplacementSignedRegistrationV1(
  input: {
    readonly authorization:
      unknown;
  },
) {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  assertDemo4D41bReplacementSingleSubmissionAvailableV1(
    input.authorization,
  );

  const bound =
    loadDemo4D41bReplacementControlledExecutionInputsV1();

  const publicPreflight =
    loadJsonArtifact(
      PUBLIC_PREFLIGHT_ARTIFACT,
    );

  if (
    publicPreflight.sha256 !==
      EXPECTED_PUBLIC_PREFLIGHT_SHA256 ||
    publicPreflight.sha256 !==
      bound.provenance
        .publicPreflightArtifactSha256
  ) {
    throw new Error(
      "public_preflight_provenance_drift",
    );
  }

  const privateKeyPath =
    safeDemo4D41bReplacementPrivateKeyPathV1();

  runtimeState.privateKeyRead =
    true;

  const privateKeyPem =
    readFileSync(
      privateKeyPath,
      "utf8",
    );

  let registrationParameter:
    unknown;

  const signed =
    buildControlledPrivatePreflightV1(
      {
        privateKeyPem,

        publicPreflightArtifact:
          publicPreflight.value,
      },
      {
        signingAttempted: () => {
          runtimeState
            .cis8MessageSigningAttempted =
            true;
        },

        registrationParameterBuilt: (
          parameter,
        ) => {
          registrationParameter =
            parameter;
        },
      },
    );

  if (
    typeof registrationParameter !==
      "object" ||
    registrationParameter === null
  ) {
    throw new Error(
      "registration_parameter_not_captured",
    );
  }

  if (
    signed.facts.publicKeyHex !==
      bound.evidenceBinding
        .replacementPublicKeyHex ||
    signed.facts.canonicalMessageByteLength !==
      bound.evidenceBinding
        .canonicalMessageByteLength ||
    signed.facts.canonicalMessageSha256 !==
      bound.evidenceBinding
        .canonicalMessageSha256 ||
    signed.facts.signatureByteLength !==
      64 ||
    signed.facts.signatureLocallyVerified !==
      true ||
    signed.facts.registrationParameterByteLength !==
      180 ||
    signed.facts.registrationParameterByteLength !==
      bound.evidenceBinding
        .registrationParameterByteLength ||
    signed.facts.registrationParameterSha256 !==
      bound.evidenceBinding
        .registrationParameterSha256 ||
    signed.evidence.privateKeyMaterialIncluded !==
      false ||
    signed.evidence.rawSignatureIncluded !==
      false ||
    signed.evidence.walletMaterialIncluded !==
      false
  ) {
    throw new Error(
      "controlled_execution_signed_material_binding_mismatch",
    );
  }

  const publicKeyHex =
    signed.facts.publicKeyHex;

  if (
    !/^[0-9a-f]{64}$/.test(
      publicKeyHex,
    )
  ) {
    throw new Error(
      "invalid_replacement_public_key_hex",
    );
  }

  const replacementPublicKey =
    Uint8Array.from(
      Buffer.from(
        publicKeyHex,
        "hex",
      ),
    );

  if (
    replacementPublicKey.length !==
      32
  ) {
    throw new Error(
      "invalid_replacement_public_key_length",
    );
  }

  const transactionEnergyAllowance =
    String(
      bound.dryRun
        .transactionEnergyAllowance,
    );

  if (
    !/^(0|[1-9][0-9]*)$/.test(
      transactionEnergyAllowance,
    )
  ) {
    throw new Error(
      "invalid_bound_transaction_energy_allowance",
    );
  }

  runtimeState.signatureLocallyVerified =
    true;

  return Object.freeze({
    bound,

    registrationParameter,

    replacementPublicKey,

    expectedRegistrationParameterSha256:
      signed.facts
        .registrationParameterSha256,

    transactionEnergyAllowance,
  });
}

export function serializeDemo4D41bReplacementControlledExecutionParameterV1(
  input: {
    readonly sdk: any;
    readonly embeddedSchema: any;
    readonly registrationParameter: unknown;
    readonly expectedRegistrationParameterSha256: string;
  },
) {
  if (
    !/^[0-9a-f]{64}$/.test(
      input.expectedRegistrationParameterSha256,
    )
  ) {
    throw new Error(
      "invalid_expected_registration_parameter_sha256",
    );
  }

  const serialized =
    serializeReplacementRegistrationParameterV1(
      {
        sdk:
          input.sdk,

        embeddedSchema:
          input.embeddedSchema,
      },
      input.registrationParameter,
    );

  if (
    serialized.deterministicBytes.length !== 180 ||
    serialized.sdkSerializedBytes.length !== 180 ||
    serialized.deterministicSha256 !==
      serialized.sdkSerializedSha256 ||
    serialized.deterministicSha256 !==
      input.expectedRegistrationParameterSha256
  ) {
    throw new Error(
      "controlled_execution_registration_parameter_binding_mismatch",
    );
  }

  return Object.freeze({
    parameter:
      serialized.parameter,

    deterministicParameterByteLength:
      serialized.deterministicBytes.length,

    deterministicParameterSha256:
      serialized.deterministicSha256,

    sdkSerializedParameterByteLength:
      serialized.sdkSerializedBytes.length,

    sdkSerializedParameterSha256:
      serialized.sdkSerializedSha256,

    exactSdkByteEquivalence:
      true as const,
  });
}

function exactArrayBufferFromBytes(
  value: Uint8Array,
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.length,
    );

  copy.set(value);

  return copy.buffer;
}

export function createDemo4D41bReplacementRegistrationSerializerV1(
  input: {
    readonly sdk: any;
    readonly embeddedSchema: any;
    readonly expectedRegistrationParameterSha256: string;
  },
): (registrationParameter: unknown) => ArrayBuffer {
  return (
    registrationParameter:
      unknown,
  ): ArrayBuffer => {
    const bound =
      serializeDemo4D41bReplacementControlledExecutionParameterV1({
        sdk:
          input.sdk,

        embeddedSchema:
          input.embeddedSchema,

        registrationParameter,

        expectedRegistrationParameterSha256:
          input.expectedRegistrationParameterSha256,
      });

    const bytes =
      Uint8Array.from(
        input.sdk.Parameter.toBuffer(
          bound.parameter,
        ),
      );

    if (
      bytes.length !== 180 ||
      sha256Hex(
        Buffer.from(bytes),
      ) !==
        input.expectedRegistrationParameterSha256
    ) {
      throw new Error(
        "controlled_execution_serializer_postcondition_mismatch",
      );
    }

    return exactArrayBufferFromBytes(
      bytes,
    );
  };
}

export function deriveDemo4D41bReplacementControlledExecutionAuthorizationV1(
  input: {
    readonly explicitControlledExecutionAuthorizationConfirmed: boolean;
    readonly controlledCapabilitiesEnabled: boolean;
  },
) {
  const bound =
    loadDemo4D41bReplacementControlledExecutionInputsV1();

  const enabled =
    input.controlledCapabilitiesEnabled === true;

  return authorizeDemo4D41bReplacementControlledExecutionV1({
    executionPreflight:
      bound.evidenceBinding,

    explicitControlledExecutionAuthorizationConfirmed:
      input.explicitControlledExecutionAuthorizationConfirmed,

    testnetOnly:
      true,

    submissionAttemptsBefore:
      0,

    automaticRetryAuthorized:
      false,

    zeroCcdRequired:
      true,

    walletReadEnabled:
      enabled,

    accountSignerCreationEnabled:
      enabled,

    transactionConstructionEnabled:
      enabled,

    transactionSigningEnabled:
      enabled,

    transactionSubmissionEnabled:
      enabled,

    evidenceWriteEnabled:
      enabled,

    cis8004Token287MutationAuthorized:
      false,

    d4_1cAttachmentAuthorized:
      false,

    historicalRegistrationRevocationAuthorized:
      false,

    executionPreflightRunnerOutputSha256:
      bound.provenance
        .executionPreflightRunnerOutputSha256,

    gate4AuthorizationArtifactSha256:
      bound.provenance
        .gate4AuthorizationArtifactSha256,

    preflightCheckpointSha256:
      bound.provenance
        .preflightCheckpointSha256,
  });
}

export function assertDemo4D41bReplacementSingleSubmissionAvailableV1(
  authorization: unknown,
): void {
  if (
    !isRecord(authorization) ||
    authorization.status !==
      "controlled_execution_authorized" ||
    authorization.transactionExecutionAuthorized !==
      true ||
    authorization.submissionLimit !== 1 ||
    authorization.submissionAttemptsBefore !== 0 ||
    authorization.remainingSubmissionAttempts !== 1 ||
    authorization.automaticRetryAuthorized !== false ||
    authorization.zeroCcdRequired !== true
  ) {
    throw new Error(
      "invalid_controlled_execution_authorization",
    );
  }

  if (
    runtimeState.transactionSubmissionAttempted === true ||
    runtimeState.transactionSubmitted === true ||
    runtimeState.submissionAttempts !== 0 ||
    runtimeState.automaticRetryAttempted === true
  ) {
    throw new Error(
      "duplicate_submission_forbidden",
    );
  }
}

function beginDemo4D41bReplacementSingleSubmissionAttemptV1(
  authorization: unknown,
): void {
  assertDemo4D41bReplacementSingleSubmissionAvailableV1(
    authorization,
  );

  if (
    runtimeState.transactionSubmissionAttempted === true ||
    runtimeState.submissionAttempts !== 0
  ) {
    throw new Error(
      "duplicate_submission_forbidden",
    );
  }

  runtimeState.transactionSubmissionAttempted =
    true;

  runtimeState.submissionAttempts =
    1;
}

function demo4D41bReplacementBlockHashHexV1(
  value: unknown,
  sdk: any,
): string {
  const candidates: unknown[] = [
    value,
  ];

  try {
    candidates.push(
      sdk.BlockHash?.toHexString?.(
        value,
      ),
    );
  } catch {
    // Continue through supported representations.
  }

  try {
    candidates.push(
      sdk.BlockHash?.toString?.(
        value,
      ),
    );
  } catch {
    // Continue through supported representations.
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized =
      candidate
        .toLowerCase()
        .replace(/^0x/, "");

    if (/^[0-9a-f]{64}$/.test(normalized)) {
      return normalized;
    }
  }

  throw new Error(
    "invalid_finalized_block_hash",
  );
}

function demo4D41bReplacementBlockHeightV1(
  value: unknown,
): string {
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

  throw new Error(
    "invalid_finalized_block_height",
  );
}

async function loadDemo4D41bReplacementFinalizedSnapshotAtBlockV1(
  input: {
    readonly context: {
      readonly sdk: any;
      readonly client: any;
    };

    readonly finalizedBlock: unknown;
  },
): Promise<{
  readonly finalizedBlock: unknown;
  readonly finalizedBlockHash: string;
  readonly finalizedBlockHeight: string;
}> {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  runtimeState.networkCalled =
    true;

  const blockInfo =
    await input.context.client.getBlockInfo(
      input.finalizedBlock,
    );

  if (
    blockInfo === null ||
    blockInfo === undefined ||
    blockInfo.finalized !== true
  ) {
    throw new Error(
      "transaction_finalized_block_not_finalized",
    );
  }

  return {
    finalizedBlock:
      input.finalizedBlock,

    finalizedBlockHash:
      demo4D41bReplacementBlockHashHexV1(
        input.finalizedBlock,
        input.context.sdk,
      ),

    finalizedBlockHeight:
      demo4D41bReplacementBlockHeightV1(
        blockInfo.blockHeight,
      ),
  };
}

function demo4D41bReplacementSchemaBufferV1(
  embeddedSchema: any,
): ArrayBuffer {
  const value =
    embeddedSchema?.buffer;

  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const copy =
      new Uint8Array(
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

  throw new Error(
    "invalid_embedded_schema_buffer",
  );
}

function demo4D41bReplacementEventSchemaTypeV1(
  embeddedSchema: any,
  sdk: any,
): unknown {
  let parsed: unknown;

  try {
    parsed =
      sdk.parseRawModuleSchema(
        embeddedSchema,
      );
  } catch {
    throw new Error(
      "embedded_schema_parse_failed",
    );
  }

  const parsedRecord =
    isRecord(parsed)
      ? parsed
      : null;

  const moduleRecord =
    isRecord(parsedRecord?.module)
      ? parsedRecord.module
      : parsedRecord;

  const rawContracts =
    moduleRecord?.contracts;

  let contract:
    UnknownRecord | null =
      null;

  if (rawContracts instanceof Map) {
    const candidate =
      rawContracts.get(
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .contractName,
      );

    contract =
      isRecord(candidate)
        ? candidate
        : null;
  } else if (isRecord(rawContracts)) {
    const candidate =
      rawContracts[
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .contractName
      ];

    contract =
      isRecord(candidate)
        ? candidate
        : null;
  }

  const event =
    contract?.event;

  if (
    event === null ||
    event === undefined
  ) {
    throw new Error(
      "cis8_event_schema_type_unavailable",
    );
  }

  return event;
}

function demo4D41bReplacementOwnerParameterForSchemaV1(
  parameter: {
    readonly external_key: {
      readonly namespace: string;
      readonly key_type: string;
      readonly public_key:
        readonly number[];
    };
  },
): unknown {
  return {
    external_key: {
      namespace:
        parameter.external_key
          .namespace,

      key_type:
        parameter.external_key
          .key_type,

      public_key:
        parameter.external_key
          .public_key
          .map(
            (byte) =>
              BigInt(byte),
          ),
    },
  };
}

function demo4D41bReplacementContractAddressMatchesV1(
  sdk: any,
  left: unknown,
  right: unknown,
): boolean {
  try {
    return sdk.ContractAddress.equals(
      left,
      right,
    );
  } catch {
    if (
      !isRecord(left) ||
      !isRecord(right)
    ) {
      return false;
    }

    return (
      String(left.index) ===
        String(right.index) &&
      String(left.subindex) ===
        String(right.subindex)
    );
  }
}

function matchingDemo4D41bReplacementRegistrationEventV1(
  input: {
    readonly context: {
      readonly sdk: any;
      readonly contractAddress: unknown;
      readonly embeddedSchema: any;
    };

    readonly summary: any;
    readonly expectedPublicKey: Uint8Array;
  },
): {
  readonly owner:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

  readonly publicKeyHex: string;
} {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  const logs =
    input.context.sdk
      .getSummaryContractUpdateLogs(
        input.summary,
      );

  const schemaType =
    demo4D41bReplacementEventSchemaTypeV1(
      input.context.embeddedSchema,
      input.context.sdk,
    );

  const matches: Array<{
    readonly owner:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

    readonly publicKeyHex: string;
  }> = [];

  for (const log of logs) {
    if (
      !input.context.sdk.isKnown(log)
    ) {
      throw new Error(
        "unknown_contract_update_log",
      );
    }

    if (
      !demo4D41bReplacementContractAddressMatchesV1(
        input.context.sdk,
        log.address,
        input.context.contractAddress,
      )
    ) {
      continue;
    }

    for (const event of log.events) {
      const bytes =
        input.context.sdk.ContractEvent
          .toBuffer(event);

      if (
        bytes.length === 0 ||
        bytes[0] !==
          DEMO4_D4_1B_REPLACEMENT_PROFILE
            .eventTag
      ) {
        continue;
      }

      let decoded: unknown;

      try {
        decoded =
          input.context.sdk.ContractEvent
            .parseWithSchemaType(
              event,
              schemaType,
            );
      } catch {
        throw new Error(
          "registration_event_decode_failed",
        );
      }

      const validated =
        validateDemo4D41bReplacementRegistrationEventV1({
          tag:
            bytes[0],

          contract:
            log.address,

          decoded,

          expectedPublicKey:
            input.expectedPublicKey,
        });

      if (!validated.ok) {
        throw new Error(
          `registration_event_rejected:${validated.reason}`,
        );
      }

      matches.push({
        owner:
          validated.value.owner,

        publicKeyHex:
          validated.value.publicKeyHex,
      });
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `registration_event_count_invalid:${matches.length}`,
    );
  }

  return matches[0];
}

async function queryDemo4D41bReplacementRegisteredOwnerOfKeyAtFinalizedBlockV1(
  input: {
    readonly context: {
      readonly sdk: any;
      readonly client: any;
      readonly contractAddress: unknown;
      readonly embeddedSchema: any;
    };

    readonly finalizedBlock: unknown;
    readonly publicKey: Uint8Array;
  },
): Promise<{
  readonly decoded: unknown;
  readonly owner:
    typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;
  readonly ownerOfKeyStatus:
    "registered";
}> {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  const parameterResult =
    buildDemo4D41bReplacementOwnerOfKeyParameterV1(
      input.publicKey,
    );

  if (!parameterResult.ok) {
    throw new Error(
      `ownerofkey_parameter_rejected:${parameterResult.reason}`,
    );
  }

  const contractName =
    input.context.sdk.ContractName
      .fromStringUnchecked(
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .contractName,
      );

  const entrypointName =
    input.context.sdk.EntrypointName
      .fromString(
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerOfKeyEntrypoint,
      );

  const parameter =
    input.context.sdk
      .serializeUpdateContractParameters(
        contractName,
        entrypointName,
        demo4D41bReplacementOwnerParameterForSchemaV1(
          parameterResult.value,
        ),
        demo4D41bReplacementSchemaBufferV1(
          input.context.embeddedSchema,
        ),
      );

  runtimeState.networkCalled =
    true;

  const invocation =
    await input.context.client
      .invokeContract(
        {
          method:
            input.context.sdk.ReceiveName
              .fromString(
                [
                  DEMO4_D4_1B_REPLACEMENT_PROFILE
                    .contractName,
                  DEMO4_D4_1B_REPLACEMENT_PROFILE
                    .ownerOfKeyEntrypoint,
                ].join("."),
              ),

          contract:
            input.context
              .contractAddress,

          parameter,
        },
        input.finalizedBlock,
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

  const decoded =
    input.context.sdk
      .deserializeReceiveReturnValue(
        input.context.sdk.ReturnValue
          .toBuffer(
            input.context.sdk.unwrap(
              invocation.returnValue,
            ),
          ),
        demo4D41bReplacementSchemaBufferV1(
          input.context.embeddedSchema,
        ),
        contractName,
        entrypointName,
      );

  const postcondition =
    validateDemo4D41bReplacementOwnerOfKeyRegisteredV1(
      decoded,
    );

  if (!postcondition.ok) {
    throw new Error(
      `ownerofkey_postcondition_rejected:${postcondition.reason}`,
    );
  }

  return {
    decoded,

    owner:
      postcondition.value.owner,

    ownerOfKeyStatus:
      postcondition.value
        .ownerOfKeyStatus,
  };
}

function demo4D41bReplacementFinalizedEnergyV1(
  value: unknown,
  sdk: any,
): string {
  const candidates: unknown[] = [
    value,
  ];

  if (isRecord(value)) {
    candidates.push(
      value.value,
      value.energy,
    );
  }

  for (const helperName of [
    "toJSON",
    "toString",
    "toUnwrappedJSON",
  ]) {
    try {
      const helper =
        sdk.Energy?.[helperName];

      if (typeof helper === "function") {
        candidates.push(
          helper(value),
        );
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
      return candidate.toString(10);
    }

    if (
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0
    ) {
      return String(candidate);
    }

    if (
      typeof candidate === "string" &&
      /^(0|[1-9][0-9]*)$/.test(candidate)
    ) {
      return candidate;
    }
  }

  throw new Error(
    "invalid_finalized_energy",
  );
}

async function finalizeDemo4D41bReplacementRegistrationV1(
  input: {
    readonly context: {
      readonly sdk: any;
      readonly client: any;
      readonly contractAddress: unknown;
      readonly embeddedSchema: any;
    };

    readonly transactionHash: unknown;
    readonly sender: unknown;
    readonly expectedPublicKey: Uint8Array;
    readonly finalizationTimeoutMs: number;
  },
): Promise<{
  readonly transaction: {
    readonly hash: string;
    readonly finalized: true;
    readonly finalizedBlockHash: string;
    readonly finalizedBlockHeight: string;
    readonly energyCost: string;
    readonly costMicroCcd: string;
    readonly transactionType: "update";
  };

  readonly registrationEvent: {
    readonly owner:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

    readonly publicKeyHex: string;
  };

  readonly ownershipPostcondition: {
    readonly owner:
      typeof DEMO4_D4_1B_REPLACEMENT_PROFILE.ownerAccount;

    readonly ownerOfKeyStatus:
      "registered";

    readonly finalized: true;
    readonly finalizedBlockHash: string;
    readonly finalizedBlockHeight: string;
  };
}> {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  if (
    !Number.isSafeInteger(
      input.finalizationTimeoutMs,
    ) ||
    input.finalizationTimeoutMs <= 0 ||
    input.finalizationTimeoutMs > 300_000
  ) {
    throw new Error(
      "invalid_finalization_timeout",
    );
  }

  runtimeState.networkCalled =
    true;

  const finalized =
    await input.context.client
      .waitForTransactionFinalization(
        input.transactionHash,
        input.finalizationTimeoutMs,
      );

  runtimeState.transactionFinalized =
    true;

  if (
    finalized === null ||
    finalized === undefined ||
    !input.context.sdk.isKnown(
      finalized.summary,
    )
  ) {
    throw new Error(
      "unknown_finalized_summary",
    );
  }

  const summary =
    finalized.summary;

  if (
    !input.context.sdk
      .isSuccessTransaction(
        summary,
      )
  ) {
    const reason =
      input.context.sdk
        .isRejectTransaction(
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
    !input.context.sdk
      .isUpdateContractSummary(
        summary,
      )
  ) {
    throw new Error(
      "finalized_summary_not_contract_update",
    );
  }

  const finalizedSender =
    Buffer.from(
      input.context.sdk.AccountAddress
        .toBuffer(
          summary.sender,
        ),
    );

  const expectedSender =
    Buffer.from(
      input.context.sdk.AccountAddress
        .toBuffer(
          input.sender,
        ),
    );

  if (
    !finalizedSender.equals(
      expectedSender,
    )
  ) {
    throw new Error(
      "finalized_sender_mismatch",
    );
  }

  const finalizedSnapshot =
    await loadDemo4D41bReplacementFinalizedSnapshotAtBlockV1({
      context: {
        sdk:
          input.context.sdk,

        client:
          input.context.client,
      },

      finalizedBlock:
        finalized.blockHash,
    });

  const registrationEvent =
    matchingDemo4D41bReplacementRegistrationEventV1({
      context: {
        sdk:
          input.context.sdk,

        contractAddress:
          input.context.contractAddress,

        embeddedSchema:
          input.context.embeddedSchema,
      },

      summary,

      expectedPublicKey:
        input.expectedPublicKey,
    });

  const ownership =
    await queryDemo4D41bReplacementRegisteredOwnerOfKeyAtFinalizedBlockV1({
      context: {
        sdk:
          input.context.sdk,

        client:
          input.context.client,

        contractAddress:
          input.context.contractAddress,

        embeddedSchema:
          input.context.embeddedSchema,
      },

      finalizedBlock:
        finalizedSnapshot.finalizedBlock,

      publicKey:
        input.expectedPublicKey,
    });

  if (
    registrationEvent.owner !==
      ownership.owner
  ) {
    throw new Error(
      "event_owner_postcondition_mismatch",
    );
  }

  const transactionHashHex =
    String(
      input.context.sdk.TransactionHash
        .toHexString(
          input.transactionHash,
        ),
    )
      .toLowerCase()
      .replace(/^0x/, "");

  if (
    !/^[0-9a-f]{64}$/.test(
      transactionHashHex,
    )
  ) {
    throw new Error(
      "invalid_transaction_hash",
    );
  }

  const costMicroCcd =
    String(
      summary.cost,
    );

  if (
    !/^(0|[1-9][0-9]*)$/.test(
      costMicroCcd,
    )
  ) {
    throw new Error(
      "invalid_transaction_cost",
    );
  }

  runtimeState.cis8Mutated =
    true;

  runtimeState.finalizedInspectionCompleted =
    true;

  return {
    transaction: {
      hash:
        transactionHashHex,

      finalized:
        true,

      finalizedBlockHash:
        finalizedSnapshot
          .finalizedBlockHash,

      finalizedBlockHeight:
        finalizedSnapshot
          .finalizedBlockHeight,

      energyCost:
        demo4D41bReplacementFinalizedEnergyV1(
          summary.energyCost,
          input.context.sdk,
        ),

      costMicroCcd,

      transactionType:
        "update",
    },

    registrationEvent,

    ownershipPostcondition: {
      owner:
        ownership.owner,

      ownerOfKeyStatus:
        "registered",

      finalized:
        true,

      finalizedBlockHash:
        finalizedSnapshot
          .finalizedBlockHash,

      finalizedBlockHeight:
        finalizedSnapshot
          .finalizedBlockHeight,
    },
  };
}

function writeDemo4D41bReplacementFinalizedEvidenceV1(
  observation:
    Parameters<
      typeof buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1
    >[0],
): {
  readonly evidencePath: string;
  readonly evidenceSha256: string;
} {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  if (
    runtimeState.evidenceWritten === true
  ) {
    throw new Error(
      "finalized_evidence_already_written",
    );
  }

  const built =
    buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1(
      observation,
    );

  if (!built.ok) {
    throw new Error(
      `finalized_evidence_rejected:${built.reason}`,
    );
  }

  const evidencePath =
    safeDemo4D41bReplacementFinalizedEvidencePathV1();

  const serialized =
    Buffer.from(
      `${JSON.stringify(
        built.value,
        null,
        2,
      )}\n`,
      "utf8",
    );

  writeFileSync(
    evidencePath,
    serialized,
    {
      flag:
        "wx",

      mode:
        0o600,
    },
  );

  runtimeState.evidenceWritten =
    true;

  return {
    evidencePath,

    evidenceSha256:
      sha256Hex(
        serialized,
      ),
  };
}

async function submitDemo4D41bReplacementRegistrationV1(
  input: {
    readonly context: {
      readonly sdk: any;
      readonly client: any;
      readonly contractAddress: unknown;
      readonly embeddedSchema: any;
    };

    readonly authorization: unknown;
    readonly registrationParameter: unknown;
    readonly expectedRegistrationParameterSha256: string;
    readonly transactionEnergyAllowance: string;
  },
): Promise<{
  readonly transactionHash: unknown;
  readonly sender: unknown;
}> {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  assertDemo4D41bReplacementSingleSubmissionAvailableV1(
    input.authorization,
  );

  if (
    !/^(0|[1-9][0-9]*)$/.test(
      input.transactionEnergyAllowance,
    )
  ) {
    throw new Error(
      "invalid_transaction_energy_allowance",
    );
  }

  const energyAllowance =
    BigInt(
      input.transactionEnergyAllowance,
    );

  if (
    energyAllowance <= 0n ||
    energyAllowance > 100_000n
  ) {
    throw new Error(
      "transaction_energy_allowance_out_of_bounds",
    );
  }

  const wallet =
    safeDemo4D41bReplacementWalletSignerV1(
      input.context,
    );

  const serializer =
    createDemo4D41bReplacementRegistrationSerializerV1({
      sdk:
        input.context.sdk,

      embeddedSchema:
        input.context.embeddedSchema,

      expectedRegistrationParameterSha256:
        input.expectedRegistrationParameterSha256,
    });

  runtimeState.networkCalled =
    true;

  const contract =
    await input.context.sdk.Contract.create(
      input.context.client,
      input.context.contractAddress,
    );

  const entrypoint =
    input.context.sdk.EntrypointName.fromString(
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .registerEntrypoint,
    );

  const metadata = {
    senderAddress:
      wallet.sender,

    energy:
      input.context.sdk.Energy.create(
        energyAllowance,
      ),

    expiry:
      input.context.sdk.TransactionExpiry.futureMinutes(
        TRANSACTION_EXPIRY_MINUTES,
      ),
  };

  runtimeState.transactionConstructed =
    true;

  runtimeState.transactionSigningAttempted =
    true;

  beginDemo4D41bReplacementSingleSubmissionAttemptV1(
    input.authorization,
  );

  const transactionHash =
    await contract.createAndSendUpdateTransaction(
      entrypoint,
      serializer,
      metadata,
      input.registrationParameter,
      wallet.signer,
    );

  runtimeState.transactionSubmitted =
    true;

  return {
    transactionHash,
    sender:
      wallet.sender,
  };
}

async function executeDemo4D41bReplacementControlledExecutionV1(
  input: {
    readonly explicitControlledExecutionAuthorizationConfirmed:
      boolean;

    readonly finalizationTimeoutMs:
      number;
  },
): Promise<{
  readonly evidencePath:
    string;

  readonly evidenceSha256:
    string;

  readonly transactionHash:
    string;
}> {
  if (
    EXECUTE_DISPATCH_ENABLED !== true
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  const authorizationResult =
    deriveDemo4D41bReplacementControlledExecutionAuthorizationV1({
      explicitControlledExecutionAuthorizationConfirmed:
        input.explicitControlledExecutionAuthorizationConfirmed,

      controlledCapabilitiesEnabled:
        true,
    });

  if (!authorizationResult.ok) {
    throw new Error(
      `controlled_execution_authorization_rejected:${authorizationResult.reason}`,
    );
  }

  const authorization =
    authorizationResult.value;

  const prepared =
    prepareDemo4D41bReplacementSignedRegistrationV1({
      authorization,
    });

  let finalizedEvidence:
    {
      readonly evidencePath:
        string;

      readonly evidenceSha256:
        string;

      readonly transactionHash:
        string;
    } | null =
      null;

  runtimeState.networkCalled =
    true;

  const inspection =
    await inspectConcordiumPublicState(
      prepared.replacementPublicKey,
      {
        validatedContext: async (
          context,
        ) => {
          if (
            context.snapshot
              .finalizedBlockHash !==
              prepared.bound
                .finalizedInspection
                .finalizedBlockHash ||
            context.snapshot
              .finalizedBlockHeight !==
              prepared.bound
                .finalizedInspection
                .finalizedBlockHeight
          ) {
            /*
             * A fresher finalized block is permitted.
             * The authoritative requirement here is
             * still-unregistered state immediately
             * before the one permitted submission.
             */
          }

          const submitted =
            await submitDemo4D41bReplacementRegistrationV1({
              context: {
                sdk:
                  context.sdk,

                client:
                  context.client,

                contractAddress:
                  context.contractAddress,

                embeddedSchema:
                  context.embeddedSchema,
              },

              authorization,

              registrationParameter:
                prepared.registrationParameter,

              expectedRegistrationParameterSha256:
                prepared.expectedRegistrationParameterSha256,

              transactionEnergyAllowance:
                prepared.transactionEnergyAllowance,
            });

          const finalized =
            await finalizeDemo4D41bReplacementRegistrationV1({
              context: {
                sdk:
                  context.sdk,

                client:
                  context.client,

                contractAddress:
                  context.contractAddress,

                embeddedSchema:
                  context.embeddedSchema,
              },

              transactionHash:
                submitted.transactionHash,

              sender:
                submitted.sender,

              expectedPublicKey:
                prepared.replacementPublicKey,

              finalizationTimeoutMs:
                input.finalizationTimeoutMs,
            });

          const written =
            writeDemo4D41bReplacementFinalizedEvidenceV1({
              authorization,

              executionPreflight:
                prepared.bound
                  .evidenceBinding,

              submissionAttempts:
                runtimeState
                  .submissionAttempts,

              automaticRetryAttempted:
                runtimeState
                  .automaticRetryAttempted,

              preState: {
                finalized:
                  true,

                finalizedBlockHash:
                  context.snapshot
                    .finalizedBlockHash,

                finalizedBlockHeight:
                  context.snapshot
                    .finalizedBlockHeight,

                ownerOfKeyStatus:
                  "unregistered",
              },

              dryRun: {
                deterministicParameterByteLength:
                  180,

                deterministicParameterSha256:
                  prepared
                    .expectedRegistrationParameterSha256,

                sdkSerializedParameterByteLength:
                  180,

                sdkSerializedParameterSha256:
                  prepared
                    .expectedRegistrationParameterSha256,

                exactSdkByteEquivalence:
                  true,

                usedEnergy:
                  String(
                    prepared.bound
                      .dryRun
                      .usedEnergy,
                  ),

                transactionEnergyAllowance:
                  prepared
                    .transactionEnergyAllowance,

                zeroCcdAttached:
                  true,
              },

              transaction:
                finalized.transaction,

              registrationEvent:
                finalized
                  .registrationEvent,

              ownershipPostcondition:
                finalized
                  .ownershipPostcondition,

              safety: {
                exactlyOneSubmissionAttempted:
                  runtimeState
                    .submissionAttempts ===
                  1,

                automaticRetryAttempted:
                  runtimeState
                    .automaticRetryAttempted,

                zeroCcdAttached:
                  true,

                cis8004Token287Mutated:
                  runtimeState
                    .cis8004Mutated,

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
              },
            });

          finalizedEvidence = {
            evidencePath:
              written.evidencePath,

            evidenceSha256:
              written.evidenceSha256,

            transactionHash:
              finalized
                .transaction
                .hash,
          };
        },
      },
    );

  runtimeState.finalizedInspectionCompleted =
    true;

  if (
    inspection.ownerOfKeyStatus !==
      "unregistered"
  ) {
    throw new Error(
      "controlled_execution_prestate_not_unregistered",
    );
  }

  if (finalizedEvidence === null) {
    throw new Error(
      "controlled_execution_finalized_evidence_not_produced",
    );
  }

  return finalizedEvidence;
}

function controlledExecutionFinalizationTimeoutMs():
number {
  const configured =
    exactEnv(
      "DEMO4_D4_1B_CONTROLLED_EXECUTION_FINALIZATION_TIMEOUT_MS",
    );

  if (
    configured === undefined ||
    !/^[1-9][0-9]*$/.test(
      configured,
    )
  ) {
    throw new Error(
      "invalid_finalization_timeout",
    );
  }

  const parsed =
    Number(
      configured,
    );

  if (
    !Number.isSafeInteger(
      parsed,
    ) ||
    parsed <= 0 ||
    parsed > 300_000
  ) {
    throw new Error(
      "invalid_finalization_timeout",
    );
  }

  return parsed;
}

function activation(): {
  readonly mode:
    "inspect" | "dry_run" | "execute";

  readonly explicitControlledExecutionAuthorizationConfirmed:
    boolean;
} {
  const configuredMode =
    exactEnv(
      "DEMO4_D4_1B_CONTROLLED_EXECUTION_MODE",
    );

  const mode =
    configuredMode === "inspect" ||
    configuredMode === "dry_run" ||
    configuredMode === "execute"
      ? configuredMode
      : "inspect";

  const explicit =
    exactEnv(
      "DEMO4_D4_1B_CONTROLLED_EXECUTION_AUTHORIZED",
    ) === "true";

  if (
    mode === "execute" &&
    (
      explicit !== true ||
      EXECUTE_DISPATCH_ENABLED !== true
    )
  ) {
    throw new Error(
      "controlled_execution_execute_unavailable",
    );
  }

  return {
    mode,
    explicitControlledExecutionAuthorizationConfirmed:
      explicit,
  };
}

function safeSummary(
  mode:
    "inspect" | "dry_run",
): UnknownRecord {
  return {
    ok:
      true,

    type:
      SCRIPT_TYPE,

    implementationStage:
      IMPLEMENTATION_STAGE,

    mode,

    network:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .concordiumNetwork,

    registry: {
      contract:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .contract,

      moduleReference:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .moduleReference,

      ownerAccount:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,
    },

    executeModeAvailable:
      false,

    explicitAuthorizationRequired:
      true,

    automaticRetryAuthorized:
      false,

    submissionLimit:
      1,

    submissionAttempts:
      runtimeState
        .submissionAttempts,

    runtimeSafety: {
      ...runtimeState,
    },
  };
}

async function main():
Promise<void> {
  const decision =
    activation();

  if (
    decision.mode ===
      "execute"
  ) {
    const executed =
      await executeDemo4D41bReplacementControlledExecutionV1({
        explicitControlledExecutionAuthorizationConfirmed:
          decision
            .explicitControlledExecutionAuthorizationConfirmed,

        finalizationTimeoutMs:
          controlledExecutionFinalizationTimeoutMs(),
      });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok:
            true,

          type:
            SCRIPT_TYPE,

          implementationStage:
            IMPLEMENTATION_STAGE,

          mode:
            "execute",

          transactionHash:
            executed
              .transactionHash,

          finalizedEvidence: {
            path:
              executed
                .evidencePath,

            sha256:
              executed
                .evidenceSha256,
          },

          submissionAttempts:
            runtimeState
              .submissionAttempts,

          automaticRetryAttempted:
            runtimeState
              .automaticRetryAttempted,
        },
        null,
        2,
      )}\n`,
    );

    return;
  }

  process.stdout.write(
    `${JSON.stringify(
      safeSummary(
        decision.mode,
      ),
      null,
      2,
    )}\n`,
  );
}

void authorizeDemo4D41bReplacementControlledExecutionV1;
void buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1;
void sha256Hex;
void isRecord;

if (require.main === module) {
  main().catch(
  (
    error:
      unknown,
  ) => {
    process.stderr.write(
      `${
        error instanceof Error
          ? error.message
          : String(error)
      }\n`,
    );

    process.exitCode =
      1;
  },
);
}
