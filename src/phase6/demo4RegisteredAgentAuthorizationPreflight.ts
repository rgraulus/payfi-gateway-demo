/**
 * PR #316 — Demo4 D4-2 Registered-Agent Authorization Preflight.
 *
 * Phase 6 owns this seam.
 *
 * Frozen flow:
 *   buyer delegation/lifecycle prerequisite evidence
 *   -> live registered-agent trust
 *   -> buyer policy
 *   -> read-only bounded-use eligibility
 *   -> STOP
 *
 * This module is pure. It performs no database, network, wallet, signer,
 * contract, transaction, payment, receipt, resource-release, or production
 * operation. Phase 5 source remains unchanged and is consumed only through
 * already-existing result contracts.
 */

import type {
  Phase5AgentDelegationLifecycleResult,
} from "../phase5/agentDelegationLifecycle";

import type {
  Phase5AgentDelegationRevocationResult,
  Phase5AgentDelegationUsageSnapshot,
} from "../db/phase5AgentDelegationLifecycleStore";

import type {
  Phase5AgentPolicyEvaluationResult,
} from "../phase5/agentPolicyEvaluator";

import type {
  Phase6AgentRegistryConditionalGatingResultV1,
} from "./agentRegistryConditionalGatingComposition";

import type {
  Phase6AgentRegistryAuthorizationAuditInsertResultV1,
} from "../db/phase6AgentRegistryAuthorizationAuditStore";

export const DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_TYPE =
  "xcf.phase6.demo4-d4-2-registered-agent-authorization-preflight" as const;

export const DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_VERSION =
  "1.0.0" as const;

export const DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_MODE =
  "phase6_live_registered_agent_read_only_preflight" as const;

export const DEMO4_D4_2_SUCCESS_REASON =
  "d4_2_registered_agent_authorization_preflight_ready" as const;

export const DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE =
  Object.freeze({
    evidenceMode:
      "live_read_only" as const,

    canonicalNetwork:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    phase6RegistryNetwork:
      "ccd:testnet",

    cis8004:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              "12802",
            subindex:
              0,
          }),

        moduleReference:
          "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

        tokenId:
          "287",

        tokenAddress:
          "ccd:testnet/cis2:12802-0-287",

        ownerAccount:
          "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
      }),

    cis8:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              "12801",
            subindex:
              0,
          }),

        moduleReference:
          "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",

        externalKey:
          Object.freeze({
            namespace:
              "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",

            keyType:
              "ed25519",

            publicKeyHex:
              "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
          }),
      }),

    agentCard:
      Object.freeze({
        uri:
          "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

        sha256:
          "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
      }),

    registryConfigPinned:
      true,

    cis8ConfigPinned:
      true,

    agentCardHttpsRequired:
      true,

    controlledEvidenceActive:
      false,
  });

export type Demo4D42LiveRegisteredAgentProfileV1 = {
  readonly evidenceMode:
    "live_read_only" | "controlled_or_fixture";

  readonly canonicalNetwork: string;
  readonly phase6RegistryNetwork: string;

  readonly cis8004: {
    readonly contract: {
      readonly index: string;
      readonly subindex: number;
    };

    readonly moduleReference: string;
    readonly tokenId: string;
    readonly tokenAddress: string;
    readonly ownerAccount: string;
  };

  readonly cis8: {
    readonly contract: {
      readonly index: string;
      readonly subindex: number;
    };

    readonly moduleReference: string;

    readonly externalKey: {
      readonly namespace: string;
      readonly keyType: string;
      readonly publicKeyHex: string;
    };
  };

  readonly agentCard: {
    readonly uri: string;
    readonly sha256: string;
  };

  readonly registryConfigPinned: boolean;
  readonly cis8ConfigPinned: boolean;
  readonly agentCardHttpsRequired: boolean;
  readonly controlledEvidenceActive: boolean;
};

