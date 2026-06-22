#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT,
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
  returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
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
  const result = validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult(seamResult);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT);
  assert.equal(result.mode, "actual_decoder_input_non_decoded_seam_result");
  assert.equal(result.status, "non_decoded_seam_result_returned");
  assert.equal(result.sourceInvocationDryRunContract, LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT);
  assert.equal(result.invocationDryRunValidated, true);
  assert.equal(result.invocationObserved, true);
  assert.equal(result.adapterInvocationSeamEntered, true);
  assert.equal(result.adapterInvocationSeamExitedSafely, true);

  assert.equal(result.seamResultBuilt, true);
  assert.equal(result.seamResultObserved, true);
  assert.equal(result.seamResultReturnedFromSeam, true);
  assert.equal(result.seamResultRoute, "test_only_actual_decoder_input_non_decoded_result_descriptor");
  assert.equal(result.seamResultKind, "non_decoded_actual_decoder_input_seam_result");
  assert.equal(result.seamResultDecodeStatus, "not_decoded");
  assert.equal(result.seamResultMetadataOnly, true);
  assert.equal(result.seamResultSanitized, true);
  assert.equal(result.seamResultBoundToPaymentRequired, true);
  assert.equal(result.seamResultNonceBound, true);
  assert.equal(result.seamResultResourceBound, true);
  assert.equal(result.seamResultContractBound, true);
  assert.equal(result.seamResultMerchantBound, true);
  assert.equal(result.seamResultPaymentTupleBound, true);

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

  assert.equal(result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam, true);
  assert.equal(result.actualDecoderInputObjectPassedToRealDecoder, false);

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
    () => returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...invocation,
      adapterInvocationSeamExitedSafely: false,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_safe_adapter_invocation_seam/,
  );

  assert.throws(
    () => returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...invocation,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_real_decoder_invocation/,
  );

  assert.throws(
    () => returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...invocation,
      rawReceiptIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      invocationDryRunValidated: false,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_validated_safe_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      seamResultDecodeStatus: "decoded" as "not_decoded",
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_non_decoded_descriptor/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      seamResultSanitized: false,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_sanitized_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      seamResultContainsActualDecoderInputObject: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_embedded_inputs_or_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      actualDecoderInputObjectPassedToRealDecoder: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_test_only_actual_input_seam_without_real_decoder/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      decoderInvoked: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_real_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult({
      ...result,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerActualDecoderInputNonDecodedSeamResult.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceInvocationDryRunContract: result.sourceInvocationDryRunContract,
    invocationDryRunValidated: result.invocationDryRunValidated,
    invocationObserved: result.invocationObserved,
    adapterInvocationSeamEntered: result.adapterInvocationSeamEntered,
    adapterInvocationSeamExitedSafely: result.adapterInvocationSeamExitedSafely,
    seamResultBuilt: result.seamResultBuilt,
    seamResultObserved: result.seamResultObserved,
    seamResultReturnedFromSeam: result.seamResultReturnedFromSeam,
    seamResultRoute: result.seamResultRoute,
    seamResultKind: result.seamResultKind,
    seamResultDecodeStatus: result.seamResultDecodeStatus,
    seamResultMetadataOnly: result.seamResultMetadataOnly,
    seamResultSanitized: result.seamResultSanitized,
    seamResultBoundToPaymentRequired: result.seamResultBoundToPaymentRequired,
    seamResultNonceBound: result.seamResultNonceBound,
    seamResultResourceBound: result.seamResultResourceBound,
    seamResultContractBound: result.seamResultContractBound,
    seamResultMerchantBound: result.seamResultMerchantBound,
    seamResultPaymentTupleBound: result.seamResultPaymentTupleBound,
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
    actualDecoderInputObjectPassedToTestOnlyInvocationSeam: result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam,
    actualDecoderInputObjectPassedToRealDecoder: result.actualDecoderInputObjectPassedToRealDecoder,
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
    unsafeInvocationRejected: true,
    realDecoderInvocationRejected: true,
    receiptMaterialInvocationRejected: true,
    invalidInvocationRejected: true,
    decodedDescriptorRejected: true,
    unsanitizedDescriptorRejected: true,
    embeddedInputRejected: true,
    realDecoderRouteRejected: true,
    receiptMaterialRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
