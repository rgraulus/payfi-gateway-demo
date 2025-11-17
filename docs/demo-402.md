# Demo 402 Endpoint Backed by CRP

This document explains how the **demo 402 endpoint** in `payfi-gateway-demo` works and how it interacts with the **CRP (Concordium Remote Payments) HTTP API** exposed by the `xcf-concordium-facilitator`.

The goal of this demo is to show a **minimal x402-style “Payment Required” flow** where:

- A gateway service checks CRP for a payment that matches a specific tuple.
- If a matching **fulfilled** payment exists, the gateway responds with **HTTP 402 Payment Required** plus a structured JSON body describing the payment.
- This shape can later be turned into a **real x402 gateway/paywall**.

---

## 1. Components and Ports

The demo involves two processes:

1. **CRP / Facilitator (backend):**
   - Repo: `xcf-concordium-facilitator`
   - Port: `:8080`
   - Relevant endpoints:
     - `GET  /v1/crp/payments/search`
     - `POST /v1/crp/payments/match`
     - `POST /v1/crp/payments/fulfill`

2. **PayFi Gateway Demo (this repo):**
   - Repo: `payfi-gateway-demo`
   - Port: `:3000`
   - Relevant endpoints:
     - `GET  /healthz`
     - `POST /demo/crp/check`
     - `GET  /demo/402`

The gateway demo talks to the facilitator via the **typed CRP HTTP client** in `src/crpClient.ts`.

---

## 2. Prerequisites

Before exercising the 402 demo, you should have:

1. **Facilitator running locally** (Terminal A):

   ```bash
   cd ~/Documents/GitHub/xcf-concordium-facilitator
   npm run start
   ```

   You should see logs like:

   ```text
   UFX listening on :8080
   [DB] Connected to postgres ...
   ```

2. **At least one CRP payment in the database** that matches the hard-coded demo filters:

   ```jsonc
   // Filters the demo expects:
   {
     "merchantId": "demo-merchant",
     "network": "concordium:testnet",
     "tokenId": "usd:test",
     "payTo": "ccd1qexampleaddress",
     "status": "fulfilled",
     "limit": 1
   }
   ```

   You already confirmed this earlier via:
   ```bash
   curl -s "http://localhost:8080/v1/crp/payments/search?merchantId=demo-merchant&network=concordium:testnet&tokenId=usd:test&payTo=ccd1qexampleaddress&status=fulfilled&limit=1"
   ```

3. **Gateway demo HTTP server running** (Terminal B):

   ```bash
   cd ~/Documents/GitHub/payfi-gateway-demo
   npm run dev
   ```

   You should see:

   ```text
   payfi-gateway-demo HTTP server listening on http://localhost:3000
   ```

---

## 3. Endpoint: GET /healthz

### Purpose

`GET /healthz` returns a JSON snapshot of:

- the gateway’s own status, and  
- the CRP configuration it will use when talking to the facilitator.

### Example

```bash
curl -s http://localhost:3000/healthz | jq
```

### Typical Response

```jsonc
{
  "ok": true,
  "status": "up",
  "crpBaseUrl": "http://localhost:8080",
  "merchantId": "demo-merchant",
  "network": "concordium:testnet",
  "tokenId": "usd:test",
  "payTo": "ccd1qexampleaddress",
  "statusOverride": "fulfilled"
}
```

Key points:

- `crpBaseUrl` must point at your running facilitator.
- The other fields (`merchantId`, `network`, `tokenId`, `payTo`, `statusOverride`) show the **hard-coded filters** the demo uses when talking to CRP.

---

## 4. Endpoint: POST /demo/crp/check

### Purpose

`POST /demo/crp/check` is a **self-test endpoint** that:

1. Calls the facilitator’s `searchPayments` API with the demo filters.
2. Calls the facilitator’s `matchPayment` API using the found payment.
3. Calls the facilitator’s `fulfillPayment` API using the same tuple.

It returns a JSON envelope that shows **all three CRP calls together**.

### Request

The body is currently ignored, so you can send `{}`:

```bash
curl -s -X POST http://localhost:3000/demo/crp/check   -H "Content-Type: application/json"   -d '{}'
```

### Typical Response (shape)

