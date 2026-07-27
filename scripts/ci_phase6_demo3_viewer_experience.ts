/**
 * PR #305 — Demo3 viewer-experience presentation-contract harness.
 *
 * This harness never invokes Concordium, CRP, a wallet, the Gateway, or the
 * frozen PR #304 engineering runner.
 *
 * It copies the viewer runner into a temporary isolated repository and supplies
 * a deterministic mock engineering runner. This validates:
 *
 * 1. the complete six-path audience narrative;
 * 2. live-versus-controlled evidence disclosure;
 * 3. exactly-one-payment enforcement;
 * 4. required evidence-marker enforcement;
 * 5. sanitized detailed-log retention;
 * 6. production activation remaining false; and
 * 7. clean temporary-state removal.
 */

import * as assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  spawnSync,
} from "node:child_process";
import * as path from "node:path";

const ROOT =
  path.resolve(
    __dirname,
    "..",
  );

const VIEWER_SOURCE =
  path.join(
    ROOT,
    "scripts",
    "demo_x402_v2_agent_registry_demo3_viewer.sh",
  );

const TMP_ROOT =
  path.join(
    ROOT,
    ".tmp",
  );

const HARNESS_ROOT =
  mkdtempSync(
    path.join(
      TMP_ROOT,
      "pr305-viewer-contract-",
    ),
  );

const SCRIPTS_DIRECTORY =
  path.join(
    HARNESS_ROOT,
    "scripts",
  );

const LOG_DIRECTORY =
  path.join(
    HARNESS_ROOT,
    "viewer-logs",
  );

const VIEWER_COPY =
  path.join(
    SCRIPTS_DIRECTORY,
    "demo_x402_v2_agent_registry_demo3_viewer.sh",
  );

const MOCK_ENGINEERING_RUNNER =
  path.join(
    SCRIPTS_DIRECTORY,
    "demo_x402_v2_agent_registry_demo3_e2e.sh",
  );

type ExecutionResult = {
  readonly status:
    number | null;

  readonly stdout:
    string;

  readonly stderr:
    string;
};

function writeUtf8(
  filePath:
    string,
  content:
    string,
): void {
  writeFileSync(
    filePath,
    content,
    {
      encoding:
        "utf8",
    },
  );
}

