#!/usr/bin/env node
/**
 * scripts/ci_phase3_live_verifier_readiness_contract.ts
 *
 * PR #164 regression harness.
 *
 * Defines the decision-space readiness contract for when a captured direct Buyer
 * ZKP proof and verified x402 receipt may be considered eligible for a future
 * Gateway release path.
 *
 * This is intentionally test-only and decision-space-only. It does not submit a
 * receipt JWS to the Gateway, does not emit PAYMENT-RESPONSE, does not touch
 * replay, does not call CRP fulfill, does not persist canonical release state,
 * and does not release protected content.
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
  type X402ReceiptBindingContext,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  assertPhase3DecisionSafety,
  buildPhase3CapturedProofReceiptState,
  buildPhase3SyntheticReceiptProofFromCapturedState,
  PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
} from "./phase3-captured-proof-receipt-test-helpers";
import {
  receiptSignal,
} from "./phase3-captured-proof-gateway-test-helpers";

const LABEL = "phase3:live-verifier-readiness-contract-test";

type ReadinessRow = {
  label: string;
  capturedProofAccepted: boolean;
  proofNormalized: boolean;
  parsedAsCanonicalDirectBuyerEnvelope: boolean;
  walletChallengeVerified: boolean;
  modelAEligibilityVerified: boolean;
  eligibilityBoundToChallenge: boolean;
  eligibilityBoundToResource: boolean;
  receiptSignalPresent: boolean;
  receiptVerified: boolean;
  receiptFinalized: boolean;
  receiptNotExpired: boolean;
  receiptContextMatched: boolean;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  readinessSatisfied: boolean;
  productionRelease: false;
};

function buildSyntheticReceiptProof(input: {
  state: Awaited<ReturnType<typeof buildPhase3CapturedProofReceiptState>>;
  expiresAt?: number;
  settlementStatus?: CcdPltProofV1["settlement"]["status"];
}): CcdPltProofV1 {
  const proof = buildPhase3SyntheticReceiptProofFromCapturedState({
    state: input.state,
    expiresAt: input.expiresAt,
    transactionHash: "phase3liveverifierreadinesscontracttxhash",
    blockHash: "phase3liveverifierreadinesscontractblockhash",
    blockHeight: 164,
    from: "ccd1qphase3liveverifierreadinessbuyerplaceholder",
  });

  if (input.settlementStatus !== undefined) {
    proof.settlement.status = input.settlementStatus;
  }

  return proof;
}

function decisionFromProof(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContext?: X402ReceiptBindingContext;
}): Phase3GatewayReleaseDecision {
  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  });

  return decisionFromReceiptSignal({
    boundEligibility: input.boundEligibility,
    receipt,
    expectedContext:
      input.expectedContext ??
      deriveX402ReceiptBindingContextFromCcdPltProofV1(input.proof),
  });
}

function decisionFromReceiptSignal(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: ReturnType<typeof receiptSignal>;
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

  assertPhase3DecisionSafety(decision);
  return decision;
}

function readinessRow(input: {
  label: string;
  boundEligibility: ModelAEligibilityBindingResult;
  proof?: CcdPltProofV1;
  receipt?: ReturnType<typeof receiptSignal>;
  expectedContext?: X402ReceiptBindingContext;
  expectedReason: string;
  expectedReadiness: boolean;
  proofNormalized: boolean;
  parsedAsCanonicalDirectBuyerEnvelope: boolean;
}): ReadinessRow {
  assert.equal(
    input.proof !== undefined || input.receipt !== undefined,
    true,
    input.label + " must provide proof or receipt",
  );

  const decision =
    input.proof !== undefined
      ? decisionFromProof({
          boundEligibility: input.boundEligibility,
          proof: input.proof,
          expectedContext: input.expectedContext,
        })
      : decisionFromReceiptSignal({
          boundEligibility: input.boundEligibility,
          receipt: input.receipt!,
          expectedContext: input.expectedContext,
        });

  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.releaseAuthorized, input.expectedReadiness, input.label);
  assert.equal(decision.paymentResponseAllowed, input.expectedReadiness, input.label);
  assert.equal(decision.resourceReleaseAllowed, input.expectedReadiness, input.label);
  assertPhase3DecisionSafety(decision);

  const capturedProofAccepted =
    input.boundEligibility.ok === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true;

  const walletChallengeVerified =
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true;

  const receiptSignalPresent = decision.receiptSignalAccepted === true;
  const receiptVerified = decision.receiptVerified === true;
  const receiptFinalized = decision.settlementStatus === "finalized";
  const receiptNotExpired = decision.receiptExpired === false;
  const receiptContextMatched = decision.receiptContextMatched === true;

  const readinessSatisfied =
    capturedProofAccepted === true &&
    input.proofNormalized === true &&
    input.parsedAsCanonicalDirectBuyerEnvelope === true &&
    walletChallengeVerified === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true &&
    receiptSignalPresent === true &&
    receiptVerified === true &&
    receiptFinalized === true &&
    receiptNotExpired === true &&
    receiptContextMatched === true &&
    decision.releaseAuthorized === true &&
    decision.paymentResponseAllowed === true &&
    decision.resourceReleaseAllowed === true;

  assert.equal(readinessSatisfied, input.expectedReadiness, input.label);

  return {
    label: input.label,
    capturedProofAccepted,
    proofNormalized: input.proofNormalized,
    parsedAsCanonicalDirectBuyerEnvelope: input.parsedAsCanonicalDirectBuyerEnvelope,
    walletChallengeVerified,
    modelAEligibilityVerified: input.boundEligibility.eligibilityVerified === true,
    eligibilityBoundToChallenge: input.boundEligibility.challengeBound === true,
    eligibilityBoundToResource: input.boundEligibility.resourceBound === true,
    receiptSignalPresent,
    receiptVerified,
    receiptFinalized,
    receiptNotExpired,
    receiptContextMatched,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    readinessSatisfied,
    productionRelease: false,
  };
}

async function main() {
  console.log(`[${LABEL}] decision-space only; no Gateway receipt submission`);

  const state = await buildPhase3CapturedProofReceiptState({
    source: "phase3-test-live-verifier-readiness-contract-input",
    badNonce: "phase3-pr164-wrong-captured-proof-nonce",
  });

  const validProof = buildSyntheticReceiptProof({ state });
  const expiredProof = buildSyntheticReceiptProof({
    state,
    expiresAt: PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  });
  const pendingReceipt = receiptSignal({
    settlementStatus: "pending",
  });

  const wrongExpectedContext = {
    ...deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof),
    nonce: "phase3-pr164-wrong-receipt-context-nonce",
  };

  const proofNormalized = state.safeMetadata.normalized === true;
  const parsedAsCanonicalDirectBuyerEnvelope = state.parsedOk === true;

  const rows = [
    readinessRow({
      label: "ready: captured proof + verified finalized receipt + matching context",
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedReason: "release_authorized",
      expectedReadiness: true,
      proofNormalized,
      parsedAsCanonicalDirectBuyerEnvelope,
    }),
    readinessRow({
      label: "not ready: invalid captured proof binding + verified finalized receipt",
      boundEligibility: state.unboundEligibility,
      proof: validProof,
      expectedReason: "eligibility_not_bound",
      expectedReadiness: false,
      proofNormalized,
      parsedAsCanonicalDirectBuyerEnvelope,
    }),
    readinessRow({
      label: "not ready: captured proof + pending receipt",
      boundEligibility: state.boundEligibility,
      receipt: pendingReceipt,
      expectedReason: "settlement_not_finalized",
      expectedReadiness: false,
      proofNormalized,
      parsedAsCanonicalDirectBuyerEnvelope,
    }),
    readinessRow({
      label: "not ready: captured proof + expired receipt",
      boundEligibility: state.boundEligibility,
      proof: expiredProof,
      expectedReason: "receipt_expired",
      expectedReadiness: false,
      proofNormalized,
      parsedAsCanonicalDirectBuyerEnvelope,
    }),
    readinessRow({
      label: "not ready: captured proof + receipt context mismatch",
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedContext: wrongExpectedContext,
      expectedReason: "receipt_context_mismatch",
      expectedReadiness: false,
      proofNormalized,
      parsedAsCanonicalDirectBuyerEnvelope,
    }),
  ];

  const readyRows = rows.filter((row) => row.readinessSatisfied === true);
  const notReadyRows = rows.filter((row) => row.readinessSatisfied === false);

  assert.equal(readyRows.length, 1);
  assert.equal(readyRows[0].decisionReason, "release_authorized");
  assert.equal(notReadyRows.length, 4);

  assert.equal(rows.every((row) => row.productionRelease === false), true);
  assert.equal(
    rows.every((row) => row.readinessSatisfied === row.releaseAuthorized),
    true,
  );
  assert.equal(
    rows.every((row) => row.readinessSatisfied === row.paymentResponseAllowed),
    true,
  );
  assert.equal(
    rows.every((row) => row.readinessSatisfied === row.resourceReleaseAllowed),
    true,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.liveVerifierReadinessContract.v1",
        decisionSpaceOnly: true,
        gatewayReceiptSubmitted: false,
        paymentResponseEmitted: false,
        replayTouched: false,
        crpCalled: false,
        crpFulfillCalled: false,
        resourceReleased: false,
        canonicalReleasePersisted: false,

        readinessContract: {
          requiresCapturedProofAccepted: true,
          requiresProofNormalized: true,
          requiresCanonicalDirectBuyerEnvelope: true,
          requiresWalletChallengeVerified: true,
          requiresModelAEligibilityVerified: true,
          requiresEligibilityBoundToChallenge: true,
          requiresEligibilityBoundToResource: true,
          requiresReceiptSignalPresent: true,
          requiresReceiptVerified: true,
          requiresFinalizedReceipt: true,
          requiresUnexpiredReceipt: true,
          requiresReceiptContextMatched: true,
        },

        capturedProofInputShape: "raw-wallet-capture-fields",
        capturedProofAcceptedByContract:
          state.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
        capturedProofNormalized: proofNormalized,
        capturedProofAccountBindingStatus: state.safeMetadata.accountBindingStatus,
        capturedProofParsedAsCanonicalEnvelope: parsedAsCanonicalDirectBuyerEnvelope,
        capturedProofEligibilityBound: state.boundEligibility.ok,

        syntheticReceiptBoundaryUsed: true,
        syntheticReceiptProofVersion: validProof.proofVersion,
        syntheticReceiptDerivedContextMatches:
          deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof).nonce === state.nonce,

        rows,
        readyRows: readyRows.length,
        notReadyRows: notReadyRows.length,
        onlyPositivePathReady: readyRows.length === 1,
        invalidCapturedProofRejected:
          rows.find((row) => row.decisionReason === "eligibility_not_bound")
            ?.readinessSatisfied === false,
        pendingReceiptRejected:
          rows.find((row) => row.decisionReason === "settlement_not_finalized")
            ?.readinessSatisfied === false,
        expiredReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_expired")
            ?.readinessSatisfied === false,
        receiptContextMismatchRejected:
          rows.find((row) => row.decisionReason === "receipt_context_mismatch")
            ?.readinessSatisfied === false,

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
