import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import { verifyConcordiumZkpAuthorizationEnvelope } from '../src/phase3/concordiumZkpVerifier';

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
  nonce: 'phase3-verifier-nonce-001',
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
  wallet: {
    network: 'testnet',
    selectedChain: 'ccd:testnet-genesis-hash-placeholder',
    accountAddress: 'ccd1qbuyerplaceholder',
  },
  submittedAt: '2026-05-31T00:00:00.000Z',
};

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

async function main() {
  const parsedOnly = await verifyConcordiumZkpAuthorizationEnvelope(directBuyerEnvelope);

  assert.equal(parsedOnly.ok, true);
  assert.equal(parsedOnly.stage, 'parsed');
  assert.equal(parsedOnly.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(parsedOnly.challengeHash, challengeHash);
  assert.equal(parsedOnly.expectedChallengeHash, challengeHash);
  assert.equal(parsedOnly.proofType, 'concordium.VerifiablePresentation');
  assert.equal(parsedOnly.delegatedAgentVerificationSupported, false);
  assert.equal(parsedOnly.agentRegistryLookupAttempted, false);
  assert.equal(parsedOnly.rawProofPrinted, false);

  const unsupportedProofType = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    proofType: 'concordium.VerifiablePresentationV1',
  });

  assert.equal(unsupportedProofType.ok, false);
  assert.equal(unsupportedProofType.stage, 'unsupported_proof_type');
  assert.equal(unsupportedProofType.agentRegistryLookupAttempted, false);
  assert.equal(unsupportedProofType.rawProofPrinted, false);

  const delegated = await verifyConcordiumZkpAuthorizationEnvelope(delegatedEnvelope);

  assert.equal(delegated.ok, false);
  assert.equal(delegated.stage, 'delegated_not_supported');
  assert.equal(delegated.envelopeType, 'xcf.concordium.authorization.delegated-agent.v1');
  assert.equal(delegated.delegatedAgentVerificationSupported, false);
  assert.equal(delegated.agentRegistryLookupAttempted, false);
  assert.equal(delegated.rawProofPrinted, false);

  const badHash = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    challengeHash: '0'.repeat(64),
  });

  assert.equal(badHash.ok, false);
  assert.equal(badHash.stage, 'verification_failed');
  assert.match(String(badHash.reason), /challengeHash does not match canonical challenge hash/);

  const missingPresentation = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    presentation: null,
  });

  assert.equal(missingPresentation.ok, false);
  assert.equal(missingPresentation.stage, 'verification_failed');
  assert.match(String(missingPresentation.reason), /presentation is required/);

  console.log(
    JSON.stringify(
      {
        ok: true,
        parsedOnlyStage: parsedOnly.stage,
        directBuyerEnvelopeType: parsedOnly.envelopeType,
        delegatedStage: delegated.stage,
        unsupportedProofTypeStage: unsupportedProofType.stage,
        badHashRejected: !badHash.ok,
        missingPresentationRejected: !missingPresentation.ok,
        agentRegistryLookupAttempted: parsedOnly.agentRegistryLookupAttempted,
        delegatedAgentVerificationSupported: parsedOnly.delegatedAgentVerificationSupported,
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
