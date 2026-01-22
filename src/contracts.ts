// src/contracts.ts
//
// Phase B: Contract registry supports BOTH modes:
// - mode="local": gateway serves content itself
// - mode="proxy": gateway forwards to upstream (payment-unaware resource server)
//
// ContractId hashing rules (immutable terms only):
// - merchantId, resource(method/path), network, asset, amount, payTo, attestations
// - PLUS mode and (if proxy) upstream.baseUrl + upstream.pathPrefix
//
// Excludes metadata/lifecycle fields:
// - contractId, contractVersion, isFrozen

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type Resource = { method: string; path: string };
export type Asset = { type: 'PLT'; tokenId: string; decimals: number };

export type Attestation =
  | { type: 'concordium:web3id'; claim: string; value: unknown }
  | { type: string; [k: string]: unknown };

export type Upstream = {
  baseUrl: string; // e.g. http://127.0.0.1:3010
  pathPrefix?: string; // optional prefix added before resource path
};

export type ContractMode = 'local' | 'proxy';

export type ContractDefinition = {
  // Metadata/lifecycle (NOT hashed)
  contractId: string; // cid_<sha256-hex>
  contractVersion: string;
  isFrozen: boolean;

  // Mode (hashed)
  mode: ContractMode;

  // Business + routing (hashed)
  merchantId: string;
  resource: Resource;

  // Payment tuple (hashed)
  network: string;
  asset: Asset;
  amount: string;
  payTo: string;

  // Proxy mode only (hashed)
  upstream?: Upstream;

  // Future identity requirements (hashed)
  attestations?: Attestation[];
};

type ContractRegistryFile = { contracts: ContractDefinition[] };

// Deterministic JSON: objects sorted by key; arrays preserve order.
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function computeContractId(def: ContractDefinition): string {
  const mode = def.mode ?? 'local';
  const attestations = def.attestations ?? [];

  const hashInput: any = {
    merchantId: def.merchantId,
    resource: def.resource,
    network: def.network,
    asset: def.asset,
    amount: def.amount,
    payTo: def.payTo,
    attestations,
    mode,
  };

  if (mode === 'proxy') {
    if (!def.upstream?.baseUrl) {
      throw new Error(
        `[contracts] mode=proxy requires upstream.baseUrl for ${def.resource.method} ${def.resource.path}`,
      );
    }
    hashInput.upstream = {
      baseUrl: def.upstream.baseUrl,
      pathPrefix: def.upstream.pathPrefix ?? '',
    };
  }

  const canonical = stableStringify(hashInput);
  const hex = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `cid_${hex}`;
}

export function loadContracts(configPath = 'config/contracts.json'): { contracts: ContractDefinition[] } {
  const full = path.resolve(process.cwd(), configPath);
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as ContractRegistryFile;

  const contracts = parsed.contracts.map((c) => {
    const declared = c.contractId;
    const computed = computeContractId(c);

    if (c.isFrozen && declared !== computed) {
      throw new Error(
        `[contracts] Frozen contractId mismatch for ${c.resource.method} ${c.resource.path}\n` +
          `declared: ${declared}\n` +
          `computed: ${computed}\n` +
          `Fix: update config/contracts.json contractId to computed, or set isFrozen:false temporarily.`,
      );
    }

    const effectiveId = c.isFrozen ? declared : computed;
    return { ...c, contractId: effectiveId };
  });

  return { contracts };
}

export function resolveContract(
  contracts: ContractDefinition[],
  req: { method: string; pathname: string },
): ContractDefinition {
  const pathname = req.pathname;
  const method = (req.method || 'GET').toUpperCase();

  const found = contracts.find(
    (c) => c.resource.method.toUpperCase() === method && c.resource.path === pathname,
  );

  if (!found) {
    throw new Error(`[contracts] No contract for ${method} ${pathname}`);
  }

  return found;
}

export function buildPaymentRequiredPayload(args: {
  contract: ContractDefinition;
  nonce: string;
  issuedAtSec: number;
  expiresAtSec: number;
}) {
  const { contract, nonce, issuedAtSec, expiresAtSec } = args;

  return {
    version: 'x402-v2',
    contractId: contract.contractId,
    contractVersion: contract.contractVersion,
    isFrozen: contract.isFrozen,

    merchantId: contract.merchantId,
    resource: contract.resource,

    nonce,
    issuedAt: issuedAtSec,
    expiresAt: expiresAtSec,

    network: contract.network,
    asset: contract.asset,
    amount: contract.amount,
    payTo: contract.payTo,

    attestations: contract.attestations ?? [],
  };
}

// Header-friendly standard base64 JSON (not base64url)
export function b64jsonHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}
