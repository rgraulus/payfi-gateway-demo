export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.implementationScaffold.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_INPUT_ENVELOPE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.inputEnvelopeContract.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.envelopeToRuntimeInputPreflight.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.runtimeInputConstructionGuard.v1" as const;

export const LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.runtimeInputConstructionTestOnlyGate.v1" as const;

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

export type LiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT;
  readonly mode: "runtime_input_construction_disabled_guard";
  readonly status: "construction_blocked";
  readonly sourcePreflightContract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT;
  readonly preflightDescriptorValidated: true;
  readonly runtimeInputDescriptorPresent: true;
  readonly runtimeInputDescriptorOnly: true;
  readonly constructionRecognizedAsFutureStep: true;
  readonly constructionEnabled: false;
  readonly constructionAttempted: true;
  readonly constructionBlocked: true;
  readonly constructionBlockReason: "runtime_input_construction_disabled";
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

export function runLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(
  descriptor: LiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflightDescriptor,
): LiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard {
  const validatedDescriptor =
    validateLiveDirectBuyerReceiptDecoderAdapterEnvelopeToRuntimeInputPreflight(descriptor);

  if (validatedDescriptor.runtimeInputDescriptorBuilt !== true || validatedDescriptor.runtimeInputDescriptorOnly !== true) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_descriptor_only_preflight");
  }

  if (
    validatedDescriptor.runtimeDecoderInputObjectBuilt ||
    validatedDescriptor.actualDecoderInputObjectBuilt ||
    validatedDescriptor.decoderInvocationAllowed ||
    validatedDescriptor.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_prebuilt_runtime_input_or_decoder_invocation");
  }

  return {
    contract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT,
    mode: "runtime_input_construction_disabled_guard",
    status: "construction_blocked",
    sourcePreflightContract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT,
    preflightDescriptorValidated: true,
    runtimeInputDescriptorPresent: true,
    runtimeInputDescriptorOnly: true,
    constructionRecognizedAsFutureStep: true,
    constructionEnabled: false,
    constructionAttempted: true,
    constructionBlocked: true,
    constructionBlockReason: "runtime_input_construction_disabled",
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

export function validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(
  guard: LiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
): LiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard {
  if (guard.contract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_unexpected_contract");
  }
  if (guard.mode !== "runtime_input_construction_disabled_guard") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_unexpected_mode");
  }
  if (guard.status !== "construction_blocked") {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_unexpected_status");
  }
  if (guard.sourcePreflightContract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_ENVELOPE_TO_RUNTIME_INPUT_PREFLIGHT_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_unexpected_source_preflight_contract");
  }
  if (
    guard.preflightDescriptorValidated !== true ||
    guard.runtimeInputDescriptorPresent !== true ||
    guard.runtimeInputDescriptorOnly !== true ||
    guard.constructionRecognizedAsFutureStep !== true
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_descriptor_only_context");
  }
  if (
    guard.constructionEnabled ||
    guard.constructionBlocked !== true ||
    guard.constructionBlockReason !== "runtime_input_construction_disabled"
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_disabled_blocked_construction");
  }
  if (guard.constructionAttempted !== true) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_blocked_attempt_observed");
  }
  if (
    guard.runtimeDecoderInputObjectBuilt ||
    guard.actualDecoderInputObjectBuilt ||
    guard.actualDecoderInputReady ||
    guard.decoderInvocationAllowed ||
    guard.decoderInvocationAttempted ||
    guard.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_runtime_input_or_decoder_invocation");
  }

  const prohibitedMaterialIncluded =
    guard.receiptMaterialIncluded ||
    guard.receiptJwsIncluded ||
    guard.receiptPayloadIncluded ||
    guard.receiptBytesIncluded ||
    guard.receiptObjectIncluded ||
    guard.rawReceiptIncluded ||
    guard.rawProofIncluded ||
    guard.settlementFieldsIncluded ||
    guard.replayKeyIncluded;

  if (prohibitedMaterialIncluded) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_decode_material");
  }

  if (
    !guard.paymentRequiredContextBound ||
    !guard.nonceBound ||
    !guard.resourceBound ||
    !guard.contractBound ||
    !guard.merchantBound ||
    !guard.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_requires_payment_required_binding");
  }

  if (
    guard.decodedReceiptProduced ||
    guard.decodedReceiptVerified ||
    guard.decoderResultProduced ||
    guard.decoderResultReleaseConsumable ||
    guard.decoderResultConsumedByReleaseDecision ||
    guard.releaseDecisionMutatedByDecoderResult ||
    guard.paymentResponseEmissionAllowed ||
    guard.crpFulfillAllowed ||
    guard.replayMutationAllowed ||
    guard.canonicalReleasePersistenceAllowed ||
    guard.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_receipt_decoder_adapter_runtime_input_construction_guard_rejects_release_side_effects");
  }

  return guard;
}

