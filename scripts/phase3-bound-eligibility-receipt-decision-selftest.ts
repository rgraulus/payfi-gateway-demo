import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import type {
  Phase3DemoContractBindingSnapshot,
} from '../src/phase3/demoChallengeBinding';
import {
  liveVerifyDirectBuyerEnvelopeWithDeps,
  type LiveZkpSdkInvocationDeps,
} from '../src/phase3/liveZkpVerifierAdapter';
import {
  buildModelAEligibilityResult,
} from '../src/phase3/modelAEligibility';
import {
  bindModelAEligibilityToChallengeContext,
} from '../src/phase3/modelAEligibilityBinding';
import {
  buildPhase3GatewayReleaseDecision,
} from '../src/phase3/gatewayReleaseDecisionAdapter';
import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptBindingContext,
  type X402ReceiptPaymentSignal,
} from '../src/phase3/x402ReceiptPaymentSignal';

const input: BuildX402ZkpChallengeInput = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'GET',
    path: '/paid-gated',
  },
  contract: {
    contractId: 'cid_demo_phase3_bound_eligibility_receipt_decision',
    contractVersion: '1.0.0',
    isFrozen: true,
  },
  network: 'concordium:testnet',
  chain_id: 'ccd:testnet-genesis-hash-placeholder',
  caip2ChainId: null,
  asset: {
    type: 'PLT',
    tokenId: 'EUDemo',
    decimals: 6,
  },
  amount: '0.050101',
  amountMinor: '50101',
  payTo: 'ccd1qmerchantplaceholder',
  nonce: 'phase3-bound-eligibility-receipt-decision-nonce-001',
  issuedAt: 1779289373,
  expiresAt: 1779291173,
  policy: {
    policyId: 'age-region-v1',
    policyVersion: '1.0.0',
    requirementsHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  businessTerms: {
    termsId: null,
    termsVersion: null,
    termsHash: null,
  },
};

const challenge = buildX402ZkpChallenge(input);
const challengeHash = hashX402ZkpChallenge(challenge);

const contract: Phase3DemoContractBindingSnapshot = {
  merchantId: input.merchantId,
  resource: {
    method: input.resource.method,
    path: input.resource.path,
  },
  contractId: input.contract.contractId,
  contractVersion: input.contract.contractVersion,
  isFrozen: input.contract.isFrozen,
  network: input.network,
  chain_id: input.chain_id,
  asset: {
    ...input.asset,
  },
  amount: input.amount,
  payTo: input.payTo,
};

const expectedReceiptContext: X402ReceiptBindingContext = {
  nonce: input.nonce,
  resource: {
    method: input.resource.method,
    path: input.resource.path,
  },
  contract: {
    contractId: input.contract.contractId,
    contractVersion: input.contract.contractVersion,
    merchantId: input.merchantId,
  },
  network: input.network,
  asset: {
    ...input.asset,
  },
  amount: input.amount,
  payTo: input.payTo,
};

const directBuyerEnvelope = {
  type: 'xcf.concordium.authorization.direct-buyer.v1',
  challenge,
  challengeHash,
  proofType: 'concordium.VerifiablePresentation',
  presentation: {
    placeholder: true,
    rawProofPrinted: false,
  },
  walletChallenge: challengeHash,
  wallet: {
    network: 'testnet',
    selectedChain: 'ccd:testnet-genesis-hash-placeholder',
    accountAddress: 'ccd1qbuyerplaceholder',
  },
  submittedAt: '2026-06-06T00:00:00.000Z',
};

function makeFakeLiveZkpDeps(input: {
  verifiedChallenge: string;
  verifiedRequest: Record<string, unknown>;
}): LiveZkpSdkInvocationDeps {
  return {
    createGrpcClient() {
      return { fake: 'grpc' };
    },
    parsePresentation(parseInput) {
      return { parsedPresentation: parseInput.presentation };
    },
    async getPublicData() {
      return [{ inputs: { credential: 1 } }];
    },
    async getCryptographicParameters() {
      return { fake: 'params' };
    },
    verifyPresentation() {
      return {
        ...input.verifiedRequest,
        challenge: input.verifiedChallenge,
      };
    },
  };
}

function receiptSignal(input: {
  ok?: boolean;
  receiptVerified?: boolean;
  settlementStatus?: X402ReceiptPaymentSignal['settlementStatus'];
  receiptExpired?: boolean;
  context?: X402ReceiptBindingContext;
} = {}): X402ReceiptPaymentSignal {
  return {
    ok: input.ok ?? true,
    source: 'x402-receipt',
    receiptVerified: input.receiptVerified ?? true,
    settlementStatus: input.settlementStatus ?? 'finalized',
    receiptExpired: input.receiptExpired ?? false,
    context: input.context ?? expectedReceiptContext,
    rawReceiptPrinted: false,
  };
}

