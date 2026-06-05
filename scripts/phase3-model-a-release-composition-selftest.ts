import assert from 'node:assert/strict';

import type {
  ModelAEligibilityBindingResult,
} from '../src/phase3/modelAEligibilityBinding';
import {
  composeModelAReleaseDecision,
} from '../src/phase3/modelAReleaseComposition';

const boundEligibility: ModelAEligibilityBindingResult = {
  ok: true,
  model: 'phase3-model-a',
  eligibilityVerified: true,
  challengeBound: true,
  resourceBound: true,
  releaseAuthorized: false,
  paymentReleaseAttempted: false,
  paymentResponseEmitted: false,
  crpCalled: false,
  replayTouched: false,
  rawProofPrinted: false,
};

const unboundEligibility: ModelAEligibilityBindingResult = {
  ...boundEligibility,
  ok: false,
  challengeBound: false,
  resourceBound: false,
  bindingCode: 'policy_binding_mismatch',
  bindingReason: 'simulated binding mismatch',
};

function assertNoSideEffects(result: ReturnType<typeof composeModelAReleaseDecision>) {
  assert.equal(result.paymentReleaseAttempted, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.crpCalled, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.rawProofPrinted, false);
}

function main() {
  const eligibleButUnpaid = composeModelAReleaseDecision({
    boundEligibility,
    payment: {
      paymentSatisfied: false,
      paymentSource: 'none',
    },
  });

  assert.equal(eligibleButUnpaid.ok, false);
  assert.equal(eligibleButUnpaid.eligibilityVerified, true);
  assert.equal(eligibleButUnpaid.challengeBound, true);
  assert.equal(eligibleButUnpaid.resourceBound, true);
  assert.equal(eligibleButUnpaid.paymentSatisfied, false);
  assert.equal(eligibleButUnpaid.paymentSource, 'none');
  assert.equal(eligibleButUnpaid.releaseAuthorized, false);
  assert.equal(eligibleButUnpaid.reason, 'payment_not_satisfied');
  assertNoSideEffects(eligibleButUnpaid);

  const unboundButPaid = composeModelAReleaseDecision({
    boundEligibility: unboundEligibility,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(unboundButPaid.ok, false);
  assert.equal(unboundButPaid.eligibilityVerified, true);
  assert.equal(unboundButPaid.challengeBound, false);
  assert.equal(unboundButPaid.resourceBound, false);
  assert.equal(unboundButPaid.paymentSatisfied, true);
  assert.equal(unboundButPaid.releaseAuthorized, false);
  assert.equal(unboundButPaid.reason, 'eligibility_not_bound');
  assertNoSideEffects(unboundButPaid);

  const eligibleAndPaid = composeModelAReleaseDecision({
    boundEligibility,
    payment: {
      paymentSatisfied: true,
      paymentSource: 'test-only',
    },
  });

  assert.equal(eligibleAndPaid.ok, true);
  assert.equal(eligibleAndPaid.eligibilityVerified, true);
  assert.equal(eligibleAndPaid.challengeBound, true);
  assert.equal(eligibleAndPaid.resourceBound, true);
  assert.equal(eligibleAndPaid.paymentSatisfied, true);
  assert.equal(eligibleAndPaid.paymentSource, 'test-only');
  assert.equal(eligibleAndPaid.releaseAuthorized, true);
  assert.equal(eligibleAndPaid.reason, 'release_authorized');
  assertNoSideEffects(eligibleAndPaid);

  console.log(
    JSON.stringify(
      {
        ok: true,
        eligibleButUnpaidDoesNotRelease: eligibleButUnpaid.releaseAuthorized === false,
        unboundButPaidDoesNotRelease: unboundButPaid.releaseAuthorized === false,
        eligibleAndPaidWouldAuthorizeRelease: eligibleAndPaid.releaseAuthorized === true,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        replayTouched: false,
        rawProofPrinted: false,
      },
      null,
      2,
    ),
  );
}

main();
