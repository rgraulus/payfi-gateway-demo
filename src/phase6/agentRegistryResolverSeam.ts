/**
 * Phase 6 controlled Agent Registry resolver seam.
 *
 * PR #299 introduced the fixture-only controlled resolver seam.
 * PR #300 widens that seam for the read-only Concordium CIS-8004 plugin:
 * - consumes the frozen PR #298 contracts;
 * - injects a deterministic fixture resolver;
 * - validates every resolver result at runtime;
 * - enforces the Gateway-authored trusted-registry boundary;
 * - preserves coherent positive and negative trust results;
 * - fails closed for malformed, unavailable, thrown, mismatched,
 *   and untrusted results;
 * - performs no live Agent Registry lookup;
 * - performs no Gateway runtime, Phase 5 lifecycle, payment,
 *   receipt, replay, release, or production action.
 */

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  type AgentRegistryContractValidationReasonV1,
  type AgentRegistryReferenceV1,
  type AgentRegistryRequirementV1,
  type AgentRegistryTrustedRegistryV1,
  type AgentRegistryTrustReasonV1,
  type AgentRegistryTrustResultV1,
  validateAgentRegistryReferenceV1,
  validateAgentRegistryRequirementV1,
  validateAgentRegistryTrustResultV1,
} from "./agentRegistryTrustContract";

export const AGENT_REGISTRY_RESOLVER_KIND =
  "xcf.agent-registry.resolver" as const;

export const AGENT_REGISTRY_RESOLVER_REQUEST_TYPE =
  "xcf.agent-registry.resolve-request" as const;

export const AGENT_REGISTRY_RESOLVER_UNAVAILABLE_TYPE =
  "xcf.agent-registry.resolver-unavailable" as const;

export const AGENT_REGISTRY_RESOLVER_MODE =
  "fixture_only" as const;

export const AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE =
  "concordium_cis8004" as const;

export const AGENT_REGISTRY_RESOLVER_MODES = [
  AGENT_REGISTRY_RESOLVER_MODE,
  AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE,
] as const;

export type AgentRegistryResolverModeV1 =
  (typeof AGENT_REGISTRY_RESOLVER_MODES)[number];

export const AGENT_REGISTRY_RESOLVER_SEAM_STATUSES = [
  "not_required",
  "resolved",
  "rejected",
  "unavailable",
  "invalid_result",
] as const;

export type AgentRegistryResolverSeamStatusV1 =
  (typeof AGENT_REGISTRY_RESOLVER_SEAM_STATUSES)[number];

export const AGENT_REGISTRY_RESOLVER_SEAM_SPECIFIC_REASONS = [
  "not_required",
  "invalid_registry_requirement",
  "resolver_exception",
] as const;

export type AgentRegistryResolverSeamSpecificReasonV1 =
  (typeof AGENT_REGISTRY_RESOLVER_SEAM_SPECIFIC_REASONS)[number];

export type AgentRegistryResolverSeamReasonV1 =
  | AgentRegistryTrustReasonV1
  | AgentRegistryResolverSeamSpecificReasonV1;

export const AGENT_REGISTRY_FIXTURE_RESOLVER_SCENARIOS = [
  "result",
  "unavailable",
  "throw",
] as const;

export type AgentRegistryFixtureResolverScenarioV1 =
  (typeof AGENT_REGISTRY_FIXTURE_RESOLVER_SCENARIOS)[number];

/**
 * The Gateway constructs this request only after validating the frozen
 * PR #298 requirement and reference contracts.
 */
export type AgentRegistryResolverRequestV1 = {
  readonly type:
    typeof AGENT_REGISTRY_RESOLVER_REQUEST_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly requirement:
    AgentRegistryRequirementV1;

  readonly reference:
    AgentRegistryReferenceV1;
};

/**
 * The resolver deliberately returns unknown.
 *
 * An external implementation's TypeScript declaration must never substitute
 * for Gateway-side runtime validation of the returned trust result.
 */
