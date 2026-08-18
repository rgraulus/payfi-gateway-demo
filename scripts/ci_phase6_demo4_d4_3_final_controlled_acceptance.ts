/**
 * PR #318 — deterministic/offline CI for the Demo4 D4-3 final controlled
 * acceptance one-shot execution contract.
 *
 * No network, database, key/wallet, signing, payment, CRP, receipt, replay,
 * release, staging, or publication side effects are performed here.
 */

import assert from "node:assert/strict";

import {
  DEMO4_D4_3_AUTOMATIC_RETRY,
  DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE,
  DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_READY_REASON,
  DEMO4_D4_3_PAYMENT_CONTRACT,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_READY_REASON,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_SUCCESS_REASON,
  DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,
  DEMO4_D4_3_PRODUCTION,
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT,
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
  evaluateDemo4D43LiveExecutionProgressV1,
  evaluateDemo4FinalControlledAcceptanceV1,
  evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1,
  inspectDemo4FinalControlledAcceptanceContractV1,
  type Demo4D43FinalControlledAcceptanceInputV1,
  type Demo4D43ExecutionDispatchInputV1,
  type Demo4D43LiveExecutionJournalV1,
} from "../src/phase6/demo4FinalControlledAcceptance";

const positive:
  Demo4D43FinalControlledAcceptanceInputV1 = {
    readinessConfirmed:
      true,

    freshAuthorizationConfirmed:
      true,

    freshChallengeConfirmed:
      true,

    challengeContextsCreated:
      1,

    buyerPrivateKeyReads:
      1,

    actingPrivateKeyReads:
      1,

    proofOfPossessionVerified:
      true,

    registeredAgentAuthorizationConfirmed:
      true,

    gatewayRedeemCalls:
      1,

    usageClaimsCreated:
      1,

    boundedUsesConsumed:
      1,

    payerWalletReads:
      1,

    signingOperations:
      1,

    transactionsConstructed:
      1,

    paymentSubmissions:
      1,

    paymentOutcome:
      "finalized_success",

    automaticRetryRequested:
      false,

    crpFulfillCalls:
      1,

    receiptIssued:
      true,

    receiptVerified:
      true,

    settlementFinalized:
      true,

    canonicalReleasePersisted:
      true,

    paymentResponsesEmitted:
      1,

    resourceReleases:
      1,

    replayProbes:
      1,

    replayRejected:
      true,

    replayAdditionalPaymentSubmissions:
      0,

    replayAdditionalUsageClaims:
      0,

    replayAdditionalCrpFulfillCalls:
      0,

    replayAdditionalPaymentResponses:
      0,

    replayAdditionalResourceReleases:
      0,

    productionActivation:
      false,

    stageSequence:
      [
        ...DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE,
      ],
  };

const contract =
  inspectDemo4FinalControlledAcceptanceContractV1();

assert.equal(
  contract.ok,
  true,
);

assert.equal(
  contract.status,
  "ready",
);

assert.equal(
  contract.reason,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_READY_REASON,
);

assert.equal(
  DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,
  1,
);

assert.equal(
  DEMO4_D4_3_AUTOMATIC_RETRY,
  false,
);

assert.equal(
  DEMO4_D4_3_PRODUCTION,
  false,
);

const accepted =
  evaluateDemo4FinalControlledAcceptanceV1(
    positive,
  );

assert.equal(
  accepted.ok,
  true,
);

assert.equal(
  accepted.status,
  "complete",
);

assert.equal(
  accepted.reason,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_SUCCESS_REASON,
);

assert.equal(
  accepted.terminal,
  true,
);

type NegativeCase = {
  readonly label:
    string;

  readonly patch:
    Partial<
      Demo4D43FinalControlledAcceptanceInputV1
    >;

  readonly reason:
    string;

  readonly terminal?:
    boolean;
};

