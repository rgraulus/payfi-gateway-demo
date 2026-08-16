/**
 * PR #317 — deterministic/offline contract coverage for Demo4 D4-3
 * Final Acceptance Readiness.
 *
 * No network, database, Gateway challenge, redeem, Phase 5 claim, secret read,
 * signer, transaction, payment, CRP fulfill, receipt, replay mutation,
 * canonical release, protected-resource release, or production activation.
 */

import assert from "node:assert/strict";

import {
  DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON,
  DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE,
  DEMO4_D4_3_PAYMENT_CONTRACT,
  DEMO4_D4_3_PAYER_EXECUTION_CONTRACT,
  evaluateDemo4FinalAcceptanceReadinessV1,
  type Demo4D43FinalAcceptanceReadinessInputV1,
  type Demo4D43FinalAcceptanceReadinessReasonV1,
} from "../src/phase6/demo4FinalAcceptanceReadiness";

function baseInput():
Demo4D43FinalAcceptanceReadinessInputV1 {
  return {
    d42Prerequisite: {
      completedLiveProven: true,
      phase5ClaimInvoked: false,
      boundedUseConsumed: false,
      paymentAttempted: false,
      receiptIssued: false,
      resourceReleased: false,
      freshD43AuthorizationRequired: true,
    },

    registeredAgentProfile: {
      ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE,

      cis8004: {
        ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8004,

        contract: {
          ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8004.contract,
        },
      },

      cis8: {
        ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8,

        contract: {
          ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8.contract,
        },

        externalKey: {
          ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8.externalKey,
        },
      },

      agentCard: {
        ...DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.agentCard,
      },
    },

    buyerReadiness: {
      delegationPathAvailable: true,
      lifecyclePathAvailable: true,
      revocationPathAvailable: true,
      revocationClear: true,
      boundedUseEligibilityPathAvailable: true,
      boundedUseEligible: true,
    },

    paymentTuple: {
      network: DEMO4_D4_3_PAYMENT_CONTRACT.network,
      canonicalChainId: DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId,
      networkGenesisIndex: DEMO4_D4_3_PAYMENT_CONTRACT.networkGenesisIndex,
      assetType: DEMO4_D4_3_PAYMENT_CONTRACT.assetType,
      tokenId: DEMO4_D4_3_PAYMENT_CONTRACT.tokenId,
      decimals: DEMO4_D4_3_PAYMENT_CONTRACT.decimals,
      amount: DEMO4_D4_3_PAYMENT_CONTRACT.amount,
      amountRaw: DEMO4_D4_3_PAYMENT_CONTRACT.amountRaw,
      merchantId: DEMO4_D4_3_PAYMENT_CONTRACT.merchantId,
      resourceMethod: DEMO4_D4_3_PAYMENT_CONTRACT.resourceMethod,
      resourcePath: DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath,
      payTo: DEMO4_D4_3_PAYMENT_CONTRACT.payTo,
    },

    payerReadiness: {
      packageCommand: DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.packageCommand,
      payerCommandSurfaceExists: true,

      walletCustodyPath:
        DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.walletCustodyPath,
      walletCustodyPathExists: true,

      actingPrivateKeyCustodyPath:
        DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.actingPrivateKeyCustodyPath,
      actingPrivateKeyCustodyPathExists: true,

      maxPaymentSubmissions: 1,
      automaticRetry: false,
    },

    settlementReadiness: {
      gatewayHealthReady: true,
      gatewayReady: true,

      crpHealthReady: true,
      crpJwksReady: true,

      receiptVerificationPathReady: true,

      replayMode: "memory",
      replayModeKnown: true,
      replayModeIntended: true,

      canonicalReleasePersistencePathReady: true,

      protectedResourcePath: "/paid-gated",

      reuseExistingConcordiumSettlementSpine: true,

      alternateParallelSettlementArchitectureRequested: false,
    },

    postExecutionEvidencePlan: {
      finalizedTransaction: true,
      crpIndexing: true,
      crpFulfillment: true,
      receiptIssuance: true,
      receiptVerification: true,
      canonicalChallengeTransition: true,
      releaseEvent: true,
      paymentResponseOccurrence: true,
      protectedResourceReleasedOnce: true,
      boundedUseConsumedOnce: true,
      replayRejected: true,
      noSecondPayment: true,
      noSecondClaim: true,
      noSecondCrpFulfillment: true,
      noSecondRelease: true,
      finalPhase6Audit: true,
      productionFalse: true,
    },

    viewer: {
      observerOnly: true,
      sanitizedMilestonesReady: true,
      executionAuthority: false,
      exposesSensitiveAudienceData: false,
    },

    sideEffects: {
      gatewayChallengeCreated: false,
      paidGatedRedeemCalled: false,
      phase5ClaimInvoked: false,
      usageClaimCreated: false,
      boundedUseConsumed: false,
      actingPrivateKeyRead: false,
      payerWalletRead: false,
      signerCreated: false,
      signingPerformed: false,
      transactionConstructed: false,
      transactionSubmitted: false,
      paymentAttempted: false,
      crpFulfillCalled: false,
      receiptRequested: false,
      receiptIssued: false,
      replayStateMutated: false,
      canonicalSettlementMutated: false,
      canonicalReleasePersisted: false,
      paymentResponseEmitted: false,
      resourceReleased: false,
      productionActivation: false,
    },
  };
}

