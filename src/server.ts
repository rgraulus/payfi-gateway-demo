import express from 'express';
import bodyParser from 'body-parser';
import { CrpClient, MatchPaymentRequest } from './crpClient';

const app = express();
app.use(bodyParser.json());

// -----------------------------------------------------------------------------
// Static demo configuration (can be overridden via env vars)
// -----------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);

const crpBaseUrl =
  process.env.CRP_BASE_URL ?? 'http://localhost:8080';
const merchantId =
  process.env.CRP_MERCHANT_ID ?? 'demo-merchant';
const network =
  process.env.CRP_NETWORK ?? 'concordium:testnet';
const tokenId =
  process.env.CRP_TOKEN_ID ?? 'usd:test';
const payTo =
  process.env.CRP_PAY_TO ?? 'ccd1qexampleaddress';
const statusOverride =
  process.env.CRP_STATUS_OVERRIDE ?? 'fulfilled';

const crpClient = new CrpClient({ baseUrl: crpBaseUrl });

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    status: 'up',
    crpBaseUrl,
    merchantId,
    network,
    tokenId,
    payTo,
    statusOverride,
  });
});

// -----------------------------------------------------------------------------
// Demo: low-level CRP check (search + match + fulfill)
// -----------------------------------------------------------------------------

app.post('/demo/crp/check', async (_req, res) => {
  try {
    const filters = {
      merchantId,
      network,
      tokenId,
      payTo,
      status: statusOverride,
      limit: 1,
    };

    const search = await crpClient.searchPayments(filters);

    const record = search.matches?.[0];
    if (!record) {
      return res.status(404).json({
        ok: false,
        error: 'No matching payments found for demo filters',
        filters,
        search,
      });
    }

    const matchReq: MatchPaymentRequest = {
      merchantId: record.merchant_id,
      network: record.network,
      asset: record.asset,
      amount: record.amount,
      payTo: record.pay_to,
      nonce: record.nonce,
    };

    const match = await crpClient.matchPayment(matchReq);
    const fulfill = await crpClient.fulfillPayment(matchReq);

    return res.json({
      ok: true,
      filters,
      search,
      match,
      fulfill,
    });
  } catch (err) {
    console.error('Error in /demo/crp/check:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal error during CRP demo check',
    });
  }
});

// -----------------------------------------------------------------------------
// Demo: proto-x402 402 Payment Required endpoint
//
// This wraps the CRP-backed payment into a future-proof "x402" JSON shape,
// while still exposing raw CRP responses under a "debug" field.
// -----------------------------------------------------------------------------

app.get('/demo/402', async (_req, res) => {
  try {
    // 1) For now we still use the static demo filters
    const filters = {
      merchantId,
      network,
      tokenId,
      payTo,
      status: statusOverride,
      limit: 1,
    };

    // 2) Look up a payment in CRP
    const search = await crpClient.searchPayments(filters);

    const record = search.matches?.[0];
    if (!record) {
      return res.status(404).json({
        ok: false,
        error: 'No matching payments found for demo filters',
        filters,
        search,
      });
    }

    // 3) Re-confirm via match + fulfill, same pattern as /demo/crp/check
    const matchReq: MatchPaymentRequest = {
      merchantId: record.merchant_id,
      network: record.network,
      asset: record.asset,
      amount: record.amount,
      payTo: record.pay_to,
      nonce: record.nonce,
    };

    const match = await crpClient.matchPayment(matchReq);
    if (!match.ok || match.count < 1 || !match.match) {
      return res.status(502).json({
        ok: false,
        error: 'CRP match failed for demo payment',
        filters,
        match,
      });
    }

    const fulfill = await crpClient.fulfillPayment(matchReq);
    if (!fulfill.ok || fulfill.count < 1 || !fulfill.match) {
      return res.status(502).json({
        ok: false,
        error: 'CRP fulfill failed for demo payment',
        filters,
        fulfill,
      });
    }

    const payment = match.match;

    // 4) Proto-x402 shape:
    //
    // Keep all "x402-ish" fields inside a single "x402" block so we can evolve
    // the structure later without breaking callers that rely on the container.
    const x402 = {
      version: '0.1', // proto / draft version
      // Who is asking for payment?
      gateway: {
        id: 'payfi-gateway-demo',
        merchantId: payment.merchant_id,
      },
      // What needs to be paid?
      payment: {
        nonce: payment.nonce,
        network: payment.network,
        asset: payment.asset,
        amount: payment.amount,
        payTo: payment.pay_to,
      },
      // What is the current state of this payment from CRP’s point of view?
      state: {
        status: payment.status,
        // In a real 402 flow this might be absent until payment is done;
        // here we include it because our demo record is already "fulfilled".
        receipt: payment.receipt ?? null,
      },
    };

    // 5) Return HTTP 402 with the proto-x402 envelope + debug info
    return res.status(402).json({
      ok: true,
      kind: 'demo.proto-x402',
      x402,
      // Keep the raw CRP details under a clearly namespaced "debug" key
      // so future clients can safely ignore it.
      debug: {
        filters,
        match,
        fulfill,
      },
    });
  } catch (err) {
    console.error('Error in /demo/402:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal error during proto-x402 402 demo',
    });
  }
});

// -----------------------------------------------------------------------------
// Fallback 404
// -----------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not found',
    method: req.method,
    url: req.url,
  });
});

// -----------------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------------

app.listen(port, () => {
  console.log(
    `payfi-gateway-demo HTTP server listening on http://localhost:${port}`,
  );
});
