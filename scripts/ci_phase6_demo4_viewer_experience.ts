import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  tmpdir,
} from "node:os";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";

const viewer =
  path.resolve(
    "scripts/demo_x402_v2_agent_registry_demo4_viewer.sh",
  );

const e2e =
  path.resolve(
    "scripts/demo_x402_v2_agent_registry_demo4_e2e.sh",
  );

const source =
  readFileSync(
    viewer,
    "utf8",
  );

const e2eSource =
  readFileSync(
    e2e,
    "utf8",
  );

for (
  const required
  of [
    "DEMO4 — CONCORDIUM AGENT REGISTRY IN AN x402 PAYMENT FLOW",
    "CORE MESSAGE",
    "SIX DEMONSTRATED PATHS",
    "ACTUAL ENGINEERING EXECUTION STARTS HERE",
    "The results below are produced by the actual Demo4 engineering flow.",
    "Paths 1–5 execute fail-closed authorization cases.",
    "Path 6 executes the live Concordium Testnet payment lifecycle.",
    "CIS-8004",
    "CIS-8",
    "Agent Card",
    "DEMO4_PAYER_CONTINUATION_READY=true",
    "PATH 1 OF 6 — INVALID BUYER AUTHORIZATION",
    "REJECTED — buyer signature invalid",
    "Agent Registry and payment not reached",
    "PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION",
    "REJECTED — proof-of-possession invalid",
    "Authorization and payment stop immediately",
    "PATH 3 OF 6 — REGISTERED ACTING-KEY MISMATCH",
    "REJECTED — acting key does not match",
    "PATH 4 OF 6 — INVALID OR TAMPERED AGENT CARD",
    "REJECTED — Agent Card validation failed",
    "PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER",
    "REJECTED — buyer policy not satisfied",
    "Agent authorization passes, but payment is blocked",
    "PATH 6 OF 6 — VALID REGISTERED AGENT + ELIGIBLE BUYER",
    "Agent Registry identity:   VERIFIED",
    "CIS-8 acting key:          VERIFIED",
    "Agent Card:                VERIFIED",
    "Buyer policy:              SATISFIED",
    "[1/6] x402 payment authorized",
    "Preparing and submitting Testnet payment...",
    "[2/6] One Concordium Testnet payment submitted",
    "Waiting for transaction finalization...",
    "Confirming settlement with the Facilitator...",
    "[3/6] Transaction finalized and settlement observed",
    "Verifying signed receipt...",
    "[4/6] Signed receipt verified",
    "[5/6] Protected resource released",
    "Verifying replay protection...",
    "[6/6] Replay rejected",
    "RESULT — SUCCESS",
    "DEMO4 COMPLETE",
    "Unsafe cases rejected:",
    "Valid case completed:",
    "Concordium Testnet payments:",
    "Protected-resource releases:",
    "Replay:",
    "Production activation:",
    "DEMONSTRATED LIFECYCLE",
    "DEMO PASSED",
    "Expected exactly one payment submission",
    "DEMO4_PRODUCTION_ACTIVATION=true",
    "production activation contradiction detected",
  ]
) {
  assert.equal(
    source.includes(required),
    true,
    `viewer source missing: ${required}`,
  );
}

const executionBoundaryIndex =
  source.indexOf(
    "ACTUAL ENGINEERING EXECUTION STARTS HERE",
  );

const sixPathsIndex =
  source.indexOf(
    'heading "SIX DEMONSTRATED PATHS"',
  );

const engineeringRunnerIndex =
  source.indexOf(
    'bash "$ENGINEERING_RUNNER" 2>&1 |',
  );

assert.ok(
  sixPathsIndex >= 0 &&
  executionBoundaryIndex > sixPathsIndex &&
  engineeringRunnerIndex > executionBoundaryIndex,
  "Viewer six-path roadmap must precede the execution boundary and actual engineering runner invocation",
);

for (
  const required
  of [
    "observe_demo4_crp_index() {",
    "local network=\"concordium:testnet\"",
    "local genesis=\"7\"",
    "local token=\"EUDemo\"",
    "local pay_to=\"4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ\"",
    "local amount_minor=\"50101\"",
    "local limit=\"100\"",
    "--data-urlencode \"network=$network\"",
    "--data-urlencode \"networkGenesisIndex=$genesis\"",
    "--data-urlencode \"tokenId=$token\"",
    "--data-urlencode \"to=$pay_to\"",
    "--data-urlencode \"amountMinor=$amount_minor\"",
    "--data-urlencode \"limit=$limit\"",
    "--arg tx \"$tx_hash\"",
    "--arg chain \"$chain_id\"",
    "(.events // []) |",
    "ascii_downcase",
    ".network_genesis_index == $genesis",
    ".token_id == $token",
    ".to_addr == $to",
    ".amount_minor == $amountMinor",
  ]
) {
  assert.equal(
    e2eSource.includes(required),
    true,
    `E2E CRP observer correlation source missing: ${required}`,
  );
}

assert.equal(
  e2eSource.includes(
    "/v1/crp/plt/search?network=concordium:testnet&txHash=",
  ),
  false,
  "E2E must not send unsupported txHash search filter",
);

assert.equal(
  e2eSource.includes(
    "/v1/crp/plt/search?network=concordium:testnet&txHash=$TX_HASH&limit=1",
  ),
  false,
  "E2E must not trust the first CRP PLT row",
);

for (
  const required
  of [
    "normalize_node_exe_env_path() {",
    `value="$(cygpath -w "$value")"`,
    `normalize_node_exe_env_path "DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH"`,
    `normalize_node_exe_env_path "DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH"`,
    `normalize_node_exe_env_path "DEMO4_D4_3_PAYER_WALLET_PATH"`,
    `challenge_created_truth="UNKNOWN"`,
    `echo "  FRESH_CHALLENGE_CREATED=$challenge_created_truth" >&2`,
    `DEMO4_FINAL_E2E_DATABASE_URL`,
    `DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=true`,
    `DEMO4_E2E_DATABASE_TARGET=transaction-outcome`,
    `export DATABASE_URL="$database_url"`,
    `run_demo4_prechallenge_payer_readiness() {`,
    `require("./scripts/plt-transfer.ts")`,
    `"grpc.testnet.concordium.com"`,
    `"EUDemo"`,
    `"0.050101"`,
    `DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=true`,
    `DEMO4_E2E_PRECHALLENGE_WALLET_READY=true`,
    `DEMO4_E2E_PRECHALLENGE_TESTNET_READY=true`,
    `DEMO4_E2E_PRECHALLENGE_TOKEN_READY=true`,
    `DEMO4_E2E_PRECHALLENGE_ACCOUNT_READY=true`,
    `DEMO4_E2E_PRECHALLENGE_BALANCE_READY=true`,
    `DEMO4_E2E_PRECHALLENGE_SIGNING_PERFORMED=false`,
    `DEMO4_E2E_PRECHALLENGE_TRANSACTION_CONSTRUCTED=false`,
    `DEMO4_E2E_PRECHALLENGE_TRANSACTION_SUBMITTED=false`,
  ]
) {
  assert.equal(
    e2eSource.includes(required),
    true,
    `E2E path/truth source missing: ${required}`,
  );
}

const root =
  mkdtempSync(
    path.join(
      tmpdir(),
      "demo4-viewer-contract-",
    ),
  );

const fakeRunner =
  path.join(
    root,
    "fake-demo4-e2e.sh",
  );

const logDir =
  path.join(
    root,
    "logs",
  );

const fakeD43 =
  path.join(
    root,
    "fake-d43.ts",
  );

const baseLines = [
  "DEMO4_PAYER_CONTINUATION_READY=true",

  "DEMO4_OFFLINE_PATH1_INVALID_BUYER_CONTRACT=true",
  "DEMO4_OFFLINE_PATH2_INVALID_AGENT_POP_CONTRACT=true",
  "DEMO4_OFFLINE_PATH3_CIS8_ACTING_KEY_MISMATCH_CONTRACT=true",
  "DEMO4_OFFLINE_PATH4_AGENT_CARD_TAMPER_CONTRACT=true",
  "DEMO4_OFFLINE_PATH5_INELIGIBLE_BUYER_CONTRACT=true",

  "DEMO4_LIVE_CIS8004_EXACT=true",
  "DEMO4_LIVE_CIS8_EXACT=true",
  "DEMO4_LIVE_AGENT_CARD_EXACT=true",

  "DEMO4_PATH1_INVALID_BUYER_REJECTED=true",
  "DEMO4_PATH2_INVALID_AGENT_POP_REJECTED=true",
  "DEMO4_PATH3_CIS8_ACTING_KEY_MISMATCH_REJECTED=true",
  "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=true",
  "DEMO4_PATH5_INELIGIBLE_BUYER_REJECTED=true",
  "DEMO4_PATH6_REGISTERED_AGENT_AUTHORIZED=true",

  "DEMO4_PAYMENT_SUBMITTED=true",
  "DEMO4_PAYMENT_FINALIZED=true",
  "DEMO4_CRP_INDEXED=true",
  "DEMO4_GATEWAY_OWNED_FULFILL_RELEASE=true",
  "DEMO4_PAYMENT_RESPONSE_EMITTED=true",
  "DEMO4_RECEIPT_JWS_PRESENT=true",
  "DEMO4_RESOURCE_RELEASED=true",
  "DEMO4_REPLAY_REJECTED=true",

  "DEMO4_PRODUCTION_ACTIVATION=false",
  "DEMO4_COMPLETE=true",
];