export interface AgentRegistryResolverV1 {
  readonly kind:
    typeof AGENT_REGISTRY_RESOLVER_KIND;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly mode:
    AgentRegistryResolverModeV1;

  resolve(
    request: AgentRegistryResolverRequestV1,
  ): Promise<unknown>;
}

export type AgentRegistryResolverUnavailableV1 = {
  readonly type:
    typeof AGENT_REGISTRY_RESOLVER_UNAVAILABLE_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly status:
    "unavailable";

  readonly reason:
    "agent_registry_resolver_unavailable";
};

export type AgentRegistryFixtureResolverBehaviorV1 =
  | {
      readonly scenario:
        "result";

      readonly result:
        unknown;
    }
  | {
      readonly scenario:
        "unavailable";
    }
  | {
      readonly scenario:
        "throw";
    };

/**
 * Deterministic test double for PR #299.
 *
 * It performs no network, filesystem, database, timer, retry, environment,
 * Gateway runtime, payment, or release activity.
 */
export class DeterministicAgentRegistryFixtureResolverV1
implements AgentRegistryResolverV1 {
  readonly kind =
    AGENT_REGISTRY_RESOLVER_KIND;

  readonly version =
    AGENT_REGISTRY_CONTRACT_VERSION;

  readonly mode =
    AGENT_REGISTRY_RESOLVER_MODE;

  constructor(
    private readonly behavior:
      AgentRegistryFixtureResolverBehaviorV1,
  ) {}

  async resolve(
    _request:
      AgentRegistryResolverRequestV1,
  ): Promise<unknown> {
    if (
      this.behavior.scenario ===
      "result"
    ) {
      return this.behavior.result;
    }

    if (
      this.behavior.scenario ===
      "unavailable"
    ) {
      const unavailable:
        AgentRegistryResolverUnavailableV1 = {
          type:
            AGENT_REGISTRY_RESOLVER_UNAVAILABLE_TYPE,

          version:
            AGENT_REGISTRY_CONTRACT_VERSION,

          status:
            "unavailable",

          reason:
            "agent_registry_resolver_unavailable",
        };

      return unavailable;
    }

    throw new Error(
      "deterministic_agent_registry_fixture_error",
    );
  }
}

export type ResolveAgentRegistryTrustForGatewayInputV1 = {
  readonly requirement:
    unknown;

  readonly reference?:
    unknown | null;

  readonly resolver:
    unknown;
};

/**
 * A successful seam result means only that resolver handling completed.
 *
 * A resolved result may still contain:
 *   verified: false
 *
 * This seam never makes the final Gateway authorization or release decision.
 */
export type AgentRegistryResolverSeamResultV1 = {
  readonly ok:
    boolean;

  readonly status:
    AgentRegistryResolverSeamStatusV1;

  readonly mode:
    AgentRegistryResolverModeV1;

  readonly reason:
    AgentRegistryResolverSeamReasonV1;

  readonly requirementValidationReason:
    AgentRegistryContractValidationReasonV1;

  readonly referenceValidationReason:
    AgentRegistryContractValidationReasonV1 | null;

  readonly trustResultValidationReason:
    AgentRegistryContractValidationReasonV1 | null;

  readonly requirement:
    AgentRegistryRequirementV1 | null;

  readonly reference:
    AgentRegistryReferenceV1 | null;

  readonly matchedTrustedRegistry:
    AgentRegistryTrustedRegistryV1 | null;

  readonly trustResult:
    AgentRegistryTrustResultV1 | null;

  readonly registryTrustSatisfied:
    boolean | null;

  readonly resolverInvoked:
    boolean;

  readonly fixtureResolverInvoked:
    boolean;

  readonly concordiumResolverInvoked:
    boolean;

  readonly registryNetworkCalled:
    boolean;

  readonly gatewayRuntimeCalled:
    false;

  readonly gatewayRuntimeChanged:
    false;

  readonly phase5StateMutated:
    false;

  readonly canonicalStateMutated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly replayStateMutated:
    false;

  readonly ufxCalled:
    false;

  readonly crpCalled:
    false;

  readonly paymentAttempted:
    false;

  readonly receiptIssued:
    false;

  readonly paymentResponseEmitted:
    false;

  readonly resourceReleased:
    false;

  readonly agentRegistryLookupAttempted:
    boolean;

  readonly productionActivation:
    false;
};

