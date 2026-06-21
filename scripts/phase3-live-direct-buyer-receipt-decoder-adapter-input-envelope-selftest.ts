#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
  validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const envelope = buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope();
  const result = validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope(envelope);

  assert.equal(result.ok, true);
  assert.equal(result.contract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT);
  assert.equal(result.mode, "input_envelope_contract_only");
  assert.equal(result.status, "input_envelope_contract_ready");
  assert.equal(result.inputEnvelopeBuilt, true);
  assert.equal(result.inputEnvelopeValidated, true);
  assert.equal(result.metadataOnly, true);
  assert.equal(result.sanitized, true);
  assert.equal(result.scaffoldOnly, true);
  assert.equal(result.runtimeDecodeReady, false);
  assert.equal(result.actualDecodeReady, false);
  assert.equal(result.releaseConsumable, false);

  assert.equal(result.paymentRequiredContextPresent, true);
  assert.equal(result.paymentRequiredContextBound, true);
  assert.equal(result.nonceBound, true);
  assert.equal(result.resourceBound, true);
  assert.equal(result.contractBound, true);
  assert.equal(result.merchantBound, true);
  assert.equal(result.paymentTupleBound, true);

  assert.equal(result.receiptMaterialAccepted, false);
  assert.equal(result.receiptJwsAcceptedForDecode, false);
  assert.equal(result.receiptPayloadAcceptedForDecode, false);
  assert.equal(result.receiptBytesAcceptedForDecode, false);
  assert.equal(result.receiptObjectAcceptedForDecode, false);
  assert.equal(result.rawReceiptAcceptedForDecode, false);
  assert.equal(result.rawProofAcceptedForDecode, false);
  assert.equal(result.settlementFieldsAcceptedForDecode, false);
  assert.equal(result.replayKeyAcceptedForDecode, false);
  assert.equal(result.runtimeDecoderInputObjectBuilt, false);
  assert.equal(result.actualDecoderInputObjectBuilt, false);
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
    () => validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope({
      ...envelope,
      receiptJwsPresent: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_input_envelope_rejects_decode_material/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope({
      ...envelope,
      runtimeDecodeReady: true,
    }),
    /live_direct_buyer_receipt_decoder_adapter_input_envelope_rejects_runtime_decode_or_release_ready/,
  );

  assert.throws(
    () => validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope({
      ...envelope,
      nonceBound: false,
    }),
    /live_direct_buyer_receipt_decoder_adapter_input_envelope_requires_payment_required_binding/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerReceiptDecoderAdapterInputEnvelope.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    inputEnvelopeBuilt: result.inputEnvelopeBuilt,
    inputEnvelopeValidated: result.inputEnvelopeValidated,
    metadataOnly: result.metadataOnly,
    sanitized: result.sanitized,
    scaffoldOnly: result.scaffoldOnly,
    runtimeDecodeReady: result.runtimeDecodeReady,
    actualDecodeReady: result.actualDecodeReady,
    releaseConsumable: result.releaseConsumable,
    paymentRequiredContextPresent: result.paymentRequiredContextPresent,
    paymentRequiredContextBound: result.paymentRequiredContextBound,
    nonceBound: result.nonceBound,
    resourceBound: result.resourceBound,
    contractBound: result.contractBound,
    merchantBound: result.merchantBound,
    paymentTupleBound: result.paymentTupleBound,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptJwsAcceptedForDecode: result.receiptJwsAcceptedForDecode,
    receiptPayloadAcceptedForDecode: result.receiptPayloadAcceptedForDecode,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
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
    prohibitedDecodeMaterialRejected: true,
    runtimeDecodeReadyRejected: true,
    missingPaymentRequiredBindingRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
