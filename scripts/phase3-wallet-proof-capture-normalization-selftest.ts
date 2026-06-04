import assert from 'node:assert/strict';

import {
  validateLiveDirectBuyerProofFixtureContract,
} from '../src/phase3/liveZkpVerifierAdapter';
import {
  buildSafeMetadata,
  normalizeWalletProofCapture,
} from './phase3-wallet-proof-capture-harness';

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true);
  return value as Record<string, unknown>;
}

const normalizedEnvelope = {
  type: 'xcf.concordium.authorization.direct-buyer.v1',
  challengeHash: 'demo-wallet-challenge-hash',
  proofType: 'concordium.VerifiablePresentation',
  presentation: {
    kind: 'placeholder-wallet-presentation',
    credentialStatements: [
      {
        statement: 'age_min_by_region',
        region: 'EU',
        minAge: 18,
      },
    ],
  },
  walletChallenge: 'demo-wallet-challenge',
  wallet: {
    network: 'testnet',
    selectedChain: 'concordium:testnet',
    accountAddress: '4FakeAccountAddressForNormalizationSelftestOnly',
  },
  submittedAt: '2026-06-03T00:00:00.000Z',
};

const wrapperCapture = {
  capturedAt: '2026-06-03T00:00:00.000Z',
  source: 'wallet-ui-dev-capture',
  authorizationProof: normalizedEnvelope,
};

const rawWalletCapture = {
  challengeHash: 'demo-wallet-challenge-hash',
  proofType: 'concordium.VerifiablePresentation',
  presentation: {
    kind: 'placeholder-wallet-presentation',
  },
  walletChallenge: 'demo-wallet-challenge',
  wallet: {
    network: 'testnet',
    selectedChain: 'concordium:testnet',
    accountAddress: '4FakeAccountAddressForNormalizationSelftestOnly',
  },
  submittedAt: '2026-06-03T00:00:00.000Z',
};

const malformedCapture = {
  type: 'xcf.concordium.authorization.direct-buyer.v1',
  challengeHash: '',
  proofType: 'concordium.VerifiablePresentation',
  presentation: null,
};

function validateAndSummarize(input: unknown) {
  const envelope = normalizeWalletProofCapture(input);
  const validation = validateLiveDirectBuyerProofFixtureContract(envelope, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });
  const metadata = buildSafeMetadata(envelope, validation);

  return {
    envelope: asRecord(envelope),
    metadata: asRecord(metadata),
    validation,
  };
}

function assertAccepted(name: string, input: unknown) {
  const { envelope, metadata, validation } = validateAndSummarize(input);

  assert.equal(validation, null, `${name}: expected validation to pass`);
  assert.equal(envelope.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(envelope.proofType, 'concordium.VerifiablePresentation');
  assert.equal(envelope.challengeHash, 'demo-wallet-challenge-hash');
  assert.equal(envelope.walletChallenge, 'demo-wallet-challenge');

  assert.equal(metadata.ok, true);
  assert.equal(metadata.normalized, true);
  assert.equal(metadata.presentationKind, 'object');
  assert.equal(metadata.walletChallengePresent, true);
  assert.equal(metadata.walletPresent, true);
  assert.equal(metadata.walletNetworkPresent, true);
  assert.equal(metadata.walletSelectedChainPresent, true);
  assert.equal(metadata.walletAccountAddressPresent, true);

  assert.equal(metadata.rawProofPrinted, false);
  assert.equal(metadata.persisted, false);
  assert.equal(metadata.paymentReleaseAttempted, false);
  assert.equal(metadata.paymentResponseEmitted, false);
  assert.equal(metadata.crpCalled, false);
  assert.equal(metadata.replayTouched, false);

  return metadata;
}

function main() {
  const normalizedMetadata = assertAccepted('already-normalized envelope', normalizedEnvelope);
  const wrapperMetadata = assertAccepted('authorizationProof wrapper', wrapperCapture);
  const rawMetadata = assertAccepted('raw wallet capture', rawWalletCapture);

  const malformed = validateAndSummarize(malformedCapture);

  assert.equal(malformed.validation?.stage, 'verification_failed');
  assert.equal(malformed.metadata.ok, false);
  assert.equal(malformed.metadata.validationReason, 'live verifier input challengeHash must be a non-empty string');
  assert.equal(malformed.metadata.rawProofPrinted, false);
  assert.equal(malformed.metadata.persisted, false);
  assert.equal(malformed.metadata.paymentReleaseAttempted, false);
  assert.equal(malformed.metadata.paymentResponseEmitted, false);
  assert.equal(malformed.metadata.crpCalled, false);
  assert.equal(malformed.metadata.replayTouched, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        normalizedEnvelopeAccepted: normalizedMetadata.ok,
        wrapperCaptureAccepted: wrapperMetadata.ok,
        rawWalletCaptureAccepted: rawMetadata.ok,
        malformedCaptureRejected: malformed.validation?.stage,
        malformedReason: malformed.metadata.validationReason,
        rawProofPrinted: false,
        persisted: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        replayTouched: false,
      },
      null,
      2,
    ),
  );
}

main();
