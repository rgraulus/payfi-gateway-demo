import { randomUUID } from 'crypto';
import type { SiwAuthChallenge, SiwChallengeScope } from './types';

export type BuildSiwChallengeArgs = {
  chainId: string;
  accountId: string;
  scope: SiwChallengeScope;
  nowSec?: number;
  ttlSec: number;
};

function buildSiwMessage(args: {
  chainId: string;
  accountId: string;
  challengeId: string;
  nonce: string;
  scope: SiwChallengeScope;
  issuedAt: number;
  expiresAt: number;
}): string {
  return [
    'payfi-gateway-demo wants you to sign in with your wallet',
    `Chain ID: ${args.chainId}`,
    `Account ID: ${args.accountId}`,
    `Challenge ID: ${args.challengeId}`,
    `Nonce: ${args.nonce}`,
    `Resource: ${args.scope.resourceMethod.toUpperCase()} ${args.scope.resourcePath}`,
    `Issued At: ${args.issuedAt}`,
    `Expires At: ${args.expiresAt}`,
  ].join('\n');
}

export function buildSiwChallenge(args: BuildSiwChallengeArgs): SiwAuthChallenge {
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000);
  const issuedAt = nowSec;
  const expiresAt = nowSec + args.ttlSec;

  const challengeId = randomUUID();
  const nonce = randomUUID();

  const message = buildSiwMessage({
    chainId: args.chainId,
    accountId: args.accountId,
    challengeId,
    nonce,
    scope: args.scope,
    issuedAt,
    expiresAt,
  });

  return {
    challengeId,
    nonce,
    chainId: args.chainId,
    accountId: args.accountId,
    scope: args.scope,
    issuedAt,
    expiresAt,
    message,
  };
}
