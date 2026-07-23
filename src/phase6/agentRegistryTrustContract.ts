/**
 * Phase 6 Agent Registry trust contracts and architecture invariants.
 *
 * PR #298 is contract-only and test-only:
 * - no Agent Registry resolver;
 * - no Concordium, MCP, Indexer, node, or hosted-service call;
 * - no Agent Card retrieval;
 * - no Gateway runtime composition;
 * - no database or canonical-state mutation;
 * - no UFX or CRP call;
 * - no payment, receipt, PAYMENT-RESPONSE, resource release, or
 *   production activation.
 */

export const AGENT_REGISTRY_REQUIREMENT_TYPE =
  "xcf.agent-registry.requirement" as const;

export const AGENT_REGISTRY_REFERENCE_TYPE =
  "xcf.agent-registry.reference" as const;

export const AGENT_REGISTRY_TRUST_RESULT_TYPE =
  "xcf.agent-registry.trust-result" as const;

export const AGENT_REGISTRY_CONTRACT_VERSION =
  "1.0.0" as const;

export const AGENT_REGISTRY_STANDARD =
  "CIS-8004" as const;

export const AGENT_REGISTRY_CONTRACT_MODE =
  "contract_only" as const;

export const AGENT_REGISTRY_REQUIRED_STATUS =
  "Active" as const;

export const AGENT_REGISTRY_EXTERNAL_KEY_POLICIES = [
  "optional",
  "required",
  "forbidden",
] as const;

export type AgentRegistryExternalKeyPolicyV1 =
  (typeof AGENT_REGISTRY_EXTERNAL_KEY_POLICIES)[number];

export const AGENT_REGISTRY_STATE_STATUS_VALUES = [
  "Active",
  "Revoked",
  "Missing",
  "Unknown",
] as const;

export type AgentRegistryStateStatusV1 =
  (typeof AGENT_REGISTRY_STATE_STATUS_VALUES)[number];

export const AGENT_REGISTRY_OWNER_IDENTITY_ASSURANCE_VALUES = [
  "not_evaluated",
  "verified",
] as const;

export type AgentRegistryOwnerIdentityAssuranceV1 =
  (typeof AGENT_REGISTRY_OWNER_IDENTITY_ASSURANCE_VALUES)[number];

export const AGENT_REGISTRY_KEY_BINDING_TYPES = [
  "native",
  "CIS-8",
] as const;

export type AgentRegistryKeyBindingTypeV1 =
  (typeof AGENT_REGISTRY_KEY_BINDING_TYPES)[number];

export const AGENT_REGISTRY_FRESHNESS_SOURCES = [
  "fixture",
  "direct_chain",
  "auditable_resolver",
] as const;

export type AgentRegistryFreshnessSourceV1 =
  (typeof AGENT_REGISTRY_FRESHNESS_SOURCES)[number];

export const AGENT_REGISTRY_TRUST_REASON_CODES = [
  "agent_registry_verified",
  "missing_registry_reference",
  "invalid_registry_reference",
  "unsupported_registry_standard",
  "untrusted_registry_contract",
  "agent_not_registered",
  "agent_registry_revoked",
  "agent_registry_status_invalid",
  "agent_registry_contract_mismatch",
  "agent_registry_identity_mismatch",
  "agent_registry_owner_mismatch",
  "agent_registry_key_mismatch",
  "agent_card_missing",
  "agent_card_fetch_failed",
  "agent_card_hash_mismatch",
  "agent_capability_missing",
  "agent_capability_scope_mismatch",
  "agent_registry_evidence_stale",
  "agent_registry_resolver_unavailable",
  "agent_registry_result_invalid",
] as const;

export type AgentRegistryTrustReasonV1 =
  (typeof AGENT_REGISTRY_TRUST_REASON_CODES)[number];

export const AGENT_REGISTRY_CONTRACT_VALIDATION_REASONS = [
  "valid",
  "invalid_object_shape",
  "unsupported_type",
  "unsupported_version",
  "unsupported_registry_standard",
  "invalid_registry_requirement",
  "invalid_registry_reference",
  "invalid_registry_trust_result",
  "incoherent_registry_trust_result",
] as const;

