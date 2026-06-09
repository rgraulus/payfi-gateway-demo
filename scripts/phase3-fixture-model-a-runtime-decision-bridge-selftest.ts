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
  buildPhase3GatewayReleaseDecision,
} from '../src/phase3/gatewayReleaseDecisionAdapter';
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
  buildX402ReceiptPaymentSatisfaction,
} from '../src/phase3/x402ReceiptPaymentSignal';
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

function assertBoundEligibilitySafetyFlags(result: ModelAEligibilityBindingResult): void {
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function assertGatewayDecisionSafetyFlags(result: ReturnType<typeof buildPhase3GatewayReleaseDecision>): void {
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
  assert.equal(result.rawReceiptPrinted, false);
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

function buildFakeLiveDeps(expectedPresentationContext: string): LiveZkpSdkInvocationDeps {
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
        challenge: expectedPresentationContext,
        credentialStatements: [{ statement: 'age-region-v1' }],
      };
    },
  };
}

async function buildFixtureBackedBoundEligibility() {
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
    source: 'phase3-fixture-model-a-runtime-decision-bridge-harness',
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

  const wrongNonceBinding = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce: 'wrong-nonce',
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(wrongNonceBinding.ok, false);
  assert.equal(wrongNonceBinding.bindingCode, 'policy_binding_mismatch');
  assertBoundEligibilitySafetyFlags(wrongNonceBinding);

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

  return {
    captureContract,
    safeMetadata,
    parsed,
    bound,
    wrongNonceBinding,
    wrongResourceBinding,
  };
}

function acceptedReceiptPayment() {
  return buildX402ReceiptPaymentSatisfaction({
    receipt: {
      ok: true,
      source: 'x402-receipt',
      receiptVerified: true,
      settlementStatus: 'finalized',
      receiptExpired: false,
      rawReceiptPrinted: false,
    },
  });
}

function unpaidReceiptPayment() {
  return buildX402ReceiptPaymentSatisfaction({
    receipt: {
      ok: true,
      source: 'x402-receipt',
      receiptVerified: true,
      settlementStatus: 'pending',
      receiptExpired: false,
      rawReceiptPrinted: false,
    },
  });
}

