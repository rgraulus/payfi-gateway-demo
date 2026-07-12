import {
  verifyPhase5AgentDelegationBindings,
  type Phase5AgentDelegationBindingContext,
  type Phase5AgentDelegationBindingVerifierReason,
} from "./phase5_agent_delegation_binding_verifier";

type JsonRecord = Record<string, unknown>;

export type Phase5AgentPolicyEvaluationReason =
  | "policy_satisfied"
  | "authorization_binding_rejected"
  | "missing_policy_evidence"
  | "unsupported_policy_evidence_type"
  | "invalid_policy_evidence"
  | "region_not_allowed"
  | "age_requirement_not_met";

export type Phase5AgentPolicyDecision =
  | "allow"
  | "deny"
  | "not_evaluated";

export type Phase5AgentPolicyEvaluationResult = {
  readonly ok: boolean;
  readonly status: "allowed" | "denied";
  readonly mode: "test_fixture_only";
  readonly reason: Phase5AgentPolicyEvaluationReason;
  readonly authorizationAccepted: boolean;
  readonly authorizationReason:
    Phase5AgentDelegationBindingVerifierReason;
  readonly authorizationBindingEvaluated: boolean;
  readonly policyEvaluated: boolean;
  readonly policyDecision: Phase5AgentPolicyDecision;
  readonly policyProofType: string | null;
  readonly buyerCommitmentPresent: boolean;
  readonly policySubjectPresent: boolean;
  readonly region: string | null;
  readonly ageClaim: number | null;
  readonly ageClaimSource:
    | "ageOver"
    | "ageAtLeast"
    | null;
  readonly requiredMinimumAge: number | null;
  readonly rawProofPrinted: boolean;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly protectedResourceReleased: false;
  readonly replayStateMutated: false;
  readonly policyStatePersisted: false;
  readonly productionActivation: false;
};

const SUPPORTED_POLICY_PROOF_TYPE =
  "concordium.VerifiablePresentation";

const AGE_THRESHOLDS: Readonly<Record<string, number>> = {
  EU: 18,
  US: 21,
};

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nonEmptyString(value: unknown): string | null {
  return (
    typeof value === "string" &&
    value.length > 0
  )
    ? value
    : null;
}

function finiteNumber(value: unknown): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

export function evaluatePhase5AgentPolicy(
  envelope: unknown,
  expectedContext: Phase5AgentDelegationBindingContext,
): Phase5AgentPolicyEvaluationResult {
  const authorization =
    verifyPhase5AgentDelegationBindings(
      envelope,
      expectedContext,
    );

  const root = isRecord(envelope) ? envelope : {};
  const buyer = isRecord(root.buyer)
    ? root.buyer
    : null;
  const policyEvidence = isRecord(root.policyEvidence)
    ? root.policyEvidence
    : null;
  const claims = isRecord(policyEvidence?.claims)
    ? policyEvidence.claims
    : null;

  const policyProofType =
    nonEmptyString(policyEvidence?.proofType);
  const region = nonEmptyString(claims?.region);

  const ageOver = finiteNumber(claims?.ageOver);
  const ageAtLeast =
    finiteNumber(claims?.ageAtLeast);
  const ageClaim =
    ageOver !== null
      ? ageOver
      : ageAtLeast;
  const ageClaimSource =
    ageOver !== null
      ? "ageOver" as const
      : ageAtLeast !== null
        ? "ageAtLeast" as const
        : null;

  const buyerCommitmentPresent =
    nonEmptyString(buyer?.buyerCommitment) !== null;
  const policySubjectPresent =
    nonEmptyString(buyer?.policySubject) !== null;
  const rawProofPrinted =
    policyEvidence?.rawProofPrinted === true;

  const buildResult = (
    reason: Phase5AgentPolicyEvaluationReason,
    policyEvaluated: boolean,
    policyDecision: Phase5AgentPolicyDecision,
    requiredMinimumAge: number | null,
  ): Phase5AgentPolicyEvaluationResult => ({
    ok: reason === "policy_satisfied",
    status:
      reason === "policy_satisfied"
        ? "allowed"
        : "denied",
    mode: "test_fixture_only",
    reason,
    authorizationAccepted: authorization.ok,
    authorizationReason: authorization.reason,
    authorizationBindingEvaluated:
      authorization.bindingEvaluated,
    policyEvaluated,
    policyDecision,
    policyProofType,
    buyerCommitmentPresent,
    policySubjectPresent,
    region,
    ageClaim,
    ageClaimSource,
    requiredMinimumAge,
    rawProofPrinted,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    replayStateMutated: false,
    policyStatePersisted: false,
    productionActivation: false,
  });

  if (!authorization.ok) {
    return buildResult(
      "authorization_binding_rejected",
      false,
      "not_evaluated",
      null,
    );
  }

  if (!policyEvidence) {
    return buildResult(
      "missing_policy_evidence",
      true,
      "deny",
      null,
    );
  }

  if (policyProofType === null) {
    return buildResult(
      "invalid_policy_evidence",
      true,
      "deny",
      null,
    );
  }

  if (
    policyProofType !==
    SUPPORTED_POLICY_PROOF_TYPE
  ) {
    return buildResult(
      "unsupported_policy_evidence_type",
      true,
      "deny",
      null,
    );
  }

  if (
    policyEvidence.rawProofPrinted !== false ||
    !claims ||
    region === null ||
    ageClaim === null
  ) {
    return buildResult(
      "invalid_policy_evidence",
      true,
      "deny",
      null,
    );
  }

  const requiredMinimumAge =
    AGE_THRESHOLDS[region];

  if (requiredMinimumAge === undefined) {
    return buildResult(
      "region_not_allowed",
      true,
      "deny",
      null,
    );
  }

  if (ageClaim < requiredMinimumAge) {
    return buildResult(
      "age_requirement_not_met",
      true,
      "deny",
      requiredMinimumAge,
    );
  }

  return buildResult(
    "policy_satisfied",
    true,
    "allow",
    requiredMinimumAge,
  );
}
