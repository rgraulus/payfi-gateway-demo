import type {
  DirectBuyerAuthorizationEnvelope,
} from './authorizationEnvelope';
import {
  type ConcordiumZkpVerifierOptions,
  type ConcordiumZkpVerifierResult,
} from './concordiumZkpVerifier';

export type LiveDirectBuyerProofFixtureContract = {
  type: 'xcf.concordium.authorization.direct-buyer.v1';
  proofType: 'concordium.VerifiablePresentation';
  challengeHash: string;
  presentation: Record<string, unknown> | string;
  walletChallenge?: string | null;
  wallet?: {
    network?: string | null;
    selectedChain?: string | null;
    accountAddress?: string | null;
  } | null;
};

export type LiveZkpSdkInvocationDeps = {
  createGrpcClient(input: {
    grpcHost: string;
    grpcPort: number;
  }): unknown;
  parsePresentation(input: {
    presentation: unknown;
  }): unknown;
  getPublicData(input: {
    grpc: unknown;
    network: string;
    presentation: unknown;
  }): Promise<Array<{ inputs?: unknown }> | Array<Record<string, unknown>>>;
  getCryptographicParameters(input: {
    grpc: unknown;
  }): Promise<unknown>;
  verifyPresentation(input: {
    presentation: unknown;
    cryptographicParameters: unknown;
    publicData: unknown[];
  }): unknown;
};

function getStringField(value: unknown, key: string): string | undefined {
  const record = asRecord(value);
  return typeof record?.[key] === 'string' ? record[key] : undefined;
}

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

function liveVerificationFailedClosed(input: {
  envelope: unknown;
  options: ConcordiumZkpVerifierOptions;
  reason: string;
  verifiedChallenge?: string | null;
  challengeBinding?: 'walletChallenge' | 'challengeHash' | 'not_checked';
}): ConcordiumZkpVerifierResult {
  const grpcHost = input.options.grpcHost ?? '127.0.0.1';
  const grpcPort = getGrpcPort(input.options);
  const network = input.options.network ?? 'testnet';

  return {
    ok: false,
    stage: 'verification_failed',
    envelopeType: getStringField(input.envelope, 'type'),
    challengeHash: getStringField(input.envelope, 'challengeHash'),
    expectedChallengeHash: getStringField(input.envelope, 'challengeHash'),
    proofType: getStringField(input.envelope, 'proofType'),
    network,
    grpcHost,
    grpcPort,
    walletChallenge: getStringField(input.envelope, 'walletChallenge') ?? null,
    verifiedChallenge: input.verifiedChallenge ?? null,
    challengeBinding:
      input.challengeBinding ??
      (getStringField(input.envelope, 'walletChallenge') ? 'walletChallenge' : 'challengeHash'),
    delegatedAgentVerificationSupported: false,
    agentRegistryLookupAttempted: false,
    rawProofPrinted: false,
    reason: input.reason,
  };
}

function isOptionalStringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

export function validateLiveDirectBuyerProofFixtureContract(
  envelope: unknown,
  options: ConcordiumZkpVerifierOptions = {},
): ConcordiumZkpVerifierResult | null {
  const record = asRecord(envelope);

  if (!record) {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input envelope must be an object',
      challengeBinding: 'not_checked',
    });
  }

  if (record.type !== 'xcf.concordium.authorization.direct-buyer.v1') {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input type must be direct-buyer v1',
      challengeBinding: 'not_checked',
    });
  }

  if (record.proofType !== 'concordium.VerifiablePresentation') {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input proofType must be concordium.VerifiablePresentation',
    });
  }

  if (typeof record.challengeHash !== 'string' || record.challengeHash.length === 0) {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input challengeHash must be a non-empty string',
    });
  }

  if (record.presentation === null || record.presentation === undefined) {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input presentation is required',
    });
  }

  if (!asRecord(record.presentation) && typeof record.presentation !== 'string') {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input presentation must be an object or string',
    });
  }

  if (!isOptionalStringOrNull(record.walletChallenge)) {
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: 'live verifier input walletChallenge must be a string or null',
    });
  }

  if (record.wallet !== undefined && record.wallet !== null) {
    const wallet = asRecord(record.wallet);
    if (!wallet) {
      return liveVerificationFailedClosed({
        envelope,
        options,
        reason: 'live verifier input wallet must be an object or null',
      });
    }

    for (const key of ['network', 'selectedChain', 'accountAddress']) {
      if (!isOptionalStringOrNull(wallet[key])) {
        return liveVerificationFailedClosed({
          envelope,
          options,
          reason: `live verifier input wallet.${key} must be a string or null`,
        });
      }
    }
  }

  return null;
}

