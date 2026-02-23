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
//
// Matching rules (scalable):
// - Exact match wins (method + exact path)
// - Optional prefix-wildcard contracts using "/paid/*" style
//   (longest prefix wins; deterministic)
// - Fail fast on duplicates (exact or wildcard-prefix duplicates)

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

// ------------------------------
// Scalable matching (exact + prefix wildcard)
// ------------------------------

export type CompiledContractRegistry = {
  // Exact match: method -> pathname -> contract
  exact: Map<string, Map<string, ContractDefinition>>;

  // Prefix wildcards: method -> [{ prefix, contract }] sorted by longest prefix first
  prefix: Map<string, Array<{ prefix: string; contract: ContractDefinition }>>;

  // Keep original list
  all: ContractDefinition[];
};

function isPrefixWildcardPath(p: string): boolean {
  // Canonical: "/paid/*" (preferred)
  // Also accept "/paid*" as a looser variant (not recommended for directories)
  return p.endsWith('/*') || (p.endsWith('*') && !p.endsWith('/*'));
}

function wildcardPrefix(p: string): string {
  // "/paid/*" -> "/paid/"
  // "/paid*"  -> "/paid"
  if (p.endsWith('/*')) return p.slice(0, -1); // keep trailing '/'
  if (p.endsWith('*')) return p.slice(0, -1);
  return p;
}

/**
 * Compile contracts into a fast registry:
 * - Exact map for O(1) hot path
 * - Prefix list for wildcard matches
 *
 * Deterministic resolution order:
 * 1) exact
 * 2) longest prefix first
 *
 * Fail-fast rules:
 * - duplicate exact (method+path) is rejected
 * - duplicate wildcard prefixes are rejected
 */
export function compileContracts(contracts: ContractDefinition[]): CompiledContractRegistry {
  const exact = new Map<string, Map<string, ContractDefinition>>();
  const prefix = new Map<string, Array<{ prefix: string; contract: ContractDefinition }>>();

  const getExactBucket = (method: string) => {
    let m = exact.get(method);
    if (!m) {
      m = new Map();
      exact.set(method, m);
    }
    return m;
  };

  const getPrefixBucket = (method: string) => {
    let arr = prefix.get(method);
    if (!arr) {
      arr = [];
      prefix.set(method, arr);
    }
    return arr;
  };

  for (const c of contracts) {
    const method = c.resource.method.toUpperCase();
    const p = c.resource.path;

    if (isPrefixWildcardPath(p)) {
      const pre = wildcardPrefix(p);

      if (!pre.startsWith('/')) {
        throw new Error(`[contracts] wildcard path must start with '/': ${method} ${p}`);
      }

      getPrefixBucket(method).push({ prefix: pre, contract: c });
      continue;
    }

    const bucket = getExactBucket(method);
    if (bucket.has(p)) {
      throw new Error(`[contracts] duplicate exact contract for ${method} ${p}`);
    }
    bucket.set(p, c);
  }

  // Sort prefixes by specificity: longest prefix first
  for (const [method, arr] of prefix.entries()) {
    arr.sort((a, b) => b.prefix.length - a.prefix.length);

    // Fail fast on duplicate prefixes
    const seen = new Set<string>();
    for (const it of arr) {
      if (seen.has(it.prefix)) {
        throw new Error(`[contracts] duplicate wildcard prefix for ${method} ${it.prefix}*`);
      }
      seen.add(it.prefix);
    }
  }

  return { exact, prefix, all: contracts };
}

export function resolveContractFromRegistry(
  reg: CompiledContractRegistry,
  req: { method: string; pathname: string },
): ContractDefinition {
  const pathname = req.pathname;
  const method = (req.method || 'GET').toUpperCase();

  // 1) Exact match wins
  const exactBucket = reg.exact.get(method);
  const exactHit = exactBucket?.get(pathname);
  if (exactHit) return exactHit;

  // 2) Prefix wildcard match (longest prefix first)
  const prefixBucket = reg.prefix.get(method) ?? [];
  for (const { prefix, contract } of prefixBucket) {
    if (pathname.startsWith(prefix)) return contract;
  }

  throw new Error(`[contracts] No contract for ${method} ${pathname}`);
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