type UnknownRecord =
  Record<string, unknown>;

type BuildResolverSeamResultOptions = {
  readonly mode?:
    AgentRegistryResolverModeV1;

  readonly requirementValidationReason:
    AgentRegistryContractValidationReasonV1;

  readonly referenceValidationReason?:
    AgentRegistryContractValidationReasonV1 | null;

  readonly trustResultValidationReason?:
    AgentRegistryContractValidationReasonV1 | null;

  readonly requirement?:
    AgentRegistryRequirementV1 | null;

  readonly reference?:
    AgentRegistryReferenceV1 | null;

  readonly matchedTrustedRegistry?:
    AgentRegistryTrustedRegistryV1 | null;

  readonly trustResult?:
    AgentRegistryTrustResultV1 | null;

  readonly registryTrustSatisfied?:
    boolean | null;

  readonly resolverInvoked?:
    boolean;

};

function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    typeof value !==
      "object" ||
    value ===
      null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function hasOnlyKeys(
  record: UnknownRecord,
  keys: readonly string[],
): boolean {
  const actualKeys =
    Object.keys(record);

  return (
    actualKeys.length ===
      keys.length &&
    actualKeys.every(
      (key) =>
        keys.includes(key),
    )
  );
}

function isAgentRegistryResolver(
  value: unknown,
): value is AgentRegistryResolverV1 {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    record.kind ===
      AGENT_REGISTRY_RESOLVER_KIND &&
    record.version ===
      AGENT_REGISTRY_CONTRACT_VERSION &&
    AGENT_REGISTRY_RESOLVER_MODES.includes(
      record.mode as
        AgentRegistryResolverModeV1,
    ) &&
    typeof record.resolve ===
      "function"
  );
}

function isUnavailableResult(
  value: unknown,
): value is AgentRegistryResolverUnavailableV1 {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    hasOnlyKeys(
      record,
      [
        "type",
        "version",
        "status",
        "reason",
      ],
    ) &&
    record.type ===
      AGENT_REGISTRY_RESOLVER_UNAVAILABLE_TYPE &&
    record.version ===
      AGENT_REGISTRY_CONTRACT_VERSION &&
    record.status ===
      "unavailable" &&
    record.reason ===
      "agent_registry_resolver_unavailable"
  );
}

function sameContractCoordinate(
  left: {
    readonly index: string;
    readonly subindex: number;
  },
  right: {
    readonly index: string;
    readonly subindex: number;
  },
): boolean {
  return (
    left.index ===
      right.index &&
    left.subindex ===
      right.subindex
  );
}

function findTrustedRegistry(
  requirement:
    AgentRegistryRequirementV1,
  reference:
    AgentRegistryReferenceV1,
): AgentRegistryTrustedRegistryV1 | null {
  return (
    requirement
      .trustedRegistries
      .find(
        (trustedRegistry) =>
          trustedRegistry.network ===
            reference.network &&
          sameContractCoordinate(
            trustedRegistry.contract,
            reference.registryContract,
          ),
      ) ??
    null
  );
}

function resultRegistryMatchesReference(
  trustResult:
    AgentRegistryTrustResultV1,
  reference:
    AgentRegistryReferenceV1,
): boolean {
  return (
    trustResult.identity.network ===
      reference.network &&
    sameContractCoordinate(
      trustResult.identity.registryContract,
      reference.registryContract,
    )
  );
}

function resultIdentityMatchesReference(
  trustResult:
    AgentRegistryTrustResultV1,
  reference:
    AgentRegistryReferenceV1,
): boolean {
  return (
    trustResult.identity.agentTokenId ===
      reference.agentTokenId &&
    trustResult.identity.tokenAddress ===
      reference.tokenAddress
  );
}

