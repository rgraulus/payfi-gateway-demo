import {
  createHash,
} from "node:crypto";

import {
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  authorizeDemo4D41bReplacementSingleSubmissionV1,
} from "../src/phase6/demo4Cis8ConformantReplacementPreflight";

type UnknownRecord =
  Record<string, unknown>;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readJson(
  path: string,
): unknown {
  return JSON.parse(
    readFileSync(path, "utf8"),
  );
}

function sha256File(
  path: string,
): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function findValues(
  value: unknown,
  target: string,
  found: unknown[] = [],
): unknown[] {
  if (Array.isArray(value)) {
    for (const child of value) {
      findValues(
        child,
        target,
        found,
      );
    }
  } else if (isRecord(value)) {
    for (
      const [key, child]
      of Object.entries(value)
    ) {
      if (key === target) {
        found.push(child);
      }

      findValues(
        child,
        target,
        found,
      );
    }
  }

  return found;
}

function requiredEnvironment(
  name: string,
): string {
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

function main(): void {
  const privateEvidencePath =
    requiredEnvironment(
      "DEMO4_D4_1B_PRIVATE_PREFLIGHT_EVIDENCE_FILE",
    );

  const checkpointPath =
    requiredEnvironment(
      "DEMO4_D4_1B_PREFLIGHT_CHECKPOINT_FILE",
    );

  const outputPath =
    requiredEnvironment(
      "DEMO4_D4_1B_GATE4_AUTHORIZATION_OUTPUT_FILE",
    );

  const privateArtifact =
    readJson(privateEvidencePath);

  const checkpoint =
    readJson(checkpointPath);

  if (
    !isRecord(privateArtifact) ||
    privateArtifact.status !==
      "accepted" ||
    privateArtifact.gate !== 3 ||
    !isRecord(
      privateArtifact.evidence,
    )
  ) {
    throw new Error(
      "invalid_private_preflight_artifact",
    );
  }

  if (!isRecord(checkpoint)) {
    throw new Error(
      "invalid_checkpoint",
    );
  }

  const statuses =
    findValues(
      checkpoint,
      "checkpointStatus",
    );

  const nextSteps =
    findValues(
      checkpoint,
      "nextRequiredStep",
    );

  if (
    statuses.length !== 1 ||
    statuses[0] !==
      "private_preflight_complete_gate4_authorization_pending"
  ) {
    throw new Error(
      "checkpoint_not_ready_for_gate4_authorization",
    );
  }

  if (
    nextSteps.length !== 1 ||
    nextSteps[0] !==
      "explicit_gate4_submission_authorization"
  ) {
    throw new Error(
      "unexpected_checkpoint_next_step",
    );
  }

  const result =
    authorizeDemo4D41bReplacementSingleSubmissionV1({
      privatePreflight:
        privateArtifact.evidence,

      explicitGate4SubmissionAuthorizationConfirmed:
        true,

      submissionAttemptsBefore:
        0,

      automaticRetryAuthorized:
        false,

      zeroCcdRequired:
        true,

      cis8004TokenId:
        "287",

      cis8004Token287MutationAuthorized:
        false,

      d4_1cAttachmentAuthorized:
        false,

      historicalRegistrationRevocationAuthorized:
        false,
    });

  if (result.ok !== true) {
    throw new Error(
      `gate4_authorization_rejected:${result.reason}`,
    );
  }

  const authorization =
    result.value;

  if (
    authorization.status !==
      "gate4_submission_authorized" ||
    authorization.transactionExecutionAuthorized !==
      false ||
    authorization.gate4SubmissionLimit !==
      1 ||
    authorization.submissionAttemptsBefore !==
      0 ||
    authorization.remainingSubmissionAttempts !==
      1 ||
    authorization.automaticRetryAuthorized !==
      false ||
    authorization.zeroCcdRequired !==
      true ||
    authorization.cis8004Token287MutationAuthorized !==
      false ||
    authorization.d4_1cAttachmentAuthorized !==
      false ||
    authorization.historicalRegistrationRevocationAuthorized !==
      false
  ) {
    throw new Error(
      "unexpected_gate4_authorization_contract",
    );
  }

  const artifact = {
    type:
      "xcf.demo4.d4-1b.cis8-conformant-" +
      "replacement-gate4-authorization",

    version: "1",
    gate: 4,
    status: "authorized",

    authorizationScope:
      "exactly_one_controlled_testnet_submission",

    authorization,

    sourceHashes: {
      privatePreflightEvidenceSha256:
        sha256File(
          privateEvidencePath,
        ),

      gate3CheckpointSha256:
        sha256File(
          checkpointPath,
        ),
    },

    runtime: {
      environmentRead: true,
      filesystemRead: true,
      filesystemWrite: true,

      privateKeyRead: false,
      walletRead: false,
      signingAttempted: false,

      networkCalled: false,
      contractInvoked: false,

      transactionConstructed: false,
      transactionSigned: false,
      transactionSubmitted: false,

      cis8Mutated: false,
      cis8004Mutated: false,
      d4_1cAttachmentPerformed: false,
      historicalRegistrationRevoked:
        false,

      automaticRetryAuthorized:
        false,
      productionActivation: false,
    },

    nextRequiredStep:
      "controlled_gate4_execution_preflight_" +
      "requires_separate_authorization",
  } as const;

  const serialized =
    JSON.stringify(
      artifact,
      null,
      2,
    ) + "\n";

  for (const forbidden of [
    "BEGIN PRIVATE KEY",
    "BEGIN OPENSSH PRIVATE KEY",
    "\"rawSignature\":",
    "\"privateKeyPem\":",
  ]) {
    if (
      serialized.includes(forbidden)
    ) {
      throw new Error(
        "sensitive_material_detected",
      );
    }
  }

  writeFileSync(
    outputPath,
    serialized,
    {
      encoding: "utf8",
    },
  );

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,

        status:
          authorization.status,

        gate4SubmissionLimit:
          authorization
            .gate4SubmissionLimit,

        submissionAttemptsBefore:
          authorization
            .submissionAttemptsBefore,

        remainingSubmissionAttempts:
          authorization
            .remainingSubmissionAttempts,

        transactionExecutionAuthorized:
          authorization
            .transactionExecutionAuthorized,

        automaticRetryAuthorized:
          authorization
            .automaticRetryAuthorized,

        zeroCcdRequired:
          authorization
            .zeroCcdRequired,

        transactionConstructed:
          false,

        transactionSigned:
          false,

        transactionSubmitted:
          false,

        nextRequiredStep:
          artifact.nextRequiredStep,
      },
      null,
      2,
    ) + "\n",
  );
}

try {
  main();
} catch (error) {
  const reason =
    error instanceof Error
      ? error.message
      : "unknown_gate4_authorization_failure";

  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        reason,
        transactionConstructed:
          false,
        transactionSigned:
          false,
        transactionSubmitted:
          false,
      },
      null,
      2,
    ) + "\n",
  );

  process.exitCode = 1;
}
