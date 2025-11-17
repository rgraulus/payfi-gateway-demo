// src/crpClient.ts
//
// Thin HTTP client for talking to the CRP service from the
// PayFi/x402 gateway.
//
// It wraps the three main endpoints:
//
//   GET  /v1/crp/payments/search
//   POST /v1/crp/payments/match
//   POST /v1/crp/payments/fulfill
//
// and exposes them as TypeScript functions.
//
// By default, CRP_BASE_URL is http://localhost:8080/v1/crp
// but you can override it with the CRP_BASE_URL env var.

declare const fetch: any; // use Node 18+ global fetch without extra deps

// ---- Types ----

export type CrpAsset = {
  type: string;
  tokenId: string;
  decimals: number;
};

export type CrpReceiptPayload = {
  asset: CrpAsset;
  nonce: string;
  amount: string;
  paidTo: string;
  network: string;
  finalizedAt: string;
};

export type CrpReceipt = {
  jws: string;
  payload: CrpReceiptPayload;
};

export type CrpPaymentStatus = "pending" | "fulfilled" | "expired" | string;

export interface CrpPaymentRow {
  merchant_id: string;
  nonce: string;
  network: string;
  asset: CrpAsset;
  amount: string;
  pay_to: string;
  expiry: string;
  policy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: CrpPaymentStatus;
  receipt: CrpReceipt | null;
  created_at: string;
  updated_at: string;
}

export interface CrpSearchFilters {
  merchantId?: string;
  network?: string;
  tokenId?: string;
  payTo?: string;
  status?: string;
  limit?: number;
}

export interface CrpSearchResponse {
  ok: boolean;
  filters: Partial<CrpSearchFilters>;
  matches: CrpPaymentRow[];
}

export interface GatewayPaymentTuple {
  merchantId: string;
  nonce: string;
  network: string;
  asset: CrpAsset;
  amount: string;
  payTo: string;
}

export interface CrpMatchResponse {
  ok: boolean;
  reason: string;
  count: number;
  match?: CrpPaymentRow;
}

export interface CrpWebhookResult {
  configured: boolean;
  attempted: boolean;
  ok: boolean;
  status?: number;
  error?: string;
}

export interface CrpFulfillResponse extends CrpMatchResponse {
  webhook: CrpWebhookResult;
}

// ---- HTTP helpers ----

export const CRP_BASE_URL =
  process.env.CRP_BASE_URL ?? "http://localhost:8080/v1/crp";

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const base = CRP_BASE_URL.endsWith("/") ? CRP_BASE_URL : CRP_BASE_URL + "/";
  const url = new URL(path.replace(/^\//, ""), base);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function httpGet<T>(path: string, query?: Record<string, unknown>): Promise<T> {
  const url = buildUrl(path, query);
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

async function httpPost<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} -> ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

// ---- Public API ----

export async function searchPayments(
  filters: CrpSearchFilters
): Promise<CrpSearchResponse> {
  return httpGet<CrpSearchResponse>("/payments/search", {
    merchantId: filters.merchantId,
    network: filters.network,
    tokenId: filters.tokenId,
    payTo: filters.payTo,
    status: filters.status,
    limit: filters.limit,
  });
}

export async function matchPayment(
  tuple: GatewayPaymentTuple
): Promise<CrpMatchResponse> {
  return httpPost<CrpMatchResponse>("/payments/match", tuple);
}

export async function fulfillPayment(
  tuple: GatewayPaymentTuple
): Promise<CrpFulfillResponse> {
  return httpPost<CrpFulfillResponse>("/payments/fulfill", tuple);
}
