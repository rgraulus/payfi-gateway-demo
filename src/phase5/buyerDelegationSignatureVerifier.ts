import {
  createPublicKey,
  verify as verifyEd25519Signature,
} from "node:crypto";

import {
  type BuyerToAgentDelegationCredentialDocument,
  type BuyerToAgentDelegationEd25519PublicKeyJwk,
  type BuyerToAgentDelegationReasonCode,
  validateBuyerToAgentDelegationCredentialContract,
} from "./buyerToAgentDelegationCredential";

/**
 * PR #294 verifies only the mathematical validity of the buyer signature.
 *
 * The supplied verification key is test-fixture material. This module does
 * not establish buyer-key trust, authenticate the buyer identity, verify
 * agent proof-of-possession, call runtime services, or authorize release.
 */

export const BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE =
  "test_fixture_only" as const;

export const BUYER_DELEGATION_SIGNATURE_VERIFICATION_STATUS_VALUES = [
  "verified",
  "rejected",
] as const;

export type BuyerDelegationSignatureVerificationStatus =
  (typeof BUYER_DELEGATION_SIGNATURE_VERIFICATION_STATUS_VALUES)[number];

export const BUYER_DELEGATION_SIGNATURE_VERIFIER_REASON_CODES = [
  "missing_buyer_verification_key",
  "buyer_verification_key_id_mismatch",
  "invalid_buyer_verification_key",
  "buyer_signature_verification_failed",
  "buyer_signature_verification_error",
] as const;

export type BuyerDelegationSignatureVerifierReasonCode =
  (typeof BUYER_DELEGATION_SIGNATURE_VERIFIER_REASON_CODES)[number];

export type BuyerDelegationSignatureVerificationReasonCode =
  | BuyerToAgentDelegationReasonCode
  | BuyerDelegationSignatureVerifierReasonCode;

export interface BuyerDelegationVerificationKey {
  buyerKeyId: string;
  publicKeyJwk: BuyerToAgentDelegationEd25519PublicKeyJwk;
  source: typeof BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE;
}

export interface BuyerDelegationSignatureVerificationInput {
  document: unknown;
  verificationKey: BuyerDelegationVerificationKey | null;
}

export interface BuyerDelegationSignatureVerificationResult {
  ok: boolean;
  status: BuyerDelegationSignatureVerificationStatus;
  reason: BuyerDelegationSignatureVerificationReasonCode;
  mode: typeof BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE;
  testOnly: true;

  contractValidated: boolean;
  contractReason: BuyerToAgentDelegationReasonCode;

  canonicalCredentialPresent: boolean;
  credentialHash: string | null;

  buyerId: string | null;
  buyerKeyId: string | null;
  verificationMethod: string | null;

  verificationKeyPresent: boolean;
  verificationKeySource:
    | typeof BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE
    | null;
  verificationKeyMatched: boolean;

  cryptographicVerificationAttempted: boolean;
  signatureVerified: boolean;

  verificationKeyTrustEstablished: false;
  buyerIdentityAuthenticated: false;
  buyerKeyOwnershipEstablished: false;
  agentProofOfPossessionVerified: false;

  gatewayCalled: false;
  crpCalled: false;
  paymentAttempted: false;
  receiptJwsPrinted: false;
  paymentResponsePrinted: false;
  protectedResourceReleased: false;
  replayStateMutated: false;
  agentRegistryLookupAttempted: false;
  productionActivation: false;
}

type UnknownRecord = Record<string, unknown>;

type ContractValidationResult = ReturnType<
  typeof validateBuyerToAgentDelegationCredentialContract
>;

interface ResultOverrides {
  verificationKeyMatched?: boolean;
  cryptographicVerificationAttempted?: boolean;
  signatureVerified?: boolean;
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isBoundedString(
  value: unknown,
  maximumLength = 512,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength
  );
}

function hasExactKeys(
  value: UnknownRecord,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([
    ...required,
    ...optional,
  ]);

  const actualKeys = Object.keys(value);

  return (
    required.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(
          value,
          key,
        ),
    ) &&
    actualKeys.every(
      (key) => allowed.has(key),
    )
  );
}

function decodeCanonicalBase64Url(
  value: unknown,
  expectedLength: number,
): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }

  let decoded: Buffer;

  try {
    decoded = Buffer.from(
      value,
      "base64url",
    );
  } catch {
    return null;
  }

  if (
    decoded.length !== expectedLength ||
    decoded.toString("base64url") !== value
  ) {
    return null;
  }

  return decoded;
}

