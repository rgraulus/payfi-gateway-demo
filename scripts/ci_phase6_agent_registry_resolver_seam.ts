import assert from "node:assert/strict";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REFERENCE_TYPE,
  AGENT_REGISTRY_REQUIREMENT_TYPE,
  AGENT_REGISTRY_STANDARD,
  AGENT_REGISTRY_TRUST_RESULT_TYPE,
  type AgentRegistryReferenceV1,
  type AgentRegistryRequirementV1,
  type AgentRegistryTrustResultV1,
} from "../src/phase6/agentRegistryTrustContract";

import {
  AGENT_REGISTRY_RESOLVER_KIND,
  AGENT_REGISTRY_RESOLVER_MODE,
  DeterministicAgentRegistryFixtureResolverV1,
  type AgentRegistryFixtureResolverBehaviorV1,
  type AgentRegistryResolverRequestV1,
  type AgentRegistryResolverSeamReasonV1,
  type AgentRegistryResolverSeamResultV1,
  type AgentRegistryResolverSeamStatusV1,
  resolveAgentRegistryTrustForGatewayV1,
} from "../src/phase6/agentRegistryResolverSeam";

const LABEL =
  "phase6:agent-registry-resolver-seam-test";

const CONTRACT =
  "phase6.agentRegistryResolverSeam.v1";

const MODE =
  AGENT_REGISTRY_RESOLVER_MODE;

const NETWORK =
  "ccd:testnet";

const OTHER_NETWORK =
  "ccd:testnet-other";

const REGISTRY_INDEX =
  "8004";

const OTHER_REGISTRY_INDEX =
  "9004";

const MODULE_REFERENCE =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const OTHER_MODULE_REFERENCE =
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const BLOCK_HASH =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const AGENT_CARD_HASH =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const EVIDENCE_HASH =
  "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const TOKEN_ADDRESS =
  "ccd:testnet/cis2:8004-0-42";

const OTHER_TOKEN_ADDRESS =
  "ccd:testnet/cis2:8004-0-43";

const REQUIRED_CAPABILITIES = [
  "x402.payment.authorize",
  "resource.premium.read",
] as const;

const VALID_REQUIREMENT:
  AgentRegistryRequirementV1 = {
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

        contract: {
          index:
            REGISTRY_INDEX,

          subindex:
            0,
        },
      },
    ],

    requiredStatus:
      "Active",

    requireAgentCardIntegrity:
      true,

    requiredCapabilities:
      REQUIRED_CAPABILITIES,

    requireOwnerAccountBinding:
      true,

    requireVerifiedOwnerIdentity:
      false,

    externalKeyPolicy:
      "required",

    maxEvidenceAgeSeconds:
      300,

    maxIndexerLagBlocks:
      3,

    revalidateBeforeReleaseIfOlderThanSeconds:
      120,
  };

const PINNED_REQUIREMENT:
  AgentRegistryRequirementV1 = {
    ...VALID_REQUIREMENT,

    trustedRegistries: [
      {
        network:
          NETWORK,

        contract: {
          index:
            REGISTRY_INDEX,

          subindex:
            0,
        },

        moduleReference:
          MODULE_REFERENCE,
      },
    ],
  };

const OPTIONAL_REQUIREMENT:
  AgentRegistryRequirementV1 = {
    ...VALID_REQUIREMENT,

    required:
      false,

    trustedRegistries: [],
  };

const VALID_REFERENCE:
  AgentRegistryReferenceV1 = {
    type:
      AGENT_REGISTRY_REFERENCE_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    network:
      NETWORK,

    registryContract: {
      index:
        REGISTRY_INDEX,

      subindex:
        0,
    },

    agentTokenId:
      "42",

    tokenAddress:
      TOKEN_ADDRESS,

    tokenAddressBase58:
      "3KMfRegistryAgentToken42",

    didAlias:
      "did:ccd:testnet:agent:42",

    resolverHint:
      "fixture:phase6:agent-42",
  };

