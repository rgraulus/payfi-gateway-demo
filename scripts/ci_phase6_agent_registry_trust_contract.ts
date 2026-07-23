import assert from "node:assert/strict";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REFERENCE_TYPE,
  AGENT_REGISTRY_REQUIREMENT_TYPE,
  AGENT_REGISTRY_STANDARD,
  AGENT_REGISTRY_TRUST_REASON_CODES,
  AGENT_REGISTRY_TRUST_RESULT_TYPE,
  PHASE6_AGENT_REGISTRY_ARCHITECTURE_INVARIANTS,
  type AgentRegistryContractValidationReasonV1,
  type AgentRegistryReferenceV1,
  type AgentRegistryRequirementV1,
  type AgentRegistryTrustResultV1,
  validateAgentRegistryReferenceV1,
  validateAgentRegistryRequirementV1,
  validateAgentRegistryTrustResultV1,
} from "../src/phase6/agentRegistryTrustContract";

const LABEL =
  "phase6:agent-registry-trust-contract-test";

const CONTRACT =
  "phase6.agentRegistryTrustContract.v1";

const MODE =
  "contract_only";

const MODULE_REFERENCE =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const BLOCK_HASH =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const AGENT_CARD_HASH =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const EVIDENCE_HASH =
  "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const NETWORK =
  "ccd:testnet";

const TOKEN_ADDRESS =
  "ccd:testnet/cis2:8004-0-42";

const REQUIRED_CAPABILITIES = [
  "x402.payment.authorize",
  "resource.premium.read",
] as const;

