import type { SiwVerifyProofInput, SiwVerifyProofResult } from './types';
import type { SiwVerifier } from './verifier';

export class ConcordiumSiwVerifier implements SiwVerifier {
  readonly chainIdPrefix = 'ccd';

  async verify(_input: SiwVerifyProofInput): Promise<SiwVerifyProofResult> {
    return {
      ok: false,
      code: 'not_implemented',
      message: 'Concordium SIW signature verification is not implemented yet.',
    };
  }
}
