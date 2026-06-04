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

const browserWalletCapture = {
  type: 'phase3b_browser_wallet_presentation_capture',
  capturedAt: '2026-06-03T00:00:00.000Z',
  warning: 'Sanitized browser wallet capture fixture. Not real proof material.',
  account: '4FakeAccountAddressFromBrowserHarnessOnly',
  selectedChain: 'concordium:testnet',
  challenge: 'demo-wallet-challenge-hash',
  statements: [
    {
      type: 'AttributeInRange',
      attributeTag: 'dob',
      lower: '19000101',
      upper: '20080603',
    },
  ],
  presentation: {
    presentationContext: 'demo-wallet-challenge-hash',
    type: ['VerifiablePresentation', 'ConcordiumVerifiablePresentationV1'],
    verifiableCredential: [],
    proof: {
      type: 'ConcordiumWeb3IdProof',
      proofValue: 'sanitized-placeholder-proof-value',
    },
  },
};

const browserWalletCaptureMissingAccount = {
  ...browserWalletCapture,
  account: null,
  accountPresent: false,
};

const rawWalletCaptureMissingWallet = {
  challengeHash: 'demo-wallet-challenge-hash',
  proofType: 'concordium.VerifiablePresentation',
  presentation: {
    kind: 'placeholder-wallet-presentation',
  },
  walletChallenge: 'demo-wallet-challenge',
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

function assertAccepted(
  name: string,
  input: unknown,
  expectedWalletChallenge = 'demo-wallet-challenge',
  expectedAccountBindingStatus = 'present',
) {
  const { envelope, metadata, validation } = validateAndSummarize(input);

  assert.equal(validation, null, `${name}: expected validation to pass`);
  assert.equal(envelope.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(envelope.proofType, 'concordium.VerifiablePresentation');
  assert.equal(envelope.challengeHash, 'demo-wallet-challenge-hash');
  assert.equal(envelope.walletChallenge, expectedWalletChallenge);

  assert.equal(metadata.ok, true);
  assert.equal(metadata.normalized, true);
  assert.equal(metadata.presentationKind, 'object');
  assert.equal(metadata.walletChallengePresent, true);
  assert.equal(metadata.walletPresent, true);
  assert.equal(metadata.walletNetworkPresent, true);
  assert.equal(metadata.walletSelectedChainPresent, true);
  assert.equal(metadata.walletAccountAddressPresent, expectedAccountBindingStatus === 'present');
  assert.equal(metadata.accountBindingStatus, expectedAccountBindingStatus);

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
  const browserWalletMetadata = assertAccepted(
    'browser wallet capture wrapper',
    browserWalletCapture,
    'demo-wallet-challenge-hash',
  );
  const browserWalletMissingAccountMetadata = assertAccepted(
    'browser wallet capture wrapper missing account',
    browserWalletCaptureMissingAccount,
    'demo-wallet-challenge-hash',
    'wallet_api_missing',
  );

  const rawMissingWallet = validateAndSummarize(rawWalletCaptureMissingWallet);
  assert.equal(rawMissingWallet.validation, null);
  assert.equal(rawMissingWallet.metadata.ok, true);
  assert.equal(rawMissingWallet.metadata.walletPresent, false);
  assert.equal(rawMissingWallet.metadata.walletAccountAddressPresent, false);
  assert.equal(rawMissingWallet.metadata.accountBindingStatus, 'not_provided');
  assert.equal(rawMissingWallet.metadata.rawProofPrinted, false);
  assert.equal(rawMissingWallet.metadata.persisted, false);
  assert.equal(rawMissingWallet.metadata.paymentReleaseAttempted, false);
  assert.equal(rawMissingWallet.metadata.paymentResponseEmitted, false);
  assert.equal(rawMissingWallet.metadata.crpCalled, false);
  assert.equal(rawMissingWallet.metadata.replayTouched, false);

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
        browserWalletCaptureAccepted: browserWalletMetadata.ok,
        browserWalletAccountAddressPresent: browserWalletMetadata.walletAccountAddressPresent,
        browserWalletAccountBindingStatus: browserWalletMetadata.accountBindingStatus,
        browserWalletMissingAccountAccepted: browserWalletMissingAccountMetadata.ok,
        browserWalletMissingAccountBindingStatus: browserWalletMissingAccountMetadata.accountBindingStatus,
        rawMissingWalletBindingStatus: rawMissingWallet.metadata.accountBindingStatus,
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
