/**
 * PR #312 Gate 2 — offline contract tests and side-effect-free dry run
 * for the proposal-conformant Demo 4 D4-1B CIS-8 replacement profile.
 *
 * This harness uses deterministic synthetic bytes only. It does not read
 * private keys or wallets, generate keys, sign, call a network or contract,
 * construct or submit a transaction, mutate CIS-8 or CIS-8004, perform
 * D4-1C attachment, or activate any Gateway runtime path.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEMO4_D4_1B_REPLACEMENT_CORE_SAFETY,
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR,
  buildDemo4D41bReplacementCanonicalMessageV1,
  buildDemo4D41bReplacementExpectedParameterContractV1,
  buildDemo4D41bReplacementOwnerOfKeyParameterV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

type Result = {
  readonly ok: boolean;
  readonly reason?: string;
};

type TestBody = () => void;

const tests: Array<{
  readonly name: string;
  readonly body: TestBody;
}> = [];

let acceptedCases = 0;
let rejectionCases = 0;

function test(name: string, body: TestBody): void {
  tests.push({ name, body });
}

function accepted<T extends Result>(result: T): T {
  assert.equal(
    result.ok,
    true,
    `expected acceptance, received ${JSON.stringify(result)}`,
  );
  acceptedCases += 1;
  return result;
}

function rejected<T extends Result>(result: T): T {
  assert.equal(
    result.ok,
    false,
    `expected rejection, received ${JSON.stringify(result)}`,
  );
  rejectionCases += 1;
  return result;
}

function bytesFromHex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "hex"));
}

const vector =
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR;

const publicKeyBytes =
  bytesFromHex(vector.publicKeyBytesHex);

const signatureBytes =
  bytesFromHex(vector.signatureBytesHex);

const canonicalInput = () => ({
  concordiumAccountBytes:
    bytesFromHex(vector.ownerAccountBytesHex),
  concordiumGenesisHashBytes:
    bytesFromHex(
      vector.concordiumGenesisHashBytesHex,
    ),
  publicKeyBytes:
    Uint8Array.from(publicKeyBytes),
});

const parameterInput = () => ({
  publicKeyBytes:
    Uint8Array.from(publicKeyBytes),
  signatureBytes:
    Uint8Array.from(signatureBytes),
});

test("builds the frozen offline contract end to end", () => {
  const canonical = accepted(
    buildDemo4D41bReplacementCanonicalMessageV1(
      canonicalInput(),
    ),
  );
  const registration = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterInput(),
    ),
  );
  const ownerLookup = accepted(
    buildDemo4D41bReplacementOwnerOfKeyParameterV1(
      publicKeyBytes,
    ),
  );

  assert.equal(
    canonical.value.byteLength,
    vector.canonicalMessageByteLength,
  );
  assert.equal(
    canonical.value.sha256,
    vector.canonicalMessageSha256,
  );
  assert.equal(
    registration.value.byteLength,
    vector.registrationParameterByteLength,
  );
  assert.equal(
    registration.value.sha256,
    vector.registrationParameterSha256,
  );
  assert.deepEqual(
    ownerLookup.value.external_key,
    registration.value.parameter.external_key,
  );
});

test("preserves the exact registration parameter semantics", () => {
  const registration = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterInput(),
    ),
  );

  const parameter = registration.value.parameter;

  assert.equal(
    parameter.external_key.namespace,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace,
  );
  assert.equal(
    parameter.external_key.key_type,
    "ed25519",
  );
  assert.deepEqual(
    parameter.external_key.public_key,
    Array.from(publicKeyBytes),
  );
  assert.equal(
    parameter.proof.scheme,
    "solana-ed25519",
  );
  assert.deepEqual(
    parameter.proof.signature,
    Array.from(signatureBytes),
  );
  assert.deepEqual(parameter.metadata, []);
});

test("keeps deterministic outputs isolated from input mutation", () => {
  const canonicalMutable = canonicalInput();
  const canonicalFirst = accepted(
    buildDemo4D41bReplacementCanonicalMessageV1(
      canonicalMutable,
    ),
  );

  canonicalMutable.publicKeyBytes[0] = 255;

  const canonicalSecond = accepted(
    buildDemo4D41bReplacementCanonicalMessageV1(
      canonicalInput(),
    ),
  );

  assert.equal(
    canonicalFirst.value.hex,
    canonicalSecond.value.hex,
  );
  assert.deepEqual(
    Array.from(canonicalFirst.value.bytes),
    Array.from(canonicalSecond.value.bytes),
  );

  const parameterMutable = parameterInput();
  const parameterFirst = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterMutable,
    ),
  );

  parameterMutable.publicKeyBytes[0] = 255;
  parameterMutable.signatureBytes[0] = 255;

  const parameterSecond = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterInput(),
    ),
  );

  assert.equal(
    parameterFirst.value.serializedHex,
    parameterSecond.value.serializedHex,
  );
  assert.deepEqual(
    parameterFirst.value.parameter.external_key.public_key,
    Array.from(publicKeyBytes),
  );
  assert.deepEqual(
    parameterFirst.value.parameter.proof.signature,
    Array.from(signatureBytes),
  );
});

test("rejects malformed ownerOfKey lookup parameters", () => {
  for (const length of [0, 31, 33]) {
    rejected(
      buildDemo4D41bReplacementOwnerOfKeyParameterV1(
        new Uint8Array(length),
      ),
    );
  }

  const valid = accepted(
    buildDemo4D41bReplacementOwnerOfKeyParameterV1(
      publicKeyBytes,
    ),
  );

  assert.equal(
    valid.value.external_key.namespace,
    DEMO4_D4_1B_REPLACEMENT_PROFILE.externalKeyNamespace,
  );
});

test("keeps the Gate 2 dry run statically side-effect-free", () => {
  assert.equal(
    DEMO4_D4_1B_REPLACEMENT_CORE_SAFETY.sideEffectFree,
    true,
  );

  for (const [name, value] of Object.entries(
    DEMO4_D4_1B_REPLACEMENT_CORE_SAFETY,
  )) {
    if (name === "sideEffectFree") continue;
    assert.equal(value, false, `${name} must remain false`);
  }

  const coreSource = readFileSync(
    resolve(
      __dirname,
      "../src/phase6/demo4Cis8ConformantReplacementProfile.ts",
    ),
    "utf8",
  );

  const forbiddenCorePatterns: readonly RegExp[] = [
    /process\.env/,
    /node:child_process/,
    /\bfetch\s*\(/,
    /from\s+["']@concordium\//,
    /require\(["']@concordium\//,
    /createPrivateKey\s*\(/,
    /generateKeyPair(?:Sync)?\s*\(/,
    /createSigner\s*\(/,
    /invokeContract\s*\(/,
    /submitTransaction\s*\(/,
    /sendTransaction\s*\(/,
  ];

  for (const pattern of forbiddenCorePatterns) {
    assert.doesNotMatch(coreSource, pattern);
  }

  const harnessSource = readFileSync(
    resolve(__filename),
    "utf8",
  );

  const importModules = Array.from(
    harnessSource.matchAll(
      /from\s+["']([^"']+)["']/g,
    ),
    (match) => match[1],
  );

  assert.deepEqual(importModules, [
    "node:assert/strict",
    "node:fs",
    "node:path",
    "../src/phase6/demo4Cis8ConformantReplacementProfile",
  ]);

  acceptedCases += 1;
});

let passed = 0;

for (const item of tests) {
  try {
    item.body();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`);
    throw error;
  }
}

console.log(JSON.stringify({
  type:
    "xcf.demo4.d4-1b.cis8-conformant-replacement-offline-contract-ci",
  version: "1",
  gate: 2,
  tests: tests.length,
  passed,
  failed: tests.length - passed,
  acceptedCases,
  rejectionCases,
  canonicalMessageVerified: true,
  registrationParameterVerified: true,
  ownerOfKeyParameterVerified: true,
  deterministicRepeatabilityVerified: true,
  inputIsolationVerified: true,
  malformedLookupRejected: true,
  sideEffectFreeDryRun: true,
  privateKeyRead: false,
  walletRead: false,
  keyGenerated: false,
  signingAttempted: false,
  contractInvoked: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  cis8Mutated: false,
  cis8004Token287Mutated: false,
  d4_1cAttachmentPerformed: false,
  gatewayRuntimeCalled: false,
  paymentAttempted: false,
  productionActivation: false,
}, null, 2));