export type AgentRegistryContractValidationReasonV1 =
  (typeof AGENT_REGISTRY_CONTRACT_VALIDATION_REASONS)[number];

export type AgentRegistryContractCoordinateV1 = {
  readonly index: string;
  readonly subindex: number;
};

export type AgentRegistryTrustedRegistryV1 = {
  readonly network: string;
  readonly contract: AgentRegistryContractCoordinateV1;
  readonly moduleReference?: string;
};

/**
 * Gateway-authored registry policy requirement.
 *
 * Agent Registry data and Agent Card declarations do not author this policy.
 * The Gateway remains the policy and final release authority.
 */
export type AgentRegistryRequirementV1 = {
  readonly type:
    typeof AGENT_REGISTRY_REQUIREMENT_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly required: boolean;

  readonly registryStandard:
    typeof AGENT_REGISTRY_STANDARD;

  readonly trustedRegistries:
    readonly AgentRegistryTrustedRegistryV1[];

  readonly requiredStatus:
    typeof AGENT_REGISTRY_REQUIRED_STATUS;

  readonly requireAgentCardIntegrity: boolean;

  readonly requiredCapabilities:
    readonly string[];

  readonly requireOwnerAccountBinding: boolean;

  readonly requireVerifiedOwnerIdentity: boolean;

  readonly externalKeyPolicy:
    AgentRegistryExternalKeyPolicyV1;

  readonly maxEvidenceAgeSeconds: number;

  readonly maxIndexerLagBlocks?: number;

  readonly revalidateBeforeReleaseIfOlderThanSeconds:
    number;
};

/**
 * Claimed canonical registry identity.
 *
 * Canonical identity is:
 * network + registry contract + AgentTokenId + token address.
 *
 * DID, Base58, and resolver values are aliases or transport hints only.
 */
export type AgentRegistryReferenceV1 = {
  readonly type:
    typeof AGENT_REGISTRY_REFERENCE_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly registryStandard:
    typeof AGENT_REGISTRY_STANDARD;

  readonly network: string;

  readonly registryContract:
    AgentRegistryContractCoordinateV1;

  readonly agentTokenId: string;

  readonly tokenAddress: string;

  readonly tokenAddressBase58?: string;

  readonly didAlias?: string;

  readonly resolverHint?: string;
};

/**
 * Normalized and sanitized Agent Registry facts.
 *
 * This object is an authorization input. It is never a settlement receipt,
 * Gateway state mutation, or resource-release instruction.
 */
export type AgentRegistryTrustResultV1 = {
  readonly type:
    typeof AGENT_REGISTRY_TRUST_RESULT_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly verified: boolean;

  readonly reason:
    AgentRegistryTrustReasonV1;

  readonly registryStandard:
    typeof AGENT_REGISTRY_STANDARD;

  readonly identity: {
    readonly network: string;

    readonly registryContract:
      AgentRegistryContractCoordinateV1;

    readonly moduleReference: string | null;

    readonly agentTokenId: string;

    readonly tokenAddress: string;
  };

  readonly state: {
    readonly status:
      AgentRegistryStateStatusV1;

    readonly ownerAccount: string | null;

    readonly ownerAccountBound: boolean;

    readonly ownerIdentityAssurance:
      AgentRegistryOwnerIdentityAssuranceV1;

    readonly agentWallet: string | null;
  };

  readonly agentCard: {
    readonly uri: string | null;

    readonly hash: string | null;

    readonly integrityVerified: boolean;
  };

  readonly keyBinding: {
    readonly required: boolean;

    readonly verified: boolean;

    readonly bindingType:
      AgentRegistryKeyBindingTypeV1 | null;

    readonly keyFingerprint: string | null;
  };

  readonly capabilities: {
    readonly required:
      readonly string[];

    readonly satisfied:
      readonly string[];

    readonly missing:
      readonly string[];

    readonly policySatisfied: boolean;
  };

  readonly freshness: {
    readonly source:
      AgentRegistryFreshnessSourceV1;

    readonly finalizedBlockHeight:
      number | null;

    readonly finalizedBlockHash:
      string | null;

    readonly observedAt:
      string | null;

    readonly evidenceAgeSeconds:
      number | null;

    readonly indexerLagBlocks:
      number | null;

    readonly fresh: boolean;
  };

  readonly evidenceHash: string | null;
};

