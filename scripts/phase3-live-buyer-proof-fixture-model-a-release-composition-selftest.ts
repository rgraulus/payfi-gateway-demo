import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseAuthorizationEnvelope,
} from '../src/phase3/authorizationEnvelope';
import type {
  Phase3DemoContractBindingSnapshot,
} from '../src/phase3/demoChallengeBinding';
import {
  liveVerifyDirectBuyerEnvelopeWithDeps,
  type LiveZkpSdkInvocationDeps,
} from '../src/phase3/liveZkpVerifierAdapter';
import {
  buildModelAEligibilityResult,
} from '../src/phase3/modelAEligibility';
import {
  bindModelAEligibilityToChallengeContext,
  type ModelAEligibilityBindingResult,
} from '../src/phase3/modelAEligibilityBinding';
import {
  composeModelAReleaseDecision,
} from '../src/phase3/modelAReleaseComposition';
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

function getRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(parent[key], key);
}

function getString(parent: Record<string, unknown>, key: string): string {
  assert.equal(typeof parent[key], 'string', key + ' must be a string');
  return String(parent[key]);
}

function assertCompositionNoSideEffects(result: ReturnType<typeof composeModelAReleaseDecision>): void {
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function buildContractFromChallenge(challenge: Record<string, unknown>): Phase3DemoContractBindingSnapshot {
  const resource = getRecord(challenge, 'resource');
  const contract = getRecord(challenge, 'contract');
  const asset = getRecord(challenge, 'asset');

  return {
    merchantId: getString(challenge, 'merchantId'),
    resource: {
      method: getString(resource, 'method'),
      path: getString(resource, 'path'),
    },
    contractId: getString(contract, 'contractId'),
    contractVersion: getString(contract, 'contractVersion'),
    isFrozen: contract.isFrozen === true,
    network: getString(challenge, 'network'),
    chain_id: getString(challenge, 'chain_id'),
    asset: {
      type: getString(asset, 'type'),
      tokenId: getString(asset, 'tokenId'),
      decimals: Number(asset.decimals),
    },
    amount: getString(challenge, 'amount'),
    payTo: getString(challenge, 'payTo'),
  };
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
            credentialStatements: [{ statement: 'age-region-v1' }],
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
          credentialStatements: [{ statement: 'age-region-v1' }],
        },
      ]);

      return {
        challenge: verifiedChallenge,
        credentialStatements: [{ statement: 'age-region-v1' }],
      };
    },
  };
}

