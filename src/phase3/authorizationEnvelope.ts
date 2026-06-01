import {
  type X402ZkpChallenge,
  hashX402ZkpChallenge,
} from './zkpChallenge';

export type ConcordiumPresentationProofType =
  | 'concordium.VerifiablePresentation'
  | 'concordium.VerifiablePresentationV1'
  | string;

export type X402ZkpAuthorizationEnvelopeType =
  | 'xcf.concordium.authorization.direct-buyer.v1'
  | 'xcf.concordium.authorization.delegated-agent.v1';

export type DirectBuyerAuthorizationEnvelope = {
  type: 'xcf.concordium.authorization.direct-buyer.v1';
  challenge: X402ZkpChallenge;
  challengeHash: string;
  proofType: ConcordiumPresentationProofType;
  presentation: unknown;
  walletChallenge?: string | null;
  wallet?: {
    network?: string | null;
    selectedChain?: string | null;
    accountAddress?: string | null;
  } | null;
  submittedAt?: string | null;
};

export type DelegatedAgentAuthorizationEnvelope = {
  type: 'xcf.concordium.authorization.delegated-agent.v1';
  challenge: X402ZkpChallenge;
  challengeHash: string;
  buyerProof: {
    proofType: ConcordiumPresentationProofType;
    presentation: unknown;
  };
  agentAuthorization: {
    agentSubjectRef?: string | null;
    agentAccountId?: string | null;
    agentAccountAddress?: string | null;
    delegationId?: string | null;
    delegationScopeHash?: string | null;
    delegationExpiresAt?: number | null;
    agentSignature?: string | null;
  };
  agentRegistryRef?: string | null;
  cis8004TokenRef?: string | null;
  cis8ExternalKeyRef?: string | null;
  agentCardHash?: string | null;
  siwxSessionRef?: string | null;
  submittedAt?: string | null;
};

export type X402ZkpAuthorizationEnvelope =
  | DirectBuyerAuthorizationEnvelope
  | DelegatedAgentAuthorizationEnvelope;

export type ParsedAuthorizationEnvelope = {
  ok: true;
  envelope: X402ZkpAuthorizationEnvelope;
  type: X402ZkpAuthorizationEnvelopeType;
  challengeHash: string;
  expectedChallengeHash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(name: string, value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('[phase3:authorizationEnvelope] ' + name + ' must be an object');
  }
  return value;
}

function assertNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('[phase3:authorizationEnvelope] ' + name + ' must be a non-empty string');
  }
  return value;
}

function assertOptionalStringOrNull(name: string, value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('[phase3:authorizationEnvelope] ' + name + ' must be a string or null');
  }
  return value;
}

function assertOptionalNumberOrNull(name: string, value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('[phase3:authorizationEnvelope] ' + name + ' must be a number or null');
  }
  return value;
}

function assertNoUndefined(value: unknown, path = '$'): void {
  if (value === undefined) {
    throw new Error('[phase3:authorizationEnvelope] undefined is not allowed at ' + path);
  }

  if (value === null) return;

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoUndefined(v, path + '[' + i + ']'));
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefined(v, path + '.' + k);
    }
  }
}

function validateChallengeAndHash(obj: Record<string, unknown>): {
  challenge: X402ZkpChallenge;
  challengeHash: string;
  expectedChallengeHash: string;
} {
  const challenge = assertRecord('challenge', obj.challenge) as unknown as X402ZkpChallenge;
  const challengeHash = assertNonEmptyString('challengeHash', obj.challengeHash);
  const expectedChallengeHash = hashX402ZkpChallenge(challenge);

  if (challengeHash !== expectedChallengeHash) {
    throw new Error('[phase3:authorizationEnvelope] challengeHash does not match canonical challenge hash');
  }

  return { challenge, challengeHash, expectedChallengeHash };
}

function parseDirectBuyerEnvelope(obj: Record<string, unknown>): DirectBuyerAuthorizationEnvelope {
  const { challenge, challengeHash } = validateChallengeAndHash(obj);
  const proofType = assertNonEmptyString('proofType', obj.proofType);

  if (obj.presentation === undefined || obj.presentation === null) {
    throw new Error('[phase3:authorizationEnvelope] presentation is required');
  }

  let wallet: DirectBuyerAuthorizationEnvelope['wallet'] = null;
  if (obj.wallet !== undefined && obj.wallet !== null) {
    const w = assertRecord('wallet', obj.wallet);
    wallet = {
      network: assertOptionalStringOrNull('wallet.network', w.network) ?? null,
      selectedChain: assertOptionalStringOrNull('wallet.selectedChain', w.selectedChain) ?? null,
      accountAddress: assertOptionalStringOrNull('wallet.accountAddress', w.accountAddress) ?? null,
    };
  }

  const parsed: DirectBuyerAuthorizationEnvelope = {
    type: 'xcf.concordium.authorization.direct-buyer.v1',
    challenge,
    challengeHash,
    proofType,
    presentation: obj.presentation,
    walletChallenge: assertOptionalStringOrNull('walletChallenge', obj.walletChallenge) ?? null,
    wallet,
    submittedAt: assertOptionalStringOrNull('submittedAt', obj.submittedAt) ?? null,
  };

  assertNoUndefined(parsed);
  return parsed;
}

