import type {
  ModelAPaymentSatisfactionInput,
} from './modelAReleaseComposition';

export type X402ReceiptPaymentSignal = {
  ok: boolean;
  source: 'x402-receipt';
  receiptVerified: boolean;
  settlementStatus: 'finalized' | 'pending' | 'failed' | 'unknown';
  receiptExpired: boolean;
  rawReceiptPrinted: false;
};

export type X402ReceiptPaymentSignalResult =
  | {
      ok: true;
      payment: ModelAPaymentSatisfactionInput;
      receiptVerified: true;
      settlementStatus: 'finalized';
      receiptExpired: false;
      rawReceiptPrinted: false;
    }
  | {
      ok: false;
      payment: ModelAPaymentSatisfactionInput;
      reason:
        | 'receipt_not_verified'
        | 'settlement_not_finalized'
        | 'receipt_expired'
        | 'invalid_receipt_source';
      receiptVerified: boolean;
      settlementStatus: X402ReceiptPaymentSignal['settlementStatus'];
      receiptExpired: boolean;
      rawReceiptPrinted: false;
    };

export function buildX402ReceiptPaymentSatisfaction(input: {
  receipt: X402ReceiptPaymentSignal;
}): X402ReceiptPaymentSignalResult {
  const receipt = input.receipt;

  const unpaid: ModelAPaymentSatisfactionInput = {
    paymentSatisfied: false,
    paymentSource: 'x402-receipt',
  };

  if (receipt.source !== 'x402-receipt') {
    return {
      ok: false,
      payment: unpaid,
      reason: 'invalid_receipt_source',
      receiptVerified: receipt.receiptVerified,
      settlementStatus: receipt.settlementStatus,
      receiptExpired: receipt.receiptExpired,
      rawReceiptPrinted: false,
    };
  }

  if (!receipt.receiptVerified || !receipt.ok) {
    return {
      ok: false,
      payment: unpaid,
      reason: 'receipt_not_verified',
      receiptVerified: receipt.receiptVerified,
      settlementStatus: receipt.settlementStatus,
      receiptExpired: receipt.receiptExpired,
      rawReceiptPrinted: false,
    };
  }

  if (receipt.receiptExpired) {
    return {
      ok: false,
      payment: unpaid,
      reason: 'receipt_expired',
      receiptVerified: receipt.receiptVerified,
      settlementStatus: receipt.settlementStatus,
      receiptExpired: true,
      rawReceiptPrinted: false,
    };
  }

  if (receipt.settlementStatus !== 'finalized') {
    return {
      ok: false,
      payment: unpaid,
      reason: 'settlement_not_finalized',
      receiptVerified: true,
      settlementStatus: receipt.settlementStatus,
      receiptExpired: false,
      rawReceiptPrinted: false,
    };
  }

  return {
    ok: true,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'x402-receipt',
    },
    receiptVerified: true,
    settlementStatus: 'finalized',
    receiptExpired: false,
    rawReceiptPrinted: false,
  };
}
