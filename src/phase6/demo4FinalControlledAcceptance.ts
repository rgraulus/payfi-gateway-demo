/**
 * PR #318 — Demo4 D4-3 final controlled acceptance.
 *
 * Initial deterministic/offline slice.
 *
 * This module is deliberately pure. It models the one-shot execution contract
 * and validates sanitized execution evidence. It performs no I/O, no network
 * calls, no database calls, no key or wallet reads, no signing, no payment,
 * no CRP call, and no release mutation.
 */

export const DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_CONTRACT =
  "demo4.d4_3.finalControlledAcceptance.v1" as const;

export const DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_READY_REASON =
  "d4_3_final_controlled_acceptance_contract_ready" as const;

export const DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_SUCCESS_REASON =
  "d4_3_final_controlled_acceptance_complete" as const;

export const DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS =
  1 as const;

export const DEMO4_D4_3_AUTOMATIC_RETRY =
  false as const;

export const DEMO4_D4_3_PRODUCTION =
  false as const;

export const DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE =
  [
    "readiness",
    "fresh_authorization",
    "fresh_challenge",
    "buyer_key_read",
    "acting_key_read",
    "proof_of_possession",
    "registered_agent_authorization",
    "gateway_redeem",
    "atomic_bounded_use_claim",
    "payer_wallet_read",
    "payment_submit",
    "payment_finalized",
    "crp_fulfill",
    "receipt_verified",
    "canonical_release",
    "resource_release",
    "replay_probe",
    "replay_rejected",
  ] as const;

export type Demo4D43PaymentOutcomeV1 =
  | "not_attempted"
  | "submitted_unknown"
  | "finalized_success"
  | "finalized_failure";

export type Demo4D43FinalControlledAcceptanceInputV1 = {
  readonly readinessConfirmed:
    boolean;

  readonly freshAuthorizationConfirmed:
    boolean;

  readonly freshChallengeConfirmed:
    boolean;

  readonly challengeContextsCreated:
    number;

  readonly buyerPrivateKeyReads:
    number;

  readonly actingPrivateKeyReads:
    number;

  readonly proofOfPossessionVerified:
    boolean;

  readonly registeredAgentAuthorizationConfirmed:
    boolean;

  readonly gatewayRedeemCalls:
    number;

  readonly usageClaimsCreated:
    number;

  readonly boundedUsesConsumed:
    number;

  readonly payerWalletReads:
    number;

  readonly signingOperations:
    number;

  readonly transactionsConstructed:
    number;

  readonly paymentSubmissions:
    number;

  readonly paymentOutcome:
    Demo4D43PaymentOutcomeV1;

  readonly automaticRetryRequested:
    boolean;

  readonly crpFulfillCalls:
    number;

  readonly receiptIssued:
    boolean;

  readonly receiptVerified:
    boolean;

  readonly settlementFinalized:
    boolean;

  readonly canonicalReleasePersisted:
    boolean;

  readonly paymentResponsesEmitted:
    number;

  readonly resourceReleases:
    number;

  readonly replayProbes:
    number;

  readonly replayRejected:
    boolean;

  readonly replayAdditionalPaymentSubmissions:
    number;

  readonly replayAdditionalUsageClaims:
    number;

  readonly replayAdditionalCrpFulfillCalls:
    number;

  readonly replayAdditionalPaymentResponses:
    number;

  readonly replayAdditionalResourceReleases:
    number;

  readonly productionActivation:
    boolean;

  readonly stageSequence:
    readonly string[];
};

export type Demo4D43FinalControlledAcceptanceResultV1 = {
  readonly ok:
    boolean;

  readonly status:
    "ready" | "complete" | "blocked";

  readonly reason:
    string;

  readonly terminal:
    boolean;

  readonly paymentSubmissionBudget:
    typeof DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS;

  readonly automaticRetry:
    typeof DEMO4_D4_3_AUTOMATIC_RETRY;

  readonly production:
    typeof DEMO4_D4_3_PRODUCTION;
};

