#!/usr/bin/env node
/**
 * scripts/ci_phase3_runtime_receipt_requirement_matrix.ts
 *
 * PR #166 regression harness.
 *
 * Proves the Phase 3 runtime release path continues to require a valid x402
 * receipt signal before any readiness-shaped release can be recognized by the
 * Gateway runtime.
 *
 * This is intentionally test-only. It combines:
 *
 *   1. a decision-space receipt requirement matrix
 *   2. a Gateway runtime missing-receipt sanity check
 *
 * It does not submit a real receipt JWS, does not emit PAYMENT-RESPONSE, does
 * not touch replay, does not call CRP fulfill, does not persist canonical
 * release state, and does not release protected content.
 */

import assert from "node:assert/strict";
import process from "node:process";

import {
  buildPhase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecisionReason,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import type {
  ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptBindingContext,
  type X402ReceiptPaymentSignal,
} from "../src/phase3/x402ReceiptPaymentSignal";
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
  receiptSignal,
} from "./phase3-captured-proof-gateway-test-helpers";

const GATEWAY_PORT = Number(process.env.PHASE3_RUNTIME_RECEIPT_REQUIREMENT_MATRIX_PORT || 3081);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:runtime-receipt-requirement-matrix-test";

type MatrixRow = {
  label: string;
  proofReady: boolean;
  receiptSignalPresent: boolean;
  receiptVerified: boolean;
  receiptFinalized: boolean;
  receiptNotExpired: boolean;
  receiptContextMatched: boolean;
  expectedReason: Phase3GatewayReleaseDecisionReason;
  decisionOk: boolean;
  decisionReason: Phase3GatewayReleaseDecisionReason;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  runtimeReleaseAllowed: false;
  productionRelease: false;
};

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

function assertDecisionSafety(decision: Phase3GatewayReleaseDecision): void {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

function decisionFor(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
  expectedContext?: X402ReceiptBindingContext;
}): Phase3GatewayReleaseDecision {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: input.receipt,
    expectedContext: input.expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertDecisionSafety(decision);
  return decision;
}

function rowFor(input: {
  label: string;
  proofReady: boolean;
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
  expectedContext?: X402ReceiptBindingContext;
  expectedReason: Phase3GatewayReleaseDecisionReason;
  expectedAuthorized: boolean;
}): MatrixRow {
  const decision = decisionFor({
    boundEligibility: input.boundEligibility,
    receipt: input.receipt,
    expectedContext: input.expectedContext,
  });

  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.releaseAuthorized, input.expectedAuthorized, input.label);
  assert.equal(decision.paymentResponseAllowed, input.expectedAuthorized, input.label);
  assert.equal(decision.resourceReleaseAllowed, input.expectedAuthorized, input.label);

  const receiptSignalPresent = decision.receiptSignalAccepted === true;
  const receiptVerified = decision.receiptVerified === true;
  const receiptFinalized = decision.settlementStatus === "finalized";
  const receiptNotExpired = decision.receiptExpired === false;
  const receiptContextMatched = decision.receiptContextMatched === true;

  return {
    label: input.label,
    proofReady: input.proofReady,
    receiptSignalPresent,
    receiptVerified,
    receiptFinalized,
    receiptNotExpired,
    receiptContextMatched,
    expectedReason: input.expectedReason,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    runtimeReleaseAllowed: false,
    productionRelease: false,
  };
}

async function runRuntimeMissingReceiptSanity() {
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

    return {
      gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
      gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
      gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
      requireLiveZkp: health.phase3.requireLiveZkp,
      eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

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

      paymentResponseEmitted: safety.paymentResponseEmitted,
      crpCalled: safety.crpCalled,
      crpFulfillCalled: safety.crpFulfillCalled,
      replayTouched: safety.replayTouched,
      canonicalReleasePersisted: safety.canonicalReleasePersisted,
      rawProofPrinted: safety.rawProofPrinted,
      rawReceiptPrinted: safety.rawReceiptPrinted,
    };
  } finally {
    await cleanup();
  }
}