function isValidEd25519PublicKeyJwk(
  value: unknown,
): value is BuyerToAgentDelegationEd25519PublicKeyJwk {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(
      value,
      ["kty", "crv", "x"],
      ["kid", "use", "alg"],
    )
  ) {
    return false;
  }

  if (
    value.kty !== "OKP" ||
    value.crv !== "Ed25519" ||
    decodeCanonicalBase64Url(
      value.x,
      32,
    ) === null
  ) {
    return false;
  }

  if (
    value.kid !== undefined &&
    !isBoundedString(value.kid)
  ) {
    return false;
  }

  if (
    value.use !== undefined &&
    value.use !== "sig"
  ) {
    return false;
  }

  if (
    value.alg !== undefined &&
    value.alg !== "EdDSA"
  ) {
    return false;
  }

  return true;
}

function toNodeCompatibleJsonWebKey(
  value: BuyerToAgentDelegationEd25519PublicKeyJwk,
): Record<string, string> {
  const result: Record<string, string> = {
    kty: value.kty,
    crv: value.crv,
    x: value.x,
  };

  if (value.kid !== undefined) {
    result.kid = value.kid;
  }

  if (value.use !== undefined) {
    result.use = value.use;
  }

  if (value.alg !== undefined) {
    result.alg = value.alg;
  }

  return result;
}

function isValidVerificationKey(
  value: unknown,
): value is BuyerDelegationVerificationKey {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(
      value,
      [
        "buyerKeyId",
        "publicKeyJwk",
        "source",
      ],
    )
  ) {
    return false;
  }

  return (
    isBoundedString(value.buyerKeyId) &&
    value.source ===
      BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE &&
    isValidEd25519PublicKeyJwk(
      value.publicKeyJwk,
    )
  );
}

function getVerificationMethod(
  document: unknown,
): string | null {
  if (!isRecord(document)) {
    return null;
  }

  const proof = document.proof;

  if (!isRecord(proof)) {
    return null;
  }

  return isBoundedString(
    proof.verificationMethod,
  )
    ? proof.verificationMethod
    : null;
}

function getCandidateBuyerKeyId(
  verificationKey: unknown,
): string | null {
  if (!isRecord(verificationKey)) {
    return null;
  }

  return isBoundedString(
    verificationKey.buyerKeyId,
  )
    ? verificationKey.buyerKeyId
    : null;
}

function getCandidateJwkKid(
  verificationKey: unknown,
): string | null {
  if (!isRecord(verificationKey)) {
    return null;
  }

  const publicKeyJwk =
    verificationKey.publicKeyJwk;

  if (!isRecord(publicKeyJwk)) {
    return null;
  }

  return isBoundedString(
    publicKeyJwk.kid,
  )
    ? publicKeyJwk.kid
    : null;
}

function getVerificationKeySource(
  verificationKey: unknown,
):
  | typeof BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE
  | null {
  if (
    isRecord(verificationKey) &&
    verificationKey.source ===
      BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE
  ) {
    return BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE;
  }

  return null;
}

function buildResult(
  input: BuyerDelegationSignatureVerificationInput,
  contractResult: ContractValidationResult,
  reason: BuyerDelegationSignatureVerificationReasonCode,
  overrides: ResultOverrides = {},
): BuyerDelegationSignatureVerificationResult {
  const signatureVerified =
    overrides.signatureVerified ?? false;

  const verified =
    reason === "accepted" &&
    signatureVerified;

  return {
    ok: verified,
    status: verified
      ? "verified"
      : "rejected",
    reason,
    mode:
      BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
    testOnly: true,

    contractValidated:
      contractResult.ok,
    contractReason:
      contractResult.reason,

    canonicalCredentialPresent:
      contractResult
        .canonicalCredentialPresent,
    credentialHash:
      contractResult.credentialHash,

    buyerId:
      contractResult.buyerId,
    buyerKeyId:
      contractResult.buyerKeyId,
    verificationMethod:
      getVerificationMethod(
        input.document,
      ),

    verificationKeyPresent:
      input.verificationKey !== null,
    verificationKeySource:
      getVerificationKeySource(
        input.verificationKey,
      ),
    verificationKeyMatched:
      overrides.verificationKeyMatched ??
      false,

    cryptographicVerificationAttempted:
      overrides
        .cryptographicVerificationAttempted ??
      false,
    signatureVerified,

    verificationKeyTrustEstablished: false,
    buyerIdentityAuthenticated: false,
    buyerKeyOwnershipEstablished: false,
    agentProofOfPossessionVerified: false,

    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    replayStateMutated: false,
    agentRegistryLookupAttempted: false,
    productionActivation: false,
  };
}

