export type SiwChainId = string;
export type SiwAccountId = string;
export type SiwSessionId = string;
export type SiwChallengeId = string;

export type SiwChallengeScope = {
  resourcePath: string;
  resourceMethod: string;
};

export type SiwAuthChallenge = {
  challengeId: SiwChallengeId;
  nonce: string;
  chainId: SiwChainId;
  accountId: SiwAccountId;
  scope: SiwChallengeScope;
  issuedAt: number;
  expiresAt: number;
  message: string;
};

export type SiwVerifyProofInput = {
  chainId: SiwChainId;
  accountId: SiwAccountId;
  message: string;
  signature: string;
};

export type SiwVerifyProofResult =
  | {
      ok: true;
      signerAccountId: SiwAccountId;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type GatewaySiwSession = {
  sessionId: SiwSessionId;
  chainId: SiwChainId;
  accountId: SiwAccountId;
  challengeId: SiwChallengeId;
  nonce: string;
  scope: SiwChallengeScope;
  issuedAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'revoked';
};
