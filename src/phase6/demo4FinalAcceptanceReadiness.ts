/**
 * PR #317 — Phase 6 Demo4 D4-3 Final Acceptance Readiness.
 *
 * Frozen boundary:
 *   merged/live-proven D4-2 authorization capability
 *   -> D4-3 readiness certification
 *   -> frozen exactly-one PR #318 execution contract
 *   -> STOP
 *
 * This module is deliberately pure and deterministic.
 *
 * It performs no:
 * - environment reads;
 * - database access;
 * - HTTP/gRPC/network calls;
 * - Gateway challenge creation;
 * - /paid-gated/redeem call;
 * - Phase 5 claim;
 * - private-key or payer-wallet read;
 * - signer creation;
 * - transaction construction/signing/submission;
 * - payment;
 * - CRP fulfill;
 * - receipt request/issuance;
 * - replay mutation;
 * - canonical settlement/release persistence;
 * - PAYMENT-RESPONSE emission;
 * - protected-resource release;
 * - production activation.
 *
 * Runtime/read-only observation belongs to the dedicated PR #317 runner.
 */

export const DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_TYPE =
  "xcf.phase6.demo4-d4-3-final-acceptance-readiness" as const;

export const DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_VERSION =
  "1.0.0" as const;

export const DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_MODE =
  "phase6_demo4_d4_3_zero_side_effect_readiness" as const;

export const DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON =
  "d4_3_final_acceptance_readiness_ready" as const;

export const DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE =
  Object.freeze({
    evidenceMode:
      "live_read_only" as const,

    canonicalChainId:
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

        byteLength:
          282,
      }),

    controlledEvidenceActive:
      false,
  });

export const DEMO4_D4_3_PAYMENT_CONTRACT =
  Object.freeze({
    network:
      "concordium:testnet",

    canonicalChainId:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    networkGenesisIndex:
      7,

    assetType:
      "PLT",

    tokenId:
      "EUDemo",

    decimals:
      6,

    amount:
      "0.050101",

    amountRaw:
      "50101",

    merchantId:
      "demo-merchant",

    resourceMethod:
      "GET",

    resourcePath:
      "/paid-gated",

    payTo:
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

    maxPaymentSubmissions:
      1,

    automaticRetry:
      false,

    productionActivation:
      false,
  });

export const DEMO4_D4_3_PAYER_EXECUTION_CONTRACT =
  Object.freeze({
    packageCommand:
      "payer:plt",

    walletCustodyPath:
      "keys/wallet.export",

    actingPrivateKeyCustodyPath:
      "$HOME/.xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-private.pk8.pem",

    maxPaymentSubmissions:
      1,

    automaticRetry:
      false,
  });

export type Demo4D43RegisteredAgentProfileV1 = {
  readonly evidenceMode:
    "live_read_only" | "controlled_or_fixture";

  readonly canonicalChainId: string;
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
    readonly byteLength: number;
  };

  readonly controlledEvidenceActive: boolean;
};

export type Demo4D43PaymentTupleV1 = {
  readonly network: string;
  readonly canonicalChainId: string;
  readonly networkGenesisIndex: number;
  readonly assetType: string;
  readonly tokenId: string;
  readonly decimals: number;
  readonly amount: string;
  readonly amountRaw: string;
  readonly merchantId: string;
  readonly resourceMethod: string;
  readonly resourcePath: string;
  readonly payTo: string;
};

export type Demo4D43FinalAcceptanceReadinessReasonV1 =
  | typeof DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON
  | "d4_2_prerequisite_missing"
  | "d4_2_prerequisite_mutated"
  | "fresh_d4_3_authorization_not_required"
  | "live_registered_agent_profile_invalid"
  | "controlled_positive_identity_evidence_forbidden"
  | "buyer_delegation_path_not_ready"
  | "revocation_path_not_ready"
  | "revocation_not_clear"
  | "bounded_use_not_eligible"
  | "payment_tuple_mismatch"
  | "payer_execution_surface_not_ready"
  | "payer_custody_not_ready"
  | "payment_submission_contract_invalid"
  | "settlement_spine_not_ready"
  | "crp_not_ready"
  | "receipt_path_not_ready"
  | "replay_mode_not_ready"
  | "canonical_release_path_not_ready"
  | "alternate_settlement_architecture_forbidden"
  | "post_execution_evidence_plan_incomplete"
  | "viewer_contract_not_ready"
  | "readiness_side_effect_detected"
  | "production_activation_forbidden";