function mapRequirementFailure(
  reason:
    AgentRegistryContractValidationReasonV1,
): AgentRegistryResolverSeamReasonV1 {
  if (
    reason ===
    "unsupported_registry_standard"
  ) {
    return "unsupported_registry_standard";
  }

  return "invalid_registry_requirement";
}

function mapReferenceFailure(
  reason:
    AgentRegistryContractValidationReasonV1,
): AgentRegistryResolverSeamReasonV1 {
  if (
    reason ===
    "unsupported_registry_standard"
  ) {
    return "unsupported_registry_standard";
  }

  return "invalid_registry_reference";
}

function buildResolverSeamResult(
  status:
    AgentRegistryResolverSeamStatusV1,
  reason:
    AgentRegistryResolverSeamReasonV1,
  options:
    BuildResolverSeamResultOptions,
): AgentRegistryResolverSeamResultV1 {
  const ok =
    status ===
      "not_required" ||
    status ===
      "resolved";

  const mode =
    options.mode ??
    AGENT_REGISTRY_RESOLVER_MODE;

  const resolverInvoked =
    options.resolverInvoked ??
    false;

  const fixtureResolverInvoked =
    resolverInvoked &&
    mode ===
      AGENT_REGISTRY_RESOLVER_MODE;

  const concordiumResolverInvoked =
    resolverInvoked &&
    mode ===
      AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE;

  return {
    ok,
    status,

    mode,

    reason,

    requirementValidationReason:
      options.requirementValidationReason,

    referenceValidationReason:
      options.referenceValidationReason ??
      null,

    trustResultValidationReason:
      options.trustResultValidationReason ??
      null,

    requirement:
      options.requirement ??
      null,

    reference:
      options.reference ??
      null,

    matchedTrustedRegistry:
      options.matchedTrustedRegistry ??
      null,

    trustResult:
      options.trustResult ??
      null,

    registryTrustSatisfied:
      options.registryTrustSatisfied ??
      null,

    resolverInvoked,

    fixtureResolverInvoked,

    concordiumResolverInvoked,

    registryNetworkCalled:
      concordiumResolverInvoked,

    gatewayRuntimeCalled:
      false,

    gatewayRuntimeChanged:
      false,

    phase5StateMutated:
      false,

    canonicalStateMutated:
      false,

    boundedUseConsumed:
      false,

    replayStateMutated:
      false,

    ufxCalled:
      false,

    crpCalled:
      false,

    paymentAttempted:
      false,

    receiptIssued:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
      false,

    agentRegistryLookupAttempted:
      concordiumResolverInvoked,

    productionActivation:
      false,
  };
}

/**
 * Gateway-owned controlled resolver adapter.
 *
 * Deterministic order:
 * 1. validate the Gateway-authored requirement;
 * 2. bypass when registry trust is not required;
 * 3. require and validate the canonical registry reference;
 * 4. enforce the trusted-registry allowlist;
 * 5. invoke only a validated fixture or Concordium CIS-8004 resolver;
 * 6. handle unavailable and thrown resolver behavior;
 * 7. validate the unknown resolver result using PR #298;
 * 8. bind the result to the requested registry identity;
 * 9. enforce a pinned module reference when configured;
 * 10. return normalized trust facts without authorizing release.
 */
