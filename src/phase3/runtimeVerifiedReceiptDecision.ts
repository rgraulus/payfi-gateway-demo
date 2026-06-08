import type { CcdPltProofV1 } from '../proofPayload';
import {
  buildPhase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecision,
} from './gatewayReleaseDecisionAdapter';
import type {
  ModelAEligibilityBindingResult,
} from './modelAEligibilityBinding';
import {
  buildX402ReceiptPaymentSatisfaction,
  buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1,
  type X402ReceiptBindingContext,
  type X402ReceiptPaymentSignalResult,
} from './x402ReceiptPaymentSignal';

export type Phase3RuntimeGatedAuthorizationReadiness =
  | {
      ok: true;
      status: 'POLICY_SATISFIED';
      challengeId?: string;
      releaseStatus?: string;
    }
  | {
      ok: false;
      reason: 'missing_canonical_challenge' | 'policy_not_satisfied';
      status?: string;
      challengeId?: string;
      releaseStatus?: string;
    };

export type Phase3RuntimeVerifiedReceiptDecision =
  | {
      ok: true;
      readinessOk: true;
      readinessStatus: 'POLICY_SATISFIED';
      decision: Phase3GatewayReleaseDecision;
      payment: X402ReceiptPaymentSignalResult;
      paymentResponseAllowed: boolean;
      resourceReleaseAllowed: boolean;
      productionRelease: false;
      paymentReleaseAttempted: false;
      paymentResponseEmitted: false;
      crpCalled: false;
      crpFulfillCalled: false;
      replayTouched: false;
      resourceReleased: false;
      canonicalReleasePersisted: false;
      rawProofPrinted: false;
      rawReceiptPrinted: false;
    }
  | {
      ok: false;
      readinessOk: true;
      readinessStatus: 'POLICY_SATISFIED';
      decision: Phase3GatewayReleaseDecision;
      payment: X402ReceiptPaymentSignalResult;
      paymentResponseAllowed: false;
      resourceReleaseAllowed: false;
      productionRelease: false;
      paymentReleaseAttempted: false;
      paymentResponseEmitted: false;
      crpCalled: false;
      crpFulfillCalled: false;
      replayTouched: false;
      resourceReleased: false;
      canonicalReleasePersisted: false;
      rawProofPrinted: false;
      rawReceiptPrinted: false;
    }
  | {
      ok: false;
      readinessOk: false;
      reason: 'missing_canonical_challenge' | 'policy_not_satisfied';
      readinessStatus?: string;
      challengeId?: string;
      releaseStatus?: string;
      paymentResponseAllowed: false;
      resourceReleaseAllowed: false;
      productionRelease: false;
      paymentReleaseAttempted: false;
      paymentResponseEmitted: false;
      crpCalled: false;
      crpFulfillCalled: false;
      replayTouched: false;
      resourceReleased: false;
      canonicalReleasePersisted: false;
      rawProofPrinted: false;
      rawReceiptPrinted: false;
    };

function boundEligibilityFromSatisfiedPolicy(): ModelAEligibilityBindingResult {
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

export function buildPhase3RuntimeVerifiedReceiptDecision(input: {
  readiness: Phase3RuntimeGatedAuthorizationReadiness;
  proof: CcdPltProofV1;
  nowSec: number;
  expectedContext: X402ReceiptBindingContext;
}): Phase3RuntimeVerifiedReceiptDecision {
  if (!input.readiness.ok) {
    return {
      ok: false,
      readinessOk: false,
      reason: input.readiness.reason,
      readinessStatus: input.readiness.status,
      challengeId: input.readiness.challengeId,
      releaseStatus: input.readiness.releaseStatus,
      paymentResponseAllowed: false,
      resourceReleaseAllowed: false,
      productionRelease: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      crpFulfillCalled: false,
      replayTouched: false,
      resourceReleased: false,
      canonicalReleasePersisted: false,
      rawProofPrinted: false,
      rawReceiptPrinted: false,
    };
  }

  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: input.nowSec,
  });

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt,
    expectedContext: input.expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: boundEligibilityFromSatisfiedPolicy(),
    payment,
  });

  if (decision.ok) {
    return {
      ok: true,
      readinessOk: true,
      readinessStatus: input.readiness.status,
      decision,
      payment,
      paymentResponseAllowed: decision.paymentResponseAllowed,
      resourceReleaseAllowed: decision.resourceReleaseAllowed,
      productionRelease: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      crpFulfillCalled: false,
      replayTouched: false,
      resourceReleased: false,
      canonicalReleasePersisted: false,
      rawProofPrinted: false,
      rawReceiptPrinted: false,
    };
  }

  return {
    ok: false,
    readinessOk: true,
    readinessStatus: input.readiness.status,
    decision,
    payment,
    paymentResponseAllowed: false,
    resourceReleaseAllowed: false,
    productionRelease: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    crpFulfillCalled: false,
    replayTouched: false,
    resourceReleased: false,
    canonicalReleasePersisted: false,
    rawProofPrinted: false,
    rawReceiptPrinted: false,
  };
}
