import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseAuthorizationEnvelope,
} from '../src/phase3/authorizationEnvelope';
import {
  liveVerifyDirectBuyerEnvelopeWithDeps,
  type LiveZkpSdkInvocationDeps,
} from '../src/phase3/liveZkpVerifierAdapter';
import {
  verifyConcordiumZkpAuthorizationEnvelope,
} from '../src/phase3/concordiumZkpVerifier';
import {
  buildSafeMetadata,
  describeLiveBuyerProofCaptureAdapterInputContract,
  normalizeWalletProofCapture,
} from './phase3-wallet-proof-capture-harness';

function asRecord(value: unknown, name: string): Record<string, unknown> {
  assert.equal(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    true,
    name + ' must be an object',
  );
  return value as Record<string, unknown>;
}

function assertSafetyMetadata(metadata: Record<string, unknown>) {
  assert.equal(metadata.rawProofPrinted, false);
  assert.equal(metadata.persisted, false);
  assert.equal(metadata.paymentReleaseAttempted, false);
  assert.equal(metadata.paymentResponseEmitted, false);
  assert.equal(metadata.crpCalled, false);
  assert.equal(metadata.replayTouched, false);
}

function buildFakeLiveDeps(expectedPresentationContext: string, verifiedChallenge = expectedPresentationContext): LiveZkpSdkInvocationDeps {
  return {
    createGrpcClient(input) {
      assert.equal(input.grpcHost, '127.0.0.1');
      assert.equal(input.grpcPort, 1);
      return {
        fake: 'grpc-client',
      };
    },

    parsePresentation(input) {
      const presentation = asRecord(input.presentation, 'presentation');
      assert.equal(presentation.presentationContext, expectedPresentationContext);
      assert.equal(presentation.sanitized, true);
      assert.equal(presentation.rawProofMaterialPresent, false);

      return {
        fake: 'parsed-presentation',
        challenge: expectedPresentationContext,
      };
    },

    async getPublicData(input) {
      assert.deepEqual(input.grpc, {
        fake: 'grpc-client',
      });
      assert.equal(input.network, 'testnet');
      assert.deepEqual(input.presentation, {
        fake: 'parsed-presentation',
        challenge: expectedPresentationContext,
      });

      return [
        {
          inputs: {
            statement: 'age_min_by_region',
            region: 'EU',
            minAge: 18,
          },
        },
      ];
    },

    async getCryptographicParameters(input) {
      assert.deepEqual(input.grpc, {
        fake: 'grpc-client',
      });

      return {
        fake: 'cryptographic-parameters',
      };
    },

    verifyPresentation(input) {
      assert.deepEqual(input.presentation, {
        fake: 'parsed-presentation',
        challenge: expectedPresentationContext,
      });
      assert.deepEqual(input.cryptographicParameters, {
        fake: 'cryptographic-parameters',
      });
      assert.deepEqual(input.publicData, [
        {
          statement: 'age_min_by_region',
          region: 'EU',
          minAge: 18,
        },
      ]);

      return {
        challenge: verifiedChallenge,
      };
    },
  };
}

