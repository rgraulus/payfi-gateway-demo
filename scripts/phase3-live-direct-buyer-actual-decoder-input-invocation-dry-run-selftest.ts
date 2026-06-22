#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerActualDecoderInputObject,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  guardLiveDirectBuyerActualDecoderInputPassToDecoder,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerActualDecoderInputInvocationDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputInvocationDryRun,
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
  const passToDecoderGuard = guardLiveDirectBuyerActualDecoderInputPassToDecoder(input);
  const passThroughGate = openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(passToDecoderGuard);

  const invocation = observeLiveDirectBuyerActualDecoderInputInvocationDryRun(passThroughGate);
  const result = validateLiveDirectBuyerActualDecoderInputInvocationDryRun(invocation);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_invocation_test_only_dry_run");
  assert.equal(result.status, "dry_run_invocation_observed");
  assert.equal(result.sourcePassThroughTestOnlyGateContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT);
  assert.equal(result.passThroughTestOnlyGateValidated, true);
  assert.equal(result.testOnlyGateSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

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

  assert.equal(result.decoderPassThroughAllowed, true);
  assert.equal(result.decoderPassThroughExecuted, true);
  assert.equal(result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam, true);
  assert.equal(result.actualDecoderInputObjectPassedToRealDecoder, false);

  assert.equal(result.testOnlyInvocationRequired, true);
  assert.equal(result.testOnlyInvocationPresent, true);
  assert.equal(result.testOnlyInvocationSatisfied, true);
  assert.equal(result.testOnlyInvocationAllowed, true);
  assert.equal(result.testOnlyInvocationAttempted, true);
  assert.equal(result.testOnlyInvocationObserved, true);
  assert.equal(result.adapterInvocationSeamEntered, true);
  assert.equal(result.adapterInvocationSeamExitedSafely, true);
  assert.equal(result.adapterInvocationRoute, "test_only_actual_decoder_input_no_real_decode_stub");

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
  assert.equal(result.productionReleaseAllowed, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => observeLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...passThroughGate,
      decoderPassThroughAllowed: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_open_permission_without_execution/,
  );

  assert.throws(
    () => observeLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...passThroughGate,
      decoderPassThroughExecuted: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_open_permission_without_execution/,
  );

  assert.throws(
    () => observeLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...passThroughGate,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_decoder_invocation/,
  );

  assert.throws(
    () => observeLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...passThroughGate,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      passThroughTestOnlyGateValidated: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_validated_test_only_gate/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      actualDecoderInputObjectBuilt: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_payment_required_bound_actual_decoder_input_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      actualDecoderInputObjectReceiptMaterialFree: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_material_replay_settlement_free_non_decodable_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      actualDecoderInputObjectPassedToTestOnlyInvocationSeam: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_test_only_invocation_seam_entry_without_real_decoder/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      actualDecoderInputObjectPassedToRealDecoder: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_test_only_invocation_seam_entry_without_real_decoder/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      testOnlyInvocationObserved: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_test_only_invocation_observed/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      adapterInvocationSeamExitedSafely: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_safe_adapter_invocation_seam/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_real_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      rawReceiptIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputInvocationDryRun({
      ...result,
      decoderResultProduced: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputInvocationDryRun.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourcePassThroughTestOnlyGateContract: result.sourcePassThroughTestOnlyGateContract,
    sourceActualDecoderInputObjectContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
    passThroughTestOnlyGateValidated: result.passThroughTestOnlyGateValidated,
    testOnlyGateSatisfied: result.testOnlyGateSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
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
    decoderPassThroughAllowed: result.decoderPassThroughAllowed,
    decoderPassThroughExecuted: result.decoderPassThroughExecuted,
    actualDecoderInputObjectPassedToTestOnlyInvocationSeam: result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam,
    actualDecoderInputObjectPassedToRealDecoder: result.actualDecoderInputObjectPassedToRealDecoder,
    testOnlyInvocationRequired: result.testOnlyInvocationRequired,
    testOnlyInvocationPresent: result.testOnlyInvocationPresent,
    testOnlyInvocationSatisfied: result.testOnlyInvocationSatisfied,
    testOnlyInvocationAllowed: result.testOnlyInvocationAllowed,
    testOnlyInvocationAttempted: result.testOnlyInvocationAttempted,
    testOnlyInvocationObserved: result.testOnlyInvocationObserved,
    adapterInvocationSeamEntered: result.adapterInvocationSeamEntered,
    adapterInvocationSeamExitedSafely: result.adapterInvocationSeamExitedSafely,
    adapterInvocationRoute: result.adapterInvocationRoute,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
    realDecoderAdapterInvoked: result.realDecoderAdapterInvoked,
    realDecoderInvoked: result.realDecoderInvoked,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptMaterialIncluded: result.receiptMaterialIncluded,
    receiptJwsIncluded: result.receiptJwsIncluded,
    receiptPayloadIncluded: result.receiptPayloadIncluded,
    receiptBytesIncluded: result.receiptBytesIncluded,
    receiptObjectIncluded: result.receiptObjectIncluded,
    rawReceiptIncluded: result.rawReceiptIncluded,
    rawProofIncluded: result.rawProofIncluded,
    settlementFieldsIncluded: result.settlementFieldsIncluded,
    replayKeyIncluded: result.replayKeyIncluded,
    decodedReceiptProduced: result.decodedReceiptProduced,
    decodedReceiptVerified: result.decodedReceiptVerified,
    decoderResultProduced: result.decoderResultProduced,
    decoderResultReleaseConsumable: result.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: result.decoderResultConsumedByReleaseDecision,
    releaseDecisionMutatedByDecoderResult: result.releaseDecisionMutatedByDecoderResult,
    paymentResponseEmissionAllowed: result.paymentResponseEmissionAllowed,
    crpFulfillAllowed: result.crpFulfillAllowed,
    replayMutationAllowed: result.replayMutationAllowed,
    canonicalReleasePersistenceAllowed: result.canonicalReleasePersistenceAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    invalidSourceGateRejected: true,
    passThroughAlreadyExecutedRejected: true,
    sourceDecoderInvocationRejected: true,
    sourceReceiptMaterialRejected: true,
    invalidTestOnlyGateRejected: true,
    invalidActualDecoderInputObjectRejected: true,
    receiptMaterialObjectRejected: true,
    missingInvocationObservationRejected: true,
    unsafeSeamExitRejected: true,
    realDecoderInvocationRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
