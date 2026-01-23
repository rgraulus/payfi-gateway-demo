export type ReplayEntry = {
  seenAtSec: number;
  expSec: number;
  receiptSha12: string;
  kid?: string;
};

export type ReplayDecision =
  | { ok: true; inserted: true; tupleKey: string; entry: ReplayEntry }
  | { ok: false; reason: "replay"; tupleKey: string; entry: ReplayEntry };

export class ReplayCache {
  private map = new Map<string, ReplayEntry>();

  size(): number {
    return this.map.size;
  }

  /**
   * Lazy purge of expired entries.
   * Called on every check/insert so the cache doesn't grow unbounded in dev.
   */
  purgeExpired(nowSec: number): void {
    for (const [k, v] of this.map.entries()) {
      if (v.expSec <= nowSec) this.map.delete(k);
    }
  }

  /**
   * Check if tupleKey already exists and is still valid; if not, insert it.
   */
  checkAndInsert(args: {
    tupleKey: string;
    nowSec: number;
    expSec: number;
    receiptSha12: string;
    kid?: string;
  }): ReplayDecision {
    this.purgeExpired(args.nowSec);

    const existing = this.map.get(args.tupleKey);
    if (existing && existing.expSec > args.nowSec) {
      return { ok: false, reason: "replay", tupleKey: args.tupleKey, entry: existing };
    }

    const entry: ReplayEntry = {
      seenAtSec: args.nowSec,
      expSec: args.expSec,
      receiptSha12: args.receiptSha12,
      kid: args.kid,
    };
    this.map.set(args.tupleKey, entry);
    return { ok: true, inserted: true, tupleKey: args.tupleKey, entry };
  }
}
