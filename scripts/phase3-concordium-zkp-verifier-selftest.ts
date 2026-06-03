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
import { liveVerifyDirectBuyerEnvelope, liveVerifyDirectBuyerEnvelopeWithDeps, validateLiveDirectBuyerProofFixtureContract, type LiveZkpSdkInvocationDeps } from '../src/phase3/liveZkpVerifierAdapter';

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

function assertCommonVerifierResultContract(result: any): void {
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(typeof result.stage, 'string');
  assert.equal(result.delegatedAgentVerificationSupported, false);
  assert.equal(result.agentRegistryLookupAttempted, false);
  assert.equal(result.rawProofPrinted, false);
}

function assertParsedOnlyOutputContract(result: any): void {
  assertCommonVerifierResultContract(result);
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'parsed');
  assert.equal(result.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(result.challengeHash, challengeHash);
  assert.equal(result.expectedChallengeHash, challengeHash);
  assert.equal(result.proofType, 'concordium.VerifiablePresentation');
  assert.equal(result.walletChallenge, challengeHash);
  assert.equal(result.verifiedChallenge, null);
  assert.equal(result.challengeBinding, 'not_checked');
  assert.equal(result.credentialCount, undefined);
  assert.equal(result.verifiedRequestKeys, undefined);
  assert.equal(result.reason, undefined);
}

function assertLiveFailureOutputContract(result: any): void {
  assertCommonVerifierResultContract(result);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'verification_failed');
  assert.equal(result.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(result.challengeHash, challengeHash);
  assert.equal(result.expectedChallengeHash, challengeHash);
  assert.equal(result.proofType, 'concordium.VerifiablePresentation');
  assert.equal(result.network, 'testnet');
  assert.equal(result.grpcHost, '127.0.0.1');
  assert.equal(result.grpcPort, 1);
  assert.equal(result.walletChallenge, challengeHash);
  assert.equal(result.verifiedChallenge, null);
  assert.equal(result.challengeBinding, 'walletChallenge');
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
}