function mutableInput():
any {
  return baseInput() as any;
}

let negativeCaseCount = 0;

function expectDenied(
  name: string,
  expectedReason:
    Demo4D43FinalAcceptanceReadinessReasonV1,
  mutate:
    (input: any) => void,
): void {
  const input = mutableInput();

  mutate(input);

  const result =
    evaluateDemo4FinalAcceptanceReadinessV1(
      input,
    );

  assert.equal(
    result.ok,
    false,
    `${name}: expected denied`,
  );

  assert.equal(
    result.status,
    "denied",
    `${name}: expected denied status`,
  );

  assert.equal(
    result.reason,
    expectedReason,
    `${name}: unexpected reason`,
  );

  assert.equal(
    result.productionActivation,
    false,
    `${name}: result must remain non-production`,
  );

  negativeCaseCount += 1;
}

const positive =
  evaluateDemo4FinalAcceptanceReadinessV1(
    baseInput(),
  );

assert.equal(
  positive.ok,
  true,
);

assert.equal(
  positive.status,
  "ready",
);

assert.equal(
  positive.reason,
  DEMO4_D4_3_FINAL_ACCEPTANCE_READINESS_SUCCESS_REASON,
);

assert.equal(positive.d42PrerequisiteReady, true);
assert.equal(positive.freshD43AuthorizationRequired, true);
assert.equal(positive.liveRegisteredAgentProfilePinned, true);
assert.equal(positive.buyerDelegationPathReady, true);
assert.equal(positive.revocationPathReady, true);
assert.equal(positive.revocationClear, true);
assert.equal(positive.boundedUseEligible, true);
assert.equal(positive.paymentTupleFrozen, true);
assert.equal(positive.payerExecutionSurfaceReady, true);
assert.equal(positive.actingKeyCustodyReady, true);
assert.equal(positive.payerWalletCustodyReady, true);
assert.equal(positive.settlementSpineReady, true);
assert.equal(positive.crpReady, true);
assert.equal(positive.receiptPathReady, true);
assert.equal(positive.replayPathReady, true);
assert.equal(positive.replayMode, "memory");
assert.equal(positive.canonicalReleasePathReady, true);
assert.equal(positive.postExecutionEvidencePlanReady, true);
assert.equal(positive.viewerContractReady, true);
assert.equal(positive.nextRungMaxPaymentSubmissions, 1);
assert.equal(positive.automaticRetry, false);

const immutableFalseResultFields = [
  "gatewayChallengeCreated",
  "paidGatedRedeemCalled",
  "phase5ClaimInvoked",
  "usageClaimCreated",
  "boundedUseConsumed",
  "actingPrivateKeyRead",
  "payerWalletRead",
  "signerCreated",
  "signingPerformed",
  "transactionConstructed",
  "transactionSubmitted",
  "paymentAttempted",
  "crpFulfillCalled",
  "receiptRequested",
  "receiptIssued",
  "replayStateMutated",
  "canonicalSettlementMutated",
  "canonicalReleasePersisted",
  "paymentResponseEmitted",
  "resourceReleased",
  "productionActivation",
] as const;