const negativeCases:
  readonly NegativeCase[] = [
    {
      label:
        "missing PR317 readiness",
      patch: {
        readinessConfirmed:
          false,
      },
      reason:
        "pr317_readiness_not_confirmed",
    },

    {
      label:
        "missing fresh authorization",
      patch: {
        freshAuthorizationConfirmed:
          false,
      },
      reason:
        "fresh_d4_3_authorization_required",
    },

    {
      label:
        "challenge not fresh",
      patch: {
        freshChallengeConfirmed:
          false,
      },
      reason:
        "exactly_one_fresh_challenge_required",
    },

    {
      label:
        "zero challenges",
      patch: {
        challengeContextsCreated:
          0,
      },
      reason:
        "exactly_one_fresh_challenge_required",
    },

    {
      label:
        "duplicate challenges",
      patch: {
        challengeContextsCreated:
          2,
      },
      reason:
        "exactly_one_fresh_challenge_required",
    },

    {
      label:
        "buyer key not read",
      patch: {
        buyerPrivateKeyReads:
          0,
      },
      reason:
        "buyer_private_key_read_count_invalid",
    },

    {
      label:
        "buyer key read twice",
      patch: {
        buyerPrivateKeyReads:
          2,
      },
      reason:
        "buyer_private_key_read_count_invalid",
    },

    {
      label:
        "acting key not read",
      patch: {
        actingPrivateKeyReads:
          0,
      },
      reason:
        "acting_private_key_read_count_invalid",
    },

    {
      label:
        "acting key read twice",
      patch: {
        actingPrivateKeyReads:
          2,
      },
      reason:
        "acting_private_key_read_count_invalid",
    },

    {
      label:
        "PoP not verified",
      patch: {
        proofOfPossessionVerified:
          false,
      },
      reason:
        "proof_of_possession_not_verified",
    },

    {
      label:
        "registered-agent authorization absent",
      patch: {
        registeredAgentAuthorizationConfirmed:
          false,
      },
      reason:
        "registered_agent_authorization_not_confirmed",
    },

    {
      label:
        "zero redeem calls",
      patch: {
        gatewayRedeemCalls:
          0,
      },
      reason:
        "gateway_redeem_call_count_invalid",
    },

    {
      label:
        "duplicate redeem calls",
      patch: {
        gatewayRedeemCalls:
          2,
      },
      reason:
        "gateway_redeem_call_count_invalid",
    },

    {
      label:
        "usage claim absent",
      patch: {
        usageClaimsCreated:
          0,
      },
      reason:
        "usage_claim_count_invalid",
    },

    {
      label:
        "duplicate usage claims",
      patch: {
        usageClaimsCreated:
          2,
      },
      reason:
        "usage_claim_count_invalid",
    },

    {
      label:
        "bounded use not consumed",
      patch: {
        boundedUsesConsumed:
          0,
      },
      reason:
        "bounded_use_consumption_count_invalid",
    },

    {
      label:
        "automatic retry requested",
      patch: {
        automaticRetryRequested:
          true,
      },
      reason:
        "automatic_payment_retry_prohibited",
      terminal:
        true,
    },

    {
      label:
        "second payment submission",
      patch: {
        paymentSubmissions:
          2,
      },
      reason:
        "payment_submission_budget_exceeded",
      terminal:
        true,
    },

    {
      label:
        "no payment submission",
      patch: {
        paymentSubmissions:
          0,
      },
      reason:
        "exactly_one_payment_submission_required",
    },

    {
      label:
        "ambiguous payment outcome",
      patch: {
        paymentOutcome:
          "submitted_unknown",
      },
      reason:
        "payment_submission_outcome_ambiguous_stop_required",
      terminal:
        true,
    },

    {
      label:
        "finalized payment failure",
      patch: {
        paymentOutcome:
          "finalized_failure",
      },
      reason:
        "payment_finalized_failed_no_retry",
      terminal:
        true,
    },

    {
      label:
        "payment not attempted outcome",
      patch: {
        paymentOutcome:
          "not_attempted",
      },
      reason:
        "payment_not_finalized_successfully",
    },

    {
      label:
        "payer wallet not read",
      patch: {
        payerWalletReads:
          0,
      },
      reason:
        "payer_wallet_read_count_invalid",
    },

    {
      label:
        "duplicate payer wallet reads",
      patch: {
        payerWalletReads:
          2,
      },
      reason:
        "payer_wallet_read_count_invalid",
    },

    {
      label:
        "signing not performed",
      patch: {
        signingOperations:
          0,
      },
      reason:
        "signing_operation_count_invalid",
    },

    {
      label:
        "duplicate signing",
      patch: {
        signingOperations:
          2,
      },
      reason:
        "signing_operation_count_invalid",
    },

    {
      label:
        "transaction not constructed",
      patch: {
        transactionsConstructed:
          0,
      },
      reason:
        "transaction_construction_count_invalid",
    },

    {
      label:
        "duplicate transaction construction",
      patch: {
        transactionsConstructed:
          2,
      },
      reason:
        "transaction_construction_count_invalid",
    },

    {
      label:
        "CRP fulfill absent",
      patch: {
        crpFulfillCalls:
          0,
      },
      reason:
        "crp_fulfill_call_count_invalid",
    },

    {
      label:
        "duplicate CRP fulfill",
      patch: {
        crpFulfillCalls:
          2,
      },
      reason:
        "crp_fulfill_call_count_invalid",
    },

    {
      label:
        "receipt not issued",
      patch: {
        receiptIssued:
          false,
      },
      reason:
        "receipt_not_issued",
    },

    {
      label:
        "receipt not verified",
      patch: {
        receiptVerified:
          false,
      },
      reason:
        "receipt_not_verified",
    },

    {
      label:
        "settlement not finalized",
      patch: {
        settlementFinalized:
          false,
      },
      reason:
        "settlement_not_finalized",
    },

    {
      label:
        "canonical release absent",
      patch: {
        canonicalReleasePersisted:
          false,
      },
      reason:
        "canonical_release_not_persisted",
    },

    {
      label:
        "PAYMENT-RESPONSE absent",
      patch: {
        paymentResponsesEmitted:
          0,
      },
      reason:
        "payment_response_count_invalid",
    },

    {
      label:
        "duplicate PAYMENT-RESPONSE",
      patch: {
        paymentResponsesEmitted:
          2,
      },
      reason:
        "payment_response_count_invalid",
    },

    {
      label:
        "resource not released",
      patch: {
        resourceReleases:
          0,
      },
      reason:
        "resource_release_count_invalid",
    },

    {
      label:
        "resource released twice",
      patch: {
        resourceReleases:
          2,
      },
      reason:
        "resource_release_count_invalid",
    },

    {
      label:
        "replay probe absent",
      patch: {
        replayProbes:
          0,
      },
      reason:
        "replay_rejection_not_proven",
    },

    {
      label:
        "duplicate replay probes",
      patch: {
        replayProbes:
          2,
      },
      reason:
        "replay_rejection_not_proven",
    },

    {
      label:
        "replay accepted",
      patch: {
        replayRejected:
          false,
      },
      reason:
        "replay_rejection_not_proven",
    },

    {
      label:
        "replay caused second payment",
      patch: {
        replayAdditionalPaymentSubmissions:
          1,
      },
      reason:
        "replay_additional_payment_prohibited",
      terminal:
        true,
    },

    {
      label:
        "replay caused second usage claim",
      patch: {
        replayAdditionalUsageClaims:
          1,
      },
      reason:
        "replay_additional_usage_claim_prohibited",
      terminal:
        true,
    },

    {
      label:
        "replay caused second CRP fulfill",
      patch: {
        replayAdditionalCrpFulfillCalls:
          1,
      },
      reason:
        "replay_additional_crp_fulfill_prohibited",
      terminal:
        true,
    },

    {
      label:
        "replay emitted second PAYMENT-RESPONSE",
      patch: {
        replayAdditionalPaymentResponses:
          1,
      },
      reason:
        "replay_additional_payment_response_prohibited",
      terminal:
        true,
    },

    {
      label:
        "replay released resource twice",
      patch: {
        replayAdditionalResourceReleases:
          1,
      },
      reason:
        "replay_additional_resource_release_prohibited",
      terminal:
        true,
    },

    {
      label:
        "stage order truncated",
      patch: {
        stageSequence:
          DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE.slice(
            0,
            -1,
          ),
      },
      reason:
        "execution_stage_order_invalid",
      terminal:
        true,
    },

    {
      label:
        "stage order swapped",
      patch: {
        stageSequence: [
          "readiness",
          "fresh_authorization",
          "fresh_challenge",
          "acting_key_read",
          "proof_of_possession",
          "registered_agent_authorization",
          "atomic_bounded_use_claim",
          "gateway_redeem",
          "payer_wallet_read",
          "payment_submit",
          "payment_finalized",
          "crp_fulfill",
          "receipt_verified",
          "canonical_release",
          "resource_release",
          "replay_probe",
          "replay_rejected",
        ],
      },
      reason:
        "execution_stage_order_invalid",
      terminal:
        true,
    },

    {
      label:
        "production activation",
      patch: {
        productionActivation:
          true,
      },
      reason:
        "production_activation_prohibited",
      terminal:
        true,
    },
  ];

