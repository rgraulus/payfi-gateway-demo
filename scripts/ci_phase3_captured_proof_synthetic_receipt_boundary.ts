#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_synthetic_receipt_boundary.ts
 *
 * PR #160 regression harness.
 *
 * Composes the captured Buyer proof guard with the verified synthetic receipt
 * proof boundary in decision space.
 *
 * This is intentionally test-only. It does not submit a receipt JWS to the
 * Gateway, does not emit PAYMENT-RESPONSE, does not touch replay, does not
 * call CRP fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";

import type { CcdPltProofV1 } from "../src/proofPayload";
import {
  buildPhase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecision,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import type {
  ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildX402ReceiptPaymentSatisfaction,
  buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1,
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  assertPhase3DecisionSafety,
  buildPhase3CapturedProofReceiptState,
  buildPhase3SyntheticReceiptProofFromCapturedState,
  PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  type Phase3CapturedProofReceiptState,
} from "./phase3-captured-proof-receipt-test-helpers";

const LABEL = "phase3:captured-proof-synthetic-receipt-boundary-test";

type BoundaryRow = {
  label: string;
  capturedProofAccepted: boolean;
  syntheticReceiptAccepted: boolean;
  receiptContextMatched: boolean;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  productionRelease: false;
};

function buildSyntheticReceiptProofFromCapturedState(input: {
  state: Phase3CapturedProofReceiptState;
  expiresAt?: number;
}): CcdPltProofV1 {
  return buildPhase3SyntheticReceiptProofFromCapturedState({
    state: input.state,
    expiresAt: input.expiresAt,
    transactionHash: "phase3syntheticreceiptboundarytxhash",
    blockHash: "phase3syntheticreceiptboundaryblockhash",
    blockHeight: 160,
    from: "ccd1qphase3syntheticbuyerplaceholder",
  });
}

function decisionFromSyntheticReceipt(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContextOverride?: ReturnType<typeof deriveX402ReceiptBindingContextFromCcdPltProofV1>;
}): Phase3GatewayReleaseDecision {
  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  });

  const expectedContext =
    input.expectedContextOverride ??
    deriveX402ReceiptBindingContextFromCcdPltProofV1(input.proof);

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt,
    expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertPhase3DecisionSafety(decision);
  return decision;
}

function boundaryRow(input: {
  label: string;
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContextOverride?: ReturnType<typeof deriveX402ReceiptBindingContextFromCcdPltProofV1>;
  expectedReason: string;
  expectedReleaseAuthorized: boolean;
}): BoundaryRow {
  const decision = decisionFromSyntheticReceipt({
    boundEligibility: input.boundEligibility,
    proof: input.proof,
    expectedContextOverride: input.expectedContextOverride,
  });

  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.releaseAuthorized, input.expectedReleaseAuthorized, input.label);
  assert.equal(decision.paymentResponseAllowed, input.expectedReleaseAuthorized, input.label);
  assert.equal(decision.resourceReleaseAllowed, input.expectedReleaseAuthorized, input.label);
  // buildPhase3GatewayReleaseDecision is decision-layer only and does not
  // expose runtime productionRelease. Runtime/production release remains out of
  // scope for this harness and is represented explicitly in BoundaryRow output.
  assertPhase3DecisionSafety(decision);

  const capturedProofAccepted =
    input.boundEligibility.ok === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true;

  const syntheticReceiptAccepted =
    decision.paymentSatisfied === true &&
    decision.receiptSignalAccepted === true &&
    decision.receiptVerified === true &&
    decision.settlementStatus === "finalized" &&
    decision.receiptExpired === false;

  return {
    label: input.label,
    capturedProofAccepted,
    syntheticReceiptAccepted,
    receiptContextMatched: decision.receiptContextMatched,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    productionRelease: false,
  };
}

async function main() {
  console.log(`[${LABEL}] decision-space only; no Gateway receipt submission`);

  const state = await buildPhase3CapturedProofReceiptState({
    source: "phase3-test-captured-proof-synthetic-receipt-boundary-input",
    badNonce: "phase3-pr160-wrong-captured-proof-nonce",
  });

  const validProof = buildSyntheticReceiptProofFromCapturedState({
    state,
  });

  const wrongExpectedContext = {
    ...deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof),
    nonce: "phase3-pr160-wrong-expected-receipt-nonce",
  };

  const expiredProof = buildSyntheticReceiptProofFromCapturedState({
    state,
    expiresAt: PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  });

  const rows = [
    boundaryRow({
      label: "valid captured proof + verified synthetic finalized receipt",
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedReason: "release_authorized",
      expectedReleaseAuthorized: true,
    }),
    boundaryRow({
      label: "valid captured proof + verified synthetic receipt wrong expected context",
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedContextOverride: wrongExpectedContext,
      expectedReason: "receipt_context_mismatch",
      expectedReleaseAuthorized: false,
    }),
    boundaryRow({
      label: "invalid captured proof binding + verified synthetic finalized receipt",
      boundEligibility: state.unboundEligibility,
      proof: validProof,
      expectedReason: "eligibility_not_bound",
      expectedReleaseAuthorized: false,
    }),
    boundaryRow({
      label: "valid captured proof + verified synthetic expired receipt",
      boundEligibility: state.boundEligibility,
      proof: expiredProof,
      expectedReason: "receipt_expired",
      expectedReleaseAuthorized: false,
    }),
  ];

  const authorizedRows = rows.filter((row) => row.releaseAuthorized === true);
  const deniedRows = rows.filter((row) => row.releaseAuthorized === false);

  assert.equal(authorizedRows.length, 1);
  assert.equal(authorizedRows[0].label, "valid captured proof + verified synthetic finalized receipt");
  assert.equal(deniedRows.length, 3);

  assert.equal(rows.every((row) => row.productionRelease === false), true);
  assert.equal(
    rows.every((row) => row.releaseAuthorized === row.paymentResponseAllowed),
    true,
  );
  assert.equal(
    rows.every((row) => row.releaseAuthorized === row.resourceReleaseAllowed),
    true,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofSyntheticReceiptBoundary.v1",
        decisionSpaceOnly: true,
        gatewayReceiptSubmitted: false,
        paymentResponseEmitted: false,
        replayTouched: false,
        crpCalled: false,
        crpFulfillCalled: false,
        resourceReleased: false,

        capturedProofInputShape: "raw-wallet-capture-fields",
        capturedProofAcceptedByContract:
          state.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
        capturedProofNormalized: state.safeMetadata.normalized,
        capturedProofAccountBindingStatus: state.safeMetadata.accountBindingStatus,
        capturedProofParsedAsCanonicalEnvelope: state.parsedOk,
        capturedProofEligibilityBound: state.boundEligibility.ok,

        syntheticReceiptBoundaryUsed: true,
        syntheticReceiptProofVersion: validProof.proofVersion,
        syntheticReceiptDerivedContextMatches:
          deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof).nonce === state.nonce,

        rows,
        authorizedRows: authorizedRows.length,
        deniedRows: deniedRows.length,

        validCapturedProofAndVerifiedSyntheticReceiptAuthorizesDecision:
          authorizedRows.length === 1,
        wrongReceiptExpectedContextRejected:
          rows.find((row) => row.decisionReason === "receipt_context_mismatch")
            ?.releaseAuthorized === false,
        invalidCapturedProofWithVerifiedSyntheticReceiptRejected:
          rows.find((row) => row.decisionReason === "eligibility_not_bound")
            ?.releaseAuthorized === false,
        expiredSyntheticReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_expired")
            ?.releaseAuthorized === false,

        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
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
