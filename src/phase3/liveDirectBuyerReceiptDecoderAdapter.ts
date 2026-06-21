export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.implementationScaffold.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.inputEnvelopeContract.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.envelopeToRuntimeInputPreflight.v1" as const;

export type LiveDirectBuyerReceiptDecoderAdapterMode = "disabled_scaffold";

export type LiveDirectBuyerReceiptDecoderAdapterInput = {
  readonly mode: LiveDirectBuyerReceiptDecoderAdapterMode;
  readonly source: "scaffold_selftest";
  readonly metadataOnly: true;
  readonly sanitized: true;
  readonly receiptMaterialPresent: false;
  readonly receiptJwsPresent: false;
  readonly receiptPayloadPresent: false;
  readonly receiptBytesPresent: false;
  readonly receiptObjectPresent: false;
  readonly rawReceiptPresent: false;
  readonly rawProofPresent: false;
  readonly settlementFieldsPresent: false;
  readonly replayKeyPresent: false;
  readonly runtimeDecoderInputObjectPresent: false;
  readonly actualDecoderInputObjectPresent: false;
};

export type LiveDirectBuyerReceiptDecoderAdapterResult = {
  readonly ok: true;
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT;
  readonly mode: LiveDirectBuyerReceiptDecoderAdapterMode;
  readonly status: "scaffold_ready";
  readonly realDecoderAdapterImplemented: true;
  readonly realDecoderRuntimeInvocationEnabled: false;
  readonly scaffoldOnly: true;
  readonly source: "scaffold_selftest";
  readonly metadataOnly: true;
  readonly sanitized: true;
  readonly receiptMaterialAccepted: false;
  readonly receiptJwsAcceptedForDecode: false;
  readonly receiptPayloadAcceptedForDecode: false;
  readonly receiptBytesAcceptedForDecode: false;
  readonly receiptObjectAcceptedForDecode: false;
  readonly rawReceiptAcceptedForDecode: false;
  readonly rawProofAcceptedForDecode: false;
  readonly settlementFieldsAcceptedForDecode: false;
  readonly replayKeyAcceptedForDecode: false;
  readonly runtimeDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectBuilt: false;
  readonly decodedReceiptProduced: false;
  readonly decodedReceiptVerified: false;
  readonly decoderResultProduced: false;
  readonly decoderResultReleaseConsumable: false;
  readonly decoderResultConsumedByReleaseDecision: false;
  readonly releaseDecisionMutatedByDecoderResult: false;
  readonly paymentResponseEmissionAllowed: false;
  readonly crpFulfillAllowed: false;
  readonly replayMutationAllowed: false;
  readonly canonicalReleasePersistenceAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly sideEffectFree: true;
};

export function buildLiveDirectBuyerReceiptDecoderAdapterScaffoldInput(): LiveDirectBuyerReceiptDecoderAdapterInput {
  return {
    mode: "disabled_scaffold",
    source: "scaffold_selftest",
    metadataOnly: true,
    sanitized: true,
    receiptMaterialPresent: false,
    receiptJwsPresent: false,
    receiptPayloadPresent: false,
    receiptBytesPresent: false,
    receiptObjectPresent: false,
    rawReceiptPresent: false,
    rawProofPresent: false,
    settlementFieldsPresent: false,
    replayKeyPresent: false,
    runtimeDecoderInputObjectPresent: false,
    actualDecoderInputObjectPresent: false,
  };
}

