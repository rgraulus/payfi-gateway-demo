import assert from "node:assert/strict";

import {
  createHash,
} from "node:crypto";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REQUIREMENT_TYPE,
  AGENT_REGISTRY_STANDARD,
  AGENT_REGISTRY_TRUST_RESULT_TYPE,
  validateAgentRegistryRequirementV1,
  validateAgentRegistryTrustResultV1,
} from "../src/phase6/agentRegistryTrustContract";

import {
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

import {
  AGENT_REGISTRATION_FILE_TYPE,
  DeterministicAgentCardFetchTransportV1,
  HttpsAgentCardFetchTransportV1,
  verifyAgentRegistryCardCapabilityFreshnessV1,
} from "../src/phase6/agentRegistryCardCapabilityFreshness";

import type {
  AgentCardCapabilityRuleV1,
  AgentRegistryCardCapabilityFreshnessInputV1,
} from "../src/phase6/agentRegistryCardCapabilityFreshness";

const NOW =
  "2026-07-24T12:00:00.000Z";

const AGENT_CARD_URI =
  "https://agent.example/card.json";

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

const FINALIZED_BLOCK_HASH =
  "b".repeat(
    64,
  );

const AGENT_TOKEN_ID =
  "5";

const TOKEN_ADDRESS =
  "ccd:testnet/cis8004:5";

const OWNER_ACCOUNT =
  "4-owner-account-phase6";

const KEY_FINGERPRINT =
  `sha256:${"d".repeat(64)}`;

const REQUIRED_CAPABILITIES = [
  "x402.payment.authorize",
  "resource.premium.read",
] as const;

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

function cloneMutable<T>(
  value: T,
): T {
  return JSON.parse(
    JSON.stringify(
      value,
    ),
  ) as T;
}

function makeAgentCard(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type:
      AGENT_REGISTRATION_FILE_TYPE,

    name:
      "PR302 deterministic agent",

    x402Support:
      true,

    active:
      true,

    services: [
      {
        name:
          "premium-resource",

        endpoint:
          "https://agent.example/service",

        version:
          "1.0.0",

        skills: [
          "resource.premium.read",
        ],

        domains: [
          "payments",
        ],
      },
    ],

    supportedTrust: [
      "reputation",
    ],

    ...overrides,
  };
}

function encodeAgentCard(
  overrides:
    Record<string, unknown> = {},
): Uint8Array {
  return Buffer.from(
    JSON.stringify(
      makeAgentCard(
        overrides,
      ),
    ),
    "utf8",
  );
}

function makeRequirement(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type:
      AGENT_REGISTRY_REQUIREMENT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    required:
      true,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    trustedRegistries: [
      {
        network:
          NETWORK,

        contract:
          REGISTRY_CONTRACT,

        moduleReference:
          MODULE_REFERENCE,
      },
    ],

    requiredStatus:
      "Active",

    requireAgentCardIntegrity:
      true,

    requiredCapabilities:
      [...REQUIRED_CAPABILITIES],

    requireOwnerAccountBinding:
      true,

    requireVerifiedOwnerIdentity:
      false,

    externalKeyPolicy:
      "required",

    maxEvidenceAgeSeconds:
      300,

    revalidateBeforeReleaseIfOlderThanSeconds:
      120,

    ...overrides,
  };
}

function makeRegistryTrustResult(
  cardHash: string,
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type:
      AGENT_REGISTRY_TRUST_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    verified:
      true,

    reason:
      "agent_registry_verified",

    registryStandard:
      AGENT_REGISTRY_STANDARD,

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
        "not_evaluated",

      agentWallet:
        null,
    },

    agentCard: {
      uri:
        AGENT_CARD_URI,

      hash:
        cardHash,

      integrityVerified:
        false,
    },

    keyBinding: {
      required:
        false,

      verified:
        false,

      bindingType:
        null,

      keyFingerprint:
        null,
    },

    capabilities: {
      required: [],

      satisfied: [],

      missing: [],

      policySatisfied:
        true,
    },

    freshness: {
      source:
        "direct_chain",

      finalizedBlockHeight:
        123456,

      finalizedBlockHash:
        FINALIZED_BLOCK_HASH,

      observedAt:
        "2026-07-24T11:59:50.000Z",

      evidenceAgeSeconds:
        10,

      indexerLagBlocks:
        0,

      fresh:
        true,
    },

    evidenceHash:
      null,

    ...overrides,
  };
}

function makeIdentityKeyBindingResult(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type:
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    mode:
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,

    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    testOnly:
      true,

    policy:
      "required",

    bindingEvaluated:
      true,

    baseRegistryTrustVerified:
      true,

    registryTrustPreserved:
      true,

    credentialHash:
      `sha256:${"e".repeat(64)}`,

    agentId:
      "agent:demo:001",

    agentKeyId:
      "agent-key-demo-001",

    agentTokenId:
      AGENT_TOKEN_ID,

    ownerAccount:
      OWNER_ACCOUNT,

    externalReferencePresent:
      true,

    sameSnapshot:
      true,

    cis8LookupAttempted:
      true,

    cis8RegistrationActive:
      true,

    keyBinding: {
      required:
        true,

      verified:
        true,

      bindingType:
        "CIS-8",

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

    ...overrides,
  };
}

function makeCapabilityRules():
  readonly AgentCardCapabilityRuleV1[] {
  return [
    {
      capabilityId:
        "x402.payment.authorize",

      source:
        "x402_support",

      expected:
        true,
    },
    {
      capabilityId:
        "resource.premium.read",

      source:
        "oasf_skill",

      skill:
        "resource.premium.read",
    },
  ];
}

function makeInput(
  cardBytes:
    Uint8Array,

  overrides:
    Partial<
      AgentRegistryCardCapabilityFreshnessInputV1
    > = {},
): AgentRegistryCardCapabilityFreshnessInputV1 {
  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  const transport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          cardBytes,

        contentType:
          "application/json",
      },
    });

  return {
    requirement:
      makeRequirement(),

    identityKeyBindingResult:
      makeIdentityKeyBindingResult(),

    registryTrustResult:
      makeRegistryTrustResult(
        cardHash,
      ),

    capabilityRules:
      makeCapabilityRules(),

    now:
      NOW,

    transport,

    ...overrides,
  };
}

