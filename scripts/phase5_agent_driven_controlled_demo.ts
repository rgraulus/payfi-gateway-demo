import {
  evaluatePhase5AgentPolicy,
  type Phase5AgentPolicyDecision,
  type Phase5AgentPolicyEvaluationReason,
} from "./phase5_agent_policy_evaluator";
import {
  type Phase5AgentDelegationBindingContext,
  type Phase5AgentDelegationBindingVerifierReason,
} from "./phase5_agent_delegation_binding_verifier";

export type Phase5AgentDrivenHandoffStatus =
  | "blocked_before_payment"
  | "ready_for_phase4_settlement";

export type Phase5AgentDrivenControlledDemoResult = {
  readonly ok: true;
  readonly mode: "test_fixture_only";
  readonly controlledDemo: true;
  readonly phase4HandoffStatus:
    Phase5AgentDrivenHandoffStatus;
  readonly authorizationAccepted: boolean;
  readonly authorizationReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly authorizationBindingEvaluated: boolean;
  readonly policyEvaluated: boolean;
  readonly policyDecision: Phase5AgentPolicyDecision;
  readonly policyReason:
    Phase5AgentPolicyEvaluationReason;
  readonly paymentEligible: boolean;
  readonly phase4SettlementEligible: boolean;
  readonly networkCalls: false;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly crpFulfillCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPresent: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponseEmitted: false;
  readonly protectedResourceReleased: false;
  readonly replayTouched: false;
  readonly canonicalReleasePersisted: false;
  readonly productionActivation: false;
};

export function runPhase5AgentDrivenControlledDemo(
  envelope: unknown,
  expectedContext:
    Phase5AgentDelegationBindingContext,
): Phase5AgentDrivenControlledDemoResult {
  const policy = evaluatePhase5AgentPolicy(
    envelope,
    expectedContext,
  );

  const phase4SettlementEligible =
    policy.ok === true &&
    policy.reason === "policy_satisfied" &&
    policy.authorizationAccepted === true &&
    policy.policyEvaluated === true &&
    policy.policyDecision === "allow";

  return {
    ok: true,
    mode: "test_fixture_only",
    controlledDemo: true,
    phase4HandoffStatus:
      phase4SettlementEligible
        ? "ready_for_phase4_settlement"
        : "blocked_before_payment",
    authorizationAccepted:
      policy.authorizationAccepted,
    authorizationReason:
      policy.authorizationReason,
    authorizationBindingEvaluated:
      policy.authorizationBindingEvaluated,
    policyEvaluated:
      policy.policyEvaluated,
    policyDecision:
      policy.policyDecision,
    policyReason:
      policy.reason,
    paymentEligible:
      phase4SettlementEligible,
    phase4SettlementEligible,
    networkCalls: false,
    gatewayCalled: false,
    crpCalled: false,
    crpFulfillCalled: false,
    paymentAttempted: false,
    receiptJwsPresent: false,
    receiptJwsPrinted: false,
    paymentResponseEmitted: false,
    protectedResourceReleased: false,
    replayTouched: false,
    canonicalReleasePersisted: false,
    productionActivation: false,
  };
}
