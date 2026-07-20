import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  type BuyerDelegationVerificationKey,
  verifyBuyerDelegationSignature,
} from "../src/phase5/buyerDelegationSignatureVerifier";

const LABEL =
  "phase5:buyer-delegation-signature-verifier-seam-test";

const CONTRACT =
  "phase5.buyerDelegationSignatureVerifier.v1";

const MODE =
  "test_fixture_only";

const ROOT =
  process.cwd();

const DELEGATION_DIRECTORY =
  "fixtures/phase5/delegation";

const SIGNATURE_DIRECTORY =
  "fixtures/phase5/delegation-signature";

const VALID_FIXTURE_FILENAME =
  "buyer-to-agent-delegation.valid.example.json";

const INVALID_CONTRACT_FIXTURE_FILENAME =
  "buyer-to-agent-delegation.invalid.missing-buyer-key.json";

const VALID_KEY_FILENAME =
  "buyer-signature.valid.verification-key.json";

const WRONG_KEY_FILENAME =
  "buyer-signature.invalid.wrong-verification-key.json";

const VALID_SIGNATURE_FILENAME =
  "buyer-signature.valid.signature.txt";

const EXPECTED_CANONICAL_LENGTH =
  1184;

const EXPECTED_CREDENTIAL_HASH =
  "39d6a9381893f94b6d9cab674d50803eafba178ee8b164a0b790ca3cc8820a2e";

const EXPECTED_VALID_KEY_FILE_HASH =
  "72f189359fd25e22f541a3bb01cbd1cd5658c84cb34687c883635eecb5547ecc";

const EXPECTED_WRONG_KEY_FILE_HASH =
  "b5e50b3a1af5480ec921c2d11f576eb6e4ccbe3d584dcf96158492c2cd31c9fb";

const EXPECTED_SIGNATURE_FILE_HASH =
  "d7cec848be1679fbef7c8da0629c13d4a7bd9dc6a2b72fb978bc6a0c20ca9f2a";

type VerificationResult = ReturnType<
  typeof verifyBuyerDelegationSignature
>;

type FixtureDocument = {
  credential: {
    delegationId: string;
    issuer: {
      buyerId: string;
      buyerKeyId: string;
    };
    [key: string]: unknown;
  };
  proof: {
    signatureValue: string;
    verificationMethod: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type VectorAudit = {
  readonly filename: string;
  readonly bytes: number;
  readonly sha256: string;
};

function absolutePath(
  directory: string,
  filename: string,
): string {
  return path.join(
    ROOT,
    directory,
    filename,
  );
}

function sha256Hex(
  value: Buffer | string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function readUtf8Json<T>(
  directory: string,
  filename: string,
): T {
  const raw = fs.readFileSync(
    absolutePath(
      directory,
      filename,
    ),
  );

  assert.equal(
    raw.includes(0),
    false,
    `${filename}: must contain no NUL`,
  );

  assert.equal(
    raw.at(-1),
    10,
    `${filename}: must end with LF`,
  );

  return JSON.parse(
    raw.toString("utf8"),
  ) as T;
}

function readPinnedJsonVector<T>(
  filename: string,
  expectedHash: string,
): {
  value: T;
  audit: VectorAudit;
} {
  const raw = fs.readFileSync(
    absolutePath(
      SIGNATURE_DIRECTORY,
      filename,
    ),
  );

  const actualHash =
    sha256Hex(raw);

  assert.equal(
    actualHash,
    expectedHash,
    `${filename}: frozen file hash mismatch`,
  );

  assert.equal(
    raw.includes(0),
    false,
    `${filename}: must contain no NUL`,
  );

  assert.equal(
    raw.includes(13),
    false,
    `${filename}: must contain no CR`,
  );

  assert.equal(
    raw.at(-1),
    10,
    `${filename}: must end with LF`,
  );

  const value =
    JSON.parse(
      raw.toString("utf8"),
    ) as T;

  return {
    value,
    audit: {
      filename,
      bytes: raw.length,
      sha256: actualHash,
    },
  };
}

function readPinnedSignatureVector(): {
  signatureValue: string;
  audit: VectorAudit;
} {
  const raw = fs.readFileSync(
    absolutePath(
      SIGNATURE_DIRECTORY,
      VALID_SIGNATURE_FILENAME,
    ),
  );

  const actualHash =
    sha256Hex(raw);

  assert.equal(
    actualHash,
    EXPECTED_SIGNATURE_FILE_HASH,
    "signature vector frozen file hash mismatch",
  );

  assert.equal(
    raw.includes(0),
    false,
    "signature vector must contain no NUL",
  );

  assert.equal(
    raw.includes(13),
    false,
    "signature vector must contain no CR",
  );

  assert.equal(
    raw.at(-1),
    10,
    "signature vector must end with one LF",
  );

  assert.notEqual(
    raw.at(-2),
    10,
    "signature vector must not have extra LF",
  );

  const signatureValue =
    raw.subarray(0, -1).toString("ascii");

  assert.match(
    signatureValue,
    /^[A-Za-z0-9_-]{86}$/,
  );

  const decoded =
    Buffer.from(
      signatureValue,
      "base64url",
    );

  assert.equal(
    decoded.length,
    64,
  );

  assert.equal(
    decoded.toString("base64url"),
    signatureValue,
  );

  return {
    signatureValue,
    audit: {
      filename:
        VALID_SIGNATURE_FILENAME,
      bytes: raw.length,
      sha256: actualHash,
    },
  };
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
    return value.map(
      reverseObjectKeys,
    );
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
            reverseObjectKeys(
              childValue,
            ),
          ],
        ),
    );
  }

  return value;
}

