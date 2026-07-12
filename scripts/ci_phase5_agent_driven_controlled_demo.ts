import * as fs from "fs";
import * as path from "path";

import {
  runPhase5AgentDrivenControlledDemo,
  type Phase5AgentDrivenControlledDemoResult,
  type Phase5AgentDrivenHandoffStatus,
} from "./phase5_agent_driven_controlled_demo";
import {
  type Phase5AgentDelegationBindingContext,
  type Phase5AgentDelegationBindingVerifierReason,
} from "./phase5_agent_delegation_binding_verifier";
import {
  type Phase5AgentPolicyDecision,
  type Phase5AgentPolicyEvaluationReason,
} from "./phase5_agent_policy_evaluator";

type JsonRecord = Record<string, unknown>;

type DemoCase = {
  readonly name: string;
  readonly relativePath: string;
  readonly expectedHandoffStatus:
    Phase5AgentDrivenHandoffStatus;
  readonly expectedAuthorizationAccepted: boolean;
  readonly expectedAuthorizationReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly expectedPolicyEvaluated: boolean;
  readonly expectedPolicyDecision:
    Phase5AgentPolicyDecision;
  readonly expectedPolicyReason:
    Phase5AgentPolicyEvaluationReason;
  readonly expectedPaymentEligible: boolean;
  readonly expectedPhase4SettlementEligible:
    boolean;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly expectedHandoffStatus:
    Phase5AgentDrivenHandoffStatus;
  readonly actualHandoffStatus:
    Phase5AgentDrivenHandoffStatus;
  readonly result:
    Phase5AgentDrivenControlledDemoResult;
};

const ROOT = process.cwd();

const EXPECTED_CONTEXT:
  Phase5AgentDelegationBindingContext = {
    nowSec: 1780000100,
    challenge: {
      nonce: "demo-phase5-valid-nonce",
      challengeHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    scope: {
      merchantId: "demo-merchant",
      resourceMethod: "GET",
      resourcePath: "/paid-gated",
      contractId:
        "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
      contractVersion: "1.0.0",
      allowedAction:
        "authorize_payment_and_resource_access",
      maxUses: 1,
    },
    paymentTuple: {
      network: "concordium:testnet",
      assetType: "PLT",
      tokenId: "EUDemo",
      decimals: 6,
      amount: "0.050101",
      payTo:
        "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
    },
  };

const DEMO_CASES: readonly DemoCase[] = [
  {
    name:
      "negative delegated buyer is blocked before payment",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.policy-ineligible-us-18.example.json",
    expectedHandoffStatus:
      "blocked_before_payment",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationReason: "accepted",
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedPolicyReason:
      "age_requirement_not_met",
    expectedPaymentEligible: false,
    expectedPhase4SettlementEligible: false,
  },
  {
    name:
      "positive delegated buyer is ready for Phase 4 settlement",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.valid.example.json",
    expectedHandoffStatus:
      "ready_for_phase4_settlement",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationReason: "accepted",
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "allow",
    expectedPolicyReason: "policy_satisfied",
    expectedPaymentEligible: true,
    expectedPhase4SettlementEligible: true,
  },
];

function readJson(
  relativePath: string,
): JsonRecord {
  const absolutePath =
    path.join(ROOT, relativePath);

  return JSON.parse(
    fs.readFileSync(absolutePath, "utf8"),
  ) as JsonRecord;
}

function safetyContractSatisfied(
  result: Phase5AgentDrivenControlledDemoResult,
): boolean {
  return (
    result.ok === true &&
    result.mode === "test_fixture_only" &&
    result.controlledDemo === true &&
    result.networkCalls === false &&
    result.gatewayCalled === false &&
    result.crpCalled === false &&
    result.crpFulfillCalled === false &&
    result.paymentAttempted === false &&
    result.receiptJwsPresent === false &&
    result.receiptJwsPrinted === false &&
    result.paymentResponseEmitted === false &&
    result.protectedResourceReleased === false &&
    result.replayTouched === false &&
    result.canonicalReleasePersisted === false &&
    result.productionActivation === false
  );
}

function evaluateCase(
  demoCase: DemoCase,
): EvaluatedCase {
  const envelope =
    readJson(demoCase.relativePath);

  const result =
    runPhase5AgentDrivenControlledDemo(
      envelope,
      EXPECTED_CONTEXT,
    );

  const ok =
    result.phase4HandoffStatus ===
      demoCase.expectedHandoffStatus &&
    result.authorizationAccepted ===
      demoCase.expectedAuthorizationAccepted &&
    result.authorizationReason ===
      demoCase.expectedAuthorizationReason &&
    result.authorizationBindingEvaluated === true &&
    result.policyEvaluated ===
      demoCase.expectedPolicyEvaluated &&
    result.policyDecision ===
      demoCase.expectedPolicyDecision &&
    result.policyReason ===
      demoCase.expectedPolicyReason &&
    result.paymentEligible ===
      demoCase.expectedPaymentEligible &&
    result.phase4SettlementEligible ===
      demoCase
        .expectedPhase4SettlementEligible &&
    safetyContractSatisfied(result);

  return {
    name: demoCase.name,
    ok,
    expectedHandoffStatus:
      demoCase.expectedHandoffStatus,
    actualHandoffStatus:
      result.phase4HandoffStatus,
    result,
  };
}

function main(): void {
  const evaluated =
    DEMO_CASES.map(evaluateCase);

  const ok = evaluated.every(
    (demoCase) => demoCase.ok,
  );

  const summary = {
    ok,
    label:
      "phase5:agent-driven-controlled-demo-test",
    contract:
      "phase5.agentDrivenControlledDemo.v1",
    mode: "test_fixture_only",
    controlledDemo: true,
    prePaymentOnly: true,
    phase4SettlementEntered: false,
    safety: {
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
    },
    nextFiniteRung:
      "#292 agent-driven x402 v2 E2E composition using the Phase 4 settlement spine",
    cases: evaluated.map(
      (demoCase) => ({
        name: demoCase.name,
        ok: demoCase.ok,
        expectedHandoffStatus:
          demoCase.expectedHandoffStatus,
        actualHandoffStatus:
          demoCase.actualHandoffStatus,
        authorizationAccepted:
          demoCase.result
            .authorizationAccepted,
        authorizationReason:
          demoCase.result
            .authorizationReason,
        authorizationBindingEvaluated:
          demoCase.result
            .authorizationBindingEvaluated,
        policyEvaluated:
          demoCase.result.policyEvaluated,
        policyDecision:
          demoCase.result.policyDecision,
        policyReason:
          demoCase.result.policyReason,
        paymentEligible:
          demoCase.result.paymentEligible,
        phase4SettlementEligible:
          demoCase.result
            .phase4SettlementEligible,
        paymentAttempted:
          demoCase.result.paymentAttempted,
        crpFulfillCalled:
          demoCase.result.crpFulfillCalled,
        paymentResponseEmitted:
          demoCase.result
            .paymentResponseEmitted,
        protectedResourceReleased:
          demoCase.result
            .protectedResourceReleased,
      }),
    ),
  };

  console.log(
    JSON.stringify(summary, null, 2),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
