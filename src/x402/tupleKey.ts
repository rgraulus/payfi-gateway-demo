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
 *
 * M3 policy: tupleKey binds to canonical PATH only.
 * Query is intentionally ignored (canonical query slot exists but is empty),
 * because including query enables replay bypass via param decoration/reordering.
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

  // M3: canonical query slot (currently ignored by policy)
  // (Future: canonical query could be included under strict rules.)
  query?: string;
};

/**
 * Deterministic tuple key:
 * - builds a canonical JSON object with a stable field set
 * - binds to canonical PATH (query is intentionally ignored)
 * - includes explicit canonical query slot (currently empty) so policy is visible
 * - returns sha256 hex of the canonical string
 */
export function buildTupleKey(input: TupleKeyInput): string {
  // Explicit, stable “schema” (don’t rely on JS insertion order)
  const tuple = {
    // bump version because tuple semantics now explicitly include a query policy slot
    v: 4,

    // payment contract
    contract: input.contract,
    nonce: input.nonce,
    amountRaw: input.amountRaw,

    // binding context
    payTo: input.payTo,
    network: input.network,
    tokenId: input.tokenId,
    decimals: input.decimals,

    // request identity
    method: input.method ? input.method.toUpperCase() : undefined,

    // canonical path only
    path: stripQuery(input.path),

    // M3: canonical query policy (explicit, but empty)
    // Keeping this present makes the spec/implementation alignment obvious.
    qPolicy: "ignored",
    q: "",

    // optional identity fields
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    merchantId: input.merchantId,

    // frozen
    isFrozen: input.isFrozen ?? true,
  };

  const canonical = JSON.stringify(canonicalize(tuple));
  return sha256Hex(canonical);
}
