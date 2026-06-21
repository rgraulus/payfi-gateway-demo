#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT,
  LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  observeLiveDirectBuyerRuntimeInputConstructionDryRun,
  openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerRuntimeInputConstructionDryRun,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const guard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const gate = openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(guard);
  const dryRun = observeLiveDirectBuyerRuntimeInputConstructionDryRun(gate);
  const result = validateLiveDirectBuyerRuntimeInputConstructionDryRun(dryRun);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT);
  assert.equal(result.mode, "runtime_input_construction_test_only_dry_run");
  assert.equal(result.status, "dry_run_observed");
  assert.equal(result.sourceTestOnlyGateContract, LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT);
  assert.equal(result.testOnlyGateValidated, true);
  assert.equal(result.testOnlyGateSatisfied, true);
  assert.equal(result.dryRunRequired, true);
  assert.equal(result.dryRunPresent, true);
  assert.equal(result.dryRunSatisfied, true);
  assert.equal(result.dryRunAttemptObserved, true);
  assert.equal(result.testOnlyAuthorityOpened, true);

  assert.equal(result.productionEnablementPresent, false);
  assert.equal(result.productionEnablementAccepted, false);
  assert.equal(result.productionConstructionAllowed, false);
  assert.equal(result.productionReleaseAllowed, false);

  assert.equal(result.constructionDryRunOnly, true);
  assert.equal(result.constructionAllowed, false);
  assert.equal(result.constructionAttempted, true);
  assert.equal(result.constructionObserved, true);
  assert.equal(result.constructionStillDeferred, true);
  assert.equal(result.constructionBlocked, true);
  assert.equal(result.constructionBlockReason, "runtime_input_construction_dry_run_only");

  assert.equal(result.runtimeInputShapeProjected, false);
  assert.equal(result.runtimeInputShapeValidated, false);
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
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      productionEnablementPresent: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_rejects_production_enablement/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      constructionAllowed: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_requires_observed_deferred_dry_run/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      runtimeInputShapeProjected: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_rejects_runtime_input_shape_projection/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      runtimeDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_rejects_runtime_input_or_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_rejects_receipt_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      nonceBound: false,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerRuntimeInputConstructionDryRun({
      ...dryRun,
      paymentResponseEmissionAllowed: true,
    }),
    /live_direct_buyer_runtime_input_construction_dry_run_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerRuntimeInputConstructionDryRun.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceTestOnlyGateContract: result.sourceTestOnlyGateContract,
    testOnlyGateValidated: result.testOnlyGateValidated,
    testOnlyGateSatisfied: result.testOnlyGateSatisfied,
    dryRunRequired: result.dryRunRequired,
    dryRunPresent: result.dryRunPresent,
    dryRunSatisfied: result.dryRunSatisfied,
    dryRunAttemptObserved: result.dryRunAttemptObserved,
    testOnlyAuthorityOpened: result.testOnlyAuthorityOpened,
    productionEnablementPresent: result.productionEnablementPresent,
    productionEnablementAccepted: result.productionEnablementAccepted,
    productionConstructionAllowed: result.productionConstructionAllowed,
    productionReleaseAllowed: result.productionReleaseAllowed,
    constructionDryRunOnly: result.constructionDryRunOnly,
    constructionAllowed: result.constructionAllowed,
    constructionAttempted: result.constructionAttempted,
    constructionObserved: result.constructionObserved,
    constructionStillDeferred: result.constructionStillDeferred,
    constructionBlocked: result.constructionBlocked,
    constructionBlockReason: result.constructionBlockReason,
    runtimeInputShapeProjected: result.runtimeInputShapeProjected,
    runtimeInputShapeValidated: result.runtimeInputShapeValidated,
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
    runtimeInputShapeProjectionRejected: true,
    runtimeInputObjectRejected: true,
    receiptMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