function assertBoundEligibilitySafetyFlags(result: ModelAEligibilityBindingResult): void {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
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
    source: 'phase3-sanitized-fixture-model-a-release-composition-harness',
    authorizationProof: fixture,
  });

  const normalizedRecord = asRecord(normalizedEnvelope, 'normalizedEnvelope');
  assert.equal(normalizedRecord.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(normalizedRecord.challengeHash, fixtureRecord.challengeHash);
  assert.equal(normalizedRecord.walletChallenge, fixtureRecord.walletChallenge);
  assert.deepEqual(normalizedRecord.challenge, fixtureRecord.challenge);
  assert.deepEqual(normalizedRecord.presentation, fixtureRecord.presentation);

  const safeMetadata = buildSafeMetadata(normalizedEnvelope, null);
  assert.equal(safeMetadata.ok, true);
  assert.equal(safeMetadata.normalized, true);

  const parsed = parseAuthorizationEnvelope(normalizedEnvelope);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(parsed.challengeHash, fixtureRecord.challengeHash);
  assert.equal(parsed.expectedChallengeHash, fixtureRecord.challengeHash);

  if (parsed.envelope.type !== 'xcf.concordium.authorization.direct-buyer.v1') {
    throw new Error('expected direct Buyer envelope');
  }

  const liveVerified = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    buildFakeLiveDeps(String(fixtureRecord.walletChallenge)),
  );

  assert.equal(liveVerified.ok, true);
  assert.equal(liveVerified.stage, 'verified');
  assert.equal(liveVerified.walletChallenge, fixtureRecord.walletChallenge);
  assert.equal(liveVerified.verifiedChallenge, fixtureRecord.walletChallenge);
  assert.equal(liveVerified.challengeBinding, 'walletChallenge');
  assert.deepEqual(liveVerified.verifiedRequestKeys, ['challenge', 'credentialStatements']);
  assert.equal(liveVerified.rawProofPrinted, false);

  const eligibility = buildModelAEligibilityResult({
    verifierResult: liveVerified,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.eligibilityVerified, true);
  assert.equal(eligibility.challengeVerified, true);
  assert.equal(eligibility.credentialStatementsVerified, true);
  assert.equal(eligibility.releaseAuthorized, false);
  assert.equal(eligibility.paymentReleaseAttempted, false);
  assert.equal(eligibility.paymentResponseEmitted, false);
  assert.equal(eligibility.crpCalled, false);
  assert.equal(eligibility.replayTouched, false);
  assert.equal(eligibility.rawProofPrinted, false);

  const fixtureChallenge = asRecord(fixtureRecord.challenge, 'fixture.challenge');
  const contract = buildContractFromChallenge(fixtureChallenge);
  const nonce = getString(fixtureChallenge, 'nonce');

  const bound = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce,
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(bound.ok, true);
  assert.equal(bound.eligibilityVerified, true);
  assert.equal(bound.challengeBound, true);
  assert.equal(bound.resourceBound, true);
  assertBoundEligibilitySafetyFlags(bound);

  const eligibleButUnpaid = composeModelAReleaseDecision({
    boundEligibility: bound,
    payment: {
      paymentSatisfied: false,
      paymentSource: 'none',
    },
  });

  assert.equal(eligibleButUnpaid.ok, false);
  assert.equal(eligibleButUnpaid.eligibilityVerified, true);
  assert.equal(eligibleButUnpaid.challengeBound, true);
  assert.equal(eligibleButUnpaid.resourceBound, true);
  assert.equal(eligibleButUnpaid.paymentSatisfied, false);
  assert.equal(eligibleButUnpaid.paymentSource, 'none');
  assert.equal(eligibleButUnpaid.releaseAuthorized, false);
  assert.equal(eligibleButUnpaid.reason, 'payment_not_satisfied');
  assertCompositionNoSideEffects(eligibleButUnpaid);

  const eligibleAndPaid = composeModelAReleaseDecision({
    boundEligibility: bound,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(eligibleAndPaid.ok, true);
  assert.equal(eligibleAndPaid.eligibilityVerified, true);
  assert.equal(eligibleAndPaid.challengeBound, true);
  assert.equal(eligibleAndPaid.resourceBound, true);
  assert.equal(eligibleAndPaid.paymentSatisfied, true);
  assert.equal(eligibleAndPaid.paymentSource, 'test-only');
  assert.equal(eligibleAndPaid.releaseAuthorized, true);
  assert.equal(eligibleAndPaid.reason, 'release_authorized');
  assertCompositionNoSideEffects(eligibleAndPaid);

  const wrongNonceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: 'wrong-nonce',
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(wrongNonceBinding.ok, false);
  assert.equal(wrongNonceBinding.bindingCode, 'policy_binding_mismatch');
  assertBoundEligibilitySafetyFlags(wrongNonceBinding);

  const unboundButPaid = composeModelAReleaseDecision({
    boundEligibility: wrongNonceBinding,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(unboundButPaid.ok, false);
  assert.equal(unboundButPaid.paymentSatisfied, true);
  assert.equal(unboundButPaid.releaseAuthorized, false);
  assert.equal(unboundButPaid.reason, 'eligibility_not_bound');
  assertCompositionNoSideEffects(unboundButPaid);

  const missingCredentialDeps: LiveZkpSdkInvocationDeps = {
    ...buildFakeLiveDeps(String(fixtureRecord.walletChallenge)),
    verifyPresentation() {
      return {
        challenge: String(fixtureRecord.walletChallenge),
        proofOk: true,
      };
    },
  };

  const missingCredentialLiveVerified = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    missingCredentialDeps,
  );

  assert.equal(missingCredentialLiveVerified.ok, true);
  assert.equal(missingCredentialLiveVerified.stage, 'verified');
  assert.deepEqual(missingCredentialLiveVerified.verifiedRequestKeys, ['challenge', 'proofOk']);

  const missingCredentialEligibility = buildModelAEligibilityResult({
    verifierResult: missingCredentialLiveVerified,
    accountBindingStatus: 'wallet_api_missing',
  });

  assert.equal(missingCredentialEligibility.ok, false);
  assert.equal(missingCredentialEligibility.eligibilityVerified, false);

  const missingCredentialBinding = bindModelAEligibilityToChallengeContext({
    eligibility: missingCredentialEligibility,
    nonce,
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(missingCredentialBinding.ok, false);
  assert.equal(missingCredentialBinding.bindingCode, 'eligibility_not_verified');
  assertBoundEligibilitySafetyFlags(missingCredentialBinding);

  const missingCredentialButPaid = composeModelAReleaseDecision({
    boundEligibility: missingCredentialBinding,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(missingCredentialButPaid.ok, false);
  assert.equal(missingCredentialButPaid.paymentSatisfied, true);
  assert.equal(missingCredentialButPaid.releaseAuthorized, false);
  assert.equal(missingCredentialButPaid.reason, 'eligibility_not_bound');
  assertCompositionNoSideEffects(missingCredentialButPaid);

  const wrongResourceChallenge = {
    ...fixtureChallenge,
    resource: {
      ...getRecord(fixtureChallenge, 'resource'),
      path: '/paid',
    },
  };

  const wrongResourceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce,
    challenge: wrongResourceChallenge,
    contract,
  });

  assert.equal(wrongResourceBinding.ok, false);
  assert.equal(wrongResourceBinding.bindingCode, 'policy_binding_mismatch');
  assertBoundEligibilitySafetyFlags(wrongResourceBinding);

  const wrongResourceButPaid = composeModelAReleaseDecision({
    boundEligibility: wrongResourceBinding,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(wrongResourceButPaid.ok, false);
  assert.equal(wrongResourceButPaid.paymentSatisfied, true);
  assert.equal(wrongResourceButPaid.releaseAuthorized, false);
  assert.equal(wrongResourceButPaid.reason, 'eligibility_not_bound');
  assertCompositionNoSideEffects(wrongResourceButPaid);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: 'wallet-proof-canonical.direct-buyer.sanitized.json',
        model: 'phase3-model-a',
        harness: 'phase3.liveBuyerProof.fixtureModelAReleaseComposition.v1',
        captureContract: captureContract.contract,
        normalizedEnvelopeAccepted: safeMetadata.ok,
        canonicalAuthorizationEnvelopeParsed: parsed.ok,
        liveVerifiedProofAcceptedByModelA: eligibility.ok,
        liveVerifiedEligibilityBound: bound.ok,
        fixtureEligibleButUnpaidDoesNotRelease: eligibleButUnpaid.releaseAuthorized === false,
        fixtureEligibleAndPaidWouldAuthorizeRelease: eligibleAndPaid.releaseAuthorized === true,
        unboundButPaidDoesNotRelease: unboundButPaid.releaseAuthorized === false,
        missingCredentialButPaidDoesNotRelease: missingCredentialButPaid.releaseAuthorized === false,
        wrongResourceButPaidDoesNotRelease: wrongResourceButPaid.releaseAuthorized === false,
        positiveReleaseReason: eligibleAndPaid.reason,
        unpaidReason: eligibleButUnpaid.reason,
        unboundReason: unboundButPaid.reason,
        missingCredentialReason: missingCredentialButPaid.reason,
        wrongResourceReason: wrongResourceButPaid.reason,
        paymentSource: eligibleAndPaid.paymentSource,
        releaseAuthorized: eligibleAndPaid.releaseAuthorized,
        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
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
