# TupleKey policy (M3)

The gateway computes a deterministic **tupleKey** to bind a verified payment receipt to the **exact resource being accessed**.
This is the gateway’s replay / double-claim protection layer (in addition to facilitator “event claim” semantics).

## Goals

tupleKey must:
- Bind “what was paid for” to “what is being accessed”.
- Prevent replay across:
  - same endpoint (repeat request),
  - different resources (pay for A, replay against B),
  - query decoration/reorder bypass attempts.
- Be deterministic and stable across instances.

## Inputs (high-level)

tupleKey is derived from:

### Contract binding
- `contract` (gateway internal identifier; typically `contractId:contractVersion`)
- `contractId`
- `contractVersion`
- `merchantId`
- `isFrozen` (prevents “shape drift” / contract mutation attacks)

### Proof / payment binding
- `nonce`
- `amountRaw` (from proof payload when available; else contract)
- `payTo`, `network`, `tokenId`, `decimals`

### Request binding
- `method` (uppercased)
- `path` (**canonical path**, see below)

## Canonicalization rules

### Canonical JSON
tupleKey is computed as:
1) Construct a tuple object with an explicit, stable schema.
2) Canonicalize JSON:
   - object keys sorted lexicographically
   - arrays remain ordered
   - `undefined` omitted (JSON.stringify behavior)
3) Hash: `sha256(hex)` of the canonical JSON string.

Implementation: `src/x402/tupleKey.ts`

### Canonical path
tupleKey binds to the **underlying resource path** (e.g. `/premium`), not the gateway wrapper route.

In proxy mode, requests are routed as:
- `/x402/<resource>` (gateway wrapper)
- gateway strips `/x402` to resolve the contract and bind tupleKey to the **underlying resource path**

Example:
- request: `GET /x402/premium?nonce=...`
- tupleKey binds to: `GET /premium`

### Canonical query policy (M3)
**Query parameters are intentionally ignored** in tupleKey.

Reason: including query makes replay bypass trivial by param decoration/reordering:
- `?nonce=...`
- `?z=1&nonce=...`
- `?nonce=...&z=1`
- duplicated keys, encoding variants, etc.

M3 makes this policy explicit in the tuple schema:
- `qPolicy: "ignored"`
- `q: ""` (always empty)

### Future: body hash rule (not implemented yet)
For non-GET requests, we may add an optional **body hash** to tupleKey under strict rules.
Requirements (future):
- canonical body serialization
- explicit content-type handling
- clear contract-level policy on whether body participates in the binding

## Versioning
The tuple schema contains a `v` field. Any semantic change bumps `v`.

Current version: **v4** (explicit query policy slot).