async function main() {
  console.log(`[${LABEL}] decision matrix + runtime missing-receipt sanity`);

  const capturedProof = await buildCapturedProofGatewayDecision({
    source: "phase3-test-runtime-receipt-requirement-matrix-input",
    badNonce: "phase3-pr166-wrong-captured-proof-nonce",
  });

  assert.equal(capturedProof.boundEligibility.ok, true);

  const unboundEligibility: ModelAEligibilityBindingResult = {
    ...capturedProof.boundEligibility,
    ok: false,
    challengeBound: false,
    resourceBound: false,
    releaseAuthorized: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: false,
  };

  assert.equal(unboundEligibility.ok, false);
  assert.equal(unboundEligibility.challengeBound, false);
  assert.equal(unboundEligibility.resourceBound, false);

  assert.equal(capturedProof.decision.releaseAuthorized, true);
  assert.equal(capturedProof.decision.reason, "release_authorized");
  assert.equal(capturedProof.decision.rawProofPrinted, false);
  assert.equal(capturedProof.decision.rawReceiptPrinted, false);

  const validReceipt = receiptSignal();
  const unverifiedReceipt = receiptSignal({
    ok: false,
    receiptVerified: false,
  });
  const pendingReceipt = receiptSignal({
    settlementStatus: "pending",
  });
  const expiredReceipt = receiptSignal({
    receiptExpired: true,
  });

  const wrongExpectedContext: X402ReceiptBindingContext = {
    nonce: "phase3-pr166-wrong-runtime-receipt-context-nonce",
    resource: {
      method: "GET",
      path: "/paid-gated",
    },
    contract: {
      contractId: "cid_phase3_runtime_receipt_requirement_matrix",
      contractVersion: "1.0.0",
      merchantId: "demo-merchant",
    },
    network: "concordium:testnet",
    asset: {
      type: "PLT",
      tokenId: "EUDemo",
      decimals: 6,
    },
    amount: "0.050101",
    payTo: "ccd1qmerchantplaceholder",
  };

  const rows = [
    rowFor({
      label: "proof ready + verified finalized matching receipt",
      proofReady: true,
      boundEligibility: capturedProof.boundEligibility,
      receipt: validReceipt,
      expectedReason: "release_authorized",
      expectedAuthorized: true,
    }),
    rowFor({
      label: "proof ready + unverified receipt",
      proofReady: true,
      boundEligibility: capturedProof.boundEligibility,
      receipt: unverifiedReceipt,
      expectedReason: "receipt_not_verified",
      expectedAuthorized: false,
    }),
    rowFor({
      label: "proof ready + pending receipt",
      proofReady: true,
      boundEligibility: capturedProof.boundEligibility,
      receipt: pendingReceipt,
      expectedReason: "settlement_not_finalized",
      expectedAuthorized: false,
    }),
    rowFor({
      label: "proof ready + expired receipt",
      proofReady: true,
      boundEligibility: capturedProof.boundEligibility,
      receipt: expiredReceipt,
      expectedReason: "receipt_expired",
      expectedAuthorized: false,
    }),
    rowFor({
      label: "proof ready + context-mismatched receipt",
      proofReady: true,
      boundEligibility: capturedProof.boundEligibility,
      receipt: validReceipt,
      expectedContext: wrongExpectedContext,
      expectedReason: "receipt_context_mismatch",
      expectedAuthorized: false,
    }),
    rowFor({
      label: "proof not ready + verified finalized matching receipt",
      proofReady: false,
      boundEligibility: unboundEligibility,
      receipt: validReceipt,
      expectedReason: "eligibility_not_bound",
      expectedAuthorized: false,
    }),
  ];

  const authorizedRows = rows.filter((row) => row.releaseAuthorized === true);
  const blockedRows = rows.filter((row) => row.releaseAuthorized === false);

  assert.equal(authorizedRows.length, 1);
  assert.equal(authorizedRows[0].decisionReason, "release_authorized");
  assert.equal(blockedRows.length, 5);

  assert.equal(
    rows.every((row) => row.runtimeReleaseAllowed === false),
    true,
  );
  assert.equal(
    rows.every((row) => row.productionRelease === false),
    true,
  );

  const runtime = await runRuntimeMissingReceiptSanity();

  assert.equal(runtime.runtimeReadinessSeamRecognized, true);
  assert.equal(runtime.runtimeGuardSatisfied, true);
  assert.equal(runtime.runtimeBlockedBy, "missing_x402_receipt_signal");
  assert.equal(runtime.runtimeReceiptRequired, true);
  assert.equal(runtime.runtimeReceiptSignalPresent, false);
  assert.equal(runtime.runtimeReleaseDecisionRecognized, false);
  assert.equal(runtime.actualGatewayStillReturns402, true);
  assert.equal(runtime.actualGatewayPaymentResponseEmitted, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.runtimeReceiptRequirementMatrix.v1",
        decisionMatrixOnlyForReceiptVariants: true,
        runtimeSanityOnlyForMissingReceipt: true,

        capturedProofInputShape: "raw-wallet-capture-fields",
        capturedProofAcceptedByContract:
          capturedProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
        capturedProofNormalized: capturedProof.safeMetadata.normalized,
        capturedProofAccountBindingStatus: capturedProof.safeMetadata.accountBindingStatus,
        capturedProofParsedAsCanonicalEnvelope: capturedProof.parsedOk,
        capturedProofEligibilityBound: capturedProof.boundEligibility.ok,

        rows,
        authorizedRows: authorizedRows.length,
        blockedRows: blockedRows.length,

        validReceiptAllowsDecisionSpaceRelease:
          rows.find((row) => row.decisionReason === "release_authorized")?.releaseAuthorized === true,
        unverifiedReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_not_verified")?.releaseAuthorized === false,
        pendingReceiptRejected:
          rows.find((row) => row.decisionReason === "settlement_not_finalized")?.releaseAuthorized === false,
        expiredReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_expired")?.releaseAuthorized === false,
        contextMismatchedReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_context_mismatch")?.releaseAuthorized === false,
        proofNotReadyRejected:
          rows.find((row) => row.decisionReason === "eligibility_not_bound")?.releaseAuthorized === false,

        runtime,

        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: runtime.paymentResponseEmitted,
        crpCalled: runtime.crpCalled,
        crpFulfillCalled: runtime.crpFulfillCalled,
        replayTouched: runtime.replayTouched,
        resourceReleased: false,
        canonicalReleasePersisted: runtime.canonicalReleasePersisted,
        rawProofPrinted: runtime.rawProofPrinted,
        rawReceiptPrinted: runtime.rawReceiptPrinted,
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
