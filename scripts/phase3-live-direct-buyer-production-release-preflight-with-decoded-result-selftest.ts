#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_PRODUCTION_RELEASE_PREFLIGHT_WITH_DECODED_RESULT_CONTRACT,
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
  preflightLiveDirectBuyerProductionReleaseWithDecodedResult,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult,
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

  const preflight = preflightLiveDirectBuyerProductionReleaseWithDecodedResult(consumptionDryRun);
  const result = validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult(preflight);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_PRODUCTION_RELEASE_PREFLIGHT_WITH_DECODED_RESULT_CONTRACT);
  assert.equal(result.mode, "production_release_preflight_with_decoded_result");
  assert.equal(result.status, "not_authorized_dry_run_only");
  assert.equal(result.sourceDecodedResultConsumptionDryRunContract, LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT);
  assert.equal(result.sourceDecodedResultConsumptionDryRunValidated, true);
  assert.equal(result.decodedResultObservedByReleaseDecisionDryRun, true);
  assert.equal(result.decodedResultPreflightEvaluated, true);
  assert.equal(result.productionReleasePreflightRequired, true);
  assert.equal(result.productionReleasePreflightPresent, true);
  assert.equal(result.productionReleasePreflightObserved, true);
  assert.equal(result.productionReleasePreflightMode, "evaluate_decoded_result_without_release");
  assert.equal(result.productionReleasePreflightStatus, "not_authorized_dry_run_only");
  assert.equal(result.productionReleasePreflightReady, false);
  assert.equal(result.productionReleasePreflightBlockReason, "decoded_result_is_test_only_fixture_not_release_consumable");

  assert.equal(result.decodedResultSourceSanitized, true);
  assert.equal(result.decodedResultSourceMetadataOnly, true);
  assert.equal(result.decodedResultSourceFixtureOnly, true);
  assert.equal(result.decodedReceiptProduced, true);
  assert.equal(result.decodedReceiptVerified, true);
  assert.equal(result.decoderResultProduced, true);

  assert.equal(result.decoderResultReleaseConsumable, false);
  assert.equal(result.decoderResultConsumedByReleaseDecision, false);
  assert.equal(result.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(result.releaseDecisionAuthorized, false);
  assert.equal(result.productionReleaseAuthorizationEvaluated, true);
  assert.equal(result.productionReleaseAuthorized, false);
  assert.equal(result.productionReleaseAllowed, false);
  assert.equal(result.productionRelease, false);
  assert.equal(result.paymentResponseEmissionAllowed, false);
  assert.equal(result.paymentResponseEmitted, false);
  assert.equal(result.resourceReleased, false);
  assert.equal(result.crpFulfillAllowed, false);
  assert.equal(result.crpFulfillCalled, false);
  assert.equal(result.replayMutationAllowed, false);
  assert.equal(result.replayTouched, false);
  assert.equal(result.canonicalReleasePersistenceAllowed, false);
  assert.equal(result.canonicalReleasePersisted, false);

  assert.equal(result.receiptMaterialAccepted, false);
  assert.equal(result.receiptJwsAcceptedForDecode, false);
  assert.equal(result.receiptPayloadAcceptedForDecode, false);
  assert.equal(result.receiptBytesAcceptedForDecode, false);
  assert.equal(result.receiptObjectAcceptedForDecode, false);
  assert.equal(result.rawReceiptAcceptedForDecode, false);
  assert.equal(result.rawProofAcceptedForDecode, false);
  assert.equal(result.settlementFieldsAcceptedForDecode, false);
  assert.equal(result.replayKeyAcceptedForDecode, false);
  assert.equal(result.rawProofPrinted, false);
  assert.equal(result.rawReceiptPrinted, false);
  assert.equal(result.receiptJwsPrinted, false);
  assert.equal(result.receiptPayloadPrinted, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => preflightLiveDirectBuyerProductionReleaseWithDecodedResult({
      ...consumptionDryRun,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_release_side_effects/,
  );

  assert.throws(
    () => preflightLiveDirectBuyerProductionReleaseWithDecodedResult({
      ...consumptionDryRun,
      productionReleaseAllowed: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_production_enablement/,
  );

  assert.throws(
    () => preflightLiveDirectBuyerProductionReleaseWithDecodedResult({
      ...consumptionDryRun,
      receiptJwsAcceptedForDecode: true,
    }),
    /live_direct_buyer_decoded_result_consumption_dry_run_rejects_receipt_material_or_leakage/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      productionReleasePreflightObserved: false,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_requires_preflight_observation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      productionReleasePreflightReady: true,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_requires_blocked_dry_run_status/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      decodedResultSourceFixtureOnly: false,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_requires_sanitized_decoded_fixture_source/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      productionReleaseAuthorized: true,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_rejects_release_side_effects/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      paymentResponseEmitted: true,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_rejects_release_side_effects/,
  );

  assert.throws(
    () => validateLiveDirectBuyerProductionReleasePreflightWithDecodedResult({
      ...result,
      rawProofPrinted: true,
    }),
    /live_direct_buyer_production_release_preflight_with_decoded_result_rejects_receipt_material_or_leakage/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerProductionReleasePreflightWithDecodedResult.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceDecodedResultConsumptionDryRunContract: result.sourceDecodedResultConsumptionDryRunContract,
    sourceDecodedResultConsumptionDryRunValidated: result.sourceDecodedResultConsumptionDryRunValidated,
    decodedResultObservedByReleaseDecisionDryRun: result.decodedResultObservedByReleaseDecisionDryRun,
    decodedResultPreflightEvaluated: result.decodedResultPreflightEvaluated,
    productionReleasePreflightRequired: result.productionReleasePreflightRequired,
    productionReleasePreflightPresent: result.productionReleasePreflightPresent,
    productionReleasePreflightObserved: result.productionReleasePreflightObserved,
    productionReleasePreflightMode: result.productionReleasePreflightMode,
    productionReleasePreflightStatus: result.productionReleasePreflightStatus,
    productionReleasePreflightReady: result.productionReleasePreflightReady,
    productionReleasePreflightBlockReason: result.productionReleasePreflightBlockReason,
    decodedResultSourceSanitized: result.decodedResultSourceSanitized,
    decodedResultSourceMetadataOnly: result.decodedResultSourceMetadataOnly,
    decodedResultSourceFixtureOnly: result.decodedResultSourceFixtureOnly,
    decodedReceiptProduced: result.decodedReceiptProduced,
    decodedReceiptVerified: result.decodedReceiptVerified,
    decoderResultProduced: result.decoderResultProduced,
    decoderResultReleaseConsumable: result.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: result.decoderResultConsumedByReleaseDecision,
    releaseDecisionMutatedByDecoderResult: result.releaseDecisionMutatedByDecoderResult,
    releaseDecisionAuthorized: result.releaseDecisionAuthorized,
    productionReleaseAuthorizationEvaluated: result.productionReleaseAuthorizationEvaluated,
    productionReleaseAuthorized: result.productionReleaseAuthorized,
    productionReleaseAllowed: result.productionReleaseAllowed,
    productionRelease: result.productionRelease,
    paymentResponseEmissionAllowed: result.paymentResponseEmissionAllowed,
    paymentResponseEmitted: result.paymentResponseEmitted,
    resourceReleased: result.resourceReleased,
    crpFulfillAllowed: result.crpFulfillAllowed,
    crpFulfillCalled: result.crpFulfillCalled,
    replayMutationAllowed: result.replayMutationAllowed,
    replayTouched: result.replayTouched,
    canonicalReleasePersistenceAllowed: result.canonicalReleasePersistenceAllowed,
    canonicalReleasePersisted: result.canonicalReleasePersisted,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptJwsAcceptedForDecode: result.receiptJwsAcceptedForDecode,
    receiptPayloadAcceptedForDecode: result.receiptPayloadAcceptedForDecode,
    receiptBytesAcceptedForDecode: result.receiptBytesAcceptedForDecode,
    receiptObjectAcceptedForDecode: result.receiptObjectAcceptedForDecode,
    rawReceiptAcceptedForDecode: result.rawReceiptAcceptedForDecode,
    rawProofAcceptedForDecode: result.rawProofAcceptedForDecode,
    settlementFieldsAcceptedForDecode: result.settlementFieldsAcceptedForDecode,
    replayKeyAcceptedForDecode: result.replayKeyAcceptedForDecode,
    rawProofPrinted: result.rawProofPrinted,
    rawReceiptPrinted: result.rawReceiptPrinted,
    receiptJwsPrinted: result.receiptJwsPrinted,
    receiptPayloadPrinted: result.receiptPayloadPrinted,
    releaseConsumableSourceRejected: true,
    productionReleaseSourceRejected: true,
    receiptMaterialSourceRejected: true,
    missingPreflightObservationRejected: true,
    preflightReadyRejected: true,
    nonFixtureDecodedResultRejected: true,
    productionAuthorizationRejected: true,
    paymentResponseEmissionRejected: true,
    leakageRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
