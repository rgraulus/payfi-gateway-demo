/**
 * PR #312 Gate 3 — deterministic public-preflight validation for the
 * proposal-conformant Demo 4 D4-1B CIS-8 replacement registration.
 *
 * This harness uses deterministic synthetic bytes plus a static source scan.
 * It does not read private keys or wallets, generate keys, sign, call a network
 * or contract, construct or submit a transaction, mutate CIS-8 or CIS-8004,
 * perform D4-1C attachment, revoke historical registration, or activate Gateway.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS,
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR,
  buildDemo4D41bReplacementCanonicalMessageV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE,
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION,
  type Demo4D41bReplacementPublicPreflightEvidenceV1,
  validateDemo4D41bReplacementPublicPreflightV1,
  validateDemo4D41bReplacementPrivatePreflightV1,
  authorizeDemo4D41bReplacementSingleSubmissionV1,
} from "../src/phase6/demo4Cis8ConformantReplacementPreflight";

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

function test(
  name: string,
  body: TestBody,
): void {
  tests.push({ name, body });
}

function accepted<T extends Result>(
  result: T,
): T {
  assert.equal(
    result.ok,
    true,
    `expected acceptance, received ${JSON.stringify(result)}`,
  );
  acceptedCases += 1;
  return result;
}

function rejected<T extends Result>(
  result: T,
  reason: string,
): T {
  assert.equal(
    result.ok,
    false,
    `expected rejection, received ${JSON.stringify(result)}`,
  );
  assert.equal(result.reason, reason);
  rejectionCases += 1;
  return result;
}

function clone<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function bytesFromHex(
  value: string,
): Uint8Array {
  return Uint8Array.from(
    Buffer.from(value, "hex"),
  );
}

const vector =
  DEMO4_D4_1B_REPLACEMENT_TEST_VECTOR;

const canonical =
  buildDemo4D41bReplacementCanonicalMessageV1({
    concordiumAccountBytes:
      bytesFromHex(vector.ownerAccountBytesHex),

    concordiumGenesisHashBytes:
      bytesFromHex(
        vector.concordiumGenesisHashBytesHex,
      ),

    publicKeyBytes:
      bytesFromHex(vector.publicKeyBytesHex),
  });

assert.equal(
  canonical.ok,
  true,
  "frozen canonical vector must build",
);

if (canonical.ok !== true) {
  throw new Error(
    "frozen_canonical_vector_rejected",
  );
}

const deployed =
  DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_PROFILE
    .deployedContract;

const validEvidence:
  Demo4D41bReplacementPublicPreflightEvidenceV1 = {
    type:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_VERSION,

    normativeHtmlSha256:
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS
        .normativeHtmlSha256,

    solanaCaipHtmlSha256:
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS
        .solanaCaipHtmlSha256,

    solanaDevnetGenesisHash:
      DEMO4_D4_1B_REPLACEMENT_SOURCE_PINS
        .solanaDevnetGenesisHash,

    finalized: true,
    finalizedBlockHeight: "1",

    network:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .concordiumNetwork,

    contractIndex:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contract.index,

    contractSubindex:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contract.subindex,

    moduleReference:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .moduleReference,

    contractName:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .contractName,

    schemaVersion:
      deployed.schemaVersion,

    ownerAccount:
      DEMO4_D4_1B_REPLACEMENT_PROFILE
        .ownerAccount,

    ownerAccountBytesHex:
      vector.ownerAccountBytesHex,

    concordiumGenesisHashBytesHex:
      vector.concordiumGenesisHashBytesHex,

    grpcHost: deployed.grpc.host,
    grpcPort: deployed.grpc.port,
    grpcTls: true,

    entrypoints: [
      deployed.registerEntrypoint,
      deployed.ownerOfKeyEntrypoint,
    ],

    eventSchemaPresent: true,

    replacementPublicKeyHex:
      vector.publicKeyBytesHex,

    ownerOfKeyStatus: "unregistered",

    canonicalMessageByteLength:
      canonical.value.byteLength,

    canonicalMessageSha256:
      canonical.value.sha256,

    expectedRegistrationParameterByteLength:
      vector.registrationParameterByteLength,

    privatePreflightRequired: true,

    safety:
      DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY,
  };


test("accepts the exact public preflight evidence", () => {
  const result = accepted(
    validateDemo4D41bReplacementPublicPreflightV1(
      clone(validEvidence),
    ),
  );

  assert.equal(
    result.reason,
    "accepted",
  );
});

test("rejects a non-object evidence envelope", () => {
  rejected(
    validateDemo4D41bReplacementPublicPreflightV1(
      null,
    ),
    "invalid_evidence",
  );
});

test("rejects normative source drift", () => {
  const evidence = clone(validEvidence);
  evidence.normativeHtmlSha256 = "0".repeat(64);

  rejected(
    validateDemo4D41bReplacementPublicPreflightV1(
      evidence,
    ),
    "source_pin_drift",
  );
});

test("rejects non-finalized chain evidence", () => {
  const evidence = clone(validEvidence);
  evidence.finalized = false;

  rejected(
    validateDemo4D41bReplacementPublicPreflightV1(
      evidence,
    ),
    "chain_state_not_finalized",
  );
});

const trustAnchorCases: ReadonlyArray<{
  readonly name: string;
  readonly reason: string;
  readonly mutate: (
    evidence: Record<string, unknown>,
  ) => void;
}> = [
  {
    name: "wrong Concordium network",
    reason: "wrong_network",
    mutate: (evidence) => {
      evidence.network = "ccd:wrong";
    },
  },
  {
    name: "wrong contract address",
    reason: "wrong_contract",
    mutate: (evidence) => {
      evidence.contractIndex = "12802";
    },
  },
  {
    name: "wrong module reference",
    reason: "wrong_module_reference",
    mutate: (evidence) => {
      evidence.moduleReference = "0".repeat(64);
    },
  },
  {
    name: "wrong contract name",
    reason: "wrong_contract_name",
    mutate: (evidence) => {
      evidence.contractName = "WrongContract";
    },
  },
  {
    name: "wrong schema version",
    reason: "wrong_schema_version",
    mutate: (evidence) => {
      evidence.schemaVersion = 2;
    },
  },
  {
    name: "wrong owner account",
    reason: "wrong_owner_account",
    mutate: (evidence) => {
      evidence.ownerAccount = "wrong-owner";
    },
  },
  {
    name: "wrong gRPC endpoint",
    reason: "wrong_grpc_endpoint",
    mutate: (evidence) => {
      evidence.grpcPort = 20_001;
    },
  },
  {
    name: "gRPC without TLS",
    reason: "tls_required",
    mutate: (evidence) => {
      evidence.grpcTls = false;
    },
  },
  {
    name: "missing register entrypoint",
    reason: "missing_register_entrypoint",
    mutate: (evidence) => {
      evidence.entrypoints = [
        deployed.ownerOfKeyEntrypoint,
      ];
    },
  },
  {
    name: "missing ownerOfKey entrypoint",
    reason: "missing_ownerofkey_entrypoint",
    mutate: (evidence) => {
      evidence.entrypoints = [
        deployed.registerEntrypoint,
      ];
    },
  },
  {
    name: "missing event schema",
    reason: "missing_event_schema",
    mutate: (evidence) => {
      evidence.eventSchemaPresent = false;
    },
  },
];

for (const current of trustAnchorCases) {
  test(`rejects ${current.name}`, () => {
    const evidence =
      clone(validEvidence) as unknown as
        Record<string, unknown>;

    current.mutate(evidence);

    rejected(
      validateDemo4D41bReplacementPublicPreflightV1(
        evidence,
      ),
      current.reason,
    );
  });
}

const keyCanonicalSafetyCases: ReadonlyArray<{
  readonly name: string;
  readonly reason: string;
  readonly mutate: (
    evidence: Record<string, unknown>,
  ) => void;
}> = [
  {
    name: "malformed replacement public key",
    reason: "invalid_public_key",
    mutate: (evidence) => {
      evidence.replacementPublicKeyHex =
        "00";
    },
  },
  {
    name: "already registered replacement key",
    reason: "replacement_key_already_registered",
    mutate: (evidence) => {
      evidence.ownerOfKeyStatus =
        "registered";
    },
  },
  {
    name: "malformed owner account bytes",
    reason: "invalid_owner_account_bytes",
    mutate: (evidence) => {
      evidence.ownerAccountBytesHex =
        "00";
    },
  },
  {
    name: "malformed Concordium genesis bytes",
    reason: "invalid_concordium_genesis_hash",
    mutate: (evidence) => {
      evidence.concordiumGenesisHashBytesHex =
        "00";
    },
  },
  {
    name: "wrong canonical message length",
    reason: "canonical_message_mismatch",
    mutate: (evidence) => {
      evidence.canonicalMessageByteLength =
        vector.canonicalMessageByteLength + 1;
    },
  },
  {
    name: "wrong canonical message hash",
    reason: "canonical_message_mismatch",
    mutate: (evidence) => {
      evidence.canonicalMessageSha256 =
        "0".repeat(64);
    },
  },
  {
    name: "wrong expected parameter length",
    reason: "registration_parameter_mismatch",
    mutate: (evidence) => {
      evidence.expectedRegistrationParameterByteLength =
        vector.registrationParameterByteLength + 1;
    },
  },
  {
    name: "missing private preflight requirement",
    reason: "private_preflight_required",
    mutate: (evidence) => {
      evidence.privatePreflightRequired =
        false;
    },
  },
  {
    name: "unsafe transaction-submitted state",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.safety = {
        ...(
          evidence.safety as
            Record<string, unknown>
        ),
        transactionSubmitted: true,
      };
    },
  },
];

for (const current of keyCanonicalSafetyCases) {
  test(`rejects ${current.name}`, () => {
    const evidence =
      clone(validEvidence) as unknown as
        Record<string, unknown>;

    current.mutate(evidence);

    rejected(
      validateDemo4D41bReplacementPublicPreflightV1(
        evidence,
      ),
      current.reason,
    );
  });
}

const preflightCoreSource = readFileSync(
  resolve(
    process.cwd(),
    "src/phase6/demo4Cis8ConformantReplacementPreflight.ts",
  ),
  "utf8",
);

const forbiddenCorePatterns: ReadonlyArray<{
  readonly name: string;
  readonly pattern: RegExp;
}> = [
  {
    name: "side-effect module import",
    pattern:
      /from\s+["']node:(?:fs|fs\/promises|child_process|net|http|https|tls|dgram|worker_threads)["']/,
  },
  {
    name: "environment access",
    pattern: /\bprocess\.env\b/,
  },
  {
    name: "network fetch",
    pattern: /\bfetch\s*\(/,
  },
  {
    name: "filesystem or process execution",
    pattern:
      /\b(?:readFileSync|writeFileSync|appendFileSync|unlinkSync|rmSync|spawn|execFile|execSync)\s*\(/,
  },
  {
    name: "private-key or signing primitive",
    pattern:
      /\b(?:createPrivateKey|generateKeyPair|generateKeyPairSync|createSign|sign)\s*\(/,
  },
  {
    name: "contract or transaction invocation",
    pattern:
      /\b(?:sendTransaction|updateContract|invokeContract)\s*\(/,
  },
  {
    name: "Concordium SDK dependency",
    pattern: /@concordium\/web-sdk/,
  },
];

test("keeps the public preflight core side-effect free", () => {
  for (const forbidden of forbiddenCorePatterns) {
    assert.equal(
      forbidden.pattern.test(preflightCoreSource),
      false,
      `public preflight core contains ${forbidden.name}`,
    );
  }

  acceptedCases += 1;
});

const validPrivateEvidence = {
  publicPreflight:
    clone(validEvidence),

  publicKeyMatchesPrivateKey:
    true,

  signatureByteLength:
    DEMO4_D4_1B_REPLACEMENT_PROFILE
      .signatureByteLength,

  signatureLocallyVerified:
    true,

  registrationParameterByteLength:
    vector.registrationParameterByteLength,

  registrationParameterSha256:
    vector.registrationParameterSha256,

  privateKeyMaterialIncluded:
    false,

  rawSignatureIncluded:
    false,

  walletMaterialIncluded:
    false,
};

test(
  "accepts exact synthetic private preflight evidence",
  () => {
    accepted(
      validateDemo4D41bReplacementPrivatePreflightV1(
        clone(validPrivateEvidence),
      ),
    );
  },
);

const privatePreflightCases: ReadonlyArray<{
  readonly name: string;
  readonly reason: string;
  readonly mutate: (
    evidence: Record<string, unknown>,
  ) => void;
}> = [
  {
    name: "nested public-preflight drift",
    reason: "source_pin_drift",
    mutate: (evidence) => {
      const publicPreflight =
        evidence.publicPreflight as
          Record<string, unknown>;

      publicPreflight.normativeHtmlSha256 =
        "0".repeat(64);
    },
  },
  {
    name: "private/public key mismatch",
    reason: "invalid_evidence",
    mutate: (evidence) => {
      evidence.publicKeyMatchesPrivateKey =
        false;
    },
  },
  {
    name: "wrong signature length",
    reason: "invalid_signature_length",
    mutate: (evidence) => {
      evidence.signatureByteLength =
        63;
    },
  },
  {
    name: "unverified local signature",
    reason: "signature_not_locally_verified",
    mutate: (evidence) => {
      evidence.signatureLocallyVerified =
        false;
    },
  },
  {
    name: "wrong registration parameter length",
    reason: "registration_parameter_mismatch",
    mutate: (evidence) => {
      evidence.registrationParameterByteLength =
        vector.registrationParameterByteLength + 1;
    },
  },
  {
    name: "malformed registration parameter hash",
    reason: "registration_parameter_mismatch",
    mutate: (evidence) => {
      evidence.registrationParameterSha256 =
        "00";
    },
  },
  {
    name: "included private-key material",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.privateKeyMaterialIncluded =
        true;
    },
  },
  {
    name: "included raw signature",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.rawSignatureIncluded =
        true;
    },
  },
  {
    name: "included wallet material",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.walletMaterialIncluded =
        true;
    },
  },
];

for (const current of privatePreflightCases) {
  test(`rejects ${current.name}`, () => {
    const evidence =
      clone(validPrivateEvidence) as unknown as
        Record<string, unknown>;

    current.mutate(evidence);

    rejected(
      validateDemo4D41bReplacementPrivatePreflightV1(
        evidence,
      ),
      current.reason,
    );
  });
}

const validAuthorizationInput = {
  privatePreflight:
    clone(validPrivateEvidence),

  explicitGate4SubmissionAuthorizationConfirmed:
    true,

  submissionAttemptsBefore:
    0,

  automaticRetryAuthorized:
    false,

  zeroCcdRequired:
    true,

  cis8004TokenId:
    DEMO4_D4_1B_REPLACEMENT_PROFILE
      .cis8004TokenId,

  cis8004Token287MutationAuthorized:
    false,

  d4_1cAttachmentAuthorized:
    false,

  historicalRegistrationRevocationAuthorized:
    false,
};

test(
  "builds a bounded synthetic Gate 4 handoff",
  () => {
    const result = accepted(
      authorizeDemo4D41bReplacementSingleSubmissionV1(
        clone(validAuthorizationInput),
      ),
    );

    assert.equal(
      result.value.status,
      "gate4_submission_authorized",
    );

    assert.equal(
      result.value.transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      result.value.gate4SubmissionLimit,
      1,
    );

    assert.equal(
      result.value.submissionAttemptsBefore,
      0,
    );

    assert.equal(
      result.value.remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      result.value.automaticRetryAuthorized,
      false,
    );

    assert.equal(
      result.value.zeroCcdRequired,
      true,
    );

    assert.equal(
      result.value.cis8004Token287MutationAuthorized,
      false,
    );

    assert.equal(
      result.value.d4_1cAttachmentAuthorized,
      false,
    );

    assert.equal(
      result.value
        .historicalRegistrationRevocationAuthorized,
      false,
    );

    assert.equal(
      Object.isFrozen(result.value),
      true,
    );
  },
);

const singleSubmissionCases: ReadonlyArray<{
  readonly name: string;
  readonly reason: string;
  readonly mutate: (
    evidence: Record<string, unknown>,
  ) => void;
}> = [
  {
    name: "nested private-preflight failure",
    reason: "signature_not_locally_verified",
    mutate: (evidence) => {
      const privatePreflight =
        evidence.privatePreflight as
          Record<string, unknown>;

      privatePreflight.signatureLocallyVerified =
        false;
    },
  },
  {
    name: "missing explicit Gate 4 authorization",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence
        .explicitGate4SubmissionAuthorizationConfirmed =
        false;
    },
  },
  {
    name: "prior submission attempt",
    reason: "submission_attempt_limit_exceeded",
    mutate: (evidence) => {
      evidence.submissionAttemptsBefore =
        1;
    },
  },
  {
    name: "automatic retry authorization",
    reason: "automatic_retry_forbidden",
    mutate: (evidence) => {
      evidence.automaticRetryAuthorized =
        true;
    },
  },
  {
    name: "non-zero CCD policy",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.zeroCcdRequired =
        false;
    },
  },
  {
    name: "wrong CIS-8004 token",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.cis8004TokenId =
        "288";
    },
  },
  {
    name: "CIS-8004 token 287 mutation",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.cis8004Token287MutationAuthorized =
        true;
    },
  },
  {
    name: "D4-1C attachment authorization",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence.d4_1cAttachmentAuthorized =
        true;
    },
  },
  {
    name: "historical registration revocation",
    reason: "unsafe_authorization_state",
    mutate: (evidence) => {
      evidence
        .historicalRegistrationRevocationAuthorized =
        true;
    },
  },
];

for (const current of singleSubmissionCases) {
  test(`rejects ${current.name}`, () => {
    const evidence =
      clone(validAuthorizationInput) as unknown as
        Record<string, unknown>;

    current.mutate(evidence);

    rejected(
      authorizeDemo4D41bReplacementSingleSubmissionV1(
        evidence,
      ),
      current.reason,
    );
  });
}

for (const current of tests) {
  current.body();
  console.log(`PASS ${current.name}`);
}

console.log(`TESTS=${tests.length}`);
console.log(`ACCEPTED_CASES=${acceptedCases}`);
console.log(`REJECTION_CASES=${rejectionCases}`);
console.log("PRIVATE_KEY_READ=false");
console.log("WALLET_READ=false");
console.log("SIGNING_ATTEMPTED=false");
console.log("NETWORK_CALLED=false");
console.log("TRANSACTION_SUBMITTED=false");
