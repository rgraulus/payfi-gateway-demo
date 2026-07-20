import * as fs from "node:fs";
import * as path from "node:path";

import {
  createHash,
} from "node:crypto";

import canonicalize from "canonicalize";

import {
  verifyAgentProofOfPossession,
  type AgentProofOfPossessionDocument,
  type AgentProofOfPossessionExpectedChallenge,
  type AgentProofOfPossessionReasonCode,
  type AgentProofOfPossessionVerificationInput,
  type AgentProofOfPossessionVerificationResult,
} from "../src/phase5/agentProofOfPossessionVerifier";

import {
  type BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

type JsonRecord = Record<string, unknown>;

type HarnessCase = {
  readonly name: string;
  readonly expectedReason:
    AgentProofOfPossessionReasonCode;
  readonly expectedOk: boolean;
  readonly expectedAgentCryptoAttempted: boolean;
  readonly makeInput: () =>
    AgentProofOfPossessionVerificationInput;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly expectedReason:
    AgentProofOfPossessionReasonCode;
  readonly actualReason:
    AgentProofOfPossessionReasonCode;
  readonly expectedAgentCryptoAttempted: boolean;
  readonly actualAgentCryptoAttempted: boolean;
  readonly agentProofOfPossessionVerified: boolean;
  readonly proofBindingsMatched: boolean;
  readonly result:
    AgentProofOfPossessionVerificationResult;
};

type FrozenVectorExpectation = {
  readonly relativePath: string;
  readonly bytes: number;
  readonly sha256: string;
};

const ROOT = process.cwd();

const FIXTURE_DIRECTORY =
  "fixtures/phase5/agent-proof-of-possession";

const DELEGATION_PATH =
  `${FIXTURE_DIRECTORY}/delegation.valid.example.json`;

const BUYER_KEY_PATH =
  `${FIXTURE_DIRECTORY}/buyer.verification-key.json`;

const PROOF_PATH =
  `${FIXTURE_DIRECTORY}/agent-proof.valid.example.json`;

const CANONICAL_PATH =
  `${FIXTURE_DIRECTORY}/agent-proof.valid.canonical.txt`;

const STATEMENT_HASH_PATH =
  `${FIXTURE_DIRECTORY}/agent-proof.valid.sha256.txt`;

const EXPECTED_CREDENTIAL_HASH =
  "76cb86a7e5f9f10d14ebe723ffb5ae828dfa3fd32ccbb6e273593e1e2cfd8dab";

const EXPECTED_PROOF_STATEMENT_HASH =
  "d490f75b52057b31ff840d3db56762e7b03ec51c11f584c906cbf356d7ebd374";

const FROZEN_VECTOR_EXPECTATIONS:
  readonly FrozenVectorExpectation[] = [
    {
      relativePath: DELEGATION_PATH,
      bytes: 1944,
      sha256:
        "10a1c8e4800e2867f962906d0623ae9fe5dfbfb3518bfbdd2255026f83bee7a6",
    },
    {
      relativePath: BUYER_KEY_PATH,
      bytes: 267,
      sha256:
        "8577dd60f82538bd88125734e7e251fe06303ea5f03ce565ebc9b0cd3ff8873b",
    },
    {
      relativePath: PROOF_PATH,
      bytes: 855,
      sha256:
        "cc696b22f321650e818fa4ba6d641fe9bcce5dcce2010bd693861ccf09b50b0f",
    },
    {
      relativePath: CANONICAL_PATH,
      bytes: 489,
      sha256:
        "b5bf39160918f1f417b4f4d944286d41d6180ef81f9b2f3137f4a311c3e4307f",
    },
    {
      relativePath: STATEMENT_HASH_PATH,
      bytes: 65,
      sha256:
        "295cb0ac06bf9aec861d819bb2395d6e90f37bb279ec0789eecf8fc58e6e36ec",
    },
  ];

const FALSE_SAFETY_FIELDS = [
  "buyerVerificationKeyTrustEstablished",
  "buyerIdentityAuthenticated",
  "buyerKeyOwnershipEstablished",
  "agentIdentityAuthenticated",
  "agentKeyTrustEstablished",
  "currentAuthorizationEstablished",
  "validityEvaluatedAgainstClock",
  "revocationChecked",
  "boundedUseConsumed",
  "challengeReplayStateMutated",
  "gatewayCalled",
  "crpCalled",
  "paymentAttempted",
  "receiptJwsPrinted",
  "paymentResponsePrinted",
  "protectedResourceReleased",
  "agentRegistryLookupAttempted",
  "productionActivation",
] as const;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson<T>(
  relativePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        relativePath,
      ),
      "utf8",
    ),
  ) as T;
}

