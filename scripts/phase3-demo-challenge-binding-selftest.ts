import assert from 'node:assert/strict';

import {
  validatePhase3DemoChallengeBinding,
  type Phase3DemoContractBindingSnapshot,
} from '../src/phase3/demoChallengeBinding';

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

function cloneChallenge(): any {
  return {
    ...baseChallenge,
    resource: { ...baseChallenge.resource },
    contract: { ...baseChallenge.contract },
    asset: { ...baseChallenge.asset },
  };
}

function expectBindingMismatch(label: string, mutate: (challenge: any) => void): void {
  const challenge = cloneChallenge();
  mutate(challenge);

  const result = validatePhase3DemoChallengeBinding({
    nonce,
    challenge,
    contract,
  });

  assert.equal(result.ok, false, `${label} should fail`);
  assert.equal(result.code, 'policy_binding_mismatch', `${label} should return policy_binding_mismatch`);
}

const valid = validatePhase3DemoChallengeBinding({
  nonce,
  challenge: cloneChallenge(),
  contract,
});

assert.equal(valid.ok, true);

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

expectBindingMismatch('wrong contractVersion', (challenge) => {
  challenge.contract.contractVersion = '9.9.9';
});

expectBindingMismatch('wrong frozen flag', (challenge) => {
  challenge.contract.isFrozen = false;
});

expectBindingMismatch('wrong network', (challenge) => {
  challenge.network = 'concordium:mainnet';
});

expectBindingMismatch('wrong chain_id', (challenge) => {
  challenge.chain_id = 'ccd:wrong-chain';
});

expectBindingMismatch('wrong asset type', (challenge) => {
  challenge.asset.type = 'CIS2';
});

expectBindingMismatch('wrong tokenId', (challenge) => {
  challenge.asset.tokenId = 'OtherToken';
});

expectBindingMismatch('wrong decimals', (challenge) => {
  challenge.asset.decimals = 8;
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
      bindingMismatchesRejected: [
        'wrong nonce',
        'wrong resource method',
        'wrong resource path',
        'wrong contractId',
        'wrong contractVersion',
        'wrong frozen flag',
        'wrong network',
        'wrong chain_id',
        'wrong asset type',
        'wrong tokenId',
        'wrong decimals',
        'wrong amount',
        'wrong payTo',
      ],
      rawProofPrinted: false,
    },
    null,
    2,
  ),
);
