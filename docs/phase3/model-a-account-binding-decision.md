# Phase 3 Model A Account-Binding Decision

## Decision

Phase 3 uses **Model A: Eligibility Proof Only**.

In this model, the Concordium wallet proof / Verifiable Presentation proves that the buyer satisfies the required policy, such as age and region eligibility.

It does **not** require the browser wallet harness to provide a usable `wallet.accountAddress`.

## Model A Definition

The Phase 3 release model is:

```text
eligible + paid = release
```

Where:

```text
eligible = challenge-bound Verifiable Presentation satisfies the configured policy
paid     = x402 / CRP receipt proves the payment settled correctly
```

The policy layer and payment layer remain separate:

```text
Policy layer:
  verifies buyer eligibility using a challenge-bound proof

Payment layer:
  verifies x402 payment settlement using CRP receipt validation and replay protection

Release decision:
  requires both policy eligibility and payment settlement
```

## Account Address Status

For Phase 3, `wallet.accountAddress` is diagnostic metadata.

It is not required for local wallet proof capture or verifier integration.

The wallet proof capture harness may report:

```json
{
  "walletAccountAddressPresent": false,
  "accountBindingStatus": "wallet_api_missing"
}
```

This means:

```text
- wallet metadata exists
- selectedChain exists
- challenge/proof exists
- the browser wallet account-selection API did not return an account address
```

It does **not** mean:

```text
- the Verifiable Presentation failed
- the proof capture path is broken
- payment was released
- CRP was called
- replay protection was touched
- production account-bound authorization has been approved
```

## Safety Constraint

Missing `wallet.accountAddress` must remain explicit.

It must not be silently interpreted as production account-bound authorization.

The following safety flags must remain false during local capture and verifier-prep harness runs:

```json
{
  "rawProofPrinted": false,
  "persisted": false,
  "paymentReleaseAttempted": false,
  "paymentResponseEmitted": false,
  "crpCalled": false,
  "replayTouched": false
}
```

## What Model A Does Not Claim

Model A does not claim that:

```text
wallet account address must be present
wallet account address must match payer
wallet account address alone authorizes release
missing wallet account address is production-ready account-bound authorization
```

The Gateway must never release protected content based only on a wallet proof.

The Gateway release condition remains:

```text
eligible + paid = release
```

## Future Model B

A future hardening step may define **Model B: Account-Bound Eligibility Proof**.

Model B would require an explicit design for:

```text
- whether the Verifiable Presentation must identify a specific Concordium account
- whether the payment sender must match that proven account
- which verified proof field establishes account identity
- how account binding interacts with x402 receipt validation and replay protection
```

Until Model B is explicitly designed and implemented, Phase 3 should continue with Model A.

## Practical Implication

For the next Phase 3 engineering steps, `accountBindingStatus: "wallet_api_missing"` is acceptable for local capture and verifier integration work.

It remains a visible diagnostic state and must not be hidden, coerced, or treated as account-bound production authorization.