for (
  const testCase
  of negativeCases
) {
  const candidate:
    Demo4D43FinalControlledAcceptanceInputV1 = {
      ...positive,
      ...testCase.patch,
    };

  const evaluated =
    evaluateDemo4FinalControlledAcceptanceV1(
      candidate,
    );

  assert.equal(
    evaluated.ok,
    false,
    testCase.label,
  );

  assert.equal(
    evaluated.status,
    "blocked",
    testCase.label,
  );

  assert.equal(
    evaluated.reason,
    testCase.reason,
    testCase.label,
  );

  if (
    testCase.terminal !==
      undefined
  ) {
    assert.equal(
      evaluated.terminal,
      testCase.terminal,
      testCase.label,
    );
  }
}

console.log(
  `NEGATIVE_CASES_PASSED=${negativeCases.length}`,
);

console.log(
  "CONTRACT_READY=true",
);

console.log(
  "MAX_PAYMENT_SUBMISSIONS=1",
);

console.log(
  "AUTOMATIC_RETRY=false",
);

console.log(
  "AMBIGUOUS_PAYMENT_OUTCOME_RETRY_ALLOWED=false",
);

console.log(
  "REPLAY_ADDITIONAL_PAYMENT_ALLOWED=false",
);

console.log(
  "REPLAY_ADDITIONAL_CLAIM_ALLOWED=false",
);

console.log(
  "REPLAY_ADDITIONAL_CRP_FULFILL_ALLOWED=false",
);

console.log(
  "REPLAY_ADDITIONAL_RELEASE_ALLOWED=false",
);

console.log(
  "NETWORK_CALLED=false",
);

console.log(
  "DATABASE_CALLED=false",
);

console.log(
  "BUYER_PRIVATE_KEY_READ=false",
);

console.log(
  "ACTING_PRIVATE_KEY_READ=false",
);

console.log(
  "PAYER_WALLET_READ=false",
);

console.log(
  "SIGNING_PERFORMED=false",
);

console.log(
  "TRANSACTION_CONSTRUCTED=false",
);

console.log(
  "TRANSACTION_SUBMITTED=false",
);

console.log(
  "PAYMENT_ATTEMPTED=false",
);

console.log(
  "PHASE5_CLAIM_INVOKED=false",
);

console.log(
  "CRP_FULFILL_CALLED=false",
);

console.log(
  "RECEIPT_REQUESTED=false",
);

console.log(
  "REPLAY_STATE_MUTATED=false",
);

console.log(
  "CANONICAL_RELEASE_PERSISTED=false",
);

console.log(
  "PAYMENT_RESPONSE_EMITTED=false",
);

console.log(
  "RESOURCE_RELEASED=false",
);

console.log(
  "PRODUCTION_ACTIVATION=false",
);


const allDispatchCapabilities =
  Object.fromEntries(
    DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES
      .map(
        (capability) => [
          capability,
          true,
        ],
      ),
  ) as
    Demo4D43ExecutionDispatchInputV1[
      "capabilityAuthorizations"
    ];

const dispatchPositive:
  Demo4D43ExecutionDispatchInputV1 = {
    executionAcknowledged:
      true,

    pr317ReadinessConfirmed:
      true,

    freshExecutionAuthorizationConfirmed:
      true,

    oneShotPaymentAcknowledged:
      true,

    ambiguousSubmissionStopAcknowledged:
      true,

    maxPaymentSubmissions:
      1,

    automaticRetry:
      false,

    productionActivation:
      false,

    canonicalChainId:
      DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId,

    paymentNetwork:
      DEMO4_D4_3_PAYMENT_CONTRACT.paymentNetwork,

    networkGenesisIndex:
      DEMO4_D4_3_PAYMENT_CONTRACT.networkGenesisIndex,

    assetType:
      DEMO4_D4_3_PAYMENT_CONTRACT.assetType,

    tokenId:
      DEMO4_D4_3_PAYMENT_CONTRACT.tokenId,

    decimals:
      DEMO4_D4_3_PAYMENT_CONTRACT.decimals,

    amount:
      DEMO4_D4_3_PAYMENT_CONTRACT.amount,

    amountRaw:
      DEMO4_D4_3_PAYMENT_CONTRACT.amountRaw,

    merchantId:
      DEMO4_D4_3_PAYMENT_CONTRACT.merchantId,

    resourceMethod:
      DEMO4_D4_3_PAYMENT_CONTRACT.resourceMethod,

    resourcePath:
      DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath,

    payTo:
      DEMO4_D4_3_PAYMENT_CONTRACT.payTo,

    capabilityAuthorizations:
      allDispatchCapabilities,
  };

const dispatchAccepted =
  evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1(
    dispatchPositive,
  );

assert.equal(
  dispatchAccepted.ok,
  true,
);

assert.equal(
  dispatchAccepted.status,
  "ready",
);

assert.equal(
  dispatchAccepted.reason,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_READY_REASON,
);

assert.equal(
  dispatchAccepted.liveExecutionImplemented,
  false,
);

assert.deepEqual(
  dispatchAccepted.missingCapabilities,
  [],
);

