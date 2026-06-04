import assert from 'node:assert/strict';

import type {
  ConcordiumZkpVerifierResult,
} from '../src/phase3/concordiumZkpVerifier';
import {
  buildModelAEligibilityResult,
} from '../src/phase3/modelAEligibility';

const baseVerifiedResult: ConcordiumZkpVerifierResult = {
  ok: true,
  stage: 'verified',
  envelopeType: 'xcf.concordium.authorization.direct-buyer.v1',
  challengeHash: 'demo-wallet-challenge-hash',
  expectedChallengeHash: 'demo-wallet-challenge-hash',
  proofType: 'concordium.VerifiablePresentation',
  network: 'testnet',
  grpcHost: '127.0.0.1',
  grpcPort: 20001,
  credentialCount: 1,
  verifiedRequestKeys: ['challenge', 'credentialStatements'],
  walletChallenge: 'demo-wallet-challenge-hash',
  verifiedChallenge: 'demo-wallet-challenge-hash',
  challengeBinding: 'walletChallenge',
  delegatedAgentVerificationSupported: false,
  agentRegistryLookupAttempted: false,
  rawProofPrinted: false,
};

const failedVerifierResult: ConcordiumZkpVerifierResult = {
  ok: false,
  stage: 'verification_failed',
  delegatedAgentVerificationSupported: false,
  agentRegistryLookupAttempted: false,
  rawProofPrinted: false,
  reason: 'simulated verifier failure',
};

const parsedOnlyVerifierResult: ConcordiumZkpVerifierResult = {
  ok: true,
  stage: 'parsed',
  envelopeType: 'xcf.concordium.authorization.direct-buyer.v1',
  challengeHash: 'demo-wallet-challenge-hash',
  expectedChallengeHash: 'demo-wallet-challenge-hash',
  proofType: 'concordium.VerifiablePresentation',
  walletChallenge: 'demo-wallet-challenge-hash',
  verifiedChallenge: null,
  challengeBinding: 'not_checked',
  delegatedAgentVerificationSupported: false,
  agentRegistryLookupAttempted: false,
  rawProofPrinted: false,
};

const missingCredentialStatementsResult: ConcordiumZkpVerifierResult = {
  ...baseVerifiedResult,
  verifiedRequestKeys: ['challenge'],
};

function assertSafetyFlags(result: ReturnType<typeof buildModelAEligibilityResult>) {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function main() {
  const eligible = buildModelAEligibilityResult({
    verifierResult: baseVerifiedResult,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(eligible.ok, true);
  assert.equal(eligible.model, 'phase3-model-a');
  assert.equal(eligible.proofVerified, true);
  assert.equal(eligible.eligibilityVerified, true);
  assert.equal(eligible.challengeVerified, true);
  assert.equal(eligible.credentialStatementsVerified, true);
  assert.equal(eligible.accountBindingStatus, 'wallet_api_missing');
  assert.equal(eligible.verifierStage, 'verified');
  assertSafetyFlags(eligible);

  const presentAccount = buildModelAEligibilityResult({
    verifierResult: baseVerifiedResult,
    accountBindingStatus: 'present',
  });

  assert.equal(presentAccount.ok, true);
  assert.equal(presentAccount.accountBindingStatus, 'present');
  assertSafetyFlags(presentAccount);

  const failed = buildModelAEligibilityResult({
    verifierResult: failedVerifierResult,
    accountBindingStatus: 'not_provided',
  });

  assert.equal(failed.ok, false);
  assert.equal(failed.proofVerified, false);
  assert.equal(failed.eligibilityVerified, false);
  assert.equal(failed.challengeVerified, false);
  assert.equal(failed.credentialStatementsVerified, false);
  assert.equal(failed.accountBindingStatus, 'not_provided');
  assert.equal(failed.verifierStage, 'verification_failed');
  assert.equal(failed.verifierReason, 'simulated verifier failure');
  assertSafetyFlags(failed);

  const parsedOnly = buildModelAEligibilityResult({
    verifierResult: parsedOnlyVerifierResult,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(parsedOnly.ok, false);
  assert.equal(parsedOnly.proofVerified, false);
  assert.equal(parsedOnly.eligibilityVerified, false);
  assert.equal(parsedOnly.challengeVerified, false);
  assert.equal(parsedOnly.credentialStatementsVerified, false);
  assert.equal(parsedOnly.verifierStage, 'parsed');
  assertSafetyFlags(parsedOnly);

  const missingCredentialStatements = buildModelAEligibilityResult({
    verifierResult: missingCredentialStatementsResult,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(missingCredentialStatements.ok, false);
  assert.equal(missingCredentialStatements.proofVerified, true);
  assert.equal(missingCredentialStatements.challengeVerified, true);
  assert.equal(missingCredentialStatements.credentialStatementsVerified, false);
  assert.equal(missingCredentialStatements.eligibilityVerified, false);
  assertSafetyFlags(missingCredentialStatements);

  console.log(
    JSON.stringify(
      {
        ok: true,
        model: eligible.model,
        eligibleWithWalletApiMissing: eligible.ok,
        eligibleWithPresentAccount: presentAccount.ok,
        failedVerifierRejected: failed.ok === false,
        parsedOnlyRejected: parsedOnly.ok === false,
        missingCredentialStatementsRejected: missingCredentialStatements.ok === false,
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
