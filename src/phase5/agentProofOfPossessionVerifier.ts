import {
  createHash,
  createPublicKey,
  verify as verifyEd25519Signature,
} from "node:crypto";

import canonicalize from "canonicalize";

import {
  verifyBuyerDelegationSignature,
  type BuyerDelegationSignatureVerificationReasonCode,
  type BuyerDelegationSignatureVerificationResult,
  type BuyerDelegationVerificationKey,
} from "./buyerDelegationSignatureVerifier";

import {
  type BuyerToAgentDelegationCredentialDocument,
  type BuyerToAgentDelegationEd25519PublicKeyJwk,
} from "./buyerToAgentDelegationCredential";

/**
 * PR #295 verifies only mathematical agent proof-of-possession.
 *
 * A successful result means that the signer controlled the private key
 * corresponding to the agent public key carried inside the buyer-signed
 * delegation credential when the challenge-bound statement was signed.
 *
 * It does not establish key trust, real-world identity, current
 * authorization, clock validity, revocation status, remaining uses,
 * replay consumption, payment authority, settlement, release, registry
 * state, or production activation.
 */

export const AGENT_PROOF_OF_POSSESSION_TYPE =
  "xcf.concordium.agent-proof-of-possession.v1" as const;

export const AGENT_PROOF_OF_POSSESSION_VERSION =
  "1.0.0" as const;

export const AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM =
  "Ed25519" as const;

export const AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM =
  "RFC8785" as const;

export const AGENT_PROOF_OF_POSSESSION_MODE =
  "test_fixture_only" as const;

export const AGENT_PROOF_OF_POSSESSION_STATUS_VALUES = [
  "verified",
  "rejected",
] as const;

export type AgentProofOfPossessionStatus =
  (typeof AGENT_PROOF_OF_POSSESSION_STATUS_VALUES)[number];

export const AGENT_PROOF_OF_POSSESSION_REASON_CODES = [
  "missing_agent_proof",
  "invalid_agent_proof_shape",
  "unsupported_agent_proof_type",
  "unsupported_agent_proof_version",
  "unsupported_agent_signature_algorithm",
  "unsupported_agent_canonicalization_algorithm",
  "missing_agent_expected_challenge",
  "delegation_id_mismatch",
  "credential_hash_mismatch",
  "agent_identity_mismatch",
  "agent_key_id_mismatch",
  "agent_proof_audience_mismatch",
  "agent_challenge_nonce_mismatch",
  "agent_challenge_hash_mismatch",
  "agent_challenge_issued_at_mismatch",
  "agent_challenge_expires_at_mismatch",
  "agent_verification_method_mismatch",
  "invalid_agent_signature_encoding",
  "agent_proof_verification_failed",
  "agent_proof_verification_error",
] as const;

export type AgentProofOfPossessionSpecificReasonCode =
  (typeof AGENT_PROOF_OF_POSSESSION_REASON_CODES)[number];

export type AgentProofOfPossessionReasonCode =
  | BuyerDelegationSignatureVerificationReasonCode
  | AgentProofOfPossessionSpecificReasonCode;

export interface AgentProofOfPossessionExpectedChallenge {
  readonly nonce: string;
  readonly challengeHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface AgentProofOfPossessionStatement {
  readonly proofType:
    typeof AGENT_PROOF_OF_POSSESSION_TYPE;

  readonly proofVersion:
    typeof AGENT_PROOF_OF_POSSESSION_VERSION;

  readonly delegationId: string;
  readonly credentialHash: string;
  readonly agentId: string;
  readonly agentKeyId: string;
  readonly audience: string;

  readonly challenge: {
    readonly nonce: string;
    readonly challengeHash: string;
    readonly issuedAt: number;
    readonly expiresAt: number;
  };
}

export interface AgentProofOfPossessionDetachedProof {
  readonly signatureAlgorithm:
    typeof AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM;

  readonly canonicalizationAlgorithm:
    typeof AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM;

  readonly verificationMethod: string;
  readonly signatureValue: string;
}

export interface AgentProofOfPossessionDocument {
  readonly statement: AgentProofOfPossessionStatement;
  readonly proof: AgentProofOfPossessionDetachedProof;
}

export interface AgentProofOfPossessionVerificationInput {
  readonly delegationDocument: unknown;

  readonly buyerVerificationKey:
    | BuyerDelegationVerificationKey
    | null;

  readonly proofDocument: unknown;