type DispatchNegativeCase = {
  readonly label:
    string;

  readonly patch:
    Partial<
      Demo4D43ExecutionDispatchInputV1
    >;

  readonly reason:
    string;
};

const dispatchNegativeCases:
  readonly DispatchNegativeCase[] = [
    {
      label: "execution acknowledgement absent",
      patch: { executionAcknowledged: false },
      reason: "execution_dispatch_ack_required",
    },
    {
      label: "PR317 readiness absent",
      patch: { pr317ReadinessConfirmed: false },
      reason: "execution_dispatch_pr317_readiness_required",
    },
    {
      label: "fresh execution authorization absent",
      patch: { freshExecutionAuthorizationConfirmed: false },
      reason: "execution_dispatch_fresh_authorization_required",
    },
    {
      label: "one-shot acknowledgement absent",
      patch: { oneShotPaymentAcknowledged: false },
      reason: "execution_dispatch_one_shot_payment_ack_required",
    },
    {
      label: "ambiguous-submit stop acknowledgement absent",
      patch: { ambiguousSubmissionStopAcknowledged: false },
      reason: "execution_dispatch_ambiguous_submission_stop_ack_required",
    },
    {
      label: "payment budget zero",
      patch: { maxPaymentSubmissions: 0 },
      reason: "execution_dispatch_payment_submission_budget_mismatch",
    },
    {
      label: "payment budget two",
      patch: { maxPaymentSubmissions: 2 },
      reason: "execution_dispatch_payment_submission_budget_mismatch",
    },
    {
      label: "automatic retry enabled",
      patch: { automaticRetry: true },
      reason: "execution_dispatch_automatic_retry_must_be_false",
    },
    {
      label: "production activation enabled",
      patch: { productionActivation: true },
      reason: "execution_dispatch_production_activation_prohibited",
    },
    {
      label: "wrong canonical chain",
      patch: { canonicalChainId: "ccd:wrong" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong network",
      patch: { paymentNetwork: "concordium:mainnet" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong genesis index",
      patch: { networkGenesisIndex: 6 },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong asset type",
      patch: { assetType: "CCD" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong token ID",
      patch: { tokenId: "WRONG" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong decimals",
      patch: { decimals: 5 },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong decimal amount",
      patch: { amount: "0.050102" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong raw amount",
      patch: { amountRaw: "50102" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong merchant",
      patch: { merchantId: "wrong-merchant" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong resource method",
      patch: { resourceMethod: "POST" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong resource path",
      patch: { resourcePath: "/paid" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
    {
      label: "wrong pay-to",
      patch: { payTo: "wrong" },
      reason: "execution_dispatch_payment_contract_mismatch",
    },
  ];

let dispatchNegativeCount =
  0;

for (
  const testCase
  of dispatchNegativeCases
) {
  const evaluated =
    evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1({
      ...dispatchPositive,
      ...testCase.patch,
    });

  assert.equal(
    evaluated.ok,
    false,
    testCase.label,
  );

  assert.equal(
    evaluated.reason,
    testCase.reason,
    testCase.label,
  );

  dispatchNegativeCount +=
    1;
}

for (
  const capability
  of DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES
) {
  const evaluated =
    evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1({
      ...dispatchPositive,

      capabilityAuthorizations: {
        ...allDispatchCapabilities,
        [capability]:
          false,
      },
    });

  assert.equal(
    evaluated.ok,
    false,
    capability,
  );

  assert.equal(
    evaluated.reason,
    "execution_dispatch_capability_authorization_missing",
    capability,
  );

  assert.deepEqual(
    evaluated.missingCapabilities,
    [capability],
    capability,
  );

  dispatchNegativeCount +=
    1;
}

console.log(
  `DISPATCH_NEGATIVE_CASES_PASSED=${dispatchNegativeCount}`,
);

console.log(
  `DISPATCH_REQUIRED_CAPABILITY_COUNT=${DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES.length}`,
);

console.log(
  "EXECUTION_DISPATCH_CONTRACT_READY=true",
);



// -----------------------------------------------------------------------------
// PR #318 — deterministic live-execution orchestration journal CI.
// Pure state-machine validation only. No I/O or live side effects.
// Demo3-informed ordering:
// authorization/claim -> CRP pending registration -> one-shot payer -> release.
// -----------------------------------------------------------------------------

assert.equal(
  DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES.length,
  14,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.length,
  13,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER[5],
  "crp_pending_registration",
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.maxPaymentSubmissions,
  1,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.automaticRetry,
  false,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.productionActivation,
  false,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.gatewayOwnsAtomicClaim,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.runnerOwnsCrpPendingRegistration,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.crpPendingRegistrationRequiredBeforePayerInvocation,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.gatewayOwnsCrpFulfill,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.gatewayOwnsReceiptVerification,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.gatewayOwnsReplay,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.gatewayOwnsCanonicalRelease,
  true,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.directPhase5ClaimFromRunner,
  false,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.directCrpFulfillFromRunner,
  false,
);

assert.equal(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.directCanonicalReleaseFromRunner,
  false,
);

assert.deepEqual(
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.stepOrder,
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
);

const orchestrationBase:
  Demo4D43LiveExecutionJournalV1 = {
    completedSteps:
      [],

    boundedUseConsumed:
      false,

    crpPendingRegistered:
      false,

    paymentSubmissionAttempts:
      0,

    paymentOutcome:
      "not_attempted",

    paymentTransactionHashObserved:
      false,

    paymentFinalized:
      false,

    crpIndexed:
      false,

    paymentResponseObserved:
      false,

    resourceReleased:
      false,

    replayRejected:
      false,

    productionActivation:
      false,
  };

const orchestrationInitial =
  evaluateDemo4D43LiveExecutionProgressV1(
    orchestrationBase,
  );

assert.equal(
  orchestrationInitial.ok,
  true,
);

assert.equal(
  orchestrationInitial.status,
  "ready",
);

assert.equal(
  orchestrationInitial.reason,
  "live_execution_step_ready",
);

assert.equal(
  orchestrationInitial.nextStep,
  "pre_live_guard",
);

const orchestrationClaimVerified =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...orchestrationBase,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        5,
      ),

    boundedUseConsumed:
      true,
  });

assert.equal(
  orchestrationClaimVerified.ok,
  true,
);

assert.equal(
  orchestrationClaimVerified.nextStep,
  "crp_pending_registration",
);

const orchestrationCrpPendingRegistered =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...orchestrationBase,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        6,
      ),

    boundedUseConsumed:
      true,

    crpPendingRegistered:
      true,
  });

assert.equal(
  orchestrationCrpPendingRegistered.ok,
  true,
);

assert.equal(
  orchestrationCrpPendingRegistered.nextStep,
  "payer_wallet_preflight",
);

const orchestrationWalletPreflight =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...orchestrationBase,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        7,
      ),

    boundedUseConsumed:
      true,

    crpPendingRegistered:
      true,
  });

assert.equal(
  orchestrationWalletPreflight.ok,
  true,
);

assert.equal(
  orchestrationWalletPreflight.nextStep,
  "payer_invocation",
);

const successfulPaymentJournal:
  Demo4D43LiveExecutionJournalV1 = {
    ...orchestrationBase,

    boundedUseConsumed:
      true,

    crpPendingRegistered:
      true,

    paymentSubmissionAttempts:
      1,

    paymentOutcome:
      "finalized",

    paymentTransactionHashObserved:
      true,

    paymentFinalized:
      true,
  };

const orchestrationPayerComplete =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...successfulPaymentJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        8,
      ),
  });

