#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_receipt_context_matrix.ts
 *
 * PR #161 regression harness.
 *
 * Proves a verified synthetic x402 receipt boundary cannot be reused across
 * the wrong captured Buyer proof / challenge / payment context.
 *
 * This is intentionally test-only and decision-space-only. It does not submit
 * a receipt JWS to the Gateway, does not emit PAYMENT-RESPONSE, does not touch
 * replay, does not call CRP fulfill, and does not release protected content.
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
  type X402ReceiptContextMismatchField,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  assertPhase3DecisionSafety,
  buildPhase3CapturedProofReceiptState,
  buildPhase3SyntheticReceiptProofFromCapturedState,
  PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  type Phase3CapturedProofReceiptState,
} from "./phase3-captured-proof-receipt-test-helpers";

const LABEL = "phase3:captured-proof-receipt-context-matrix-test";

type ContextMismatchRow = {
  label: string;
  expectedMismatchField: X402ReceiptContextMismatchField | null;
  actualMismatchField: X402ReceiptContextMismatchField | null;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  capturedProofAccepted: boolean;
  receiptVerified: boolean;
  receiptContextMatched: boolean;
  productionRelease: false;
};

function buildSyntheticReceiptProofFromCapturedState(state: Phase3CapturedProofReceiptState): CcdPltProofV1 {
  return buildPhase3SyntheticReceiptProofFromCapturedState({
    state,
    transactionHash: "phase3contextmatrixtxhash",
    blockHash: "phase3contextmatrixblockhash",
    blockHeight: 161,
    from: "ccd1qphase3contextmatrixbuyerplaceholder",
  });
}

function decisionFromExpectedContext(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContext: X402ReceiptBindingContext;
}): Phase3GatewayReleaseDecision {
  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: PHASE3_CAPTURED_PROOF_RECEIPT_NOW_SEC,
  });

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt,
    expectedContext: input.expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertPhase3DecisionSafety(decision);
  return decision;
}

function mutateContext(
  base: X402ReceiptBindingContext,
  field: X402ReceiptContextMismatchField,
): X402ReceiptBindingContext | undefined {
  if (field === "missing_receipt_context") {
    return undefined;
  }

  const out: X402ReceiptBindingContext = JSON.parse(JSON.stringify(base));

  switch (field) {
    case "nonce":
      out.nonce = "phase3-pr161-wrong-nonce";
      break;
    case "resource.method":
      out.resource.method = "POST";
      break;
    case "resource.path":
      out.resource.path = "/paid-gated-other";
      break;
    case "contract.contractId":
      out.contract.contractId = "cid_phase3_pr161_wrong_contract";
      break;
    case "contract.contractVersion":
      out.contract.contractVersion = "9.9.9";
      break;
    case "contract.merchantId":
      out.contract.merchantId = "wrong-merchant";
      break;
    case "network":
      out.network = "concordium:mainnet";
      break;
    case "asset.type":
      out.asset.type = "CCD";
      break;
    case "asset.tokenId":
      out.asset.tokenId = "OtherDemo";
      break;
    case "asset.decimals":
      out.asset.decimals = 8;
      break;
    case "amount":
      out.amount = "0.999999";
      break;
    case "payTo":
      out.payTo = "ccd1qphase3wrongmerchant";
      break;
    default:
      throw new Error(`unhandled context mismatch field: ${field}`);
  }

  return out;
}

