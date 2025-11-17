import {
  CrpClient,
  SearchPaymentsParams,
  CrpPaymentRecord,
  MatchPaymentRequest,
} from "./crpClient";

async function main(): Promise<void> {
  const baseUrl =
    process.env.CRP_BASE_URL?.trim() || "http://localhost:8080";

  const merchantId = "demo-merchant";
  const network = "concordium:testnet";
  const tokenId = "usd:test";
  const payTo = "ccd1qexampleaddress";
  const status = "fulfilled";

  console.log("CRP demo client");
  console.log("----------------");
  console.log(`Base URL:     ${baseUrl}`);
  console.log(`Merchant ID:  ${merchantId}`);
  console.log(`Network:      ${network}`);
  console.log(`Token ID:     ${tokenId}`);
  console.log(`Pay To:       ${payTo}`);
  console.log(`Status:       ${status}`);
  console.log();

  const client = new CrpClient({ baseUrl });

  const filters: SearchPaymentsParams = {
    merchantId,
    network,
    tokenId,
    payTo,
    status,
    limit: 1,
  };

  // 1) searchPayments
  const searchResult = await client.searchPayments(filters);

  console.log("== searchPayments ==\n");
  console.log(JSON.stringify(searchResult, null, 2));
  console.log();

  const sample: CrpPaymentRecord | undefined = searchResult.matches[0];
  if (!sample) {
    console.error("No sample payment found; demo cannot continue.");
    return;
  }

  // Map DB row (snake_case) into the exact-tuple request (camelCase)
  const tuple: MatchPaymentRequest = {
    merchantId: sample.merchant_id,
    nonce: sample.nonce,
    network: sample.network,
    asset: sample.asset,
    amount: sample.amount,
    payTo: sample.pay_to,
  };

  // 2) payments.match
  const matchResult = await client.matchPayment(tuple);
  console.log("== payments.match ==\n");
  console.log(JSON.stringify(matchResult, null, 2));
  console.log();

  // 3) payments.fulfill
  const fulfillResult = await client.fulfillPayment(tuple);
  console.log("== payments.fulfill ==\n");
  console.log(JSON.stringify(fulfillResult, null, 2));
  console.log();

  console.log("Demo complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
