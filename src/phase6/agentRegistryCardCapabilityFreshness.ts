import {
  createHash,
} from "node:crypto";

import type {
  AgentRegistryRequirementV1,
  AgentRegistryTrustReasonV1,
  AgentRegistryTrustResultV1,
} from "./agentRegistryTrustContract";

import {
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,
} from "./agentRegistryIdentityKeyBinding";

import type {
  AgentRegistryIdentityKeyBindingResultV1,
} from "./agentRegistryIdentityKeyBinding";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  validateAgentRegistryRequirementV1,
  validateAgentRegistryTrustResultV1,
} from "./agentRegistryTrustContract";

export const AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_TYPE =
  "xcf.agent-registry.card-capability-freshness-result" as const;

export const AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_MODE =
  "test_only" as const;

export const AGENT_CARD_FETCH_RESULT_TYPE =
  "xcf.agent-card.fetch-result" as const;

export const AGENT_CARD_DETERMINISTIC_TRANSPORT_KIND =
  "xcf.agent-card.transport.deterministic" as const;

export const AGENT_CARD_HTTPS_TRANSPORT_KIND =
  "xcf.agent-card.transport.https" as const;

export const AGENT_REGISTRATION_FILE_TYPE =
  "https://eips.ethereum.org/EIPS/eip-8004#registration-v1" as const;

export const DEFAULT_AGENT_CARD_MAX_BYTES =
  262_144;

export const DEFAULT_AGENT_CARD_FETCH_TIMEOUT_MS =
  5_000;

export const AGENT_CARD_CAPABILITY_RULE_SOURCES = [
  "x402_support",
  "oasf_skill",
  "oasf_domain",
] as const;

export type AgentCardCapabilityRuleSourceV1 =
  (typeof AGENT_CARD_CAPABILITY_RULE_SOURCES)[number];

export type AgentRegistryCardCapabilityFreshnessReasonV1 =
  | AgentRegistryTrustReasonV1
  | "accepted"
  | "accepted_without_agent_card"
  | "agent_registry_revalidation_required";

export type AgentRegistrationFileServiceSubsetV1 = {
  readonly name: string;

  readonly endpoint?: string;

  readonly version?: string;

  readonly skills?: readonly string[];

  readonly domains?: readonly string[];
};

export type AgentRegistrationFileSubsetV1 = {
  readonly type:
    typeof AGENT_REGISTRATION_FILE_TYPE;

  readonly name: string;

  readonly services?:
    readonly AgentRegistrationFileServiceSubsetV1[];

  readonly x402Support?: boolean;

  readonly active?: boolean;

  readonly supportedTrust?: readonly string[];
};

export type AgentCardFetchRequestV1 = {
  readonly uri: string;

  readonly maxBytes: number;

  readonly timeoutMs: number;
};

export type AgentCardFetchResultV1 = {
  readonly type:
    typeof AGENT_CARD_FETCH_RESULT_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly ok: boolean;

  readonly status:
    | "fetched"
    | "failed";

  readonly uri: string;

  readonly bytes:
    Uint8Array | null;

  readonly contentType:
    string | null;

  readonly httpStatus:
    number | null;

  readonly redirected:
    boolean;

  readonly timedOut:
    boolean;

  readonly error:
    string | null;
};

export interface AgentCardFetchTransportV1 {
  readonly kind: string;

  read(
    request:
      AgentCardFetchRequestV1,
  ): Promise<unknown>;
}

export type DeterministicAgentCardFetchFixtureV1 =
  | {
      readonly ok: true;

      readonly bytes:
        Uint8Array | string;

      readonly contentType?: string;

      readonly httpStatus?: number;

      readonly redirected?: boolean;
    }
  | {
      readonly ok: false;

      readonly error: string;

      readonly timedOut?: boolean;

      readonly httpStatus?: number;

      readonly redirected?: boolean;
    };

export type AgentCardCapabilityRuleV1 =
  | {
      readonly capabilityId: string;

      readonly source:
        "x402_support";

      readonly expected:
        true;
    }
  | {
      readonly capabilityId: string;

      readonly source:
        "oasf_skill";

      readonly skill: string;
    }
  | {
      readonly capabilityId: string;

      readonly source:
        "oasf_domain";

      readonly domain: string;
    };

export type AgentRegistryCardCapabilityFreshnessInputV1 = {
  readonly requirement:
    unknown;

  readonly identityKeyBindingResult:
    unknown;

  readonly registryTrustResult:
    unknown;

  readonly capabilityRules:
    unknown;

  readonly now: string;

  readonly transport?:
    AgentCardFetchTransportV1;

  readonly maxAgentCardBytes?:
    number;

  readonly fetchTimeoutMs?:
    number;
};

export type AgentRegistryCardCapabilityFreshnessResultV1 = {
  readonly type:
    typeof AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly mode:
    typeof AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_MODE;

  readonly ok: boolean;

  readonly status:
    | "accepted"
    | "rejected"
    | "revalidation_required";

  readonly reason:
    AgentRegistryCardCapabilityFreshnessReasonV1;

  readonly testOnly:
    true;

  readonly requirementValidated:
    boolean;

  readonly baseRegistryTrustVerified:
    boolean;

  readonly identityKeyBindingAccepted:
    boolean;

  readonly registryTrustPreserved:
    boolean;

  readonly trustResult:
    AgentRegistryTrustResultV1 | null;

  readonly identityKeyBinding:
    AgentRegistryIdentityKeyBindingResultV1 | null;

  readonly cardEvidence: {
    readonly fetchRequired: boolean;

    readonly fetchAttempted: boolean;

    readonly uri: string | null;

    readonly expectedHash: string | null;

    readonly actualHash: string | null;

    readonly byteLength: number | null;

    readonly schemaType: string | null;

    readonly integrityVerified: boolean;
  };

  readonly capabilityDecision: {
    readonly required:
      readonly string[];

    readonly satisfied:
      readonly string[];

    readonly missing:
      readonly string[];

    readonly policySatisfied: boolean;
  };

  readonly freshnessDecision: {
    readonly source:
      string | null;

    readonly observedAt:
      string | null;

    readonly calculatedEvidenceAgeSeconds:
      number | null;

    readonly suppliedEvidenceAgeSeconds:
      number | null;

    readonly maxEvidenceAgeSeconds:
      number | null;

    readonly indexerLagBlocks:
      number | null;

    readonly maxIndexerLagBlocks:
      number | null;

    readonly revalidationThresholdSeconds:
      number | null;

    readonly revalidationRequired:
      boolean;

    readonly fresh:
      boolean;
  };

  readonly agentCardNetworkCalled:
    boolean;

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

  readonly transactionSubmitted:
    false;

  readonly signingKeyUsed:
    false;

  readonly persistenceUsed:
    false;

  readonly productionActivation:
    false;
};

export type AgentRegistryCardCapabilityFreshnessValidatedInputV1 = {
  readonly requirement:
    AgentRegistryRequirementV1;

  readonly identityKeyBindingResult:
    AgentRegistryIdentityKeyBindingResultV1;

  readonly registryTrustResult:
    AgentRegistryTrustResultV1;

  readonly capabilityRules:
    readonly AgentCardCapabilityRuleV1[];

  readonly nowMs: number;

  readonly maxAgentCardBytes: number;

  readonly fetchTimeoutMs: number;

  readonly transport:
    AgentCardFetchTransportV1 | null;
};

type UnknownRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown,
): UnknownRecord | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  )
    ? value as UnknownRecord
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

