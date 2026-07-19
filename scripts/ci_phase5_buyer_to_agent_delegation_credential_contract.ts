import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  type BuyerToAgentDelegationReasonCode,
  validateBuyerToAgentDelegationCredentialContract,
} from "../src/phase5/buyerToAgentDelegationCredential";

const LABEL =
  "phase5:buyer-to-agent-delegation-credential-contract-test";

const CONTRACT =
  "phase5.buyerToAgentDelegationCredential.v1";

const MODE = "contract_only";

const ROOT = process.cwd();

const FIXTURE_DIRECTORY =
  "fixtures/phase5/delegation";

const VALID_FIXTURE_PATH =
  "buyer-to-agent-delegation.valid.example.json";

const CANONICAL_VECTOR_PATH =
  "buyer-to-agent-delegation.valid.canonical.txt";

const HASH_VECTOR_PATH =
  "buyer-to-agent-delegation.valid.sha256.txt";

const EXPECTED_CANONICAL_LENGTH = 1184;

const EXPECTED_CREDENTIAL_HASH =
  "39d6a9381893f94b6d9cab674d50803eafba178ee8b164a0b790ca3cc8820a2e";

type ValidationResult = ReturnType<
  typeof validateBuyerToAgentDelegationCredentialContract
>;

type FixtureDocument = {
  credential: {
    delegationId: string;
    [key: string]: unknown;
  };
  proof: {
    signatureValue: string;
    verificationMethod: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type InvalidFixtureCase = {
  readonly name: string;
  readonly filename: string;
  readonly expectedReason:
    BuyerToAgentDelegationReasonCode;
};

const INVALID_FIXTURE_CASES:
  readonly InvalidFixtureCase[] = [
    {
      name: "missing buyer key identity fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.missing-buyer-key.json",
      expectedReason:
        "missing_buyer_key_identity",
    },
    {
      name: "missing agent key identity fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.missing-agent-key.json",
      expectedReason:
        "missing_agent_key_identity",
    },
    {
      name:
        "unsupported credential version fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.unsupported-version.json",
      expectedReason:
        "unsupported_credential_version",
    },
    {
      name: "invalid delegated scope fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.scope.json",
      expectedReason:
        "invalid_scope",
    },
    {
      name: "invalid validity window fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.validity-window.json",
      expectedReason:
        "invalid_validity_window",
    },
    {
      name:
        "invalid signature encoding fails closed",
      filename:
        "buyer-to-agent-delegation.invalid.signature-encoding.json",
      expectedReason:
        "invalid_signature_encoding",
    },
  ];

function fixturePath(
  filename: string,
): string {
  return path.join(
    ROOT,
    FIXTURE_DIRECTORY,
    filename,
  );
}

function readUtf8(
  filename: string,
): string {
  return fs.readFileSync(
    fixturePath(filename),
    "utf8",
  );
}

function readFixture<T>(
  filename: string,
): T {
  return JSON.parse(
    readUtf8(filename),
  ) as T;
}

function cloneFixture<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function reverseObjectKeys(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectKeys);
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const record =
      value as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(record)
        .reverse()
        .map(
          ([key, childValue]) => [
            key,
            reverseObjectKeys(childValue),
          ],
        ),
    );
  }

  return value;
}

function assertSafetyContract(
  result: ValidationResult,
  context: string,
): void {
  assert.equal(
    result.metadataOnly,
    true,
    context,
  );

  assert.equal(
    result.signatureVerified,
    false,
    context,
  );

  assert.equal(
    result.agentProofOfPossessionVerified,
    false,
    context,
  );

  assert.equal(
    result.gatewayCalled,
    false,
    context,
  );

  assert.equal(
    result.crpCalled,
    false,
    context,
  );

  assert.equal(
    result.paymentAttempted,
    false,
    context,
  );

  assert.equal(
    result.receiptJwsPrinted,
    false,
    context,
  );

  assert.equal(
    result.paymentResponsePrinted,
    false,
    context,
  );

  assert.equal(
    result.protectedResourceReleased,
    false,
    context,
  );

  assert.equal(
    result.agentRegistryLookupAttempted,
    false,
    context,
  );

  assert.equal(
    result.productionActivation,
    false,
    context,
  );
}

