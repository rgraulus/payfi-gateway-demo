import assert from 'node:assert/strict';

import {
  assertCcdPltProofV1,
  type CcdPltProofV1,
} from '../src/proofPayload';
import {
  buildX402ReceiptPaymentSatisfaction,
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
  type X402ReceiptBindingContext,
  type X402ReceiptPaymentSignal,
} from '../src/phase3/x402ReceiptPaymentSignal';

const proof: CcdPltProofV1 = {
  proofVersion: 'ccd-plt-proof@v1',
  contract: {
    contractId: 'cid_phase3_context_from_proof',
    contractVersion: '1.0.0',
    isFrozen: true,
    merchantId: 'demo-merchant',
    resource: {
      method: 'GET',
      path: '/paid-gated',
    },
    network: 'concordium:testnet',
    asset: {
      type: 'PLT',
      tokenId: 'EUDemo',
      decimals: 6,
    },
    amount: '0.050101',
    payTo: 'ccd1qmerchantplaceholder',
  },
  nonce: 'phase3-context-from-proof-nonce-001',
  settlement: {
    status: 'finalized',
    settledAt: 1_700_000_000,
    expiresAt: 4_000_000_000,
  },
  chain: {
    transactionHash: 'abc123',
    blockHash: 'def456',
    blockHeight: 123456,
  },
  paymentEvent: {
    kind: 'plt.transfer',
    tokenId: 'EUDemo',
    amountRaw: '50101',
    from: 'ccd1qbuyerplaceholder',
    to: 'ccd1qmerchantplaceholder',
  },
};

assertCcdPltProofV1(proof);

const derived = deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

const expected: X402ReceiptBindingContext = {
  nonce: proof.nonce,
  resource: {
    method: proof.contract.resource.method,
    path: proof.contract.resource.path,
  },
  contract: {
    contractId: proof.contract.contractId,
    contractVersion: proof.contract.contractVersion,
    merchantId: proof.contract.merchantId,
  },
  network: proof.contract.network,
  asset: {
    type: proof.contract.asset.type,
    tokenId: proof.contract.asset.tokenId,
    decimals: proof.contract.asset.decimals,
  },
  amount: proof.contract.amount,
  payTo: proof.contract.payTo,
};

assert.deepEqual(derived, expected);

const receiptSignal: X402ReceiptPaymentSignal = {
  ok: true,
  source: 'x402-receipt',
  receiptVerified: true,
  settlementStatus: 'finalized',
  receiptExpired: false,
  context: derived,
  rawReceiptPrinted: false,
};

const satisfied = buildX402ReceiptPaymentSatisfaction({
  receipt: receiptSignal,
  expectedContext: expected,
});

assert.equal(satisfied.ok, true);
assert.equal(satisfied.payment.paymentSatisfied, true);
assert.equal(satisfied.receiptContextMatched, true);
assert.equal(satisfied.contextMismatchField, null);
assert.equal(satisfied.rawReceiptPrinted, false);

const wrongExpectedNonce: X402ReceiptBindingContext = {
  ...expected,
  nonce: 'wrong-expected-nonce',
};

const rejected = buildX402ReceiptPaymentSatisfaction({
  receipt: receiptSignal,
  expectedContext: wrongExpectedNonce,
});

assert.equal(rejected.ok, false);
assert.equal(rejected.payment.paymentSatisfied, false);
assert.equal(rejected.reason, 'receipt_context_mismatch');
assert.equal(rejected.receiptContextMatched, false);
assert.equal(rejected.contextMismatchField, 'nonce');
assert.equal(rejected.rawReceiptPrinted, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      proofVersion: proof.proofVersion,
      derivedNonce: derived.nonce,
      derivedResourcePath: derived.resource.path,
      derivedContractId: derived.contract.contractId,
      derivedMerchantId: derived.contract.merchantId,
      derivedNetwork: derived.network,
      derivedAssetTokenId: derived.asset.tokenId,
      derivedAmount: derived.amount,
      derivedPayTo: derived.payTo,
      derivedContextMatchedExpected: satisfied.receiptContextMatched,
      wrongExpectedNonceRejected: rejected.ok === false,
      wrongExpectedNonceMismatchField: rejected.contextMismatchField,
      rawProofPrinted: false,
      rawReceiptPrinted: false,
    },
    null,
    2,
  ),
);
