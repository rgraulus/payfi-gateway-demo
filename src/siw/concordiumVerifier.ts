import type { SiwVerifyProofInput, SiwVerifyProofResult } from './types';
import type { SiwVerifier } from './verifier';

function hasConcordiumAccountInfoShape(accountInfo: unknown): boolean {
  if (!accountInfo || typeof accountInfo !== 'object') {
    return false;
  }

  const value = accountInfo as any;
  return (
    typeof value.accountThreshold === 'number' &&
    value.accountCredentials != null &&
    typeof value.accountCredentials === 'object'
  );
}

function getAccountAddressString(accountInfo: unknown): string {
  if (!accountInfo || typeof accountInfo !== 'object') {
    return '';
  }

  const value = (accountInfo as any).accountAddress;
  if (typeof value === 'string') {
    return value;
  }

  if (value != null) {
    return String(value);
  }

  return '';
}

export class ConcordiumSiwVerifier implements SiwVerifier {
  readonly chainIdPrefix = 'ccd';

  async verify(input: SiwVerifyProofInput): Promise<SiwVerifyProofResult> {
    if (!input.accountInfo || typeof input.accountInfo !== 'object') {
      return {
        ok: false,
        code: 'invalid_account_info',
        message: 'Concordium SIW verification requires accountInfo.',
      };
    }

    const accountAddress = getAccountAddressString(input.accountInfo);
    if (!accountAddress) {
      return {
        ok: false,
        code: 'invalid_account_info',
        message: 'Concordium accountInfo must include accountAddress.',
      };
    }

    if (!hasConcordiumAccountInfoShape(input.accountInfo)) {
      return {
        ok: false,
        code: 'invalid_account_info',
        message: 'Concordium accountInfo must include accountThreshold and accountCredentials.',
      };
    }

    if (accountAddress !== input.accountId) {
      return {
        ok: false,
        code: 'account_binding_mismatch',
        message: 'Concordium accountInfo.accountAddress does not match accountId.',
      };
    }

    try {
      const { verifyMessageSignature } = await import('@concordium/web-sdk');

      const verified = await verifyMessageSignature(
        input.message,
        input.signature as any,
        input.accountInfo as any,
      );

      if (!verified) {
        return {
          ok: false,
          code: 'invalid_signature',
          message: 'Concordium SIW signature verification failed.',
        };
      }

      return {
        ok: true,
        signerAccountId: accountAddress,
      };
    } catch (err: any) {
      return {
        ok: false,
        code: 'verification_error',
        message: String(err?.message ?? err),
      };
    }
  }
}
