#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT,
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
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
  openLiveDirectBuyerActualDecoderInputTestOnlyGate,
  openLiveDirectBuyerReceiptMaterialAcceptanceGate,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  projectLiveDirectBuyerSanitizedActualDecoderInputShape,
  projectLiveDirectBuyerSanitizedRuntimeInputShape,
  returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerTestOnlyRealDecoderInvocation,
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
  const result = validateLiveDirectBuyerTestOnlyRealDecoderInvocation(decoderInvocation);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT);
  assert.equal(result.mode, "test_only_real_decoder_invocation");
  assert.equal(result.status, "test_only_real_decoder_invocation_observed");
  assert.equal(result.sourceReceiptMaterialAcceptanceGateContract, LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT);
  assert.equal(result.receiptMaterialAcceptanceGateValidated, true);
  assert.equal(result.receiptMaterialAcceptanceGateSatisfied, true);
  assert.equal(result.testOnlyRealDecoderInvocationRequired, true);
  assert.equal(result.testOnlyRealDecoderInvocationPresent, true);
  assert.equal(result.testOnlyRealDecoderInvocationSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);
  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionDecoderInvocationAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.sanitizedFixtureInputBuilt, true);
  assert.equal(result.sanitizedFixtureInputUsed, true);
  assert.equal(result.sanitizedFixtureInputSource, "test_only_sanitized_fixture_input");
  assert.equal(result.sanitizedFixtureInputMetadataOnly, true);
  assert.equal(result.sanitizedFixtureInputSanitized, true);
  assert.equal(result.sanitizedFixtureInputBoundToPaymentRequired, true);
  assert.equal(result.sanitizedFixtureInputContainsRawProof, false);
  assert.equal(result.sanitizedFixtureInputContainsRawReceipt, false);
  assert.equal(result.sanitizedFixtureInputContainsReceiptJws, false);
  assert.equal(result.sanitizedFixtureInputContainsReceiptPayload, false);
  assert.equal(result.sanitizedFixtureInputContainsReceiptBytes, false);
  assert.equal(result.sanitizedFixtureInputContainsReceiptObject, false);
  assert.equal(result.sanitizedFixtureInputContainsSettlementFields, false);
  assert.equal(result.sanitizedFixtureInputContainsReplayKey, false);

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

  assert.equal(result.testOnlyRealDecoderInvocationAllowed, true);
  assert.equal(result.testOnlyRealDecoderInvocationAttempted, true);
  assert.equal(result.testOnlyRealDecoderInvocationObserved, true);
  assert.equal(result.realDecoderAdapterRepresented, true);
  assert.equal(result.realDecoderAdapterInvoked, true);
  assert.equal(result.realDecoderInvoked, true);
  assert.equal(result.realDecoderInvocationRoute, "test_only_sanitized_fixture_input_no_release");

  assert.equal(result.decoderFixtureFunctionCalled, true);
  assert.equal(result.decoderFixtureResultKind, "test_only_sanitized_decoder_fixture_result");
  assert.equal(result.testOnlyDecoderResultProduced, true);
  assert.equal(result.testOnlyDecoderResultSanitized, true);
  assert.equal(result.testOnlyDecoderResultMetadataOnly, true);
  assert.equal(result.testOnlyDecoderResultFixtureOnly, true);
  assert.equal(result.decodedReceiptProduced, true);
  assert.equal(result.decodedReceiptVerified, true);
  assert.equal(result.decoderResultProduced, true);
  assert.equal(result.decoderResultReleaseConsumable, false);
  assert.equal(result.decoderResultConsumedByReleaseDecision, false);
  assert.equal(result.releaseDecisionMutatedByDecoderResult, false);
  assert.equal(result.paymentResponseEmissionAllowed, false);
  assert.equal(result.crpFulfillAllowed, false);
  assert.equal(result.replayMutationAllowed, false);
  assert.equal(result.canonicalReleasePersistenceAllowed, false);
  assert.equal(result.productionReleaseAllowedAfterInvocation, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => invokeLiveDirectBuyerTestOnlyRealDecoder({
      ...gate,
      receiptMaterialAccepted: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_requires_open_permission_without_acceptance/,
  );

  assert.throws(
    () => invokeLiveDirectBuyerTestOnlyRealDecoder({
      ...gate,
      receiptJwsAcceptedForDecode: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_receipt_material_acceptance_or_decode/,
  );

  assert.throws(
    () => invokeLiveDirectBuyerTestOnlyRealDecoder({
      ...gate,
      productionReleaseAllowed: true,
    }),
    /live_direct_buyer_receipt_material_acceptance_gate_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      testOnlyRealDecoderInvocationSatisfied: false,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_requires_test_only_authority/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      productionDecoderInvocationAllowed: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      sanitizedFixtureInputContainsRawProof: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_raw_or_printed_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      receiptJwsAcceptedForDecode: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_real_receipt_material_acceptance/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      realDecoderInvoked: false,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_requires_real_decoder_invocation_observation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      testOnlyDecoderResultProduced: false,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_requires_sanitized_test_only_decoder_result/,
  );

  assert.throws(
    () => validateLiveDirectBuyerTestOnlyRealDecoderInvocation({
      ...result,
      decoderResultReleaseConsumable: true,
    }),
    /live_direct_buyer_test_only_real_decoder_invocation_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerTestOnlyRealDecoderInvocation.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceReceiptMaterialAcceptanceGateContract: result.sourceReceiptMaterialAcceptanceGateContract,
    receiptMaterialAcceptanceGateValidated: result.receiptMaterialAcceptanceGateValidated,
    receiptMaterialAcceptanceGateSatisfied: result.receiptMaterialAcceptanceGateSatisfied,
    testOnlyRealDecoderInvocationRequired: result.testOnlyRealDecoderInvocationRequired,
    testOnlyRealDecoderInvocationPresent: result.testOnlyRealDecoderInvocationPresent,
    testOnlyRealDecoderInvocationSatisfied: result.testOnlyRealDecoderInvocationSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionDecoderInvocationAllowed: result.productionDecoderInvocationAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    sanitizedFixtureInputBuilt: result.sanitizedFixtureInputBuilt,
    sanitizedFixtureInputUsed: result.sanitizedFixtureInputUsed,
    sanitizedFixtureInputSource: result.sanitizedFixtureInputSource,
    sanitizedFixtureInputMetadataOnly: result.sanitizedFixtureInputMetadataOnly,
    sanitizedFixtureInputSanitized: result.sanitizedFixtureInputSanitized,
    sanitizedFixtureInputBoundToPaymentRequired: result.sanitizedFixtureInputBoundToPaymentRequired,
    sanitizedFixtureInputContainsRawProof: result.sanitizedFixtureInputContainsRawProof,
    sanitizedFixtureInputContainsRawReceipt: result.sanitizedFixtureInputContainsRawReceipt,
    sanitizedFixtureInputContainsReceiptJws: result.sanitizedFixtureInputContainsReceiptJws,
    sanitizedFixtureInputContainsReceiptPayload: result.sanitizedFixtureInputContainsReceiptPayload,
    sanitizedFixtureInputContainsReceiptBytes: result.sanitizedFixtureInputContainsReceiptBytes,
    sanitizedFixtureInputContainsReceiptObject: result.sanitizedFixtureInputContainsReceiptObject,
    sanitizedFixtureInputContainsSettlementFields: result.sanitizedFixtureInputContainsSettlementFields,
    sanitizedFixtureInputContainsReplayKey: result.sanitizedFixtureInputContainsReplayKey,
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
    testOnlyRealDecoderInvocationAllowed: result.testOnlyRealDecoderInvocationAllowed,
    testOnlyRealDecoderInvocationAttempted: result.testOnlyRealDecoderInvocationAttempted,
    testOnlyRealDecoderInvocationObserved: result.testOnlyRealDecoderInvocationObserved,
    realDecoderAdapterRepresented: result.realDecoderAdapterRepresented,
    realDecoderAdapterInvoked: result.realDecoderAdapterInvoked,
    realDecoderInvoked: result.realDecoderInvoked,
    realDecoderInvocationRoute: result.realDecoderInvocationRoute,
    decoderFixtureFunctionCalled: result.decoderFixtureFunctionCalled,
    decoderFixtureResultKind: result.decoderFixtureResultKind,
    testOnlyDecoderResultProduced: result.testOnlyDecoderResultProduced,
    testOnlyDecoderResultSanitized: result.testOnlyDecoderResultSanitized,
    testOnlyDecoderResultMetadataOnly: result.testOnlyDecoderResultMetadataOnly,
    testOnlyDecoderResultFixtureOnly: result.testOnlyDecoderResultFixtureOnly,
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
    productionReleaseAllowedAfterInvocation: result.productionReleaseAllowedAfterInvocation,
    receiptMaterialGateRejectedIfAlreadyAccepted: true,
    receiptMaterialDecodeInputRejected: true,
    productionInvocationRejected: true,
    missingTestOnlyAuthorityRejected: true,
    productionEnablementRejected: true,
    rawMaterialRejected: true,
    realReceiptMaterialAcceptanceRejected: true,
    missingRealDecoderInvocationRejected: true,
    missingDecoderResultRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
