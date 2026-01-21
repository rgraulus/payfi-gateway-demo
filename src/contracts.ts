// src/contracts.ts
//
// Phase A: Contract registry + freeze enforcement for x402 v2.
//
// Key rules:
// - Load ContractDefinitions from config/contracts.json
// - Compute contractId = sha256(canonical_json(immutable_terms))
//   where immutable_terms EXCLUDES lifecycle/metadata fields such as:
//     - contractId
//     - contractVersion
//     - isFrozen
// - If isFrozen=true, declared contractId MUST match computed contractId.
// - Resolve incoming request -> contract by method + pathname.
// - Build PAYMENT-REQUIRED header payload from contract + nonce + issuedAt/expiresAt.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type Resource = { method: string; path: string };
export type Asset = { type: 'PLT'; tokenId: string; decimals: number };

export type Attestation =
  | { type: 'concordium:web3id'; claim: string; value: unknown }
  | { type: string; [k: string]: unknown };

export type ContractDefinition = {
  // Identity/lifecycle metadata (NOT hashed)
  contractId: string; // cid_<sha256-hex>
  contractVersion: string; // human-readable tag
  isFrozen: boolean;

  // Immutable business + routing (hashed)
  merchantId: string;
  resource: Resource;

  // Immutable payment tuple (hashed)
  network: string; // e.g. "ccd:testnet"
  asset: Asset;
  amount: string; // decimal string (Phase A)
  payTo: string;

  // Future Verify & Pay / identity requirements (hashed)
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

/**
 * Compute contractId over immutable terms only.
 * IMPORTANT: Do NOT include contractVersion or isFrozen, otherwise toggling them changes the hash.
 */
export function computeContractId(def: ContractDefinition): string {
  const hashInput = {
    merchantId: def.merchantId,
    resource: def.resource,
    network: def.network,
    asset: def.asset,
    amount: def.amount,
    payTo: def.payTo,
    attestations: def.attestations ?? [],
  };

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

    // In non-frozen mode, we auto-fill the computed contractId (so you can bootstrap).
    const effectiveId = c.isFrozen ? declared : computed;
    return { ...c, contractId: effectiveId };
  });

  return { contracts };
}

export function resolveContract(
  contracts: ContractDefinition[],
  req: { method: string; url: string },
): ContractDefinition {
  const u = new URL(req.url, 'http://localhost');
  const pathname = u.pathname;
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