export function runLiveDirectBuyerReceiptDecoderAdapterScaffold(
  input: LiveDirectBuyerReceiptDecoderAdapterInput,
): LiveDirectBuyerReceiptDecoderAdapterResult {
  if (input.mode !== "disabled_scaffold") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_scaffold_unexpected_mode");
  }
  if (input.source !== "scaffold_selftest") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_scaffold_unexpected_source");
  }
  if (input.metadataOnly !== true || input.sanitized !== true) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_scaffold_requires_sanitized_metadata_only_input");
  }

  const prohibitedMaterialPresent =
    input.receiptMaterialPresent ||
    input.receiptJwsPresent ||
    input.receiptPayloadPresent ||
    input.receiptBytesPresent ||
    input.receiptObjectPresent ||
    input.rawReceiptPresent ||
    input.rawProofPresent ||
    input.settlementFieldsPresent ||
    input.replayKeyPresent ||
    input.runtimeDecoderInputObjectPresent ||
    input.actualDecoderInputObjectPresent;

  if (prohibitedMaterialPresent) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_scaffold_rejects_decode_material");
  }

  return {
    ok: true,
    contract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT,
    mode: "disabled_scaffold",
    status: "scaffold_ready",
    realDecoderAdapterImplemented: true,
    realDecoderRuntimeInvocationEnabled: false,
    scaffoldOnly: true,
    source: "scaffold_selftest",
    metadataOnly: true,
    sanitized: true,
    receiptMaterialAccepted: false,
    receiptJwsAcceptedForDecode: false,
    receiptPayloadAcceptedForDecode: false,
    receiptBytesAcceptedForDecode: false,
    receiptObjectAcceptedForDecode: false,
    rawReceiptAcceptedForDecode: false,
    rawProofAcceptedForDecode: false,
    settlementFieldsAcceptedForDecode: false,
    replayKeyAcceptedForDecode: false,
    runtimeDecoderInputObjectBuilt: false,
    actualDecoderInputObjectBuilt: false,
    decodedReceiptProduced: false,
    decodedReceiptVerified: false,
    decoderResultProduced: false,
    decoderResultReleaseConsumable: false,
    decoderResultConsumedByReleaseDecision: false,
    releaseDecisionMutatedByDecoderResult: false,
    paymentResponseEmissionAllowed: false,
    crpFulfillAllowed: false,
    replayMutationAllowed: false,
    canonicalReleasePersistenceAllowed: false,
    productionReleaseAllowed: false,
    sideEffectFree: true,
  };
}

export type LiveDirectBuyerReceiptDecoderAdapterInputEnvelope = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT;
  readonly mode: "input_envelope_contract_only";
  readonly status: "input_envelope_contract_ready";
  readonly source: "input_envelope_selftest";
  readonly envelopeVersion: "v1";
  readonly metadataOnly: true;
  readonly sanitized: true;
  readonly scaffoldOnly: true;
  readonly runtimeDecodeReady: false;
  readonly actualDecodeReady: false;
  readonly releaseConsumable: false;
  readonly paymentRequiredContextPresent: true;
  readonly paymentRequiredContextBound: true;
  readonly nonceBound: true;
  readonly resourceBound: true;
  readonly contractBound: true;
  readonly merchantBound: true;
  readonly paymentTupleBound: true;
  readonly receiptMaterialPresent: false;
  readonly receiptJwsPresent: false;
  readonly receiptPayloadPresent: false;
  readonly receiptBytesPresent: false;
  readonly receiptObjectPresent: false;
  readonly rawReceiptPresent: false;
  readonly rawProofPresent: false;
  readonly settlementFieldsPresent: false;
  readonly replayKeyPresent: false;
  readonly runtimeDecoderInputObjectPresent: false;
  readonly actualDecoderInputObjectPresent: false;
};