assert.equal(
  orchestrationPayerComplete.ok,
  true,
);

assert.equal(
  orchestrationPayerComplete.nextStep,
  "finalize_and_reconcile",
);

const orchestrationReconciled =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...successfulPaymentJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        9,
      ),
  });

assert.equal(
  orchestrationReconciled.ok,
  true,
);

assert.equal(
  orchestrationReconciled.nextStep,
  "wait_for_crp_index",
);

const indexedPaymentJournal:
  Demo4D43LiveExecutionJournalV1 = {
    ...successfulPaymentJournal,
    crpIndexed:
      true,
  };

const orchestrationIndexed =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...indexedPaymentJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        10,
      ),
  });

assert.equal(
  orchestrationIndexed.ok,
  true,
);

assert.equal(
  orchestrationIndexed.nextStep,
  "release_request",
);

const releasedJournal:
  Demo4D43LiveExecutionJournalV1 = {
    ...indexedPaymentJournal,

    paymentResponseObserved:
      true,

    resourceReleased:
      true,
  };

const orchestrationReleased =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...releasedJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        11,
      ),
  });

assert.equal(
  orchestrationReleased.ok,
  true,
);

assert.equal(
  orchestrationReleased.nextStep,
  "replay_request",
);

const replayRejectedJournal:
  Demo4D43LiveExecutionJournalV1 = {
    ...releasedJournal,
    replayRejected:
      true,
  };

const orchestrationReplayRejected =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...replayRejectedJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
        0,
        12,
      ),
  });

assert.equal(
  orchestrationReplayRejected.ok,
  true,
);

assert.equal(
  orchestrationReplayRejected.nextStep,
  "final_state_verification",
);

const orchestrationComplete =
  evaluateDemo4D43LiveExecutionProgressV1({
    ...replayRejectedJournal,

    completedSteps:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
  });

assert.equal(
  orchestrationComplete.ok,
  true,
);

assert.equal(
  orchestrationComplete.status,
  "complete",
);

assert.equal(
  orchestrationComplete.reason,
  "live_execution_complete",
);

assert.equal(
  orchestrationComplete.nextStep,
  null,
);

assert.equal(
  orchestrationComplete.paymentSubmissionAttempts,
  1,
);

type OrchestrationNegativeCase = {
  readonly label:
    string;

  readonly journal:
    Demo4D43LiveExecutionJournalV1;

  readonly reason:
    string;
};

const payerCompletedPrefix =
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
    0,
    8,
  );

const orchestrationNegativeCases:
  readonly OrchestrationNegativeCase[] = [
    {
      label:
        "out of order journal",

      journal: {
        ...orchestrationBase,

        completedSteps: [
          "pre_live_guard",
          "proof_construction",
        ],
      },

      reason:
        "execution_stage_order_invalid",
    },

    {
      label:
        "production activation prohibited",

      journal: {
        ...orchestrationBase,
        productionActivation:
          true,
      },

      reason:
        "production_activation_prohibited",
    },

    {
      label:
        "payment budget exceeded",

      journal: {
        ...orchestrationBase,
        paymentSubmissionAttempts:
          2,
      },

      reason:
        "payment_submission_budget_exceeded",
    },

    {
      label:
        "malformed ambiguous state before payer",

      journal: {
        ...orchestrationBase,
        paymentSubmissionAttempts:
          1,
        paymentOutcome:
          "ambiguous_stop",
      },

      reason:
        "payment_outcome_inconsistent",
    },

    {
      label:
        "well formed ambiguous payer outcome stops",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        boundedUseConsumed:
          true,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "ambiguous_stop",
      },

      reason:
        "payment_submission_outcome_ambiguous_stop_required",
    },

    {
      label:
        "payer invocation before bounded use",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "failed_before_submission",
      },

      reason:
        "claim_required_before_payment",
    },

    {
      label:
        "payer invocation before CRP pending registration",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        boundedUseConsumed:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "failed_before_submission",
      },

      reason:
        "crp_pending_registration_required_before_payment",
    },

    {
      label:
        "payer invocation without consumed payment attempt",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        boundedUseConsumed:
          true,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          0,

        paymentOutcome:
          "not_attempted",
      },

      reason:
        "payment_outcome_inconsistent",
    },

    {
      label:
        "failed-before-submission state without payer invocation",

      journal: {
        ...orchestrationBase,

        boundedUseConsumed:
          true,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "failed_before_submission",
      },

      reason:
        "payment_outcome_inconsistent",
    },

    {
      label:
        "failed-before-submission after payer is terminal",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        boundedUseConsumed:
          true,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "failed_before_submission",
      },

      reason:
        "payment_submission_failed_stop_required",
    },

    {
      label:
        "not attempted outcome with consumed budget",

      journal: {
        ...orchestrationBase,

        paymentSubmissionAttempts:
          1,
      },

      reason:
        "payment_outcome_inconsistent",
    },

    {
      label:
        "finalized outcome missing transaction evidence",

      journal: {
        ...orchestrationBase,

        completedSteps:
          payerCompletedPrefix,

        boundedUseConsumed:
          true,

        crpPendingRegistered:
          true,

        paymentSubmissionAttempts:
          1,

        paymentOutcome:
          "finalized",
      },

      reason:
        "payment_outcome_inconsistent",
    },

    {
      label:
        "release attempted before CRP indexing",

      journal: {
        ...successfulPaymentJournal,

        completedSteps:
          DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
            0,
            11,
          ),
      },

      reason:
        "crp_index_required_before_release",
    },

    {
      label:
        "replay attempted before successful release evidence",

      journal: {
        ...indexedPaymentJournal,

        completedSteps:
          DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.slice(
            0,
            12,
          ),
      },

      reason:
        "release_required_before_replay",
    },

    {
      label:
        "final verification before replay rejection",

      journal: {
        ...releasedJournal,

        completedSteps:
          DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
      },

      reason:
        "replay_rejection_required_before_final_verification",
    },
  ];

