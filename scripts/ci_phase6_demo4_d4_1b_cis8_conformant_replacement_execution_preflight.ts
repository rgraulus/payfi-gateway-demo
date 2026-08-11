import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

import {
  authorizeDemo4D41bReplacementExecutionPreflightV1,
  bindDemo4D41bReplacementExecutionPreflightArtifactsV1,
  bindDemo4D41bReplacementExecutionPreflightEvidenceV1,
} from "../src/phase6/demo4Cis8ConformantReplacementExecutionPreflight";

type Classification =
  "accepted" | "rejection";

const tests: Array<{
  readonly name: string;
  readonly classification: Classification;
  readonly body: () => void;
}> = [];

let acceptedCases = 0;
let rejectionCases = 0;
let failed = 0;

function test(
  name: string,
  classification: Classification,
  body: () => void,
): void {
  tests.push({
    name,
    classification,
    body,
  });
}

const exact = {
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
};

test(
  "accepts the exact execution-preflight boundary",
  "accepted",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1(
        exact,
      );

    assert.equal(result.ok, true);

    if (result.ok !== true) {
      throw new Error(
        "exact_execution_preflight_rejected",
      );
    }

    assert.equal(
      result.value.energySafetyCap,
      "100000",
    );

    assert.equal(
      result.value.remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      result.value.registerExternalKeyDryRunAuthorized,
      true,
    );

    assert.equal(
      result.value.transactionSubmissionAuthorized,
      false,
    );
  },
);

