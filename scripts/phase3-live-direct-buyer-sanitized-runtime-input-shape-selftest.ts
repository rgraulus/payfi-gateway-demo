#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT,
  LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerSanitizedRuntimeInputShape,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const guard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const gate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(guard);
  const dryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(gate);
  const shape = projectLiveDirectBuyerSanitizedRuntimeInputShape(dryRun);
  const result = validateLiveDirectBuyerSanitizedRuntimeInputShape(shape);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT);
  assert.equal(result.mode, "sanitized_runtime_input_shape_contract");
  assert.equal(result.status, "shape_contract_ready");
  assert.equal(result.sourceDryRunContract, LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT);
  assert.equal(result.dryRunValidated, true);
  assert.equal(result.dryRunObserved, true);
  assert.equal(result.dryRunAttemptObserved, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.runtimeInputShapeProjected, true);
  assert.equal(result.runtimeInputShapeValidated, true);
  assert.equal(result.runtimeInputShapeMetadataOnly, true);
  assert.equal(result.runtimeInputShapeSanitized, true);
  assert.equal(result.runtimeInputShapeBoundToPaymentRequired, true);
  assert.equal(result.runtimeInputShapeNonceBound, true);
  assert.equal(result.runtimeInputShapeResourceBound, true);
  assert.equal(result.runtimeInputShapeContractBound, true);
  assert.equal(result.runtimeInputShapeMerchantBound, true);
  assert.equal(result.runtimeInputShapePaymentTupleBound, true);
  assert.equal(result.runtimeInputShapeReceiptMaterialFree, true);
  assert.equal(result.runtimeInputShapeReplayFree, true);
  assert.equal(result.runtimeInputShapeSettlementFree, true);

  assert.equal(result.runtimeInputDescriptorPresent, true);
  assert.equal(result.runtimeInputDescriptorOnly, true);
  assert.equal(result.runtimeDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputReady, false);
  assert.equal(result.decoderInvocationAllowed, false);
  assert.equal(result.decoderInvocationAttempted, false);
  assert.equal(result.decoderInvoked, false);

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
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      runtimeInputShapeSanitized: false,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_requires_sanitized_payment_required_bound_shape/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      runtimeInputShapeReceiptMaterialFree: false,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_requires_material_replay_settlement_free_shape/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      runtimeDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_rejects_runtime_input_or_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerSanitizedRuntimeInputShape({
      ...shape,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_sanitized_runtime_input_shape_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerSanitizedRuntimeInputShape.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceDryRunContract: result.sourceDryRunContract,
    dryRunValidated: result.dryRunValidated,
    dryRunObserved: result.dryRunObserved,
    dryRunAttemptObserved: result.dryRunAttemptObserved,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    runtimeInputShapeProjected: result.runtimeInputShapeProjected,
    runtimeInputShapeValidated: result.runtimeInputShapeValidated,
    runtimeInputShapeMetadataOnly: result.runtimeInputShapeMetadataOnly,
    runtimeInputShapeSanitized: result.runtimeInputShapeSanitized,
    runtimeInputShapeBoundToPaymentRequired: result.runtimeInputShapeBoundToPaymentRequired,
    runtimeInputShapeNonceBound: result.runtimeInputShapeNonceBound,
    runtimeInputShapeResourceBound: result.runtimeInputShapeResourceBound,
    runtimeInputShapeContractBound: result.runtimeInputShapeContractBound,
    runtimeInputShapeMerchantBound: result.runtimeInputShapeMerchantBound,
    runtimeInputShapePaymentTupleBound: result.runtimeInputShapePaymentTupleBound,
    runtimeInputShapeReceiptMaterialFree: result.runtimeInputShapeReceiptMaterialFree,
    runtimeInputShapeReplayFree: result.runtimeInputShapeReplayFree,
    runtimeInputShapeSettlementFree: result.runtimeInputShapeSettlementFree,
    runtimeInputDescriptorPresent: result.runtimeInputDescriptorPresent,
    runtimeInputDescriptorOnly: result.runtimeInputDescriptorOnly,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
    actualDecoderInputReady: result.actualDecoderInputReady,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
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
    unsanitizedRuntimeInputShapeRejected: true,
    receiptMaterialShapeRejected: true,
    runtimeInputObjectRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
