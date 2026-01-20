// src/crpClient.ts
//
// CRP client used by the demo gateway.
// Key behavior change:
// - Do NOT throw on non-2xx responses from CRP.
// - Always return parsed JSON + httpStatus so the gateway can decide what to do.
// - Only throw on network/transport errors or invalid JSON.

export type Asset = {
  type: string; // "PLT"
  tokenId: string;
  decimals: number;
};

export type MatchPaymentRequest = {
  merchantId: string;
  nonce: string;
  network: string;
  payTo: string;
  amount: string;
  asset: Asset;
};

export type CrpResponse<T = any> = T & { httpStatus: number };

export class CrpClient {
  private baseUrl: string;

  constructor(opts: { baseUrl: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
  }

  private async postJson<T>(path: string, body: unknown): Promise<CrpResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    let resp: Response;

    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      // Network/transport error (gateway truly cannot reach CRP)
      throw new Error(`CRP fetch failed: ${String(e?.message ?? e)}`);
    }

    const text = await resp.text();
    let json: any = null;

    if (text && text.trim().length > 0) {
      try {
        json = JSON.parse(text);
      } catch (e: any) {
        throw new Error(
          `CRP returned non-JSON (${resp.status}): ${String(e?.message ?? e)}; body=${text.slice(0, 200)}`
        );
      }
    }

    return { ...(json ?? {}), httpStatus: resp.status };
  }

  async matchPayment(req: MatchPaymentRequest): Promise<CrpResponse<any>> {
    // Facilitator routes are mounted at /v1/crp/...
    return this.postJson("/v1/crp/payments/match", req);
  }

  async fulfillPayment(req: MatchPaymentRequest): Promise<CrpResponse<any>> {
    // Same body shape as match + extra optional flags handled server-side.
    return this.postJson("/v1/crp/payments/fulfill", req);
  }
}
