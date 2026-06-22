#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerActualDecoderInputObject,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  guardLiveDirectBuyerActualDecoderInputPassToDecoder,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard,
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

  const guard = guardLiveDirectBuyerActualDecoderInputPassToDecoder(input);
  const result = validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard(guard);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_pass_to_decoder_guard");
  assert.equal(result.status, "decoder_pass_through_blocked");
  assert.equal(result.sourceActualDecoderInputObjectContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT);

  assert.equal(result.actualDecoderInputObjectValidated, true);
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

  assert.equal(result.decoderPassThroughRecognizedAsFutureStep, true);
  assert.equal(result.actualDecoderInputObjectPassedToDecoder, false);
  assert.equal(result.decoderPassThroughAllowed, false);
  assert.equal(result.decoderPassThroughAttempted, true);
  assert.equal(result.decoderPassThroughBlocked, true);
  assert.equal(result.decoderPassThroughBlockReason, "actual_decoder_input_pass_to_decoder_disabled");

  assert.equal(result.decoderInvocationAllowed, false);
  assert.equal(result.decoderInvocationAttempted, false);
  assert.equal(result.decoderInvoked, false);
  assert.equal(result.realDecoderAdapterInvoked, false);
  assert.equal(result.realDecoderInvoked, false);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionDecoderPassThroughAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

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
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      actualDecoderInputObjectBuilt: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_validated_payment_required_bound_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      actualDecoderInputObjectReceiptMaterialFree: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_material_replay_settlement_free_non_decodable_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      actualDecoderInputObjectPassedToDecoder: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_blocked_decoder_pass_through/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      decoderPassThroughAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_blocked_decoder_pass_through/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard({
      ...result,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputPassToDecoderGuard.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceActualDecoderInputObjectContract: result.sourceActualDecoderInputObjectContract,
    actualDecoderInputObjectValidated: result.actualDecoderInputObjectValidated,
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
    decoderPassThroughRecognizedAsFutureStep: result.decoderPassThroughRecognizedAsFutureStep,
    actualDecoderInputObjectPassedToDecoder: result.actualDecoderInputObjectPassedToDecoder,
    decoderPassThroughAllowed: result.decoderPassThroughAllowed,
    decoderPassThroughAttempted: result.decoderPassThroughAttempted,
    decoderPassThroughBlocked: result.decoderPassThroughBlocked,
    decoderPassThroughBlockReason: result.decoderPassThroughBlockReason,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
    realDecoderAdapterInvoked: result.realDecoderAdapterInvoked,
    realDecoderInvoked: result.realDecoderInvoked,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionDecoderPassThroughAllowed: result.productionDecoderPassThroughAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
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
    invalidActualDecoderInputObjectRejected: true,
    receiptMaterialObjectRejected: true,
    decoderPassThroughRejected: true,
    decoderPassThroughAllowedRejected: true,
    decoderInvocationRejected: true,
    productionEnablementRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