function assertAccepted(
  result: ValidationResult,
  context: string,
): void {
  assert.equal(result.ok, true, context);
  assert.equal(
    result.status,
    "accepted",
    context,
  );
  assert.equal(
    result.reason,
    "accepted",
    context,
  );
  assert.equal(
    result.canonicalCredentialPresent,
    true,
    context,
  );

  assert.ok(
    typeof result.canonicalCredential ===
      "string",
    context,
  );

  assert.match(
    result.credentialHash ?? "",
    /^[0-9a-f]{64}$/,
    context,
  );

  assertSafetyContract(result, context);
}

function assertRejected(
  result: ValidationResult,
  expectedReason:
    BuyerToAgentDelegationReasonCode,
  context: string,
): void {
  assert.equal(result.ok, false, context);
  assert.equal(
    result.status,
    "rejected",
    context,
  );
  assert.equal(
    result.reason,
    expectedReason,
    context,
  );
  assert.equal(
    result.canonicalCredentialPresent,
    false,
    context,
  );
  assert.equal(
    result.canonicalCredential,
    null,
    context,
  );
  assert.equal(
    result.credentialHash,
    null,
    context,
  );

  assertSafetyContract(result, context);
}

function readFrozenVectors(): {
  canonicalCredential: string;
  credentialHash: string;
} {
  const canonicalWithLf =
    readUtf8(CANONICAL_VECTOR_PATH);

  const hashWithLf =
    readUtf8(HASH_VECTOR_PATH);

  assert.ok(
    canonicalWithLf.endsWith("\n"),
    "canonical vector must end with one LF",
  );

  assert.ok(
    !canonicalWithLf.endsWith("\n\n"),
    "canonical vector must not have extra LF",
  );

  assert.ok(
    !canonicalWithLf.includes("\r"),
    "canonical vector must not contain CR",
  );

  assert.ok(
    hashWithLf.endsWith("\n"),
    "hash vector must end with one LF",
  );

  assert.ok(
    !hashWithLf.endsWith("\n\n"),
    "hash vector must not have extra LF",
  );

  assert.ok(
    !hashWithLf.includes("\r"),
    "hash vector must not contain CR",
  );

  const canonicalCredential =
    canonicalWithLf.slice(0, -1);

  const credentialHash =
    hashWithLf.slice(0, -1);

  assert.equal(
    canonicalCredential.length,
    EXPECTED_CANONICAL_LENGTH,
  );

  assert.equal(
    Buffer.byteLength(
      canonicalCredential,
      "utf8",
    ),
    EXPECTED_CANONICAL_LENGTH,
  );

  assert.equal(
    credentialHash,
    EXPECTED_CREDENTIAL_HASH,
  );

  assert.match(
    credentialHash,
    /^[0-9a-f]{64}$/,
  );

  const independentlyComputedHash =
    createHash("sha256")
      .update(
        canonicalCredential,
        "utf8",
      )
      .digest("hex");

  assert.equal(
    independentlyComputedHash,
    credentialHash,
  );

  return {
    canonicalCredential,
    credentialHash,
  };
}

