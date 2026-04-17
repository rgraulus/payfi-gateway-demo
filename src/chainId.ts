export type ConcordiumChainResolution = {
  chainId: string;
  networkAlias: 'concordium:testnet' | 'concordium:mainnet';
  networkLabel: 'testnet' | 'mainnet';
  displayName: 'Concordium Testnet' | 'Concordium Mainnet';
};

export const CONCORDIUM_TESTNET_CHAIN_ID = 'ccd:4221332d34e1694168c2a0c0b3fd0f27';
export const CONCORDIUM_MAINNET_CHAIN_ID = 'ccd:9dd9ca4d19e9393877d2c44b70f89acb';

export function resolveConcordiumChain(input: string): ConcordiumChainResolution {
  const v = String(input || '').trim();

  switch (v) {
    case 'concordium:testnet':
    case CONCORDIUM_TESTNET_CHAIN_ID:
      return {
        chainId: CONCORDIUM_TESTNET_CHAIN_ID,
        networkAlias: 'concordium:testnet',
        networkLabel: 'testnet',
        displayName: 'Concordium Testnet',
      };

    case 'concordium:mainnet':
    case CONCORDIUM_MAINNET_CHAIN_ID:
      return {
        chainId: CONCORDIUM_MAINNET_CHAIN_ID,
        networkAlias: 'concordium:mainnet',
        networkLabel: 'mainnet',
        displayName: 'Concordium Mainnet',
      };

    default:
      throw new Error(`Unsupported Concordium chain identifier: "${v}"`);
  }
}

export function isCanonicalConcordiumChainId(input: string): boolean {
  const v = String(input || '').trim();
  return v === CONCORDIUM_TESTNET_CHAIN_ID || v === CONCORDIUM_MAINNET_CHAIN_ID;
}
