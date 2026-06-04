import fs from 'node:fs';

import {
  validateLiveDirectBuyerProofFixtureContract,
} from '../src/phase3/liveZkpVerifierAdapter';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function presentationKind(value: unknown): 'object' | 'string' | 'missing' | 'unsupported' {
  if (value === undefined || value === null) return 'missing';
  if (typeof value === 'string') return 'string';
  if (isRecord(value)) return 'object';
  return 'unsupported';
}

export function normalizeWalletProofCapture(input: unknown): unknown {
  const record = isRecord(input) ? input : {};

  // Prefer an already-normalized Direct Buyer authorization envelope.
  if (record.type === 'xcf.concordium.authorization.direct-buyer.v1') {
    return record;
  }

  // Accept a common capture wrapper shape without making it a production contract.
  const authorizationProof = isRecord(record.authorizationProof) ? record.authorizationProof : null;
  if (authorizationProof?.type === 'xcf.concordium.authorization.direct-buyer.v1') {
    return authorizationProof;
  }

  // Accept a raw wallet capture with the core fields at top level.
  return {
    type: 'xcf.concordium.authorization.direct-buyer.v1',
    challenge: record.challenge,
    challengeHash: record.challengeHash,
    proofType: record.proofType ?? 'concordium.VerifiablePresentation',
    presentation: record.presentation,
    walletChallenge: record.walletChallenge ?? null,
    wallet: record.wallet ?? null,
    submittedAt: record.submittedAt ?? null,
  };
}

export function buildSafeMetadata(envelope: unknown, validation: ReturnType<typeof validateLiveDirectBuyerProofFixtureContract>) {
  const record = isRecord(envelope) ? envelope : {};
  const wallet = isRecord(record.wallet) ? record.wallet : null;

  return {
    ok: validation === null,
    normalized: true,
    envelopeType: safeString(record.type),
    proofType: safeString(record.proofType),
    challengeHashPresent: typeof record.challengeHash === 'string' && record.challengeHash.length > 0,
    challengeHashLength: typeof record.challengeHash === 'string' ? record.challengeHash.length : 0,
    presentationKind: presentationKind(record.presentation),
    walletChallengePresent: typeof record.walletChallenge === 'string' && record.walletChallenge.length > 0,
    walletPresent: wallet !== null,
    walletNetworkPresent: typeof wallet?.network === 'string' && wallet.network.length > 0,
    walletSelectedChainPresent: typeof wallet?.selectedChain === 'string' && wallet.selectedChain.length > 0,
    walletAccountAddressPresent: typeof wallet?.accountAddress === 'string' && wallet.accountAddress.length > 0,
    validationStage: validation?.stage ?? 'accepted',
    validationReason: validation?.reason ?? null,
    rawProofPrinted: false,
    persisted: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
  };
}

function main() {
  if (String(process.env.PHASE3_WALLET_PROOF_CAPTURE_HARNESS ?? '').toLowerCase() !== 'true') {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'harness_disabled',
          reason: 'Set PHASE3_WALLET_PROOF_CAPTURE_HARNESS=true to run this dev-only harness.',
          rawProofPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'missing_input_file',
          reason: 'Usage: PHASE3_WALLET_PROOF_CAPTURE_HARNESS=true npm run phase3:wallet-proof-capture -- <wallet-proof.json>',
          rawProofPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let rawInput: string;
  try {
    rawInput = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'input_read_failed',
          reason: String((err as any)?.message ?? err),
          rawProofPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: 'invalid_json',
          reason: String((err as any)?.message ?? err),
          rawProofPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const envelope = normalizeWalletProofCapture(parsed);
  const validation = validateLiveDirectBuyerProofFixtureContract(envelope, {
    liveVerify: true,
    grpcHost: process.env.PHASE3_GRPC_HOST ?? '127.0.0.1',
    grpcPort: process.env.PHASE3_GRPC_PORT ? Number(process.env.PHASE3_GRPC_PORT) : 1,
    network: process.env.PHASE3_CONCORDIUM_NETWORK ?? 'testnet',
  });

  const safeMetadata = buildSafeMetadata(envelope, validation);

  console.log(JSON.stringify(safeMetadata, null, 2));

  if (validation !== null) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
