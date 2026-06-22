#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT,
  LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerTestOnlyRuntimeInputObject,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const guard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const gate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(guard);
  const dryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(gate);
  const shape = projectLiveDirectBuyerSanitizedRuntimeInputShape(dryRun);
  const runtimeInput = constructLiveDirectBuyerTestOnlyRuntimeInputObject(shape);
  const result = validateLiveDirectBuyerTestOnlyRuntimeInputObject(runtimeInput);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT);
  assert.equal(result.mode, "test_only_runtime_input_object_construction");
  assert.equal(result.status, "runtime_input_object_constructed_test_only");
  assert.equal(result.sourceShapeContract, LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT);

  assert.equal(result.shapeValidated, true);
  assert.equal(result.shapeProjected, true);
  assert.equal(result.shapeMetadataOnly, true);
  assert.equal(result.shapeSanitized, true);
  assert.equal(result.shapeBoundToPaymentRequired, true);

  assert.equal(result.testOnlyConstructionRequired, true);
  assert.equal(result.testOnlyConstructionPresent, true);
  assert.equal(result.testOnlyConstructionSatisfied, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.runtimeInputObjectKind, "test_only_sanitized_runtime_input_object");
  assert.equal(result.runtimeInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectMetadataOnly, true);
  assert.equal(result.runtimeDecoderInputObjectSanitized, true);
  assert.equal(result.runtimeDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(result.runtimeDecoderInputObjectNonceBound, true);
  assert.equal(result.runtimeDecoderInputObjectResourceBound, true);
  assert.equal(result.runtimeDecoderInputObjectContractBound, true);
  assert.equal(result.runtimeDecoderInputObjectMerchantBound, true);
  assert.equal(result.runtimeDecoderInputObjectPaymentTupleBound, true);
  assert.equal(result.runtimeDecoderInputObjectReceiptMaterialFree, true);
  assert.equal(result.runtimeDecoderInputObjectReplayFree, true);
  assert.equal(result.runtimeDecoderInputObjectSettlementFree, true);
  assert.equal(result.runtimeDecoderInputObjectNonDecodable, true);

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
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_test_only_runtime_input_object_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      runtimeDecoderInputObjectSanitized: false,
    }),
    /live_direct_buyer_test_only_runtime_input_object_requires_sanitized_payment_required_bound_runtime_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      runtimeDecoderInputObjectReceiptMaterialFree: false,
    }),
    /live_direct_buyer_test_only_runtime_input_object_requires_non_decodable_material_free_runtime_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      actualDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_test_only_runtime_input_object_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_test_only_runtime_input_object_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRuntimeInputObject({
      ...runtimeInput,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_test_only_runtime_input_object_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerTestOnlyRuntimeInputObject.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceShapeContract: result.sourceShapeContract,
    shapeValidated: result.shapeValidated,
    shapeProjected: result.shapeProjected,
    shapeMetadataOnly: result.shapeMetadataOnly,
    shapeSanitized: result.shapeSanitized,
    shapeBoundToPaymentRequired: result.shapeBoundToPaymentRequired,
    testOnlyConstructionRequired: result.testOnlyConstructionRequired,
    testOnlyConstructionPresent: result.testOnlyConstructionPresent,
    testOnlyConstructionSatisfied: result.testOnlyConstructionSatisfied,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    runtimeInputObjectKind: result.runtimeInputObjectKind,
    runtimeInputObjectBuilt: result.runtimeInputObjectBuilt,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    runtimeDecoderInputObjectMetadataOnly: result.runtimeDecoderInputObjectMetadataOnly,
    runtimeDecoderInputObjectSanitized: result.runtimeDecoderInputObjectSanitized,
    runtimeDecoderInputObjectBoundToPaymentRequired: result.runtimeDecoderInputObjectBoundToPaymentRequired,
    runtimeDecoderInputObjectNonceBound: result.runtimeDecoderInputObjectNonceBound,
    runtimeDecoderInputObjectResourceBound: result.runtimeDecoderInputObjectResourceBound,
    runtimeDecoderInputObjectContractBound: result.runtimeDecoderInputObjectContractBound,
    runtimeDecoderInputObjectMerchantBound: result.runtimeDecoderInputObjectMerchantBound,
    runtimeDecoderInputObjectPaymentTupleBound: result.runtimeDecoderInputObjectPaymentTupleBound,
    runtimeDecoderInputObjectReceiptMaterialFree: result.runtimeDecoderInputObjectReceiptMaterialFree,
    runtimeDecoderInputObjectReplayFree: result.runtimeDecoderInputObjectReplayFree,
    runtimeDecoderInputObjectSettlementFree: result.runtimeDecoderInputObjectSettlementFree,
    runtimeDecoderInputObjectNonDecodable: result.runtimeDecoderInputObjectNonDecodable,
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
    unsanitizedRuntimeInputObjectRejected: true,
    receiptMaterialRuntimeInputRejected: true,
    actualDecoderInputRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
