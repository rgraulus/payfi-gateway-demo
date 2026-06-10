import assert from "node:assert/strict";

import type {
  Phase3DemoContractBindingSnapshot,
} from "../src/phase3/demoChallengeBinding";
import {
  buildPhase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecision,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import {
  bindModelAEligibilityToChallengeContext,
  type ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptPaymentSignal,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  assertPhase3DecisionSafety,
  buildPhase3CapturedProofReceiptState,
  type Phase3CapturedProofReceiptState,
} from "./phase3-captured-proof-receipt-test-helpers";

export type Phase3CapturedProofGatewayDecision = {
  captureContract: Phase3CapturedProofReceiptState["captureContract"];
  safeMetadata: Phase3CapturedProofReceiptState["safeMetadata"];
  parsedOk: boolean;
  decision: Phase3GatewayReleaseDecision;
  boundEligibility: ModelAEligibilityBindingResult;
  fixtureChallenge: Record<string, unknown>;
  contract: Phase3DemoContractBindingSnapshot;
  nonce: string;
};

export function assertGatewayDecisionSafetyFlags(decision: Phase3GatewayReleaseDecision): void {
  assertPhase3DecisionSafety(decision);
}

export function acceptedReceiptPayment() {
  return buildX402ReceiptPaymentSatisfaction({
    receipt: {
      ok: true,
      source: "x402-receipt",
      receiptVerified: true,
      settlementStatus: "finalized",
      receiptExpired: false,
      rawReceiptPrinted: false,
    },
  });
}

export function receiptSignal(input: {
  ok?: boolean;
  receiptVerified?: boolean;
  settlementStatus?: X402ReceiptPaymentSignal["settlementStatus"];
  receiptExpired?: boolean;
} = {}): X402ReceiptPaymentSignal {
  return {
    ok: input.ok ?? true,
    source: "x402-receipt",
    receiptVerified: input.receiptVerified ?? true,
    settlementStatus: input.settlementStatus ?? "finalized",
    receiptExpired: input.receiptExpired ?? false,
    rawReceiptPrinted: false,
  };
}

export function decisionFor(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
}): Phase3GatewayReleaseDecision {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: input.receipt,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertGatewayDecisionSafetyFlags(decision);
  return decision;
}

export async function buildCapturedProofGatewayDecision(input: {
  source: string;
  badNonce: string;
  assertExtendedSafeMetadata?: boolean;
}): Promise<Phase3CapturedProofGatewayDecision> {
  const state = await buildPhase3CapturedProofReceiptState({
    source: input.source,
    badNonce: input.badNonce,
  });

  if (input.assertExtendedSafeMetadata) {
    assert.equal(state.safeMetadata.envelopeType, "xcf.concordium.authorization.direct-buyer.v1");
    assert.equal(state.safeMetadata.proofType, "concordium.VerifiablePresentation");
    assert.equal(state.safeMetadata.challengeHashPresent, true);
    assert.equal(state.safeMetadata.walletChallengePresent, true);
    assert.equal(state.safeMetadata.walletPresent, true);
    assert.equal(state.safeMetadata.walletNetworkPresent, true);
    assert.equal(state.safeMetadata.walletSelectedChainPresent, true);
    assert.equal(state.safeMetadata.walletAccountAddressPresent, true);
  }

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: state.boundEligibility,
    payment: acceptedReceiptPayment(),
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.model, "phase3-model-a");
  assert.equal(decision.releaseAuthorized, true);
  assert.equal(decision.reason, "release_authorized");
  assert.equal(decision.eligibilityVerified, true);
  assert.equal(decision.challengeBound, true);
  assert.equal(decision.resourceBound, true);
  assert.equal(decision.paymentSatisfied, true);
  assert.equal(decision.paymentSource, "x402-receipt");
  assert.equal(decision.receiptSignalAccepted, true);
  assert.equal(decision.receiptVerified, true);
  assert.equal(decision.settlementStatus, "finalized");
  assert.equal(decision.receiptExpired, false);
  assert.equal(decision.receiptContextMatched, true);
  assert.equal(decision.receiptContextMismatchField, null);
  assert.equal(decision.paymentResponseAllowed, true);
  assert.equal(decision.resourceReleaseAllowed, true);
  assertGatewayDecisionSafetyFlags(decision);

  return {
    captureContract: state.captureContract,
    safeMetadata: state.safeMetadata,
    parsedOk: state.parsedOk,
    decision,
    boundEligibility: state.boundEligibility,
    fixtureChallenge: state.fixtureChallenge,
    contract: state.contract,
    nonce: state.nonce,
  };
}

export function cloneChallenge(challenge: Record<string, unknown>): any {
  return JSON.parse(JSON.stringify(challenge));
}

export function buildBindingNegative(input: {
  label: string;
  challenge: Record<string, unknown>;
  contract: Phase3DemoContractBindingSnapshot;
  nonce: string;
  mutate: (challenge: any) => void;
}) {
  const badChallenge = cloneChallenge(input.challenge);
  input.mutate(badChallenge);

  const rebound = bindModelAEligibilityToChallengeContext({
    eligibility: {
      ok: true,
      model: "phase3-model-a",
      proofVerified: true,
      eligibilityVerified: true,
      challengeVerified: true,
      credentialStatementsVerified: true,
      accountBindingStatus: "present",
      verifierStage: "verified",
      releaseAuthorized: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      replayTouched: false,
      rawProofPrinted: false,
    },
    nonce: input.nonce,
    challenge: badChallenge,
    contract: input.contract,
  });

  assert.equal(rebound.ok, false, input.label);
  assert.equal(rebound.bindingCode, "policy_binding_mismatch", input.label);
  assert.equal(rebound.eligibilityVerified, true, input.label);
  assert.equal(rebound.challengeBound, false, input.label);
  assert.equal(rebound.resourceBound, false, input.label);
  assert.equal(rebound.releaseAuthorized, false, input.label);
  assert.equal(rebound.paymentReleaseAttempted, false, input.label);
  assert.equal(rebound.paymentResponseEmitted, false, input.label);
  assert.equal(rebound.crpCalled, false, input.label);
  assert.equal(rebound.replayTouched, false, input.label);
  assert.equal(rebound.rawProofPrinted, false, input.label);

  const decision = decisionFor({
    boundEligibility: rebound,
    receipt: receiptSignal(),
  });

  assert.equal(decision.ok, false, input.label);
  assert.equal(decision.releaseAuthorized, false, input.label);
  assert.equal(decision.reason, "eligibility_not_bound", input.label);
  assert.equal(decision.paymentResponseAllowed, false, input.label);
  assert.equal(decision.resourceReleaseAllowed, false, input.label);
  assertGatewayDecisionSafetyFlags(decision);

  return {
    label: input.label,
    bindingOk: rebound.ok,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
  };
}

export function buildReceiptNegative(input: {
  label: string;
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
  expectedReason: string;
}) {
  const decision = decisionFor({
    boundEligibility: input.boundEligibility,
    receipt: input.receipt,
  });

  assert.equal(decision.ok, false, input.label);
  assert.equal(decision.releaseAuthorized, false, input.label);
  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.paymentResponseAllowed, false, input.label);
  assert.equal(decision.resourceReleaseAllowed, false, input.label);
  assertGatewayDecisionSafetyFlags(decision);

  return {
    label: input.label,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
  };
}
