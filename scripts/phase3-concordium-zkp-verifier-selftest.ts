import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import {
  resolveConcordiumWalletChallengeBinding,
  verifyConcordiumZkpAuthorizationEnvelope,
} from '../src/phase3/concordiumZkpVerifier';
import { liveVerifyDirectBuyerEnvelope } from '../src/phase3/liveZkpVerifierAdapter';

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
  walletChallenge: challengeHash,
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
  assert.equal(parsedOnly.walletChallenge, challengeHash);
  assert.equal(parsedOnly.verifiedChallenge, null);
  assert.equal(parsedOnly.challengeBinding, 'not_checked');
  assert.equal(parsedOnly.delegatedAgentVerificationSupported, false);
  assert.equal(parsedOnly.agentRegistryLookupAttempted, false);
  assert.equal(parsedOnly.rawProofPrinted, false);

  const liveUnavailable = await verifyConcordiumZkpAuthorizationEnvelope(directBuyerEnvelope, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(liveUnavailable.ok, false);
  assert.equal(liveUnavailable.stage, 'verification_failed');
  assert.equal(liveUnavailable.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(liveUnavailable.proofType, 'concordium.VerifiablePresentation');
  assert.equal(liveUnavailable.grpcHost, '127.0.0.1');
  assert.equal(liveUnavailable.grpcPort, 1);
  assert.equal(liveUnavailable.network, 'testnet');
  assert.equal(liveUnavailable.walletChallenge, challengeHash);
  assert.equal(liveUnavailable.verifiedChallenge, null);
  assert.equal(liveUnavailable.challengeBinding, 'walletChallenge');
  assert.equal(liveUnavailable.delegatedAgentVerificationSupported, false);
  assert.equal(liveUnavailable.agentRegistryLookupAttempted, false);
  assert.equal(liveUnavailable.rawProofPrinted, false);

  const adapterNullEnvelope = await liveVerifyDirectBuyerEnvelope(null as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(adapterNullEnvelope.ok, false);
  assert.equal(adapterNullEnvelope.stage, 'verification_failed');
  assert.equal(adapterNullEnvelope.reason, 'live verifier input envelope must be an object');
  assert.equal(adapterNullEnvelope.challengeBinding, 'not_checked');
  assert.equal(adapterNullEnvelope.rawProofPrinted, false);

  const adapterMissingPresentation = await liveVerifyDirectBuyerEnvelope({
    ...directBuyerEnvelope,
    presentation: undefined,
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(adapterMissingPresentation.ok, false);
  assert.equal(adapterMissingPresentation.stage, 'verification_failed');
  assert.equal(adapterMissingPresentation.reason, 'live verifier input presentation is required');
  assert.equal(adapterMissingPresentation.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(adapterMissingPresentation.proofType, 'concordium.VerifiablePresentation');
  assert.equal(adapterMissingPresentation.walletChallenge, challengeHash);
  assert.equal(adapterMissingPresentation.rawProofPrinted, false);

  const adapterMalformedPresentation = await liveVerifyDirectBuyerEnvelope({
    ...directBuyerEnvelope,
    presentation: 123,
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(adapterMalformedPresentation.ok, false);
  assert.equal(adapterMalformedPresentation.stage, 'verification_failed');
  assert.equal(adapterMalformedPresentation.reason, 'live verifier input presentation must be an object or string');
  assert.equal(adapterMalformedPresentation.rawProofPrinted, false);

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

  const missingWalletChallenge = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    walletChallenge: undefined,
  });

  assert.equal(missingWalletChallenge.ok, true);
  assert.equal(missingWalletChallenge.stage, 'parsed');
  assert.equal(missingWalletChallenge.walletChallenge, null);
  assert.equal(missingWalletChallenge.verifiedChallenge, null);
  assert.equal(missingWalletChallenge.challengeBinding, 'not_checked');
  assert.equal(missingWalletChallenge.rawProofPrinted, false);

  const nullWalletChallenge = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    walletChallenge: null,
  });

  assert.equal(nullWalletChallenge.ok, true);
  assert.equal(nullWalletChallenge.stage, 'parsed');
  assert.equal(nullWalletChallenge.walletChallenge, null);
  assert.equal(nullWalletChallenge.verifiedChallenge, null);
  assert.equal(nullWalletChallenge.challengeBinding, 'not_checked');
  assert.equal(nullWalletChallenge.rawProofPrinted, false);

  const malformedWalletChallenge = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    walletChallenge: 123,
  });

  assert.equal(malformedWalletChallenge.ok, false);
  assert.equal(malformedWalletChallenge.stage, 'verification_failed');
  assert.match(String(malformedWalletChallenge.reason), /walletChallenge must be a string or null/);
  assert.equal(malformedWalletChallenge.rawProofPrinted, false);

  const walletChallengeMatch = resolveConcordiumWalletChallengeBinding({
    challengeHash,
    walletChallenge: 'wallet-proof-challenge-001',
    verifiedChallenge: 'wallet-proof-challenge-001',
  });

  assert.equal(walletChallengeMatch.expectedChallenge, 'wallet-proof-challenge-001');
  assert.equal(walletChallengeMatch.challengeBinding, 'walletChallenge');
  assert.equal(walletChallengeMatch.matches, true);

  const walletChallengeMismatch = resolveConcordiumWalletChallengeBinding({
    challengeHash,
    walletChallenge: 'wallet-proof-challenge-001',
    verifiedChallenge: 'wallet-proof-challenge-002',
  });

  assert.equal(walletChallengeMismatch.expectedChallenge, 'wallet-proof-challenge-001');
  assert.equal(walletChallengeMismatch.challengeBinding, 'walletChallenge');
  assert.equal(walletChallengeMismatch.matches, false);

  const missingWalletChallengeFallbackMatch = resolveConcordiumWalletChallengeBinding({
    challengeHash,
    verifiedChallenge: challengeHash,
  });

  assert.equal(missingWalletChallengeFallbackMatch.expectedChallenge, challengeHash);
  assert.equal(missingWalletChallengeFallbackMatch.challengeBinding, 'challengeHash');
  assert.equal(missingWalletChallengeFallbackMatch.matches, true);

  const missingVerifiedChallenge = resolveConcordiumWalletChallengeBinding({
    challengeHash,
    walletChallenge: 'wallet-proof-challenge-001',
  });

  assert.equal(missingVerifiedChallenge.expectedChallenge, 'wallet-proof-challenge-001');
  assert.equal(missingVerifiedChallenge.challengeBinding, 'walletChallenge');
  assert.equal(missingVerifiedChallenge.matches, null);

  console.log(
    JSON.stringify(
      {
        ok: true,
        parsedOnlyStage: parsedOnly.stage,
        liveUnavailableStage: liveUnavailable.stage,
        liveUnavailableFailsClosed: !liveUnavailable.ok,
        adapterNullEnvelopeRejected: !adapterNullEnvelope.ok,
        adapterMissingPresentationRejected: !adapterMissingPresentation.ok,
        adapterMalformedPresentationRejected: !adapterMalformedPresentation.ok,
        directBuyerEnvelopeType: parsedOnly.envelopeType,
        delegatedStage: delegated.stage,
        unsupportedProofTypeStage: unsupportedProofType.stage,
        walletChallengeBound: parsedOnly.walletChallenge === challengeHash,
        challengeBinding: parsedOnly.challengeBinding,
        badHashRejected: !badHash.ok,
        missingPresentationRejected: !missingPresentation.ok,
        missingWalletChallengeFallbackOk: missingWalletChallenge.ok,
        nullWalletChallengeAccepted: nullWalletChallenge.ok,
        malformedWalletChallengeRejected: !malformedWalletChallenge.ok,
        walletChallengeBindingMatch: walletChallengeMatch.matches,
        walletChallengeBindingMismatchRejected: walletChallengeMismatch.matches === false,
        missingWalletChallengeLiveFallbackBinding: missingWalletChallengeFallbackMatch.challengeBinding,
        missingVerifiedChallengeBindingNotChecked: missingVerifiedChallenge.matches === null,
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
