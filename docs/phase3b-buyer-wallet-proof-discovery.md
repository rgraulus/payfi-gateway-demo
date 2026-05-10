# Phase 3B — Concordium Buyer Wallet Proof Discovery

## Status

Discovery draft for Phase 3B PR 1.

This document records the first discovery findings for the Direct Buyer Wallet Proof Path. It does not change Gateway runtime behavior, payment logic, CRP behavior, policy verification, or release logic.

## Objective

Phase 3B starts by discovering the official Concordium wallet proof-generation and proof-verification path before integrating real ZKP verification into the Gateway.

The immediate goal is not to implement the full Delegated Agent proof model.

The immediate goal is:

```text
Use a funded Buyer wallet to generate/capture a real Concordium proof artifact,
then understand how that artifact should be verified and mapped into the
existing concordium_zkp_v1 proof envelope.
```

This is the identity-root baseline that later delegated Agent proofs depend on.

## Guardrails

For PR 1:

- Do not modify `/paid-gated` release behavior.
- Do not modify CRP.
- Do not modify payment proof validation.
- Do not modify `src/policyVerifier.ts`.
- Do not add runtime ZKP verification yet.
- Do not add SDK dependencies yet unless a later PR explicitly scopes that change.
- Keep this PR documentation/discovery-only.

## Current Repo Dependency State

The repo currently has:

```text
@concordium/web-sdk@12.0.2
```

Observed via:

```bash
npm ls @concordium/web-sdk @concordium/browser-wallet-api-helpers @concordium/wallet-connectors
```

Current result:

```text
payfi-gateway-demo@1.0.0
└── @concordium/web-sdk@12.0.2
```

The repo does not currently install:

```text
@concordium/wallet-connectors
@concordium/browser-wallet-api-helpers
@concordium/react-components
```

NPM version discovery showed:

```text
@concordium/web-sdk                     12.0.2
@concordium/wallet-connectors           0.9.0-alpha.0
@concordium/browser-wallet-api-helpers  3.3.0
@concordium/react-components            0.9.0-alpha.0
```

## Official Concordium Integration Guide Takeaways

The Concordium Verify & Access integration guide describes a production verification flow with these major components:

1. A frontend capable of connecting to the user's wallet.
2. A wallet connection / proof request flow.
3. A backend verifier flow.
4. Concordium gRPC V2 access for chain state.
5. Optional/self-hosted Concordium Verifier Service for validating ZKP proofs.

The guide identifies these relevant frontend/wallet libraries:

```text
@concordium/web-sdk
@concordium/wallet-connectors
@concordium/browser-wallet-api-helpers
@concordium/react-components
```

Important interpretation for this project:

- `@concordium/web-sdk` is already present and exposes backend/web3-id proof primitives.
- Browser-wallet proof generation likely needs a wallet-facing package such as `@concordium/wallet-connectors` or `@concordium/browser-wallet-api-helpers`.
- Full backend verification may either use direct SDK APIs or Concordium's Verifier Service pattern.
- Gateway integration should wait until a proof can be generated and verified in isolation.

## Local SDK Discovery

Inspection of `@concordium/web-sdk@12.0.2` showed that the package exposes Web3 ID and verifiable-presentation modules.

Relevant files observed inside `node_modules/@concordium/web-sdk` include:

```text
lib/esm/pub/web3-id.js
lib/esm/web3-id/index.d.ts
lib/esm/web3-id/proofs.d.ts
lib/esm/web3-id/types.d.ts
lib/esm/id/idProofs.d.ts
lib/esm/id/idProofTypes.d.ts
lib/esm/types/VerifiablePresentation.d.ts
lib/esm/wasm/VerifiablePresentationV1/index.d.ts
lib/esm/wasm/VerifiablePresentationV1/request.d.ts
lib/esm/wasm/VerifiablePresentationV1/proof.d.ts
lib/esm/wasm/VerifiablePresentationV1/types.d.ts
```

Relevant exported symbols observed from `@concordium/web-sdk` include:

```text
AccountStatementBuild
AtomicStatementBuilder
IdStatementBuilder
VerificationRequestV1
VerifiablePresentation
VerifiablePresentationV1
Web3StatementBuilder
attributesWithRange
attributesWithSet
getVerifiablePresentation
verifyPresentation
verifyIdstatement
verifyAtomicStatements
verifyCredentialMetadata
verifyWeb3IdCredentialSignature
```