function rowFor(input: {
  label: string;
  state: Phase3CapturedProofReceiptState;
  proof: CcdPltProofV1;
  expectedContext: X402ReceiptBindingContext;
  expectedMismatchField: X402ReceiptContextMismatchField | null;
  expectedReleaseAuthorized: boolean;
}): ContextMismatchRow {
  const decision = decisionFromExpectedContext({
    boundEligibility: input.state.boundEligibility,
    proof: input.proof,
    expectedContext: input.expectedContext,
  });

  assert.equal(
    decision.releaseAuthorized,
    input.expectedReleaseAuthorized,
    input.label,
  );
  assert.equal(
    decision.paymentResponseAllowed,
    input.expectedReleaseAuthorized,
    input.label,
  );
  assert.equal(
    decision.resourceReleaseAllowed,
    input.expectedReleaseAuthorized,
    input.label,
  );

  if (input.expectedMismatchField === null) {
    assert.equal(decision.reason, "release_authorized", input.label);
    assert.equal(decision.receiptContextMatched, true, input.label);
    assert.equal(decision.receiptContextMismatchField, null, input.label);
  } else {
    assert.equal(decision.reason, "receipt_context_mismatch", input.label);
    assert.equal(decision.receiptContextMatched, false, input.label);
    assert.equal(decision.receiptContextMismatchField, input.expectedMismatchField, input.label);
  }

  assertPhase3DecisionSafety(decision);

  return {
    label: input.label,
    expectedMismatchField: input.expectedMismatchField,
    actualMismatchField: decision.receiptContextMismatchField,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    capturedProofAccepted:
      input.state.boundEligibility.ok === true &&
      input.state.boundEligibility.eligibilityVerified === true &&
      input.state.boundEligibility.challengeBound === true &&
      input.state.boundEligibility.resourceBound === true,
    receiptVerified: decision.receiptVerified,
    receiptContextMatched: decision.receiptContextMatched,
    productionRelease: false,
  };
}

async function main() {
  console.log(`[${LABEL}] decision-space only; no Gateway receipt submission`);

  const state = await buildPhase3CapturedProofReceiptState({
    source: "phase3-test-captured-proof-receipt-context-matrix-input",
    badNonce: "phase3-pr161-wrong-captured-proof-nonce",
  });
  const proof = buildSyntheticReceiptProofFromCapturedState(state);
  const matchingContext = deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

  const mismatchFields: X402ReceiptContextMismatchField[] = [
    "nonce",
    "resource.method",
    "resource.path",
    "contract.contractId",
    "contract.contractVersion",
    "contract.merchantId",
    "network",
    "asset.type",
    "asset.tokenId",
    "asset.decimals",
    "amount",
    "payTo",
  ];

  const positive = rowFor({
    label: "matching captured proof + verified synthetic receipt context",
    state,
    proof,
    expectedContext: matchingContext,
    expectedMismatchField: null,
    expectedReleaseAuthorized: true,
  });

  const mismatchRows = mismatchFields.map((field) => {
    const expectedContext = mutateContext(matchingContext, field);
    assert.ok(expectedContext, `${field} should produce an expected context`);

    return rowFor({
      label: `wrong ${field}`,
      state,
      proof,
      expectedContext,
      expectedMismatchField: field,
      expectedReleaseAuthorized: false,
    });
  });

  const rows = [positive, ...mismatchRows];

  assert.equal(positive.decisionReason, "release_authorized");
  assert.equal(positive.releaseAuthorized, true);
  assert.equal(positive.paymentResponseAllowed, true);
  assert.equal(positive.resourceReleaseAllowed, true);
  assert.equal(positive.receiptContextMatched, true);

  assert.equal(mismatchRows.length, mismatchFields.length);
  assert.equal(mismatchRows.every((row) => row.decisionReason === "receipt_context_mismatch"), true);
  assert.equal(mismatchRows.every((row) => row.releaseAuthorized === false), true);
  assert.equal(mismatchRows.every((row) => row.paymentResponseAllowed === false), true);
  assert.equal(mismatchRows.every((row) => row.resourceReleaseAllowed === false), true);
  assert.equal(mismatchRows.every((row) => row.receiptContextMatched === false), true);
  assert.deepEqual(
    mismatchRows.map((row) => row.actualMismatchField),
    mismatchFields,
  );

  assert.equal(rows.every((row) => row.capturedProofAccepted === true), true);
  assert.equal(rows.every((row) => row.receiptVerified === true), true);
  assert.equal(rows.every((row) => row.productionRelease === false), true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofReceiptContextMatrix.v1",
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

        positiveControlAuthorized: positive.releaseAuthorized,
        receiptContextFieldsCovered: mismatchFields,
        mismatchRows,
        mismatchRowsRejected: mismatchRows.length,
        allMismatchesRejected: mismatchRows.every((row) => row.releaseAuthorized === false),
        mismatchFieldsRoundTripped:
          JSON.stringify(mismatchRows.map((row) => row.actualMismatchField)) ===
          JSON.stringify(mismatchFields),

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
