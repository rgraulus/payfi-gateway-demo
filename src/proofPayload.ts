// src/proofPayload.ts
//
// Phase B (real): Concordium PLT proof payload schema + validation.
// This is the payload that must be inside the receipt JWS payload (claims).
//
// Gateway verifies:
// - JWS signature (already done via JWKS), then
// - semantic correctness of this payload (contract binding, nonce, finalized, amountRaw, etc.)
//
// IMPORTANT: Keep this deterministic and strict. Any mismatch should fail closed (402).

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AssetPlt = {
  type: 'PLT';
  tokenId: string;
  decimals: number;
};

export type ContractBinding = {
  contractId: string;
  contractVersion: string;
  isFrozen: boolean;

  merchantId: string;
  resource: { method: HttpMethod; path: string };

  network: string; // e.g. "ccd:testnet"
  asset: AssetPlt;

  // amount in decimal-string form (as in config/contracts.json), e.g. "0.050101"
  amount: string;

  // payee address
  payTo: string;
};

export type CcdPltProofV1 = {
  proofVersion: 'ccd-plt-proof@v1';

  contract: ContractBinding;

  nonce: string;

  settlement: {
    status: 'finalized';
    settledAt: number; // unix seconds
    expiresAt?: number; // unix seconds (optional)
  };

  chain: {
    transactionHash: string; // hex string
    blockHash?: string; // hex string (optional but recommended)
    blockHeight?: number; // optional
  };

  paymentEvent: {
    kind: 'plt.transfer';
    tokenId: string;
    amountRaw: string; // integer string (base units)
    from?: string; // optional (payer)
    to: string; // must equal contract.payTo
  };
};

export class ProofPayloadError extends Error {
  name = 'ProofPayloadError';
}

export function proofPayloadError(message: string): ProofPayloadError {
  return new ProofPayloadError(message);
}

function isObject(x: unknown): x is Record<string, any> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function requireString(path: string, v: any): string {
  if (typeof v !== 'string' || v.length === 0) throw proofPayloadError(`${path} must be non-empty string`);
  return v;
}

function requireBool(path: string, v: any): boolean {
  if (typeof v !== 'boolean') throw proofPayloadError(`${path} must be boolean`);
  return v;
}

function requireNumber(path: string, v: any): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw proofPayloadError(`${path} must be finite number`);
  return v;
}

function requireMethod(path: string, v: any): HttpMethod {
  const s = requireString(path, v).toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(s)) {
    throw proofPayloadError(`${path} must be HTTP method`);
  }
  return s as HttpMethod;
}

function requireIntString(path: string, v: any): string {
  const s = requireString(path, v);
  if (!/^\d+$/.test(s)) throw proofPayloadError(`${path} must be integer string`);
  return s;
}

