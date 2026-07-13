type JsonRecord = Record<string, unknown>;

export const PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE =
  "xcf.concordium.authorization.agent-delegated.v1" as const;

export type Phase5AgentDelegationVerifierMode = "test_fixture_only";

export type Phase5AgentDelegationVerifierStatus =
  | "accepted"
  | "rejected";

export type Phase5AgentDelegationVerifierReason =
  | "accepted"
  | "unsupported_authorization_proof_type"
  | "missing_agent_identity"
  | "missing_buyer_binding"
  | "missing_delegation"
  | "delegation_proof_not_present"
  | "delegation_proof_must_not_be_printed";

export type Phase5AgentDelegationVerifierResult = {
  readonly ok: boolean;
  readonly status: Phase5AgentDelegationVerifierStatus;
  readonly mode: Phase5AgentDelegationVerifierMode;
  readonly reason: Phase5AgentDelegationVerifierReason;
  readonly authorizationProofType: string | null;
  readonly agentId: string | null;
  readonly buyerCommitmentPresent: boolean;
  readonly delegationId: string | null;
  readonly delegationProofPresent: boolean;
  readonly delegationProofPrinted: boolean;
  readonly rawProofPrinted: boolean;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly productionActivation: false;
};

type Phase5AgentDelegationAuditSnapshot = {
  readonly authorizationProofType: string | null;
  readonly agentId: string | null;
  readonly buyerCommitmentPresent: boolean;
  readonly delegationPresent: boolean;
  readonly delegationId: string | null;
  readonly delegationProofPresent: boolean;
  readonly delegationProofPrinted: boolean;
  readonly rawProofPrinted: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildAuditSnapshot(
  envelope: unknown,
): Phase5AgentDelegationAuditSnapshot {
  const root = isRecord(envelope) ? envelope : {};
  const agent = isRecord(root.agent) ? root.agent : null;
  const buyer = isRecord(root.buyer) ? root.buyer : null;
  const delegation = isRecord(root.delegation) ? root.delegation : null;
  const policyEvidence = isRecord(root.policyEvidence)
    ? root.policyEvidence
    : null;

  return {
    authorizationProofType: nonEmptyString(root.authorizationProofType),
    agentId: nonEmptyString(agent?.agentId),
    buyerCommitmentPresent:
      nonEmptyString(buyer?.buyerCommitment) !== null,
    delegationPresent: delegation !== null,
    delegationId: nonEmptyString(delegation?.delegationId),
    delegationProofPresent:
      delegation?.delegationProofPresent === true,
    delegationProofPrinted:
      delegation?.delegationProofPrinted === true,
    rawProofPrinted:
      policyEvidence?.rawProofPrinted === true,
  };
}

function result(
  snapshot: Phase5AgentDelegationAuditSnapshot,
  ok: boolean,
  reason: Phase5AgentDelegationVerifierReason,
): Phase5AgentDelegationVerifierResult {
  return {
    ok,
    status: ok ? "accepted" : "rejected",
    mode: "test_fixture_only",
    reason,
    authorizationProofType: snapshot.authorizationProofType,
    agentId: snapshot.agentId,
    buyerCommitmentPresent: snapshot.buyerCommitmentPresent,
    delegationId: snapshot.delegationId,
    delegationProofPresent: snapshot.delegationProofPresent,
    delegationProofPrinted: snapshot.delegationProofPrinted,
    rawProofPrinted: snapshot.rawProofPrinted,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    productionActivation: false,
  };
}

export function verifyPhase5AgentDelegationFixture(
  envelope: unknown,
): Phase5AgentDelegationVerifierResult {
  const snapshot = buildAuditSnapshot(envelope);

  if (
    snapshot.authorizationProofType !==
    PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE
  ) {
    return result(
      snapshot,
      false,
      "unsupported_authorization_proof_type",
    );
  }

  if (snapshot.agentId === null) {
    return result(snapshot, false, "missing_agent_identity");
  }

  if (!snapshot.buyerCommitmentPresent) {
    return result(snapshot, false, "missing_buyer_binding");
  }

  if (
    !snapshot.delegationPresent ||
    snapshot.delegationId === null
  ) {
    return result(snapshot, false, "missing_delegation");
  }

  if (!snapshot.delegationProofPresent) {
    return result(snapshot, false, "delegation_proof_not_present");
  }

  if (snapshot.delegationProofPrinted) {
    return result(
      snapshot,
      false,
      "delegation_proof_must_not_be_printed",
    );
  }

  return result(snapshot, true, "accepted");
}
