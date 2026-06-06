import type {
  ModelAPaymentSatisfactionInput,
} from './modelAReleaseComposition';

export type X402ReceiptBindingContext = {
  nonce: string;
  resource: {
    method: string;
    path: string;
  };
  contract: {
    contractId: string;
    contractVersion: string;
    merchantId: string;
  };
  network: string;
  asset: {
    type: string;
    tokenId: string;
    decimals: number;
  };
  amount: string;
  payTo: string;
};

export type X402ReceiptPaymentSignal = {
  ok: boolean;
  source: 'x402-receipt';
  receiptVerified: boolean;
  settlementStatus: 'finalized' | 'pending' | 'failed' | 'unknown';
  receiptExpired: boolean;
  context?: X402ReceiptBindingContext;
  rawReceiptPrinted: false;
};

export type X402ReceiptContextMismatchField =
  | 'nonce'
  | 'resource.method'
  | 'resource.path'
  | 'contract.contractId'
  | 'contract.contractVersion'
  | 'contract.merchantId'
  | 'network'
  | 'asset.type'
  | 'asset.tokenId'
  | 'asset.decimals'
  | 'amount'
  | 'payTo'
  | 'missing_receipt_context';

export type X402ReceiptPaymentSignalResult =
  | {
      ok: true;
      payment: ModelAPaymentSatisfactionInput;
      receiptVerified: true;
      settlementStatus: 'finalized';
      receiptExpired: false;
      receiptContextMatched: true;
      contextMismatchField: null;
      rawReceiptPrinted: false;
    }
  | {
      ok: false;
      payment: ModelAPaymentSatisfactionInput;
      reason:
        | 'receipt_not_verified'
        | 'settlement_not_finalized'
        | 'receipt_expired'
        | 'invalid_receipt_source'
        | 'receipt_context_mismatch';
      receiptVerified: boolean;
      settlementStatus: X402ReceiptPaymentSignal['settlementStatus'];
      receiptExpired: boolean;
      receiptContextMatched: boolean;
      contextMismatchField: X402ReceiptContextMismatchField | null;
      rawReceiptPrinted: false;
    };

function compareReceiptContext(input: {
  expected: X402ReceiptBindingContext;
  actual?: X402ReceiptBindingContext;
}): {
  ok: boolean;
  field: X402ReceiptContextMismatchField | null;
} {
  const { expected, actual } = input;

  if (!actual) {
    return { ok: false, field: 'missing_receipt_context' };
  }

  const checks: Array<[X402ReceiptContextMismatchField, unknown, unknown]> = [
    ['nonce', actual.nonce, expected.nonce],
    ['resource.method', actual.resource?.method, expected.resource.method],
    ['resource.path', actual.resource?.path, expected.resource.path],
    ['contract.contractId', actual.contract?.contractId, expected.contract.contractId],
    ['contract.contractVersion', actual.contract?.contractVersion, expected.contract.contractVersion],
    ['contract.merchantId', actual.contract?.merchantId, expected.contract.merchantId],
    ['network', actual.network, expected.network],
    ['asset.type', actual.asset?.type, expected.asset.type],
    ['asset.tokenId', actual.asset?.tokenId, expected.asset.tokenId],
    ['asset.decimals', actual.asset?.decimals, expected.asset.decimals],
    ['amount', actual.amount, expected.amount],
    ['payTo', actual.payTo, expected.payTo],
  ];

  for (const [field, actualValue, expectedValue] of checks) {
    if (actualValue !== expectedValue) {
      return { ok: false, field };
    }
  }

  return { ok: true, field: null };
}

export function buildX402ReceiptPaymentSatisfaction(input: {
  receipt: X402ReceiptPaymentSignal;
  expectedContext?: X402ReceiptBindingContext;
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
      receiptContextMatched: false,
      contextMismatchField: null,
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
      receiptContextMatched: false,
      contextMismatchField: null,
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
      receiptContextMatched: false,
      contextMismatchField: null,
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
      receiptContextMatched: false,
      contextMismatchField: null,
      rawReceiptPrinted: false,
    };
  }

  if (input.expectedContext) {
    const context = compareReceiptContext({
      expected: input.expectedContext,
      actual: receipt.context,
    });

    if (!context.ok) {
      return {
        ok: false,
        payment: unpaid,
        reason: 'receipt_context_mismatch',
        receiptVerified: true,
        settlementStatus: 'finalized',
        receiptExpired: false,
        receiptContextMatched: false,
        contextMismatchField: context.field,
        rawReceiptPrinted: false,
      };
    }
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
    receiptContextMatched: true,
    contextMismatchField: null,
    rawReceiptPrinted: false,
  };
}