function clone<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function sha256Hex(
  value: Buffer | string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function mutateCanonicalBase64UrlSignature(
  signatureValue: string,
): string {
  const bytes = Buffer.from(
    signatureValue,
    "base64url",
  );

  assert(
    bytes.length === 64,
    "signature mutation requires a 64-byte signature",
  );

  bytes[0] ^= 0x01;

  return bytes.toString("base64url");
}

function recursivelyReorder(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      recursivelyReorder,
    );
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return value;
  }

  const record =
    value as JsonRecord;

  const reordered: JsonRecord = {};

  for (
    const key of Object.keys(record)
      .sort()
      .reverse()
  ) {
    reordered[key] =
      recursivelyReorder(
        record[key],
      );
  }

  return reordered;
}

function assertNoPrivateMaterial(
  value: unknown,
  location = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        assertNoPrivateMaterial(
          item,
          `${location}[${index}]`,
        ),
    );

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  for (
    const [key, nested]
    of Object.entries(
      value as JsonRecord,
    )
  ) {
    assert(
      key !== "d",
      `private JWK field found at ${location}.${key}`,
    );

    assertNoPrivateMaterial(
      nested,
      `${location}.${key}`,
    );
  }
}

const VALID_DELEGATION =
  readJson<JsonRecord>(
    DELEGATION_PATH,
  );

const VALID_BUYER_KEY =
  readJson<BuyerDelegationVerificationKey>(
    BUYER_KEY_PATH,
  );

const VALID_PROOF =
  readJson<AgentProofOfPossessionDocument>(
    PROOF_PATH,
  );

const VALID_EXPECTED_CHALLENGE:
  AgentProofOfPossessionExpectedChallenge = {
    ...VALID_PROOF.statement.challenge,
  };

function baseInput():
  AgentProofOfPossessionVerificationInput {
  return {
    delegationDocument:
      clone(VALID_DELEGATION),

    buyerVerificationKey:
      clone(VALID_BUYER_KEY),

    proofDocument:
      clone(VALID_PROOF),

    expectedChallenge:
      clone(
        VALID_EXPECTED_CHALLENGE,
      ),
  };
}

function mutatedDelegation(
  mutate: (
    document: any,
  ) => void,
): unknown {
  const document =
    clone(VALID_DELEGATION) as any;

  mutate(document);

  return document;
}

function mutatedProof(
  mutate: (
    document: any,
  ) => void,
): unknown {
  const document =
    clone(VALID_PROOF) as any;

  mutate(document);

  return document;
}

function inputWithProof(
  proofDocument: unknown,
): AgentProofOfPossessionVerificationInput {
  return {
    ...baseInput(),
    proofDocument,
  };
}

function inputWithExpectedChallenge(
  expectedChallenge:
    AgentProofOfPossessionExpectedChallenge
    | null,
): AgentProofOfPossessionVerificationInput {
  return {
    ...baseInput(),
    expectedChallenge,
  };
}