async function main() {
  const fixtureBacked = await buildFixtureBackedBoundEligibility();

  const allowed = buildPhase3GatewayReleaseDecision({
    boundEligibility: fixtureBacked.bound,
    payment: acceptedReceiptPayment(),
  });

  assert.equal(allowed.ok, true);
  assert.equal(allowed.model, 'phase3-model-a');
  assert.equal(allowed.releaseAuthorized, true);
  assert.equal(allowed.reason, 'release_authorized');
  assert.equal(allowed.eligibilityVerified, true);
  assert.equal(allowed.challengeBound, true);
  assert.equal(allowed.resourceBound, true);
  assert.equal(allowed.paymentSatisfied, true);
  assert.equal(allowed.paymentSource, 'x402-receipt');
  assert.equal(allowed.receiptSignalAccepted, true);
  assert.equal(allowed.receiptVerified, true);
  assert.equal(allowed.settlementStatus, 'finalized');
  assert.equal(allowed.receiptExpired, false);
  assert.equal(allowed.receiptContextMatched, true);
  assert.equal(allowed.receiptContextMismatchField, null);
  assert.equal(allowed.paymentResponseAllowed, true);
  assert.equal(allowed.resourceReleaseAllowed, true);
  assertGatewayDecisionSafetyFlags(allowed);

  const eligibleButUnpaid = buildPhase3GatewayReleaseDecision({
    boundEligibility: fixtureBacked.bound,
    payment: unpaidReceiptPayment(),
  });

  assert.equal(eligibleButUnpaid.ok, false);
  assert.equal(eligibleButUnpaid.releaseAuthorized, false);
  assert.equal(eligibleButUnpaid.reason, 'settlement_not_finalized');
  assert.equal(eligibleButUnpaid.eligibilityVerified, true);
  assert.equal(eligibleButUnpaid.challengeBound, true);
  assert.equal(eligibleButUnpaid.resourceBound, true);
  assert.equal(eligibleButUnpaid.paymentSatisfied, false);
  assert.equal(eligibleButUnpaid.paymentSource, 'x402-receipt');
  assert.equal(eligibleButUnpaid.receiptSignalAccepted, false);
  assert.equal(eligibleButUnpaid.paymentResponseAllowed, false);
  assert.equal(eligibleButUnpaid.resourceReleaseAllowed, false);
  assertGatewayDecisionSafetyFlags(eligibleButUnpaid);

  const wrongNonceButPaid = buildPhase3GatewayReleaseDecision({
    boundEligibility: fixtureBacked.wrongNonceBinding,
    payment: acceptedReceiptPayment(),
  });

  assert.equal(wrongNonceButPaid.ok, false);
  assert.equal(wrongNonceButPaid.releaseAuthorized, false);
  assert.equal(wrongNonceButPaid.reason, 'eligibility_not_bound');
  assert.equal(wrongNonceButPaid.eligibilityVerified, true);
  assert.equal(wrongNonceButPaid.challengeBound, false);
  assert.equal(wrongNonceButPaid.resourceBound, false);
  assert.equal(wrongNonceButPaid.paymentSatisfied, true);
  assert.equal(wrongNonceButPaid.paymentResponseAllowed, false);
  assert.equal(wrongNonceButPaid.resourceReleaseAllowed, false);
  assertGatewayDecisionSafetyFlags(wrongNonceButPaid);

  const wrongResourceButPaid = buildPhase3GatewayReleaseDecision({
    boundEligibility: fixtureBacked.wrongResourceBinding,
    payment: acceptedReceiptPayment(),
  });

  assert.equal(wrongResourceButPaid.ok, false);
  assert.equal(wrongResourceButPaid.releaseAuthorized, false);
  assert.equal(wrongResourceButPaid.reason, 'eligibility_not_bound');
  assert.equal(wrongResourceButPaid.eligibilityVerified, true);
  assert.equal(wrongResourceButPaid.challengeBound, false);
  assert.equal(wrongResourceButPaid.resourceBound, false);
  assert.equal(wrongResourceButPaid.paymentSatisfied, true);
  assert.equal(wrongResourceButPaid.paymentResponseAllowed, false);
  assert.equal(wrongResourceButPaid.resourceReleaseAllowed, false);
  assertGatewayDecisionSafetyFlags(wrongResourceButPaid);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: 'wallet-proof-canonical.direct-buyer.sanitized.json',
        model: 'phase3-model-a',
        harness: 'phase3.fixtureModelA.runtimeDecisionBridge.v1',
        captureContract: fixtureBacked.captureContract.contract,
        normalizedEnvelopeAccepted: fixtureBacked.safeMetadata.ok,
        canonicalAuthorizationEnvelopeParsed: fixtureBacked.parsed.ok,
        fixtureBackedEligibilityBound: fixtureBacked.bound.ok,

        gatewayReleaseDecisionAuthorized: allowed.releaseAuthorized,
        gatewayPaymentResponseAllowed: allowed.paymentResponseAllowed,
        gatewayResourceReleaseAllowed: allowed.resourceReleaseAllowed,
        gatewayDecisionReason: allowed.reason,
        gatewayPaymentSource: allowed.paymentSource,

        eligibleButUnpaidDoesNotRelease: eligibleButUnpaid.releaseAuthorized === false,
        eligibleButUnpaidReason: eligibleButUnpaid.reason,
        wrongNonceButPaidDoesNotRelease: wrongNonceButPaid.releaseAuthorized === false,
        wrongNonceReason: wrongNonceButPaid.reason,
        wrongResourceButPaidDoesNotRelease: wrongResourceButPaid.releaseAuthorized === false,
        wrongResourceReason: wrongResourceButPaid.reason,

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
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