export type AgentRegistryContractKindV1 =
  | "requirement"
  | "reference"
  | "trust_result";

/**
 * Pure contract-validation result.
 *
 * Safety fields are literal false values so structural contract acceptance
 * cannot be confused with live registry verification or runtime release.
 */
export type AgentRegistryContractValidationResult<T> = {
  readonly ok: boolean;

  readonly status:
    | "accepted"
    | "rejected";

  readonly mode:
    typeof AGENT_REGISTRY_CONTRACT_MODE;

  readonly contractKind:
    AgentRegistryContractKindV1;

  readonly validationReason:
    AgentRegistryContractValidationReasonV1;

  readonly value: T | null;

  readonly gatewayCalled: false;
  readonly registryNetworkCalled: false;
  readonly ufxCalled: false;
  readonly crpCalled: false;

  readonly paymentAttempted: false;
  readonly receiptIssued: false;
  readonly paymentResponseEmitted: false;
  readonly resourceReleased: false;

  readonly stateMutated: false;
  readonly agentRegistryLookupAttempted: false;
  readonly productionActivation: false;
};

/**
 * Machine-assertable ownership and safety freeze for the full middleware
 * bundle. Detailed rationale belongs in the accompanying repository document.
 */
export const PHASE6_AGENT_REGISTRY_ARCHITECTURE_INVARIANTS =
  Object.freeze({
    gateway: Object.freeze({
      ownsPaymentRequiredConstruction: true,
      ownsConditionalGating: true,
      ownsAuthorizationState: true,
      ownsReplayEnforcement: true,
      ownsReceiptVerification: true,
      ownsFinalResourceRelease: true,
      ownsRegistryChainMechanics: false,
      ownsSettlementRailMechanics: false,
    }),

    registryPlugin: Object.freeze({
      providesAuthenticatedTrustFacts: true,
      ownsGatewayAuthorizationPolicy: false,
      ownsBoundedUseMutation: false,
      ownsPaymentSettlement: false,
      ownsResourceRelease: false,
    }),

    ufx: Object.freeze({
      ownsPaymentIntents: true,
      ownsIdempotencyAndExpiry: true,
      ownsRailSelection: true,
      ownsSettlementNormalization: true,
      ownsSignedSettlementResults: true,
      ownsBuyerPolicy: false,
      ownsAgentDelegationPolicy: false,
      ownsFinalResourceRelease: false,
    }),

    settlementRail: Object.freeze({
      ownsChainSpecificSettlementMechanics: true,
      ownsConditionalGating: false,
      ownsRegistryPolicy: false,
      ownsFinalResourceRelease: false,
    }),

    orchestrator: Object.freeze({
      requiredForPhase6: false,
      mayBeUsedOnlyBySeparateApproval: true,
    }),

    runtime: Object.freeze({
      liveRegistryLookup: false,
      gatewayRuntimeChanged: false,
      ufxCalled: false,
      crpCalled: false,
      paymentAttempted: false,
      receiptIssued: false,
      resourceReleased: false,
      productionActivation: false,
    }),
  });

type UnknownRecord =
  Record<string, unknown>;

const REQUIREMENT_KEYS = [
  "type",
  "version",
  "required",
  "registryStandard",
  "trustedRegistries",
  "requiredStatus",
  "requireAgentCardIntegrity",
  "requiredCapabilities",
  "requireOwnerAccountBinding",
  "requireVerifiedOwnerIdentity",
  "externalKeyPolicy",
  "maxEvidenceAgeSeconds",
  "maxIndexerLagBlocks",
  "revalidateBeforeReleaseIfOlderThanSeconds",
] as const;

const TRUSTED_REGISTRY_KEYS = [
  "network",
  "contract",
  "moduleReference",
] as const;

const CONTRACT_COORDINATE_KEYS = [
  "index",
  "subindex",
] as const;

const REFERENCE_KEYS = [
  "type",
  "version",
  "registryStandard",
  "network",
  "registryContract",
  "agentTokenId",
  "tokenAddress",
  "tokenAddressBase58",
  "didAlias",
  "resolverHint",
] as const;

