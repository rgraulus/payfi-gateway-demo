#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT,
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
  validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const guard = runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(descriptor);
  const result = validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(guard);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT);
  assert.equal(result.mode, "runtime_input_construction_disabled_guard");
  assert.equal(result.status, "construction_blocked");
  assert.equal(result.sourcePreflightContract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT);
  assert.equal(result.preflightDescriptorValidated, true);
  assert.equal(result.runtimeInputDescriptorPresent, true);
  assert.equal(result.runtimeInputDescriptorOnly, true);
  assert.equal(result.constructionRecognizedAsFutureStep, true);
  assert.equal(result.constructionEnabled, false);
  assert.equal(result.constructionAttempted, true);
  assert.equal(result.constructionBlocked, true);
  assert.equal(result.constructionBlockReason, "runtime_input_construction_disabled");

  assert.equal(result.runtimeDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputReady, false);
  assert.equal(result.decoderInvocationAllowed, false);
  assert.equal(result.decoderInvocationAttempted, false);
  assert.equal(result.decoderInvoked, false);

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
  assert.equal(result.productionReleaseAllowed, false);
  assert.equal(result.sideEffectFree, true);

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard({
      ...guard,
      constructionEnabled: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_disabled_blocked_construction/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard({
      ...guard,
      runtimeDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_runtime_input_or_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard({
      ...guard,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_decode_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard({
      ...guard,
      nonceBound: false,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard({
      ...guard,
      productionReleaseAllowed: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourcePreflightContract: result.sourcePreflightContract,
    preflightDescriptorValidated: result.preflightDescriptorValidated,
    runtimeInputDescriptorPresent: result.runtimeInputDescriptorPresent,
    runtimeInputDescriptorOnly: result.runtimeInputDescriptorOnly,
    constructionRecognizedAsFutureStep: result.constructionRecognizedAsFutureStep,
    constructionEnabled: result.constructionEnabled,
    constructionAttempted: result.constructionAttempted,
    constructionBlocked: result.constructionBlocked,
    constructionBlockReason: result.constructionBlockReason,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
    actualDecoderInputReady: result.actualDecoderInputReady,
    decoderInvocationAllowed: result.decoderInvocationAllowed,
    decoderInvocationAttempted: result.decoderInvocationAttempted,
    decoderInvoked: result.decoderInvoked,
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
    productionReleaseAllowed: result.productionReleaseAllowed,
    constructionEnablementRejected: true,
    runtimeInputObjectRejected: true,
    decodeMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