function result(
  ok: boolean,
  status:
    Demo4D43FinalControlledAcceptanceResultV1["status"],
  reason: string,
  terminal = false,
): Demo4D43FinalControlledAcceptanceResultV1 {
  return {
    ok,
    status,
    reason,
    terminal,

    paymentSubmissionBudget:
      DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,

    automaticRetry:
      DEMO4_D4_3_AUTOMATIC_RETRY,

    production:
      DEMO4_D4_3_PRODUCTION,
  };
}

function exactSequence(
  actual:
    readonly string[],
  expected:
    readonly string[],
): boolean {
  if (
    actual.length !==
    expected.length
  ) {
    return false;
  }

  return expected.every(
    (value, index) =>
      actual[index] ===
      value,
  );
}

function exactlyOne(
  value: number,
): boolean {
  return (
    Number.isSafeInteger(
      value,
    ) &&
    value === 1
  );
}

function exactlyZero(
  value: number,
): boolean {
  return (
    Number.isSafeInteger(
      value,
    ) &&
    value === 0
  );
}

export function inspectDemo4FinalControlledAcceptanceContractV1():
Demo4D43FinalControlledAcceptanceResultV1 {
  if (
    DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS !==
      1
  ) {
    return result(
      false,
      "blocked",
      "payment_submission_budget_invalid",
      true,
    );
  }

  if (
    DEMO4_D4_3_AUTOMATIC_RETRY !==
      false
  ) {
    return result(
      false,
      "blocked",
      "automatic_retry_must_be_disabled",
      true,
    );
  }

  if (
    DEMO4_D4_3_PRODUCTION !==
      false
  ) {
    return result(
      false,
      "blocked",
      "production_activation_must_be_disabled",
      true,
    );
  }

  return result(
    true,
    "ready",
    DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_READY_REASON,
  );
}

