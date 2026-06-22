#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  constructLiveDirectBuyerActualDecoderInputObject,
  constructLiveDirectBuyerTestOnlyRuntimeInputObject,
  guardLiveDirectBuyerActualDecoderInputConstruction,
  guardLiveDirectBuyerActualDecoderInputPassToDecoder,
  invokeLiveDirectBuyerTestOnlyRealDecoder,
  observeLiveDirectBuyerActualDecoderInputDryRun,
  observeLiveDirectBuyerActualDecoderInputInvocationDryRun,
  observeLiveDirectBuyerDecodedResultConsumptionDryRun,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerReceiptMaterialAcceptanceGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerDecodedResultConsumptionDryRun,
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
  const decoderInvocation = invokeLiveDirectBuyerTestOnlyRealDecoder(gate);

  const consumptionDryRun = observeLiveDirectBuyerDecodedResultConsumptionDryRun(decoderInvocation);
  const result = validateLiveDirectBuyerDecodedResultConsumptionDryRun(consumptionDryRun);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT);
  assert.equal(result.mode, "decoded_result_consumption_dry_run");
  assert.equal(result.status, "dry_run_consumption_observed");
  assert.equal(result.sourceTestOnlyRealDecoderInvocationContract, LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT);
  assert.equal(result.sourceDecoderInvocationValidated, true);
  assert.equal(result.decodedResultConsumptionDryRunRequired, true);
  assert.equal(result.decodedResultConsumptionDryRunPresent, true);
  assert.equal(result.decodedResultConsumptionDryRunObserved, true);
  assert.equal(result.testOnlyAuthorityOpened, true);
  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.decoderFixtureFunctionCalled, true);
  assert.equal(result.decoderFixtureResultKind, "test_only_sanitized_decoder_fixture_result");
  assert.equal(result.decodedReceiptProduced, true);
  assert.equal(result.decodedReceiptVerified, true);
  assert.equal(result.decoderResultProduced, true);
  assert.equal(result.decoderResultSanitized, true);
  assert.equal(result.decoderResultMetadataOnly, true);
  assert.equal(result.decoderResultFixtureOnly, true);

  assert.equal(result.decoderResultObservedByReleaseDecisionDryRun, true);
  assert.equal(result.releaseDecisionDryRunObserved, true);
  assert.equal(result.releaseDecisionDryRunMode, "observe_decoded_result_without_mutation");
  assert.equal(result.decodedResultConsumptionAttempted, true);
  assert.equal(result.decodedResultConsumptionObserved, true);
  assert.equal(result.decodedResultConsumptionDryRunOnly, true);
  assert.equal(result.decodedResultReleaseEligibilityEvaluated, true);
  assert.equal(result.decodedResultReleaseEligibility, "not_release_consumable_dry_run_only");

  assert.equal(result.decoderResultReleaseConsumable, false);
  assert.equal(result.decoderResultConsumedByReleaseDecision, false);
  assert.equal(result.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(result.releaseDecisionAuthorized, false);
  assert.equal(result.paymentResponseEmissionAllowed, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.resourceReleased, false);
  assert.equal(result.crpFulfillAllowed, false);
  assert.equal(result.crpFulfillCalled, false);
  assert.equal(result.replayMutationAllowed, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.canonicalReleasePersistenceAllowed, false);
  assert.equal(result.canonicalReleasePersisted, false);
  assert.equal(result.productionRelease, false);

  assert.equal(result.rawProofPrinted, false);
  assert.equal(result.rawReceiptPrinted, false);
  assert.equal(result.receiptJwsPrinted, false);
  assert.equal(result.receiptPayloadPrinted, false);
  assert.equal(result.receiptMaterialAccepted, false);
  assert.equal(result.receiptJwsAcceptedForDecode, false);
  assert.equal(result.receiptPayloadAcceptedForDecode, false);
  assert.equal(result.receiptBytesAcceptedForDecode, false);
  assert.equal(result.receiptObjectAcceptedForDecode, false);
  assert.equal(result.rawReceiptAcceptedForDecode, false);
  assert.equal(result.rawProofAcceptedForDecode, false);
  assert.equal(result.settlementFieldsAcceptedForDecode, false);
  assert.equal(result.replayKeyAcceptedForDecode, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => observeLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...decoderInvocation,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_release_side_effects/,
  );

  assert.throws(
    () => observeLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...decoderInvocation,
      productionReleaseAllowedAfterInvocation: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_release_side_effects/,
  );

  assert.throws(
    () => observeLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...decoderInvocation,
      rawProofPrinted: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_raw_or_printed_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      decodedResultConsumptionDryRunObserved: false,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_requires_test_only_dry_run_authority/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      productionReleaseAllowed: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      decoderResultSanitized: false,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_requires_valid_decoded_fixture_result/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      releaseDecisionDryRunObserved: false,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_requires_release_decision_dry_run_observation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      releaseDecisionMutatedByDecoderResult: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_release_side_effects/,
  );

  assert.throws(
    () => validateLiveDirectBuyerDecodedResultConsumptionDryRun({
      ...result,
      receiptJwsAcceptedForDecode: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_receipt_material_or_leakage/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerDecodedResultConsumptionDryRun.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceTestOnlyRealDecoderInvocationContract: result.sourceTestOnlyRealDecoderInvocationContract,
    sourceDecoderInvocationValidated: result.sourceDecoderInvocationValidated,
    decodedResultConsumptionDryRunRequired: result.decodedResultConsumptionDryRunRequired,
    decodedResultConsumptionDryRunPresent: result.decodedResultConsumptionDryRunPresent,
    decodedResultConsumptionDryRunObserved: result.decodedResultConsumptionDryRunObserved,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionReleaseAllowed: result.productionReleaseAllowed,
    decoderFixtureFunctionCalled: result.decoderFixtureFunctionCalled,
    decoderFixtureResultKind: result.decoderFixtureResultKind,
    decodedReceiptProduced: result.decodedReceiptProduced,
    decodedReceiptVerified: result.decodedReceiptVerified,
    decoderResultProduced: result.decoderResultProduced,
    decoderResultSanitized: result.decoderResultSanitized,
    decoderResultMetadataOnly: result.decoderResultMetadataOnly,
    decoderResultFixtureOnly: result.decoderResultFixtureOnly,
    decoderResultObservedByReleaseDecisionDryRun: result.decoderResultObservedByReleaseDecisionDryRun,
    releaseDecisionDryRunObserved: result.releaseDecisionDryRunObserved,
    releaseDecisionDryRunMode: result.releaseDecisionDryRunMode,
    decodedResultConsumptionAttempted: result.decodedResultConsumptionAttempted,
    decodedResultConsumptionObserved: result.decodedResultConsumptionObserved,
    decodedResultConsumptionDryRunOnly: result.decodedResultConsumptionDryRunOnly,
    decodedResultReleaseEligibilityEvaluated: result.decodedResultReleaseEligibilityEvaluated,
    decodedResultReleaseEligibility: result.decodedResultReleaseEligibility,
    decoderResultReleaseConsumable: result.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: result.decoderResultConsumedByReleaseDecision,
    releaseDecisionMutatedByDecoderResult: result.releaseDecisionMutatedByDecoderResult,
    releaseDecisionAuthorized: result.releaseDecisionAuthorized,
    paymentResponseEmissionAllowed: result.paymentResponseEmissionAllowed,
    paymentResponseEmitted: result.paymentResponseEmitted,
    resourceReleased: result.resourceReleased,
    crpFulfillAllowed: result.crpFulfillAllowed,
    crpFulfillCalled: result.crpFulfillCalled,
    replayMutationAllowed: result.replayMutationAllowed,
    replayTouched: result.replayTouched,
    canonicalReleasePersistenceAllowed: result.canonicalReleasePersistenceAllowed,
    canonicalReleasePersisted: result.canonicalReleasePersisted,
    productionRelease: result.productionRelease,
    rawProofPrinted: result.rawProofPrinted,
    rawReceiptPrinted: result.rawReceiptPrinted,
    receiptJwsPrinted: result.receiptJwsPrinted,
    receiptPayloadPrinted: result.receiptPayloadPrinted,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptJwsAcceptedForDecode: result.receiptJwsAcceptedForDecode,
    receiptPayloadAcceptedForDecode: result.receiptPayloadAcceptedForDecode,
    receiptBytesAcceptedForDecode: result.receiptBytesAcceptedForDecode,
    receiptObjectAcceptedForDecode: result.receiptObjectAcceptedForDecode,
    rawReceiptAcceptedForDecode: result.rawReceiptAcceptedForDecode,
    rawProofAcceptedForDecode: result.rawProofAcceptedForDecode,
    settlementFieldsAcceptedForDecode: result.settlementFieldsAcceptedForDecode,
    replayKeyAcceptedForDecode: result.replayKeyAcceptedForDecode,
    releaseConsumableSourceRejected: true,
    productionReleaseSourceRejected: true,
    rawMaterialSourceRejected: true,
    missingDryRunObservationRejected: true,
    productionEnablementRejected: true,
    unsanitizedDecodedResultRejected: true,
    missingReleaseDecisionDryRunRejected: true,
    releaseSideEffectsRejected: true,
    receiptMaterialOrLeakageRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
