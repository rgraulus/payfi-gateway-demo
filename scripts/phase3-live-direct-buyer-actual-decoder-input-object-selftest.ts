#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
  LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerActualDecoderInputObject,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputObject,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const constructionGuard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const runtimeGate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(constructionGuard);
  const runtimeDryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(runtimeGate);
  const runtimeShape = projectLiveDirectBuyerSanitizedRuntimeInputShape(runtimeDryRun);
  const runtimeInput = constructLiveDirectBuyerTestOnlyRuntimeInputObject(runtimeShape);
  const actualDecoderInputGuard = guardLiveDirectBuyerActualDecoderInputConstruction(runtimeInput);
  const actualDecoderInputGate = openLiveDirectBuyerActualDecoderInputTestOnlyGate(actualDecoderInputGuard);
  const dryRun = observeLiveDirectBuyerActualDecoderInputDryRun(actualDecoderInputGate);
  const shape = projectLiveDirectBuyerSanitizedActualDecoderInputShape(dryRun);

  const input = constructLiveDirectBuyerActualDecoderInputObject(shape);
  const result = validateLiveDirectBuyerActualDecoderInputObject(input);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_object_construction");
  assert.equal(result.status, "actual_decoder_input_object_constructed_test_only");
  assert.equal(result.sourceShapeContract, LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT);

  assert.equal(result.shapeValidated, true);
  assert.equal(result.shapeProjected, true);
  assert.equal(result.shapeMetadataOnly, true);
  assert.equal(result.shapeSanitized, true);
  assert.equal(result.shapeBoundToPaymentRequired, true);
  assert.equal(result.shapeNonceBound, true);
  assert.equal(result.shapeResourceBound, true);
  assert.equal(result.shapeContractBound, true);
  assert.equal(result.shapeMerchantBound, true);
  assert.equal(result.shapePaymentTupleBound, true);

  assert.equal(result.testOnlyConstructionRequired, true);
  assert.equal(result.testOnlyConstructionPresent, true);
  assert.equal(result.testOnlyConstructionSatisfied, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.actualDecoderInputObjectKind, "test_only_sanitized_actual_decoder_input_object");
  assert.equal(result.actualDecoderInputObjectBuilt, true);
  assert.equal(result.actualDecoderInputObjectReady, true);
  assert.equal(result.actualDecoderInputObjectMetadataOnly, true);
  assert.equal(result.actualDecoderInputObjectSanitized, true);
  assert.equal(result.actualDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(result.actualDecoderInputObjectNonceBound, true);
  assert.equal(result.actualDecoderInputObjectResourceBound, true);
  assert.equal(result.actualDecoderInputObjectContractBound, true);
  assert.equal(result.actualDecoderInputObjectMerchantBound, true);
  assert.equal(result.actualDecoderInputObjectPaymentTupleBound, true);
  assert.equal(result.actualDecoderInputObjectReceiptMaterialFree, true);
  assert.equal(result.actualDecoderInputObjectReplayFree, true);
  assert.equal(result.actualDecoderInputObjectSettlementFree, true);
  assert.equal(result.actualDecoderInputObjectNonDecodable, true);

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
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_actual_decoder_input_object_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      shapeMetadataOnly: false,
    }),
    /live_direct_buyer_actual_decoder_input_object_requires_validated_payment_required_bound_shape/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      testOnlyConstructionSatisfied: false,
    }),
    /live_direct_buyer_actual_decoder_input_object_requires_test_only_construction/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      actualDecoderInputObjectSanitized: false,
    }),
    /live_direct_buyer_actual_decoder_input_object_requires_sanitized_payment_required_bound_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      actualDecoderInputObjectReceiptMaterialFree: false,
    }),
    /live_direct_buyer_actual_decoder_input_object_requires_material_replay_settlement_free_non_decodable_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      actualDecoderInputObjectPassedToDecoder: true,
    }),
    /live_direct_buyer_actual_decoder_input_object_rejects_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_object_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputObject({
      ...result,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_object_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputObject.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceShapeContract: result.sourceShapeContract,
    shapeValidated: result.shapeValidated,
    shapeProjected: result.shapeProjected,
    shapeMetadataOnly: result.shapeMetadataOnly,
    shapeSanitized: result.shapeSanitized,
    shapeBoundToPaymentRequired: result.shapeBoundToPaymentRequired,
    shapeNonceBound: result.shapeNonceBound,
    shapeResourceBound: result.shapeResourceBound,
    shapeContractBound: result.shapeContractBound,
    shapeMerchantBound: result.shapeMerchantBound,
    shapePaymentTupleBound: result.shapePaymentTupleBound,
    testOnlyConstructionRequired: result.testOnlyConstructionRequired,
    testOnlyConstructionPresent: result.testOnlyConstructionPresent,
    testOnlyConstructionSatisfied: result.testOnlyConstructionSatisfied,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    actualDecoderInputObjectKind: result.actualDecoderInputObjectKind,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
    actualDecoderInputObjectReady: result.actualDecoderInputObjectReady,
    actualDecoderInputObjectMetadataOnly: result.actualDecoderInputObjectMetadataOnly,
    actualDecoderInputObjectSanitized: result.actualDecoderInputObjectSanitized,
    actualDecoderInputObjectBoundToPaymentRequired: result.actualDecoderInputObjectBoundToPaymentRequired,
    actualDecoderInputObjectNonceBound: result.actualDecoderInputObjectNonceBound,
    actualDecoderInputObjectResourceBound: result.actualDecoderInputObjectResourceBound,
    actualDecoderInputObjectContractBound: result.actualDecoderInputObjectContractBound,
    actualDecoderInputObjectMerchantBound: result.actualDecoderInputObjectMerchantBound,
    actualDecoderInputObjectPaymentTupleBound: result.actualDecoderInputObjectPaymentTupleBound,
    actualDecoderInputObjectReceiptMaterialFree: result.actualDecoderInputObjectReceiptMaterialFree,
    actualDecoderInputObjectReplayFree: result.actualDecoderInputObjectReplayFree,
    actualDecoderInputObjectSettlementFree: result.actualDecoderInputObjectSettlementFree,
    actualDecoderInputObjectNonDecodable: result.actualDecoderInputObjectNonDecodable,
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
    invalidShapeRejected: true,
    missingTestOnlyConstructionRejected: true,
    unsanitizedActualDecoderInputObjectRejected: true,
    receiptMaterialObjectRejected: true,
    decoderPassThroughRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