function assertSafety(
  result:
    Awaited<
      ReturnType<
        typeof verifyAgentRegistryCardCapabilityFreshnessV1
      >
    >,
): void {
  const falseFields = [
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
  ] as const;

  for (
    const field
    of falseFields
  ) {
    assert.equal(
      result[field],
      false,
      field,
    );
  }
}

function makeFreshness(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    source:
      "direct_chain",

    finalizedBlockHeight:
      123456,

    finalizedBlockHash:
      FINALIZED_BLOCK_HASH,

    observedAt:
      "2026-07-24T11:59:50.000Z",

    evidenceAgeSeconds:
      10,

    indexerLagBlocks:
      0,

    fresh:
      true,

    ...overrides,
  };
}

async function runFreshnessCases(
  cardBytes:
    Uint8Array,
): Promise<void> {
  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  const atThresholdInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  observedAt:
                    "2026-07-24T11:58:00.000Z",

                  evidenceAgeSeconds:
                    120,
                }),
            },
          ),
      },
    );

  const atThresholdTransport =
    atThresholdInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const atThreshold =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      atThresholdInput,
    );

  assert.equal(
    atThreshold.ok,
    true,
  );

  assert.equal(
    atThreshold.reason,
    "accepted",
  );

  assert.equal(
    atThreshold.freshnessDecision.revalidationRequired,
    false,
  );

  assert.equal(
    atThresholdTransport.calls.length,
    1,
  );

  console.log(
    "PR302_B2B_REVALIDATION_THRESHOLD_PASSES=true",
  );

  const revalidationInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  observedAt:
                    "2026-07-24T11:57:59.000Z",

                  evidenceAgeSeconds:
                    121,
                }),
            },
          ),
      },
    );

  const revalidationTransport =
    revalidationInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const revalidation =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      revalidationInput,
    );

  assert.equal(
    revalidation.ok,
    false,
  );

  assert.equal(
    revalidation.status,
    "revalidation_required",
  );

  assert.equal(
    revalidation.reason,
    "agent_registry_revalidation_required",
  );

  assert.equal(
    revalidation.freshnessDecision.revalidationRequired,
    true,
  );

  assert.equal(
    revalidationTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_REVALIDATION_REQUIRED_ZERO_FETCH=true",
  );

  const staleInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  observedAt:
                    "2026-07-24T11:54:59.000Z",

                  evidenceAgeSeconds:
                    301,
                }),
            },
          ),
      },
    );

  const staleTransport =
    staleInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const stale =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      staleInput,
    );

  assert.equal(
    stale.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    staleTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_HARD_MAXIMUM_ZERO_FETCH=true",
  );

  const futureInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  observedAt:
                    "2026-07-24T12:00:01.000Z",

                  evidenceAgeSeconds:
                    0,
                }),
            },
          ),
      },
    );

  const futureTransport =
    futureInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const future =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      futureInput,
    );

  assert.equal(
    future.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    futureTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_FUTURE_OBSERVATION_REJECTED=true",
  );

  const ageMismatchInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  evidenceAgeSeconds:
                    11,
                }),
            },
          ),
      },
    );

  const ageMismatchTransport =
    ageMismatchInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const ageMismatch =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      ageMismatchInput,
    );

  assert.equal(
    ageMismatch.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    ageMismatchTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_CALCULATED_AGE_MISMATCH_REJECTED=true",
  );

  const directLagInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  indexerLagBlocks:
                    1,
                }),
            },
          ),
      },
    );

  const directLagTransport =
    directLagInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const directLag =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      directLagInput,
    );

  assert.equal(
    directLag.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    directLagTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_DIRECT_CHAIN_POSITIVE_LAG_REJECTED=true",
  );

  const resolverAtThresholdInput =
    makeInput(
      cardBytes,
      {
        requirement:
          makeRequirement({
            maxIndexerLagBlocks:
              3,
          }),

        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  source:
                    "auditable_resolver",

                  indexerLagBlocks:
                    3,
                }),
            },
          ),
      },
    );

  const resolverAtThresholdTransport =
    resolverAtThresholdInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const resolverAtThreshold =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      resolverAtThresholdInput,
    );

  assert.equal(
    resolverAtThreshold.ok,
    true,
  );

  assert.equal(
    resolverAtThreshold.reason,
    "accepted",
  );

  assert.equal(
    resolverAtThresholdTransport.calls.length,
    1,
  );

  console.log(
    "PR302_B2B_RESOLVER_LAG_THRESHOLD_PASSES=true",
  );

  const resolverMissingLagInput =
    makeInput(
      cardBytes,
      {
        requirement:
          makeRequirement({
            maxIndexerLagBlocks:
              3,
          }),

        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  source:
                    "auditable_resolver",

                  indexerLagBlocks:
                    null,
                }),
            },
          ),
      },
    );

  const resolverMissingLagTransport =
    resolverMissingLagInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const resolverMissingLag =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      resolverMissingLagInput,
    );

  assert.equal(
    resolverMissingLag.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    resolverMissingLagTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_RESOLVER_MISSING_LAG_REJECTED=true",
  );

  const resolverExcessLagInput =
    makeInput(
      cardBytes,
      {
        requirement:
          makeRequirement({
            maxIndexerLagBlocks:
              3,
          }),

        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              freshness:
                makeFreshness({
                  source:
                    "auditable_resolver",

                  indexerLagBlocks:
                    4,
                }),
            },
          ),
      },
    );

  const resolverExcessLagTransport =
    resolverExcessLagInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const resolverExcessLag =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      resolverExcessLagInput,
    );

  assert.equal(
    resolverExcessLag.reason,
    "agent_registry_evidence_stale",
  );

  assert.equal(
    resolverExcessLagTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2B_RESOLVER_EXCESS_LAG_REJECTED=true",
  );
}

