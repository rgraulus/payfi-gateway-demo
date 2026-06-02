export type Phase3DemoContractBindingSnapshot = {
  merchantId: string;
  resource: {
    method: string;
    path: string;
  };
  contractId: string;
  contractVersion: string;
  isFrozen: boolean;
  network: string;
  chain_id: string;
  asset: {
    type: string;
    tokenId: string;
    decimals: number;
  };
  amount: string;
  payTo: string;
};

export type Phase3DemoChallengeBindingResult =
  | { ok: true }
  | { ok: false; code: 'policy_binding_mismatch'; message: string };

export function validatePhase3DemoChallengeBinding(args: {
  nonce: string;
  challenge: any;
  contract: Phase3DemoContractBindingSnapshot;
}): Phase3DemoChallengeBindingResult {
  const { nonce, challenge, contract } = args;

  const checks: Array<[boolean, 'policy_binding_mismatch', string]> = [
    [
      challenge?.nonce === nonce,
      'policy_binding_mismatch',
      'Authorization proof challenge nonce does not match request nonce.',
    ],
    [
      challenge?.merchantId === contract.merchantId,
      'policy_binding_mismatch',
      'Authorization proof challenge merchantId does not match /paid-gated contract.',
    ],
    [
      challenge?.resource?.method === contract.resource.method &&
        challenge?.resource?.path === contract.resource.path,
      'policy_binding_mismatch',
      'Authorization proof challenge resource does not match /paid-gated.',
    ],
    [
      challenge?.contract?.contractId === contract.contractId &&
        challenge?.contract?.contractVersion === contract.contractVersion &&
        challenge?.contract?.isFrozen === contract.isFrozen,
      'policy_binding_mismatch',
      'Authorization proof challenge contract snapshot does not match /paid-gated contract.',
    ],
    [
      challenge?.network === contract.network &&
        challenge?.chain_id === contract.chain_id,
      'policy_binding_mismatch',
      'Authorization proof challenge network does not match /paid-gated contract.',
    ],
    [
      challenge?.asset?.type === contract.asset.type &&
        challenge?.asset?.tokenId === contract.asset.tokenId &&
        challenge?.asset?.decimals === contract.asset.decimals,
      'policy_binding_mismatch',
      'Authorization proof challenge asset does not match /paid-gated contract.',
    ],
    [
      challenge?.amount === contract.amount &&
        challenge?.payTo === contract.payTo,
      'policy_binding_mismatch',
      'Authorization proof challenge payment terms do not match /paid-gated contract.',
    ],
  ];

  for (const [ok, code, message] of checks) {
    if (!ok) return { ok: false, code, message };
  }

  return { ok: true };
}
