import assert from 'node:assert/strict';

import type { CcdPltProofV1 } from '../src/proofPayload';
import {
  buildX402ReceiptPaymentSatisfaction,
  buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1,
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
  type X402ReceiptBindingContext,
} from '../src/phase3/x402ReceiptPaymentSignal';
import {
  buildPhase3GatewayReleaseDecision,
} from '../src/phase3/gatewayReleaseDecisionAdapter';
import type {
  ModelAEligibilityBindingResult,
} from '../src/phase3/modelAEligibilityBinding';

const nowSec = 1_800_000_000;

const proof: CcdPltProofV1 = {
  proofVersion: 'ccd-plt-proof@v1',
  contract: {
    contractId: 'cid_phase3_verified_proof_receipt_signal',
    contractVersion: '1.0.0',
    isFrozen: true,
    merchantId: 'demo-merchant',
    resource: {
      method: 'GET',
      path: '/paid-gated',
    },
    network: 'concordium:testnet',
    asset: {
      type: 'PLT',
      tokenId: 'EUDemo',
      decimals: 6,
    },
    amount: '0.050101',
    payTo: 'ccd1qmerchantplaceholder',
  },
  nonce: 'phase3-verified-proof-receipt-signal-nonce-001',
  settlement: {
    status: 'finalized',
    settledAt: nowSec - 60,
    expiresAt: nowSec + 300,
  },
  chain: {
    transactionHash: 'abc123',
    blockHash: 'def456',
    blockHeight: 123456,
  },
  paymentEvent: {
    kind: 'plt.transfer',
    tokenId: 'EUDemo',
    amountRaw: '50101',
    from: 'ccd1qbuyerplaceholder',
    to: 'ccd1qmerchantplaceholder',
  },
};

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

const expectedContext: X402ReceiptBindingContext =
  deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
  proof,
  nowSec,
});

assert.equal(receipt.ok, true);
assert.equal(receipt.source, 'x402-receipt');
assert.equal(receipt.receiptVerified, true);
assert.equal(receipt.settlementStatus, 'finalized');
assert.equal(receipt.receiptExpired, false);
assert.deepEqual(receipt.context, expectedContext);
assert.equal(receipt.rawReceiptPrinted, false);

const payment = buildX402ReceiptPaymentSatisfaction({
  receipt,
  expectedContext,
});

assert.equal(payment.ok, true);
assert.equal(payment.payment.paymentSatisfied, true);
assert.equal(payment.receiptContextMatched, true);
assert.equal(payment.contextMismatchField, null);
assert.equal(payment.rawReceiptPrinted, false);

const decision = buildPhase3GatewayReleaseDecision({
  boundEligibility,
  payment,
});

assert.equal(decision.ok, true);
assert.equal(decision.releaseAuthorized, true);
assert.equal(decision.reason, 'release_authorized');
assert.equal(decision.receiptSignalAccepted, true);
assert.equal(decision.receiptVerified, true);
assert.equal(decision.settlementStatus, 'finalized');
assert.equal(decision.receiptExpired, false);
assert.equal(decision.receiptContextMatched, true);
assert.equal(decision.receiptContextMismatchField, null);
assert.equal(decision.paymentResponseAllowed, true);
assert.equal(decision.resourceReleaseAllowed, true);
assert.equal(decision.paymentReleaseAttempted, false);
assert.equal(decision.paymentResponseEmitted, false);
assert.equal(decision.crpCalled, false);
assert.equal(decision.replayTouched, false);
assert.equal(decision.rawProofPrinted, false);
assert.equal(decision.rawReceiptPrinted, false);

const wrongExpectedContext: X402ReceiptBindingContext = {
  ...expectedContext,
  nonce: 'wrong-expected-nonce',
};

const mismatchedPayment = buildX402ReceiptPaymentSatisfaction({
  receipt,
  expectedContext: wrongExpectedContext,
});

assert.equal(mismatchedPayment.ok, false);
assert.equal(mismatchedPayment.payment.paymentSatisfied, false);
assert.equal(mismatchedPayment.reason, 'receipt_context_mismatch');
assert.equal(mismatchedPayment.receiptContextMatched, false);
assert.equal(mismatchedPayment.contextMismatchField, 'nonce');
assert.equal(mismatchedPayment.rawReceiptPrinted, false);

const mismatchedDecision = buildPhase3GatewayReleaseDecision({
  boundEligibility,
  payment: mismatchedPayment,
});

assert.equal(mismatchedDecision.ok, false);
assert.equal(mismatchedDecision.releaseAuthorized, false);
assert.equal(mismatchedDecision.reason, 'receipt_context_mismatch');
assert.equal(mismatchedDecision.paymentResponseAllowed, false);
assert.equal(mismatchedDecision.resourceReleaseAllowed, false);
assert.equal(mismatchedDecision.receiptContextMismatchField, 'nonce');
assert.equal(mismatchedDecision.rawProofPrinted, false);
assert.equal(mismatchedDecision.rawReceiptPrinted, false);

const expiredReceipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
  proof: {
    ...proof,
    settlement: {
      ...proof.settlement,
      expiresAt: nowSec,
    },
  },
  nowSec,
});

assert.equal(expiredReceipt.ok, true);
assert.equal(expiredReceipt.receiptVerified, true);
assert.equal(expiredReceipt.settlementStatus, 'finalized');
assert.equal(expiredReceipt.receiptExpired, true);
assert.deepEqual(expiredReceipt.context, expectedContext);
assert.equal(expiredReceipt.rawReceiptPrinted, false);

const expiredPayment = buildX402ReceiptPaymentSatisfaction({
  receipt: expiredReceipt,
  expectedContext,
});

assert.equal(expiredPayment.ok, false);
assert.equal(expiredPayment.payment.paymentSatisfied, false);
assert.equal(expiredPayment.reason, 'receipt_expired');
assert.equal(expiredPayment.receiptExpired, true);
assert.equal(expiredPayment.rawReceiptPrinted, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      verifiedProofReceiptSignalBuilt: receipt.ok,
      receiptVerified: receipt.receiptVerified,
      settlementStatus: receipt.settlementStatus,
      receiptExpired: receipt.receiptExpired,
      derivedContextAttached: receipt.context?.nonce === expectedContext.nonce,
      paymentSatisfied: payment.payment.paymentSatisfied,
      releaseAuthorized: decision.releaseAuthorized,
      wrongExpectedNonceRejected: mismatchedPayment.ok === false,
      wrongExpectedNonceMismatchField: mismatchedPayment.contextMismatchField,
      expiredReceiptRejected: expiredPayment.ok === false,
      expiredReceiptReason: expiredPayment.reason,
      paymentResponseAllowed: decision.paymentResponseAllowed,
      resourceReleaseAllowed: decision.resourceReleaseAllowed,
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
