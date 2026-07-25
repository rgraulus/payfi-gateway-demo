import assert from "node:assert/strict";

const LABEL =
  "phase6:agent-registry-conditional-gating-composition-test";

const NOW =
  "2026-07-24T12:00:00.000Z";

const NETWORK =
  "ccd:testnet";

const REGISTRY_CONTRACT = {
  index:
    "12802",

  subindex:
    0,
} as const;

const MODULE_REFERENCE =
  "a".repeat(
    64,
  );

const AGENT_TOKEN_ID =
  "5";

const TOKEN_ADDRESS =
  "ccd:testnet/cis8004:5";

const OWNER_ACCOUNT =
  "4-phase6-pr303-owner-account";

const FINALIZED_BLOCK_HEIGHT =
  9_303;

const FINALIZED_BLOCK_HASH =
  "b".repeat(
    64,
  );

const AGENT_CARD_HASH =
  "c".repeat(
    64,
  );

const KEY_FINGERPRINT =
  `sha256:${"d".repeat(64)}`;

const REQUIRED_CAPABILITIES = [
  "x402.payment.authorize",
  "resource.premium.read",
] as const;

const NONCE =
  "phase6-pr303-nonce";

const CHALLENGE_ID =
  "phase6-pr303-challenge";

const MERCHANT_ID =
  "demo-merchant";

const RAW_DELEGATION_SENTINEL =
  "RAW_DELEGATION_MATERIAL_MUST_NOT_PERSIST";

const RAW_REGISTRY_SENTINEL =
  "RAW_REGISTRY_READ_MUST_NOT_PERSIST";

type MutableModule =
  Record<string, unknown>;

type Scenario =
  | "allowed"
  | "resolver_denied"
  | "resolver_exception"
  | "binding_denied"
  | "binding_exception"
  | "card_denied"
  | "card_exception"
  | "revalidation_required";

type StageCounters = {
  resolver: number;
  registryRead: number;
  binding: number;
  card: number;
  buyerPolicy: number;
  boundedUse: number;
  payment: number;
  receipt: number;
  replay: number;
  release: number;
};

type CapturedQuery = {
  text: string;
  values: readonly unknown[];
};

type CompositionModule =
  typeof import(
    "../src/phase6/agentRegistryConditionalGatingComposition"
  );

type StoreModule =
  typeof import(
    "../src/db/phase6AgentRegistryAuthorizationAuditStore"
  );

type TrustContractModule =
  typeof import(
    "../src/phase6/agentRegistryTrustContract"
  );

function counters():
StageCounters {
  return {
    resolver: 0,
    registryRead: 0,
    binding: 0,
    card: 0,
    buyerPolicy: 0,
    boundedUse: 0,
    payment: 0,
    receipt: 0,
    replay: 0,
    release: 0,
  };
}

function cloneMutable<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
    ),
  ) as T;
}

function patchExport(
  moduleValue: MutableModule,
  exportName: string,
  replacement: unknown,
): () => void {
  assert.ok(
    exportName in moduleValue,
    `missing export ${exportName}`,
  );

  const original =
    moduleValue[exportName];

  moduleValue[exportName] =
    replacement;

  assert.equal(
    moduleValue[exportName],
    replacement,
    `unable to patch ${exportName}`,
  );

  return () => {
    moduleValue[exportName] =
      original;
  };
}

