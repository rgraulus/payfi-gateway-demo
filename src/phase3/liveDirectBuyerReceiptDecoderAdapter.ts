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

export const LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.runtimeInputConstructionDryRun.v1" as const;

export const LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.sanitizedRuntimeInputShape.v1" as const;

export const LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.testOnlyRuntimeInputObject.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputGuard.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputTestOnlyGate.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputDryRun.v1" as const;

export const LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.sanitizedActualDecoderInputShape.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputObject.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputPassToDecoderGuard.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputPassThroughTestOnlyGate.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputInvocationDryRun.v1" as const;

export const LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.actualDecoderInputNonDecodedSeamResult.v1" as const;

export const LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.receiptMaterialAcceptanceGate.v1" as const;

export const LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.testOnlyRealDecoderInvocation.v1" as const;

export const LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.decodedResultConsumptionDryRun.v1" as const;

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

export type LiveDirectBuyerRuntimeInputConstructionDryRun = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT;
  readonly mode: "runtime_input_construction_test_only_dry_run";
  readonly status: "dry_run_observed";
  readonly sourceTestOnlyGateContract: typeof LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT;
  readonly testOnlyGateValidated: true;
  readonly testOnlyGateSatisfied: true;
  readonly dryRunRequired: true;
  readonly dryRunPresent: true;
  readonly dryRunSatisfied: true;
  readonly dryRunAttemptObserved: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly testOnlyAuthorityOpened: true;
  readonly constructionDryRunOnly: true;
  readonly constructionAllowed: false;
  readonly constructionAttempted: true;
  readonly constructionObserved: true;
  readonly constructionStillDeferred: true;
  readonly constructionBlocked: true;
  readonly constructionBlockReason: "runtime_input_construction_dry_run_only";
  readonly runtimeInputShapeProjected: false;
  readonly runtimeInputShapeValidated: false;
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
  readonly sideEffectFree: true;
};

export function observeLiveDirectBuyerRuntimeInputConstructionDryRun(
  gate: LiveDirectBuyerRuntimeInputConstructionTestOnlyGate,
): LiveDirectBuyerRuntimeInputConstructionDryRun {
  const validatedGate = validateLiveDirectBuyerRuntimeInputConstructionTestOnlyGate(gate);

  if (validatedGate.testOnlyGateSatisfied !== true || validatedGate.testOnlyAuthorityOpened !== true) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_requires_open_test_only_gate");
  }
  if (
    validatedGate.productionEnablementPresent ||
    validatedGate.productionEnablementAccepted ||
    validatedGate.productionConstructionAllowed ||
    validatedGate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_production_enablement");
  }
  if (validatedGate.runtimeDecoderInputObjectBuilt || validatedGate.actualDecoderInputObjectBuilt) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_prebuilt_runtime_input");
  }

  return {
    contract: LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT,
    mode: "runtime_input_construction_test_only_dry_run",
    status: "dry_run_observed",
    sourceTestOnlyGateContract: LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT,
    testOnlyGateValidated: true,
    testOnlyGateSatisfied: true,
    dryRunRequired: true,
    dryRunPresent: true,
    dryRunSatisfied: true,
    dryRunAttemptObserved: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    testOnlyAuthorityOpened: true,
    constructionDryRunOnly: true,
    constructionAllowed: false,
    constructionAttempted: true,
    constructionObserved: true,
    constructionStillDeferred: true,
    constructionBlocked: true,
    constructionBlockReason: "runtime_input_construction_dry_run_only",
    runtimeInputShapeProjected: false,
    runtimeInputShapeValidated: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerRuntimeInputConstructionDryRun(
  dryRun: LiveDirectBuyerRuntimeInputConstructionDryRun,
): LiveDirectBuyerRuntimeInputConstructionDryRun {
  if (dryRun.contract !== LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_unexpected_contract");
  }
  if (dryRun.mode !== "runtime_input_construction_test_only_dry_run") {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_unexpected_mode");
  }
  if (dryRun.status !== "dry_run_observed") {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_unexpected_status");
  }
  if (dryRun.sourceTestOnlyGateContract !== LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_unexpected_source_gate_contract");
  }
  if (
    dryRun.testOnlyGateValidated !== true ||
    dryRun.testOnlyGateSatisfied !== true ||
    dryRun.dryRunRequired !== true ||
    dryRun.dryRunPresent !== true ||
    dryRun.dryRunSatisfied !== true ||
    dryRun.dryRunAttemptObserved !== true ||
    dryRun.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_requires_test_only_dry_run_authority");
  }
  if (
    dryRun.productionEnablementPresent ||
    dryRun.productionEnablementAccepted ||
    dryRun.productionConstructionAllowed ||
    dryRun.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_production_enablement");
  }
  if (
    dryRun.constructionDryRunOnly !== true ||
    dryRun.constructionAllowed ||
    dryRun.constructionAttempted !== true ||
    dryRun.constructionObserved !== true ||
    dryRun.constructionStillDeferred !== true ||
    dryRun.constructionBlocked !== true ||
    dryRun.constructionBlockReason !== "runtime_input_construction_dry_run_only"
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_requires_observed_deferred_dry_run");
  }
  if (dryRun.runtimeInputShapeProjected || dryRun.runtimeInputShapeValidated) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_runtime_input_shape_projection");
  }
  if (dryRun.runtimeInputDescriptorPresent !== true || dryRun.runtimeInputDescriptorOnly !== true) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_requires_descriptor_only_context");
  }
  if (
    dryRun.runtimeDecoderInputObjectBuilt ||
    dryRun.actualDecoderInputObjectBuilt ||
    dryRun.actualDecoderInputReady ||
    dryRun.decoderInvocationAllowed ||
    dryRun.decoderInvocationAttempted ||
    dryRun.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_runtime_input_or_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    dryRun.receiptMaterialAccepted ||
    dryRun.receiptMaterialIncluded ||
    dryRun.receiptJwsIncluded ||
    dryRun.receiptPayloadIncluded ||
    dryRun.receiptBytesIncluded ||
    dryRun.receiptObjectIncluded ||
    dryRun.rawReceiptIncluded ||
    dryRun.rawProofIncluded ||
    dryRun.settlementFieldsIncluded ||
    dryRun.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_receipt_material");
  }

  if (
    !dryRun.paymentRequiredContextBound ||
    !dryRun.nonceBound ||
    !dryRun.resourceBound ||
    !dryRun.contractBound ||
    !dryRun.merchantBound ||
    !dryRun.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_requires_payment_required_binding");
  }

  if (
    dryRun.decodedReceiptProduced ||
    dryRun.decodedReceiptVerified ||
    dryRun.decoderResultProduced ||
    dryRun.decoderResultReleaseConsumable ||
    dryRun.decoderResultConsumedByReleaseDecision ||
    dryRun.releaseDecisionMutatedByDecoderResult ||
    dryRun.paymentResponseEmissionAllowed ||
    dryRun.crpFulfillAllowed ||
    dryRun.replayMutationAllowed ||
    dryRun.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_runtime_input_construction_dry_run_rejects_release_side_effects");
  }

  return dryRun;
}

export type LiveDirectBuyerSanitizedRuntimeInputShape = {
  readonly contract: typeof LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT;
  readonly mode: "sanitized_runtime_input_shape_contract";
  readonly status: "shape_contract_ready";
  readonly sourceDryRunContract: typeof LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT;
  readonly dryRunValidated: true;
  readonly dryRunObserved: true;
  readonly dryRunAttemptObserved: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly runtimeInputShapeProjected: true;
  readonly runtimeInputShapeValidated: true;
  readonly runtimeInputShapeMetadataOnly: true;
  readonly runtimeInputShapeSanitized: true;
  readonly runtimeInputShapeBoundToPaymentRequired: true;
  readonly runtimeInputShapeNonceBound: true;
  readonly runtimeInputShapeResourceBound: true;
  readonly runtimeInputShapeContractBound: true;
  readonly runtimeInputShapeMerchantBound: true;
  readonly runtimeInputShapePaymentTupleBound: true;
  readonly runtimeInputShapeReceiptMaterialFree: true;
  readonly runtimeInputShapeReplayFree: true;
  readonly runtimeInputShapeSettlementFree: true;
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
  readonly sideEffectFree: true;
};

export function projectLiveDirectBuyerSanitizedRuntimeInputShape(
  dryRun: LiveDirectBuyerRuntimeInputConstructionDryRun,
): LiveDirectBuyerSanitizedRuntimeInputShape {
  const validatedDryRun = validateLiveDirectBuyerRuntimeInputConstructionDryRun(dryRun);

  if (validatedDryRun.dryRunAttemptObserved !== true || validatedDryRun.testOnlyAuthorityOpened !== true) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_requires_observed_dry_run");
  }
  if (
    validatedDryRun.productionEnablementPresent ||
    validatedDryRun.productionEnablementAccepted ||
    validatedDryRun.productionConstructionAllowed ||
    validatedDryRun.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_production_enablement");
  }
  if (validatedDryRun.runtimeDecoderInputObjectBuilt || validatedDryRun.actualDecoderInputObjectBuilt) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_prebuilt_runtime_input");
  }

  return {
    contract: LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT,
    mode: "sanitized_runtime_input_shape_contract",
    status: "shape_contract_ready",
    sourceDryRunContract: LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT,
    dryRunValidated: true,
    dryRunObserved: true,
    dryRunAttemptObserved: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    runtimeInputShapeProjected: true,
    runtimeInputShapeValidated: true,
    runtimeInputShapeMetadataOnly: true,
    runtimeInputShapeSanitized: true,
    runtimeInputShapeBoundToPaymentRequired: true,
    runtimeInputShapeNonceBound: true,
    runtimeInputShapeResourceBound: true,
    runtimeInputShapeContractBound: true,
    runtimeInputShapeMerchantBound: true,
    runtimeInputShapePaymentTupleBound: true,
    runtimeInputShapeReceiptMaterialFree: true,
    runtimeInputShapeReplayFree: true,
    runtimeInputShapeSettlementFree: true,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerSanitizedRuntimeInputShape(
  shape: LiveDirectBuyerSanitizedRuntimeInputShape,
): LiveDirectBuyerSanitizedRuntimeInputShape {
  if (shape.contract !== LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_unexpected_contract");
  }
  if (shape.mode !== "sanitized_runtime_input_shape_contract") {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_unexpected_mode");
  }
  if (shape.status !== "shape_contract_ready") {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_unexpected_status");
  }
  if (shape.sourceDryRunContract !== LIVE_DIRECT_BUYER_RUNTIME_INPUT_CONSTRUCTION_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_unexpected_source_dry_run_contract");
  }
  if (
    shape.dryRunValidated !== true ||
    shape.dryRunObserved !== true ||
    shape.dryRunAttemptObserved !== true ||
    shape.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_requires_validated_observed_dry_run");
  }
  if (
    shape.productionEnablementPresent ||
    shape.productionEnablementAccepted ||
    shape.productionConstructionAllowed ||
    shape.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_production_enablement");
  }
  if (
    shape.runtimeInputShapeProjected !== true ||
    shape.runtimeInputShapeValidated !== true ||
    shape.runtimeInputShapeMetadataOnly !== true ||
    shape.runtimeInputShapeSanitized !== true ||
    shape.runtimeInputShapeBoundToPaymentRequired !== true ||
    shape.runtimeInputShapeNonceBound !== true ||
    shape.runtimeInputShapeResourceBound !== true ||
    shape.runtimeInputShapeContractBound !== true ||
    shape.runtimeInputShapeMerchantBound !== true ||
    shape.runtimeInputShapePaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_requires_sanitized_payment_required_bound_shape");
  }
  if (
    shape.runtimeInputShapeReceiptMaterialFree !== true ||
    shape.runtimeInputShapeReplayFree !== true ||
    shape.runtimeInputShapeSettlementFree !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_requires_material_replay_settlement_free_shape");
  }
  if (shape.runtimeInputDescriptorPresent !== true || shape.runtimeInputDescriptorOnly !== true) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_requires_descriptor_only_context");
  }
  if (
    shape.runtimeDecoderInputObjectBuilt ||
    shape.actualDecoderInputObjectBuilt ||
    shape.actualDecoderInputReady ||
    shape.decoderInvocationAllowed ||
    shape.decoderInvocationAttempted ||
    shape.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_runtime_input_or_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    shape.receiptMaterialAccepted ||
    shape.receiptMaterialIncluded ||
    shape.receiptJwsIncluded ||
    shape.receiptPayloadIncluded ||
    shape.receiptBytesIncluded ||
    shape.receiptObjectIncluded ||
    shape.rawReceiptIncluded ||
    shape.rawProofIncluded ||
    shape.settlementFieldsIncluded ||
    shape.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_receipt_material");
  }

  if (
    shape.decodedReceiptProduced ||
    shape.decodedReceiptVerified ||
    shape.decoderResultProduced ||
    shape.decoderResultReleaseConsumable ||
    shape.decoderResultConsumedByReleaseDecision ||
    shape.releaseDecisionMutatedByDecoderResult ||
    shape.paymentResponseEmissionAllowed ||
    shape.crpFulfillAllowed ||
    shape.replayMutationAllowed ||
    shape.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_runtime_input_shape_rejects_release_side_effects");
  }

  return shape;
}

