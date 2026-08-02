/**
 * PR #309 — Demo4 D4-1B CIS-8 profile-conformance decision.
 *
 * Permanent deterministic validation harness.
 *
 * This harness reads only committed public repository artifacts. It performs
 * no filesystem writes, network calls, key access, wallet access, signing,
 * contract invocation, transaction construction, payment, persistence,
 * Gateway runtime work, receipt work, replay mutation, resource release, or
 * production activation.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

const HARNESS_TYPE =
  "xcf.demo4.d4-1b.profile-conformance-decision-ci.v1";

const DOCUMENT_PATH =
  "docs/demo4-d4-1b-profile-conformance-decision.md";

const DECISION_EVIDENCE_PATH =
  "docs/evidence/demo4-d4-1b-profile-conformance-decision.json";

const D4_1B_EVIDENCE_PATH =
  "docs/evidence/demo4-d4-1b-cis8-registration-evidence.json";

const D4_1B_SOURCE_PATH =
  "src/phase6/demo4Cis8ActingKeyRegistration.ts";

const D4_1B_DOCUMENT_PATH =
  "docs/demo4-d4-1b-cis8-acting-key-registration.md";

const PHASE5_KEY_BUNDLE_PATH =
  "scripts/demo_phase5_cryptographic_key_bundle.ts";

const CORRECTIVE_REBASELINE_PATH =
  "docs/demo4-corrective-rebaseline.md";

const EXPECTED_DOCUMENT_SHA256 =
  "67d27fa58da9b653479a0b10278f587e21b1290c5ddd7c614c6326934ebf5699";

const EXPECTED_DECISION_EVIDENCE_SHA256 =
  "ffbfffe0e3932a24e73cd45b12b1945e7e66f9caac0ac6e2879bdb446eafe8b2";

const EXPECTED_TRANSACTION_HASH =
  "949a25947e645cca59a6a529859ba8fcbf160a0122d31406dc0eb45cc7d87093";

const EXPECTED_FINALIZED_BLOCK_HASH =
  "0506c203c157a2e676694e46a85e23f364409b90f3d615dcf034ba01f89a52cd";

const EXPECTED_FINALIZED_BLOCK_HEIGHT =
  "46287110";

const EXPECTED_MODULE_REFERENCE =
  "5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da";

const EXPECTED_OWNER_ACCOUNT =
  "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7";

const EXPECTED_AGENT_ID =
  "agent:xcf:demo4:registered";

const EXPECTED_AGENT_KEY_ID =
  "agent-key:xcf:demo4:registered:ed25519-1";

const EXPECTED_PUBLIC_KEY_HEX =
  "e9d34013c5d042e38e8f8c43f0d7e2c326eafe70b40647319d39ade5ea8c18ad";

const EXPECTED_PUBLIC_KEY_FINGERPRINT =
  "sha256:5064708a2081db6539f9e4043a1635fa0ab1633c97a67f5ced705a2fc73ce619";

const EXPECTED_CANONICAL_MESSAGE_SHA256 =
  "sha256:09d6e43e745b3aa4c1e3749416d2f58ed89d0634b78180aaaeb3c216865dc377";

const EXPECTED_NETWORK =
  "ccd:4221332d34e1694168c2a0c0b3fd0f27";

const EXPECTED_D4_1B_IMPLEMENTATION_COMMIT =
  "c69d21d83dcad06dd48b2898f76d022aacd6b160";

const EXPECTED_CORRECTIVE_REBASELINE_COMMIT =
  "10576fec6141940d96d114136a4f00f72f0eb2b1";

const EXPECTED_REFERENCE_COMMIT =
  "ecad927df321126dbde4e996c475e0faea3cfda1";

const EXPECTED_REFERENCE_BLOB =
  "3aedbbb7ac261f2547038ea09d966fdb53a8126c";

function repositoryPath(path: string): string {
  return resolve(process.cwd(), path);
}

function readBytes(path: string): Buffer {
  return readFileSync(repositoryPath(path));
}

function readUtf8(path: string): string {
  return readBytes(path).toString("utf8");
}

function sha256(value: Buffer | string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function asRecord(
  value: unknown,
  label: string,
): JsonRecord {
  assert.equal(
    typeof value,
    "object",
    `${label}_must_be_object`,
  );

  assert.notEqual(
    value,
    null,
    `${label}_must_not_be_null`,
  );

  assert.equal(
    Array.isArray(value),
    false,
    `${label}_must_not_be_array`,
  );

  return value as JsonRecord;
}

function parseJson(
  text: string,
  label: string,
): JsonRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${label}_invalid_json:${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  return asRecord(parsed, label);
}

function property(
  record: JsonRecord,
  name: string,
  label: string,
): unknown {
  assert.equal(
    Object.prototype.hasOwnProperty.call(record, name),
    true,
    `${label}_missing_${name}`,
  );

  return record[name];
}

function recordProperty(
  record: JsonRecord,
  name: string,
  label: string,
): JsonRecord {
  return asRecord(
    property(record, name, label),
    `${label}_${name}`,
  );
}

function stringProperty(
  record: JsonRecord,
  name: string,
  label: string,
): string {
  const value = property(record, name, label);

  assert.equal(
    typeof value,
    "string",
    `${label}_${name}_must_be_string`,
  );

  return value as string;
}

function booleanProperty(
  record: JsonRecord,
  name: string,
  label: string,
): boolean {
  const value = property(record, name, label);

  assert.equal(
    typeof value,
    "boolean",
    `${label}_${name}_must_be_boolean`,
  );

  return value as boolean;
}

function numberProperty(
  record: JsonRecord,
  name: string,
  label: string,
): number {
  const value = property(record, name, label);

  assert.equal(
    typeof value,
    "number",
    `${label}_${name}_must_be_number`,
  );

  assert.equal(
    Number.isFinite(value),
    true,
    `${label}_${name}_must_be_finite`,
  );

  return value as number;
}

function assertExactKeys(
  record: JsonRecord,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(record).sort();
  const frozenExpected = [...expected].sort();

  assert.deepEqual(
    actual,
    frozenExpected,
    `${label}_unexpected_key_set`,
  );
}

function assertContains(
  text: string,
  expected: string,
  label: string,
): void {
  assert.equal(
    text.includes(expected),
    true,
    `${label}_missing`,
  );
}

function extractLiteral(
  source: string,
  pattern: RegExp,
  label: string,
): string {
  const match = pattern.exec(source);

  assert.notEqual(
    match,
    null,
    `${label}_not_found`,
  );

  assert.equal(
    typeof match?.[1],
    "string",
    `${label}_capture_missing`,
  );

  return match![1];
}

function normalizeLineEndings(
  value: string,
): string {
  return value.replace(/\r\n/g, "\n");
}

function validateHarnessSafety(): void {
  const harnessSource = readUtf8(
    "scripts/ci_phase6_demo4_d4_1b_profile_conformance_decision.ts",
  );

  const allowedImports = [
    'import assert from "node:assert/strict";',
    'import { createHash } from "node:crypto";',
    'import { readFileSync } from "node:fs";',
    'import { resolve } from "node:path";',
  ];

  const importLines = harnessSource
    .split(/\r?\n/)
    .filter((line) => line.startsWith("import "));

  assert.deepEqual(
    importLines,
    allowedImports,
    "harness_import_surface_changed",
  );

  const forbiddenSourceFragments = [
    "write" + "File",
    "append" + "File",
    "create" + "WriteStream",
    "mkdir" + "Sync",
    "rm" + "Sync",
    "unlink" + "Sync",
    "rename" + "Sync",
    "copy" + "File",
    "child_" + "process",
    "exec" + "Sync",
    "spawn" + "Sync",
    "fetch" + "(",
    "node:" + "http",
    "node:" + "https",
    "node:" + "net",
    "node:" + "tls",
    "@concordium/" + "web-sdk",
    "process." + "env",
    "process." + "chdir",
  ];

  for (
    const fragment
    of forbiddenSourceFragments
  ) {
    assert.equal(
      harnessSource.includes(fragment),
      false,
      `harness_forbidden_source_fragment:${fragment}`,
    );
  }
}

function main(): void {
  console.log(
    `HARNESS_TYPE=${HARNESS_TYPE}`,
  );

  const documentBytes =
    readBytes(DOCUMENT_PATH);

  const document =
    documentBytes.toString("utf8");

  const decisionEvidenceBytes =
    readBytes(DECISION_EVIDENCE_PATH);

  const decisionEvidenceText =
    decisionEvidenceBytes.toString("utf8");

  const decisionEvidence =
    parseJson(
      decisionEvidenceText,
      "decision_evidence",
    );

  const d4_1bEvidence =
    parseJson(
      readUtf8(D4_1B_EVIDENCE_PATH),
      "d4_1b_evidence",
    );

  const d4_1bSource =
    readUtf8(D4_1B_SOURCE_PATH);

  const d4_1bDocument =
    readUtf8(D4_1B_DOCUMENT_PATH);

  const phase5KeyBundle =
    readUtf8(PHASE5_KEY_BUNDLE_PATH);

  const correctiveRebaseline =
    readUtf8(CORRECTIVE_REBASELINE_PATH);

  assert.equal(
    sha256(documentBytes),
    EXPECTED_DOCUMENT_SHA256,
    "decision_document_hash_changed",
  );

  assert.equal(
    sha256(decisionEvidenceBytes),
    EXPECTED_DECISION_EVIDENCE_SHA256,
    "decision_evidence_hash_changed",
  );

  assert.equal(
    documentBytes.subarray(0, 3)
      .equals(Buffer.from([0xef, 0xbb, 0xbf])),
    false,
    "decision_document_bom_forbidden",
  );

  assert.equal(
    decisionEvidenceBytes.subarray(0, 3)
      .equals(Buffer.from([0xef, 0xbb, 0xbf])),
    false,
    "decision_evidence_bom_forbidden",
  );

  assert.equal(
    document.endsWith("\r\n"),
    true,
    "decision_document_final_crlf_required",
  );

  assert.equal(
    decisionEvidenceText.endsWith("\r\n"),
    true,
    "decision_evidence_final_crlf_required",
  );

  assert.equal(
    normalizeLineEndings(decisionEvidenceText),
    `${JSON.stringify(decisionEvidence, null, 2)}\n`,
    "decision_evidence_not_canonical_pretty_json",
  );

  assertExactKeys(
    decisionEvidence,
    [
      "type",
      "version",
      "environment",
      "decision",
      "existingRegistration",
      "actingKey",
      "submittedProfile",
      "conformanceAssessment",
      "automaticNamespaceSubstitution",
      "replacementProfile",
      "d4_1a",
      "authoritativeReference",
      "repositoryAnchors",
      "safety",
    ],
    "decision_evidence",
  );

  assert.equal(
    stringProperty(
      decisionEvidence,
      "type",
      "decision_evidence",
    ),
    "xcf.demo4.d4-1b.profile-conformance-decision-evidence",
    "decision_evidence_type_mismatch",
  );

  assert.equal(
    stringProperty(
      decisionEvidence,
      "version",
      "decision_evidence",
    ),
    "1",
    "decision_evidence_version_mismatch",
  );

  assert.equal(
    stringProperty(
      decisionEvidence,
      "environment",
      "decision_evidence",
    ),
    "controlled_concordium_testnet",
    "decision_evidence_environment_mismatch",
  );

  const decision = recordProperty(
    decisionEvidence,
    "decision",
    "decision_evidence",
  );

  assertExactKeys(
    decision,
    [
      "disposition",
      "existingTransactionPreserved",
      "existingEvidencePreserved",
      "retainAsCanonicalProfile",
      "attachExistingRegistrationToCis8004",
      "immediateRevocationAuthorized",
      "replacementProfileRequired",
      "replacementProfileStatus",
      "d4_1cBlocked",
      "demo4StopRequired",
      "productionActivationAuthorized",
    ],
    "decision",
  );

  assert.equal(
    stringProperty(
      decision,
      "disposition",
      "decision",
    ),
    "SUPERSEDE_BEFORE_D4_1C",
    "wrong_disposition",
  );

  assert.equal(
    booleanProperty(
      decision,
      "existingTransactionPreserved",
      "decision",
    ),
    true,
    "existing_transaction_must_be_preserved",
  );

  assert.equal(
    booleanProperty(
      decision,
      "existingEvidencePreserved",
      "decision",
    ),
    true,
    "existing_evidence_must_be_preserved",
  );

  assert.equal(
    booleanProperty(
      decision,
      "retainAsCanonicalProfile",
      "decision",
    ),
    false,
    "retain_as_canonical_must_be_false",
  );

  assert.equal(
    booleanProperty(
      decision,
      "attachExistingRegistrationToCis8004",
      "decision",
    ),
    false,
    "existing_registration_attachment_must_be_false",
  );

  assert.equal(
    booleanProperty(
      decision,
      "immediateRevocationAuthorized",
      "decision",
    ),
    false,
    "immediate_revocation_must_remain_unauthorized",
  );

  assert.equal(
    booleanProperty(
      decision,
      "replacementProfileRequired",
      "decision",
    ),
    true,
    "replacement_profile_must_be_required",
  );

  assert.equal(
    stringProperty(
      decision,
      "replacementProfileStatus",
      "decision",
    ),
    "UNRESOLVED_FAIL_CLOSED",
    "replacement_profile_must_remain_unresolved",
  );

  assert.equal(
    booleanProperty(
      decision,
      "d4_1cBlocked",
      "decision",
    ),
    true,
    "d4_1c_must_remain_blocked",
  );

  assert.equal(
    booleanProperty(
      decision,
      "demo4StopRequired",
      "decision",
    ),
    false,
    "demo4_stop_must_not_be_required",
  );

  assert.equal(
    booleanProperty(
      decision,
      "productionActivationAuthorized",
      "decision",
    ),
    false,
    "production_activation_must_not_be_authorized",
  );

  const sourceRegistry = recordProperty(
    d4_1bEvidence,
    "registry",
    "d4_1b_evidence",
  );

  const sourceContract = recordProperty(
    sourceRegistry,
    "contract",
    "d4_1b_registry",
  );

  const sourceTransaction = recordProperty(
    d4_1bEvidence,
    "transaction",
    "d4_1b_evidence",
  );

  const sourceOwnership = recordProperty(
    d4_1bEvidence,
    "ownershipPostcondition",
    "d4_1b_evidence",
  );

  const sourceActingKey = recordProperty(
    d4_1bEvidence,
    "actingKey",
    "d4_1b_evidence",
  );

  const sourceProof = recordProperty(
    d4_1bEvidence,
    "proof",
    "d4_1b_evidence",
  );

  const sourceSafety = recordProperty(
    d4_1bEvidence,
    "safety",
    "d4_1b_evidence",
  );

  const existingRegistration = recordProperty(
    decisionEvidence,
    "existingRegistration",
    "decision_evidence",
  );

  const existingContract = recordProperty(
    existingRegistration,
    "contract",
    "existing_registration",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "network",
      "existing_registration",
    ),
    EXPECTED_NETWORK,
    "existing_registration_network_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "network",
      "existing_registration",
    ),
    stringProperty(
      d4_1bEvidence,
      "network",
      "d4_1b_evidence",
    ),
    "existing_registration_network_not_evidence_bound",
  );

  assert.equal(
    stringProperty(
      existingContract,
      "index",
      "existing_contract",
    ),
    stringProperty(
      sourceContract,
      "index",
      "source_contract",
    ),
    "contract_index_mismatch",
  );

  assert.equal(
    stringProperty(
      existingContract,
      "subindex",
      "existing_contract",
    ),
    stringProperty(
      sourceContract,
      "subindex",
      "source_contract",
    ),
    "contract_subindex_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "contractName",
      "existing_registration",
    ),
    "CIS-8",
    "contract_name_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "moduleReference",
      "existing_registration",
    ),
    EXPECTED_MODULE_REFERENCE,
    "module_reference_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "ownerAccount",
      "existing_registration",
    ),
    EXPECTED_OWNER_ACCOUNT,
    "owner_account_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "ownerAccount",
      "existing_registration",
    ),
    stringProperty(
      sourceRegistry,
      "ownerAccount",
      "source_registry",
    ),
    "owner_not_bound_to_source_evidence",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "transactionHash",
      "existing_registration",
    ),
    EXPECTED_TRANSACTION_HASH,
    "transaction_hash_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "transactionHash",
      "existing_registration",
    ),
    stringProperty(
      sourceTransaction,
      "hash",
      "source_transaction",
    ),
    "transaction_hash_not_evidence_bound",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "finalizedBlockHash",
      "existing_registration",
    ),
    EXPECTED_FINALIZED_BLOCK_HASH,
    "finalized_block_hash_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "finalizedBlockHeight",
      "existing_registration",
    ),
    EXPECTED_FINALIZED_BLOCK_HEIGHT,
    "finalized_block_height_mismatch",
  );

  assert.equal(
    stringProperty(
      existingRegistration,
      "finalizedBlockHeight",
      "existing_registration",
    ),
    stringProperty(
      sourceOwnership,
      "finalizedBlockHeight",
      "source_ownership",
    ),
    "finalized_block_height_not_evidence_bound",
  );

  assert.equal(
    booleanProperty(
      existingRegistration,
      "finalized",
      "existing_registration",
    ),
    true,
    "existing_registration_not_finalized",
  );

  assert.equal(
    numberProperty(
      existingRegistration,
      "matchingRegistrationEventCount",
      "existing_registration",
    ),
    1,
    "matching_registration_event_count_mismatch",
  );

  assert.equal(
    booleanProperty(
      existingRegistration,
      "ownerOfKeyPostconditionSatisfied",
      "existing_registration",
    ),
    true,
    "ownerofkey_postcondition_not_satisfied",
  );

  assert.equal(
    booleanProperty(
      existingRegistration,
      "zeroCcdAttached",
      "existing_registration",
    ),
    booleanProperty(
      sourceSafety,
      "zeroCcdAttached",
      "source_safety",
    ),
    "zero_ccd_attached_not_evidence_bound",
  );

  const actingKey = recordProperty(
    decisionEvidence,
    "actingKey",
    "decision_evidence",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "agentId",
      "acting_key",
    ),
    EXPECTED_AGENT_ID,
    "agent_id_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "agentId",
      "acting_key",
    ),
    stringProperty(
      sourceActingKey,
      "agentId",
      "source_acting_key",
    ),
    "agent_id_not_evidence_bound",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "agentKeyId",
      "acting_key",
    ),
    EXPECTED_AGENT_KEY_ID,
    "agent_key_id_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "publicKeyHex",
      "acting_key",
    ),
    EXPECTED_PUBLIC_KEY_HEX,
    "public_key_hex_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "publicKeyFingerprint",
      "acting_key",
    ),
    EXPECTED_PUBLIC_KEY_FINGERPRINT,
    "public_key_fingerprint_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "publicKeyType",
      "acting_key",
    ),
    "ed25519",
    "public_key_type_mismatch",
  );

  assert.equal(
    numberProperty(
      actingKey,
      "publicKeyByteLength",
      "acting_key",
    ),
    32,
    "public_key_byte_length_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "provenanceClassification",
      "acting_key",
    ),
    "APPLICATION_LEVEL_XCF_AGENT_ACTING_KEY",
    "provenance_classification_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "keyBundleContract",
      "acting_key",
    ),
    "phase5.demoCryptographicKeyBundle.v1",
    "key_bundle_contract_mismatch",
  );

  assert.equal(
    stringProperty(
      actingKey,
      "keyBundleMode",
      "acting_key",
    ),
    "controlled_cryptographic_demo2",
    "key_bundle_mode_mismatch",
  );

  for (
    const field
    of [
      "fetchAiExternalIdentityEvidenced",
      "solanaExternalIdentityEvidenced",
      "concordiumAccountKeyEvidenced",
      "otherExternalBlockchainIdentityEvidenced",
    ]
  ) {
    assert.equal(
      booleanProperty(
        actingKey,
        field,
        "acting_key",
      ),
      false,
      `${field}_must_be_false`,
    );
  }

  assertContains(
    phase5KeyBundle,
    "Generate a temporary controlled Demo2 cryptographic key bundle.",
    "phase5_application_key_generation_description",
  );

  assertContains(
    phase5KeyBundle,
    '"phase5.demoCryptographicKeyBundle.v1"',
    "phase5_key_bundle_contract",
  );

  assertContains(
    phase5KeyBundle,
    '"controlled_cryptographic_demo2"',
    "phase5_key_bundle_mode",
  );

  assertContains(
    d4_1bDocument,
    "fresh Demo4-specific Ed25519 acting key",
    "d4_1b_application_acting_key_description",
  );

  assertContains(
    d4_1bDocument,
    "The namespace is an XCF-controlled extension.",
    "d4_1b_controlled_namespace_disclosure",
  );

  assertContains(
    d4_1bDocument,
    "It must not be represented as a universally standardized CIS-8 or CAIP namespace.",
    "d4_1b_nonstandard_namespace_disclosure",
  );

  const submittedProfile = recordProperty(
    decisionEvidence,
    "submittedProfile",
    "decision_evidence",
  );

  const canonicalDomain = extractLiteral(
    d4_1bSource,
    /DEMO4_D4_1B_CANONICAL_DOMAIN\s*=\s*"([^"]+)"/,
    "canonical_domain",
  );

  const externalNamespace = extractLiteral(
    d4_1bSource,
    /externalNamespace:\s*"([^"]+)"/,
    "external_namespace",
  );

  const externalKeyNamespace = extractLiteral(
    d4_1bSource,
    /externalKeyNamespace:\s*"([^"]+)"/,
    "external_key_namespace",
  );

  const externalKeyType = extractLiteral(
    d4_1bSource,
    /externalKeyType:\s*"([^"]+)"/,
    "external_key_type",
  );

  const proofScheme = extractLiteral(
    d4_1bSource,
    /proofScheme:\s*"([^"]+)"/,
    "proof_scheme",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "canonicalDomain",
      "submitted_profile",
    ),
    canonicalDomain,
    "submitted_canonical_domain_mismatch",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "externalNamespace",
      "submitted_profile",
    ),
    externalNamespace,
    "submitted_external_namespace_mismatch",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "externalKeyNamespace",
      "submitted_profile",
    ),
    externalKeyNamespace,
    "submitted_external_key_namespace_mismatch",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "externalKeyType",
      "submitted_profile",
    ),
    externalKeyType,
    "submitted_external_key_type_mismatch",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "proofScheme",
      "submitted_profile",
    ),
    proofScheme,
    "submitted_proof_scheme_mismatch",
  );

  assert.equal(
    numberProperty(
      submittedProfile,
      "canonicalMessageByteLength",
      "submitted_profile",
    ),
    numberProperty(
      sourceProof,
      "canonicalMessageByteLength",
      "source_proof",
    ),
    "canonical_message_byte_length_mismatch",
  );

  assert.equal(
    stringProperty(
      submittedProfile,
      "canonicalMessageSha256",
      "submitted_profile",
    ),
    EXPECTED_CANONICAL_MESSAGE_SHA256,
    "canonical_message_hash_mismatch",
  );

  assert.equal(
    numberProperty(
      submittedProfile,
      "proofByteLength",
      "submitted_profile",
    ),
    64,
    "proof_byte_length_mismatch",
  );

  const assessment = recordProperty(
    decisionEvidence,
    "conformanceAssessment",
    "decision_evidence",
  );

  const externalNamespaceAssessment =
    recordProperty(
      assessment,
      "externalNamespace",
      "conformance_assessment",
    );

  const externalKeyNamespaceAssessment =
    recordProperty(
      assessment,
      "externalKeyNamespace",
      "conformance_assessment",
    );

  const externalKeyTypeAssessment =
    recordProperty(
      assessment,
      "externalKeyType",
      "conformance_assessment",
    );

  const proofSchemeAssessment =
    recordProperty(
      assessment,
      "proofScheme",
      "conformance_assessment",
    );

  const canonicalStructureAssessment =
    recordProperty(
      assessment,
      "canonicalMessageStructure",
      "conformance_assessment",
    );

  assert.equal(
    stringProperty(
      externalNamespaceAssessment,
      "result",
      "external_namespace_assessment",
    ),
    "NONCONFORMANT_FOR_CANONICAL_DEMO4_CIS8_PROFILE",
    "external_namespace_assessment_mismatch",
  );

  assert.equal(
    stringProperty(
      externalKeyNamespaceAssessment,
      "result",
      "external_key_namespace_assessment",
    ),
    "NONCONFORMANT_FOR_CANONICAL_DEMO4_CIS8_PROFILE",
    "external_key_namespace_assessment_mismatch",
  );

  assert.equal(
    stringProperty(
      externalKeyTypeAssessment,
      "result",
      "external_key_type_assessment",
    ),
    "STRUCTURALLY_SUPPORTED_BUT_INSUFFICIENT",
    "external_key_type_assessment_mismatch",
  );

  assert.equal(
    stringProperty(
      proofSchemeAssessment,
      "result",
      "proof_scheme_assessment",
    ),
    "SUPPORTED_IDENTIFIER_WITH_UNSUPPORTED_PROVENANCE_BINDING",
    "proof_scheme_assessment_mismatch",
  );

  assert.equal(
    stringProperty(
      canonicalStructureAssessment,
      "result",
      "canonical_structure_assessment",
    ),
    "STRUCTURALLY_PLAUSIBLE_BUT_NOT_DISPOSITIVE",
    "canonical_structure_assessment_mismatch",
  );

  assert.equal(
    booleanProperty(
      canonicalStructureAssessment,
      "officialBuilderComparisonRequiredForExistingProfile",
      "canonical_structure_assessment",
    ),
    false,
    "existing_profile_builder_comparison_must_not_be_required",
  );

  const substitution = recordProperty(
    decisionEvidence,
    "automaticNamespaceSubstitution",
    "decision_evidence",
  );

  for (
    const field
    of [
      "permitted",
      "cosmosFetchhub4Justified",
      "solanaMainnetJustified",
      "concordiumTestnetJustified",
      "otherCaip2NamespaceJustified",
    ]
  ) {
    assert.equal(
      booleanProperty(
        substitution,
        field,
        "automatic_namespace_substitution",
      ),
      false,
      `${field}_must_be_false`,
    );
  }

  const replacement = recordProperty(
    decisionEvidence,
    "replacementProfile",
    "decision_evidence",
  );

  assert.equal(
    booleanProperty(
      replacement,
      "selected",
      "replacement_profile",
    ),
    false,
    "replacement_profile_must_not_be_selected",
  );

  assert.equal(
    stringProperty(
      replacement,
      "status",
      "replacement_profile",
    ),
    "UNRESOLVED_FAIL_CLOSED",
    "replacement_profile_status_mismatch",
  );

  for (
    const field
    of [
      "mustIdentifyGenuineExternalBlockchain",
      "mustUseAuthoritativeCaip2Identifier",
      "mustEstablishExternalKeyProvenance",
      "mustFreezeKeyType",
      "mustFreezeProofScheme",
      "mustUseOfficialOrApprovedCanonicalBuilder",
      "mustApproveCustodyModel",
      "mustPassIndependentReviewBeforeSensitiveWork",
    ]
  ) {
    assert.equal(
      booleanProperty(
        replacement,
        field,
        "replacement_profile",
      ),
      true,
      `${field}_must_be_true`,
    );
  }

  const d4_1a = recordProperty(
    decisionEvidence,
    "d4_1a",
    "decision_evidence",
  );

  assert.equal(
    booleanProperty(
      d4_1a,
      "agentCardRemainsValid",
      "d4_1a",
    ),
    true,
    "agent_card_must_remain_valid",
  );

  assert.equal(
    booleanProperty(
      d4_1a,
      "cis8004PreparationMayProceedWithoutExistingExternalReference",
      "d4_1a",
    ),
    true,
    "d4_1a_preparation_must_remain_available",
  );

  assert.equal(
    booleanProperty(
      d4_1a,
      "existingXcfPhase5ReferenceMustNotBeAttached",
      "d4_1a",
    ),
    true,
    "xcf_phase5_reference_attachment_must_be_forbidden",
  );

  assert.equal(
    booleanProperty(
      d4_1a,
      "d4_1cRemainsSeparateAndBlocked",
      "d4_1a",
    ),
    true,
    "d4_1c_separation_and_block_must_be_preserved",
  );

  const reference = recordProperty(
    decisionEvidence,
    "authoritativeReference",
    "decision_evidence",
  );

  assert.equal(
    stringProperty(
      reference,
      "repository",
      "authoritative_reference",
    ),
    "Concordium/concordium.github.io",
    "reference_repository_mismatch",
  );

  assert.equal(
    stringProperty(
      reference,
      "path",
      "authoritative_reference",
    ),
    "source/mainnet/technical-reference/agent-registry/cis-8.rst",
    "reference_path_mismatch",
  );

  assert.equal(
    stringProperty(
      reference,
      "reviewedCommit",
      "authoritative_reference",
    ),
    EXPECTED_REFERENCE_COMMIT,
    "reference_commit_mismatch",
  );

  assert.equal(
    stringProperty(
      reference,
      "reviewedBlob",
      "authoritative_reference",
    ),
    EXPECTED_REFERENCE_BLOB,
    "reference_blob_mismatch",
  );

  const anchors = recordProperty(
    decisionEvidence,
    "repositoryAnchors",
    "decision_evidence",
  );

  assert.equal(
    stringProperty(
      anchors,
      "d4_1bImplementationCommit",
      "repository_anchors",
    ),
    EXPECTED_D4_1B_IMPLEMENTATION_COMMIT,
    "d4_1b_implementation_commit_mismatch",
  );

  assert.equal(
    stringProperty(
      anchors,
      "correctiveRebaselineCommit",
      "repository_anchors",
    ),
    EXPECTED_CORRECTIVE_REBASELINE_COMMIT,
    "corrective_rebaseline_commit_mismatch",
  );

  assert.equal(
    stringProperty(
      anchors,
      "decisionDocumentPath",
      "repository_anchors",
    ),
    DOCUMENT_PATH,
    "decision_document_path_mismatch",
  );

  assert.equal(
    stringProperty(
      anchors,
      "decisionDocumentSha256",
      "repository_anchors",
    ),
    EXPECTED_DOCUMENT_SHA256,
    "decision_document_anchor_hash_mismatch",
  );

  assertContains(
    correctiveRebaseline,
    "No disposition may be selected implicitly.",
    "rebaseline_no_implicit_disposition_guard",
  );

  assertContains(
    correctiveRebaseline,
    "it must not be attached to the new CIS-8004 identity;",
    "rebaseline_no_attachment_guard",
  );

  const safety = recordProperty(
    decisionEvidence,
    "safety",
    "decision_evidence",
  );

  assertExactKeys(
    safety,
    [
      "privateKeyAccessed",
      "ceremonyDirectoryAccessed",
      "walletAccessed",
      "newKeyGenerated",
      "signingAttempted",
      "signerCreated",
      "canonicalBuilderExecuted",
      "contractInvoked",
      "transactionConstructed",
      "transactionSubmitted",
      "cis8Mutated",
      "cis8004Mutated",
      "externalReferenceUpdated",
      "databaseMutated",
      "gatewayRuntimeCalled",
      "paymentAttempted",
      "receiptRequested",
      "receiptRedeemed",
      "protectedResourceReleased",
      "replayStateMutated",
      "productionActivation",
      "rawSignatureIncluded",
      "privatePathIncluded",
      "walletMaterialIncluded",
    ],
    "safety",
  );

  for (
    const [field, value]
    of Object.entries(safety)
  ) {
    assert.equal(
      value,
      false,
      `safety_effect_must_be_false:${field}`,
    );
  }

  const documentRequiredStatements = [
    "`SUPERSEDE_BEFORE_D4_1C`",
    "`APPLICATION_LEVEL_XCF_AGENT_ACTING_KEY`",
    "`RETAIN_AS_CANONICAL_PROFILE=false`",
    "`SUPERSEDE_REQUIRED=true`",
    "`UNRESOLVED_FAIL_CLOSED`",
    "`IMMEDIATE_REVOCATION_AUTHORIZED=false`",
    "`D4_1C_BLOCKED=true`",
    "`DEMO4_STOP_REQUIRED=false`",
    "It must not be attached to the future Demo4 CIS-8004 identity.",
    "No implicit answer is permitted.",
  ];

  for (
    const statement
    of documentRequiredStatements
  ) {
    assertContains(
      document,
      statement,
      `decision_document_statement:${statement}`,
    );
  }

  validateHarnessSafety();

  console.log(
    "PR309_PROFILE_CONFORMANCE_DECISION_DOCUMENT_VALIDATED=true",
  );

  console.log(
    "PR309_PROFILE_CONFORMANCE_DECISION_EVIDENCE_VALIDATED=true",
  );

  console.log(
    "PR309_APPLICATION_LEVEL_ACTING_KEY_PROVENANCE_VALIDATED=true",
  );

  console.log(
    "PR309_EXISTING_CIS8_PROFILE_RETAINED=false",
  );

  console.log(
    "PR309_EXISTING_CIS8_PROFILE_ATTACHABLE_TO_CIS8004=false",
  );

  console.log(
    "PR309_AUTOMATIC_CAIP2_NAMESPACE_SUBSTITUTION_ALLOWED=false",
  );

  console.log(
    "PR309_REPLACEMENT_PROFILE_STATUS=UNRESOLVED_FAIL_CLOSED",
  );

  console.log(
    "PR309_D4_1C_BLOCKED=true",
  );

  console.log(
    "PR309_IMMEDIATE_REVOCATION_AUTHORIZED=false",
  );

  console.log(
    "PR309_DEMO4_STOP_REQUIRED=false",
  );

  console.log(
    "PR309_DISPOSITION=SUPERSEDE_BEFORE_D4_1C",
  );

  console.log(
    "PR309_ZERO_SIDE_EFFECT_PROFILE=true",
  );

  console.log(
    "PR309_D4_1B_PROFILE_CONFORMANCE_DECISION_CI_PASSED=true",
  );
}

try {
  main();
} catch (error) {
  console.error(
    "PR309_D4_1B_PROFILE_CONFORMANCE_DECISION_CI_PASSED=false",
  );

  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : String(error),
  );

  process.exitCode = 1;
}