  readonly expectedChallenge:
    | AgentProofOfPossessionExpectedChallenge
    | null;
}

export interface AgentProofOfPossessionVerificationResult {
  readonly ok: boolean;
  readonly status: AgentProofOfPossessionStatus;
  readonly reason: AgentProofOfPossessionReasonCode;

  readonly mode:
    typeof AGENT_PROOF_OF_POSSESSION_MODE;

  readonly testOnly: true;

  readonly delegationContractValidated: boolean;
  readonly buyerSignatureVerified: boolean;
  readonly agentPublicKeyBoundByBuyerSignature: boolean;

  readonly credentialHash: string | null;
  readonly delegationId: string | null;
  readonly agentId: string | null;
  readonly agentKeyId: string | null;

  readonly proofStatementValidated: boolean;
  readonly canonicalProofStatementPresent: boolean;
  readonly proofStatementHash: string | null;

  readonly expectedChallengePresent: boolean;

  readonly delegationIdMatched: boolean;
  readonly credentialHashMatched: boolean;
  readonly agentIdentityMatched: boolean;
  readonly agentKeyIdMatched: boolean;
  readonly audienceMatched: boolean;

  readonly challengeNonceMatched: boolean;
  readonly challengeHashMatched: boolean;
  readonly challengeIssuedAtMatched: boolean;
  readonly challengeExpiresAtMatched: boolean;

  readonly verificationMethodMatched: boolean;
  readonly proofBindingsMatched: boolean;

  readonly agentCryptographicVerificationAttempted: boolean;
  readonly agentProofOfPossessionVerified: boolean;

  readonly buyerVerificationKeyTrustEstablished: false;
  readonly buyerIdentityAuthenticated: false;
  readonly buyerKeyOwnershipEstablished: false;

  readonly agentIdentityAuthenticated: false;
  readonly agentKeyTrustEstablished: false;

  readonly currentAuthorizationEstablished: false;
  readonly validityEvaluatedAgainstClock: false;
  readonly revocationChecked: false;
  readonly boundedUseConsumed: false;
  readonly challengeReplayStateMutated: false;

  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly protectedResourceReleased: false;
  readonly agentRegistryLookupAttempted: false;
  readonly productionActivation: false;
}

type UnknownRecord = Record<string, unknown>;

interface VerifiedDelegationSnapshot {
  readonly delegationId: string;
  readonly agentId: string;
  readonly agentKeyId: string;
  readonly agentPublicKeyJwk:
    BuyerToAgentDelegationEd25519PublicKeyJwk;
  readonly audience: string;
}

interface ParsedProofDocument {
  readonly document:
    AgentProofOfPossessionDocument;

  readonly canonicalStatement: string;
  readonly proofStatementHash: string;
}

type ParsedProofResult =
  | {
      readonly ok: true;
      readonly value: ParsedProofDocument;
    }
  | {
      readonly ok: false;
      readonly reason:
        AgentProofOfPossessionSpecificReasonCode;
    };

interface VerificationState {
  proofStatementValidated: boolean;
  canonicalProofStatementPresent: boolean;
  proofStatementHash: string | null;

  expectedChallengePresent: boolean;

  delegationIdMatched: boolean;
  credentialHashMatched: boolean;
  agentIdentityMatched: boolean;
  agentKeyIdMatched: boolean;
  audienceMatched: boolean;

  challengeNonceMatched: boolean;
  challengeHashMatched: boolean;
  challengeIssuedAtMatched: boolean;
  challengeExpiresAtMatched: boolean;

  verificationMethodMatched: boolean;

