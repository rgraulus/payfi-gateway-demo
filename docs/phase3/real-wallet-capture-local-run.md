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