const TRUST_RESULT_KEYS = [
  "type",
  "version",
  "verified",
  "reason",
  "registryStandard",
  "identity",
  "state",
  "agentCard",
  "keyBinding",
  "capabilities",
  "freshness",
  "evidenceHash",
] as const;

const TRUST_RESULT_IDENTITY_KEYS = [
  "network",
  "registryContract",
  "moduleReference",
  "agentTokenId",
  "tokenAddress",
] as const;

const TRUST_RESULT_STATE_KEYS = [
  "status",
  "ownerAccount",
  "ownerAccountBound",
  "ownerIdentityAssurance",
  "agentWallet",
] as const;

const TRUST_RESULT_AGENT_CARD_KEYS = [
  "uri",
  "hash",
  "integrityVerified",
] as const;

const TRUST_RESULT_KEY_BINDING_KEYS = [
  "required",
  "verified",
  "bindingType",
  "keyFingerprint",
] as const;

const TRUST_RESULT_CAPABILITY_KEYS = [
  "required",
  "satisfied",
  "missing",
  "policySatisfied",
] as const;

const TRUST_RESULT_FRESHNESS_KEYS = [
  "source",
  "finalizedBlockHeight",
  "finalizedBlockHash",
  "observedAt",
  "evidenceAgeSeconds",
  "indexerLagBlocks",
  "fresh",
] as const;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asRecord(
  value: unknown,
): UnknownRecord | null {
  return isRecord(value)
    ? value
    : null;
}

function hasOwn(
  value: UnknownRecord,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}

function hasOnlyKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
): boolean {
  const allowed =
    new Set(allowedKeys);

  return Object.keys(value)
    .every(
      (key) =>
        allowed.has(key),
    );
}

function isAllowedString(
  value: unknown,
  allowedValues: readonly string[],
): boolean {
  return (
    typeof value === "string" &&
    allowedValues.includes(value)
  );
}

function isBoundedTrimmedString(
  value: unknown,
  maximumLength = 2048,
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
  maximumLength = 1024,
): value is string {
  return (
    isBoundedTrimmedString(
      value,
      maximumLength,
    ) &&
    !/\s/.test(value)
  );
}

function isCanonicalNonNegativeDecimal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d*)$/.test(value)
  );
}

function isNonNegativeSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isLowerHex64(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{64}$/.test(value)
  );
}

function isNullableLowerHex64(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    isLowerHex64(value)
  );
}

function isNullableCompactIdentifier(
  value: unknown,
  maximumLength = 2048,
): value is string | null {
  return (
    value === null ||
    isCompactIdentifier(
      value,
      maximumLength,
    )
  );
}

function isNullableNonNegativeSafeInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    isNonNegativeSafeInteger(value)
  );
}

function isIsoTimestamp(
  value: unknown,
): value is string {
  return (
    isBoundedTrimmedString(value, 128) &&
    Number.isFinite(
      Date.parse(value),
    )
  );
}

function isNullableIsoTimestamp(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    isIsoTimestamp(value)
  );
}

/**
 * PR #298 performs only a conservative CAIP-19-shaped check.
 *
 * Full CAIP-2/CAIP-19 parsing and network-specific semantic validation are
 * deliberately deferred until authoritative libraries and trusted registry
 * configuration are introduced by later Phase 6 rungs.
 */
function isTokenAddressShape(
  value: unknown,
): value is string {
  if (
    !isCompactIdentifier(
      value,
      2048,
    )
  ) {
    return false;
  }

  const slashIndex =
    value.indexOf("/");

  const assetColonIndex =
    value.indexOf(
      ":",
      slashIndex + 1,
    );

  return (
    slashIndex > 0 &&
    assetColonIndex >
      slashIndex + 1 &&
    assetColonIndex <
      value.length - 1
  );
}

function isUniqueCompactStringArray(
  value: unknown,
): value is readonly string[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const seen =
    new Set<string>();

  for (const item of value) {
    if (
      !isCompactIdentifier(
        item,
        512,
      ) ||
      seen.has(item)
    ) {
      return false;
    }

    seen.add(item);
  }

  return true;
}

