import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  authorizeDemo4D41bReplacementControlledExecutionV1,
  buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1,
} from "../src/phase6/demo4Cis8ConformantReplacementControlledExecution";

type TestCase = {
  readonly name: string;
  readonly body: () => void;
};

const tests: TestCase[] = [];

function test(
  name: string,
  body: () => void,
): void {
  tests.push({
    name,
    body,
  });
}

function executionPreflight(): any {
  return {
    publicPreflightArtifactSha256:
      "a".repeat(64),

    privatePreflightArtifactSha256:
      "b".repeat(64),

    replacementPublicKeyHex:
      "c".repeat(64),

    ownerAccountBytesHex:
      "d".repeat(64),

    concordiumGenesisHashBytesHex:
      "e".repeat(64),

    ownerOfKeyStatus:
      "unregistered",

    canonicalMessageByteLength:
      249,

    canonicalMessageSha256:
      "1".repeat(64),

    signatureByteLength:
      64,

    signatureLocallyVerified:
      true,

    registrationParameterByteLength:
      180,

    registrationParameterSha256:
      "2".repeat(64),

    privateKeyMaterialIncluded:
      false,

    rawSignatureIncluded:
      false,

    walletMaterialIncluded:
      false,

    walletRead:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,
  };
}

function authorizationInput(): any {
  return {
    executionPreflight:
      executionPreflight(),

    explicitControlledExecutionAuthorizationConfirmed:
      true,

    testnetOnly:
      true,

    submissionAttemptsBefore:
      0,

    automaticRetryAuthorized:
      false,

    zeroCcdRequired:
      true,

    walletReadEnabled:
      true,

    accountSignerCreationEnabled:
      true,

    transactionConstructionEnabled:
      true,

    transactionSigningEnabled:
      true,

    transactionSubmissionEnabled:
      true,

    evidenceWriteEnabled:
      true,

    cis8004Token287MutationAuthorized:
      false,

    d4_1cAttachmentAuthorized:
      false,

    historicalRegistrationRevocationAuthorized:
      false,

    executionPreflightRunnerOutputSha256:
      "3".repeat(64),

    gate4AuthorizationArtifactSha256:
      "4".repeat(64),

    preflightCheckpointSha256:
      "5".repeat(64),
  };
}

function acceptedAuthorization(): any {
  const result =
    authorizeDemo4D41bReplacementControlledExecutionV1(
      authorizationInput(),
    );

  assert.equal(
    result.ok,
    true,
  );

  if (result.ok !== true) {
    throw new Error(
      "authorization_not_accepted",
    );
  }

  return result.value;
}

function observation(): any {
  return {
    authorization:
      acceptedAuthorization(),

    executionPreflight:
      executionPreflight(),

    submissionAttempts:
      1,

    automaticRetryAttempted:
      false,

    preState: {
      finalized:
        true,

      finalizedBlockHash:
        "6".repeat(64),

      finalizedBlockHeight:
        "100",

      ownerOfKeyStatus:
        "unregistered",
    },

    dryRun: {
      deterministicParameterByteLength:
        180,

      deterministicParameterSha256:
        "2".repeat(64),

      sdkSerializedParameterByteLength:
        180,

      sdkSerializedParameterSha256:
        "2".repeat(64),

      exactSdkByteEquivalence:
        true,

      usedEnergy:
        "1436",

      transactionEnergyAllowance:
        "2436",

      zeroCcdAttached:
        true,
    },

    transaction: {
      hash:
        "7".repeat(64),

      finalized:
        true,

      finalizedBlockHash:
        "8".repeat(64),

      finalizedBlockHeight:
        "101",

      energyCost:
        "1855",

      costMicroCcd:
        "12691094",

      transactionType:
        "update",
    },

    registrationEvent: {
      owner:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      publicKeyHex:
        "c".repeat(64),
    },

    ownershipPostcondition: {
      owner:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .ownerAccount,

      ownerOfKeyStatus:
        "registered",

      finalized:
        true,

      finalizedBlockHash:
        "8".repeat(64),

      finalizedBlockHeight:
        "101",
    },

    safety: {
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
    },
  };
}

function expectRejected(
  result: any,
  reason: string,
): void {
  assert.equal(
    result.ok,
    false,
  );

  if (result.ok !== false) {
    throw new Error(
      "expected_rejection",
    );
  }

  assert.equal(
    result.reason,
    reason,
  );
}

