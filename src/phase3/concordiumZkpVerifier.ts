import {
  parseAuthorizationEnvelope,
  type DirectBuyerAuthorizationEnvelope,
  type X402ZkpAuthorizationEnvelope,
} from './authorizationEnvelope';

type SafeVerificationStage =
  | 'parsed'
  | 'verified'
  | 'delegated_not_supported'
  | 'unsupported_proof_type'
  | 'verification_failed';

export type ConcordiumZkpVerifierOptions = {
  liveVerify?: boolean;
  grpcHost?: string;
  grpcPort?: number;
  network?: string;
};

export type ConcordiumZkpVerifierResult = {
  ok: boolean;
  stage: SafeVerificationStage;
  envelopeType?: string;
  challengeHash?: string;
  expectedChallengeHash?: string;
  proofType?: string;
  network?: string;
  grpcHost?: string;
  grpcPort?: number;
  credentialCount?: number;
  verifiedRequestKeys?: string[];
  delegatedAgentVerificationSupported: false;
  agentRegistryLookupAttempted: false;
  rawProofPrinted: false;
  reason?: string;
};

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

function isSupportedCurrentPresentation(proofType: string): boolean {
  return proofType === 'concordium.VerifiablePresentation';
}

function getGrpcPort(options: ConcordiumZkpVerifierOptions): number {
  return Number.isFinite(options.grpcPort) ? Number(options.grpcPort) : 20001;
}

async function liveVerifyDirectBuyerEnvelope(
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

    if (verifiedChallenge !== undefined && verifiedChallenge !== envelope.challengeHash) {
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
        delegatedAgentVerificationSupported: false,
        agentRegistryLookupAttempted: false,
        rawProofPrinted: false,
        reason: 'verified request challenge does not match envelope challengeHash',
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
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
      reason: safeError(err),
    };
  }
}

function parsedOnlyResult(envelope: DirectBuyerAuthorizationEnvelope): ConcordiumZkpVerifierResult {
  return {
    ok: true,
    stage: 'parsed',
    envelopeType: envelope.type,
    challengeHash: envelope.challengeHash,
    expectedChallengeHash: envelope.challengeHash,
    proofType: envelope.proofType,
    delegatedAgentVerificationSupported: false,
    agentRegistryLookupAttempted: false,
    rawProofPrinted: false,
  };
}

export async function verifyConcordiumZkpAuthorizationEnvelope(
  input: unknown,
  options: ConcordiumZkpVerifierOptions = {},
): Promise<ConcordiumZkpVerifierResult> {
  let parsed;
  try {
    parsed = parseAuthorizationEnvelope(input);
  } catch (err) {
    return {
      ok: false,
      stage: 'verification_failed',
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
      reason: safeError(err),
    };
  }

  const envelope: X402ZkpAuthorizationEnvelope = parsed.envelope;

  if (envelope.type === 'xcf.concordium.authorization.delegated-agent.v1') {
    return {
      ok: false,
      stage: 'delegated_not_supported',
      envelopeType: envelope.type,
      challengeHash: envelope.challengeHash,
      expectedChallengeHash: parsed.expectedChallengeHash,
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
      reason: 'delegated-agent envelopes are parsed but not cryptographically verified in PR #93',
    };
  }

  if (!isSupportedCurrentPresentation(envelope.proofType)) {
    return {
      ok: false,
      stage: 'unsupported_proof_type',
      envelopeType: envelope.type,
      challengeHash: envelope.challengeHash,
      expectedChallengeHash: parsed.expectedChallengeHash,
      proofType: envelope.proofType,
      delegatedAgentVerificationSupported: false,
      agentRegistryLookupAttempted: false,
      rawProofPrinted: false,
      reason: 'PR #93 supports current Concordium VerifiablePresentation only',
    };
  }

  if (!options.liveVerify) {
    return parsedOnlyResult(envelope);
  }

  return liveVerifyDirectBuyerEnvelope(envelope, options);
}
