import { ConcordiumSiwVerifier } from './concordiumVerifier';
import type { SiwVerifier } from './verifier';

const verifiers: SiwVerifier[] = [new ConcordiumSiwVerifier()];

function getChainIdPrefix(chainId: string): string {
  const value = String(chainId || '').trim().toLowerCase();
  const idx = value.indexOf(':');
  return idx >= 0 ? value.slice(0, idx) : value;
}

export function getSiwVerifierForChainId(chainId: string): SiwVerifier | null {
  const prefix = getChainIdPrefix(chainId);
  return verifiers.find((verifier) => verifier.chainIdPrefix === prefix) ?? null;
}
