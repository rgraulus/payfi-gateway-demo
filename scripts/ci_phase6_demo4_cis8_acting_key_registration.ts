/**
 * CI harness for Demo4 D4-1B — controlled CIS-8 acting-key registration.
 *
 * This harness exercises only the side-effect-free core. It does not read
 * environment variables, files, private keys, wallets, or network state. It
 * does not create signers, construct or submit transactions, make payments,
 * mutate CIS-8/CIS-8004, write evidence, activate Gateway runtime, release a
 * protected resource, settle, issue receipts, mutate replay state, or enable
 * production behavior.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEMO4_D4_1B_CANONICAL_DOMAIN,
  DEMO4_D4_1B_CORE_SAFETY,
  DEMO4_D4_1B_CORE_TYPE,
  DEMO4_D4_1B_CORE_VERSION,
  DEMO4_D4_1B_MODES,
  DEMO4_D4_1B_PROFILE,
  buildDemo4D41bCanonicalMessageV1,
  buildDemo4D41bOwnerOfKeyParameterV1,
  buildDemo4D41bRegistrationParameterV1,
  canonicalizeDemo4D41bEvidenceV1,
  hashDemo4D41bEvidenceV1,
  validateDemo4D41bActivationV1,
  validateDemo4D41bKeyBundleManifestV1,
  validateDemo4D41bOwnerOfKeyPostconditionV1,
  validateDemo4D41bPublicJwkV1,
  validateDemo4D41bRegistrationEventV1,
  validateDemo4D41bSanitizedEvidenceV1,
  validateDemo4D41bTrustAnchorsV1,
  type Demo4D41bFailureV1,
  type Demo4D41bResultV1,
} from "../src/phase6/demo4Cis8ActingKeyRegistration";

type TestBody = () => void;

type TestResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly error?: string;
};

const results: TestResult[] = [];

function test(name: string, body: TestBody): void {
  try {
    body();
    results.push({ name, ok: true });
  } catch (error: unknown) {
    results.push({
      name,
      ok: false,
      error:
        error instanceof Error
          ? error.stack ?? error.message
          : String(error),
    });
  }
}

function expectAccepted<T>(
  result: Demo4D41bResultV1<T>,
): T {
  if (!result.ok) {
    throw new Error(
      `expected accepted result, received ${result.reason}`,
    );
  }

  assert.equal(result.status, "accepted");
  assert.equal(result.reason, "accepted");
  return result.value;
}

function expectRejected(
  result: Demo4D41bResultV1<unknown>,
  reason: Demo4D41bFailureV1["reason"],
): void {
  assert.equal(
    result.ok,
    false,
    `expected rejection ${reason}, received ${JSON.stringify(result)}`,
  );

  if (result.ok) {
    throw new Error(
      `expected rejection ${reason}, received accepted result`,
    );
  }

  assert.equal(result.status, "rejected");
  assert.equal(result.reason, reason);
}

function rangeBytes(start: number): Uint8Array {
  return Uint8Array.from(
    { length: 32 },
    (_, index) => start + index,
  );
}

const OWNER_BYTES = rangeBytes(0);
const GENESIS_BYTES = rangeBytes(32);
const PUBLIC_KEY_BYTES = rangeBytes(64);
const OTHER_PUBLIC_KEY_BYTES = rangeBytes(96);
const SIGNATURE_BYTES = Uint8Array.from(
  { length: 64 },
  (_, index) => 128 + index,
);

const PUBLIC_KEY_BASE64URL =
  Buffer.from(PUBLIC_KEY_BYTES).toString("base64url");

const PUBLIC_KEY_HEX =
  Buffer.from(PUBLIC_KEY_BYTES).toString("hex");

const EXPECTED_CANONICAL_HEX =
  "4349532d382f76312f63616e6f6e6963616c" +
  "000102030405060708090a0b0c0d0e0f" +
  "101112131415161718191a1b1c1d1e1f" +
  "0132000000000000" +
  "0000000000000000" +
  "202122232425262728292a2b2c2d2e2f" +
  "303132333435363738393a3b3c3d3e3f" +
  "0a0000007863663a706861736535" +
  "0a0000007863663a706861736535" +
  "0700000065643235353139" +
  "20000000404142434445464748494a4b4c4d4e4f" +
  "505152535455565758595a5b5c5d5e5f" +
  "1000000066657463682d61692d65643235353139";

const EXPECTED_CANONICAL_SHA256 =
  "sha256:57526c175547e96071b867259dcb9707c8e84f3576b3cff11eaf200e59714c40";

const VALID_PUBLIC_JWK = Object.freeze({
  kty: "OKP",
  crv: "Ed25519",
  x: PUBLIC_KEY_BASE64URL,
  kid: DEMO4_D4_1B_PROFILE.agentKeyId,
});

const VALID_MANIFEST = Object.freeze({
  contract: DEMO4_D4_1B_PROFILE.keyBundleContract,
  mode: DEMO4_D4_1B_PROFILE.keyBundleMode,
  buyer: {
    buyerId: "buyer:unused-by-d4-1b-ci",
    buyerKeyId: "buyer-key:unused-by-d4-1b-ci",
    verificationKeyFile: "buyer.verification-key.json",
    privateKeyFile: "buyer.private-key.pem",
  },
  agent: {
    agentId: DEMO4_D4_1B_PROFILE.agentId,
    agentKeyId: DEMO4_D4_1B_PROFILE.agentKeyId,
    publicKeyJwk: VALID_PUBLIC_JWK,
    privateKeyFile: "agent.private-key.pem",
  },
  privateMaterialTemporary: true,
  privateMaterialPrinted: false,
  gatewayCalled: false,
  crpCalled: false,
  paymentAttempted: false,
  protectedResourceReleased: false,
  agentRegistryLookupAttempted: false,
  productionActivation: false,
});

const VALID_TRUST_ANCHORS = Object.freeze({
  network: DEMO4_D4_1B_PROFILE.network,
  contractIndex: DEMO4_D4_1B_PROFILE.contract.index,
  contractSubindex: DEMO4_D4_1B_PROFILE.contract.subindex,
  moduleReference: DEMO4_D4_1B_PROFILE.moduleReference,
  contractName: DEMO4_D4_1B_PROFILE.contractName,
  schemaVersion: DEMO4_D4_1B_PROFILE.schemaVersion,
  ownerAccount: DEMO4_D4_1B_PROFILE.ownerAccount,
  grpcHost: DEMO4_D4_1B_PROFILE.grpc.host,
  grpcPort: DEMO4_D4_1B_PROFILE.grpc.port,
  grpcTls: true,
  entrypoints: [
    DEMO4_D4_1B_PROFILE.registerEntrypoint,
    DEMO4_D4_1B_PROFILE.ownerOfKeyEntrypoint,
  ],
  eventSchemaPresent: true,
});

function canonicalInput(
  overrides: Partial<Parameters<
    typeof buildDemo4D41bCanonicalMessageV1
  >[0]> = {},
): Parameters<
  typeof buildDemo4D41bCanonicalMessageV1
>[0] {
  return {
    ownerAccountBytes: OWNER_BYTES,
    contractIndex: DEMO4_D4_1B_PROFILE.contract.index,
    contractSubindex: DEMO4_D4_1B_PROFILE.contract.subindex,
    genesisHashBytes: GENESIS_BYTES,
    externalNamespace: DEMO4_D4_1B_PROFILE.externalNamespace,
    externalKeyNamespace:
      DEMO4_D4_1B_PROFILE.externalKeyNamespace,
    externalKeyType: DEMO4_D4_1B_PROFILE.externalKeyType,
    publicKeyBytes: PUBLIC_KEY_BYTES,
    proofScheme: DEMO4_D4_1B_PROFILE.proofScheme,
    ...overrides,
  };
}

function eventInput(
  overrides: Partial<Parameters<
    typeof validateDemo4D41bRegistrationEventV1
  >[0]> = {},
): Parameters<
  typeof validateDemo4D41bRegistrationEventV1
>[0] {
  return {
    tag: DEMO4_D4_1B_PROFILE.eventTag,
    contract: {
      index: DEMO4_D4_1B_PROFILE.contract.index,
      subindex: DEMO4_D4_1B_PROFILE.contract.subindex,
    },
    decoded: {
      [DEMO4_D4_1B_PROFILE.eventName]: {
        owner: {
          Account: [DEMO4_D4_1B_PROFILE.ownerAccount],
        },
        external_key: {
          namespace:
            DEMO4_D4_1B_PROFILE.externalKeyNamespace,
          key_type:
            DEMO4_D4_1B_PROFILE.externalKeyType,
          public_key:
            Array.from(PUBLIC_KEY_BYTES),
        },
        proof_scheme:
          DEMO4_D4_1B_PROFILE.proofScheme,
        metadata: [],
      },
    },
    expectedPublicKey: PUBLIC_KEY_BYTES,
    ...overrides,
  };
}

test("exports frozen D4-1B identity and mode constants", () => {
  assert.equal(
    DEMO4_D4_1B_CORE_TYPE,
    "xcf.demo4.d4-1b.cis8-acting-key-registration-core",
  );
  assert.equal(DEMO4_D4_1B_CORE_VERSION, "1");
  assert.equal(
    DEMO4_D4_1B_CANONICAL_DOMAIN,
    "CIS-8/v1/canonical",
  );
  assert.deepEqual(
    DEMO4_D4_1B_MODES,
    ["inspect", "signed_preflight", "execute"],
  );
});

test("exports the frozen Testnet and CIS-8 profile", () => {
  assert.equal(
    DEMO4_D4_1B_PROFILE.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );
  assert.deepEqual(DEMO4_D4_1B_PROFILE.contract, {
    index: "12801",
    subindex: "0",
  });
  assert.equal(
    DEMO4_D4_1B_PROFILE.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );
  assert.equal(
    DEMO4_D4_1B_PROFILE.moduleReference,
    "5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da",
  );
  assert.equal(DEMO4_D4_1B_PROFILE.eventTag, 231);
  assert.equal(
    DEMO4_D4_1B_PROFILE.agentKeyId,
    "agent-key:xcf:demo4:registered:ed25519-1",
  );
});

test("declares a fully side-effect-free core", () => {
  assert.equal(DEMO4_D4_1B_CORE_SAFETY.sideEffectFree, true);

  for (
    const [name, value] of Object.entries(
      DEMO4_D4_1B_CORE_SAFETY,
    )
  ) {
    if (name === "sideEffectFree") {
      continue;
    }
    assert.equal(value, false, `${name} must remain false`);
  }
});

test("accepts inspect mode only with Testnet declaration", () => {
  const value = expectAccepted(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: "true",
    }),
  );

  assert.deepEqual(value, {
    mode: "inspect",
    testnetOnly: true,
    mayReadPrivateKey: false,
    mayReadWallet: false,
    mayCreateSigner: false,
    maySign: false,
    mayConstructTransaction: false,
    maySubmitTransaction: false,
  });
});

test("defaults missing mode to inspect", () => {
  const value = expectAccepted(
    validateDemo4D41bActivationV1({
      testnetOnly: "true",
    }),
  );
  assert.equal(value.mode, "inspect");
});

test("rejects invalid activation mode", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "live",
      testnetOnly: "true",
    }),
    "invalid_mode",
  );
});

test("rejects non-literal activation booleans", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: true,
    }),
    "invalid_boolean_literal",
  );
});

test("requires exact Testnet-only gate", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: "false",
    }),
    "testnet_only_gate_required",
  );
});

test("inspect mode forbids private-key access", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
    }),
    "private_key_gate_forbidden",
  );
});

test("inspect mode forbids wallet access", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: "true",
      walletReadEnabled: "true",
    }),
    "wallet_gate_forbidden",
  );
});

test("inspect mode forbids execution", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "inspect",
      testnetOnly: "true",
      executionEnabled: "true",
    }),
    "execution_gate_forbidden",
  );
});

test("signed preflight requires private-key gate", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "signed_preflight",
      testnetOnly: "true",
    }),
    "private_key_gate_required",
  );
});

test("signed preflight allows signing but no wallet or transaction", () => {
  const value = expectAccepted(
    validateDemo4D41bActivationV1({
      mode: "signed_preflight",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
    }),
  );

  assert.equal(value.mayReadPrivateKey, true);
  assert.equal(value.maySign, true);
  assert.equal(value.mayReadWallet, false);
  assert.equal(value.mayCreateSigner, false);
  assert.equal(value.mayConstructTransaction, false);
  assert.equal(value.maySubmitTransaction, false);
});

test("signed preflight forbids wallet and execution gates", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "signed_preflight",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
      walletReadEnabled: "true",
    }),
    "wallet_gate_forbidden",
  );

  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "signed_preflight",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
      executionEnabled: "true",
    }),
    "execution_gate_forbidden",
  );
});

test("execute mode requires wallet gate", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "execute",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
    }),
    "wallet_gate_required",
  );
});

test("execute mode requires execution gate", () => {
  expectRejected(
    validateDemo4D41bActivationV1({
      mode: "execute",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
      walletReadEnabled: "true",
    }),
    "execution_gate_required",
  );
});

test("execute mode enables the guarded transaction capabilities", () => {
  const value = expectAccepted(
    validateDemo4D41bActivationV1({
      mode: "execute",
      testnetOnly: "true",
      privateKeyReadEnabled: "true",
      walletReadEnabled: "true",
      executionEnabled: "true",
    }),
  );

  assert.equal(value.mayReadPrivateKey, true);
  assert.equal(value.mayReadWallet, true);
  assert.equal(value.mayCreateSigner, true);
  assert.equal(value.maySign, true);
  assert.equal(value.mayConstructTransaction, true);
  assert.equal(value.maySubmitTransaction, true);
});

test("accepts a fresh Ed25519 public JWK", () => {
  const value = expectAccepted(
    validateDemo4D41bPublicJwkV1(VALID_PUBLIC_JWK),
  );

  assert.equal(value.base64Url, PUBLIC_KEY_BASE64URL);
  assert.equal(value.hex, PUBLIC_KEY_HEX);
  assert.deepEqual(
    Array.from(value.bytes),
    Array.from(PUBLIC_KEY_BYTES),
  );
  assert.equal(
    value.fingerprint,
    `sha256:${createHash("sha256")
      .update(PUBLIC_KEY_BYTES)
      .digest("hex")}`,
  );
});

test("rejects private JWK material", () => {
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      d: "forbidden",
    }),
    "private_jwk_material_present",
  );
});

test("rejects wrong JWK type, curve, kid, and key length", () => {
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      kty: "EC",
    }),
    "invalid_public_jwk",
  );
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      crv: "X25519",
    }),
    "invalid_public_jwk",
  );
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      kid: "agent-key:wrong",
    }),
    "wrong_public_key_id",
  );
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      x: Buffer.alloc(31, 1).toString("base64url"),
    }),
    "malformed_ed25519_key",
  );
});

test("rejects the frozen static 0x07 fixture key", () => {
  expectRejected(
    validateDemo4D41bPublicJwkV1({
      ...VALID_PUBLIC_JWK,
      x: DEMO4_D4_1B_PROFILE.staticFixturePublicKeyBase64Url,
    }),
    "static_fixture_key_forbidden",
  );
});

test("accepts the exact Phase 5 key-bundle manifest shape", () => {
  const value = expectAccepted(
    validateDemo4D41bKeyBundleManifestV1(
      VALID_MANIFEST,
    ),
  );

  assert.equal(
    value.contract,
    DEMO4_D4_1B_PROFILE.keyBundleContract,
  );
  assert.equal(value.mode, DEMO4_D4_1B_PROFILE.keyBundleMode);
  assert.equal(value.agentId, DEMO4_D4_1B_PROFILE.agentId);
  assert.equal(value.agentKeyId, DEMO4_D4_1B_PROFILE.agentKeyId);
  assert.equal(value.privateKeyFile, "agent.private-key.pem");
  assert.equal(value.publicKey.hex, PUBLIC_KEY_HEX);
});

test("rejects altered key-bundle safety fields", () => {
  for (
    const field of [
      "privateMaterialTemporary",
      "privateMaterialPrinted",
      "gatewayCalled",
      "crpCalled",
      "paymentAttempted",
      "protectedResourceReleased",
      "agentRegistryLookupAttempted",
      "productionActivation",
    ] as const
  ) {
    const altered = {
      ...VALID_MANIFEST,
      [field]:
        field === "privateMaterialTemporary"
          ? false
          : field === "privateMaterialPrinted"
            ? true
            : true,
    };

    expectRejected(
      validateDemo4D41bKeyBundleManifestV1(altered),
      "invalid_manifest",
    );
  }
});

test("rejects wrong agent identity and key identity", () => {
  expectRejected(
    validateDemo4D41bKeyBundleManifestV1({
      ...VALID_MANIFEST,
      agent: {
        ...VALID_MANIFEST.agent,
        agentId: "agent:wrong",
      },
    }),
    "wrong_agent_id",
  );

  expectRejected(
    validateDemo4D41bKeyBundleManifestV1({
      ...VALID_MANIFEST,
      agent: {
        ...VALID_MANIFEST.agent,
        agentKeyId: "agent-key:wrong",
      },
    }),
    "wrong_agent_key_id",
  );
});

test("rejects invalid private-key file reference", () => {
  expectRejected(
    validateDemo4D41bKeyBundleManifestV1({
      ...VALID_MANIFEST,
      agent: {
        ...VALID_MANIFEST.agent,
        privateKeyFile: " agent.private-key.pem ",
      },
    }),
    "invalid_private_key_reference",
  );
});

test("accepts all frozen trust anchors", () => {
  const value = expectAccepted(
    validateDemo4D41bTrustAnchorsV1(
      VALID_TRUST_ANCHORS,
    ),
  );
  assert.equal(value.network, DEMO4_D4_1B_PROFILE.network);
  assert.equal(
    value.moduleReference,
    DEMO4_D4_1B_PROFILE.moduleReference,
  );
});

test("rejects wrong network and contract coordinates", () => {
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      network: "ccd:wrong",
    }),
    "invalid_network",
  );

  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      contractIndex: "12802",
    }),
    "wrong_contract",
  );

  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      contractSubindex: "1",
    }),
    "wrong_contract",
  );
});

test("rejects wrong module, contract name, schema, and owner", () => {
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      moduleReference: "0".repeat(64),
    }),
    "wrong_module",
  );
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      contractName: "Wrong",
    }),
    "wrong_contract_name",
  );
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      schemaVersion: 2,
    }),
    "wrong_schema_version",
  );
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      ownerAccount: "wrong-owner",
    }),
    "wrong_owner",
  );
});

test("rejects wrong gRPC endpoint or disabled TLS", () => {
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      grpcHost: "localhost",
    }),
    "wrong_grpc_endpoint",
  );
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      grpcTls: false,
    }),
    "tls_required",
  );
});

test("requires both entrypoints and event schema", () => {
  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      entrypoints: [
        DEMO4_D4_1B_PROFILE.ownerOfKeyEntrypoint,
      ],
    }),
    "missing_register_entrypoint",
  );

  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      entrypoints: [
        DEMO4_D4_1B_PROFILE.registerEntrypoint,
      ],
    }),
    "missing_ownerofkey_entrypoint",
  );

  expectRejected(
    validateDemo4D41bTrustAnchorsV1({
      ...VALID_TRUST_ANCHORS,
      eventSchemaPresent: false,
    }),
    "missing_event_schema",
  );
});

test("builds the independently fixed CIS-8 canonical vector", () => {
  const value = expectAccepted(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput(),
    ),
  );

  assert.equal(value.byteLength, 193);
  assert.equal(value.hex, EXPECTED_CANONICAL_HEX);
  assert.equal(value.sha256, EXPECTED_CANONICAL_SHA256);
  assert.equal(
    Buffer.from(value.bytes).toString("hex"),
    EXPECTED_CANONICAL_HEX,
  );
});

test("canonical vector uses deployed little-endian framing", () => {
  const value = expectAccepted(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput(),
    ),
  );

  const bytes = Buffer.from(value.bytes);
  const contractOffset =
    Buffer.byteLength(DEMO4_D4_1B_CANONICAL_DOMAIN, "ascii") +
    OWNER_BYTES.length;

  assert.equal(
    bytes.subarray(
      contractOffset,
      contractOffset + 8,
    ).toString("hex"),
    "0132000000000000",
  );
  assert.equal(
    bytes.subarray(
      contractOffset + 8,
      contractOffset + 16,
    ).toString("hex"),
    "0000000000000000",
  );

  const publicKeyLengthOffset =
    contractOffset +
    16 +
    GENESIS_BYTES.length +
    4 + Buffer.byteLength(
      DEMO4_D4_1B_PROFILE.externalNamespace,
      "utf8",
    ) +
    4 + Buffer.byteLength(
      DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      "utf8",
    ) +
    4 + Buffer.byteLength(
      DEMO4_D4_1B_PROFILE.externalKeyType,
      "utf8",
    );

  assert.equal(
    bytes.subarray(
      publicKeyLengthOffset,
      publicKeyLengthOffset + 4,
    ).toString("hex"),
    "20000000",
  );
});

test("canonical construction rejects invalid fixed inputs", () => {
  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        ownerAccountBytes: Uint8Array.from([1]),
      }),
    ),
    "invalid_account_bytes",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        contractIndex: "-1",
      }),
    ),
    "invalid_contract_coordinate",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        contractIndex: 1n << 64n,
      }),
    ),
    "invalid_contract_coordinate",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        genesisHashBytes: Uint8Array.from([1]),
      }),
    ),
    "invalid_genesis_hash",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        externalNamespace: "xcf:wrong",
      }),
    ),
    "invalid_external_namespace",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        externalKeyNamespace: "xcf:wrong",
      }),
    ),
    "invalid_external_key_namespace",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        externalKeyType: "rsa",
      }),
    ),
    "invalid_external_key_type",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        publicKeyBytes: Buffer.alloc(32, 7),
      }),
    ),
    "malformed_ed25519_key",
  );

  expectRejected(
    buildDemo4D41bCanonicalMessageV1(
      canonicalInput({
        proofScheme: "wrong",
      }),
    ),
    "invalid_proof_scheme",
  );
});

test("builds the deployed registration parameter shape", () => {
  const value = expectAccepted(
    buildDemo4D41bRegistrationParameterV1(
      PUBLIC_KEY_BYTES,
      SIGNATURE_BYTES,
    ),
  );

  assert.deepEqual(value, {
    external_key: {
      namespace:
        DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      key_type:
        DEMO4_D4_1B_PROFILE.externalKeyType,
      public_key:
        Array.from(PUBLIC_KEY_BYTES),
    },
    proof: {
      scheme: DEMO4_D4_1B_PROFILE.proofScheme,
      signature:
        Array.from(SIGNATURE_BYTES),
    },
    metadata: [],
  });
  assert.equal(Object.isFrozen(value.external_key.public_key), true);
  assert.equal(Object.isFrozen(value.proof.signature), true);
  assert.equal(Object.isFrozen(value.metadata), true);
});

test("registration parameter rejects key and signature defects", () => {
  expectRejected(
    buildDemo4D41bRegistrationParameterV1(
      Uint8Array.from([1]),
      SIGNATURE_BYTES,
    ),
    "malformed_ed25519_key",
  );

  expectRejected(
    buildDemo4D41bRegistrationParameterV1(
      PUBLIC_KEY_BYTES,
      Uint8Array.from([1]),
    ),
    "invalid_signature",
  );
});

test("builds the deployed ownerOfKey parameter shape", () => {
  const value = expectAccepted(
    buildDemo4D41bOwnerOfKeyParameterV1(
      PUBLIC_KEY_BYTES,
    ),
  );

  assert.deepEqual(value, {
    external_key: {
      namespace:
        DEMO4_D4_1B_PROFILE.externalKeyNamespace,
      key_type:
        DEMO4_D4_1B_PROFILE.externalKeyType,
      public_key:
        Array.from(PUBLIC_KEY_BYTES),
    },
  });
  assert.equal(Object.isFrozen(value.external_key.public_key), true);
});

test("validates a matching deployed registration event", () => {
  const value = expectAccepted(
    validateDemo4D41bRegistrationEventV1(
      eventInput(),
    ),
  );

  assert.deepEqual(value, {
    owner: DEMO4_D4_1B_PROFILE.ownerAccount,
    publicKeyBase64Url: PUBLIC_KEY_BASE64URL,
    publicKeyHex: PUBLIC_KEY_HEX,
    proofScheme: DEMO4_D4_1B_PROFILE.proofScheme,
    metadata: [],
  });
});

test("accepts the deployed singleton-array event variant", () => {
  const base = eventInput();
  const decoded =
    base.decoded as Record<string, unknown>;

  const named =
    decoded[DEMO4_D4_1B_PROFILE.eventName];

  assert.notEqual(named, undefined);

  const value = expectAccepted(
    validateDemo4D41bRegistrationEventV1({
      ...base,
      decoded: {
        [DEMO4_D4_1B_PROFILE.eventName]:
          [named],
      },
    }),
  );

  assert.deepEqual(value, {
    owner: DEMO4_D4_1B_PROFILE.ownerAccount,
    publicKeyBase64Url: PUBLIC_KEY_BASE64URL,
    publicKeyHex: PUBLIC_KEY_HEX,
    proofScheme: DEMO4_D4_1B_PROFILE.proofScheme,
    metadata: [],
  });
});

test("rejects ambiguous or malformed event-variant arrays", () => {
  const base = eventInput();
  const decoded =
    base.decoded as Record<string, unknown>;

  const named =
    decoded[DEMO4_D4_1B_PROFILE.eventName];

  assert.notEqual(named, undefined);

  for (const malformed of [
    [],
    [named, named],
    [null],
  ]) {
    expectRejected(
      validateDemo4D41bRegistrationEventV1({
        ...base,
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]:
            malformed,
        },
      }),
      "wrong_event_variant",
    );
  }
});

test("accepts deployed bigint public-key bytes", () => {
  const base = eventInput();
  const decoded =
    base.decoded as Record<string, unknown>;

  const named =
    decoded[
      DEMO4_D4_1B_PROFILE.eventName
    ] as Record<string, unknown>;

  assert.notEqual(named, undefined);

  const externalKey =
    named.external_key as Record<
      string,
      unknown
    >;

  assert.notEqual(externalKey, undefined);

  const bigintBytes =
    Array.from(
      Buffer.from(PUBLIC_KEY_HEX, "hex"),
      (byte) => BigInt(byte),
    );

  const value = expectAccepted(
    validateDemo4D41bRegistrationEventV1({
      ...base,
      decoded: {
        [DEMO4_D4_1B_PROFILE.eventName]: [
          {
            ...named,
            external_key: {
              ...externalKey,
              public_key: bigintBytes,
            },
          },
        ],
      },
    }),
  );

  assert.deepEqual(value, {
    owner:
      DEMO4_D4_1B_PROFILE.ownerAccount,
    publicKeyBase64Url:
      PUBLIC_KEY_BASE64URL,
    publicKeyHex:
      PUBLIC_KEY_HEX,
    proofScheme:
      DEMO4_D4_1B_PROFILE.proofScheme,
    metadata: [],
  });
});

test("rejects malformed deployed bigint public-key bytes", () => {
  const base = eventInput();
  const decoded =
    base.decoded as Record<string, unknown>;

  const named =
    decoded[
      DEMO4_D4_1B_PROFILE.eventName
    ] as Record<string, unknown>;

  assert.notEqual(named, undefined);

  const externalKey =
    named.external_key as Record<
      string,
      unknown
    >;

  assert.notEqual(externalKey, undefined);

  const valid =
    Array.from(
      Buffer.from(PUBLIC_KEY_HEX, "hex"),
      (byte) => BigInt(byte),
    );

  for (const malformed of [
    -1n,
    256n,
    "1",
    1,
    null,
  ]) {
    const bytes: unknown[] = [...valid];
    bytes[0] = malformed;

    expectRejected(
      validateDemo4D41bRegistrationEventV1({
        ...base,
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]: [
            {
              ...named,
              external_key: {
                ...externalKey,
                public_key: bytes,
              },
            },
          ],
        },
      }),
      "invalid_event_shape",
    );
  }
});

test("registration event requires correct tag and contract", () => {
  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({ tag: 230 }),
    ),
    "wrong_event_tag",
  );

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        contract: {
          index: "12802",
          subindex: "0",
        },
      }),
    ),
    "wrong_event_contract",
  );
});

test("registration event rejects missing or malformed payload", () => {
  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({ decoded: null }),
    ),
    "wrong_event_variant",
  );

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]: {
            owner: DEMO4_D4_1B_PROFILE.ownerAccount,
          },
        },
      }),
    ),
    "invalid_event_shape",
  );
});

test("registration event validates every frozen field", () => {
  const validPayload = (
    eventInput().decoded as Record<string, unknown>
  )[DEMO4_D4_1B_PROFILE.eventName] as Record<
    string,
    unknown
  >;

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]: {
            ...validPayload,
            owner: "wrong-owner",
          },
        },
      }),
    ),
    "wrong_event_owner",
  );

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        expectedPublicKey: OTHER_PUBLIC_KEY_BYTES,
      }),
    ),
    "wrong_event_external_key",
  );

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]: {
            ...validPayload,
            proof_scheme: "wrong",
          },
        },
      }),
    ),
    "wrong_event_proof_scheme",
  );

  expectRejected(
    validateDemo4D41bRegistrationEventV1(
      eventInput({
        decoded: {
          [DEMO4_D4_1B_PROFILE.eventName]: {
            ...validPayload,
            metadata: [{ key: "unexpected", value: "1" }],
          },
        },
      }),
    ),
    "wrong_event_metadata",
  );
});

test("accepts finalized ownerOfKey result variants", () => {
  for (
    const decoded of [
      DEMO4_D4_1B_PROFILE.ownerAccount,
      {
        Some: [
          {
            Account: [
              DEMO4_D4_1B_PROFILE.ownerAccount,
            ],
          },
        ],
      },
      {
        registration: {
          owner:
            DEMO4_D4_1B_PROFILE.ownerAccount,
        },
      },
      {
        found: true,
        owner:
          DEMO4_D4_1B_PROFILE.ownerAccount,
      },
    ]
  ) {
    const value = expectAccepted(
      validateDemo4D41bOwnerOfKeyPostconditionV1(
        decoded,
      ),
    );
    assert.equal(
      value.owner,
      DEMO4_D4_1B_PROFILE.ownerAccount,
    );
  }
});

test("ownerOfKey rejects absent, malformed, and wrong owner", () => {
  for (
    const decoded of [
      null,
      { found: false },
      { status: "not_found" },
      { None: [] },
    ]
  ) {
    expectRejected(
      validateDemo4D41bOwnerOfKeyPostconditionV1(
        decoded,
      ),
      "ownerofkey_not_registered",
    );
  }

  expectRejected(
    validateDemo4D41bOwnerOfKeyPostconditionV1({
      Some: [{ unexpected: true }],
    }),
    "invalid_ownerofkey_shape",
  );

  expectRejected(
    validateDemo4D41bOwnerOfKeyPostconditionV1({
      owner: "wrong-owner",
    }),
    "wrong_ownerofkey_owner",
  );
});

test("canonicalizes evidence deterministically", () => {
  const value = {
    z: 3,
    a: {
      y: undefined,
      c: null,
      b: 2,
    },
    list: [1, undefined, 3],
    bytes: Uint8Array.from([2, 1]),
  };

  const canonical =
    canonicalizeDemo4D41bEvidenceV1(value);

  assert.equal(
    canonical,
    '{"a":{"b":2,"c":null},"bytes":[2,1],"list":[1,null,3],"z":3}',
  );

  assert.equal(
    hashDemo4D41bEvidenceV1(value),
    `sha256:${createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex")}`,
  );
});

test("accepts sanitized evidence and returns its hash", () => {
  const evidence = {
    schemaVersion: 1,
    network: DEMO4_D4_1B_PROFILE.network,
    transactionHash: "abc123",
    event: {
      tag: DEMO4_D4_1B_PROFILE.eventTag,
      owner: DEMO4_D4_1B_PROFILE.ownerAccount,
      publicKeyFingerprint:
        `sha256:${"1".repeat(64)}`,
    },
    ownerOfKey: {
      owner: DEMO4_D4_1B_PROFILE.ownerAccount,
    },
  };

  const value = expectAccepted(
    validateDemo4D41bSanitizedEvidenceV1(
      evidence,
    ),
  );

  assert.equal(
    value.canonicalJson,
    canonicalizeDemo4D41bEvidenceV1(evidence),
  );
  assert.equal(
    value.evidenceHash,
    hashDemo4D41bEvidenceV1(evidence),
  );
});

test("rejects non-object evidence", () => {
  expectRejected(
    validateDemo4D41bSanitizedEvidenceV1(
      "not-an-object",
    ),
    "invalid_evidence",
  );
});

test("rejects forbidden evidence key names", () => {
  for (
    const evidence of [
      { privateKey: "redacted" },
      { private_key_path: "redacted" },
      { rawSignature: "redacted" },
      { walletExport: "redacted" },
      { process_env: {} },
      { rawRegistrationParameter: {} },
    ]
  ) {
    expectRejected(
      validateDemo4D41bSanitizedEvidenceV1(
        evidence,
      ),
      "forbidden_evidence_material",
    );
  }
});

test("rejects secret-bearing evidence strings", () => {
  for (
    const evidence of [
      {
        note:
          "-----BEGIN PRIVATE KEY-----",
      },
      {
        note:
          "temporary agent.private-key.pem",
      },
      {
        note:
          "wallet-export.json",
      },
      {
        note:
          "seed phrase must never appear",
      },
    ]
  ) {
    expectRejected(
      validateDemo4D41bSanitizedEvidenceV1(
        evidence,
      ),
      "forbidden_evidence_material",
    );
  }
});

test("rejects cyclic and non-JSON evidence", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  expectRejected(
    validateDemo4D41bSanitizedEvidenceV1(
      cyclic,
    ),
    "evidence_serialization_failed",
  );

  expectRejected(
    validateDemo4D41bSanitizedEvidenceV1({
      amount: 1n,
    }),
    "evidence_serialization_failed",
  );
});

const failed =
  results.filter((result) => !result.ok);

const summary = {
  ok: failed.length === 0,
  harness:
    "ci.phase6.demo4D41bCis8ActingKeyRegistration.v1",
  coreType: DEMO4_D4_1B_CORE_TYPE,
  coreVersion: DEMO4_D4_1B_CORE_VERSION,
  profile: {
    network: DEMO4_D4_1B_PROFILE.network,
    contract: DEMO4_D4_1B_PROFILE.contract,
    moduleReference:
      DEMO4_D4_1B_PROFILE.moduleReference,
    ownerAccount:
      DEMO4_D4_1B_PROFILE.ownerAccount,
    agentKeyId:
      DEMO4_D4_1B_PROFILE.agentKeyId,
    proofScheme:
      DEMO4_D4_1B_PROFILE.proofScheme,
  },
  tests: {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
  },
  safety: {
    sideEffectFree: true,
    environmentRead: false,
    filesystemRead: false,
    filesystemWrite: false,
    networkCalled: false,
    privateKeyRead: false,
    walletRead: false,
    signingAttempted: false,
    signerCreated: false,
    transactionConstructed: false,
    transactionSubmitted: false,
    paymentAttempted: false,
    cis8004Mutated: false,
    externalReferenceUpdated: false,
    databaseMutated: false,
    gatewayRuntimeActivated: false,
    protectedResourceReleased: false,
    settlementAttempted: false,
    receiptIssued: false,
    replayStateMutated: false,
    authorizationDecided: false,
    productionActivation: false,
  },
  failures: failed.map((result) => ({
    name: result.name,
    error: result.error,
  })),
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
