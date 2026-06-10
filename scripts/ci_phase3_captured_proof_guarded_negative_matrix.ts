#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_guarded_negative_matrix.ts
 *
 * PR #158 regression harness.
 *
 * Proves negative captured-proof-derived Gateway release decisions fail closed
 * next to the existing guarded test-release flag surface.
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
  buildBindingNegative,
  buildCapturedProofGatewayDecision,
  buildReceiptNegative,
  receiptSignal,
} from "./phase3-captured-proof-gateway-test-helpers";

const GATEWAY_PORT = Number(process.env.PHASE3_CAPTURED_PROOF_GUARDED_NEGATIVE_MATRIX_PORT || 3078);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:captured-proof-guarded-negative-matrix-test";

async function buildCapturedProofPositive() {
  const capturedProof = await buildCapturedProofGatewayDecision({
    source: "phase3-test-captured-proof-guarded-negative-matrix-input",
    badNonce: "phase3-pr158-wrong-captured-proof-nonce",
  });

  return {
    positive: {
      captureContract: capturedProof.captureContract,
      safeMetadata: capturedProof.safeMetadata,
      parsedOk: capturedProof.parsedOk,
      boundEligibility: capturedProof.boundEligibility,
      decision: capturedProof.decision,
    },
    fixtureChallenge: capturedProof.fixtureChallenge,
    contract: capturedProof.contract,
    nonce: capturedProof.nonce,
  };
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previousReleaseEnabled = process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  const previousTestReleaseOnly = process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  const previousRequireLiveZkp = process.env.PHASE3_REQUIRE_LIVE_ZKP;

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    if (previousReleaseEnabled === undefined) {
      delete process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
    } else {
      process.env.PHASE3_GATEWAY_RELEASE_ENABLED = previousReleaseEnabled;
    }

    if (previousTestReleaseOnly === undefined) {
      delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
    } else {
      process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = previousTestReleaseOnly;
    }

    if (previousRequireLiveZkp === undefined) {
      delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
    } else {
      process.env.PHASE3_REQUIRE_LIVE_ZKP = previousRequireLiveZkp;
    }

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

    const captured = await buildCapturedProofPositive();

    const bindingNegatives = [
      buildBindingNegative({
        label: "wrong nonce binding",
        challenge: captured.fixtureChallenge,
        contract: captured.contract,
        nonce: captured.nonce,
        mutate(challenge) {
          challenge.nonce = "wrong-captured-proof-nonce";
        },
      }),
      buildBindingNegative({
        label: "wrong resource path binding",
        challenge: captured.fixtureChallenge,
        contract: captured.contract,
        nonce: captured.nonce,
        mutate(challenge) {
          challenge.resource.path = "/paid";
        },
      }),
    ];

    const receiptNegatives = [
      buildReceiptNegative({
        label: "pending receipt",
        boundEligibility: captured.positive.boundEligibility,
        receipt: receiptSignal({
          settlementStatus: "pending",
        }),
        expectedReason: "settlement_not_finalized",
      }),
      buildReceiptNegative({
        label: "expired receipt",
        boundEligibility: captured.positive.boundEligibility,
        receipt: receiptSignal({
          receiptExpired: true,
        }),
        expectedReason: "receipt_expired",
      }),
      buildReceiptNegative({
        label: "unverified receipt",
        boundEligibility: captured.positive.boundEligibility,
        receipt: receiptSignal({
          ok: false,
          receiptVerified: false,
        }),
        expectedReason: "receipt_not_verified",
      }),
    ];

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (
        blocked.status === 402 &&
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked runtime response should be present");
    assert.equal(blocked.status, 402, `guarded runtime must remain blocked without receipt: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked runtime must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked runtime must not emit PAYMENT-RESPONSE");

    assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
    assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
    assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);

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
          harness: "phase3.capturedProofGuardedNegativeMatrix.v1",
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          capturedProofPositiveStillBuildsDecision: captured.positive.decision.releaseAuthorized === true,
          capturedProofInputShape: "raw-wallet-capture-fields",
          capturedProofAcceptedByContract:
            captured.positive.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
          capturedProofNormalized: captured.positive.safeMetadata.normalized,
          capturedProofAccountBindingStatus: captured.positive.safeMetadata.accountBindingStatus,
          capturedProofParsedAsCanonicalEnvelope: captured.positive.parsedOk,
          capturedProofEligibilityBound: captured.positive.boundEligibility.ok,

          bindingNegatives,
          bindingNegativesRejected: bindingNegatives.every((item) => item.decisionReason === "eligibility_not_bound"),
          receiptNegatives,
          receiptNegativesRejected: receiptNegatives.every((item) => item.releaseAuthorized === false),

          missingReceiptRuntimeBlocked:
            blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal",
          actualGatewayStillReturns402: blocked.status === 402,
          actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

          productionReleaseAuthorized: false,
          paymentReleaseAttempted: false,
          paymentResponseEmitted: false,
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