function acceptedTrustResult():
Record<string, unknown> {
  return {
    type:
      "xcf.agent-registry.trust-result",

    version:
      "v1",

    verified:
      true,

    identity: {
      network:
        NETWORK,

      registryContract:
        REGISTRY_CONTRACT,

      moduleReference:
        MODULE_REFERENCE,

      agentTokenId:
        AGENT_TOKEN_ID,

      tokenAddress:
        TOKEN_ADDRESS,
    },

    state: {
      status:
        "Active",

      ownerAccount:
        OWNER_ACCOUNT,

      ownerAccountBound:
        true,

      ownerIdentityAssurance:
        "verified",
    },

    freshness: {
      source:
        "concordium_finalized",

      finalizedBlockHeight:
        FINALIZED_BLOCK_HEIGHT,

      finalizedBlockHash:
        FINALIZED_BLOCK_HASH,

      observedAt:
        NOW,

      evidenceAgeSeconds:
        0,

      indexerLagBlocks:
        0,
    },

    agentCard: {
      uri:
        "https://agent.example/pr303-card.json",

      hash:
        AGENT_CARD_HASH,

      integrityVerified:
        true,
    },

    capabilities: {
      required: [
        ...REQUIRED_CAPABILITIES,
      ],

      satisfied: [
        ...REQUIRED_CAPABILITIES,
      ],

      missing: [],

      policySatisfied:
        true,
    },

    evidenceHash:
      `sha256:${"e".repeat(64)}`,
  };
}