export type Demo4D42RegisteredAgentAuthorizationPreflightReasonV1 =
  | typeof DEMO4_D4_2_SUCCESS_REASON
  | "live_registered_agent_profile_invalid"
  | "buyer_delegation_lifecycle_not_ready"
  | "buyer_delegation_revocation_not_clear"
  | "registered_agent_revalidation_required"
  | "registered_agent_trust_not_accepted"
  | "live_registry_evidence_required"
  | "live_cis8_evidence_required"
  | "live_agent_card_evidence_required"
  | "registered_agent_target_mismatch"
  | "sanitized_append_only_audit_not_persisted"
  | "buyer_policy_not_satisfied"
  | "bounded_use_contract_mismatch"
  | "bounded_use_state_invalid"
  | "bounded_use_exhausted";

export type Demo4D42RegisteredAgentAuthorizationPreflightInputV1 = {
  readonly liveProfile:
    Demo4D42LiveRegisteredAgentProfileV1;

  readonly lifecycle:
    Phase5AgentDelegationLifecycleResult;

  readonly revocation:
    Phase5AgentDelegationRevocationResult;

  readonly registeredAgentAuthorization:
    Phase6AgentRegistryConditionalGatingResultV1;

  readonly registryAudit:
    Phase6AgentRegistryAuthorizationAuditInsertResultV1;

  readonly buyerPolicy:
    Phase5AgentPolicyEvaluationResult;

  readonly usage:
    Phase5AgentDelegationUsageSnapshot;
};

export type Demo4D42RegisteredAgentAuthorizationPreflightResultV1 = {
  readonly type:
    typeof DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_TYPE;

  readonly version:
    typeof DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_VERSION;

  readonly mode:
    typeof DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_MODE;

  readonly ok: boolean;

  readonly status:
    "ready" | "denied" | "revalidation_required";

  readonly reason:
    Demo4D42RegisteredAgentAuthorizationPreflightReasonV1;

  readonly lifecycleReady: boolean;
  readonly revocationClear: boolean;

  readonly liveRegisteredAgentTrustSatisfied:
    boolean;

  readonly sanitizedAppendOnlyAuditPersisted:
    boolean;

  readonly buyerPolicyEvaluated: boolean;
  readonly buyerPolicySatisfied: boolean;

  readonly boundedUseChecked: boolean;
  readonly boundedUseEligible: boolean;

  readonly usageRowFound: boolean;
  readonly consumedUses: number | null;
  readonly maxUses: number | null;
  readonly remainingUses: number | null;

  readonly liveEvidence: {
    readonly profilePinned: boolean;
    readonly registryReadObserved: boolean;
    readonly cis8ReadObserved: boolean;
    readonly agentCardHttpsReadObserved: boolean;
    readonly controlledEvidenceActive: false;
  };

  readonly phase5SourceModified: false;
  readonly phase5ClaimInvoked: false;

  readonly auditPersistenceAttempted:
    boolean;

  readonly policyStateMutated: false;
  readonly canonicalStateMutated: false;

  readonly usageClaimCreated: false;
  readonly boundedUseConsumed: false;
  readonly replayStateMutated: false;

  readonly paymentAttempted: false;
  readonly receiptRequested: false;
  readonly receiptIssued: false;
  readonly paymentResponseEmitted: false;
  readonly resourceReleased: false;

  readonly walletRead: false;
  readonly privateKeyRead: false;
  readonly signingKeyUsed: false;
  readonly contractDryRunPerformed: false;
  readonly transactionConstructed: false;
  readonly transactionSubmitted: false;

  readonly productionActivation: false;
};

