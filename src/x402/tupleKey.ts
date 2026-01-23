import { createHash } from "crypto";

/**
 * Canonicalize JS values into a stable JSON representation:
 * - Object keys sorted lexicographically
 * - Arrays kept in order
 * - undefined omitted (like JSON.stringify)
 */
function canonicalize(value: any): any {
  if (value === null) return null;

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;

  if (Array.isArray(value)) return value.map(canonicalize);

  if (t === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) {
      const v = value[k];
      if (v === undefined) continue;
      out[k] = canonicalize(v);
    }
    return out;
  }

  // functions / symbols / bigint not expected; omit
  return undefined;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Strip query string from a path (if present).
 * We intentionally ignore request query params in the tuple key because:
 * - nonce is already a first-class field in the tuple
 * - the payment contract is bound to (method + contract.resource.path)
 * - including query params enables replay bypass via param decoration/reordering
 */
function stripQuery(path?: string): string | undefined {
  if (!path) return path;
  const s = String(path);
  const i = s.indexOf("?");
  return i === -1 ? s : s.slice(0, i);
}

export type TupleKeyInput = {
  // Payment contract semantics
  contract: string;
  nonce: string;
  amountRaw: string;

  // Proof binding / merchant context
  payTo?: string;
  network?: string;
  tokenId?: string;
  decimals?: number;

  // Request binding (resource identity)
  method?: string; // GET/POST...
  path?: string;   // path only; query is stripped defensively

  // Extra identity/versioning fields
  contractId?: string;
  contractVersion?: string;
  merchantId?: string;

  // Frozen contract flag to prevent “shape drift”
  isFrozen?: boolean;
};

/**
 * Deterministic tuple key:
 * - builds a canonical JSON object with a stable field set
 * - strips query from `path` so added/reordered params can't bypass replay protection
 * - returns sha256 hex of the canonical string
 */
export function buildTupleKey(input: TupleKeyInput): string {
  // Explicit, stable “schema” (don’t rely on JS insertion order)
  const tuple = {
    // bump version because tuple semantics changed (path now ignores query)
    v: 3,

    contract: input.contract,
    nonce: input.nonce,
    amountRaw: input.amountRaw,

    payTo: input.payTo,
    network: input.network,
    tokenId: input.tokenId,
    decimals: input.decimals,

    method: input.method ? input.method.toUpperCase() : undefined,
    path: stripQuery(input.path),

    contractId: input.contractId,
    contractVersion: input.contractVersion,
    merchantId: input.merchantId,

    isFrozen: input.isFrozen ?? true,
  };

  const canonical = JSON.stringify(canonicalize(tuple));
  return sha256Hex(canonical);
}