export type LiveDirectBuyerReceiptDecoderAdapterInputEnvelopeValidation = {
  readonly ok: true;
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT;
  readonly mode: "input_envelope_contract_only";
  readonly status: "input_envelope_contract_ready";
  readonly inputEnvelopeBuilt: true;
  readonly inputEnvelopeValidated: true;
  readonly metadataOnly: true;
  readonly sanitized: true;
  readonly scaffoldOnly: true;
  readonly runtimeDecodeReady: false;
  readonly actualDecodeReady: false;
  readonly releaseConsumable: false;
  readonly paymentRequiredContextPresent: true;
  readonly paymentRequiredContextBound: true;
  readonly nonceBound: true;
  readonly resourceBound: true;
  readonly contractBound: true;
  readonly merchantBound: true;
  readonly paymentTupleBound: true;
  readonly receiptMaterialAccepted: false;
  readonly receiptJwsAcceptedForDecode: false;
  readonly receiptPayloadAcceptedForDecode: false;
  readonly receiptBytesAcceptedForDecode: false;
  readonly receiptObjectAcceptedForDecode: false;
  readonly rawReceiptAcceptedForDecode: false;
  readonly rawProofAcceptedForDecode: false;
  readonly settlementFieldsAcceptedForDecode: false;
  readonly replayKeyAcceptedForDecode: false;
  readonly runtimeDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectBuilt: false;
  readonly decodedReceiptProduced: false;
  readonly decodedReceiptVerified: false;
  readonly decoderResultProduced: false;
  readonly decoderResultReleaseConsumable: false;
  readonly decoderResultConsumedByReleaseDecision: false;
  readonly releaseDecisionMutatedByDecoderResult: false;
  readonly paymentResponseEmissionAllowed: false;
  readonly crpFulfillAllowed: false;
  readonly replayMutationAllowed: false;
  readonly canonicalReleasePersistenceAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly sideEffectFree: true;
};

export function buildLiveDirectBuyerReceiptDecoderAdapterInputEnvelope(): LiveDirectBuyerReceiptDecoderAdapterInputEnvelope {
  return {
    contract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT,
    mode: "input_envelope_contract_only",
    status: "input_envelope_contract_ready",
    source: "input_envelope_selftest",
    envelopeVersion: "v1",
    metadataOnly: true,
    sanitized: true,
    scaffoldOnly: true,
    runtimeDecodeReady: false,
    actualDecodeReady: false,
    releaseConsumable: false,
    paymentRequiredContextPresent: true,
    paymentRequiredContextBound: true,
    nonceBound: true,
    resourceBound: true,
    contractBound: true,
    merchantBound: true,
    paymentTupleBound: true,
    receiptMaterialPresent: false,
    receiptJwsPresent: false,
    receiptPayloadPresent: false,
    receiptBytesPresent: false,
    receiptObjectPresent: false,
    rawReceiptPresent: false,
    rawProofPresent: false,
    settlementFieldsPresent: false,
    replayKeyPresent: false,
    runtimeDecoderInputObjectPresent: false,
    actualDecoderInputObjectPresent: false,
  };
}

export function validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope(
  envelope: LiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
): LiveDirectBuyerReceiptDecoderAdapterInputEnvelopeValidation {
  if (envelope.contract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_unexpected_contract");
  }
  if (envelope.mode !== "input_envelope_contract_only") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_unexpected_mode");
  }
  if (envelope.status !== "input_envelope_contract_ready") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_unexpected_status");
  }
  if (envelope.source !== "input_envelope_selftest") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_unexpected_source");
  }
  if (envelope.metadataOnly !== true || envelope.sanitized !== true || envelope.scaffoldOnly !== true) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_requires_sanitized_metadata_only_scaffold");
  }
  if (
    envelope.runtimeDecodeReady ||
    envelope.actualDecodeReady ||
    envelope.releaseConsumable
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_rejects_runtime_decode_or_release_ready");
  }
  if (
    !envelope.paymentRequiredContextPresent ||
    !envelope.paymentRequiredContextBound ||
    !envelope.nonceBound ||
    !envelope.resourceBound ||
    !envelope.contractBound ||
    !envelope.merchantBound ||
    !envelope.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_requires_payment_required_binding");
  }

  const prohibitedMaterialPresent =
    envelope.receiptMaterialPresent ||
    envelope.receiptJwsPresent ||
    envelope.receiptPayloadPresent ||
    envelope.receiptBytesPresent ||
    envelope.receiptObjectPresent ||
    envelope.rawReceiptPresent ||
    envelope.rawProofPresent ||
    envelope.settlementFieldsPresent ||
    envelope.replayKeyPresent ||
    envelope.runtimeDecoderInputObjectPresent ||
    envelope.actualDecoderInputObjectPresent;

  if (prohibitedMaterialPresent) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_input_envelope_rejects_decode_material");
  }

  return {
    ok: true,
    contract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT,
    mode: "input_envelope_contract_only",
    status: "input_envelope_contract_ready",
    inputEnvelopeBuilt: true,
    inputEnvelopeValidated: true,
    metadataOnly: true,
    sanitized: true,
    scaffoldOnly: true,
    runtimeDecodeReady: false,
    actualDecodeReady: false,
    releaseConsumable: false,
    paymentRequiredContextPresent: true,
    paymentRequiredContextBound: true,
    nonceBound: true,
    resourceBound: true,
    contractBound: true,
    merchantBound: true,
    paymentTupleBound: true,
    receiptMaterialAccepted: false,
    receiptJwsAcceptedForDecode: false,
    receiptPayloadAcceptedForDecode: false,
    receiptBytesAcceptedForDecode: false,
    receiptObjectAcceptedForDecode: false,
    rawReceiptAcceptedForDecode: false,
    rawProofAcceptedForDecode: false,
    settlementFieldsAcceptedForDecode: false,
    replayKeyAcceptedForDecode: false,
    runtimeDecoderInputObjectBuilt: false,
    actualDecoderInputObjectBuilt: false,
    decodedReceiptProduced: false,
    decodedReceiptVerified: false,
    decoderResultProduced: false,
    decoderResultReleaseConsumable: false,
    decoderResultConsumedByReleaseDecision: false,
    releaseDecisionMutatedByDecoderResult: false,
    paymentResponseEmissionAllowed: false,
    crpFulfillAllowed: false,
    replayMutationAllowed: false,
    canonicalReleasePersistenceAllowed: false,
    productionReleaseAllowed: false,
    sideEffectFree: true,
  };
}

