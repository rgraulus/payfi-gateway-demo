/**
 * PR #312 Gate 4 — exactly-one-submission authorization CI.
 *
 * No private key, wallet, network, transaction construction, signing,
 * submission, or contract mutation occurs.
 */

import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import {
  tmpdir,
} from "node:os";
import {
  join,
  resolve,
} from "node:path";
import {
  spawnSync,
} from "node:child_process";

import {
  authorizeDemo4D41bReplacementSingleSubmissionV1,
} from "../src/phase6/demo4Cis8ConformantReplacementPreflight";

type Classification =
  "accepted" | "rejection";

const tests: Array<{
  readonly name: string;
  readonly classification: Classification;
  readonly body: () => void;
}> = [];

let acceptedCases = 0;
let rejectionCases = 0;

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

function sha256File(
  path: string,
): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

const runnerPath = resolve(
  process.cwd(),
  "scripts/demo_phase6_demo4_d4_1b_" +
    "cis8_conformant_replacement_" +
    "gate4_authorization.ts",
);

const artifactPath = resolve(
  process.cwd(),
  "docs/evidence/demo4-d4-1b-" +
    "cis8-conformant-replacement-" +
    "gate4-authorization.json",
);

const privateEvidencePath = resolve(
  process.cwd(),
  "docs/evidence/demo4-d4-1b-" +
    "cis8-conformant-replacement-" +
    "private-preflight.json",
);

const checkpointPath = resolve(
  process.cwd(),
  "docs/evidence/demo4-d4-1b-" +
    "cis8-conformant-replacement-" +
    "preflight-implementation-checkpoint.json",
);

const artifact = JSON.parse(
  readFileSync(
    artifactPath,
    "utf8",
  ),
);

const privateArtifact = JSON.parse(
  readFileSync(
    privateEvidencePath,
    "utf8",
  ),
);

const exactAuthorizationInput = {
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
};

test(
  "accepts the exact bounded authorization",
  "accepted",
  () => {
    const result =
      authorizeDemo4D41bReplacementSingleSubmissionV1(
        exactAuthorizationInput,
      );

    assert.equal(result.ok, true);

    if (result.ok !== true) {
      throw new Error(
        "exact_authorization_rejected",
      );
    }

    assert.deepEqual(
      result.value,
      artifact.authorization,
    );
  },
);

test(
  "validates the authorization artifact boundary",
  "accepted",
  () => {
    assert.equal(
      artifact.status,
      "authorized",
    );

    assert.equal(
      artifact.gate,
      4,
    );

    assert.equal(
      artifact.authorization
        .gate4SubmissionLimit,
      1,
    );

    assert.equal(
      artifact.authorization
        .submissionAttemptsBefore,
      0,
    );

    assert.equal(
      artifact.authorization
        .remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      artifact.authorization
        .transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      artifact.authorization
        .automaticRetryAuthorized,
      false,
    );

    assert.equal(
      artifact.authorization
        .zeroCcdRequired,
      true,
    );

    assert.equal(
      artifact.runtime.walletRead,
      false,
    );

    assert.equal(
      artifact.runtime
        .transactionConstructed,
      false,
    );

    assert.equal(
      artifact.runtime
        .transactionSigned,
      false,
    );

    assert.equal(
      artifact.runtime
        .transactionSubmitted,
      false,
    );
  },
);

test(
  "binds authorization to current Gate 3 evidence",
  "accepted",
  () => {
    assert.equal(
      artifact.sourceHashes
        .privatePreflightEvidenceSha256,
      sha256File(
        privateEvidencePath,
      ),
    );

    const checkpointArtifact = JSON.parse(
      readFileSync(
        checkpointPath,
        "utf8",
      ),
    );

    assert.equal(
      artifact.sourceHashes
        .gate3CheckpointSha256,
      checkpointArtifact
        .gate4AuthorizationState
        .authorizationInputCheckpointSha256,
    );
  },
);

test(
  "keeps the authorization runner execution free",
  "accepted",
  () => {
    const source = readFileSync(
      runnerPath,
      "utf8",
    );

    const forbidden = [
      /\bcreatePrivateKey\s*\(/,
      /\bcreatePublicKey\s*\(/,
      /\bgenerateKeyPair/,
      /\bsign\s*\(/,
      /\bverify\s*\(/,
      /\bfetch\s*\(/,
      /@concordium\/web-sdk/,
      /\b(?:sendTransaction|updateContract|invokeContract|executeContract)\s*\(/,
    ];

    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(source),
        false,
        `forbidden runner surface: ${pattern}`,
      );
    }
  },
);

test(
  "rejects any prior submission attempt",
  "rejection",
  () => {
    const result =
      authorizeDemo4D41bReplacementSingleSubmissionV1({
        ...exactAuthorizationInput,
        submissionAttemptsBefore: 1,
      });

    assert.equal(result.ok, false);

    if (result.ok !== false) {
      throw new Error(
        "prior_attempt_unexpectedly_accepted",
      );
    }

    assert.equal(
      result.reason,
      "submission_attempt_limit_exceeded",
    );
  },
);

test(
  "fails closed without authorization inputs",
  "rejection",
  () => {
    const directory = mkdtempSync(
      join(
        tmpdir(),
        "xcf-gate4-auth-",
      ),
    );

    const outputPath = join(
      directory,
      "authorization.json",
    );

    try {
      const environment = {
        ...process.env,
      };

      delete environment[
        "DEMO4_D4_1B_PRIVATE_PREFLIGHT_EVIDENCE_FILE"
      ];

      delete environment[
        "DEMO4_D4_1B_PREFLIGHT_CHECKPOINT_FILE"
      ];

      delete environment[
        "DEMO4_D4_1B_GATE4_AUTHORIZATION_OUTPUT_FILE"
      ];

      const execution = spawnSync(
        process.execPath,
        [
          resolve(
            process.cwd(),
            "node_modules/ts-node/dist/bin.js",
          ),
          "--transpile-only",
          runnerPath,
        ],
        {
          cwd: process.cwd(),
          env: environment,
          encoding: "utf8",
        },
      );

      assert.equal(
        execution.status,
        1,
      );

      const output = JSON.parse(
        execution.stdout,
      );

      assert.equal(
        output.ok,
        false,
      );

      assert.equal(
        output.transactionConstructed,
        false,
      );

      assert.equal(
        output.transactionSigned,
        false,
      );

      assert.equal(
        output.transactionSubmitted,
        false,
      );

      assert.equal(
        existsSync(outputPath),
        false,
      );
    } finally {
      rmSync(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

let failed = 0;

for (const current of tests) {
  try {
    current.body();

    if (
      current.classification ===
      "accepted"
    ) {
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

console.log(
  `TESTS=${tests.length}`,
);
console.log(
  `ACCEPTED_CASES=${acceptedCases}`,
);
console.log(
  `REJECTION_CASES=${rejectionCases}`,
);
console.log(
  "PRIVATE_KEY_READ=false",
);
console.log(
  "WALLET_READ=false",
);
console.log(
  "TRANSACTION_CONSTRUCTED=false",
);
console.log(
  "TRANSACTION_SIGNED=false",
);
console.log(
  "TRANSACTION_SUBMITTED=false",
);
console.log(
  "AUTOMATIC_RETRY_AUTHORIZED=false",
);

if (failed !== 0) {
  process.exitCode = 1;
}