let orchestrationNegativeCount =
  0;

for (
  const testCase
  of orchestrationNegativeCases
) {
  const evaluated =
    evaluateDemo4D43LiveExecutionProgressV1(
      testCase.journal,
    );

  assert.equal(
    evaluated.ok,
    false,
    testCase.label,
  );

  assert.equal(
    evaluated.status,
    "stop",
    testCase.label,
  );

  assert.equal(
    evaluated.reason,
    testCase.reason,
    testCase.label,
  );

  assert.equal(
    evaluated.nextStep,
    null,
    testCase.label,
  );

  assert.equal(
    evaluated.automaticRetry,
    false,
    testCase.label,
  );

  orchestrationNegativeCount +=
    1;
}

assert.equal(
  orchestrationNegativeCount,
  15,
);

console.log(
  `ORCHESTRATION_NEGATIVE_CASES_PASSED=${orchestrationNegativeCount}`,
);

console.log(
  `ORCHESTRATION_STEP_COUNT=${DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.length}`,
);

console.log(
  `ORCHESTRATION_CAPABILITY_COUNT=${DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES.length}`,
);

console.log(
  "CRP_PENDING_REGISTRATION_ORDER_PROVEN=true",
);

console.log(
  "ONE_SHOT_PAYER_FAILURE_STOP_PROVEN=true",
);

console.log(
  "ONE_SHOT_PAYER_AMBIGUITY_STOP_PROVEN=true",
);

console.log(
  "LIVE_ORCHESTRATION_STATE_MACHINE_READY=true",
);

console.log(
  "LIVE_EXECUTION_IMPLEMENTED=false",
);

console.log(
  "CAPABILITY_FLAGS_ARE_DECLARATIVE_ONLY=true",
);

console.log(
  "FRESH_BOUNDARY_AUTHORIZATION_STILL_REQUIRED=true",
);

console.log(
  "PR318_DETERMINISTIC_OFFLINE_CI=PASSED",
);


// -----------------------------------------------------------------------------
// PR #318 — deterministic S4/S5 controlled payer adapter CI.
//
// Mock-only. No wallet read, no network, no signing, no transaction submission.
// -----------------------------------------------------------------------------