function isValidContractCoordinate(
  value: unknown,
): value is AgentRegistryContractCoordinateV1 {
  const record =
    asRecord(value);

  return (
    record !== null &&
    hasOnlyKeys(
      record,
      CONTRACT_COORDINATE_KEYS,
    ) &&
    isCanonicalNonNegativeDecimal(
      record.index,
    ) &&
    isNonNegativeSafeInteger(
      record.subindex,
    )
  );
}

function buildValidationResult<T>(
  contractKind:
    AgentRegistryContractKindV1,
  validationReason:
    AgentRegistryContractValidationReasonV1,
  value: T | null,
): AgentRegistryContractValidationResult<T> {
  const accepted =
    validationReason ===
    "valid";

  return {
    ok: accepted,

    status:
      accepted
        ? "accepted"
        : "rejected",

    mode:
      AGENT_REGISTRY_CONTRACT_MODE,

    contractKind,

    validationReason,

    value:
      accepted
        ? value
        : null,

    gatewayCalled: false,
    registryNetworkCalled: false,
    ufxCalled: false,
    crpCalled: false,

    paymentAttempted: false,
    receiptIssued: false,
    paymentResponseEmitted: false,
    resourceReleased: false,

    stateMutated: false,
    agentRegistryLookupAttempted: false,
    productionActivation: false,
  };
}

function rejectRequirement(
  validationReason:
    AgentRegistryContractValidationReasonV1,
): AgentRegistryContractValidationResult<
  AgentRegistryRequirementV1
> {
  return buildValidationResult(
    "requirement",
    validationReason,
    null,
  );
}

function rejectReference(
  validationReason:
    AgentRegistryContractValidationReasonV1,
): AgentRegistryContractValidationResult<
  AgentRegistryReferenceV1
> {
  return buildValidationResult(
    "reference",
    validationReason,
    null,
  );
}

function rejectTrustResult(
  validationReason:
    AgentRegistryContractValidationReasonV1,
): AgentRegistryContractValidationResult<
  AgentRegistryTrustResultV1
> {
  return buildValidationResult(
    "trust_result",
    validationReason,
    null,
  );
}

function validateTrustedRegistryEntry(
  value: unknown,
): value is AgentRegistryTrustedRegistryV1 {
  const record =
    asRecord(value);

  if (
    record === null ||
    !hasOnlyKeys(
      record,
      TRUSTED_REGISTRY_KEYS,
    ) ||
    !isCompactIdentifier(
      record.network,
    ) ||
    !isValidContractCoordinate(
      record.contract,
    )
  ) {
    return false;
  }

  return (
    !hasOwn(
      record,
      "moduleReference",
    ) ||
    isLowerHex64(
      record.moduleReference,
    )
  );
}

/**
 * Strict, pure Agent Registry requirement validation.
 */
export function validateAgentRegistryRequirementV1(
  value: unknown,
): AgentRegistryContractValidationResult<
  AgentRegistryRequirementV1
