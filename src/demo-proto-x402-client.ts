// src/demo-proto-x402-client.ts

// -----------------------------------------------------------------------------
// Types for proto-x402 response
// -----------------------------------------------------------------------------

interface ProtoX402Asset {
  type: string;
  tokenId: string;
  decimals: number;
}

interface ProtoX402Payment {
  nonce: string;
  network: string;
  asset: ProtoX402Asset;
  amount: string;
  payTo: string;
}

interface ProtoX402State {
  status: string;
  // For now we just type this loosely; the JWS payload can evolve
  receipt?: unknown;
}

interface ProtoX402Gateway {
  id: string;
  merchantId: string;
}

interface ProtoX402Body {
  version: string;
  gateway: ProtoX402Gateway;
  payment: ProtoX402Payment;
  state: ProtoX402State;
}

interface DemoProtoX402Response {
  ok: boolean;
  kind: string;
  x402?: ProtoX402Body;
  debug?: unknown;
}

// -----------------------------------------------------------------------------
// Types for CRP exact-match demo response (/demo/crp/exact-match)
// -----------------------------------------------------------------------------

interface CrpAsset {
  type: string;
  tokenId: string;
  decimals: number;
}

interface CrpPaymentRecord {
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
  receipt?: unknown;
  created_at: string;
  updated_at: string;
}

interface CrpExactMatchInner {
  ok: boolean;
  reason: string; // "exact_match", "no_match", etc.
  count: number;
  match?: CrpPaymentRecord;
}

interface DemoCrpExactMatchResponse {
  ok: boolean;
  filters?: unknown;
  search?: unknown;
  exactMatchRequest?: unknown;
  exactMatch?: CrpExactMatchInner;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function logDivider(label: string): void {
  console.log("");
  console.log("==================================================");
  console.log(label);
  console.log("==================================================");
}

// Compare the tuple in the proto-x402 payment vs the CRP match record.
function tuplesMatch(x402: ProtoX402Body, match: CrpPaymentRecord): boolean {
  const { gateway, payment } = x402;

  const sameMerchant = gateway.merchantId === match.merchant_id;
  const sameNonce = payment.nonce === match.nonce;
  const sameNetwork = payment.network === match.network;
  const sameAmount = payment.amount === match.amount;
  const samePayTo = payment.payTo === match.pay_to;

  const sameAssetType = payment.asset.type === match.asset.type;
  const sameTokenId = payment.asset.tokenId === match.asset.tokenId;
  const sameDecimals =
    Number(payment.asset.decimals) === Number(match.asset.decimals);

  return (
    sameMerchant &&
    sameNonce &&
    sameNetwork &&
    sameAmount &&
    samePayTo &&
    sameAssetType &&
    sameTokenId &&
    sameDecimals
  );
}

// -----------------------------------------------------------------------------
// Main demo
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const baseUrl =
    process.env.DEMO_GATEWAY_BASE_URL ?? "http://localhost:3000";
  const normalizedBase = normalizeBaseUrl(baseUrl);

  const x402Endpoint = `${normalizedBase}/demo/402`;
  const exactMatchEndpoint = `${normalizedBase}/demo/crp/exact-match`;

  console.log("Proto-x402 + CRP exact-match demo client");
  console.log("----------------------------------------");
  console.log("Gateway base URL:", normalizedBase);
  console.log("");

  // ---------------------------------------------------------------------------
  // 1) Call /demo/402 (proto-x402 402 Payment Required)
  // ---------------------------------------------------------------------------

  logDivider("STEP 1: GET /demo/402 (proto-x402)");

  console.log("Requesting:", x402Endpoint);
  const res = await fetch(x402Endpoint);

  console.log("HTTP status:", res.status);
  console.log("");

  let body: DemoProtoX402Response;
  try {
    body = (await res.json()) as DemoProtoX402Response;
  } catch (err) {
    console.error("Failed to parse /demo/402 JSON:", err);
    return;
  }

