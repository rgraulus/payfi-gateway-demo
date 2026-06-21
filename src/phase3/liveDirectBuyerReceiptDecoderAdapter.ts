export const LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT =
  "phase3.liveDirectBuyer.receiptDecoderAdapter.implementationScaffold.v1" as const;

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
