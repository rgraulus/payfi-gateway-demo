import {
  type Phase3DemoChallengeBindingResult,
  type Phase3DemoContractBindingSnapshot,
  validatePhase3DemoChallengeBinding,
} from './demoChallengeBinding';
import type {
  ModelAEligibilityResult,
} from './modelAEligibility';

export type ModelAEligibilityBindingResult = {
  ok: boolean;
  model: 'phase3-model-a';
  eligibilityVerified: boolean;
  challengeBound: boolean;
  resourceBound: boolean;
  bindingCode?: 'eligibility_not_verified' | 'policy_binding_mismatch';
  bindingReason?: string;
  releaseAuthorized: false;
  paymentReleaseAttempted: false;
  paymentResponseEmitted: false;
  crpCalled: false;
  replayTouched: false;
  rawProofPrinted: false;
};

function failedClosed(input: {
  eligibility: ModelAEligibilityResult;
  bindingCode: 'eligibility_not_verified' | 'policy_binding_mismatch';
  bindingReason: string;
  challengeBound?: boolean;
  resourceBound?: boolean;
}): ModelAEligibilityBindingResult {
  return {
    ok: false,
    model: 'phase3-model-a',
    eligibilityVerified: input.eligibility.eligibilityVerified,
    challengeBound: input.challengeBound ?? false,
    resourceBound: input.resourceBound ?? false,
    bindingCode: input.bindingCode,
    bindingReason: input.bindingReason,
    releaseAuthorized: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: false,
  };
}

export function bindModelAEligibilityToChallengeContext(input: {
  eligibility: ModelAEligibilityResult;
  nonce: string;
  challenge: unknown;
  contract: Phase3DemoContractBindingSnapshot;
}): ModelAEligibilityBindingResult {
  if (!input.eligibility.eligibilityVerified) {
    return failedClosed({
      eligibility: input.eligibility,
      bindingCode: 'eligibility_not_verified',
      bindingReason: 'Model A eligibility must be verified before challenge/resource binding.',
    });
  }

  const binding: Phase3DemoChallengeBindingResult = validatePhase3DemoChallengeBinding({
    nonce: input.nonce,
    challenge: input.challenge,
    contract: input.contract,
  });

  if (!binding.ok) {
    return failedClosed({
      eligibility: input.eligibility,
      bindingCode: binding.code,
      bindingReason: binding.message,
    });
  }

  return {
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
}