function isCompactString(
  value: unknown,
  maxLength = 4096,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0 &&
    value.length <=
      maxLength &&
    value.trim() ===
      value
  );
}

function isPositiveSafeInteger(
  value: unknown,
): value is number {
  return (
    Number.isSafeInteger(
      value,
    ) &&
    (
      value as number
    ) >
      0
  );
}

function isUniqueCompactStringArray(
  value: unknown,
): value is readonly string[] {
  if (
    !Array.isArray(
      value,
    ) ||
    !value.every(
      (entry) =>
        isCompactString(
          entry,
          2048,
        ),
    )
  ) {
    return false;
  }

  return (
    new Set(
      value,
    ).size ===
    value.length
  );
}

function normalizeFixtureBytes(
  value:
    Uint8Array | string,
): Uint8Array {
  return typeof value ===
    "string"
    ? Buffer.from(
        value,
        "utf8",
      )
    : Uint8Array.from(
        value,
      );
}

function buildAgentCardFetchResult(
  state: {
    readonly ok: boolean;

    readonly status:
      "fetched" | "failed";

    readonly uri: string;

    readonly bytes?:
      Uint8Array | null;

    readonly contentType?:
      string | null;

    readonly httpStatus?:
      number | null;

    readonly redirected?:
      boolean;

    readonly timedOut?:
      boolean;

    readonly error?:
      string | null;
  },
): AgentCardFetchResultV1 {
  return {
    type:
      AGENT_CARD_FETCH_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    ok:
      state.ok,

    status:
      state.status,

    uri:
      state.uri,

    bytes:
      state.bytes ??
      null,

    contentType:
      state.contentType ??
      null,

    httpStatus:
      state.httpStatus ??
      null,

    redirected:
      state.redirected ??
      false,

    timedOut:
      state.timedOut ??
      false,

    error:
      state.error ??
      null,
  };
}

export class DeterministicAgentCardFetchTransportV1
implements AgentCardFetchTransportV1 {
  readonly kind =
    AGENT_CARD_DETERMINISTIC_TRANSPORT_KIND;

  readonly calls:
    AgentCardFetchRequestV1[] = [];

  constructor(
    private readonly fixtures:
      Readonly<
        Record<
          string,
          DeterministicAgentCardFetchFixtureV1
        >
      >,
  ) {}

  async read(
    request:
      AgentCardFetchRequestV1,
  ): Promise<AgentCardFetchResultV1> {
    this.calls.push({
      ...request,
    });

    const fixture =
      this.fixtures[
        request.uri
      ];

    if (
      fixture ===
      undefined
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        error:
          "fixture_missing",
      });
    }

    if (
      fixture.ok ===
      false
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        httpStatus:
          fixture.httpStatus ??
          null,

        redirected:
          fixture.redirected ??
          false,

        timedOut:
          fixture.timedOut ??
          false,

        error:
          fixture.error,
      });
    }

    const bytes =
      normalizeFixtureBytes(
        fixture.bytes,
      );

    const httpStatus =
      fixture.httpStatus ??
      200;

    if (
      bytes.byteLength >
      request.maxBytes
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        contentType:
          fixture.contentType ??
          "application/json",

        httpStatus,

        redirected:
          fixture.redirected ??
          false,

        error:
          "response_too_large",
      });
    }

    if (
      httpStatus <
        200 ||
      httpStatus >
        299
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        contentType:
          fixture.contentType ??
          "application/json",

        httpStatus,

        redirected:
          fixture.redirected ??
          false,

        error:
          "http_status_not_success",
      });
    }

    return buildAgentCardFetchResult({
      ok:
        true,

      status:
        "fetched",

      uri:
        request.uri,

      bytes,

      contentType:
        fixture.contentType ??
        "application/json",

      httpStatus,

      redirected:
        fixture.redirected ??
        false,
    });
  }
}

function validateCapabilityRules(
  value: unknown,
): readonly AgentCardCapabilityRuleV1[] | null {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return null;
  }

  const rules:
    AgentCardCapabilityRuleV1[] = [];

  for (
    const candidate
    of value
  ) {
    const rule =
      asRecord(
        candidate,
      );

    if (
      rule ===
        null ||
      !isCompactString(
        rule.capabilityId,
        2048,
      ) ||
      typeof rule.source !==
        "string" ||
      !AGENT_CARD_CAPABILITY_RULE_SOURCES.includes(
        rule.source as AgentCardCapabilityRuleSourceV1,
      )
    ) {
      return null;
    }

    if (
      rule.source ===
      "x402_support"
    ) {
      if (
        rule.expected !==
          true ||
        Object.keys(
          rule,
        ).some(
          (key) =>
            ![
              "capabilityId",
              "source",
              "expected",
            ].includes(
              key,
            ),
        )
      ) {
        return null;
      }

      rules.push({
        capabilityId:
          rule.capabilityId,

        source:
          "x402_support",

        expected:
          true,
      });

      continue;
    }

    if (
      rule.source ===
      "oasf_skill"
    ) {
      if (
        !isCompactString(
          rule.skill,
          2048,
        ) ||
        Object.keys(
          rule,
        ).some(
          (key) =>
            ![
              "capabilityId",
              "source",
              "skill",
            ].includes(
              key,
            ),
        )
      ) {
        return null;
      }

      rules.push({
        capabilityId:
          rule.capabilityId,

        source:
          "oasf_skill",

        skill:
          rule.skill,
      });

      continue;
    }

    if (
      !isCompactString(
        rule.domain,
        2048,
      ) ||
      Object.keys(
        rule,
      ).some(
        (key) =>
          ![
            "capabilityId",
            "source",
            "domain",
          ].includes(
            key,
          ),
      )
    ) {
      return null;
    }

    rules.push({
      capabilityId:
        rule.capabilityId,

      source:
        "oasf_domain",

      domain:
        rule.domain,
    });
  }

  const capabilityIds =
    rules.map(
      (rule) =>
        rule.capabilityId,
    );

  if (
    !isUniqueCompactStringArray(
      capabilityIds,
    )
  ) {
    return null;
  }

  return rules;
}

function isAgentCardFetchTransport(
  value: unknown,
): value is AgentCardFetchTransportV1 {
  const transport =
    asRecord(
      value,
    );

  return (
    transport !==
      null &&
    isCompactString(
      transport.kind,
      256,
    ) &&
    typeof transport.read ===
      "function"
  );
}

void hasOwn;
void isPositiveSafeInteger;
void validateCapabilityRules;
void isAgentCardFetchTransport;


type FreshnessEvaluationV1 = {
  readonly ok: boolean;

  readonly reason:
    | "accepted"
    | "agent_registry_evidence_stale"
    | "agent_registry_revalidation_required";

  readonly decision:
    AgentRegistryCardCapabilityFreshnessResultV1[
      "freshnessDecision"
    ];
};

type CardCapabilityFreshnessResultStateV1 = {
  readonly reason:
    AgentRegistryCardCapabilityFreshnessReasonV1;

  readonly requirementValidated?: boolean;

  readonly baseRegistryTrustVerified?: boolean;

  readonly identityKeyBindingAccepted?: boolean;

  readonly registryTrustPreserved?: boolean;

  readonly trustResult?:
    AgentRegistryTrustResultV1 | null;

  readonly identityKeyBinding?:
    AgentRegistryIdentityKeyBindingResultV1 | null;

  readonly cardEvidence?: Partial<
    AgentRegistryCardCapabilityFreshnessResultV1[
      "cardEvidence"
    ]
  >;

  readonly capabilityDecision?: Partial<
    AgentRegistryCardCapabilityFreshnessResultV1[
      "capabilityDecision"
    ]
  >;

  readonly freshnessDecision?: Partial<
    AgentRegistryCardCapabilityFreshnessResultV1[
      "freshnessDecision"
    ]
  >;

  readonly agentCardNetworkCalled?: boolean;
};

