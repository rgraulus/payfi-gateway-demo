import express from 'express';
import { CrpClient, MatchPaymentRequest } from './crpClient';

// --------------------------------------------------
// Local types (match what CrpClient.searchPayments expects)
// --------------------------------------------------

type CrpSearchFilters = {
  merchantId: string;
  network: string;
  tokenId?: string;
  payTo?: string;
  status?: string;
  limit?: number;
};

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const CRP_BASE_URL =
  process.env.CRP_BASE_URL || 'http://localhost:8080';

const MERCHANT_ID =
  process.env.CRP_MERCHANT_ID || 'demo-merchant';

const NETWORK =
  process.env.CRP_NETWORK || 'concordium:testnet';

const TOKEN_ID =
  process.env.CRP_TOKEN_ID || 'usd:test';

const PAY_TO =
  process.env.CRP_PAY_TO || 'ccd1qexampleaddress';

const STATUS_OVERRIDE =
  process.env.CRP_STATUS_OVERRIDE || 'fulfilled';

const PORT = Number(process.env.PORT || 3000);

// --------------------------------------------------
// CRP client
// --------------------------------------------------

const crpClient = new CrpClient({
  baseUrl: CRP_BASE_URL,
});

// --------------------------------------------------
// Express app
// --------------------------------------------------

const app = express();
app.use(express.json());

// --------------------------------------------------
// /healthz
// --------------------------------------------------

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    status: 'up',
    crpBaseUrl: CRP_BASE_URL,
    merchantId: MERCHANT_ID,
    network: NETWORK,
    tokenId: TOKEN_ID,
    payTo: PAY_TO,
    statusOverride: STATUS_OVERRIDE,
  });
});

// --------------------------------------------------
// POST /demo/crp/check
// - Calls CRP search → match → fulfill
// - Returns all three blocks
// --------------------------------------------------

app.post('/demo/crp/check', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<CrpSearchFilters>;

    const filters: CrpSearchFilters = {
      merchantId: body.merchantId ?? MERCHANT_ID,
      network: body.network ?? NETWORK,
      tokenId: body.tokenId ?? TOKEN_ID,
      payTo: body.payTo ?? PAY_TO,
      status: body.status ?? STATUS_OVERRIDE,
      limit: body.limit ?? 1,
    };

    const search = await crpClient.searchPayments(filters);

    let match: unknown = null;
    let fulfill: unknown = null;

    if (search.ok && search.matches && search.matches.length > 0) {
      const record: any = search.matches[0];

      const matchReq: MatchPaymentRequest = {
        merchantId: record.merchant_id,
        network: record.network,
        asset: record.asset,
        amount: record.amount,
        payTo: record.pay_to,
        nonce: record.nonce,
      };

      match = await crpClient.matchPayment(matchReq);
      fulfill = await crpClient.fulfillPayment(matchReq);
    }

    res.json({
      ok: true,
      filters,
      search,
      match,
      fulfill,
    });
  } catch (err) {
    console.error('Error in /demo/crp/check', err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// --------------------------------------------------
// GET /demo/402
// - Simple x402-style demo endpoint
// - Returns HTTP 402 when a matching payment exists
// --------------------------------------------------

app.get('/demo/402', async (_req, res) => {
  try {
    const filters: CrpSearchFilters = {
      merchantId: MERCHANT_ID,
      network: NETWORK,
      tokenId: TOKEN_ID,
      payTo: PAY_TO,
      status: STATUS_OVERRIDE,
      limit: 1,
    };

    // 1) Search for a fulfilled payment matching the demo tuple
    const search = await crpClient.searchPayments(filters);

    if (!search.ok || !search.matches || search.matches.length === 0) {
      res.status(404).json({
        ok: false,
        error: 'No matching payment found for demo 402',
        filters,
        search,
      });
      return;
    }

    const record: any = search.matches[0];

    // 2) Exact-tuple request for match/fulfill
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

    // 3) Return HTTP 402 with CRP-derived info
    res.status(402).json({
      ok: true,
      kind: 'demo.402',
      filters,
      match,
      fulfill,
    });
  } catch (err) {
    console.error('Error in /demo/402', err);
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// --------------------------------------------------
// Fallback 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not found',
    method: req.method,
    url: req.url,
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `payfi-gateway-demo HTTP server listening on http://localhost:${PORT}`,
  );
});