function completeMockOutput(
  options: {
    readonly duplicatePayment?:
      boolean;

    readonly omitPath4?:
      boolean;
  } = {},
): string {
  const lines = [
    "#!/usr/bin/env bash",
    "set -uo pipefail",
    'echo "Live token-0 registry smoke passed: true"',
    'echo ">>> Running controlled six-path PR #304 final acceptance"',
    'echo "payfi-gateway-demo HTTP server listening on http://127.0.0.1:3150"',
    'echo "payfi-gateway-demo HTTP server listening on http://127.0.0.1:3150"',
    'echo "payfi-gateway-demo HTTP server listening on http://127.0.0.1:3150"',
    'echo "payfi-gateway-demo HTTP server listening on http://127.0.0.1:3150"',
    'echo "PR304_PATH1_INVALID_BUYER_SIGNATURE_REJECTED=true"',
    'echo "PR304_PATH2_INVALID_AGENT_POP_REJECTED=true"',
    'echo "PR304_PATH3_AGENT_REGISTRY_KEY_MISMATCH_AUDITED=true"',
  ];

  if (
    options.omitPath4 !==
      true
  ) {
    lines.push(
      'echo "PR304_PATH4_AGENT_CARD_HASH_MISMATCH_AUDITED=true"',
    );
  }

  lines.push(
    'echo "PR304_PATH5_INELIGIBLE_BUYER_NO_CONSUMPTION=true"',
    'echo "PR304_PATH6_ELIGIBLE_BUYER_BOUNDED_USE_CONSUMED=true"',
    'echo "PR304_PHASE6_APPEND_ONLY_AUDIT_RETAINED=true"',
    'echo ">>> Entering explicitly enabled Demo3 live-settlement phase"',
    'echo "Wallet prerequisite present: true"',
    'echo "Lifecycle storage ready: true"',
    'echo "Temporary cryptographic key bundle generated: true"',
    'echo "Controlled Demo3 positive manifest generated: true"',
    'echo ">>> Checking service readiness"',
    'echo ">>> LIVE PATH 1 OF 4 - Invalid buyer signature"',
    'echo ">>> LIVE PATH 2 OF 4 - Invalid agent proof-of-possession"',
    'echo ">>> LIVE PATH 3 OF 4 - Authenticated agent with ineligible buyer"',
    'echo ">>> LIVE PATH 4 OF 4 - Authenticated agent with eligible buyer"',
    'echo ">>> Building CRP payment payload"',
    'echo ">>> Creating CRP payment record"',
    'echo ">>> Submitting Concordium PLT payment"',
    'echo "PLT transfer submitted: true"',
  );

  if (
    options.duplicatePayment ===
      true
  ) {
    lines.push(
      'echo "PLT transfer submitted: true"',
    );
  }

  lines.push(
    'echo ">>> Waiting for indexed transfer"',
    'echo "Indexed transfer found: true"',
    'echo ">>> Fulfilling CRP receipt"',
    'echo "CRP fulfill ok: true"',
    'echo ">>> Fetching receipt JWS"',
    'echo "Receipt JWS present: true"',
    'echo ">>> Redeeming against protected resource"',
    'echo "PATH 4 RESULT - PAYMENT FINALIZED AND RESOURCE RELEASED"',
    'echo ">>> Checking replay / second use"',
    'echo "Replay blocked: true"',
    'echo ">>> Verifying final canonical state"',
    'echo "Final result: x402 v2 Agent Registry Demo3 complete"',
    'echo "PR304_CONTROLLED_LIVE_PAYMENT_ACCEPTANCE_PASSED=true"',
    "",
  );

  return lines.join(
    "\n",
  );
}

function runViewer(
  runId:
    string,
  mockOutput:
    string,
): ExecutionResult {
  writeUtf8(
    MOCK_ENGINEERING_RUNNER,
    mockOutput,
  );

  chmodSync(
    MOCK_ENGINEERING_RUNNER,
    0o755,
  );

  const execution =
    spawnSync(
      "bash",
      [
        VIEWER_COPY,
      ],
      {
        cwd:
          HARNESS_ROOT,

        env: {
          ...process.env,

          RUN_ID:
            runId,

          DEMO3_VIEWER_LOG_DIR:
            LOG_DIRECTORY,

          DEMO3_VIEWER_VERBOSE:
            "false",

          DEMO_PACE_SECONDS:
            "0",
        },

        encoding:
          "utf8",
      },
    );

  return {
    status:
      execution.status,

    stdout:
      execution.stdout ?? "",

    stderr:
      execution.stderr ?? "",
  };
}

function requireText(
  haystack:
    string,
  needle:
    string,
  label:
    string,
): void {
  assert.equal(
    haystack.includes(
      needle,
    ),
    true,
    `${label}: expected text ${JSON.stringify(needle)}`,
  );
}

function forbidText(
  haystack:
    string,
  needle:
    string,
  label:
    string,
): void {
  assert.equal(
    haystack.includes(
      needle,
    ),
    false,
    `${label}: forbidden text ${JSON.stringify(needle)}`,
  );
}