> {
  const root =
    asRecord(value);

  if (
    root === null ||
    !hasOnlyKeys(
      root,
      REQUIREMENT_KEYS,
    )
  ) {
    return rejectRequirement(
      "invalid_object_shape",
    );
  }

  if (
    root.type !==
    AGENT_REGISTRY_REQUIREMENT_TYPE
  ) {
    return rejectRequirement(
      "unsupported_type",
    );
  }

  if (
    root.version !==
    AGENT_REGISTRY_CONTRACT_VERSION
  ) {
    return rejectRequirement(
      "unsupported_version",
    );
  }

  if (
    root.registryStandard !==
    AGENT_REGISTRY_STANDARD
  ) {
    return rejectRequirement(
      "unsupported_registry_standard",
    );
  }

  if (
    typeof root.required !==
      "boolean" ||
    !Array.isArray(
      root.trustedRegistries,
    ) ||
    root.requiredStatus !==
      AGENT_REGISTRY_REQUIRED_STATUS ||
    typeof root.requireAgentCardIntegrity !==
      "boolean" ||
    !isUniqueCompactStringArray(
      root.requiredCapabilities,
    ) ||
    typeof root.requireOwnerAccountBinding !==
      "boolean" ||
    typeof root.requireVerifiedOwnerIdentity !==
      "boolean" ||
    !isAllowedString(
      root.externalKeyPolicy,
      AGENT_REGISTRY_EXTERNAL_KEY_POLICIES,
    ) ||
    !isPositiveSafeInteger(
      root.maxEvidenceAgeSeconds,
    ) ||
    !isPositiveSafeInteger(
      root
        .revalidateBeforeReleaseIfOlderThanSeconds,
    )
  ) {
    return rejectRequirement(
      "invalid_registry_requirement",
    );
  }

  if (
    hasOwn(
      root,
      "maxIndexerLagBlocks",
    ) &&
    !isPositiveSafeInteger(
      root.maxIndexerLagBlocks,
    )
  ) {
    return rejectRequirement(
      "invalid_registry_requirement",
    );
  }

  if (
    root
      .revalidateBeforeReleaseIfOlderThanSeconds >
    root.maxEvidenceAgeSeconds
  ) {
    return rejectRequirement(
      "invalid_registry_requirement",
    );
  }

  if (
    root.required === true &&
    root.trustedRegistries.length === 0
  ) {
    return rejectRequirement(
      "invalid_registry_requirement",
    );
  }

  const trustedRegistryKeys =
    new Set<string>();

  for (
    const entry of
    root.trustedRegistries
  ) {
    if (
      !validateTrustedRegistryEntry(
        entry,
      )
    ) {
      return rejectRequirement(
        "invalid_registry_requirement",
      );
    }

    const key =
      [
        entry.network,
        entry.contract.index,
        String(
          entry.contract.subindex,
        ),
      ].join("|");

    if (
      trustedRegistryKeys.has(key)
    ) {
      return rejectRequirement(
        "invalid_registry_requirement",
      );
    }

    trustedRegistryKeys.add(key);
  }

  return buildValidationResult(
    "requirement",
    "valid",
    value as AgentRegistryRequirementV1,
  );
}

/**
 * Strict, pure canonical Agent Registry reference validation.
 */
export function validateAgentRegistryReferenceV1(
  value: unknown,
): AgentRegistryContractValidationResult<
  AgentRegistryReferenceV1
> {
  const root =
    asRecord(value);

  if (
    root === null ||
    !hasOnlyKeys(
      root,
      REFERENCE_KEYS,
    )
  ) {
    return rejectReference(
      "invalid_object_shape",
    );
  }

  if (
    root.type !==
    AGENT_REGISTRY_REFERENCE_TYPE
  ) {
    return rejectReference(
      "unsupported_type",
    );
  }

  if (
    root.version !==
    AGENT_REGISTRY_CONTRACT_VERSION
  ) {
    return rejectReference(
      "unsupported_version",
    );
  }

  if (
    root.registryStandard !==
    AGENT_REGISTRY_STANDARD
  ) {
    return rejectReference(
      "unsupported_registry_standard",
    );
  }

  if (
    !isCompactIdentifier(
      root.network,
    ) ||
    !isValidContractCoordinate(
      root.registryContract,
    ) ||
    !isCanonicalNonNegativeDecimal(
      root.agentTokenId,
    ) ||
    !isTokenAddressShape(
      root.tokenAddress,
    )
  ) {
    return rejectReference(
      "invalid_registry_reference",
    );
  }

  if (
    (
      hasOwn(
        root,
        "tokenAddressBase58",
      ) &&
      !isCompactIdentifier(
        root.tokenAddressBase58,
        2048,
      )
    ) ||
    (
      hasOwn(
        root,
        "didAlias",
      ) &&
      !isCompactIdentifier(
        root.didAlias,
        2048,
      )
    ) ||
    (
      hasOwn(
        root,
        "resolverHint",
      ) &&
      !isCompactIdentifier(
        root.resolverHint,
        2048,
      )
    )
  ) {
    return rejectReference(
      "invalid_registry_reference",
    );
  }

  return buildValidationResult(
    "reference",
    "valid",
    value as AgentRegistryReferenceV1,
  );
}