export type LiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflightDescriptor = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT;
  readonly mode: "envelope_to_runtime_input_preflight_only";
  readonly status: "runtime_input_preflight_ready";
  readonly sourceEnvelopeContract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT;
  readonly inputEnvelopeValidated: true;
  readonly inputEnvelopeMetadataOnly: true;
  readonly inputEnvelopeSanitized: true;
  readonly inputEnvelopeScaffoldOnly: true;
  readonly projectionBuilt: true;
  readonly projectionValidated: true;
  readonly runtimeInputDescriptorBuilt: true;
  readonly runtimeInputDescriptorOnly: true;
  readonly runtimeDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputReady: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly receiptMaterialIncluded: false;
  readonly receiptJwsIncluded: false;
  readonly receiptPayloadIncluded: false;
  readonly receiptBytesIncluded: false;
  readonly receiptObjectIncluded: false;
  readonly rawReceiptIncluded: false;
  readonly rawProofIncluded: false;
  readonly settlementFieldsIncluded: false;
  readonly replayKeyIncluded: false;
  readonly paymentRequiredContextBound: true;
  readonly nonceBound: true;
  readonly resourceBound: true;
  readonly contractBound: true;
  readonly merchantBound: true;
  readonly paymentTupleBound: true;
  readonly decodedReceiptProduced: false;
  readonly decodedReceiptVerified: false;
  readonly decoderResultProduced: false;
  readonly decoderResultReleaseConsumable: false;
  readonly decoderResultConsumedByReleaseDecision: false;
  readonly releaseDecisionMutatedByDecoderResult: false;
  readonly paymentResponseEmissionAllowed: false;
  readonly crpFulfillAllowed: false;
  readonly replayMutationAllowed: false;
  readonly canonicalReleasePersistenceAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly sideEffectFree: true;
};

