import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function parseLastJsonObject(output: string): Record<string, unknown> {
  const start = output.lastIndexOf('{');
  assert.notEqual(start, -1, 'expected JSON object in harness stdout');

  return JSON.parse(output.slice(start));
}

function main() {
  const fixturePath = path.join(
    process.cwd(),
    'fixtures',
    'phase3',
    'wallet-proof-example.direct-buyer.json',
  );

  const result = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      path.join(process.cwd(), 'scripts', 'phase3-wallet-proof-capture-harness.ts'),
      fixturePath,
    ],
    {
      env: {
        ...process.env,
        PHASE3_WALLET_PROOF_CAPTURE_HARNESS: 'true',
      },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const metadata = parseLastJsonObject(result.stdout);

  assert.equal(metadata.ok, true);
  assert.equal(metadata.normalized, true);
  assert.equal(metadata.envelopeType, 'xcf.concordium.authorization.direct-buyer.v1');
  assert.equal(metadata.proofType, 'concordium.VerifiablePresentation');
  assert.equal(metadata.challengeHashPresent, true);
  assert.equal(metadata.presentationKind, 'object');
  assert.equal(metadata.walletChallengePresent, true);
  assert.equal(metadata.walletPresent, true);
  assert.equal(metadata.walletNetworkPresent, true);
  assert.equal(metadata.walletSelectedChainPresent, true);
  assert.equal(metadata.walletAccountAddressPresent, true);
  assert.equal(metadata.validationStage, 'accepted');
  assert.equal(metadata.validationReason, null);

  assert.equal(metadata.rawProofPrinted, false);
  assert.equal(metadata.persisted, false);
  assert.equal(metadata.paymentReleaseAttempted, false);
  assert.equal(metadata.paymentResponseEmitted, false);
  assert.equal(metadata.crpCalled, false);
  assert.equal(metadata.replayTouched, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixtureAccepted: metadata.ok,
        validationStage: metadata.validationStage,
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