const VALID_VERIFIED_RESULT:
  AgentRegistryTrustResultV1 = {
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

      registryContract: {
        index:
          REGISTRY_INDEX,

        subindex:
          0,
      },

      moduleReference:
        MODULE_REFERENCE,

      agentTokenId:
        "42",

      tokenAddress:
        TOKEN_ADDRESS,
    },

    state: {
      status:
        "Active",

      ownerAccount:
        "4-owner-account-phase6",

      ownerAccountBound:
        true,

      ownerIdentityAssurance:
        "verified",

      agentWallet:
        "4-agent-wallet-phase6",
    },

    agentCard: {
      uri:
        "https://example.test/agents/42/card.json",

      hash:
        AGENT_CARD_HASH,

      integrityVerified:
        true,
    },

    keyBinding: {
      required:
        true,

      verified:
        true,

      bindingType:
        "native",

      keyFingerprint:
        "sha256:phase6-agent-key-42",
    },

    capabilities: {
      required:
        REQUIRED_CAPABILITIES,

      satisfied:
        REQUIRED_CAPABILITIES,

      missing: [],

      policySatisfied:
        true,
    },

    freshness: {
      source:
        "fixture",

      finalizedBlockHeight:
        123456,

      finalizedBlockHash:
        BLOCK_HASH,

      observedAt:
        "2026-07-23T12:00:00.000Z",

      evidenceAgeSeconds:
        10,

      indexerLagBlocks:
        0,

      fresh:
        true,
    },

    evidenceHash:
      EVIDENCE_HASH,
  };

const VALID_REVOKED_RESULT:
  AgentRegistryTrustResultV1 = {
    type:
      AGENT_REGISTRY_TRUST_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    verified:
      false,

    reason:
      "agent_registry_revoked",

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    identity: {
      network:
        NETWORK,

      registryContract: {
        index:
          REGISTRY_INDEX,

        subindex:
          0,
      },

      moduleReference:
        MODULE_REFERENCE,

      agentTokenId:
        "42",

      tokenAddress:
        TOKEN_ADDRESS,
    },

    state: {
      status:
        "Revoked",

      ownerAccount:
        null,

      ownerAccountBound:
        false,

      ownerIdentityAssurance:
        "not_evaluated",

      agentWallet:
        null,
    },

    agentCard: {
      uri:
        null,

      hash:
        null,

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
      required: [
        "x402.payment.authorize",
      ],

      satisfied: [],

      missing: [
        "x402.payment.authorize",
      ],

      policySatisfied:
        false,
    },

    freshness: {
      source:
        "fixture",

      finalizedBlockHeight:
        123456,

      finalizedBlockHash:
        BLOCK_HASH,

      observedAt:
        "2026-07-23T12:00:00.000Z",

      evidenceAgeSeconds:
        15,

      indexerLagBlocks:
        0,

      fresh:
        true,
    },

    evidenceHash:
      EVIDENCE_HASH,
  };

const VALID_MISSING_AGENT_RESULT:
  AgentRegistryTrustResultV1 = {
    ...VALID_REVOKED_RESULT,

    reason:
      "agent_not_registered",

    state: {
      status:
        "Missing",

      ownerAccount:
        null,

      ownerAccountBound:
        false,

      ownerIdentityAssurance:
        "not_evaluated",

      agentWallet:
        null,
    },
  };

class CountingFixtureResolver
extends DeterministicAgentRegistryFixtureResolverV1 {
  calls =
    0;

  lastRequest:
    AgentRegistryResolverRequestV1 | null =
      null;

  override async resolve(
    request:
      AgentRegistryResolverRequestV1,
  ): Promise<unknown> {
    this.calls +=
      1;

    this.lastRequest =
      request;

    return super.resolve(
      request,
    );
  }
}

type Mutable<T> =
  {
    -readonly [K in keyof T]:
      T[K] extends object
        ? Mutable<T[K]>
        : T[K];
  };

type HarnessCase = {
  readonly name:
    string;

  readonly requirement:
    unknown;

  readonly reference?:
    unknown | null;

  readonly behavior:
    AgentRegistryFixtureResolverBehaviorV1;

  readonly expectedOk:
    boolean;

  readonly expectedStatus:
    AgentRegistryResolverSeamStatusV1;

  readonly expectedReason:
    AgentRegistryResolverSeamReasonV1;

  readonly expectedResolverCalls:
    number;

  readonly expectedRegistryTrustSatisfied:
    boolean | null;

  readonly expectedTrustResultPresent:
    boolean;

  readonly expectedRequirementValidationReason?:
    string;

  readonly expectedReferenceValidationReason?:
    string | null;

  readonly expectedTrustResultValidationReason?:
    string | null;
};

