import { createHash } from "node:crypto";

import canonicalize from "canonicalize";

/**
 * Canonical buyer-to-agent delegation credential contract for Phase 5.
 *
 * PR #293 is contract-only:
 * - no signature verification;
 * - no agent proof-of-possession verification;
 * - no Gateway, CRP, payment, persistence, release, registry, or
 *   production activation behavior.
 */

export const BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE =
  "xcf.concordium.delegation.buyer-to-agent.v1" as const;

export const BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION =
  "1.0.0" as const;

export const BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM =
  "Ed25519" as const;

export const BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM =
  "RFC8785" as const;

export const BUYER_TO_AGENT_DELEGATION_HASH_ALGORITHM =
  "SHA-256" as const;

export const BUYER_TO_AGENT_DELEGATION_CONTRACT_MODE =
  "contract_only" as const;

export const BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE =
  "exact" as const;

export const BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION =
  "authorize_payment_and_resource_access" as const;

export const BUYER_TO_AGENT_DELEGATION_DOMAIN =
  BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE;

export const BUYER_TO_AGENT_DELEGATION_STATUS_VALUES = [
  "accepted",
  "rejected",
] as const;

export type BuyerToAgentDelegationStatus =
  (typeof BUYER_TO_AGENT_DELEGATION_STATUS_VALUES)[number];

export const BUYER_TO_AGENT_DELEGATION_REASON_CODES = [
  "accepted",
  "invalid_document_shape",
  "unsupported_credential_type",
  "unsupported_credential_version",
  "unsupported_signature_algorithm",
  "unsupported_canonicalization_algorithm",
  "missing_delegation_id",
  "missing_buyer_identity",
  "missing_buyer_key_identity",
  "missing_agent_identity",
  "missing_agent_key_identity",
  "missing_agent_public_key",
  "invalid_agent_public_key",
  "invalid_scope",
  "invalid_amount_constraint",
  "invalid_validity_window",
  "invalid_usage_semantics",
  "invalid_replay_semantics",
  "invalid_lifecycle_metadata",
  "missing_signature_value",
  "invalid_signature_encoding",
  "verification_method_mismatch",
  "canonicalization_failed",
] as const;

export type BuyerToAgentDelegationReasonCode =
  (typeof BUYER_TO_AGENT_DELEGATION_REASON_CODES)[number];

export interface BuyerToAgentDelegationEd25519PublicKeyJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid?: string;
  use?: "sig";
  alg?: "EdDSA";
}

export interface BuyerToAgentDelegationIssuer {
  buyerId: string;
  buyerKeyId: string;
}

export interface BuyerToAgentDelegationSubject {
  agentId: string;
  agentKeyId: string;
  agentPublicKeyJwk: BuyerToAgentDelegationEd25519PublicKeyJwk;
}

export interface BuyerToAgentDelegationResourceScope {
  method: string;
  path: string;
}

export interface BuyerToAgentDelegationContractScope {
  contractId: string;
  contractVersion: string;
}

export interface BuyerToAgentDelegationAssetScope {
  type: "PLT";
  tokenId: string;
  decimals: number;
}

export interface BuyerToAgentDelegationAmountConstraint {
  mode: typeof BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE;
  value: string;
}

export interface BuyerToAgentDelegationScope {
  merchantId: string;
  resource: BuyerToAgentDelegationResourceScope;
  contract: BuyerToAgentDelegationContractScope;
  network: string;
  asset: BuyerToAgentDelegationAssetScope;
  amount: BuyerToAgentDelegationAmountConstraint;
  payTo: string;
  allowedAction: typeof BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION;
}

export interface BuyerToAgentDelegationValidity {
  issuedAt: number;
  notBefore: number;
  expiresAt: number;
}

export interface BuyerToAgentDelegationUsage {
  maxUses: number;
}

export interface BuyerToAgentDelegationReplay {
  audience: string;
  domain: typeof BUYER_TO_AGENT_DELEGATION_DOMAIN;
  credentialNonce: string;
}

export interface BuyerToAgentDelegationLifecycle {
  revocationId: string;
  buyerKeyVersion: number;
  agentKeyVersion: number;
}

