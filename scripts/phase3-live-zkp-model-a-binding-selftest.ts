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

const input: BuildX402ZkpChallengeInput = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'GET',
    path: '/paid-gated',
  },
  contract: {
    contractId: 'cid_demo_phase3_live_model_a_binding',
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
  nonce: 'phase3-live-model-a-binding-nonce-001',
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

function assertEligibilitySafetyFlags(result: ReturnType<typeof buildModelAEligibilityResult>): void {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function assertBindingSafetyFlags(result: ReturnType<typeof bindModelAEligibilityToChallengeContext>): void {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

async function verifyWithDeps(input: {
  verifiedChallenge: string;
  verifiedRequest: Record<string, unknown>;
}) {
  return liveVerifyDirectBuyerEnvelopeWithDeps(
    directBuyerEnvelope as any,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    makeFakeLiveZkpDeps(input),
  );
}

async function main() {
  const liveVerified = await verifyWithDeps({
    verifiedChallenge: challengeHash,
    verifiedRequest: {
      credentialStatements: [{ statement: 'age-region-v1' }],
    },
  });

  assert.equal(liveVerified.ok, true);
  assert.equal(liveVerified.stage, 'verified');
  assert.equal(liveVerified.walletChallenge, challengeHash);
  assert.equal(liveVerified.verifiedChallenge, challengeHash);
  assert.equal(liveVerified.challengeBinding, 'walletChallenge');
  assert.deepEqual(liveVerified.verifiedRequestKeys, ['challenge', 'credentialStatements']);
  assert.equal(liveVerified.rawProofPrinted, false);

  const eligibility = buildModelAEligibilityResult({
    verifierResult: liveVerified,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.proofVerified, true);
  assert.equal(eligibility.eligibilityVerified, true);
  assert.equal(eligibility.challengeVerified, true);
  assert.equal(eligibility.credentialStatementsVerified, true);
  assert.equal(eligibility.verifierStage, 'verified');
  assertEligibilitySafetyFlags(eligibility);

  const bound = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: input.nonce,
    challenge,
    contract,
  });

  assert.equal(bound.ok, true);
  assert.equal(bound.eligibilityVerified, true);
  assert.equal(bound.challengeBound, true);
  assert.equal(bound.resourceBound, true);
  assertBindingSafetyFlags(bound);

  const missingCredentialStatementsLiveVerified = await verifyWithDeps({
    verifiedChallenge: challengeHash,
    verifiedRequest: {
      proofOk: true,
    },
  });

  assert.equal(missingCredentialStatementsLiveVerified.ok, true);
  assert.equal(missingCredentialStatementsLiveVerified.stage, 'verified');
  assert.deepEqual(missingCredentialStatementsLiveVerified.verifiedRequestKeys, ['challenge', 'proofOk']);

  const missingCredentialEligibility = buildModelAEligibilityResult({
    verifierResult: missingCredentialStatementsLiveVerified,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(missingCredentialEligibility.ok, false);
  assert.equal(missingCredentialEligibility.proofVerified, true);
  assert.equal(missingCredentialEligibility.challengeVerified, true);
  assert.equal(missingCredentialEligibility.credentialStatementsVerified, false);
  assert.equal(missingCredentialEligibility.eligibilityVerified, false);
  assertEligibilitySafetyFlags(missingCredentialEligibility);

  const missingCredentialBinding = bindModelAEligibilityToChallengeContext({
    eligibility: missingCredentialEligibility,
    nonce: input.nonce,
    challenge,
    contract,
  });

  assert.equal(missingCredentialBinding.ok, false);
  assert.equal(missingCredentialBinding.bindingCode, 'eligibility_not_verified');
  assert.equal(missingCredentialBinding.challengeBound, false);
  assert.equal(missingCredentialBinding.resourceBound, false);
  assertBindingSafetyFlags(missingCredentialBinding);

  const challengeMismatch = await verifyWithDeps({
    verifiedChallenge: 'wrong-wallet-challenge',
    verifiedRequest: {
      credentialStatements: [{ statement: 'age-region-v1' }],
    },
  });

  assert.equal(challengeMismatch.ok, false);
  assert.equal(challengeMismatch.stage, 'verification_failed');
  assert.equal(challengeMismatch.verifiedChallenge, 'wrong-wallet-challenge');
  assert.equal(
    challengeMismatch.reason,
    'verified request challenge does not match expected wallet challenge binding',
  );
  assert.equal(challengeMismatch.rawProofPrinted, false);

  const challengeMismatchEligibility = buildModelAEligibilityResult({
    verifierResult: challengeMismatch,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(challengeMismatchEligibility.ok, false);
  assert.equal(challengeMismatchEligibility.eligibilityVerified, false);
  assertEligibilitySafetyFlags(challengeMismatchEligibility);

  const wrongNonceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: 'wrong-nonce',
    challenge,
    contract,
  });

  assert.equal(wrongNonceBinding.ok, false);
  assert.equal(wrongNonceBinding.bindingCode, 'policy_binding_mismatch');
  assert.equal(wrongNonceBinding.challengeBound, false);
  assert.equal(wrongNonceBinding.resourceBound, false);
  assertBindingSafetyFlags(wrongNonceBinding);

  const wrongResourceChallenge = {
    ...challenge,
    resource: {
      ...challenge.resource,
      path: '/paid',
    },
  };

  const wrongResourceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: input.nonce,
    challenge: wrongResourceChallenge,
    contract,
  });

  assert.equal(wrongResourceBinding.ok, false);
  assert.equal(wrongResourceBinding.bindingCode, 'policy_binding_mismatch');
  assert.equal(wrongResourceBinding.challengeBound, false);
  assert.equal(wrongResourceBinding.resourceBound, false);
  assertBindingSafetyFlags(wrongResourceBinding);

  console.log(
    JSON.stringify(
      {
        ok: true,
        liveVerifiedProofAcceptedByModelA: eligibility.ok,
        liveVerifiedEligibilityBound: bound.ok,
        verifierStage: eligibility.verifierStage,
        challengeBinding: liveVerified.challengeBinding,
        credentialStatementsVerified: eligibility.credentialStatementsVerified,
        missingCredentialStatementsRejected: missingCredentialBinding.bindingCode,
        challengeMismatchRejected: challengeMismatch.stage,
        wrongNonceRejected: wrongNonceBinding.bindingCode,
        wrongResourceRejected: wrongResourceBinding.bindingCode,

        releaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
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
  console.error('[phase3:live-zkp-model-a-binding-test] ERROR:', err?.stack || err?.message || err);
  process.exit(1);
});