```jsonc
{
  "ok": true,
  "filters": {
    "merchantId": "demo-merchant",
    "network": "concordium:testnet",
    "tokenId": "usd:test",
    "payTo": "ccd1qexampleaddress",
    "status": "fulfilled",
    "limit": 1
  },
  "search": {
    "ok": true,
    "filters": { "...": "..." },
    "matches": [
      {
        "merchant_id": "demo-merchant",
        "nonce": "n-1763272560",
        "network": "concordium:testnet",
        "asset": {
          "type": "PLT",
          "tokenId": "usd:test",
          "decimals": 2
        },
        "amount": "25.00",
        "pay_to": "ccd1qexampleaddress",
        "expiry": "2025-11-02T12:00:00.000Z",
        "policy": {},
        "metadata": {},
        "status": "fulfilled",
        "receipt": { "...": "..." },
        "created_at": "...",
        "updated_at": "..."
      }
    ]
  },
  "match": {
    "ok": true,
    "reason": "exact_match",
    "count": 1,
    "match": { /* same payment as above */ }
  },
  "fulfill": {
    "ok": true,
    "reason": "exact_match",
    "count": 1,
    "match": { /* same payment as above */ },
    "webhook": {
      "configured": false,
      "attempted": false,
      "ok": false
    }
  }
}
```

This is purely a **diagnostic endpoint** to verify that:

- the gateway can talk to CRP at all, and  
- the CRP configuration (filters, merchant, asset) is correct.

---

## 5. Endpoint: GET /demo/402

### Purpose

`GET /demo/402` is the **x402-style demo endpoint**.

It models what a real x402 gateway/paywall might do when a client tries to access a **protected resource**:

1. The gateway checks CRP for a matching **fulfilled** payment.
2. If a payment is found, the gateway:
   - responds with **HTTP 402 Payment Required**, and  
   - includes a JSON body describing the matching payment and the CRP calls it made.

In a real x402 implementation, this 402 response would carry **serialized x402 payment tokens** in headers/body, and the client/agent would use those tokens to prove a payment has been made or to trigger a new one.

### Request

```bash
curl -s -i http://localhost:3000/demo/402
```

Note the `-i` to show HTTP **status code and headers**.

### Typical Response

The important parts:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
...
```

Body (shape):

```jsonc
{
  "ok": true,
  "kind": "demo.402",
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
    "match": { /* CRP payment record */ },
    "webhook": {
      "configured": false,
      "attempted": false,
      "ok": false
    }
  }
}
```

So `/demo/402` is essentially:

- **“Payment protected resource”** that always returns `402` in this demo.
- The JSON body gives you the **ground truth payment tuple** from CRP.
- This JSON shape can be used as a **bridge** to a more formal x402 representation later.

---

## 6. How This Maps to a Real x402 Gateway

In a full x402 gateway:

1. The client (browser, agent, or API caller) requests a **protected resource**.
2. The gateway checks for:
   - a valid x402 token (proof of payment), or  
   - a cached CRP result / local ledger entry.
3. If no valid proof exists, the gateway returns **HTTP 402 Payment Required** with:
   - an x402 token describing **what** needs to be paid (amount, asset, pay-to, expiry, policy), and  
   - possibly a “where to pay” hint (PayFi link, wallet deeplink, or DApp URL).

Our demo currently:

- **Skips the token construction** and just exposes the **raw CRP payment record**.
- Always responds with 402 so you can see the shape and play with it.
- Uses a **single, hard-coded payment tuple** to keep the flow simple.

Later, we can layer on:

- True x402 token encoding/decoding.
- Real browser/client flows.
- Agentic AI clients that understand “402 Payment Required” and know how to resolve it via PayFi.

---

## 7. Summary

- `/healthz` shows that the gateway is up and how it’s configured to talk to CRP.
- `/demo/crp/check` is a **diagnostic endpoint** that exercises the CRP client: `search → match → fulfill`.
- `/demo/402` is a **minimal 402 paywall-style endpoint**, currently hard-wired to a single CRP payment, that:
  - returns **HTTP 402 Payment Required**, and  
  - includes the CRP payment and fulfillment info in the JSON body.

This gives you a concrete, working **“CRP-backed 402”** slice that can be extended into a full x402 gateway in later phases.