function buildCardCapabilityFreshnessResult(
  state:
    CardCapabilityFreshnessResultStateV1,
): AgentRegistryCardCapabilityFreshnessResultV1 {
  const accepted =
    state.reason ===
      "accepted" ||
    state.reason ===
      "accepted_without_agent_card";

  const revalidationRequired =
    state.reason ===
      "agent_registry_revalidation_required";

  return {
    type:
      AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    mode:
      AGENT_REGISTRY_CARD_CAPABILITY_FRESHNESS_MODE,

    ok:
      accepted,

    status:
      accepted
        ? "accepted"
        : revalidationRequired
          ? "revalidation_required"
          : "rejected",

    reason:
      state.reason,

    testOnly:
      true,

    requirementValidated:
      state.requirementValidated ??
      false,

    baseRegistryTrustVerified:
      state.baseRegistryTrustVerified ??
      false,

    identityKeyBindingAccepted:
      state.identityKeyBindingAccepted ??
      false,

    registryTrustPreserved:
      state.registryTrustPreserved ??
      false,

    trustResult:
      state.trustResult ??
      null,

    identityKeyBinding:
      state.identityKeyBinding ??
      null,

    cardEvidence: {
      fetchRequired:
        state.cardEvidence?.fetchRequired ??
        false,

      fetchAttempted:
        state.cardEvidence?.fetchAttempted ??
        false,

      uri:
        state.cardEvidence?.uri ??
        null,

      expectedHash:
        state.cardEvidence?.expectedHash ??
        null,

      actualHash:
        state.cardEvidence?.actualHash ??
        null,

      byteLength:
        state.cardEvidence?.byteLength ??
        null,

      schemaType:
        state.cardEvidence?.schemaType ??
        null,

      integrityVerified:
        state.cardEvidence?.integrityVerified ??
        false,
    },

    capabilityDecision: {
      required:
        state.capabilityDecision?.required ??
        [],

      satisfied:
        state.capabilityDecision?.satisfied ??
        [],

      missing:
        state.capabilityDecision?.missing ??
        [],

      policySatisfied:
        state.capabilityDecision?.policySatisfied ??
        false,
    },

    freshnessDecision: {
      source:
        state.freshnessDecision?.source ??
        null,

      observedAt:
        state.freshnessDecision?.observedAt ??
        null,

      calculatedEvidenceAgeSeconds:
        state.freshnessDecision
          ?.calculatedEvidenceAgeSeconds ??
        null,

      suppliedEvidenceAgeSeconds:
        state.freshnessDecision
          ?.suppliedEvidenceAgeSeconds ??
        null,

      maxEvidenceAgeSeconds:
        state.freshnessDecision
          ?.maxEvidenceAgeSeconds ??
        null,

      indexerLagBlocks:
        state.freshnessDecision
          ?.indexerLagBlocks ??
        null,

      maxIndexerLagBlocks:
        state.freshnessDecision
          ?.maxIndexerLagBlocks ??
        null,

      revalidationThresholdSeconds:
        state.freshnessDecision
          ?.revalidationThresholdSeconds ??
        null,

      revalidationRequired:
        state.freshnessDecision
          ?.revalidationRequired ??
        false,

      fresh:
        state.freshnessDecision?.fresh ??
        false,
    },

    agentCardNetworkCalled:
      state.agentCardNetworkCalled ??
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

    transactionSubmitted:
      false,

    signingKeyUsed:
      false,

    persistenceUsed:
      false,

    productionActivation:
      false,
  };
}

function validateAcceptedIdentityKeyBindingResult(
  value: unknown,
  requirement:
    AgentRegistryRequirementV1,
): AgentRegistryIdentityKeyBindingResultV1 | null {
  const root =
    asRecord(
      value,
    );

  if (
    root ===
      null ||
    root.type !==
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE ||
    root.version !==
      AGENT_REGISTRY_CONTRACT_VERSION ||
    root.mode !==
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE ||
    root.ok !==
      true ||
    root.status !==
      "accepted" ||
    (
      root.reason !==
        "accepted" &&
      root.reason !==
        "accepted_without_external_key"
    ) ||
    root.testOnly !==
      true ||
    root.policy !==
      requirement.externalKeyPolicy ||
    root.baseRegistryTrustVerified !==
      true ||
    root.registryTrustPreserved !==
      true
  ) {
    return null;
  }

  const keyBinding =
    asRecord(
      root.keyBinding,
    );

  if (
    keyBinding ===
      null ||
    typeof keyBinding.required !==
      "boolean" ||
    typeof keyBinding.verified !==
      "boolean" ||
    !(
      keyBinding.bindingType ===
        null ||
      keyBinding.bindingType ===
        "CIS-8"
    ) ||
    !(
      keyBinding.keyFingerprint ===
        null ||
      isCompactString(
        keyBinding.keyFingerprint,
        2048,
      )
    )
  ) {
    return null;
  }

  if (
    requirement.externalKeyPolicy ===
      "required" &&
    (
      root.reason !==
        "accepted" ||
      keyBinding.required !==
        true ||
      keyBinding.verified !==
        true ||
      keyBinding.bindingType !==
        "CIS-8" ||
      !isCompactString(
        keyBinding.keyFingerprint,
        2048,
      )
    )
  ) {
    return null;
  }

  if (
    requirement.externalKeyPolicy ===
      "forbidden" &&
    (
      root.reason !==
        "accepted_without_external_key" ||
      keyBinding.verified !==
        false ||
      keyBinding.bindingType !==
        null ||
      keyBinding.keyFingerprint !==
        null
    )
  ) {
    return null;
  }

  const literalFalseFields = [
    "gatewayRuntimeChanged",
    "phase5StateMutated",
    "canonicalStateMutated",
    "boundedUseConsumed",
    "replayStateMutated",
    "ufxCalled",
    "crpCalled",
    "paymentAttempted",
    "receiptIssued",
    "paymentResponseEmitted",
    "resourceReleased",
    "transactionSubmitted",
    "signingKeyUsed",
    "persistenceUsed",
    "productionActivation",
  ];

  if (
    literalFalseFields.some(
      (field) =>
        root[field] !==
        false,
    )
  ) {
    return null;
  }

  return value as
    AgentRegistryIdentityKeyBindingResultV1;
}

