import {
  verifyPhase5AgentDelegationFixture,
  type Phase5AgentDelegationVerifierReason,
} from "./agentDelegationVerifier";

type JsonRecord = Record<string, unknown>;

export type Phase5AgentDelegationBindingVerifierReason =
  | Phase5AgentDelegationVerifierReason
  | "challenge_binding_mismatch"
  | "scope_binding_mismatch"
  | "payment_tuple_binding_mismatch"
  | "challenge_expired"
  | "delegation_expired"
  | "delegation_challenge_window_mismatch";

export type Phase5AgentDelegationBindingContext = {
  readonly nowSec: number;
  readonly challenge: {
    readonly nonce: string;
    readonly challengeHash: string;
    readonly issuedAt?: number;
    readonly expiresAt?: number;
  };
  readonly scope: {
    readonly merchantId: string;
    readonly resourceMethod: string;
    readonly resourcePath: string;
    readonly contractId: string;
    readonly contractVersion: string;
    readonly allowedAction: string;
    readonly maxUses: number;
  };
  readonly paymentTuple: {
    readonly network: string;
    readonly assetType: string;
    readonly tokenId: string;
    readonly decimals: number;
    readonly amount: string;
    readonly payTo: string;
  };
};

export type Phase5AgentDelegationBindingVerifierResult = {
  readonly ok: boolean;
  readonly status: "accepted" | "rejected";
  readonly mode: "test_fixture_only";
  readonly reason: Phase5AgentDelegationBindingVerifierReason;
  readonly basicVerifierReason: Phase5AgentDelegationVerifierReason;
  readonly basicVerifierAccepted: boolean;
  readonly bindingEvaluated: boolean;
  readonly mismatchFields: readonly string[];
  readonly verificationTimeSec: number;
  readonly authorizationProofType: string | null;
  readonly agentId: string | null;
  readonly buyerCommitmentPresent: boolean;
  readonly delegationId: string | null;
  readonly challengeNonce: string | null;
  readonly challengeHash: string | null;
  readonly challengeIssuedAt: number | null;
  readonly challengeExpiresAt: number | null;
  readonly delegationIssuedAt: number | null;
  readonly delegationExpiresAt: number | null;
  readonly challengeBound: boolean;
  readonly scopeBound: boolean;
  readonly paymentTupleBound: boolean;
  readonly challengeExpired: boolean;
  readonly delegationExpired: boolean;
  readonly delegationCoversChallengeWindow: boolean;
  readonly rawProofPrinted: boolean;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly productionActivation: false;
};

type Phase5AgentDelegationBindingSnapshot = {
  readonly challengeNonce: string | null;
  readonly challengeHash: string | null;
  readonly challengeIssuedAt: number | null;
  readonly challengeExpiresAt: number | null;
  readonly delegationIssuedAt: number | null;
  readonly delegationExpiresAt: number | null;
  readonly merchantId: string | null;
  readonly resourceMethod: string | null;
  readonly resourcePath: string | null;
  readonly contractId: string | null;
  readonly contractVersion: string | null;
  readonly allowedAction: string | null;
  readonly maxUses: number | null;
  readonly network: string | null;
  readonly assetType: string | null;
  readonly tokenId: string | null;
  readonly decimals: number | null;
  readonly amount: string | null;
  readonly payTo: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function buildSnapshot(
  envelope: unknown,
): Phase5AgentDelegationBindingSnapshot {
  const root = isRecord(envelope) ? envelope : {};
  const challenge = isRecord(root.challenge)
    ? root.challenge
    : null;
  const delegation = isRecord(root.delegation)
    ? root.delegation
    : null;
  const scope = isRecord(root.scope)
    ? root.scope
    : null;
  const resource = isRecord(scope?.resource)
    ? scope.resource
    : null;
  const asset = isRecord(scope?.asset)
    ? scope.asset
    : null;

  return {
    challengeNonce: stringValue(challenge?.nonce),
    challengeHash: stringValue(challenge?.challengeHash),
    challengeIssuedAt: numberValue(challenge?.issuedAt),
    challengeExpiresAt: numberValue(challenge?.expiresAt),
    delegationIssuedAt: numberValue(
      delegation?.delegationIssuedAt,
    ),
    delegationExpiresAt: numberValue(
      delegation?.delegationExpiresAt,
    ),
    merchantId: stringValue(scope?.merchantId),
    resourceMethod: stringValue(resource?.method),
    resourcePath: stringValue(resource?.path),
    contractId: stringValue(scope?.contractId),
    contractVersion: stringValue(scope?.contractVersion),
    allowedAction: stringValue(scope?.allowedAction),
    maxUses: numberValue(scope?.maxUses),
    network: stringValue(scope?.network),
    assetType: stringValue(asset?.type),
    tokenId: stringValue(asset?.tokenId),
    decimals: numberValue(asset?.decimals),
    amount: stringValue(scope?.amount),
    payTo: stringValue(scope?.payTo),
  };
}

function challengeMismatchFields(
  snapshot: Phase5AgentDelegationBindingSnapshot,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];

  if (snapshot.challengeNonce !== expected.challenge.nonce) {
    fields.push("challenge.nonce");
  }

  if (
    snapshot.challengeHash !==
    expected.challenge.challengeHash
  ) {
    fields.push("challenge.challengeHash");
  }

  if (
    expected.challenge.issuedAt !== undefined &&
    snapshot.challengeIssuedAt !== expected.challenge.issuedAt
  ) {
    fields.push("challenge.issuedAt");
  }

  if (
    expected.challenge.expiresAt !== undefined &&
    snapshot.challengeExpiresAt !== expected.challenge.expiresAt
  ) {
    fields.push("challenge.expiresAt");
  }

  if (snapshot.challengeIssuedAt === null) {
    fields.push("challenge.issuedAt");
  }

  if (snapshot.challengeExpiresAt === null) {
    fields.push("challenge.expiresAt");
  }

  if (
    snapshot.challengeIssuedAt !== null &&
    snapshot.challengeExpiresAt !== null &&
    snapshot.challengeExpiresAt <= snapshot.challengeIssuedAt
  ) {
    if (!fields.includes("challenge.issuedAt")) {
      fields.push("challenge.issuedAt");
    }

    if (!fields.includes("challenge.expiresAt")) {
      fields.push("challenge.expiresAt");
    }
  }

  return fields;
}

