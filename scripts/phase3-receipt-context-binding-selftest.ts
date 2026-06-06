import assert from 'node:assert/strict';

import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptBindingContext,
  type X402ReceiptPaymentSignal,
} from '../src/phase3/x402ReceiptPaymentSignal';

const expectedContext: X402ReceiptBindingContext = {
  nonce: 'phase3-receipt-context-binding-nonce-001',
  resource: {
    method: 'GET',
    path: '/paid-gated',
  },
  contract: {
    contractId: 'cid_phase3_receipt_context_binding',
    contractVersion: '1.0.0',
    merchantId: 'demo-merchant',
  },
  network: 'concordium:testnet',
  asset: {
    type: 'PLT',
    tokenId: 'EUDemo',
    decimals: 6,
  },
  amount: '0.050101',
  payTo: 'ccd1qmerchantplaceholder',
};

function receiptSignal(
  context: X402ReceiptBindingContext | undefined,
  overrides: Partial<X402ReceiptPaymentSignal> = {},
): X402ReceiptPaymentSignal {
  return {
    ok: true,
    source: 'x402-receipt',
    receiptVerified: true,
    settlementStatus: 'finalized',
    receiptExpired: false,
    context,
    rawReceiptPrinted: false,
    ...overrides,
  };
}

function expectContextMismatch(input: {
  label: string;
  context?: X402ReceiptBindingContext;
  expectedField: string;
}) {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: receiptSignal(input.context),
    expectedContext,
  });

  assert.equal(payment.ok, false, input.label);
  assert.equal(payment.payment.paymentSatisfied, false, input.label);
  assert.equal(payment.reason, 'receipt_context_mismatch', input.label);
  assert.equal(payment.receiptVerified, true, input.label);
  assert.equal(payment.settlementStatus, 'finalized', input.label);
  assert.equal(payment.receiptExpired, false, input.label);
  assert.equal(payment.receiptContextMatched, false, input.label);
  assert.equal(payment.contextMismatchField, input.expectedField, input.label);
  assert.equal(payment.rawReceiptPrinted, false, input.label);
}

const matched = buildX402ReceiptPaymentSatisfaction({
  receipt: receiptSignal(expectedContext),
  expectedContext,
});

assert.equal(matched.ok, true);
assert.equal(matched.payment.paymentSatisfied, true);
assert.equal(matched.payment.paymentSource, 'x402-receipt');
assert.equal(matched.receiptVerified, true);
assert.equal(matched.settlementStatus, 'finalized');
assert.equal(matched.receiptExpired, false);
assert.equal(matched.receiptContextMatched, true);
assert.equal(matched.contextMismatchField, null);
assert.equal(matched.rawReceiptPrinted, false);

expectContextMismatch({
  label: 'missing receipt context must fail closed',
  context: undefined,
  expectedField: 'missing_receipt_context',
});

expectContextMismatch({
  label: 'wrong nonce must fail closed',
  context: {
    ...expectedContext,
    nonce: 'wrong-nonce',
  },
  expectedField: 'nonce',
});

expectContextMismatch({
  label: 'wrong resource path must fail closed',
  context: {
    ...expectedContext,
    resource: {
      ...expectedContext.resource,
      path: '/paid-gated-other',
    },
  },
  expectedField: 'resource.path',
});

expectContextMismatch({
  label: 'wrong contract id must fail closed',
  context: {
    ...expectedContext,
    contract: {
      ...expectedContext.contract,
      contractId: 'cid_wrong_contract',
    },
  },
  expectedField: 'contract.contractId',
});

expectContextMismatch({
  label: 'wrong merchant id must fail closed',
  context: {
    ...expectedContext,
    contract: {
      ...expectedContext.contract,
      merchantId: 'wrong-merchant',
    },
  },
  expectedField: 'contract.merchantId',
});

expectContextMismatch({
  label: 'wrong amount must fail closed',
  context: {
    ...expectedContext,
    amount: '0.999999',
  },
  expectedField: 'amount',
});

expectContextMismatch({
  label: 'wrong payTo must fail closed',
  context: {
    ...expectedContext,
    payTo: 'ccd1qothermerchant',
  },
  expectedField: 'payTo',
});

expectContextMismatch({
  label: 'wrong network must fail closed',
  context: {
    ...expectedContext,
    network: 'concordium:mainnet',
  },
  expectedField: 'network',
});

expectContextMismatch({
  label: 'wrong asset token must fail closed',
  context: {
    ...expectedContext,
    asset: {
      ...expectedContext.asset,
      tokenId: 'OtherDemo',
    },
  },
  expectedField: 'asset.tokenId',
});

// Backward compatibility: when no expected context is supplied, the pre-#137
// verified/finalized/not-expired receipt signal still maps to payment
// satisfaction. The release decision path should pass expectedContext whenever
// context binding is required.
const legacyUnbound = buildX402ReceiptPaymentSatisfaction({
  receipt: receiptSignal(undefined),
});

assert.equal(legacyUnbound.ok, true);
assert.equal(legacyUnbound.payment.paymentSatisfied, true);
assert.equal(legacyUnbound.receiptContextMatched, true);
assert.equal(legacyUnbound.contextMismatchField, null);
assert.equal(legacyUnbound.rawReceiptPrinted, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      matchedReceiptAccepted: matched.ok,
      missingContextRejected: true,
      wrongNonceRejected: true,
      wrongResourceRejected: true,
      wrongContractRejected: true,
      wrongMerchantRejected: true,
      wrongAmountRejected: true,
      wrongPayToRejected: true,
      wrongNetworkRejected: true,
      wrongAssetRejected: true,
      legacyUnboundStillAcceptedWithoutExpectedContext: legacyUnbound.ok,
      rawReceiptPrinted: false,
    },
    null,
    2,
  ),
);
