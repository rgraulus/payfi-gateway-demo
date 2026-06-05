import type {
  ModelAEligibilityBindingResult,
} from './modelAEligibilityBinding';

export type ModelAPaymentSatisfactionInput = {
  paymentSatisfied: boolean;
  paymentSource: 'none' | 'test-only' | 'x402-receipt';
};

export type ModelAReleaseCompositionDecision = {
  ok: boolean;
  model: 'phase3-model-a';
  eligibilityVerified: boolean;
  challengeBound: boolean;
  resourceBound: boolean;
  paymentSatisfied: boolean;
  paymentSource: ModelAPaymentSatisfactionInput['paymentSource'];
  releaseAuthorized: boolean;
  reason:
    | 'release_authorized'
    | 'eligibility_not_bound'
    | 'payment_not_satisfied';
  paymentReleaseAttempted: false;
  paymentResponseEmitted: false;
  crpCalled: false;
  replayTouched: false;
  rawProofPrinted: false;
};

export function composeModelAReleaseDecision(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  payment: ModelAPaymentSatisfactionInput;
}): ModelAReleaseCompositionDecision {
  const eligibilityBound =
    input.boundEligibility.ok === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true;

  if (!eligibilityBound) {
    return {
      ok: false,
      model: 'phase3-model-a',
      eligibilityVerified: input.boundEligibility.eligibilityVerified,
      challengeBound: input.boundEligibility.challengeBound,
      resourceBound: input.boundEligibility.resourceBound,
      paymentSatisfied: input.payment.paymentSatisfied,
      paymentSource: input.payment.paymentSource,
      releaseAuthorized: false,
      reason: 'eligibility_not_bound',
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      replayTouched: false,
      rawProofPrinted: false,
    };
  }

  if (!input.payment.paymentSatisfied) {
    return {
      ok: false,
      model: 'phase3-model-a',
      eligibilityVerified: true,
      challengeBound: true,
      resourceBound: true,
      paymentSatisfied: false,
      paymentSource: input.payment.paymentSource,
      releaseAuthorized: false,
      reason: 'payment_not_satisfied',
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      replayTouched: false,
      rawProofPrinted: false,
    };
  }

  return {
    ok: true,
    model: 'phase3-model-a',
    eligibilityVerified: true,
    challengeBound: true,
    resourceBound: true,
    paymentSatisfied: true,
    paymentSource: input.payment.paymentSource,
    releaseAuthorized: true,
    reason: 'release_authorized',
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: false,
  };
}
