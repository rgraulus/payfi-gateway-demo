#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT,
  LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT,
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
  openLiveDirectBuyerReceiptMaterialAcceptanceGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerReceiptMaterialAcceptanceGate,
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
  const seamResult = returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult(invocation);

  const gate = openLiveDirectBuyerReceiptMaterialAcceptanceGate(seamResult);
  const result = validateLiveDirectBuyerReceiptMaterialAcceptanceGate(gate);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT);
  assert.equal(result.mode, "receipt_material_acceptance_test_only_gate");
  assert.equal(result.status, "open_test_only");
  assert.equal(result.sourceNonDecodedSeamResultContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT);
  assert.equal(result.nonDecodedSeamResultValidated, true);
  assert.equal(result.receiptMaterialAcceptanceGateRequired, true);
  assert.equal(result.receiptMaterialAcceptanceGatePresent, true);
  assert.equal(result.receiptMaterialAcceptanceGateSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);
  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionReceiptMaterialAcceptanceAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.receiptMaterialAcceptanceRecognizedAsFutureStep, true);
  assert.equal(result.receiptMaterialAcceptanceEligible, true);
  assert.equal(result.receiptMaterialAcceptanceAllowed, true);
  assert.equal(result.receiptMaterialAccepted, false);
  assert.equal(result.receiptMaterialStillNotAccepted, true);
  assert.equal(result.receiptMaterialAcceptanceBlockLiftedForTestOnly, true);
  assert.equal(result.receiptMaterialAcceptanceBlockReason, "test_only_gate_open_no_receipt_material_accepted");

  assert.equal(result.seamResultBuilt, true);
  assert.equal(result.seamResultObserved, true);
  assert.equal(result.seamResultReturnedFromSeam, true);
  assert.equal(result.seamResultDecodeStatus, "not_decoded");
  assert.equal(result.seamResultMetadataOnly, true);
  assert.equal(result.seamResultSanitized, true);
  assert.equal(result.seamResultBoundToPaymentRequired, true);
  assert.equal(result.seamResultContainsActualDecoderInputObject, false);
  assert.equal(result.seamResultContainsRuntimeDecoderInputObject, false);
  assert.equal(result.seamResultContainsReceiptJws, false);
  assert.equal(result.seamResultContainsReceiptPayload, false);
  assert.equal(result.seamResultContainsReceiptBytes, false);
  assert.equal(result.seamResultContainsReceiptObject, false);
  assert.equal(result.seamResultContainsRawReceipt, false);
  assert.equal(result.seamResultContainsRawProof, false);
  assert.equal(result.seamResultContainsSettlementFields, false);
  assert.equal(result.seamResultContainsReplayKey, false);

  assert.equal(result.receiptJwsAcceptedForDecode, false);
  assert.equal(result.receiptPayloadAcceptedForDecode, false);
  assert.equal(result.receiptBytesAcceptedForDecode, false);
  assert.equal(result.receiptObjectAcceptedForDecode, false);
  assert.equal(result.rawReceiptAcceptedForDecode, false);
  assert.equal(result.rawProofAcceptedForDecode, false);
  assert.equal(result.settlementFieldsAcceptedForDecode, false);
  assert.equal(result.replayKeyAcceptedForDecode, false);
  assert.equal(result.receiptMaterialPassedToDecoder, false);

  assert.equal(result.actualDecoderInputObjectPassedToRealDecoder, false);
  assert.equal(result.decoderInvocationAllowed, false);
  assert.equal(result.decoderInvocationAttempted, false);
  assert.equal(result.decoderInvoked, false);
  assert.equal(result.realDecoderAdapterInvoked, false);
  assert.equal(result.realDecoderInvoked, false);

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
    () => openLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...seamResult,
      seamResultContainsReceiptJws: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_embedded_inputs_or_receipt_material/,
  );

  assert.throws(
    () => openLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...seamResult,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_real_decoder_invocation/,
  );

  assert.throws(
    () => openLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...seamResult,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_release_side_effects/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      receiptMaterialAcceptanceGateSatisfied: false,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_requires_test_only_gate_authority/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      productionReceiptMaterialAcceptanceAllowed: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      receiptMaterialAccepted: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_requires_open_permission_without_acceptance/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      seamResultContainsReceiptJws: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_embedded_inputs_or_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      receiptJwsAcceptedForDecode: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_receipt_material_acceptance_or_decode/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      decoderInvoked: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptMaterialAcceptanceGate({
      ...result,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerReceiptMaterialAcceptanceGate.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceNonDecodedSeamResultContract: result.sourceNonDecodedSeamResultContract,
    nonDecodedSeamResultValidated: result.nonDecodedSeamResultValidated,
    receiptMaterialAcceptanceGateRequired: result.receiptMaterialAcceptanceGateRequired,
    receiptMaterialAcceptanceGatePresent: result.receiptMaterialAcceptanceGatePresent,
    receiptMaterialAcceptanceGateSatisfied: result.receiptMaterialAcceptanceGateSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionReceiptMaterialAcceptanceAllowed: result.productionReceiptMaterialAcceptanceAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    receiptMaterialAcceptanceRecognizedAsFutureStep: result.receiptMaterialAcceptanceRecognizedAsFutureStep,
    receiptMaterialAcceptanceEligible: result.receiptMaterialAcceptanceEligible,
    receiptMaterialAcceptanceAllowed: result.receiptMaterialAcceptanceAllowed,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptMaterialStillNotAccepted: result.receiptMaterialStillNotAccepted,
    receiptMaterialAcceptanceBlockLiftedForTestOnly: result.receiptMaterialAcceptanceBlockLiftedForTestOnly,
    receiptMaterialAcceptanceBlockReason: result.receiptMaterialAcceptanceBlockReason,
    seamResultBuilt: result.seamResultBuilt,
    seamResultObserved: result.seamResultObserved,
    seamResultReturnedFromSeam: result.seamResultReturnedFromSeam,
    seamResultDecodeStatus: result.seamResultDecodeStatus,
    seamResultMetadataOnly: result.seamResultMetadataOnly,
    seamResultSanitized: result.seamResultSanitized,
    seamResultBoundToPaymentRequired: result.seamResultBoundToPaymentRequired,
    seamResultContainsActualDecoderInputObject: result.seamResultContainsActualDecoderInputObject,
    seamResultContainsRuntimeDecoderInputObject: result.seamResultContainsRuntimeDecoderInputObject,
    seamResultContainsReceiptJws: result.seamResultContainsReceiptJws,
    seamResultContainsReceiptPayload: result.seamResultContainsReceiptPayload,
    seamResultContainsReceiptBytes: result.seamResultContainsReceiptBytes,
    seamResultContainsReceiptObject: result.seamResultContainsReceiptObject,
    seamResultContainsRawReceipt: result.seamResultContainsRawReceipt,
    seamResultContainsRawProof: result.seamResultContainsRawProof,
    seamResultContainsSettlementFields: result.seamResultContainsSettlementFields,
    seamResultContainsReplayKey: result.seamResultContainsReplayKey,
    receiptJwsAcceptedForDecode: result.receiptJwsAcceptedForDecode,
    receiptPayloadAcceptedForDecode: result.receiptPayloadAcceptedForDecode,
    receiptBytesAcceptedForDecode: result.receiptBytesAcceptedForDecode,
    receiptObjectAcceptedForDecode: result.receiptObjectAcceptedForDecode,
    rawReceiptAcceptedForDecode: result.rawReceiptAcceptedForDecode,
    rawProofAcceptedForDecode: result.rawProofAcceptedForDecode,
    settlementFieldsAcceptedForDecode: result.settlementFieldsAcceptedForDecode,
    replayKeyAcceptedForDecode: result.replayKeyAcceptedForDecode,
    receiptMaterialPassedToDecoder: result.receiptMaterialPassedToDecoder,
    actualDecoderInputObjectPassedToRealDecoder: result.actualDecoderInputObjectPassedToRealDecoder,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
    realDecoderAdapterInvoked: result.realDecoderAdapterInvoked,
    realDecoderInvoked: result.realDecoderInvoked,
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
    embeddedReceiptMaterialRejected: true,
    decoderInvocationRejected: true,
    releaseSideEffectsRejected: true,
    missingGateAuthorityRejected: true,
    productionEnablementRejected: true,
    receiptMaterialAcceptanceRejected: true,
    receiptMaterialDecodeAcceptanceRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
