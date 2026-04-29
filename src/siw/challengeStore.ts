import type { SiwAuthChallenge } from './types';

const challenges = new Map<string, SiwAuthChallenge>();

export function putSiwChallenge(challenge: SiwAuthChallenge): void {
  challenges.set(challenge.challengeId, challenge);
}

export function getSiwChallenge(challengeId: string): SiwAuthChallenge | null {
  return challenges.get(challengeId) ?? null;
}

export function deleteSiwChallenge(challengeId: string): void {
  challenges.delete(challengeId);
}

export function isSiwChallengeExpired(challenge: SiwAuthChallenge, nowSec?: number): boolean {
  const current = nowSec ?? Math.floor(Date.now() / 1000);
  return challenge.expiresAt <= current;
}