type ResultState = {
  readonly status?:
    "ready" | "denied" | "revalidation_required";

  readonly lifecycleReady?: boolean;
  readonly revocationClear?: boolean;

  readonly liveRegisteredAgentTrustSatisfied?:
    boolean;

  readonly sanitizedAppendOnlyAuditPersisted?:
    boolean;

  readonly buyerPolicyEvaluated?: boolean;
  readonly buyerPolicySatisfied?: boolean;

  readonly boundedUseChecked?: boolean;
  readonly boundedUseEligible?: boolean;

  readonly usageRowFound?: boolean;
  readonly consumedUses?: number | null;
  readonly maxUses?: number | null;
  readonly remainingUses?: number | null;

  readonly profilePinned?: boolean;
  readonly registryReadObserved?: boolean;
  readonly cis8ReadObserved?: boolean;
  readonly agentCardHttpsReadObserved?: boolean;

  readonly auditPersistenceAttempted?: boolean;
};

function buildResult(
  reason:
    Demo4D42RegisteredAgentAuthorizationPreflightReasonV1,
  state:
    ResultState = {},
): Demo4D42RegisteredAgentAuthorizationPreflightResultV1 {
  const ok =
    reason ===
      DEMO4_D4_2_SUCCESS_REASON;

  return {
    type:
      DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_VERSION,

    mode:
      DEMO4_D4_2_REGISTERED_AGENT_AUTHORIZATION_PREFLIGHT_MODE,

    ok,

    status:
      state.status ??
      (
        ok
          ? "ready"
          : "denied"
      ),

    reason,

    lifecycleReady:
      state.lifecycleReady ??
      false,

    revocationClear:
      state.revocationClear ??
      false,

    liveRegisteredAgentTrustSatisfied:
      state.liveRegisteredAgentTrustSatisfied ??
      false,

    sanitizedAppendOnlyAuditPersisted:
      state.sanitizedAppendOnlyAuditPersisted ??
      false,

    buyerPolicyEvaluated:
      state.buyerPolicyEvaluated ??
      false,

    buyerPolicySatisfied:
      state.buyerPolicySatisfied ??
      false,

    boundedUseChecked:
      state.boundedUseChecked ??
      false,

    boundedUseEligible:
      state.boundedUseEligible ??
      false,

    usageRowFound:
      state.usageRowFound ??
      false,

    consumedUses:
      state.consumedUses ??
      null,

    maxUses:
      state.maxUses ??
      null,

    remainingUses:
      state.remainingUses ??
      null,

    liveEvidence: {
      profilePinned:
        state.profilePinned ??
        false,

      registryReadObserved:
        state.registryReadObserved ??
        false,

      cis8ReadObserved:
        state.cis8ReadObserved ??
        false,

      agentCardHttpsReadObserved:
        state.agentCardHttpsReadObserved ??
        false,

      controlledEvidenceActive:
        false,
    },

    phase5SourceModified:
      false,

    phase5ClaimInvoked:
      false,

    auditPersistenceAttempted:
      state.auditPersistenceAttempted ??
      false,

    policyStateMutated:
      false,

    canonicalStateMutated:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    replayStateMutated:
      false,

    paymentAttempted:
      false,

    receiptRequested:
      false,

    receiptIssued:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
      false,

    walletRead:
      false,

    privateKeyRead:
      false,

    signingKeyUsed:
      false,

    contractDryRunPerformed:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    productionActivation:
      false,
  };
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

function exactLiveProfile(
  profile:
    Demo4D42LiveRegisteredAgentProfileV1,
): boolean {
  const expected =
    DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE;

  return (
    profile.evidenceMode ===
      "live_read_only" &&
    profile.canonicalNetwork ===
      expected.canonicalNetwork &&
    profile.phase6RegistryNetwork ===
      expected.phase6RegistryNetwork &&
    sameContractCoordinate(
      profile.cis8004.contract,
      expected.cis8004.contract,
    ) &&
    profile.cis8004.moduleReference ===
      expected.cis8004.moduleReference &&
    profile.cis8004.tokenId ===
      expected.cis8004.tokenId &&
    profile.cis8004.tokenAddress ===
      expected.cis8004.tokenAddress &&
    profile.cis8004.ownerAccount ===
      expected.cis8004.ownerAccount &&
    sameContractCoordinate(
      profile.cis8.contract,
      expected.cis8.contract,
    ) &&
    profile.cis8.moduleReference ===
      expected.cis8.moduleReference &&
    profile.cis8.externalKey.namespace ===
      expected.cis8.externalKey.namespace &&
    profile.cis8.externalKey.keyType ===
      expected.cis8.externalKey.keyType &&
    profile.cis8.externalKey.publicKeyHex ===
      expected.cis8.externalKey.publicKeyHex &&
    profile.agentCard.uri ===
      expected.agentCard.uri &&
    profile.agentCard.sha256 ===
      expected.agentCard.sha256 &&
    profile.registryConfigPinned ===
      true &&
    profile.cis8ConfigPinned ===
      true &&
    profile.agentCardHttpsRequired ===
      true &&
    profile.controlledEvidenceActive ===
      false
  );
}

function nonNegativeSafeInteger(
  value: unknown,
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value >=
      0
  );
}