export function evaluateDemo4FinalControlledAcceptanceV1(
  input:
    Demo4D43FinalControlledAcceptanceInputV1,
): Demo4D43FinalControlledAcceptanceResultV1 {
  const contract =
    inspectDemo4FinalControlledAcceptanceContractV1();

  if (!contract.ok) {
    return contract;
  }

  if (
    input.productionActivation !==
      false
  ) {
    return result(
      false,
      "blocked",
      "production_activation_prohibited",
      true,
    );
  }

  if (
    input.readinessConfirmed !==
      true
  ) {
    return result(
      false,
      "blocked",
      "pr317_readiness_not_confirmed",
    );
  }

  if (
    input.freshAuthorizationConfirmed !==
      true
  ) {
    return result(
      false,
      "blocked",
      "fresh_d4_3_authorization_required",
    );
  }

  if (
    input.freshChallengeConfirmed !==
      true ||
    !exactlyOne(
      input.challengeContextsCreated,
    )
  ) {
    return result(
      false,
      "blocked",
      "exactly_one_fresh_challenge_required",
    );
  }

  if (
    !exactlyOne(
      input.buyerPrivateKeyReads,
    )
  ) {
    return result(
      false,
      "blocked",
      "buyer_private_key_read_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.actingPrivateKeyReads,
    )
  ) {
    return result(
      false,
      "blocked",
      "acting_private_key_read_count_invalid",
    );
  }

  if (
    input.proofOfPossessionVerified !==
      true
  ) {
    return result(
      false,
      "blocked",
      "proof_of_possession_not_verified",
    );
  }

  if (
    input.registeredAgentAuthorizationConfirmed !==
      true
  ) {
    return result(
      false,
      "blocked",
      "registered_agent_authorization_not_confirmed",
    );
  }

  if (
    !exactlyOne(
      input.gatewayRedeemCalls,
    )
  ) {
    return result(
      false,
      "blocked",
      "gateway_redeem_call_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.usageClaimsCreated,
    )
  ) {
    return result(
      false,
      "blocked",
      "usage_claim_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.boundedUsesConsumed,
    )
  ) {
    return result(
      false,
      "blocked",
      "bounded_use_consumption_count_invalid",
    );
  }

  if (
    input.automaticRetryRequested !==
      false
  ) {
    return result(
      false,
      "blocked",
      "automatic_payment_retry_prohibited",
      true,
    );
  }

  if (
    input.paymentSubmissions >
      DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS
  ) {
    return result(
      false,
      "blocked",
      "payment_submission_budget_exceeded",
      true,
    );
  }

  if (
    !exactlyOne(
      input.paymentSubmissions,
    )
  ) {
    return result(
      false,
      "blocked",
      "exactly_one_payment_submission_required",
    );
  }

  /*
   * Once the payer has been invoked, the single payment-attempt budget is
   * consumed. An ambiguous post-submit result is terminal. The caller must
   * inspect chain/CRP state rather than invoke the payer again.
   */
  if (
    input.paymentOutcome ===
      "submitted_unknown"
  ) {
    return result(
      false,
      "blocked",
      "payment_submission_outcome_ambiguous_stop_required",
      true,
    );
  }

  if (
    input.paymentOutcome ===
      "finalized_failure"
  ) {
    return result(
      false,
      "blocked",
      "payment_finalized_failed_no_retry",
      true,
    );
  }

  if (
    input.paymentOutcome !==
      "finalized_success"
  ) {
    return result(
      false,
      "blocked",
      "payment_not_finalized_successfully",
    );
  }

  if (
    !exactlyOne(
      input.payerWalletReads,
    )
  ) {
    return result(
      false,
      "blocked",
      "payer_wallet_read_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.signingOperations,
    )
  ) {
    return result(
      false,
      "blocked",
      "signing_operation_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.transactionsConstructed,
    )
  ) {
    return result(
      false,
      "blocked",
      "transaction_construction_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.crpFulfillCalls,
    )
  ) {
    return result(
      false,
      "blocked",
      "crp_fulfill_call_count_invalid",
    );
  }

  if (
    input.receiptIssued !==
      true
  ) {
    return result(
      false,
      "blocked",
      "receipt_not_issued",
    );
  }

  if (
    input.receiptVerified !==
      true
  ) {
    return result(
      false,
      "blocked",
      "receipt_not_verified",
    );
  }

  if (
    input.settlementFinalized !==
      true
  ) {
    return result(
      false,
      "blocked",
      "settlement_not_finalized",
    );
  }

  if (
    input.canonicalReleasePersisted !==
      true
  ) {
    return result(
      false,
      "blocked",
      "canonical_release_not_persisted",
    );
  }

  if (
    !exactlyOne(
      input.paymentResponsesEmitted,
    )
  ) {
    return result(
      false,
      "blocked",
      "payment_response_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.resourceReleases,
    )
  ) {
    return result(
      false,
      "blocked",
      "resource_release_count_invalid",
    );
  }

  if (
    !exactlyOne(
      input.replayProbes,
    ) ||
    input.replayRejected !==
      true
  ) {
    return result(
      false,
      "blocked",
      "replay_rejection_not_proven",
    );
  }

  if (
    !exactlyZero(
      input.replayAdditionalPaymentSubmissions,
    )
  ) {
    return result(
      false,
      "blocked",
      "replay_additional_payment_prohibited",
      true,
    );
  }

  if (
    !exactlyZero(
      input.replayAdditionalUsageClaims,
    )
  ) {
    return result(
      false,
      "blocked",
      "replay_additional_usage_claim_prohibited",
      true,
    );
  }

  if (
    !exactlyZero(
      input.replayAdditionalCrpFulfillCalls,
    )
  ) {
    return result(
      false,
      "blocked",
      "replay_additional_crp_fulfill_prohibited",
      true,
    );
  }

  if (
    !exactlyZero(
      input.replayAdditionalPaymentResponses,
    )
  ) {
    return result(
      false,
      "blocked",
      "replay_additional_payment_response_prohibited",
      true,
    );
  }

  if (
    !exactlyZero(
      input.replayAdditionalResourceReleases,
    )
  ) {
    return result(
      false,
      "blocked",
      "replay_additional_resource_release_prohibited",
      true,
    );
  }

  if (
    !exactSequence(
      input.stageSequence,
      DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE,
    )
  ) {
    return result(
      false,
      "blocked",
      "execution_stage_order_invalid",
      true,
    );
  }

  return result(
    true,
    "complete",
    DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_SUCCESS_REASON,
    true,
  );
}