async function runDemo4D43S4S5DeterministicAdapterCiV1():
Promise<void> {
  const assert =
    require(
      "node:assert/strict",
    );

  const runner =
    require(
      "./demo_phase6_demo4_d4_3_final_controlled_acceptance.ts",
    );

  const payer =
    require(
      "./plt-transfer.ts",
    );

  const paymentRequired = {
    merchantId:
      "demo-merchant",

    network:
      "concordium:testnet",

    chain_id:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    asset: {
      type:
        "PLT",

      tokenId:
        "EUDemo",

      decimals:
        6,
    },

    amount:
      "0.050101",

    payTo:
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

    resource: {
      method:
        "GET",

      path:
        "/paid-gated",
    },
  };

  const assessBalance =
    payer
      .assessPltTransferBalanceReadinessV1;

  assert.equal(
    typeof assessBalance,
    "function",
  );

  const balanceReady =
    assessBalance({
      payerTokenBalanceRaw:
        75000n,

      payerTokenBalanceDecimals:
        6,

      requiredAmountRaw:
        50101n,

      requiredAmountDecimals:
        6,
    });

  assert.equal(
    balanceReady.ok,
    true,
  );

  assert.equal(
    balanceReady.reason,
    "plt_payer_balance_ready",
  );

  const balanceInsufficient =
    assessBalance({
      payerTokenBalanceRaw:
        50100n,

      payerTokenBalanceDecimals:
        6,

      requiredAmountRaw:
        50101n,

      requiredAmountDecimals:
        6,
    });

  assert.equal(
    balanceInsufficient.ok,
    false,
  );

  assert.equal(
    balanceInsufficient.reason,
    "plt_payer_balance_insufficient",
  );

  const balanceDecimalsMismatch =
    assessBalance({
      payerTokenBalanceRaw:
        50101n,

      payerTokenBalanceDecimals:
        5,

      requiredAmountRaw:
        50101n,

      requiredAmountDecimals:
        6,
    });

  assert.equal(
    balanceDecimalsMismatch.ok,
    false,
  );

  assert.equal(
    balanceDecimalsMismatch.reason,
    "plt_payer_balance_decimals_mismatch",
  );

  const prepared = {
    walletPath:
      "mock-wallet.export",

    to:
      paymentRequired.payTo,

    tokenId:
      "EUDemo",

    amount:
      "0.050101",

    grpcHost:
      "grpc.testnet.concordium.com",

    grpcPort:
      20000,

    senderAddress:
      "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

    decimals:
      6,

    walletReadCount:
      1,

    tokenNetworkReads:
      1,

    accountInfoNetworkReads:
      1,

    payerTokenBalanceRaw:
      "75000",

    requiredAmountRaw:
      "50101",

    balanceSufficient:
      true,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    runtime: {
      webSdk: {},
      pltSdk: {},
      client: {},
      walletExport: {},
      sender: {},
      token: {},
      amountValue: {},
      recipient: {},
      memo:
        undefined,
    },
  };

  let s4NegativeCases =
    0;

  let preflightCalls =
    0;

  const unauthorizedS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          false,

        crpPendingRegistered:
          true,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => {
            preflightCalls +=
              1;

            return prepared;
          },
      });

  assert.equal(
    unauthorizedS4.evidence.ok,
    false,
  );

  assert.equal(
    unauthorizedS4.evidence.reason,
    "payer_wallet_preflight_not_authorized",
  );

  assert.equal(
    preflightCalls,
    0,
  );

  s4NegativeCases +=
    1;

  const noCrpS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          false,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => {
            preflightCalls +=
              1;

            return prepared;
          },
      });

  assert.equal(
    noCrpS4.evidence.reason,
    "payer_wallet_preflight_crp_pending_required",
  );

  assert.equal(
    preflightCalls,
    0,
  );

  s4NegativeCases +=
    1;

  const badTupleS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          true,

        paymentRequired: {
          ...paymentRequired,

          amount:
            "0.050102",
        },

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => {
            preflightCalls +=
              1;

            return prepared;
          },
      });

  assert.equal(
    badTupleS4.evidence.reason,
    "payer_wallet_preflight_contract_mismatch",
  );

  assert.equal(
    preflightCalls,
    0,
  );

  s4NegativeCases +=
    1;

  const failedPreflightS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          true,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => {
            preflightCalls +=
              1;

            throw new Error(
              "mock_preflight_failure",
            );
          },
      });

  assert.equal(
    failedPreflightS4.evidence.reason,
    "payer_wallet_preflight_failed",
  );

  assert.equal(
    failedPreflightS4.evidence.preflightCalls,
    1,
  );

  assert.equal(
    failedPreflightS4.evidence.paymentAttempted,
    false,
  );

  s4NegativeCases +=
    1;

  preflightCalls =
    0;

  const successfulS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          true,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => {
            preflightCalls +=
              1;

            return prepared;
          },
      });

  assert.equal(
    successfulS4.evidence.ok,
    true,
  );

  assert.equal(
    successfulS4.evidence.reason,
    "payer_wallet_preflight_completed",
  );

  assert.equal(
    preflightCalls,
    1,
  );

  assert.equal(
    successfulS4.evidence.walletReadCount,
    1,
  );

  assert.equal(
    successfulS4.evidence.tokenNetworkReads,
    1,
  );

  assert.equal(
    successfulS4.evidence.accountInfoNetworkReads,
    1,
  );

  assert.equal(
    successfulS4.evidence.payerTokenBalanceRaw,
    "75000",
  );

  assert.equal(
    successfulS4.evidence.requiredAmountRaw,
    "50101",
  );

  assert.equal(
    successfulS4.evidence.balanceSufficient,
    true,
  );

  assert.equal(
    successfulS4.evidence.amountRaw,
    "50101",
  );

  assert.equal(
    successfulS4.evidence.transactionConstructed,
    false,
  );

  assert.equal(
    successfulS4.evidence.transactionSubmitted,
    false,
  );

  assert.equal(
    successfulS4.evidence.paymentAttempted,
    false,
  );

  const insufficientBalanceS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          true,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => ({
            ...prepared,

            payerTokenBalanceRaw:
              "50100",

            balanceSufficient:
              true,
          }),
      });

  assert.equal(
    insufficientBalanceS4.evidence.ok,
    false,
  );

  assert.equal(
    insufficientBalanceS4.evidence.reason,
    "payer_wallet_preflight_contract_mismatch",
  );

  assert.equal(
    insufficientBalanceS4.evidence.paymentAttempted,
    false,
  );

  s4NegativeCases +=
    1;

  const missingAccountReadS4 =
    await runner
      .executeDemo4D43PayerWalletPreflightWithAdapterV1({
        authorized:
          true,

        crpPendingRegistered:
          true,

        paymentRequired,

        walletPath:
          "mock-wallet.export",

        grpcHost:
          "grpc.testnet.concordium.com",

        grpcPort:
          20000,

        preflight:
          async () => ({
            ...prepared,

            accountInfoNetworkReads:
              0,
          }),
      });

  assert.equal(
    missingAccountReadS4.evidence.ok,
    false,
  );

  assert.equal(
    missingAccountReadS4.evidence.reason,
    "payer_wallet_preflight_contract_mismatch",
  );

  assert.equal(
    missingAccountReadS4.evidence.paymentAttempted,
    false,
  );

  s4NegativeCases +=
    1;

  let s5NegativeCases =
    0;

  let payerCalls =
    0;

  const successExecution = {
    ok:
      true,

    outcome:
      "finalized_success",

    txHash:
      "a".repeat(
        64,
      ),

    transactionHashObserved:
      true,

    paymentSubmissionAttempts:
      1,

    signingOperations:
      1,

    transactionsConstructed:
      1,

    automaticRetry:
      false,

    finalized:
      true,

    diagnostic:
      null,
  };

  const unauthorizedS5 =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          false,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          1,

        invoke:
          async () => {
            payerCalls +=
              1;

            return successExecution;
          },
      });

  assert.equal(
    unauthorizedS5.reason,
    "payment_invocation_not_authorized",
  );

  assert.equal(
    payerCalls,
    0,
  );

  assert.equal(
    unauthorizedS5.paymentSubmissionAttempts,
    0,
  );

  s5NegativeCases +=
    1;

  const badBudgetS5 =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          true,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          0,

        invoke:
          async () => {
            payerCalls +=
              1;

            return successExecution;
          },
      });

  assert.equal(
    badBudgetS5.reason,
    "payment_invocation_budget_invalid",
  );

  assert.equal(
    payerCalls,
    0,
  );

  /*
   * This proves a second invocation is prohibited once the budget is gone.
   */
  assert.equal(
    badBudgetS5.paymentSubmissionAttempts,
    0,
  );

  s5NegativeCases +=
    1;

  const failedExecution =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          true,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          1,

        invoke:
          async () => {
            payerCalls +=
              1;

            return {
              ...successExecution,

              ok:
                false,

              outcome:
                "finalized_failure",

              txHash:
                "b".repeat(
                  64,
                ),

              finalized:
                true,

              diagnostic:
                "mock_finalized_failure",
            };
          },
      });

  assert.equal(
    failedExecution.reason,
    "payment_invocation_finalized_failure",
  );

  assert.equal(
    failedExecution.paymentOutcome,
    "finalized_failure",
  );

  assert.equal(
    failedExecution.stopRequired,
    true,
  );

  assert.equal(
    failedExecution.automaticRetry,
    false,
  );

  assert.equal(
    failedExecution.paymentSubmissionAttempts,
    1,
  );

  s5NegativeCases +=
    1;

  const ambiguousExecution =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          true,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          1,

        invoke:
          async () => {
            payerCalls +=
              1;

            return {
              ...successExecution,

              ok:
                false,

              outcome:
                "submitted_unknown",

              txHash:
                "c".repeat(
                  64,
                ),

              finalized:
                false,

              diagnostic:
                "mock_ambiguous",
            };
          },
      });

  assert.equal(
    ambiguousExecution.reason,
    "payment_invocation_submitted_unknown",
  );

  assert.equal(
    ambiguousExecution.paymentOutcome,
    "submitted_unknown",
  );

  assert.equal(
    ambiguousExecution.stopRequired,
    true,
  );

  assert.equal(
    ambiguousExecution.automaticRetry,
    false,
  );

  assert.equal(
    ambiguousExecution.paymentSubmissionAttempts,
    1,
  );

  s5NegativeCases +=
    1;

  const thrownExecution =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          true,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          1,

        invoke:
          async () => {
            payerCalls +=
              1;

            throw new Error(
              "mock_unknown_submission_outcome",
            );
          },
      });

  assert.equal(
    thrownExecution.reason,
    "payment_invocation_submitted_unknown",
  );

  assert.equal(
    thrownExecution.paymentAttemptConsumedBeforePayerInvocation,
    true,
  );

  assert.equal(
    thrownExecution.paymentSubmissionAttempts,
    1,
  );

  assert.equal(
    thrownExecution.stopRequired,
    true,
  );

  assert.equal(
    thrownExecution.automaticRetry,
    false,
  );

  s5NegativeCases +=
    1;

  payerCalls =
    0;

  const successfulS5 =
    await runner
      .executeDemo4D43PaymentInvocationWithAdapterV1({
        authorized:
          true,

        preflightSession:
          successfulS4,

        paymentSubmissionBudgetRemaining:
          1,

        invoke:
          async () => {
            payerCalls +=
              1;

            return successExecution;
          },
      });

  assert.equal(
    successfulS5.ok,
    true,
  );

  assert.equal(
    successfulS5.reason,
    "payment_invocation_completed",
  );

  assert.equal(
    payerCalls,
    1,
  );

  assert.equal(
    successfulS5.paymentSubmissionAttempts,
    1,
  );

  assert.equal(
    successfulS5.paymentAttemptConsumedBeforePayerInvocation,
    true,
  );

  assert.equal(
    successfulS5.signingOperations,
    1,
  );

  assert.equal(
    successfulS5.transactionsConstructed,
    1,
  );

  assert.equal(
    successfulS5.paymentOutcome,
    "finalized_success",
  );

  assert.equal(
    successfulS5.paymentFinalized,
    true,
  );

  assert.equal(
    successfulS5.stopRequired,
    false,
  );

  assert.equal(
    successfulS5.automaticRetry,
    false,
  );

  console.log(
    `S4_ADAPTER_NEGATIVE_CASES_PASSED=${s4NegativeCases}`,
  );

  console.log(
    "S4_AUTHORIZED_PREFLIGHT_EXACTLY_ONE=true",
  );

  console.log(
    "S4_NO_PAYMENT_PROVEN=true",
  );

  console.log(
    "S4_PLT_BALANCE_HELPER_SUFFICIENT_PROVEN=true",
  );

  console.log(
    "S4_PLT_BALANCE_HELPER_INSUFFICIENT_BLOCKED=true",
  );

  console.log(
    "S4_PLT_BALANCE_DECIMALS_MISMATCH_BLOCKED=true",
  );

  console.log(
    "S4_PLT_ACCOUNT_INFO_READ_REQUIRED=true",
  );

  console.log(
    "S4_PLT_BALANCE_BELOW_50101_BLOCKED=true",
  );

  console.log(
    "PR318_S4_PLT_BALANCE_READINESS_CI=PASSED",
  );

  console.log(
    `S5_ADAPTER_NEGATIVE_CASES_PASSED=${s5NegativeCases}`,
  );

  console.log(
    "S5_EXACTLY_ONE_PAYER_INVOCATION_PROVEN=true",
  );

  console.log(
    "S5_PAYMENT_BUDGET_CONSUMED_BEFORE_INVOCATION_PROVEN=true",
  );

  console.log(
    "S5_SECOND_INVOCATION_WITH_ZERO_BUDGET_BLOCKED=true",
  );

  console.log(
    "S5_FINALIZED_FAILURE_NO_RETRY_PROVEN=true",
  );

  console.log(
    "S5_AMBIGUOUS_OUTCOME_STOP_NO_RETRY_PROVEN=true",
  );

  console.log(
    "PR318_S4_S5_DETERMINISTIC_ADAPTER_CI=PASSED",
  );
}

void runDemo4D43S4S5DeterministicAdapterCiV1()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error(
        "PR318_S4_S5_DETERMINISTIC_ADAPTER_CI=FAILED",
      );

      console.error(
        error instanceof Error
          ? error.stack ??
            error.message
          : String(
              error,
            ),
      );

      process.exitCode =
        1;
    },
  );
