# X402 v2 + Concordium Gateway Contract (Phase A Freeze)

This document freezes the gateway HTTP behavior for a paid resource using x402 v2 headers.
Goal: make the 402 negotiation stable and machine-checkable BEFORE scripting automation.

## Endpoint

### GET /paid?nonce={nonce}

- `nonce` (required): opaque string provided by client. Used to correlate the challenge round-trip.
- Resource is protected; unpaid requests return 402 with PAYMENT-REQUIRED header.

## Unpaid Response (402)

When no acceptable payment proof has been provided (or proof invalid / not verified):

- Status: `402 Payment Required`
- Required headers:
  - `PAYMENT-REQUIRED: <base64(json)>`
- Recommended headers:
  - `Content-Type: application/json`
- Optional body (DX only):
  - `{ "paid": false, "reason": "payment_required", "nonce": "...", "contractId": "cid_..." }`

### PAYMENT-REQUIRED Encoding Rules

- JSON encoded in UTF-8
- Base64 is RFC4648 standard Base64 with padding (`=` allowed)
- No line breaks

### PAYMENT-REQUIRED JSON Shape (frozen)

The header contains base64(JSON) with the following fields:

```json
{
  "version": "x402-v2",
  "contractId": "cid_<sha256-hex>",
  "contractVersion": "1.0.0",
  "isFrozen": true,

  "merchantId": "demo-merchant",
  "resource": { "method": "GET", "path": "/paid" },

  "nonce": "<client nonce>",
  "issuedAt": 1730000000,
  "expiresAt": 1730000300,

  "network": "ccd:testnet",
  "asset": { "type": "PLT", "tokenId": "EUDemo", "decimals": 6 },
  "amount": "0.050101",
  "payTo": "<merchant account address>",

  "attestations": []
}
```

Notes:
- `contractId` is derived ONLY from the ContractDefinition in `config/contracts.json` (see below), not from nonce/time.
- `issuedAt` and `expiresAt` are seconds since epoch.
- `attestations` is reserved for future Verify & Pay / identity attribute requirements.

## Paid Response (200)

When the gateway considers the payment satisfied/verified:

- Status: `200 OK`
- Required headers:
  - `PAYMENT-RESPONSE: <base64(json)>`
- Recommended headers:
  - `Content-Type: application/json` (or the resource content type)

### PAYMENT-RESPONSE Encoding Rules

Same as PAYMENT-REQUIRED:
- UTF-8 JSON, RFC4648 base64, padding OK, no line breaks.

### PAYMENT-RESPONSE JSON Shape (Phase A)

For Phase A we only freeze:
- The header MUST exist and be decodable as JSON
- The JSON MUST include:
  - `version`, `contractId`, `merchantId`, `nonce`
  - `settled` boolean

Example:

```json
{
  "version": "x402-v2",
  "contractId": "cid_...",
  "merchantId": "demo-merchant",
  "nonce": "...",
  "settled": true
}
```

(Phase B/C will freeze the proof / receipt fields.)

## Contract Freeze / Anti-Bait-and-Switch Rules

The gateway maintains a registry of ContractDefinitions.
Each ContractDefinition has:
- `contractId` = sha256(canonical_json(definition))
- `isFrozen = true` means the gateway MUST refuse to start if the computed hash does not match the declared id.

Any change to price, payTo, asset, network, or attestations MUST produce a new contractId.

## Multi-Contract Readiness

The gateway uses a resolver:
- incoming request -> contractId
This is currently a simple path/method mapping but is designed to scale to multi-app multi-resource manifests later.