export function evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
  input:
    Demo4D42RegisteredAgentAuthorizationPreflightInputV1,
): Demo4D42RegisteredAgentAuthorizationPreflightResultV1 {
  const profilePinned =
    exactLiveProfile(
      input.liveProfile,
    );

  if (!profilePinned) {
    return buildResult(
      "live_registered_agent_profile_invalid",
    );
  }

  const lifecycle =
    input.lifecycle;

  const lifecycleContract =
    lifecycle.lifecycleContract;

  const lifecycleReady =
    lifecycle.ok ===
      true &&
    lifecycle.status ===
      "accepted" &&
    lifecycle.reason ===
      "lifecycle_ready" &&
    lifecycle.lifecycleEvaluated ===
      true &&
    lifecycle.lifecycleContractValidated ===
      true &&
    lifecycle.lifecycleContractMatched ===
      true &&
    lifecycle.cryptographicDelegationVerified ===
      true &&
    lifecycle.cryptographicBindingVerified ===
      true &&
    lifecycle.validityEvaluatedAgainstClock ===
      true &&
    lifecycle.credentialCurrentlyValid ===
      true &&
    lifecycleContract !==
      null &&
    lifecycle.revocationChecked ===
      false &&
    lifecycle.boundedUseChecked ===
      false &&
    lifecycle.boundedUseConsumed ===
      false &&
    lifecycle.gatewayCalled ===
      false &&
    lifecycle.crpCalled ===
      false &&
    lifecycle.paymentAttempted ===
      false &&
    lifecycle.protectedResourceReleased ===
      false &&
    lifecycle.productionActivation ===
      false;

  if (
    !lifecycleReady ||
    lifecycleContract ===
      null
  ) {
    return buildResult(
      "buyer_delegation_lifecycle_not_ready",
      {
        profilePinned,
      },
    );
  }

  const revocation =
    input.revocation;

  const revocationClear =
    revocation.ok ===
      true &&
    revocation.reason ===
      "not_revoked" &&
    revocation.revocationChecked ===
      true &&
    revocation.delegationRevoked ===
      false &&
    revocation.lifecycleContractMatched ===
      true &&
    revocation.revocationId ===
      lifecycleContract.revocationId &&
    revocation.delegationId ===
      lifecycleContract.delegationId &&
    revocation.credentialHash ===
      lifecycleContract.credentialHash;

  if (!revocationClear) {
    return buildResult(
      "buyer_delegation_revocation_not_clear",
      {
        profilePinned,
        lifecycleReady:
          true,
      },
    );
  }

  const authorization =
    input.registeredAgentAuthorization;

  if (
    authorization.status ===
      "revalidation_required"
  ) {
    return buildResult(
      "registered_agent_revalidation_required",
      {
        status:
          "revalidation_required",

        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
      },
    );
  }

  if (
    authorization.ok !==
      true ||
    authorization.status !==
      "allowed" ||
    authorization.reason !==
      "accepted" ||
    authorization.phase5PreflightAccepted !==
      true ||
    authorization.paymentEligibilityHandoff ===
      null ||
    authorization.paymentEligibilityHandoff
      .eligible !==
      true ||
    authorization.phase5StateMutated !==
      false ||
    authorization.canonicalStateMutated !==
      false ||
    authorization.boundedUseConsumed !==
      false ||
    authorization.replayStateMutated !==
      false ||
    authorization.crpCalled !==
      false ||
    authorization.paymentAttempted !==
      false ||
    authorization.receiptIssued !==
      false ||
    authorization.paymentResponseEmitted !==
      false ||
    authorization.resourceReleased !==
      false ||
    authorization.transactionSubmitted !==
      false ||
    authorization.signingKeyUsed !==
      false ||
    authorization.productionActivation !==
      false
  ) {
    return buildResult(
      "registered_agent_trust_not_accepted",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
      },
    );
  }

  const evidence =
    authorization.evidence;

  const handoff =
    authorization.paymentEligibilityHandoff;

  const registryReadObserved =
    authorization.registryReadCaptured ===
      true &&
    authorization.agentRegistryLookupAttempted ===
      true &&
    authorization.registryNetworkCalled ===
      true &&
    evidence.freshness.source ===
      "direct_chain" &&
    evidence.freshness.fresh ===
      true &&
    evidence.freshness.revalidationRequired ===
      false &&
    evidence.freshness.finalizedBlockHeight !==
      null &&
    evidence.freshness.finalizedBlockHash !==
      null &&
    evidence.freshness.observedAt !==
      null;

  if (!registryReadObserved) {
    return buildResult(
      "live_registry_evidence_required",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
      },
    );
  }

  const cis8ReadObserved =
    authorization.cis8LookupAttempted ===
      true &&
    evidence.keyBinding.required ===
      true &&
    evidence.keyBinding.verified ===
      true &&
    evidence.keyBinding.bindingType ===
      "CIS-8" &&
    evidence.keyBinding.keyFingerprint !==
      null;

  if (!cis8ReadObserved) {
    return buildResult(
      "live_cis8_evidence_required",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        registryReadObserved:
          true,
      },
    );
  }

  const agentCardHttpsReadObserved =
    authorization.agentCardFetchAttempted ===
      true &&
    authorization.agentCardNetworkCalled ===
      true &&
    evidence.agentCard.integrityVerified ===
      true &&
    evidence.agentCard.expectedHash ===
      input.liveProfile.agentCard.sha256 &&
    evidence.agentCard.actualHash ===
      input.liveProfile.agentCard.sha256 &&
    evidence.agentCard.byteLength !==
      null &&
    evidence.agentCard.byteLength >
      0 &&
    evidence.capabilities.required.length >
      0 &&
    evidence.capabilities.missing.length ===
      0 &&
    evidence.capabilities.policySatisfied ===
      true;

  if (!agentCardHttpsReadObserved) {
    return buildResult(
      "live_agent_card_evidence_required",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
      },
    );
  }

  const registry =
    evidence.registryIdentity;

  const accountability =
    evidence.accountability;

  const registeredAgentTargetMatches =
    registry.network ===
      input.liveProfile.phase6RegistryNetwork &&
    registry.contract !==
      null &&
    sameContractCoordinate(
      registry.contract,
      input.liveProfile.cis8004.contract,
    ) &&
    registry.moduleReference ===
      input.liveProfile.cis8004.moduleReference &&
    registry.agentTokenId ===
      input.liveProfile.cis8004.tokenId &&
    registry.tokenAddress ===
      input.liveProfile.cis8004.tokenAddress &&
    accountability.registryStatus ===
      "Active" &&
    accountability.ownerAccount ===
      input.liveProfile.cis8004.ownerAccount &&
    accountability.ownerAccountBound ===
      true &&
    handoff.registry.network ===
      input.liveProfile.phase6RegistryNetwork &&
    sameContractCoordinate(
      handoff.registry.contract,
      input.liveProfile.cis8004.contract,
    ) &&
    handoff.registry.moduleReference ===
      input.liveProfile.cis8004.moduleReference &&
    handoff.registry.agentTokenId ===
      input.liveProfile.cis8004.tokenId &&
    handoff.registry.tokenAddress ===
      input.liveProfile.cis8004.tokenAddress &&
    handoff.registry.ownerAccount ===
      input.liveProfile.cis8004.ownerAccount &&
    handoff.scope.maxUses ===
      lifecycleContract.maxUses &&
    handoff.paymentAttempted ===
      false &&
    handoff.productionActivation ===
      false;

  if (!registeredAgentTargetMatches) {
    return buildResult(
      "registered_agent_target_mismatch",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
        agentCardHttpsReadObserved:
          true,
      },
    );
  }

  const audit =
    input.registryAudit;

  const auditPersisted =
    audit.ok ===
      true &&
    audit.reason ===
      "inserted" &&
    audit.decision ===
      "allowed" &&
    audit.auditPersisted ===
      true &&
    audit.persistenceAttempted ===
      true &&
    audit.databaseCalled ===
      true &&
    audit.auditId !==
      null &&
    audit.recordedAt !==
      null &&
    audit.registryEvidenceHash !==
      null &&
    audit.authorizationEvidenceHash !==
      null &&
    audit.updateAttempted ===
      false &&
    audit.deleteAttempted ===
      false &&
    audit.rawMaterialPersisted ===
      false &&
    audit.productionActivation ===
      false;

  if (!auditPersisted) {
    return buildResult(
      "sanitized_append_only_audit_not_persisted",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        liveRegisteredAgentTrustSatisfied:
          true,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
        agentCardHttpsReadObserved:
          true,
        auditPersistenceAttempted:
          audit.persistenceAttempted ===
            true,
      },
    );
  }

  const policy =
    input.buyerPolicy;

  const buyerPolicyEvaluated =
    policy.policyEvaluated ===
      true;

  const buyerPolicySatisfied =
    policy.ok ===
      true &&
    policy.status ===
      "allowed" &&
    policy.reason ===
      "policy_satisfied" &&
    policy.authorizationAccepted ===
      true &&
    policy.authorizationBindingEvaluated ===
      true &&
    policy.policyEvaluated ===
      true &&
    policy.policyDecision ===
      "allow" &&
    policy.rawProofPrinted ===
      false &&
    policy.gatewayCalled ===
      false &&
    policy.crpCalled ===
      false &&
    policy.paymentAttempted ===
      false &&
    policy.receiptJwsPrinted ===
      false &&
    policy.paymentResponsePrinted ===
      false &&
    policy.protectedResourceReleased ===
      false &&
    policy.replayStateMutated ===
      false &&
    policy.policyStatePersisted ===
      false &&
    policy.productionActivation ===
      false;

  if (!buyerPolicySatisfied) {
    return buildResult(
      "buyer_policy_not_satisfied",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        liveRegisteredAgentTrustSatisfied:
          true,
        sanitizedAppendOnlyAuditPersisted:
          true,
        buyerPolicyEvaluated,
        buyerPolicySatisfied:
          false,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
        agentCardHttpsReadObserved:
          true,
        auditPersistenceAttempted:
          true,
      },
    );
  }

  const usage =
    input.usage;

  let usageRowFound =
    false;

  let consumedUses =
    0;

  let maxUses =
    lifecycleContract.maxUses;

  let remainingUses =
    lifecycleContract.maxUses;

  if (!nonNegativeSafeInteger(maxUses) || maxUses === 0) {
    return buildResult(
      "bounded_use_state_invalid",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        liveRegisteredAgentTrustSatisfied:
          true,
        sanitizedAppendOnlyAuditPersisted:
          true,
        buyerPolicyEvaluated:
          true,
        buyerPolicySatisfied:
          true,
        boundedUseChecked:
          true,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
        agentCardHttpsReadObserved:
          true,
        auditPersistenceAttempted:
          true,
      },
    );
  }

  if (usage.found) {
    usageRowFound =
      true;

    if (
      usage.credentialHash !==
        lifecycleContract.credentialHash ||
      usage.delegationId !==
        lifecycleContract.delegationId ||
      usage.revocationId !==
        lifecycleContract.revocationId ||
      usage.buyerKeyVersion !==
        lifecycleContract.buyerKeyVersion ||
      usage.agentKeyVersion !==
        lifecycleContract.agentKeyVersion ||
      usage.maxUses !==
        lifecycleContract.maxUses
    ) {
      return buildResult(
        "bounded_use_contract_mismatch",
        {
          profilePinned,
          lifecycleReady:
            true,
          revocationClear:
            true,
          liveRegisteredAgentTrustSatisfied:
            true,
          sanitizedAppendOnlyAuditPersisted:
            true,
          buyerPolicyEvaluated:
            true,
          buyerPolicySatisfied:
            true,
          boundedUseChecked:
            true,
          usageRowFound:
            true,
          registryReadObserved:
            true,
          cis8ReadObserved:
            true,
          agentCardHttpsReadObserved:
            true,
          auditPersistenceAttempted:
            true,
        },
      );
    }

    if (
      !nonNegativeSafeInteger(
        usage.consumedUses,
      ) ||
      !nonNegativeSafeInteger(
        usage.claimCount,
      ) ||
      usage.claimCount !==
        usage.consumedUses ||
      usage.consumedUses >
        usage.maxUses
    ) {
      return buildResult(
        "bounded_use_state_invalid",
        {
          profilePinned,
          lifecycleReady:
            true,
          revocationClear:
            true,
          liveRegisteredAgentTrustSatisfied:
            true,
          sanitizedAppendOnlyAuditPersisted:
            true,
          buyerPolicyEvaluated:
            true,
          buyerPolicySatisfied:
            true,
          boundedUseChecked:
            true,
          usageRowFound:
            true,
          consumedUses:
            usage.consumedUses,
          maxUses:
            usage.maxUses,
          registryReadObserved:
            true,
          cis8ReadObserved:
            true,
          agentCardHttpsReadObserved:
            true,
          auditPersistenceAttempted:
            true,
        },
      );
    }

    consumedUses =
      usage.consumedUses;

    maxUses =
      usage.maxUses;

    remainingUses =
      maxUses -
      consumedUses;
  }

  if (remainingUses <= 0) {
    return buildResult(
      "bounded_use_exhausted",
      {
        profilePinned,
        lifecycleReady:
          true,
        revocationClear:
          true,
        liveRegisteredAgentTrustSatisfied:
          true,
        sanitizedAppendOnlyAuditPersisted:
          true,
        buyerPolicyEvaluated:
          true,
        buyerPolicySatisfied:
          true,
        boundedUseChecked:
          true,
        usageRowFound,
        consumedUses,
        maxUses,
        remainingUses,
        registryReadObserved:
          true,
        cis8ReadObserved:
          true,
        agentCardHttpsReadObserved:
          true,
        auditPersistenceAttempted:
          true,
      },
    );
  }

  return buildResult(
    DEMO4_D4_2_SUCCESS_REASON,
    {
      status:
        "ready",

      profilePinned,
      lifecycleReady:
        true,
      revocationClear:
        true,

      liveRegisteredAgentTrustSatisfied:
        true,

      sanitizedAppendOnlyAuditPersisted:
        true,

      buyerPolicyEvaluated:
        true,
      buyerPolicySatisfied:
        true,

      boundedUseChecked:
        true,
      boundedUseEligible:
        true,

      usageRowFound,
      consumedUses,
      maxUses,
      remainingUses,

      registryReadObserved:
        true,
      cis8ReadObserved:
        true,
      agentCardHttpsReadObserved:
        true,

      auditPersistenceAttempted:
        true,
    },
  );
}
