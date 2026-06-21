#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT,
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const descriptor = buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(envelope);
  const result = validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(descriptor);

  assert.equal(result.contract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT);
  assert.equal(result.mode, "envelope_to_runtime_input_preflight_only");
  assert.equal(result.status, "runtime_input_preflight_ready");
  assert.equal(result.sourceEnvelopeContract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT);
  assert.equal(result.inputEnvelopeValidated, true);
  assert.equal(result.inputEnvelopeMetadataOnly, true);
  assert.equal(result.inputEnvelopeSanitized, true);
  assert.equal(result.inputEnvelopeScaffoldOnly, true);
  assert.equal(result.projectionBuilt, true);
  assert.equal(result.projectionValidated, true);
  assert.equal(result.runtimeInputDescriptorBuilt, true);
  assert.equal(result.runtimeInputDescriptorOnly, true);
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
    () => validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight({
      ...descriptor,
      runtimeDecoderInputObjectBuilt: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_runtime_input_or_decoder_invocation/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight({
      ...descriptor,
      receiptJwsIncluded: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_decode_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight({
      ...descriptor,
      nonceBound: false,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_requires_payment_required_binding/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight({
      ...descriptor,
      productionReleaseAllowed: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_release_side_effects/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    sourceEnvelopeContract: result.sourceEnvelopeContract,
    inputEnvelopeValidated: result.inputEnvelopeValidated,
    inputEnvelopeMetadataOnly: result.inputEnvelopeMetadataOnly,
    inputEnvelopeSanitized: result.inputEnvelopeSanitized,
    inputEnvelopeScaffoldOnly: result.inputEnvelopeScaffoldOnly,
    projectionBuilt: result.projectionBuilt,
    projectionValidated: result.projectionValidated,
    runtimeInputDescriptorBuilt: result.runtimeInputDescriptorBuilt,
    runtimeInputDescriptorOnly: result.runtimeInputDescriptorOnly,
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
    runtimeInputObjectRejected: true,
    decodeMaterialRejected: true,
    missingPaymentRequiredBindingRejected: true,
    releaseSideEffectsRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