function main(): void {
  assert.equal(
    existsSync(
      VIEWER_SOURCE,
    ),
    true,
    "viewer source must exist",
  );

  const viewerSourceText =
    readFileSync(
      VIEWER_SOURCE,
      {
        encoding:
          "utf8",
      },
    );

  assert.equal(
    viewerSourceText.includes(
      'ENGINEERING_WORKDIR=',
    ),
    false,
    "viewer must not define an alternate engineering work directory",
  );

  assert.equal(
    viewerSourceText.includes(
      'WORKDIR="$ENGINEERING_WORKDIR"',
    ),
    false,
    "viewer must not override the frozen PR #304 runner WORKDIR",
  );

  mkdirSync(
    SCRIPTS_DIRECTORY,
    {
      recursive:
        true,
    },
  );

  mkdirSync(
    LOG_DIRECTORY,
    {
      recursive:
        true,
    },
  );

  copyFileSync(
    VIEWER_SOURCE,
    VIEWER_COPY,
  );

  chmodSync(
    VIEWER_COPY,
    0o755,
  );

  const success =
    runViewer(
      "success",
      completeMockOutput(),
    );

  assert.equal(
    success.status,
    0,
    (
      "successful viewer execution failed\n"
      + `stdout:\n${success.stdout}\n`
      + `stderr:\n${success.stderr}`
    ),
  );

  const requiredAudienceText = [
    "DEMO3 — CONCORDIUM AGENT REGISTRY IN AN x402 PAYMENT FLOW",
    "THE STORY",
    "CORE MESSAGE",
    "WHAT THIS DEMO WILL RUN",
    "PAYMENT NOTICE",
    "EVIDENCE NOTICE",
    "LIVE REGISTRY GROUNDING — PASSED",
    "Preparing the six-path authorization matrix...",
    "Controlled environment 1 of 4 ready.",
    "Controlled environment 4 of 4 ready.",
    "PATH 1 OF 6 — INVALID BUYER SIGNATURE",
    "PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION",
    "PATH 3 OF 6 — ACTING-KEY MISMATCH",
    "PATH 4 OF 6 — TAMPERED AGENT CARD",
    "PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER",
    "PATH 6 AUTHORIZATION CHECKPOINT — PASSED",
    "PATH 6 — AUTHORIZED x402 PAYMENT CONTINUATION",
    "SETTLEMENT PREPARATION",
    "[1/4] Delegation lifecycle storage ready.",
    "[4/4] Dedicated Gateway started; checking service readiness.",
    "SETTLEMENT SAFETY REVALIDATION",
    "Safety check 1 of 3: invalid buyer signature rejected before payment.",
    "Safety checks complete.",
    "Submitting 0.050101 EUDemo and waiting for Concordium finalization...",
    "Waiting for the CRP indexer to observe the finalized transfer...",
    "Requesting CRP fulfillment for the finalized transfer...",
    "Fetching the signed receipt...",
    "Redeeming the receipt against the protected resource...",
    "Verifying replay protection...",
    "Verifying final canonical state and append-only audit evidence...",
    "[1/6] Testnet PLT payment submitted",
    "[2/6] Finalized transfer found by the CRP indexer",
    "[3/6] Concordium Receipt Protocol payment fulfilled",
    "[4/6] Receipt obtained",
    "[5/6] Receipt redeemed and protected resource released",
    "[6/6] Replay or second receipt use rejected",
    "PATH 6 OF 6 — VALID AGENT, ELIGIBLE BUYER, SUCCESSFUL PAYMENT",
    "WHAT WE ARE TESTING",
    "EXPECTED RESULT",
    "OBSERVED RESULT",
    "WHY IT MATTERS",
    "DEMO3 CAPABILITY SUMMARY",
    "[PASS] Exactly one 0.050101 EUDemo Testnet payment submitted",
    "[PASS] Production activation remained disabled",
    "DEMO PASSED",
    "PR305_DEMO3_VIEWER_PAYMENT_SUBMISSION_COUNT=1",
    "PR305_DEMO3_VIEWER_PRODUCTION_ACTIVATION=false",
    "PR305_DEMO3_VIEWER_COMPLETE=true",
  ];

  for (
    const text
    of requiredAudienceText
  ) {
    requireText(
      success.stdout,
      text,
      "successful viewer output",
    );
  }

  forbidText(
    success.stdout,
    "[engineering]",
    "default viewer output",
  );

  forbidText(
    success.stdout,
    "BEGIN PRIVATE KEY",
    "default viewer output",
  );

  const successLogPath =
    path.join(
      LOG_DIRECTORY,
      "demo3-viewer-success.log",
    );

  assert.equal(
    existsSync(
      successLogPath,
    ),
    true,
    "successful detailed engineering log must exist",
  );

  const successLog =
    readFileSync(
      successLogPath,
      {
        encoding:
          "utf8",
      },
    );

  requireText(
    successLog,
    "PR304_PATH4_AGENT_CARD_HASH_MISMATCH_AUDITED=true",
    "successful detailed log",
  );

  requireText(
    successLog,
    "PLT transfer submitted: true",
    "successful detailed log",
  );

  requireText(
    successLog,
    "Replay blocked: true",
    "successful detailed log",
  );

  const successStatePath =
    path.join(
      LOG_DIRECTORY,
      "demo3-viewer-success.state",
    );

  assert.equal(
    existsSync(
      successStatePath,
    ),
    false,
    "successful viewer state file must be removed",
  );

  const duplicatePayment =
    runViewer(
      "duplicate-payment",
      completeMockOutput({
        duplicatePayment:
          true,
      }),
    );

  assert.notEqual(
    duplicatePayment.status,
    0,
    "duplicate-payment evidence must fail closed",
  );

  requireText(
    (
      duplicatePayment.stdout
      + duplicatePayment.stderr
    ),
    "Expected exactly one payment submission, observed 2",
    "duplicate-payment failure",
  );

  forbidText(
    duplicatePayment.stdout,
    "PR305_DEMO3_VIEWER_COMPLETE=true",
    "duplicate-payment failure",
  );

  const missingEvidence =
    runViewer(
      "missing-path4",
      completeMockOutput({
        omitPath4:
          true,
      }),
    );

  assert.notEqual(
    missingEvidence.status,
    0,
    "missing required path evidence must fail closed",
  );

  requireText(
    (
      missingEvidence.stdout
      + missingEvidence.stderr
    ),
    "required viewer evidence marker missing: path4",
    "missing-evidence failure",
  );

  forbidText(
    missingEvidence.stdout,
    "PR305_DEMO3_VIEWER_COMPLETE=true",
    "missing-evidence failure",
  );

  console.log(
    JSON.stringify(
      {
        ok:
          true,

        label:
          "phase6-demo3-viewer-experience",

        liveOrControlledNetworkCalled:
          false,

        gatewayCalled:
          false,

        crpCalled:
          false,

        walletCalled:
          false,

        databaseCalled:
          false,

        paymentAttempted:
          false,

        receiptRequested:
          false,

        protectedResourceReleased:
          false,

        viewerSuccessContractValidated:
          true,

        sixPathNarrativeValidated:
          true,

        exactlyOnePaymentGuardValidated:
          true,

        missingEvidenceGuardValidated:
          true,

        detailedEngineeringLogRetained:
          true,

        productionActivation:
          false,
      },
      null,
      2,
    ),
  );

  console.log();
  console.log(
    "PR305_VIEWER_SUCCESS_CONTRACT_VALIDATED=true",
  );
  console.log(
    "PR305_VIEWER_SIX_PATH_NARRATIVE_VALIDATED=true",
  );
  console.log(
    "PR305_VIEWER_EXACTLY_ONE_PAYMENT_GUARD_VALIDATED=true",
  );
  console.log(
    "PR305_VIEWER_MISSING_EVIDENCE_GUARD_VALIDATED=true",
  );
  console.log(
    "PR305_VIEWER_NO_PAYMENT_OR_NETWORK_SIDE_EFFECTS=true",
  );
  console.log(
    "PR305_VIEWER_PRESENTATION_CONTRACT_COMPLETE=true",
  );
}

try {
  main();
} catch (
  error:
    unknown
) {
  console.error(
    "[phase6-demo3-viewer-experience] failed:",
    error,
  );

  process.exitCode =
    1;
} finally {
  rmSync(
    HARNESS_ROOT,
    {
      recursive:
        true,

      force:
        true,
    },
  );

  console.log();
  console.log(
    "PR305_VIEWER_PRESENTATION_CONTRACT_CLEANUP_COMPLETE=true",
  );
}
