import http, { IncomingMessage, ServerResponse } from "http";
import { CrpClient } from "./crpClient";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Environment-driven defaults for filters
const crpBaseUrl = process.env.CRP_BASE_URL ?? "http://localhost:8080";
const merchantId = process.env.CRP_MERCHANT_ID ?? "demo-merchant";
const network = process.env.CRP_NETWORK ?? "concordium:testnet";
const tokenId = process.env.CRP_TOKEN_ID ?? "usd:test";
const payTo = process.env.CRP_PAY_TO ?? "ccd1qexampleaddress";
const status = process.env.CRP_STATUS ?? "fulfilled";

// CrpClient config: currently only expects baseUrl
const crpClient = new CrpClient({
  baseUrl: crpBaseUrl,
});

function sendJson(
  res: ServerResponse,
  statusCode: 200 | 400 | 404 | 500,
  payload: unknown
) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(chunk as Buffer);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const json = JSON.parse(raw);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const url = req.url || "/";

    // Simple health check
    if (method === "GET" && url === "/healthz") {
      return sendJson(res, 200, {
        ok: true,
        status: "up",
        crpBaseUrl,
        merchantId,
        network,
        tokenId,
        payTo,
        statusOverride: status,
      });
    }

    // Demo route: end-to-end CRP check
    if (method === "POST" && url === "/demo/crp/check") {
      const body = await readJsonBody(req);

      // Build full filters object with env defaults + optional overrides from body
      const filters = {
        merchantId: body.merchantId ?? merchantId,
        network: body.network ?? network,
        tokenId: body.tokenId ?? tokenId,
        payTo: body.payTo ?? payTo,
        status: body.status ?? status,
        limit: body.limit ?? 1,
      };

      // 1) search payments
      const searchRes = await crpClient.searchPayments(filters);
      if (!searchRes.ok || !searchRes.matches || searchRes.matches.length === 0) {
        return sendJson(res, 404, {
          ok: false,
          reason: "no_matches",
          search: searchRes,
        });
      }

      const payment = searchRes.matches[0];

      // Map CrpPaymentRecord -> MatchPaymentRequest
      const matchReq = {
        merchantId: payment.merchant_id,
        network: payment.network,
        tokenId: payment.asset.tokenId,
        payTo: payment.pay_to,
        amount: payment.amount,
        nonce: payment.nonce,
        status: payment.status,
        asset: payment.asset,
      };

      // 2) match payment
      const matchRes = await crpClient.matchPayment(matchReq);
      if (!matchRes.ok) {
        return sendJson(res, 400, {
          ok: false,
          reason: "match_failed",
          match: matchRes,
        });
      }

      // 3) fulfill payment (no external webhook here; CRP handles its own webhooks)
      const fulfillRes = await crpClient.fulfillPayment(matchReq);

      return sendJson(res, 200, {
        ok: true,
        filters,
        search: searchRes,
        match: matchRes,
        fulfill: fulfillRes,
      });
    }

    // Fallback for unknown routes
    sendJson(res, 404, {
      ok: false,
      error: "Not found",
      method,
      url,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    sendJson(res, 500, {
      ok: false,
      error: "internal_error",
      details: err?.message ?? String(err),
    });
  }
});

server.listen(PORT, () => {
  console.log(
    `payfi-gateway-demo HTTP server listening on http://localhost:${PORT}`
  );
});