/**
 * The complete set of buyer-signed claims.
 *
 * Only this object is canonicalized and signed. The outer proof object is not
 * included in its own signing input or stable credential hash.
 */
export interface BuyerToAgentDelegationCredential {
  credentialType: typeof BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE;
  credentialVersion: typeof BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION;
  delegationId: string;
  issuer: BuyerToAgentDelegationIssuer;
  subject: BuyerToAgentDelegationSubject;
  scope: BuyerToAgentDelegationScope;
  validity: BuyerToAgentDelegationValidity;
  usage: BuyerToAgentDelegationUsage;
  replay: BuyerToAgentDelegationReplay;
  lifecycle: BuyerToAgentDelegationLifecycle;
}

/**
 * Signature metadata and signature material carried beside the signed claims.
 *
 * PR #293 validates only the metadata shape and base64url representation.
 * Cryptographic verification is deferred to PR #294.
 */
export interface BuyerToAgentDelegationProof {
  signatureAlgorithm:
    typeof BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM;
  canonicalizationAlgorithm:
    typeof BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM;
  verificationMethod: string;
  signatureValue: string;
}

export interface BuyerToAgentDelegationCredentialDocument {
  credential: BuyerToAgentDelegationCredential;
  proof: BuyerToAgentDelegationProof;
}

/**
 * Typed contract-only validation result.
 *
 * Honesty and safety fields remain explicit so later callers cannot confuse
 * metadata validation with cryptographic or runtime authorization.
 */
export interface BuyerToAgentDelegationContractValidationResult {
  ok: boolean;
  status: BuyerToAgentDelegationStatus;
  mode: typeof BUYER_TO_AGENT_DELEGATION_CONTRACT_MODE;
  metadataOnly: true;
  reason: BuyerToAgentDelegationReasonCode;

  credentialType: string | null;
  credentialVersion: string | null;
  delegationId: string | null;

  buyerId: string | null;
  buyerKeyId: string | null;
  agentId: string | null;
  agentKeyId: string | null;
  agentPublicKeyPresent: boolean;

  scopePresent: boolean;
  validityWindowValid: boolean;
  usageValid: boolean;
  replaySemanticsValid: boolean;
  lifecycleMetadataPresent: boolean;

  signatureAlgorithm: string | null;
  canonicalizationAlgorithm: string | null;
  signatureValuePresent: boolean;

  canonicalCredentialPresent: boolean;
  canonicalCredential: string | null;
  credentialHash: string | null;
  credentialHashAlgorithm:
    typeof BUYER_TO_AGENT_DELEGATION_HASH_ALGORITHM;

  signatureVerified: false;
  agentProofOfPossessionVerified: false;

  gatewayCalled: false;
  crpCalled: false;
  paymentAttempted: false;
  receiptJwsPrinted: false;
  paymentResponsePrinted: false;
  protectedResourceReleased: false;
  agentRegistryLookupAttempted: false;
  productionActivation: false;
}



/**
 * Produces the exact RFC 8785/JCS UTF-8 signing representation of the
 * buyer-signed credential claims.
 *
 * The outer proof object is deliberately excluded.
 */
export function canonicalizeBuyerToAgentDelegationCredential(
  credential: BuyerToAgentDelegationCredential,
): string {
  const canonical = canonicalize(credential);

  if (typeof canonical !== "string") {
    throw new Error("canonicalization_failed");
  }

  return canonical;
}

/**
 * Produces the stable lowercase SHA-256 hex digest used to bind the
 * delegation credential to later agent proof-of-possession.
 */
export function hashBuyerToAgentDelegationCredential(
  credential: BuyerToAgentDelegationCredential,
): string {
  const canonical =
    canonicalizeBuyerToAgentDelegationCredential(credential);

  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}

type UnknownRecord = Record<string, unknown>;

const BUYER_TO_AGENT_DELEGATION_DOCUMENT_KEYS = [
  "credential",
  "proof",
] as const;

const BUYER_TO_AGENT_DELEGATION_CREDENTIAL_KEYS = [
  "credentialType",
  "credentialVersion",
  "delegationId",
  "issuer",
  "subject",
  "scope",
  "validity",
  "usage",
  "replay",
  "lifecycle",
] as const;