export type Demo4D43FinalAcceptanceReadinessInputV1 = {
  readonly d42Prerequisite: {
    readonly completedLiveProven: boolean;
    readonly phase5ClaimInvoked: boolean;
    readonly boundedUseConsumed: boolean;
    readonly paymentAttempted: boolean;
    readonly receiptIssued: boolean;
    readonly resourceReleased: boolean;
    readonly freshD43AuthorizationRequired: boolean;
  };

  readonly registeredAgentProfile:
    Demo4D43RegisteredAgentProfileV1;

  readonly buyerReadiness: {
    readonly delegationPathAvailable: boolean;
    readonly lifecyclePathAvailable: boolean;
    readonly revocationPathAvailable: boolean;
    readonly revocationClear: boolean;
    readonly boundedUseEligibilityPathAvailable: boolean;
    readonly boundedUseEligible: boolean;
  };

  readonly paymentTuple:
    Demo4D43PaymentTupleV1;

  readonly payerReadiness: {
    readonly packageCommand: string;
    readonly payerCommandSurfaceExists: boolean;

    readonly walletCustodyPath: string;
    readonly walletCustodyPathExists: boolean;

    readonly actingPrivateKeyCustodyPath: string;
    readonly actingPrivateKeyCustodyPathExists: boolean;

    readonly maxPaymentSubmissions: number;
    readonly automaticRetry: boolean;
  };

  readonly settlementReadiness: {
    readonly gatewayHealthReady: boolean;
    readonly gatewayReady: boolean;

    readonly crpHealthReady: boolean;
    readonly crpJwksReady: boolean;

    readonly receiptVerificationPathReady: boolean;

    readonly replayMode:
      "memory" | "redis" | null;

    readonly replayModeKnown: boolean;
    readonly replayModeIntended: boolean;

    readonly canonicalReleasePersistencePathReady: boolean;

    readonly protectedResourcePath: string;

    readonly reuseExistingConcordiumSettlementSpine: boolean;

    readonly alternateParallelSettlementArchitectureRequested:
      boolean;
  };

  readonly postExecutionEvidencePlan: {
    readonly finalizedTransaction: boolean;
    readonly crpIndexing: boolean;
    readonly crpFulfillment: boolean;
    readonly receiptIssuance: boolean;
    readonly receiptVerification: boolean;
    readonly canonicalChallengeTransition: boolean;
    readonly releaseEvent: boolean;
    readonly paymentResponseOccurrence: boolean;
    readonly protectedResourceReleasedOnce: boolean;
    readonly boundedUseConsumedOnce: boolean;
    readonly replayRejected: boolean;
    readonly noSecondPayment: boolean;
    readonly noSecondClaim: boolean;
    readonly noSecondCrpFulfillment: boolean;
    readonly noSecondRelease: boolean;
    readonly finalPhase6Audit: boolean;
    readonly productionFalse: boolean;
  };

  readonly viewer: {
    readonly observerOnly: boolean;
    readonly sanitizedMilestonesReady: boolean;
    readonly executionAuthority: boolean;
    readonly exposesSensitiveAudienceData: boolean;
  };

  readonly sideEffects: {
    readonly gatewayChallengeCreated: boolean;
    readonly paidGatedRedeemCalled: boolean;
    readonly phase5ClaimInvoked: boolean;
    readonly usageClaimCreated: boolean;
    readonly boundedUseConsumed: boolean;
    readonly actingPrivateKeyRead: boolean;
    readonly payerWalletRead: boolean;
    readonly signerCreated: boolean;
    readonly signingPerformed: boolean;
    readonly transactionConstructed: boolean;
    readonly transactionSubmitted: boolean;
    readonly paymentAttempted: boolean;
    readonly crpFulfillCalled: boolean;
    readonly receiptRequested: boolean;
    readonly receiptIssued: boolean;
    readonly replayStateMutated: boolean;
    readonly canonicalSettlementMutated: boolean;
    readonly canonicalReleasePersisted: boolean;
    readonly paymentResponseEmitted: boolean;
    readonly resourceReleased: boolean;
    readonly productionActivation: boolean;
  };
};