function parseDelegatedAgentEnvelope(obj: Record<string, unknown>): DelegatedAgentAuthorizationEnvelope {
  const { challenge, challengeHash } = validateChallengeAndHash(obj);

  const buyerProofRaw = assertRecord('buyerProof', obj.buyerProof);
  const proofType = assertNonEmptyString('buyerProof.proofType', buyerProofRaw.proofType);

  if (buyerProofRaw.presentation === undefined || buyerProofRaw.presentation === null) {
    throw new Error('[phase3:authorizationEnvelope] buyerProof.presentation is required');
  }

  const agentAuthorizationRaw = assertRecord('agentAuthorization', obj.agentAuthorization);

  const parsed: DelegatedAgentAuthorizationEnvelope = {
    type: 'xcf.concordium.authorization.delegated-agent.v1',
    challenge,
    challengeHash,
    buyerProof: {
      proofType,
      presentation: buyerProofRaw.presentation,
    },
    agentAuthorization: {
      agentSubjectRef: assertOptionalStringOrNull('agentAuthorization.agentSubjectRef', agentAuthorizationRaw.agentSubjectRef) ?? null,
      agentAccountId: assertOptionalStringOrNull('agentAuthorization.agentAccountId', agentAuthorizationRaw.agentAccountId) ?? null,
      agentAccountAddress:
        assertOptionalStringOrNull('agentAuthorization.agentAccountAddress', agentAuthorizationRaw.agentAccountAddress) ?? null,
      delegationId: assertOptionalStringOrNull('agentAuthorization.delegationId', agentAuthorizationRaw.delegationId) ?? null,
      delegationScopeHash:
        assertOptionalStringOrNull('agentAuthorization.delegationScopeHash', agentAuthorizationRaw.delegationScopeHash) ?? null,
      delegationExpiresAt:
        assertOptionalNumberOrNull('agentAuthorization.delegationExpiresAt', agentAuthorizationRaw.delegationExpiresAt) ?? null,
      agentSignature: assertOptionalStringOrNull('agentAuthorization.agentSignature', agentAuthorizationRaw.agentSignature) ?? null,
    },
    agentRegistryRef: assertOptionalStringOrNull('agentRegistryRef', obj.agentRegistryRef) ?? null,
    cis8004TokenRef: assertOptionalStringOrNull('cis8004TokenRef', obj.cis8004TokenRef) ?? null,
    cis8ExternalKeyRef: assertOptionalStringOrNull('cis8ExternalKeyRef', obj.cis8ExternalKeyRef) ?? null,
    agentCardHash: assertOptionalStringOrNull('agentCardHash', obj.agentCardHash) ?? null,
    siwxSessionRef: assertOptionalStringOrNull('siwxSessionRef', obj.siwxSessionRef) ?? null,
    submittedAt: assertOptionalStringOrNull('submittedAt', obj.submittedAt) ?? null,
  };

  assertNoUndefined(parsed);
  return parsed;
}

export function parseAuthorizationEnvelope(input: unknown): ParsedAuthorizationEnvelope {
  const obj = assertRecord('authorization envelope', input);
  const type = assertNonEmptyString('type', obj.type) as X402ZkpAuthorizationEnvelopeType;

  let envelope: X402ZkpAuthorizationEnvelope;

  if (type === 'xcf.concordium.authorization.direct-buyer.v1') {
    envelope = parseDirectBuyerEnvelope(obj);
  } else if (type === 'xcf.concordium.authorization.delegated-agent.v1') {
    envelope = parseDelegatedAgentEnvelope(obj);
  } else {
    throw new Error('[phase3:authorizationEnvelope] unsupported envelope type: ' + type);
  }

  const expectedChallengeHash = hashX402ZkpChallenge(envelope.challenge);

  return {
    ok: true,
    envelope,
    type,
    challengeHash: envelope.challengeHash,
    expectedChallengeHash,
  };
}