const BUYER_TO_AGENT_DELEGATION_ISSUER_KEYS = [
  "buyerId",
  "buyerKeyId",
] as const;

const BUYER_TO_AGENT_DELEGATION_SUBJECT_KEYS = [
  "agentId",
  "agentKeyId",
  "agentPublicKeyJwk",
] as const;

const BUYER_TO_AGENT_DELEGATION_JWK_KEYS = [
  "kty",
  "crv",
  "x",
  "kid",
  "use",
  "alg",
] as const;

const BUYER_TO_AGENT_DELEGATION_SCOPE_KEYS = [
  "merchantId",
  "resource",
  "contract",
  "network",
  "asset",
  "amount",
  "payTo",
  "allowedAction",
] as const;

const BUYER_TO_AGENT_DELEGATION_RESOURCE_KEYS = [
  "method",
  "path",
] as const;

const BUYER_TO_AGENT_DELEGATION_CONTRACT_KEYS = [
  "contractId",
  "contractVersion",
] as const;

const BUYER_TO_AGENT_DELEGATION_ASSET_KEYS = [
  "type",
  "tokenId",
  "decimals",
] as const;

const BUYER_TO_AGENT_DELEGATION_AMOUNT_KEYS = [
  "mode",
  "value",
] as const;

const BUYER_TO_AGENT_DELEGATION_VALIDITY_KEYS = [
  "issuedAt",
  "notBefore",
  "expiresAt",
] as const;

const BUYER_TO_AGENT_DELEGATION_USAGE_KEYS = [
  "maxUses",
] as const;

const BUYER_TO_AGENT_DELEGATION_REPLAY_KEYS = [
  "audience",
  "domain",
  "credentialNonce",
] as const;

const BUYER_TO_AGENT_DELEGATION_LIFECYCLE_KEYS = [
  "revocationId",
  "buyerKeyVersion",
  "agentKeyVersion",
] as const;

const BUYER_TO_AGENT_DELEGATION_PROOF_KEYS = [
  "signatureAlgorithm",
  "canonicalizationAlgorithm",
  "verificationMethod",
  "signatureValue",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasOnlyKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isBoundedString(
  value: unknown,
  maximumLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value === value.trim()
  );
}

function isCompactIdentifier(
  value: unknown,
  maximumLength = 512,
): value is string {
  return (
    isBoundedString(value, maximumLength) &&
    !/\s/.test(value)
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isCanonicalBase64Url(
  value: unknown,
  expectedByteLength: number,
): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return false;
  }

  try {
    const decoded = Buffer.from(value, "base64url");

    return (
      decoded.length === expectedByteLength &&
      decoded.toString("base64url") === value
    );
  } catch {
    return false;
  }
}

function isValidExactAmount(
  value: unknown,
  decimals: number,
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const pattern =
    decimals === 0
      ? /^(0|[1-9]\d*)$/
      : new RegExp(`^(0|[1-9]\\d*)\\.\\d{${decimals}}$`);

  if (!pattern.test(value)) {
    return false;
  }

  const minorUnits = BigInt(value.replace(".", ""));
  return minorUnits > 0n;
}

function getCredentialRecords(input: unknown): {
  root: UnknownRecord | null;
  credential: UnknownRecord | null;
  issuer: UnknownRecord | null;
  subject: UnknownRecord | null;
  publicKey: UnknownRecord | null;
  scope: UnknownRecord | null;
  validity: UnknownRecord | null;
  usage: UnknownRecord | null;
  replay: UnknownRecord | null;
  lifecycle: UnknownRecord | null;
  proof: UnknownRecord | null;
} {
  const root = asRecord(input);
  const credential = asRecord(root?.credential);
  const issuer = asRecord(credential?.issuer);
  const subject = asRecord(credential?.subject);
  const publicKey = asRecord(subject?.agentPublicKeyJwk);
  const scope = asRecord(credential?.scope);
  const validity = asRecord(credential?.validity);
  const usage = asRecord(credential?.usage);
  const replay = asRecord(credential?.replay);
  const lifecycle = asRecord(credential?.lifecycle);
  const proof = asRecord(root?.proof);

  return {
    root,
    credential,
    issuer,
    subject,
    publicKey,
    scope,
    validity,
    usage,
    replay,
    lifecycle,
    proof,
  };
}