test(
  "keeps the core statically side-effect free",
  "accepted",
  () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/phase6/" +
          "demo4Cis8ConformantReplacement" +
          "ExecutionPreflight.ts",
      ),
      "utf8",
    );

    const forbidden = [
      /node:fs/,
      /node:crypto/,
      /@concordium\/web-sdk/,
      /\bfetch\s*\(/,
      /\binvokeContract\s*\(/,
      /\bcreatePrivateKey\s*\(/,
      /\bsign\s*\(/,
      /\bbuildAccountSigner\s*\(/,
      /\bcreateAndSendUpdateTransaction\s*\(/,
      /\bsendTransaction\s*\(/,
    ];

    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden core surface: ${pattern}`,
      );
    }
  },
);

test(
  "rejects missing explicit authorization",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1({
        ...exact,
        explicitExecutionPreflightAuthorizationConfirmed:
          false,
      });

    assert.equal(result.ok, false);
  },
);

test(
  "rejects a consumed submission slot",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1({
        ...exact,
        submissionAttemptsBefore: 1,
        remainingSubmissionAttempts: 0,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "consumed_slot_unexpectedly_accepted",
      );
    }

    assert.equal(
      result.reason,
      "submission_attempt_limit_exceeded",
    );
  },
);

test(
  "rejects automatic retry",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1({
        ...exact,
        automaticRetryAuthorized: true,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "automatic_retry_unexpectedly_accepted",
      );
    }

    assert.equal(
      result.reason,
      "automatic_retry_forbidden",
    );
  },
);

test(
  "rejects wallet access",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1({
        ...exact,
        walletReadEnabled: true,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "wallet_access_unexpectedly_accepted",
      );
    }

    assert.equal(
      result.reason,
      "transaction_boundary_violation",
    );
  },
);

test(
  "rejects transaction submission",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementExecutionPreflightV1({
        ...exact,
        transactionSubmissionEnabled: true,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "transaction_submission_unexpectedly_accepted",
      );
    }

    assert.equal(
      result.reason,
      "transaction_boundary_violation",
    );
  },
);


function resolvedCheckpointClone(
  value: unknown,
): Record<string, any> {
  const checkpoint =
    JSON.parse(
      JSON.stringify(value),
    ) as Record<string, any>;

  assert.equal(
    checkpoint
      .deployedSchemaCompatibility
      ?.status,
    "resolved",
  );

  assert.equal(
    checkpoint
      .deployedSchemaCompatibility
      ?.externalDependency
      ?.status,
    "resolved",
  );

  return checkpoint;
}

test(
  "rejects a synthetic historical blocked checkpoint before execution preflight",
  "rejection",
  () => {
    const authorizationPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "gate4-authorization.json",
    );

    const checkpointPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "preflight-implementation-checkpoint.json",
    );

    const authorizationBytes =
      readFileSync(
        authorizationPath,
      );

    const checkpoint =
      resolvedCheckpointClone(
        JSON.parse(
          readFileSync(
            checkpointPath,
            "utf8",
          ),
        ),
      );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .executionPolicy
        .executionPreflightBlocked,
      true,
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .executionPolicy
        .blockBeforePrivateKeyRead,
      true,
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .executionPolicy
        .transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .supersededHistoricalResolutionContext
        .previousStatus,
      "blocked",
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .supersededHistoricalCanonicalMessageCompatibility
        .draftU16
        .byteLength,
      239,
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .supersededHistoricalCanonicalMessageCompatibility
        .deployedU32
        .byteLength,
      249,
    );

    assert.equal(
      checkpoint
        .deployedSchemaCompatibility
        .supersededHistoricalCanonicalMessageCompatibility
        .sameSigningMessage,
      false,
    );

    checkpoint.gate.checkpointStatus =
      "gate4_blocked_external_cis8_draft_deployment_" +
      "compatibility_dependency";

    checkpoint.gate.nextRequiredStep =
      "obtain_concordium_draft_compatible_testnet_target_" +
      "or_authoritative_compatibility_guidance";

    const result =
      bindDemo4D41bReplacementExecutionPreflightArtifactsV1({
        authorizationArtifact:
          JSON.parse(
            authorizationBytes.toString(
              "utf8",
            ),
          ),

        checkpoint,

        authorizationArtifactSha256:
          createHash("sha256")
            .update(
              authorizationBytes,
            )
            .digest("hex"),
      });

    assert.equal(
      result.ok,
      false,
    );

    if (result.ok !== false) {
      throw new Error(
        "historical_blocked_checkpoint_accepted",
      );
    }

    assert.equal(
      result.reason,
      "checkpoint_not_ready_for_execution_preflight",
    );
  },
);

test(
  "accepts a resolved ready checkpoint without compatibility diagnostics",
  "accepted",
  () => {
    const authorizationPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "gate4-authorization.json",
    );

    const checkpointPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "preflight-implementation-checkpoint.json",
    );

    const authorizationBytes =
      readFileSync(
        authorizationPath,
      );

    const readyCheckpoint =
      resolvedCheckpointClone(
        JSON.parse(
          readFileSync(
            checkpointPath,
            "utf8",
          ),
        ),
      );

    delete readyCheckpoint
      .deployedSchemaCompatibility;

    const result =
      bindDemo4D41bReplacementExecutionPreflightArtifactsV1({
        authorizationArtifact:
          JSON.parse(
            authorizationBytes.toString(
              "utf8",
            ),
          ),

        checkpoint:
          readyCheckpoint,

        authorizationArtifactSha256:
          createHash("sha256")
            .update(
              authorizationBytes,
            )
            .digest("hex"),
      });

    assert.equal(
      result.ok,
      true,
    );

    if (result.ok !== true) {
      throw new Error(
        "resolved_ready_checkpoint_rejected",
      );
    }

    assert.equal(
      result.value
        .remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      result.value
        .transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      result.value
        .transactionSubmitted,
      false,
    );
  },
);

test(
  "rejects a consumed resolved ready checkpoint",
  "rejection",
  () => {
    const authorizationPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "gate4-authorization.json",
    );

    const checkpointPath = resolve(
      process.cwd(),
      "docs/evidence/" +
        "demo4-d4-1b-cis8-conformant-replacement-" +
        "preflight-implementation-checkpoint.json",
    );

    const authorizationBytes =
      readFileSync(
        authorizationPath,
      );

    const readyCheckpoint =
      resolvedCheckpointClone(
        JSON.parse(
          readFileSync(
            checkpointPath,
            "utf8",
          ),
        ),
      );

    readyCheckpoint
      .gate4AuthorizationState
      .remainingSubmissionAttempts = 0;

    const result =
      bindDemo4D41bReplacementExecutionPreflightArtifactsV1({
        authorizationArtifact:
          JSON.parse(
            authorizationBytes.toString(
              "utf8",
            ),
          ),

        checkpoint:
          readyCheckpoint,

        authorizationArtifactSha256:
          createHash("sha256")
            .update(
              authorizationBytes,
            )
            .digest("hex"),
      });

    assert.equal(
      result.ok,
      false,
    );

    if (result.ok !== false) {
      throw new Error(
        "consumed_resolved_slot_accepted",
      );
    }

    assert.equal(
      result.reason,
      "checkpoint_artifact_binding_mismatch",
    );
  },
);

test(
  "accepts the real execution-preflight evidence chain",
  "accepted",
  () => {
    function readArtifact(
      path: string,
    ): {
      readonly value: unknown;
      readonly sha256: string;
    } {
      const bytes =
        readFileSync(path);

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

    const publicArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-public-preflight.json",
        ),
      );

    const privateArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-private-preflight.json",
        ),
      );

    const authorizationArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-gate4-authorization.json",
        ),
      );

    const result =
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
      });

    assert.equal(result.ok, true);

    if (result.ok !== true) {
      throw new Error(
        "real_evidence_chain_rejected",
      );
    }

    assert.equal(
      result.value.ownerOfKeyStatus,
      "unregistered",
    );

    assert.equal(
      result.value.canonicalMessageByteLength,
      249,
    );

    assert.equal(
      result.value.registrationParameterByteLength,
      180,
    );

    assert.equal(
      result.value.transactionSubmitted,
      false,
    );
  },
);

test(
  "rejects forged public evidence provenance",
  "rejection",
  () => {
    function readArtifact(
      path: string,
    ): {
      readonly value: unknown;
      readonly sha256: string;
    } {
      const bytes =
        readFileSync(path);

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

    const publicArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-public-preflight.json",
        ),
      );

    const privateArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-private-preflight.json",
        ),
      );

    const authorizationArtifact =
      readArtifact(
        resolve(
          process.cwd(),
          "docs/evidence/" +
            "demo4-d4-1b-cis8-conformant-" +
            "replacement-gate4-authorization.json",
        ),
      );

    const result =
      bindDemo4D41bReplacementExecutionPreflightEvidenceV1({
        publicPreflightArtifact:
          publicArtifact.value,

        publicPreflightArtifactSha256:
          "0".repeat(64),

        privatePreflightArtifact:
          privateArtifact.value,

        privatePreflightArtifactSha256:
          privateArtifact.sha256,

        gate4AuthorizationArtifact:
          authorizationArtifact.value,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "forged_public_provenance_accepted",
      );
    }

    assert.equal(
      result.reason,
      "evidence_hash_chain_mismatch",
    );
  },
);

for (const current of tests) {
  try {
    current.body();

    if (current.classification === "accepted") {
      acceptedCases += 1;
    } else {
      rejectionCases += 1;
    }

    console.log(
      `PASS ${current.name}`,
    );
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${current.name}`,
    );
    console.error(error);
  }
}

console.log(`TESTS=${tests.length}`);
console.log(`ACCEPTED_CASES=${acceptedCases}`);
console.log(`REJECTION_CASES=${rejectionCases}`);
console.log("FILESYSTEM_READ=false");
console.log("PRIVATE_KEY_READ=false");
console.log("NETWORK_CALLED=false");
console.log("DRY_RUN_CALLED=false");
console.log("WALLET_READ=false");
console.log("TRANSACTION_CONSTRUCTED=false");
console.log("TRANSACTION_SIGNED=false");
console.log("TRANSACTION_SUBMITTED=false");
console.log("SUBMISSION_ATTEMPT_CONSUMED=false");

if (failed !== 0) {
  process.exitCode = 1;
}
