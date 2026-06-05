#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_x402_receipt_composition_decision.ts
 *
 * PR #125 regression harness:
 *
 * Proves the Gateway-facing x402 receipt composition decision:
 *
 *   eligible + challenge/resource-bound + finalized x402 receipt payment signal
 *   => releaseAuthorized:true as a decision only
 *
 * This is intentionally test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import process from "node:process";

import { composeModelAReleaseDecision } from "../src/phase3/modelAReleaseComposition";
import { buildX402ReceiptPaymentSatisfaction } from "../src/phase3/x402ReceiptPaymentSignal";
import {
  assertStillNoRelease,
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

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_X402_RECEIPT_COMPOSITION_PORT || 3064);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-x402-receipt-composition-test";

function buildDecisionOnlyX402ReceiptComposition() {
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

  assert.equal(payment.ok, true);
  assert.equal(payment.payment.paymentSatisfied, true);
  assert.equal(payment.payment.paymentSource, "x402-receipt");
  assert.equal(payment.rawReceiptPrinted, false);

  const decision = composeModelAReleaseDecision({
    boundEligibility: {
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
    },
    payment: payment.payment,
  });

  return {
    ...decision,
    releaseDecisionOnly: true,
    crpFulfillCalled: decision.crpCalled,
    resourceReleased: false,
    receiptPaymentSignalAccepted: payment.ok,
    receiptVerified: payment.receiptVerified,
    settlementStatus: payment.settlementStatus,
    receiptExpired: payment.receiptExpired,
    rawReceiptPrinted: payment.rawReceiptPrinted,
  };
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

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
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);
    const redeem = await redeemEligiblePolicy(BASE, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const decision = buildDecisionOnlyX402ReceiptComposition();

    assert.equal(decision.ok, true);
    assert.equal(decision.eligibilityVerified, true);
    assert.equal(decision.challengeBound, true);
    assert.equal(decision.resourceBound, true);
    assert.equal(decision.paymentSatisfied, true);
    assert.equal(decision.paymentSource, "x402-receipt");
    assert.equal(decision.releaseAuthorized, true);
    assert.equal(decision.releaseDecisionOnly, true);

    assert.equal(decision.receiptPaymentSignalAccepted, true);
    assert.equal(decision.receiptVerified, true);
    assert.equal(decision.settlementStatus, "finalized");
    assert.equal(decision.receiptExpired, false);

    assert.equal(decision.paymentReleaseAttempted, false);
    assert.equal(decision.paymentResponseEmitted, false);
    assert.equal(decision.crpFulfillCalled, false);
    assert.equal(decision.replayTouched, false);
    assert.equal(decision.resourceReleased, false);
    assert.equal(decision.rawProofPrinted, false);
    assert.equal(decision.rawReceiptPrinted, false);

    const stillNoRelease = await assertStillNoRelease(
      BASE,
      pr.nonce,
      "x402 receipt composition test must not release resource",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          eligibilityVerified: decision.eligibilityVerified,
          challengeBound: decision.challengeBound,
          resourceBound: decision.resourceBound,
          receiptPaymentSignalAccepted: decision.receiptPaymentSignalAccepted,
          receiptVerified: decision.receiptVerified,
          settlementStatus: decision.settlementStatus,
          receiptExpired: decision.receiptExpired,
          paymentSatisfied: decision.paymentSatisfied,
          paymentSource: decision.paymentSource,
          releaseAuthorized: decision.releaseAuthorized,
          releaseDecisionOnly: decision.releaseDecisionOnly,
          paymentReleaseAttempted: decision.paymentReleaseAttempted,
          paymentResponseEmitted: decision.paymentResponseEmitted,
          crpFulfillCalled: decision.crpFulfillCalled,
          replayTouched: decision.replayTouched,
          resourceReleased: decision.resourceReleased,
          rawProofPrinted: decision.rawProofPrinted,
          rawReceiptPrinted: decision.rawReceiptPrinted,
          actualGatewayStillReturns402: stillNoRelease.status === 402,
          actualGatewayPaymentResponseEmitted: stillNoRelease.headers.has("payment-response"),
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