function buildContractValidationResult(
  input: unknown,
  reason: BuyerToAgentDelegationReasonCode,
  overrides: Partial<
    BuyerToAgentDelegationContractValidationResult
  > = {},
): BuyerToAgentDelegationContractValidationResult {
  const {
    credential,
    issuer,
    subject,
    publicKey,
    scope,
    validity,
    usage,
    replay,
    lifecycle,
    proof,
  } = getCredentialRecords(input);

  const accepted = reason === "accepted";

  const result: BuyerToAgentDelegationContractValidationResult = {
    ok: accepted,
    status: accepted ? "accepted" : "rejected",
    mode: BUYER_TO_AGENT_DELEGATION_CONTRACT_MODE,
    metadataOnly: true,
    reason,

    credentialType:
      asString(credential?.credentialType),
    credentialVersion:
      asString(credential?.credentialVersion),
    delegationId:
      asString(credential?.delegationId),

    buyerId:
      asString(issuer?.buyerId),
    buyerKeyId:
      asString(issuer?.buyerKeyId),
    agentId:
      asString(subject?.agentId),
    agentKeyId:
      asString(subject?.agentKeyId),
    agentPublicKeyPresent: publicKey !== null,

    scopePresent: scope !== null,
    validityWindowValid: false,
    usageValid: false,
    replaySemanticsValid: false,
    lifecycleMetadataPresent: lifecycle !== null,

    signatureAlgorithm:
      asString(proof?.signatureAlgorithm),
    canonicalizationAlgorithm:
      asString(proof?.canonicalizationAlgorithm),
    signatureValuePresent:
      isBoundedString(proof?.signatureValue, 1024),

    canonicalCredentialPresent: false,
    canonicalCredential: null,
    credentialHash: null,
    credentialHashAlgorithm:
      BUYER_TO_AGENT_DELEGATION_HASH_ALGORITHM,

    signatureVerified: false,
    agentProofOfPossessionVerified: false,

    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    agentRegistryLookupAttempted: false,
    productionActivation: false,

    ...overrides,
  };

  return result;
}

function rejectCredential(
  input: unknown,
  reason: BuyerToAgentDelegationReasonCode,
  overrides: Partial<
    BuyerToAgentDelegationContractValidationResult
  > = {},
): BuyerToAgentDelegationContractValidationResult {
  return buildContractValidationResult(input, reason, overrides);
}

/**
 * Strict contract-only validation.
 *
 * This validates metadata, deterministic field semantics, and encoded key and
 * signature lengths. It does not cryptographically verify the buyer signature
 * or an agent proof-of-possession.
 */