function assertNoSideEffects(decision: ReturnType<typeof buildPhase3GatewayReleaseDecision>): void {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

async function buildLiveBoundEligibility() {
  const verifierResult = await liveVerifyDirectBuyerEnvelopeWithDeps(
    directBuyerEnvelope as any,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    makeFakeLiveZkpDeps({
      verifiedChallenge: challengeHash,
      verifiedRequest: {
        credentialStatements: [{ statement: 'age-region-v1' }],
      },
    }),
  );

  assert.equal(verifierResult.ok, true);
  assert.equal(verifierResult.stage, 'verified');
  assert.equal(verifierResult.walletChallenge, challengeHash);
  assert.equal(verifierResult.verifiedChallenge, challengeHash);
  assert.equal(verifierResult.challengeBinding, 'walletChallenge');
  assert.deepEqual(verifierResult.verifiedRequestKeys, ['challenge', 'credentialStatements']);
  assert.equal(verifierResult.rawProofPrinted, false);

  const eligibility = buildModelAEligibilityResult({
    verifierResult,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.eligibilityVerified, true);
  assert.equal(eligibility.challengeVerified, true);
  assert.equal(eligibility.credentialStatementsVerified, true);
  assert.equal(eligibility.releaseAuthorized, false);
  assert.equal(eligibility.paymentResponseEmitted, false);
  assert.equal(eligibility.rawProofPrinted, false);

  const boundEligibility = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: input.nonce,
    challenge,
    contract,
  });

  assert.equal(boundEligibility.ok, true);
  assert.equal(boundEligibility.eligibilityVerified, true);
  assert.equal(boundEligibility.challengeBound, true);
  assert.equal(boundEligibility.resourceBound, true);
  assert.equal(boundEligibility.releaseAuthorized, false);
  assert.equal(boundEligibility.paymentResponseEmitted, false);
  assert.equal(boundEligibility.rawProofPrinted, false);

  return boundEligibility;
}

function decisionFor(input: {
  boundEligibility: Awaited<ReturnType<typeof buildLiveBoundEligibility>>;
  receipt: X402ReceiptPaymentSignal;
}) {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: input.receipt,
    expectedContext: expectedReceiptContext,
  });

  return buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });
}