function capabilitySetsAreCoherent(
  required:
    readonly string[],
  satisfied:
    readonly string[],
  missing:
    readonly string[],
): boolean {
  const requiredSet =
    new Set(required);

  const satisfiedSet =
    new Set(satisfied);

  const missingSet =
    new Set(missing);

  for (const capability of satisfied) {
    if (
      !requiredSet.has(capability) ||
      missingSet.has(capability)
    ) {
      return false;
    }
  }

  for (const capability of missing) {
    if (
      !requiredSet.has(capability) ||
      satisfiedSet.has(capability)
    ) {
      return false;
    }
  }

  return required.every(
    (capability) =>
      (
        satisfiedSet.has(capability) &&
        !missingSet.has(capability)
      ) ||
      (
        !satisfiedSet.has(capability) &&
        missingSet.has(capability)
      ),
  );
}

/**
 * Strict, pure normalized Agent Registry trust-result validation.
 *
 * Requirement-to-result composition is deliberately deferred. For example,
 * whether Agent Card integrity is mandatory depends on the separately
 * validated Gateway-authored requirement, not on this standalone result.
 */
export function validateAgentRegistryTrustResultV1(
  value: unknown,
): AgentRegistryContractValidationResult<
  AgentRegistryTrustResultV1
> {
  const root =
    asRecord(value);

  if (
    root === null ||
    !hasOnlyKeys(
      root,
      TRUST_RESULT_KEYS,
    )
  ) {
    return rejectTrustResult(
      "invalid_object_shape",
    );
  }

  if (
    root.type !==
    AGENT_REGISTRY_TRUST_RESULT_TYPE
  ) {
    return rejectTrustResult(
      "unsupported_type",
    );
  }

  if (
    root.version !==
    AGENT_REGISTRY_CONTRACT_VERSION
  ) {
    return rejectTrustResult(
      "unsupported_version",
    );
  }

  if (
    root.registryStandard !==
    AGENT_REGISTRY_STANDARD
  ) {
    return rejectTrustResult(
      "unsupported_registry_standard",
    );
  }

  const identity =
    asRecord(root.identity);

  const state =
    asRecord(root.state);

  const agentCard =
    asRecord(root.agentCard);

  const keyBinding =
    asRecord(root.keyBinding);

  const capabilities =
    asRecord(root.capabilities);

  const freshness =
    asRecord(root.freshness);

  if (
    identity === null ||
    state === null ||
    agentCard === null ||
    keyBinding === null ||
    capabilities === null ||
    freshness === null ||
    !hasOnlyKeys(
      identity,
      TRUST_RESULT_IDENTITY_KEYS,
    ) ||
    !hasOnlyKeys(
      state,
      TRUST_RESULT_STATE_KEYS,
    ) ||
    !hasOnlyKeys(
      agentCard,
      TRUST_RESULT_AGENT_CARD_KEYS,
    ) ||
    !hasOnlyKeys(
      keyBinding,
      TRUST_RESULT_KEY_BINDING_KEYS,
    ) ||
    !hasOnlyKeys(
      capabilities,
      TRUST_RESULT_CAPABILITY_KEYS,
    ) ||
    !hasOnlyKeys(
      freshness,
      TRUST_RESULT_FRESHNESS_KEYS,
    )
  ) {
    return rejectTrustResult(
      "invalid_object_shape",
    );
  }

  if (
    typeof root.verified !==
      "boolean" ||
    !isAllowedString(
      root.reason,
      AGENT_REGISTRY_TRUST_REASON_CODES,
    ) ||
    !isCompactIdentifier(
      identity.network,
    ) ||
    !isValidContractCoordinate(
      identity.registryContract,
    ) ||
    !isNullableLowerHex64(
      identity.moduleReference,
    ) ||
    !isCanonicalNonNegativeDecimal(
      identity.agentTokenId,
    ) ||
    !isTokenAddressShape(
      identity.tokenAddress,
    ) ||
    !isAllowedString(
      state.status,
      AGENT_REGISTRY_STATE_STATUS_VALUES,
    ) ||
    !isNullableCompactIdentifier(
      state.ownerAccount,
    ) ||
    typeof state.ownerAccountBound !==
      "boolean" ||
    !isAllowedString(
      state.ownerIdentityAssurance,
      AGENT_REGISTRY_OWNER_IDENTITY_ASSURANCE_VALUES,
    ) ||
    !isNullableCompactIdentifier(
      state.agentWallet,
    ) ||
    !isNullableCompactIdentifier(
      agentCard.uri,
      4096,
    ) ||
    !isNullableLowerHex64(
      agentCard.hash,
    ) ||
    typeof agentCard.integrityVerified !==
      "boolean" ||
    typeof keyBinding.required !==
      "boolean" ||
    typeof keyBinding.verified !==
      "boolean" ||
    !(
      keyBinding.bindingType ===
        null ||
      isAllowedString(
        keyBinding.bindingType,
        AGENT_REGISTRY_KEY_BINDING_TYPES,
      )
    ) ||
    !isNullableCompactIdentifier(
      keyBinding.keyFingerprint,
      2048,
    ) ||
    !isUniqueCompactStringArray(
      capabilities.required,
    ) ||
    !isUniqueCompactStringArray(
      capabilities.satisfied,
    ) ||
    !isUniqueCompactStringArray(
      capabilities.missing,
    ) ||
    typeof capabilities.policySatisfied !==
      "boolean" ||
    !isAllowedString(
      freshness.source,
      AGENT_REGISTRY_FRESHNESS_SOURCES,
    ) ||
    !isNullableNonNegativeSafeInteger(
      freshness.finalizedBlockHeight,
    ) ||
    !isNullableLowerHex64(
      freshness.finalizedBlockHash,
    ) ||
    !isNullableIsoTimestamp(
      freshness.observedAt,
    ) ||
    !isNullableNonNegativeSafeInteger(
      freshness.evidenceAgeSeconds,
    ) ||
    !isNullableNonNegativeSafeInteger(
      freshness.indexerLagBlocks,
    ) ||
    typeof freshness.fresh !==
      "boolean" ||
    !isNullableLowerHex64(
      root.evidenceHash,
    )
  ) {
    return rejectTrustResult(
      "invalid_registry_trust_result",
    );
  }

  if (
    (
      freshness.finalizedBlockHeight ===
        null
    ) !==
    (
      freshness.finalizedBlockHash ===
        null
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    freshness.fresh === true &&
    (
      freshness.observedAt ===
        null ||
      freshness.evidenceAgeSeconds ===
        null
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    !capabilitySetsAreCoherent(
      capabilities.required,
      capabilities.satisfied,
      capabilities.missing,
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  const satisfiedCapabilities =
    capabilities.satisfied as readonly string[];

  const allRequiredCapabilitiesSatisfied =
    capabilities.required.every(
      (capability) =>
        satisfiedCapabilities.includes(
          capability,
        ),
    );

  if (
    capabilities.policySatisfied ===
      true &&
    (
      capabilities.missing.length >
        0 ||
      !allRequiredCapabilitiesSatisfied
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    state.ownerAccountBound ===
      true &&
    state.ownerAccount ===
      null
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    state.ownerIdentityAssurance ===
      "verified" &&
    (
      state.ownerAccountBound !==
        true ||
      state.ownerAccount ===
        null
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    keyBinding.verified ===
      true &&
    (
      keyBinding.bindingType ===
        null ||
      keyBinding.keyFingerprint ===
        null
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    agentCard.integrityVerified ===
      true &&
    (
      agentCard.uri ===
        null ||
      agentCard.hash ===
        null
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    root.verified ===
      true &&
    (
      root.reason !==
        "agent_registry_verified" ||
      state.status !==
        "Active" ||
      freshness.fresh !==
        true ||
      capabilities.policySatisfied !==
        true ||
      capabilities.missing.length >
        0 ||
      !allRequiredCapabilitiesSatisfied ||
      (
        keyBinding.required ===
          true &&
        keyBinding.verified !==
          true
      )
    )
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  if (
    root.verified ===
      false &&
    root.reason ===
      "agent_registry_verified"
  ) {
    return rejectTrustResult(
      "incoherent_registry_trust_result",
    );
  }

  return buildValidationResult(
    "trust_result",
    "valid",
    value as AgentRegistryTrustResultV1,
  );
}
