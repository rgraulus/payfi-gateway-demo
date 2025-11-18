# Proto-x402 402 Demo Contract

> **Status:** Demo-only, non-production  
> **Endpoint:** `GET /demo/402`  
> **HTTP status:** Always `402 Payment Required` on success

This document describes the *demo* JSON response shape returned by the `payfi-gateway-demo` service on `GET /demo/402`.  
It is intended as a proto-contract for future x402-style integrations and **must not** be treated as a stable or production API.

The endpoint is currently backed by the Concordium Facilitator (CRP) running on `http://localhost:8080` and seeded demo data for:

- `merchantId`: `demo-merchant`
- `network`: `concordium:testnet`
- `tokenId`: `usd:test`
- `payTo`: `ccd1qexampleaddress`
- `amount`: `25.00` (PLT, 2 decimals)

---

## 1. Top-level response shape

On success, the endpoint returns `HTTP 402` with a JSON body of the following shape:

```json
{
  "ok": true,
  "kind": "demo.proto-x402",
  "x402": { ... },
  "debug": { ... }
}
```

- `ok`: Boolean. `true` indicates the demo flow executed successfully.
- `kind`: String. For now always `"demo.proto-x402"` to clearly mark this as demo-only.
- `x402`: The proto-x402 envelope (see below).
- `debug`: Raw debug data used for the demo (see below). This is **not** part of any future stable x402 contract.

On internal error (for example, if the demo CRP call fails), the endpoint returns `HTTP 500` with a minimal payload:

```json
{
  "ok": false,
  "error": "Internal error during proto-x402 402 demo"
}
```

The exact error message may change; clients should treat `ok === false` as a hard failure and *not* try to parse an `x402` object.

---

## 2. `x402` envelope

The core of the response is the `x402` object:

```json
{
  "version": "0.1",
  "gateway": {
    "id": "payfi-gateway-demo",
    "merchantId": "demo-merchant"
  },
  "payment": {
    "nonce": "n-1763272560",
    "network": "concordium:testnet",
    "asset": {
      "type": "PLT",
      "tokenId": "usd:test",
      "decimals": 2
    },
    "amount": "25.00",
    "payTo": "ccd1qexampleaddress"
  },
  "state": {
    "status": "fulfilled",
    "receipt": {
      "jws": "<JWS string>",
      "payload": {
        "asset": {
          "type": "PLT",
          "tokenId": "usd:test",
          "decimals": 2
        },
        "nonce": "n-1763272560",
        "amount": "25.00",
        "paidTo": "ccd1qexampleaddress",
        "network": "concordium:testnet",
        "finalizedAt": "2025-11-16T05:56:02Z"
      }
    }
  }
}
```

### 2.1 `version`

- **Field:** `x402.version`
- **Type:** string
- **Current value:** `"0.1"`
- **Purpose:** Experimental protocol version for this demo.
- **Notes:** This will likely change as the x402 shape evolves. Clients may eventually negotiate behavior based on this value.

### 2.2 `gateway`

```json
"gateway": {
  "id": "payfi-gateway-demo",
  "merchantId": "demo-merchant"
}
```

- **`gateway.id`**  
  - Type: string  
  - Demo value: `"payfi-gateway-demo"`  
  - Meaning: Logical identifier for this gateway implementation or deployment.  
- **`gateway.merchantId`**  
  - Type: string  
  - Demo value: `"demo-merchant"`  
  - Meaning: Merchant identifier as known to the gateway and CRP.

In a future production context, `gateway.id` and `gateway.merchantId` would be important for routing, policy, and logging.

### 2.3 `payment`

```json
"payment": {
  "nonce": "n-1763272560",
  "network": "concordium:testnet",
  "asset": {
    "type": "PLT",
    "tokenId": "usd:test",
    "decimals": 2
  },
  "amount": "25.00",
  "payTo": "ccd1qexampleaddress"
}
```

Fields:

- **`payment.nonce`**  
  - Type: string  
  - Meaning: Gateway-level payment nonce (unique identifier for this payment attempt). Derived from CRP.  
- **`payment.network`**  
  - Type: string  
  - Demo value: `"concordium:testnet"`  
  - Meaning: Logical network / chain identifier.  
- **`payment.asset`**  
  - Type: object  
  - Fields:
    - `type`: `"PLT"` – indicates a Protocol-Level Token on Concordium.  
    - `tokenId`: `"usd:test"` – demo token identifier.  
    - `decimals`: `2` – number of decimal places.  