function parseCanonicalIsoTimestamp(
  value: unknown,
): number | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const parsed =
    Date.parse(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return null;
  }

  try {
    return (
      new Date(
        parsed,
      ).toISOString() ===
      value
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function evaluateFreshness(
  requirement:
    AgentRegistryRequirementV1,
  trustResult:
    AgentRegistryTrustResultV1,
  nowMs: number,
): FreshnessEvaluationV1 {
  const freshness =
    trustResult.freshness;

  const baseDecision = {
    source:
      freshness.source,

    observedAt:
      freshness.observedAt,

    calculatedEvidenceAgeSeconds:
      null,

    suppliedEvidenceAgeSeconds:
      freshness.evidenceAgeSeconds,

    maxEvidenceAgeSeconds:
      requirement.maxEvidenceAgeSeconds,

    indexerLagBlocks:
      freshness.indexerLagBlocks,

    maxIndexerLagBlocks:
      requirement.maxIndexerLagBlocks ??
      null,

    revalidationThresholdSeconds:
      requirement
        .revalidateBeforeReleaseIfOlderThanSeconds,

    revalidationRequired:
      false,

    fresh:
      false,
  } satisfies
    AgentRegistryCardCapabilityFreshnessResultV1[
      "freshnessDecision"
    ];

  if (
    freshness.finalizedBlockHeight ===
      null ||
    freshness.finalizedBlockHash ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        baseDecision,
    };
  }

  const observedAtMs =
    parseCanonicalIsoTimestamp(
      freshness.observedAt,
    );

  if (
    observedAtMs ===
      null ||
    observedAtMs >
      nowMs
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        baseDecision,
    };
  }

  const calculatedAge =
    Math.floor(
      (
        nowMs -
        observedAtMs
      ) /
      1000,
    );

  const decisionWithAge = {
    ...baseDecision,

    calculatedEvidenceAgeSeconds:
      calculatedAge,
  };

  if (
    freshness.evidenceAgeSeconds ===
      null ||
    freshness.evidenceAgeSeconds !==
      calculatedAge
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        decisionWithAge,
    };
  }

  if (
    freshness.source ===
      "direct_chain" &&
    freshness.indexerLagBlocks !==
      null &&
    freshness.indexerLagBlocks !==
      0
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        decisionWithAge,
    };
  }

  if (
    freshness.source ===
      "auditable_resolver" &&
    requirement.maxIndexerLagBlocks !==
      undefined &&
    (
      freshness.indexerLagBlocks ===
        null ||
      freshness.indexerLagBlocks >
        requirement.maxIndexerLagBlocks
    )
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        decisionWithAge,
    };
  }

  if (
    calculatedAge >
    requirement.maxEvidenceAgeSeconds
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",

      decision:
        decisionWithAge,
    };
  }

  if (
    calculatedAge >
    requirement
      .revalidateBeforeReleaseIfOlderThanSeconds
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_revalidation_required",

      decision: {
        ...decisionWithAge,

        revalidationRequired:
          true,

        fresh:
          true,
      },
    };
  }

  return {
    ok:
      true,

    reason:
      "accepted",

    decision: {
      ...decisionWithAge,

      fresh:
        true,
    },
  };
}

function preservedBaseTrustIsUnenriched(
  trustResult:
    AgentRegistryTrustResultV1,
): boolean {
  return (
    trustResult
      .agentCard
      .integrityVerified ===
        false &&
    trustResult
      .keyBinding
      .required ===
        false &&
    trustResult
      .keyBinding
      .verified ===
        false &&
    trustResult
      .keyBinding
      .bindingType ===
        null &&
    trustResult
      .keyBinding
      .keyFingerprint ===
        null &&
    trustResult
      .capabilities
      .required
      .length ===
        0 &&
    trustResult
      .capabilities
      .satisfied
      .length ===
        0 &&
    trustResult
      .capabilities
      .missing
      .length ===
        0 &&
    trustResult
      .capabilities
      .policySatisfied ===
        true
  );
}


function validateCoreInput(
  input:
    AgentRegistryCardCapabilityFreshnessInputV1,
):
  | {
      readonly ok: true;

      readonly value:
        AgentRegistryCardCapabilityFreshnessValidatedInputV1;
    }
  | {
      readonly ok: false;

      readonly reason:
        AgentRegistryCardCapabilityFreshnessReasonV1;
    } {
  const requirementValidation =
    validateAgentRegistryRequirementV1(
      input.requirement,
    );

  if (
    requirementValidation.ok !==
      true ||
    requirementValidation.value ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_result_invalid",
    };
  }

  const requirement =
    requirementValidation.value;

  const trustValidation =
    validateAgentRegistryTrustResultV1(
      input.registryTrustResult,
    );

  if (
    trustValidation.ok !==
      true ||
    trustValidation.value ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_result_invalid",
    };
  }

  const trustResult =
    trustValidation.value;

  if (
    trustResult.verified !==
      true ||
    trustResult.reason !==
      "agent_registry_verified" ||
    trustResult.state.status !==
      "Active"
  ) {
    return {
      ok:
        false,

      reason:
        trustResult.reason,
    };
  }

  if (
    !preservedBaseTrustIsUnenriched(
      trustResult,
    )
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_result_invalid",
    };
  }

  const bindingResult =
    validateAcceptedIdentityKeyBindingResult(
      input.identityKeyBindingResult,
      requirement,
    );

  if (
    bindingResult ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_key_mismatch",
    };
  }

  const capabilityRules =
    validateCapabilityRules(
      input.capabilityRules,
    );

  if (
    capabilityRules ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_capability_scope_mismatch",
    };
  }

  const nowMs =
    parseCanonicalIsoTimestamp(
      input.now,
    );

  if (
    nowMs ===
      null
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_evidence_stale",
    };
  }

  const maxAgentCardBytes =
    input.maxAgentCardBytes ??
    DEFAULT_AGENT_CARD_MAX_BYTES;

  const fetchTimeoutMs =
    input.fetchTimeoutMs ??
    DEFAULT_AGENT_CARD_FETCH_TIMEOUT_MS;

  if (
    !isPositiveSafeInteger(
      maxAgentCardBytes,
    ) ||
    !isPositiveSafeInteger(
      fetchTimeoutMs,
    )
  ) {
    return {
      ok:
        false,

      reason:
        "agent_registry_result_invalid",
    };
  }

  if (
    input.transport !==
      undefined &&
    !isAgentCardFetchTransport(
      input.transport,
    )
  ) {
    return {
      ok:
        false,

      reason:
        "agent_card_fetch_failed",
    };
  }

  return {
    ok:
      true,

    value: {
      requirement,

      identityKeyBindingResult:
        bindingResult,

      registryTrustResult:
        trustResult,

      capabilityRules,

      nowMs,

      maxAgentCardBytes,

      fetchTimeoutMs,

      transport:
        input.transport ??
        null,
    },
  };
}

void buildCardCapabilityFreshnessResult;
void evaluateFreshness;
void validateCoreInput;


type ParsedAgentRegistrationFileV1 = {
  readonly card:
    AgentRegistrationFileSubsetV1;

  readonly skills:
    ReadonlySet<string>;

  readonly domains:
    ReadonlySet<string>;

  readonly duplicateDeclarations:
    boolean;
};

type CapabilityEvaluationV1 = {
  readonly ok: boolean;

  readonly reason:
    | "accepted"
    | "agent_capability_missing"
    | "agent_capability_scope_mismatch";

  readonly decision:
    AgentRegistryCardCapabilityFreshnessResultV1[
      "capabilityDecision"
    ];
};

function sha256LowerHex(
  bytes: Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

function isJsonCompatibleContentType(
  value: string | null,
): boolean {
  if (
    value ===
      null
  ) {
    return false;
  }

  const mediaType =
    value
      .split(
        ";",
        1,
      )[0]
      ?.trim()
      .toLowerCase();

  return (
    mediaType ===
      "application/json" ||
    (
      typeof mediaType ===
        "string" &&
      mediaType.endsWith(
        "+json",
      )
    )
  );
}

function decodeBoundedAgentCardDataUri(
  uri: string,
  maxBytes: number,
): AgentCardFetchResultV1 {
  const match =
    /^data:application\/json(?:;charset=utf-8)?;base64,([A-Za-z0-9+/]+={0,2})$/i
      .exec(
        uri,
      );

  if (
    match ===
      null
  ) {
    return buildAgentCardFetchResult({
      ok:
        false,

      status:
        "failed",

      uri,

      error:
        "data_uri_invalid",
    });
  }

  const encoded =
    match[1];

  if (
    encoded.length %
      4 !==
    0
  ) {
    return buildAgentCardFetchResult({
      ok:
        false,

      status:
        "failed",

      uri,

      error:
        "data_uri_invalid_base64",
    });
  }

  try {
    const bytes =
      Buffer.from(
        encoded,
        "base64",
      );

    if (
      bytes.byteLength ===
        0 ||
      bytes.toString(
        "base64",
      ) !==
        encoded
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri,

        error:
          "data_uri_invalid_base64",
      });
    }

    if (
      bytes.byteLength >
      maxBytes
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri,

        contentType:
          "application/json",

        error:
          "response_too_large",
      });
    }

    return buildAgentCardFetchResult({
      ok:
        true,

      status:
        "fetched",

      uri,

      bytes,

      contentType:
        "application/json",
    });
  } catch {
    return buildAgentCardFetchResult({
      ok:
        false,

      status:
        "failed",

      uri,

      error:
        "data_uri_invalid_base64",
    });
  }
}

