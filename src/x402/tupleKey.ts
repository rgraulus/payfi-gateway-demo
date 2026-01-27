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
      const v = (value as any)[k];
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

function upperMethod(m?: string): string | undefined {
  if (!m) return undefined;
  const s = String(m).toUpperCase();
  return s.length ? s : undefined;
}

function isBodyBoundMethod(methodUpper?: string): boolean {
  const m = String(methodUpper || "");
  return m === "POST" || m === "PUT" || m === "PATCH";
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

  // M5: optional body binding for POST/PUT/PATCH
  // Expectation: hex sha256 of *raw request bytes*.
  bodySha256?: string;
};

/**
 * Deterministic tuple key:
 * - builds a canonical JSON object with a stable field set
 * - binds to canonical PATH (query is intentionally ignored)
 * - includes explicit canonical query slot (currently empty) so policy is visible
 * - optionally (M5) binds POST/PUT/PATCH to sha256(rawBodyBytes)
 * - returns sha256 hex of the canonical string
 */
export function buildTupleKey(input: TupleKeyInput): string {
  const method = upperMethod(input.method);
  const includeBody = isBodyBoundMethod(method);

  // Explicit, stable “schema” (don’t rely on JS insertion order)
  const tuple: Record<string, any> = {
    // bump version only when semantics change.
    // v4: query policy slot present
    // v5: optional body binding for POST/PUT/PATCH
    v: 5,

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
    method,

    // canonical path only
    path: stripQuery(input.path),

    // M3: canonical query policy (explicit, but empty)
    qPolicy: "ignored",
    q: "",

    // optional identity fields
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    merchantId: input.merchantId,

    // frozen
    isFrozen: input.isFrozen ?? true,
  };

  // M5: body binding only applies to POST/PUT/PATCH (never GET).
  // If present, we include a policy slot + the hash to make the binding explicit.
  if (includeBody) {
    tuple.bPolicy = "sha256-raw";
    tuple.bodySha256 = typeof input.bodySha256 === "string" ? input.bodySha256 : "";
  }

  const canonical = JSON.stringify(canonicalize(tuple));
  return sha256Hex(canonical);
}
