import path from 'path';
import { pathToFileURL } from 'url';
import { resolveConcordiumChain } from '../chainId';

export type ConcordiumLookupConfig = {
  testnet: {
    host: string;
    port: number;
  };
  mainnet: {
    host: string;
    port: number;
  };
};

export async function getConcordiumAccountInfo(
  chainId: string,
  accountId: string,
  config: ConcordiumLookupConfig,
): Promise<unknown> {
  const resolved = resolveConcordiumChain(chainId);

  const node =
    resolved.networkLabel === 'mainnet'
      ? config.mainnet
      : config.testnet;

  const sdkIndexPath = require.resolve('@concordium/web-sdk');
  const sdkDir = path.dirname(sdkIndexPath);
  const grpcModulePath = path.join(sdkDir, 'nodejs', 'grpc.js');
  const grpcModuleUrl = pathToFileURL(grpcModulePath).href;
  const { ConcordiumGRPCNodeClient, credentials } = await import(grpcModuleUrl as any);

  const client = new ConcordiumGRPCNodeClient(
    node.host,
    node.port,
    credentials.createInsecure(),
  );

  return await client.getAccountInfo(accountId);
}