  console.log("Raw /demo/402 response:");
  console.log(JSON.stringify(body, null, 2));
  console.log("");

  if (!body.ok) {
    console.error("Gateway reported ok=false on /demo/402; aborting.");
    return;
  }

  if (!body.x402) {
    console.error("No x402 payload found on /demo/402; aborting.");
    return;
  }

  const x402 = body.x402;
  const { gateway, payment, state } = x402;

  console.log("Parsed proto-x402 summary:");
  console.log(`- Version:       ${x402.version}`);
  console.log(`- Gateway ID:    ${gateway.id}`);
  console.log(`- Merchant ID:   ${gateway.merchantId}`);
  console.log(`- Network:       ${payment.network}`);
  console.log(
    `- Asset:         ${payment.asset.type}:${payment.asset.tokenId} (decimals=${payment.asset.decimals})`
  );
  console.log(`- Amount:        ${payment.amount}`);
  console.log(`- Pay to:        ${payment.payTo}`);
  console.log(`- Status:        ${state.status}`);
  console.log("");

  // ---------------------------------------------------------------------------
  // 2) Call /demo/crp/exact-match (gateway → CRP GET alias)
  //
  //    This endpoint:
  //      - Uses the same demo filters (merchant/network/tokenId/payTo/status)
  //      - Finds a demo payment in CRP
  //      - Calls the GET /v1/crp/payments/exact-match alias
  // ---------------------------------------------------------------------------

  logDivider("STEP 2: POST /demo/crp/exact-match (CRP exact tuple)");

  console.log("Requesting:", exactMatchEndpoint);
  const emRes = await fetch(exactMatchEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  });

  console.log("HTTP status:", emRes.status);
  console.log("");

  let emBody: DemoCrpExactMatchResponse;
  try {
    emBody = (await emRes.json()) as DemoCrpExactMatchResponse;
  } catch (err) {
    console.error("Failed to parse /demo/crp/exact-match JSON:", err);
    return;
  }

  console.log("Raw /demo/crp/exact-match response:");
  console.log(JSON.stringify(emBody, null, 2));
  console.log("");

  if (!emRes.ok) {
    console.error(
      "Gateway responded with non-2xx for /demo/crp/exact-match; aborting."
    );
    return;
  }

  if (!emBody.ok) {
    console.error(
      "Gateway reported ok=false on /demo/crp/exact-match; aborting."
    );
    return;
  }

  if (!emBody.exactMatch || !emBody.exactMatch.match) {
    console.error(
      "No exactMatch.match found on /demo/crp/exact-match; aborting."
    );
    return;
  }

  const matchRecord = emBody.exactMatch.match;

  console.log("CRP exact-match summary:");
  console.log(`- Merchant ID:   ${matchRecord.merchant_id}`);
  console.log(`- Nonce:         ${matchRecord.nonce}`);
  console.log(`- Network:       ${matchRecord.network}`);
  console.log(
    `- Asset:         ${matchRecord.asset.type}:${matchRecord.asset.tokenId} (decimals=${matchRecord.asset.decimals})`
  );
  console.log(`- Amount:        ${matchRecord.amount}`);
  console.log(`- Pay to:        ${matchRecord.pay_to}`);
  console.log(`- Status:        ${matchRecord.status}`);
  console.log("");

  // ---------------------------------------------------------------------------
  // 3) Compare tuples: x402 payment vs CRP exact-match record
  // ---------------------------------------------------------------------------

  logDivider("STEP 3: Tuple comparison (x402 vs CRP)");

  const equal = tuplesMatch(x402, matchRecord);
  console.log("Tuples equal:", equal ? "YES ✅" : "NO ❌");
  console.log("");

  if (!equal) {
    console.log("x402 payment tuple:");
    console.log(JSON.stringify(payment, null, 2));
    console.log("");
    console.log("CRP payment record tuple:");
    console.log(JSON.stringify(matchRecord, null, 2));
  }
}

main().catch((err) => {
  console.error("Error in proto-x402 demo client:", err);
  process.exitCode = 1;
});