test(
  "authorizes exactly one controlled execution",
  () => {
    const result =
      authorizeDemo4D41bReplacementControlledExecutionV1(
        authorizationInput(),
      );

    assert.equal(
      result.ok,
      true,
    );

    if (result.ok !== true) {
      throw new Error(
        "authorization_rejected",
      );
    }

    assert.equal(
      result.value.transactionExecutionAuthorized,
      true,
    );

    assert.equal(
      result.value.submissionLimit,
      1,
    );

    assert.equal(
      result.value.submissionAttemptsBefore,
      0,
    );

    assert.equal(
      result.value.remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      result.value.automaticRetryAuthorized,
      false,
    );
  },
);

test(
  "rejects absent explicit execution authorization",
  () => {
    expectRejected(
      authorizeDemo4D41bReplacementControlledExecutionV1({
        ...authorizationInput(),

        explicitControlledExecutionAuthorizationConfirmed:
          false,
      }),
      "controlled_execution_authorization_required",
    );
  },
);

test(
  "rejects consumed submission allowance",
  () => {
    expectRejected(
      authorizeDemo4D41bReplacementControlledExecutionV1({
        ...authorizationInput(),

        submissionAttemptsBefore:
          1,
      }),
      "submission_attempt_limit_exceeded",
    );
  },
);

test(
  "rejects automatic retry authorization",
  () => {
    expectRejected(
      authorizeDemo4D41bReplacementControlledExecutionV1({
        ...authorizationInput(),

        automaticRetryAuthorized:
          true,
      }),
      "automatic_retry_forbidden",
    );
  },
);

test(
  "rejects incomplete transaction capability",
  () => {
    expectRejected(
      authorizeDemo4D41bReplacementControlledExecutionV1({
        ...authorizationInput(),

        transactionSubmissionEnabled:
          false,
      }),
      "controlled_execution_capability_incomplete",
    );
  },
);

test(
  "rejects adjacent mutation authorization",
  () => {
    expectRejected(
      authorizeDemo4D41bReplacementControlledExecutionV1({
        ...authorizationInput(),

        d4_1cAttachmentAuthorized:
          true,
      }),
      "adjacent_mutation_authorization_forbidden",
    );
  },
);

test(
  "builds sanitized finalized replacement evidence",
  () => {
    const result =
      buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1(
        observation(),
      );

    assert.equal(
      result.ok,
      true,
    );

    if (result.ok !== true) {
      throw new Error(
        "finalized_evidence_rejected",
      );
    }

    assert.equal(
      result.value.status,
      "finalized_registration_confirmed",
    );

    assert.equal(
      result.value.proof.canonicalMessageByteLength,
      249,
    );

    assert.equal(
      result.value.proof.registrationParameterByteLength,
      180,
    );

    assert.equal(
      result.value.proof.exactSdkByteEquivalence,
      true,
    );

    assert.equal(
      result.value.ownershipPostcondition.ownerOfKeyStatus,
      "registered",
    );

    assert.equal(
      result.value.safety.exactlyOneSubmissionAttempted,
      true,
    );
  },
);

test(
  "rejects more than one submission attempt",
  () => {
    expectRejected(
      buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1({
        ...observation(),

        submissionAttempts:
          2,
      }),
      "submission_attempt_limit_exceeded",
    );
  },
);

test(
  "rejects parameter dry-run drift",
  () => {
    const valid =
      observation();

    expectRejected(
      buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1({
        ...valid,

        dryRun: {
          ...valid.dryRun,

          sdkSerializedParameterSha256:
            "9".repeat(64),
        },
      }),
      "dry_run_binding_mismatch",
    );
  },
);

test(
  "rejects unsafe finalized adjacent mutation",
  () => {
    const valid =
      observation();

    expectRejected(
      buildDemo4D41bReplacementSanitizedFinalizedEvidenceV1({
        ...valid,

        safety: {
          ...valid.safety,

          cis8004Token287Mutated:
            true,
        },
      }),
      "unsafe_finalized_evidence",
    );
  },
);

test(
  "pure core contains no runtime execution machinery",
  () => {
    const source =
      readFileSync(
        resolve(
          process.cwd(),
          "src/phase6/" +
            "demo4Cis8ConformantReplacementControlledExecution.ts",
        ),
        "utf8",
      );

    for (
      const forbidden of [
        "node:fs",
        "node:path",
        "@concordium",
        "readFileSync",
        "writeFileSync",
        "createAndSendUpdateTransaction",
        "waitForTransactionFinalization",
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
        `forbidden_runtime_surface:${forbidden}`,
      );
    }
  },
);

