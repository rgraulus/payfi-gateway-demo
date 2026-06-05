import assert from 'node:assert/strict';

import type {
  ModelAEligibilityBindingResult,
} from '../src/phase3/modelAEligibilityBinding';
import {
  composeModelAReleaseDecision,
} from '../src/phase3/modelAReleaseComposition';
import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptPaymentSignal,
} from '../src/phase3/x402ReceiptPaymentSignal';

const boundEligibility: ModelAEligibilityBindingResult = {
  ok: true,
  model: 'phase3-model-a',
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

const finalizedReceiptSignal: X402ReceiptPaymentSignal = {
  ok: true,
  source: 'x402-receipt',
  receiptVerified: true,
  settlementStatus: 'finalized',
  receiptExpired: false,
  rawReceiptPrinted: false,
};

function assertNoReleaseSideEffects(result: ReturnType<typeof composeModelAReleaseDecision>) {
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

type X402ReceiptPaymentSignalRejectReason =
  | 'receipt_not_verified'
  | 'settlement_not_finalized'
  | 'receipt_expired'
  | 'invalid_receipt_source';

function expectRejected(
  label: string,
  receipt: X402ReceiptPaymentSignal,
  expectedReason: X402ReceiptPaymentSignalRejectReason,
): void {
  const payment = buildX402ReceiptPaymentSatisfaction({ receipt });

  assert.equal(payment.ok, false, `${label} should be rejected`);
  assert.equal(payment.payment.paymentSatisfied, false);
  assert.equal(payment.payment.paymentSource, 'x402-receipt');
  assert.equal(payment.rawReceiptPrinted, false);

  if (!payment.ok) {
    assert.equal(payment.reason, expectedReason);
  }

  const decision = composeModelAReleaseDecision({
    boundEligibility,
    payment: payment.payment,
  });

  assert.equal(decision.ok, false);
  assert.equal(decision.releaseAuthorized, false);
  assert.equal(decision.reason, 'payment_not_satisfied');
  assertNoReleaseSideEffects(decision);
}

function main() {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: finalizedReceiptSignal,
  });

  assert.equal(payment.ok, true);
  assert.equal(payment.payment.paymentSatisfied, true);
  assert.equal(payment.payment.paymentSource, 'x402-receipt');
  assert.equal(payment.receiptVerified, true);
  assert.equal(payment.settlementStatus, 'finalized');
  assert.equal(payment.receiptExpired, false);
  assert.equal(payment.rawReceiptPrinted, false);

  const decision = composeModelAReleaseDecision({
    boundEligibility,
    payment: payment.payment,
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.eligibilityVerified, true);
  assert.equal(decision.challengeBound, true);
  assert.equal(decision.resourceBound, true);
  assert.equal(decision.paymentSatisfied, true);
  assert.equal(decision.paymentSource, 'x402-receipt');
  assert.equal(decision.releaseAuthorized, true);
  assert.equal(decision.reason, 'release_authorized');
  assertNoReleaseSideEffects(decision);

  expectRejected('unverified receipt', {
    ...finalizedReceiptSignal,
    ok: false,
    receiptVerified: false,
  }, 'receipt_not_verified');

  expectRejected('pending settlement', {
    ...finalizedReceiptSignal,
    settlementStatus: 'pending',
  }, 'settlement_not_finalized');

  expectRejected('expired receipt', {
    ...finalizedReceiptSignal,
    receiptExpired: true,
  }, 'receipt_expired');

  console.log(
    JSON.stringify(
      {
        ok: true,
        x402ReceiptPaymentSatisfied: payment.payment.paymentSatisfied,
        paymentSource: payment.payment.paymentSource,
        eligibleBoundReceiptWouldAuthorizeRelease: decision.releaseAuthorized,
        unverifiedReceiptRejected: true,
        pendingSettlementRejected: true,
        expiredReceiptRejected: true,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        replayTouched: false,
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
}

main();