export type Demo4D43FinalAcceptanceReadinessResultV1 = {
  readonly type:
    typeof DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_TYPE;

  readonly version:
    typeof DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_VERSION;

  readonly mode:
    typeof DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_MODE;

  readonly ok: boolean;

  readonly status:
    "ready" | "denied";

  readonly reason:
    Demo4D43FinalAcceptanceReadinessReasonV1;

  readonly d42PrerequisiteReady: boolean;
  readonly freshD43AuthorizationRequired: boolean;

  readonly liveRegisteredAgentProfilePinned: boolean;

  readonly buyerDelegationPathReady: boolean;
  readonly revocationPathReady: boolean;
  readonly revocationClear: boolean;
  readonly boundedUseEligible: boolean;

  readonly paymentTupleFrozen: boolean;

  readonly payerExecutionSurfaceReady: boolean;
  readonly actingKeyCustodyReady: boolean;
  readonly payerWalletCustodyReady: boolean;

  readonly settlementSpineReady: boolean;
  readonly crpReady: boolean;
  readonly receiptPathReady: boolean;
  readonly replayPathReady: boolean;
  readonly replayMode: "memory" | "redis" | null;
  readonly canonicalReleasePathReady: boolean;

  readonly postExecutionEvidencePlanReady: boolean;
  readonly viewerContractReady: boolean;

  readonly nextRungMaxPaymentSubmissions: number;
  readonly automaticRetry: false;

  readonly gatewayChallengeCreated: false;
  readonly paidGatedRedeemCalled: false;
  readonly phase5ClaimInvoked: false;
  readonly usageClaimCreated: false;
  readonly boundedUseConsumed: false;

  readonly actingPrivateKeyRead: false;
  readonly payerWalletRead: false;
  readonly signerCreated: false;
  readonly signingPerformed: false;
  readonly transactionConstructed: false;
  readonly transactionSubmitted: false;
  readonly paymentAttempted: false;

  readonly crpFulfillCalled: false;
  readonly receiptRequested: false;
  readonly receiptIssued: false;

  readonly replayStateMutated: false;
  readonly canonicalSettlementMutated: false;
  readonly canonicalReleasePersisted: false;

  readonly paymentResponseEmitted: false;
  readonly resourceReleased: false;

  readonly productionActivation: false;
};

type ResultState = {
  readonly d42PrerequisiteReady?: boolean;
  readonly freshD43AuthorizationRequired?: boolean;

  readonly liveRegisteredAgentProfilePinned?: boolean;

  readonly buyerDelegationPathReady?: boolean;
  readonly revocationPathReady?: boolean;
  readonly revocationClear?: boolean;
  readonly boundedUseEligible?: boolean;

  readonly paymentTupleFrozen?: boolean;

  readonly payerExecutionSurfaceReady?: boolean;
  readonly actingKeyCustodyReady?: boolean;
  readonly payerWalletCustodyReady?: boolean;

  readonly settlementSpineReady?: boolean;
  readonly crpReady?: boolean;
  readonly receiptPathReady?: boolean;
  readonly replayPathReady?: boolean;
  readonly replayMode?: "memory" | "redis" | null;
  readonly canonicalReleasePathReady?: boolean;

  readonly postExecutionEvidencePlanReady?: boolean;
  readonly viewerContractReady?: boolean;
};