function runnerSource(): string {
  return readFileSync(
    resolve(
      process.cwd(),
      "scripts/" +
        "demo_phase6_demo4_d4_1b_cis8_conformant_replacement_controlled_execution.ts",
    ),
    "utf8",
  );
}

function sourceSection(
  source: string,
  start: string,
  end: string,
): string {
  const startIndex =
    source.indexOf(start);

  const endIndex =
    source.indexOf(
      end,
      startIndex + start.length,
    );

  assert.notEqual(
    startIndex,
    -1,
    `missing_section_start:${start}`,
  );

  assert.notEqual(
    endIndex,
    -1,
    `missing_section_end:${end}`,
  );

  assert.ok(
    endIndex > startIndex,
    `invalid_section_order:${start}`,
  );

  return source.slice(
    startIndex,
    endIndex,
  );
}

test(
  "live controlled-execution npm entry point is permanently absent",
  () => {
    const packageJson =
      JSON.parse(
        readFileSync(
          resolve(
            process.cwd(),
            "package.json",
          ),
          "utf8",
        ),
      );

    assert.equal(
      packageJson.scripts?.[
        "phase6:demo4-d4-1b-cis8-conformant-replacement-controlled-execution"
      ],
      undefined,
    );

    assert.equal(
      typeof packageJson.scripts?.[
        "phase6:demo4-d4-1b-cis8-conformant-replacement-controlled-execution-test"
      ],
      "string",
    );
  },
);

test(
  "runner closure metadata and durable preflight provenance are gate5-finalized",
  () => {
    const source =
      runnerSource();

    assert.equal(
      source.includes(
        "const IMPLEMENTATION_STAGE =\n" +
          '  "gate5_finalized_registration_locked" as const;',
      ),
      true,
    );

    assert.equal(
      source.includes(
        "    executeModeAvailable:\n" +
          "      false,",
      ),
      true,
    );

    assert.equal(
      source.includes(
        ".backups/" + "pr312-",
      ),
      false,
    );

    assert.equal(
      source.includes(
        "const EXECUTION_PREFLIGHT_CAPTURE =\n" +
          '  "docs/evidence/demo4-d4-1b-cis8-conformant-replacement-execution-preflight-runner-output.json";',
      ),
      true,
    );

    assert.equal(
      source.includes(
        "Gate 4 completed exactly one authorized Testnet registration.",
      ),
      true,
    );
  },
);

test(
  "runner execute dispatch is permanently gate5-locked",
  () => {
    const source =
      runnerSource();

    assert.equal(
      source.includes(
        "const EXECUTE_DISPATCH_ENABLED =\n" +
          "  false as const;",
      ),
      true,
    );

    assert.equal(
      source.includes(
        "DEMO4_D4_1B_CONTROLLED_EXECUTION_FINALIZATION_TIMEOUT_MS",
      ),
      true,
    );

    assert.equal(
      source.includes(
        "parsed > 300_000",
      ),
      true,
    );
  },
);

test(
  "runner main dispatches execute only through bounded orchestrator",
  () => {
    const source =
      runnerSource();

    assert.equal(
      source.split(
        "executeDemo4D41bReplacementControlledExecutionV1(",
      ).length - 1,
      2,
    );

    const activation =
      sourceSection(
        source,
        "function activation():",
        "function safeSummary(",
      );

    assert.equal(
      activation.includes(
        "DEMO4_D4_1B_CONTROLLED_EXECUTION_AUTHORIZED",
      ),
      true,
    );

    assert.equal(
      activation.includes(
        "explicit !== true",
      ),
      true,
    );

    assert.equal(
      activation.includes(
        "EXECUTE_DISPATCH_ENABLED !== true",
      ),
      true,
    );

    assert.equal(
      activation.includes(
        "controlled_execution_execute_unavailable",
      ),
      true,
    );

    const main =
      sourceSection(
        source,
        "async function main():",
        "void authorizeDemo4D41bReplacementControlledExecutionV1;",
      );

    assert.equal(
      main.includes(
        "executeDemo4D41bReplacementControlledExecutionV1(",
      ),
      true,
    );

    assert.equal(
      main.includes(
        "controlledExecutionFinalizationTimeoutMs()",
      ),
      true,
    );

    assert.equal(
      main.includes(
        "controlled_execution_execute_unavailable",
      ),
      false,
    );
  },
);