export function buildLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(
  envelope: LiveDirectBuyerReceiptDecoderAdapterInputEnvelope,
): LiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflightDescriptor {
  const envelopeValidation = validateLiveDirectBuyerReceiptDecoderAdapterInputEnvelope(envelope);

  if (envelopeValidation.ok !== true) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_envelope_validation_failed");
  }

  return {
    contract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT,
    mode: "envelope_to_runtime_input_preflight_only",
    status: "runtime_input_preflight_ready",
    sourceEnvelopeContract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT,
    inputEnvelopeValidated: true,
    inputEnvelopeMetadataOnly: true,
    inputEnvelopeSanitized: true,
    inputEnvelopeScaffoldOnly: true,
    projectionBuilt: true,
    projectionValidated: true,
    runtimeInputDescriptorBuilt: true,
    runtimeInputDescriptorOnly: true,
    runtimeDecoderInputObjectBuilt: false,
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputReady: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    receiptMaterialIncluded: false,
    receiptJwsIncluded: false,
    receiptPayloadIncluded: false,
    receiptBytesIncluded: false,
    receiptObjectIncluded: false,
    rawReceiptIncluded: false,
    rawProofIncluded: false,
    settlementFieldsIncluded: false,
    replayKeyIncluded: false,
    paymentRequiredContextBound: true,
    nonceBound: true,
    resourceBound: true,
    contractBound: true,
    merchantBound: true,
    paymentTupleBound: true,
    decodedReceiptProduced: false,
    decodedReceiptVerified: false,
    decoderResultProduced: false,
    decoderResultReleaseConsumable: false,
    decoderResultConsumedByReleaseDecision: false,
    releaseDecisionMutatedByDecoderResult: false,
    paymentResponseEmissionAllowed: false,
    crpFulfillAllowed: false,
    replayMutationAllowed: false,
    canonicalReleasePersistenceAllowed: false,
    productionReleaseAllowed: false,
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(
  descriptor: LiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflightDescriptor,
): LiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflightDescriptor {
  if (descriptor.contract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_unexpected_contract");
  }
  if (descriptor.mode !== "envelope_to_runtime_input_preflight_only") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_unexpected_mode");
  }
  if (descriptor.status !== "runtime_input_preflight_ready") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_unexpected_status");
  }
  if (descriptor.sourceEnvelopeContract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_unexpected_source_envelope_contract");
  }
  if (
    descriptor.inputEnvelopeValidated !== true ||
    descriptor.inputEnvelopeMetadataOnly !== true ||
    descriptor.inputEnvelopeSanitized !== true ||
    descriptor.inputEnvelopeScaffoldOnly !== true ||
    descriptor.projectionBuilt !== true ||
    descriptor.projectionValidated !== true ||
    descriptor.runtimeInputDescriptorBuilt !== true ||
    descriptor.runtimeInputDescriptorOnly !== true
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_requires_validated_descriptor_only_projection");
  }
  if (
    descriptor.runtimeDecoderInputObjectBuilt ||
    descriptor.actualDecoderInputObjectBuilt ||
    descriptor.actualDecoderInputReady ||
    descriptor.decoderInvocationAllowed ||
    descriptor.decoderInvocationAttempted ||
    descriptor.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_runtime_input_or_decoder_invocation");
  }

  const prohibitedMaterialIncluded =
    descriptor.receiptMaterialIncluded ||
    descriptor.receiptJwsIncluded ||
    descriptor.receiptPayloadIncluded ||
    descriptor.receiptBytesIncluded ||
    descriptor.receiptObjectIncluded ||
    descriptor.rawReceiptIncluded ||
    descriptor.rawProofIncluded ||
    descriptor.settlementFieldsIncluded ||
    descriptor.replayKeyIncluded;

  if (prohibitedMaterialIncluded) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_decode_material");
  }

  if (
    !descriptor.paymentRequiredContextBound ||
    !descriptor.nonceBound ||
    !descriptor.resourceBound ||
    !descriptor.contractBound ||
    !descriptor.merchantBound ||
    !descriptor.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_requires_payment_required_binding");
  }

  if (
    descriptor.decodedReceiptProduced ||
    descriptor.decodedReceiptVerified ||
    descriptor.decoderResultProduced ||
    descriptor.decoderResultReleaseConsumable ||
    descriptor.decoderResultConsumedByReleaseDecision ||
    descriptor.releaseDecisionMutatedByDecoderResult ||
    descriptor.paymentResponseEmissionAllowed ||
    descriptor.crpFulfillAllowed ||
    descriptor.replayMutationAllowed ||
    descriptor.canonicalReleasePersistenceAllowed ||
    descriptor.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_preflight_rejects_release_side_effects");
  }

  return descriptor;
}
