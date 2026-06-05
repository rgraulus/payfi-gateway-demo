import assert from 'node:assert/strict';

import type {
  Phase3DemoContractBindingSnapshot,
} from '../src/phase3/demoChallengeBinding';
import {
  bindModelAEligibilityToChallengeContext,
} from '../src/phase3/modelAEligibilityBinding';
import type {
  ModelAEligibilityResult,
} from '../src/phase3/modelAEligibility';

const contract: Phase3DemoContractBindingSnapshot = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'GET',
    path: '/paid-gated',
  },
  contractId: 'cid_demo_phase3_binding',
  contractVersion: '1.0.0',
  isFrozen: true,
  network: 'concordium:testnet',
  chain_id: 'ccd:testnet-genesis-hash-placeholder',
  asset: {
    type: 'PLT',
    tokenId: 'EUDemo',
    decimals: 6,
  },
  amount: '0.050101',
  payTo: 'ccd1qmerchantplaceholder',
};

const nonce = 'phase3-binding-nonce-001';

const baseChallenge = {
  merchantId: contract.merchantId,
  resource: {
    method: contract.resource.method,
    path: contract.resource.path,
  },
  contract: {
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    isFrozen: contract.isFrozen,
  },
  network: contract.network,
  chain_id: contract.chain_id,
  asset: {
    ...contract.asset,
  },
  amount: contract.amount,
  payTo: contract.payTo,
  nonce,
};

const verifiedEligibility: ModelAEligibilityResult = {
  ok: true,
  model: 'phase3-model-a',
  proofVerified: true,
  eligibilityVerified: true,
  challengeVerified: true,
  credentialStatementsVerified: true,
  accountBindingStatus: 'wallet_api_missing',
  verifierStage: 'verified',
  releaseAuthorized: false,
  paymentReleaseAttempted: false,
  paymentResponseEmitted: false,
  crpCalled: false,
  replayTouched: false,
  rawProofPrinted: false,
};

const unverifiedEligibility: ModelAEligibilityResult = {
  ...verifiedEligibility,
  ok: false,
  proofVerified: false,
  eligibilityVerified: false,
  challengeVerified: false,
  credentialStatementsVerified: false,
  verifierStage: 'verification_failed',
  verifierReason: 'simulated verifier failure',
};

function cloneChallenge(): any {
  return {
    ...baseChallenge,
    resource: { ...baseChallenge.resource },
    contract: { ...baseChallenge.contract },
    asset: { ...baseChallenge.asset },
  };
}

function assertSafetyFlags(result: ReturnType<typeof bindModelAEligibilityToChallengeContext>) {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function bind(challenge: unknown, eligibility = verifiedEligibility) {
  return bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce,
    challenge,
    contract,
  });
}

function expectBindingMismatch(label: string, mutate: (challenge: any) => void): void {
  const challenge = cloneChallenge();
  mutate(challenge);

  const result = bind(challenge);

  assert.equal(result.ok, false, `${label} should fail`);
  assert.equal(result.bindingCode, 'policy_binding_mismatch');
  assert.equal(result.eligibilityVerified, true);
  assert.equal(result.challengeBound, false);
  assert.equal(result.resourceBound, false);
  assertSafetyFlags(result);
}

function main() {
  const valid = bind(cloneChallenge());

  assert.equal(valid.ok, true);
  assert.equal(valid.model, 'phase3-model-a');
  assert.equal(valid.eligibilityVerified, true);
  assert.equal(valid.challengeBound, true);
  assert.equal(valid.resourceBound, true);
  assertSafetyFlags(valid);

  const unverified = bind(cloneChallenge(), unverifiedEligibility);

  assert.equal(unverified.ok, false);
  assert.equal(unverified.bindingCode, 'eligibility_not_verified');
  assert.equal(unverified.eligibilityVerified, false);
  assert.equal(unverified.challengeBound, false);
  assert.equal(unverified.resourceBound, false);
  assertSafetyFlags(unverified);

  expectBindingMismatch('wrong nonce', (challenge) => {
    challenge.nonce = 'wrong-nonce';
  });

  expectBindingMismatch('wrong resource method', (challenge) => {
    challenge.resource.method = 'POST';
  });

  expectBindingMismatch('wrong resource path', (challenge) => {
    challenge.resource.path = '/paid';
  });

  expectBindingMismatch('wrong contractId', (challenge) => {
    challenge.contract.contractId = 'cid_wrong';
  });

  expectBindingMismatch('wrong network', (challenge) => {
    challenge.network = 'concordium:mainnet';
  });

  expectBindingMismatch('wrong amount', (challenge) => {
    challenge.amount = '0.050102';
  });

  expectBindingMismatch('wrong payTo', (challenge) => {
    challenge.payTo = 'ccd1qothermerchantplaceholder';
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        validBindingAccepted: valid.ok,
        unverifiedEligibilityRejected: unverified.ok === false,
        bindingMismatchesRejected: [
          'wrong nonce',
          'wrong resource method',
          'wrong resource path',
          'wrong contractId',
          'wrong network',
          'wrong amount',
          'wrong payTo',
        ],
        releaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        replayTouched: false,
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
}

main();
