import {
  createHash,
} from "node:crypto";
import {
  readFileSync,
} from "node:fs";

import {
  authorizeDemo4D41bReplacementExecutionPreflightV1,
  bindDemo4D41bReplacementExecutionPreflightArtifactsV1,
  bindDemo4D41bReplacementExecutionPreflightEvidenceV1,
} from "../src/phase6/demo4Cis8ConformantReplacementExecutionPreflight";

import {
  buildControlledPrivatePreflightV1,
} from "./demo_phase6_demo4_d4_1b_cis8_conformant_replacement_private_preflight";

import {
  inspectConcordiumPublicState,
} from "./demo_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight";

import {
  runReplacementRegistrationDryRunV1,
  type ReplacementDryRunFacts,
} from "../src/phase6/demo4Cis8ConformantReplacementExecutionDryRun";

const SCRIPT =
  "demo.phase6.demo4D41bCis8ConformantReplacementExecutionPreflight.v1";

const runtime = {
  environmentRead: false,
  filesystemRead: false,
  privateKeyRead: false,
  cis8MessageSigningAttempted: false,
  signatureLocallyVerified: false,
  signedMaterialBound: false,
  registrationParameterInMemory: false,
  networkCalled: false,
  finalizedInspectionCompleted: false,
  ownerOfKeyRecheckedUnregistered: false,
  dryRunCalled: false,
  dryRunSucceeded: false,
  walletRead: false,
  accountSignerCreated: false,
  transactionConstructed: false,
  transactionSigned: false,
  transactionSubmitted: false,
  submissionAttemptConsumed: false,
};

function requiredEnv(
  name: string,
): string {
  runtime.environmentRead = true;

  const value = process.env[name];

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `missing_environment:${name}`,
    );
  }

  return value;
}

function readArtifact(
  path: string,
): {
  readonly value: unknown;
  readonly sha256: string;
} {
  const bytes = readFileSync(path);

  runtime.filesystemRead = true;

  return {
    value: JSON.parse(
      bytes.toString("utf8"),
    ),

    sha256:
      createHash("sha256")
        .update(bytes)
        .digest("hex"),
  };
}

function accepted<T>(
  result:
    | {
        readonly ok: true;
        readonly value: T;
      }
    | {
        readonly ok: false;
        readonly reason: string;
      },
  prefix: string,
): T {
  if (result.ok !== true) {
    throw new Error(
      `${prefix}:${result.reason}`,
    );
  }

  return result.value;
}

