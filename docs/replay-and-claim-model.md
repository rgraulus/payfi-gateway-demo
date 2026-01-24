# Replay and claim model (M1)

This gateway enforces **two complementary anti-replay/anti-double-claim layers**:

## Layer 1: Facilitator (CRP) “event claim” semantics

In real mode (non-dev harness), the gateway calls the facilitator (CRP) to match/fulfill payment.
CRP may respond with a “claimed” result (e.g., `409 event_claimed`) indicating the underlying on-chain
payment event has already been consumed/claimed. The gateway treats this as a normal unpaid path and
returns **402 + PAYMENT-REQUIRED** (not a 5xx).

**What this protects against**
- Cross-instance replays (multiple gateway replicas) where the same chain event is presented again.
- Gateway restarts: the claim state is held by the facilitator, not the gateway.

## Layer 2: Gateway tupleKey replay protection

After a receipt is verified and the proof payload is validated, the gateway computes a deterministic
**tupleKey** and performs an atomic **check-and-insert** in a ReplayStore.

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

## Emitting PAYMENT-RESPONSE (hardening)

The gateway never emits `PAYMENT-RESPONSE` unless:
1) receipt signature verification succeeds,
2) proof payload validation against the resolved contract succeeds,
3) replay protection accepts the tupleKey (first claim),
4) and (proxy mode) the upstream returns a **2xx** response.

This keeps `PAYMENT-RESPONSE` aligned with “successful paid delivery” rather than “payment verified but delivery failed”.

## Operational note

Default replay backend is memory (simple demos). If you run multiple gateway instances or want replay
persistence across restarts, select the Redis backend via env vars (kept optional by design).
