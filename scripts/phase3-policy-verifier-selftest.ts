import assert from 'node:assert/strict';

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
  type BuildX402ZkpChallengeInput,
} from '../src/phase3/zkpChallenge';
import {
  verifyPhase3Policy,
  type Phase3PolicyRequirement,
} from '../src/phase3/policyVerifier';
import type { ConcordiumZkpVerifierResult } from '../src/phase3/concordiumZkpVerifier';

const baseInput: BuildX402ZkpChallengeInput = {
  merchantId: 'demo-merchant',
  resource: {
    method: 'GET',
    path: '/paid-gated',
  },
  contract: {
    contractId: 'cid_demo_phase3_policy',
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
  nonce: 'phase3-policy-verifier-nonce-001',
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

const requirement: Phase3PolicyRequirement = {
  policyId: 'age-region-v1',
  policyVersion: '1.0.0',
  requirementsHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  allowParsedOnly: true,
};

const parsedVerifierResult: ConcordiumZkpVerifierResult = {
  ok: true,
  stage: 'parsed',
  envelopeType: 'xcf.concordium.authorization.direct-buyer.v1',
  challengeHash,
  expectedChallengeHash: challengeHash,
  proofType: 'concordium.VerifiablePresentation',
  walletChallenge: 'wallet-proof-challenge-001',
  verifiedChallenge: null,
  challengeBinding: 'not_checked',
  delegatedAgentVerificationSupported: false,
  agentRegistryLookupAttempted: false,
  rawProofPrinted: false,
};

const verifiedVerifierResult: ConcordiumZkpVerifierResult = {
  ...parsedVerifierResult,
  stage: 'verified',
  walletChallenge: 'wallet-proof-challenge-001',
  verifiedChallenge: 'wallet-proof-challenge-001',
  challengeBinding: 'walletChallenge',
};

function main() {
  const parsedAllowed = verifyPhase3Policy({
    challenge,
    verifierResult: parsedVerifierResult,
    requirement,
    now: challenge.issuedAt + 10,
  });

  assert.equal(parsedAllowed.ok, true);
  assert.equal(parsedAllowed.allowed, true);
  assert.equal(parsedAllowed.code, 'policy_satisfied');
  assert.equal(parsedAllowed.rawProofPrinted, false);

  const verifiedRequiredAllowed = verifyPhase3Policy({
    challenge,
    verifierResult: verifiedVerifierResult,
    requirement: {
      ...requirement,
      requireVerifiedProof: true,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(verifiedRequiredAllowed.ok, true);
  assert.equal(verifiedRequiredAllowed.allowed, true);
  assert.equal(verifiedRequiredAllowed.code, 'policy_satisfied');
  assert.equal(verifiedRequiredAllowed.challengeBinding, 'walletChallenge');

  const parsedRejectedWhenLiveRequired = verifyPhase3Policy({
    challenge,
    verifierResult: parsedVerifierResult,
    requirement: {
      ...requirement,
      requireVerifiedProof: true,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(parsedRejectedWhenLiveRequired.ok, false);
  assert.equal(parsedRejectedWhenLiveRequired.allowed, false);
  assert.equal(parsedRejectedWhenLiveRequired.code, 'verified_proof_required');

  const parsedRejectedByDefault = verifyPhase3Policy({
    challenge,
    verifierResult: parsedVerifierResult,
    requirement: {
      ...requirement,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(parsedRejectedByDefault.ok, false);
  assert.equal(parsedRejectedByDefault.allowed, false);
  assert.equal(parsedRejectedByDefault.code, 'verified_proof_required');

  const policyMismatch = verifyPhase3Policy({
    challenge,
    verifierResult: parsedVerifierResult,
    requirement: {
      ...requirement,
      requirementsHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(policyMismatch.ok, false);
  assert.equal(policyMismatch.code, 'policy_mismatch');

  const expired = verifyPhase3Policy({
    challenge,
    verifierResult: parsedVerifierResult,
    requirement,
    now: challenge.expiresAt + 1,
  });

  assert.equal(expired.ok, false);
  assert.equal(expired.code, 'challenge_expired');

  const verifierFailed = verifyPhase3Policy({
    challenge,
    verifierResult: {
      ...parsedVerifierResult,
      ok: false,
      stage: 'verification_failed',
      reason: 'demo verifier failure',
    },
    requirement,
    now: challenge.issuedAt + 10,
  });

  assert.equal(verifierFailed.ok, false);
  assert.equal(verifierFailed.code, 'verifier_failed');

  const delegatedRejected = verifyPhase3Policy({
    challenge,
    verifierResult: {
      ...parsedVerifierResult,
      ok: false,
      stage: 'delegated_not_supported',
      reason: 'delegated not supported',
    },
    requirement,
    now: challenge.issuedAt + 10,
  });

  assert.equal(delegatedRejected.ok, false);
  assert.equal(delegatedRejected.code, 'delegated_agent_not_supported');

  const verifiedMissingWalletChallenge = verifyPhase3Policy({
    challenge,
    verifierResult: {
      ...verifiedVerifierResult,
      walletChallenge: null,
      verifiedChallenge: 'wallet-proof-challenge-001',
    },
    requirement: {
      ...requirement,
      requireVerifiedProof: true,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(verifiedMissingWalletChallenge.ok, false);
  assert.equal(verifiedMissingWalletChallenge.code, 'wallet_challenge_required');

  const verifiedWrongBinding = verifyPhase3Policy({
    challenge,
    verifierResult: {
      ...verifiedVerifierResult,
      challengeBinding: 'challengeHash',
    },
    requirement: {
      ...requirement,
      requireVerifiedProof: true,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(verifiedWrongBinding.ok, false);
  assert.equal(verifiedWrongBinding.code, 'wallet_challenge_required');

  const verifiedChallengeMismatch = verifyPhase3Policy({
    challenge,
    verifierResult: {
      ...verifiedVerifierResult,
      verifiedChallenge: 'wallet-proof-challenge-002',
    },
    requirement: {
      ...requirement,
      requireVerifiedProof: true,
      allowParsedOnly: false,
    },
    now: challenge.issuedAt + 10,
  });

  assert.equal(verifiedChallengeMismatch.ok, false);
  assert.equal(verifiedChallengeMismatch.code, 'wallet_challenge_mismatch');

  console.log(
    JSON.stringify(
      {
        ok: true,
        parsedAllowed: parsedAllowed.allowed,
        verifiedRequiredAllowed: verifiedRequiredAllowed.allowed,
        parsedRejectedWhenLiveRequired: parsedRejectedWhenLiveRequired.code,
        parsedRejectedByDefault: parsedRejectedByDefault.code,
        policyMismatchRejected: policyMismatch.code,
        expiredRejected: expired.code,
        verifierFailedRejected: verifierFailed.code,
        delegatedRejected: delegatedRejected.code,
        verifiedMissingWalletChallengeRejected: verifiedMissingWalletChallenge.code,
        verifiedWrongBindingRejected: verifiedWrongBinding.code,
        verifiedChallengeMismatchRejected: verifiedChallengeMismatch.code,
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
}

main();
