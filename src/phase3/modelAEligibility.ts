import type {
  ConcordiumZkpVerifierResult,
} from './concordiumZkpVerifier';

export type Phase3AccountBindingStatus =
  | 'present'
  | 'wallet_api_missing'
  | 'not_provided';

export type ModelAEligibilityResult = {
  ok: boolean;
  model: 'phase3-model-a';
  proofVerified: boolean;
  eligibilityVerified: boolean;
  challengeVerified: boolean;
  credentialStatementsVerified: boolean;
  accountBindingStatus: Phase3AccountBindingStatus;
  verifierStage: ConcordiumZkpVerifierResult['stage'];
  verifierReason?: string;
  releaseAuthorized: false;
  paymentReleaseAttempted: false;
  paymentResponseEmitted: false;
  crpCalled: false;
  replayTouched: false;
  rawProofPrinted: false;
};

function verifiedRequestHas(result: ConcordiumZkpVerifierResult, key: string): boolean {
  return Array.isArray(result.verifiedRequestKeys) && result.verifiedRequestKeys.includes(key);
}

export function buildModelAEligibilityResult(input: {
  verifierResult: ConcordiumZkpVerifierResult;
  accountBindingStatus: Phase3AccountBindingStatus;
}): ModelAEligibilityResult {
  const proofVerified = input.verifierResult.ok === true && input.verifierResult.stage === 'verified';
  const challengeVerified = proofVerified && verifiedRequestHas(input.verifierResult, 'challenge');
  const credentialStatementsVerified =
    proofVerified && verifiedRequestHas(input.verifierResult, 'credentialStatements');

  const eligibilityVerified = proofVerified && challengeVerified && credentialStatementsVerified;

  return {
    ok: eligibilityVerified,
    model: 'phase3-model-a',
    proofVerified,
    eligibilityVerified,
    challengeVerified,
    credentialStatementsVerified,
    accountBindingStatus: input.accountBindingStatus,
    verifierStage: input.verifierResult.stage,
    verifierReason: input.verifierResult.reason,
    releaseAuthorized: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: false,
  };
}