function assertLiveVerifiedOutputContract(result: any): void {
  assertCommonVerifierResultContract(result);
  assert.equal(result.ok, true);
  assert.equal(result.stage, 'verified');
  assert.equal(result.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(result.challengeHash, challengeHash);
  assert.equal(result.expectedChallengeHash, challengeHash);
  assert.equal(result.proofType, 'concordium.VerifiablePresentation');
  assert.equal(result.network, 'testnet');
  assert.equal(result.grpcHost, '127.0.0.1');
  assert.equal(result.grpcPort, 1);
  assert.equal(result.credentialCount, 2);
  assert.deepEqual(result.verifiedRequestKeys, ['challenge', 'proofOk']);
  assert.equal(result.walletChallenge, challengeHash);
  assert.equal(result.verifiedChallenge, challengeHash);
  assert.equal(result.challengeBinding, 'walletChallenge');
  assert.equal(result.reason, undefined);
}

function makeFakeLiveZkpDeps(verifiedChallenge: string, shouldThrow = false): LiveZkpSdkInvocationDeps {
  return {
    createGrpcClient() {
      if (shouldThrow) throw new Error('fake sdk createGrpcClient failed');
      return { fake: 'grpc' };
    },
    parsePresentation(input) {
      return { parsedPresentation: input.presentation };
    },
    async getPublicData() {
      return [{ inputs: { credential: 1 } }, { inputs: { credential: 2 } }];
    },
    async getCryptographicParameters() {
      return { fake: 'params' };
    },
    verifyPresentation() {
      return {
        challenge: verifiedChallenge,
        proofOk: true,
      };
    },
  };
}


function assertRejectedOutputContract(result: any, stage: string): void {
  assertCommonVerifierResultContract(result);
  assert.equal(result.ok, false);
  assert.equal(result.stage, stage);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
}


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
  assertParsedOnlyOutputContract(parsedOnly);

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
  assertLiveFailureOutputContract(liveUnavailable);

  const fakeLiveVerified = await liveVerifyDirectBuyerEnvelopeWithDeps(
    directBuyerEnvelope as any,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    makeFakeLiveZkpDeps(challengeHash),
  );

  assertLiveVerifiedOutputContract(fakeLiveVerified);

  const fakeLiveChallengeMismatch = await liveVerifyDirectBuyerEnvelopeWithDeps(
    directBuyerEnvelope as any,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    makeFakeLiveZkpDeps('wrong-wallet-challenge'),
  );

  assert.equal(fakeLiveChallengeMismatch.ok, false);
  assert.equal(fakeLiveChallengeMismatch.stage, 'verification_failed');
  assert.equal(fakeLiveChallengeMismatch.credentialCount, 2);
  assert.deepEqual(fakeLiveChallengeMismatch.verifiedRequestKeys, ['challenge', 'proofOk']);
  assert.equal(fakeLiveChallengeMismatch.walletChallenge, challengeHash);
  assert.equal(fakeLiveChallengeMismatch.verifiedChallenge, 'wrong-wallet-challenge');
  assert.equal(fakeLiveChallengeMismatch.challengeBinding, 'walletChallenge');
  assert.equal(
    fakeLiveChallengeMismatch.reason,
    'verified request challenge does not match expected wallet challenge binding',
  );
  assert.equal(fakeLiveChallengeMismatch.rawProofPrinted, false);

  const fakeLiveSdkFailure = await liveVerifyDirectBuyerEnvelopeWithDeps(
    directBuyerEnvelope as any,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    makeFakeLiveZkpDeps(challengeHash, true),
  );

  assert.equal(fakeLiveSdkFailure.ok, false);
  assert.equal(fakeLiveSdkFailure.stage, 'verification_failed');
  assert.equal(fakeLiveSdkFailure.reason, 'fake sdk createGrpcClient failed');
  assert.equal(fakeLiveSdkFailure.rawProofPrinted, false);

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

  const fixtureContractValid = validateLiveDirectBuyerProofFixtureContract(directBuyerEnvelope, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(fixtureContractValid, null);

  const fixtureMissingType = validateLiveDirectBuyerProofFixtureContract({
    ...directBuyerEnvelope,
    type: undefined,
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(fixtureMissingType?.ok, false);
  assert.equal(fixtureMissingType?.stage, 'verification_failed');
  assert.equal(fixtureMissingType?.reason, 'live verifier input type must be direct-buyer v1');
  assert.equal(fixtureMissingType?.rawProofPrinted, false);

  const fixtureWrongProofType = validateLiveDirectBuyerProofFixtureContract({
    ...directBuyerEnvelope,
    proofType: 'concordium.VerifiablePresentationV1',
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(fixtureWrongProofType?.ok, false);
  assert.equal(fixtureWrongProofType?.stage, 'verification_failed');
  assert.equal(fixtureWrongProofType?.reason, 'live verifier input proofType must be concordium.VerifiablePresentation');
  assert.equal(fixtureWrongProofType?.rawProofPrinted, false);

  const fixtureMissingChallengeHash = validateLiveDirectBuyerProofFixtureContract({
    ...directBuyerEnvelope,
    challengeHash: '',
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(fixtureMissingChallengeHash?.ok, false);
  assert.equal(fixtureMissingChallengeHash?.stage, 'verification_failed');
  assert.equal(fixtureMissingChallengeHash?.reason, 'live verifier input challengeHash must be a non-empty string');
  assert.equal(fixtureMissingChallengeHash?.rawProofPrinted, false);

  const fixtureMalformedWallet = validateLiveDirectBuyerProofFixtureContract({
    ...directBuyerEnvelope,
    wallet: 123,
  } as any, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(fixtureMalformedWallet?.ok, false);
  assert.equal(fixtureMalformedWallet?.stage, 'verification_failed');
  assert.equal(fixtureMalformedWallet?.reason, 'live verifier input wallet must be an object or null');
  assert.equal(fixtureMalformedWallet?.rawProofPrinted, false);

  const unsupportedProofType = await verifyConcordiumZkpAuthorizationEnvelope({
    ...directBuyerEnvelope,
    proofType: 'concordium.VerifiablePresentationV1',
  });

  assert.equal(unsupportedProofType.ok, false);
  assert.equal(unsupportedProofType.stage, 'unsupported_proof_type');
  assert.equal(unsupportedProofType.agentRegistryLookupAttempted, false);
  assert.equal(unsupportedProofType.rawProofPrinted, false);
  assertRejectedOutputContract(unsupportedProofType, 'unsupported_proof_type');

  const delegated = await verifyConcordiumZkpAuthorizationEnvelope(delegatedEnvelope);

  assert.equal(delegated.ok, false);
  assert.equal(delegated.stage, 'delegated_not_supported');
  assert.equal(delegated.envelopeType, 'xcf.concordium.authorization.delegated-agent.v1');
  assert.equal(delegated.delegatedAgentVerificationSupported, false);
  assert.equal(delegated.agentRegistryLookupAttempted, false);
  assert.equal(delegated.rawProofPrinted, false);
  assertRejectedOutputContract(delegated, 'delegated_not_supported');

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
        parsedOnlyOutputContract: parsedOnly.ok && parsedOnly.stage === 'parsed',
        liveFailureOutputContract: !liveUnavailable.ok && liveUnavailable.stage === 'verification_failed',
        fakeLiveVerifiedOutputContract: fakeLiveVerified.ok && fakeLiveVerified.stage === 'verified',
        fakeLiveChallengeMismatchRejected:
          !fakeLiveChallengeMismatch.ok && fakeLiveChallengeMismatch.stage === 'verification_failed',
        fakeLiveSdkFailureRejected:
          !fakeLiveSdkFailure.ok && fakeLiveSdkFailure.stage === 'verification_failed',
        unsupportedProofTypeOutputContract:
          !unsupportedProofType.ok && unsupportedProofType.stage === 'unsupported_proof_type',
        delegatedOutputContract: !delegated.ok && delegated.stage === 'delegated_not_supported',
        adapterNullEnvelopeRejected: !adapterNullEnvelope.ok,
        adapterMissingPresentationRejected: !adapterMissingPresentation.ok,
        adapterMalformedPresentationRejected: !adapterMalformedPresentation.ok,
        fixtureContractValid: fixtureContractValid === null,
        fixtureMissingTypeRejected: !fixtureMissingType?.ok,
        fixtureWrongProofTypeRejected: !fixtureWrongProofType?.ok,
        fixtureMissingChallengeHashRejected: !fixtureMissingChallengeHash?.ok,
        fixtureMalformedWalletRejected: !fixtureMalformedWallet?.ok,
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
