// src/contractResolver.ts

import {
  loadContracts,
  compileContracts,
  resolveContractFromRegistry,
  ContractDefinition,
  CompiledContractRegistry,
} from './contracts';

export type ResolveByResourceArgs = {
  method: string;
  pathname: string;
};

export interface ContractResolver {
  resolveByResource(args: ResolveByResourceArgs): ContractDefinition;
  list(): ContractDefinition[];
}

export class FileContractResolver implements ContractResolver {
  private readonly contracts: ContractDefinition[];
  private readonly registry: CompiledContractRegistry;

  constructor(configPath: string) {
    const loaded = loadContracts(configPath);
    this.contracts = loaded.contracts;
    this.registry = compileContracts(this.contracts);
  }

  resolveByResource(args: ResolveByResourceArgs): ContractDefinition {
    return resolveContractFromRegistry(this.registry, {
      method: args.method,
      pathname: args.pathname,
    });
  }

  list(): ContractDefinition[] {
    return this.contracts;
  }
}