async function verifyCapabilityCard(
  card:
    Record<string, unknown>,

  requirement:
    Record<string, unknown>,

  capabilityRules:
    unknown,
): Promise<{
  readonly result:
    Awaited<
      ReturnType<
        typeof verifyAgentRegistryCardCapabilityFreshnessV1
      >
    >;

  readonly transport:
    DeterministicAgentCardFetchTransportV1;
}> {
  const cardBytes =
    Buffer.from(
      JSON.stringify(
        card,
      ),
      "utf8",
    );

  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  const transport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          cardBytes,

        contentType:
          "application/json",
      },
    });

  const result =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement,

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          cardHash,
        ),

      capabilityRules,

      now:
        NOW,

      transport,
    });

  return {
    result,
    transport,
  };
}

async function runCapabilityCases(): Promise<void> {
  const missingMapping =
    await verifyCapabilityCard(
      makeAgentCard(),
      makeRequirement(),
      [
        {
          capabilityId:
            "x402.payment.authorize",

          source:
            "x402_support",

          expected:
            true,
        },
      ],
    );

  assert.equal(
    missingMapping.result.reason,
    "agent_capability_scope_mismatch",
  );

  assert.equal(
    missingMapping.transport.calls.length,
    1,
  );

  console.log(
    "PR302_B2C_MISSING_MAPPING_REJECTED=true",
  );

  const duplicateRules = [
    {
      capabilityId:
        "x402.payment.authorize",

      source:
        "x402_support",

      expected:
        true,
    },
    {
      capabilityId:
        "x402.payment.authorize",

      source:
        "x402_support",

      expected:
        true,
    },
  ];

  const duplicateMapping =
    await verifyCapabilityCard(
      makeAgentCard(),
      makeRequirement(),
      duplicateRules,
    );

  assert.equal(
    duplicateMapping.result.reason,
    "agent_capability_scope_mismatch",
  );

  assert.equal(
    duplicateMapping.transport.calls.length,
    0,
  );

  console.log(
    "PR302_B2C_DUPLICATE_MAPPING_REJECTED=true",
  );

  const unsupportedMapping =
    await verifyCapabilityCard(
      makeAgentCard(),
      makeRequirement(),
      [
        {
          capabilityId:
            "x402.payment.authorize",

          source:
            "endpoint",

          endpoint:
            "https://agent.example/service",
        },
        {
          capabilityId:
            "resource.premium.read",

          source:
            "oasf_skill",

          skill:
            "resource.premium.read",
        },
      ],
    );

  assert.equal(
    unsupportedMapping.result.reason,
    "agent_capability_scope_mismatch",
  );

  assert.equal(
    unsupportedMapping.transport.calls.length,
    0,
  );

  console.log(
    "PR302_B2C_UNSUPPORTED_MAPPING_REJECTED=true",
  );

  const x402Missing =
    await verifyCapabilityCard(
      makeAgentCard({
        x402Support:
          false,
      }),
      makeRequirement(),
      makeCapabilityRules(),
    );

  assert.equal(
    x402Missing.result.reason,
    "agent_capability_missing",
  );

  assert.deepEqual(
    x402Missing.result.capabilityDecision.missing,
    [
      "x402.payment.authorize",
    ],
  );

  console.log(
    "PR302_B2C_X402_FALSE_REJECTED=true",
  );

  const caseSubstitution =
    await verifyCapabilityCard(
      makeAgentCard({
        services: [
          {
            name:
              "premium-resource",

            skills: [
              "Resource.Premium.Read",
            ],
          },
        ],
      }),
      makeRequirement(),
      makeCapabilityRules(),
    );

  assert.equal(
    caseSubstitution.result.reason,
    "agent_capability_missing",
  );

  assert.deepEqual(
    caseSubstitution.result.capabilityDecision.missing,
    [
      "resource.premium.read",
    ],
  );

  console.log(
    "PR302_B2C_CASE_SUBSTITUTION_REJECTED=true",
  );

  const prefixSubstitution =
    await verifyCapabilityCard(
      makeAgentCard({
        services: [
          {
            name:
              "premium-resource",

            skills: [
              "prefix.resource.premium.read",
            ],
          },
        ],
      }),
      makeRequirement(),
      makeCapabilityRules(),
    );

  assert.equal(
    prefixSubstitution.result.reason,
    "agent_capability_missing",
  );

  console.log(
    "PR302_B2C_PREFIX_SUBSTITUTION_REJECTED=true",
  );

  const duplicateDeclarations =
    await verifyCapabilityCard(
      makeAgentCard({
        services: [
          {
            name:
              "first",

            skills: [
              "resource.premium.read",
            ],
          },
          {
            name:
              "second",

            skills: [
              "resource.premium.read",
            ],
          },
        ],
      }),
      makeRequirement(),
      makeCapabilityRules(),
    );

  assert.equal(
    duplicateDeclarations.result.reason,
    "agent_capability_scope_mismatch",
  );

  console.log(
    "PR302_B2C_DUPLICATE_DECLARATION_REJECTED=true",
  );

  const endpointInference =
    await verifyCapabilityCard(
      makeAgentCard({
        name:
          "Agent can read premium resources",

        services: [
          {
            name:
              "resource.premium.read",

            endpoint:
              "https://agent.example/resource.premium.read",
          },
        ],
      }),
      makeRequirement(),
      makeCapabilityRules(),
    );

  assert.equal(
    endpointInference.result.reason,
    "agent_capability_missing",
  );

  assert.deepEqual(
    endpointInference.result.capabilityDecision.missing,
    [
      "resource.premium.read",
    ],
  );

  console.log(
    "PR302_B2C_ENDPOINT_DESCRIPTION_NOT_AUTHORITY=true",
  );

  const domainRequirement =
    makeRequirement({
      requiredCapabilities: [
        "resource.payments.domain",
      ],
    });

  const domainRules = [
    {
      capabilityId:
        "resource.payments.domain",

      source:
        "oasf_domain",

      domain:
        "payments",
    },
  ];

  const domainSuccess =
    await verifyCapabilityCard(
      makeAgentCard(),
      domainRequirement,
      domainRules,
    );

  assert.equal(
    domainSuccess.result.ok,
    true,
  );

  assert.equal(
    domainSuccess.result.reason,
    "accepted",
  );

  assert.deepEqual(
    domainSuccess.result.capabilityDecision.satisfied,
    [
      "resource.payments.domain",
    ],
  );

  console.log(
    "PR302_B2C_DOMAIN_MAPPING_SUCCESS=true",
  );

  const domainSubstitution =
    await verifyCapabilityCard(
      makeAgentCard({
        services: [
          {
            name:
              "premium-resource",

            domains: [
              "Payments",
            ],
          },
        ],
      }),
      domainRequirement,
      domainRules,
    );

  assert.equal(
    domainSubstitution.result.reason,
    "agent_capability_missing",
  );

  console.log(
    "PR302_B2C_DOMAIN_CASE_SUBSTITUTION_REJECTED=true",
  );
}