async function main() {
  const fixturePath = path.join(
    process.cwd(),
    'fixtures',
    'phase3',
    'wallet-proof-canonical.direct-buyer.sanitized.json',
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const fixtureRecord = asRecord(fixture, 'fixture');

  const captureContract = describeLiveBuyerProofCaptureAdapterInputContract();
  assert.equal(captureContract.adapterInputOnly, true);
  assert.equal(captureContract.canonicalAuthorizationEnvelopeRequired, false);
  assert.equal(captureContract.canonicalChallengeHashValidationPerformed, false);
  assert.equal(captureContract.productionReleaseAuthorized, false);
  assert.equal(captureContract.gatewayRuntimeMutated, false);
  assert.equal(captureContract.persisted, false);
  assert.equal(captureContract.crpCalled, false);
  assert.equal(captureContract.paymentAttempted, false);
  assert.equal(captureContract.paymentResponseEmitted, false);
  assert.equal(captureContract.replayTouched, false);
  assert.equal(captureContract.rawProofPrinted, false);

  const normalizedEnvelope = normalizeWalletProofCapture({
    capturedAt: '2026-06-09T00:00:00.000Z',
    source: 'phase3-sanitized-fixture-replay-harness',
    authorizationProof: fixture,
  });

  const normalizedRecord = asRecord(normalizedEnvelope, 'normalizedEnvelope');
  assert.equal(normalizedRecord.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(normalizedRecord.challengeHash, fixtureRecord.challengeHash);
  assert.equal(normalizedRecord.walletChallenge, fixtureRecord.walletChallenge);
  assert.deepEqual(normalizedRecord.challenge, fixtureRecord.challenge);
  assert.deepEqual(normalizedRecord.presentation, fixtureRecord.presentation);

  const fixtureValidationMetadata = buildSafeMetadata(normalizedEnvelope, null);
  assert.equal(fixtureValidationMetadata.ok, true);
  assert.equal(fixtureValidationMetadata.normalized, true);
  assertSafetyMetadata(asRecord(fixtureValidationMetadata, 'fixtureValidationMetadata'));

  const parsed = parseAuthorizationEnvelope(normalizedEnvelope);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(parsed.challengeHash, fixtureRecord.challengeHash);
  assert.equal(parsed.expectedChallengeHash, fixtureRecord.challengeHash);

  if (parsed.envelope.type !== 'xcf.concordium.authorization.direct-buyer.v1') {
    throw new Error('expected direct Buyer envelope');
  }

  const parsedOnly = await verifyConcordiumZkpAuthorizationEnvelope(normalizedEnvelope, {
    liveVerify: false,
    network: 'testnet',
  });

  assert.equal(parsedOnly.ok, true);
  assert.equal(parsedOnly.stage, 'parsed');
  assert.equal(parsedOnly.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(parsedOnly.challengeHash, fixtureRecord.challengeHash);
  assert.equal(parsedOnly.expectedChallengeHash, fixtureRecord.challengeHash);
  assert.equal(parsedOnly.walletChallenge, fixtureRecord.walletChallenge);
  assert.equal(parsedOnly.challengeBinding, 'not_checked');
  assert.equal(parsedOnly.delegatedAgentVerificationSupported, false);
  assert.equal(parsedOnly.agentRegistryLookupAttempted, false);
  assert.equal(parsedOnly.rawProofPrinted, false);

  const fakeLiveVerified = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    buildFakeLiveDeps(String(fixtureRecord.walletChallenge)),
  );

  assert.equal(fakeLiveVerified.ok, true);
  assert.equal(fakeLiveVerified.stage, 'verified');
  assert.equal(fakeLiveVerified.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(fakeLiveVerified.challengeHash, fixtureRecord.challengeHash);
  assert.equal(fakeLiveVerified.expectedChallengeHash, fixtureRecord.challengeHash);
  assert.equal(fakeLiveVerified.walletChallenge, fixtureRecord.walletChallenge);
  assert.equal(fakeLiveVerified.verifiedChallenge, fixtureRecord.walletChallenge);
  assert.equal(fakeLiveVerified.challengeBinding, 'walletChallenge');
  assert.equal(fakeLiveVerified.credentialCount, 1);
  assert.equal(fakeLiveVerified.delegatedAgentVerificationSupported, false);
  assert.equal(fakeLiveVerified.agentRegistryLookupAttempted, false);
  assert.equal(fakeLiveVerified.rawProofPrinted, false);

  const fakeMismatch = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    buildFakeLiveDeps(String(fixtureRecord.walletChallenge), 'wrong-wallet-challenge'),
  );

  assert.equal(fakeMismatch.ok, false);
  assert.equal(fakeMismatch.stage, 'verification_failed');
  assert.equal(fakeMismatch.reason, 'verified request challenge does not match expected wallet challenge binding');
  assert.equal(fakeMismatch.challengeBinding, 'walletChallenge');
  assert.equal(fakeMismatch.rawProofPrinted, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: 'wallet-proof-canonical.direct-buyer.sanitized.json',
        replayHarness: 'phase3.liveBuyerProof.fixtureReplay.v1',
        captureContract: captureContract.contract,
        normalizedEnvelopeAccepted: fixtureValidationMetadata.ok,
        canonicalAuthorizationEnvelopeParsed: parsed.ok,
        parsedOnlyVerifierStage: parsedOnly.stage,
        fakeLiveVerifierStage: fakeLiveVerified.stage,
        fakeLiveChallengeMismatchRejected: fakeMismatch.reason,
        walletChallengeBound: fakeLiveVerified.walletChallenge === fixtureRecord.walletChallenge,
        verifiedChallengeBound: fakeLiveVerified.verifiedChallenge === fixtureRecord.walletChallenge,
        credentialCount: fakeLiveVerified.credentialCount,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
        persisted: false,
        productionReleaseAuthorized: false,
        gatewayRuntimeMutated: false,
        crpCalled: false,
        paymentAttempted: false,
        paymentResponseEmitted: false,
        replayTouched: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: String((err as any)?.message ?? err),
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