function buildResult(
  reason:
    Demo4D43FinalAcceptanceReadinessReasonV1,
  state:
    ResultState = {},
): Demo4D43FinalAcceptanceReadinessResultV1 {
  const ok =
    reason ===
      DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON;

  return {
    type:
      DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_TYPE,

    version:
      DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_VERSION,

    mode:
      DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_MODE,

    ok,

    status:
      ok
        ? "ready"
        : "denied",

    reason,

    d42PrerequisiteReady:
      state.d42PrerequisiteReady ??
      false,

    freshD43AuthorizationRequired:
      state.freshD43AuthorizationRequired ??
      false,

    liveRegisteredAgentProfilePinned:
      state.liveRegisteredAgentProfilePinned ??
      false,

    buyerDelegationPathReady:
      state.buyerDelegationPathReady ??
      false,

    revocationPathReady:
      state.revocationPathReady ??
      false,

    revocationClear:
      state.revocationClear ??
      false,

    boundedUseEligible:
      state.boundedUseEligible ??
      false,

    paymentTupleFrozen:
      state.paymentTupleFrozen ??
      false,

    payerExecutionSurfaceReady:
      state.payerExecutionSurfaceReady ??
      false,

    actingKeyCustodyReady:
      state.actingKeyCustodyReady ??
      false,

    payerWalletCustodyReady:
      state.payerWalletCustodyReady ??
      false,

    settlementSpineReady:
      state.settlementSpineReady ??
      false,

    crpReady:
      state.crpReady ??
      false,

    receiptPathReady:
      state.receiptPathReady ??
      false,

    replayPathReady:
      state.replayPathReady ??
      false,

    replayMode:
      state.replayMode ??
      null,

    canonicalReleasePathReady:
      state.canonicalReleasePathReady ??
      false,

    postExecutionEvidencePlanReady:
      state.postExecutionEvidencePlanReady ??
      false,

    viewerContractReady:
      state.viewerContractReady ??
      false,

    nextRungMaxPaymentSubmissions:
      DEMO4_D4_3_PAYMENT_CONTRACT
        .maxPaymentSubmissions,

    automaticRetry:
      false,

    gatewayChallengeCreated:
      false,

    paidGatedRedeemCalled:
      false,

    phase5ClaimInvoked:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    actingPrivateKeyRead:
      false,

    payerWalletRead:
      false,

    signerCreated:
      false,

    signingPerformed:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    crpFulfillCalled:
      false,

    receiptRequested:
      false,

    receiptIssued:
      false,

    replayStateMutated:
      false,

    canonicalSettlementMutated:
      false,

    canonicalReleasePersisted:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
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

function exactRegisteredAgentProfile(
  profile:
    Demo4D43RegisteredAgentProfileV1,
): boolean {
  const expected =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE;

  return (
    profile.evidenceMode ===
      expected.evidenceMode &&
    profile.canonicalChainId ===
      expected.canonicalChainId &&
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
    profile.agentCard.byteLength ===
      expected.agentCard.byteLength
  );
}

function exactPaymentTuple(
  tuple:
    Demo4D43PaymentTupleV1,
): boolean {
  const expected =
    DEMO4_D4_3_PAYMENT_CONTRACT;

  return (
    tuple.network ===
      expected.network &&
    tuple.canonicalChainId ===
      expected.canonicalChainId &&
    tuple.networkGenesisIndex ===
      expected.networkGenesisIndex &&
    tuple.assetType ===
      expected.assetType &&
    tuple.tokenId ===
      expected.tokenId &&
    tuple.decimals ===
      expected.decimals &&
    tuple.amount ===
      expected.amount &&
    tuple.amountRaw ===
      expected.amountRaw &&
    tuple.merchantId ===
      expected.merchantId &&
    tuple.resourceMethod ===
      expected.resourceMethod &&
    tuple.resourcePath ===
      expected.resourcePath &&
    tuple.payTo ===
      expected.payTo
  );
}

function noReadinessSideEffects(
  sideEffects:
    Demo4D43FinalAcceptanceReadinessInputV1["sideEffects"],
): boolean {
  return (
    sideEffects.gatewayChallengeCreated ===
      false &&
    sideEffects.paidGatedRedeemCalled ===
      false &&
    sideEffects.phase5ClaimInvoked ===
      false &&
    sideEffects.usageClaimCreated ===
      false &&
    sideEffects.boundedUseConsumed ===
      false &&
    sideEffects.actingPrivateKeyRead ===
      false &&
    sideEffects.payerWalletRead ===
      false &&
    sideEffects.signerCreated ===
      false &&
    sideEffects.signingPerformed ===
      false &&
    sideEffects.transactionConstructed ===
      false &&
    sideEffects.transactionSubmitted ===
      false &&
    sideEffects.paymentAttempted ===
      false &&
    sideEffects.crpFulfillCalled ===
      false &&
    sideEffects.receiptRequested ===
      false &&
    sideEffects.receiptIssued ===
      false &&
    sideEffects.replayStateMutated ===
      false &&
    sideEffects.canonicalSettlementMutated ===
      false &&
    sideEffects.canonicalReleasePersisted ===
      false &&
    sideEffects.paymentResponseEmitted ===
      false &&
    sideEffects.resourceReleased ===
      false &&
    sideEffects.productionActivation ===
      false
  );
}

function completePostExecutionEvidencePlan(
  plan:
    Demo4D43FinalAcceptanceReadinessInputV1[
      "postExecutionEvidencePlan"
    ],
): boolean {
  return (
    plan.finalizedTransaction ===
      true &&
    plan.crpIndexing ===
      true &&
    plan.crpFulfillment ===
      true &&
    plan.receiptIssuance ===
      true &&
    plan.receiptVerification ===
      true &&
    plan.canonicalChallengeTransition ===
      true &&
    plan.releaseEvent ===
      true &&
    plan.paymentResponseOccurrence ===
      true &&
    plan.protectedResourceReleasedOnce ===
      true &&
    plan.boundedUseConsumedOnce ===
      true &&
    plan.replayRejected ===
      true &&
    plan.noSecondPayment ===
      true &&
    plan.noSecondClaim ===
      true &&
    plan.noSecondCrpFulfillment ===
      true &&
    plan.noSecondRelease ===
      true &&
    plan.finalPhase6Audit ===
      true &&
    plan.productionFalse ===
      true
  );
}

export function evaluateDemo4FinalAcceptanceReadinessV1(
  input:
    Demo4D43FinalAcceptanceReadinessInputV1,
): Demo4D43FinalAcceptanceReadinessResultV1 {
  const d42 =
    input.d42Prerequisite;

  if (
    d42.completedLiveProven !==
      true
  ) {
    return buildResult(
      "d4_2_prerequisite_missing",
    );
  }

  if (
    d42.phase5ClaimInvoked !==
      false ||
    d42.boundedUseConsumed !==
      false ||
    d42.paymentAttempted !==
      false ||
    d42.receiptIssued !==
      false ||
    d42.resourceReleased !==
      false
  ) {
    return buildResult(
      "d4_2_prerequisite_mutated",
    );
  }

  const d42PrerequisiteReady =
    true;

  if (
    d42.freshD43AuthorizationRequired !==
      true
  ) {
    return buildResult(
      "fresh_d4_3_authorization_not_required",
      {
        d42PrerequisiteReady,
      },
    );
  }

  const freshD43AuthorizationRequired =
    true;

  if (
    input.registeredAgentProfile
      .controlledEvidenceActive ===
      true ||
    input.registeredAgentProfile
      .evidenceMode ===
      "controlled_or_fixture"
  ) {
    return buildResult(
      "controlled_positive_identity_evidence_forbidden",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
      },
    );
  }

  const liveRegisteredAgentProfilePinned =
    exactRegisteredAgentProfile(
      input.registeredAgentProfile,
    );

  if (
    !liveRegisteredAgentProfilePinned
  ) {
    return buildResult(
      "live_registered_agent_profile_invalid",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
      },
    );
  }

  const buyer =
    input.buyerReadiness;

  const buyerDelegationPathReady =
    buyer.delegationPathAvailable ===
      true &&
    buyer.lifecyclePathAvailable ===
      true &&
    buyer.boundedUseEligibilityPathAvailable ===
      true;

  if (
    !buyerDelegationPathReady
  ) {
    return buildResult(
      "buyer_delegation_path_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
      },
    );
  }

  const revocationPathReady =
    buyer.revocationPathAvailable ===
      true;

  if (
    !revocationPathReady
  ) {
    return buildResult(
      "revocation_path_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
      },
    );
  }

  const revocationClear =
    buyer.revocationClear ===
      true;

  if (
    !revocationClear
  ) {
    return buildResult(
      "revocation_not_clear",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
      },
    );
  }

  const boundedUseEligible =
    buyer.boundedUseEligible ===
      true;

  if (
    !boundedUseEligible
  ) {
    return buildResult(
      "bounded_use_not_eligible",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
      },
    );
  }

  const paymentTupleFrozen =
    exactPaymentTuple(
      input.paymentTuple,
    );

  if (
    !paymentTupleFrozen
  ) {
    return buildResult(
      "payment_tuple_mismatch",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
      },
    );
  }

  const payer =
    input.payerReadiness;

  const payerExecutionSurfaceReady =
    payer.packageCommand ===
      DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
        .packageCommand &&
    payer.payerCommandSurfaceExists ===
      true;

  if (
    !payerExecutionSurfaceReady
  ) {
    return buildResult(
      "payer_execution_surface_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
      },
    );
  }

  const actingKeyCustodyReady =
    payer.actingPrivateKeyCustodyPath ===
      DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
        .actingPrivateKeyCustodyPath &&
    payer.actingPrivateKeyCustodyPathExists ===
      true;

  const payerWalletCustodyReady =
    payer.walletCustodyPath ===
      DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
        .walletCustodyPath &&
    payer.walletCustodyPathExists ===
      true;

  if (
    !actingKeyCustodyReady ||
    !payerWalletCustodyReady
  ) {
    return buildResult(
      "payer_custody_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
      },
    );
  }

  if (
    payer.maxPaymentSubmissions !==
      DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
        .maxPaymentSubmissions ||
    payer.automaticRetry !==
      false
  ) {
    return buildResult(
      "payment_submission_contract_invalid",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
      },
    );
  }

  const settlement =
    input.settlementReadiness;

  if (
    settlement
      .alternateParallelSettlementArchitectureRequested ===
      true
  ) {
    return buildResult(
      "alternate_settlement_architecture_forbidden",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
      },
    );
  }

  const settlementSpineReady =
    settlement.gatewayHealthReady ===
      true &&
    settlement.gatewayReady ===
      true &&
    settlement
      .reuseExistingConcordiumSettlementSpine ===
      true &&
    settlement.protectedResourcePath ===
      DEMO4_D4_3_PAYMENT_CONTRACT
        .resourcePath;

  if (
    !settlementSpineReady
  ) {
    return buildResult(
      "settlement_spine_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
      },
    );
  }

  const crpReady =
    settlement.crpHealthReady ===
      true &&
    settlement.crpJwksReady ===
      true;

  if (
    !crpReady
  ) {
    return buildResult(
      "crp_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
      },
    );
  }

  const receiptPathReady =
    settlement
      .receiptVerificationPathReady ===
      true;

  if (
    !receiptPathReady
  ) {
    return buildResult(
      "receipt_path_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
      },
    );
  }

  const replayPathReady =
    settlement.replayModeKnown ===
      true &&
    settlement.replayModeIntended ===
      true &&
    (
      settlement.replayMode ===
        "memory" ||
      settlement.replayMode ===
        "redis"
    );

  if (
    !replayPathReady
  ) {
    return buildResult(
      "replay_mode_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayMode:
          settlement.replayMode,
      },
    );
  }

  const canonicalReleasePathReady =
    settlement
      .canonicalReleasePersistencePathReady ===
      true;

  if (
    !canonicalReleasePathReady
  ) {
    return buildResult(
      "canonical_release_path_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayPathReady,
        replayMode:
          settlement.replayMode,
      },
    );
  }

  const postExecutionEvidencePlanReady =
    completePostExecutionEvidencePlan(
      input.postExecutionEvidencePlan,
    );

  if (
    !postExecutionEvidencePlanReady
  ) {
    return buildResult(
      "post_execution_evidence_plan_incomplete",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayPathReady,
        replayMode:
          settlement.replayMode,
        canonicalReleasePathReady,
      },
    );
  }

  const viewerContractReady =
    input.viewer.observerOnly ===
      true &&
    input.viewer.sanitizedMilestonesReady ===
      true &&
    input.viewer.executionAuthority ===
      false &&
    input.viewer.exposesSensitiveAudienceData ===
      false;

  if (
    !viewerContractReady
  ) {
    return buildResult(
      "viewer_contract_not_ready",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayPathReady,
        replayMode:
          settlement.replayMode,
        canonicalReleasePathReady,
        postExecutionEvidencePlanReady,
      },
    );
  }

  if (
    input.sideEffects.productionActivation ===
      true
  ) {
    return buildResult(
      "production_activation_forbidden",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayPathReady,
        replayMode:
          settlement.replayMode,
        canonicalReleasePathReady,
        postExecutionEvidencePlanReady,
        viewerContractReady,
      },
    );
  }

  if (
    !noReadinessSideEffects(
      input.sideEffects,
    )
  ) {
    return buildResult(
      "readiness_side_effect_detected",
      {
        d42PrerequisiteReady,
        freshD43AuthorizationRequired,
        liveRegisteredAgentProfilePinned,
        buyerDelegationPathReady,
        revocationPathReady,
        revocationClear,
        boundedUseEligible,
        paymentTupleFrozen,
        payerExecutionSurfaceReady,
        actingKeyCustodyReady,
        payerWalletCustodyReady,
        settlementSpineReady,
        crpReady,
        receiptPathReady,
        replayPathReady,
        replayMode:
          settlement.replayMode,
        canonicalReleasePathReady,
        postExecutionEvidencePlanReady,
        viewerContractReady,
      },
    );
  }

  return buildResult(
    DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON,
    {
      d42PrerequisiteReady,
      freshD43AuthorizationRequired,
      liveRegisteredAgentProfilePinned,
      buyerDelegationPathReady,
      revocationPathReady,
      revocationClear,
      boundedUseEligible,
      paymentTupleFrozen,
      payerExecutionSurfaceReady,
      actingKeyCustodyReady,
      payerWalletCustodyReady,
      settlementSpineReady,
      crpReady,
      receiptPathReady,
      replayPathReady,
      replayMode:
        settlement.replayMode,
      canonicalReleasePathReady,
      postExecutionEvidencePlanReady,
      viewerContractReady,
    },
  );
}