async function loadDefaultLiveZkpSdkInvocationDeps(): Promise<LiveZkpSdkInvocationDeps> {
  const grpcMod: any = await import('@concordium/web-sdk/nodejs');
  const sdkMod: any = await import('@concordium/web-sdk');
  const web3IdMod: any = await import('@concordium/web-sdk/web3-id');
  const wasmMod: any = await import('@concordium/web-sdk/wasm');

  return {
    createGrpcClient(input) {
      return new grpcMod.ConcordiumGRPCNodeClient(
        input.grpcHost,
        input.grpcPort,
        grpcMod.credentials.createInsecure(),
      );
    },
    parsePresentation(input) {
      return sdkMod.VerifiablePresentation.fromString(JSON.stringify(input.presentation));
    },
    async getPublicData(input) {
      return web3IdMod.getPublicData(input.grpc, input.network, input.presentation);
    },
    async getCryptographicParameters(input) {
      const grpc = input.grpc as { getCryptographicParameters(): Promise<unknown> };
      return grpc.getCryptographicParameters();
    },
    verifyPresentation(input) {
      return wasmMod.verifyPresentation(
        input.presentation,
        input.cryptographicParameters,
        input.publicData,
      );
    },
  };
}

export async function liveVerifyDirectBuyerEnvelopeWithDeps(
  envelope: DirectBuyerAuthorizationEnvelope,
  options: ConcordiumZkpVerifierOptions,
  deps: LiveZkpSdkInvocationDeps,
): Promise<ConcordiumZkpVerifierResult> {
  return liveVerifyDirectBuyerEnvelopeInternal(envelope, options, deps);
}

export async function liveVerifyDirectBuyerEnvelope(
  envelope: DirectBuyerAuthorizationEnvelope,
  options: ConcordiumZkpVerifierOptions,
): Promise<ConcordiumZkpVerifierResult> {
  return liveVerifyDirectBuyerEnvelopeInternal(
    envelope,
    options,
    await loadDefaultLiveZkpSdkInvocationDeps(),
  );
}

async function liveVerifyDirectBuyerEnvelopeInternal(
  envelope: DirectBuyerAuthorizationEnvelope,
  options: ConcordiumZkpVerifierOptions,
  deps: LiveZkpSdkInvocationDeps,
): Promise<ConcordiumZkpVerifierResult> {
  const grpcHost = options.grpcHost ?? '127.0.0.1';
  const grpcPort = getGrpcPort(options);
  const network = options.network ?? 'testnet';

  const boundaryFailure = validateLiveDirectBuyerProofFixtureContract(envelope, options);
  if (boundaryFailure) {
    return boundaryFailure;
  }

  try {
    const grpc = deps.createGrpcClient({ grpcHost, grpcPort });
    const presentation = deps.parsePresentation({ presentation: envelope.presentation });
    const credentialMetadata = await deps.getPublicData({ grpc, network, presentation });
    const publicData = credentialMetadata.map((x: any) => x.inputs);
    const cryptographicParameters = await deps.getCryptographicParameters({ grpc });
    const verifiedRequest = deps.verifyPresentation({
      presentation,
      cryptographicParameters,
      publicData,
    });

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
    return liveVerificationFailedClosed({
      envelope,
      options,
      reason: safeError(err),
    });
  }
}
