#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT,
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const guard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const gate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(guard);
  const result = validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(gate);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT);
  assert.equal(result.mode, "runtime_input_construction_test_only_gate");
  assert.equal(result.status, "open_test_only");
  assert.equal(result.sourceConstructionGuardContract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT);
  assert.equal(result.constructionGuardValidated, true);
  assert.equal(result.testOnlyGateRequired, true);
  assert.equal(result.testOnlyGatePresent, true);
  assert.equal(result.testOnlyGateSatisfied, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.constructionStillDeferred, true);
  assert.equal(result.constructionAllowed, false);
  assert.equal(result.constructionAttempted, false);
  assert.equal(result.constructionBlocked, true);
  assert.equal(result.constructionBlockReason, "construction_deferred_after_test_only_gate");

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
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      constructionAllowed: true,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_requires_deferred_blocked_construction/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      runtimeDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_rejects_runtime_input_or_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      nonceBound: false,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate({
      ...gate,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_runtime_input_construction_test_only_gate_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerRuntimeInputConstructionTestOnlyGate.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceConstructionGuardContract: result.sourceConstructionGuardContract,
    constructionGuardValidated: result.constructionGuardValidated,
    testOnlyGateRequired: result.testOnlyGateRequired,
    testOnlyGatePresent: result.testOnlyGatePresent,
    testOnlyGateSatisfied: result.testOnlyGateSatisfied,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    constructionStillDeferred: result.constructionStillDeferred,
    constructionAllowed: result.constructionAllowed,
    constructionAttempted: result.constructionAttempted,
    constructionBlocked: result.constructionBlocked,
    constructionBlockReason: result.constructionBlockReason,
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
    productionEnablementRejected: true,
    constructionStillDeferredRejectedIfAllowed: true,
    runtimeInputObjectRejected: true,
    receiptMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
