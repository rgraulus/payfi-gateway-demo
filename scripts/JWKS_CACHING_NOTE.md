# JWKS caching / “restartless” harness nuance

This repo’s Phase B/Phase D harness scripts start a **dev JWKS issuer** (`scripts/dev_jwks_server.mjs`) on:

- `http://127.0.0.1:8088/.well-known/jwks.json`

The gateway verifies receipt JWS tokens using **JOSE Remote JWK Set** (via `createRemoteJWKSet(...)`), and the gateway code intentionally **caches the RemoteJWKSet instance for the lifetime of the gateway process** (see `getRemoteJwks()` in `src/server.ts`).

That caching is good (fewer network calls), but it creates one important workflow nuance when you run the “restartless” harnesses.

---

## What can go wrong

Each harness run starts a **new** dev issuer process. That issuer generates a **new Ed25519 key pair** each time it starts (even though the `kid` value is stable).

If the gateway is already running from a previous test run, it may have a cached JWKS key from the *previous* issuer process. When you run the harness again:

- the harness mints a receipt signed by the **new** private key,
- but the gateway may still verify using the **old** cached public key,
- which causes request #2 to fail with:

- `402 Payment Required`
- `error: "Invalid payment receipt (dev harness)"`

This is the “JWKS caching / restartless” failure mode.

**Key symptom:**  
Request #1 (unpaid) returns 402 correctly, minting succeeds, but request #2 returns 402 with “Invalid payment receipt”.

---

## Why the GET harness often “seems fine”

If you ran the gateway + harness in the same `ci:m4` flow (or restarted the gateway just before the harness), the cached JWKS matches the issuer that minted the receipt, so everything passes.

The failure usually appears when you:

1. keep the gateway running across multiple harness runs, **and**
2. each harness run starts a *fresh* issuer with a newly generated key pair.

---

## Recommended workflows (pick one)

### Option A (simple): restart gateway when you rerun harnesses
If you’re doing ad-hoc harness runs and the gateway may already be running:

1. stop the gateway
2. start it with:
   - `X402_ALLOW_DEV_HARNESS=true`
   - `NODE_ENV=development`
   - `CRP_JWKS_URL=http://127.0.0.1:8088/.well-known/jwks.json`
3. run the harness

This guarantees the gateway’s cached JWKS matches the issuer used by the harness.

### Option B (best “restartless”): keep a single issuer running
Instead of letting each harness start its own issuer:

1. start `scripts/dev_jwks_server.mjs` once and keep it running
2. run harnesses without restarting that issuer

Now the key pair stays stable and the gateway’s cached JWKS remains valid.

### Option C (fully deterministic): make the dev issuer key persistent
Modify `scripts/dev_jwks_server.mjs` to load a fixed private key from disk/env so it doesn’t rotate between runs.
This is more work, but makes tests maximally repeatable.

---

## Notes

- `/healthz` confirms the gateway is pointing at the expected `jwksUrl`, but it cannot prove the gateway has refreshed keys (it only shows configuration, not cached key material).
- This nuance only affects **dev harness** flows. In real deployments, the facilitator JWKS should be stable and not regenerated per minute.

---

## TL;DR

If request #2 fails with `Invalid payment receipt (dev harness)` after minting succeeds, it’s usually because:

> the harness started a new dev JWKS issuer (new keypair), but the gateway is still using a cached JWKS from an older issuer.

Restart the gateway, keep one issuer running, or make the issuer key persistent.
