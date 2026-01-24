# Replay and claim model (M1 + M2)

This gateway enforces **two complementary anti-replay / anti-double-claim layers**, and (as of M2)
adds an explicit **pending settlement** behavior that is safe (no paid header leakage) and client-friendly.

## Layer 1: Facilitator (CRP) “event claim” semantics

In real mode (non-dev harness), the gateway calls the facilitator (CRP) to match/fulfill payment.
CRP may respond with a “claimed” result (e.g., `409 event_claimed`) indicating the underlying on-chain
payment event has already been consumed/claimed. The gateway treats this as a normal unpaid path and
returns **402 + PAYMENT-REQUIRED** (not a 5xx).

**What this protects against**
- Cross-instance replays (multiple gateway replicas) where the same chain event is presented again.
- Gateway restarts: the claim state is held by the facilitator, not the gateway.

## Layer 2: Gateway tupleKey replay protection

After a receipt is verified and the proof payload is validated (and is eligible to be treated as paid),
the gateway computes a deterministic **tupleKey** and performs an atomic **check-and-insert** in a ReplayStore.

Default backend is **in-memory**; an optional **Redis** backend can be selected via env vars.

**What this protects against**
- Replays that occur before (or in addition to) CRP-level checks.
- “Request-binding” attacks: paying for one resource/method and replaying the receipt against another.

### tupleKey inputs (high level)

The tuple key is derived from:
- contract identity/version (including `isFrozen`)
- merchantId
- nonce
- amountRaw (from proof payload if present, else contract)
- payTo, network, tokenId, decimals
- request method
- request path

**Important: query params are intentionally ignored in the tupleKey.**
This prevents bypass via query decoration and reordering (e.g., `?z=1&nonce=...` vs `?nonce=...`).

Implementation: `src/x402/tupleKey.ts` strips query from `path` before hashing.

### Replay entry lifetime (hardening)

Replay entries are stored with an expiry that uses the tightest bound available:

`expSec = min(receipt.exp, proof.settlement.expiresAt, PAYMENT-REQUIRED.expiresAt, now + ttlSec)`

If the derived `expSec <= now`, the gateway treats the receipt as expired and returns **402 + PAYMENT-REQUIRED**
(and never emits `PAYMENT-RESPONSE`).

## M2: Pending / non-finalized settlement semantics

A receipt can be **cryptographically valid** yet still represent a payment that is **not finalized**
(e.g., `settlement.status = "pending"`). In M2, the gateway makes this state explicit and safe:

If a receipt verifies and is a valid `ccd-plt-proof@v1` payload, but the settlement is **not finalized**:
- Return **402 + PAYMENT-REQUIRED**
- **Do NOT** emit `PAYMENT-RESPONSE`
- Include a stable JSON signal:
  - `reason = "pending_settlement"`
  - `settlement` metadata (`status`, `settledAt`, `expiresAt`)
  - Optional `retryAfterSec` hint and `Retry-After` header

**Why this matters**
- Prevents “paid header leakage” for non-finalized payments.
- Gives clients a deterministic way to retry (or surface “still confirming” UX) instead of a generic “invalid receipt”.

**Important note about replay**
- Pending/non-finalized receipts are **not** inserted into the ReplayStore.
  Replay is only enforced after a receipt is considered eligible for “paid delivery”.

## Emitting PAYMENT-RESPONSE (hardening)

The gateway never emits `PAYMENT-RESPONSE` unless all of the following are true:

1) Receipt signature verification succeeds (JWKS)
2) Proof payload validation against the resolved contract succeeds
3) Settlement is **finalized** (M2)
4) Replay protection accepts the tupleKey (first claim)
5) And (proxy mode) the upstream returns a **2xx** response

This keeps `PAYMENT-RESPONSE` aligned with **successful paid delivery** rather than
“payment verified but delivery failed” or “payment pending finality”.

## Operational note

Default replay backend is memory (simple demos). If you run multiple gateway instances or want replay
persistence across restarts, select the Redis backend via env vars (kept optional by design).