async function main() {
  const boundEligibility = await buildLiveBoundEligibility();

  const finalizedReceiptDecision = decisionFor({
    boundEligibility,
    receipt: receiptSignal(),
  });

  assert.equal(finalizedReceiptDecision.ok, true);
  assert.equal(finalizedReceiptDecision.releaseAuthorized, true);
  assert.equal(finalizedReceiptDecision.reason, 'release_authorized');
  assert.equal(finalizedReceiptDecision.eligibilityVerified, true);
  assert.equal(finalizedReceiptDecision.challengeBound, true);
  assert.equal(finalizedReceiptDecision.resourceBound, true);
  assert.equal(finalizedReceiptDecision.paymentSatisfied, true);
  assert.equal(finalizedReceiptDecision.paymentSource, 'x402-receipt');
  assert.equal(finalizedReceiptDecision.receiptSignalAccepted, true);
  assert.equal(finalizedReceiptDecision.receiptVerified, true);
  assert.equal(finalizedReceiptDecision.settlementStatus, 'finalized');
  assert.equal(finalizedReceiptDecision.receiptExpired, false);
  assert.equal(finalizedReceiptDecision.paymentResponseAllowed, true);
  assert.equal(finalizedReceiptDecision.resourceReleaseAllowed, true);
  assertNoSideEffects(finalizedReceiptDecision);

  const wrongNonceReceiptDecision = decisionFor({
    boundEligibility,
    receipt: receiptSignal({
      context: {
        ...expectedReceiptContext,
        nonce: 'wrong-receipt-nonce',
      },
    }),
  });

  assert.equal(wrongNonceReceiptDecision.ok, false);
  assert.equal(wrongNonceReceiptDecision.releaseAuthorized, false);
  assert.equal(wrongNonceReceiptDecision.reason, 'receipt_context_mismatch');
  assert.equal(wrongNonceReceiptDecision.paymentSatisfied, false);
  assert.equal(wrongNonceReceiptDecision.receiptSignalAccepted, false);
  assert.equal(wrongNonceReceiptDecision.receiptVerified, true);
  assert.equal(wrongNonceReceiptDecision.settlementStatus, 'finalized');
  assert.equal(wrongNonceReceiptDecision.receiptExpired, false);
  assert.equal(wrongNonceReceiptDecision.receiptContextMatched, false);
  assert.equal(wrongNonceReceiptDecision.receiptContextMismatchField, 'nonce');
  assert.equal(wrongNonceReceiptDecision.paymentResponseAllowed, false);
  assert.equal(wrongNonceReceiptDecision.resourceReleaseAllowed, false);
  assertNoSideEffects(wrongNonceReceiptDecision);

  const pendingReceiptDecision = decisionFor({
    boundEligibility,
    receipt: receiptSignal({
      settlementStatus: 'pending',
    }),
  });

  assert.equal(pendingReceiptDecision.ok, false);
  assert.equal(pendingReceiptDecision.releaseAuthorized, false);
  assert.equal(pendingReceiptDecision.reason, 'settlement_not_finalized');
  assert.equal(pendingReceiptDecision.paymentSatisfied, false);
  assert.equal(pendingReceiptDecision.receiptSignalAccepted, false);
  assert.equal(pendingReceiptDecision.paymentResponseAllowed, false);
  assert.equal(pendingReceiptDecision.resourceReleaseAllowed, false);
  assertNoSideEffects(pendingReceiptDecision);

  const unverifiedReceiptDecision = decisionFor({
    boundEligibility,
    receipt: receiptSignal({
      ok: false,
      receiptVerified: false,
    }),
  });

  assert.equal(unverifiedReceiptDecision.ok, false);
  assert.equal(unverifiedReceiptDecision.releaseAuthorized, false);
  assert.equal(unverifiedReceiptDecision.reason, 'receipt_not_verified');
  assert.equal(unverifiedReceiptDecision.paymentSatisfied, false);
  assert.equal(unverifiedReceiptDecision.receiptSignalAccepted, false);
  assert.equal(unverifiedReceiptDecision.paymentResponseAllowed, false);
  assert.equal(unverifiedReceiptDecision.resourceReleaseAllowed, false);
  assertNoSideEffects(unverifiedReceiptDecision);

  const expiredReceiptDecision = decisionFor({
    boundEligibility,
    receipt: receiptSignal({
      receiptExpired: true,
    }),
  });

  assert.equal(expiredReceiptDecision.ok, false);
  assert.equal(expiredReceiptDecision.releaseAuthorized, false);
  assert.equal(expiredReceiptDecision.reason, 'receipt_expired');
  assert.equal(expiredReceiptDecision.paymentSatisfied, false);
  assert.equal(expiredReceiptDecision.receiptSignalAccepted, false);
  assert.equal(expiredReceiptDecision.paymentResponseAllowed, false);
  assert.equal(expiredReceiptDecision.resourceReleaseAllowed, false);
  assertNoSideEffects(expiredReceiptDecision);

  const unboundEligibility = {
    ...boundEligibility,
    ok: false,
    challengeBound: false,
    resourceBound: false,
    bindingCode: 'policy_binding_mismatch' as const,
    bindingReason: 'simulated unbound eligibility for PR #134 decision guard',
  };

  const unboundFinalizedDecision = decisionFor({
    boundEligibility: unboundEligibility,
    receipt: receiptSignal(),
  });

  assert.equal(unboundFinalizedDecision.ok, false);
  assert.equal(unboundFinalizedDecision.releaseAuthorized, false);
  assert.equal(unboundFinalizedDecision.reason, 'eligibility_not_bound');
  assert.equal(unboundFinalizedDecision.paymentSatisfied, true);
  assert.equal(unboundFinalizedDecision.receiptSignalAccepted, true);
  assert.equal(unboundFinalizedDecision.paymentResponseAllowed, false);
  assert.equal(unboundFinalizedDecision.resourceReleaseAllowed, false);
  assertNoSideEffects(unboundFinalizedDecision);

  console.log(
    JSON.stringify(
      {
        ok: true,

        liveBoundEligibilityAccepted: boundEligibility.ok,
        eligibilityVerified: boundEligibility.eligibilityVerified,
        challengeBound: boundEligibility.challengeBound,
        resourceBound: boundEligibility.resourceBound,

        finalizedReceiptDecisionAuthorized: finalizedReceiptDecision.releaseAuthorized,
        finalizedReceiptPaymentResponseAllowed: finalizedReceiptDecision.paymentResponseAllowed,
        finalizedReceiptResourceReleaseAllowed: finalizedReceiptDecision.resourceReleaseAllowed,
        finalizedReceiptContextMatched: finalizedReceiptDecision.receiptContextMatched,

        wrongNonceReceiptRejected: wrongNonceReceiptDecision.reason,
        wrongNonceMismatchField: wrongNonceReceiptDecision.receiptContextMismatchField,
        wrongNonceReceiptPaymentResponseAllowed: wrongNonceReceiptDecision.paymentResponseAllowed,
        wrongNonceReceiptResourceReleaseAllowed: wrongNonceReceiptDecision.resourceReleaseAllowed,

        pendingReceiptRejected: pendingReceiptDecision.reason,
        unverifiedReceiptRejected: unverifiedReceiptDecision.reason,
        expiredReceiptRejected: expiredReceiptDecision.reason,
        unboundEligibilityRejected: unboundFinalizedDecision.reason,

        releaseDecisionOnly: true,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        resourceReleased: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[phase3:bound-eligibility-receipt-decision-test] ERROR:', err?.stack || err?.message || err);
  process.exit(1);
});
