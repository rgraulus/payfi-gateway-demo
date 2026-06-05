import assert from 'node:assert/strict';

import type {
  ModelAEligibilityBindingResult,
} from '../src/phase3/modelAEligibilityBinding';
import {
  buildPhase3GatewayReleaseDecision,
} from '../src/phase3/gatewayReleaseDecisionAdapter';
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

const unboundEligibility: ModelAEligibilityBindingResult = {
  ...boundEligibility,
  ok: false,
  challengeBound: false,
  resourceBound: false,
  bindingCode: 'policy_binding_mismatch',
  bindingReason: 'selftest mismatch',
};

const finalizedReceiptSignal: X402ReceiptPaymentSignal = {
  ok: true,
  source: 'x402-receipt',
  receiptVerified: true,
  settlementStatus: 'finalized',
  receiptExpired: false,
  rawReceiptPrinted: false,
};

function assertNoSideEffects(decision: ReturnType<typeof buildPhase3GatewayReleaseDecision>) {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

function buildPayment(receipt: X402ReceiptPaymentSignal) {
  return buildX402ReceiptPaymentSatisfaction({ receipt });
}

function main() {
  const authorized = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment: buildPayment(finalizedReceiptSignal),
  });

  assert.equal(authorized.ok, true);
  assert.equal(authorized.releaseAuthorized, true);
  assert.equal(authorized.reason, 'release_authorized');
  assert.equal(authorized.eligibilityVerified, true);
  assert.equal(authorized.challengeBound, true);
  assert.equal(authorized.resourceBound, true);
  assert.equal(authorized.paymentSatisfied, true);
  assert.equal(authorized.paymentSource, 'x402-receipt');
  assert.equal(authorized.receiptSignalAccepted, true);
  assert.equal(authorized.receiptVerified, true);
  assert.equal(authorized.settlementStatus, 'finalized');
  assert.equal(authorized.receiptExpired, false);
  assert.equal(authorized.paymentResponseAllowed, true);
  assert.equal(authorized.resourceReleaseAllowed, true);
  assertNoSideEffects(authorized);

  const unbound = buildPhase3GatewayReleaseDecision({
    boundEligibility: unboundEligibility,
    payment: buildPayment(finalizedReceiptSignal),
  });

  assert.equal(unbound.ok, false);
  assert.equal(unbound.releaseAuthorized, false);
  assert.equal(unbound.reason, 'eligibility_not_bound');
  assert.equal(unbound.paymentSatisfied, true);
  assert.equal(unbound.receiptSignalAccepted, true);
  assert.equal(unbound.paymentResponseAllowed, false);
  assert.equal(unbound.resourceReleaseAllowed, false);
  assertNoSideEffects(unbound);

  const unverifiedReceipt = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment: buildPayment({
      ...finalizedReceiptSignal,
      ok: false,
      receiptVerified: false,
    }),
  });

  assert.equal(unverifiedReceipt.ok, false);
  assert.equal(unverifiedReceipt.releaseAuthorized, false);
  assert.equal(unverifiedReceipt.reason, 'receipt_not_verified');
  assert.equal(unverifiedReceipt.paymentSatisfied, false);
  assert.equal(unverifiedReceipt.receiptSignalAccepted, false);
  assert.equal(unverifiedReceipt.receiptVerified, false);
  assert.equal(unverifiedReceipt.paymentResponseAllowed, false);
  assert.equal(unverifiedReceipt.resourceReleaseAllowed, false);
  assertNoSideEffects(unverifiedReceipt);

  const pendingSettlement = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment: buildPayment({
      ...finalizedReceiptSignal,
      settlementStatus: 'pending',
    }),
  });

  assert.equal(pendingSettlement.ok, false);
  assert.equal(pendingSettlement.releaseAuthorized, false);
  assert.equal(pendingSettlement.reason, 'settlement_not_finalized');
  assert.equal(pendingSettlement.paymentSatisfied, false);
  assert.equal(pendingSettlement.receiptSignalAccepted, false);
  assert.equal(pendingSettlement.receiptVerified, true);
  assert.equal(pendingSettlement.settlementStatus, 'pending');
  assert.equal(pendingSettlement.paymentResponseAllowed, false);
  assert.equal(pendingSettlement.resourceReleaseAllowed, false);
  assertNoSideEffects(pendingSettlement);

  const expiredReceipt = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment: buildPayment({
      ...finalizedReceiptSignal,
      receiptExpired: true,
    }),
  });

  assert.equal(expiredReceipt.ok, false);
  assert.equal(expiredReceipt.releaseAuthorized, false);
  assert.equal(expiredReceipt.reason, 'receipt_expired');
  assert.equal(expiredReceipt.paymentSatisfied, false);
  assert.equal(expiredReceipt.receiptSignalAccepted, false);
  assert.equal(expiredReceipt.receiptExpired, true);
  assert.equal(expiredReceipt.paymentResponseAllowed, false);
  assert.equal(expiredReceipt.resourceReleaseAllowed, false);
  assertNoSideEffects(expiredReceipt);

  console.log(
    JSON.stringify(
      {
        ok: true,
        authorizedReleaseDecision: authorized.releaseAuthorized,
        authorizedPaymentResponseAllowed: authorized.paymentResponseAllowed,
        authorizedResourceReleaseAllowed: authorized.resourceReleaseAllowed,
        unboundEligibilityRejected: unbound.reason === 'eligibility_not_bound',
        unverifiedReceiptRejected: unverifiedReceipt.reason === 'receipt_not_verified',
        pendingSettlementRejected: pendingSettlement.reason === 'settlement_not_finalized',
        expiredReceiptRejected: expiredReceipt.reason === 'receipt_expired',
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        replayTouched: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
}

main();
