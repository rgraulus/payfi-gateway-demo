# Phase 3 Live Wallet Proof Verification Local Run

## Purpose

This note records the first successful local live-verification run against a real Concordium Browser Wallet presentation capture.

The run validates the verifier path only. It does not wire the proof into Gateway release behavior.

## Input

The input was a local-only real wallet capture file outside the repository:

```text
/tmp/xcf-wallet-captures/my-fresh-wallet-capture-after-pr114.json
```

This file must not be committed, pasted into chat, uploaded, or stored as a fixture.

## Command

```bash
PRIVATE_PROOF="/tmp/xcf-wallet-captures/my-fresh-wallet-capture-after-pr114.json"

npx ts-node scripts/phase3-proof-shape-check.ts --proof "$PRIVATE_PROOF" --live-verify
```

## Result

Live verification succeeded.

Important safe metadata:

```json
{
  "ok": true,
  "family": "phase3_harness_capture_wrapper",
  "hasProofObject": true,
  "hasPresentationContext": true,
  "hasVerifiableCredentialArray": true,
  "statementCount": 1,
  "selectedChainPresent": true,
  "challengePresent": true,
  "rawProofPrinted": false,
  "liveVerificationAttempted": true,
  "liveVerification": {
    "ok": true,
    "stage": "verified",
    "network": "testnet",
    "grpcHost": "127.0.0.1",
    "grpcPort": 20001,
    "credentialCount": 1,
    "verifiedRequestKeys": [
      "challenge",
      "credentialStatements"
    ],
    "rawProofPrinted": false
  }
}
```

## Interpretation

This proves that the real Browser Wallet presentation can be parsed and live-verified by the current Phase 3 verifier tooling.

Specifically, the verifier path confirmed:

```text
real Browser Wallet presentation
→ parsed successfully
→ public verification data resolved
→ verification succeeded
→ challenge and credentialStatements were verified
```

## Safety Boundaries

This run did not perform or imply any of the following:

```text
payment release
PAYMENT-RESPONSE emission
CRP call
replay mutation
route wiring
production authorization
```

The run was verifier-only.

## Relationship to Model A

This result supports the Phase 3 Model A decision:

```text
eligible + paid = release
```

The live wallet proof verifies buyer eligibility material. Payment settlement remains separately governed by x402 / CRP receipt validation and replay protection.

This run does not require `wallet.accountAddress` and does not implement Model B account-bound authorization.

## Next Step

The next engineering step can use this successful verifier result to design the safest integration seam between:

```text
policy eligibility verification
x402 payment receipt verification
final Gateway release decision
```

No Gateway route should release protected content until both eligibility and payment settlement checks pass.

## Current PR #223 diagnostic harness command

The historical verifier-only run above remains valid evidence that a real Concordium Browser Wallet presentation could be live-verified locally.

After PR #223, the current canonical verifier-only command is the live Direct Buyer verifier diagnostic harness:

    PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

    PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true \
      PHASE3_GRPC_HOST=127.0.0.1 \
      PHASE3_GRPC_PORT=20001 \
      PHASE3_CONCORDIUM_NETWORK=testnet \
      npm run phase3:live-direct-buyer-verifier-diagnostic-test -- "$PRIVATE_PROOF"

For public Concordium testnet gRPC, use:

    PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

    PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true \
      PHASE3_GRPC_HOST=grpc.testnet.concordium.com \
      PHASE3_GRPC_PORT=20000 \
      PHASE3_CONCORDIUM_NETWORK=testnet \
      npm run phase3:live-direct-buyer-verifier-diagnostic-test -- "$PRIVATE_PROOF"

Expected success metadata from the current harness includes:

    ok: true
    code: verified
    liveVerifyAttempted: true
    verifierOk: true
    verifierStage: verified
    credentialCount: 1
    challengeBinding: walletChallenge
    challengeBound: true
    rawProofPrinted: false
    rawReceiptPrinted: false

This remains verifier-only. It does not release content, emit PAYMENT-RESPONSE, call CRP, call CRP fulfill, submit or decode receipts, touch replay, wire Gateway routes, or authorize production release.

Milestone 3B should re-establish the real wallet proof verification result using this current diagnostic harness and a local-only real wallet capture file.
