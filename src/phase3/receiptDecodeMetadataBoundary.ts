export const RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT =
  'phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptDecodeMetadataBoundary.v1' as const;

export const RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES = [
  'contractBinding',
  'resourceBinding',
  'merchantBinding',
  'networkBinding',
  'assetBinding',
  'amountBinding',
  'destinationBinding',
  'nonceBinding',
  'upstreamGateContext',
  'decoderContractVersion',
] as const;

export const RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES = [
  'receiptJws',
  'receiptJwsHeader',
  'receiptJwsPayload',
  'receiptPayload',
  'receiptBytes',
  'receiptObject',
  'transactionHash',
  'settlementFields',
  'replayKey',
] as const;

export type ReceiptDecodeMetadataBoundaryDescriptor = {
  contract: string;
  mode: string;
  status: string;
  ready: boolean;
  decoderInput: {
    futureDecoderInputRequired: boolean;
    metadataOnly: boolean;
    inputObjectBuilt: boolean;
    decoderInvocationAllowed: boolean;
    decoderInvocationObserved: boolean;
    allowedMetadataCategories: readonly string[];
    prohibitedReceiptMaterialCategories: readonly string[];
    receiptJwsAccepted: boolean;
    receiptPayloadAccepted: boolean;
    receiptBytesAccepted: boolean;
    receiptObjectAccepted: boolean;
    transactionHashAccepted: boolean;
  };
};

export type ReceiptDecodeMetadataBoundaryValidationResult =
  | {
      ok: true;
      reason: null;
    }
  | {
      ok: false;
      reason:
        | 'contract_mismatch'
        | 'mode_mismatch'
        | 'status_mismatch'
        | 'boundary_marked_ready'
        | 'future_decoder_input_not_required'
        | 'boundary_not_metadata_only'
        | 'runtime_input_object_built'
        | 'decoder_invocation_allowed'
        | 'decoder_invocation_observed'
        | 'required_allowed_metadata_category_missing'
        | 'prohibited_receipt_material_category_missing'
        | 'allowed_and_prohibited_categories_overlap'
        | 'prohibited_receipt_material_allowed'
        | 'receipt_material_accepted';
    };

export function buildReceiptDecodeMetadataBoundaryDescriptor(): ReceiptDecodeMetadataBoundaryDescriptor {
  return {
    contract: RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT,
    mode: 'contract_only',
    status: 'preflight_ready',
    ready: false,
    decoderInput: {
      futureDecoderInputRequired: true,
      metadataOnly: true,
      inputObjectBuilt: false,
      decoderInvocationAllowed: false,
      decoderInvocationObserved: false,
      allowedMetadataCategories: [
        ...RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES,
      ],
      prohibitedReceiptMaterialCategories: [
        ...RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES,
      ],
      receiptJwsAccepted: false,
      receiptPayloadAccepted: false,
      receiptBytesAccepted: false,
      receiptObjectAccepted: false,
      transactionHashAccepted: false,
    },
  };
}

export function validateReceiptDecodeMetadataBoundaryDescriptor(
  descriptor: ReceiptDecodeMetadataBoundaryDescriptor,
): ReceiptDecodeMetadataBoundaryValidationResult {
  if (descriptor.contract !== RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT) {
    return { ok: false, reason: 'contract_mismatch' };
  }

  if (descriptor.mode !== 'contract_only') {
    return { ok: false, reason: 'mode_mismatch' };
  }

  if (descriptor.status !== 'preflight_ready') {
    return { ok: false, reason: 'status_mismatch' };
  }

  if (descriptor.ready !== false) {
    return { ok: false, reason: 'boundary_marked_ready' };
  }

  const decoderInput = descriptor.decoderInput;

  if (decoderInput.futureDecoderInputRequired !== true) {
    return { ok: false, reason: 'future_decoder_input_not_required' };
  }

  if (decoderInput.metadataOnly !== true) {
    return { ok: false, reason: 'boundary_not_metadata_only' };
  }

  if (decoderInput.inputObjectBuilt !== false) {
    return { ok: false, reason: 'runtime_input_object_built' };
  }

  if (decoderInput.decoderInvocationAllowed !== false) {
    return { ok: false, reason: 'decoder_invocation_allowed' };
  }

  if (decoderInput.decoderInvocationObserved !== false) {
    return { ok: false, reason: 'decoder_invocation_observed' };
  }

  const allowed = new Set(decoderInput.allowedMetadataCategories);
  const prohibited = new Set(decoderInput.prohibitedReceiptMaterialCategories);

  for (const category of RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES) {
    if (!allowed.has(category)) {
      return { ok: false, reason: 'required_allowed_metadata_category_missing' };
    }
  }

  for (const category of RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES) {
    if (!prohibited.has(category)) {
      return { ok: false, reason: 'prohibited_receipt_material_category_missing' };
    }

    if (allowed.has(category)) {
      return { ok: false, reason: 'prohibited_receipt_material_allowed' };
    }
  }

  for (const category of allowed) {
    if (prohibited.has(category)) {
      return { ok: false, reason: 'allowed_and_prohibited_categories_overlap' };
    }
  }

  if (
    decoderInput.receiptJwsAccepted ||
    decoderInput.receiptPayloadAccepted ||
    decoderInput.receiptBytesAccepted ||
    decoderInput.receiptObjectAccepted ||
    decoderInput.transactionHashAccepted
  ) {
    return { ok: false, reason: 'receipt_material_accepted' };
  }

  return { ok: true, reason: null };
}