async function runAgentCardFailureCases(
  canonicalCardBytes:
    Uint8Array,
): Promise<void> {
  const canonicalHash =
    sha256LowerHex(
      canonicalCardBytes,
    );

  const missingUri =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      ...makeInput(
        canonicalCardBytes,
      ),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
          {
            agentCard: {
              uri:
                null,

              hash:
                canonicalHash,

              integrityVerified:
                false,
            },
          },
        ),
    });

  assert.equal(
    missingUri.reason,
    "agent_card_missing",
  );

  assert.equal(
    missingUri.cardEvidence.fetchAttempted,
    false,
  );

  console.log(
    "PR302_B2D_MISSING_URI_REJECTED=true",
  );

  const missingHash =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      ...makeInput(
        canonicalCardBytes,
      ),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
          {
            agentCard: {
              uri:
                AGENT_CARD_URI,

              hash:
                null,

              integrityVerified:
                false,
            },
          },
        ),
    });

  assert.equal(
    missingHash.reason,
    "agent_card_missing",
  );

  assert.equal(
    missingHash.cardEvidence.fetchAttempted,
    false,
  );

  console.log(
    "PR302_B2D_MISSING_HASH_REJECTED=true",
  );

  const unsupportedTransport =
    new DeterministicAgentCardFetchTransportV1({});

  const unsupportedScheme =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
          {
            agentCard: {
              uri:
                "http://agent.example/card.json",

              hash:
                canonicalHash,

              integrityVerified:
                false,
            },
          },
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        unsupportedTransport,
    });

  assert.equal(
    unsupportedScheme.reason,
    "agent_card_fetch_failed",
  );

  assert.equal(
    unsupportedTransport.calls.length,
    0,
  );

  console.log(
    "PR302_B2D_UNSUPPORTED_URI_SCHEME_REJECTED=true",
  );

  const newlineBytes =
    Buffer.concat([
      Buffer.from(
        canonicalCardBytes,
      ),
      Buffer.from(
        "\n",
        "utf8",
      ),
    ]);

  const newlineTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          newlineBytes,
      },
    });

  const newlineSubstitution =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        newlineTransport,
    });

  assert.equal(
    newlineSubstitution.reason,
    "agent_card_hash_mismatch",
  );

  assert.equal(
    newlineSubstitution.cardEvidence.integrityVerified,
    false,
  );

  console.log(
    "PR302_B2D_TRAILING_NEWLINE_SUBSTITUTION_REJECTED=true",
  );

  const equivalentJsonBytes =
    Buffer.from(
      JSON.stringify({
        active:
          true,

        x402Support:
          true,

        name:
          "PR302 deterministic agent",

        type:
          AGENT_REGISTRATION_FILE_TYPE,

        supportedTrust: [
          "reputation",
        ],

        services: [
          {
            domains: [
              "payments",
            ],

            skills: [
              "resource.premium.read",
            ],

            version:
              "1.0.0",

            endpoint:
              "https://agent.example/service",

            name:
              "premium-resource",
          },
        ],
      }),
      "utf8",
    );

  assert.notEqual(
    sha256LowerHex(
      equivalentJsonBytes,
    ),
    canonicalHash,
  );

  const equivalentTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          equivalentJsonBytes,
      },
    });

  const equivalentSubstitution =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        equivalentTransport,
    });

  assert.equal(
    equivalentSubstitution.reason,
    "agent_card_hash_mismatch",
  );

  console.log(
    "PR302_B2D_EQUIVALENT_JSON_SUBSTITUTION_REJECTED=true",
  );

  const malformedJsonBytes =
    Buffer.from(
      '{"type":',
      "utf8",
    );

  const malformedJsonTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          malformedJsonBytes,
      },
    });

  const malformedJson =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          sha256LowerHex(
            malformedJsonBytes,
          ),
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        malformedJsonTransport,
    });

  assert.equal(
    malformedJson.reason,
    "agent_card_fetch_failed",
  );

  assert.equal(
    malformedJson.cardEvidence.integrityVerified,
    true,
  );

  console.log(
    "PR302_B2D_MALFORMED_JSON_REJECTED=true",
  );

  const malformedUtf8Bytes =
    Uint8Array.from([
      0xff,
      0xfe,
      0xfd,
    ]);

  const malformedUtf8Transport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          malformedUtf8Bytes,
      },
    });

  const malformedUtf8 =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          sha256LowerHex(
            malformedUtf8Bytes,
          ),
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        malformedUtf8Transport,
    });

  assert.equal(
    malformedUtf8.reason,
    "agent_card_fetch_failed",
  );

  assert.equal(
    malformedUtf8.cardEvidence.integrityVerified,
    true,
  );

  console.log(
    "PR302_B2D_MALFORMED_UTF8_REJECTED=true",
  );

  const wrongSchemaBytes =
    encodeAgentCard({
      type:
        "https://example.invalid/registration-v2",
    });

  const wrongSchemaTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          wrongSchemaBytes,
      },
    });

  const wrongSchema =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          sha256LowerHex(
            wrongSchemaBytes,
          ),
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        wrongSchemaTransport,
    });

  assert.equal(
    wrongSchema.reason,
    "agent_card_fetch_failed",
  );

  console.log(
    "PR302_B2D_UNSUPPORTED_SCHEMA_REJECTED=true",
  );

  const inactiveBytes =
    encodeAgentCard({
      active:
        false,
    });

  const inactiveTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          inactiveBytes,
      },
    });

  const inactive =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          sha256LowerHex(
            inactiveBytes,
          ),
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        inactiveTransport,
    });

  assert.equal(
    inactive.reason,
    "agent_registry_status_invalid",
  );

  assert.equal(
    inactive.cardEvidence.integrityVerified,
    true,
  );

  console.log(
    "PR302_B2D_INACTIVE_CARD_REJECTED=true",
  );

  const invalidDataUri =
    "data:application/json;base64,%%%%";

  const invalidData =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          "c".repeat(
            64,
          ),
          {
            agentCard: {
              uri:
                invalidDataUri,

              hash:
                "c".repeat(
                  64,
                ),

              integrityVerified:
                false,
            },
          },
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,
    });

  assert.equal(
    invalidData.reason,
    "agent_card_fetch_failed",
  );

  assert.equal(
    invalidData.agentCardNetworkCalled,
    false,
  );

  console.log(
    "PR302_B2D_MALFORMED_DATA_URI_REJECTED=true",
  );

  const oversizedTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          canonicalCardBytes,
      },
    });

  const oversized =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        oversizedTransport,

      maxAgentCardBytes:
        8,
    });

  assert.equal(
    oversized.reason,
    "agent_card_fetch_failed",
  );

  console.log(
    "PR302_B2D_OVERSIZED_CARD_REJECTED=true",
  );

  const wrongMediaTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          canonicalCardBytes,

        contentType:
          "text/plain",
      },
    });

  const wrongMedia =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          canonicalHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        wrongMediaTransport,
    });

  assert.equal(
    wrongMedia.reason,
    "agent_card_fetch_failed",
  );

  console.log(
    "PR302_B2D_INVALID_MEDIA_TYPE_REJECTED=true",
  );

  const serialized =
    JSON.stringify(
      newlineSubstitution,
    );

  assert.equal(
    serialized.includes(
      "PR302 deterministic agent",
    ),
    false,
  );

  assert.equal(
    serialized.includes(
      Buffer.from(
        newlineBytes,
      ).toString(
        "base64",
      ),
    ),
    false,
  );

  console.log(
    "PR302_B2D_RAW_CARD_BYTES_NOT_EXPOSED=true",
  );
}

