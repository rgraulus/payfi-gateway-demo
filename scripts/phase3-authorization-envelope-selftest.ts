import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import { parseAuthorizationEnvelope } from '../src/phase3/authorizationEnvelope';

const baseInput: BuildX402ZkpChallengeInput = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'GET',
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
  nonce: 'phase3-envelope-nonce-001',
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

const challenge = buildX402ZkpChallenge(baseInput);
const challengeHash = hashX402ZkpChallenge(challenge);

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
  submittedAt: '2026-05-31T00:00:00.000Z',
};

const parsedDirect = parseAuthorizationEnvelope(directBuyerEnvelope);
assert.equal(parsedDirect.ok, true);
assert.equal(parsedDirect.type, 'xcf.concordium.authorization.direct-buyer.v1');
assert.equal(parsedDirect.challengeHash, challengeHash);
assert.equal(parsedDirect.expectedChallengeHash, challengeHash);
if (parsedDirect.envelope.type !== 'xcf.concordium.authorization.direct-buyer.v1') {
  throw new Error('expected direct Buyer envelope');
}
assert.equal(parsedDirect.envelope.walletChallenge, challengeHash);

const delegatedEnvelope = {
  type: 'xcf.concordium.authorization.delegated-agent.v1',
  challenge,
  challengeHash,
  buyerProof: {
    proofType: 'concordium.VerifiablePresentation',
    presentation: {
      placeholder: true,
      rawProofPrinted: false,
    },
  },
  agentAuthorization: {
    agentSubjectRef: 'did:ccd:agent-placeholder',
    agentAccountId: 'agent-account-placeholder',
    agentAccountAddress: 'ccd1qagentplaceholder',
    delegationId: 'delegation-demo-001',
    delegationScopeHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    delegationExpiresAt: 1779291173,
    agentSignature: 'agent-signature-placeholder',
  },
  agentRegistryRef: 'cis8004:placeholder',
  cis8004TokenRef: 'cis2:placeholder:token:1',
  cis8ExternalKeyRef: 'cis8:placeholder:key:1',
  agentCardHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  siwxSessionRef: 'siwx-session-placeholder',
  submittedAt: '2026-05-31T00:00:00.000Z',
};

const parsedDelegated = parseAuthorizationEnvelope(delegatedEnvelope);
assert.equal(parsedDelegated.ok, true);
assert.equal(parsedDelegated.type, 'xcf.concordium.authorization.delegated-agent.v1');
assert.equal(parsedDelegated.challengeHash, challengeHash);
assert.equal(parsedDelegated.expectedChallengeHash, challengeHash);

assert.throws(
  () =>
    parseAuthorizationEnvelope({
      ...directBuyerEnvelope,
      challengeHash: '0'.repeat(64),
    }),
  /challengeHash does not match canonical challenge hash/,
);

assert.throws(
  () =>
    parseAuthorizationEnvelope({
      ...directBuyerEnvelope,
      type: 'unsupported.envelope.v1',
    }),
  /unsupported envelope type/,
);

assert.throws(
  () =>
    parseAuthorizationEnvelope({
      ...directBuyerEnvelope,
      presentation: null,
    }),
  /presentation is required/,
);

assert.throws(
  () =>
    parseAuthorizationEnvelope({
      ...delegatedEnvelope,
      buyerProof: {
        proofType: 'concordium.VerifiablePresentation',
        presentation: null,
      },
    }),
  /buyerProof.presentation is required/,
);

assert.throws(
  () =>
    parseAuthorizationEnvelope({
      ...delegatedEnvelope,
      agentAuthorization: null,
    }),
  /agentAuthorization must be an object/,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      directBuyerType: parsedDirect.type,
      delegatedAgentType: parsedDelegated.type,
      challengeHash,
      agentRegistryHooksPresent: {
        agentRegistryRef: parsedDelegated.envelope.type === 'xcf.concordium.authorization.delegated-agent.v1'
          ? parsedDelegated.envelope.agentRegistryRef !== null
          : false,
        cis8004TokenRef: parsedDelegated.envelope.type === 'xcf.concordium.authorization.delegated-agent.v1'
          ? parsedDelegated.envelope.cis8004TokenRef !== null
          : false,
        cis8ExternalKeyRef: parsedDelegated.envelope.type === 'xcf.concordium.authorization.delegated-agent.v1'
          ? parsedDelegated.envelope.cis8ExternalKeyRef !== null
          : false,
        agentCardHash: parsedDelegated.envelope.type === 'xcf.concordium.authorization.delegated-agent.v1'
          ? parsedDelegated.envelope.agentCardHash !== null
          : false,
      },
      rawProofPrinted: false,
    },
    null,
    2,
  ),
);