export type LiveDirectBuyerTestOnlyRuntimeInputObject = {
  readonly contract: typeof LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT;
  readonly mode: "test_only_runtime_input_object_construction";
  readonly status: "runtime_input_object_constructed_test_only";
  readonly sourceShapeContract: typeof LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT;
  readonly shapeValidated: true;
  readonly shapeProjected: true;
  readonly shapeMetadataOnly: true;
  readonly shapeSanitized: true;
  readonly shapeBoundToPaymentRequired: true;
  readonly testOnlyConstructionRequired: true;
  readonly testOnlyConstructionPresent: true;
  readonly testOnlyConstructionSatisfied: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly runtimeInputObjectKind: "test_only_sanitized_runtime_input_object";
  readonly runtimeInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectMetadataOnly: true;
  readonly runtimeDecoderInputObjectSanitized: true;
  readonly runtimeDecoderInputObjectBoundToPaymentRequired: true;
  readonly runtimeDecoderInputObjectNonceBound: true;
  readonly runtimeDecoderInputObjectResourceBound: true;
  readonly runtimeDecoderInputObjectContractBound: true;
  readonly runtimeDecoderInputObjectMerchantBound: true;
  readonly runtimeDecoderInputObjectPaymentTupleBound: true;
  readonly runtimeDecoderInputObjectReceiptMaterialFree: true;
  readonly runtimeDecoderInputObjectReplayFree: true;
  readonly runtimeDecoderInputObjectSettlementFree: true;
  readonly runtimeDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectReady: false;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function constructLiveDirectBuyerTestOnlyRuntimeInputObject(
  shape: LiveDirectBuyerSanitizedRuntimeInputShape,
): LiveDirectBuyerTestOnlyRuntimeInputObject {
  const validatedShape = validateLiveDirectBuyerSanitizedRuntimeInputShape(shape);

  if (
    validatedShape.runtimeInputShapeProjected !== true ||
    validatedShape.runtimeInputShapeValidated !== true ||
    validatedShape.runtimeInputShapeMetadataOnly !== true ||
    validatedShape.runtimeInputShapeSanitized !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_validated_sanitized_shape");
  }
  if (
    validatedShape.productionEnablementPresent ||
    validatedShape.productionEnablementAccepted ||
    validatedShape.productionConstructionAllowed ||
    validatedShape.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_production_enablement");
  }
  if (validatedShape.runtimeDecoderInputObjectBuilt || validatedShape.actualDecoderInputObjectBuilt) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_prebuilt_runtime_input");
  }

  return {
    contract: LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT,
    mode: "test_only_runtime_input_object_construction",
    status: "runtime_input_object_constructed_test_only",
    sourceShapeContract: LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT,
    shapeValidated: true,
    shapeProjected: true,
    shapeMetadataOnly: true,
    shapeSanitized: true,
    shapeBoundToPaymentRequired: true,
    testOnlyConstructionRequired: true,
    testOnlyConstructionPresent: true,
    testOnlyConstructionSatisfied: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    runtimeInputObjectKind: "test_only_sanitized_runtime_input_object",
    runtimeInputObjectBuilt: true,
    runtimeDecoderInputObjectBuilt: true,
    runtimeDecoderInputObjectMetadataOnly: true,
    runtimeDecoderInputObjectSanitized: true,
    runtimeDecoderInputObjectBoundToPaymentRequired: true,
    runtimeDecoderInputObjectNonceBound: true,
    runtimeDecoderInputObjectResourceBound: true,
    runtimeDecoderInputObjectContractBound: true,
    runtimeDecoderInputObjectMerchantBound: true,
    runtimeDecoderInputObjectPaymentTupleBound: true,
    runtimeDecoderInputObjectReceiptMaterialFree: true,
    runtimeDecoderInputObjectReplayFree: true,
    runtimeDecoderInputObjectSettlementFree: true,
    runtimeDecoderInputObjectNonDecodable: true,
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputObjectReady: false,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerTestOnlyRuntimeInputObject(
  runtimeInput: LiveDirectBuyerTestOnlyRuntimeInputObject,
): LiveDirectBuyerTestOnlyRuntimeInputObject {
  if (runtimeInput.contract !== LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_unexpected_contract");
  }
  if (runtimeInput.mode !== "test_only_runtime_input_object_construction") {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_unexpected_mode");
  }
  if (runtimeInput.status !== "runtime_input_object_constructed_test_only") {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_unexpected_status");
  }
  if (runtimeInput.sourceShapeContract !== LIVE_DIRECT_BUYER_SANITIZED_RUNTIME_INPUT_SHAPE_CONTRACT) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_unexpected_source_shape_contract");
  }
  if (
    runtimeInput.shapeValidated !== true ||
    runtimeInput.shapeProjected !== true ||
    runtimeInput.shapeMetadataOnly !== true ||
    runtimeInput.shapeSanitized !== true ||
    runtimeInput.shapeBoundToPaymentRequired !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_validated_sanitized_bound_shape");
  }
  if (
    runtimeInput.testOnlyConstructionRequired !== true ||
    runtimeInput.testOnlyConstructionPresent !== true ||
    runtimeInput.testOnlyConstructionSatisfied !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_test_only_construction_authority");
  }
  if (
    runtimeInput.productionEnablementPresent ||
    runtimeInput.productionEnablementAccepted ||
    runtimeInput.productionConstructionAllowed ||
    runtimeInput.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_production_enablement");
  }
  if (
    runtimeInput.runtimeInputObjectKind !== "test_only_sanitized_runtime_input_object" ||
    runtimeInput.runtimeInputObjectBuilt !== true ||
    runtimeInput.runtimeDecoderInputObjectBuilt !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_test_only_runtime_object");
  }
  if (
    runtimeInput.runtimeDecoderInputObjectMetadataOnly !== true ||
    runtimeInput.runtimeDecoderInputObjectSanitized !== true ||
    runtimeInput.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    runtimeInput.runtimeDecoderInputObjectNonceBound !== true ||
    runtimeInput.runtimeDecoderInputObjectResourceBound !== true ||
    runtimeInput.runtimeDecoderInputObjectContractBound !== true ||
    runtimeInput.runtimeDecoderInputObjectMerchantBound !== true ||
    runtimeInput.runtimeDecoderInputObjectPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_sanitized_payment_required_bound_runtime_object");
  }
  if (
    runtimeInput.runtimeDecoderInputObjectReceiptMaterialFree !== true ||
    runtimeInput.runtimeDecoderInputObjectReplayFree !== true ||
    runtimeInput.runtimeDecoderInputObjectSettlementFree !== true ||
    runtimeInput.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_requires_non_decodable_material_free_runtime_object");
  }
  if (
    runtimeInput.actualDecoderInputObjectBuilt ||
    runtimeInput.actualDecoderInputObjectReady ||
    runtimeInput.actualDecoderInputObjectPassedToDecoder ||
    runtimeInput.decoderInvocationAllowed ||
    runtimeInput.decoderInvocationAttempted ||
    runtimeInput.decoderInvoked ||
    runtimeInput.realDecoderAdapterInvoked ||
    runtimeInput.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_actual_decoder_input_or_invocation");
  }

  const prohibitedReceiptMaterial =
    runtimeInput.receiptMaterialAccepted ||
    runtimeInput.receiptMaterialIncluded ||
    runtimeInput.receiptJwsIncluded ||
    runtimeInput.receiptPayloadIncluded ||
    runtimeInput.receiptBytesIncluded ||
    runtimeInput.receiptObjectIncluded ||
    runtimeInput.rawReceiptIncluded ||
    runtimeInput.rawProofIncluded ||
    runtimeInput.settlementFieldsIncluded ||
    runtimeInput.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_receipt_material");
  }

  if (
    runtimeInput.decodedReceiptProduced ||
    runtimeInput.decodedReceiptVerified ||
    runtimeInput.decoderResultProduced ||
    runtimeInput.decoderResultReleaseConsumable ||
    runtimeInput.decoderResultConsumedByReleaseDecision ||
    runtimeInput.releaseDecisionMutatedByDecoderResult ||
    runtimeInput.paymentResponseEmissionAllowed ||
    runtimeInput.crpFulfillAllowed ||
    runtimeInput.replayMutationAllowed ||
    runtimeInput.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_runtime_input_object_rejects_release_side_effects");
  }

  return runtimeInput;
}