const CASES:
  readonly HarnessCase[] = [
    {
      name:
        "valid buyer signature plus valid agent proof-of-possession",
      expectedReason: "accepted",
      expectedOk: true,
      expectedAgentCryptoAttempted: true,
      makeInput: baseInput,
    },
    {
      name:
        "recursive PoP statement key reordering is canonicalization-stable",
      expectedReason: "accepted",
      expectedOk: true,
      expectedAgentCryptoAttempted: true,
      makeInput: () =>
        inputWithProof(
          recursivelyReorder(
            VALID_PROOF,
          ),
        ),
    },
    {
      name:
        "PR #293 credential-contract rejection is preserved",
      expectedReason:
        "missing_buyer_key_identity",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () => ({
        ...baseInput(),
        delegationDocument:
          mutatedDelegation(
            (document) => {
              document
                .credential
                .issuer
                .buyerKeyId = "";
            },
          ),
      }),
    },
    {
      name:
        "PR #294 buyer-signature rejection is preserved",
      expectedReason:
        "buyer_signature_verification_failed",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () => ({
        ...baseInput(),
        delegationDocument:
          mutatedDelegation(
            (document) => {
              document
                .proof
                .signatureValue =
                mutateCanonicalBase64UrlSignature(
                  document
                    .proof
                    .signatureValue,
                );
            },
          ),
      }),
    },
    {
      name:
        "missing agent proof document",
      expectedReason:
        "missing_agent_proof",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(null),
    },
    {
      name:
        "invalid agent proof shape",
      expectedReason:
        "invalid_agent_proof_shape",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document.unexpected = true;
            },
          ),
        ),
    },
    {
      name:
        "unsupported agent proof type",
      expectedReason:
        "unsupported_agent_proof_type",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .proofType =
                "xcf.concordium.agent-proof-of-possession.unsupported";
            },
          ),
        ),
    },
    {
      name:
        "unsupported agent proof version",
      expectedReason:
        "unsupported_agent_proof_version",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .proofVersion =
                "2.0.0";
            },
          ),
        ),
    },
    {
      name:
        "unsupported agent signature algorithm",
      expectedReason:
        "unsupported_agent_signature_algorithm",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .proof
                .signatureAlgorithm =
                "Unsupported";
            },
          ),
        ),
    },
    {
      name:
        "unsupported agent canonicalization algorithm",
      expectedReason:
        "unsupported_agent_canonicalization_algorithm",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .proof
                .canonicalizationAlgorithm =
                "Unsupported";
            },
          ),
        ),
    },
    {
      name:
        "missing expected challenge",
      expectedReason:
        "missing_agent_expected_challenge",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithExpectedChallenge(null),
    },
    {
      name:
        "invalid canonical agent signature encoding",
      expectedReason:
        "invalid_agent_signature_encoding",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .proof
                .signatureValue =
                "AA==";
            },
          ),
        ),
    },
    {
      name:
        "delegation ID mismatch",
      expectedReason:
        "delegation_id_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .delegationId =
                "delegation-pr295-mismatch";
            },
          ),
        ),
    },
    {
      name:
        "credential hash mismatch",
      expectedReason:
        "credential_hash_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .credentialHash =
                "0".repeat(64);
            },
          ),
        ),
    },
    {
      name:
        "agent identity mismatch",
      expectedReason:
        "agent_identity_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .agentId =
                "agent:demo:pr295:mismatch";
            },
          ),
        ),
    },
    {
      name:
        "agent key ID mismatch",
      expectedReason:
        "agent_key_id_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .agentKeyId =
                "agent-key-pr295-mismatch";
            },
          ),
        ),
    },
    {
      name:
        "agent proof audience mismatch",
      expectedReason:
        "agent_proof_audience_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .audience =
                "xcf-gateway:mismatch";
            },
          ),
        ),
    },
    {
      name:
        "agent challenge nonce mismatch",
      expectedReason:
        "agent_challenge_nonce_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .challenge
                .nonce =
                "agent-pop-challenge-pr295-mismatch";
            },
          ),
        ),
    },
    {
      name:
        "agent challenge hash mismatch",
      expectedReason:
        "agent_challenge_hash_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .challenge
                .challengeHash =
                "f".repeat(64);
            },
          ),
        ),
    },
    {
      name:
        "agent challenge issuedAt mismatch",
      expectedReason:
        "agent_challenge_issued_at_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .challenge
                .issuedAt += 1;
            },
          ),
        ),
    },
    {
      name:
        "agent challenge expiresAt mismatch",
      expectedReason:
        "agent_challenge_expires_at_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .statement
                .challenge
                .expiresAt += 1;
            },
          ),
        ),
    },
    {
      name:
        "agent verification-method mismatch",
      expectedReason:
        "agent_verification_method_mismatch",
      expectedOk: false,
      expectedAgentCryptoAttempted: false,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .proof
                .verificationMethod =
                "agent-key-pr295-mismatch";
            },
          ),
        ),
    },
    {
      name:
        "one-bit agent-signature mutation fails cryptographically",
      expectedReason:
        "agent_proof_verification_failed",
      expectedOk: false,
      expectedAgentCryptoAttempted: true,
      makeInput: () =>
        inputWithProof(
          mutatedProof(
            (document) => {
              document
                .proof
                .signatureValue =
                mutateCanonicalBase64UrlSignature(
                  document
                    .proof
                    .signatureValue,
                );
            },
          ),
        ),
    },
    {
      name:
        "signed PoP-statement mutation fails cryptographically",
      expectedReason:
        "agent_proof_verification_failed",
      expectedOk: false,
      expectedAgentCryptoAttempted: true,
      makeInput: () => {
        const mutatedNonce =
          "agent-pop-challenge-pr295-signed-mutation";

        return {
          ...baseInput(),

          proofDocument:
            mutatedProof(
              (document) => {
                document
                  .statement
                  .challenge
                  .nonce =
                  mutatedNonce;
              },
            ),

          expectedChallenge: {
            ...VALID_EXPECTED_CHALLENGE,
            nonce: mutatedNonce,
          },
        };
      },
    },
  ];