function assertSafetyContract(
  result: VerificationResult,
  context: string,
): void {
  assert.equal(
    result.mode,
    MODE,
    context,
  );

  assert.equal(
    result.testOnly,
    true,
    context,
  );

  assert.equal(
    result.verificationKeyTrustEstablished,
    false,
    context,
  );

  assert.equal(
    result.buyerIdentityAuthenticated,
    false,
    context,
  );

  assert.equal(
    result.buyerKeyOwnershipEstablished,
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
    result.replayStateMutated,
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

function assertVerified(
  result: VerificationResult,
  context: string,
): void {
  assert.equal(
    result.ok,
    true,
    context,
  );

  assert.equal(
    result.status,
    "verified",
    context,
  );

  assert.equal(
    result.reason,
    "accepted",
    context,
  );

  assert.equal(
    result.contractValidated,
    true,
    context,
  );

  assert.equal(
    result.contractReason,
    "accepted",
    context,
  );

  assert.equal(
    result.canonicalCredentialPresent,
    true,
    context,
  );

  assert.equal(
    result.credentialHash,
    EXPECTED_CREDENTIAL_HASH,
    context,
  );

  assert.equal(
    result.verificationKeyMatched,
    true,
    context,
  );

  assert.equal(
    result.cryptographicVerificationAttempted,
    true,
    context,
  );

  assert.equal(
    result.signatureVerified,
    true,
    context,
  );

  assertSafetyContract(
    result,
    context,
  );
}

function assertRejected(
  result: VerificationResult,
  expectedReason:
    VerificationResult["reason"],
  expectedCryptoAttempted: boolean,
  context: string,
): void {
  assert.equal(
    result.ok,
    false,
    context,
  );

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
    result.cryptographicVerificationAttempted,
    expectedCryptoAttempted,
    context,
  );

  assert.equal(
    result.signatureVerified,
    false,
    context,
  );

  assertSafetyContract(
    result,
    context,
  );
}

function auditVerificationKey(
  verificationKey:
    BuyerDelegationVerificationKey,
  context: string,
): void {
  assert.equal(
    verificationKey.buyerKeyId,
    "buyer-key-demo-001",
    context,
  );

  assert.equal(
    verificationKey.source,
    MODE,
    context,
  );

  const jwk =
    verificationKey.publicKeyJwk;

  assert.equal(
    jwk.kty,
    "OKP",
    context,
  );

  assert.equal(
    jwk.crv,
    "Ed25519",
    context,
  );

  assert.equal(
    jwk.kid,
    verificationKey.buyerKeyId,
    context,
  );

  assert.equal(
    jwk.use,
    "sig",
    context,
  );

  assert.equal(
    jwk.alg,
    "EdDSA",
    context,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      jwk,
      "d",
    ),
    false,
    context,
  );

  const decodedX =
    Buffer.from(
      jwk.x,
      "base64url",
    );

  assert.equal(
    decodedX.length,
    32,
    context,
  );

  assert.equal(
    decodedX.toString("base64url"),
    jwk.x,
    context,
  );
}

