import { createHash } from 'node:crypto';

export type X402ZkpResource = {
  method: string;
  path: string;
};

export type X402ZkpAsset = {
  type: 'PLT' | string;
  tokenId: string;
  decimals: number;
};

export type X402ZkpContract = {
  contractId: string;
  contractVersion: string;
  isFrozen: boolean;
};

export type X402ZkpPolicy = {
  policyId: string;
  policyVersion: string;
  requirementsHash: string;
};

export type X402ZkpBusinessTerms = {
  termsId: string | null;
  termsVersion: string | null;
  termsHash: string | null;
  termsUri?: string | null;
  termsSchema?: string | null;
};

export type X402ZkpBuyerSubject = {
  buyerSubjectRef?: string | null;
  buyerAccountAddress?: string | null;
  buyerAccountId?: string | null;
  buyerCaip10AccountId?: string | null;
};

export type X402ZkpAgentRegistryRef = {
  registryStandard?: 'CIS-8004' | string | null;
  agentDid?: string | null;
  agentRegistryRef?: string | null;
  cis8004TokenRef?: string | null;
  cis8ExternalKeyRef?: string | null;
  agentCardHash?: string | null;
  agentCardUri?: string | null;
  agentRegistryContract?: string | null;
  agentRegistryTokenId?: string | null;
};

export type X402ZkpAgentSubject = {
  agentSubjectRef?: string | null;
  agentAccountAddress?: string | null;
  agentAccountId?: string | null;
  agentCaip10AccountId?: string | null;
  delegationId?: string | null;
  delegationScopeHash?: string | null;
  delegationExpiresAt?: number | null;
  delegationNonce?: string | null;
  agentSessionId?: string | null;
  registry?: X402ZkpAgentRegistryRef | null;
};

export type X402ZkpChallenge = {
  type: 'xcf.x402.zkp.challenge';
  version: '1.0.0';
  x402Version: 'x402-v2';

  merchantId: string;
  resource: X402ZkpResource;
  contract: X402ZkpContract;

  network: string;
  chain_id: string;
  caip2ChainId?: string | null;

  asset: X402ZkpAsset;
  amount: string;
  amountMinor: string;
  payTo: string;

  nonce: string;
  issuedAt: number;
  expiresAt: number;

  policy: X402ZkpPolicy;
  businessTerms: X402ZkpBusinessTerms;

  buyer?: X402ZkpBuyerSubject | null;
  agent?: X402ZkpAgentSubject | null;
};

export type BuildX402ZkpChallengeInput = {
  merchantId: string;
  resource: X402ZkpResource;
  contract: X402ZkpContract;

  network: string;
  chain_id: string;
  caip2ChainId?: string | null;

  asset: X402ZkpAsset;
  amount: string;
  amountMinor: string;
  payTo: string;

  nonce: string;
  issuedAt: number;
  expiresAt: number;

  policy: X402ZkpPolicy;
  businessTerms?: Partial<X402ZkpBusinessTerms> | null;

  buyer?: X402ZkpBuyerSubject | null;
  agent?: X402ZkpAgentSubject | null;
};

function assertNonEmptyString(name: string, value: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('[phase3:zkpChallenge] ' + name + ' must be a non-empty string');
  }
}

function assertIntegerSeconds(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('[phase3:zkpChallenge] ' + name + ' must be a positive integer timestamp');
  }
}

function assertNoUndefined(value: unknown, path = '$'): void {
  if (value === undefined) {
    throw new Error('[phase3:zkpChallenge] undefined is not allowed at ' + path);
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

export function buildX402ZkpChallenge(input: BuildX402ZkpChallengeInput): X402ZkpChallenge {
  assertNonEmptyString('merchantId', input.merchantId);
  assertNonEmptyString('resource.method', input.resource.method);
  assertNonEmptyString('resource.path', input.resource.path);
  assertNonEmptyString('contract.contractId', input.contract.contractId);
  assertNonEmptyString('contract.contractVersion', input.contract.contractVersion);
  assertNonEmptyString('network', input.network);
  assertNonEmptyString('chain_id', input.chain_id);
  assertNonEmptyString('asset.type', input.asset.type);
  assertNonEmptyString('asset.tokenId', input.asset.tokenId);
  assertNonEmptyString('amount', input.amount);
  assertNonEmptyString('amountMinor', input.amountMinor);
  assertNonEmptyString('payTo', input.payTo);
  assertNonEmptyString('nonce', input.nonce);
  assertNonEmptyString('policy.policyId', input.policy.policyId);
  assertNonEmptyString('policy.policyVersion', input.policy.policyVersion);
  assertNonEmptyString('policy.requirementsHash', input.policy.requirementsHash);
  assertIntegerSeconds('issuedAt', input.issuedAt);
  assertIntegerSeconds('expiresAt', input.expiresAt);

  if (input.expiresAt <= input.issuedAt) {
    throw new Error('[phase3:zkpChallenge] expiresAt must be greater than issuedAt');
  }

  const challenge: X402ZkpChallenge = {
    type: 'xcf.x402.zkp.challenge',
    version: '1.0.0',
    x402Version: 'x402-v2',

    merchantId: input.merchantId,
    resource: {
      method: input.resource.method.toUpperCase(),
      path: input.resource.path,
    },
    contract: {
      contractId: input.contract.contractId,
      contractVersion: input.contract.contractVersion,
      isFrozen: input.contract.isFrozen,
    },

    network: input.network,
    chain_id: input.chain_id,
    caip2ChainId: input.caip2ChainId ?? null,

    asset: {
      type: input.asset.type,
      tokenId: input.asset.tokenId,
      decimals: input.asset.decimals,
    },
    amount: input.amount,
    amountMinor: input.amountMinor,
    payTo: input.payTo,

    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,

    policy: {
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      requirementsHash: input.policy.requirementsHash,
    },

    businessTerms: {
      termsId: input.businessTerms?.termsId ?? null,
      termsVersion: input.businessTerms?.termsVersion ?? null,
      termsHash: input.businessTerms?.termsHash ?? null,
      termsUri: input.businessTerms?.termsUri ?? null,
      termsSchema: input.businessTerms?.termsSchema ?? null,
    },

    buyer: input.buyer ?? null,
    agent: input.agent ?? null,
  };

  assertNoUndefined(challenge);
  return challenge;
}

export function canonicalizeX402ZkpChallenge(value: unknown): string {
  assertNoUndefined(value);

  function stable(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);

    if (Array.isArray(v)) {
      return '[' + v.map(stable).join(',') + ']';
    }

    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stable(obj[k])).join(',') + '}';
  }

  return stable(value);
}

export function hashX402ZkpChallenge(challenge: X402ZkpChallenge): string {
  const canonical = canonicalizeX402ZkpChallenge(challenge);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function deriveWalletChallenge(challenge: X402ZkpChallenge): string {
  return hashX402ZkpChallenge(challenge);
}