function writeRunner(
  lines: readonly string[],
): void {
  writeFileSync(
    fakeRunner,
    [
      "#!/usr/bin/env bash",
      "set -e",
      ...lines.map(
        (line) =>
          `printf '%s\\n' '${line}'`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );
}

function runViewer():
ReturnType<typeof spawnSync> {
  return spawnSync(
    "bash",
    [
      viewer,
    ],
    {
      cwd:
        process.cwd(),
      env: {
        ...process.env,
        DEMO4_ENGINEERING_RUNNER:
          fakeRunner,
        DEMO4_VIEWER_LOG_DIR:
          logDir,
        RUN_ID:
          "contract-test",
      },
      encoding:
        "utf8",
    },
  );
}

function writeFakeD43(
  lines: readonly string[],
  exitCode: number,
  prelude: readonly string[] = [],
): void {
  writeFileSync(
    fakeD43,
    [
      ...prelude,
      ...lines.map(
        (line) =>
          `console.log(${JSON.stringify(line)});`,
      ),
      `process.exitCode = ${exitCode};`,
      "",
    ].join("\n"),
    "utf8",
  );
}

function runDiagnosticE2E(
  extraEnv:
    NodeJS.ProcessEnv = {},
):
ReturnType<typeof spawnSync> {
  return spawnSync(
    "bash",
    [
      e2e,
    ],
    {
      cwd:
        process.cwd(),
      env: {
        ...process.env,
        DEMO4_FINAL_E2E_MODE:
          "live",
        DEMO4_FINAL_E2E_LIVE_AUTHORIZED:
          "true",
        DEMO4_FINAL_E2E_DATABASE_URL:
          "postgres://demo4-test:demo4-test@127.0.0.1:5432/transaction-outcome",
        DEMO4_FINAL_E2E_TEST_ONLY:
          "true",
        DEMO4_FINAL_E2E_TEST_NONPAYER_CUSTODY_RESULT:
          "ready",
        DEMO4_FINAL_E2E_TEST_PAYER_READINESS_RESULT:
          "ready",
        DEMO4_FINAL_E2E_TEST_D43_RUNNER:
          fakeD43,
        DEMO4_FINAL_E2E_TEST_SKIP_OFFLINE_SUITES:
          "true",
        DEMO4_FINAL_E2E_TEST_STOP_AFTER_D43_HANDOFF:
          "true",
        DEMO4_D4_3_GATEWAY_BASE_URL:
          "http://127.0.0.1:1",
        DEMO4_D4_3_CRP_BASE_URL:
          "http://127.0.0.1:1",
        RUN_ID:
          "diagnostic-contract-test",
        ...extraEnv,
      },
      encoding:
        "utf8",
    },
  );
}

const missingDbHandoff =
  runDiagnosticE2E({
    DEMO4_FINAL_E2E_DATABASE_URL:
      "",
  });

const missingDbHandoffOutput =
  `${missingDbHandoff.stdout}\n${missingDbHandoff.stderr}`;

assert.notEqual(
  missingDbHandoff.status,
  0,
);

assert.match(
  missingDbHandoffOutput,
  /DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=false/,
);

assert.match(
  missingDbHandoffOutput,
  /DEMO4_E2E_DATABASE_HANDOFF_REASON=missing_database_url/,
);

assert.match(
  missingDbHandoffOutput,
  /DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false/,
);

assert.doesNotMatch(
  missingDbHandoffOutput,
  /FRESH_CHALLENGE_CREATED=true/,
);

const wrongDbTarget =
  runDiagnosticE2E({
    DEMO4_FINAL_E2E_DATABASE_URL:
      "postgres://demo4-test:demo4-test@127.0.0.1:5432/payfi_gateway",
  });

const wrongDbTargetOutput =
  `${wrongDbTarget.stdout}\n${wrongDbTarget.stderr}`;

assert.notEqual(
  wrongDbTarget.status,
  0,
);

assert.match(
  wrongDbTargetOutput,
  /DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=false/,
);

assert.match(
  wrongDbTargetOutput,
  /DEMO4_E2E_DATABASE_HANDOFF_REASON=invalid_database_url_contract/,
);

assert.match(
  wrongDbTargetOutput,
  /DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false/,
);

assert.doesNotMatch(
  wrongDbTargetOutput,
  /FRESH_CHALLENGE_CREATED=true/,
);

const prechallengeNonPayerCustodyFailureCases = [
  "buyer_private_not_ready",
  "acting_private_not_ready",
  "buyer_public_not_ready",
  "acting_public_not_ready",
] as const;

for (
  const custodyFailure
  of prechallengeNonPayerCustodyFailureCases
) {
  writeFakeD43(
    [
      "SYNTHETIC_D43_STARTED=true",
      "FRESH_CHALLENGE_CREATED=true",
      "PAYMENT_ATTEMPTED=false",
    ],
    0,
  );

  const custodyBlocked =
    runDiagnosticE2E({
      DEMO4_FINAL_E2E_TEST_NONPAYER_CUSTODY_RESULT:
        custodyFailure,
    });

  const custodyBlockedOutput =
    `${custodyBlocked.stdout}\n${custodyBlocked.stderr}`;

  assert.notEqual(
    custodyBlocked.status,
    0,
  );

  assert.match(
    custodyBlockedOutput,
    /DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=false/,
  );

  assert.match(
    custodyBlockedOutput,
    new RegExp(
      `DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_REASON=${custodyFailure}`,
    ),
  );

  assert.match(
    custodyBlockedOutput,
    /DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false/,
  );

  assert.doesNotMatch(
    custodyBlockedOutput,
    /SYNTHETIC_D43_STARTED=true/,
  );

  assert.doesNotMatch(
    custodyBlockedOutput,
    /FRESH_CHALLENGE_CREATED=true/,
  );
}

const prechallengePayerFailureCases = [
  "wallet_not_ready",
  "testnet_not_ready",
  "token_not_ready",
  "account_not_ready",
  "balance_not_ready",
] as const;

for (
  const readinessFailure
  of prechallengePayerFailureCases
) {
  writeFakeD43(
    [
      "SYNTHETIC_D43_STARTED=true",
      "FRESH_CHALLENGE_CREATED=true",
      "PAYMENT_ATTEMPTED=false",
    ],
    0,
  );

  const readinessBlocked =
    runDiagnosticE2E({
      DEMO4_FINAL_E2E_TEST_PAYER_READINESS_RESULT:
        readinessFailure,
    });

  const readinessBlockedOutput =
    `${readinessBlocked.stdout}\n${readinessBlocked.stderr}`;

  assert.notEqual(
    readinessBlocked.status,
    0,
  );

  assert.match(
    readinessBlockedOutput,
    /DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=false/,
  );

  assert.match(
    readinessBlockedOutput,
    new RegExp(
      `DEMO4_E2E_PRECHALLENGE_PAYER_REASON=${readinessFailure}`,
    ),
  );

  assert.match(
    readinessBlockedOutput,
    /DEMO4_D4_3_LIVE_RUNNER_EXECUTED=false/,
  );

  assert.doesNotMatch(
    readinessBlockedOutput,
    /SYNTHETIC_D43_STARTED=true/,
  );

  assert.doesNotMatch(
    readinessBlockedOutput,
    /FRESH_CHALLENGE_CREATED=true/,
  );
}

const controlledStopLines = [
  "RUNNER_RESULT=STOP_BEFORE_PAYER_WALLET_PREFLIGHT",
  "PRE_LIVE_GUARD_COMPLETE=true",
  "PRE_LIVE_GUARD_CIS8004_EXACT=true",
  "PRE_LIVE_GUARD_CIS8_EXACT=true",
  "PRE_LIVE_GUARD_AGENT_CARD_EXACT=true",
  "FRESH_CHALLENGE_CREATED=true",
  "PROOF_CONSTRUCTION_COMPLETE=true",
  "PHASE5_CLAIM_INVOKED=true",
  "USAGE_CLAIM_CREATED=true",
  "BOUNDED_USE_CONSUMED=true",
  "CRP_PENDING_REGISTERED=true",
  "PAYMENT_ATTEMPTED=false",
  "CRP_FULFILL_CALLED=false",
  "RESOURCE_RELEASED=false",
  "PRODUCTION_ACTIVATION=false",
];

type CrpIndexEvent = {
  tx_hash?: string;
  txHash?: string;
  network?: string;
  network_genesis_index?: number;
  token_id?: string;
  to_addr?: string;
  amount_minor?: string;
};

const expectedCrpCorrelation = {
  txHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  network:
    "concordium:testnet",
  chain:
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  genesis:
    7,
  token:
    "EUDemo",
  to:
    "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
  amountMinor:
    "50101",
};

function crpIndexEventMatches(
  event: CrpIndexEvent,
): boolean {
  const tx =
    String(
      event.tx_hash ??
      event.txHash ??
      "",
    ).toLowerCase();

  return (
    tx ===
      expectedCrpCorrelation.txHash.toLowerCase() &&
    (
      event.network ===
        expectedCrpCorrelation.network ||
      event.network ===
        expectedCrpCorrelation.chain
    ) &&
    event.network_genesis_index ===
      expectedCrpCorrelation.genesis &&
    event.token_id ===
      expectedCrpCorrelation.token &&
    event.to_addr ===
      expectedCrpCorrelation.to &&
    event.amount_minor ===
      expectedCrpCorrelation.amountMinor
  );
}

try {
  writeRunner(
    baseLines,
  );

  const success =
    runViewer();

  assert.equal(
    success.status,
    0,
    success.stderr,
  );

  assert.match(
    success.stdout,
    /DEMO PASSED/,
  );

  assert.doesNotMatch(
    success.stdout,
    /DEMO4_VIEWER_(?:PAYMENT_SUBMISSION_COUNT|COMPLETE)=/,
  );

  assert.doesNotMatch(
    success.stdout,
    /Detailed engineering log:/,
  );

  assert.doesNotMatch(
    success.stdout,
    /PAYMENT SAFETY/,
  );

  for (
    const progress
    of [
      /ACTUAL ENGINEERING EXECUTION STARTS HERE/,
      /Preparing and submitting Testnet payment\.\.\./,
      /Waiting for transaction finalization\.\.\./,
      /Confirming settlement with the Facilitator\.\.\./,
      /Verifying signed receipt\.\.\./,
      /Verifying replay protection\.\.\./,
    ]
  ) {
    assert.match(
      success.stdout,
      progress,
    );
  }

  assert.doesNotMatch(
    success.stdout,
    /\bCHECK\b/,
  );

  const successExecutionBoundaryIndex =
    success.stdout.indexOf(
      "ACTUAL ENGINEERING EXECUTION STARTS HERE",
    );

  assert.ok(
    successExecutionBoundaryIndex >= 0,
    "execution boundary missing from Viewer output",
  );

  for (
    const roadmapTitle
    of [
      "PATH 1 OF 6 — INVALID BUYER AUTHORIZATION",
      "PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION",
      "PATH 3 OF 6 — REGISTERED ACTING-KEY MISMATCH",
      "PATH 4 OF 6 — INVALID OR TAMPERED AGENT CARD",
      "PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER",
      "PATH 6 OF 6 — VALID REGISTERED AGENT + ELIGIBLE BUYER",
    ]
  ) {
    const roadmapIndex =
      success.stdout.indexOf(
        roadmapTitle,
      );

    assert.ok(
      roadmapIndex >= 0 &&
      roadmapIndex < successExecutionBoundaryIndex,
      `roadmap title must appear before execution boundary: ${roadmapTitle}`,
    );
  }

  let previousResultIndex =
    successExecutionBoundaryIndex;

  for (
    const resultLine
    of [
      "RESULT  REJECTED — buyer signature invalid",
      "RESULT  REJECTED — proof-of-possession invalid",
      "RESULT  REJECTED — acting key does not match",
      "RESULT  REJECTED — Agent Card validation failed",
      "RESULT  REJECTED — buyer policy not satisfied",
      "RESULT — SUCCESS",
    ]
  ) {
    const resultIndex =
      success.stdout.indexOf(
        resultLine,
      );

    assert.ok(
      resultIndex > previousResultIndex,
      `path result must appear sequentially after execution boundary: ${resultLine}`,
    );

    previousResultIndex =
      resultIndex;
  }

  for (
    const expected
    of [
        /PATH 1 OF 6 — INVALID BUYER AUTHORIZATION/,
        /RESULT\s+REJECTED — buyer signature invalid/,
        /EFFECT\s+Agent Registry and payment not reached/,
        /PATH 2 OF 6 — INVALID AGENT PROOF-OF-POSSESSION/,
        /RESULT\s+REJECTED — proof-of-possession invalid/,
        /EFFECT\s+Authorization and payment stop immediately/,
        /PATH 3 OF 6 — REGISTERED ACTING-KEY MISMATCH/,
        /RESULT\s+REJECTED — acting key does not match/,
        /EFFECT\s+Payment not attempted/,
        /PATH 4 OF 6 — INVALID OR TAMPERED AGENT CARD/,
        /RESULT\s+REJECTED — Agent Card validation failed/,
        /PATH 5 OF 6 — VALID AGENT, INELIGIBLE BUYER/,
        /RESULT\s+REJECTED — buyer policy not satisfied/,
        /EFFECT\s+Agent authorization passes, but payment is blocked/,
        /PATH 6 OF 6 — VALID REGISTERED AGENT \+ ELIGIBLE BUYER/,
        /Agent Registry identity:\s+VERIFIED/,
        /CIS-8 acting key:\s+VERIFIED/,
        /Agent Card:\s+VERIFIED/,
        /Buyer policy:\s+SATISFIED/,
        /\[1\/6\] x402 payment authorized/,
        /\[2\/6\] One Concordium Testnet payment submitted/,
        /\[3\/6\] Transaction finalized and settlement observed/,
        /\[4\/6\] Signed receipt verified/,
        /\[5\/6\] Protected resource released/,
        /\[6\/6\] Replay rejected/,
        /RESULT — SUCCESS/,
        /DEMO4 COMPLETE/,
        /Unsafe cases rejected:\s+5 of 5/,
        /Valid case completed:\s+1 of 1/,
        /Concordium Testnet payments:\s+1/,
        /Protected-resource releases:\s+1/,
        /Replay:\s+REJECTED/,
        /Production activation:\s+DISABLED/,
        /DEMONSTRATED LIFECYCLE/,
    ]
  ) {
    assert.match(
      success.stdout,
      expected,
    );
  }

  writeRunner([
    ...baseLines,
    "DEMO4_PAYMENT_SUBMITTED=true",
  ]);

  const duplicate =
    runViewer();

  assert.notEqual(
    duplicate.status,
    0,
  );

  assert.match(
    `${duplicate.stdout}\n${duplicate.stderr}`,
    /Expected exactly one payment submission, observed 2/,
  );

  writeRunner([
    ...baseLines,
    "DEMO4_PRODUCTION_ACTIVATION=true",
  ]);

  const productionContradiction =
    runViewer();

  assert.notEqual(
    productionContradiction.status,
    0,
  );

  assert.doesNotMatch(
    productionContradiction.stdout,
    /DEMO PASSED/,
  );

  assert.match(
    `${productionContradiction.stdout}\n${productionContradiction.stderr}`,
    /production activation contradiction detected/,
  );

  console.log(
    "DEMO4_VIEWER_PRODUCTION_CONTRADICTION_FAIL_CLOSED=PASSED",
  );

  writeRunner(
    baseLines.filter(
      (line) =>
        line !==
        "DEMO4_CRP_INDEXED=true",
    ),
  );

  const missingSettlement =
    runViewer();

  assert.notEqual(
    missingSettlement.status,
    0,
  );

  assert.doesNotMatch(
    missingSettlement.stdout,
    /DEMO PASSED/,
  );

  assert.match(
    `${missingSettlement.stdout}\n${missingSettlement.stderr}`,
    /required Demo4 evidence marker missing: crp_indexed/,
  );

  writeRunner(
    baseLines.filter(
      (line) =>
        line !==
        "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=true",
    ),
  );

  const missing =
    runViewer();

  assert.notEqual(
    missing.status,
    0,
  );

  assert.match(
    `${missing.stdout}\n${missing.stderr}`,
    /required Demo4 evidence marker missing: path4/,
  );

  writeRunner(
    baseLines.filter(
      (line) =>
        line !==
        "DEMO4_PAYER_CONTINUATION_READY=true",
    ),
  );

  const missingContinuation =
    runViewer();

  assert.notEqual(
    missingContinuation.status,
    0,
  );

  assert.doesNotMatch(
    missingContinuation.stdout,
    /DEMO PASSED/,
  );

  assert.match(
    `${missingContinuation.stdout}\n${missingContinuation.stderr}`,
    /required Demo4 evidence marker missing: payer_continuation_ready/,
  );

  writeRunner([
    "DEMO4_PAYER_CONTINUATION_READY=true",
    "DEMO4_OFFLINE_PATH1_INVALID_BUYER_CONTRACT=true",
    "DEMO4_OFFLINE_PATH2_INVALID_AGENT_POP_CONTRACT=true",
    "DEMO4_OFFLINE_PATH3_CIS8_ACTING_KEY_MISMATCH_CONTRACT=true",
    "DEMO4_OFFLINE_PATH4_AGENT_CARD_TAMPER_CONTRACT=true",
    "DEMO4_OFFLINE_PATH5_INELIGIBLE_BUYER_CONTRACT=true",
    "DEMO4_OFFLINE_D43_ONE_SHOT_CONTRACT=true",
    "DEMO4_OFFLINE_EVIDENCE_READY=true",
    "DEMO4_LIVE_CIS8004_EXACT=false",
    "DEMO4_LIVE_CIS8_EXACT=false",
    "DEMO4_LIVE_AGENT_CARD_EXACT=false",
    "DEMO4_PATH1_INVALID_BUYER_REJECTED=false",
    "DEMO4_PATH2_INVALID_AGENT_POP_REJECTED=false",
    "DEMO4_PATH3_CIS8_ACTING_KEY_MISMATCH_REJECTED=false",
    "DEMO4_PATH4_AGENT_CARD_TAMPER_REJECTED=false",
    "DEMO4_PATH5_INELIGIBLE_BUYER_REJECTED=false",
    "DEMO4_PATH6_REGISTERED_AGENT_AUTHORIZED=false",
    "DEMO4_PAYMENT_SUBMITTED=false",
    "DEMO4_RESOURCE_RELEASED=false",
    "DEMO4_REPLAY_REJECTED=false",
    "DEMO4_PRODUCTION_ACTIVATION=false",
    "DEMO4_COMPLETE=false",
  ]);

  const offlineOnly =
    runViewer();

  assert.notEqual(
    offlineOnly.status,
    0,
  );

  assert.doesNotMatch(
    offlineOnly.stdout,
    /DEMO PASSED/,
  );

  assert.match(
    `${offlineOnly.stdout}\n${offlineOnly.stderr}`,
    /required Demo4 evidence marker missing: live_cis8004/,
  );

  const wrongTxEvent: CrpIndexEvent = {
    tx_hash:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    network:
      expectedCrpCorrelation.network,
    network_genesis_index:
      expectedCrpCorrelation.genesis,
    token_id:
      expectedCrpCorrelation.token,
    to_addr:
      expectedCrpCorrelation.to,
    amount_minor:
      expectedCrpCorrelation.amountMinor,
  };

  const exactCanonicalEvent: CrpIndexEvent = {
    tx_hash:
      expectedCrpCorrelation.txHash.toUpperCase(),
    network:
      expectedCrpCorrelation.chain,
    network_genesis_index:
      expectedCrpCorrelation.genesis,
    token_id:
      expectedCrpCorrelation.token,
    to_addr:
      expectedCrpCorrelation.to,
    amount_minor:
      expectedCrpCorrelation.amountMinor,
  };

  const exactLegacyEvent: CrpIndexEvent = {
    ...exactCanonicalEvent,
    network:
      expectedCrpCorrelation.network,
  };

  assert.equal(
    crpIndexEventMatches(
      exactCanonicalEvent,
    ),
    true,
  );

  assert.equal(
    crpIndexEventMatches(
      exactLegacyEvent,
    ),
    true,
  );

  assert.equal(
    [
      wrongTxEvent,
      exactCanonicalEvent,
    ].some(
      crpIndexEventMatches,
    ),
    true,
    "CRP correlation must inspect the collection rather than trust the first row",
  );

  assert.equal(
    crpIndexEventMatches(
      wrongTxEvent,
    ),
    false,
  );

  assert.equal(
    crpIndexEventMatches({
      ...exactCanonicalEvent,
      amount_minor:
        "99999",
    }),
    false,
  );

  assert.equal(
    crpIndexEventMatches({
      ...exactCanonicalEvent,
      to_addr:
        "wrong-recipient",
    }),
    false,
  );

  assert.equal(
    crpIndexEventMatches({
      ...exactCanonicalEvent,
      token_id:
        "WrongToken",
    }),
    false,
  );

  assert.equal(
    crpIndexEventMatches({
      ...exactCanonicalEvent,
      network_genesis_index:
        999,
    }),
    false,
  );

  assert.equal(
    crpIndexEventMatches({
      ...exactCanonicalEvent,
      network:
        "wrong-network",
    }),
    false,
  );

  writeFakeD43(
    [
      "FRESH_CHALLENGE_CREATED=false",
      "PAYMENT_ATTEMPTED=false",
    ],
    1,
    [
      "const windowsPath = /^[A-Za-z]:\\\\/;",
      "const buyerPrivate = process.env.DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH ?? \"\";",
      "const actingPrivate = process.env.DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH ?? \"\";",
      "const payerWallet = process.env.DEMO4_D4_3_PAYER_WALLET_PATH ?? \"\";",
      "console.log(`RUNNER_ERROR=synthetic_path_normalization:buyer=${windowsPath.test(buyerPrivate)},acting=${windowsPath.test(actingPrivate)},payer=${windowsPath.test(payerWallet)}`);",
    ],
  );

  const pathNormalization =
    runDiagnosticE2E({
      DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH:
        "/c/demo4-ci/buyer.private-key.pem",
      DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH:
        "/c/demo4-ci/replacement-ed25519-private.pk8.pem",
      DEMO4_D4_3_PAYER_WALLET_PATH:
        "/c/demo4-ci/wallet.export",
    });

  const pathNormalizationOutput =
    `${pathNormalization.stdout}\n${pathNormalization.stderr}`;

  assert.notEqual(
    pathNormalization.status,
    0,
  );

  assert.match(
    pathNormalizationOutput,
    /DEMO4_E2E_NODE_PATH_NORMALIZED_BUYER_PRIVATE=true/,
  );

  assert.match(
    pathNormalizationOutput,
    /DEMO4_E2E_NODE_PATH_NORMALIZED_ACTING_PRIVATE=true/,
  );

  assert.match(
    pathNormalizationOutput,
    /DEMO4_E2E_NODE_PATH_NORMALIZED_PAYER_WALLET=true/,
  );

  assert.match(
    pathNormalizationOutput,
    /RUNNER_ERROR=synthetic_path_normalization:buyer=true,acting=true,payer=true/,
  );

  assert.match(
    pathNormalizationOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  const contradictoryNonce =
    "ci-post-challenge-nonce-must-not-be-printed";

  writeFakeD43(
    [
      "RUNNER_ERROR=synthetic_post_challenge_failure",
      "FRESH_CHALLENGE_OK=true",
      "FRESH_CHALLENGE_REASON=fresh_challenge_created_and_frozen_tuple_verified",
      "FRESH_CHALLENGE_HTTP_STATUS=402",
      "FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=true",
      "FRESH_CHALLENGE_CREATED=false",
      `FRESH_CHALLENGE_NONCE=${contradictoryNonce}`,
      "PAYMENT_ATTEMPTED=false",
    ],
    1,
  );

  const challengeTruth =
    runDiagnosticE2E();

  const challengeTruthOutput =
    `${challengeTruth.stdout}\n${challengeTruth.stderr}`;

  assert.notEqual(
    challengeTruth.status,
    0,
  );

  assert.match(
    challengeTruthOutput,
    /RUNNER_ERROR=synthetic_post_challenge_failure/,
  );

  assert.match(
    challengeTruthOutput,
    /FRESH_CHALLENGE_OK=true/,
  );

  assert.match(
    challengeTruthOutput,
    /FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=true/,
  );

  assert.match(
    challengeTruthOutput,
    /FRESH_CHALLENGE_CREATED=true/,
  );

  assert.doesNotMatch(
    challengeTruthOutput,
    /FRESH_CHALLENGE_CREATED=false/,
  );

  assert.match(
    challengeTruthOutput,
    /FRESH_CHALLENGE_NONCE_SHA256=[0-9a-f]{64}/,
  );

  assert.doesNotMatch(
    challengeTruthOutput,
    new RegExp(contradictoryNonce),
  );

  assert.match(
    challengeTruthOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  /*
   * Stage-truth regression 1:
   *
   * Gateway redeem is positively known, but a later exception emits
   * generic false lifecycle markers. The claim-related truth must
   * become UNKNOWN rather than a false negative.
   */
  writeFakeD43(
    [
      "RUNNER_ERROR=synthetic_post_redeem_failure",
      "FRESH_CHALLENGE_OK=true",
      "FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=true",
      "GATEWAY_REDEEM_OK=true",
      "GATEWAY_REDEEM_REASON=synthetic_redeem_success",
      "PHASE5_CLAIM_INVOKED=false",
      "USAGE_CLAIM_CREATED=false",
      "BOUNDED_USE_CONSUMED=false",
      "CRP_PENDING_REGISTERED=false",
      "PAYMENT_ATTEMPTED=false",
      "CRP_FULFILL_CALLED=false",
      "RECEIPT_REQUESTED=false",
      "RECEIPT_ISSUED=false",
      "RESOURCE_RELEASED=false",
    ],
    1,
  );

  const postRedeemUnknown =
    runDiagnosticE2E();

  const postRedeemUnknownOutput =
    `${postRedeemUnknown.stdout}\n${postRedeemUnknown.stderr}`;

  assert.notEqual(
    postRedeemUnknown.status,
    0,
  );

  assert.match(
    postRedeemUnknownOutput,
    /GATEWAY_REDEEM_SUCCEEDED=true/,
  );

  assert.match(
    postRedeemUnknownOutput,
    /PHASE5_CLAIM_INVOKED=UNKNOWN/,
  );

  assert.match(
    postRedeemUnknownOutput,
    /USAGE_CLAIM_CREATED=UNKNOWN/,
  );

  assert.match(
    postRedeemUnknownOutput,
    /BOUNDED_USE_CONSUMED=UNKNOWN/,
  );

  assert.doesNotMatch(
    postRedeemUnknownOutput,
    /PHASE5_CLAIM_INVOKED=false/,
  );

  assert.doesNotMatch(
    postRedeemUnknownOutput,
    /USAGE_CLAIM_CREATED=false/,
  );

  assert.doesNotMatch(
    postRedeemUnknownOutput,
    /BOUNDED_USE_CONSUMED=false/,
  );

  /*
   * Stage-truth regression 2:
   *
   * Explicit positive lifecycle evidence must win over contradictory
   * later false markers.
   */
  writeFakeD43(
    [
      "RUNNER_ERROR=synthetic_post_claim_failure",
      "FRESH_CHALLENGE_OK=true",
      "FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=true",
      "GATEWAY_REDEEM_OK=true",
      "PHASE5_CLAIM_STATE_FOUND=true",
      "PHASE5_CLAIM_INVOKED=true",
      "USAGE_CLAIM_CREATED=true",
      "BOUNDED_USE_CONSUMED=true",
      "PHASE5_CLAIM_INVOKED=false",
      "USAGE_CLAIM_CREATED=false",
      "BOUNDED_USE_CONSUMED=false",
      "CRP_PENDING_REGISTERED=false",
      "PAYMENT_ATTEMPTED=false",
    ],
    1,
  );

  const postClaimPositiveWins =
    runDiagnosticE2E();

  const postClaimPositiveWinsOutput =
    `${postClaimPositiveWins.stdout}\n${postClaimPositiveWins.stderr}`;

  assert.notEqual(
    postClaimPositiveWins.status,
    0,
  );

  assert.match(
    postClaimPositiveWinsOutput,
    /GATEWAY_REDEEM_SUCCEEDED=true/,
  );

  assert.match(
    postClaimPositiveWinsOutput,
    /PHASE5_CLAIM_INVOKED=true/,
  );

  assert.match(
    postClaimPositiveWinsOutput,
    /USAGE_CLAIM_CREATED=true/,
  );

  assert.match(
    postClaimPositiveWinsOutput,
    /BOUNDED_USE_CONSUMED=true/,
  );

  assert.doesNotMatch(
    postClaimPositiveWinsOutput,
    /PHASE5_CLAIM_INVOKED=false/,
  );

  /*
   * Stage-truth regression 3:
   *
   * CRP pending positive evidence must also survive a contradictory
   * later false marker.
   */
  writeFakeD43(
    [
      "RUNNER_ERROR=synthetic_post_crp_pending_failure",
      "FRESH_CHALLENGE_OK=true",
      "FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=true",
      "GATEWAY_REDEEM_OK=true",
      "PHASE5_CLAIM_INVOKED=true",
      "USAGE_CLAIM_CREATED=true",
      "BOUNDED_USE_CONSUMED=true",
      "CRP_PENDING_OK=true",
      "CRP_PENDING_REGISTERED=true",
      "CRP_PENDING_REGISTERED=false",
      "PAYMENT_ATTEMPTED=false",
    ],
    1,
  );

  const postCrpPositiveWins =
    runDiagnosticE2E();

  const postCrpPositiveWinsOutput =
    `${postCrpPositiveWins.stdout}\n${postCrpPositiveWins.stderr}`;

  assert.notEqual(
    postCrpPositiveWins.status,
    0,
  );

  assert.match(
    postCrpPositiveWinsOutput,
    /CRP_PENDING_REGISTERED=true/,
  );

  assert.doesNotMatch(
    postCrpPositiveWinsOutput,
    /CRP_PENDING_REGISTERED=false/,
  );

  console.log(
    "DEMO4_E2E_STAGE_TRUTH_POST_REDEEM_UNKNOWN=PASSED",
  );

  console.log(
    "DEMO4_E2E_STAGE_TRUTH_POSITIVE_EVIDENCE_WINS=PASSED",
  );

  console.log(
    "DEMO4_E2E_STAGE_TRUTH_CRP_PENDING_POSITIVE_WINS=PASSED",
  );

  writeFakeD43(
    controlledStopLines,
    2,
  );

  const controlledStop =
    runDiagnosticE2E();

  assert.equal(
    controlledStop.status,
    0,
    `${controlledStop.stdout}\n${controlledStop.stderr}`,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_DATABASE_HANDOFF_VALIDATED=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_DATABASE_TARGET=transaction-outcome/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_DATABASE_CONNECTIVITY_CHECKED=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_SYNTHETIC=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_BUYER_PRIVATE_METADATA_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_ACTING_PRIVATE_METADATA_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_BUYER_PUBLIC_KEY_VALIDATED=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_ACTING_PUBLIC_KEY_VALIDATED=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_READ=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_PUBLIC_KEY_FILE_READ=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_COMPLETE=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_PAYER_PROBE_SYNTHETIC=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_PAYER_READINESS=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_WALLET_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_TESTNET_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_TOKEN_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_ACCOUNT_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_BALANCE_READY=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_WALLET_READ=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_TOKEN_NETWORK_READ=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_ACCOUNT_NETWORK_READ=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_SIGNING_PERFORMED=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_TRANSACTION_CONSTRUCTED=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_TRANSACTION_SUBMITTED=false/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_PRECHALLENGE_PAYER_PROBE_COMPLETE=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_E2E_TEST_D43_HANDOFF_ACCEPTED=true/,
  );

  assert.match(
    controlledStop.stdout,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  writeFakeD43(
    [
      "RUNNER_ERROR=synthetic_missing_runner_result",
      "FRESH_CHALLENGE_CREATED=false",
      "PAYMENT_ATTEMPTED=false",
    ],
    1,
  );

  const missingResult =
    runDiagnosticE2E();

  const missingResultOutput =
    `${missingResult.stdout}\n${missingResult.stderr}`;

  assert.notEqual(
    missingResult.status,
    0,
  );

  assert.match(
    missingResultOutput,
    /D43_CHILD_EXIT_CODE=1/,
  );

  assert.match(
    missingResultOutput,
    /RUNNER_ERROR=synthetic_missing_runner_result/,
  );

  assert.match(
    missingResultOutput,
    /FRESH_CHALLENGE_CREATED=false/,
  );

  assert.match(
    missingResultOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  writeFakeD43(
    [
      "RUNNER_RESULT=BLOCKED_SYNTHETIC_FRESH_CHALLENGE",
      "FRESH_CHALLENGE_REASON=fresh_challenge_response_not_402_with_payment_required",
      "FRESH_CHALLENGE_CREATED=false",
      "PAYMENT_ATTEMPTED=false",
    ],
    3,
  );

  const freshFalse =
    runDiagnosticE2E();

  const freshFalseOutput =
    `${freshFalse.stdout}\n${freshFalse.stderr}`;

  assert.notEqual(
    freshFalse.status,
    0,
  );

  assert.match(
    freshFalseOutput,
    /D43_CHILD_EXIT_CODE=3/,
  );

  assert.match(
    freshFalseOutput,
    /FRESH_CHALLENGE_REASON=fresh_challenge_response_not_402_with_payment_required/,
  );

  assert.match(
    freshFalseOutput,
    /FRESH_CHALLENGE_CREATED=false/,
  );

  assert.match(
    freshFalseOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  const syntheticNonce =
    "ci-raw-nonce-must-not-be-printed";

  writeFakeD43(
    [
      "RUNNER_RESULT=STOP_SYNTHETIC_AMBIGUOUS_FRESH_CHALLENGE",
      "FRESH_CHALLENGE_REASON=fresh_challenge_network_outcome_ambiguous",
      "FRESH_CHALLENGE_CREATED=UNKNOWN",
      `FRESH_CHALLENGE_NONCE=${syntheticNonce}`,
      "PAYMENT_ATTEMPTED=false",
    ],
    4,
  );

  const freshUnknown =
    runDiagnosticE2E();

  const freshUnknownOutput =
    `${freshUnknown.stdout}\n${freshUnknown.stderr}`;

  assert.notEqual(
    freshUnknown.status,
    0,
  );

  assert.match(
    freshUnknownOutput,
    /D43_CHILD_EXIT_CODE=4/,
  );

  assert.match(
    freshUnknownOutput,
    /FRESH_CHALLENGE_CREATED=UNKNOWN/,
  );

  assert.match(
    freshUnknownOutput,
    /FRESH_CHALLENGE_NONCE_SHA256=[0-9a-f]{64}/,
  );

  assert.doesNotMatch(
    freshUnknownOutput,
    new RegExp(syntheticNonce),
  );

  assert.match(
    freshUnknownOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  writeFakeD43(
    [
      "RUNNER_RESULT=STOP_BEFORE_PAYER_WALLET_PREFLIGHT",
      "RUNNER_ERROR=synthetic_unexpected_nonzero_exit",
      "PAYMENT_ATTEMPTED=false",
    ],
    7,
  );

  const nonzeroExit =
    runDiagnosticE2E();

  const nonzeroExitOutput =
    `${nonzeroExit.stdout}\n${nonzeroExit.stderr}`;

  assert.notEqual(
    nonzeroExit.status,
    0,
  );

  assert.match(
    nonzeroExitOutput,
    /D43_CHILD_EXIT_CODE=7/,
  );

  assert.match(
    nonzeroExitOutput,
    /RUNNER_RESULT=STOP_BEFORE_PAYER_WALLET_PREFLIGHT/,
  );

  assert.match(
    nonzeroExitOutput,
    /RUNNER_ERROR=synthetic_unexpected_nonzero_exit/,
  );

  assert.match(
    nonzeroExitOutput,
    /DEMO4_PAYER_CONTINUATION_EXECUTE_MODE_INVOKED=false/,
  );

  console.log(
    "DEMO4_E2E_CRP_SUPPORTED_FILTER_SOURCE_CONTRACT=PASSED",
  );

  console.log(
    "DEMO4_E2E_CRP_EXACT_TX_AND_TUPLE_CORRELATION=PASSED",
  );

  console.log(
    "DEMO4_E2E_CRP_COLLECTION_SCAN_NOT_FIRST_ROW=PASSED",
  );

  console.log(
    "DEMO4_E2E_CRP_WRONG_TX_REJECTED=PASSED",
  );

  console.log(
    "DEMO4_E2E_CRP_WRONG_TUPLE_REJECTED=PASSED",
  );

  console.log(
    "DEMO4_E2E_DATABASE_HANDOFF_PRECHALLENGE_GUARD=PASSED",
  );

  console.log(
    "DEMO4_E2E_DATABASE_MISSING_BLOCKS_BEFORE_D43=PASSED",
  );

  console.log(
    "DEMO4_E2E_DATABASE_WRONG_TARGET_BLOCKS_BEFORE_D43=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_NONPAYER_CUSTODY_GUARD=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_NONPAYER_FAILURES_BLOCK_BEFORE_D43=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_PRIVATE_KEY_CONTENT_NOT_READ=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_PAYER_READINESS_GUARD=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_PAYER_FAILURES_BLOCK_BEFORE_D43=PASSED",
  );

  console.log(
    "DEMO4_E2E_PRECHALLENGE_PAYER_NO_PAYMENT_SIDE_EFFECTS=PASSED",
  );

  console.log(
    "DEMO4_E2E_NODE_PATH_NORMALIZATION=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_CHALLENGE_TRUTH_RECONCILIATION=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_CONTROLLED_STOP_TEST=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_MISSING_RESULT_DIAGNOSTICS=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_FRESH_FALSE_DIAGNOSTICS=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_FRESH_UNKNOWN_DIAGNOSTICS=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_NONZERO_EXIT_DIAGNOSTICS=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_RAW_NONCE_NOT_PRINTED=PASSED",
  );

  console.log(
    "DEMO4_E2E_D43_FAILURES_BLOCK_PAYER_CONTINUATION=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_SOURCE_CONTRACT=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_SUCCESS_PATH=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_DUPLICATE_PAYMENT_FAIL_CLOSED=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_MISSING_EVIDENCE_FAIL_CLOSED=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_MISSING_PAYER_CONTINUATION_FAIL_CLOSED=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_OFFLINE_EVIDENCE_CANNOT_MASQUERADE_AS_LIVE=PASSED",
  );

  console.log(
    "DEMO4_VIEWER_EXPERIENCE_TEST=PASSED",
  );

  console.log(
    "LIVE_EXECUTION_PERFORMED=false",
  );

  console.log(
    "PAYMENT_ATTEMPTED=false",
  );

  console.log(
    "PRODUCTION_ACTIVATION=false",
  );
} finally {
  rmSync(
    root,
    {
      recursive:
        true,
      force:
        true,
    },
  );
}

// -----------------------------------------------------------------------------
// Demo4 non-resubmitting settlement-reconciliation bridge.
//
// submitted_unknown + known tx hash:
//   - payment budget remains consumed;
//   - payer is never reinvoked;
//   - exact existing CRP PLT-index reconciliation may proceed.
//
// This is a static/no-payment contract.
// -----------------------------------------------------------------------------
{
  const fs =
    require("node:fs");

  const assert =
    require("node:assert/strict");

  const source =
    fs.readFileSync(
      "scripts/demo_x402_v2_agent_registry_demo4_e2e.sh",
      "utf8",
    );

  assert.ok(
    source.includes(
      "PAYMENT_FINALIZATION_RECONCILIATION_REQUIRED=true",
    ),
  );

  assert.ok(
    source.includes(
      "DEMO4_PAYMENT_RESUBMISSION_AFTER_UNKNOWN=false",
    ),
  );

  assert.ok(
    source.includes(
      "DEMO4_PAYMENT_BUDGET_REMAINS_CONSUMED=true",
    ),
  );

  assert.ok(
    source.includes(
      "DEMO4_PAYMENT_FINALIZATION_RECONCILIATION_SOURCE=exact_crp_plt_index",
    ),
  );

  assert.ok(
    source.includes(
      "submitted-unknown payment lacks a valid transaction hash; reconciliation blocked",
    ),
  );

  const exitIndex =
    source.indexOf(
      "CONTINUATION_EXIT=$?",
    );

  const indexedMarker =
    source.indexOf(
      "echo \"DEMO4_CRP_INDEXED=true\"",
      exitIndex,
    );

  assert.ok(
    exitIndex >= 0 &&
    indexedMarker > exitIndex,
  );

  const region =
    source.slice(
      exitIndex,
      indexedMarker,
    );

  assert.ok(
    region.includes(
      "\"PAYMENT_OUTCOME\" \"submitted_unknown\"",
    ),
  );

  assert.ok(
    region.includes(
      "TX_HASH",
    ),
  );

  assert.ok(
    region.includes(
      "DEMO4_PAYMENT_BUDGET_REMAINS_CONSUMED=true",
    ),
  );

  assert.equal(
    region.includes(
      "\"$PAYER_CONTINUATION\"",
    ),
    false,
  );

  console.log(
    "PR_DEMO4_NONRESUBMITTING_RECONCILIATION_BRIDGE_VALIDATED=true",
  );

  console.log(
    "PR_DEMO4_SUBMITTED_UNKNOWN_REQUIRES_KNOWN_TX=true",
  );

  console.log(
    "PR_DEMO4_UNKNOWN_PAYMENT_AUTOMATIC_RETRY=false",
  );

  console.log(
    "PR_DEMO4_EXISTING_POST_PAYMENT_PATH_REUSED=true",
  );
}
// -----------------------------------------------------------------------------
// Demo4 historical-timeliness recovery seam — deterministic source contract.
// No server execution, network, database, wallet, signing, fulfill, or release.
// -----------------------------------------------------------------------------

const demo4HistoricalRecoveryServerSource =
  readFileSync(
    path.resolve(
      "src/server.ts",
    ),
    "utf8",
  );

const demo4HistoricalRecoveryStart =
  demo4HistoricalRecoveryServerSource.indexOf(
    "// Demo4 historical-timeliness recovery.",
  );

const demo4HistoricalRecoveryEnd =
  demo4HistoricalRecoveryServerSource.indexOf(
    "phase4RealCrpFulfillInvocationBoundaryEnabled === true",
    demo4HistoricalRecoveryStart,
  );

assert.ok(
  demo4HistoricalRecoveryStart >= 0,
  "historical-timeliness recovery branch must exist",
);

assert.ok(
  demo4HistoricalRecoveryEnd >
    demo4HistoricalRecoveryStart,
  "historical-timeliness recovery branch must precede normal Phase-4 controlled path",
);

const demo4HistoricalRecoveryRegion =
  demo4HistoricalRecoveryServerSource.slice(
    demo4HistoricalRecoveryStart,
    demo4HistoricalRecoveryEnd,
  );

for (
  const required of [
    "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_ENABLED",
    "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_AUTHORIZED",
    "x-demo4-historical-timeliness-recovery",
    "getCanonicalChallengeBindingByNonce(nonce)",
    "POLICY_SATISFIED",
    "NOT_RELEASED",
    "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_MAX_AGE_SEC",
    "recoveryOriginalExpiresAtSec",
    "recoverySettledAt <= recoveryOriginalExpiresAtSec",
    "Math.trunc(recoveryReceiptExpiresAt)",
    "recoveryReceiptTxHash ===",
    "txHashFromSig",
    "networkGenesisIndexFromSig !== 7",
    "crpClient.fulfillPayment(matchReq)",
    "assertCcdPltProofV1(recoveryProof)",
    "recoveryReplayExpSec",
    "finalizeSuccessfulSettlementAndRelease",
    "originalChallengePreserved: true",
    "originalExpiryPreserved: true",
    "paymentSubmitted: false",
    "paymentRetryAllowed: false",
  ]
) {
  assert.ok(
    demo4HistoricalRecoveryServerSource.includes(
      required,
    ),
    `historical recovery source missing required invariant: ${required}`,
  );
}

assert.doesNotMatch(
  demo4HistoricalRecoveryRegion,
  /persistIssuedChallengeIfNeeded/,
  "historical recovery branch must not persist or refresh challenge issuance",
);

assert.doesNotMatch(
  demo4HistoricalRecoveryRegion,
  /sendIntentToOrchestrator/,
  "historical recovery branch must not send a fresh payment intent",
);

assert.doesNotMatch(
  demo4HistoricalRecoveryRegion,
  /sendProofToOrchestrator/,
  "historical recovery branch must not send a fresh payment proof workflow",
);

assert.doesNotMatch(
  demo4HistoricalRecoveryRegion,
  /Token\.transfer|executePreparedPltTransferV1|payer:plt/,
  "historical recovery branch must never submit or reconstruct a payment",
);

assert.match(
  demo4HistoricalRecoveryServerSource,
  /if \(demo4HistoricalTimelinessRecoveryActive === true\) \{\s+return Promise\.resolve\(\);\s+\}\s+\n?\s*if \(issuedPersistStarted/s,
);

assert.match(
  demo4HistoricalRecoveryServerSource,
  /if \(demo4HistoricalTimelinessRecoveryActive === true\) \{\s+return Promise\.resolve\(\);\s+\}\s+\n?\s*if \(proofWorkflowPersistStarted/s,
);

assert.match(
  demo4HistoricalRecoveryServerSource,
  /recoveryReplayExpSec !== null[\s\S]*?nowSec \+ ttlSec[\s\S]*?: deriveReplayExpSec/,
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_SOURCE_CONTRACT=PASSED",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_ENV_GATED=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_CANONICAL_CHALLENGE_REQUIRED=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_ORIGINAL_EXPIRY_PRESERVED=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_PAYMENT_TIMELINESS_REQUIRED=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_NO_NEW_INTENT=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_NO_PAYMENT_RESUBMISSION=true",
);

console.log(
  "DEMO4_HISTORICAL_TIMELINESS_RECOVERY_BOUNDED_REPLAY_WINDOW=true",
);
// -----------------------------------------------------------------------------
// Demo4 historical-recovery Phase-3 policy-gate ordering contract.
//
// The legacy Phase-3 disabled gate must remain the default behavior, but an
// explicitly requested + enabled + authorized Demo4 historical recovery may
// pass that single early gate so downstream Testnet/chain/canonical checks can
// execute.
// -----------------------------------------------------------------------------

const demo4HistoricalRecoveryPolicyGateOrderingSource =
  readFileSync(
    path.resolve("src/server.ts"),
    "utf8",
  );

const demo4RecoveryHandlerStart =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "async function handleX402(",
  );

const demo4RecoveryEarlyHeader =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "const demo4HistoricalTimelinessRecoveryHeader =",
    demo4RecoveryHandlerStart,
  );

const demo4RecoveryEarlyBypass =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "const demo4HistoricalTimelinessRecoveryPhase3PolicyGateBypass =",
    demo4RecoveryHandlerStart,
  );

const demo4RecoveryLegacyGate =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "return replyPhase3GatewayPolicyGateDisabled(res);",
    demo4RecoveryHandlerStart,
  );

const demo4RecoveryContractResolution =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "contractResolver.resolveByResource({",
    demo4RecoveryHandlerStart,
  );

const demo4RecoveryActiveDefinition =
  demo4HistoricalRecoveryPolicyGateOrderingSource.indexOf(
    "const demo4HistoricalTimelinessRecoveryActive =",
    demo4RecoveryHandlerStart,
  );

assert.ok(
  demo4RecoveryHandlerStart >= 0,
  "handleX402 must exist",
);

assert.ok(
  demo4RecoveryEarlyHeader > demo4RecoveryHandlerStart,
  "historical recovery header must be parsed at handler entry",
);

assert.ok(
  demo4RecoveryEarlyBypass > demo4RecoveryEarlyHeader,
  "historical recovery early policy bypass must follow explicit header parsing",
);

assert.ok(
  demo4RecoveryLegacyGate > demo4RecoveryEarlyBypass,
  "legacy Phase-3 disabled rejection must occur after narrow recovery bypass derivation",
);

assert.ok(
  demo4RecoveryContractResolution > demo4RecoveryLegacyGate,
  "normal contract resolution ordering must remain after the legacy policy gate",
);

assert.ok(
  demo4RecoveryActiveDefinition > demo4RecoveryContractResolution,
  "fully active recovery mode must still require resolved contract data",
);

assert.match(
  demo4HistoricalRecoveryPolicyGateOrderingSource,
  /const demo4HistoricalTimelinessRecoveryPhase3PolicyGateBypass =\s+demo4HistoricalTimelinessRecoveryRequested === true &&\s+demo4HistoricalTimelinessRecoveryEnabled === true &&\s+demo4HistoricalTimelinessRecoveryAuthorized === true &&\s+resourcePathname === '\/paid-gated';/s,
);

assert.match(
  demo4HistoricalRecoveryPolicyGateOrderingSource,
  /isPhase3GatewayPolicyGatePath\(resourcePathname\) &&\s+!phase3GatewayPolicyGateEnabled &&\s+demo4HistoricalTimelinessRecoveryPhase3PolicyGateBypass !== true/s,
);

assert.match(
  demo4HistoricalRecoveryPolicyGateOrderingSource,
  /const demo4HistoricalTimelinessRecoveryActive =\s+demo4HistoricalTimelinessRecoveryPhase3PolicyGateBypass === true &&\s+contract\.network === 'concordium:testnet' &&\s+contract\.chain_id ===\s+'ccd:4221332d34e1694168c2a0c0b3fd0f27';/s,
);

assert.equal(
  (
    demo4HistoricalRecoveryPolicyGateOrderingSource.match(
      /const demo4HistoricalTimelinessRecoveryHeader =/g,
    ) || []
  ).length,
  1,
  "recovery request header must be parsed exactly once",
);

assert.equal(
  (
    demo4HistoricalRecoveryPolicyGateOrderingSource.match(
      /const demo4HistoricalTimelinessRecoveryRequested =/g,
    ) || []
  ).length,
  1,
  "recovery requested boolean must be defined exactly once",
);

assert.ok(
  demo4HistoricalRecoveryPolicyGateOrderingSource.includes(
    "return replyPhase3GatewayPolicyGateDisabled(res);",
  ),
  "ordinary legacy Phase-3 disabled response must remain intact",
);

console.log(
  "DEMO4_HISTORICAL_RECOVERY_POLICY_GATE_ORDERING_CONTRACT=PASSED",
);

console.log(
  "DEMO4_NORMAL_PHASE3_POLICY_GATE_PRESERVED=true",
);

console.log(
  "DEMO4_RECOVERY_EARLY_BYPASS_REQUIRES_REQUEST_ENABLE_AUTH=true",
);

console.log(
  "DEMO4_RECOVERY_FULL_ACTIVE_STILL_REQUIRES_TESTNET_CHAIN=true",
);
// -----------------------------------------------------------------------------
// Demo4 CRP observer/reconciliation classification regression.
//
// This executes only the E2E test-only observer seam.
// No D4-3 invocation, challenge creation, payer continuation, payment,
// settlement mutation, receipt release, or production activation occurs.
// -----------------------------------------------------------------------------
{
  const fs =
    require("node:fs");

  const os =
    require("node:os");

  const pathModule =
    require("node:path");

  const childProcess =
    require("node:child_process");

  const observerRoot:
    string =
    fs.mkdtempSync(
      pathModule.join(
        os.tmpdir(),
        "demo4-observer-ci-",
      ),
    );

  const mockServer:
    string =
    pathModule.join(
      observerRoot,
      "mock-crp.cjs",
    );

  const observerTx =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  fs.writeFileSync(
    mockServer,
    [
      'const http = require("node:http");',
      'const mode = process.argv[2];',
      'const port = Number(process.argv[3]);',
      'const tx = process.argv[4];',
      '',
      'const event = {',
      '  tx_hash: tx,',
      '  network: "concordium:testnet",',
      '  network_genesis_index: 7,',
      '  token_id: "EUDemo",',
      '  to_addr: "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",',
      '  amount_minor: "50101",',
      '};',
      '',
      'const server = http.createServer((_req, res) => {',
      '  if (mode === "http500") {',
      '    res.statusCode = 500;',
      '    res.setHeader("content-type", "application/json");',
      '    res.end(JSON.stringify({ ok: false, events: [] }));',
      '    return;',
      '  }',
      '',
      '  res.statusCode = 200;',
      '',
      '  if (mode === "invalid") {',
      '    res.setHeader("content-type", "application/json");',
      '    res.end("{\\"events\\":");',
      '    return;',
      '  }',
      '',
      '  res.setHeader("content-type", "application/json");',
      '',
      '  if (mode === "match") {',
      '    res.end(JSON.stringify({ ok: true, events: [event] }));',
      '    return;',
      '  }',
      '',
      '  res.end(JSON.stringify({ ok: true, events: [] }));',
      '});',
      '',
      'server.listen(port, "127.0.0.1");',
      '',
      'process.on("SIGTERM", () => {',
      '  server.close(() => process.exit(0));',
      '});',
      '',
    ].join("\n"),
    "utf8",
  );

  function freePort():
  number {
    const result =
      childProcess.spawnSync(
        "python",
        [
          "-c",
          [
            "import socket",
            "s=socket.socket()",
            "s.bind(('127.0.0.1',0))",
            "print(s.getsockname()[1])",
            "s.close()",
          ].join(";"),
        ],
        {
          encoding:
            "utf8",
        },
      );

    assert.equal(
      result.status,
      0,
      `${result.stdout}\n${result.stderr}`,
    );

    const port =
      Number(
        String(result.stdout).trim(),
      );

    assert.equal(
      Number.isSafeInteger(port) &&
      port > 0,
      true,
    );

    return port;
  }

  function sleepMs(
    milliseconds:
      number,
  ): void {
    Atomics.wait(
      new Int32Array(
        new SharedArrayBuffer(4),
      ),
      0,
      0,
      milliseconds,
    );
  }

  function waitForMock(
    baseUrl:
      string,
  ): void {
    for (
      let attempt = 0;
      attempt < 30;
      attempt += 1
    ) {
      const probe =
        childProcess.spawnSync(
          "curl",
          [
            "-sS",
            "--max-time",
            "1",
            `${baseUrl}/ready`,
          ],
          {
            stdio:
              "ignore",
          },
        );

      if (probe.status === 0) {
        return;
      }

      sleepMs(50);
    }

    throw new Error(
      `mock CRP did not become ready: ${baseUrl}`,
    );
  }

  function startMock(
    mode:
      "match" |
      "miss" |
      "http500" |
      "invalid",
  ): {
    readonly child:
      any;
    readonly baseUrl:
      string;
  } {
    const port =
      freePort();

    const child =
      childProcess.spawn(
        process.execPath,
        [
          mockServer,
          mode,
          String(port),
          observerTx,
        ],
        {
          stdio:
            "ignore",
        },
      );

    const baseUrl =
      `http://127.0.0.1:${port}`;

    waitForMock(
      baseUrl,
    );

    return {
      child,
      baseUrl,
    };
  }

  function runObserverOnly(
    baseUrl:
      string,
  ):
  ReturnType<typeof spawnSync> {
    return spawnSync(
      "bash",
      [
        e2e,
      ],
      {
        cwd:
          process.cwd(),

        env: {
          ...process.env,

          DEMO4_FINAL_E2E_MODE:
            "live",

          DEMO4_FINAL_E2E_LIVE_AUTHORIZED:
            "true",

          DEMO4_FINAL_E2E_DATABASE_URL:
            "postgres://demo4-test:demo4-test@127.0.0.1:5432/transaction-outcome",

          DEMO4_FINAL_E2E_TEST_ONLY:
            "true",

          DEMO4_FINAL_E2E_TEST_D43_RUNNER:
            "observer-only-unused-d43-runner",

          DEMO4_FINAL_E2E_TEST_SKIP_OFFLINE_SUITES:
            "true",

          DEMO4_FINAL_E2E_TEST_STOP_AFTER_D43_HANDOFF:
            "false",

          DEMO4_FINAL_E2E_TEST_OBSERVER_ONLY:
            "true",

          DEMO4_FINAL_E2E_TEST_OBSERVER_TX_HASH:
            observerTx,

          DEMO4_FINAL_E2E_TEST_OBSERVER_CHAIN_ID:
            "ccd:4221332d34e1694168c2a0c0b3fd0f27",

          DEMO4_D4_3_GATEWAY_BASE_URL:
            "http://127.0.0.1:1",

          DEMO4_D4_3_CRP_BASE_URL:
            baseUrl,

          DEMO4_FINAL_E2E_POLL_INTERVAL_SECS:
            "1",

          DEMO4_FINAL_E2E_POLL_MAX_SECS:
            "2",
        },

        encoding:
          "utf8",
      },
    );
  }

  function combinedOutput(
    result:
      ReturnType<typeof spawnSync>,
  ): string {
    return `${
      result.stdout ?? ""
    }\n${
      result.stderr ?? ""
    }`;
  }

  function assertNoPayment(
    output:
      string,
  ): void {
    assert.match(
      output,
      /DEMO4_PAYMENT_SUBMITTED=false/,
    );

    assert.match(
      output,
      /DEMO4_PAYMENT_SUBMISSIONS=0/,
    );

    assert.doesNotMatch(
      output,
      /DEMO4_PAYMENT_SUBMITTED=true/,
    );

    assert.match(
      output,
      /DEMO4_PRODUCTION_ACTIVATION=false/,
    );
  }

  try {
    // ------------------------------------------------------------
    // CASE 1: HTTP 200 + valid JSON + exact event => success.
    // ------------------------------------------------------------

    const exactMock =
      startMock(
        "match",
      );

    try {
      const exact =
        runObserverOnly(
          exactMock.baseUrl,
        );

      const output =
        combinedOutput(
          exact,
        );

      assert.equal(
        exact.status,
        0,
        output,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_RESULT=exact_match/,
      );

      assert.match(
        output,
        /DEMO4_CRP_INDEXED=true/,
      );

      assert.match(
        output,
        /DEMO4_E2E_TEST_OBSERVER_ONLY_RESULT=exact_match/,
      );

      assertNoPayment(
        output,
      );
    } finally {
      exactMock.child.kill();
    }

    // ------------------------------------------------------------
    // CASE 2: repeated valid HTTP 200 + valid JSON + no event
    //         => genuine index-miss timeout.
    // ------------------------------------------------------------

    const missMock =
      startMock(
        "miss",
      );

    try {
      const miss =
        runObserverOnly(
          missMock.baseUrl,
        );

      const output =
        combinedOutput(
          miss,
        );

      assert.notEqual(
        miss.status,
        0,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_RESULT=valid_200_index_miss_timeout/,
      );

      assert.match(
        output,
        /DEMO4_E2E_ERROR=finalized Testnet transfer was not observed in CRP index before timeout/,
      );

      assert.doesNotMatch(
        output,
        /CRP observer encountered transport\/HTTP\/response errors/,
      );

      assertNoPayment(
        output,
      );
    } finally {
      missMock.child.kill();
    }

    // ------------------------------------------------------------
    // CASE 3: HTTP non-2xx => observer HTTP error, NOT index miss.
    // ------------------------------------------------------------

    const httpErrorMock =
      startMock(
        "http500",
      );

    try {
      const httpError =
        runObserverOnly(
          httpErrorMock.baseUrl,
        );

      const output =
        combinedOutput(
          httpError,
        );

      assert.notEqual(
        httpError.status,
        0,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_HTTP_ERRORS=[1-9][0-9]*/,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_RESULT=observer_error_timeout/,
      );

      assert.match(
        output,
        /DEMO4_E2E_ERROR=CRP observer encountered transport\/HTTP\/response errors before exact finalized-event observation/,
      );

      assert.doesNotMatch(
        output,
        /DEMO4_E2E_ERROR=finalized Testnet transfer was not observed in CRP index before timeout/,
      );

      assertNoPayment(
        output,
      );
    } finally {
      httpErrorMock.child.kill();
    }

    // ------------------------------------------------------------
    // CASE 4: transport failure => observer transport error.
    // ------------------------------------------------------------

    const unusedPort =
      freePort();

    const transport =
      runObserverOnly(
        `http://127.0.0.1:${unusedPort}`,
      );

    const transportOutput =
      combinedOutput(
        transport,
      );

    assert.notEqual(
      transport.status,
      0,
    );

    assert.match(
      transportOutput,
      /DEMO4_CRP_OBSERVER_TRANSPORT_ERRORS=[1-9][0-9]*/,
    );

    assert.match(
      transportOutput,
      /DEMO4_CRP_OBSERVER_RESULT=observer_error_timeout/,
    );

    assert.doesNotMatch(
      transportOutput,
      /DEMO4_E2E_ERROR=finalized Testnet transfer was not observed in CRP index before timeout/,
    );

    assertNoPayment(
      transportOutput,
    );

    // ------------------------------------------------------------
    // CASE 5: HTTP 200 + malformed JSON => response error.
    // ------------------------------------------------------------

    const invalidMock =
      startMock(
        "invalid",
      );

    try {
      const invalid =
        runObserverOnly(
          invalidMock.baseUrl,
        );

      const output =
        combinedOutput(
          invalid,
        );

      assert.notEqual(
        invalid.status,
        0,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_RESPONSE_ERRORS=[1-9][0-9]*/,
      );

      assert.match(
        output,
        /DEMO4_CRP_OBSERVER_RESULT=observer_error_timeout/,
      );

      assert.doesNotMatch(
        output,
        /DEMO4_E2E_ERROR=finalized Testnet transfer was not observed in CRP index before timeout/,
      );

      assertNoPayment(
        output,
      );
    } finally {
      invalidMock.child.kill();
    }

    console.log(
      "DEMO4_E2E_OBSERVER_EXACT_MATCH_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_VALID_200_INDEX_MISS_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_HTTP_ERROR_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_TRANSPORT_ERROR_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_RESPONSE_ERROR_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_CLASSIFICATION_CI=PASSED",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_PAYMENT_ATTEMPTED=false",
    );

    console.log(
      "DEMO4_E2E_OBSERVER_PRODUCTION_ACTIVATION=false",
    );
  } finally {
    fs.rmSync(
      observerRoot,
      {
        recursive:
          true,
        force:
          true,
      },
    );
  }
}