function decodeStrictUtf8(
  bytes: Uint8Array,
): string | null {
  try {
    return new TextDecoder(
      "utf-8",
      {
        fatal:
          true,
      },
    ).decode(
      bytes,
    );
  } catch {
    return null;
  }
}

function parseOptionalCompactString(
  root: UnknownRecord,
  key: string,
  maxLength: number,
):
  | {
      readonly ok: true;

      readonly value:
        string | undefined;
    }
  | {
      readonly ok: false;
    } {
  if (
    !hasOwn(
      root,
      key,
    )
  ) {
    return {
      ok:
        true,

      value:
        undefined,
    };
  }

  if (
    !isCompactString(
      root[key],
      maxLength,
    )
  ) {
    return {
      ok:
        false,
    };
  }

  return {
    ok:
      true,

    value:
      root[key] as string,
  };
}

function parseOptionalUniqueStrings(
  root: UnknownRecord,
  key: string,
  maxEntries: number,
  maxEntryLength: number,
):
  | {
      readonly ok: true;

      readonly value:
        readonly string[] | undefined;
    }
  | {
      readonly ok: false;
    } {
  if (
    !hasOwn(
      root,
      key,
    )
  ) {
    return {
      ok:
        true,

      value:
        undefined,
    };
  }

  const value =
    root[key];

  if (
    !Array.isArray(
      value,
    ) ||
    value.length >
      maxEntries ||
    !value.every(
      (entry) =>
        isCompactString(
          entry,
          maxEntryLength,
        ),
    ) ||
    new Set(
      value,
    ).size !==
      value.length
  ) {
    return {
      ok:
        false,
    };
  }

  return {
    ok:
      true,

    value:
      value as readonly string[],
  };
}

function parseAgentRegistrationFile(
  bytes: Uint8Array,
):
  | {
      readonly ok: true;

      readonly value:
        ParsedAgentRegistrationFileV1;
    }
  | {
      readonly ok: false;
    } {
  const decoded =
    decodeStrictUtf8(
      bytes,
    );

  if (
    decoded ===
      null
  ) {
    return {
      ok:
        false,
    };
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        decoded,
      );
  } catch {
    return {
      ok:
        false,
    };
  }

  const root =
    asRecord(
      parsed,
    );

  if (
    root ===
      null ||
    root.type !==
      AGENT_REGISTRATION_FILE_TYPE ||
    !isCompactString(
      root.name,
      512,
    )
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    hasOwn(
      root,
      "x402Support",
    ) &&
    typeof root.x402Support !==
      "boolean"
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    hasOwn(
      root,
      "active",
    ) &&
    typeof root.active !==
      "boolean"
  ) {
    return {
      ok:
        false,
    };
  }

  const supportedTrust =
    parseOptionalUniqueStrings(
      root,
      "supportedTrust",
      64,
      512,
    );

  if (
    supportedTrust.ok !==
      true
  ) {
    return {
      ok:
        false,
    };
  }

  const servicesValue =
    hasOwn(
      root,
      "services",
    )
      ? root.services
      : undefined;

  if (
    servicesValue !==
      undefined &&
    (
      !Array.isArray(
        servicesValue,
      ) ||
      servicesValue.length >
        128
    )
  ) {
    return {
      ok:
        false,
    };
  }

  const services:
    AgentRegistrationFileServiceSubsetV1[] = [];

  const skills =
    new Set<string>();

  const domains =
    new Set<string>();

  let duplicateDeclarations =
    false;

  for (
    const candidate
    of (
      servicesValue ??
      []
    ) as readonly unknown[]
  ) {
    const service =
      asRecord(
        candidate,
      );

    if (
      service ===
        null ||
      !isCompactString(
        service.name,
        512,
      )
    ) {
      return {
        ok:
          false,
      };
    }

    const endpoint =
      parseOptionalCompactString(
        service,
        "endpoint",
        4096,
      );

    const version =
      parseOptionalCompactString(
        service,
        "version",
        256,
      );

    const serviceSkills =
      parseOptionalUniqueStrings(
        service,
        "skills",
        256,
        2048,
      );

    const serviceDomains =
      parseOptionalUniqueStrings(
        service,
        "domains",
        256,
        2048,
      );

    if (
      endpoint.ok !==
        true ||
      version.ok !==
        true ||
      serviceSkills.ok !==
        true ||
      serviceDomains.ok !==
        true
    ) {
      return {
        ok:
          false,
      };
    }

    for (
      const skill
      of serviceSkills.value ??
        []
    ) {
      if (
        skills.has(
          skill,
        )
      ) {
        duplicateDeclarations =
          true;
      }

      skills.add(
        skill,
      );
    }

    for (
      const domain
      of serviceDomains.value ??
        []
    ) {
      if (
        domains.has(
          domain,
        )
      ) {
        duplicateDeclarations =
          true;
      }

      domains.add(
        domain,
      );
    }

    services.push({
      name:
        service.name,

      ...(
        endpoint.value ===
          undefined
          ? {}
          : {
              endpoint:
                endpoint.value,
            }
      ),

      ...(
        version.value ===
          undefined
          ? {}
          : {
              version:
                version.value,
            }
      ),

      ...(
        serviceSkills.value ===
          undefined
          ? {}
          : {
              skills:
                serviceSkills.value,
            }
      ),

      ...(
        serviceDomains.value ===
          undefined
          ? {}
          : {
              domains:
                serviceDomains.value,
            }
      ),
    });
  }

  const card:
    AgentRegistrationFileSubsetV1 = {
      type:
        AGENT_REGISTRATION_FILE_TYPE,

      name:
        root.name,

      ...(
        servicesValue ===
          undefined
          ? {}
          : {
              services,
            }
      ),

      ...(
        hasOwn(
          root,
          "x402Support",
        )
          ? {
              x402Support:
                root.x402Support as boolean,
            }
          : {}
      ),

      ...(
        hasOwn(
          root,
          "active",
        )
          ? {
              active:
                root.active as boolean,
            }
          : {}
      ),

      ...(
        supportedTrust.value ===
          undefined
          ? {}
          : {
              supportedTrust:
                supportedTrust.value,
            }
      ),
    };

  return {
    ok:
      true,

    value: {
      card,

      skills,

      domains,

      duplicateDeclarations,
    },
  };
}

