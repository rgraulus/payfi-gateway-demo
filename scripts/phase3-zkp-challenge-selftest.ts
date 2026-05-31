import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  canonicalizeX402ZkpChallenge,
  deriveWalletChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';

const baseInput: BuildX402ZkpChallengeInput = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'get',
    path: '/paid-gated',
  },
  contract: {
    contractId: 'cid_demo_phase3',
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
  nonce: 'phase3-nonce-001',
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

function cloneWith(patch: Partial<BuildX402ZkpChallengeInput>): BuildX402ZkpChallengeInput {
  return {
    ...baseInput,
    resource: { ...baseInput.resource },
    contract: { ...baseInput.contract },
    asset: { ...baseInput.asset },
    policy: { ...baseInput.policy },
    businessTerms: { ...baseInput.businessTerms },
    ...patch,
  };
}

function hashOf(input: BuildX402ZkpChallengeInput): string {
  return hashX402ZkpChallenge(buildX402ZkpChallenge(input));
}

function expectHashChange(label: string, input: BuildX402ZkpChallengeInput): void {
  const baseHash = hashOf(baseInput);
  const changedHash = hashOf(input);
  assert.notEqual(changedHash, baseHash, label);
}

const challengeA = buildX402ZkpChallenge(baseInput);
const challengeB = buildX402ZkpChallenge(baseInput);

assert.equal(challengeA.resource.method, 'GET');
assert.equal(canonicalizeX402ZkpChallenge(challengeA), canonicalizeX402ZkpChallenge(challengeB));
assert.equal(hashX402ZkpChallenge(challengeA), hashX402ZkpChallenge(challengeB));
assert.equal(deriveWalletChallenge(challengeA), hashX402ZkpChallenge(challengeA));
assert.match(hashX402ZkpChallenge(challengeA), /^[0-9a-f]{64}$/);

expectHashChange('nonce must affect challenge hash', cloneWith({ nonce: 'phase3-nonce-002' }));
expectHashChange('merchantId must affect challenge hash', cloneWith({ merchantId: 'other-merchant' }));
expectHashChange('resource method must affect challenge hash', cloneWith({ resource: { ...baseInput.resource, method: 'POST' } }));
expectHashChange('resource path must affect challenge hash', cloneWith({ resource: { ...baseInput.resource, path: '/other' } }));
expectHashChange('contractId must affect challenge hash', cloneWith({ contract: { ...baseInput.contract, contractId: 'cid_other' } }));
expectHashChange('amountMinor must affect challenge hash', cloneWith({ amountMinor: '50102' }));
expectHashChange('asset tokenId must affect challenge hash', cloneWith({ asset: { ...baseInput.asset, tokenId: 'OtherToken' } }));
expectHashChange('payTo must affect challenge hash', cloneWith({ payTo: 'ccd1qothermerchantplaceholder' }));
expectHashChange('chain_id must affect challenge hash', cloneWith({ chain_id: 'ccd:other-chain' }));
expectHashChange(
  'policy requirementsHash must affect challenge hash',
  cloneWith({
    policy: {
      ...baseInput.policy,
      requirementsHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  }),
);
expectHashChange(
  'businessTerms termsHash must affect challenge hash',
  cloneWith({
    businessTerms: {
      termsId: 'terms-demo',
      termsVersion: '1.0.0',
      termsHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
  }),
);

const withAgentRegistry = buildX402ZkpChallenge({
  ...baseInput,
  agent: {
    agentSubjectRef: 'did:ccd:agent-placeholder',
    agentAccountAddress: 'ccd1qagentplaceholder',
    delegationId: 'delegation-demo-001',
    delegationScopeHash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    delegationExpiresAt: 1779291173,
    delegationNonce: 'agent-delegation-nonce-001',
    agentSessionId: 'agent-session-001',
    registry: {
      registryStandard: 'CIS-8004',
      agentDid: 'did:ccd:agent-placeholder',
      agentRegistryRef: 'cis8004:placeholder',
      cis8004TokenRef: 'cis2:placeholder:token:1',
      cis8ExternalKeyRef: 'cis8:placeholder:key:1',
      agentCardHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      agentCardUri: 'https://example.invalid/agent-card.json',
    },
  },
});

assert.equal(withAgentRegistry.agent?.registry?.registryStandard, 'CIS-8004');
assert.match(hashX402ZkpChallenge(withAgentRegistry), /^[0-9a-f]{64}$/);
assert.notEqual(hashX402ZkpChallenge(withAgentRegistry), hashX402ZkpChallenge(challengeA));

assert.throws(
  () =>
    buildX402ZkpChallenge({
      ...baseInput,
      expiresAt: baseInput.issuedAt,
    }),
  /expiresAt must be greater than issuedAt/,
);

assert.throws(
  () =>
    canonicalizeX402ZkpChallenge({
      ok: true,
      bad: undefined,
    }),
  /undefined is not allowed/,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      baseHash: hashX402ZkpChallenge(challengeA),
      agentRegistryHookHash: hashX402ZkpChallenge(withAgentRegistry),
      rawProofPrinted: false,
    },
    null,
    2,
  ),
);