export async function resolveAgentRegistryTrustForGatewayV1(
  input:
    ResolveAgentRegistryTrustForGatewayInputV1,
): Promise<AgentRegistryResolverSeamResultV1> {
  const resolver =
    isAgentRegistryResolver(
      input.resolver,
    )
      ? input.resolver
      : null;

  const resolverMode =
    resolver?.mode ??
    AGENT_REGISTRY_RESOLVER_MODE;

  const buildResult = (
    status:
      AgentRegistryResolverSeamStatusV1,
    reason:
      AgentRegistryResolverSeamReasonV1,
    options:
      BuildResolverSeamResultOptions,
  ): AgentRegistryResolverSeamResultV1 =>
    buildResolverSeamResult(
      status,
      reason,
      {
        ...options,

        mode:
          resolverMode,
      },
    );

  const requirementValidation =
    validateAgentRegistryRequirementV1(
      input.requirement,
    );

  if (
    !requirementValidation.ok ||
    requirementValidation.value ===
      null
  ) {
    return buildResult(
      "rejected",
      mapRequirementFailure(
        requirementValidation
          .validationReason,
      ),
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,
      },
    );
  }

  const requirement =
    requirementValidation.value;

  if (!requirement.required) {
    return buildResult(
      "not_required",
      "not_required",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        requirement,
      },
    );
  }

  if (
    input.reference ===
      undefined ||
    input.reference ===
      null
  ) {
    return buildResult(
      "rejected",
      "missing_registry_reference",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        requirement,
      },
    );
  }

  const referenceValidation =
    validateAgentRegistryReferenceV1(
      input.reference,
    );

  if (
    !referenceValidation.ok ||
    referenceValidation.value ===
      null
  ) {
    return buildResult(
      "rejected",
      mapReferenceFailure(
        referenceValidation
          .validationReason,
      ),
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        requirement,
      },
    );
  }

  const reference =
    referenceValidation.value;

  const matchedTrustedRegistry =
    findTrustedRegistry(
      requirement,
      reference,
    );

  if (
    matchedTrustedRegistry ===
      null
  ) {
    return buildResult(
      "rejected",
      "untrusted_registry_contract",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        requirement,
        reference,
      },
    );
  }

  if (
    resolver ===
      null
  ) {
    return buildResult(
      "unavailable",
      "agent_registry_resolver_unavailable",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,
      },
    );
  }

  const request:
    AgentRegistryResolverRequestV1 = {
      type:
        AGENT_REGISTRY_RESOLVER_REQUEST_TYPE,

      version:
        AGENT_REGISTRY_CONTRACT_VERSION,

      requirement,
      reference,
    };

  let resolverOutput:
    unknown;

  try {
    resolverOutput =
      await resolver.resolve(
        request,
      );
  } catch {
    return buildResult(
      "unavailable",
      "resolver_exception",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  if (
    isUnavailableResult(
      resolverOutput,
    )
  ) {
    return buildResult(
      "unavailable",
      "agent_registry_resolver_unavailable",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  const trustResultValidation =
    validateAgentRegistryTrustResultV1(
      resolverOutput,
    );

  if (
    !trustResultValidation.ok ||
    trustResultValidation.value ===
      null
  ) {
    return buildResult(
      "invalid_result",
      "agent_registry_result_invalid",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        trustResultValidationReason:
          trustResultValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  const trustResult =
    trustResultValidation.value;

  if (
    !resultRegistryMatchesReference(
      trustResult,
      reference,
    )
  ) {
    return buildResult(
      "rejected",
      "agent_registry_contract_mismatch",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        trustResultValidationReason:
          trustResultValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  if (
    !resultIdentityMatchesReference(
      trustResult,
      reference,
    )
  ) {
    return buildResult(
      "rejected",
      "agent_registry_identity_mismatch",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        trustResultValidationReason:
          trustResultValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  if (
    matchedTrustedRegistry
      .moduleReference !==
      undefined &&
    trustResult.identity
      .moduleReference !==
      matchedTrustedRegistry
        .moduleReference
  ) {
    return buildResult(
      "rejected",
      "agent_registry_contract_mismatch",
      {
        requirementValidationReason:
          requirementValidation
            .validationReason,

        referenceValidationReason:
          referenceValidation
            .validationReason,

        trustResultValidationReason:
          trustResultValidation
            .validationReason,

        requirement,
        reference,
        matchedTrustedRegistry,

        resolverInvoked:
          true,

      },
    );
  }

  return buildResult(
    "resolved",
    trustResult.reason,
    {
      requirementValidationReason:
        requirementValidation
          .validationReason,

      referenceValidationReason:
        referenceValidation
          .validationReason,

      trustResultValidationReason:
        trustResultValidation
          .validationReason,

      requirement,
      reference,
      matchedTrustedRegistry,
      trustResult,

      registryTrustSatisfied:
        trustResult.verified,

      resolverInvoked:
        true,

    },
  );
}
