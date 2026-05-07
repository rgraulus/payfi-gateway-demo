import { randomUUID } from 'crypto';
import type { GatewaySiwSession, SiwAuthChallenge } from './types';

const sessions = new Map<string, GatewaySiwSession>();

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function createSiwSession(
  challenge: SiwAuthChallenge,
  ttlSec: number,
): GatewaySiwSession {
  const issuedAt = nowSec();
  const expiresAt = issuedAt + ttlSec;

  const session: GatewaySiwSession = {
    sessionId: randomUUID(),
    chainId: challenge.chainId,
    accountId: challenge.accountId,
    subjectAccountId: challenge.subjectAccountId,
    challengeId: challenge.challengeId,
    nonce: challenge.nonce,
    scope: challenge.scope,
    issuedAt,
    expiresAt,
    status: 'active',
  };

  sessions.set(session.sessionId, session);
  return session;
}

export function getSiwSession(sessionId: string): GatewaySiwSession | null {
  return sessions.get(sessionId) ?? null;
}

export function isSiwSessionExpired(session: GatewaySiwSession): boolean {
  return session.status !== 'active' || session.expiresAt <= nowSec();
}