for (
  const field of
    immutableFalseResultFields
) {
  assert.equal(
    positive[field],
    false,
    `positive result mutated ${field}`,
  );
}

expectDenied(
  "d4_2_missing",
  "d4_2_prerequisite_missing",
  (i) => {
    i.d42Prerequisite.completedLiveProven =
      false;
  },
);

for (
  const field of [
    "phase5ClaimInvoked",
    "boundedUseConsumed",
    "paymentAttempted",
    "receiptIssued",
    "resourceReleased",
  ]
) {
  expectDenied(
    `d4_2_mutated_${field}`,
    "d4_2_prerequisite_mutated",
    (i) => {
      i.d42Prerequisite[field] =
        true;
    },
  );
}

expectDenied(
  "fresh_authorization_not_required",
  "fresh_d4_3_authorization_not_required",
  (i) => {
    i.d42Prerequisite.freshD43AuthorizationRequired =
      false;
  },
);

expectDenied(
  "controlled_positive_identity",
  "controlled_positive_identity_evidence_forbidden",
  (i) => {
    i.registeredAgentProfile.controlledEvidenceActive =
      true;
  },
);

const identityMismatchCases:
Array<[string, (i: any) => void]> = [
  [
    "wrong_cis8004_token",
    (i) => {
      i.registeredAgentProfile.cis8004.tokenId =
        "999";
    },
  ],
  [
    "wrong_cis8004_module",
    (i) => {
      i.registeredAgentProfile.cis8004.moduleReference =
        "bad-module";
    },
  ],
  [
    "wrong_owner",
    (i) => {
      i.registeredAgentProfile.cis8004.ownerAccount =
        "bad-owner";
    },
  ],
  [
    "wrong_cis8_contract",
    (i) => {
      i.registeredAgentProfile.cis8.contract.index =
        "99999";
    },
  ],
  [
    "wrong_cis8_module",
    (i) => {
      i.registeredAgentProfile.cis8.moduleReference =
        "bad-module";
    },
  ],
  [
    "wrong_cis8_key",
    (i) => {
      i.registeredAgentProfile.cis8.externalKey.publicKeyHex =
        "00";
    },
  ],
  [
    "wrong_agent_card_uri",
    (i) => {
      i.registeredAgentProfile.agentCard.uri =
        "https://example.invalid/card.json";
    },
  ],
  [
    "wrong_agent_card_hash",
    (i) => {
      i.registeredAgentProfile.agentCard.sha256 =
        "00";
    },
  ],
  [
    "wrong_agent_card_bytes",
    (i) => {
      i.registeredAgentProfile.agentCard.byteLength =
        281;
    },
  ],
];

for (
  const [name, mutate] of
    identityMismatchCases
) {
  expectDenied(
    name,
    "live_registered_agent_profile_invalid",
    mutate,
  );
}

expectDenied(
  "buyer_delegation_path_missing",
  "buyer_delegation_path_not_ready",
  (i) => {
    i.buyerReadiness.delegationPathAvailable =
      false;
  },
);

expectDenied(
  "buyer_lifecycle_path_missing",
  "buyer_delegation_path_not_ready",
  (i) => {
    i.buyerReadiness.lifecyclePathAvailable =
      false;
  },
);

expectDenied(
  "bounded_use_eligibility_path_missing",
  "buyer_delegation_path_not_ready",
  (i) => {
    i.buyerReadiness.boundedUseEligibilityPathAvailable =
      false;
  },
);

expectDenied(
  "revocation_path_missing",
  "revocation_path_not_ready",
  (i) => {
    i.buyerReadiness.revocationPathAvailable =
      false;
  },
);

expectDenied(
  "revocation_not_clear",
  "revocation_not_clear",
  (i) => {
    i.buyerReadiness.revocationClear =
      false;
  },
);

expectDenied(
  "bounded_use_not_eligible",
  "bounded_use_not_eligible",
  (i) => {
    i.buyerReadiness.boundedUseEligible =
      false;
  },
);