// Strict decimal parsing. Returns integer base-units as string.
// Example: amount="0.050101", decimals=6 => "50101"
export function amountToRawUnits(amount: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw proofPayloadError(`decimals must be integer in [0,18], got ${decimals}`);
  }

  const s = (amount ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw proofPayloadError(`amount must be a non-negative decimal string, got "${amount}"`);
  }

  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    throw proofPayloadError(
      `amount has too many decimal places: ${frac.length} > ${decimals} (amount="${amount}")`,
    );
  }

  const fracPadded = frac.padEnd(decimals, '0');
  const raw = `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
  return raw;
}

// Runtime assertion that an unknown value is a CcdPltProofV1.
// Throws ProofPayloadError on mismatch.
export function assertCcdPltProofV1(u: unknown): asserts u is CcdPltProofV1 {
  if (!isObject(u)) throw proofPayloadError(`proof payload must be object`);

  const pv = u.proofVersion;
  if (pv !== 'ccd-plt-proof@v1') throw proofPayloadError(`proofVersion must be "ccd-plt-proof@v1"`);

  if (!isObject(u.contract)) throw proofPayloadError(`contract must be object`);
  const c = u.contract;

  requireString('contract.contractId', c.contractId);
  requireString('contract.contractVersion', c.contractVersion);
  requireBool('contract.isFrozen', c.isFrozen);

  requireString('contract.merchantId', c.merchantId);
  if (!isObject(c.resource)) throw proofPayloadError(`contract.resource must be object`);
  requireMethod('contract.resource.method', c.resource.method);
  requireString('contract.resource.path', c.resource.path);

  requireString('contract.network', c.network);

  if (!isObject(c.asset)) throw proofPayloadError(`contract.asset must be object`);
  if (c.asset.type !== 'PLT') throw proofPayloadError(`contract.asset.type must be "PLT"`);
  requireString('contract.asset.tokenId', c.asset.tokenId);
  const dec = requireNumber('contract.asset.decimals', c.asset.decimals);
  if (!Number.isInteger(dec) || dec < 0 || dec > 18) {
    throw proofPayloadError(`contract.asset.decimals must be integer in [0,18]`);
  }

  requireString('contract.amount', c.amount);
  requireString('contract.payTo', c.payTo);

  requireString('nonce', u.nonce);

  if (!isObject(u.settlement)) throw proofPayloadError(`settlement must be object`);
  if (u.settlement.status !== 'finalized') throw proofPayloadError(`settlement.status must be "finalized"`);
  requireNumber('settlement.settledAt', u.settlement.settledAt);
  if (u.settlement.expiresAt !== undefined) requireNumber('settlement.expiresAt', u.settlement.expiresAt);

  if (!isObject(u.chain)) throw proofPayloadError(`chain must be object`);
  requireString('chain.transactionHash', u.chain.transactionHash);
  if (u.chain.blockHash !== undefined) requireString('chain.blockHash', u.chain.blockHash);
  if (u.chain.blockHeight !== undefined) {
    const bh = requireNumber('chain.blockHeight', u.chain.blockHeight);
    if (!Number.isInteger(bh) || bh < 0) throw proofPayloadError(`chain.blockHeight must be non-negative integer`);
  }

  if (!isObject(u.paymentEvent)) throw proofPayloadError(`paymentEvent must be object`);
  if (u.paymentEvent.kind !== 'plt.transfer') throw proofPayloadError(`paymentEvent.kind must be "plt.transfer"`);
  requireString('paymentEvent.tokenId', u.paymentEvent.tokenId);
  requireIntString('paymentEvent.amountRaw', u.paymentEvent.amountRaw);
  if (u.paymentEvent.from !== undefined) requireString('paymentEvent.from', u.paymentEvent.from);
  requireString('paymentEvent.to', u.paymentEvent.to);
}

// Semantic validation: verifies payload binds to the gateway contract + nonce and amount rules.
// Returns void; throws ProofPayloadError on failure.
export function validateCcdPltProofAgainstContract(args: {
  proof: CcdPltProofV1;
  expected: {
    nonce: string;
    contract: ContractBinding;
    nowSec: number;
  };
}) {
  const { proof, expected } = args;

  // nonce binding
  if (proof.nonce !== expected.nonce) {
    throw proofPayloadError(`nonce mismatch: got "${proof.nonce}", expected "${expected.nonce}"`);
  }

  // Contract binding (strict)
  const pc = proof.contract;
  const ec = expected.contract;

  const mismatches: string[] = [];

  const eq = (k: string, a: any, b: any) => {
    if (a !== b) mismatches.push(`${k}: got "${String(a)}" expected "${String(b)}"`);
  };

  eq('contractId', pc.contractId, ec.contractId);
  eq('contractVersion', pc.contractVersion, ec.contractVersion);
  eq('isFrozen', pc.isFrozen, ec.isFrozen);

  eq('merchantId', pc.merchantId, ec.merchantId);
  eq('resource.method', pc.resource.method, ec.resource.method);
  eq('resource.path', pc.resource.path, ec.resource.path);

  eq('network', pc.network, ec.network);

  eq('asset.type', pc.asset.type, ec.asset.type);
  eq('asset.tokenId', pc.asset.tokenId, ec.asset.tokenId);
  eq('asset.decimals', pc.asset.decimals, ec.asset.decimals);

  eq('amount', pc.amount, ec.amount);
  eq('payTo', pc.payTo, ec.payTo);

  if (mismatches.length) {
    throw proofPayloadError(`contract binding mismatch:\n- ${mismatches.join('\n- ')}`);
  }

  // Finalization requirement
  if (proof.settlement.status !== 'finalized') {
    throw proofPayloadError(`settlement.status must be "finalized"`);
  }

  // Optional expiry
  if (proof.settlement.expiresAt !== undefined && proof.settlement.expiresAt < expected.nowSec) {
    throw proofPayloadError(`proof expired at ${proof.settlement.expiresAt}, now=${expected.nowSec}`);
  }

  // Payment event binding
  if (proof.paymentEvent.tokenId !== ec.asset.tokenId) {
    throw proofPayloadError(
      `paymentEvent.tokenId mismatch: got "${proof.paymentEvent.tokenId}", expected "${ec.asset.tokenId}"`,
    );
  }

  if (proof.paymentEvent.to !== ec.payTo) {
    throw proofPayloadError(
      `paymentEvent.to mismatch: got "${proof.paymentEvent.to}", expected "${ec.payTo}"`,
    );
  }

  const expectedRaw = amountToRawUnits(ec.amount, ec.asset.decimals);
  if (proof.paymentEvent.amountRaw !== expectedRaw) {
    throw proofPayloadError(
      `paymentEvent.amountRaw mismatch: got "${proof.paymentEvent.amountRaw}", expected "${expectedRaw}"`,
    );
  }
}