- **`payment.amount`**  
  - Type: string  
  - Demo value: `"25.00"`  
  - Meaning: Human-readable decimal amount, respecting `asset.decimals`.  
- **`payment.payTo`**  
  - Type: string  
  - Demo value: `"ccd1qexampleaddress"`  
  - Meaning: Destination account address on the underlying network.

### 2.4 `state`

```json
"state": {
  "status": "fulfilled",
  "receipt": {
    "jws": "<JWS string>",
    "payload": {
      "asset": {
        "type": "PLT",
        "tokenId": "usd:test",
        "decimals": 2
      },
      "nonce": "n-1763272560",
      "amount": "25.00",
      "paidTo": "ccd1qexampleaddress",
      "network": "concordium:testnet",
      "finalizedAt": "2025-11-16T05:56:02Z"
    }
  }
}
```

- **`state.status`**  
  - Type: string  
  - Demo value: `"fulfilled"`  
  - Meaning: Current state of the payment *as known to the gateway*.  
  - For this demo, we only expose `"fulfilled"` but future statuses could include `"pending"`, `"expired"`, `"failed"`, etc.

- **`state.receipt`**  
  - Type: object  
  - Fields:
    - `jws`: Compact JWS string (EdDSA-signed) wrapping the receipt payload.  
    - `payload`: Parsed JWS payload, currently mirroring the structure emitted by the CRP / Concordium facilitator for this demo payment.

The exact receipt format and signature scheme are controlled by the facilitator / CRP and may evolve independently of the gateway. In a production-grade x402 spec, `state.receipt` would likely reference a more formally defined receipt type.

---

## 3. `debug` block (demo-only)

The `debug` object surfaces the raw CRP responses used to build the `x402` envelope. It is **strictly demo / dev tooling** and not meant as stable contract.

Shape (simplified):

```json
"debug": {
  "filters": {
    "merchantId": "demo-merchant",
    "network": "concordium:testnet",
    "tokenId": "usd:test",
    "payTo": "ccd1qexampleaddress",
    "status": "fulfilled",
    "limit": 1
  },
  "match": {
    "ok": true,
    "reason": "exact_match",
    "count": 1,
    "match": { /* CRP payment record */ }
  },
  "fulfill": {
    "ok": true,
    "reason": "exact_match",
    "count": 1,
    "match": { /* CRP payment record after fulfill */ },
    "webhook": {
      "configured": false,
      "attempted": false,
      "ok": false
    }
  }
}
```

Notes:

- `debug.filters`: Effective filters applied when querying CRP.  
- `debug.match`: Direct JSON from `/v1/crp/payments/match`.  
- `debug.fulfill`: Direct JSON from `/v1/crp/payments/fulfill`.  
- `debug.fulfill.webhook`: Reflects the webhook configuration in the facilitator (demo environment usually has `configured: false`).

Clients **must not** rely on the structure of `debug`. It exists only to help developers see the underlying data sources.

---

## 4. Demo assumptions and limitations

1. **Fixed payment tuple**  
   - The demo is wired to a *single* payment tuple:
     - `merchantId = demo-merchant`
     - `network = concordium:testnet`
     - `tokenId = usd:test`
     - `payTo = ccd1qexampleaddress`
     - `status = fulfilled`
   - In the future, these will be dynamic based on incoming 402 requests or merchant configuration.

2. **Testnet-only**  
   - All underlying on-chain data is sourced from Concordium **testnet** via the facilitator.  
   - No mainnet assets or real-world funds are involved.

3. **Status is currently always `"fulfilled"`**  
   - The demo endpoint always returns `state.status = "fulfilled"` for the seeded payment.  
   - Future evolutions may add different demo modes (e.g., pending/expired/failure scenarios).

4. **Signature and receipt details are not yet standardized**  
   - The `receipt.jws` and `receipt.payload` fields are taken from today’s facilitator / CRP implementation.  
   - Any future formal x402 spec may refactor how receipts and signatures are represented.

---

## 5. Intended use

This proto-x402 contract is meant to:

- Provide a concrete, working example of **how a 402 gateway response could look** when backed by Concordium PLT payments via CRP.
- Give client and PayFi/x402 teams something tangible to inspect, critique, and iterate on.
- Allow safe demoing of an HTTP 402 Payment Required response with realistic, testnet-backed payment data.

It is **not** intended for:

- Production use.
- Stable client integration.
- External partners without clear communication that this is a demo endpoint and a proto-contract, subject to change.
