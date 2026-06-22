#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT,
  LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputGuard,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const constructionGuard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const gate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(constructionGuard);
  const dryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(gate);
  const shape = projectLiveDirectBuyerSanitizedRuntimeInputShape(dryRun);
  const runtimeInput = constructLiveDirectBuyerTestOnlyRuntimeInputObject(shape);
  const guard = guardLiveDirectBuyerActualDecoderInputConstruction(runtimeInput);
  const result = validateLiveDirectBuyerActualDecoderInputGuard(guard);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_guard");
  assert.equal(result.status, "actual_decoder_input_blocked");
  assert.equal(result.sourceRuntimeInputObjectContract, LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT);

  assert.equal(result.runtimeInputObjectValidated, true);
  assert.equal(result.runtimeInputObjectPresent, true);
  assert.equal(result.runtimeInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectBuilt, true);
  assert.equal(result.runtimeDecoderInputObjectMetadataOnly, true);
  assert.equal(result.runtimeDecoderInputObjectSanitized, true);
  assert.equal(result.runtimeDecoderInputObjectBoundToPaymentRequired, true);
  assert.equal(result.runtimeDecoderInputObjectNonDecodable, true);

  assert.equal(result.actualDecoderInputConstructionRecognizedAsFutureStep, true);
  assert.equal(result.actualDecoderInputConstructionAttempted, true);
  assert.equal(result.actualDecoderInputConstructionAllowed, false);
  assert.equal(result.actualDecoderInputConstructionBlocked, true);
  assert.equal(result.actualDecoderInputConstructionBlockReason, "actual_decoder_input_construction_disabled");

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
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      actualDecoderInputConstructionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_guard_requires_blocked_actual_decoder_input_construction/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      actualDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_actual_decoder_input_guard_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_guard_rejects_actual_decoder_input_or_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_guard_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      nonceBound: false,
    }),
    /live_direct_buyer_actual_decoder_input_guard_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputGuard({
      ...guard,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_guard_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputGuard.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceRuntimeInputObjectContract: result.sourceRuntimeInputObjectContract,
    runtimeInputObjectValidated: result.runtimeInputObjectValidated,
    runtimeInputObjectPresent: result.runtimeInputObjectPresent,
    runtimeInputObjectBuilt: result.runtimeInputObjectBuilt,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    runtimeDecoderInputObjectMetadataOnly: result.runtimeDecoderInputObjectMetadataOnly,
    runtimeDecoderInputObjectSanitized: result.runtimeDecoderInputObjectSanitized,
    runtimeDecoderInputObjectBoundToPaymentRequired: result.runtimeDecoderInputObjectBoundToPaymentRequired,
    runtimeDecoderInputObjectNonDecodable: result.runtimeDecoderInputObjectNonDecodable,
    actualDecoderInputConstructionRecognizedAsFutureStep: result.actualDecoderInputConstructionRecognizedAsFutureStep,
    actualDecoderInputConstructionAttempted: result.actualDecoderInputConstructionAttempted,
    actualDecoderInputConstructionAllowed: result.actualDecoderInputConstructionAllowed,
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
    actualDecoderInputConstructionAllowedRejected: true,
    actualDecoderInputObjectRejected: true,
    decoderInvocationRejected: true,
    receiptMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
