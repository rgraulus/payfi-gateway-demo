/**
 * PR #312 Gate 1 — permanent, side-effect-free validation for the
 * proposal-conformant Demo4 CIS-8 replacement profile.
 *
 * This harness performs deterministic in-memory validation plus a static scan
 * of the new pure core. It does not read private keys or wallets, generate
 * keys, sign, call a network or contract, construct or submit a transaction,
 * mutate CIS-8/CIS-8004, or write evidence.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR,
  buildDemo4D41bReplacementCanonicalMessageV1,
  buildDemo4D41bReplacementExpectedParameterContractV1,
  validateDemo4D41bReplacementProfileV1,
  validateDemo4D41bReplacementSourcePinsV1,
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bytesFromHex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "hex"));
}

function replaceLiteral(
  value: unknown,
  expected: string | number | boolean,
  replacement: string | number | boolean,
): unknown {
  if (value === expected) return replacement;

  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceLiteral(item, expected, replacement),
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, item]) => [
          key,
          replaceLiteral(item, expected, replacement),
        ],
      ),
    );
  }

  return value;
}

function expectFrozenTree(
  value: unknown,
  path = "root",
): void {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return;
  }

  assert.equal(
    Object.isFrozen(value),
    true,
    `${path} must be frozen`,
  );

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      expectFrozenTree(item, `${path}[${index}]`),
    );
    return;
  }

  for (const [key, item] of Object.entries(
    value as Record<string, unknown>,
  )) {
    expectFrozenTree(item, `${path}.${key}`);
  }
}

const vector =
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR;

const canonicalInput = () => ({
  concordiumAccountBytes:
    bytesFromHex(vector.ownerAccountBytesHex),
  concordiumGenesisHashBytes:
    bytesFromHex(
      vector.concordiumGenesisHashBytesHex,
    ),
  publicKeyBytes:
    bytesFromHex(vector.publicKeyBytesHex),
});

const parameterInput = () => ({
  publicKeyBytes:
    bytesFromHex(vector.publicKeyBytesHex),
  signatureBytes:
    bytesFromHex(vector.signatureBytesHex),
});

test("freezes source pins and replacement profile recursively", () => {
  expectFrozenTree(
    DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
    "sourcePins",
  );
  expectFrozenTree(
    DEMO4_D4_1B_REPLACEMENT_PROFILE,
    "profile",
  );
  expectFrozenTree(vector, "testVector");
  acceptedCases += 3;
});

test("accepts the exact frozen source pins", () => {
  accepted(
    validateDemo4D41bReplacementSourcePinsV1(
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
    ),
  );
});

test("rejects source-pin literal drift", () => {
  const cases: Array<
    readonly [string | number | boolean, string | number | boolean]
  > = [
    [
      "https://proposals.concordium.com/CIS/cis-8.html",
      "https://example.invalid/cis-8",
    ],
    [
      "6216474e04464b33de77dd79df8d90d9fe231635aacd4ecf89507e1d2c74546b",
      "0".repeat(64),
    ],
    [
      "https://namespaces.chainagnostic.org/solana/caip2",
      "https://example.invalid/solana",
    ],
    [
      "5598020d520135b0b1d84ad89833785eb7f425b40620941e02d29b69165a12ad",
      "f".repeat(64),
    ],
    [
      "https://api.devnet.solana.com",
      "https://api.mainnet-beta.solana.com",
    ],
    [
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69xxxxxxxxxxxx",
    ],
  ];

  for (const [expected, replacement] of cases) {
    const mutated = replaceLiteral(
      clone(DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS),
      expected,
      replacement,
    );
    rejected(
      validateDemo4D41bReplacementSourcePinsV1(
        mutated,
      ),
    );
  }
});

test("accepts the exact frozen replacement profile", () => {
  accepted(
    validateDemo4D41bReplacementProfileV1(
      DEMO4_D4_1B_REPLACEMENT_PROFILE,
    ),
  );
});

test("rejects historical and nonconformant profile values", () => {
  const cases: Array<
    readonly [string | number | boolean, string | number | boolean]
  > = [
    [
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "xcf:phase5",
    ],
    ["solana-ed25519", "fetch-ai-ed25519"],
    ["ed25519", "secp256k1"],
    ["12801", "12802"],
    [
      "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
      "wrong-owner",
    ],
    ["CIS-8/v1/canonical", "CIS-8/v2/canonical"],
  ];

  for (const [expected, replacement] of cases) {
    const mutated = replaceLiteral(
      clone(DEMO4_D4_1B_REPLACEMENT_PROFILE),
      expected,
      replacement,
    );
    rejected(
      validateDemo4D41bReplacementProfileV1(
        mutated,
      ),
    );
  }
});

test("builds the exact deterministic canonical vector", () => {
  const first = accepted(
    buildDemo4D41bReplacementCanonicalMessageV1(
      canonicalInput(),
    ),
  );

  const second = accepted(
    buildDemo4D41bReplacementCanonicalMessageV1(
      canonicalInput(),
    ),
  );

  if (!first.ok || !second.ok) {
    throw new Error("canonical_vector_rejected");
  }

  assert.equal(
    first.value.byteLength,
    vector.canonicalMessageByteLength,
  );
  assert.equal(
    first.value.sha256,
    vector.canonicalMessageSha256,
  );
  assert.equal(
    first.value.hex,
    second.value.hex,
  );
  assert.deepEqual(
    Array.from(first.value.bytes),
    Array.from(second.value.bytes),
  );
});

test("rejects malformed canonical-message inputs", () => {
  const owner31 = canonicalInput();
  owner31.concordiumAccountBytes =
    owner31.concordiumAccountBytes.slice(0, 31);
  rejected(
    buildDemo4D41bReplacementCanonicalMessageV1(
      owner31,
    ),
  );

  const genesis31 = canonicalInput();
  genesis31.concordiumGenesisHashBytes =
    genesis31.concordiumGenesisHashBytes.slice(
      0,
      31,
    );
  rejected(
    buildDemo4D41bReplacementCanonicalMessageV1(
      genesis31,
    ),
  );

  const key31 = canonicalInput();
  key31.publicKeyBytes =
    key31.publicKeyBytes.slice(0, 31);
  rejected(
    buildDemo4D41bReplacementCanonicalMessageV1(
      key31,
    ),
  );

  const key33 = canonicalInput();
  key33.publicKeyBytes =
    Uint8Array.from([
      ...key33.publicKeyBytes,
      32,
    ]);
  rejected(
    buildDemo4D41bReplacementCanonicalMessageV1(
      key33,
    ),
  );
});

test("builds the exact deterministic parameter vector", () => {
  const first = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterInput(),
    ),
  );

  const second = accepted(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      parameterInput(),
    ),
  );

  if (!first.ok || !second.ok) {
    throw new Error("parameter_vector_rejected");
  }

  assert.equal(
    first.value.byteLength,
    vector.registrationParameterByteLength,
  );
  assert.equal(
    first.value.sha256,
    vector.registrationParameterSha256,
  );
  assert.equal(
    first.value.serializedHex,
    second.value.serializedHex,
  );
  assert.deepEqual(
    Array.from(first.value.serializedBytes),
    Array.from(second.value.serializedBytes),
  );

  const parameterHex = first.value.serializedHex;
  assert.match(
    parameterHex,
    new RegExp(
      Buffer.from(
        "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        "utf8",
      ).toString("hex"),
    ),
  );
  assert.match(
    parameterHex,
    new RegExp(
      Buffer.from(
        "solana-ed25519",
        "utf8",
      ).toString("hex"),
    ),
  );
  assert.doesNotMatch(
    parameterHex,
    new RegExp(
      Buffer.from(
        "xcf:phase5",
        "utf8",
      ).toString("hex"),
    ),
  );
  assert.doesNotMatch(
    parameterHex,
    new RegExp(
      Buffer.from(
        "fetch-ai-ed25519",
        "utf8",
      ).toString("hex"),
    ),
  );
});

test("rejects malformed parameter key and signature lengths", () => {
  const key31 = parameterInput();
  key31.publicKeyBytes =
    key31.publicKeyBytes.slice(0, 31);
  rejected(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      key31,
    ),
  );

  const signature63 = parameterInput();
  signature63.signatureBytes =
    signature63.signatureBytes.slice(0, 63);
  rejected(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      signature63,
    ),
  );

  const signature65 = parameterInput();
  signature65.signatureBytes =
    Uint8Array.from([
      ...signature65.signatureBytes,
      96,
    ]);
  rejected(
    buildDemo4D41bReplacementExpectedParameterContractV1(
      signature65,
    ),
  );
});

test("keeps the Gate 1 core statically side-effect-free", () => {
  const corePath = resolve(
    __dirname,
    "../src/phase6/demo4Cis8ConformantReplacementProfile.ts",
  );
  const source = readFileSync(corePath, "utf8");

  const forbidden: readonly RegExp[] = [
    /process\.env/,
    /node:fs/,
    /node:child_process/,
    /\bfetch\s*\(/,
    /\bcurl\b/,
    /from\s+["']@concordium\//,
    /require\(["']@concordium\//,
    /readFile(?:Sync)?\s*\(/,
    /writeFile(?:Sync)?\s*\(/,
    /appendFile(?:Sync)?\s*\(/,
    /createPrivateKey\s*\(/,
    /generateKeyPair(?:Sync)?\s*\(/,
    /createSigner\s*\(/,
    /submitTransaction\s*\(/,
    /sendTransaction\s*\(/,
    /invokeContract\s*\(/,
    /rmSync\s*\(/,
    /unlinkSync\s*\(/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }

  assert.match(
    source,
    /encodeU32Length|writeUInt32LE/,
  );
  assert.doesNotMatch(
    source,
    /encodeU16|writeUInt16LE/,
  );
  assert.match(
    source,
    /CIS-8\/v1\/canonical/,
  );
  assert.match(
    source,
    /solana-ed25519/,
  );
  assert.doesNotMatch(
    source,
    /fetch-ai-ed25519/,
  );
  assert.doesNotMatch(
    source,
    /xcf:phase5/,
  );

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
  type: "xcf.demo4.d4-1b.cis8-conformant-replacement-profile-ci",
  version: "1",
  tests: tests.length,
  passed,
  failed: tests.length - passed,
  acceptedCases,
  rejectionCases,
  sourcePinsFrozen: true,
  solanaDevnetProfileFrozen: true,
  fourByteLengthCodecFrozen: true,
  canonicalVectorVerified: true,
  parameterVectorVerified: true,
  historicalProfileRejected: true,
  sideEffectFree: true,
  privateKeyRead: false,
  walletRead: false,
  keyGenerated: false,
  signingAttempted: false,
  contractInvoked: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  cis8004Token287Mutated: false,
}, null, 2));