/*
 * PR #318 deterministic fail-closed execution-dispatch contract.
 *
 * This is a pure decision surface. "ready" means only that the exact
 * one-shot Demo4 execution contract is pinned and acknowledged.
 *
 * It performs no live side effect.
 */

export const DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_CONTRACT =
  "demo4.d4_3.finalControlledAcceptance.executionDispatch.v1" as const;

export const DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_READY_REASON =
  "d4_3_final_controlled_acceptance_execution_dispatch_ready" as const;

export const DEMO4_D4_3_PAYMENT_CONTRACT = {
  canonicalChainId:
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",

  paymentNetwork:
    "concordium:testnet",

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
    DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,

  automaticRetry:
    DEMO4_D4_3_AUTOMATIC_RETRY,

  production:
    DEMO4_D4_3_PRODUCTION,
} as const;

export const DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES =
  [
    "challengeNetworkRead",
    "databaseRead",
    "phase6AuditWrite",
    "buyerPrivateKeyRead",
    "actingPrivateKeyRead",
    "proofSigning",
    "gatewayRedeem",
    "phase5AtomicClaim",
    "payerWalletRead",
    "paymentTransactionSubmit",
    "crpPaymentCreate",
    "crpFulfill",
    "receiptRelease",
    "replayProbe",
  ] as const;

export type Demo4D43ExecutionCapabilityNameV1 =
  typeof DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES[number];

export type Demo4D43ExecutionCapabilityAuthorizationsV1 =
  Readonly<
    Record<
      Demo4D43ExecutionCapabilityNameV1,
      boolean
    >
  >;

export type Demo4D43ExecutionDispatchInputV1 = {
  readonly executionAcknowledged:
    boolean;

  readonly pr317ReadinessConfirmed:
    boolean;

  readonly freshExecutionAuthorizationConfirmed:
    boolean;

  readonly oneShotPaymentAcknowledged:
    boolean;

  readonly ambiguousSubmissionStopAcknowledged:
    boolean;

  readonly maxPaymentSubmissions:
    number;

  readonly automaticRetry:
    boolean;

  readonly productionActivation:
    boolean;

  readonly canonicalChainId:
    string;

  readonly paymentNetwork:
    string;

  readonly networkGenesisIndex:
    number;

  readonly assetType:
    string;

  readonly tokenId:
    string;

  readonly decimals:
    number;

  readonly amount:
    string;

  readonly amountRaw:
    string;

  readonly merchantId:
    string;

  readonly resourceMethod:
    string;

  readonly resourcePath:
    string;

  readonly payTo:
    string;

  readonly capabilityAuthorizations:
    Demo4D43ExecutionCapabilityAuthorizationsV1;
};

export type Demo4D43ExecutionDispatchResultV1 = {
  readonly ok:
    boolean;

  readonly status:
    "ready" | "blocked";

  readonly reason:
    string;

  readonly missingCapabilities:
    readonly Demo4D43ExecutionCapabilityNameV1[];

  readonly maxPaymentSubmissions:
    typeof DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS;

  readonly automaticRetry:
    typeof DEMO4_D4_3_AUTOMATIC_RETRY;

  readonly production:
    typeof DEMO4_D4_3_PRODUCTION;

  readonly liveExecutionImplemented:
    false;
};