function evaluateCapabilities(
  required:
    readonly string[],
  rules:
    readonly AgentCardCapabilityRuleV1[],
  parsed:
    ParsedAgentRegistrationFileV1,
): CapabilityEvaluationV1 {
  const emptyDecision = {
    required:
      [...required],

    satisfied:
      [],

    missing:
      [...required],

    policySatisfied:
      false,
  };

  if (
    parsed.duplicateDeclarations
  ) {
    return {
      ok:
        false,

      reason:
        "agent_capability_scope_mismatch",

      decision:
        emptyDecision,
    };
  }

  if (
    rules.length !==
      required.length ||
    rules.some(
      (rule) =>
        !required.includes(
          rule.capabilityId,
        ),
    ) ||
    required.some(
      (capability) =>
        rules.filter(
          (rule) =>
            rule.capabilityId ===
            capability,
        ).length !==
          1,
    )
  ) {
    return {
      ok:
        false,

      reason:
        "agent_capability_scope_mismatch",

      decision:
        emptyDecision,
    };
  }

  const satisfied:
    string[] = [];

  const missing:
    string[] = [];

  for (
    const capability
    of required
  ) {
    const rule =
      rules.find(
        (candidate) =>
          candidate.capabilityId ===
          capability,
      );

    if (
      rule ===
        undefined
    ) {
      return {
        ok:
          false,

        reason:
          "agent_capability_scope_mismatch",

        decision:
          emptyDecision,
      };
    }

    let present =
      false;

    if (
      rule.source ===
      "x402_support"
    ) {
      present =
        parsed.card.x402Support ===
        true;
    } else if (
      rule.source ===
      "oasf_skill"
    ) {
      present =
        parsed.skills.has(
          rule.skill,
        );
    } else {
      present =
        parsed.domains.has(
          rule.domain,
        );
    }

    if (
      present
    ) {
      satisfied.push(
        capability,
      );
    } else {
      missing.push(
        capability,
      );
    }
  }

  const policySatisfied =
    missing.length ===
    0;

  return {
    ok:
      policySatisfied,

    reason:
      policySatisfied
        ? "accepted"
        : "agent_capability_missing",

    decision: {
      required:
        [...required],

      satisfied,

      missing,

      policySatisfied,
    },
  };
}

function validateAgentCardFetchResult(
  value: unknown,
  expectedUri: string,
  maxBytes: number,
): AgentCardFetchResultV1 | null {
  const root =
    asRecord(
      value,
    );

  if (
    root ===
      null ||
    root.type !==
      AGENT_CARD_FETCH_RESULT_TYPE ||
    root.version !==
      AGENT_REGISTRY_CONTRACT_VERSION ||
    typeof root.ok !==
      "boolean" ||
    (
      root.status !==
        "fetched" &&
      root.status !==
        "failed"
    ) ||
    root.uri !==
      expectedUri ||
    !(
      root.bytes ===
        null ||
      root.bytes instanceof
        Uint8Array
    ) ||
    !(
      root.contentType ===
        null ||
      typeof root.contentType ===
        "string"
    ) ||
    !(
      root.httpStatus ===
        null ||
      (
        Number.isSafeInteger(
          root.httpStatus,
        ) &&
        (
          root.httpStatus as number
        ) >=
          100 &&
        (
          root.httpStatus as number
        ) <=
          599
      )
    ) ||
    typeof root.redirected !==
      "boolean" ||
    typeof root.timedOut !==
      "boolean" ||
    !(
      root.error ===
        null ||
      isCompactString(
        root.error,
        2048,
      )
    )
  ) {
    return null;
  }

  if (
    root.ok ===
      true &&
    (
      root.status !==
        "fetched" ||
      !(root.bytes instanceof
        Uint8Array) ||
      root.bytes.byteLength ===
        0 ||
      root.bytes.byteLength >
        maxBytes ||
      root.redirected !==
        false ||
      root.timedOut !==
        false ||
      root.error !==
        null ||
      !isJsonCompatibleContentType(
        root.contentType as string | null,
      )
    )
  ) {
    return null;
  }

  if (
    root.ok ===
      false &&
    (
      root.status !==
        "failed" ||
      root.bytes !==
        null
    )
  ) {
    return null;
  }

  return value as
    AgentCardFetchResultV1;
}

void sha256LowerHex;
void decodeBoundedAgentCardDataUri;
void parseAgentRegistrationFile;
void evaluateCapabilities;
void validateAgentCardFetchResult;


type AgentCardUriClassificationV1 =
  | {
      readonly ok: true;

      readonly kind:
        "data" | "https";

      readonly uri: string;
    }
  | {
      readonly ok: false;
    };

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

function trustedRegistryMatchesResult(
  requirement:
    AgentRegistryRequirementV1,
  trustResult:
    AgentRegistryTrustResultV1,
): boolean {
  return requirement.trustedRegistries.some(
    (trusted) =>
      trusted.network ===
        trustResult.identity.network &&
      sameContractCoordinate(
        trusted.contract,
        trustResult.identity.registryContract,
      ) &&
      (
        trusted.moduleReference ===
          undefined ||
        trusted.moduleReference ===
          trustResult.identity.moduleReference
      ),
  );
}

function bindingAndTrustAreCoherent(
  requirement:
    AgentRegistryRequirementV1,
  binding:
    AgentRegistryIdentityKeyBindingResultV1,
  trustResult:
    AgentRegistryTrustResultV1,
): boolean {
  if (
    !trustedRegistryMatchesResult(
      requirement,
      trustResult,
    ) ||
    !preservedBaseTrustIsUnenriched(
      trustResult,
    ) ||
    binding.bindingEvaluated !==
      true ||
    binding.baseRegistryTrustVerified !==
      true ||
    binding.registryTrustPreserved !==
      true ||
    binding.agentTokenId !==
      trustResult.identity.agentTokenId ||
    binding.ownerAccount !==
      trustResult.state.ownerAccount ||
    trustResult.state.status !==
      requirement.requiredStatus
  ) {
    return false;
  }

  if (
    requirement.requireOwnerAccountBinding ===
      true &&
    (
      trustResult.state.ownerAccountBound !==
        true ||
      trustResult.state.ownerAccount ===
        null
    )
  ) {
    return false;
  }

  if (
    requirement.requireVerifiedOwnerIdentity ===
      true &&
    trustResult.state.ownerIdentityAssurance !==
      "verified"
  ) {
    return false;
  }

  const bindingKey =
    binding.keyBinding;

  if (
    requirement.externalKeyPolicy ===
      "required"
  ) {
    return (
      binding.reason ===
        "accepted" &&
      binding.externalReferencePresent ===
        true &&
      binding.sameSnapshot ===
        true &&
      binding.cis8LookupAttempted ===
        true &&
      binding.cis8RegistrationActive ===
        true &&
      bindingKey.required ===
        true &&
      bindingKey.verified ===
        true &&
      bindingKey.bindingType ===
        "CIS-8" &&
      bindingKey.keyFingerprint !==
        null
    );
  }

  if (
    requirement.externalKeyPolicy ===
      "forbidden"
  ) {
    return (
      binding.reason ===
        "accepted_without_external_key" &&
      binding.externalReferencePresent ===
        false &&
      binding.cis8LookupAttempted ===
        false &&
      binding.cis8RegistrationActive ===
        false &&
      bindingKey.required ===
        false &&
      bindingKey.verified ===
        false &&
      bindingKey.bindingType ===
        null &&
      bindingKey.keyFingerprint ===
        null
    );
  }

  if (
    binding.reason ===
      "accepted_without_external_key"
  ) {
    return (
      binding.externalReferencePresent ===
        false &&
      binding.cis8LookupAttempted ===
        false &&
      binding.cis8RegistrationActive ===
        false &&
      bindingKey.required ===
        false &&
      bindingKey.verified ===
        false &&
      bindingKey.bindingType ===
        null &&
      bindingKey.keyFingerprint ===
        null
    );
  }

  return (
    binding.reason ===
      "accepted" &&
    binding.externalReferencePresent ===
      true &&
    binding.sameSnapshot ===
      true &&
    binding.cis8LookupAttempted ===
      true &&
    binding.cis8RegistrationActive ===
      true &&
    bindingKey.required ===
      false &&
    bindingKey.verified ===
      true &&
    bindingKey.bindingType ===
      "CIS-8" &&
    bindingKey.keyFingerprint !==
      null
  );
}


