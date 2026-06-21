#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT,
  buildLiveDirectBuyerReceiptDecoderAdapterScaffoldInput,
  runLiveDirectBuyerReceiptDecoderAdapterScaffold,
} from "../src/phase3/liveDirectBuyerReceiptDecoderAdapter";

function main() {
  const input = buildLiveDirectBuyerReceiptDecoderAdapterScaffoldInput();
  const result = runLiveDirectBuyerReceiptDecoderAdapterScaffold(input);

  assert.equal(result.ok, true);
  assert.equal(result.contract, LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_SCAFFOLD_CONTRACT);
  assert.equal(result.mode, "disabled_scaffold");
  assert.equal(result.status, "scaffold_ready");
  assert.equal(result.realDecoderAdapterImplemented, true);
  assert.equal(result.realDecoderRuntimeInvocationEnabled, false);
  assert.equal(result.scaffoldOnly, true);
  assert.equal(result.source, "scaffold_selftest");
  assert.equal(result.metadataOnly, true);
  assert.equal(result.sanitized, true);

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

  const rejectedInput = {
    ...input,
    receiptJwsPresent: true,
  };

  assert.throws(
    () => runLiveDirectBuyerReceiptDecoderAdapterScaffold(rejectedInput),
    /live_direct_buyer_receipt_decoder_adapter_scaffold_rejects_decode_material/,
  );

  console.log(JSON.stringify({
    ok: true,
    harness: "phase3.liveDirectBuyerReceiptDecoderAdapterScaffold.selftest.v1",
    contract: result.contract,
    mode: result.mode,
    status: result.status,
    realDecoderAdapterImplemented: result.realDecoderAdapterImplemented,
    realDecoderRuntimeInvocationEnabled: result.realDecoderRuntimeInvocationEnabled,
    scaffoldOnly: result.scaffoldOnly,
    metadataOnly: result.metadataOnly,
    sanitized: result.sanitized,
    receiptMaterialAccepted: result.receiptMaterialAccepted,
    receiptJwsAcceptedForDecode: result.receiptJwsAcceptedForDecode,
    receiptPayloadAcceptedForDecode: result.receiptPayloadAcceptedForDecode,
    runtimeDecoderInputObjectBuilt: result.runtimeDecoderInputObjectBuilt,
    actualDecoderInputObjectBuilt: result.actualDecoderInputObjectBuilt,
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
    productionReleaseAllowed: result.productionReleaseAllowed,
    prohibitedDecodeMaterialRejected: true,
    sideEffectFree: result.sideEffectFree,
  }, null, 2));
}

main();
