# Phase 3B Buyer Wallet Proof Harness

Isolated browser-facing proof discovery harness for Phase 3B.

This harness is intentionally outside the Gateway runtime. It does not call the Gateway, CRP, /paid-gated, or src/policyVerifier.ts.

Purpose:
Concordium Browser Wallet -> wallet proof request -> wallet-generated Verifiable Presentation -> copy/save proof JSON for later offline verification.

Requirements:
- Concordium Browser Wallet Chrome extension
- Wallet connected to Concordium Testnet
- Funded Buyer account available in the wallet
- @concordium/browser-wallet-api-helpers
- @concordium/web-sdk

Local usage from repo root:
npx vite --host 127.0.0.1 poc/phase3b-buyer-wallet-proof-harness

Open the local Vite URL in Chrome with the Concordium Browser Wallet extension enabled.

Notes:
This is a discovery harness only. Do not commit returned proof/presentation JSON unless it is sanitized and explicitly approved.

Discovery caveat:
The harness currently uses a broad test identity-provider allowlist `[0, 1, 2, 3, 4, 5]` for local proof discovery. This is not a production trust policy.