const paymentMismatchCases:
Array<[string, string, any]> = [
  ["wrong_network", "network", "wrong:testnet"],
  ["wrong_chain_id", "canonicalChainId", "ccd:wrong"],
  ["wrong_genesis", "networkGenesisIndex", 6],
  ["wrong_asset_type", "assetType", "CIS2"],
  ["wrong_token", "tokenId", "WrongToken"],
  ["wrong_decimals", "decimals", 5],
  ["wrong_amount", "amount", "0.050102"],
  ["wrong_amount_raw", "amountRaw", "50102"],
  ["wrong_merchant", "merchantId", "other-merchant"],
  ["wrong_method", "resourceMethod", "POST"],
  ["wrong_path", "resourcePath", "/paid"],
  ["wrong_pay_to", "payTo", "wrong-address"],
];

for (
  const [name, field, value] of
    paymentMismatchCases
) {
  expectDenied(
    name,
    "payment_tuple_mismatch",
    (i) => {
      i.paymentTuple[field] =
        value;
    },
  );
}

expectDenied(
  "payer_surface_missing",
  "payer_execution_surface_not_ready",
  (i) => {
    i.payerReadiness.payerCommandSurfaceExists =
      false;
  },
);

expectDenied(
  "wrong_payer_command",
  "payer_execution_surface_not_ready",
  (i) => {
    i.payerReadiness.packageCommand =
      "other";
  },
);

expectDenied(
  "wallet_custody_missing",
  "payer_custody_not_ready",
  (i) => {
    i.payerReadiness.walletCustodyPathExists =
      false;
  },
);

expectDenied(
  "acting_key_custody_missing",
  "payer_custody_not_ready",
  (i) => {
    i.payerReadiness.actingPrivateKeyCustodyPathExists =
      false;
  },
);

expectDenied(
  "submission_ceiling_not_one",
  "payment_submission_contract_invalid",
  (i) => {
    i.payerReadiness.maxPaymentSubmissions =
      2;
  },
);

expectDenied(
  "automatic_retry_enabled",
  "payment_submission_contract_invalid",
  (i) => {
    i.payerReadiness.automaticRetry =
      true;
  },
);

expectDenied(
  "alternate_settlement_architecture",
  "alternate_settlement_architecture_forbidden",
  (i) => {
    i.settlementReadiness.alternateParallelSettlementArchitectureRequested =
      true;
  },
);

expectDenied(
  "gateway_not_ready",
  "settlement_spine_not_ready",
  (i) => {
    i.settlementReadiness.gatewayReady =
      false;
  },
);

expectDenied(
  "wrong_protected_resource",
  "settlement_spine_not_ready",
  (i) => {
    i.settlementReadiness.protectedResourcePath =
      "/wrong";
  },
);

expectDenied(
  "crp_health_missing",
  "crp_not_ready",
  (i) => {
    i.settlementReadiness.crpHealthReady =
      false;
  },
);

expectDenied(
  "crp_jwks_missing",
  "crp_not_ready",
  (i) => {
    i.settlementReadiness.crpJwksReady =
      false;
  },
);

expectDenied(
  "receipt_path_missing",
  "receipt_path_not_ready",
  (i) => {
    i.settlementReadiness.receiptVerificationPathReady =
      false;
  },
);

expectDenied(
  "replay_mode_unknown",
  "replay_mode_not_ready",
  (i) => {
    i.settlementReadiness.replayMode =
      null;
    i.settlementReadiness.replayModeKnown =
      false;
  },
);

expectDenied(
  "replay_mode_unintended",
  "replay_mode_not_ready",
  (i) => {
    i.settlementReadiness.replayModeIntended =
      false;
  },
);

expectDenied(
  "canonical_release_path_missing",
  "canonical_release_path_not_ready",
  (i) => {
    i.settlementReadiness.canonicalReleasePersistencePathReady =
      false;
  },
);

expectDenied(
  "post_execution_evidence_incomplete",
  "post_execution_evidence_plan_incomplete",
  (i) => {
    i.postExecutionEvidencePlan.replayRejected =
      false;
  },
);

expectDenied(
  "viewer_has_execution_authority",
  "viewer_contract_not_ready",
  (i) => {
    i.viewer.executionAuthority =
      true;
  },
);