function assertSafetyContract(
  result:
    AgentProofOfPossessionVerificationResult,
): void {
  for (
    const field of FALSE_SAFETY_FIELDS
  ) {
    assert(
      result[field] === false,
      `${field} must remain false`,
    );
  }

  assert(
    result.mode ===
      "test_fixture_only",
    "unexpected verifier mode",
  );

  assert(
    result.testOnly === true,
    "testOnly must remain true",
  );
}

function evaluateCase(
  fixtureCase: HarnessCase,
): EvaluatedCase {
  const result =
    verifyAgentProofOfPossession(
      fixtureCase.makeInput(),
    );

  assertSafetyContract(result);

  const statusMatches =
    fixtureCase.expectedOk
      ? (
          result.ok === true &&
          result.status === "verified"
        )
      : (
          result.ok === false &&
          result.status === "rejected"
        );

  const coreStateMatches =
    result.reason ===
      fixtureCase.expectedReason &&
    statusMatches &&
    result
      .agentCryptographicVerificationAttempted ===
      fixtureCase
        .expectedAgentCryptoAttempted &&
    result.agentProofOfPossessionVerified ===
      fixtureCase.expectedOk;

  if (fixtureCase.expectedOk) {
    assert(
      result.delegationContractValidated === true,
      `${fixtureCase.name}: contract not validated`,
    );

    assert(
      result.buyerSignatureVerified === true,
      `${fixtureCase.name}: buyer signature not verified`,
    );

    assert(
      result.agentPublicKeyBoundByBuyerSignature === true,
      `${fixtureCase.name}: agent key not buyer-signature bound`,
    );

    assert(
      result.proofStatementValidated === true,
      `${fixtureCase.name}: proof statement not validated`,
    );

    assert(
      result.canonicalProofStatementPresent === true,
      `${fixtureCase.name}: canonical statement absent`,
    );

    assert(
      result.proofStatementHash ===
        EXPECTED_PROOF_STATEMENT_HASH,
      `${fixtureCase.name}: proof statement hash mismatch`,
    );

    assert(
      result.expectedChallengePresent === true,
      `${fixtureCase.name}: expected challenge absent`,
    );

    assert(
      result.proofBindingsMatched === true,
      `${fixtureCase.name}: bindings not matched`,
    );
  }

  assert(
    coreStateMatches,
    [
      fixtureCase.name,
      `expectedReason=${fixtureCase.expectedReason}`,
      `actualReason=${result.reason}`,
      `expectedOk=${fixtureCase.expectedOk}`,
      `actualOk=${result.ok}`,
      "expectedAgentCryptoAttempted="
        + fixtureCase
          .expectedAgentCryptoAttempted,
      "actualAgentCryptoAttempted="
        + result
          .agentCryptographicVerificationAttempted,
      "agentProofOfPossessionVerified="
        + result
          .agentProofOfPossessionVerified,
    ].join(" | "),
  );

  return {
    name: fixtureCase.name,
    ok: coreStateMatches,
    expectedReason:
      fixtureCase.expectedReason,
    actualReason:
      result.reason,
    expectedAgentCryptoAttempted:
      fixtureCase
        .expectedAgentCryptoAttempted,
    actualAgentCryptoAttempted:
      result
        .agentCryptographicVerificationAttempted,
    agentProofOfPossessionVerified:
      result.agentProofOfPossessionVerified,
    proofBindingsMatched:
      result.proofBindingsMatched,
    result,
  };
}

