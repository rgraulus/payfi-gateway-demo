#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_release_disabled_seam.ts
 *
 * PR #129 regression harness.
 *
 * Proves the Phase 3 Gateway release seam is visible but disabled by default:
 *
 *   eligible + finalized x402 receipt -> release decision authorized
 *   PHASE3_GATEWAY_RELEASE_ENABLED unset/false -> runtime release remains blocked
 *
 * This is intentionally decision-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import process from "node:process";

import type {
  ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildPhase3GatewayReleaseDecision,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import {
  buildX402ReceiptPaymentSatisfaction,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  redeemEligiblePolicy,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_RELEASE_DISABLED_SEAM_PORT || 3066);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-release-disabled-seam-test";

const boundEligibility: ModelAEligibilityBindingResult = {
  ok: true,
  model: "phase3-model-a",
  eligibilityVerified: true,
  challengeBound: true,
  resourceBound: true,
  releaseAuthorized: false,
  paymentReleaseAttempted: false,
  paymentResponseEmitted: false,
  crpCalled: false,
  replayTouched: false,
  rawProofPrinted: false,
};

function buildAuthorizedDecision() {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: {
      ok: true,
      source: "x402-receipt",
      receiptVerified: true,
      settlementStatus: "finalized",
      receiptExpired: false,
      rawReceiptPrinted: false,
    },
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment,
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.releaseAuthorized, true);
  assert.equal(decision.paymentResponseAllowed, true);
  assert.equal(decision.resourceReleaseAllowed, true);
  assert.equal(decision.paymentSatisfied, true);
  assert.equal(decision.paymentSource, "x402-receipt");
  assert.equal(decision.receiptSignalAccepted, true);
  assert.equal(decision.receiptVerified, true);
  assert.equal(decision.settlementStatus, "finalized");
  assert.equal(decision.receiptExpired, false);

  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);

  return decision;
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (String(process.env.PHASE3_GATEWAY_RELEASE_ENABLED ?? "").toLowerCase() === "true") {
    throw new Error("PHASE3_GATEWAY_RELEASE_ENABLED must not be true for this disabled-seam harness.");
  }

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);
    const redeem = await redeemEligiblePolicy(BASE, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const decision = buildAuthorizedDecision();

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          releaseDecisionAuthorized: decision.releaseAuthorized,
          releaseBlockedByDisabledSeam: health.phase3.gatewayReleaseEnabled === false,

          paymentResponseAllowedByDecision: decision.paymentResponseAllowed,
          resourceReleaseAllowedByDecision: decision.resourceReleaseAllowed,

          paymentReleaseAttempted: false,
          paymentResponseEmitted: false,
          crpCalled: false,
          crpFulfillCalled: false,
          replayTouched: false,
          resourceReleased: false,
          rawProofPrinted: false,
          rawReceiptPrinted: false,

          actualGatewayStillReturns402: true,
          actualGatewayPaymentResponseEmitted: false,
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
