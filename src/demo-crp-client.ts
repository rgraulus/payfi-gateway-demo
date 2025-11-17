// src/demo-crp-client.ts
//
// Minimal demo client that talks to the CRP service and exercises
// the Gateway ↔ CRP contract:
//
//   1) GET  /v1/crp/payments/search   (find a fulfilled payment)
//   2) POST /v1/crp/payments/match    (exact tuple match)
//   3) POST /v1/crp/payments/fulfill  (exact tuple + webhook)
//
// It assumes your CRP server is running on localhost:8080 and seeded
// with demo data (via the XCF facilitator migrations + smoke tests).

// ---- Config -----------------------------------------------------------------

const CRP_BASE_URL =
  (process.env.CRP_BASE_URL && process.env.CRP_BASE_URL.trim()) ||
  "http://localhost:8080";

// These should line up with the seeded demo rows in the CRP database.
const DEMO_MERCHANT_ID = "demo-merchant";
const DEMO_NETWORK = "concordium:testnet";
const DEMO_TOKEN_ID = "usd:test";
const DEMO_PAY_TO = "ccd1qexampleaddress";
const DEMO_STATUS = "fulfilled";

// ---- Types ------------------------------------------------------------------

interface CrpAsset {
  type: string;
  tokenId: string;
  decimals: number;
}

interface CrpPaymentRow {
  merchant_id: string;
  nonce: string;
  network: string;
  asset: CrpAsset;
  amount: string;
  pay_to: string;
  expiry: string;
  policy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: string;
  receipt: unknown;
  created_at: string;
  updated_at: string;
}

interface CrpSearchResponse {
  ok: boolean;
  filters: Record<string, unknown>;
  matches: CrpPaymentRow[];
}

interface GatewayPaymentTuple {
  merchantId: string;
  nonce: string;
  network: string;
  asset: {
    type: string;
    tokenId: string;
    decimals: number;
  };
  amount: string;
  payTo: string;
}

// /v1/crp/payments/match response (simplified)
interface CrpMatchResponse {
  ok: boolean;
  reason: string;
  count: number;
  match?: CrpPaymentRow;
}

// /v1/crp/payments/fulfill response (simplified)
interface CrpFulfillResponse extends CrpMatchResponse {
  webhook?: {
    configured: boolean;
    attempted: boolean;
    ok: boolean;
    status?: number;
    error?: string;
  };
}

// ---- Helpers ----------------------------------------------------------------

function logSection(title: string) {
  console.log();
  console.log("== " + title + " ==");
}

// ---- Main demo flow ---------------------------------------------------------

async function main() {
  console.log("CRP demo client");
  console.log("----------------");
  console.log("Base URL:    ", CRP_BASE_URL);
  console.log("Merchant ID: ", DEMO_MERCHANT_ID);
  console.log("Network:     ", DEMO_NETWORK);
  console.log("Token ID:    ", DEMO_TOKEN_ID);
  console.log("Pay To:      ", DEMO_PAY_TO);
  console.log("Status:      ", DEMO_STATUS);

  // 1) searchPayments: find a fulfilled payment row
  logSection("searchPayments");

  const searchParams = new URLSearchParams({
    merchantId: DEMO_MERCHANT_ID,
    network: DEMO_NETWORK,
    tokenId: DEMO_TOKEN_ID,
    payTo: DEMO_PAY_TO,
    status: DEMO_STATUS,
    limit: "1",
  });

  const searchRes = await fetch(
    `${CRP_BASE_URL}/v1/crp/payments/search?${searchParams.toString()}`
  );

  if (!searchRes.ok) {
    console.error("searchPayments failed with status", searchRes.status);
    const text = await searchRes.text();
    console.error(text);
    process.exit(1);
  }

  const searchJson = (await searchRes.json()) as CrpSearchResponse;
  console.log(JSON.stringify(searchJson, null, 2));

  if (!searchJson.matches || searchJson.matches.length === 0) {
    console.error("No fulfilled payments found; aborting demo.");
    return;
  }

  // We just checked length, so this is safe.
  const row = searchJson.matches[0]!;

  const tuple: GatewayPaymentTuple = {
    merchantId: row.merchant_id,
    nonce: row.nonce,
    network: row.network,
    asset: {
      type: row.asset.type,
      tokenId: row.asset.tokenId,
      decimals: row.asset.decimals,
    },
    amount: row.amount,
    payTo: row.pay_to,
  };

  // 2) /v1/crp/payments/match
  logSection("payments.match");

  const matchRes = await fetch(`${CRP_BASE_URL}/v1/crp/payments/match`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(tuple),
  });

  if (!matchRes.ok) {
    console.error("payments.match failed with status", matchRes.status);
    const text = await matchRes.text();
    console.error(text);
    process.exit(1);
  }

  const matchJson = (await matchRes.json()) as CrpMatchResponse;
  console.log(JSON.stringify(matchJson, null, 2));

  if (!matchJson.ok || matchJson.reason !== "exact_match" || matchJson.count !== 1) {
    console.error("Unexpected match response; aborting before fulfill.");
    return;
  }

  // 3) /v1/crp/payments/fulfill (triggers webhook if configured)
  logSection("payments.fulfill");

  const fulfillRes = await fetch(`${CRP_BASE_URL}/v1/crp/payments/fulfill`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(tuple),
  });

  if (!fulfillRes.ok) {
    console.error("payments.fulfill failed with status", fulfillRes.status);
    const text = await fulfillRes.text();
    console.error(text);
    process.exit(1);
  }

  const fulfillJson = (await fulfillRes.json()) as CrpFulfillResponse;
  console.log(JSON.stringify(fulfillJson, null, 2));

  console.log();
  console.log("Demo complete.");
}

// Run the demo
main().catch((err) => {
  console.error("Fatal error in demo client:", err);
  process.exit(1);
});