function dispatchResult(
  ok: boolean,
  status:
    Demo4D43ExecutionDispatchResultV1["status"],
  reason: string,
  missingCapabilities:
    readonly Demo4D43ExecutionCapabilityNameV1[] = [],
): Demo4D43ExecutionDispatchResultV1 {
  return {
    ok,
    status,
    reason,
    missingCapabilities,

    maxPaymentSubmissions:
      DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,

    automaticRetry:
      DEMO4_D4_3_AUTOMATIC_RETRY,

    production:
      DEMO4_D4_3_PRODUCTION,

    liveExecutionImplemented:
      false,
  };
}

export function evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1(
  input:
    Demo4D43ExecutionDispatchInputV1,
): Demo4D43ExecutionDispatchResultV1 {
  if (
    input.productionActivation !==
      false
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_production_activation_prohibited",
    );
  }

  if (
    input.executionAcknowledged !==
      true
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_ack_required",
    );
  }

  if (
    input.pr317ReadinessConfirmed !==
      true
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_pr317_readiness_required",
    );
  }

  if (
    input.freshExecutionAuthorizationConfirmed !==
      true
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_fresh_authorization_required",
    );
  }

  if (
    input.oneShotPaymentAcknowledged !==
      true
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_one_shot_payment_ack_required",
    );
  }

  if (
    input.ambiguousSubmissionStopAcknowledged !==
      true
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_ambiguous_submission_stop_ack_required",
    );
  }

  if (
    input.maxPaymentSubmissions !==
      DEMO4_D4_3_PAYMENT_CONTRACT.maxPaymentSubmissions
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_payment_submission_budget_mismatch",
    );
  }

  if (
    input.automaticRetry !==
      DEMO4_D4_3_PAYMENT_CONTRACT.automaticRetry
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_automatic_retry_must_be_false",
    );
  }

  const paymentContractMatches =
    input.canonicalChainId ===
      DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId &&
    input.paymentNetwork ===
      DEMO4_D4_3_PAYMENT_CONTRACT.paymentNetwork &&
    input.networkGenesisIndex ===
      DEMO4_D4_3_PAYMENT_CONTRACT.networkGenesisIndex &&
    input.assetType ===
      DEMO4_D4_3_PAYMENT_CONTRACT.assetType &&
    input.tokenId ===
      DEMO4_D4_3_PAYMENT_CONTRACT.tokenId &&
    input.decimals ===
      DEMO4_D4_3_PAYMENT_CONTRACT.decimals &&
    input.amount ===
      DEMO4_D4_3_PAYMENT_CONTRACT.amount &&
    input.amountRaw ===
      DEMO4_D4_3_PAYMENT_CONTRACT.amountRaw &&
    input.merchantId ===
      DEMO4_D4_3_PAYMENT_CONTRACT.merchantId &&
    input.resourceMethod ===
      DEMO4_D4_3_PAYMENT_CONTRACT.resourceMethod &&
    input.resourcePath ===
      DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath &&
    input.payTo ===
      DEMO4_D4_3_PAYMENT_CONTRACT.payTo;

  if (!paymentContractMatches) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_payment_contract_mismatch",
    );
  }

  const missingCapabilities =
    DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES
      .filter(
        (capability) =>
          input
            .capabilityAuthorizations[
              capability
            ] !== true,
      );

  if (
    missingCapabilities.length >
      0
  ) {
    return dispatchResult(
      false,
      "blocked",
      "execution_dispatch_capability_authorization_missing",
      missingCapabilities,
    );
  }

  return dispatchResult(
    true,
    "ready",
    DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_READY_REASON,
  );
}


// -----------------------------------------------------------------------------
// PR #318 — bounded live-execution orchestration state machine.
// Pure coordination only: no I/O, no signing, no payment, no release.
// -----------------------------------------------------------------------------

