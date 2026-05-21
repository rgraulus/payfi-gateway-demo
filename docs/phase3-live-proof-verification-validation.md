# Phase 3 — Live Buyer Wallet Proof Verification Validation

## Status

Live Concordium ZKP verification has been successfully validated locally for the current Buyer Wallet `VerifiablePresentation` path.

This is an isolated Phase 3 validation milestone. It does not modify Gateway runtime behavior, CRP behavior, `/paid-gated`, payment validation, or `src/policyVerifier.ts`.

## Purpose

The purpose of this validation was to prove that a raw Concordium Browser Wallet proof artifact can be verified locally against live Concordium testnet data using the current `VerifiablePresentation` flow.

The validated path is:

```text
Buyer Wallet raw VerifiablePresentation
→ local proof shape checker
→ getPublicData(...)
→ getCryptographicParameters(...)
→ verifyPresentation(...)
→ verified request returned
```

## Raw Proof Handling

The raw Buyer Wallet proof was saved outside the Git repository.

Example private local path:

```text
~/Documents/XCF-private/phase3-proofs/buyer-proof.raw.json
```

The raw proof was not committed, not copied into the repository, and not printed to terminal output beyond the safe metadata emitted by the checker.

The repository still contains only sanitized fixtures and placeholder artifacts.

## Shape-Only Validation

Command:

```bash
npm run phase3:proof-check -- \
  --proof ~/Documents/XCF-private/phase3-proofs/buyer-proof.raw.json
```

Observed safe summary:

```text
family: phase3_harness_capture_wrapper
hasProofObject: true
hasPresentationContext: true
hasVerifiableCredentialArray: true
statementCount: 1
selectedChainPresent: true
challengePresent: true
rawProofPrinted: false
liveVerificationAttempted: false
```

## Live Verification Validation

Command:

```bash
npm run phase3:proof-check -- \
  --proof ~/Documents/XCF-private/phase3-proofs/buyer-proof.raw.json \
  --live-verify
```

Observed safe result:

```text
liveVerification.ok: true
liveVerification.stage: verified
network: testnet
grpcHost: 127.0.0.1
grpcPort: 20001
credentialCount: 1
verifiedRequestKeys:
  - challenge
  - credentialStatements
rawProofPrinted: false
exit: 0
```

## What This Proves

This validates that the direct Buyer-wallet proof path is technically viable:

```text
Concordium Browser Wallet can generate a proof
The local checker can parse the captured artifact
Public credential metadata can be fetched from Concordium testnet
Cryptographic parameters can be fetched from the local node
verifyPresentation(...) can verify the proof successfully
```

## What This Does Not Yet Prove

This does not yet prove Gateway enforcement.

Specifically, this validation does not yet bind the proof to:

- x402 nonce
- merchantId
- resource
- contractId
- amount
- asset
- payTo
- expiresAt
- chain_id

It also does not yet modify or replace the current demo policy verifier.

## Current Phase 3 Position

Completed so far:

```text
PR #83 — Buyer wallet proof discovery
PR #84 — Browser Wallet proof request harness
PR #85 — Sanitized Buyer proof capture fixture
PR #86 — Offline proof verification preparation
PR #87 — Local proof shape check skeleton
PR #88 — Live proof verification attempt harness
```

This validation confirms that PR #88 works with a real private local Buyer Wallet proof.

## Recommended Next Engineering Step

The next safe step is to define the x402/ZKP binding contract.

That contract should specify exactly how a verified Concordium proof binds to:

- x402 challenge nonce
- merchant
- route/resource
- contract
- payment tuple
- expiry
- chain identity

Only after that binding contract is defined should we build a Gateway-facing verifier adapter.
