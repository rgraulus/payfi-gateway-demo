# Demo PoC — Phase 1 (Truth Pipeline)

This folder contains Phase 1 PoC orchestration scripts.

## What Phase 1 proves
- Gateway enforces x402 semantics for a real paid asset (bytes)
- Upstream resource server is **not reachable from host** (no bypass path)
- The canonical buyer script remains the regression test:
  - `scripts/e2e-autorun-proxy.sh`

## Run
From repo root:

```bash
chmod +x scripts/poc/demo/phase1/*.sh
./scripts/poc/demo/phase1/smoke.sh