function cloneMutable<T>(
  value: T,
): Mutable<T> {
  return JSON.parse(
    JSON.stringify(value),
  ) as Mutable<T>;
}

function resultBehavior(
  result: unknown,
): AgentRegistryFixtureResolverBehaviorV1 {
  return {
    scenario:
      "result",

    result,
  };
}

function buildCases():
  readonly HarnessCase[] {
  const unsupportedRequirement =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  unsupportedRequirement.version =
    "2.0.0" as
      typeof unsupportedRequirement.version;

  const malformedReference =
    cloneMutable(
      VALID_REFERENCE,
    );

  malformedReference.tokenAddress =
    "not-a-caip19-shaped-address";

  const unsupportedReference =
    cloneMutable(
      VALID_REFERENCE,
    );

  unsupportedReference.registryStandard =
    "OTHER-REGISTRY" as
      typeof unsupportedReference.registryStandard;

  const untrustedNetworkReference =
    cloneMutable(
      VALID_REFERENCE,
    );

  untrustedNetworkReference.network =
    OTHER_NETWORK;

  const untrustedContractReference =
    cloneMutable(
      VALID_REFERENCE,
    );

  untrustedContractReference
    .registryContract.index =
      OTHER_REGISTRY_INDEX;

  const registryMismatchResult =
    cloneMutable(
      VALID_REVOKED_RESULT,
    );

  registryMismatchResult
    .identity.registryContract.index =
      OTHER_REGISTRY_INDEX;

  const identityMismatchResult =
    cloneMutable(
      VALID_REVOKED_RESULT,
    );

  identityMismatchResult
    .identity.agentTokenId =
      "43";

  identityMismatchResult
    .identity.tokenAddress =
      OTHER_TOKEN_ADDRESS;

  const moduleMismatchResult =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  moduleMismatchResult
    .identity.moduleReference =
      OTHER_MODULE_REFERENCE;

  return [
    {
      name:
        "optional requirement bypasses resolver",

      requirement:
        OPTIONAL_REQUIREMENT,

      reference:
        null,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        true,

      expectedStatus:
        "not_required",

      expectedReason:
        "not_required",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        null,

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "trusted pinned registry resolves verified result",

      requirement:
        PINNED_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        true,

      expectedStatus:
        "resolved",

      expectedReason:
        "agent_registry_verified",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        true,

      expectedTrustResultPresent:
        true,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
    {
      name:
        "coherent revoked result is preserved",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          VALID_REVOKED_RESULT,
        ),

      expectedOk:
        true,

      expectedStatus:
        "resolved",

      expectedReason:
        "agent_registry_revoked",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        false,

      expectedTrustResultPresent:
        true,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
    {
      name:
        "coherent missing agent result is preserved",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          VALID_MISSING_AGENT_RESULT,
        ),

      expectedOk:
        true,

      expectedStatus:
        "resolved",

      expectedReason:
        "agent_not_registered",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        false,

      expectedTrustResultPresent:
        true,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
    {
      name:
        "unsupported requirement version fails before resolver",

      requirement:
        unsupportedRequirement,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "invalid_registry_requirement",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "unsupported_version",

      expectedReferenceValidationReason:
        null,

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "required trust without reference fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        null,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "missing_registry_reference",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        null,

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "malformed reference fails before resolver",

      requirement:
        VALID_REQUIREMENT,

      reference:
        malformedReference,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "invalid_registry_reference",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "invalid_registry_reference",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "unsupported reference standard fails before resolver",

      requirement:
        VALID_REQUIREMENT,

      reference:
        unsupportedReference,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "unsupported_registry_standard",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "unsupported_registry_standard",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "untrusted registry network fails before resolver",

      requirement:
        VALID_REQUIREMENT,

      reference:
        untrustedNetworkReference,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "untrusted_registry_contract",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "untrusted registry contract fails before resolver",

      requirement:
        VALID_REQUIREMENT,

      reference:
        untrustedContractReference,

      behavior:
        resultBehavior(
          VALID_VERIFIED_RESULT,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "untrusted_registry_contract",

      expectedResolverCalls:
        0,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "resolver unavailable result fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior: {
        scenario:
          "unavailable",
      },

      expectedOk:
        false,

      expectedStatus:
        "unavailable",

      expectedReason:
        "agent_registry_resolver_unavailable",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "resolver exception fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior: {
        scenario:
          "throw",
      },

      expectedOk:
        false,

      expectedStatus:
        "unavailable",

      expectedReason:
        "resolver_exception",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        null,
    },
    {
      name:
        "malformed resolver output fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          "not-a-trust-result",
        ),

      expectedOk:
        false,

      expectedStatus:
        "invalid_result",

      expectedReason:
        "agent_registry_result_invalid",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "invalid_object_shape",
    },
    {
      name:
        "resolved registry contract substitution fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          registryMismatchResult,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "agent_registry_contract_mismatch",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
    {
      name:
        "resolved token identity substitution fails closed",

      requirement:
        VALID_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          identityMismatchResult,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "agent_registry_identity_mismatch",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
    {
      name:
        "pinned module reference mismatch fails closed",

      requirement:
        PINNED_REQUIREMENT,

      reference:
        VALID_REFERENCE,

      behavior:
        resultBehavior(
          moduleMismatchResult,
        ),

      expectedOk:
        false,

      expectedStatus:
        "rejected",

      expectedReason:
        "agent_registry_contract_mismatch",

      expectedResolverCalls:
        1,

      expectedRegistryTrustSatisfied:
        null,

      expectedTrustResultPresent:
        false,

      expectedRequirementValidationReason:
        "valid",

      expectedReferenceValidationReason:
        "valid",

      expectedTrustResultValidationReason:
        "valid",
    },
  ];
}

function assertSafety(
  result:
    AgentRegistryResolverSeamResultV1,
  context:
    string,
): void {
  assert.equal(
    result.mode,
    MODE,
    context,
  );

  assert.equal(
    result.registryNetworkCalled,
    false,
    context,
  );

  assert.equal(
    result.gatewayRuntimeCalled,
    false,
    context,
  );

  assert.equal(
    result.gatewayRuntimeChanged,
    false,
    context,
  );

  assert.equal(
    result.phase5StateMutated,
    false,
    context,
  );

  assert.equal(
    result.canonicalStateMutated,
    false,
    context,
  );

  assert.equal(
    result.boundedUseConsumed,
    false,
    context,
  );

  assert.equal(
    result.replayStateMutated,
    false,
    context,
  );

  assert.equal(
    result.ufxCalled,
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
    result.receiptIssued,
    false,
    context,
  );

  assert.equal(
    result.paymentResponseEmitted,
    false,
    context,
  );

  assert.equal(
    result.resourceReleased,
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

async function main():
  Promise<void> {
  const cases =
    buildCases();

  assert.equal(
    cases.length,
    16,
  );

  const results = [];

  for (
    const testCase of
      cases
  ) {
    const resolver =
      new CountingFixtureResolver(
        testCase.behavior,
      );

    const result =
      await resolveAgentRegistryTrustForGatewayV1({
        requirement:
          testCase.requirement,

        reference:
          testCase.reference,

        resolver,
      });

    assert.equal(
      result.ok,
      testCase.expectedOk,
      testCase.name,
    );

    assert.equal(
      result.status,
      testCase.expectedStatus,
      testCase.name,
    );

    assert.equal(
      result.reason,
      testCase.expectedReason,
      testCase.name,
    );

    assert.equal(
      resolver.calls,
      testCase.expectedResolverCalls,
      testCase.name,
    );

    assert.equal(
      result.resolverInvoked,
      testCase.expectedResolverCalls >
        0,
      testCase.name,
    );

    assert.equal(
      result.fixtureResolverInvoked,
      testCase.expectedResolverCalls >
        0,
      testCase.name,
    );

    assert.equal(
      result.registryTrustSatisfied,
      testCase
        .expectedRegistryTrustSatisfied,
      testCase.name,
    );

    assert.equal(
      result.trustResult !==
        null,
      testCase
        .expectedTrustResultPresent,
      testCase.name,
    );

    if (
      testCase
        .expectedRequirementValidationReason !==
        undefined
    ) {
      assert.equal(
        result
          .requirementValidationReason,
        testCase
          .expectedRequirementValidationReason,
        testCase.name,
      );
    }

    if (
      testCase
        .expectedReferenceValidationReason !==
        undefined
    ) {
      assert.equal(
        result
          .referenceValidationReason,
        testCase
          .expectedReferenceValidationReason,
        testCase.name,
      );
    }

    if (
      testCase
        .expectedTrustResultValidationReason !==
        undefined
    ) {
      assert.equal(
        result
          .trustResultValidationReason,
        testCase
          .expectedTrustResultValidationReason,
        testCase.name,
      );
    }

    if (
      testCase.expectedResolverCalls ===
        0
    ) {
      assert.equal(
        resolver.lastRequest,
        null,
        testCase.name,
      );
    } else {
      assert.notEqual(
        resolver.lastRequest,
        null,
        testCase.name,
      );

      assert.equal(
        resolver.lastRequest?.type,
        "xcf.agent-registry.resolve-request",
        testCase.name,
      );

      assert.equal(
        resolver.lastRequest?.version,
        AGENT_REGISTRY_CONTRACT_VERSION,
        testCase.name,
      );
    }

    if (
      result.status ===
        "resolved"
    ) {
      assert.notEqual(
        result.trustResult,
        null,
        testCase.name,
      );

      assert.equal(
        result.registryTrustSatisfied,
        result.trustResult?.verified ??
          null,
        testCase.name,
      );
    }

    assertSafety(
      result,
      testCase.name,
    );

    results.push({
      name:
        testCase.name,

      expectedOk:
        testCase.expectedOk,

      actualOk:
        result.ok,

      expectedStatus:
        testCase.expectedStatus,

      actualStatus:
        result.status,

      expectedReason:
        testCase.expectedReason,

      actualReason:
        result.reason,

      resolverCalls:
        resolver.calls,

      registryTrustSatisfied:
        result.registryTrustSatisfied,
    });
  }

  const acceptedCaseCount =
    results.filter(
      (result) =>
        result.actualOk,
    ).length;

  const rejectedCaseCount =
    results.length -
    acceptedCaseCount;

  assert.equal(
    acceptedCaseCount,
    4,
  );

  assert.equal(
    rejectedCaseCount,
    12,
  );

  const acceptanceMarkers = {
    PR299_AGENT_REGISTRY_RESOLVER_INTERFACE:
      true,

    PR299_GATEWAY_RESOLVER_ADAPTER:
      true,

    PR299_DETERMINISTIC_FIXTURE_RESOLVER:
      true,

    PR299_TRUSTED_REGISTRY_ALLOWLIST_ENFORCED:
      true,

    PR299_MISSING_REFERENCE_FAILS_CLOSED:
      true,

    PR299_MALFORMED_RESULT_FAILS_CLOSED:
      true,

    PR299_RESOLVER_UNAVAILABLE_FAILS_CLOSED:
      true,

    PR299_RESOLVER_EXCEPTION_FAILS_CLOSED:
      true,

    PR299_NEGATIVE_TRUST_RESULT_PRESERVED:
      true,

    PR299_RESULT_IDENTITY_BINDING_ENFORCED:
      true,

    PR299_LIVE_REGISTRY_LOOKUP:
      false,

    PR299_GATEWAY_RUNTIME_CHANGED:
      false,

    PR299_PHASE5_STATE_MUTATED:
      false,

    PR299_PAYMENT_ATTEMPTED:
      false,

    PR299_RESOURCE_RELEASED:
      false,

    PR299_PRODUCTION_ACTIVATION:
      false,

    PR299_PHASE6_RESOLVER_SEAM_ACCEPTANCE:
      true,
  } as const;

  const summary = {
    ok:
      true,

    label:
      LABEL,

    contract:
      CONTRACT,

    mode:
      MODE,

    resolverKind:
      AGENT_REGISTRY_RESOLVER_KIND,

    contractVersion:
      AGENT_REGISTRY_CONTRACT_VERSION,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    caseCount:
      results.length,

    acceptedCaseCount,
    rejectedCaseCount,

    cases:
      results,

    safety: {
      registryNetworkCalled:
        false,

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
        false,

      productionActivation:
        false,
    },

    acceptanceMarkers,

    nextFiniteRung:
      "#300 Concordium CIS-8004 Registry Plugin",
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  console.log();

  for (
    const [marker, value] of
      Object.entries(
        acceptanceMarkers,
      )
  ) {
    console.log(
      `${marker}=${String(value)}`,
    );
  }
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode =
      1;
  },
);
