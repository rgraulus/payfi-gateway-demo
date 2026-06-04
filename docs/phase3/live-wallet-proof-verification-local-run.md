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
