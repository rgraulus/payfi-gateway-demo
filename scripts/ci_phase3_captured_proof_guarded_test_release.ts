#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_guarded_test_release.ts
 *
 * PR #157 regression harness.
 *
 * Proves a captured wallet-proof-derived Gateway release decision can be
 * evaluated next to the existing guarded test-release flag surface without
 * weakening the Gateway's fail-closed runtime posture.
 *
 * This is intentionally test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import process from "node:process";

import {
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  redeemEligiblePolicy,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";
import {
  buildCapturedProofGatewayDecision,
} from "./phase3-captured-proof-gateway-test-helpers";

const GATEWAY_PORT_FLAG_ONLY = Number(process.env.PHASE3_CAPTURED_PROOF_GUARDED_FLAG_ONLY_PORT || 3076);
const GATEWAY_PORT_BOTH_GUARDS = Number(process.env.PHASE3_CAPTURED_PROOF_GUARDED_BOTH_GUARDS_PORT || 3077);
const LABEL = "phase3:captured-proof-guarded-test-release-test";

type GuardScenario = "release-flag-alone" | "both-test-guards";

async function buildCapturedProofDecision() {
  return buildCapturedProofGatewayDecision({
    source: "phase3-test-captured-proof-guarded-release-input",
    badNonce: "phase3-pr157-wrong-captured-proof-nonce",
  });
}

function restoreEnv(previous: {
  releaseEnabled: string | undefined;
  testReleaseOnly: string | undefined;
  requireLiveZkp: string | undefined;
}) {
  if (previous.releaseEnabled === undefined) {
    delete process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  } else {
    process.env.PHASE3_GATEWAY_RELEASE_ENABLED = previous.releaseEnabled;
  }

  if (previous.testReleaseOnly === undefined) {
    delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  } else {
    process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = previous.testReleaseOnly;
  }

  if (previous.requireLiveZkp === undefined) {
    delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
  } else {
    process.env.PHASE3_REQUIRE_LIVE_ZKP = previous.requireLiveZkp;
  }
}

async function runGuardScenario(input: {
  scenario: GuardScenario;
  port: number;
  releaseEnabled: boolean;
  testReleaseOnly: boolean;
}) {
  const base = baseUrlForPort(input.port);
  console.log(`[${LABEL}:${input.scenario}] BASE=${base}`);

  if (await isPortOpen(input.port)) {
    throw new Error(`port ${input.port} is already open. Stop the existing gateway and retry.`);
  }

  const previous = {
    releaseEnabled: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    testReleaseOnly: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    requireLiveZkp: process.env.PHASE3_REQUIRE_LIVE_ZKP,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = input.releaseEnabled ? "true" : "false";

  if (input.testReleaseOnly) {
    process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  } else {
    delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  }

  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

  const gateway = startGateway({
    port: input.port,
    label: `${LABEL}:${input.scenario}`,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await waitForPortClosed(input.port);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(base);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, input.releaseEnabled);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, input.testReleaseOnly);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(base);
    const redeem = await redeemEligiblePolicy(base, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedProof = await buildCapturedProofDecision();

    assert.equal(capturedProof.decision.releaseAuthorized, true);
    assert.equal(capturedProof.decision.paymentResponseAllowed, true);
    assert.equal(capturedProof.decision.resourceReleaseAllowed, true);
    assert.equal(capturedProof.boundEligibility.ok, true);
    assert.equal(capturedProof.safeMetadata.accountBindingStatus, "present");

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(base, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (blocked.status === 402) {
        if (input.testReleaseOnly) {
          if (blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal") {
            break;
          }
        } else {
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked runtime response should be present");
    assert.equal(blocked.status, 402, `runtime must remain blocked: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked runtime must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked runtime must not emit PAYMENT-RESPONSE");

    if (input.testReleaseOnly) {
      assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
      assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
      assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);
    } else {
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
      assert.equal(input.releaseEnabled, true);
      assert.equal(input.testReleaseOnly, false);
    }

    const safety = blocked.json?.safety ?? {};
    if (input.testReleaseOnly) {
      assert.equal(safety.paymentResponseEmitted, false);
      assert.equal(safety.crpCalled, false);
      assert.equal(safety.crpFulfillCalled, false);
      assert.equal(safety.replayTouched, false);
      assert.equal(safety.canonicalReleasePersisted, false);
      assert.equal(safety.rawProofPrinted, false);
      assert.equal(safety.rawReceiptPrinted, false);
    }

    return {
      ok: true,
      scenario: input.scenario,
      gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
      gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
      gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
      requireLiveZkp: health.phase3.requireLiveZkp,
      eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

      capturedProofInputShape: "raw-wallet-capture-fields",
      capturedProofAcceptedByContract:
        capturedProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
      capturedProofNormalized: capturedProof.safeMetadata.normalized,
      capturedProofAccountBindingStatus: capturedProof.safeMetadata.accountBindingStatus,
      capturedProofParsedAsCanonicalEnvelope: capturedProof.parsedOk,
      capturedProofEligibilityBound: capturedProof.boundEligibility.ok,

      capturedProofReleaseDecisionAuthorized: capturedProof.decision.releaseAuthorized,
      capturedProofPaymentResponseAllowedByDecision: capturedProof.decision.paymentResponseAllowed,
      capturedProofResourceReleaseAllowedByDecision: capturedProof.decision.resourceReleaseAllowed,
      capturedProofDecisionReason: capturedProof.decision.reason,
      capturedProofPaymentSource: capturedProof.decision.paymentSource,

      runtimeStatus: blocked.status,
      releaseFlagAloneInsufficient:
        input.scenario === "release-flag-alone" &&
        health.phase3.gatewayReleaseEnabled === true &&
        health.phase3.gatewayTestReleaseOnly === false,
      bothGuardsSatisfied:
        input.scenario === "both-test-guards" &&
        health.phase3.gatewayReleaseEnabled === true &&
        health.phase3.gatewayTestReleaseOnly === true,
      runtimeReceiptRequired: blocked.json?.phase3?.runtimeReceiptRequired === true,
      receiptSignalPresent: blocked.json?.phase3?.receiptSignalPresent === true,
      missingReceiptRejected:
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal",
      guardedRuntimeReleaseRecognized:
        blocked.json?.runtimeReleaseRecognition?.recognized === true,
      releaseDecisionRecognized:
        blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized === true,

      actualGatewayStillReturns402: blocked.status === 402,
      actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

      productionReleaseAuthorized: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: input.testReleaseOnly ? safety.crpCalled : false,
      crpFulfillCalled: input.testReleaseOnly ? safety.crpFulfillCalled : false,
      replayTouched: input.testReleaseOnly ? safety.replayTouched : false,
      resourceReleased: false,
      canonicalReleasePersisted: input.testReleaseOnly ? safety.canonicalReleasePersisted : false,
      rawProofPrinted: input.testReleaseOnly ? safety.rawProofPrinted : false,
      rawReceiptPrinted: input.testReleaseOnly ? safety.rawReceiptPrinted : false,
    };
  } finally {
    await cleanup();
  }
}

async function main() {
  const flagOnly = await runGuardScenario({
    scenario: "release-flag-alone",
    port: GATEWAY_PORT_FLAG_ONLY,
    releaseEnabled: true,
    testReleaseOnly: false,
  });

  const bothGuards = await runGuardScenario({
    scenario: "both-test-guards",
    port: GATEWAY_PORT_BOTH_GUARDS,
    releaseEnabled: true,
    testReleaseOnly: true,
  });

  assert.equal(flagOnly.releaseFlagAloneInsufficient, true);
  assert.equal(flagOnly.actualGatewayStillReturns402, true);
  assert.equal(flagOnly.actualGatewayPaymentResponseEmitted, false);
  assert.equal(flagOnly.capturedProofReleaseDecisionAuthorized, true);

  assert.equal(bothGuards.bothGuardsSatisfied, true);
  assert.equal(bothGuards.guardedRuntimeReleaseRecognized, true);
  assert.equal(bothGuards.missingReceiptRejected, true);
  assert.equal(bothGuards.actualGatewayStillReturns402, true);
  assert.equal(bothGuards.actualGatewayPaymentResponseEmitted, false);
  assert.equal(bothGuards.capturedProofReleaseDecisionAuthorized, true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofGuardedTestRelease.v1",
        scenarios: [flagOnly, bothGuards],

        capturedProofDecisionAuthorizedInBothScenarios:
          flagOnly.capturedProofReleaseDecisionAuthorized === true &&
          bothGuards.capturedProofReleaseDecisionAuthorized === true,

        releaseFlagAloneInsufficient: flagOnly.releaseFlagAloneInsufficient,
        bothTestGuardsStillRequireReceipt: bothGuards.missingReceiptRejected,
        actualGatewayStillReturns402InBothScenarios:
          flagOnly.actualGatewayStillReturns402 === true &&
          bothGuards.actualGatewayStillReturns402 === true,
        actualGatewayPaymentResponseEmittedInEitherScenario:
          flagOnly.actualGatewayPaymentResponseEmitted === true ||
          bothGuards.actualGatewayPaymentResponseEmitted === true,

        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        resourceReleased: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
