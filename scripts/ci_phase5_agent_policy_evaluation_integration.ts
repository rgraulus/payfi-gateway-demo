import * as fs from "fs";
import * as path from "path";

import {
  evaluatePhase5AgentPolicy,
  type Phase5AgentPolicyDecision,
  type Phase5AgentPolicyEvaluationReason,
  type Phase5AgentPolicyEvaluationResult,
} from "./phase5_agent_policy_evaluator";
import {
  type Phase5AgentDelegationBindingContext,
  type Phase5AgentDelegationBindingVerifierReason,
} from "./phase5_agent_delegation_binding_verifier";

type JsonRecord = Record<string, unknown>;

type FixtureCase = {
  readonly name: string;
  readonly relativePath: string;
  readonly expectedReason:
    Phase5AgentPolicyEvaluationReason;
  readonly expectedAuthorizationReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly expectedAuthorizationAccepted: boolean;
  readonly expectedAuthorizationBindingEvaluated: boolean;
  readonly expectedPolicyEvaluated: boolean;
  readonly expectedPolicyDecision:
    Phase5AgentPolicyDecision;
  readonly expectedProofType: string | null;
  readonly expectedRegion: string | null;
  readonly expectedAgeClaim: number | null;
  readonly expectedAgeClaimSource:
    | "ageOver"
    | "ageAtLeast"
    | null;
  readonly expectedMinimumAge: number | null;
  readonly proveAgentCannotSubstitute?: boolean;
};

type EvaluatedCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly expectedReason:
    Phase5AgentPolicyEvaluationReason;
  readonly actualReason:
    Phase5AgentPolicyEvaluationReason;
  readonly result:
    Phase5AgentPolicyEvaluationResult;
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