function auditFrozenVectors(): {
  readonly vectors: readonly {
    readonly relativePath: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly cr: number;
  }[];
  readonly canonicalStatementHash: string;
} {
  const vectors =
    FROZEN_VECTOR_EXPECTATIONS.map(
      (expectation) => {
        const bytes =
          fs.readFileSync(
            path.join(
              ROOT,
              expectation.relativePath,
            ),
          );

        const digest =
          sha256Hex(bytes);

        const cr =
          [...bytes].filter(
            (value) => value === 13,
          ).length;

        assert(
          bytes.length ===
            expectation.bytes,
          `${expectation.relativePath}: byte-count mismatch`,
        );

        assert(
          digest ===
            expectation.sha256,
          `${expectation.relativePath}: SHA-256 mismatch`,
        );

        assert(
          cr === 0,
          `${expectation.relativePath}: CR bytes found`,
        );

        const upper =
          bytes.toString("utf8").toUpperCase();

        assert(
          !upper.includes(
            "PRIVATE KEY",
          ),
          `${expectation.relativePath}: private key marker found`,
        );

        assert(
          !upper.includes(
            "SECRET KEY",
          ),
          `${expectation.relativePath}: secret key marker found`,
        );

        return {
          relativePath:
            expectation.relativePath,
          bytes:
            bytes.length,
          sha256:
            digest,
          cr,
        };
      },
    );

  assertNoPrivateMaterial(
    VALID_DELEGATION,
  );

  assertNoPrivateMaterial(
    VALID_BUYER_KEY,
  );

  assertNoPrivateMaterial(
    VALID_PROOF,
  );

  const canonical =
    canonicalize(
      VALID_PROOF.statement,
    );

  assert(
    typeof canonical === "string",
    "valid statement canonicalization failed",
  );

  const frozenCanonical =
    fs.readFileSync(
      path.join(
        ROOT,
        CANONICAL_PATH,
      ),
      "utf8",
    );

  assert(
    frozenCanonical ===
      canonical + "\n",
    "frozen canonical statement text mismatch",
  );

  const canonicalStatementHash =
    sha256Hex(canonical);

  assert(
    canonicalStatementHash ===
      EXPECTED_PROOF_STATEMENT_HASH,
    "canonical statement hash mismatch",
  );

  const frozenStatementHash =
    fs.readFileSync(
      path.join(
        ROOT,
        STATEMENT_HASH_PATH,
      ),
      "utf8",
    );

  assert(
    frozenStatementHash ===
      canonicalStatementHash + "\n",
    "frozen statement hash file mismatch",
  );

  assert(
    VALID_PROOF
      .statement
      .credentialHash ===
      EXPECTED_CREDENTIAL_HASH,
    "proof credential hash vector mismatch",
  );

  const delegationCredential =
    (
      VALID_DELEGATION
        .credential as JsonRecord
    );

  const delegationSubject =
    (
      delegationCredential
        .subject as JsonRecord
    );

  const embeddedAgentKey =
    (
      delegationSubject
        .agentPublicKeyJwk as JsonRecord
    );

  assert(
    delegationSubject.agentId ===
      VALID_PROOF.statement.agentId,
    "agent identity is not fixture-bound",
  );

  assert(
    delegationSubject.agentKeyId ===
      VALID_PROOF.statement.agentKeyId,
    "agent key ID is not fixture-bound",
  );

  assert(
    embeddedAgentKey.kid ===
      VALID_PROOF.statement.agentKeyId,
    "embedded agent JWK kid mismatch",
  );

  assert(
    (
      delegationCredential
        .delegationId
    ) ===
      VALID_PROOF
        .statement
        .delegationId,
    "delegation ID is not fixture-bound",
  );

  return {
    vectors,
    canonicalStatementHash,
  };
}

