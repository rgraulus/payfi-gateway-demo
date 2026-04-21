// src/contractResolver.ts

import {
  loadContracts,
  compileContracts,
  resolveContractFromRegistry,
  ContractDefinition,
  LoadedContractDefinition,
  CompiledContractRegistry,
} from './contracts';

export type ResolveByResourceArgs = {
  method: string;
  pathname: string;
};

export interface ContractResolver {
  resolveByResource(args: ResolveByResourceArgs): LoadedContractDefinition;
  list(): LoadedContractDefinition[];
}

export class FileContractResolver implements ContractResolver {
  private readonly contracts: LoadedContractDefinition[];
  private readonly registry: CompiledContractRegistry;

  constructor(configPath: string) {
    const loaded = loadContracts(configPath);
    this.contracts = loaded.contracts;
    this.registry = compileContracts(this.contracts);
  }

  resolveByResource(args: ResolveByResourceArgs): LoadedContractDefinition {
    return resolveContractFromRegistry(this.registry, {
      method: args.method,
      pathname: args.pathname,
    });
  }

  list(): LoadedContractDefinition[] {
    return this.contracts;
  }
}