function classifyAgentCardUri(
  value: string,
): AgentCardUriClassificationV1 {
  if (
    value.startsWith(
      "data:",
    )
  ) {
    return {
      ok:
        true,

      kind:
        "data",

      uri:
        value,
    };
  }

  let parsed:
    URL;

  try {
    parsed =
      new URL(
        value,
      );
  } catch {
    return {
      ok:
        false,
    };
  }

  if (
    parsed.protocol !==
      "https:" ||
    parsed.username !==
      "" ||
    parsed.password !==
      "" ||
    parsed.hash !==
      ""
  ) {
    return {
      ok:
        false,
    };
  }

  return {
    ok:
      true,

    kind:
      "https",

    uri:
      parsed.toString(),
  };
}

void bindingAndTrustAreCoherent;
void classifyAgentCardUri;


export async function verifyAgentRegistryCardCapabilityFreshnessV1(
  input:
    AgentRegistryCardCapabilityFreshnessInputV1,
): Promise<AgentRegistryCardCapabilityFreshnessResultV1> {
  const validated =
    validateCoreInput(
      input,
    );

  if (
    validated.ok !==
      true
  ) {
    return buildCardCapabilityFreshnessResult({
      reason:
        validated.reason,
    });
  }

  const {
    requirement,
    identityKeyBindingResult,
    registryTrustResult,
    capabilityRules,
    nowMs,
    maxAgentCardBytes,
    fetchTimeoutMs,
    transport,
  } =
    validated.value;

  const baseState = {
    requirementValidated:
      true,

    baseRegistryTrustVerified:
      true,

    identityKeyBindingAccepted:
      true,

    registryTrustPreserved:
      true,

    trustResult:
      registryTrustResult,

    identityKeyBinding:
      identityKeyBindingResult,

    capabilityDecision: {
      required:
        [...requirement.requiredCapabilities],

      satisfied:
        [],

      missing:
        [...requirement.requiredCapabilities],

      policySatisfied:
        false,
    },
  };

  if (
    !bindingAndTrustAreCoherent(
      requirement,
      identityKeyBindingResult,
      registryTrustResult,
    )
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      identityKeyBindingAccepted:
        false,

      registryTrustPreserved:
        false,

      reason:
        "agent_registry_key_mismatch",
    });
  }

  const freshness =
    evaluateFreshness(
      requirement,
      registryTrustResult,
      nowMs,
    );

  if (
    freshness.reason ===
      "agent_registry_revalidation_required"
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        freshness.reason,

      freshnessDecision:
        freshness.decision,
    });
  }

  if (
    freshness.ok !==
      true
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        freshness.reason,

      freshnessDecision:
        freshness.decision,
    });
  }

  const fetchRequired =
    requirement.requireAgentCardIntegrity ===
      true ||
    requirement.requiredCapabilities.length >
      0;

  if (
    fetchRequired ===
      false
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "accepted_without_agent_card",

      cardEvidence: {
        fetchRequired:
          false,

        fetchAttempted:
          false,

        uri:
          registryTrustResult.agentCard.uri,

        expectedHash:
          registryTrustResult.agentCard.hash,

        integrityVerified:
          false,
      },

      capabilityDecision: {
        required:
          [],

        satisfied:
          [],

        missing:
          [],

        policySatisfied:
          true,
      },

      freshnessDecision:
        freshness.decision,
    });
  }

  const uri =
    registryTrustResult.agentCard.uri;

  const expectedHash =
    registryTrustResult.agentCard.hash;

  const cardBase = {
    fetchRequired:
      true,

    fetchAttempted:
      false,

    uri,

    expectedHash,

    actualHash:
      null,

    byteLength:
      null,

    schemaType:
      null,

    integrityVerified:
      false,
  };

  if (
    uri ===
      null ||
    expectedHash ===
      null
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_card_missing",

      cardEvidence:
        cardBase,

      freshnessDecision:
        freshness.decision,
    });
  }

  const classifiedUri =
    classifyAgentCardUri(
      uri,
    );

  if (
    classifiedUri.ok !==
      true
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_card_fetch_failed",

      cardEvidence:
        cardBase,

      freshnessDecision:
        freshness.decision,
    });
  }

  let rawFetch:
    unknown;

  let agentCardNetworkCalled =
    false;

  if (
    classifiedUri.kind ===
      "data"
  ) {
    rawFetch =
      decodeBoundedAgentCardDataUri(
        classifiedUri.uri,
        maxAgentCardBytes,
      );
  } else {
    if (
      transport ===
        null
    ) {
      return buildCardCapabilityFreshnessResult({
        ...baseState,

        reason:
          "agent_card_fetch_failed",

        cardEvidence:
          cardBase,

        freshnessDecision:
          freshness.decision,
      });
    }

    agentCardNetworkCalled =
      transport.kind ===
      AGENT_CARD_HTTPS_TRANSPORT_KIND;

    try {
      rawFetch =
        await transport.read({
          uri:
            classifiedUri.uri,

          maxBytes:
            maxAgentCardBytes,

          timeoutMs:
            fetchTimeoutMs,
        });
    } catch {
      return buildCardCapabilityFreshnessResult({
        ...baseState,

        reason:
          "agent_card_fetch_failed",

        cardEvidence: {
          ...cardBase,

          fetchAttempted:
            true,
        },

        freshnessDecision:
          freshness.decision,

        agentCardNetworkCalled,
      });
    }
  }

  const fetchResult =
    validateAgentCardFetchResult(
      rawFetch,
      classifiedUri.uri,
      maxAgentCardBytes,
    );

  if (
    fetchResult ===
      null ||
    fetchResult.ok !==
      true ||
    fetchResult.bytes ===
      null
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_card_fetch_failed",

      cardEvidence: {
        ...cardBase,

        fetchAttempted:
          true,
      },

      freshnessDecision:
        freshness.decision,

      agentCardNetworkCalled,
    });
  }

  const bytes =
    Uint8Array.from(
      fetchResult.bytes,
    );

  const actualHash =
    sha256LowerHex(
      bytes,
    );

  const fetchedCardEvidence = {
    ...cardBase,

    fetchAttempted:
      true,

    actualHash,

    byteLength:
      bytes.byteLength,
  };

  if (
    actualHash !==
      expectedHash
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_card_hash_mismatch",

      cardEvidence:
        fetchedCardEvidence,

      freshnessDecision:
        freshness.decision,

      agentCardNetworkCalled,
    });
  }

  const parsed =
    parseAgentRegistrationFile(
      bytes,
    );

  if (
    parsed.ok !==
      true
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_card_fetch_failed",

      cardEvidence: {
        ...fetchedCardEvidence,

        integrityVerified:
          true,
      },

      freshnessDecision:
        freshness.decision,

      agentCardNetworkCalled,
    });
  }

  const verifiedCardEvidence = {
    ...fetchedCardEvidence,

    schemaType:
      parsed.value.card.type,

    integrityVerified:
      true,
  };

  if (
    parsed.value.card.active ===
      false
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        "agent_registry_status_invalid",

      cardEvidence:
        verifiedCardEvidence,

      freshnessDecision:
        freshness.decision,

      agentCardNetworkCalled,
    });
  }

  const capabilities =
    evaluateCapabilities(
      requirement.requiredCapabilities,
      capabilityRules,
      parsed.value,
    );

  if (
    capabilities.ok !==
      true
  ) {
    return buildCardCapabilityFreshnessResult({
      ...baseState,

      reason:
        capabilities.reason,

      cardEvidence:
        verifiedCardEvidence,

      capabilityDecision:
        capabilities.decision,

      freshnessDecision:
        freshness.decision,

      agentCardNetworkCalled,
    });
  }

  return buildCardCapabilityFreshnessResult({
    ...baseState,

    reason:
      "accepted",

    cardEvidence:
      verifiedCardEvidence,

    capabilityDecision:
      capabilities.decision,

    freshnessDecision:
      freshness.decision,

    agentCardNetworkCalled,
  });
}