export type LiveDirectBuyerActualDecoderInputGuard = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT;
  readonly mode: "actual_decoder_input_guard";
  readonly status: "actual_decoder_input_blocked";
  readonly sourceRuntimeInputObjectContract: typeof LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT;
  readonly runtimeInputObjectValidated: true;
  readonly runtimeInputObjectPresent: true;
  readonly runtimeInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectMetadataOnly: true;
  readonly runtimeDecoderInputObjectSanitized: true;
  readonly runtimeDecoderInputObjectBoundToPaymentRequired: true;
  readonly runtimeDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputConstructionRecognizedAsFutureStep: true;
  readonly actualDecoderInputConstructionAttempted: true;
  readonly actualDecoderInputConstructionAllowed: false;
  readonly actualDecoderInputConstructionBlocked: true;
  readonly actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_disabled";
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectReady: false;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function guardLiveDirectBuyerActualDecoderInputConstruction(
  runtimeInput: LiveDirectBuyerTestOnlyRuntimeInputObject,
): LiveDirectBuyerActualDecoderInputGuard {
  const validatedRuntimeInput = validateLiveDirectBuyerTestOnlyRuntimeInputObject(runtimeInput);

  if (
    validatedRuntimeInput.runtimeInputObjectBuilt !== true ||
    validatedRuntimeInput.runtimeDecoderInputObjectBuilt !== true ||
    validatedRuntimeInput.runtimeDecoderInputObjectMetadataOnly !== true ||
    validatedRuntimeInput.runtimeDecoderInputObjectSanitized !== true ||
    validatedRuntimeInput.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    validatedRuntimeInput.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_requires_validated_test_only_runtime_input");
  }
  if (
    validatedRuntimeInput.actualDecoderInputObjectBuilt ||
    validatedRuntimeInput.actualDecoderInputObjectReady ||
    validatedRuntimeInput.actualDecoderInputObjectPassedToDecoder ||
    validatedRuntimeInput.decoderInvocationAllowed ||
    validatedRuntimeInput.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_rejects_prebuilt_actual_decoder_input_or_invocation");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT,
    mode: "actual_decoder_input_guard",
    status: "actual_decoder_input_blocked",
    sourceRuntimeInputObjectContract: LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT,
    runtimeInputObjectValidated: true,
    runtimeInputObjectPresent: true,
    runtimeInputObjectBuilt: true,
    runtimeDecoderInputObjectBuilt: true,
    runtimeDecoderInputObjectMetadataOnly: true,
    runtimeDecoderInputObjectSanitized: true,
    runtimeDecoderInputObjectBoundToPaymentRequired: true,
    runtimeDecoderInputObjectNonDecodable: true,
    actualDecoderInputConstructionRecognizedAsFutureStep: true,
    actualDecoderInputConstructionAttempted: true,
    actualDecoderInputConstructionAllowed: false,
    actualDecoderInputConstructionBlocked: true,
    actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_disabled",
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputObjectReady: false,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputGuard(
  guard: LiveDirectBuyerActualDecoderInputGuard,
): LiveDirectBuyerActualDecoderInputGuard {
  if (guard.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_unexpected_contract");
  }
  if (guard.mode !== "actual_decoder_input_guard") {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_unexpected_mode");
  }
  if (guard.status !== "actual_decoder_input_blocked") {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_unexpected_status");
  }
  if (guard.sourceRuntimeInputObjectContract !== LIVE_DIRECT_BUYER_TEST_ONLY_RUNTIME_INPUT_OBJECT_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_unexpected_source_runtime_input_object_contract");
  }
  if (
    guard.runtimeInputObjectValidated !== true ||
    guard.runtimeInputObjectPresent !== true ||
    guard.runtimeInputObjectBuilt !== true ||
    guard.runtimeDecoderInputObjectBuilt !== true ||
    guard.runtimeDecoderInputObjectMetadataOnly !== true ||
    guard.runtimeDecoderInputObjectSanitized !== true ||
    guard.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    guard.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_requires_validated_test_only_runtime_input");
  }
  if (
    guard.actualDecoderInputConstructionRecognizedAsFutureStep !== true ||
    guard.actualDecoderInputConstructionAttempted !== true ||
    guard.actualDecoderInputConstructionAllowed ||
    guard.actualDecoderInputConstructionBlocked !== true ||
    guard.actualDecoderInputConstructionBlockReason !== "actual_decoder_input_construction_disabled"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_requires_blocked_actual_decoder_input_construction");
  }
  if (
    guard.actualDecoderInputObjectBuilt ||
    guard.actualDecoderInputObjectReady ||
    guard.actualDecoderInputObjectPassedToDecoder ||
    guard.decoderInvocationAllowed ||
    guard.decoderInvocationAttempted ||
    guard.decoderInvoked ||
    guard.realDecoderAdapterInvoked ||
    guard.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_rejects_actual_decoder_input_or_invocation");
  }

  const prohibitedReceiptMaterial =
    guard.receiptMaterialAccepted ||
    guard.receiptMaterialIncluded ||
    guard.receiptJwsIncluded ||
    guard.receiptPayloadIncluded ||
    guard.receiptBytesIncluded ||
    guard.receiptObjectIncluded ||
    guard.rawReceiptIncluded ||
    guard.rawProofIncluded ||
    guard.settlementFieldsIncluded ||
    guard.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_rejects_receipt_material");
  }

  if (
    !guard.paymentRequiredContextBound ||
    !guard.nonceBound ||
    !guard.resourceBound ||
    !guard.contractBound ||
    !guard.merchantBound ||
    !guard.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_requires_payment_required_binding");
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
    guard.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_guard_rejects_release_side_effects");
  }

  return guard;
}

export type LiveDirectBuyerActualDecoderInputTestOnlyGate = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT;
  readonly mode: "actual_decoder_input_test_only_gate";
  readonly status: "open_test_only";
  readonly sourceActualDecoderInputGuardContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT;
  readonly actualDecoderInputGuardValidated: true;
  readonly testOnlyGateRequired: true;
  readonly testOnlyGatePresent: true;
  readonly testOnlyGateSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly runtimeInputObjectPresent: true;
  readonly runtimeInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectMetadataOnly: true;
  readonly runtimeDecoderInputObjectSanitized: true;
  readonly runtimeDecoderInputObjectBoundToPaymentRequired: true;
  readonly runtimeDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputConstructionStillDeferred: true;
  readonly actualDecoderInputConstructionAllowed: false;
  readonly actualDecoderInputConstructionAttempted: false;
  readonly actualDecoderInputConstructionBlocked: true;
  readonly actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_deferred_after_test_only_gate";
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectReady: false;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function openLiveDirectBuyerActualDecoderInputTestOnlyGate(
  guard: LiveDirectBuyerActualDecoderInputGuard,
): LiveDirectBuyerActualDecoderInputTestOnlyGate {
  const validatedGuard = validateLiveDirectBuyerActualDecoderInputGuard(guard);

  if (
    validatedGuard.actualDecoderInputConstructionBlocked !== true ||
    validatedGuard.actualDecoderInputConstructionAllowed ||
    validatedGuard.actualDecoderInputObjectBuilt ||
    validatedGuard.decoderInvocationAllowed ||
    validatedGuard.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_requires_blocked_actual_decoder_input_guard");
  }
  if (
    validatedGuard.receiptMaterialAccepted ||
    validatedGuard.receiptMaterialIncluded ||
    validatedGuard.receiptJwsIncluded ||
    validatedGuard.receiptPayloadIncluded ||
    validatedGuard.rawReceiptIncluded ||
    validatedGuard.rawProofIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_rejects_receipt_material");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT,
    mode: "actual_decoder_input_test_only_gate",
    status: "open_test_only",
    sourceActualDecoderInputGuardContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT,
    actualDecoderInputGuardValidated: true,
    testOnlyGateRequired: true,
    testOnlyGatePresent: true,
    testOnlyGateSatisfied: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    runtimeInputObjectPresent: true,
    runtimeInputObjectBuilt: true,
    runtimeDecoderInputObjectBuilt: true,
    runtimeDecoderInputObjectMetadataOnly: true,
    runtimeDecoderInputObjectSanitized: true,
    runtimeDecoderInputObjectBoundToPaymentRequired: true,
    runtimeDecoderInputObjectNonDecodable: true,
    actualDecoderInputConstructionStillDeferred: true,
    actualDecoderInputConstructionAllowed: false,
    actualDecoderInputConstructionAttempted: false,
    actualDecoderInputConstructionBlocked: true,
    actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_deferred_after_test_only_gate",
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputObjectReady: false,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputTestOnlyGate(
  gate: LiveDirectBuyerActualDecoderInputTestOnlyGate,
): LiveDirectBuyerActualDecoderInputTestOnlyGate {
  if (gate.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_unexpected_contract");
  }
  if (gate.mode !== "actual_decoder_input_test_only_gate") {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_unexpected_mode");
  }
  if (gate.status !== "open_test_only") {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_unexpected_status");
  }
  if (gate.sourceActualDecoderInputGuardContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_unexpected_source_guard_contract");
  }
  if (
    gate.actualDecoderInputGuardValidated !== true ||
    gate.testOnlyGateRequired !== true ||
    gate.testOnlyGatePresent !== true ||
    gate.testOnlyGateSatisfied !== true ||
    gate.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_requires_test_only_authority");
  }
  if (
    gate.productionEnablementPresent ||
    gate.productionEnablementAccepted ||
    gate.productionConstructionAllowed ||
    gate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_rejects_production_enablement");
  }
  if (
    gate.runtimeInputObjectPresent !== true ||
    gate.runtimeInputObjectBuilt !== true ||
    gate.runtimeDecoderInputObjectBuilt !== true ||
    gate.runtimeDecoderInputObjectMetadataOnly !== true ||
    gate.runtimeDecoderInputObjectSanitized !== true ||
    gate.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    gate.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_requires_validated_runtime_input_object");
  }
  if (
    gate.actualDecoderInputConstructionStillDeferred !== true ||
    gate.actualDecoderInputConstructionAllowed ||
    gate.actualDecoderInputConstructionAttempted ||
    gate.actualDecoderInputConstructionBlocked !== true ||
    gate.actualDecoderInputConstructionBlockReason !== "actual_decoder_input_construction_deferred_after_test_only_gate"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_requires_deferred_blocked_actual_decoder_input_construction");
  }
  if (
    gate.actualDecoderInputObjectBuilt ||
    gate.actualDecoderInputObjectReady ||
    gate.actualDecoderInputObjectPassedToDecoder ||
    gate.decoderInvocationAllowed ||
    gate.decoderInvocationAttempted ||
    gate.decoderInvoked ||
    gate.realDecoderAdapterInvoked ||
    gate.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_rejects_actual_decoder_input_or_invocation");
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
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_rejects_receipt_material");
  }

  if (
    !gate.paymentRequiredContextBound ||
    !gate.nonceBound ||
    !gate.resourceBound ||
    !gate.contractBound ||
    !gate.merchantBound ||
    !gate.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_requires_payment_required_binding");
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
    throw new Error("live_direct_buyer_actual_decoder_input_test_only_gate_rejects_release_side_effects");
  }

  return gate;
}

export type LiveDirectBuyerActualDecoderInputDryRun = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT;
  readonly mode: "actual_decoder_input_test_only_dry_run";
  readonly status: "dry_run_observed";
  readonly sourceTestOnlyGateContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT;
  readonly testOnlyGateValidated: true;
  readonly testOnlyGateSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly dryRunRequired: true;
  readonly dryRunPresent: true;
  readonly dryRunSatisfied: true;
  readonly dryRunAttemptObserved: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly runtimeInputObjectPresent: true;
  readonly runtimeInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectMetadataOnly: true;
  readonly runtimeDecoderInputObjectSanitized: true;
  readonly runtimeDecoderInputObjectBoundToPaymentRequired: true;
  readonly runtimeDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputDryRunOnly: true;
  readonly actualDecoderInputConstructionObserved: true;
  readonly actualDecoderInputConstructionAllowed: false;
  readonly actualDecoderInputConstructionAttempted: true;
  readonly actualDecoderInputConstructionStillDeferred: true;
  readonly actualDecoderInputConstructionBlocked: true;
  readonly actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_dry_run_only";
  readonly sanitizedActualDecoderInputShapeProjected: false;
  readonly sanitizedActualDecoderInputShapeValidated: false;
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectReady: false;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function observeLiveDirectBuyerActualDecoderInputDryRun(
  gate: LiveDirectBuyerActualDecoderInputTestOnlyGate,
): LiveDirectBuyerActualDecoderInputDryRun {
  const validatedGate = validateLiveDirectBuyerActualDecoderInputTestOnlyGate(gate);

  if (
    validatedGate.testOnlyGateSatisfied !== true ||
    validatedGate.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_requires_open_test_only_gate");
  }
  if (
    validatedGate.productionEnablementPresent ||
    validatedGate.productionEnablementAccepted ||
    validatedGate.productionConstructionAllowed ||
    validatedGate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_production_enablement");
  }
  if (
    validatedGate.actualDecoderInputObjectBuilt ||
    validatedGate.actualDecoderInputObjectReady ||
    validatedGate.actualDecoderInputObjectPassedToDecoder ||
    validatedGate.decoderInvocationAllowed ||
    validatedGate.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_prebuilt_actual_decoder_input_or_invocation");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT,
    mode: "actual_decoder_input_test_only_dry_run",
    status: "dry_run_observed",
    sourceTestOnlyGateContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT,
    testOnlyGateValidated: true,
    testOnlyGateSatisfied: true,
    testOnlyAuthorityOpened: true,
    dryRunRequired: true,
    dryRunPresent: true,
    dryRunSatisfied: true,
    dryRunAttemptObserved: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    runtimeInputObjectPresent: true,
    runtimeInputObjectBuilt: true,
    runtimeDecoderInputObjectBuilt: true,
    runtimeDecoderInputObjectMetadataOnly: true,
    runtimeDecoderInputObjectSanitized: true,
    runtimeDecoderInputObjectBoundToPaymentRequired: true,
    runtimeDecoderInputObjectNonDecodable: true,
    actualDecoderInputDryRunOnly: true,
    actualDecoderInputConstructionObserved: true,
    actualDecoderInputConstructionAllowed: false,
    actualDecoderInputConstructionAttempted: true,
    actualDecoderInputConstructionStillDeferred: true,
    actualDecoderInputConstructionBlocked: true,
    actualDecoderInputConstructionBlockReason: "actual_decoder_input_construction_dry_run_only",
    sanitizedActualDecoderInputShapeProjected: false,
    sanitizedActualDecoderInputShapeValidated: false,
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputObjectReady: false,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputDryRun(
  dryRun: LiveDirectBuyerActualDecoderInputDryRun,
): LiveDirectBuyerActualDecoderInputDryRun {
  if (dryRun.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_unexpected_contract");
  }
  if (dryRun.mode !== "actual_decoder_input_test_only_dry_run") {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_unexpected_mode");
  }
  if (dryRun.status !== "dry_run_observed") {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_unexpected_status");
  }
  if (dryRun.sourceTestOnlyGateContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_unexpected_source_gate_contract");
  }
  if (
    dryRun.testOnlyGateValidated !== true ||
    dryRun.testOnlyGateSatisfied !== true ||
    dryRun.testOnlyAuthorityOpened !== true ||
    dryRun.dryRunRequired !== true ||
    dryRun.dryRunPresent !== true ||
    dryRun.dryRunSatisfied !== true ||
    dryRun.dryRunAttemptObserved !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_requires_test_only_dry_run_authority");
  }
  if (
    dryRun.productionEnablementPresent ||
    dryRun.productionEnablementAccepted ||
    dryRun.productionConstructionAllowed ||
    dryRun.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_production_enablement");
  }
  if (
    dryRun.runtimeInputObjectPresent !== true ||
    dryRun.runtimeInputObjectBuilt !== true ||
    dryRun.runtimeDecoderInputObjectBuilt !== true ||
    dryRun.runtimeDecoderInputObjectMetadataOnly !== true ||
    dryRun.runtimeDecoderInputObjectSanitized !== true ||
    dryRun.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    dryRun.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_requires_validated_runtime_input_object");
  }
  if (
    dryRun.actualDecoderInputDryRunOnly !== true ||
    dryRun.actualDecoderInputConstructionObserved !== true ||
    dryRun.actualDecoderInputConstructionAllowed ||
    dryRun.actualDecoderInputConstructionAttempted !== true ||
    dryRun.actualDecoderInputConstructionStillDeferred !== true ||
    dryRun.actualDecoderInputConstructionBlocked !== true ||
    dryRun.actualDecoderInputConstructionBlockReason !== "actual_decoder_input_construction_dry_run_only"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_requires_observed_deferred_dry_run");
  }
  if (
    dryRun.sanitizedActualDecoderInputShapeProjected ||
    dryRun.sanitizedActualDecoderInputShapeValidated
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_shape_projection_inside_dry_run");
  }
  if (
    dryRun.actualDecoderInputObjectBuilt ||
    dryRun.actualDecoderInputObjectReady ||
    dryRun.actualDecoderInputObjectPassedToDecoder ||
    dryRun.decoderInvocationAllowed ||
    dryRun.decoderInvocationAttempted ||
    dryRun.decoderInvoked ||
    dryRun.realDecoderAdapterInvoked ||
    dryRun.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_actual_decoder_input_or_invocation");
  }

  const prohibitedReceiptMaterial =
    dryRun.receiptMaterialAccepted ||
    dryRun.receiptMaterialIncluded ||
    dryRun.receiptJwsIncluded ||
    dryRun.receiptPayloadIncluded ||
    dryRun.receiptBytesIncluded ||
    dryRun.receiptObjectIncluded ||
    dryRun.rawReceiptIncluded ||
    dryRun.rawProofIncluded ||
    dryRun.settlementFieldsIncluded ||
    dryRun.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_receipt_material");
  }

  if (
    !dryRun.paymentRequiredContextBound ||
    !dryRun.nonceBound ||
    !dryRun.resourceBound ||
    !dryRun.contractBound ||
    !dryRun.merchantBound ||
    !dryRun.paymentTupleBound
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_requires_payment_required_binding");
  }

  if (
    dryRun.decodedReceiptProduced ||
    dryRun.decodedReceiptVerified ||
    dryRun.decoderResultProduced ||
    dryRun.decoderResultReleaseConsumable ||
    dryRun.decoderResultConsumedByReleaseDecision ||
    dryRun.releaseDecisionMutatedByDecoderResult ||
    dryRun.paymentResponseEmissionAllowed ||
    dryRun.crpFulfillAllowed ||
    dryRun.replayMutationAllowed ||
    dryRun.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_dry_run_rejects_release_side_effects");
  }

  return dryRun;
}

export type LiveDirectBuyerSanitizedActualDecoderInputShape = {
  readonly contract: typeof LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT;
  readonly mode: "sanitized_actual_decoder_input_shape_contract";
  readonly status: "shape_contract_ready";
  readonly sourceDryRunContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT;
  readonly dryRunValidated: true;
  readonly dryRunObserved: true;
  readonly dryRunAttemptObserved: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly runtimeInputObjectPresent: true;
  readonly runtimeInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectBuilt: true;
  readonly runtimeDecoderInputObjectMetadataOnly: true;
  readonly runtimeDecoderInputObjectSanitized: true;
  readonly runtimeDecoderInputObjectBoundToPaymentRequired: true;
  readonly runtimeDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputShapeProjected: true;
  readonly actualDecoderInputShapeValidated: true;
  readonly actualDecoderInputShapeMetadataOnly: true;
  readonly actualDecoderInputShapeSanitized: true;
  readonly actualDecoderInputShapeBoundToPaymentRequired: true;
  readonly actualDecoderInputShapeNonceBound: true;
  readonly actualDecoderInputShapeResourceBound: true;
  readonly actualDecoderInputShapeContractBound: true;
  readonly actualDecoderInputShapeMerchantBound: true;
  readonly actualDecoderInputShapePaymentTupleBound: true;
  readonly actualDecoderInputShapeReceiptMaterialFree: true;
  readonly actualDecoderInputShapeReplayFree: true;
  readonly actualDecoderInputShapeSettlementFree: true;
  readonly actualDecoderInputShapeNonDecodable: true;
  readonly actualDecoderInputObjectBuilt: false;
  readonly actualDecoderInputObjectReady: false;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function projectLiveDirectBuyerSanitizedActualDecoderInputShape(
  dryRun: LiveDirectBuyerActualDecoderInputDryRun,
): LiveDirectBuyerSanitizedActualDecoderInputShape {
  const validatedDryRun = validateLiveDirectBuyerActualDecoderInputDryRun(dryRun);

  if (
    validatedDryRun.dryRunAttemptObserved !== true ||
    validatedDryRun.actualDecoderInputConstructionObserved !== true ||
    validatedDryRun.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_requires_observed_dry_run");
  }
  if (
    validatedDryRun.productionEnablementPresent ||
    validatedDryRun.productionEnablementAccepted ||
    validatedDryRun.productionConstructionAllowed ||
    validatedDryRun.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_production_enablement");
  }
  if (
    validatedDryRun.actualDecoderInputObjectBuilt ||
    validatedDryRun.actualDecoderInputObjectReady ||
    validatedDryRun.decoderInvocationAllowed ||
    validatedDryRun.decoderInvoked
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_prebuilt_actual_decoder_input_or_invocation");
  }

  return {
    contract: LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT,
    mode: "sanitized_actual_decoder_input_shape_contract",
    status: "shape_contract_ready",
    sourceDryRunContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT,
    dryRunValidated: true,
    dryRunObserved: true,
    dryRunAttemptObserved: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    runtimeInputObjectPresent: true,
    runtimeInputObjectBuilt: true,
    runtimeDecoderInputObjectBuilt: true,
    runtimeDecoderInputObjectMetadataOnly: true,
    runtimeDecoderInputObjectSanitized: true,
    runtimeDecoderInputObjectBoundToPaymentRequired: true,
    runtimeDecoderInputObjectNonDecodable: true,
    actualDecoderInputShapeProjected: true,
    actualDecoderInputShapeValidated: true,
    actualDecoderInputShapeMetadataOnly: true,
    actualDecoderInputShapeSanitized: true,
    actualDecoderInputShapeBoundToPaymentRequired: true,
    actualDecoderInputShapeNonceBound: true,
    actualDecoderInputShapeResourceBound: true,
    actualDecoderInputShapeContractBound: true,
    actualDecoderInputShapeMerchantBound: true,
    actualDecoderInputShapePaymentTupleBound: true,
    actualDecoderInputShapeReceiptMaterialFree: true,
    actualDecoderInputShapeReplayFree: true,
    actualDecoderInputShapeSettlementFree: true,
    actualDecoderInputShapeNonDecodable: true,
    actualDecoderInputObjectBuilt: false,
    actualDecoderInputObjectReady: false,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerSanitizedActualDecoderInputShape(
  shape: LiveDirectBuyerSanitizedActualDecoderInputShape,
): LiveDirectBuyerSanitizedActualDecoderInputShape {
  if (shape.contract !== LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_unexpected_contract");
  }
  if (shape.mode !== "sanitized_actual_decoder_input_shape_contract") {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_unexpected_mode");
  }
  if (shape.status !== "shape_contract_ready") {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_unexpected_status");
  }
  if (shape.sourceDryRunContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_unexpected_source_dry_run_contract");
  }
  if (
    shape.dryRunValidated !== true ||
    shape.dryRunObserved !== true ||
    shape.dryRunAttemptObserved !== true ||
    shape.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_requires_validated_observed_dry_run");
  }
  if (
    shape.productionEnablementPresent ||
    shape.productionEnablementAccepted ||
    shape.productionConstructionAllowed ||
    shape.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_production_enablement");
  }
  if (
    shape.runtimeInputObjectPresent !== true ||
    shape.runtimeInputObjectBuilt !== true ||
    shape.runtimeDecoderInputObjectBuilt !== true ||
    shape.runtimeDecoderInputObjectMetadataOnly !== true ||
    shape.runtimeDecoderInputObjectSanitized !== true ||
    shape.runtimeDecoderInputObjectBoundToPaymentRequired !== true ||
    shape.runtimeDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_requires_validated_runtime_input_object");
  }
  if (
    shape.actualDecoderInputShapeProjected !== true ||
    shape.actualDecoderInputShapeValidated !== true ||
    shape.actualDecoderInputShapeMetadataOnly !== true ||
    shape.actualDecoderInputShapeSanitized !== true ||
    shape.actualDecoderInputShapeBoundToPaymentRequired !== true ||
    shape.actualDecoderInputShapeNonceBound !== true ||
    shape.actualDecoderInputShapeResourceBound !== true ||
    shape.actualDecoderInputShapeContractBound !== true ||
    shape.actualDecoderInputShapeMerchantBound !== true ||
    shape.actualDecoderInputShapePaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_requires_sanitized_payment_required_bound_shape");
  }
  if (
    shape.actualDecoderInputShapeReceiptMaterialFree !== true ||
    shape.actualDecoderInputShapeReplayFree !== true ||
    shape.actualDecoderInputShapeSettlementFree !== true ||
    shape.actualDecoderInputShapeNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_requires_non_decodable_material_replay_settlement_free_shape");
  }
  if (
    shape.actualDecoderInputObjectBuilt ||
    shape.actualDecoderInputObjectReady ||
    shape.actualDecoderInputObjectPassedToDecoder ||
    shape.decoderInvocationAllowed ||
    shape.decoderInvocationAttempted ||
    shape.decoderInvoked ||
    shape.realDecoderAdapterInvoked ||
    shape.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_actual_decoder_input_or_invocation");
  }

  const prohibitedReceiptMaterial =
    shape.receiptMaterialAccepted ||
    shape.receiptMaterialIncluded ||
    shape.receiptJwsIncluded ||
    shape.receiptPayloadIncluded ||
    shape.receiptBytesIncluded ||
    shape.receiptObjectIncluded ||
    shape.rawReceiptIncluded ||
    shape.rawProofIncluded ||
    shape.settlementFieldsIncluded ||
    shape.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_receipt_material");
  }

  if (
    shape.decodedReceiptProduced ||
    shape.decodedReceiptVerified ||
    shape.decoderResultProduced ||
    shape.decoderResultReleaseConsumable ||
    shape.decoderResultConsumedByReleaseDecision ||
    shape.releaseDecisionMutatedByDecoderResult ||
    shape.paymentResponseEmissionAllowed ||
    shape.crpFulfillAllowed ||
    shape.replayMutationAllowed ||
    shape.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_sanitized_actual_decoder_input_shape_rejects_release_side_effects");
  }

  return shape;
}

export type LiveDirectBuyerActualDecoderInputObject = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT;
  readonly mode: "actual_decoder_input_object_construction";
  readonly status: "actual_decoder_input_object_constructed_test_only";
  readonly sourceShapeContract: typeof LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT;
  readonly shapeValidated: true;
  readonly shapeProjected: true;
  readonly shapeMetadataOnly: true;
  readonly shapeSanitized: true;
  readonly shapeBoundToPaymentRequired: true;
  readonly shapeNonceBound: true;
  readonly shapeResourceBound: true;
  readonly shapeContractBound: true;
  readonly shapeMerchantBound: true;
  readonly shapePaymentTupleBound: true;
  readonly testOnlyConstructionRequired: true;
  readonly testOnlyConstructionPresent: true;
  readonly testOnlyConstructionSatisfied: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionConstructionAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly actualDecoderInputObjectKind: "test_only_sanitized_actual_decoder_input_object";
  readonly actualDecoderInputObjectBuilt: true;
  readonly actualDecoderInputObjectReady: true;
  readonly actualDecoderInputObjectMetadataOnly: true;
  readonly actualDecoderInputObjectSanitized: true;
  readonly actualDecoderInputObjectBoundToPaymentRequired: true;
  readonly actualDecoderInputObjectNonceBound: true;
  readonly actualDecoderInputObjectResourceBound: true;
  readonly actualDecoderInputObjectContractBound: true;
  readonly actualDecoderInputObjectMerchantBound: true;
  readonly actualDecoderInputObjectPaymentTupleBound: true;
  readonly actualDecoderInputObjectReceiptMaterialFree: true;
  readonly actualDecoderInputObjectReplayFree: true;
  readonly actualDecoderInputObjectSettlementFree: true;
  readonly actualDecoderInputObjectNonDecodable: true;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function constructLiveDirectBuyerActualDecoderInputObject(
  shape: LiveDirectBuyerSanitizedActualDecoderInputShape,
): LiveDirectBuyerActualDecoderInputObject {
  const validatedShape = validateLiveDirectBuyerSanitizedActualDecoderInputShape(shape);

  if (
    validatedShape.actualDecoderInputShapeProjected !== true ||
    validatedShape.actualDecoderInputShapeValidated !== true ||
    validatedShape.actualDecoderInputShapeMetadataOnly !== true ||
    validatedShape.actualDecoderInputShapeSanitized !== true ||
    validatedShape.actualDecoderInputShapeBoundToPaymentRequired !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_requires_validated_sanitized_shape");
  }
  if (
    validatedShape.productionEnablementPresent ||
    validatedShape.productionEnablementAccepted ||
    validatedShape.productionConstructionAllowed ||
    validatedShape.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_production_enablement");
  }
  if (
    validatedShape.receiptMaterialAccepted ||
    validatedShape.receiptMaterialIncluded ||
    validatedShape.receiptJwsIncluded ||
    validatedShape.receiptPayloadIncluded ||
    validatedShape.rawReceiptIncluded ||
    validatedShape.rawProofIncluded ||
    validatedShape.settlementFieldsIncluded ||
    validatedShape.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_receipt_material");
  }
  if (
    validatedShape.decoderInvocationAllowed ||
    validatedShape.decoderInvocationAttempted ||
    validatedShape.decoderInvoked ||
    validatedShape.realDecoderAdapterInvoked ||
    validatedShape.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_decoder_invocation");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
    mode: "actual_decoder_input_object_construction",
    status: "actual_decoder_input_object_constructed_test_only",
    sourceShapeContract: LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT,
    shapeValidated: true,
    shapeProjected: true,
    shapeMetadataOnly: true,
    shapeSanitized: true,
    shapeBoundToPaymentRequired: true,
    shapeNonceBound: true,
    shapeResourceBound: true,
    shapeContractBound: true,
    shapeMerchantBound: true,
    shapePaymentTupleBound: true,
    testOnlyConstructionRequired: true,
    testOnlyConstructionPresent: true,
    testOnlyConstructionSatisfied: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionConstructionAllowed: false,
    productionReleaseAllowed: false,
    actualDecoderInputObjectKind: "test_only_sanitized_actual_decoder_input_object",
    actualDecoderInputObjectBuilt: true,
    actualDecoderInputObjectReady: true,
    actualDecoderInputObjectMetadataOnly: true,
    actualDecoderInputObjectSanitized: true,
    actualDecoderInputObjectBoundToPaymentRequired: true,
    actualDecoderInputObjectNonceBound: true,
    actualDecoderInputObjectResourceBound: true,
    actualDecoderInputObjectContractBound: true,
    actualDecoderInputObjectMerchantBound: true,
    actualDecoderInputObjectPaymentTupleBound: true,
    actualDecoderInputObjectReceiptMaterialFree: true,
    actualDecoderInputObjectReplayFree: true,
    actualDecoderInputObjectSettlementFree: true,
    actualDecoderInputObjectNonDecodable: true,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputObject(
  input: LiveDirectBuyerActualDecoderInputObject,
): LiveDirectBuyerActualDecoderInputObject {
  if (input.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_unexpected_contract");
  }
  if (input.mode !== "actual_decoder_input_object_construction") {
    throw new Error("live_direct_buyer_actual_decoder_input_object_unexpected_mode");
  }
  if (input.status !== "actual_decoder_input_object_constructed_test_only") {
    throw new Error("live_direct_buyer_actual_decoder_input_object_unexpected_status");
  }
  if (input.sourceShapeContract !== LIVE_DIRECT_BUYER_SANITIZED_ACTUAL_DECODER_INPUT_SHAPE_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_unexpected_source_shape_contract");
  }
  if (
    input.shapeValidated !== true ||
    input.shapeProjected !== true ||
    input.shapeMetadataOnly !== true ||
    input.shapeSanitized !== true ||
    input.shapeBoundToPaymentRequired !== true ||
    input.shapeNonceBound !== true ||
    input.shapeResourceBound !== true ||
    input.shapeContractBound !== true ||
    input.shapeMerchantBound !== true ||
    input.shapePaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_requires_validated_payment_required_bound_shape");
  }
  if (
    input.testOnlyConstructionRequired !== true ||
    input.testOnlyConstructionPresent !== true ||
    input.testOnlyConstructionSatisfied !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_requires_test_only_construction");
  }
  if (
    input.productionEnablementPresent ||
    input.productionEnablementAccepted ||
    input.productionConstructionAllowed ||
    input.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_production_enablement");
  }
  if (
    input.actualDecoderInputObjectKind !== "test_only_sanitized_actual_decoder_input_object" ||
    input.actualDecoderInputObjectBuilt !== true ||
    input.actualDecoderInputObjectReady !== true ||
    input.actualDecoderInputObjectMetadataOnly !== true ||
    input.actualDecoderInputObjectSanitized !== true ||
    input.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    input.actualDecoderInputObjectNonceBound !== true ||
    input.actualDecoderInputObjectResourceBound !== true ||
    input.actualDecoderInputObjectContractBound !== true ||
    input.actualDecoderInputObjectMerchantBound !== true ||
    input.actualDecoderInputObjectPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_requires_sanitized_payment_required_bound_object");
  }
  if (
    input.actualDecoderInputObjectReceiptMaterialFree !== true ||
    input.actualDecoderInputObjectReplayFree !== true ||
    input.actualDecoderInputObjectSettlementFree !== true ||
    input.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_requires_material_replay_settlement_free_non_decodable_object");
  }
  if (
    input.actualDecoderInputObjectPassedToDecoder ||
    input.decoderInvocationAllowed ||
    input.decoderInvocationAttempted ||
    input.decoderInvoked ||
    input.realDecoderAdapterInvoked ||
    input.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    input.receiptMaterialAccepted ||
    input.receiptMaterialIncluded ||
    input.receiptJwsIncluded ||
    input.receiptPayloadIncluded ||
    input.receiptBytesIncluded ||
    input.receiptObjectIncluded ||
    input.rawReceiptIncluded ||
    input.rawProofIncluded ||
    input.settlementFieldsIncluded ||
    input.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_receipt_material");
  }

  if (
    input.decodedReceiptProduced ||
    input.decodedReceiptVerified ||
    input.decoderResultProduced ||
    input.decoderResultReleaseConsumable ||
    input.decoderResultConsumedByReleaseDecision ||
    input.releaseDecisionMutatedByDecoderResult ||
    input.paymentResponseEmissionAllowed ||
    input.crpFulfillAllowed ||
    input.replayMutationAllowed ||
    input.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_object_rejects_release_side_effects");
  }

  return input;
}

export type LiveDirectBuyerActualDecoderInputPassToDecoderGuard = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT;
  readonly mode: "actual_decoder_input_pass_to_decoder_guard";
  readonly status: "decoder_pass_through_blocked";
  readonly sourceActualDecoderInputObjectContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT;
  readonly actualDecoderInputObjectValidated: true;
  readonly actualDecoderInputObjectBuilt: true;
  readonly actualDecoderInputObjectReady: true;
  readonly actualDecoderInputObjectMetadataOnly: true;
  readonly actualDecoderInputObjectSanitized: true;
  readonly actualDecoderInputObjectBoundToPaymentRequired: true;
  readonly actualDecoderInputObjectNonceBound: true;
  readonly actualDecoderInputObjectResourceBound: true;
  readonly actualDecoderInputObjectContractBound: true;
  readonly actualDecoderInputObjectMerchantBound: true;
  readonly actualDecoderInputObjectPaymentTupleBound: true;
  readonly actualDecoderInputObjectReceiptMaterialFree: true;
  readonly actualDecoderInputObjectReplayFree: true;
  readonly actualDecoderInputObjectSettlementFree: true;
  readonly actualDecoderInputObjectNonDecodable: true;
  readonly decoderPassThroughRecognizedAsFutureStep: true;
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderPassThroughAllowed: false;
  readonly decoderPassThroughAttempted: true;
  readonly decoderPassThroughBlocked: true;
  readonly decoderPassThroughBlockReason: "actual_decoder_input_pass_to_decoder_disabled";
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionDecoderPassThroughAllowed: false;
  readonly productionReleaseAllowed: false;
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
  readonly sideEffectFree: true;
};

export function guardLiveDirectBuyerActualDecoderInputPassToDecoder(
  input: LiveDirectBuyerActualDecoderInputObject,
): LiveDirectBuyerActualDecoderInputPassToDecoderGuard {
  const validatedInput = validateLiveDirectBuyerActualDecoderInputObject(input);

  if (
    validatedInput.actualDecoderInputObjectBuilt !== true ||
    validatedInput.actualDecoderInputObjectReady !== true ||
    validatedInput.actualDecoderInputObjectMetadataOnly !== true ||
    validatedInput.actualDecoderInputObjectSanitized !== true ||
    validatedInput.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    validatedInput.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_validated_actual_decoder_input_object");
  }
  if (
    validatedInput.productionEnablementPresent ||
    validatedInput.productionEnablementAccepted ||
    validatedInput.productionConstructionAllowed ||
    validatedInput.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_production_enablement");
  }
  if (
    validatedInput.actualDecoderInputObjectPassedToDecoder ||
    validatedInput.decoderInvocationAllowed ||
    validatedInput.decoderInvocationAttempted ||
    validatedInput.decoderInvoked ||
    validatedInput.realDecoderAdapterInvoked ||
    validatedInput.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_preexisting_decoder_invocation");
  }
  if (
    validatedInput.receiptMaterialAccepted ||
    validatedInput.receiptMaterialIncluded ||
    validatedInput.receiptJwsIncluded ||
    validatedInput.receiptPayloadIncluded ||
    validatedInput.rawReceiptIncluded ||
    validatedInput.rawProofIncluded ||
    validatedInput.settlementFieldsIncluded ||
    validatedInput.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_receipt_material");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT,
    mode: "actual_decoder_input_pass_to_decoder_guard",
    status: "decoder_pass_through_blocked",
    sourceActualDecoderInputObjectContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT,
    actualDecoderInputObjectValidated: true,
    actualDecoderInputObjectBuilt: true,
    actualDecoderInputObjectReady: true,
    actualDecoderInputObjectMetadataOnly: true,
    actualDecoderInputObjectSanitized: true,
    actualDecoderInputObjectBoundToPaymentRequired: true,
    actualDecoderInputObjectNonceBound: true,
    actualDecoderInputObjectResourceBound: true,
    actualDecoderInputObjectContractBound: true,
    actualDecoderInputObjectMerchantBound: true,
    actualDecoderInputObjectPaymentTupleBound: true,
    actualDecoderInputObjectReceiptMaterialFree: true,
    actualDecoderInputObjectReplayFree: true,
    actualDecoderInputObjectSettlementFree: true,
    actualDecoderInputObjectNonDecodable: true,
    decoderPassThroughRecognizedAsFutureStep: true,
    actualDecoderInputObjectPassedToDecoder: false,
    decoderPassThroughAllowed: false,
    decoderPassThroughAttempted: true,
    decoderPassThroughBlocked: true,
    decoderPassThroughBlockReason: "actual_decoder_input_pass_to_decoder_disabled",
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionDecoderPassThroughAllowed: false,
    productionReleaseAllowed: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard(
  guard: LiveDirectBuyerActualDecoderInputPassToDecoderGuard,
): LiveDirectBuyerActualDecoderInputPassToDecoderGuard {
  if (guard.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_unexpected_contract");
  }
  if (guard.mode !== "actual_decoder_input_pass_to_decoder_guard") {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_unexpected_mode");
  }
  if (guard.status !== "decoder_pass_through_blocked") {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_unexpected_status");
  }
  if (guard.sourceActualDecoderInputObjectContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_OBJECT_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_unexpected_source_object_contract");
  }
  if (
    guard.actualDecoderInputObjectValidated !== true ||
    guard.actualDecoderInputObjectBuilt !== true ||
    guard.actualDecoderInputObjectReady !== true ||
    guard.actualDecoderInputObjectMetadataOnly !== true ||
    guard.actualDecoderInputObjectSanitized !== true ||
    guard.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    guard.actualDecoderInputObjectNonceBound !== true ||
    guard.actualDecoderInputObjectResourceBound !== true ||
    guard.actualDecoderInputObjectContractBound !== true ||
    guard.actualDecoderInputObjectMerchantBound !== true ||
    guard.actualDecoderInputObjectPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_validated_payment_required_bound_object");
  }
  if (
    guard.actualDecoderInputObjectReceiptMaterialFree !== true ||
    guard.actualDecoderInputObjectReplayFree !== true ||
    guard.actualDecoderInputObjectSettlementFree !== true ||
    guard.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_material_replay_settlement_free_non_decodable_object");
  }
  if (
    guard.decoderPassThroughRecognizedAsFutureStep !== true ||
    guard.actualDecoderInputObjectPassedToDecoder ||
    guard.decoderPassThroughAllowed ||
    guard.decoderPassThroughAttempted !== true ||
    guard.decoderPassThroughBlocked !== true ||
    guard.decoderPassThroughBlockReason !== "actual_decoder_input_pass_to_decoder_disabled"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_requires_blocked_decoder_pass_through");
  }
  if (
    guard.decoderInvocationAllowed ||
    guard.decoderInvocationAttempted ||
    guard.decoderInvoked ||
    guard.realDecoderAdapterInvoked ||
    guard.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_decoder_invocation");
  }
  if (
    guard.productionEnablementPresent ||
    guard.productionEnablementAccepted ||
    guard.productionDecoderPassThroughAllowed ||
    guard.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_production_enablement");
  }

  const prohibitedReceiptMaterial =
    guard.receiptMaterialAccepted ||
    guard.receiptMaterialIncluded ||
    guard.receiptJwsIncluded ||
    guard.receiptPayloadIncluded ||
    guard.receiptBytesIncluded ||
    guard.receiptObjectIncluded ||
    guard.rawReceiptIncluded ||
    guard.rawProofIncluded ||
    guard.settlementFieldsIncluded ||
    guard.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_receipt_material");
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
    guard.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_to_decoder_guard_rejects_release_side_effects");
  }

  return guard;
}

export type LiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT;
  readonly mode: "actual_decoder_input_pass_through_test_only_gate";
  readonly status: "open_test_only";
  readonly sourcePassToDecoderGuardContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT;
  readonly passToDecoderGuardValidated: true;
  readonly actualDecoderInputObjectValidated: true;
  readonly actualDecoderInputObjectBuilt: true;
  readonly actualDecoderInputObjectReady: true;
  readonly actualDecoderInputObjectMetadataOnly: true;
  readonly actualDecoderInputObjectSanitized: true;
  readonly actualDecoderInputObjectBoundToPaymentRequired: true;
  readonly actualDecoderInputObjectNonceBound: true;
  readonly actualDecoderInputObjectResourceBound: true;
  readonly actualDecoderInputObjectContractBound: true;
  readonly actualDecoderInputObjectMerchantBound: true;
  readonly actualDecoderInputObjectPaymentTupleBound: true;
  readonly actualDecoderInputObjectReceiptMaterialFree: true;
  readonly actualDecoderInputObjectReplayFree: true;
  readonly actualDecoderInputObjectSettlementFree: true;
  readonly actualDecoderInputObjectNonDecodable: true;
  readonly testOnlyGateRequired: true;
  readonly testOnlyGatePresent: true;
  readonly testOnlyGateSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionPassThroughAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly decoderPassThroughRecognizedAsFutureStep: true;
  readonly decoderPassThroughEligible: true;
  readonly decoderPassThroughAllowed: true;
  readonly decoderPassThroughExecuted: false;
  readonly decoderPassThroughStillNotExecuted: true;
  readonly decoderPassThroughBlockLiftedForTestOnly: true;
  readonly decoderPassThroughBlockReason: "test_only_gate_open_no_execution";
  readonly actualDecoderInputObjectPassedToDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function openLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(
  guard: LiveDirectBuyerActualDecoderInputPassToDecoderGuard,
): LiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate {
  const validatedGuard = validateLiveDirectBuyerActualDecoderInputPassToDecoderGuard(guard);

  if (
    validatedGuard.actualDecoderInputObjectValidated !== true ||
    validatedGuard.actualDecoderInputObjectBuilt !== true ||
    validatedGuard.actualDecoderInputObjectReady !== true ||
    validatedGuard.actualDecoderInputObjectMetadataOnly !== true ||
    validatedGuard.actualDecoderInputObjectSanitized !== true ||
    validatedGuard.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    validatedGuard.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_validated_actual_decoder_input_object");
  }
  if (
    validatedGuard.productionEnablementPresent ||
    validatedGuard.productionEnablementAccepted ||
    validatedGuard.productionDecoderPassThroughAllowed ||
    validatedGuard.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_production_enablement");
  }
  if (
    validatedGuard.actualDecoderInputObjectPassedToDecoder ||
    validatedGuard.decoderInvocationAllowed ||
    validatedGuard.decoderInvocationAttempted ||
    validatedGuard.decoderInvoked ||
    validatedGuard.realDecoderAdapterInvoked ||
    validatedGuard.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_preexisting_decoder_invocation");
  }
  if (
    validatedGuard.receiptMaterialAccepted ||
    validatedGuard.receiptMaterialIncluded ||
    validatedGuard.receiptJwsIncluded ||
    validatedGuard.receiptPayloadIncluded ||
    validatedGuard.rawReceiptIncluded ||
    validatedGuard.rawProofIncluded ||
    validatedGuard.settlementFieldsIncluded ||
    validatedGuard.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_receipt_material");
  }
  if (
    validatedGuard.decoderPassThroughRecognizedAsFutureStep !== true ||
    validatedGuard.decoderPassThroughAttempted !== true ||
    validatedGuard.decoderPassThroughBlocked !== true ||
    validatedGuard.decoderPassThroughAllowed !== false
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_blocked_source_guard");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT,
    mode: "actual_decoder_input_pass_through_test_only_gate",
    status: "open_test_only",
    sourcePassToDecoderGuardContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT,
    passToDecoderGuardValidated: true,
    actualDecoderInputObjectValidated: true,
    actualDecoderInputObjectBuilt: true,
    actualDecoderInputObjectReady: true,
    actualDecoderInputObjectMetadataOnly: true,
    actualDecoderInputObjectSanitized: true,
    actualDecoderInputObjectBoundToPaymentRequired: true,
    actualDecoderInputObjectNonceBound: true,
    actualDecoderInputObjectResourceBound: true,
    actualDecoderInputObjectContractBound: true,
    actualDecoderInputObjectMerchantBound: true,
    actualDecoderInputObjectPaymentTupleBound: true,
    actualDecoderInputObjectReceiptMaterialFree: true,
    actualDecoderInputObjectReplayFree: true,
    actualDecoderInputObjectSettlementFree: true,
    actualDecoderInputObjectNonDecodable: true,
    testOnlyGateRequired: true,
    testOnlyGatePresent: true,
    testOnlyGateSatisfied: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionPassThroughAllowed: false,
    productionReleaseAllowed: false,
    decoderPassThroughRecognizedAsFutureStep: true,
    decoderPassThroughEligible: true,
    decoderPassThroughAllowed: true,
    decoderPassThroughExecuted: false,
    decoderPassThroughStillNotExecuted: true,
    decoderPassThroughBlockLiftedForTestOnly: true,
    decoderPassThroughBlockReason: "test_only_gate_open_no_execution",
    actualDecoderInputObjectPassedToDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(
  gate: LiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
): LiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate {
  if (gate.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_unexpected_contract");
  }
  if (gate.mode !== "actual_decoder_input_pass_through_test_only_gate") {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_unexpected_mode");
  }
  if (gate.status !== "open_test_only") {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_unexpected_status");
  }
  if (gate.sourcePassToDecoderGuardContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_TO_DECODER_GUARD_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_unexpected_source_guard_contract");
  }
  if (gate.passToDecoderGuardValidated !== true) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_validated_source_guard");
  }
  if (
    gate.actualDecoderInputObjectValidated !== true ||
    gate.actualDecoderInputObjectBuilt !== true ||
    gate.actualDecoderInputObjectReady !== true ||
    gate.actualDecoderInputObjectMetadataOnly !== true ||
    gate.actualDecoderInputObjectSanitized !== true ||
    gate.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    gate.actualDecoderInputObjectNonceBound !== true ||
    gate.actualDecoderInputObjectResourceBound !== true ||
    gate.actualDecoderInputObjectContractBound !== true ||
    gate.actualDecoderInputObjectMerchantBound !== true ||
    gate.actualDecoderInputObjectPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_validated_payment_required_bound_object");
  }
  if (
    gate.actualDecoderInputObjectReceiptMaterialFree !== true ||
    gate.actualDecoderInputObjectReplayFree !== true ||
    gate.actualDecoderInputObjectSettlementFree !== true ||
    gate.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_material_replay_settlement_free_non_decodable_object");
  }
  if (
    gate.testOnlyGateRequired !== true ||
    gate.testOnlyGatePresent !== true ||
    gate.testOnlyGateSatisfied !== true ||
    gate.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_test_only_authority");
  }
  if (
    gate.productionEnablementPresent ||
    gate.productionEnablementAccepted ||
    gate.productionPassThroughAllowed ||
    gate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_production_enablement");
  }
  if (
    gate.decoderPassThroughRecognizedAsFutureStep !== true ||
    gate.decoderPassThroughEligible !== true ||
    gate.decoderPassThroughAllowed !== true ||
    gate.decoderPassThroughExecuted ||
    gate.decoderPassThroughStillNotExecuted !== true ||
    gate.decoderPassThroughBlockLiftedForTestOnly !== true ||
    gate.decoderPassThroughBlockReason !== "test_only_gate_open_no_execution"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_requires_open_permission_without_execution");
  }
  if (
    gate.actualDecoderInputObjectPassedToDecoder ||
    gate.decoderInvocationAllowed ||
    gate.decoderInvocationAttempted ||
    gate.decoderInvoked ||
    gate.realDecoderAdapterInvoked ||
    gate.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_decoder_invocation");
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
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_receipt_material");
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
    throw new Error("live_direct_buyer_actual_decoder_input_pass_through_test_only_gate_rejects_release_side_effects");
  }

  return gate;
}

export type LiveDirectBuyerActualDecoderInputInvocationDryRun = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT;
  readonly mode: "actual_decoder_input_invocation_test_only_dry_run";
  readonly status: "dry_run_invocation_observed";
  readonly sourcePassThroughTestOnlyGateContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT;
  readonly passThroughTestOnlyGateValidated: true;
  readonly testOnlyGateSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly actualDecoderInputObjectValidated: true;
  readonly actualDecoderInputObjectBuilt: true;
  readonly actualDecoderInputObjectReady: true;
  readonly actualDecoderInputObjectMetadataOnly: true;
  readonly actualDecoderInputObjectSanitized: true;
  readonly actualDecoderInputObjectBoundToPaymentRequired: true;
  readonly actualDecoderInputObjectNonceBound: true;
  readonly actualDecoderInputObjectResourceBound: true;
  readonly actualDecoderInputObjectContractBound: true;
  readonly actualDecoderInputObjectMerchantBound: true;
  readonly actualDecoderInputObjectPaymentTupleBound: true;
  readonly actualDecoderInputObjectReceiptMaterialFree: true;
  readonly actualDecoderInputObjectReplayFree: true;
  readonly actualDecoderInputObjectSettlementFree: true;
  readonly actualDecoderInputObjectNonDecodable: true;
  readonly decoderPassThroughAllowed: true;
  readonly decoderPassThroughExecuted: true;
  readonly actualDecoderInputObjectPassedToTestOnlyInvocationSeam: true;
  readonly actualDecoderInputObjectPassedToRealDecoder: false;
  readonly testOnlyInvocationRequired: true;
  readonly testOnlyInvocationPresent: true;
  readonly testOnlyInvocationSatisfied: true;
  readonly testOnlyInvocationAllowed: true;
  readonly testOnlyInvocationAttempted: true;
  readonly testOnlyInvocationObserved: true;
  readonly adapterInvocationSeamEntered: true;
  readonly adapterInvocationSeamExitedSafely: true;
  readonly adapterInvocationRoute: "test_only_actual_decoder_input_no_real_decode_stub";
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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

export function observeLiveDirectBuyerActualDecoderInputInvocationDryRun(
  gate: LiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate,
): LiveDirectBuyerActualDecoderInputInvocationDryRun {
  const validatedGate = validateLiveDirectBuyerActualDecoderInputPassThroughTestOnlyGate(gate);

  if (
    validatedGate.testOnlyGateSatisfied !== true ||
    validatedGate.testOnlyAuthorityOpened !== true ||
    validatedGate.decoderPassThroughAllowed !== true ||
    validatedGate.decoderPassThroughExecuted !== false
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_open_test_only_pass_through_gate");
  }
  if (
    validatedGate.productionEnablementPresent ||
    validatedGate.productionEnablementAccepted ||
    validatedGate.productionPassThroughAllowed ||
    validatedGate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_production_enablement");
  }
  if (
    validatedGate.actualDecoderInputObjectPassedToDecoder ||
    validatedGate.decoderInvocationAllowed ||
    validatedGate.decoderInvocationAttempted ||
    validatedGate.decoderInvoked ||
    validatedGate.realDecoderAdapterInvoked ||
    validatedGate.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_preexisting_decoder_invocation");
  }
  if (
    validatedGate.receiptMaterialAccepted ||
    validatedGate.receiptMaterialIncluded ||
    validatedGate.receiptJwsIncluded ||
    validatedGate.receiptPayloadIncluded ||
    validatedGate.receiptBytesIncluded ||
    validatedGate.receiptObjectIncluded ||
    validatedGate.rawReceiptIncluded ||
    validatedGate.rawProofIncluded ||
    validatedGate.settlementFieldsIncluded ||
    validatedGate.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_receipt_material");
  }
  if (
    validatedGate.decodedReceiptProduced ||
    validatedGate.decodedReceiptVerified ||
    validatedGate.decoderResultProduced ||
    validatedGate.decoderResultReleaseConsumable ||
    validatedGate.decoderResultConsumedByReleaseDecision ||
    validatedGate.releaseDecisionMutatedByDecoderResult ||
    validatedGate.paymentResponseEmissionAllowed ||
    validatedGate.crpFulfillAllowed ||
    validatedGate.replayMutationAllowed ||
    validatedGate.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_release_side_effects");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT,
    mode: "actual_decoder_input_invocation_test_only_dry_run",
    status: "dry_run_invocation_observed",
    sourcePassThroughTestOnlyGateContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT,
    passThroughTestOnlyGateValidated: true,
    testOnlyGateSatisfied: true,
    testOnlyAuthorityOpened: true,
    actualDecoderInputObjectValidated: true,
    actualDecoderInputObjectBuilt: true,
    actualDecoderInputObjectReady: true,
    actualDecoderInputObjectMetadataOnly: true,
    actualDecoderInputObjectSanitized: true,
    actualDecoderInputObjectBoundToPaymentRequired: true,
    actualDecoderInputObjectNonceBound: true,
    actualDecoderInputObjectResourceBound: true,
    actualDecoderInputObjectContractBound: true,
    actualDecoderInputObjectMerchantBound: true,
    actualDecoderInputObjectPaymentTupleBound: true,
    actualDecoderInputObjectReceiptMaterialFree: true,
    actualDecoderInputObjectReplayFree: true,
    actualDecoderInputObjectSettlementFree: true,
    actualDecoderInputObjectNonDecodable: true,
    decoderPassThroughAllowed: true,
    decoderPassThroughExecuted: true,
    actualDecoderInputObjectPassedToTestOnlyInvocationSeam: true,
    actualDecoderInputObjectPassedToRealDecoder: false,
    testOnlyInvocationRequired: true,
    testOnlyInvocationPresent: true,
    testOnlyInvocationSatisfied: true,
    testOnlyInvocationAllowed: true,
    testOnlyInvocationAttempted: true,
    testOnlyInvocationObserved: true,
    adapterInvocationSeamEntered: true,
    adapterInvocationSeamExitedSafely: true,
    adapterInvocationRoute: "test_only_actual_decoder_input_no_real_decode_stub",
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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

export function validateLiveDirectBuyerActualDecoderInputInvocationDryRun(
  result: LiveDirectBuyerActualDecoderInputInvocationDryRun,
): LiveDirectBuyerActualDecoderInputInvocationDryRun {
  if (result.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_unexpected_contract");
  }
  if (result.mode !== "actual_decoder_input_invocation_test_only_dry_run") {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_unexpected_mode");
  }
  if (result.status !== "dry_run_invocation_observed") {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_unexpected_status");
  }
  if (result.sourcePassThroughTestOnlyGateContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_PASS_THROUGH_TEST_ONLY_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_unexpected_source_gate_contract");
  }
  if (
    result.passThroughTestOnlyGateValidated !== true ||
    result.testOnlyGateSatisfied !== true ||
    result.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_validated_test_only_gate");
  }
  if (
    result.actualDecoderInputObjectValidated !== true ||
    result.actualDecoderInputObjectBuilt !== true ||
    result.actualDecoderInputObjectReady !== true ||
    result.actualDecoderInputObjectMetadataOnly !== true ||
    result.actualDecoderInputObjectSanitized !== true ||
    result.actualDecoderInputObjectBoundToPaymentRequired !== true ||
    result.actualDecoderInputObjectNonceBound !== true ||
    result.actualDecoderInputObjectResourceBound !== true ||
    result.actualDecoderInputObjectContractBound !== true ||
    result.actualDecoderInputObjectMerchantBound !== true ||
    result.actualDecoderInputObjectPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_payment_required_bound_actual_decoder_input_object");
  }
  if (
    result.actualDecoderInputObjectReceiptMaterialFree !== true ||
    result.actualDecoderInputObjectReplayFree !== true ||
    result.actualDecoderInputObjectSettlementFree !== true ||
    result.actualDecoderInputObjectNonDecodable !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_material_replay_settlement_free_non_decodable_object");
  }
  if (
    result.decoderPassThroughAllowed !== true ||
    result.decoderPassThroughExecuted !== true ||
    result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam !== true ||
    result.actualDecoderInputObjectPassedToRealDecoder !== false
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_test_only_invocation_seam_entry_without_real_decoder");
  }
  if (
    result.testOnlyInvocationRequired !== true ||
    result.testOnlyInvocationPresent !== true ||
    result.testOnlyInvocationSatisfied !== true ||
    result.testOnlyInvocationAllowed !== true ||
    result.testOnlyInvocationAttempted !== true ||
    result.testOnlyInvocationObserved !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_test_only_invocation_observed");
  }
  if (
    result.adapterInvocationSeamEntered !== true ||
    result.adapterInvocationSeamExitedSafely !== true ||
    result.adapterInvocationRoute !== "test_only_actual_decoder_input_no_real_decode_stub"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_safe_adapter_invocation_seam");
  }
  if (
    result.decoderInvocationAllowed ||
    result.decoderInvocationAttempted ||
    result.decoderInvoked ||
    result.realDecoderAdapterInvoked ||
    result.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_real_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    result.receiptMaterialAccepted ||
    result.receiptMaterialIncluded ||
    result.receiptJwsIncluded ||
    result.receiptPayloadIncluded ||
    result.receiptBytesIncluded ||
    result.receiptObjectIncluded ||
    result.rawReceiptIncluded ||
    result.rawProofIncluded ||
    result.settlementFieldsIncluded ||
    result.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_receipt_material");
  }

  if (
    result.decodedReceiptProduced ||
    result.decodedReceiptVerified ||
    result.decoderResultProduced ||
    result.decoderResultReleaseConsumable ||
    result.decoderResultConsumedByReleaseDecision ||
    result.releaseDecisionMutatedByDecoderResult ||
    result.paymentResponseEmissionAllowed ||
    result.crpFulfillAllowed ||
    result.replayMutationAllowed ||
    result.canonicalReleasePersistenceAllowed ||
    result.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_rejects_release_side_effects");
  }

  if (result.sideEffectFree !== true) {
    throw new Error("live_direct_buyer_actual_decoder_input_invocation_dry_run_requires_side_effect_free");
  }

  return result;
}

export type LiveDirectBuyerActualDecoderInputNonDecodedSeamResult = {
  readonly contract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT;
  readonly mode: "actual_decoder_input_non_decoded_seam_result";
  readonly status: "non_decoded_seam_result_returned";
  readonly sourceInvocationDryRunContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT;
  readonly invocationDryRunValidated: true;
  readonly invocationObserved: true;
  readonly adapterInvocationSeamEntered: true;
  readonly adapterInvocationSeamExitedSafely: true;
  readonly seamResultBuilt: true;
  readonly seamResultObserved: true;
  readonly seamResultReturnedFromSeam: true;
  readonly seamResultRoute: "test_only_actual_decoder_input_non_decoded_result_descriptor";
  readonly seamResultKind: "non_decoded_actual_decoder_input_seam_result";
  readonly seamResultDecodeStatus: "not_decoded";
  readonly seamResultMetadataOnly: true;
  readonly seamResultSanitized: true;
  readonly seamResultBoundToPaymentRequired: true;
  readonly seamResultNonceBound: true;
  readonly seamResultResourceBound: true;
  readonly seamResultContractBound: true;
  readonly seamResultMerchantBound: true;
  readonly seamResultPaymentTupleBound: true;
  readonly seamResultContainsActualDecoderInputObject: false;
  readonly seamResultContainsRuntimeDecoderInputObject: false;
  readonly seamResultContainsReceiptJws: false;
  readonly seamResultContainsReceiptPayload: false;
  readonly seamResultContainsReceiptBytes: false;
  readonly seamResultContainsReceiptObject: false;
  readonly seamResultContainsRawReceipt: false;
  readonly seamResultContainsRawProof: false;
  readonly seamResultContainsSettlementFields: false;
  readonly seamResultContainsReplayKey: false;
  readonly actualDecoderInputObjectPassedToTestOnlyInvocationSeam: true;
  readonly actualDecoderInputObjectPassedToRealDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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

export function returnLiveDirectBuyerActualDecoderInputNonDecodedSeamResult(
  invocation: LiveDirectBuyerActualDecoderInputInvocationDryRun,
): LiveDirectBuyerActualDecoderInputNonDecodedSeamResult {
  const validatedInvocation = validateLiveDirectBuyerActualDecoderInputInvocationDryRun(invocation);

  if (
    validatedInvocation.testOnlyInvocationObserved !== true ||
    validatedInvocation.adapterInvocationSeamEntered !== true ||
    validatedInvocation.adapterInvocationSeamExitedSafely !== true ||
    validatedInvocation.actualDecoderInputObjectPassedToTestOnlyInvocationSeam !== true ||
    validatedInvocation.actualDecoderInputObjectPassedToRealDecoder !== false
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_safe_observed_invocation_seam");
  }
  if (
    validatedInvocation.decoderInvocationAllowed ||
    validatedInvocation.decoderInvocationAttempted ||
    validatedInvocation.decoderInvoked ||
    validatedInvocation.realDecoderAdapterInvoked ||
    validatedInvocation.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_real_decoder_invocation");
  }
  if (
    validatedInvocation.receiptMaterialAccepted ||
    validatedInvocation.receiptMaterialIncluded ||
    validatedInvocation.receiptJwsIncluded ||
    validatedInvocation.receiptPayloadIncluded ||
    validatedInvocation.receiptBytesIncluded ||
    validatedInvocation.receiptObjectIncluded ||
    validatedInvocation.rawReceiptIncluded ||
    validatedInvocation.rawProofIncluded ||
    validatedInvocation.settlementFieldsIncluded ||
    validatedInvocation.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_receipt_material");
  }
  if (
    validatedInvocation.decodedReceiptProduced ||
    validatedInvocation.decodedReceiptVerified ||
    validatedInvocation.decoderResultProduced ||
    validatedInvocation.decoderResultReleaseConsumable ||
    validatedInvocation.decoderResultConsumedByReleaseDecision ||
    validatedInvocation.releaseDecisionMutatedByDecoderResult ||
    validatedInvocation.paymentResponseEmissionAllowed ||
    validatedInvocation.crpFulfillAllowed ||
    validatedInvocation.replayMutationAllowed ||
    validatedInvocation.canonicalReleasePersistenceAllowed ||
    validatedInvocation.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_release_side_effects");
  }

  return {
    contract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT,
    mode: "actual_decoder_input_non_decoded_seam_result",
    status: "non_decoded_seam_result_returned",
    sourceInvocationDryRunContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT,
    invocationDryRunValidated: true,
    invocationObserved: true,
    adapterInvocationSeamEntered: true,
    adapterInvocationSeamExitedSafely: true,
    seamResultBuilt: true,
    seamResultObserved: true,
    seamResultReturnedFromSeam: true,
    seamResultRoute: "test_only_actual_decoder_input_non_decoded_result_descriptor",
    seamResultKind: "non_decoded_actual_decoder_input_seam_result",
    seamResultDecodeStatus: "not_decoded",
    seamResultMetadataOnly: true,
    seamResultSanitized: true,
    seamResultBoundToPaymentRequired: true,
    seamResultNonceBound: true,
    seamResultResourceBound: true,
    seamResultContractBound: true,
    seamResultMerchantBound: true,
    seamResultPaymentTupleBound: true,
    seamResultContainsActualDecoderInputObject: false,
    seamResultContainsRuntimeDecoderInputObject: false,
    seamResultContainsReceiptJws: false,
    seamResultContainsReceiptPayload: false,
    seamResultContainsReceiptBytes: false,
    seamResultContainsReceiptObject: false,
    seamResultContainsRawReceipt: false,
    seamResultContainsRawProof: false,
    seamResultContainsSettlementFields: false,
    seamResultContainsReplayKey: false,
    actualDecoderInputObjectPassedToTestOnlyInvocationSeam: true,
    actualDecoderInputObjectPassedToRealDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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

export function validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult(
  result: LiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
): LiveDirectBuyerActualDecoderInputNonDecodedSeamResult {
  if (result.contract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_unexpected_contract");
  }
  if (result.mode !== "actual_decoder_input_non_decoded_seam_result") {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_unexpected_mode");
  }
  if (result.status !== "non_decoded_seam_result_returned") {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_unexpected_status");
  }
  if (result.sourceInvocationDryRunContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_INVOCATION_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_unexpected_source_invocation_contract");
  }
  if (
    result.invocationDryRunValidated !== true ||
    result.invocationObserved !== true ||
    result.adapterInvocationSeamEntered !== true ||
    result.adapterInvocationSeamExitedSafely !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_validated_safe_invocation");
  }
  if (
    result.seamResultBuilt !== true ||
    result.seamResultObserved !== true ||
    result.seamResultReturnedFromSeam !== true ||
    result.seamResultRoute !== "test_only_actual_decoder_input_non_decoded_result_descriptor" ||
    result.seamResultKind !== "non_decoded_actual_decoder_input_seam_result" ||
    result.seamResultDecodeStatus !== "not_decoded"
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_non_decoded_descriptor");
  }
  if (
    result.seamResultMetadataOnly !== true ||
    result.seamResultSanitized !== true ||
    result.seamResultBoundToPaymentRequired !== true ||
    result.seamResultNonceBound !== true ||
    result.seamResultResourceBound !== true ||
    result.seamResultContractBound !== true ||
    result.seamResultMerchantBound !== true ||
    result.seamResultPaymentTupleBound !== true
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_sanitized_payment_required_binding");
  }
  if (
    result.seamResultContainsActualDecoderInputObject ||
    result.seamResultContainsRuntimeDecoderInputObject ||
    result.seamResultContainsReceiptJws ||
    result.seamResultContainsReceiptPayload ||
    result.seamResultContainsReceiptBytes ||
    result.seamResultContainsReceiptObject ||
    result.seamResultContainsRawReceipt ||
    result.seamResultContainsRawProof ||
    result.seamResultContainsSettlementFields ||
    result.seamResultContainsReplayKey
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_embedded_inputs_or_receipt_material");
  }
  if (
    result.actualDecoderInputObjectPassedToTestOnlyInvocationSeam !== true ||
    result.actualDecoderInputObjectPassedToRealDecoder !== false
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_test_only_actual_input_seam_without_real_decoder");
  }
  if (
    result.decoderInvocationAllowed ||
    result.decoderInvocationAttempted ||
    result.decoderInvoked ||
    result.realDecoderAdapterInvoked ||
    result.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_real_decoder_invocation");
  }

  const prohibitedReceiptMaterial =
    result.receiptMaterialAccepted ||
    result.receiptMaterialIncluded ||
    result.receiptJwsIncluded ||
    result.receiptPayloadIncluded ||
    result.receiptBytesIncluded ||
    result.receiptObjectIncluded ||
    result.rawReceiptIncluded ||
    result.rawProofIncluded ||
    result.settlementFieldsIncluded ||
    result.replayKeyIncluded;

  if (prohibitedReceiptMaterial) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_receipt_material");
  }

  if (
    result.decodedReceiptProduced ||
    result.decodedReceiptVerified ||
    result.decoderResultProduced ||
    result.decoderResultReleaseConsumable ||
    result.decoderResultConsumedByReleaseDecision ||
    result.releaseDecisionMutatedByDecoderResult ||
    result.paymentResponseEmissionAllowed ||
    result.crpFulfillAllowed ||
    result.replayMutationAllowed ||
    result.canonicalReleasePersistenceAllowed ||
    result.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_rejects_release_side_effects");
  }

  if (result.sideEffectFree !== true) {
    throw new Error("live_direct_buyer_actual_decoder_input_non_decoded_seam_result_requires_side_effect_free");
  }

  return result;
}

export type LiveDirectBuyerReceiptMaterialAcceptanceGate = {
  readonly contract: typeof LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT;
  readonly mode: "receipt_material_acceptance_test_only_gate";
  readonly status: "open_test_only";
  readonly sourceNonDecodedSeamResultContract: typeof LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT;
  readonly nonDecodedSeamResultValidated: true;
  readonly receiptMaterialAcceptanceGateRequired: true;
  readonly receiptMaterialAcceptanceGatePresent: true;
  readonly receiptMaterialAcceptanceGateSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionReceiptMaterialAcceptanceAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly receiptMaterialAcceptanceRecognizedAsFutureStep: true;
  readonly receiptMaterialAcceptanceEligible: true;
  readonly receiptMaterialAcceptanceAllowed: true;
  readonly receiptMaterialAccepted: false;
  readonly receiptMaterialStillNotAccepted: true;
  readonly receiptMaterialAcceptanceBlockLiftedForTestOnly: true;
  readonly receiptMaterialAcceptanceBlockReason: "test_only_gate_open_no_receipt_material_accepted";
  readonly seamResultBuilt: true;
  readonly seamResultObserved: true;
  readonly seamResultReturnedFromSeam: true;
  readonly seamResultDecodeStatus: "not_decoded";
  readonly seamResultMetadataOnly: true;
  readonly seamResultSanitized: true;
  readonly seamResultBoundToPaymentRequired: true;
  readonly seamResultContainsActualDecoderInputObject: false;
  readonly seamResultContainsRuntimeDecoderInputObject: false;
  readonly seamResultContainsReceiptJws: false;
  readonly seamResultContainsReceiptPayload: false;
  readonly seamResultContainsReceiptBytes: false;
  readonly seamResultContainsReceiptObject: false;
  readonly seamResultContainsRawReceipt: false;
  readonly seamResultContainsRawProof: false;
  readonly seamResultContainsSettlementFields: false;
  readonly seamResultContainsReplayKey: false;
  readonly receiptJwsAcceptedForDecode: false;
  readonly receiptPayloadAcceptedForDecode: false;
  readonly receiptBytesAcceptedForDecode: false;
  readonly receiptObjectAcceptedForDecode: false;
  readonly rawReceiptAcceptedForDecode: false;
  readonly rawProofAcceptedForDecode: false;
  readonly settlementFieldsAcceptedForDecode: false;
  readonly replayKeyAcceptedForDecode: false;
  readonly receiptMaterialPassedToDecoder: false;
  readonly actualDecoderInputObjectPassedToRealDecoder: false;
  readonly decoderInvocationAllowed: false;
  readonly decoderInvocationAttempted: false;
  readonly decoderInvoked: false;
  readonly realDecoderAdapterInvoked: false;
  readonly realDecoderInvoked: false;
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
  readonly sideEffectFree: true;
};

export function openLiveDirectBuyerReceiptMaterialAcceptanceGate(
  seamResult: LiveDirectBuyerActualDecoderInputNonDecodedSeamResult,
): LiveDirectBuyerReceiptMaterialAcceptanceGate {
  const validatedSeamResult = validateLiveDirectBuyerActualDecoderInputNonDecodedSeamResult(seamResult);

  if (
    validatedSeamResult.seamResultBuilt !== true ||
    validatedSeamResult.seamResultObserved !== true ||
    validatedSeamResult.seamResultReturnedFromSeam !== true ||
    validatedSeamResult.seamResultDecodeStatus !== "not_decoded"
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_non_decoded_seam_result");
  }
  if (
    validatedSeamResult.seamResultMetadataOnly !== true ||
    validatedSeamResult.seamResultSanitized !== true ||
    validatedSeamResult.seamResultBoundToPaymentRequired !== true
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_sanitized_payment_required_bound_seam_result");
  }
  if (
    validatedSeamResult.seamResultContainsActualDecoderInputObject ||
    validatedSeamResult.seamResultContainsRuntimeDecoderInputObject ||
    validatedSeamResult.seamResultContainsReceiptJws ||
    validatedSeamResult.seamResultContainsReceiptPayload ||
    validatedSeamResult.seamResultContainsReceiptBytes ||
    validatedSeamResult.seamResultContainsReceiptObject ||
    validatedSeamResult.seamResultContainsRawReceipt ||
    validatedSeamResult.seamResultContainsRawProof ||
    validatedSeamResult.seamResultContainsSettlementFields ||
    validatedSeamResult.seamResultContainsReplayKey
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_embedded_inputs_or_receipt_material");
  }
  if (
    validatedSeamResult.decoderInvocationAllowed ||
    validatedSeamResult.decoderInvocationAttempted ||
    validatedSeamResult.decoderInvoked ||
    validatedSeamResult.realDecoderAdapterInvoked ||
    validatedSeamResult.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_decoder_invocation");
  }
  if (
    validatedSeamResult.receiptMaterialAccepted ||
    validatedSeamResult.receiptMaterialIncluded ||
    validatedSeamResult.receiptJwsIncluded ||
    validatedSeamResult.receiptPayloadIncluded ||
    validatedSeamResult.receiptBytesIncluded ||
    validatedSeamResult.receiptObjectIncluded ||
    validatedSeamResult.rawReceiptIncluded ||
    validatedSeamResult.rawProofIncluded ||
    validatedSeamResult.settlementFieldsIncluded ||
    validatedSeamResult.replayKeyIncluded
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_preexisting_receipt_material");
  }
  if (
    validatedSeamResult.decodedReceiptProduced ||
    validatedSeamResult.decodedReceiptVerified ||
    validatedSeamResult.decoderResultProduced ||
    validatedSeamResult.decoderResultReleaseConsumable ||
    validatedSeamResult.decoderResultConsumedByReleaseDecision ||
    validatedSeamResult.releaseDecisionMutatedByDecoderResult ||
    validatedSeamResult.paymentResponseEmissionAllowed ||
    validatedSeamResult.crpFulfillAllowed ||
    validatedSeamResult.replayMutationAllowed ||
    validatedSeamResult.canonicalReleasePersistenceAllowed ||
    validatedSeamResult.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_release_side_effects");
  }

  return {
    contract: LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT,
    mode: "receipt_material_acceptance_test_only_gate",
    status: "open_test_only",
    sourceNonDecodedSeamResultContract: LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT,
    nonDecodedSeamResultValidated: true,
    receiptMaterialAcceptanceGateRequired: true,
    receiptMaterialAcceptanceGatePresent: true,
    receiptMaterialAcceptanceGateSatisfied: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionReceiptMaterialAcceptanceAllowed: false,
    productionReleaseAllowed: false,
    receiptMaterialAcceptanceRecognizedAsFutureStep: true,
    receiptMaterialAcceptanceEligible: true,
    receiptMaterialAcceptanceAllowed: true,
    receiptMaterialAccepted: false,
    receiptMaterialStillNotAccepted: true,
    receiptMaterialAcceptanceBlockLiftedForTestOnly: true,
    receiptMaterialAcceptanceBlockReason: "test_only_gate_open_no_receipt_material_accepted",
    seamResultBuilt: true,
    seamResultObserved: true,
    seamResultReturnedFromSeam: true,
    seamResultDecodeStatus: "not_decoded",
    seamResultMetadataOnly: true,
    seamResultSanitized: true,
    seamResultBoundToPaymentRequired: true,
    seamResultContainsActualDecoderInputObject: false,
    seamResultContainsRuntimeDecoderInputObject: false,
    seamResultContainsReceiptJws: false,
    seamResultContainsReceiptPayload: false,
    seamResultContainsReceiptBytes: false,
    seamResultContainsReceiptObject: false,
    seamResultContainsRawReceipt: false,
    seamResultContainsRawProof: false,
    seamResultContainsSettlementFields: false,
    seamResultContainsReplayKey: false,
    receiptJwsAcceptedForDecode: false,
    receiptPayloadAcceptedForDecode: false,
    receiptBytesAcceptedForDecode: false,
    receiptObjectAcceptedForDecode: false,
    rawReceiptAcceptedForDecode: false,
    rawProofAcceptedForDecode: false,
    settlementFieldsAcceptedForDecode: false,
    replayKeyAcceptedForDecode: false,
    receiptMaterialPassedToDecoder: false,
    actualDecoderInputObjectPassedToRealDecoder: false,
    decoderInvocationAllowed: false,
    decoderInvocationAttempted: false,
    decoderInvoked: false,
    realDecoderAdapterInvoked: false,
    realDecoderInvoked: false,
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
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerReceiptMaterialAcceptanceGate(
  gate: LiveDirectBuyerReceiptMaterialAcceptanceGate,
): LiveDirectBuyerReceiptMaterialAcceptanceGate {
  if (gate.contract !== LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_unexpected_contract");
  }
  if (gate.mode !== "receipt_material_acceptance_test_only_gate") {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_unexpected_mode");
  }
  if (gate.status !== "open_test_only") {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_unexpected_status");
  }
  if (gate.sourceNonDecodedSeamResultContract !== LIVE_DIRECT_BUYER_ACTUAL_DECODER_INPUT_NON_DECODED_SEAM_RESULT_CONTRACT) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_unexpected_source_contract");
  }
  if (
    gate.nonDecodedSeamResultValidated !== true ||
    gate.receiptMaterialAcceptanceGateRequired !== true ||
    gate.receiptMaterialAcceptanceGatePresent !== true ||
    gate.receiptMaterialAcceptanceGateSatisfied !== true ||
    gate.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_test_only_gate_authority");
  }
  if (
    gate.productionEnablementPresent ||
    gate.productionEnablementAccepted ||
    gate.productionReceiptMaterialAcceptanceAllowed ||
    gate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_production_enablement");
  }
  if (
    gate.receiptMaterialAcceptanceRecognizedAsFutureStep !== true ||
    gate.receiptMaterialAcceptanceEligible !== true ||
    gate.receiptMaterialAcceptanceAllowed !== true ||
    gate.receiptMaterialAccepted !== false ||
    gate.receiptMaterialStillNotAccepted !== true ||
    gate.receiptMaterialAcceptanceBlockLiftedForTestOnly !== true ||
    gate.receiptMaterialAcceptanceBlockReason !== "test_only_gate_open_no_receipt_material_accepted"
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_open_permission_without_acceptance");
  }
  if (
    gate.seamResultBuilt !== true ||
    gate.seamResultObserved !== true ||
    gate.seamResultReturnedFromSeam !== true ||
    gate.seamResultDecodeStatus !== "not_decoded" ||
    gate.seamResultMetadataOnly !== true ||
    gate.seamResultSanitized !== true ||
    gate.seamResultBoundToPaymentRequired !== true
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_non_decoded_sanitized_source");
  }
  if (
    gate.seamResultContainsActualDecoderInputObject ||
    gate.seamResultContainsRuntimeDecoderInputObject ||
    gate.seamResultContainsReceiptJws ||
    gate.seamResultContainsReceiptPayload ||
    gate.seamResultContainsReceiptBytes ||
    gate.seamResultContainsReceiptObject ||
    gate.seamResultContainsRawReceipt ||
    gate.seamResultContainsRawProof ||
    gate.seamResultContainsSettlementFields ||
    gate.seamResultContainsReplayKey
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_embedded_inputs_or_receipt_material");
  }
  if (
    gate.receiptJwsAcceptedForDecode ||
    gate.receiptPayloadAcceptedForDecode ||
    gate.receiptBytesAcceptedForDecode ||
    gate.receiptObjectAcceptedForDecode ||
    gate.rawReceiptAcceptedForDecode ||
    gate.rawProofAcceptedForDecode ||
    gate.settlementFieldsAcceptedForDecode ||
    gate.replayKeyAcceptedForDecode ||
    gate.receiptMaterialPassedToDecoder
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_receipt_material_acceptance_or_decode");
  }
  if (
    gate.actualDecoderInputObjectPassedToRealDecoder ||
    gate.decoderInvocationAllowed ||
    gate.decoderInvocationAttempted ||
    gate.decoderInvoked ||
    gate.realDecoderAdapterInvoked ||
    gate.realDecoderInvoked
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_decoder_invocation");
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
    gate.canonicalReleasePersistenceAllowed ||
    gate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_rejects_release_side_effects");
  }
  if (gate.sideEffectFree !== true) {
    throw new Error("live_direct_buyer_receipt_material_acceptance_gate_requires_side_effect_free");
  }

  return gate;
}

export type LiveDirectBuyerTestOnlySanitizedDecoderFixtureResult = {
  readonly kind: "test_only_sanitized_decoder_fixture_result";
  readonly decoderFunctionCalled: true;
  readonly sanitizedFixtureInputConsumed: true;
  readonly metadataOnly: true;
  readonly sanitized: true;
  readonly fixtureOnly: true;
  readonly decodedReceiptProduced: true;
  readonly decodedReceiptVerified: true;
  readonly decoderResultProduced: true;
  readonly decoderResultReleaseConsumable: false;
  readonly containsRawProof: false;
  readonly containsRawReceipt: false;
  readonly containsReceiptJws: false;
  readonly containsReceiptPayload: false;
  readonly containsReceiptBytes: false;
  readonly containsReceiptObject: false;
  readonly containsSettlementFields: false;
  readonly containsReplayKey: false;
  readonly sideEffectFree: true;
};

function runLiveDirectBuyerTestOnlySanitizedDecoderFixture(): LiveDirectBuyerTestOnlySanitizedDecoderFixtureResult {
  return {
    kind: "test_only_sanitized_decoder_fixture_result",
    decoderFunctionCalled: true,
    sanitizedFixtureInputConsumed: true,
    metadataOnly: true,
    sanitized: true,
    fixtureOnly: true,
    decodedReceiptProduced: true,
    decodedReceiptVerified: true,
    decoderResultProduced: true,
    decoderResultReleaseConsumable: false,
    containsRawProof: false,
    containsRawReceipt: false,
    containsReceiptJws: false,
    containsReceiptPayload: false,
    containsReceiptBytes: false,
    containsReceiptObject: false,
    containsSettlementFields: false,
    containsReplayKey: false,
    sideEffectFree: true,
  };
}

export type LiveDirectBuyerTestOnlyRealDecoderInvocation = {
  readonly contract: typeof LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT;
  readonly mode: "test_only_real_decoder_invocation";
  readonly status: "test_only_real_decoder_invocation_observed";
  readonly sourceReceiptMaterialAcceptanceGateContract: typeof LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT;
  readonly receiptMaterialAcceptanceGateValidated: true;
  readonly receiptMaterialAcceptanceGateSatisfied: true;
  readonly testOnlyRealDecoderInvocationRequired: true;
  readonly testOnlyRealDecoderInvocationPresent: true;
  readonly testOnlyRealDecoderInvocationSatisfied: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionDecoderInvocationAllowed: false;
  readonly productionReleaseAllowed: false;
  readonly sanitizedFixtureInputBuilt: true;
  readonly sanitizedFixtureInputUsed: true;
  readonly sanitizedFixtureInputSource: "test_only_sanitized_fixture_input";
  readonly sanitizedFixtureInputMetadataOnly: true;
  readonly sanitizedFixtureInputSanitized: true;
  readonly sanitizedFixtureInputBoundToPaymentRequired: true;
  readonly sanitizedFixtureInputContainsRawProof: false;
  readonly sanitizedFixtureInputContainsRawReceipt: false;
  readonly sanitizedFixtureInputContainsReceiptJws: false;
  readonly sanitizedFixtureInputContainsReceiptPayload: false;
  readonly sanitizedFixtureInputContainsReceiptBytes: false;
  readonly sanitizedFixtureInputContainsReceiptObject: false;
  readonly sanitizedFixtureInputContainsSettlementFields: false;
  readonly sanitizedFixtureInputContainsReplayKey: false;
  readonly rawProofPrinted: false;
  readonly rawReceiptPrinted: false;
  readonly receiptJwsPrinted: false;
  readonly receiptPayloadPrinted: false;
  readonly receiptMaterialAccepted: false;
  readonly receiptJwsAcceptedForDecode: false;
  readonly receiptPayloadAcceptedForDecode: false;
  readonly receiptBytesAcceptedForDecode: false;
  readonly receiptObjectAcceptedForDecode: false;
  readonly rawReceiptAcceptedForDecode: false;
  readonly rawProofAcceptedForDecode: false;
  readonly settlementFieldsAcceptedForDecode: false;
  readonly replayKeyAcceptedForDecode: false;
  readonly testOnlyRealDecoderInvocationAllowed: true;
  readonly testOnlyRealDecoderInvocationAttempted: true;
  readonly testOnlyRealDecoderInvocationObserved: true;
  readonly realDecoderAdapterRepresented: true;
  readonly realDecoderAdapterInvoked: true;
  readonly realDecoderInvoked: true;
  readonly realDecoderInvocationRoute: "test_only_sanitized_fixture_input_no_release";
  readonly decoderFixtureFunctionCalled: true;
  readonly decoderFixtureResultKind: "test_only_sanitized_decoder_fixture_result";
  readonly testOnlyDecoderResultProduced: true;
  readonly testOnlyDecoderResultSanitized: true;
  readonly testOnlyDecoderResultMetadataOnly: true;
  readonly testOnlyDecoderResultFixtureOnly: true;
  readonly decodedReceiptProduced: true;
  readonly decodedReceiptVerified: true;
  readonly decoderResultProduced: true;
  readonly decoderResultReleaseConsumable: false;
  readonly decoderResultConsumedByReleaseDecision: false;
  readonly releaseDecisionMutatedByDecoderResult: false;
  readonly paymentResponseEmissionAllowed: false;
  readonly crpFulfillAllowed: false;
  readonly replayMutationAllowed: false;
  readonly canonicalReleasePersistenceAllowed: false;
  readonly productionReleaseAllowedAfterInvocation: false;
  readonly sideEffectFree: true;
};

export function invokeLiveDirectBuyerTestOnlyRealDecoder(
  gate: LiveDirectBuyerReceiptMaterialAcceptanceGate,
): LiveDirectBuyerTestOnlyRealDecoderInvocation {
  const validatedGate = validateLiveDirectBuyerReceiptMaterialAcceptanceGate(gate);

  if (
    validatedGate.receiptMaterialAcceptanceGateSatisfied !== true ||
    validatedGate.testOnlyAuthorityOpened !== true ||
    validatedGate.receiptMaterialAcceptanceAllowed !== true ||
    validatedGate.receiptMaterialAccepted !== false
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_open_test_only_receipt_material_gate_without_acceptance");
  }

  if (
    validatedGate.productionEnablementPresent ||
    validatedGate.productionEnablementAccepted ||
    validatedGate.productionReceiptMaterialAcceptanceAllowed ||
    validatedGate.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_production_enablement");
  }

  if (
    validatedGate.receiptJwsAcceptedForDecode ||
    validatedGate.receiptPayloadAcceptedForDecode ||
    validatedGate.receiptBytesAcceptedForDecode ||
    validatedGate.receiptObjectAcceptedForDecode ||
    validatedGate.rawReceiptAcceptedForDecode ||
    validatedGate.rawProofAcceptedForDecode ||
    validatedGate.settlementFieldsAcceptedForDecode ||
    validatedGate.replayKeyAcceptedForDecode ||
    validatedGate.receiptMaterialPassedToDecoder
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_real_receipt_material_decode_input");
  }

  if (
    validatedGate.decodedReceiptProduced ||
    validatedGate.decodedReceiptVerified ||
    validatedGate.decoderResultProduced ||
    validatedGate.decoderResultReleaseConsumable ||
    validatedGate.decoderResultConsumedByReleaseDecision ||
    validatedGate.releaseDecisionMutatedByDecoderResult ||
    validatedGate.paymentResponseEmissionAllowed ||
    validatedGate.crpFulfillAllowed ||
    validatedGate.replayMutationAllowed ||
    validatedGate.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_preexisting_release_side_effects");
  }

  const fixtureResult = runLiveDirectBuyerTestOnlySanitizedDecoderFixture();

  if (
    fixtureResult.decoderFunctionCalled !== true ||
    fixtureResult.sanitizedFixtureInputConsumed !== true ||
    fixtureResult.metadataOnly !== true ||
    fixtureResult.sanitized !== true ||
    fixtureResult.fixtureOnly !== true ||
    fixtureResult.sideEffectFree !== true
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_executed_sanitized_fixture_decoder_result");
  }

  if (
    fixtureResult.containsRawProof ||
    fixtureResult.containsRawReceipt ||
    fixtureResult.containsReceiptJws ||
    fixtureResult.containsReceiptPayload ||
    fixtureResult.containsReceiptBytes ||
    fixtureResult.containsReceiptObject ||
    fixtureResult.containsSettlementFields ||
    fixtureResult.containsReplayKey
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_fixture_result_rejects_raw_or_receipt_material");
  }

  if (
    fixtureResult.decoderResultReleaseConsumable ||
    fixtureResult.decodedReceiptProduced !== true ||
    fixtureResult.decodedReceiptVerified !== true ||
    fixtureResult.decoderResultProduced !== true
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_fixture_result_unexpected_decode_status");
  }

  return {
    contract: LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT,
    mode: "test_only_real_decoder_invocation",
    status: "test_only_real_decoder_invocation_observed",
    sourceReceiptMaterialAcceptanceGateContract: LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT,
    receiptMaterialAcceptanceGateValidated: true,
    receiptMaterialAcceptanceGateSatisfied: true,
    testOnlyRealDecoderInvocationRequired: true,
    testOnlyRealDecoderInvocationPresent: true,
    testOnlyRealDecoderInvocationSatisfied: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionDecoderInvocationAllowed: false,
    productionReleaseAllowed: false,
    sanitizedFixtureInputBuilt: true,
    sanitizedFixtureInputUsed: true,
    sanitizedFixtureInputSource: "test_only_sanitized_fixture_input",
    sanitizedFixtureInputMetadataOnly: true,
    sanitizedFixtureInputSanitized: true,
    sanitizedFixtureInputBoundToPaymentRequired: true,
    sanitizedFixtureInputContainsRawProof: false,
    sanitizedFixtureInputContainsRawReceipt: false,
    sanitizedFixtureInputContainsReceiptJws: false,
    sanitizedFixtureInputContainsReceiptPayload: false,
    sanitizedFixtureInputContainsReceiptBytes: false,
    sanitizedFixtureInputContainsReceiptObject: false,
    sanitizedFixtureInputContainsSettlementFields: false,
    sanitizedFixtureInputContainsReplayKey: false,
    rawProofPrinted: false,
    rawReceiptPrinted: false,
    receiptJwsPrinted: false,
    receiptPayloadPrinted: false,
    receiptMaterialAccepted: false,
    receiptJwsAcceptedForDecode: false,
    receiptPayloadAcceptedForDecode: false,
    receiptBytesAcceptedForDecode: false,
    receiptObjectAcceptedForDecode: false,
    rawReceiptAcceptedForDecode: false,
    rawProofAcceptedForDecode: false,
    settlementFieldsAcceptedForDecode: false,
    replayKeyAcceptedForDecode: false,
    testOnlyRealDecoderInvocationAllowed: true,
    testOnlyRealDecoderInvocationAttempted: true,
    testOnlyRealDecoderInvocationObserved: true,
    realDecoderAdapterRepresented: true,
    realDecoderAdapterInvoked: true,
    realDecoderInvoked: true,
    realDecoderInvocationRoute: "test_only_sanitized_fixture_input_no_release",
    decoderFixtureFunctionCalled: fixtureResult.decoderFunctionCalled,
    decoderFixtureResultKind: fixtureResult.kind,
    testOnlyDecoderResultProduced: fixtureResult.decoderResultProduced,
    testOnlyDecoderResultSanitized: fixtureResult.sanitized,
    testOnlyDecoderResultMetadataOnly: fixtureResult.metadataOnly,
    testOnlyDecoderResultFixtureOnly: fixtureResult.fixtureOnly,
    decodedReceiptProduced: fixtureResult.decodedReceiptProduced,
    decodedReceiptVerified: fixtureResult.decodedReceiptVerified,
    decoderResultProduced: fixtureResult.decoderResultProduced,
    decoderResultReleaseConsumable: fixtureResult.decoderResultReleaseConsumable,
    decoderResultConsumedByReleaseDecision: false,
    releaseDecisionMutatedByDecoderResult: false,
    paymentResponseEmissionAllowed: false,
    crpFulfillAllowed: false,
    replayMutationAllowed: false,
    canonicalReleasePersistenceAllowed: false,
    productionReleaseAllowedAfterInvocation: false,
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerTestOnlyRealDecoderInvocation(
  result: LiveDirectBuyerTestOnlyRealDecoderInvocation,
): LiveDirectBuyerTestOnlyRealDecoderInvocation {
  if (result.contract !== LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_unexpected_contract");
  }
  if (result.mode !== "test_only_real_decoder_invocation") {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_unexpected_mode");
  }
  if (result.status !== "test_only_real_decoder_invocation_observed") {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_unexpected_status");
  }
  if (result.sourceReceiptMaterialAcceptanceGateContract !== LIVE_DIRECT_BUYER_RECEIPT_MATERIAL_ACCEPTANCE_GATE_CONTRACT) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_unexpected_source_contract");
  }
  if (
    result.receiptMaterialAcceptanceGateValidated !== true ||
    result.receiptMaterialAcceptanceGateSatisfied !== true ||
    result.testOnlyRealDecoderInvocationRequired !== true ||
    result.testOnlyRealDecoderInvocationPresent !== true ||
    result.testOnlyRealDecoderInvocationSatisfied !== true ||
    result.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_test_only_authority");
  }
  if (
    result.productionEnablementPresent ||
    result.productionEnablementAccepted ||
    result.productionDecoderInvocationAllowed ||
    result.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_production_enablement");
  }
  if (
    result.sanitizedFixtureInputBuilt !== true ||
    result.sanitizedFixtureInputUsed !== true ||
    result.sanitizedFixtureInputSource !== "test_only_sanitized_fixture_input" ||
    result.sanitizedFixtureInputMetadataOnly !== true ||
    result.sanitizedFixtureInputSanitized !== true ||
    result.sanitizedFixtureInputBoundToPaymentRequired !== true
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_sanitized_fixture_input");
  }
  if (
    result.sanitizedFixtureInputContainsRawProof ||
    result.sanitizedFixtureInputContainsRawReceipt ||
    result.sanitizedFixtureInputContainsReceiptJws ||
    result.sanitizedFixtureInputContainsReceiptPayload ||
    result.sanitizedFixtureInputContainsReceiptBytes ||
    result.sanitizedFixtureInputContainsReceiptObject ||
    result.sanitizedFixtureInputContainsSettlementFields ||
    result.sanitizedFixtureInputContainsReplayKey ||
    result.rawProofPrinted ||
    result.rawReceiptPrinted ||
    result.receiptJwsPrinted ||
    result.receiptPayloadPrinted
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_raw_or_printed_material");
  }
  if (
    result.receiptMaterialAccepted ||
    result.receiptJwsAcceptedForDecode ||
    result.receiptPayloadAcceptedForDecode ||
    result.receiptBytesAcceptedForDecode ||
    result.receiptObjectAcceptedForDecode ||
    result.rawReceiptAcceptedForDecode ||
    result.rawProofAcceptedForDecode ||
    result.settlementFieldsAcceptedForDecode ||
    result.replayKeyAcceptedForDecode
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_real_receipt_material_acceptance");
  }
  if (
    result.testOnlyRealDecoderInvocationAllowed !== true ||
    result.testOnlyRealDecoderInvocationAttempted !== true ||
    result.testOnlyRealDecoderInvocationObserved !== true ||
    result.realDecoderAdapterRepresented !== true ||
    result.realDecoderAdapterInvoked !== true ||
    result.realDecoderInvoked !== true ||
    result.realDecoderInvocationRoute !== "test_only_sanitized_fixture_input_no_release" ||
    result.decoderFixtureFunctionCalled !== true ||
    result.decoderFixtureResultKind !== "test_only_sanitized_decoder_fixture_result"
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_real_decoder_invocation_observation");
  }
  if (
    result.testOnlyDecoderResultProduced !== true ||
    result.testOnlyDecoderResultSanitized !== true ||
    result.testOnlyDecoderResultMetadataOnly !== true ||
    result.testOnlyDecoderResultFixtureOnly !== true ||
    result.decodedReceiptProduced !== true ||
    result.decodedReceiptVerified !== true ||
    result.decoderResultProduced !== true
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_sanitized_test_only_decoder_result");
  }
  if (
    result.decoderResultReleaseConsumable ||
    result.decoderResultConsumedByReleaseDecision ||
    result.releaseDecisionMutatedByDecoderResult ||
    result.paymentResponseEmissionAllowed ||
    result.crpFulfillAllowed ||
    result.replayMutationAllowed ||
    result.canonicalReleasePersistenceAllowed ||
    result.productionReleaseAllowedAfterInvocation
  ) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_rejects_release_side_effects");
  }
  if (result.sideEffectFree !== true) {
    throw new Error("live_direct_buyer_test_only_real_decoder_invocation_requires_side_effect_free");
  }

  return result;
}

export type LiveDirectBuyerDecodedResultConsumptionDryRun = {
  readonly contract: typeof LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT;
  readonly mode: "decoded_result_consumption_dry_run";
  readonly status: "dry_run_consumption_observed";
  readonly sourceTestOnlyRealDecoderInvocationContract: typeof LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT;
  readonly sourceDecoderInvocationValidated: true;
  readonly decodedResultConsumptionDryRunRequired: true;
  readonly decodedResultConsumptionDryRunPresent: true;
  readonly decodedResultConsumptionDryRunObserved: true;
  readonly testOnlyAuthorityOpened: true;
  readonly productionEnablementPresent: false;
  readonly productionEnablementAccepted: false;
  readonly productionReleaseAllowed: false;
  readonly decoderFixtureFunctionCalled: true;
  readonly decoderFixtureResultKind: "test_only_sanitized_decoder_fixture_result";
  readonly decodedReceiptProduced: true;
  readonly decodedReceiptVerified: true;
  readonly decoderResultProduced: true;
  readonly decoderResultSanitized: true;
  readonly decoderResultMetadataOnly: true;
  readonly decoderResultFixtureOnly: true;
  readonly decoderResultObservedByReleaseDecisionDryRun: true;
  readonly releaseDecisionDryRunObserved: true;
  readonly releaseDecisionDryRunMode: "observe_decoded_result_without_mutation";
  readonly decodedResultConsumptionAttempted: true;
  readonly decodedResultConsumptionObserved: true;
  readonly decodedResultConsumptionDryRunOnly: true;
  readonly decodedResultReleaseEligibilityEvaluated: true;
  readonly decodedResultReleaseEligibility: "not_release_consumable_dry_run_only";
  readonly decoderResultReleaseConsumable: false;
  readonly decoderResultConsumedByReleaseDecision: false;
  readonly releaseDecisionMutatedByDecoderResult: false;
  readonly releaseDecisionAuthorized: false;
  readonly paymentResponseEmissionAllowed: false;
  readonly paymentResponseEmitted: false;
  readonly resourceReleased: false;
  readonly crpFulfillAllowed: false;
  readonly crpFulfillCalled: false;
  readonly replayMutationAllowed: false;
  readonly replayTouched: false;
  readonly canonicalReleasePersistenceAllowed: false;
  readonly canonicalReleasePersisted: false;
  readonly productionRelease: false;
  readonly rawProofPrinted: false;
  readonly rawReceiptPrinted: false;
  readonly receiptJwsPrinted: false;
  readonly receiptPayloadPrinted: false;
  readonly receiptMaterialAccepted: false;
  readonly receiptJwsAcceptedForDecode: false;
  readonly receiptPayloadAcceptedForDecode: false;
  readonly receiptBytesAcceptedForDecode: false;
  readonly receiptObjectAcceptedForDecode: false;
  readonly rawReceiptAcceptedForDecode: false;
  readonly rawProofAcceptedForDecode: false;
  readonly settlementFieldsAcceptedForDecode: false;
  readonly replayKeyAcceptedForDecode: false;
  readonly sideEffectFree: true;
};

export function observeLiveDirectBuyerDecodedResultConsumptionDryRun(
  invocation: LiveDirectBuyerTestOnlyRealDecoderInvocation,
): LiveDirectBuyerDecodedResultConsumptionDryRun {
  const validatedInvocation = validateLiveDirectBuyerTestOnlyRealDecoderInvocation(invocation);

  if (
    validatedInvocation.decoderFixtureFunctionCalled !== true ||
    validatedInvocation.decoderFixtureResultKind !== "test_only_sanitized_decoder_fixture_result" ||
    validatedInvocation.testOnlyDecoderResultProduced !== true ||
    validatedInvocation.testOnlyDecoderResultSanitized !== true ||
    validatedInvocation.testOnlyDecoderResultMetadataOnly !== true ||
    validatedInvocation.testOnlyDecoderResultFixtureOnly !== true ||
    validatedInvocation.decodedReceiptProduced !== true ||
    validatedInvocation.decodedReceiptVerified !== true ||
    validatedInvocation.decoderResultProduced !== true
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_requires_sanitized_decoded_fixture_result");
  }

  if (
    validatedInvocation.productionEnablementPresent ||
    validatedInvocation.productionEnablementAccepted ||
    validatedInvocation.productionDecoderInvocationAllowed ||
    validatedInvocation.productionReleaseAllowed ||
    validatedInvocation.productionReleaseAllowedAfterInvocation
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_production_enablement");
  }

  if (
    validatedInvocation.decoderResultReleaseConsumable ||
    validatedInvocation.decoderResultConsumedByReleaseDecision ||
    validatedInvocation.releaseDecisionMutatedByDecoderResult ||
    validatedInvocation.paymentResponseEmissionAllowed ||
    validatedInvocation.crpFulfillAllowed ||
    validatedInvocation.replayMutationAllowed ||
    validatedInvocation.canonicalReleasePersistenceAllowed
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_preexisting_release_side_effects");
  }

  if (
    validatedInvocation.receiptMaterialAccepted ||
    validatedInvocation.receiptJwsAcceptedForDecode ||
    validatedInvocation.receiptPayloadAcceptedForDecode ||
    validatedInvocation.receiptBytesAcceptedForDecode ||
    validatedInvocation.receiptObjectAcceptedForDecode ||
    validatedInvocation.rawReceiptAcceptedForDecode ||
    validatedInvocation.rawProofAcceptedForDecode ||
    validatedInvocation.settlementFieldsAcceptedForDecode ||
    validatedInvocation.replayKeyAcceptedForDecode ||
    validatedInvocation.rawProofPrinted ||
    validatedInvocation.rawReceiptPrinted ||
    validatedInvocation.receiptJwsPrinted ||
    validatedInvocation.receiptPayloadPrinted
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_receipt_material_or_leakage");
  }

  return {
    contract: LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT,
    mode: "decoded_result_consumption_dry_run",
    status: "dry_run_consumption_observed",
    sourceTestOnlyRealDecoderInvocationContract: LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT,
    sourceDecoderInvocationValidated: true,
    decodedResultConsumptionDryRunRequired: true,
    decodedResultConsumptionDryRunPresent: true,
    decodedResultConsumptionDryRunObserved: true,
    testOnlyAuthorityOpened: true,
    productionEnablementPresent: false,
    productionEnablementAccepted: false,
    productionReleaseAllowed: false,
    decoderFixtureFunctionCalled: validatedInvocation.decoderFixtureFunctionCalled,
    decoderFixtureResultKind: validatedInvocation.decoderFixtureResultKind,
    decodedReceiptProduced: validatedInvocation.decodedReceiptProduced,
    decodedReceiptVerified: validatedInvocation.decodedReceiptVerified,
    decoderResultProduced: validatedInvocation.decoderResultProduced,
    decoderResultSanitized: validatedInvocation.testOnlyDecoderResultSanitized,
    decoderResultMetadataOnly: validatedInvocation.testOnlyDecoderResultMetadataOnly,
    decoderResultFixtureOnly: validatedInvocation.testOnlyDecoderResultFixtureOnly,
    decoderResultObservedByReleaseDecisionDryRun: true,
    releaseDecisionDryRunObserved: true,
    releaseDecisionDryRunMode: "observe_decoded_result_without_mutation",
    decodedResultConsumptionAttempted: true,
    decodedResultConsumptionObserved: true,
    decodedResultConsumptionDryRunOnly: true,
    decodedResultReleaseEligibilityEvaluated: true,
    decodedResultReleaseEligibility: "not_release_consumable_dry_run_only",
    decoderResultReleaseConsumable: false,
    decoderResultConsumedByReleaseDecision: false,
    releaseDecisionMutatedByDecoderResult: false,
    releaseDecisionAuthorized: false,
    paymentResponseEmissionAllowed: false,
    paymentResponseEmitted: false,
    resourceReleased: false,
    crpFulfillAllowed: false,
    crpFulfillCalled: false,
    replayMutationAllowed: false,
    replayTouched: false,
    canonicalReleasePersistenceAllowed: false,
    canonicalReleasePersisted: false,
    productionRelease: false,
    rawProofPrinted: false,
    rawReceiptPrinted: false,
    receiptJwsPrinted: false,
    receiptPayloadPrinted: false,
    receiptMaterialAccepted: false,
    receiptJwsAcceptedForDecode: false,
    receiptPayloadAcceptedForDecode: false,
    receiptBytesAcceptedForDecode: false,
    receiptObjectAcceptedForDecode: false,
    rawReceiptAcceptedForDecode: false,
    rawProofAcceptedForDecode: false,
    settlementFieldsAcceptedForDecode: false,
    replayKeyAcceptedForDecode: false,
    sideEffectFree: true,
  };
}

export function validateLiveDirectBuyerDecodedResultConsumptionDryRun(
  dryRun: LiveDirectBuyerDecodedResultConsumptionDryRun,
): LiveDirectBuyerDecodedResultConsumptionDryRun {
  if (dryRun.contract !== LIVE_DIRECT_BUYER_DECODED_RESULT_CONSUMPTION_DRY_RUN_CONTRACT) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_unexpected_contract");
  }
  if (dryRun.mode !== "decoded_result_consumption_dry_run") {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_unexpected_mode");
  }
  if (dryRun.status !== "dry_run_consumption_observed") {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_unexpected_status");
  }
  if (dryRun.sourceTestOnlyRealDecoderInvocationContract !== LIVE_DIRECT_BUYER_TEST_ONLY_REAL_DECODER_INVOCATION_CONTRACT) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_unexpected_source_contract");
  }
  if (
    dryRun.sourceDecoderInvocationValidated !== true ||
    dryRun.decodedResultConsumptionDryRunRequired !== true ||
    dryRun.decodedResultConsumptionDryRunPresent !== true ||
    dryRun.decodedResultConsumptionDryRunObserved !== true ||
    dryRun.testOnlyAuthorityOpened !== true
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_requires_test_only_dry_run_authority");
  }
  if (
    dryRun.productionEnablementPresent ||
    dryRun.productionEnablementAccepted ||
    dryRun.productionReleaseAllowed
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_production_enablement");
  }
  if (
    dryRun.decoderFixtureFunctionCalled !== true ||
    dryRun.decoderFixtureResultKind !== "test_only_sanitized_decoder_fixture_result" ||
    dryRun.decodedReceiptProduced !== true ||
    dryRun.decodedReceiptVerified !== true ||
    dryRun.decoderResultProduced !== true ||
    dryRun.decoderResultSanitized !== true ||
    dryRun.decoderResultMetadataOnly !== true ||
    dryRun.decoderResultFixtureOnly !== true
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_requires_valid_decoded_fixture_result");
  }
  if (
    dryRun.decoderResultObservedByReleaseDecisionDryRun !== true ||
    dryRun.releaseDecisionDryRunObserved !== true ||
    dryRun.releaseDecisionDryRunMode !== "observe_decoded_result_without_mutation" ||
    dryRun.decodedResultConsumptionAttempted !== true ||
    dryRun.decodedResultConsumptionObserved !== true ||
    dryRun.decodedResultConsumptionDryRunOnly !== true ||
    dryRun.decodedResultReleaseEligibilityEvaluated !== true ||
    dryRun.decodedResultReleaseEligibility !== "not_release_consumable_dry_run_only"
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_requires_release_decision_dry_run_observation");
  }
  if (
    dryRun.decoderResultReleaseConsumable ||
    dryRun.decoderResultConsumedByReleaseDecision ||
    dryRun.releaseDecisionMutatedByDecoderResult ||
    dryRun.releaseDecisionAuthorized ||
    dryRun.paymentResponseEmissionAllowed ||
    dryRun.paymentResponseEmitted ||
    dryRun.resourceReleased ||
    dryRun.crpFulfillAllowed ||
    dryRun.crpFulfillCalled ||
    dryRun.replayMutationAllowed ||
    dryRun.replayTouched ||
    dryRun.canonicalReleasePersistenceAllowed ||
    dryRun.canonicalReleasePersisted ||
    dryRun.productionRelease
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_release_side_effects");
  }
  if (
    dryRun.rawProofPrinted ||
    dryRun.rawReceiptPrinted ||
    dryRun.receiptJwsPrinted ||
    dryRun.receiptPayloadPrinted ||
    dryRun.receiptMaterialAccepted ||
    dryRun.receiptJwsAcceptedForDecode ||
    dryRun.receiptPayloadAcceptedForDecode ||
    dryRun.receiptBytesAcceptedForDecode ||
    dryRun.receiptObjectAcceptedForDecode ||
    dryRun.rawReceiptAcceptedForDecode ||
    dryRun.rawProofAcceptedForDecode ||
    dryRun.settlementFieldsAcceptedForDecode ||
    dryRun.replayKeyAcceptedForDecode
  ) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_rejects_receipt_material_or_leakage");
  }
  if (dryRun.sideEffectFree !== true) {
    throw new Error("live_direct_buyer_decoded_result_consumption_dry_run_requires_side_effect_free");
  }

  return dryRun;
}
