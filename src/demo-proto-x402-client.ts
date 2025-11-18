// src/demo-proto-x402-client.ts

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

async function main(): Promise<void> {
  const baseUrl = process.env.DEMO_GATEWAY_BASE_URL ?? "http://localhost:3000";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/demo/402`;

  console.log("Proto-x402 demo client");
  console.log("----------------------");
  console.log("Endpoint:", endpoint);
  console.log("");

  const res = await fetch(endpoint);
  console.log("HTTP status:", res.status);
  console.log("");

  const body = (await res.json()) as DemoProtoX402Response;

  console.log("Raw response:");
  console.log(JSON.stringify(body, null, 2));
  console.log("");

  if (!body.ok) {
    console.error("Gateway reported ok=false; aborting.");
    return;
  }

  if (!body.x402) {
    console.error("No x402 payload found on response; aborting.");
    return;
  }

  const { x402 } = body;
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
}

main().catch((err) => {
  console.error("Error in proto-x402 demo client:", err);
  process.exitCode = 1;
});