export const DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER = Object.freeze([
  "pre_live_guard",
  "fresh_challenge",
  "proof_construction",
  "redeem_and_claim",
  "verify_claim_state",
  "crp_pending_registration",
  "payer_wallet_preflight",
  "payer_invocation",
  "finalize_and_reconcile",
  "wait_for_crp_index",
  "release_request",
  "replay_request",
  "final_state_verification",
] as const);

export type Demo4D43LiveExecutionStepV1 =
  (typeof DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER)[number];

export type Demo4D43LivePaymentOutcomeV1 =
  | "not_attempted"
  | "finalized"
  | "failed_before_submission"
  | "ambiguous_stop";

export const DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT = Object.freeze({
  contract: "demo4.d4_3.finalControlledAcceptance.liveOrchestration.v1",
  version: "1.0.0",
  testnetOnly: true,
  productionActivation: false,
  maxPaymentSubmissions: 1,
  automaticRetry: false,
  paymentAttemptConsumedBeforePayerInvocation: true,
  ambiguousPaymentOutcomeRequiresStop: true,
  gatewayOwnsAtomicClaim: true,
  runnerOwnsCrpPendingRegistration: true,
  crpPendingRegistrationRequiredBeforePayerInvocation: true,
  gatewayOwnsCrpFulfill: true,
  gatewayOwnsReceiptVerification: true,
  gatewayOwnsReplay: true,
  gatewayOwnsCanonicalRelease: true,
  directPhase5ClaimFromRunner: false,
  directCrpFulfillFromRunner: false,
  directCanonicalReleaseFromRunner: false,
  stepOrder: DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
});

export type Demo4D43LiveExecutionJournalV1 = {
  readonly completedSteps: readonly Demo4D43LiveExecutionStepV1[];
  readonly boundedUseConsumed: boolean;
  readonly crpPendingRegistered: boolean;
  readonly paymentSubmissionAttempts: number;
  readonly paymentOutcome: Demo4D43LivePaymentOutcomeV1;
  readonly paymentTransactionHashObserved: boolean;
  readonly paymentFinalized: boolean;
  readonly crpIndexed: boolean;
  readonly paymentResponseObserved: boolean;
  readonly resourceReleased: boolean;
  readonly replayRejected: boolean;
  readonly productionActivation: boolean;
};

export type Demo4D43LiveExecutionProgressV1 = {
  readonly ok: boolean;
  readonly status: "ready" | "complete" | "stop";
  readonly reason:
    | "live_execution_step_ready"
    | "live_execution_complete"
    | "execution_stage_order_invalid"
    | "production_activation_prohibited"
    | "payment_submission_budget_exceeded"
    | "payment_submission_outcome_ambiguous_stop_required"
    | "claim_required_before_payment"
    | "crp_pending_registration_required_before_payment"
    | "payment_submission_failed_stop_required"
    | "payment_outcome_inconsistent"
    | "payment_finalization_required_before_release"
    | "crp_index_required_before_release"
    | "release_required_before_replay"
    | "replay_rejection_required_before_final_verification";
  readonly nextStep: Demo4D43LiveExecutionStepV1 | null;
  readonly completedStepCount: number;
  readonly paymentSubmissionAttempts: number;
  readonly automaticRetry: false;
  readonly productionActivation: false;
};

function demo4D43Stop(
  journal: Demo4D43LiveExecutionJournalV1,
  reason: Demo4D43LiveExecutionProgressV1["reason"],
): Demo4D43LiveExecutionProgressV1 {
  return {
    ok: false,
    status: "stop",
    reason,
    nextStep: null,
    completedStepCount: journal.completedSteps.length,
    paymentSubmissionAttempts: journal.paymentSubmissionAttempts,
    automaticRetry: false,
    productionActivation: false,
  };
}

