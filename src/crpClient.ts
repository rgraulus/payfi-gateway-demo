/**
 * Thin typed CRP HTTP client for the demo gateway.
 *
 * Exposes:
 *   - searchPayments
 *   - matchPayment
 *   - fulfillPayment
 */

export interface CrpClientConfig {
  baseUrl: string; // e.g. http://localhost:8080
}

export interface CrpAsset {
  type: string;        // "PLT", etc.
  tokenId: string;     // e.g. "usd:test"
  decimals: number;    // e.g. 2
}

export interface CrpReceiptPayload {
  asset: CrpAsset;
  nonce: string;
  amount: string;      // decimal string
  paidTo: string;      // ccd1...
  network: string;     // "concordium:testnet"
  finalizedAt: string; // ISO timestamp
}

export interface CrpReceipt {
  jws: string;
  payload: CrpReceiptPayload;
}

/**
 * Shape returned by /v1/crp/payments/search.matches[]
 * This reflects the DB row (snake_case).
 */
export interface CrpPaymentRecord {
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
  receipt?: CrpReceipt;
  created_at: string;
  updated_at: string;
}

/**
 * Exact-tuple request shape expected by:
 *   - POST /v1/crp/payments/match
 *   - POST /v1/crp/payments/fulfill
 *
 * Note the camelCase keys: merchantId, payTo, ...
 */
export interface MatchPaymentRequest {
  merchantId: string;
  nonce: string;
  network: string;
  asset: CrpAsset;
  amount: string;
  payTo: string;
}

export interface SearchPaymentsParams {
  merchantId?: string;
  network?: string;
  tokenId?: string;
  payTo?: string;
  status?: string;
  limit?: number;
}

export interface SearchPaymentsResponse {
  ok: boolean;
  filters: SearchPaymentsParams;
  matches: CrpPaymentRecord[];
}

export interface MatchPaymentResponse {
  ok: boolean;
  reason: string;   // "exact_match", "no_match", etc.
  count: number;
  match?: CrpPaymentRecord;
}

export interface FulfillPaymentResponse extends MatchPaymentResponse {
  webhook?: {
    configured: boolean;
    attempted: boolean;
    ok: boolean;
    status?: number;
  };
}

export class CrpClient {
  private readonly baseUrl: string;

  constructor(config: CrpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  /**
   * GET /v1/crp/payments/search
   */
  async searchPayments(
    params: SearchPaymentsParams
  ): Promise<SearchPaymentsResponse> {
    const url = new URL("/v1/crp/payments/search", this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `searchPayments failed: ${res.status} ${res.statusText}`
      );
    }

    const body = (await res.json()) as SearchPaymentsResponse;
    return body;
  }

  /**
   * POST /v1/crp/payments/match
   *
   * Expects an exact-tuple request (camelCase fields).
   */
  async matchPayment(
    tuple: MatchPaymentRequest
  ): Promise<MatchPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/v1/crp/payments/match`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(tuple),
    });

    if (!res.ok) {
      throw new Error(`matchPayment failed: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as MatchPaymentResponse;
    return body;
  }

  /**
   * POST /v1/crp/payments/fulfill
   *
   * Uses the same exact-tuple request as matchPayment, but
   * additionally attempts to fire any configured webhook.
   */
  async fulfillPayment(
    tuple: MatchPaymentRequest
  ): Promise<FulfillPaymentResponse> {
    const res = await fetch(`${this.baseUrl}/v1/crp/payments/fulfill`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(tuple),
    });

    if (!res.ok) {
      throw new Error(
        `fulfillPayment failed: ${res.status} ${res.statusText}`
      );
    }

    const body = (await res.json()) as FulfillPaymentResponse;
    return body;
  }
}
