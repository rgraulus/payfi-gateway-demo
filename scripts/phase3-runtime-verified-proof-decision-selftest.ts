import assert from 'node:assert/strict';

import type { CcdPltProofV1 } from '../src/proofPayload';
import {
  buildPhase3RuntimeVerifiedReceiptDecision,
  type Phase3RuntimeGatedAuthorizationReadiness,
} from '../src/phase3/runtimeVerifiedReceiptDecision';
import {
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
  type X402ReceiptBindingContext,
} from '../src/phase3/x402ReceiptPaymentSignal';

const nowSec = 1_800_000_000;

const proof: CcdPltProofV1 = {
  proofVersion: 'ccd-plt-proof@v1',
  contract: {
    contractId: 'cid_phase3_runtime_verified_proof_decision',
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
  nonce: 'phase3-runtime-verified-proof-decision-nonce-001',
  settlement: {
    status: 'finalized',
    settledAt: nowSec - 60,
    expiresAt: nowSec + 300,
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

const readiness: Phase3RuntimeGatedAuthorizationReadiness = {
  ok: true,
  status: 'POLICY_SATISFIED',
  challengeId: proof.nonce,
  releaseStatus: 'POLICY_SATISFIED',
};

const expectedContext: X402ReceiptBindingContext =
  deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

const allowed = buildPhase3RuntimeVerifiedReceiptDecision({
  readiness,
  proof,
  nowSec,
  expectedContext,
});

assert.equal(allowed.ok, true);
assert.equal(allowed.readinessOk, true);
assert.equal(allowed.readinessStatus, 'POLICY_SATISFIED');
assert.equal(allowed.decision.ok, true);
assert.equal(allowed.decision.reason, 'release_authorized');
assert.equal(allowed.decision.receiptVerified, true);
assert.equal(allowed.decision.settlementStatus, 'finalized');
assert.equal(allowed.decision.receiptExpired, false);
assert.equal(allowed.decision.receiptContextMatched, true);
assert.equal(allowed.decision.receiptContextMismatchField, null);
assert.equal(allowed.paymentResponseAllowed, true);
assert.equal(allowed.resourceReleaseAllowed, true);
assert.equal(allowed.productionRelease, false);
assert.equal(allowed.paymentReleaseAttempted, false);
assert.equal(allowed.paymentResponseEmitted, false);
assert.equal(allowed.crpCalled, false);
assert.equal(allowed.crpFulfillCalled, false);
assert.equal(allowed.replayTouched, false);
assert.equal(allowed.resourceReleased, false);
assert.equal(allowed.canonicalReleasePersisted, false);
assert.equal(allowed.rawProofPrinted, false);
assert.equal(allowed.rawReceiptPrinted, false);

const wrongExpectedContext: X402ReceiptBindingContext = {
  ...expectedContext,
  nonce: 'wrong-expected-runtime-nonce',
};

const mismatched = buildPhase3RuntimeVerifiedReceiptDecision({
  readiness,
  proof,
  nowSec,
  expectedContext: wrongExpectedContext,
});

assert.equal(mismatched.ok, false);
assert.equal(mismatched.readinessOk, true);
assert.equal(mismatched.decision.ok, false);
assert.equal(mismatched.decision.reason, 'receipt_context_mismatch');
assert.equal(mismatched.decision.receiptContextMatched, false);
assert.equal(mismatched.decision.receiptContextMismatchField, 'nonce');
assert.equal(mismatched.paymentResponseAllowed, false);
assert.equal(mismatched.resourceReleaseAllowed, false);
assert.equal(mismatched.productionRelease, false);
assert.equal(mismatched.paymentResponseEmitted, false);
assert.equal(mismatched.replayTouched, false);
assert.equal(mismatched.resourceReleased, false);
assert.equal(mismatched.canonicalReleasePersisted, false);
assert.equal(mismatched.rawProofPrinted, false);
assert.equal(mismatched.rawReceiptPrinted, false);

const expired = buildPhase3RuntimeVerifiedReceiptDecision({
  readiness,
  proof: {
    ...proof,
    settlement: {
      ...proof.settlement,
      expiresAt: nowSec,
    },
  },
  nowSec,
  expectedContext,
});

assert.equal(expired.ok, false);
assert.equal(expired.readinessOk, true);
assert.equal(expired.decision.ok, false);
assert.equal(expired.decision.reason, 'receipt_expired');
assert.equal(expired.decision.receiptExpired, true);
assert.equal(expired.paymentResponseAllowed, false);
assert.equal(expired.resourceReleaseAllowed, false);
assert.equal(expired.productionRelease, false);
assert.equal(expired.paymentResponseEmitted, false);
assert.equal(expired.replayTouched, false);
assert.equal(expired.resourceReleased, false);
assert.equal(expired.canonicalReleasePersisted, false);
assert.equal(expired.rawProofPrinted, false);
assert.equal(expired.rawReceiptPrinted, false);

const missingCanonical = buildPhase3RuntimeVerifiedReceiptDecision({
  readiness: {
    ok: false,
    reason: 'missing_canonical_challenge',
  },
  proof,
  nowSec,
  expectedContext,
});

assert.equal(missingCanonical.ok, false);
assert.equal(missingCanonical.readinessOk, false);
assert.equal(missingCanonical.reason, 'missing_canonical_challenge');
assert.equal(missingCanonical.paymentResponseAllowed, false);
assert.equal(missingCanonical.resourceReleaseAllowed, false);
assert.equal(missingCanonical.productionRelease, false);
assert.equal(missingCanonical.paymentResponseEmitted, false);
assert.equal(missingCanonical.replayTouched, false);
assert.equal(missingCanonical.resourceReleased, false);
assert.equal(missingCanonical.canonicalReleasePersisted, false);
assert.equal(missingCanonical.rawProofPrinted, false);
assert.equal(missingCanonical.rawReceiptPrinted, false);

const policyNotSatisfied = buildPhase3RuntimeVerifiedReceiptDecision({
  readiness: {
    ok: false,
    reason: 'policy_not_satisfied',
    status: 'SOURCE_VERIFIED',
    challengeId: proof.nonce,
    releaseStatus: 'SOURCE_VERIFIED',
  },
  proof,
  nowSec,
  expectedContext,
});

assert.equal(policyNotSatisfied.ok, false);
assert.equal(policyNotSatisfied.readinessOk, false);
assert.equal(policyNotSatisfied.reason, 'policy_not_satisfied');
assert.equal(policyNotSatisfied.readinessStatus, 'SOURCE_VERIFIED');
assert.equal(policyNotSatisfied.paymentResponseAllowed, false);
assert.equal(policyNotSatisfied.resourceReleaseAllowed, false);
assert.equal(policyNotSatisfied.productionRelease, false);
assert.equal(policyNotSatisfied.paymentResponseEmitted, false);
assert.equal(policyNotSatisfied.replayTouched, false);
assert.equal(policyNotSatisfied.resourceReleased, false);
assert.equal(policyNotSatisfied.canonicalReleasePersisted, false);
assert.equal(policyNotSatisfied.rawProofPrinted, false);
assert.equal(policyNotSatisfied.rawReceiptPrinted, false);

console.log(
  JSON.stringify(
    {
      ok: true,
      runtimeDecisionFromVerifiedProof: allowed.ok,
      readinessStatus: allowed.readinessStatus,
      releaseAuthorized: allowed.decision.releaseAuthorized,
      paymentResponseAllowed: allowed.paymentResponseAllowed,
      resourceReleaseAllowed: allowed.resourceReleaseAllowed,
      productionRelease: allowed.productionRelease,
      wrongExpectedNonceRejected: mismatched.ok === false,
      wrongExpectedNonceReason: mismatched.decision.reason,
      wrongExpectedNonceMismatchField: mismatched.decision.receiptContextMismatchField,
      expiredReceiptRejected: expired.ok === false,
      expiredReceiptReason: expired.decision.reason,
      missingCanonicalRejected: missingCanonical.reason,
      policyNotSatisfiedRejected: policyNotSatisfied.reason,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      crpFulfillCalled: false,
      replayTouched: false,
      resourceReleased: false,
      canonicalReleasePersisted: false,
      rawProofPrinted: false,
      rawReceiptPrinted: false,
    },
    null,
    2,
  ),
);