  agentCryptographicVerificationAttempted: boolean;
  agentProofOfPossessionVerified: boolean;
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

function hasExactKeys(
  value: UnknownRecord,
  required: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  const allowed = new Set(required);

  return (
    actualKeys.length === required.length &&
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

function isLowercaseSha256(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{64}$/.test(value)
  );
}

function isSafeTimestamp(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
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

function createInitialState(): VerificationState {
  return {
    proofStatementValidated: false,
    canonicalProofStatementPresent: false,
    proofStatementHash: null,

    expectedChallengePresent: false,

    delegationIdMatched: false,
    credentialHashMatched: false,
    agentIdentityMatched: false,
    agentKeyIdMatched: false,
    audienceMatched: false,

    challengeNonceMatched: false,
    challengeHashMatched: false,
    challengeIssuedAtMatched: false,
    challengeExpiresAtMatched: false,

    verificationMethodMatched: false,

    agentCryptographicVerificationAttempted: false,
    agentProofOfPossessionVerified: false,
  };
}

function getVerifiedDelegationSnapshot(
  document: unknown,
): VerifiedDelegationSnapshot | null {
  if (!isRecord(document)) {
    return null;
  }

  const credential = document.credential;

  if (!isRecord(credential)) {
    return null;
  }

  const subject = credential.subject;
  const replay = credential.replay;

  if (
    !isRecord(subject) ||
    !isRecord(replay)
  ) {
    return null;
  }

  const typedDocument =
    document as unknown as
      BuyerToAgentDelegationCredentialDocument;

  return {
    delegationId:
      typedDocument.credential.delegationId,

    agentId:
      typedDocument.credential.subject.agentId,

    agentKeyId:
      typedDocument.credential.subject.agentKeyId,

    agentPublicKeyJwk:
      typedDocument
        .credential
        .subject
        .agentPublicKeyJwk,

    audience:
      typedDocument.credential.replay.audience,
  };
}

function validateExpectedChallenge(
  value: unknown,
): value is AgentProofOfPossessionExpectedChallenge {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasExactKeys(
      value,
      [
        "nonce",
        "challengeHash",
        "issuedAt",
        "expiresAt",
      ],
    )
  ) {
    return false;
  }

  return (
    isBoundedString(value.nonce) &&
    isLowercaseSha256(value.challengeHash) &&
    isSafeTimestamp(value.issuedAt) &&
    isSafeTimestamp(value.expiresAt) &&
    value.expiresAt > value.issuedAt
  );
}

function parseProofDocument(
  value: unknown,
): ParsedProofResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  if (
    !hasExactKeys(
      value,
      ["statement", "proof"],
    )
  ) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  const statement = value.statement;
  const proof = value.proof;

  if (
    !isRecord(statement) ||
    !isRecord(proof)
  ) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  if (
    !hasExactKeys(
      statement,
      [
        "proofType",
        "proofVersion",
        "delegationId",
        "credentialHash",
        "agentId",
        "agentKeyId",
        "audience",
        "challenge",
      ],
    ) ||
    !hasExactKeys(
      proof,
      [
        "signatureAlgorithm",
        "canonicalizationAlgorithm",
        "verificationMethod",
        "signatureValue",
      ],
    )
  ) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  const challenge = statement.challenge;

  if (
    !isRecord(challenge) ||
    !hasExactKeys(
      challenge,
      [
        "nonce",
        "challengeHash",
        "issuedAt",
        "expiresAt",
      ],
    )
  ) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  if (
    !isBoundedString(statement.proofType) ||
    !isBoundedString(statement.proofVersion) ||
    !isBoundedString(statement.delegationId) ||
    !isLowercaseSha256(
      statement.credentialHash,
    ) ||
    !isBoundedString(statement.agentId) ||
    !isBoundedString(statement.agentKeyId) ||
    !isBoundedString(statement.audience) ||
    !isBoundedString(challenge.nonce) ||
    !isLowercaseSha256(
      challenge.challengeHash,
    ) ||
    !isSafeTimestamp(challenge.issuedAt) ||
    !isSafeTimestamp(challenge.expiresAt) ||
    challenge.expiresAt <= challenge.issuedAt ||
    !isBoundedString(
      proof.signatureAlgorithm,
    ) ||
    !isBoundedString(
      proof.canonicalizationAlgorithm,
    ) ||
    !isBoundedString(
      proof.verificationMethod,
    ) ||
    !isBoundedString(
      proof.signatureValue,
      1024,
    )
  ) {
    return {
      ok: false,
      reason: "invalid_agent_proof_shape",
    };
  }

  if (
    statement.proofType !==
    AGENT_PROOF_OF_POSSESSION_TYPE
  ) {
    return {
      ok: false,
      reason: "unsupported_agent_proof_type",
    };
  }

  if (
    statement.proofVersion !==
    AGENT_PROOF_OF_POSSESSION_VERSION
  ) {
    return {
      ok: false,
      reason: "unsupported_agent_proof_version",
    };
  }

  if (
    proof.signatureAlgorithm !==
    AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM
  ) {
    return {
      ok: false,
      reason:
        "unsupported_agent_signature_algorithm",
    };
  }

  if (
    proof.canonicalizationAlgorithm !==
    AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM
  ) {
    return {
      ok: false,
      reason:
        "unsupported_agent_canonicalization_algorithm",
    };
  }

  let canonicalStatement: string;

  try {
    const canonical = canonicalize(
      statement,
    );

    if (typeof canonical !== "string") {
      return {
        ok: false,
        reason:
          "agent_proof_verification_error",
      };
    }

    canonicalStatement = canonical;
  } catch {
    return {
      ok: false,
      reason:
        "agent_proof_verification_error",
    };
  }

  const proofStatementHash =
    createHash("sha256")
      .update(
        canonicalStatement,
        "utf8",
      )
      .digest("hex");

  return {
    ok: true,
    value: {
      document:
        value as unknown as
          AgentProofOfPossessionDocument,

      canonicalStatement,
      proofStatementHash,
    },
  };
}

function proofBindingsMatched(
  state: VerificationState,
): boolean {
  return (
    state.delegationIdMatched &&
    state.credentialHashMatched &&
    state.agentIdentityMatched &&
    state.agentKeyIdMatched &&
    state.audienceMatched &&
    state.challengeNonceMatched &&
    state.challengeHashMatched &&
    state.challengeIssuedAtMatched &&
    state.challengeExpiresAtMatched &&
    state.verificationMethodMatched
  );
}

function buildResult(
  buyerResult:
    BuyerDelegationSignatureVerificationResult,

  delegation:
    VerifiedDelegationSnapshot | null,

  reason:
    AgentProofOfPossessionReasonCode,

  state:
    VerificationState,
): AgentProofOfPossessionVerificationResult {
  const verified =
    reason === "accepted" &&
    state.agentProofOfPossessionVerified;

  return {
    ok: verified,
    status: verified
      ? "verified"
      : "rejected",
    reason,

    mode:
      AGENT_PROOF_OF_POSSESSION_MODE,

    testOnly: true,

    delegationContractValidated:
      buyerResult.contractValidated,

    buyerSignatureVerified:
      buyerResult.signatureVerified,

    agentPublicKeyBoundByBuyerSignature:
      buyerResult.ok &&
      buyerResult.signatureVerified &&
      delegation !== null,

    credentialHash:
      buyerResult.credentialHash,

    delegationId:
      delegation?.delegationId ?? null,

    agentId:
      delegation?.agentId ?? null,

    agentKeyId:
      delegation?.agentKeyId ?? null,

    proofStatementValidated:
      state.proofStatementValidated,

    canonicalProofStatementPresent:
      state.canonicalProofStatementPresent,

    proofStatementHash:
      state.proofStatementHash,

    expectedChallengePresent:
      state.expectedChallengePresent,

    delegationIdMatched:
      state.delegationIdMatched,

    credentialHashMatched:
      state.credentialHashMatched,

    agentIdentityMatched:
      state.agentIdentityMatched,

    agentKeyIdMatched:
      state.agentKeyIdMatched,

    audienceMatched:
      state.audienceMatched,

    challengeNonceMatched:
      state.challengeNonceMatched,

    challengeHashMatched:
      state.challengeHashMatched,

    challengeIssuedAtMatched:
      state.challengeIssuedAtMatched,

    challengeExpiresAtMatched:
      state.challengeExpiresAtMatched,

    verificationMethodMatched:
      state.verificationMethodMatched,

    proofBindingsMatched:
      proofBindingsMatched(state),

    agentCryptographicVerificationAttempted:
      state
        .agentCryptographicVerificationAttempted,

    agentProofOfPossessionVerified:
      state.agentProofOfPossessionVerified,

    buyerVerificationKeyTrustEstablished: false,
    buyerIdentityAuthenticated: false,
    buyerKeyOwnershipEstablished: false,

    agentIdentityAuthenticated: false,
    agentKeyTrustEstablished: false,

    currentAuthorizationEstablished: false,
    validityEvaluatedAgainstClock: false,
    revocationChecked: false,
    boundedUseConsumed: false,
    challengeReplayStateMutated: false,

    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    agentRegistryLookupAttempted: false,
    productionActivation: false,
  };
}

/**
 * Verifies a challenge-bound detached Ed25519 agent signature using only
 * the agent public JWK carried inside the already buyer-signed credential.
 *
 * The caller cannot supply an independent agent verification key.
 */
export function verifyAgentProofOfPossession(
  input:
    AgentProofOfPossessionVerificationInput,
): AgentProofOfPossessionVerificationResult {
  const buyerResult =
    verifyBuyerDelegationSignature({
      document:
        input.delegationDocument,

      verificationKey:
        input.buyerVerificationKey,
    });

  const state = createInitialState();

  const delegation =
    buyerResult.contractValidated
      ? getVerifiedDelegationSnapshot(
          input.delegationDocument,
        )
      : null;

  /*
   * PR #293 and PR #294 reasons take absolute precedence.
   * No PoP validation or agent cryptographic verification occurs here.
   */
  if (!buyerResult.ok) {
    return buildResult(
      buyerResult,
      delegation,
      buyerResult.reason,
      state,
    );
  }

  if (
    delegation === null ||
    buyerResult.credentialHash === null
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_proof_verification_error",
      state,
    );
  }

