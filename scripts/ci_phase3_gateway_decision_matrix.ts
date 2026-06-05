#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_decision_matrix.ts
 *
 * PR #128 Gateway decision matrix harness.
 *
 * Proves the Gateway-facing Phase 3 release-decision matrix:
 *
 *   eligible + finalized x402 receipt -> authorize decision
 *   eligible + pending x402 receipt   -> deny
 *   eligible + expired x402 receipt   -> deny
 *   unbound eligibility + finalized receipt -> deny
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
  type X402ReceiptPaymentSignal,
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

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_DECISION_MATRIX_PORT || 3065);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-decision-matrix-test";

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

const unboundEligibility: ModelAEligibilityBindingResult = {
  ...boundEligibility,
  ok: false,
  challengeBound: false,
  resourceBound: false,
  bindingCode: "policy_binding_mismatch",
  bindingReason: "decision matrix simulated binding mismatch",
};

function receiptSignal(input: {
  ok?: boolean;
  receiptVerified?: boolean;
  settlementStatus?: X402ReceiptPaymentSignal["settlementStatus"];
  receiptExpired?: boolean;
} = {}): X402ReceiptPaymentSignal {
  return {
    ok: input.ok ?? true,
    source: "x402-receipt",
    receiptVerified: input.receiptVerified ?? true,
    settlementStatus: input.settlementStatus ?? "finalized",
    receiptExpired: input.receiptExpired ?? false,
    rawReceiptPrinted: false,
  };
}

function decisionFor(input: {
  eligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
}) {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: input.receipt,
  });

  return buildPhase3GatewayReleaseDecision({
    boundEligibility: input.eligibility,
    payment,
  });
}

function assertNoSideEffects(decision: ReturnType<typeof decisionFor>) {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

function buildDecisionMatrix() {
  const eligibleFinalized = decisionFor({
    eligibility: boundEligibility,
    receipt: receiptSignal(),
  });

  assert.equal(eligibleFinalized.ok, true);
  assert.equal(eligibleFinalized.releaseAuthorized, true);
  assert.equal(eligibleFinalized.reason, "release_authorized");
  assert.equal(eligibleFinalized.paymentSatisfied, true);
  assert.equal(eligibleFinalized.receiptSignalAccepted, true);
  assert.equal(eligibleFinalized.receiptVerified, true);
  assert.equal(eligibleFinalized.settlementStatus, "finalized");
  assert.equal(eligibleFinalized.receiptExpired, false);
  assert.equal(eligibleFinalized.paymentResponseAllowed, true);
  assert.equal(eligibleFinalized.resourceReleaseAllowed, true);
  assertNoSideEffects(eligibleFinalized);

  const eligiblePending = decisionFor({
    eligibility: boundEligibility,
    receipt: receiptSignal({
      settlementStatus: "pending",
    }),
  });

  assert.equal(eligiblePending.ok, false);
  assert.equal(eligiblePending.releaseAuthorized, false);
  assert.equal(eligiblePending.reason, "settlement_not_finalized");
  assert.equal(eligiblePending.paymentSatisfied, false);
  assert.equal(eligiblePending.receiptSignalAccepted, false);
  assert.equal(eligiblePending.receiptVerified, true);
  assert.equal(eligiblePending.settlementStatus, "pending");
  assert.equal(eligiblePending.paymentResponseAllowed, false);
  assert.equal(eligiblePending.resourceReleaseAllowed, false);
  assertNoSideEffects(eligiblePending);

  const eligibleExpired = decisionFor({
    eligibility: boundEligibility,
    receipt: receiptSignal({
      receiptExpired: true,
    }),
  });

  assert.equal(eligibleExpired.ok, false);
  assert.equal(eligibleExpired.releaseAuthorized, false);
  assert.equal(eligibleExpired.reason, "receipt_expired");
  assert.equal(eligibleExpired.paymentSatisfied, false);
  assert.equal(eligibleExpired.receiptSignalAccepted, false);
  assert.equal(eligibleExpired.receiptExpired, true);
  assert.equal(eligibleExpired.paymentResponseAllowed, false);
  assert.equal(eligibleExpired.resourceReleaseAllowed, false);
  assertNoSideEffects(eligibleExpired);

  const unboundFinalized = decisionFor({
    eligibility: unboundEligibility,
    receipt: receiptSignal(),
  });

  assert.equal(unboundFinalized.ok, false);
  assert.equal(unboundFinalized.releaseAuthorized, false);
  assert.equal(unboundFinalized.reason, "eligibility_not_bound");
  assert.equal(unboundFinalized.paymentSatisfied, true);
  assert.equal(unboundFinalized.receiptSignalAccepted, true);
  assert.equal(unboundFinalized.receiptVerified, true);
  assert.equal(unboundFinalized.settlementStatus, "finalized");
  assert.equal(unboundFinalized.paymentResponseAllowed, false);
  assert.equal(unboundFinalized.resourceReleaseAllowed, false);
  assertNoSideEffects(unboundFinalized);

  return {
    eligibleFinalized,
    eligiblePending,
    eligibleExpired,
    unboundFinalized,
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

    const matrix = buildDecisionMatrix();

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          eligibleFinalizedAuthorized: matrix.eligibleFinalized.releaseAuthorized === true,
          eligiblePendingRejected: matrix.eligiblePending.reason === "settlement_not_finalized",
          eligibleExpiredRejected: matrix.eligibleExpired.reason === "receipt_expired",
          unboundFinalizedRejected: matrix.unboundFinalized.reason === "eligibility_not_bound",

          releaseDecisionOnly: true,
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