/**
 * Verifies the detached Ed25519 buyer signature over the exact RFC 8785
 * canonical credential bytes produced by the PR #293 contract validator.
 */
export function verifyBuyerDelegationSignature(
  input: BuyerDelegationSignatureVerificationInput,
): BuyerDelegationSignatureVerificationResult {
  const contractResult =
    validateBuyerToAgentDelegationCredentialContract(
      input.document,
    );

  if (!contractResult.ok) {
    return buildResult(
      input,
      contractResult,
      contractResult.reason,
    );
  }

  if (input.verificationKey === null) {
    return buildResult(
      input,
      contractResult,
      "missing_buyer_verification_key",
    );
  }

  const expectedBuyerKeyId =
    contractResult.buyerKeyId;

  const expectedVerificationMethod =
    getVerificationMethod(
      input.document,
    );

  const candidateBuyerKeyId =
    getCandidateBuyerKeyId(
      input.verificationKey,
    );

  const candidateJwkKid =
    getCandidateJwkKid(
      input.verificationKey,
    );

  if (
    expectedBuyerKeyId === null ||
    expectedVerificationMethod === null
  ) {
    return buildResult(
      input,
      contractResult,
      "buyer_signature_verification_error",
    );
  }

  if (
    (
      candidateBuyerKeyId !== null &&
      candidateBuyerKeyId !==
        expectedBuyerKeyId
    ) ||
    (
      candidateBuyerKeyId !== null &&
      candidateBuyerKeyId !==
        expectedVerificationMethod
    ) ||
    (
      candidateJwkKid !== null &&
      candidateJwkKid !==
        expectedBuyerKeyId
    )
  ) {
    return buildResult(
      input,
      contractResult,
      "buyer_verification_key_id_mismatch",
    );
  }

  if (
    !isValidVerificationKey(
      input.verificationKey,
    )
  ) {
    return buildResult(
      input,
      contractResult,
      "invalid_buyer_verification_key",
      {
        verificationKeyMatched:
          candidateBuyerKeyId ===
            expectedBuyerKeyId &&
          (
            candidateJwkKid === null ||
            candidateJwkKid ===
              expectedBuyerKeyId
          ),
      },
    );
  }

  const verificationKey =
    input.verificationKey;

  if (
    verificationKey.buyerKeyId !==
      expectedBuyerKeyId ||
    verificationKey.buyerKeyId !==
      expectedVerificationMethod ||
    (
      verificationKey.publicKeyJwk.kid !==
        undefined &&
      verificationKey.publicKeyJwk.kid !==
        expectedBuyerKeyId
    )
  ) {
    return buildResult(
      input,
      contractResult,
      "buyer_verification_key_id_mismatch",
    );
  }

  const document =
    input.document as
      BuyerToAgentDelegationCredentialDocument;

  const signatureBytes =
    decodeCanonicalBase64Url(
      document.proof.signatureValue,
      64,
    );

  if (
    signatureBytes === null ||
    contractResult.canonicalCredential === null
  ) {
    return buildResult(
      input,
      contractResult,
      signatureBytes === null
        ? "invalid_signature_encoding"
        : "canonicalization_failed",
      {
        verificationKeyMatched: true,
      },
    );
  }

  let publicKey: ReturnType<
    typeof createPublicKey
  >;

  try {
    publicKey = createPublicKey({
      key: toNodeCompatibleJsonWebKey(
        verificationKey.publicKeyJwk,
      ),
      format: "jwk",
    });
  } catch {
    return buildResult(
      input,
      contractResult,
      "invalid_buyer_verification_key",
      {
        verificationKeyMatched: true,
      },
    );
  }

  let signatureVerified: boolean;

  try {
    signatureVerified =
      verifyEd25519Signature(
        null,
        Buffer.from(
          contractResult
            .canonicalCredential,
          "utf8",
        ),
        publicKey,
        signatureBytes,
      );
  } catch {
    return buildResult(
      input,
      contractResult,
      "buyer_signature_verification_error",
      {
        verificationKeyMatched: true,
        cryptographicVerificationAttempted:
          true,
      },
    );
  }

  if (!signatureVerified) {
    return buildResult(
      input,
      contractResult,
      "buyer_signature_verification_failed",
      {
        verificationKeyMatched: true,
        cryptographicVerificationAttempted:
          true,
      },
    );
  }

  return buildResult(
    input,
    contractResult,
    "accepted",
    {
      verificationKeyMatched: true,
      cryptographicVerificationAttempted:
        true,
      signatureVerified: true,
    },
  );
}