async function runPreservedBaseTrustForgeryCases(
  cardBytes:
    Uint8Array,
): Promise<void> {
  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  const forgedKeyInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              keyBinding: {
                required:
                  true,

                verified:
                  true,

                bindingType:
                  "CIS-8",

                keyFingerprint:
                  KEY_FINGERPRINT,
              },
            },
          ),
      },
    );

  const forgedKeyTransport =
    forgedKeyInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const forgedKey =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      forgedKeyInput,
    );

  assert.equal(
    forgedKey.ok,
    false,
  );

  assert.equal(
    forgedKey.reason,
    "agent_registry_result_invalid",
  );

  assert.equal(
    forgedKeyTransport.calls.length,
    0,
  );

  assertSafety(
    forgedKey,
  );

  console.log(
    "PR302_B2E_FORGED_BASE_KEY_BINDING_REJECTED=true",
  );

  const forgedIntegrityInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              agentCard: {
                uri:
                  AGENT_CARD_URI,

                hash:
                  cardHash,

                integrityVerified:
                  true,
              },
            },
          ),
      },
    );

  const forgedIntegrityTransport =
    forgedIntegrityInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const forgedIntegrity =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      forgedIntegrityInput,
    );

  assert.equal(
    forgedIntegrity.ok,
    false,
  );

  assert.equal(
    forgedIntegrity.reason,
    "agent_registry_result_invalid",
  );

  assert.equal(
    forgedIntegrityTransport.calls.length,
    0,
  );

  assertSafety(
    forgedIntegrity,
  );

  console.log(
    "PR302_B2E_FORGED_BASE_CARD_INTEGRITY_REJECTED=true",
  );

  const forgedCapabilitiesInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              capabilities: {
                required:
                  [...REQUIRED_CAPABILITIES],

                satisfied:
                  [...REQUIRED_CAPABILITIES],

                missing: [],

                policySatisfied:
                  true,
              },
            },
          ),
      },
    );

  const forgedCapabilitiesTransport =
    forgedCapabilitiesInput.transport as
      DeterministicAgentCardFetchTransportV1;

  const forgedCapabilities =
    await verifyAgentRegistryCardCapabilityFreshnessV1(
      forgedCapabilitiesInput,
    );

  assert.equal(
    forgedCapabilities.ok,
    false,
  );

  assert.equal(
    forgedCapabilities.reason,
    "agent_registry_result_invalid",
  );

  assert.equal(
    forgedCapabilitiesTransport.calls.length,
    0,
  );

  assertSafety(
    forgedCapabilities,
  );

  console.log(
    "PR302_B2E_FORGED_BASE_CAPABILITY_SATISFACTION_REJECTED=true",
  );
}