const FIXTURE_CASES: readonly FixtureCase[] = [
  {
    name: "eligible EU buyer policy is allowed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.valid.example.json",
    expectedReason: "policy_satisfied",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "allow",
    expectedProofType:
      "concordium.VerifiablePresentation",
    expectedRegion: "EU",
    expectedAgeClaim: 21,
    expectedAgeClaimSource: "ageOver",
    expectedMinimumAge: 18,
  },
  {
    name: "ineligible US buyer policy is denied",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.policy-ineligible-us-18.example.json",
    expectedReason: "age_requirement_not_met",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType:
      "concordium.VerifiablePresentation",
    expectedRegion: "US",
    expectedAgeClaim: 18,
    expectedAgeClaimSource: "ageOver",
    expectedMinimumAge: 21,
  },
  {
    name: "authorization binding rejection is preserved",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-challenge-binding.example.json",
    expectedReason:
      "authorization_binding_rejected",
    expectedAuthorizationReason:
      "challenge_binding_mismatch",
    expectedAuthorizationAccepted: false,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: false,
    expectedPolicyDecision: "not_evaluated",
    expectedProofType:
      "concordium.VerifiablePresentation",
    expectedRegion: "EU",
    expectedAgeClaim: 21,
    expectedAgeClaimSource: "ageOver",
    expectedMinimumAge: null,
  },
  {
    name: "missing buyer policy evidence fails closed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-policy-evidence.example.json",
    expectedReason: "missing_policy_evidence",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType: null,
    expectedRegion: null,
    expectedAgeClaim: null,
    expectedAgeClaimSource: null,
    expectedMinimumAge: null,
  },
  {
    name: "unsupported policy proof type fails closed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-unsupported-policy-evidence-type.example.json",
    expectedReason:
      "unsupported_policy_evidence_type",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType:
      "unsupported.demo.PolicyEvidence",
    expectedRegion: "EU",
    expectedAgeClaim: 21,
    expectedAgeClaimSource: "ageOver",
    expectedMinimumAge: null,
  },
  {
    name: "malformed policy claims fail closed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-policy-evidence.example.json",
    expectedReason: "invalid_policy_evidence",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType:
      "concordium.VerifiablePresentation",
    expectedRegion: "EU",
    expectedAgeClaim: null,
    expectedAgeClaimSource: null,
    expectedMinimumAge: null,
  },
  {
    name: "unknown policy region fails closed",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-region-not-allowed.example.json",
    expectedReason: "region_not_allowed",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType:
      "concordium.VerifiablePresentation",
    expectedRegion: "APAC",
    expectedAgeClaim: 30,
    expectedAgeClaimSource: "ageOver",
    expectedMinimumAge: null,
  },
  {
    name:
      "agent identity cannot substitute for buyer policy evidence",
    relativePath:
      "fixtures/phase5/agent-delegated-authorization.invalid-missing-policy-evidence.example.json",
    expectedReason: "missing_policy_evidence",
    expectedAuthorizationReason: "accepted",
    expectedAuthorizationAccepted: true,
    expectedAuthorizationBindingEvaluated: true,
    expectedPolicyEvaluated: true,
    expectedPolicyDecision: "deny",
    expectedProofType: null,
    expectedRegion: null,
    expectedAgeClaim: null,
    expectedAgeClaimSource: null,
    expectedMinimumAge: null,
    proveAgentCannotSubstitute: true,
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

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nonEmptyString(
  value: unknown,
): string | null {
  return (
    typeof value === "string" &&
    value.length > 0
  )
    ? value
    : null;
}

function safetyContractSatisfied(
  result: Phase5AgentPolicyEvaluationResult,
): boolean {
  return (
    result.mode === "test_fixture_only" &&
    result.rawProofPrinted === false &&
    result.gatewayCalled === false &&
    result.crpCalled === false &&
    result.paymentAttempted === false &&
    result.receiptJwsPrinted === false &&
    result.paymentResponsePrinted === false &&
    result.protectedResourceReleased === false &&
    result.replayStateMutated === false &&
    result.policyStatePersisted === false &&
    result.productionActivation === false
  );
}

function statusContractSatisfied(
  result: Phase5AgentPolicyEvaluationResult,
): boolean {
  if (result.reason === "policy_satisfied") {
    return (
      result.ok &&
      result.status === "allowed"
    );
  }

  return (
    !result.ok &&
    result.status === "denied"
  );
}

function agentCannotSubstituteSatisfied(
  envelope: JsonRecord,
  fixtureCase: FixtureCase,
  result: Phase5AgentPolicyEvaluationResult,
): boolean {
  if (!fixtureCase.proveAgentCannotSubstitute) {
    return true;
  }

  const agent = isRecord(envelope.agent)
    ? envelope.agent
    : null;
  const buyer = isRecord(envelope.buyer)
    ? envelope.buyer
    : null;

  return (
    nonEmptyString(agent?.agentId) !== null &&
    nonEmptyString(
      buyer?.buyerCommitment,
    ) !== null &&
    nonEmptyString(
      buyer?.policySubject,
    ) !== null &&
    !isRecord(envelope.policyEvidence) &&
    result.authorizationAccepted === true &&
    result.reason ===
      "missing_policy_evidence" &&
    result.policyDecision === "deny"
  );
}

function evaluateFixture(
  fixtureCase: FixtureCase,
): EvaluatedCase {
  const envelope =
    readJson(fixtureCase.relativePath);
  const result = evaluatePhase5AgentPolicy(
    envelope,
    EXPECTED_CONTEXT,
  );

  const ok =
    result.reason === fixtureCase.expectedReason &&
    result.authorizationReason ===
      fixtureCase.expectedAuthorizationReason &&
    result.authorizationAccepted ===
      fixtureCase.expectedAuthorizationAccepted &&
    result.authorizationBindingEvaluated ===
      fixtureCase.expectedAuthorizationBindingEvaluated &&
    result.policyEvaluated ===
      fixtureCase.expectedPolicyEvaluated &&
    result.policyDecision ===
      fixtureCase.expectedPolicyDecision &&
    result.policyProofType ===
      fixtureCase.expectedProofType &&
    result.region ===
      fixtureCase.expectedRegion &&
    result.ageClaim ===
      fixtureCase.expectedAgeClaim &&
    result.ageClaimSource ===
      fixtureCase.expectedAgeClaimSource &&
    result.requiredMinimumAge ===
      fixtureCase.expectedMinimumAge &&
    result.buyerCommitmentPresent === true &&
    result.policySubjectPresent === true &&
    safetyContractSatisfied(result) &&
    statusContractSatisfied(result) &&
    agentCannotSubstituteSatisfied(
      envelope,
      fixtureCase,
      result,
    );

  return {
    name: fixtureCase.name,
    ok,
    expectedReason:
      fixtureCase.expectedReason,
    actualReason: result.reason,
    result,
  };
}

function main(): void {
  const evaluated =
    FIXTURE_CASES.map(evaluateFixture);
  const ok = evaluated.every(
    (fixtureCase) => fixtureCase.ok,
  );

  const summary = {
    ok,
    label:
      "phase5:agent-policy-evaluation-integration-test",
    testOnly: true,
    metadataOnly: true,
    verificationTimeSec:
      EXPECTED_CONTEXT.nowSec,
    policyThresholds: {
      EU: 18,
      US: 21,
      defaultDecision: "deny",
    },
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    replayStateMutated: false,
    policyStatePersisted: false,
    productionActivation: false,
    cases: evaluated.map(
      (fixtureCase) => ({
        name: fixtureCase.name,
        ok: fixtureCase.ok,
        expectedReason:
          fixtureCase.expectedReason,
        actualReason:
          fixtureCase.actualReason,
        status:
          fixtureCase.result.status,
        mode:
          fixtureCase.result.mode,
        authorizationAccepted:
          fixtureCase.result
            .authorizationAccepted,
        authorizationReason:
          fixtureCase.result
            .authorizationReason,
        authorizationBindingEvaluated:
          fixtureCase.result
            .authorizationBindingEvaluated,
        policyEvaluated:
          fixtureCase.result
            .policyEvaluated,
        policyDecision:
          fixtureCase.result
            .policyDecision,
        policyProofType:
          fixtureCase.result
            .policyProofType,
        buyerCommitmentPresent:
          fixtureCase.result
            .buyerCommitmentPresent,
        policySubjectPresent:
          fixtureCase.result
            .policySubjectPresent,
        region:
          fixtureCase.result.region,
        ageClaim:
          fixtureCase.result.ageClaim,
        ageClaimSource:
          fixtureCase.result
            .ageClaimSource,
        requiredMinimumAge:
          fixtureCase.result
            .requiredMinimumAge,
        rawProofPrinted:
          fixtureCase.result
            .rawProofPrinted,
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
