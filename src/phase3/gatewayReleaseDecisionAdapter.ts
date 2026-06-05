import {
  composeModelAReleaseDecision,
  type ModelAReleaseCompositionDecision,
} from './modelAReleaseComposition';
import type {
  ModelAEligibilityBindingResult,
} from './modelAEligibilityBinding';
import type {
  X402ReceiptPaymentSignalResult,
} from './x402ReceiptPaymentSignal';

export type Phase3GatewayReleaseDecisionReason =
  | 'release_authorized'
  | 'eligibility_not_bound'
  | 'payment_not_satisfied'
  | 'receipt_not_verified'
  | 'settlement_not_finalized'
  | 'receipt_expired'
  | 'invalid_receipt_source';

export type Phase3GatewayReleaseDecision = {
  ok: boolean;
  model: 'phase3-model-a';
  releaseAuthorized: boolean;
  reason: Phase3GatewayReleaseDecisionReason;

  eligibilityVerified: boolean;
  challengeBound: boolean;
  resourceBound: boolean;

  paymentSatisfied: boolean;
  paymentSource: ModelAReleaseCompositionDecision['paymentSource'];

  receiptSignalAccepted: boolean;
  receiptVerified: boolean;
  settlementStatus: X402ReceiptPaymentSignalResult['settlementStatus'];
  receiptExpired: boolean;

  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;

  paymentReleaseAttempted: false;
  paymentResponseEmitted: false;
  crpCalled: false;
  replayTouched: false;
  rawProofPrinted: false;
  rawReceiptPrinted: false;
};

function receiptReason(
  input: X402ReceiptPaymentSignalResult,
): Phase3GatewayReleaseDecisionReason | null {
  return input.ok ? null : input.reason;
}

export function buildPhase3GatewayReleaseDecision(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  payment: X402ReceiptPaymentSignalResult;
}): Phase3GatewayReleaseDecision {
  const composition = composeModelAReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment: input.payment.payment,
  });

  const reason = receiptReason(input.payment) ?? composition.reason;
  const releaseAuthorized = composition.releaseAuthorized && input.payment.ok === true;

  return {
    ok: composition.ok && input.payment.ok === true,
    model: 'phase3-model-a',
    releaseAuthorized,
    reason,

    eligibilityVerified: composition.eligibilityVerified,
    challengeBound: composition.challengeBound,
    resourceBound: composition.resourceBound,

    paymentSatisfied: composition.paymentSatisfied,
    paymentSource: composition.paymentSource,

    receiptSignalAccepted: input.payment.ok === true,
    receiptVerified: input.payment.receiptVerified,
    settlementStatus: input.payment.settlementStatus,
    receiptExpired: input.payment.receiptExpired,

    paymentResponseAllowed: releaseAuthorized,
    resourceReleaseAllowed: releaseAuthorized,

    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: composition.rawProofPrinted,
    rawReceiptPrinted: input.payment.rawReceiptPrinted,
  };
}