async function runCrossResultCoherenceCases(
  cardBytes:
    Uint8Array,
): Promise<void> {
  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  async function assertKeyMismatchWithoutFetch(
    input:
      AgentRegistryCardCapabilityFreshnessInputV1,

    label:
      string,
  ): Promise<void> {
    const transport =
      input.transport as
        DeterministicAgentCardFetchTransportV1;

    const result =
      await verifyAgentRegistryCardCapabilityFreshnessV1(
        input,
      );

    assert.equal(
      result.ok,
      false,
      label,
    );

    assert.equal(
      result.status,
      "rejected",
      label,
    );

    assert.equal(
      result.reason,
      "agent_registry_key_mismatch",
      label,
    );

    assert.equal(
      result.identityKeyBindingAccepted,
      false,
      label,
    );

    assert.equal(
      result.registryTrustPreserved,
      false,
      label,
    );

    assert.equal(
      result.cardEvidence.fetchAttempted,
      false,
      label,
    );

    assert.equal(
      transport.calls.length,
      0,
      label,
    );

    assertSafety(
      result,
    );
  }

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            agentTokenId:
              "6",
          }),
      },
    ),
    "agent token mismatch",
  );

  console.log(
    "PR302_B2F_AGENT_TOKEN_MISMATCH_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            ownerAccount:
              "4-different-owner-account",
          }),
      },
    ),
    "owner account mismatch",
  );

  console.log(
    "PR302_B2F_OWNER_ACCOUNT_MISMATCH_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            sameSnapshot:
              false,
          }),
      },
    ),
    "snapshot mismatch",
  );

  console.log(
    "PR302_B2F_SNAPSHOT_MISMATCH_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            cis8LookupAttempted:
              false,
          }),
      },
    ),
    "CIS-8 lookup not attempted",
  );

  console.log(
    "PR302_B2F_CIS8_LOOKUP_NOT_ATTEMPTED_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            cis8RegistrationActive:
              false,
          }),
      },
    ),
    "inactive CIS-8 registration",
  );

  console.log(
    "PR302_B2F_INACTIVE_CIS8_REGISTRATION_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            registryTrustPreserved:
              false,
          }),
      },
    ),
    "unpreserved registry trust",
  );

  console.log(
    "PR302_B2F_UNPRESERVED_TRUST_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            bindingEvaluated:
              false,
          }),
      },
    ),
    "binding not evaluated",
  );

  console.log(
    "PR302_B2F_UNEVALUATED_BINDING_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
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
          }),
      },
    ),
    "unverified accepted binding",
  );

  console.log(
    "PR302_B2F_UNVERIFIED_ACCEPTED_BINDING_REJECTED=true",
  );

  await assertKeyMismatchWithoutFetch(
    makeInput(
      cardBytes,
      {
        identityKeyBindingResult:
          makeIdentityKeyBindingResult({
            paymentAttempted:
              true,
          }),
      },
    ),
    "forged binding side effect",
  );

  console.log(
    "PR302_B2F_FORGED_BINDING_SIDE_EFFECT_REJECTED=true",
  );

  const mismatchedRegistryInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              identity: {
                network:
                  NETWORK,

                registryContract: {
                  index:
                    "12803",

                  subindex:
                    0,
                },

                moduleReference:
                  MODULE_REFERENCE,

                agentTokenId:
                  AGENT_TOKEN_ID,

                tokenAddress:
                  TOKEN_ADDRESS,
              },
            },
          ),
      },
    );

  await assertKeyMismatchWithoutFetch(
    mismatchedRegistryInput,
    "untrusted registry coordinates",
  );

  console.log(
    "PR302_B2F_UNTRUSTED_REGISTRY_REJECTED=true",
  );

  const mismatchedModuleInput =
    makeInput(
      cardBytes,
      {
        registryTrustResult:
          makeRegistryTrustResult(
            cardHash,
            {
              identity: {
                network:
                  NETWORK,

                registryContract:
                  REGISTRY_CONTRACT,

                moduleReference:
                  "f".repeat(
                    64,
                  ),

                agentTokenId:
                  AGENT_TOKEN_ID,

                tokenAddress:
                  TOKEN_ADDRESS,
              },
            },
          ),
      },
    );

  await assertKeyMismatchWithoutFetch(
    mismatchedModuleInput,
    "untrusted module reference",
  );

  console.log(
    "PR302_B2F_UNTRUSTED_MODULE_REJECTED=true",
  );
}