export function validateBuyerToAgentDelegationCredentialContract(
  input: unknown,
): BuyerToAgentDelegationContractValidationResult {
  const {
    root,
    credential,
    issuer,
    subject,
    publicKey,
    scope,
    validity,
    usage,
    replay,
    lifecycle,
    proof,
  } = getCredentialRecords(input);

  if (
    root === null ||
    !hasOnlyKeys(
      root,
      BUYER_TO_AGENT_DELEGATION_DOCUMENT_KEYS,
    ) ||
    credential === null ||
    proof === null ||
    !hasOnlyKeys(
      credential,
      BUYER_TO_AGENT_DELEGATION_CREDENTIAL_KEYS,
    ) ||
    !hasOnlyKeys(
      proof,
      BUYER_TO_AGENT_DELEGATION_PROOF_KEYS,
    )
  ) {
    return rejectCredential(input, "invalid_document_shape");
  }

  if (
    credential.credentialType !==
    BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE
  ) {
    return rejectCredential(
      input,
      "unsupported_credential_type",
    );
  }

  if (
    credential.credentialVersion !==
    BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION
  ) {
    return rejectCredential(
      input,
      "unsupported_credential_version",
    );
  }

  if (!isCompactIdentifier(credential.delegationId)) {
    return rejectCredential(input, "missing_delegation_id");
  }

  if (
    issuer === null ||
    !hasOnlyKeys(
      issuer,
      BUYER_TO_AGENT_DELEGATION_ISSUER_KEYS,
    )
  ) {
    return rejectCredential(input, "invalid_document_shape");
  }

  if (!isCompactIdentifier(issuer.buyerId)) {
    return rejectCredential(input, "missing_buyer_identity");
  }

  if (!isCompactIdentifier(issuer.buyerKeyId)) {
    return rejectCredential(
      input,
      "missing_buyer_key_identity",
    );
  }

  if (
    subject === null ||
    !hasOnlyKeys(
      subject,
      BUYER_TO_AGENT_DELEGATION_SUBJECT_KEYS,
    )
  ) {
    return rejectCredential(input, "invalid_document_shape");
  }

  if (!isCompactIdentifier(subject.agentId)) {
    return rejectCredential(input, "missing_agent_identity");
  }

  if (!isCompactIdentifier(subject.agentKeyId)) {
    return rejectCredential(
      input,
      "missing_agent_key_identity",
    );
  }

  if (publicKey === null) {
    return rejectCredential(input, "missing_agent_public_key");
  }

  if (
    !hasOnlyKeys(
      publicKey,
      BUYER_TO_AGENT_DELEGATION_JWK_KEYS,
    ) ||
    publicKey.kty !== "OKP" ||
    publicKey.crv !== "Ed25519" ||
    !isCanonicalBase64Url(publicKey.x, 32) ||
    (
      hasOwn(publicKey, "kid") &&
      (
        !isCompactIdentifier(publicKey.kid) ||
        publicKey.kid !== subject.agentKeyId
      )
    ) ||
    (
      hasOwn(publicKey, "use") &&
      publicKey.use !== "sig"
    ) ||
    (
      hasOwn(publicKey, "alg") &&
      publicKey.alg !== "EdDSA"
    )
  ) {
    return rejectCredential(input, "invalid_agent_public_key");
  }

  if (
    scope === null ||
    !hasOnlyKeys(
      scope,
      BUYER_TO_AGENT_DELEGATION_SCOPE_KEYS,
    )
  ) {
    return rejectCredential(input, "invalid_scope");
  }

  const resource = asRecord(scope.resource);
  const contract = asRecord(scope.contract);
  const asset = asRecord(scope.asset);
  const amount = asRecord(scope.amount);

  if (
    resource === null ||
    contract === null ||
    asset === null ||
    amount === null ||
    !hasOnlyKeys(
      resource,
      BUYER_TO_AGENT_DELEGATION_RESOURCE_KEYS,
    ) ||
    !hasOnlyKeys(
      contract,
      BUYER_TO_AGENT_DELEGATION_CONTRACT_KEYS,
    ) ||
    !hasOnlyKeys(
      asset,
      BUYER_TO_AGENT_DELEGATION_ASSET_KEYS,
    ) ||
    !hasOnlyKeys(
      amount,
      BUYER_TO_AGENT_DELEGATION_AMOUNT_KEYS,
    )
  ) {
    return rejectCredential(input, "invalid_scope");
  }

  if (
    !isBoundedString(scope.merchantId, 256) ||
    !isBoundedString(resource.method, 32) ||
    !/^[A-Z][A-Z0-9_-]*$/.test(resource.method) ||
    !isBoundedString(resource.path, 2048) ||
    !resource.path.startsWith("/") ||
    /\s/.test(resource.path) ||
    !isCompactIdentifier(contract.contractId, 256) ||
    !contract.contractId.startsWith("cid_") ||
    !isCompactIdentifier(contract.contractVersion, 64) ||
    !isCompactIdentifier(scope.network, 256) ||
    asset.type !== "PLT" ||
    !isCompactIdentifier(asset.tokenId, 128) ||
    !isNonNegativeSafeInteger(asset.decimals) ||
    asset.decimals > 255 ||
    !isCompactIdentifier(scope.payTo, 256) ||
    scope.allowedAction !==
      BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION
  ) {
    return rejectCredential(input, "invalid_scope");
  }

  if (
    amount.mode !==
      BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE ||
    !isValidExactAmount(amount.value, asset.decimals)
  ) {
    return rejectCredential(
      input,
      "invalid_amount_constraint",
    );
  }

  if (
    validity === null ||
    !hasOnlyKeys(
      validity,
      BUYER_TO_AGENT_DELEGATION_VALIDITY_KEYS,
    ) ||
    !isPositiveSafeInteger(validity.issuedAt) ||
    !isPositiveSafeInteger(validity.notBefore) ||
    !isPositiveSafeInteger(validity.expiresAt) ||
    validity.issuedAt > validity.notBefore ||
    validity.notBefore >= validity.expiresAt
  ) {
    return rejectCredential(
      input,
      "invalid_validity_window",
    );
  }

  if (
    usage === null ||
    !hasOnlyKeys(
      usage,
      BUYER_TO_AGENT_DELEGATION_USAGE_KEYS,
    ) ||
    !isPositiveSafeInteger(usage.maxUses)
  ) {
    return rejectCredential(
      input,
      "invalid_usage_semantics",
      {
        validityWindowValid: true,
      },
    );
  }

  if (
    replay === null ||
    !hasOnlyKeys(
      replay,
      BUYER_TO_AGENT_DELEGATION_REPLAY_KEYS,
    ) ||
    !isCompactIdentifier(replay.audience, 512) ||
    replay.domain !== BUYER_TO_AGENT_DELEGATION_DOMAIN ||
    !isCompactIdentifier(replay.credentialNonce, 512)
  ) {
    return rejectCredential(
      input,
      "invalid_replay_semantics",
      {
        validityWindowValid: true,
        usageValid: true,
      },
    );
  }

  if (
    lifecycle === null ||
    !hasOnlyKeys(
      lifecycle,
      BUYER_TO_AGENT_DELEGATION_LIFECYCLE_KEYS,
    ) ||
    !isCompactIdentifier(lifecycle.revocationId, 512) ||
    !isPositiveSafeInteger(lifecycle.buyerKeyVersion) ||
    !isPositiveSafeInteger(lifecycle.agentKeyVersion)
  ) {
    return rejectCredential(
      input,
      "invalid_lifecycle_metadata",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
      },
    );
  }

  if (
    proof.signatureAlgorithm !==
    BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM
  ) {
    return rejectCredential(
      input,
      "unsupported_signature_algorithm",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
      },
    );
  }

  if (
    proof.canonicalizationAlgorithm !==
    BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM
  ) {
    return rejectCredential(
      input,
      "unsupported_canonicalization_algorithm",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
      },
    );
  }

  if (!isBoundedString(proof.signatureValue, 1024)) {
    return rejectCredential(
      input,
      "missing_signature_value",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
      },
    );
  }

  if (!isCanonicalBase64Url(proof.signatureValue, 64)) {
    return rejectCredential(
      input,
      "invalid_signature_encoding",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
      },
    );
  }

  if (
    !isCompactIdentifier(proof.verificationMethod) ||
    proof.verificationMethod !== issuer.buyerKeyId
  ) {
    return rejectCredential(
      input,
      "verification_method_mismatch",
      {
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
      },
    );
  }

  let canonicalCredential: string;
  let credentialHash: string;

  try {
    const typedCredential =
      credential as unknown as BuyerToAgentDelegationCredential;

    canonicalCredential =
      canonicalizeBuyerToAgentDelegationCredential(
        typedCredential,
      );

    credentialHash = createHash("sha256")
      .update(canonicalCredential, "utf8")
      .digest("hex");
  } catch {
    return rejectCredential(
      input,
      "canonicalization_failed",
      {
        agentPublicKeyPresent: true,
        scopePresent: true,
        validityWindowValid: true,
        usageValid: true,
        replaySemanticsValid: true,
        lifecycleMetadataPresent: true,
        signatureValuePresent: true,
      },
    );
  }

  return buildContractValidationResult(input, "accepted", {
    agentPublicKeyPresent: true,
    scopePresent: true,
    validityWindowValid: true,
    usageValid: true,
    replaySemanticsValid: true,
    lifecycleMetadataPresent: true,
    signatureValuePresent: true,
    canonicalCredentialPresent: true,
    canonicalCredential,
    credentialHash,
  });
}
