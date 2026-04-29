import type { SiwVerifyProofInput, SiwVerifyProofResult } from './types';

export interface SiwVerifier {
  readonly chainIdPrefix: string;

  verify(input: SiwVerifyProofInput): Promise<SiwVerifyProofResult>;
}
