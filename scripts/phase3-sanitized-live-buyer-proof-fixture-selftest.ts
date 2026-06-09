import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseAuthorizationEnvelope,
} from '../src/phase3/authorizationEnvelope';
import {
  validateLiveDirectBuyerProofFixtureContract,
} from '../src/phase3/liveZkpVerifierAdapter';
import {
  hashX402ZkpChallenge,
} from '../src/phase3/zkpChallenge';

function asRecord(value: unknown, name: string): Record<string, unknown> {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true, name + ' must be an object');
  return value as Record<string, unknown>;
}

function main() {
  const fixturePath = path.join(
    process.cwd(),
    'fixtures',
    'phase3',
    'wallet-proof-canonical.direct-buyer.sanitized.json',
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const fixtureRecord = asRecord(fixture, 'fixture');
  const challenge = asRecord(fixtureRecord.challenge, 'fixture.challenge');
  const presentation = asRecord(fixtureRecord.presentation, 'fixture.presentation');
  const fixtureSafety = asRecord(fixtureRecord.fixtureSafety, 'fixture.fixtureSafety');

  assert.equal(fixtureRecord.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(fixtureRecord.proofType, 'concordium.VerifiablePresentation');

  const computedChallengeHash = hashX402ZkpChallenge(challenge as any);
  assert.equal(fixtureRecord.challengeHash, computedChallengeHash);
  assert.equal(fixtureRecord.walletChallenge, computedChallengeHash);
  assert.equal(presentation.presentationContext, computedChallengeHash);

  assert.equal(presentation.sanitized, true);
  assert.equal(presentation.rawProofMaterialPresent, false);
  assert.match(String(presentation.note), /not real wallet proof material/i);

  assert.equal(fixtureSafety.sanitized, true);
  assert.equal(fixtureSafety.rawProofMaterial, false);
  assert.equal(fixtureSafety.rawReceiptMaterial, false);
  assert.equal(fixtureSafety.productionReleaseAuthorized, false);
  assert.equal(fixtureSafety.gatewayRuntimeMutated, false);
  assert.equal(fixtureSafety.persisted, false);
  assert.equal(fixtureSafety.crpCalled, false);
  assert.equal(fixtureSafety.paymentAttempted, false);
  assert.equal(fixtureSafety.paymentResponseEmitted, false);
  assert.equal(fixtureSafety.replayTouched, false);

  const parsed = parseAuthorizationEnvelope(fixture);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(parsed.challengeHash, computedChallengeHash);
  assert.equal(parsed.expectedChallengeHash, computedChallengeHash);

  if (parsed.envelope.type !== 'xcf.concordium.authorization.direct-buyer.v1') {
    throw new Error('expected direct Buyer envelope');
  }

  assert.equal(parsed.envelope.walletChallenge, computedChallengeHash);
  assert.equal(parsed.envelope.wallet?.network, 'testnet');
  assert.equal(parsed.envelope.wallet?.selectedChain, 'concordium:testnet');
  assert.equal(parsed.envelope.wallet?.accountAddress, '4SanitizedCanonicalBuyerAccountAddressNotReal');

  const adapterValidation = validateLiveDirectBuyerProofFixtureContract(parsed.envelope, {
    liveVerify: true,
    grpcHost: '127.0.0.1',
    grpcPort: 1,
    network: 'testnet',
  });

  assert.equal(adapterValidation, null);

  assert.throws(
    () =>
      parseAuthorizationEnvelope({
        ...fixture,
        challengeHash: '0'.repeat(64),
      }),
    /challengeHash does not match canonical challenge hash/,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: 'wallet-proof-canonical.direct-buyer.sanitized.json',
        envelopeType: parsed.type,
        challengeHash: computedChallengeHash,
        canonicalAuthorizationEnvelopeParsed: true,
        liveAdapterBoundaryAccepted: adapterValidation === null,
        walletChallengeBound: parsed.envelope.walletChallenge === computedChallengeHash,
        presentationContextBound: presentation.presentationContext === computedChallengeHash,
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

main();
