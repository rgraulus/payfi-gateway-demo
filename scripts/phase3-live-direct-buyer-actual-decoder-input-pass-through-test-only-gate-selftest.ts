#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerActualDecoderInputObject,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  guardLiveDirectBuyerActualDecoderInputPassToDecoder,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
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

  const gate = openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(passToDecoderGuard);
  const result = validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(gate);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_pass_through_test_only_gate");
  assert.equal(result.status, "open_test_only");
  assert.equal(result.sourcePassToDecoderGuardContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT);
  assert.equal(result.passToDecoderGuardValidated, true);

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

  assert.equal(result.testOnlyGateRequired, true);
  assert.equal(result.testOnlyGatePresent, true);
  assert.equal(result.testOnlyGateSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionPassThroughAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.decoderPassThroughRecognizedAsFutureStep, true);
  assert.equal(result.decoderPassThroughEligible, true);
  assert.equal(result.decoderPassThroughAllowed, true);
  assert.equal(result.decoderPassThroughExecuted, false);
  assert.equal(result.decoderPassThroughStillNotExecuted, true);
  assert.equal(result.decoderPassThroughBlockLiftedForTestOnly, true);
  assert.equal(result.decoderPassThroughBlockReason, "test_only_gate_open_no_execution");
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
    () => openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...passToDecoderGuard,
      decoderPassThroughAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_blocked_decoder_pass_through/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      passToDecoderGuardValidated: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_validated_source_guard/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      actualDecoderInputObjectBuilt: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_validated_payment_required_bound_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      actualDecoderInputObjectReceiptMaterialFree: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_material_replay_settlement_free_non_decodable_object/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      testOnlyGateSatisfied: false,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_test_only_authority/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      decoderPassThroughExecuted: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_open_permission_without_execution/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      actualDecoderInputObjectPassedToDecoder: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate({
      ...result,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputPassThroughTestOnlyGate.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourcePassToDecoderGuardContract: result.sourcePassToDecoderGuardContract,
    sourceActualDecoderInputObjectContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
    passToDecoderGuardValidated: result.passToDecoderGuardValidated,
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
    testOnlyGateRequired: result.testOnlyGateRequired,
    testOnlyGatePresent: result.testOnlyGatePresent,
    testOnlyGateSatisfied: result.testOnlyGateSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionPassThroughAllowed: result.productionPassThroughAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    decoderPassThroughRecognizedAsFutureStep: result.decoderPassThroughRecognizedAsFutureStep,
    decoderPassThroughEligible: result.decoderPassThroughEligible,
    decoderPassThroughAllowed: result.decoderPassThroughAllowed,
    decoderPassThroughExecuted: result.decoderPassThroughExecuted,
    decoderPassThroughStillNotExecuted: result.decoderPassThroughStillNotExecuted,
    decoderPassThroughBlockLiftedForTestOnly: result.decoderPassThroughBlockLiftedForTestOnly,
    decoderPassThroughBlockReason: result.decoderPassThroughBlockReason,
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
    invalidSourceGuardRejected: true,
    invalidActualDecoderInputObjectRejected: true,
    receiptMaterialObjectRejected: true,
    missingTestOnlyGateRejected: true,
    productionEnablementRejected: true,
    passThroughExecutionRejected: true,
    actualDecoderInputObjectPassedToDecoderRejected: true,
    decoderInvocationRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