function scopeMismatchFields(
  snapshot: Phase5AgentDelegationBindingSnapshot,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];

  if (snapshot.merchantId !== expected.scope.merchantId) {
    fields.push("scope.merchantId");
  }

  if (
    snapshot.resourceMethod !==
    expected.scope.resourceMethod
  ) {
    fields.push("scope.resource.method");
  }

  if (
    snapshot.resourcePath !==
    expected.scope.resourcePath
  ) {
    fields.push("scope.resource.path");
  }

  if (snapshot.contractId !== expected.scope.contractId) {
    fields.push("scope.contractId");
  }

  if (
    snapshot.contractVersion !==
    expected.scope.contractVersion
  ) {
    fields.push("scope.contractVersion");
  }

  if (
    snapshot.allowedAction !==
    expected.scope.allowedAction
  ) {
    fields.push("scope.allowedAction");
  }

  if (snapshot.maxUses !== expected.scope.maxUses) {
    fields.push("scope.maxUses");
  }

  return fields;
}

function paymentTupleMismatchFields(
  snapshot: Phase5AgentDelegationBindingSnapshot,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];

  if (
    snapshot.network !==
    expected.paymentTuple.network
  ) {
    fields.push("scope.network");
  }

  if (
    snapshot.assetType !==
    expected.paymentTuple.assetType
  ) {
    fields.push("scope.asset.type");
  }

  if (
    snapshot.tokenId !==
    expected.paymentTuple.tokenId
  ) {
    fields.push("scope.asset.tokenId");
  }

  if (
    snapshot.decimals !==
    expected.paymentTuple.decimals
  ) {
    fields.push("scope.asset.decimals");
  }

  if (
    snapshot.amount !==
    expected.paymentTuple.amount
  ) {
    fields.push("scope.amount");
  }

  if (
    snapshot.payTo !==
    expected.paymentTuple.payTo
  ) {
    fields.push("scope.payTo");
  }

  return fields;
}

function delegationWindowMismatchFields(
  snapshot: Phase5AgentDelegationBindingSnapshot,
): string[] {
  const fields: string[] = [];

  if (snapshot.delegationIssuedAt === null) {
    fields.push("delegation.delegationIssuedAt");
  }

  if (snapshot.delegationExpiresAt === null) {
    fields.push("delegation.delegationExpiresAt");
  }

  if (
    snapshot.delegationIssuedAt !== null &&
    snapshot.delegationExpiresAt !== null &&
    snapshot.delegationExpiresAt <=
      snapshot.delegationIssuedAt
  ) {
    if (
      !fields.includes(
        "delegation.delegationIssuedAt",
      )
    ) {
      fields.push("delegation.delegationIssuedAt");
    }

    if (
      !fields.includes(
        "delegation.delegationExpiresAt",
      )
    ) {
      fields.push("delegation.delegationExpiresAt");
    }
  }

  if (
    snapshot.delegationIssuedAt !== null &&
    snapshot.challengeIssuedAt !== null &&
    snapshot.delegationIssuedAt >
      snapshot.challengeIssuedAt &&
    !fields.includes(
      "delegation.delegationIssuedAt",
    )
  ) {
    fields.push("delegation.delegationIssuedAt");
  }

  if (
    snapshot.delegationExpiresAt !== null &&
    snapshot.challengeExpiresAt !== null &&
    snapshot.delegationExpiresAt <
      snapshot.challengeExpiresAt &&
    !fields.includes(
      "delegation.delegationExpiresAt",
    )
  ) {
    fields.push("delegation.delegationExpiresAt");
  }

  return fields;
}