async function runHttpsTransportCases(
  cardBytes:
    Uint8Array,
): Promise<void> {
  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  let observedInput:
    RequestInfo | URL | null =
      null;

  let observedInit:
    RequestInit | undefined;

  const successTransport =
    new HttpsAgentCardFetchTransportV1(
      async (
        input,
        init,
      ) => {
        observedInput =
          input;

        observedInit =
          init;

        return new Response(
          cardBytes,
          {
            status:
              200,

            headers: {
              "content-type":
                "application/json; charset=utf-8",

              "content-length":
                String(
                  cardBytes.byteLength,
                ),
            },
          },
        );
      },
    );

  const success =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          cardHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        successTransport,
    });

  assert.equal(
    success.ok,
    true,
  );

  assert.equal(
    success.reason,
    "accepted",
  );

  assert.equal(
    success.agentCardNetworkCalled,
    true,
  );

  assert.equal(
    observedInput,
    AGENT_CARD_URI,
  );

  assert.equal(
    observedInit?.method,
    "GET",
  );

  assert.equal(
    observedInit?.redirect,
    "manual",
  );

  assert.equal(
    observedInit?.credentials,
    "omit",
  );

  assert.deepEqual(
    observedInit?.headers,
    {
      accept:
        "application/json, application/*+json",
    },
  );

  assertSafety(
    success,
  );

  console.log(
    "PR302_B2G_HTTPS_VERIFIER_INTEGRATION=true",
  );

  const redirectTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          null,
          {
            status:
              302,

            headers: {
              location:
                "https://other.example/card.json",
            },
          },
        ),
    );

  const redirect =
    await redirectTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    redirect.ok,
    false,
  );

  assert.equal(
    redirect.redirected,
    true,
  );

  assert.equal(
    redirect.error,
    "redirect_not_allowed",
  );

  console.log(
    "PR302_B2G_HTTPS_REDIRECT_REJECTED=true",
  );

  const mediaTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          cardBytes,
          {
            status:
              200,

            headers: {
              "content-type":
                "text/plain",
            },
          },
        ),
    );

  const media =
    await mediaTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    media.ok,
    false,
  );

  assert.equal(
    media.error,
    "content_type_not_json",
  );

  console.log(
    "PR302_B2G_HTTPS_MEDIA_TYPE_REJECTED=true",
  );

  const declaredOversizeTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          "1234567890",
          {
            status:
              200,

            headers: {
              "content-type":
                "application/json",

              "content-length":
                "10",
            },
          },
        ),
    );

  const declaredOversize =
    await declaredOversizeTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        8,

      timeoutMs:
        1000,
    });

  assert.equal(
    declaredOversize.ok,
    false,
  );

  assert.equal(
    declaredOversize.error,
    "response_too_large",
  );

  console.log(
    "PR302_B2G_HTTPS_DECLARED_SIZE_REJECTED=true",
  );

  const streamedOversizeTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(
              controller,
            ) {
              controller.enqueue(
                Uint8Array.from([
                  1,
                  2,
                  3,
                  4,
                  5,
                ]),
              );

              controller.enqueue(
                Uint8Array.from([
                  6,
                  7,
                  8,
                  9,
                ]),
              );

              controller.close();
            },
          }),
          {
            status:
              200,

            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
    );

  const streamedOversize =
    await streamedOversizeTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        8,

      timeoutMs:
        1000,
    });

  assert.equal(
    streamedOversize.ok,
    false,
  );

  assert.equal(
    streamedOversize.error,
    "response_too_large",
  );

  console.log(
    "PR302_B2G_HTTPS_STREAM_SIZE_REJECTED=true",
  );

  const statusTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          '{"error":"missing"}',
          {
            status:
              404,

            headers: {
              "content-type":
                "application/json",
            },
          },
        ),
    );

  const status =
    await statusTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    status.ok,
    false,
  );

  assert.equal(
    status.httpStatus,
    404,
  );

  assert.equal(
    status.error,
    "http_status_not_success",
  );

  console.log(
    "PR302_B2G_HTTPS_STATUS_REJECTED=true",
  );

  const malformedLengthTransport =
    new HttpsAgentCardFetchTransportV1(
      async () =>
        new Response(
          "{}",
          {
            status:
              200,

            headers: {
              "content-type":
                "application/json",

              "content-length":
                "not-a-number",
            },
          },
        ),
    );

  const malformedLength =
    await malformedLengthTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    malformedLength.ok,
    false,
  );

  assert.equal(
    malformedLength.error,
    "content_length_invalid",
  );

  console.log(
    "PR302_B2G_HTTPS_CONTENT_LENGTH_REJECTED=true",
  );

  const credentialed =
    await successTransport.read({
      uri:
        "https://user:password@agent.example/card.json",

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    credentialed.ok,
    false,
  );

  assert.equal(
    credentialed.error,
    "invalid_https_uri",
  );

  console.log(
    "PR302_B2G_HTTPS_CREDENTIALS_REJECTED=true",
  );

  const exceptionTransport =
    new HttpsAgentCardFetchTransportV1(
      async () => {
        throw new Error(
          "network failure",
        );
      },
    );

  const exception =
    await exceptionTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        1000,
    });

  assert.equal(
    exception.ok,
    false,
  );

  assert.equal(
    exception.timedOut,
    false,
  );

  assert.equal(
    exception.error,
    "fetch_exception",
  );

  console.log(
    "PR302_B2G_HTTPS_EXCEPTION_REJECTED=true",
  );

  const timeoutTransport =
    new HttpsAgentCardFetchTransportV1(
      async (
        _input,
        init,
      ) =>
        await new Promise<Response>(
          (
            _resolve,
            reject,
          ) => {
            const signal =
              init?.signal;

            assert.ok(
              signal,
            );

            signal.addEventListener(
              "abort",
              () => {
                reject(
                  new Error(
                    "aborted",
                  ),
                );
              },
              {
                once:
                  true,
              },
            );
          },
        ),
    );

  const timeout =
    await timeoutTransport.read({
      uri:
        AGENT_CARD_URI,

      maxBytes:
        1024,

      timeoutMs:
        25,
    });

  assert.equal(
    timeout.ok,
    false,
  );

  assert.equal(
    timeout.timedOut,
    true,
  );

  assert.equal(
    timeout.error,
    "fetch_timeout",
  );

  console.log(
    "PR302_B2G_HTTPS_TIMEOUT_REJECTED=true",
  );
}