async function main(): Promise<void> {
  const executionGate =
    requiredEnv(
      "DEMO4_D4_1B_EXECUTION_PREFLIGHT",
    );

  if (executionGate !== "true") {
    throw new Error(
      "execution_preflight_gate_not_exact_true",
    );
  }

  const publicArtifact =
    readArtifact(
      requiredEnv(
        "DEMO4_D4_1B_PUBLIC_PREFLIGHT_EVIDENCE_FILE",
      ),
    );

  const privateArtifact =
    readArtifact(
      requiredEnv(
        "DEMO4_D4_1B_PRIVATE_PREFLIGHT_EVIDENCE_FILE",
      ),
    );

  const authorizationArtifact =
    readArtifact(
      requiredEnv(
        "DEMO4_D4_1B_GATE4_AUTHORIZATION_FILE",
      ),
    );

  const checkpoint =
    readArtifact(
      requiredEnv(
        "DEMO4_D4_1B_PREFLIGHT_CHECKPOINT_FILE",
      ),
    );

  const plan = accepted(
    authorizeDemo4D41bReplacementExecutionPreflightV1({
      explicitExecutionPreflightAuthorizationConfirmed:
        true,
      testnetOnly: true,
      zeroCcdRequired: true,
      submissionAttemptsBefore: 0,
      remainingSubmissionAttempts: 1,
      automaticRetryAuthorized: false,
      walletReadEnabled: false,
      accountSignerCreationEnabled: false,
      transactionConstructionEnabled: false,
      transactionSigningEnabled: false,
      transactionSubmissionEnabled: false,
      submissionAttemptConsumptionEnabled: false,
    }),
    "execution_preflight_authorization_rejected",
  );

  const artifactBinding = accepted(
    bindDemo4D41bReplacementExecutionPreflightArtifactsV1({
      authorizationArtifact:
        authorizationArtifact.value,
      authorizationArtifactSha256:
        authorizationArtifact.sha256,
      checkpoint:
        checkpoint.value,
    }),
    "authorization_artifact_binding_rejected",
  );

  const evidenceBinding = accepted(
    bindDemo4D41bReplacementExecutionPreflightEvidenceV1({
      publicPreflightArtifact:
        publicArtifact.value,
      publicPreflightArtifactSha256:
        publicArtifact.sha256,
      privatePreflightArtifact:
        privateArtifact.value,
      privatePreflightArtifactSha256:
        privateArtifact.sha256,
      gate4AuthorizationArtifact:
        authorizationArtifact.value,
    }),
    "evidence_chain_binding_rejected",
  );

  const privateKeyFile =
    requiredEnv(
      "DEMO4_D4_1B_REPLACEMENT_PRIVATE_KEY_FILE",
    );

  runtime.privateKeyRead = true;

  const privateKeyPem =
    readFileSync(
      privateKeyFile,
      "utf8",
    );

  let registrationParameter: unknown;

  const signedMaterial =
    buildControlledPrivatePreflightV1(
      {
        privateKeyPem,
        publicPreflightArtifact:
          publicArtifact.value,
      },
      {
        signingAttempted: () => {
          runtime.cis8MessageSigningAttempted =
            true;
        },

        registrationParameterBuilt: (
          parameter,
        ) => {
          registrationParameter = parameter;
        },
      },
    );

  if (
    typeof registrationParameter !== "object" ||
    registrationParameter === null
  ) {
    throw new Error(
      "registration_parameter_not_captured",
    );
  }

  runtime.registrationParameterInMemory = true;

  if (
    signedMaterial.facts.publicKeyHex !==
      evidenceBinding.replacementPublicKeyHex ||
    signedMaterial.facts.canonicalMessageByteLength !==
      evidenceBinding.canonicalMessageByteLength ||
    signedMaterial.facts.canonicalMessageSha256 !==
      evidenceBinding.canonicalMessageSha256 ||
    signedMaterial.facts.signatureByteLength !==
      64 ||
    signedMaterial.facts.signatureLocallyVerified !==
      true ||
    signedMaterial.facts.registrationParameterByteLength !==
      evidenceBinding.registrationParameterByteLength ||
    signedMaterial.facts.registrationParameterSha256 !==
      evidenceBinding.registrationParameterSha256 ||
    signedMaterial.evidence.privateKeyMaterialIncluded !==
      false ||
    signedMaterial.evidence.rawSignatureIncluded !==
      false ||
    signedMaterial.evidence.walletMaterialIncluded !==
      false
  ) {
    throw new Error(
      "signed_material_binding_mismatch",
    );
  }

  runtime.signatureLocallyVerified = true;
  runtime.signedMaterialBound = true;

  let dryRunFacts:
    ReplacementDryRunFacts | null = null;

  runtime.networkCalled = true;

  const finalizedInspection =
    await inspectConcordiumPublicState(
      Uint8Array.from(
        Buffer.from(
          evidenceBinding.replacementPublicKeyHex,
          "hex",
        ),
      ),
      {
        validatedContext: async (
          context,
        ) => {
          runtime.dryRunCalled = true;

          dryRunFacts =
            await runReplacementRegistrationDryRunV1(
              context,
              registrationParameter,
            );
        },
      },
    );

  runtime.finalizedInspectionCompleted = true;

  if (
    finalizedInspection.ownerOfKeyStatus !==
      "unregistered"
  ) {
    throw new Error(
      "replacement_key_not_unregistered",
    );
  }

  runtime.ownerOfKeyRecheckedUnregistered = true;

  if (dryRunFacts === null) {
    throw new Error(
      "register_external_key_dry_run_not_completed",
    );
  }

  runtime.dryRunSucceeded = true;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: SCRIPT,
        gate: 4,
        implementationStage:
          "execution_preflight_inputs_bound",
        plan,
        artifactBinding,
        evidenceBinding,

        signedMaterial: {
          publicKeyHex:
            signedMaterial.facts.publicKeyHex,

          canonicalMessageByteLength:
            signedMaterial.facts
              .canonicalMessageByteLength,

          canonicalMessageSha256:
            signedMaterial.facts
              .canonicalMessageSha256,

          signatureByteLength:
            signedMaterial.facts.signatureByteLength,

          signatureLocallyVerified:
            signedMaterial.facts
              .signatureLocallyVerified,

          registrationParameterByteLength:
            signedMaterial.facts
              .registrationParameterByteLength,

          registrationParameterSha256:
            signedMaterial.facts
              .registrationParameterSha256,

          privateKeyMaterialIncluded: false,
          rawSignatureIncluded: false,
          walletMaterialIncluded: false,
        },

        finalizedInspection: {
          finalizedBlockHash:
            finalizedInspection.snapshot
              .finalizedBlockHash,

          finalizedBlockHeight:
            finalizedInspection.snapshot
              .finalizedBlockHeight,

          observedAt:
            finalizedInspection.snapshot
              .observedAt,

          moduleReference:
            finalizedInspection.moduleReference,

          ownerOfKeyStatus:
            finalizedInspection.ownerOfKeyStatus,
        },

        dryRun: dryRunFacts,

        runtime,
        nextRequiredStep:
          "capture_execution_preflight_evidence",
      },
      null,
      2,
    ),
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          script: SCRIPT,
          gate: 4,
          implementationStage:
            "execution_preflight_inputs_bound",
          reason:
            error instanceof Error
              ? error.message
              : "unknown_execution_preflight_failure",
          runtime,
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
  },
);