export type LiveDirectBuyerRuntimeInputConstructionTestOnlyGate = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT;
  readonly mode: "runtime_input_construction_test_only_gate";
  readonly status: "open_test_only";
  readonly sourceConstructionGuardContract: typeof LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT;
  readonly constructionGuardValidated: true;
  readonly testOnlyGateRequired: true;
  readonly testOnlyGatePresent: true;
  readonly testOnlyGateSatisfied: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly testOnlyAuthorityOpened: true;
  readonly constructionStillDeferred: true;
  readonly constructionAllowed: false;
  readonly constructionAttempted: false;
  readonly constructionBlocked: true;
  readonly constructionBlockReason: "construction_deferred_after_test_only_gate";
  readonly runtimeInputDescriptorPresent: true;
  readonly runtimeInputDescriptorOnly: true;
  readonly runtimeDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputReady: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly receiptMaterialAccepted: false;
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

export function openLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(
  guard: LiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard,
): LiveDirectBuyerRuntimeInputConstructionTestOnlyGate {
  const validatedGuard = validateLiveDirectBuyerReceiptDecoderAdapterRuntimeInputConstructionGuard(guard);

  if (validatedGuard.constructionBlocked !== true || validatedGuard.constructionEnabled !== false) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_requires_disabled_blocked_guard");
  }
  if (validatedGuard.runtimeDecoderInputObjectBuilt || validatedGuard.actualDecoderInputObjectBuilt) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_rejects_prebuilt_runtime_input");
  }

  return {
    contract: LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT,
    mode: "runtime_input_construction_test_only_gate",
    status: "open_test_only",
    sourceConstructionGuardContract: LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT,
    constructionGuardValidated: true,
    testOnlyGateRequired: true,
    testOnlyGatePresent: true,
    testOnlyGateSatisfied: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    testOnlyAuthorityOpened: true,
    constructionStillDeferred: true,
    constructionAllowed: false,
    constructionAttempted: false,
    constructionBlocked: true,
    constructionBlockReason: "construction_deferred_after_test_only_gate",
    runtimeInputDescriptorPresent: true,
    runtimeInputDescriptorOnly: true,
    runtimeDecoderInputObjectBuilt: false,
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputReady: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    receiptMaterialAccepted: false,
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

export function validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(
  gate: LiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
): LiveDirectBuyerRuntimeInputConstructionTestOnlyGate {
  if (gate.contract !== LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_unexpected_contract");
  }
  if (gate.mode !== "runtime_input_construction_test_only_gate") {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_unexpected_mode");
  }
  if (gate.status !== "open_test_only") {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_unexpected_status");
  }
  if (gate.sourceConstructionGuardContract !== LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_RUNTIME_INPUT_CONSTRUCTION_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_unexpected_source_guard_contract");
  }
  if (
    gate.constructionGuardValidated !== true ||
    gate.testOnlyGateRequired !== true ||
    gate.testOnlyGatePresent !== true ||
    gate.testOnlyGateSatisfied !== true ||
    gate.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_requires_test_only_authority");
  }
  if (
    gate.productionEnablementPresent ||
    gate.productionEnablementAccepted ||
    gate.productionConstructionAllowed ||
    gate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_rejects_production_enablement");
  }
  if (
    gate.constructionStillDeferred !== true ||
    gate.constructionAllowed ||
    gate.constructionAttempted ||
    gate.constructionBlocked !== true ||
    gate.constructionBlockReason !== "construction_deferred_after_test_only_gate"
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_requires_deferred_blocked_construction");
  }
  if (gate.runtimeInputDescriptorPresent !== true || gate.runtimeInputDescriptorOnly !== true) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_requires_descriptor_only_context");
  }
  if (
    gate.runtimeDecoderInputObjectBuilt ||
    gate.actualDecoderInputObjectBuilt ||
    gate.actualDecoderInputReady ||
    gate.decoderInvocationAllowed ||
    gate.decoderInvocationAttempted ||
    gate.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_rejects_runtime_input_or_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    gate.receiptMaterialAccepted ||
    gate.receiptMaterialIncluded ||
    gate.receiptJwsIncluded ||
    gate.receiptPayloadIncluded ||
    gate.receiptBytesIncluded ||
    gate.receiptObjectIncluded ||
    gate.rawReceiptIncluded ||
    gate.rawProofIncluded ||
    gate.settlementFieldsIncluded ||
    gate.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_rejects_receipt_material");
  }

  if (
    !gate.paymentRequiredContextBound ||
    !gate.nonceBound ||
    !gate.resourceBound ||
    !gate.contractBound ||
    !gate.merchantBound ||
    !gate.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_requires_payment_required_binding");
  }

  if (
    gate.decodedReceiptProduced ||
    gate.decodedReceiptVerified ||
    gate.decoderResultProduced ||
    gate.decoderResultReleaseConsumable ||
    gate.decoderResultConsumedByReleaseDecision ||
    gate.releaseDecisionMutatedByDecoderResult ||
    gate.paymentResponseEmissionAllowed ||
    gate.crpFulfillAllowed ||
    gate.replayMutationAllowed ||
    gate.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_test_only_gate_rejects_release_side_effects");
  }

  return gate;
}