expectDenied(
  "viewer_exposes_sensitive_data",
  "viewer_contract_not_ready",
  (i) => {
    i.viewer.exposesSensitiveAudienceData =
      true;
  },
);

expectDenied(
  "production_activation",
  "production_activation_forbidden",
  (i) => {
    i.sideEffects.productionActivation =
      true;
  },
);

const sideEffectFields = [
  "gatewayChallengeCreated",
  "paidGatedRedeemCalled",
  "phase5ClaimInvoked",
  "usageClaimCreated",
  "boundedUseConsumed",
  "actingPrivateKeyRead",
  "payerWalletRead",
  "signerCreated",
  "signingPerformed",
  "transactionConstructed",
  "transactionSubmitted",
  "paymentAttempted",
  "crpFulfillCalled",
  "receiptRequested",
  "receiptIssued",
  "replayStateMutated",
  "canonicalSettlementMutated",
  "canonicalReleasePersisted",
  "paymentResponseEmitted",
  "resourceReleased",
] as const;

for (
  const field of
    sideEffectFields
) {
  expectDenied(
    `side_effect_${field}`,
    "readiness_side_effect_detected",
    (i) => {
      i.sideEffects[field] =
        true;
    },
  );
}

assert.ok(
  negativeCaseCount >=
    60,
  `expected broad negative matrix; got ${negativeCaseCount}`,
);

console.log(
  "D4_3_READINESS_STATUS=ready",
);

console.log(
  `D4_3_READINESS_REASON=${positive.reason}`,
);

console.log("D4_2_PREREQUISITE_READY=true");
console.log("FRESH_D4_3_AUTHORIZATION_REQUIRED=true");
console.log("LIVE_REGISTERED_AGENT_PROFILE_PINNED=true");
console.log("BUYER_DELEGATION_PATH_READY=true");
console.log("REVOCATION_PATH_READY=true");
console.log("BOUNDED_USE_ELIGIBLE=true");
console.log("PAYMENT_TUPLE_FROZEN=true");
console.log("PAYER_EXECUTION_SURFACE_READY=true");
console.log("ACTING_KEY_CUSTODY_READY=true");
console.log("PAYER_WALLET_CUSTODY_READY=true");
console.log("SETTLEMENT_SPINE_READY=true");
console.log("CRP_READY=true");
console.log("RECEIPT_PATH_READY=true");
console.log("REPLAY_PATH_READY=true");
console.log("CANONICAL_RELEASE_PATH_READY=true");
console.log("POST_EXECUTION_EVIDENCE_PLAN_READY=true");
console.log("VIEWER_CONTRACT_READY=true");
console.log("NEXT_RUNG_MAX_PAYMENT_SUBMISSIONS=1");
console.log("AUTOMATIC_RETRY=false");

console.log("GATEWAY_CHALLENGE_CREATED=false");
console.log("PAID_GATED_REDEEM_CALLED=false");
console.log("PHASE5_CLAIM_INVOKED=false");
console.log("USAGE_CLAIM_CREATED=false");
console.log("BOUNDED_USE_CONSUMED=false");
console.log("ACTING_PRIVATE_KEY_READ=false");
console.log("PAYER_WALLET_READ=false");
console.log("SIGNING_PERFORMED=false");
console.log("TRANSACTION_CONSTRUCTED=false");
console.log("TRANSACTION_SUBMITTED=false");
console.log("PAYMENT_ATTEMPTED=false");
console.log("CRP_FULFILL_CALLED=false");
console.log("RECEIPT_REQUESTED=false");
console.log("RECEIPT_ISSUED=false");
console.log("REPLAY_STATE_MUTATED=false");
console.log("CANONICAL_SETTLEMENT_MUTATED=false");
console.log("CANONICAL_RELEASE_PERSISTED=false");
console.log("PAYMENT_RESPONSE_EMITTED=false");
console.log("RESOURCE_RELEASED=false");
console.log("PRODUCTION_ACTIVATION=false");

console.log(
  `NEGATIVE_CASES_PASSED=${negativeCaseCount}`,
);

console.log(
  "PR317_DETERMINISTIC_OFFLINE_CI=PASSED",
);
