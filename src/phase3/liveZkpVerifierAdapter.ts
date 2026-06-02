import type {
  DirectBuyerAuthorizationEnvelope,
} from './authorizationEnvelope';
import {
  type ConcordiumZkpVerifierOptions,
  type ConcordiumZkpVerifierResult,
} from './concordiumZkpVerifier';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function safeKeys(value: unknown): string[] {
  return Object.keys(asRecord(value) ?? {}).sort();
}

function safeError(err: unknown): string {
  const msg = String((err as any)?.message ?? err);
  return msg.length > 500 ? msg.slice(0, 500) + '...' : msg;
}

function resolveConcordiumWalletChallengeBinding(input: {
  challengeHash: string;
  walletChallenge?: string | null;
  verifiedChallenge?: string | null;
}): {
  expectedChallenge: string;
  challengeBinding: 'walletChallenge' | 'challengeHash';
  matches: boolean | null;
} {
  const expectedChallenge = input.walletChallenge ?? input.challengeHash;
  const challengeBinding = input.walletChallenge ? 'walletChallenge' : 'challengeHash';

  return {
    expectedChallenge,
    challengeBinding,
    matches:
      input.verifiedChallenge === undefined || input.verifiedChallenge === null
        ? null
        : input.verifiedChallenge === expectedChallenge,
  };
}

function getGrpcPort(options: ConcordiumZkpVerifierOptions): number {
  return Number.isFinite(options.grpcPort) ? Number(options.grpcPort) : 20001;
}

export async function liveVerifyDirectBuyerEnvelope(
  envelope: DirectBuyerAuthorizationEnvelope,
  options: ConcordiumZkpVerifierOptions,
): Promise<ConcordiumZkpVerifierResult> {
  const grpcHost = options.grpcHost ?? '127.0.0.1';
  const grpcPort = getGrpcPort(options);
  const network = options.network ?? 'testnet';

  try {
    const grpcMod: any = await import('@concordium/web-sdk/nodejs');
    const sdkMod: any = await import('@concordium/web-sdk');
    const web3IdMod: any = await import('@concordium/web-sdk/web3-id');
    const wasmMod: any = await import('@concordium/web-sdk/wasm');

    const grpc = new grpcMod.ConcordiumGRPCNodeClient(
      grpcHost,
      grpcPort,
      grpcMod.credentials.createInsecure(),
    );

    const presentation = sdkMod.VerifiablePresentation.fromString(
      JSON.stringify(envelope.presentation),
    );

    const credentialMetadata = await web3IdMod.getPublicData(grpc, network, presentation);
    const publicData = credentialMetadata.map((x: any) => x.inputs);
    const cryptographicParameters = await grpc.getCryptographicParameters();

    const verifiedRequest = wasmMod.verifyPresentation(
      presentation,
      cryptographicParameters,
      publicData,
    );

    const verifiedRequestRecord = asRecord(verifiedRequest);
    const verifiedChallenge =
      typeof verifiedRequestRecord?.challenge === 'string'
        ? verifiedRequestRecord.challenge
        : undefined;

    const binding = resolveConcordiumWalletChallengeBinding({
      challengeHash: envelope.challengeHash,
      walletChallenge: envelope.walletChallenge,
      verifiedChallenge,
    });

    if (binding.matches === false) {
      return {
        ok: false,
        stage: 'verification_failed',
        envelopeType: envelope.type,
        challengeHash: envelope.challengeHash,
        expectedChallengeHash: envelope.challengeHash,
        proofType: envelope.proofType,
        network,
        grpcHost,
        grpcPort,
        credentialCount: credentialMetadata.length,
        verifiedRequestKeys: safeKeys(verifiedRequest),
        walletChallenge: envelope.walletChallenge ?? null,
        verifiedChallenge: verifiedChallenge ?? null,
        challengeBinding: binding.challengeBinding,
        delegatedAgentVerificationSupported: false,
        agentRegistryLookupAttempted: false,
        rawProofPrinted: false,
        reason: 'verified request challenge does not match expected wallet challenge binding',
      };
    }

    return {
      ok: true,
      stage: 'verified',
      envelopeType: envelope.type,
      challengeHash: envelope.challengeHash,
      expectedChallengeHash: envelope.challengeHash,
      proofType: envelope.proofType,
      network,
      grpcHost,
      grpcPort,
      credentialCount: credentialMetadata.length,
      verifiedRequestKeys: safeKeys(verifiedRequest),
      walletChallenge: envelope.walletChallenge ?? null,
      verifiedChallenge: verifiedChallenge ?? null,
      challengeBinding: binding.challengeBinding,
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
    };
  } catch (err) {
    return {
      ok: false,
      stage: 'verification_failed',
      envelopeType: envelope.type,
      challengeHash: envelope.challengeHash,
      expectedChallengeHash: envelope.challengeHash,
      proofType: envelope.proofType,
      network,
      grpcHost,
      grpcPort,
      walletChallenge: envelope.walletChallenge ?? null,
      verifiedChallenge: null,
      challengeBinding: envelope.walletChallenge ? 'walletChallenge' : 'challengeHash',
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
      reason: safeError(err),
    };
  }
}
