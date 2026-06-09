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
} from '../src/phase3/modelAEligibilityBinding';
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

function assertEligibilitySafetyFlags(result: ReturnType<typeof buildModelAEligibilityResult>): void {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function assertBindingSafetyFlags(result: ReturnType<typeof bindModelAEligibilityToChallengeContext>): void {
  assert.equal(result.releaseAuthorized, false);
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
    source: 'phase3-sanitized-fixture-model-a-binding-harness',
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
  assert.equal(eligibility.proofVerified, true);
  assert.equal(eligibility.eligibilityVerified, true);
  assert.equal(eligibility.challengeVerified, true);
  assert.equal(eligibility.credentialStatementsVerified, true);
  assert.equal(eligibility.verifierStage, 'verified');
  assertEligibilitySafetyFlags(eligibility);

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
  assertBindingSafetyFlags(bound);

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
  assert.equal(missingCredentialEligibility.credentialStatementsVerified, false);
  assert.equal(missingCredentialEligibility.eligibilityVerified, false);
  assertEligibilitySafetyFlags(missingCredentialEligibility);

  const missingCredentialBinding = bindModelAEligibilityToChallengeContext({
    eligibility: missingCredentialEligibility,
    nonce,
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(missingCredentialBinding.ok, false);
  assert.equal(missingCredentialBinding.bindingCode, 'eligibility_not_verified');
  assertBindingSafetyFlags(missingCredentialBinding);

  const challengeMismatch = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: '127.0.0.1',
      grpcPort: 1,
      network: 'testnet',
    },
    buildFakeLiveDeps(String(fixtureRecord.walletChallenge), 'wrong-wallet-challenge'),
  );

  assert.equal(challengeMismatch.ok, false);
  assert.equal(challengeMismatch.stage, 'verification_failed');
  assert.equal(challengeMismatch.reason, 'verified request challenge does not match expected wallet challenge binding');
  assert.equal(challengeMismatch.rawProofPrinted, false);

  const wrongNonceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: 'wrong-nonce',
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(wrongNonceBinding.ok, false);
  assert.equal(wrongNonceBinding.bindingCode, 'policy_binding_mismatch');
  assertBindingSafetyFlags(wrongNonceBinding);

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
  assertBindingSafetyFlags(wrongResourceBinding);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: 'wallet-proof-canonical.direct-buyer.sanitized.json',
        model: 'phase3-model-a',
        harness: 'phase3.liveBuyerProof.fixtureModelABinding.v1',
        captureContract: captureContract.contract,
        normalizedEnvelopeAccepted: safeMetadata.ok,
        canonicalAuthorizationEnvelopeParsed: parsed.ok,
        liveVerifiedProofAcceptedByModelA: eligibility.ok,
        liveVerifiedEligibilityBound: bound.ok,
        verifierStage: eligibility.verifierStage,
        challengeBinding: liveVerified.challengeBinding,
        credentialStatementsVerified: eligibility.credentialStatementsVerified,
        missingCredentialStatementsRejected: missingCredentialBinding.bindingCode,
        challengeMismatchRejected: challengeMismatch.stage,
        wrongNonceRejected: wrongNonceBinding.bindingCode,
        wrongResourceRejected: wrongResourceBinding.bindingCode,
        walletChallengeBound: liveVerified.walletChallenge === fixtureRecord.walletChallenge,
        verifiedChallengeBound: liveVerified.verifiedChallenge === fixtureRecord.walletChallenge,

        releaseAuthorized: false,
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