function buildResult(
  envelope: unknown,
  expected: Phase5AgentDelegationBindingContext,
  bindingEvaluated: boolean,
  reason: Phase5AgentDelegationBindingVerifierReason,
  mismatchFields: readonly string[],
): Phase5AgentDelegationBindingVerifierResult {
  const basic = verifyPhase5AgentDelegationFixture(envelope);
  const snapshot = buildSnapshot(envelope);

  const challengeFields = challengeMismatchFields(
    snapshot,
    expected,
  );
  const scopeFields = scopeMismatchFields(
    snapshot,
    expected,
  );
  const paymentFields = paymentTupleMismatchFields(
    snapshot,
    expected,
  );
  const windowFields = delegationWindowMismatchFields(
    snapshot,
  );

  const challengeExpired =
    snapshot.challengeExpiresAt !== null &&
    expected.nowSec >= snapshot.challengeExpiresAt;

  const delegationExpired =
    snapshot.delegationExpiresAt !== null &&
    expected.nowSec >= snapshot.delegationExpiresAt;

  return {
    ok: reason === "accepted",
    status:
      reason === "accepted"
        ? "accepted"
        : "rejected",
    mode: "test_fixture_only",
    reason,
    basicVerifierReason: basic.reason,
    basicVerifierAccepted: basic.ok,
    bindingEvaluated,
    mismatchFields: [...mismatchFields],
    verificationTimeSec: expected.nowSec,
    authorizationProofType:
      basic.authorizationProofType,
    agentId: basic.agentId,
    buyerCommitmentPresent:
      basic.buyerCommitmentPresent,
    delegationId: basic.delegationId,
    challengeNonce: snapshot.challengeNonce,
    challengeHash: snapshot.challengeHash,
    challengeIssuedAt: snapshot.challengeIssuedAt,
    challengeExpiresAt: snapshot.challengeExpiresAt,
    delegationIssuedAt: snapshot.delegationIssuedAt,
    delegationExpiresAt: snapshot.delegationExpiresAt,
    challengeBound:
      bindingEvaluated &&
      challengeFields.length === 0,
    scopeBound:
      bindingEvaluated &&
      scopeFields.length === 0,
    paymentTupleBound:
      bindingEvaluated &&
      paymentFields.length === 0,
    challengeExpired:
      bindingEvaluated && challengeExpired,
    delegationExpired:
      bindingEvaluated && delegationExpired,
    delegationCoversChallengeWindow:
      bindingEvaluated &&
      windowFields.length === 0,
    rawProofPrinted: basic.rawProofPrinted,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    productionActivation: false,
  };
}

export function verifyPhase5AgentDelegationBindings(
  envelope: unknown,
  expected: Phase5AgentDelegationBindingContext,
): Phase5AgentDelegationBindingVerifierResult {
  const basic = verifyPhase5AgentDelegationFixture(envelope);

  if (!basic.ok) {
    return buildResult(
      envelope,
      expected,
      false,
      basic.reason,
      [],
    );
  }

  const snapshot = buildSnapshot(envelope);

  const challengeFields = challengeMismatchFields(
    snapshot,
    expected,
  );

  if (challengeFields.length > 0) {
    return buildResult(
      envelope,
      expected,
      true,
      "challenge_binding_mismatch",
      challengeFields,
    );
  }

  const scopeFields = scopeMismatchFields(
    snapshot,
    expected,
  );

  if (scopeFields.length > 0) {
    return buildResult(
      envelope,
      expected,
      true,
      "scope_binding_mismatch",
      scopeFields,
    );
  }

  const paymentFields = paymentTupleMismatchFields(
    snapshot,
    expected,
  );

  if (paymentFields.length > 0) {
    return buildResult(
      envelope,
      expected,
      true,
      "payment_tuple_binding_mismatch",
      paymentFields,
    );
  }

  if (
    snapshot.challengeExpiresAt !== null &&
    expected.nowSec >= snapshot.challengeExpiresAt
  ) {
    return buildResult(
      envelope,
      expected,
      true,
      "challenge_expired",
      [],
    );
  }

  const windowFields = delegationWindowMismatchFields(
    snapshot,
  );

  if (
    snapshot.delegationExpiresAt !== null &&
    expected.nowSec >= snapshot.delegationExpiresAt
  ) {
    return buildResult(
      envelope,
      expected,
      true,
      "delegation_expired",
      [],
    );
  }

  if (windowFields.length > 0) {
    return buildResult(
      envelope,
      expected,
      true,
      "delegation_challenge_window_mismatch",
      windowFields,
    );
  }

  return buildResult(
    envelope,
    expected,
    true,
    "accepted",
    [],
  );
}
