#!/usr/bin/env node
/**
 * scripts/ci_phase3_runtime_readiness_seam.ts
 *
 * PR #165 regression harness.
 *
 * Proves the Gateway runtime seam can recognize a Phase 3 readiness-shaped
 * decision while still failing closed because no real x402 receipt signal has
 * been submitted to the Gateway runtime.
 *
 * This is intentionally test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, does not persist canonical release state, and does not release
 * protected content.
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

const GATEWAY_PORT = Number(process.env.PHASE3_RUNTIME_READINESS_SEAM_PORT || 3080);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:runtime-readiness-seam-test";

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

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previous = {
    releaseEnabled: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    testReleaseOnly: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    requireLiveZkp: process.env.PHASE3_REQUIRE_LIVE_ZKP,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, true);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);
    const redeem = await redeemEligiblePolicy(BASE, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedProof = await buildCapturedProofGatewayDecision({
      source: "phase3-test-runtime-readiness-seam-input",
      badNonce: "phase3-pr165-wrong-captured-proof-nonce",
    });

    assert.equal(capturedProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"), true);
    assert.equal(capturedProof.safeMetadata.normalized, true);
    assert.equal(capturedProof.safeMetadata.accountBindingStatus, "present");
    assert.equal(capturedProof.parsedOk, true);
    assert.equal(capturedProof.boundEligibility.ok, true);

    assert.equal(capturedProof.decision.releaseAuthorized, true);
    assert.equal(capturedProof.decision.reason, "release_authorized");
    assert.equal(capturedProof.decision.paymentResponseAllowed, true);
    assert.equal(capturedProof.decision.resourceReleaseAllowed, true);
    assert.equal(capturedProof.decision.paymentSource, "x402-receipt");
    assert.equal(capturedProof.decision.receiptSignalAccepted, true);
    assert.equal(capturedProof.decision.receiptVerified, true);
    assert.equal(capturedProof.decision.settlementStatus, "finalized");
    assert.equal(capturedProof.decision.receiptExpired, false);
    assert.equal(capturedProof.decision.receiptContextMatched, true);
    assert.equal(capturedProof.decision.paymentReleaseAttempted, false);
    assert.equal(capturedProof.decision.paymentResponseEmitted, false);
    assert.equal(capturedProof.decision.crpCalled, false);
    assert.equal(capturedProof.decision.replayTouched, false);
    assert.equal(capturedProof.decision.rawProofPrinted, false);
    assert.equal(capturedProof.decision.rawReceiptPrinted, false);

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (
        blocked.status === 402 &&
        blocked.json?.runtimeReleaseRecognition?.recognized === true &&
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked runtime response should be present");
    assert.equal(blocked.status, 402, `runtime must remain blocked: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked runtime must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked runtime must not emit PAYMENT-RESPONSE");

    assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
    assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);

    assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
    assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);

    const safety = blocked.json?.safety ?? {};
    assert.equal(safety.paymentResponseEmitted, false);
    assert.equal(safety.crpCalled, false);
    assert.equal(safety.crpFulfillCalled, false);
    assert.equal(safety.replayTouched, false);
    assert.equal(safety.canonicalReleasePersisted, false);
    assert.equal(safety.rawProofPrinted, false);
    assert.equal(safety.rawReceiptPrinted, false);

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.runtimeReadinessSeam.v1",

          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          eligiblePolicyAllowed: redeem.json?.policyDecision?.allowed === true,

          readinessDecisionBuilt: true,
          readinessDecisionAuthorized: capturedProof.decision.releaseAuthorized,
          readinessDecisionReason: capturedProof.decision.reason,
          readinessPaymentResponseAllowedByDecision: capturedProof.decision.paymentResponseAllowed,
          readinessResourceReleaseAllowedByDecision: capturedProof.decision.resourceReleaseAllowed,
          readinessPaymentSource: capturedProof.decision.paymentSource,
          readinessReceiptAcceptedByDecision: capturedProof.decision.receiptSignalAccepted,
          readinessReceiptVerifiedByDecision: capturedProof.decision.receiptVerified,
          readinessReceiptFinalizedByDecision: capturedProof.decision.settlementStatus === "finalized",
          readinessReceiptNotExpiredByDecision: capturedProof.decision.receiptExpired === false,
          readinessReceiptContextMatchedByDecision: capturedProof.decision.receiptContextMatched,

          capturedProofInputShape: "raw-wallet-capture-fields",
          capturedProofAcceptedByContract:
            capturedProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
          capturedProofNormalized: capturedProof.safeMetadata.normalized,
          capturedProofAccountBindingStatus: capturedProof.safeMetadata.accountBindingStatus,
          capturedProofParsedAsCanonicalEnvelope: capturedProof.parsedOk,
          capturedProofEligibilityBound: capturedProof.boundEligibility.ok,

          runtimeStatus: blocked.status,
          runtimeReadinessSeamRecognized: blocked.json?.runtimeReleaseRecognition?.recognized === true,
          runtimeGuardSatisfied: blocked.json?.runtimeReleaseRecognition?.guardSatisfied === true,
          runtimeBlockedBy: blocked.json?.runtimeReleaseRecognition?.blockedBy,
          runtimeReceiptRequired: blocked.json?.phase3?.runtimeReceiptRequired === true,
          runtimeReceiptSignalPresent: blocked.json?.phase3?.receiptSignalPresent === true,
          runtimeReleaseDecisionRecognized:
            blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized === true,

          actualGatewayStillReturns402: blocked.status === 402,
          actualGatewayPaymentRequiredEmitted: blocked.headers.get("payment-required") !== null,
          actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

          productionReleaseAuthorized: false,
          paymentReleaseAttempted: false,
          paymentResponseEmitted: safety.paymentResponseEmitted,
          crpCalled: safety.crpCalled,
          crpFulfillCalled: safety.crpFulfillCalled,
          replayTouched: safety.replayTouched,
          resourceReleased: false,
          canonicalReleasePersisted: safety.canonicalReleasePersisted,
          rawProofPrinted: safety.rawProofPrinted,
          rawReceiptPrinted: safety.rawReceiptPrinted,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