  if (
    input.proofDocument === null ||
    input.proofDocument === undefined
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "missing_agent_proof",
      state,
    );
  }

  const parsed =
    parseProofDocument(
      input.proofDocument,
    );

  if (parsed.ok === false) {
    return buildResult(
      buyerResult,
      delegation,
      parsed.reason,
      state,
    );
  }

  state.proofStatementValidated = true;
  state.canonicalProofStatementPresent = true;
  state.proofStatementHash =
    parsed.value.proofStatementHash;

  if (
    !validateExpectedChallenge(
      input.expectedChallenge,
    )
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "missing_agent_expected_challenge",
      state,
    );
  }

  state.expectedChallengePresent = true;

  const statement =
    parsed.value.document.statement;

  const proof =
    parsed.value.document.proof;

  const expectedChallenge =
    input.expectedChallenge;

  if (
    statement.delegationId !==
    delegation.delegationId
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "delegation_id_mismatch",
      state,
    );
  }

  state.delegationIdMatched = true;

  if (
    statement.credentialHash !==
    buyerResult.credentialHash
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "credential_hash_mismatch",
      state,
    );
  }

  state.credentialHashMatched = true;

  if (
    statement.agentId !==
    delegation.agentId
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_identity_mismatch",
      state,
    );
  }

  state.agentIdentityMatched = true;

  if (
    statement.agentKeyId !==
    delegation.agentKeyId
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_key_id_mismatch",
      state,
    );
  }

  state.agentKeyIdMatched = true;

  if (
    statement.audience !==
    delegation.audience
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_proof_audience_mismatch",
      state,
    );
  }

  state.audienceMatched = true;

  if (
    statement.challenge.nonce !==
    expectedChallenge.nonce
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_challenge_nonce_mismatch",
      state,
    );
  }

  state.challengeNonceMatched = true;

  if (
    statement.challenge.challengeHash !==
    expectedChallenge.challengeHash
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_challenge_hash_mismatch",
      state,
    );
  }

  state.challengeHashMatched = true;

  if (
    statement.challenge.issuedAt !==
    expectedChallenge.issuedAt
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_challenge_issued_at_mismatch",
      state,
    );
  }

  state.challengeIssuedAtMatched = true;

  if (
    statement.challenge.expiresAt !==
    expectedChallenge.expiresAt
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_challenge_expires_at_mismatch",
      state,
    );
  }

  state.challengeExpiresAtMatched = true;

  if (
    proof.verificationMethod !==
    delegation.agentKeyId
  ) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_verification_method_mismatch",
      state,
    );
  }

  state.verificationMethodMatched = true;

  const signatureBytes =
    decodeCanonicalBase64Url(
      proof.signatureValue,
      64,
    );

  if (signatureBytes === null) {
    return buildResult(
      buyerResult,
      delegation,
      "invalid_agent_signature_encoding",
      state,
    );
  }

  let publicKey: ReturnType<
    typeof createPublicKey
  >;

  try {
    publicKey = createPublicKey({
      key:
        toNodeCompatibleJsonWebKey(
          delegation.agentPublicKeyJwk,
        ),
      format: "jwk",
    });
  } catch {
    return buildResult(
      buyerResult,
      delegation,
      "agent_proof_verification_error",
      state,
    );
  }

  let signatureVerified: boolean;

  state.agentCryptographicVerificationAttempted =
    true;

  try {
    signatureVerified =
      verifyEd25519Signature(
        null,
        Buffer.from(
          parsed.value.canonicalStatement,
          "utf8",
        ),
        publicKey,
        signatureBytes,
      );
  } catch {
    return buildResult(
      buyerResult,
      delegation,
      "agent_proof_verification_error",
      state,
    );
  }

  if (!signatureVerified) {
    return buildResult(
      buyerResult,
      delegation,
      "agent_proof_verification_failed",
      state,
    );
  }

  state.agentProofOfPossessionVerified =
    true;

  return buildResult(
    buyerResult,
    delegation,
    "accepted",
    state,
  );
}
