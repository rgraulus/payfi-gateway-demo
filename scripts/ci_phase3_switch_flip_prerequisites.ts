#!/usr/bin/env node
/**
 * scripts/ci_phase3_switch_flip_prerequisites.ts
 *
 * PR #172 meta-readiness harness.
 *
 * Consolidates the current Phase 3 switch-flip prerequisites into one
 * go/no-go test runner before any runtime production-release semantics are
 * changed.
 *
 * This harness intentionally does not introduce new runtime behavior. It runs
 * the existing high-value boundary harnesses and emits a single readiness
 * summary.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process from "node:process";

const LABEL = "phase3:switch-flip-prerequisites-test";
const isWin = process.platform === "win32";

type Step = {
  name: string;
  npmScript: string;
  proves: string[];
};

const steps: Step[] = [
  {
    name: "production release disabled boundary",
    npmScript: "phase3:production-release-disabled-boundary-test",
    proves: [
      "productionReleaseStillDisabled",
      "canonicalReleasePersistenceStillDisabled",
      "crpFulfillStillDisabled",
      "rawProofAndReceiptNotPrinted",
    ],
  },
  {
    name: "decision persistence boundary",
    npmScript: "phase3:decision-persistence-boundary-test",
    proves: [
      "canonicalReleasePersistenceStillDisabled",
      "guardedNegativeStillBlocked",
      "replayBlockedAfterRelease",
    ],
  },
  {
    name: "payment response replay boundary",
    npmScript: "phase3:payment-response-replay-boundary-test",
    proves: [
      "paymentResponseBoundaryReady",
      "replayBlockedAfterRelease",
    ],
  },
  {
    name: "guarded runtime release decision recognition",
    npmScript: "phase3:guarded-runtime-release-decision-recognition-test",
    proves: [
      "runtimeDecisionRequired",
      "guardedNegativeStillBlocked",
    ],
  },
  {
    name: "runtime receipt requirement matrix",
    npmScript: "phase3:runtime-receipt-requirement-matrix-test",
    proves: [
      "verifiedFinalizedReceiptRequired",
      "runtimeDecisionRequired",
    ],
  },
  {
    name: "dual proof receipt guard",
    npmScript: "phase3:dual-proof-receipt-guard-test",
    proves: [
      "verifiedFinalizedReceiptRequired",
      "runtimeDecisionRequired",
      "guardedNegativeStillBlocked",
    ],
  },
];

function runNpmScript(step: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[${LABEL}] running ${step.npmScript} (${step.name})`);

    const child = spawn(isWin ? "npm.cmd" : "npm", ["run", step.npmScript], {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
      ...(isWin ? { shell: true } : {}),
    });

    child.on("error", reject);

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${step.npmScript} failed with code=${String(code)} signal=${String(signal)}`,
        ),
      );
    });
  });
}

async function main() {
  const completed: Array<{
    name: string;
    npmScript: string;
    proves: string[];
    ok: boolean;
  }> = [];

  for (const step of steps) {
    await runNpmScript(step);
    completed.push({
      name: step.name,
      npmScript: step.npmScript,
      proves: step.proves,
      ok: true,
    });
  }

  const proved = new Set(completed.flatMap((step) => step.proves));

  const summary = {
    ok: true,
    harness: "phase3.switchFlipPrerequisites.v1",

    completedScripts: completed.map((step) => step.npmScript),
    completed,

    verifiedFinalizedReceiptRequired: proved.has("verifiedFinalizedReceiptRequired"),
    runtimeDecisionRequired: proved.has("runtimeDecisionRequired"),
    paymentResponseBoundaryReady: proved.has("paymentResponseBoundaryReady"),
    replayBlockedAfterRelease: proved.has("replayBlockedAfterRelease"),
    guardedNegativeStillBlocked: proved.has("guardedNegativeStillBlocked"),
    productionReleaseStillDisabled: proved.has("productionReleaseStillDisabled"),
    canonicalReleasePersistenceStillDisabled: proved.has(
      "canonicalReleasePersistenceStillDisabled",
    ),
    crpFulfillStillDisabled: proved.has("crpFulfillStillDisabled"),
    rawProofAndReceiptNotPrinted: proved.has("rawProofAndReceiptNotPrinted"),

    readyForProductionReleaseImplementationPr:
      proved.has("verifiedFinalizedReceiptRequired") &&
      proved.has("runtimeDecisionRequired") &&
      proved.has("paymentResponseBoundaryReady") &&
      proved.has("replayBlockedAfterRelease") &&
      proved.has("guardedNegativeStillBlocked") &&
      proved.has("productionReleaseStillDisabled") &&
      proved.has("canonicalReleasePersistenceStillDisabled") &&
      proved.has("crpFulfillStillDisabled") &&
      proved.has("rawProofAndReceiptNotPrinted"),
  };

  assert.equal(summary.verifiedFinalizedReceiptRequired, true);
  assert.equal(summary.runtimeDecisionRequired, true);
  assert.equal(summary.paymentResponseBoundaryReady, true);
  assert.equal(summary.replayBlockedAfterRelease, true);
  assert.equal(summary.guardedNegativeStillBlocked, true);
  assert.equal(summary.productionReleaseStillDisabled, true);
  assert.equal(summary.canonicalReleasePersistenceStillDisabled, true);
  assert.equal(summary.crpFulfillStillDisabled, true);
  assert.equal(summary.rawProofAndReceiptNotPrinted, true);
  assert.equal(summary.readyForProductionReleaseImplementationPr, true);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
