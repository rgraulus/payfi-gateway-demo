import {
  parseAuthorizationEnvelope,
  type DirectBuyerAuthorizationEnvelope,
  type X402ZkpAuthorizationEnvelope,
} from './authorizationEnvelope';
import { liveVerifyDirectBuyerEnvelope } from './liveZkpVerifierAdapter';

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
  walletChallenge?: string | null;
  verifiedChallenge?: string | null;
  challengeBinding?: 'walletChallenge' | 'challengeHash' | 'not_checked';
  delegatedAgentVerificationSupported: false;
  agentRegistryLookupAttempted: false;
  rawProofPrinted: false;
  reason?: string;
};

function safeError(err: unknown): string {
  const msg = String((err as any)?.message ?? err);
  return msg.length > 500 ? msg.slice(0, 500) + '...' : msg;
}

function isSupportedCurrentPresentation(proofType: string): boolean {
  return proofType === 'concordium.VerifiablePresentation';
}

export function resolveConcordiumWalletChallengeBinding(input: {
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

function parsedOnlyResult(envelope: DirectBuyerAuthorizationEnvelope): ConcordiumZkpVerifierResult {
  return {
    ok: true,
    stage: 'parsed',
    envelopeType: envelope.type,
    challengeHash: envelope.challengeHash,
    expectedChallengeHash: envelope.challengeHash,
    proofType: envelope.proofType,
    walletChallenge: envelope.walletChallenge ?? null,
    verifiedChallenge: null,
    challengeBinding: 'not_checked',
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