Relevant exported symbols observed from `@concordium/web-sdk/web3-id` include:

```text
AccountStatementBuild
AtomicStatementBuilder
Web3StatementBuilder
canProveAtomicStatement
canProveCredentialStatement
verifyAtomicStatements
verifyCredentialMetadata
```

Relevant exported symbols observed from `@concordium/web-sdk/id` include:

```text
IdStatementBuilder
attributesWithRange
attributesWithSet
verifyIdstatement
```

## Identity Statement Discovery

The SDK includes identity statement helpers relevant to the current age/region policy.

`IdStatementBuilder` supports:

```text
addMinimumAge(age)
addMaximumAge(age)
addAgeInRange(minAge, maxAge)
addEUResidency()
addEUNationality()
addRange(attribute, lower, upper)
addMembership(attribute, set)
addNonMembership(attribute, set)
revealAttribute(attribute)
```

This maps well to the Phase 3A policy direction:

```text
EU >= 18
US >= 21
default deny
```

However, the exact proof request JSON expected by the wallet must still be discovered from the wallet-facing API.

## Verifiable Presentation V1 Discovery

The SDK exposes `VerifiablePresentationV1` APIs that appear relevant to backend verification.

Observed capabilities include:

```text
VerificationRequestV1.createAndAnchor(...)
VerificationRequestV1.create(...)
VerificationRequestV1.verifyAnchor(...)

VerifiablePresentationV1.createFromAnchor(...)
VerifiablePresentationV1.create(...)
VerifiablePresentationV1.getPublicData(...)
VerifiablePresentationV1.verify(...)
VerifiablePresentationV1.verifyWithNode(...)
```

Interpretation:

- SDK-level backend verification appears possible.
- Verification can also query a Concordium node through gRPC.
- The official guide's Verifier Service may wrap this type of functionality for production deployment.
- PR 1 should not choose between direct SDK verification and Verifier Service yet.

## Current Buyer Wallet Assumption

The user has a funded Concordium Browser Wallet connected to Testnet, with stablecoins for x402 payments and CCD for gas.

This is suitable for the next Phase 3B step, because the direct Buyer-wallet proof path likely requires wallet interaction.

## Current Open Questions

1. What exact method does the Concordium Browser Wallet expose for requesting an identity proof or verifiable presentation?
2. Is `@concordium/browser-wallet-api-helpers` sufficient for the browser-extension-only path?
3. Is `@concordium/wallet-connectors` preferable even for local proof-harness work because it abstracts browser extension and WalletConnect/Reown flows?
4. What exact JSON proof/presentation shape is returned by the wallet?
5. Does the wallet proof response map more directly to:
   - `VerifiablePresentation`
   - `VerifiablePresentationV1`
   - `Web3IdProofInput`
   - another wallet-specific envelope?
6. Should the first proof harness request an anchored verification request, or can it request an unanchored/local proof for development?
7. For Gateway integration later, should backend verification call:
   - direct `@concordium/web-sdk` verification APIs, or
   - a local Concordium Verifier Service container?

## Recommended Next PR

Phase 3B PR 2 should create a minimal local browser-facing proof request harness.

Recommended scope:

- Add the minimum wallet-facing dependency needed for proof generation.
- Do not touch Gateway runtime.
- Do not touch CRP.
- Do not touch `src/policyVerifier.ts`.
- Create a small local proof harness that connects to the funded Buyer Concordium Browser Wallet.
- Build a proof request for the age/region policy.
- Capture the returned wallet proof/presentation JSON.
- Save only sanitized proof artifacts unless explicitly approved.

Possible package direction:

```text
Option A: @concordium/browser-wallet-api-helpers
Option B: @concordium/wallet-connectors
```

Initial recommendation:

Start with the smallest browser-extension path if the immediate target is the user's funded Concordium Browser Wallet on Testnet. Revisit `@concordium/wallet-connectors` if WalletConnect/Reown or mobile wallet support becomes necessary.

## Summary

Phase 3B PR 1 confirms:

```text
Backend SDK primitives are already present through @concordium/web-sdk@12.0.2.
Wallet proof generation likely requires an additional wallet-facing package.
The first real implementation step should be an isolated browser proof harness.
Gateway release behavior should remain untouched until proof generation and verification are proven outside the Gateway.
```
