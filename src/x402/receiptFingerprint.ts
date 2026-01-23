import { createHash } from "crypto";

/**
 * Short fingerprint for logging / cache entries.
 * Uses sha256 of the full compact JWS string.
 */
export function receiptSha12(jwsCompact: string): string {
  const hex = createHash("sha256").update(jwsCompact, "utf8").digest("hex");
  return hex.slice(0, 12);
}
