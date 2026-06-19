# Phase 3 — Real Wallet Capture Local Run

Use this only for local, uncommitted wallet proof captures.

## Safety rules

- Do not commit real wallet proof material.
- Do not paste real proof material into PRs, issues, or logs.
- Keep real capture files outside the repo or in ignored local paths.
- Use the committed sanitized fixture for examples.

## Safe committed example

Run the harness against the sanitized fixture already committed to the repo:

    PHASE3_WALLET_PROOF_CAPTURE_HARNESS=true \
      npm run phase3:wallet-proof-capture -- fixtures/phase3/wallet-proof-example.direct-buyer.json

## Local real capture run

Store the real capture outside the repo, for example:

    REAL_CAPTURE="/tmp/my-real-wallet-capture.json"

Then run:

    PHASE3_WALLET_PROOF_CAPTURE_HARNESS=true \
      npm run phase3:wallet-proof-capture -- "$REAL_CAPTURE"

Expected safe output includes metadata only:

    rawProofPrinted: false
    persisted: false
    paymentReleaseAttempted: false
    paymentResponseEmitted: false
    crpCalled: false
    replayTouched: false

This harness does not release content, emit PAYMENT-RESPONSE, call CRP, or touch replay.

## Do not commit real captures

Before committing, check:

    git status --short

Only documentation, scripts, or sanitized fixtures should appear. Real wallet capture files must not be staged or committed.

## Current PR #223 diagnostic harness workflow

For Milestone 3B, keep real wallet proof captures local-only. The preferred ignored local path is:

    .local/phase3/live-direct-buyer/

Example local proof path:

    PRIVATE_PROOF=".local/phase3/live-direct-buyer/captured-wallet-proof.direct-buyer.local.json"

After a real Browser Wallet presentation capture has been saved locally, first run the existing normalization harness:

    PHASE3_WALLET_PROOF_CAPTURE_HARNESS=true \
      npm run phase3:wallet-proof-capture -- "$PRIVATE_PROOF"

Then run the current live verifier diagnostic harness added in PR #223:

    PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true \
      PHASE3_GRPC_HOST=127.0.0.1 \
      PHASE3_GRPC_PORT=20001 \
      PHASE3_CONCORDIUM_NETWORK=testnet \
      npm run phase3:live-direct-buyer-verifier-diagnostic-test -- "$PRIVATE_PROOF"

For public Concordium testnet gRPC, use:

    PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true \
      PHASE3_GRPC_HOST=grpc.testnet.concordium.com \
      PHASE3_GRPC_PORT=20000 \
      PHASE3_CONCORDIUM_NETWORK=testnet \
      npm run phase3:live-direct-buyer-verifier-diagnostic-test -- "$PRIVATE_PROOF"

Milestone 3B is complete when a local-only real wallet proof can be read by the diagnostic harness and live verification succeeds with safe metadata, including:

    ok: true
    code: verified
    liveVerifyAttempted: true
    verifierOk: true
    verifierStage: verified
    challengeBinding: walletChallenge
    challengeBound: true
    rawProofPrinted: false
    rawReceiptPrinted: false

This workflow does not release content, emit PAYMENT-RESPONSE, call CRP, call CRP fulfill, submit or decode receipts, touch replay, or authorize production release.
