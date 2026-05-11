# Phase 3 — Offline Proof Verification Preparation

## Status

Phase 3 PR 4 preparation note.

This document defines the safe offline verification path for the Concordium Buyer Wallet proof artifact captured in Phase 3 PR 3.

This PR does not perform Gateway integration.

## Purpose

The purpose of PR 4 is to prepare the verification path for the current Browser Wallet proof artifact without depending on live Testnet availability and without committing raw proof material.

The current Browser Wallet harness uses:

requestVerifiablePresentation(challenge, statements)

That means the captured artifact follows the current VerifiablePresentation path, not the VerifiablePresentationV1 anchored request path.

## Guardrails

This PR must not modify:

- Gateway runtime behavior
- /paid-gated release logic
- CRP behavior
- payment proof validation
- src/policyVerifier.ts
- production verifier behavior

This PR must not commit raw wallet proof material.

## Current Artifact Path

The existing proof harness is located at:

poc/phase3b-buyer-wallet-proof-harness

The harness calls the Concordium Browser Wallet API method:

requestVerifiablePresentation(challenge, statements)

The wallet returns a VerifiablePresentation artifact.

The relevant current SDK verification path is:

- verifyPresentation(presentation, globalContext, publicData)
- getPublicData(grpc, network, presentation, blockHash?)

## Required Verification Inputs

A full offline or semi-offline verification flow will require:

- raw wallet VerifiablePresentation artifact
- Concordium network identifier
- Concordium global cryptographic parameters
- public credential metadata / credential inputs
- gRPC access to Concordium chain state, unless public data is supplied separately
- optional block hash for deterministic historical verification
- the original proof request / challenge context
- x402 binding context for later Gateway integration

## SDK Discovery Summary

The installed @concordium/web-sdk exposes the current VerifiablePresentation verification APIs.

Relevant declarations observed:

- node_modules/@concordium/web-sdk/lib/esm/wasm/VerifiablePresentation.d.ts
- node_modules/@concordium/web-sdk/lib/esm/web3-id/grpc.d.ts

The current path includes:

- verifyPresentation(...)
- getPublicData(...)

The SDK also exposes a newer VerifiablePresentationV1 path.

Relevant declarations observed:

- node_modules/@concordium/web-sdk/lib/esm/wasm/VerifiablePresentationV1/proof.d.ts
- node_modules/@concordium/web-sdk/lib/esm/wasm/VerifiablePresentationV1/request.d.ts

The V1 path includes:

- requestVerifiablePresentationV1(...) on the Browser Wallet API
- VerificationRequestV1
- VerifiablePresentationV1.fromJSON(...)
- VerifiablePresentationV1.verify(...)
- VerifiablePresentationV1.verifyWithNode(...)

## Current Decision

PR 4 should focus on the current VerifiablePresentation path because that is what the existing Browser Wallet harness already produces.

No harness change is required for PR 4.

The V1 / anchored verification path should remain a future decision point.

## Future Harness Extension

A future PR may add a second harness path for:

requestVerifiablePresentationV1(request)

That should be treated as a separate scope because the V1 path appears to require a VerificationRequestV1 object and may require an anchored request model.

## Verification Strategy

The safest staged verification strategy is:

1. Keep raw proof material outside the repo.
2. Use a local uncommitted proof JSON file for verification experiments.
3. Parse the wallet presentation locally.
4. Fetch public credential metadata from Concordium chain state through gRPC when infrastructure is healthy.
5. Call verifyPresentation(...) with the presentation, global context, and public data.
6. Compare the verified request with the expected proof statement.
7. Only after isolated verification succeeds, design the Gateway verifier adapter.

## Raw Proof Handling Rule

Raw wallet proof material must not be committed.

A future verification harness should require an explicit local file path, for example:

PHASE3_BUYER_PROOF_PATH=/local/private/path/buyer-proof.raw.json

The harness should fail fast if the path is not provided.

The repo should only contain sanitized fixtures.

## Relationship to concordium_zkp_v1

The current proof path should eventually map into the direct Buyer-wallet authorization envelope:

type: concordium_zkp_v1
chain_id: ccd:<genesisHash>
subjectAccountId: ccd:<genesisHash>:<buyerAccount>
proofRequestId: age_min_by_region_v1
presentation.format: concordium_verifiable_presentation
presentation.payload: <wallet presentation>

Later Gateway integration must additionally bind the proof to:

- x402 nonce
- merchantId
- resource
- contractId
- amount
- asset
- payTo
- expiresAt
- chain_id

## Important Limitation

This PR does not claim that cryptographic verification has succeeded.

This PR only prepares and documents the verification path.

Live verification should be attempted only when Concordium Testnet / gRPC infrastructure is healthy.

## Recommended Next Step

After this PR, the next implementation step should be an isolated verification script that:

- accepts a local uncommitted raw proof file path
- validates the expected top-level shape
- detects whether the artifact is VerifiablePresentation or VerifiablePresentationV1
- refuses to run against the sanitized sample fixture
- does not write proof material to the repo
- optionally attempts live gRPC verification when infrastructure is available