async function cancelAgentCardBodyQuietly(
  body:
    ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (
    body ===
      null
  ) {
    return;
  }

  try {
    await body.cancel();
  } catch {
    // Read-only cleanup failure does not alter the transport decision.
  }
}

function combineAgentCardChunks(
  chunks:
    readonly Uint8Array[],
  totalBytes: number,
): Uint8Array {
  const combined =
    new Uint8Array(
      totalBytes,
    );

  let offset =
    0;

  for (
    const chunk
    of chunks
  ) {
    combined.set(
      chunk,
      offset,
    );

    offset +=
      chunk.byteLength;
  }

  return combined;
}

export class HttpsAgentCardFetchTransportV1
implements AgentCardFetchTransportV1 {
  readonly kind =
    AGENT_CARD_HTTPS_TRANSPORT_KIND;

  constructor(
    private readonly fetchImpl:
      typeof fetch =
        globalThis.fetch,
  ) {}

  async read(
    request:
      AgentCardFetchRequestV1,
  ): Promise<AgentCardFetchResultV1> {
    if (
      !isPositiveSafeInteger(
        request.maxBytes,
      ) ||
      !isPositiveSafeInteger(
        request.timeoutMs,
      )
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        error:
          "invalid_fetch_request",
      });
    }

    let parsed:
      URL;

    try {
      parsed =
        new URL(
          request.uri,
        );
    } catch {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        error:
          "invalid_https_uri",
      });
    }

    if (
      parsed.protocol !==
        "https:" ||
      parsed.username !==
        "" ||
      parsed.password !==
        "" ||
      parsed.hash !==
        ""
    ) {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          request.uri,

        error:
          "invalid_https_uri",
      });
    }

    const normalizedUri =
      parsed.toString();

    const controller =
      new AbortController();

    let timeoutTriggered =
      false;

    const timer =
      setTimeout(
        () => {
          timeoutTriggered =
            true;

          controller.abort();
        },
        request.timeoutMs,
      );

    try {
      const response =
        await this.fetchImpl(
          normalizedUri,
          {
            method:
              "GET",

            redirect:
              "manual",

            credentials:
              "omit",

            headers: {
              accept:
                "application/json, application/*+json",
            },

            signal:
              controller.signal,
          },
        );

      const httpStatus =
        response.status;

      const contentType =
        response.headers.get(
          "content-type",
        );

      const redirected =
        response.redirected ||
        (
          httpStatus >=
            300 &&
          httpStatus <=
            399
        );

      if (
        redirected
      ) {
        await cancelAgentCardBodyQuietly(
          response.body,
        );

        return buildAgentCardFetchResult({
          ok:
            false,

          status:
            "failed",

          uri:
            normalizedUri,

          contentType,

          httpStatus,

          redirected:
            true,

          error:
            "redirect_not_allowed",
        });
      }

      if (
        httpStatus <
          200 ||
        httpStatus >
          299
      ) {
        await cancelAgentCardBodyQuietly(
          response.body,
        );

        return buildAgentCardFetchResult({
          ok:
            false,

          status:
            "failed",

          uri:
            normalizedUri,

          contentType,

          httpStatus,

          error:
            "http_status_not_success",
        });
      }

      if (
        !isJsonCompatibleContentType(
          contentType,
        )
      ) {
        await cancelAgentCardBodyQuietly(
          response.body,
        );

        return buildAgentCardFetchResult({
          ok:
            false,

          status:
            "failed",

          uri:
            normalizedUri,

          contentType,

          httpStatus,

          error:
            "content_type_not_json",
        });
      }

      const contentLengthHeader =
        response.headers.get(
          "content-length",
        );

      if (
        contentLengthHeader !==
          null
      ) {
        if (
          !/^(0|[1-9][0-9]*)$/.test(
            contentLengthHeader,
          )
        ) {
          await cancelAgentCardBodyQuietly(
            response.body,
          );

          return buildAgentCardFetchResult({
            ok:
              false,

            status:
              "failed",

            uri:
              normalizedUri,

            contentType,

            httpStatus,

            error:
              "content_length_invalid",
          });
        }

        const declaredLength =
          Number(
            contentLengthHeader,
          );

        if (
          !Number.isSafeInteger(
            declaredLength,
          )
        ) {
          await cancelAgentCardBodyQuietly(
            response.body,
          );

          return buildAgentCardFetchResult({
            ok:
              false,

            status:
              "failed",

            uri:
              normalizedUri,

            contentType,

            httpStatus,

            error:
              "content_length_invalid",
          });
        }

        if (
          declaredLength >
          request.maxBytes
        ) {
          await cancelAgentCardBodyQuietly(
            response.body,
          );

          return buildAgentCardFetchResult({
            ok:
              false,

            status:
              "failed",

            uri:
              normalizedUri,

            contentType,

            httpStatus,

            error:
              "response_too_large",
          });
        }
      }

      if (
        response.body ===
          null
      ) {
        return buildAgentCardFetchResult({
          ok:
            false,

          status:
            "failed",

          uri:
            normalizedUri,

          contentType,

          httpStatus,

          error:
            "response_body_missing",
        });
      }

      const reader =
        response.body.getReader();

      const chunks:
        Uint8Array[] = [];

      let totalBytes =
        0;

      while (
        true
      ) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (
          done
        ) {
          break;
        }

        const chunk =
          Uint8Array.from(
            value,
          );

        totalBytes +=
          chunk.byteLength;

        if (
          totalBytes >
          request.maxBytes
        ) {
          try {
            await reader.cancel();
          } catch {
            // The size decision remains fail-closed.
          }

          return buildAgentCardFetchResult({
            ok:
              false,

            status:
              "failed",

            uri:
              normalizedUri,

            contentType,

            httpStatus,

            error:
              "response_too_large",
          });
        }

        chunks.push(
          chunk,
        );
      }

      if (
        totalBytes ===
          0
      ) {
        return buildAgentCardFetchResult({
          ok:
            false,

          status:
            "failed",

          uri:
            normalizedUri,

          contentType,

          httpStatus,

          error:
            "response_body_empty",
        });
      }

      return buildAgentCardFetchResult({
        ok:
          true,

        status:
          "fetched",

        uri:
          normalizedUri,

        bytes:
          combineAgentCardChunks(
            chunks,
            totalBytes,
          ),

        contentType,

        httpStatus,
      });
    } catch {
      return buildAgentCardFetchResult({
        ok:
          false,

        status:
          "failed",

        uri:
          normalizedUri,

        timedOut:
          timeoutTriggered,

        error:
          timeoutTriggered
            ? "fetch_timeout"
            : "fetch_exception",
      });
    } finally {
      clearTimeout(
        timer,
      );
    }
  }
}
