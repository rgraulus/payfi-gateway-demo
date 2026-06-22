#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputTestOnlyGate,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const constructionGuard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const runtimeGate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(constructionGuard);
  const dryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(runtimeGate);
  const shape = projectLiveDirectBuyerSanitizedRuntimeInputShape(dryRun);
  const runtimeInput = constructLiveDirectBuyerTestOnlyRuntimeInputObject(shape);
  const actualDecoderInputGuard = guardLiveDirectBuyerActualDecoderInputConstruction(runtimeInput);
  const gate = openLiveDirectBuyerActualDecoderInputTestOnlyGate(actualDecoderInputGuard);
  const result = validateLiveDirectBuyerActualDecoderInputTestOnlyGate(gate);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_test_only_gate");
  assert.equal(result.status, "open_test_only");
  assert.equal(result.sourceActualDecoderInputGuardContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT);

  assert.equal(result.actualDecoderInputGuardValidated, true);
  assert.equal(result.testOnlyGateRequired, true);
  assert.equal(result.testOnlyGatePresent, true);
  assert.equal(result.testOnlyGateSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.runtimeInputObjectPresent, true);
  assert.equal(result.runtimeInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectMetadataOnly, true);
  assert.equal(result.runtimeDecoderInputObjectSanitized, true);
  assert.equal(result.runtimeDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(result.runtimeDecoderInputObjectNonDecodable, true);

  assert.equal(result.actualDecoderInputConstructionStillDeferred, true);
  assert.equal(result.actualDecoderInputConstructionAllowed, false);
  assert.equal(result.actualDecoderInputConstructionAttempted, false);
  assert.equal(result.actualDecoderInputConstructionBlocked, true);
  assert.equal(
    result.actualDecoderInputConstructionBlockReason,
    "actual_decoder_input_construction_deferred_after_test_only_gate",
  );

  assert.equal(result.actualDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputObjectReady, false);
  assert.equal(result.actualDecoderInputObjectPassedToDecoder, false);
  assert.equal(result.decoderInvocationAllowed, false);
  assert.equal(result.decoderInvocationAttempted, false);
  assert.equal(result.decoderInvoked, false);
  assert.equal(result.realDecoderAdapterInvoked, false);
  assert.equal(result.realDecoderInvoked, false);

  assert.equal(result.receiptMaterialAccepted, false);
  assert.equal(result.receiptMaterialIncluded, false);
  assert.equal(result.receiptJwsIncluded, false);
  assert.equal(result.receiptPayloadIncluded, false);
  assert.equal(result.receiptBytesIncluded, false);
  assert.equal(result.receiptObjectIncluded, false);
  assert.equal(result.rawReceiptIncluded, false);
  assert.equal(result.rawProofIncluded, false);
  assert.equal(result.settlementFieldsIncluded, false);
  assert.equal(result.replayKeyIncluded, false);

  assert.equal(result.paymentRequiredContextBound, true);
  assert.equal(result.nonceBound, true);
  assert.equal(result.resourceBound, true);
  assert.equal(result.contractBound, true);
  assert.equal(result.merchantBound, true);
  assert.equal(result.paymentTupleBound, true);

  assert.equal(result.decodedReceiptProduced, false);
  assert.equal(result.decodedReceiptVerified, false);
  assert.equal(result.decoderResultProduced, false);
  assert.equal(result.decoderResultReleaseConsumable, false);
  assert.equal(result.decoderResultConsumedByReleaseDecision, false);
  assert.equal(result.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(result.paymentResponseEmissionAllowed, false);
  assert.equal(result.crpFulfillAllowed, false);
  assert.equal(result.replayMutationAllowed, false);
  assert.equal(result.canonicalReleasePersistenceAllowed, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      actualDecoderInputConstructionAttempted: true,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_requires_deferred_blocked_actual_decoder_input_construction/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      actualDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      nonceBound: false,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputTestOnlyGate({
      ...gate,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_test_only_gate_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputTestOnlyGate.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceActualDecoderInputGuardContract: result.sourceActualDecoderInputGuardContract,
    actualDecoderInputGuardValidated: result.actualDecoderInputGuardValidated,
    testOnlyGateRequired: result.testOnlyGateRequired,
    testOnlyGatePresent: result.testOnlyGatePresent,
    testOnlyGateSatisfied: result.testOnlyGateSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    runtimeInputObjectPresent: result.runtimeInputObjectPresent,
    runtimeInputObjectBuilt: result.runtimeInputObjectBuilt,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    runtimeDecoderInputObjectMetadataOnly: result.runtimeDecoderInputObjectMetadataOnly,
    runtimeDecoderInputObjectSanitized: result.runtimeDecoderInputObjectSanitized,
    runtimeDecoderInputObjectBoundToPaymentRequired: result.runtimeDecoderInputObjectBoundToPaymentRequired,
    runtimeDecoderInputObjectNonDecodable: result.runtimeDecoderInputObjectNonDecodable,
    actualDecoderInputConstructionStillDeferred: result.actualDecoderInputConstructionStillDeferred,
    actualDecoderInputConstructionAllowed: result.actualDecoderInputConstructionAllowed,
    actualDecoderInputConstructionAttempted: result.actualDecoderInputConstructionAttempted,
    actualDecoderInputConstructionBlocked: result.actualDecoderInputConstructionBlocked,
    actualDecoderInputConstructionBlockReason: result.actualDecoderInputConstructionBlockReason,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
    actualDecoderInputObjectReady: result.actualDecoderInputObjectReady,
    actualDecoderInputObjectPassedToDecoder: result.actualDecoderInputObjectPassedToDecoder,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
    realDecoderAdapterInvoked: result.realDecoderAdapterInvoked,
    realDecoderInvoked: result.realDecoderInvoked,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptMaterialIncluded: result.receiptMaterialIncluded,
    receiptJwsIncluded: result.receiptJwsIncluded,
    receiptPayloadIncluded: result.receiptPayloadIncluded,
    rawReceiptIncluded: result.rawReceiptIncluded,
    rawProofIncluded: result.rawProofIncluded,
    paymentRequiredContextBound: result.paymentRequiredContextBound,
    nonceBound: result.nonceBound,
    resourceBound: result.resourceBound,
    contractBound: result.contractBound,
    merchantBound: result.merchantBound,
    paymentTupleBound: result.paymentTupleBound,
    decodedReceiptProduced: result.decodedReceiptProduced,
    decoderResultProduced: result.decoderResultProduced,
    decoderResultReleaseConsumable: result.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: result.decoderResultConsumedByReleaseDecision,
    releaseDecisionMutatedByDecoderResult: result.releaseDecisionMutatedByDecoderResult,
    paymentResponseEmissionAllowed: result.paymentResponseEmissionAllowed,
    crpFulfillAllowed: result.crpFulfillAllowed,
    replayMutationAllowed: result.replayMutationAllowed,
    canonicalReleasePersistenceAllowed: result.canonicalReleasePersistenceAllowed,
    productionEnablementRejected: true,
    actualDecoderInputConstructionStillDeferredRejectedIfAttempted: true,
    actualDecoderInputObjectRejected: true,
    receiptMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