test(
  "runner has exactly one physical transaction submission surface",
  () => {
    const source =
      runnerSource();

    assert.equal(
      source.split(
        "createAndSendUpdateTransaction",
      ).length - 1,
      1,
    );
  },
);

test(
  "runner finalization binds event and owner postcondition to transaction finalized block",
  () => {
    const source =
      runnerSource();

    const finalizer =
      sourceSection(
        source,
        "async function finalizeDemo4D41bReplacementRegistrationV1(",
        "function writeDemo4D41bReplacementFinalizedEvidenceV1(",
      );

    const snapshotIndex =
      finalizer.indexOf(
        "loadDemo4D41bReplacementFinalizedSnapshotAtBlockV1(",
      );

    const eventIndex =
      finalizer.indexOf(
        "matchingDemo4D41bReplacementRegistrationEventV1(",
      );

    const ownerIndex =
      finalizer.indexOf(
        "queryDemo4D41bReplacementRegisteredOwnerOfKeyAtFinalizedBlockV1(",
      );

    assert.ok(
      snapshotIndex >= 0,
      "missing_transaction_finalized_snapshot",
    );

    assert.ok(
      eventIndex > snapshotIndex,
      "registration_event_not_after_finalized_snapshot",
    );

    assert.ok(
      ownerIndex > eventIndex,
      "owner_postcondition_not_after_registration_event",
    );

    assert.equal(
      finalizer.includes(
        "finalized.blockHash",
      ),
      true,
    );

    assert.equal(
      finalizer.includes(
        "finalizedBlock:\n        finalizedSnapshot.finalizedBlock",
      ),
      true,
    );

    assert.equal(
      finalizer.includes(
        "event_owner_postcondition_mismatch",
      ),
      true,
    );
  },
);

test(
  "runner finalized evidence writer is exclusive and restrictive",
  () => {
    const source =
      runnerSource();

    const writer =
      sourceSection(
        source,
        "function writeDemo4D41bReplacementFinalizedEvidenceV1(",
        "async function submitDemo4D41bReplacementRegistrationV1(",
      );

    assert.equal(
      source.split(
        "writeFileSync(",
      ).length - 1,
      1,
    );

    assert.equal(
      writer.includes(
        "finalized_evidence_already_written",
      ),
      true,
    );

    assert.equal(
      writer.includes(
        "\"wx\"",
      ),
      true,
    );

    assert.equal(
      writer.includes(
        "0o600",
      ),
      true,
    );
  },
);

test(
  "runner signing preparation and evidence provenance remain hardened",
  () => {
    const source =
      runnerSource();

    const preparation =
      sourceSection(
        source,
        "function prepareDemo4D41bReplacementSignedRegistrationV1(",
        "export function serializeDemo4D41bReplacementControlledExecutionParameterV1(",
      );

    for (
      const required of [
        "PUBLIC_PREFLIGHT_ARTIFACT",
        "PRIVATE_PREFLIGHT_ARTIFACT",
        "EXPECTED_PUBLIC_PREFLIGHT_SHA256",
        "EXPECTED_PRIVATE_PREFLIGHT_SHA256",
        "preflight_evidence_artifact_binding_mismatch",
        "replacement_private_key_symlink_forbidden",
        "replacement_private_key_path_escape",
        "buildControlledPrivatePreflightV1",
        "controlled_execution_signed_material_binding_mismatch",
      ]
    ) {
      assert.equal(
        source.includes(
          required,
        ),
        true,
        `missing_hardened_surface:${required}`,
      );
    }

    assert.equal(
      preparation.includes(
        "buildControlledPrivatePreflightV1(",
      ),
      true,
    );

    assert.equal(
      preparation.includes(
        "signatureLocallyVerified",
      ),
      true,
    );
  },
);

let passed = 0;

for (const current of tests) {
  try {
    current.body();
    passed += 1;

    process.stdout.write(
      `PASS ${current.name}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `FAIL ${current.name}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }\n`,
    );

    process.exitCode = 1;
  }
}

process.stdout.write(
  `${JSON.stringify({
    ok:
      passed === tests.length,
    tests:
      tests.length,
    passed,
    failed:
      tests.length - passed,
    privateKeyRead:
      false,
    walletRead:
      false,
    networkCalled:
      false,
    transactionConstructed:
      false,
    transactionSigned:
      false,
    transactionSubmitted:
      false,
    executionModeInvoked:
      false,
    submissionAttemptConsumed:
      false,
  })}\n`,
);