function main(): void {
  const frozenVectors =
    readFrozenVectors();

  const validFixture =
    readFixture<FixtureDocument>(
      VALID_FIXTURE_PATH,
    );

  const validResult =
    validateBuyerToAgentDelegationCredentialContract(
      validFixture,
    );

  assertAccepted(
    validResult,
    "valid fixture",
  );

  assert.equal(
    validResult.canonicalCredential,
    frozenVectors.canonicalCredential,
  );

  assert.equal(
    validResult.credentialHash,
    frozenVectors.credentialHash,
  );

  assert.equal(
    validResult.canonicalCredential?.length,
    EXPECTED_CANONICAL_LENGTH,
  );

  assert.ok(
    !frozenVectors.canonicalCredential.includes(
      '"proof"',
    ),
  );

  assert.ok(
    !frozenVectors.canonicalCredential.includes(
      validFixture.proof.signatureValue,
    ),
  );

  const reorderedFixture =
    reverseObjectKeys(
      validFixture,
    );

  const reorderedResult =
    validateBuyerToAgentDelegationCredentialContract(
      reorderedFixture,
    );

  assertAccepted(
    reorderedResult,
    "recursively reordered fixture",
  );

  assert.equal(
    reorderedResult.canonicalCredential,
    frozenVectors.canonicalCredential,
  );

  assert.equal(
    reorderedResult.credentialHash,
    frozenVectors.credentialHash,
  );

  const proofMutation =
    cloneFixture(validFixture);

  proofMutation.proof.signatureValue =
    Buffer.alloc(64, 10).toString(
      "base64url",
    );

  const proofMutationResult =
    validateBuyerToAgentDelegationCredentialContract(
      proofMutation,
    );

  assertAccepted(
    proofMutationResult,
    "detached proof mutation",
  );

  assert.equal(
    proofMutationResult.canonicalCredential,
    frozenVectors.canonicalCredential,
  );

  assert.equal(
    proofMutationResult.credentialHash,
    frozenVectors.credentialHash,
  );

  const signedClaimMutation =
    cloneFixture(validFixture);

  signedClaimMutation.credential.delegationId =
    "delegation-pr293-mutated-001";

  const signedClaimMutationResult =
    validateBuyerToAgentDelegationCredentialContract(
      signedClaimMutation,
    );

  assertAccepted(
    signedClaimMutationResult,
    "signed claim mutation",
  );

  assert.notEqual(
    signedClaimMutationResult
      .canonicalCredential,
    frozenVectors.canonicalCredential,
  );

  assert.notEqual(
    signedClaimMutationResult.credentialHash,
    frozenVectors.credentialHash,
  );

  const invalidResults =
    INVALID_FIXTURE_CASES.map(
      (fixtureCase) => {
        const input =
          readFixture<unknown>(
            fixtureCase.filename,
          );

        const result =
          validateBuyerToAgentDelegationCredentialContract(
            input,
          );

        assertRejected(
          result,
          fixtureCase.expectedReason,
          fixtureCase.filename,
        );

        return {
          name: fixtureCase.name,
          filename:
            fixtureCase.filename,
          ok: result.ok,
          status: result.status,
          expectedReason:
            fixtureCase.expectedReason,
          actualReason:
            result.reason,
          canonicalCredentialPresent:
            result.canonicalCredentialPresent,
          credentialHash:
            result.credentialHash,
          signatureVerified:
            result.signatureVerified,
          agentProofOfPossessionVerified:
            result
              .agentProofOfPossessionVerified,
          gatewayCalled:
            result.gatewayCalled,
          crpCalled:
            result.crpCalled,
          paymentAttempted:
            result.paymentAttempted,
          protectedResourceReleased:
            result
              .protectedResourceReleased,
          agentRegistryLookupAttempted:
            result
              .agentRegistryLookupAttempted,
          productionActivation:
            result.productionActivation,
        };
      },
    );

  const summary = {
    ok: true,
    label: LABEL,
    contract: CONTRACT,
    mode: MODE,
    metadataOnly: true,
    validFixture: {
      accepted: validResult.ok,
      reason: validResult.reason,
      canonicalLength:
        validResult.canonicalCredential
          ?.length ?? null,
      credentialHash:
        validResult.credentialHash,
    },
    vectors: {
      canonicalizationAlgorithm:
        "RFC8785",
      hashAlgorithm: "SHA-256",
      canonicalLength:
        frozenVectors
          .canonicalCredential.length,
      credentialHash:
        frozenVectors.credentialHash,
      independentlyVerified: true,
      proofExcluded: true,
    },
    mutations: {
      recursiveKeyReorderingStable:
        reorderedResult.credentialHash ===
        frozenVectors.credentialHash,
      detachedProofMutationStable:
        proofMutationResult.credentialHash ===
        frozenVectors.credentialHash,
      signedClaimMutationChangesHash:
        signedClaimMutationResult
          .credentialHash !==
        frozenVectors.credentialHash,
    },
    invalidFixtureCount:
      invalidResults.length,
    invalidFixtures:
      invalidResults,
    safety: {
      signatureVerified: false,
      agentProofOfPossessionVerified:
        false,
      gatewayCalled: false,
      crpCalled: false,
      paymentAttempted: false,
      receiptJwsPrinted: false,
      paymentResponsePrinted: false,
      protectedResourceReleased: false,
      agentRegistryLookupAttempted:
        false,
      productionActivation: false,
    },
    nextFiniteRung:
      "#294 cryptographic buyer signature verifier seam",
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );
}

main();