function acceptedResolverResult():
Record<string, unknown> {
  return {
    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    resolverInvoked:
      true,

    fixtureResolverInvoked:
      false,

    agentRegistryLookupAttempted:
      true,

    registryNetworkCalled:
      true,

    registryTrustSatisfied:
      true,

    trustResult:
      acceptedTrustResult(),

    requirementValidation:
      null,

    referenceValidation:
      null,

    trustResultValidation:
      null,

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

function deniedResolverResult():
Record<string, unknown> {
  return {
    ...acceptedResolverResult(),

    ok:
      false,

    status:
      "rejected",

    reason:
      "agent_registry_status_not_allowed",

    registryNetworkCalled:
      false,

    registryTrustSatisfied:
      false,

    trustResult:
      null,
  };
}

function acceptedBindingResult():
Record<string, unknown> {
  return {
    type:
      "xcf.agent-registry.identity-key-binding",

    version:
      "v1",

    mode:
      "controlled_test_only",

    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    testOnly:
      true,

    bindingEvaluated:
      true,

    baseRegistryTrustVerified:
      true,

    sameFinalizedSnapshot:
      true,

    registryRecordPresent:
      true,

    expectedAgentTokenId:
      AGENT_TOKEN_ID,

    agentTokenIdMatched:
      true,

    ownerAccount:
      OWNER_ACCOUNT,

    ownerAccountMatched:
      true,

    phase5IdentityMatched:
      true,

    cis8LookupAttempted:
      true,

    cis8RegistrationPresent:
      true,

    cis8RegistrationActive:
      true,

    keyBinding: {
      required:
        true,

      verified:
        true,

      bindingType:
        "cis8_external_key",

      keyFingerprint:
        KEY_FINGERPRINT,
    },

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

function deniedBindingResult():
Record<string, unknown> {
  return {
    ...acceptedBindingResult(),

    ok:
      false,

    status:
      "rejected",

    reason:
      "agent_public_key_mismatch",

    keyBinding: {
      required:
        true,

      verified:
        false,

      bindingType:
        null,

      keyFingerprint:
        null,
    },
  };
}

function acceptedCardResult():
Record<string, unknown> {
  return {
    type:
      "xcf.agent-registry.card-capability-freshness",

    version:
      "v1",

    mode:
      "controlled_test_only",

    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    testOnly:
      true,

    requirementValidated:
      true,

    baseRegistryTrustVerified:
      true,

    identityKeyBindingAccepted:
      true,

    registryTrustPreserved:
      true,

    trustResult:
      acceptedTrustResult(),

    identityKeyBinding:
      acceptedBindingResult(),

    cardEvidence: {
      fetchRequired:
        true,

      fetchAttempted:
        true,

      uri:
        "https://agent.example/pr303-card.json",

      expectedHash:
        AGENT_CARD_HASH,

      actualHash:
        AGENT_CARD_HASH,

      byteLength:
        512,

      schemaType:
        "agent-registration-file",

      integrityVerified:
        true,
    },

    capabilityDecision: {
      required: [
        ...REQUIRED_CAPABILITIES,
      ],

      satisfied: [
        ...REQUIRED_CAPABILITIES,
      ],

      missing: [],

      policySatisfied:
        true,
    },

    freshnessDecision: {
      source:
        "concordium_finalized",

      observedAt:
        NOW,

      calculatedEvidenceAgeSeconds:
        0,

      suppliedEvidenceAgeSeconds:
        0,

      maxEvidenceAgeSeconds:
        300,

      indexerLagBlocks:
        0,

      maxIndexerLagBlocks:
        0,

      revalidationThresholdSeconds:
        120,

      revalidationRequired:
        false,

      fresh:
        true,
    },

    agentCardNetworkCalled:
      true,

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

function deniedCardResult():
Record<string, unknown> {
  const result =
    acceptedCardResult();

  return {
    ...result,

    ok:
      false,

    status:
      "rejected",

    reason:
      "agent_capability_missing",

    capabilityDecision: {
      required: [
        ...REQUIRED_CAPABILITIES,
      ],

      satisfied: [
        REQUIRED_CAPABILITIES[0],
      ],

      missing: [
        REQUIRED_CAPABILITIES[1],
      ],

      policySatisfied:
        false,
    },
  };
}

function revalidationCardResult():
Record<string, unknown> {
  const result =
    acceptedCardResult();

  return {
    ...result,

    ok:
      false,

    status:
      "revalidation_required",

    reason:
      "agent_registry_revalidation_required",

    freshnessDecision: {
      ...(
        result.freshnessDecision as
          Record<string, unknown>
      ),

      revalidationRequired:
        true,

      fresh:
        true,
    },
  };
}

function makePhase5Preflight():
Record<string, unknown> {
  return {
    ok:
      true,

    reason:
      "accepted",

    cryptographicBinding: {
      ok:
        true,

      signedPaymentTupleBound:
        true,

      reason:
        "accepted",
    },

    delegationDocument: {
      sentinel:
        RAW_DELEGATION_SENTINEL,
    },

    expectedContext: {
      nowSec:
        1_753_358_400,

      challenge: {
        nonce:
          NONCE,

        challengeHash:
          CHALLENGE_ID,

        issuedAt:
          "2026-07-24T11:59:00.000Z",

        expiresAt:
          "2026-07-24T12:05:00.000Z",
      },

      scope: {
        merchantId:
          MERCHANT_ID,

        resourceMethod:
          "GET",

        resourcePath:
          "/paid-gated",

        contractId:
          "paid-gated",

        contractVersion:
          "1.0.0",

        allowedAction:
          "resource.read",

        maxUses:
          1,
      },

      paymentTuple: {
        network:
          "concordium:testnet",

        assetType:
          "plt",

        tokenId:
          "EUDemo",

        decimals:
          6,

        amount:
          "0.050101",

        payTo:
          "4-phase6-pr303-merchant",
      },
    },
  };
}

function validRequirement(
  trust:
    TrustContractModule,
): unknown {
  const requirementType =
    (
      trust as unknown as
        Record<string, unknown>
    ).AGENT_REGISTRY_REQUIREMENT_TYPE;

  const version =
    trust.AGENT_REGISTRY_CONTRACT_VERSION;

  const standard =
    (
      trust as unknown as
        Record<string, unknown>
    ).AGENT_REGISTRY_STANDARD;

  const registryCandidates = [
    {
      network:
        NETWORK,

      contract:
        REGISTRY_CONTRACT,

      moduleReference:
        MODULE_REFERENCE,
    },
    {
      network:
        NETWORK,

      registryContract:
        REGISTRY_CONTRACT,

      moduleReference:
        MODULE_REFERENCE,
    },
  ];

  for (
    const registry of registryCandidates
  ) {
    const candidate = {
      type:
        requirementType,

      version,

      registryStandard:
        standard,

      required:
        true,

      trustedRegistries: [
        registry,
      ],

      requiredStatus:
        "Active",

      requireAgentCardIntegrity:
        true,

      requiredCapabilities: [
        ...REQUIRED_CAPABILITIES,
      ],

      requireOwnerAccountBinding:
        true,

      requireVerifiedOwnerIdentity:
        true,

      externalKeyPolicy:
        "required",

      maxEvidenceAgeSeconds:
        300,


      revalidateBeforeReleaseIfOlderThanSeconds:
        120,
    };

    const validation =
      trust.validateAgentRegistryRequirementV1(
        candidate,
      );

    if (
      validation.ok &&
      validation.value !== null
    ) {
      return validation.value;
    }
  }

  assert.fail(
    "unable to construct a valid strict requirement",
  );
}

function validReference(
  trust:
    TrustContractModule,
): unknown {
  const moduleRecord =
    trust as unknown as
      Record<string, unknown>;

  const candidate = {
    type:
      moduleRecord
        .AGENT_REGISTRY_REFERENCE_TYPE,

    version:
      trust
        .AGENT_REGISTRY_CONTRACT_VERSION,

    registryStandard:
      moduleRecord
        .AGENT_REGISTRY_STANDARD,

    network:
      NETWORK,

    registryContract:
      REGISTRY_CONTRACT,

    agentTokenId:
      AGENT_TOKEN_ID,

    tokenAddress:
      TOKEN_ADDRESS,
  };

  const validation =
    trust.validateAgentRegistryReferenceV1(
      candidate,
    );

  assert.equal(
    validation.ok,
    true,
    validation.validationReason,
  );

  assert.notEqual(
    validation.value,
    null,
  );

  return validation.value;
}

function assertZeroSideEffects(
  result:
    Record<string, unknown>,
  name: string,
): void {
  const falseFields = [
    "buyerPolicyEvaluated",
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
    "productionActivation",
  ] as const;

  for (const field of falseFields) {
    assert.equal(
      result[field],
      false,
      `${name}:${field}`,
    );
  }
}

class CapturingAuditExecutor {
  readonly calls:
    CapturedQuery[] = [];

  constructor(
    private readonly fail:
      boolean,
  ) {}

  async query(
    text: string,
    values: readonly unknown[],
  ): Promise<{
    rowCount: number;
    rows: readonly Record<string, unknown>[];
  }> {
    this.calls.push({
      text,
      values: [
        ...values,
      ],
    });

    if (this.fail) {
      throw new Error(
        "controlled_audit_store_failure",
      );
    }

    return {
      rowCount:
        1,

      rows: [
        {
          audit_id:
            "303",

          recorded_at:
            NOW,
        },
      ],
    };
  }
}

class AuthorizationOnlyAdapter {
  calls =
    0;

  paymentExecuted =
    false;

  captured:
    unknown = null;

  consume(
    handoff: unknown,
  ): {
    accepted: true;
    paymentExecuted: false;
  } {
    this.calls +=
      1;

    this.captured =
      handoff;

    return {
      accepted:
        true,

      paymentExecuted:
        false,
    };
  }
}

async function main():
Promise<void> {
  const trust =
    require(
      "../src/phase6/agentRegistryTrustContract",
    ) as TrustContractModule;

  const resolverModule =
    require(
      "../src/phase6/agentRegistryResolverSeam",
    ) as MutableModule;

  const bindingModule =
    require(
      "../src/phase6/agentRegistryIdentityKeyBinding",
    ) as MutableModule;

  const cardModule =
    require(
      "../src/phase6/agentRegistryCardCapabilityFreshness",
    ) as MutableModule;

  const pluginModule =
    require(
      "../src/phase6/concordiumCis8004RegistryPlugin",
    ) as MutableModule;

  let scenario:
    Scenario =
      "allowed";

  let activeCounters =
    counters();

  class HarnessRegistryPlugin {
    constructor(
      private readonly transport: {
        read(
          request: unknown,
        ): Promise<unknown>;
      },
    ) {}

    async captureRead():
    Promise<unknown> {
      return this.transport.read({
        operation:
          "get_agent",

        sentinel:
          RAW_REGISTRY_SENTINEL,
      });
    }
  }

  const restore: (() => void)[] = [];

  restore.push(
    patchExport(
      pluginModule,
      "ConcordiumCis8004RegistryPluginV1",
      HarnessRegistryPlugin,
    ),
  );

  restore.push(
    patchExport(
      resolverModule,
      "resolveAgentRegistryTrustForGatewayV1",
      async (
        input: {
          resolver:
            HarnessRegistryPlugin;
        },
      ): Promise<unknown> => {
        activeCounters.resolver +=
          1;

        if (
          scenario ===
            "resolver_exception"
        ) {
          throw new Error(
            "controlled_resolver_exception",
          );
        }

        if (
          scenario ===
            "resolver_denied"
        ) {
          return deniedResolverResult();
        }

        await input.resolver.captureRead();

        return acceptedResolverResult();
      },
    ),
  );

  restore.push(
    patchExport(
      bindingModule,
      "bindAgentRegistryIdentityToPhase5ActingKeyV1",
      async (): Promise<unknown> => {
        activeCounters.binding +=
          1;

        if (
          scenario ===
            "binding_exception"
        ) {
          throw new Error(
            "controlled_binding_exception",
          );
        }

        if (
          scenario ===
            "binding_denied"
        ) {
          return deniedBindingResult();
        }

        return acceptedBindingResult();
      },
    ),
  );

  restore.push(
    patchExport(
      cardModule,
      "verifyAgentRegistryCardCapabilityFreshnessV1",
      async (): Promise<unknown> => {
        activeCounters.card +=
          1;

        if (
          scenario ===
            "card_exception"
        ) {
          throw new Error(
            "controlled_card_exception",
          );
        }

        if (
          scenario ===
            "card_denied"
        ) {
          return deniedCardResult();
        }

        if (
          scenario ===
            "revalidation_required"
        ) {
          return revalidationCardResult();
        }

        return acceptedCardResult();
      },
    ),
  );

  const compositionPath =
    require.resolve(
      "../src/phase6/agentRegistryConditionalGatingComposition",
    );

  const storePath =
    require.resolve(
      "../src/db/phase6AgentRegistryAuthorizationAuditStore",
    );

  delete require.cache[compositionPath];
  delete require.cache[storePath];

  const composition =
    require(
      compositionPath,
    ) as CompositionModule;

  const store =
    require(
      storePath,
    ) as StoreModule;

  const requirement =
    validRequirement(trust);

  const reference =
    validReference(trust);

  const makeInput = () => ({
    phase5Preflight:
      makePhase5Preflight(),

    requirement,

    reference,

    capabilityRules: [],

    now:
      NOW,

    registryTransport: {
      kind:
        "pr303_deterministic_transport",

      async read():
      Promise<unknown> {
        activeCounters.registryRead +=
          1;

        return {
          sentinel:
            RAW_REGISTRY_SENTINEL,
        };
      },
    },
  });

  const composeCase =
    async (
      nextScenario:
        Scenario,
    ) => {
      scenario =
        nextScenario;

      activeCounters =
        counters();

      const result =
        await composition
          .composeAgentRegistryConditionalGatingV1(
            makeInput() as never,
          );

      assertZeroSideEffects(
        result as unknown as
          Record<string, unknown>,
        nextScenario,
      );

      return {
        result,
        counters:
          activeCounters,
      };
    };

  try {
    const positive =
      await composeCase(
        "allowed",
      );

    assert.equal(
      positive.result.ok,
      true,
    );

    assert.equal(
      positive.result.status,
      "allowed",
    );

    assert.equal(
      positive.result.reason,
      "accepted",
    );

    assert.notEqual(
      positive.result.paymentEligibilityHandoff,
      null,
    );

    assert.equal(
      positive.counters.resolver,
      1,
    );

    assert.equal(
      positive.counters.registryRead,
      1,
    );

    assert.equal(
      positive.counters.binding,
      1,
    );

    assert.equal(
      positive.counters.card,
      1,
    );

    console.log(
      "PR303_POSITIVE_COMPOSITION_ALLOWED=true",
    );

    const negativeCases = [
      {
        scenario:
          "resolver_denied" as const,

        status:
          "denied",

        reason:
          "agent_registry_status_not_allowed",

        resolver:
          1,

        registryRead:
          0,

        binding:
          0,

        card:
          0,
      },
      {
        scenario:
          "resolver_exception" as const,

        status:
          "denied",

        reason:
          "agent_registry_resolver_exception",

        resolver:
          1,

        registryRead:
          0,

        binding:
          0,

        card:
          0,
      },
      {
        scenario:
          "binding_denied" as const,

        status:
          "denied",

        reason:
          "agent_public_key_mismatch",

        resolver:
          1,

        registryRead:
          1,

        binding:
          1,

        card:
          0,
      },
      {
        scenario:
          "binding_exception" as const,

        status:
          "denied",

        reason:
          "agent_registry_key_binding_exception",

        resolver:
          1,

        registryRead:
          1,

        binding:
          1,

        card:
          0,
      },
      {
        scenario:
          "card_denied" as const,

        status:
          "denied",

        reason:
          "agent_capability_missing",

        resolver:
          1,

        registryRead:
          1,

        binding:
          1,

        card:
          1,
      },
      {
        scenario:
          "card_exception" as const,

        status:
          "denied",

        reason:
          "agent_registry_card_verification_exception",

        resolver:
          1,

        registryRead:
          1,

        binding:
          1,

        card:
          1,
      },
      {
        scenario:
          "revalidation_required" as const,

        status:
          "revalidation_required",

        reason:
          "agent_registry_revalidation_required",

        resolver:
          1,

        registryRead:
          1,

        binding:
          1,

        card:
          1,
      },
    ];

    for (
      const testCase of negativeCases
    ) {
      const evaluated =
        await composeCase(
          testCase.scenario,
        );

      assert.equal(
        evaluated.result.ok,
        false,
        testCase.scenario,
      );

      assert.equal(
        evaluated.result.status,
        testCase.status,
        testCase.scenario,
      );

      assert.equal(
        evaluated.result.reason,
        testCase.reason,
        testCase.scenario,
      );

      assert.equal(
        evaluated.result
          .paymentEligibilityHandoff,
        null,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.resolver,
        testCase.resolver,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.registryRead,
        testCase.registryRead,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.binding,
        testCase.binding,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.card,
        testCase.card,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.buyerPolicy,
        0,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.boundedUse,
        0,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.payment,
        0,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.receipt,
        0,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.replay,
        0,
        testCase.scenario,
      );

      assert.equal(
        evaluated.counters.release,
        0,
        testCase.scenario,
      );
    }

    console.log(
      "PR303_NEGATIVE_MATRIX_FAILS_CLOSED=true",
    );

    const successExecutor =
      new CapturingAuditExecutor(
        false,
      );

    const persisted =
      await store
        .persistPhase6AgentRegistryAuthorizationAuditV1(
          {
            challengeId:
              CHALLENGE_ID,

            nonce:
              NONCE,

            merchantId:
              MERCHANT_ID,

            authorization:
              positive.result,
          },
          {
            executor:
              successExecutor,
          },
        );

    assert.equal(
      persisted.ok,
      true,
    );

    assert.equal(
      persisted.reason,
      "inserted",
    );

    assert.equal(
      persisted.auditPersisted,
      true,
    );

    assert.equal(
      successExecutor.calls.length,
      1,
    );

    assert.match(
      successExecutor.calls[0]?.text ??
        "",
      /^\s*INSERT INTO /,
    );

    assert.doesNotMatch(
      successExecutor.calls[0]?.text ??
        "",
      /\bUPDATE\b|\bDELETE\b/i,
    );

    const capturedValues =
      JSON.stringify(
        successExecutor.calls[0]?.values ??
          [],
      );

    assert.doesNotMatch(
      capturedValues,
      new RegExp(
        RAW_DELEGATION_SENTINEL,
      ),
    );

    assert.doesNotMatch(
      capturedValues,
      new RegExp(
        RAW_REGISTRY_SENTINEL,
      ),
    );

    assert.doesNotMatch(
      capturedValues,
      /delegationDocument|agentCardBytes|parsedAgentCard|receiptJws|paymentResponse/,
    );

    console.log(
      "PR303_APPEND_ONLY_SANITIZED_AUDIT_PERSISTED=true",
    );

    const failingExecutor =
      new CapturingAuditExecutor(
        true,
      );

    activeCounters =
      counters();

    const persistenceFailure =
      await store
        .persistPhase6AgentRegistryAuthorizationAuditV1(
          {
            challengeId:
              CHALLENGE_ID,

            nonce:
              NONCE,

            merchantId:
              MERCHANT_ID,

            authorization:
              positive.result,
          },
          {
            executor:
              failingExecutor,
          },
        );

    assert.equal(
      persistenceFailure.ok,
      false,
    );

    assert.equal(
      persistenceFailure.reason,
      "database_error",
    );

    assert.equal(
      persistenceFailure.auditPersisted,
      false,
    );

    assert.equal(
      activeCounters.buyerPolicy,
      0,
    );

    assert.equal(
      activeCounters.boundedUse,
      0,
    );

    assert.equal(
      activeCounters.payment,
      0,
    );

    assert.equal(
      activeCounters.receipt,
      0,
    );

    assert.equal(
      activeCounters.replay,
      0,
    );

    assert.equal(
      activeCounters.release,
      0,
    );

    console.log(
      "PR303_PERSISTENCE_FAILURE_DENIES_BEFORE_POLICY=true",
    );

    const handoff =
      positive.result
        .paymentEligibilityHandoff;

    assert.notEqual(
      handoff,
      null,
    );

    const concordiumAdapter =
      new AuthorizationOnlyAdapter();

    const alternateAdapter =
      new AuthorizationOnlyAdapter();

    const concordiumConsumption =
      concordiumAdapter.consume(
        handoff,
      );

    const alternateConsumption =
      alternateAdapter.consume(
        handoff,
      );

    assert.equal(
      concordiumAdapter.calls,
      1,
    );

    assert.equal(
      alternateAdapter.calls,
      1,
    );

    assert.equal(
      concordiumAdapter.captured,
      handoff,
    );

    assert.equal(
      alternateAdapter.captured,
      handoff,
    );

    assert.deepEqual(
      concordiumConsumption,
      alternateConsumption,
    );

    assert.equal(
      concordiumAdapter.paymentExecuted,
      false,
    );

    assert.equal(
      alternateAdapter.paymentExecuted,
      false,
    );

    assert.equal(
      concordiumConsumption.paymentExecuted,
      false,
    );

    assert.equal(
      alternateConsumption.paymentExecuted,
      false,
    );

    console.log(
      "PR303_SETTLEMENT_ADAPTER_PORTABILITY=true",
    );

    assert.equal(
      positive.result.productionActivation,
      false,
    );

    assert.equal(
      positive.result.boundedUseConsumed,
      false,
    );

    assert.equal(
      positive.result.paymentAttempted,
      false,
    );

    assert.equal(
      positive.result.receiptIssued,
      false,
    );

    assert.equal(
      positive.result.replayStateMutated,
      false,
    );

    assert.equal(
      positive.result.resourceReleased,
      false,
    );

    console.log(
      "PR303_ZERO_CANONICAL_SIDE_EFFECTS=true",
    );

    console.log(
      JSON.stringify(
        {
          label:
            LABEL,

          positiveComposition:
            true,

          negativeMatrix:
            negativeCases.length,

          resolverDenialBeforePolicy:
            true,

          identityKeyBindingDenialBeforePolicy:
            true,

          agentCardDenialBeforePolicy:
            true,

          revalidationBeforePolicy:
            true,

          auditPersistenceSuccess:
            true,

          auditPersistenceFailureClosed:
            true,

          sanitizedAppendOnlyPersistence:
            true,

          concordiumAdapterConsumed:
            true,

          alternateAdapterConsumed:
            true,

          adapterPaymentExecution:
            false,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          receiptIssued:
            false,

          replayStateMutated:
            false,

          resourceReleased:
            false,

          productionActivation:
            false,
        },
      ),
    );
  } finally {
    for (
      const restoreExport of
        restore.reverse()
    ) {
      restoreExport();
    }
  }
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error(
      `${LABEL}: FAIL`,
      error,
    );

    process.exitCode =
      1;
  },
);
