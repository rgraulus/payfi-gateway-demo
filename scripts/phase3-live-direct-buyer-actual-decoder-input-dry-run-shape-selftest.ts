#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT,
  LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputDryRun,
  validateLiveDirectBuyerSanitizedActualDecoderInputShape,
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
  const dryRunResult = validateLiveDirectBuyerActualDecoderInputDryRun(dryRun);

  assert.equal(dryRunResult.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT);
  assert.equal(dryRunResult.mode, "actual_decoder_input_test_only_dry_run");
  assert.equal(dryRunResult.status, "dry_run_observed");
  assert.equal(dryRunResult.sourceTestOnlyGateContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT);
  assert.equal(dryRunResult.testOnlyGateValidated, true);
  assert.equal(dryRunResult.testOnlyGateSatisfied, true);
  assert.equal(dryRunResult.testOnlyAuthorityOpened, true);
  assert.equal(dryRunResult.dryRunRequired, true);
  assert.equal(dryRunResult.dryRunPresent, true);
  assert.equal(dryRunResult.dryRunSatisfied, true);
  assert.equal(dryRunResult.dryRunAttemptObserved, true);

  assert.equal(dryRunResult.productionEnablementPresent, false);
  assert.equal(dryRunResult.productionEnablementAccepted, false);
  assert.equal(dryRunResult.productionConstructionAllowed, false);
  assert.equal(dryRunResult.productionReleaseAllowed, false);

  assert.equal(dryRunResult.runtimeInputObjectPresent, true);
  assert.equal(dryRunResult.runtimeInputObjectBuilt, true);
  assert.equal(dryRunResult.runtimeDecoderInputObjectBuilt, true);
  assert.equal(dryRunResult.runtimeDecoderInputObjectMetadataOnly, true);
  assert.equal(dryRunResult.runtimeDecoderInputObjectSanitized, true);
  assert.equal(dryRunResult.runtimeDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(dryRunResult.runtimeDecoderInputObjectNonDecodable, true);

  assert.equal(dryRunResult.actualDecoderInputDryRunOnly, true);
  assert.equal(dryRunResult.actualDecoderInputConstructionObserved, true);
  assert.equal(dryRunResult.actualDecoderInputConstructionAllowed, false);
  assert.equal(dryRunResult.actualDecoderInputConstructionAttempted, true);
  assert.equal(dryRunResult.actualDecoderInputConstructionStillDeferred, true);
  assert.equal(dryRunResult.actualDecoderInputConstructionBlocked, true);
  assert.equal(dryRunResult.actualDecoderInputConstructionBlockReason, "actual_decoder_input_construction_dry_run_only");
  assert.equal(dryRunResult.sanitizedActualDecoderInputShapeProjected, false);
  assert.equal(dryRunResult.sanitizedActualDecoderInputShapeValidated, false);

  assert.equal(dryRunResult.actualDecoderInputObjectBuilt, false);
  assert.equal(dryRunResult.actualDecoderInputObjectReady, false);
  assert.equal(dryRunResult.actualDecoderInputObjectPassedToDecoder, false);
  assert.equal(dryRunResult.decoderInvocationAllowed, false);
  assert.equal(dryRunResult.decoderInvocationAttempted, false);
  assert.equal(dryRunResult.decoderInvoked, false);
  assert.equal(dryRunResult.realDecoderAdapterInvoked, false);
  assert.equal(dryRunResult.realDecoderInvoked, false);

  assert.equal(dryRunResult.receiptMaterialAccepted, false);
  assert.equal(dryRunResult.receiptMaterialIncluded, false);
  assert.equal(dryRunResult.receiptJwsIncluded, false);
  assert.equal(dryRunResult.receiptPayloadIncluded, false);
  assert.equal(dryRunResult.rawReceiptIncluded, false);
  assert.equal(dryRunResult.rawProofIncluded, false);

  assert.equal(dryRunResult.paymentRequiredContextBound, true);
  assert.equal(dryRunResult.nonceBound, true);
  assert.equal(dryRunResult.resourceBound, true);
  assert.equal(dryRunResult.contractBound, true);
  assert.equal(dryRunResult.merchantBound, true);
  assert.equal(dryRunResult.paymentTupleBound, true);

  assert.equal(dryRunResult.decodedReceiptProduced, false);
  assert.equal(dryRunResult.decoderResultProduced, false);
  assert.equal(dryRunResult.decoderResultReleaseConsumable, false);
  assert.equal(dryRunResult.decoderResultConsumedByReleaseDecision, false);
  assert.equal(dryRunResult.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(dryRunResult.paymentResponseEmissionAllowed, false);
  assert.equal(dryRunResult.crpFulfillAllowed, false);
  assert.equal(dryRunResult.replayMutationAllowed, false);
  assert.equal(dryRunResult.canonicalReleasePersistenceAllowed, false);
  assert.equal(dryRunResult.sideEffectFree, true);

  const shape = projectLiveDirectBuyerSanitizedActualDecoderInputShape(dryRunResult);
  const shapeResult = validateLiveDirectBuyerSanitizedActualDecoderInputShape(shape);

  assert.equal(shapeResult.contract, LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT);
  assert.equal(shapeResult.mode, "sanitized_actual_decoder_input_shape_contract");
  assert.equal(shapeResult.status, "shape_contract_ready");
  assert.equal(shapeResult.sourceDryRunContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT);
  assert.equal(shapeResult.dryRunValidated, true);
  assert.equal(shapeResult.dryRunObserved, true);
  assert.equal(shapeResult.dryRunAttemptObserved, true);
  assert.equal(shapeResult.testOnlyAuthorityOpened, true);

  assert.equal(shapeResult.productionEnablementPresent, false);
  assert.equal(shapeResult.productionEnablementAccepted, false);
  assert.equal(shapeResult.productionConstructionAllowed, false);
  assert.equal(shapeResult.productionReleaseAllowed, false);

  assert.equal(shapeResult.runtimeInputObjectPresent, true);
  assert.equal(shapeResult.runtimeInputObjectBuilt, true);
  assert.equal(shapeResult.runtimeDecoderInputObjectBuilt, true);
  assert.equal(shapeResult.runtimeDecoderInputObjectMetadataOnly, true);
  assert.equal(shapeResult.runtimeDecoderInputObjectSanitized, true);
  assert.equal(shapeResult.runtimeDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(shapeResult.runtimeDecoderInputObjectNonDecodable, true);

  assert.equal(shapeResult.actualDecoderInputShapeProjected, true);
  assert.equal(shapeResult.actualDecoderInputShapeValidated, true);
  assert.equal(shapeResult.actualDecoderInputShapeMetadataOnly, true);
  assert.equal(shapeResult.actualDecoderInputShapeSanitized, true);
  assert.equal(shapeResult.actualDecoderInputShapeBoundToPaymentRequired, true);
  assert.equal(shapeResult.actualDecoderInputShapeNonceBound, true);
  assert.equal(shapeResult.actualDecoderInputShapeResourceBound, true);
  assert.equal(shapeResult.actualDecoderInputShapeContractBound, true);
  assert.equal(shapeResult.actualDecoderInputShapeMerchantBound, true);
  assert.equal(shapeResult.actualDecoderInputShapePaymentTupleBound, true);
  assert.equal(shapeResult.actualDecoderInputShapeReceiptMaterialFree, true);
  assert.equal(shapeResult.actualDecoderInputShapeReplayFree, true);
  assert.equal(shapeResult.actualDecoderInputShapeSettlementFree, true);
  assert.equal(shapeResult.actualDecoderInputShapeNonDecodable, true);

  assert.equal(shapeResult.actualDecoderInputObjectBuilt, false);
  assert.equal(shapeResult.actualDecoderInputObjectReady, false);
  assert.equal(shapeResult.actualDecoderInputObjectPassedToDecoder, false);
  assert.equal(shapeResult.decoderInvocationAllowed, false);
  assert.equal(shapeResult.decoderInvocationAttempted, false);
  assert.equal(shapeResult.decoderInvoked, false);
  assert.equal(shapeResult.realDecoderAdapterInvoked, false);
  assert.equal(shapeResult.realDecoderInvoked, false);

  assert.equal(shapeResult.receiptMaterialAccepted, false);
  assert.equal(shapeResult.receiptMaterialIncluded, false);
  assert.equal(shapeResult.receiptJwsIncluded, false);
  assert.equal(shapeResult.receiptPayloadIncluded, false);
  assert.equal(shapeResult.rawReceiptIncluded, false);
  assert.equal(shapeResult.rawProofIncluded, false);

  assert.equal(shapeResult.decodedReceiptProduced, false);
  assert.equal(shapeResult.decoderResultProduced, false);
  assert.equal(shapeResult.decoderResultReleaseConsumable, false);
  assert.equal(shapeResult.decoderResultConsumedByReleaseDecision, false);
  assert.equal(shapeResult.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(shapeResult.paymentResponseEmissionAllowed, false);
  assert.equal(shapeResult.crpFulfillAllowed, false);
  assert.equal(shapeResult.replayMutationAllowed, false);
  assert.equal(shapeResult.canonicalReleasePersistenceAllowed, false);
  assert.equal(shapeResult.sideEffectFree, true);

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      sanitizedActualDecoderInputShapeProjected: true,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_rejects_shape_projection_inside_dry_run/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      actualDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      nonceBound: false,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputDryRun({
      ...dryRunResult,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_dry_run_rejects_release_side_effects/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      actualDecoderInputShapeMetadataOnly: false,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_requires_sanitized_payment_required_bound_shape/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      actualDecoderInputShapeReceiptMaterialFree: false,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_requires_non_decodable_material_replay_settlement_free_shape/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      actualDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedActualDecoderInputShape({
      ...shapeResult,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputDryRunShape.selftest.v1",
    dryRunContract: dryRunResult.contract,
    dryRunMode: dryRunResult.mode,
    dryRunStatus: dryRunResult.status,
    sourceTestOnlyGateContract: dryRunResult.sourceTestOnlyGateContract,
    testOnlyGateValidated: dryRunResult.testOnlyGateValidated,
    testOnlyGateSatisfied: dryRunResult.testOnlyGateSatisfied,
    testOnlyAuthorityOpened: dryRunResult.testOnlyAuthorityOpened,
    dryRunRequired: dryRunResult.dryRunRequired,
    dryRunPresent: dryRunResult.dryRunPresent,
    dryRunSatisfied: dryRunResult.dryRunSatisfied,
    dryRunAttemptObserved: dryRunResult.dryRunAttemptObserved,
    actualDecoderInputDryRunOnly: dryRunResult.actualDecoderInputDryRunOnly,
    actualDecoderInputConstructionObserved: dryRunResult.actualDecoderInputConstructionObserved,
    actualDecoderInputConstructionAllowed: dryRunResult.actualDecoderInputConstructionAllowed,
    actualDecoderInputConstructionAttempted: dryRunResult.actualDecoderInputConstructionAttempted,
    actualDecoderInputConstructionStillDeferred: dryRunResult.actualDecoderInputConstructionStillDeferred,
    actualDecoderInputConstructionBlocked: dryRunResult.actualDecoderInputConstructionBlocked,
    actualDecoderInputConstructionBlockReason: dryRunResult.actualDecoderInputConstructionBlockReason,
    dryRunShapeProjected: dryRunResult.sanitizedActualDecoderInputShapeProjected,
    dryRunShapeValidated: dryRunResult.sanitizedActualDecoderInputShapeValidated,
    shapeContract: shapeResult.contract,
    shapeMode: shapeResult.mode,
    shapeStatus: shapeResult.status,
    shapeSourceDryRunContract: shapeResult.sourceDryRunContract,
    shapeProjected: shapeResult.actualDecoderInputShapeProjected,
    shapeValidated: shapeResult.actualDecoderInputShapeValidated,
    shapeMetadataOnly: shapeResult.actualDecoderInputShapeMetadataOnly,
    shapeSanitized: shapeResult.actualDecoderInputShapeSanitized,
    shapeBoundToPaymentRequired: shapeResult.actualDecoderInputShapeBoundToPaymentRequired,
    shapeNonceBound: shapeResult.actualDecoderInputShapeNonceBound,
    shapeResourceBound: shapeResult.actualDecoderInputShapeResourceBound,
    shapeContractBound: shapeResult.actualDecoderInputShapeContractBound,
    shapeMerchantBound: shapeResult.actualDecoderInputShapeMerchantBound,
    shapePaymentTupleBound: shapeResult.actualDecoderInputShapePaymentTupleBound,
    shapeReceiptMaterialFree: shapeResult.actualDecoderInputShapeReceiptMaterialFree,
    shapeReplayFree: shapeResult.actualDecoderInputShapeReplayFree,
    shapeSettlementFree: shapeResult.actualDecoderInputShapeSettlementFree,
    shapeNonDecodable: shapeResult.actualDecoderInputShapeNonDecodable,
    productionEnablementPresent: shapeResult.productionEnablementPresent,
    productionEnablementAccepted: shapeResult.productionEnablementAccepted,
    productionConstructionAllowed: shapeResult.productionConstructionAllowed,
    productionReleaseAllowed: shapeResult.productionReleaseAllowed,
    runtimeInputObjectPresent: shapeResult.runtimeInputObjectPresent,
    runtimeInputObjectBuilt: shapeResult.runtimeInputObjectBuilt,
    runtimeDecoderInputObjectBuilt: shapeResult.runtimeDecoderInputObjectBuilt,
    actualDecoderInputObjectBuilt: shapeResult.actualDecoderInputObjectBuilt,
    actualDecoderInputObjectReady: shapeResult.actualDecoderInputObjectReady,
    actualDecoderInputObjectPassedToDecoder: shapeResult.actualDecoderInputObjectPassedToDecoder,
    decoderInvocationAllowed: shapeResult.decoderInvocationAllowed,
    decoderInvocationAttempted: shapeResult.decoderInvocationAttempted,
    decoderInvoked: shapeResult.decoderInvoked,
    realDecoderAdapterInvoked: shapeResult.realDecoderAdapterInvoked,
    realDecoderInvoked: shapeResult.realDecoderInvoked,
    receiptMaterialAccepted: shapeResult.receiptMaterialAccepted,
    receiptMaterialIncluded: shapeResult.receiptMaterialIncluded,
    receiptJwsIncluded: shapeResult.receiptJwsIncluded,
    receiptPayloadIncluded: shapeResult.receiptPayloadIncluded,
    rawReceiptIncluded: shapeResult.rawReceiptIncluded,
    rawProofIncluded: shapeResult.rawProofIncluded,
    decodedReceiptProduced: shapeResult.decodedReceiptProduced,
    decoderResultProduced: shapeResult.decoderResultProduced,
    decoderResultReleaseConsumable: shapeResult.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: shapeResult.decoderResultConsumedByReleaseDecision,
    releaseDecisionMutatedByDecoderResult: shapeResult.releaseDecisionMutatedByDecoderResult,
    paymentResponseEmissionAllowed: shapeResult.paymentResponseEmissionAllowed,
    crpFulfillAllowed: shapeResult.crpFulfillAllowed,
    replayMutationAllowed: shapeResult.replayMutationAllowed,
    canonicalReleasePersistenceAllowed: shapeResult.canonicalReleasePersistenceAllowed,
    dryRunProductionEnablementRejected: true,
    dryRunShapeProjectionRejectedInsideDryRun: true,
    dryRunActualDecoderInputObjectRejected: true,
    dryRunReceiptMaterialRejected: true,
    dryRunMissingPaymentRequiredBindingRejected: true,
    dryRunReleaseSideEffectsRejected: true,
    shapeProductionEnablementRejected: true,
    unsanitizedActualDecoderInputShapeRejected: true,
    receiptMaterialShapeRejected: true,
    shapeActualDecoderInputObjectRejected: true,
    shapeReceiptMaterialRejected: true,
    shapeReleaseSideEffectsRejected: true,
    sideEffectFree: shapeResult.sideEffectFree,
  }, null, 2));
}

main();
