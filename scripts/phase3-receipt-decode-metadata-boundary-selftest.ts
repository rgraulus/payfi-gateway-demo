import assert from 'node:assert/strict';

import {
  buildReceiptDecodeMetadataBoundaryDescriptor,
  RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES,
  RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT,
  RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES,
  validateReceiptDecodeMetadataBoundaryDescriptor,
  type ReceiptDecodeMetadataBoundaryDescriptor,
} from '../src/phase3/receiptDecodeMetadataBoundary';

function cloneDescriptor(): ReceiptDecodeMetadataBoundaryDescriptor {
  const canonical = buildReceiptDecodeMetadataBoundaryDescriptor();

  return {
    ...canonical,
    decoderInput: {
      ...canonical.decoderInput,
      allowedMetadataCategories: [...canonical.decoderInput.allowedMetadataCategories],
      prohibitedReceiptMaterialCategories: [
        ...canonical.decoderInput.prohibitedReceiptMaterialCategories,
      ],
    },
  };
}

function expectRejected(input: {
  label: string;
  expectedReason: Exclude<
    ReturnType<typeof validateReceiptDecodeMetadataBoundaryDescriptor>['reason'],
    null
  >;
  mutate: (descriptor: ReceiptDecodeMetadataBoundaryDescriptor) => void;
}) {
  const descriptor = cloneDescriptor();
  input.mutate(descriptor);

  const result = validateReceiptDecodeMetadataBoundaryDescriptor(descriptor);

  assert.equal(result.ok, false, input.label);
  assert.equal(result.reason, input.expectedReason, input.label);
}

const canonical = buildReceiptDecodeMetadataBoundaryDescriptor();
const canonicalResult = validateReceiptDecodeMetadataBoundaryDescriptor(canonical);

assert.equal(canonicalResult.ok, true);
assert.equal(canonicalResult.reason, null);
assert.equal(canonical.contract, RECEIPT_DECODE_METADATA_BOUNDARY_CONTRACT);
assert.equal(canonical.mode, 'contract_only');
assert.equal(canonical.status, 'preflight_ready');
assert.equal(canonical.ready, false);
assert.equal(canonical.decoderInput.futureDecoderInputRequired, true);
assert.equal(canonical.decoderInput.metadataOnly, true);
assert.equal(canonical.decoderInput.inputObjectBuilt, false);
assert.equal(canonical.decoderInput.decoderInvocationAllowed, false);
assert.equal(canonical.decoderInput.decoderInvocationObserved, false);

for (const category of RECEIPT_DECODE_METADATA_BOUNDARY_ALLOWED_METADATA_CATEGORIES) {
  assert.equal(canonical.decoderInput.allowedMetadataCategories.includes(category), true);
}

for (const category of RECEIPT_DECODE_METADATA_BOUNDARY_PROHIBITED_RECEIPT_MATERIAL_CATEGORIES) {
  assert.equal(canonical.decoderInput.prohibitedReceiptMaterialCategories.includes(category), true);
  assert.equal(canonical.decoderInput.allowedMetadataCategories.includes(category), false);
}

expectRejected({
  label: 'missing required metadata category must fail closed',
  expectedReason: 'required_allowed_metadata_category_missing',
  mutate: (descriptor) => {
    descriptor.decoderInput.allowedMetadataCategories =
      descriptor.decoderInput.allowedMetadataCategories.filter(
        (category) => category !== 'nonceBinding',
      );
  },
});

expectRejected({
  label: 'missing prohibited receipt category must fail closed',
  expectedReason: 'prohibited_receipt_material_category_missing',
  mutate: (descriptor) => {
    descriptor.decoderInput.prohibitedReceiptMaterialCategories =
      descriptor.decoderInput.prohibitedReceiptMaterialCategories.filter(
        (category) => category !== 'receiptJws',
      );
  },
});

expectRejected({
  label: 'prohibited receipt material may not be allowed metadata',
  expectedReason: 'prohibited_receipt_material_allowed',
  mutate: (descriptor) => {
    descriptor.decoderInput.allowedMetadataCategories = [
      ...descriptor.decoderInput.allowedMetadataCategories,
      'receiptJws',
    ];
  },
});

expectRejected({
  label: 'noncanonical overlap must fail closed',
  expectedReason: 'allowed_and_prohibited_categories_overlap',
  mutate: (descriptor) => {
    descriptor.decoderInput.allowedMetadataCategories = [
      ...descriptor.decoderInput.allowedMetadataCategories,
      'syntheticOverlapOnly',
    ];
    descriptor.decoderInput.prohibitedReceiptMaterialCategories = [
      ...descriptor.decoderInput.prohibitedReceiptMaterialCategories,
      'syntheticOverlapOnly',
    ];
  },
});

expectRejected({
  label: 'runtime input construction must fail closed',
  expectedReason: 'runtime_input_object_built',
  mutate: (descriptor) => {
    descriptor.decoderInput.inputObjectBuilt = true;
  },
});

expectRejected({
  label: 'decoder invocation permission must fail closed',
  expectedReason: 'decoder_invocation_allowed',
  mutate: (descriptor) => {
    descriptor.decoderInput.decoderInvocationAllowed = true;
  },
});

expectRejected({
  label: 'observed decoder invocation must fail closed',
  expectedReason: 'decoder_invocation_observed',
  mutate: (descriptor) => {
    descriptor.decoderInput.decoderInvocationObserved = true;
  },
});

expectRejected({
  label: 'receipt material acceptance must fail closed',
  expectedReason: 'receipt_material_accepted',
  mutate: (descriptor) => {
    descriptor.decoderInput.receiptPayloadAccepted = true;
  },
});

expectRejected({
  label: 'ready boundary must fail closed',
  expectedReason: 'boundary_marked_ready',
  mutate: (descriptor) => {
    descriptor.ready = true;
  },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      harness: 'phase3.receiptDecodeMetadataBoundary.selftest.v1',
      canonicalBoundaryAccepted: canonicalResult.ok,
      allowedAndProhibitedCategoriesDisjoint: true,
      prohibitedReceiptMaterialRejected: true,
      runtimeInputConstructionRejected: true,
      decoderInvocationRejected: true,
      receiptMaterialAcceptanceRejected: true,
      boundaryMarkedReadyRejected: true,
      sideEffectFree: true,
    },
    null,
    2,
  ),
);