function main(): void {
  const validFixture =
    readUtf8Json<FixtureDocument>(
      DELEGATION_DIRECTORY,
      VALID_FIXTURE_FILENAME,
    );

  const invalidContractFixture =
    readUtf8Json<unknown>(
      DELEGATION_DIRECTORY,
      INVALID_CONTRACT_FIXTURE_FILENAME,
    );

  const validKeyVector =
    readPinnedJsonVector<
      BuyerDelegationVerificationKey
    >(
      VALID_KEY_FILENAME,
      EXPECTED_VALID_KEY_FILE_HASH,
    );

  const wrongKeyVector =
    readPinnedJsonVector<
      BuyerDelegationVerificationKey
    >(
      WRONG_KEY_FILENAME,
      EXPECTED_WRONG_KEY_FILE_HASH,
    );

  const signatureVector =
    readPinnedSignatureVector();

  const validKey =
    validKeyVector.value;

  const wrongKey =
    wrongKeyVector.value;

  auditVerificationKey(
    validKey,
    "valid verification key",
  );

  auditVerificationKey(
    wrongKey,
    "wrong verification key",
  );

  assert.notEqual(
    validKey.publicKeyJwk.x,
    wrongKey.publicKeyJwk.x,
  );

  assert.equal(
    validFixture
      .credential
      .issuer
      .buyerKeyId,
    validKey.buyerKeyId,
  );

  assert.equal(
    validFixture
      .proof
      .verificationMethod,
    validKey.buyerKeyId,
  );

  const signedDocument =
    cloneFixture(
      validFixture,
    );

  signedDocument.proof.signatureValue =
    signatureVector.signatureValue;

  const accepted =
    verifyBuyerDelegationSignature({
      document: signedDocument,
      verificationKey: validKey,
    });

  assertVerified(
    accepted,
    "valid signature",
  );

  assert.equal(
    accepted.canonicalCredentialPresent,
    true,
  );

  assert.equal(
    accepted.credentialHash,
    EXPECTED_CREDENTIAL_HASH,
  );

  const reordered =
    verifyBuyerDelegationSignature({
      document:
        reverseObjectKeys(
          signedDocument,
        ),
      verificationKey: validKey,
    });

  assertVerified(
    reordered,
    "recursive key reordering",
  );

  assert.equal(
    reordered.credentialHash,
    accepted.credentialHash,
  );

  const placeholder =
    verifyBuyerDelegationSignature({
      document: validFixture,
      verificationKey: validKey,
    });

  assertRejected(
    placeholder,
    "buyer_signature_verification_failed",
    true,
    "PR #293 placeholder signature",
  );

  assert.equal(
    placeholder.contractValidated,
    true,
  );

  assert.equal(
    placeholder.credentialHash,
    EXPECTED_CREDENTIAL_HASH,
  );

  const wrongPublicKey =
    verifyBuyerDelegationSignature({
      document: signedDocument,
      verificationKey: wrongKey,
    });

  assertRejected(
    wrongPublicKey,
    "buyer_signature_verification_failed",
    true,
    "wrong public key",
  );

  assert.equal(
    wrongPublicKey.verificationKeyMatched,
    true,
  );

  const oneBitSignatureDocument =
    cloneFixture(
      signedDocument,
    );

  const oneBitSignatureBytes =
    Buffer.from(
      signatureVector.signatureValue,
      "base64url",
    );

  oneBitSignatureBytes[0] ^= 1;

  oneBitSignatureDocument
    .proof
    .signatureValue =
      oneBitSignatureBytes.toString(
        "base64url",
      );

  const oneBitSignatureMutation =
    verifyBuyerDelegationSignature({
      document:
        oneBitSignatureDocument,
      verificationKey: validKey,
    });

  assertRejected(
    oneBitSignatureMutation,
    "buyer_signature_verification_failed",
    true,
    "one-bit signature mutation",
  );

  assert.equal(
    oneBitSignatureMutation.credentialHash,
    EXPECTED_CREDENTIAL_HASH,
  );

  const signedClaimDocument =
    cloneFixture(
      signedDocument,
    );

  signedClaimDocument
    .credential
    .delegationId =
      "delegation-pr294-mutated-001";

  const signedClaimMutation =
    verifyBuyerDelegationSignature({
      document:
        signedClaimDocument,
      verificationKey: validKey,
    });

  assertRejected(
    signedClaimMutation,
    "buyer_signature_verification_failed",
    true,
    "signed claim mutation",
  );

  assert.notEqual(
    signedClaimMutation.credentialHash,
    EXPECTED_CREDENTIAL_HASH,
  );

  const missingVerificationKey =
    verifyBuyerDelegationSignature({
      document: signedDocument,
      verificationKey: null,
    });

  assertRejected(
    missingVerificationKey,
    "missing_buyer_verification_key",
    false,
    "missing verification key",
  );

  assert.equal(
    missingVerificationKey.contractValidated,
    true,
  );

  const keyIdMismatch =
    verifyBuyerDelegationSignature({
      document: signedDocument,
      verificationKey: {
        ...validKey,
        buyerKeyId:
          "buyer-key-other-001",
      },
    });

  assertRejected(
    keyIdMismatch,
    "buyer_verification_key_id_mismatch",
    false,
    "verification key ID mismatch",
  );

  const invalidVerificationKey =
    verifyBuyerDelegationSignature({
      document: signedDocument,
      verificationKey: {
        ...validKey,
        publicKeyJwk: {
          ...validKey.publicKeyJwk,
          crv:
            "Ed25519-invalid",
        },
      } as unknown as
        BuyerDelegationVerificationKey,
    });

  assertRejected(
    invalidVerificationKey,
    "invalid_buyer_verification_key",
    false,
    "invalid verification JWK",
  );

  const contractRejection =
    verifyBuyerDelegationSignature({
      document:
        invalidContractFixture,
      verificationKey: validKey,
    });

  assertRejected(
    contractRejection,
    "missing_buyer_key_identity",
    false,
    "PR #293 reason preservation",
  );

  assert.equal(
    contractRejection.contractValidated,
    false,
  );

  assert.equal(
    contractRejection.contractReason,
    "missing_buyer_key_identity",
  );

  assert.equal(
    contractRejection.canonicalCredentialPresent,
    false,
  );

  assert.equal(
    contractRejection.credentialHash,
    null,
  );

  const verificationMethodMismatchDocument =
    cloneFixture(
      signedDocument,
    );

  verificationMethodMismatchDocument
    .proof
    .verificationMethod =
      "buyer-key-other-001";

  const verificationMethodMismatch =
    verifyBuyerDelegationSignature({
      document:
        verificationMethodMismatchDocument,
      verificationKey: validKey,
    });

  assertRejected(
    verificationMethodMismatch,
    "verification_method_mismatch",
    false,
    "proof verification-method mismatch",
  );

  assert.equal(
    verificationMethodMismatch.contractValidated,
    false,
  );

  assert.equal(
    verificationMethodMismatch.contractReason,
    "verification_method_mismatch",
  );

  const cases = [
    {
      name: "valid signature",
      result: accepted,
    },
    {
      name:
        "recursive key reordering",
      result: reordered,
    },
    {
      name:
        "PR #293 placeholder signature",
      result: placeholder,
    },
    {
      name: "wrong public key",
      result: wrongPublicKey,
    },
    {
      name:
        "one-bit signature mutation",
      result:
        oneBitSignatureMutation,
    },
    {
      name:
        "signed claim mutation",
      result: signedClaimMutation,
    },
    {
      name:
        "missing verification key",
      result:
        missingVerificationKey,
    },
    {
      name:
        "verification key ID mismatch",
      result: keyIdMismatch,
    },
    {
      name:
        "invalid verification JWK",
      result:
        invalidVerificationKey,
    },
    {
      name:
        "PR #293 reason preservation",
      result: contractRejection,
    },
    {
      name:
        "proof verification-method mismatch",
      result:
        verificationMethodMismatch,
    },
  ];

  const summary = {
    ok: true,
    label: LABEL,
    contract: CONTRACT,
    mode: MODE,
    testOnly: true,
    cryptographicPrimitive:
      "Ed25519",
    signingRepresentation:
      "RFC8785 canonical UTF-8 credential bytes",
    canonicalLength:
      EXPECTED_CANONICAL_LENGTH,
    credentialHash:
      EXPECTED_CREDENTIAL_HASH,
    vectors: [
      validKeyVector.audit,
      wrongKeyVector.audit,
      signatureVector.audit,
    ],
    positive: {
      validSignatureVerified:
        accepted.signatureVerified,
      recursiveKeyReorderingStable:
        reordered.signatureVerified,
      detachedProofExcludedFromHash:
        placeholder.credentialHash ===
        accepted.credentialHash,
    },
    negative: {
      placeholderSignature:
        placeholder.reason,
      wrongPublicKey:
        wrongPublicKey.reason,
      oneBitSignatureMutation:
        oneBitSignatureMutation.reason,
      signedClaimMutation:
        signedClaimMutation.reason,
      missingVerificationKey:
        missingVerificationKey.reason,
      verificationKeyIdMismatch:
        keyIdMismatch.reason,
      invalidVerificationJwk:
        invalidVerificationKey.reason,
      preservedContractReason:
        contractRejection.reason,
      verificationMethodMismatch:
        verificationMethodMismatch.reason,
    },
    caseCount:
      cases.length,
    cases:
      cases.map(
        ({ name, result }) => ({
          name,
          ok: result.ok,
          status: result.status,
          reason: result.reason,
          contractValidated:
            result.contractValidated,
          verificationKeyMatched:
            result.verificationKeyMatched,
          cryptographicVerificationAttempted:
            result
              .cryptographicVerificationAttempted,
          signatureVerified:
            result.signatureVerified,
          credentialHash:
            result.credentialHash,
        }),
      ),
    trustBoundary: {
      mathematicalSignatureVerified:
        accepted.signatureVerified,
      verificationKeyTrustEstablished:
        false,
      buyerIdentityAuthenticated:
        false,
      buyerKeyOwnershipEstablished:
        false,
      agentProofOfPossessionVerified:
        false,
    },
    safety: {
      gatewayCalled: false,
      crpCalled: false,
      paymentAttempted: false,
      receiptJwsPrinted: false,
      paymentResponsePrinted: false,
      protectedResourceReleased: false,
      replayStateMutated: false,
      agentRegistryLookupAttempted:
        false,
      productionActivation: false,
    },
    nextFiniteRung:
      "#295 agent proof-of-possession",
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