const EXPECTED_TRUST_REASONS = [
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

const VALID_REQUIREMENT:
  AgentRegistryRequirementV1 = {
    type:
      AGENT_REGISTRY_REQUIREMENT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    required: true,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    trustedRegistries: [
      {
        network:
          NETWORK,

        contract: {
          index: "8004",
          subindex: 0,
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
      index: "8004",
      subindex: 0,
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

    verified: true,

    reason:
      "agent_registry_verified",

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    identity: {
      network:
        NETWORK,

      registryContract: {
        index: "8004",
        subindex: 0,
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

    verified: false,

    reason:
      "agent_registry_revoked",

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    identity: {
      network:
        NETWORK,

      registryContract: {
        index: "8004",
        subindex: 0,
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
        "direct_chain",

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

const VALID_OWNER_NOT_EVALUATED_RESULT:
  AgentRegistryTrustResultV1 = {
    ...VALID_REVOKED_RESULT,

    reason:
      "agent_registry_status_invalid",

    state: {
      status:
        "Active",

      ownerAccount:
        "4-owner-account-phase6",

      ownerAccountBound:
        true,

      ownerIdentityAssurance:
        "not_evaluated",

      agentWallet:
        "4-agent-wallet-phase6",
    },
  };

type RequirementValidation =
  ReturnType<
    typeof validateAgentRegistryRequirementV1
  >;

type ReferenceValidation =
  ReturnType<
    typeof validateAgentRegistryReferenceV1
  >;

type TrustResultValidation =
  ReturnType<
    typeof validateAgentRegistryTrustResultV1
  >;

type AnyValidation =
  | RequirementValidation
  | ReferenceValidation
  | TrustResultValidation;

type ContractKind =
  AnyValidation["contractKind"];

type Validator = (
  value: unknown,
) => AnyValidation;

type HarnessCase = {
  readonly name: string;

  readonly contractKind:
    ContractKind;

  readonly validator:
    Validator;

  readonly input:
    unknown;

  readonly expectedOk:
    boolean;

  readonly expectedReason:
    AgentRegistryContractValidationReasonV1;
};

function cloneMutable<T>(
  value: T,
): any {
  return JSON.parse(
    JSON.stringify(value),
  );
}

function assertSafetyContract(
  result: AnyValidation,
  context: string,
): void {
  assert.equal(
    result.mode,
    MODE,
    context,
  );

  assert.equal(
    result.gatewayCalled,
    false,
    context,
  );

  assert.equal(
    result.registryNetworkCalled,
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
    result.stateMutated,
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

function validOptionalRequirement():
  AgentRegistryRequirementV1 {
  return {
    ...VALID_REQUIREMENT,

    trustedRegistries: [
      {
        network:
          NETWORK,

        contract: {
          index: "8004",
          subindex: 0,
        },

        moduleReference:
          MODULE_REFERENCE,
      },
    ],

    maxIndexerLagBlocks:
      5,
  };
}

function buildCases():
  readonly HarnessCase[] {
  const requirementUnknownKey =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementUnknownKey.unexpected =
    true;

  const requirementUnsupportedVersion =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementUnsupportedVersion.version =
    "2.0.0";

  const requirementUnsupportedStandard =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementUnsupportedStandard
    .registryStandard =
      "OTHER-REGISTRY";

  const requirementMissingRegistries =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementMissingRegistries
    .trustedRegistries = [];

  const requirementDuplicateRegistry =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementDuplicateRegistry
    .trustedRegistries = [
      cloneMutable(
        VALID_REQUIREMENT
          .trustedRegistries[0],
      ),
      cloneMutable(
        VALID_REQUIREMENT
          .trustedRegistries[0],
      ),
    ];

  const requirementInvalidThreshold =
    cloneMutable(
      VALID_REQUIREMENT,
    );

  requirementInvalidThreshold
    .maxEvidenceAgeSeconds = 60;

  requirementInvalidThreshold
    .revalidateBeforeReleaseIfOlderThanSeconds =
      61;

  const referenceUnknownKey =
    cloneMutable(
      VALID_REFERENCE,
    );

  referenceUnknownKey.unexpected =
    true;

  const referenceEmptyNetwork =
    cloneMutable(
      VALID_REFERENCE,
    );

  referenceEmptyNetwork.network =
    "";

  const referenceInvalidContractIndex =
    cloneMutable(
      VALID_REFERENCE,
    );

  referenceInvalidContractIndex
    .registryContract.index =
      "01";

  const referenceInvalidTokenId =
    cloneMutable(
      VALID_REFERENCE,
    );

  referenceInvalidTokenId
    .agentTokenId =
      "-1";

  const referenceMalformedTokenAddress =
    cloneMutable(
      VALID_REFERENCE,
    );

  referenceMalformedTokenAddress
    .tokenAddress =
      "not-a-caip19-shaped-address";

  const verifiedWithFailureReason =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  verifiedWithFailureReason.reason =
    "agent_registry_revoked";

  const verifiedWithRevokedStatus =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  verifiedWithRevokedStatus
    .state.status =
      "Revoked";

  const verifiedWithStaleEvidence =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  verifiedWithStaleEvidence
    .freshness.fresh =
      false;

  const missingCapabilityPolicySatisfied =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  missingCapabilityPolicySatisfied
    .verified =
      false;

  missingCapabilityPolicySatisfied
    .reason =
      "agent_capability_missing";

  missingCapabilityPolicySatisfied
    .capabilities.satisfied = [
      "x402.payment.authorize",
    ];

  missingCapabilityPolicySatisfied
    .capabilities.missing = [
      "resource.premium.read",
    ];

  missingCapabilityPolicySatisfied
    .capabilities.policySatisfied =
      true;

  const verifiedKeyWithoutFingerprint =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  verifiedKeyWithoutFingerprint
    .keyBinding.keyFingerprint =
      null;

  const verifiedOwnerWithoutBinding =
    cloneMutable(
      VALID_VERIFIED_RESULT,
    );

  verifiedOwnerWithoutBinding
    .state.ownerAccountBound =
      false;

  const malformedEvidenceHash =
    cloneMutable(
      VALID_REVOKED_RESULT,
    );

  malformedEvidenceHash.evidenceHash =
    "ABC123";

  return [
    {
      name:
        "canonical required registry requirement",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        VALID_REQUIREMENT,

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "requirement with optional module and lag constraint",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        validOptionalRequirement(),

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "canonical registry reference",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        VALID_REFERENCE,

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "verified result with required native key binding",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        VALID_VERIFIED_RESULT,

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "coherent revoked result",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        VALID_REVOKED_RESULT,

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "owner known while identity assurance is not evaluated",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        VALID_OWNER_NOT_EVALUATED_RESULT,

      expectedOk:
        true,

      expectedReason:
        "valid",
    },
    {
      name:
        "requirement unknown top-level key fails closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementUnknownKey,

      expectedOk:
        false,

      expectedReason:
        "invalid_object_shape",
    },
    {
      name:
        "unsupported requirement version fails closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementUnsupportedVersion,

      expectedOk:
        false,

      expectedReason:
        "unsupported_version",
    },
    {
      name:
        "unsupported registry standard fails closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementUnsupportedStandard,

      expectedOk:
        false,

      expectedReason:
        "unsupported_registry_standard",
    },
    {
      name:
        "required requirement without trusted registry fails closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementMissingRegistries,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_requirement",
    },
    {
      name:
        "duplicate trusted registry fails closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementDuplicateRegistry,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_requirement",
    },
    {
      name:
        "contradictory freshness thresholds fail closed",

      contractKind:
        "requirement",

      validator:
        validateAgentRegistryRequirementV1,

      input:
        requirementInvalidThreshold,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_requirement",
    },
    {
      name:
        "reference unknown top-level key fails closed",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        referenceUnknownKey,

      expectedOk:
        false,

      expectedReason:
        "invalid_object_shape",
    },
    {
      name:
        "empty reference network fails closed",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        referenceEmptyNetwork,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_reference",
    },
    {
      name:
        "noncanonical contract index fails closed",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        referenceInvalidContractIndex,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_reference",
    },
    {
      name:
        "invalid AgentTokenId fails closed",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        referenceInvalidTokenId,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_reference",
    },
    {
      name:
        "malformed token address fails closed",

      contractKind:
        "reference",

      validator:
        validateAgentRegistryReferenceV1,

      input:
        referenceMalformedTokenAddress,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_reference",
    },
    {
      name:
        "verified result with failure reason fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        verifiedWithFailureReason,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "verified result with revoked status fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        verifiedWithRevokedStatus,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "verified result with stale evidence fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        verifiedWithStaleEvidence,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "missing capability with positive policy fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        missingCapabilityPolicySatisfied,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "verified key without fingerprint fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        verifiedKeyWithoutFingerprint,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "verified owner identity without account binding fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        verifiedOwnerWithoutBinding,

      expectedOk:
        false,

      expectedReason:
        "incoherent_registry_trust_result",
    },
    {
      name:
        "malformed evidence hash fails closed",

      contractKind:
        "trust_result",

      validator:
        validateAgentRegistryTrustResultV1,

      input:
        malformedEvidenceHash,

      expectedOk:
        false,

      expectedReason:
        "invalid_registry_trust_result",
    },
  ];
}

function assertArchitectureInvariants():
  void {
  const invariants =
    PHASE6_AGENT_REGISTRY_ARCHITECTURE_INVARIANTS;

  assert.ok(
    Object.isFrozen(invariants),
  );

  assert.ok(
    Object.isFrozen(
      invariants.gateway,
    ),
  );

  assert.ok(
    Object.isFrozen(
      invariants.registryPlugin,
    ),
  );

  assert.ok(
    Object.isFrozen(
      invariants.ufx,
    ),
  );

  assert.ok(
    Object.isFrozen(
      invariants.settlementRail,
    ),
  );

  assert.ok(
    Object.isFrozen(
      invariants.orchestrator,
    ),
  );

  assert.ok(
    Object.isFrozen(
      invariants.runtime,
    ),
  );

  assert.equal(
    invariants
      .gateway
      .ownsPaymentRequiredConstruction,
    true,
  );

  assert.equal(
    invariants
      .gateway
      .ownsConditionalGating,
    true,
  );

  assert.equal(
    invariants
      .gateway
      .ownsFinalResourceRelease,
    true,
  );

  assert.equal(
    invariants
      .registryPlugin
      .providesAuthenticatedTrustFacts,
    true,
  );

  assert.equal(
    invariants
      .registryPlugin
      .ownsResourceRelease,
    false,
  );

  assert.equal(
    invariants
      .ufx
      .ownsSettlementNormalization,
    true,
  );

  assert.equal(
    invariants
      .ufx
      .ownsSignedSettlementResults,
    true,
  );

  assert.equal(
    invariants
      .ufx
      .ownsFinalResourceRelease,
    false,
  );

  assert.equal(
    invariants
      .settlementRail
      .ownsChainSpecificSettlementMechanics,
    true,
  );

  assert.equal(
    invariants
      .settlementRail
      .ownsConditionalGating,
    false,
  );

  assert.equal(
    invariants
      .orchestrator
      .requiredForPhase6,
    false,
  );

  assert.equal(
    invariants
      .runtime
      .liveRegistryLookup,
    false,
  );

  assert.equal(
    invariants
      .runtime
      .gatewayRuntimeChanged,
    false,
  );

  assert.equal(
    invariants
      .runtime
      .paymentAttempted,
    false,
  );

  assert.equal(
    invariants
      .runtime
      .resourceReleased,
    false,
  );

  assert.equal(
    invariants
      .runtime
      .productionActivation,
    false,
  );
}

function main():
  void {
  assert.deepEqual(
    AGENT_REGISTRY_TRUST_REASON_CODES,
    EXPECTED_TRUST_REASONS,
  );

  assertArchitectureInvariants();

  const cases =
    buildCases();

  assert.equal(
    cases.length,
    24,
    "the PR #298 matrix is frozen at 24 focused cases",
  );

  const results =
    cases.map(
      (testCase) => {
        const result =
          testCase.validator(
            testCase.input,
          );

        assert.equal(
          result.contractKind,
          testCase.contractKind,
          testCase.name,
        );

        assert.equal(
          result.ok,
          testCase.expectedOk,
          testCase.name,
        );

        assert.equal(
          result.status,
          testCase.expectedOk
            ? "accepted"
            : "rejected",
          testCase.name,
        );

        assert.equal(
          result.validationReason,
          testCase.expectedReason,
          testCase.name,
        );

        if (testCase.expectedOk) {
          assert.notEqual(
            result.value,
            null,
            testCase.name,
          );
        } else {
          assert.equal(
            result.value,
            null,
            testCase.name,
          );
        }

        assertSafetyContract(
          result,
          testCase.name,
        );

        return {
          name:
            testCase.name,

          contractKind:
            testCase.contractKind,

          expectedOk:
            testCase.expectedOk,

          actualOk:
            result.ok,

          expectedReason:
            testCase.expectedReason,

          actualReason:
            result.validationReason,
        };
      },
    );

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
    6,
  );

  assert.equal(
    rejectedCaseCount,
    18,
  );

  const safety = {
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
  } as const;

  const acceptanceMarkers = {
    PR298_AGENT_REGISTRY_REQUIREMENT_CONTRACT:
      true,

    PR298_AGENT_REGISTRY_REFERENCE_CONTRACT:
      true,

    PR298_AGENT_REGISTRY_TRUST_RESULT_CONTRACT:
      true,

    PR298_AGENT_REGISTRY_REASON_CODES_FROZEN:
      true,

    PR298_ARCHITECTURE_INVARIANTS_FROZEN:
      true,

    PR298_GATEWAY_RELEASE_AUTHORITY_PRESERVED:
      true,

    PR298_UFX_SETTLEMENT_AUTHORITY_PRESERVED:
      true,

    PR298_SETTLEMENT_RAIL_BOUNDARY_PRESERVED:
      true,

    PR298_ORCHESTRATOR_REQUIRED:
      false,

    PR298_LIVE_REGISTRY_LOOKUP:
      false,

    PR298_GATEWAY_RUNTIME_CHANGED:
      false,

    PR298_PAYMENT_ATTEMPTED:
      false,

    PR298_RESOURCE_RELEASED:
      false,

    PR298_PRODUCTION_ACTIVATION:
      false,

    PR298_PHASE6_CONTRACT_ACCEPTANCE:
      true,
  } as const;

  const summary = {
    ok: true,
    label:
      LABEL,
    contract:
      CONTRACT,
    mode:
      MODE,

    contractVersion:
      AGENT_REGISTRY_CONTRACT_VERSION,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    caseCount:
      results.length,

    acceptedCaseCount,
    rejectedCaseCount,

    reasonCodeCount:
      AGENT_REGISTRY_TRUST_REASON_CODES
        .length,

    cases:
      results,

    architecture: {
      gatewayFinalReleaseAuthority:
        true,

      registryPluginTrustFactsOnly:
        true,

      ufxSettlementCoordination:
        true,

      settlementRailChainMechanicsOnly:
        true,

      orchestratorRequired:
        false,
    },

    safety,
    acceptanceMarkers,

    nextFiniteRung:
      "#299 controlled Gateway Agent Registry resolver seam",
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  for (
    const [
      marker,
      value,
    ] of Object.entries(
      acceptanceMarkers,
    )
  ) {
    console.log(
      `${marker}=${String(value)}`,
    );
  }
}

main();
