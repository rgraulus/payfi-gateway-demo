# Phase 3 — Buyer Wallet Proof Capture

## Status

Phase 3 PR 3 capture and sanitization note.

This document records the first successful Buyer wallet proof capture using the isolated Browser Wallet proof harness.

No raw wallet proof material is committed.

## Purpose

The purpose of PR 3 is to capture the shape of a real Concordium Browser Wallet proof response without committing sensitive proof material.

The direct Buyer wallet proof path is the baseline for later Gateway verification and later delegated Agent proof work.

## Capture Harness

The proof was captured using:

poc/phase3b-buyer-wallet-proof-harness

The harness was served locally with:

npx vite --host 127.0.0.1 poc/phase3b-buyer-wallet-proof-harness

The browser flow was:

1. Open local Vite URL in Chrome.
2. Detect Concordium Browser Wallet.
3. Connect the funded Buyer wallet account.
4. Request a Verifiable Presentation.
5. Approve the Proof of Identity Request in the wallet popup.
6. Confirm the harness reached presentation_received.

## Validation Result

The wallet proof request succeeded.

Observed final harness state:

ok: true
step: presentation_received

This confirms that the browser harness can request a Verifiable Presentation from the Concordium Browser Wallet on Testnet.

## Requested Statement Shape

The harness requested an identity credential statement with:

- minimum age: 18
- EU country of residence
- broad test identity-provider issuer allowlist: [0, 1, 2, 3, 4, 5]

The wallet translated the minimum age rule into a date-of-birth range statement.

The wallet translated the EU residency rule into a countryOfResidence membership statement with EU country codes.

## Redaction Policy

Raw wallet proof material must not be committed.

The sanitized fixture may preserve:

- high-level wrapper shape
- statement shape
- non-sensitive network identifier
- placeholder account field
- placeholder challenge field
- placeholder presentation payload field
- notes about omitted raw proof material

The sanitized fixture must redact or omit:

- buyer account address
- raw challenge value
- raw presentationContext value
- raw proof object contents
- raw proof signatures
- credential-specific proof material
- any verifier-sensitive cryptographic payloads
- exact capture timestamps if not needed

## Sanitized Fixture

The sanitized fixture is:

fixtures/concordium-zkp/phase3-buyer-proof.sample.json

This fixture is intentionally marked:

sanitized: true
doNotUseForVerification: true
rawProofCommitted: false

It is a shape sample only.

It is not a valid cryptographic proof.

## Mapping Toward concordium_zkp_v1

The captured proof shape maps toward the Phase 3A direct Buyer-wallet authorization proof envelope:

type: concordium_zkp_v1
chain_id: ccd:<genesisHash>
subjectAccountId: ccd:<genesisHash>:<buyerAccount>
proofRequestId: age_min_by_region_v1
presentation.format: concordium_verifiable_presentation
presentation.payload: <wallet presentation>

Future Gateway integration must bind this proof to the x402 challenge context before release.

Required bindings remain:

- nonce
- merchantId
- resource
- contractId
- amount
- asset
- payTo
- expiresAt
- chain_id

## Important Limitation

The current harness proves that the Browser Wallet can produce a presentation for the requested statement.

This PR does not yet verify the presentation offline.

This PR does not yet integrate with src/policyVerifier.ts.

This PR does not yet alter /paid-gated behavior.

## Next Step

The next step should be offline verification preparation.

That work should determine whether verification should use:

- direct @concordium/web-sdk VerifiablePresentation APIs
- VerifiablePresentationV1 APIs
- Concordium Verifier Service
- a combination of SDK verification and verifier-service validation

Only after isolated verification succeeds should the project consider Gateway policy verifier integration.