function main(): void {
  assert(
    CASES.length === 24,
    `expected 24 cases, found ${CASES.length}`,
  );

  const vectorAudit =
    auditFrozenVectors();

  const evaluated =
    CASES.map(
      evaluateCase,
    );

  const allCasesPassed =
    evaluated.every(
      (fixtureCase) =>
        fixtureCase.ok,
    );

  const positiveCount =
    evaluated.filter(
      (fixtureCase) =>
        fixtureCase.result.ok,
    ).length;

  const agentCryptoAttemptCount =
    evaluated.filter(
      (fixtureCase) =>
        fixtureCase
          .actualAgentCryptoAttempted,
    ).length;

  const agentCryptoVerifiedCount =
    evaluated.filter(
      (fixtureCase) =>
        fixtureCase
          .agentProofOfPossessionVerified,
    ).length;

  const summary = {
    ok: allCasesPassed,
    label:
      "phase5:agent-proof-of-possession-verifier-seam-test",
    contract:
      "phase5.agentProofOfPossessionVerifier.v1",
    mode:
      "test_fixture_only",
    testOnly: true,
    cryptographicPrimitive:
      "Ed25519",
    signingRepresentation:
      "RFC8785 canonical UTF-8 PoP statement bytes",
    delegatedAgentKeySource:
      "buyer-signed delegation credential only",
    caseCount:
      evaluated.length,
    positiveCount,
    negativeCount:
      evaluated.length -
      positiveCount,
    agentCryptoAttemptCount,
    agentCryptoVerifiedCount,
    credentialHash:
      EXPECTED_CREDENTIAL_HASH,
    proofStatementHash:
      vectorAudit
        .canonicalStatementHash,
    vectors:
      vectorAudit.vectors,
    cases:
      evaluated.map(
        (fixtureCase) => ({
          name:
            fixtureCase.name,
          ok:
            fixtureCase.ok,
          expectedReason:
            fixtureCase.expectedReason,
          actualReason:
            fixtureCase.actualReason,
          expectedAgentCryptoAttempted:
            fixtureCase
              .expectedAgentCryptoAttempted,
          actualAgentCryptoAttempted:
            fixtureCase
              .actualAgentCryptoAttempted,
          agentProofOfPossessionVerified:
            fixtureCase
              .agentProofOfPossessionVerified,
          proofBindingsMatched:
            fixtureCase
              .proofBindingsMatched,
          status:
            fixtureCase.result.status,
        }),
      ),
    trustBoundary: {
      mathematicalBuyerSignatureVerified:
        true,
      agentPublicKeyBoundByBuyerSignature:
        true,
      mathematicalAgentProofOfPossessionVerified:
        true,
      buyerVerificationKeyTrustEstablished:
        false,
      buyerIdentityAuthenticated:
        false,
      buyerKeyOwnershipEstablished:
        false,
      agentIdentityAuthenticated:
        false,
      agentKeyTrustEstablished:
        false,
      currentAuthorizationEstablished:
        false,
    },
    safety: {
      validityEvaluatedAgainstClock:
        false,
      revocationChecked:
        false,
      boundedUseConsumed:
        false,
      challengeReplayStateMutated:
        false,
      gatewayCalled:
        false,
      crpCalled:
        false,
      paymentAttempted:
        false,
      receiptJwsPrinted:
        false,
      paymentResponsePrinted:
        false,
      protectedResourceReleased:
        false,
      agentRegistryLookupAttempted:
        false,
      productionActivation:
        false,
    },
    nextFiniteRung:
      "#296 controlled runtime cryptographic composition / Demo 2",
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  if (!allCasesPassed) {
    process.exitCode = 1;
  }
}

main();