export function evaluateDemo4D43LiveExecutionProgressV1(
  journal: Demo4D43LiveExecutionJournalV1,
): Demo4D43LiveExecutionProgressV1 {
  const ordered =
    journal.completedSteps.length <= DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.length &&
    journal.completedSteps.every(
      (step, index) => step === DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER[index],
    );

  if (journal.productionActivation) {
    return demo4D43Stop(journal, "production_activation_prohibited");
  }
  if (!ordered) {
    return demo4D43Stop(journal, "execution_stage_order_invalid");
  }
  if (
    !Number.isSafeInteger(journal.paymentSubmissionAttempts) ||
    journal.paymentSubmissionAttempts < 0 ||
    journal.paymentSubmissionAttempts > 1
  ) {
    return demo4D43Stop(journal, "payment_submission_budget_exceeded");
  }
  if (journal.paymentOutcome === "ambiguous_stop") {
    if (
      !journal.completedSteps.includes("payer_invocation") ||
      journal.paymentSubmissionAttempts !== 1
    ) {
      return demo4D43Stop(journal, "payment_outcome_inconsistent");
    }

    return demo4D43Stop(
      journal,
      "payment_submission_outcome_ambiguous_stop_required",
    );
  }

  const completed = new Set(journal.completedSteps);

  if (completed.has("payer_invocation") && !journal.boundedUseConsumed) {
    return demo4D43Stop(journal, "claim_required_before_payment");
  }

  if (completed.has("payer_invocation") && !journal.crpPendingRegistered) {
    return demo4D43Stop(
      journal,
      "crp_pending_registration_required_before_payment",
    );
  }

  if (
    completed.has("payer_invocation") &&
    journal.paymentSubmissionAttempts !== 1
  ) {
    return demo4D43Stop(journal, "payment_outcome_inconsistent");
  }

  if (journal.paymentOutcome === "failed_before_submission") {
    if (
      !completed.has("payer_invocation") ||
      journal.paymentSubmissionAttempts !== 1 ||
      journal.paymentTransactionHashObserved ||
      journal.paymentFinalized
    ) {
      return demo4D43Stop(journal, "payment_outcome_inconsistent");
    }

    return demo4D43Stop(
      journal,
      "payment_submission_failed_stop_required",
    );
  }

  if (
    (journal.paymentOutcome === "not_attempted" &&
      journal.paymentSubmissionAttempts !== 0) ||
    (journal.paymentOutcome === "finalized" &&
      (journal.paymentSubmissionAttempts !== 1 ||
        !journal.paymentTransactionHashObserved ||
        !journal.paymentFinalized))
  ) {
    return demo4D43Stop(journal, "payment_outcome_inconsistent");
  }
  if (completed.has("release_request") && !journal.paymentFinalized) {
    return demo4D43Stop(
      journal,
      "payment_finalization_required_before_release",
    );
  }
  if (completed.has("release_request") && !journal.crpIndexed) {
    return demo4D43Stop(journal, "crp_index_required_before_release");
  }
  if (
    completed.has("replay_request") &&
    (!journal.paymentResponseObserved || !journal.resourceReleased)
  ) {
    return demo4D43Stop(journal, "release_required_before_replay");
  }
  if (completed.has("final_state_verification") && !journal.replayRejected) {
    return demo4D43Stop(
      journal,
      "replay_rejection_required_before_final_verification",
    );
  }

  if (
    journal.completedSteps.length ===
    DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.length
  ) {
    return {
      ok: true,
      status: "complete",
      reason: "live_execution_complete",
      nextStep: null,
      completedStepCount: journal.completedSteps.length,
      paymentSubmissionAttempts: journal.paymentSubmissionAttempts,
      automaticRetry: false,
      productionActivation: false,
    };
  }

  return {
    ok: true,
    status: "ready",
    reason: "live_execution_step_ready",
    nextStep:
      DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER[journal.completedSteps.length],
    completedStepCount: journal.completedSteps.length,
    paymentSubmissionAttempts: journal.paymentSubmissionAttempts,
    automaticRetry: false,
    productionActivation: false,
  };
}