async function main(): Promise<void> {
  const cardBytes =
    encodeAgentCard();

  const cardHash =
    sha256LowerHex(
      cardBytes,
    );

  const requirementValidation =
    validateAgentRegistryRequirementV1(
      makeRequirement(),
    );

  assert.equal(
    requirementValidation.ok,
    true,
  );

  const trustValidation =
    validateAgentRegistryTrustResultV1(
      makeRegistryTrustResult(
        cardHash,
      ),
    );

  assert.equal(
    trustValidation.ok,
    true,
  );

  console.log(
    "PR302_B1_FIXTURE_CONTRACTS=true",
  );

  const httpsTransport =
    new DeterministicAgentCardFetchTransportV1({
      [AGENT_CARD_URI]: {
        ok:
          true,

        bytes:
          cardBytes,

        contentType:
          "application/json; charset=utf-8",
      },
    });

  const httpsResult =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        makeRegistryTrustResult(
          cardHash,
        ),

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,

      transport:
        httpsTransport,
    });

  assert.equal(
    httpsResult.ok,
    true,
  );

  assert.equal(
    httpsResult.status,
    "accepted",
  );

  assert.equal(
    httpsResult.reason,
    "accepted",
  );

  assert.equal(
    httpsResult.cardEvidence.fetchRequired,
    true,
  );

  assert.equal(
    httpsResult.cardEvidence.fetchAttempted,
    true,
  );

  assert.equal(
    httpsResult.cardEvidence.expectedHash,
    cardHash,
  );

  assert.equal(
    httpsResult.cardEvidence.actualHash,
    cardHash,
  );

  assert.equal(
    httpsResult.cardEvidence.byteLength,
    cardBytes.byteLength,
  );

  assert.equal(
    httpsResult.cardEvidence.schemaType,
    AGENT_REGISTRATION_FILE_TYPE,
  );

  assert.equal(
    httpsResult.cardEvidence.integrityVerified,
    true,
  );

  assert.deepEqual(
    httpsResult.capabilityDecision.required,
    [...REQUIRED_CAPABILITIES],
  );

  assert.deepEqual(
    httpsResult.capabilityDecision.satisfied,
    [...REQUIRED_CAPABILITIES],
  );

  assert.deepEqual(
    httpsResult.capabilityDecision.missing,
    [],
  );

  assert.equal(
    httpsResult.capabilityDecision.policySatisfied,
    true,
  );

  assert.equal(
    httpsResult.freshnessDecision.calculatedEvidenceAgeSeconds,
    10,
  );

  assert.equal(
    httpsResult.freshnessDecision.fresh,
    true,
  );

  assert.equal(
    httpsResult.identityKeyBinding?.keyBinding.keyFingerprint,
    KEY_FINGERPRINT,
  );

  assert.equal(
    httpsResult.trustResult?.identity.agentTokenId,
    AGENT_TOKEN_ID,
  );


  assert.equal(
    httpsResult
      .trustResult
      ?.agentCard
      .integrityVerified,
    false,
  );

  assert.deepEqual(
    httpsResult
      .trustResult
      ?.keyBinding,
    {
      required:
        false,

      verified:
        false,

      bindingType:
        null,

      keyFingerprint:
        null,
    },
  );

  assert.deepEqual(
    httpsResult
      .trustResult
      ?.capabilities,
    {
      required: [],

      satisfied: [],

      missing: [],

      policySatisfied:
        true,
    },
  );

  console.log(
    "PR302_B2E_PR300_BASE_TRUST_PRESERVED=true",
  );

  assert.equal(
    httpsTransport.calls.length,
    1,
  );

  assertSafety(
    httpsResult,
  );

  console.log(
    "PR302_B2A_EXACT_HTTPS_SUCCESS=true",
  );

  const dataUri =
    `data:application/json;base64,${
      Buffer.from(
        cardBytes,
      ).toString(
        "base64",
      )
    }`;

  const dataTrust =
    makeRegistryTrustResult(
      cardHash,
      {
        agentCard: {
          uri:
            dataUri,

          hash:
            cardHash,

          integrityVerified:
            false,
        },
      },
    );

  const dataResult =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        makeRequirement(),

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        dataTrust,

      capabilityRules:
        makeCapabilityRules(),

      now:
        NOW,
    });

  assert.equal(
    dataResult.ok,
    true,
  );

  assert.equal(
    dataResult.reason,
    "accepted",
  );

  assert.equal(
    dataResult.cardEvidence.uri,
    dataUri,
  );

  assert.equal(
    dataResult.cardEvidence.actualHash,
    cardHash,
  );

  assert.equal(
    dataResult.cardEvidence.integrityVerified,
    true,
  );

  assert.equal(
    dataResult.agentCardNetworkCalled,
    false,
  );

  assertSafety(
    dataResult,
  );

  console.log(
    "PR302_B2A_DATA_URI_SUCCESS=true",
  );

  const noCardRequirement =
    makeRequirement({
      requireAgentCardIntegrity:
        false,

      requiredCapabilities: [],
    });

  const noCardTrust =
    makeRegistryTrustResult(
      cardHash,
      {
        agentCard: {
          uri:
            null,

          hash:
            null,

          integrityVerified:
            false,
        },

        capabilities: {
          required: [],

          satisfied: [],

          missing: [],

          policySatisfied:
            true,
        },
      },
    );

  const noCardTransport =
    new DeterministicAgentCardFetchTransportV1({});

  const noCardResult =
    await verifyAgentRegistryCardCapabilityFreshnessV1({
      requirement:
        noCardRequirement,

      identityKeyBindingResult:
        makeIdentityKeyBindingResult(),

      registryTrustResult:
        noCardTrust,

      capabilityRules: [],

      now:
        NOW,

      transport:
        noCardTransport,
    });

  assert.equal(
    noCardResult.ok,
    true,
  );

  assert.equal(
    noCardResult.status,
    "accepted",
  );

  assert.equal(
    noCardResult.reason,
    "accepted_without_agent_card",
  );

  assert.equal(
    noCardResult.cardEvidence.fetchRequired,
    false,
  );

  assert.equal(
    noCardResult.cardEvidence.fetchAttempted,
    false,
  );

  assert.equal(
    noCardResult.cardEvidence.integrityVerified,
    false,
  );

  assert.deepEqual(
    noCardResult.capabilityDecision,
    {
      required: [],

      satisfied: [],

      missing: [],

      policySatisfied:
        true,
    },
  );

  assert.equal(
    noCardTransport.calls.length,
    0,
  );

  assertSafety(
    noCardResult,
  );

  console.log(
    "PR302_B2A_NO_CARD_POLICY_SUCCESS=true",
  );

  await runFreshnessCases(
    cardBytes,
  );

  await runCapabilityCases();

  await runPreservedBaseTrustForgeryCases(
    cardBytes,
  );

  await runCrossResultCoherenceCases(
    cardBytes,
  );

  await runHttpsTransportCases(
    cardBytes,
  );

  await runAgentCardFailureCases(
    cardBytes,
  );

  console.log(
    "PR302_B2A_IDENTITY_KEY_BINDING_PRESERVED=true",
  );

  console.log(
    "PR302_B2A_ZERO_SIDE_EFFECTS=true",
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      error,
    );

    process.exit(
      1,
    );
  },
);
