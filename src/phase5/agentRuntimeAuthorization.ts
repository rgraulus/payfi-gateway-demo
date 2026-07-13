import type { LoadedContractDefinition } from "../contracts";
import type {
  CanonicalChallengeBindingRecord,
} from "../db/gatewayPersistence";
import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
} from "../phase3/zkpChallenge";
import { amountToRawUnits } from "../proofPayload";
import {
  PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
} from "./agentDelegationVerifier";
import {
  PHASE5_AGENT_POLICY_DEFAULT_DECISION,
  PHASE5_AGENT_POLICY_THRESHOLDS,
  evaluatePhase5AgentPolicy,
  type Phase5AgentPolicyEvaluationReason,
  type Phase5AgentPolicyEvaluationResult,
} from "./agentPolicyEvaluator";

type JsonRecord = Record<string, unknown>;

export const PHASE5_AGENT_RUNTIME_MODE =
  "controlled_e2e_demo" as const;

export const PHASE5_AGENT_RUNTIME_ALLOWED_ACTION =
  "authorize_payment_and_resource_access" as const;

export const PHASE5_AGENT_RUNTIME_MAX_USES = 1 as const;

export const PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT = {
  policyId: "age-region-v1",
  policyVersion: "1.0.0",
  requirementsHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

export type Phase5AgentRuntimeAuthorizationReason =
  | Phase5AgentPolicyEvaluationReason
  | "canonical_challenge_state_invalid"
  | "canonical_contract_mismatch"
  | "unsupported_contract_policy"
  | "canonical_challenge_construction_failed";

export type Phase5AgentRuntimePersistenceOutcome =
  | "satisfied"
  | "failed"
  | null;

export type Phase5AgentRuntimeAuthorizationResult = {
  readonly ok: boolean;
  readonly status: "allowed" | "denied";
  readonly mode: typeof PHASE5_AGENT_RUNTIME_MODE;
  readonly reason: Phase5AgentRuntimeAuthorizationReason;
  readonly httpStatus: 200 | 403 | 409;
  readonly policyStatus:
    | "POLICY_SATISFIED"
    | "POLICY_FAILED"
    | "POLICY_NOT_EVALUATED";
  readonly shouldPersistPolicyOutcome:
    Phase5AgentRuntimePersistenceOutcome;
  readonly canonicalChallengeAccepted: boolean;
  readonly contractBindingAccepted: boolean;
  readonly canonicalMismatchFields: readonly string[];
  readonly expectedChallengeHash: string | null;
  readonly challengeIssuedAtSec: number | null;
  readonly challengeExpiresAtSec: number | null;
  readonly policyEvaluation:
    Phase5AgentPolicyEvaluationResult | null;
  readonly authorizationProofType:
    string | null;
  readonly authorizationAccepted: boolean;
  readonly authorizationReason: string | null;
  readonly policyEvaluated: boolean;
  readonly policyDecision:
    | "allow"
    | "deny"
    | "not_evaluated";
  readonly rawProofPrinted: boolean;
  readonly cryptographicDelegationVerification: false;
  readonly agentRegistryLookupAttempted: false;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly protectedResourceReleased: false;
  readonly replayStateMutated: false;
  readonly productionActivation: false;
};

export type Phase5AgentRuntimeAuthorizationInput = {
  readonly nonce: string;
  readonly envelope: unknown;
  readonly nowSec: number;
  readonly canonical:
    CanonicalChallengeBindingRecord;
  readonly contract: LoadedContractDefinition;
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

function envelopeAuthorizationProofType(
  envelope: unknown,
): string | null {
  return isRecord(envelope)
    ? nonEmptyString(envelope.authorizationProofType)
    : null;
}

export function isPhase5AgentDelegatedAuthorizationEnvelope(
  envelope: unknown,
): boolean {
  return (
    envelopeAuthorizationProofType(envelope) ===
    PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE
  );
}

function policyHttpStatus(
  policy: Phase5AgentPolicyEvaluationResult,
): 403 | 409 {
  switch (policy.authorizationReason) {
    case "challenge_binding_mismatch":
    case "scope_binding_mismatch":
    case "payment_tuple_binding_mismatch":
    case "delegation_challenge_window_mismatch":
      return 409;
    default:
      return 403;
  }
}

function buildResult(args: {
  envelope: unknown;
  reason: Phase5AgentRuntimeAuthorizationReason;
  httpStatus: 200 | 403 | 409;
  shouldPersistPolicyOutcome:
    Phase5AgentRuntimePersistenceOutcome;
  canonicalChallengeAccepted: boolean;
  contractBindingAccepted: boolean;
  canonicalMismatchFields?: readonly string[];
  expectedChallengeHash?: string | null;
  challengeIssuedAtSec?: number | null;
  challengeExpiresAtSec?: number | null;
  policyEvaluation?: Phase5AgentPolicyEvaluationResult | null;
}): Phase5AgentRuntimeAuthorizationResult {
  const policy = args.policyEvaluation ?? null;
  const allowed =
    args.reason === "policy_satisfied";

  return {
    ok: allowed,
    status: allowed ? "allowed" : "denied",
    mode: PHASE5_AGENT_RUNTIME_MODE,
    reason: args.reason,
    httpStatus: args.httpStatus,
    policyStatus:
      args.shouldPersistPolicyOutcome === null
        ? "POLICY_NOT_EVALUATED"
        : allowed
          ? "POLICY_SATISFIED"
          : "POLICY_FAILED",
    shouldPersistPolicyOutcome:
      args.shouldPersistPolicyOutcome,
    canonicalChallengeAccepted:
      args.canonicalChallengeAccepted,
    contractBindingAccepted:
      args.contractBindingAccepted,
    canonicalMismatchFields: [
      ...(args.canonicalMismatchFields ?? []),
    ],
    expectedChallengeHash:
      args.expectedChallengeHash ?? null,
    challengeIssuedAtSec:
      args.challengeIssuedAtSec ?? null,
    challengeExpiresAtSec:
      args.challengeExpiresAtSec ?? null,
    policyEvaluation: policy,
    authorizationProofType:
      envelopeAuthorizationProofType(args.envelope),
    authorizationAccepted:
      policy?.authorizationAccepted === true,
    authorizationReason:
      policy?.authorizationReason ?? null,
    policyEvaluated:
      policy?.policyEvaluated === true,
    policyDecision:
      policy?.policyDecision ?? "not_evaluated",
    rawProofPrinted:
      policy?.rawProofPrinted === true,
    cryptographicDelegationVerification: false,
    agentRegistryLookupAttempted: false,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,
    replayStateMutated: false,
    productionActivation: false,
  };
}

function canonicalStateMismatchFields(
  input: Phase5AgentRuntimeAuthorizationInput,
): string[] {
  const fields: string[] = [];
  const { canonical } = input;

  if (
    typeof input.nonce !== "string" ||
    input.nonce.length === 0 ||
    canonical.nonce !== input.nonce
  ) {
    fields.push("canonical.nonce");
  }

  if (canonical.status !== "ISSUED") {
    fields.push("canonical.status");
  }

  if (canonical.releaseStatus !== "NOT_RELEASED") {
    fields.push("canonical.releaseStatus");
  }

  if (
    !Number.isInteger(canonical.issuedAtSec) ||
    canonical.issuedAtSec <= 0
  ) {
    fields.push("canonical.issuedAtSec");
  }

  if (
    !Number.isInteger(canonical.expiresAtSec) ||
    canonical.expiresAtSec <=
      canonical.issuedAtSec
  ) {
    fields.push("canonical.expiresAtSec");
  }

  if (
    !Number.isInteger(input.nowSec) ||
    input.nowSec <= 0
  ) {
    fields.push("runtime.nowSec");
  }

  return fields;
}

function contractMismatchFields(
  input: Phase5AgentRuntimeAuthorizationInput,
): string[] {
  const fields: string[] = [];
  const { canonical, contract } = input;

  const canonicalAsset = isRecord(canonical.asset)
    ? canonical.asset
    : null;
  const snapshot = isRecord(canonical.contractSnapshot)
    ? canonical.contractSnapshot
    : null;
  const snapshotResource =
    isRecord(snapshot?.resource)
      ? snapshot.resource
      : null;
  const snapshotAsset =
    isRecord(snapshot?.asset)
      ? snapshot.asset
      : null;

  if (!contract.isFrozen) {
    fields.push("contract.isFrozen");
  }

  if (canonical.merchantId !== contract.merchantId) {
    fields.push("canonical.merchantId");
  }

  if (canonical.contractId !== contract.contractId) {
    fields.push("canonical.contractId");
  }

  if (
    canonical.contractVersion !==
    contract.contractVersion
  ) {
    fields.push("canonical.contractVersion");
  }

  if (canonical.network !== contract.network) {
    fields.push("canonical.network");
  }

  if (canonical.amount !== contract.amount) {
    fields.push("canonical.amount");
  }

  if (canonical.payTo !== contract.payTo) {
    fields.push("canonical.payTo");
  }

  if (
    nonEmptyString(canonicalAsset?.type) !==
    contract.asset.type
  ) {
    fields.push("canonical.asset.type");
  }

  if (
    nonEmptyString(canonicalAsset?.tokenId) !==
    contract.asset.tokenId
  ) {
    fields.push("canonical.asset.tokenId");
  }

  if (
    finiteNumber(canonicalAsset?.decimals) !==
    contract.asset.decimals
  ) {
    fields.push("canonical.asset.decimals");
  }

  if (!snapshot) {
    fields.push("canonical.contractSnapshot");
    return fields;
  }

  if (
    nonEmptyString(snapshot.contractId) !==
    contract.contractId
  ) {
    fields.push("contractSnapshot.contractId");
  }

  if (
    nonEmptyString(snapshot.contractVersion) !==
    contract.contractVersion
  ) {
    fields.push("contractSnapshot.contractVersion");
  }

  if (snapshot.isFrozen !== contract.isFrozen) {
    fields.push("contractSnapshot.isFrozen");
  }

  if (
    nonEmptyString(snapshot.merchantId) !==
    contract.merchantId
  ) {
    fields.push("contractSnapshot.merchantId");
  }

  if (
    nonEmptyString(snapshotResource?.method)?.toUpperCase() !==
    contract.resource.method.toUpperCase()
  ) {
    fields.push("contractSnapshot.resource.method");
  }

  if (
    nonEmptyString(snapshotResource?.path) !==
    contract.resource.path
  ) {
    fields.push("contractSnapshot.resource.path");
  }

  if (
    nonEmptyString(snapshot.network) !==
    contract.network
  ) {
    fields.push("contractSnapshot.network");
  }

  if (
    nonEmptyString(snapshotAsset?.type) !==
    contract.asset.type
  ) {
    fields.push("contractSnapshot.asset.type");
  }

  if (
    nonEmptyString(snapshotAsset?.tokenId) !==
    contract.asset.tokenId
  ) {
    fields.push("contractSnapshot.asset.tokenId");
  }

  if (
    finiteNumber(snapshotAsset?.decimals) !==
    contract.asset.decimals
  ) {
    fields.push("contractSnapshot.asset.decimals");
  }

  if (
    nonEmptyString(snapshot.amount) !==
    contract.amount
  ) {
    fields.push("contractSnapshot.amount");
  }

  if (
    nonEmptyString(snapshot.payTo) !==
    contract.payTo
  ) {
    fields.push("contractSnapshot.payTo");
  }

  return fields;
}

function controlledPolicyMismatchFields(
  input: Phase5AgentRuntimeAuthorizationInput,
): string[] {
  const fields: string[] = [];
  const { contract } = input;

  if (contract.policyRequired !== true) {
    fields.push("contract.policyRequired");
  }

  if (contract.policyVersion !== "v1") {
    fields.push("contract.policyVersion");
  }

  const policy = isRecord(contract.policy)
    ? contract.policy
    : null;

  if (!policy) {
    fields.push("contract.policy");
    return fields;
  }

  if (policy.kind !== "composite") {
    fields.push("contract.policy.kind");
    return fields;
  }

  if (policy.version !== "v1") {
    fields.push("contract.policy.version");
  }

  const rules = Array.isArray(policy.rules)
    ? policy.rules
    : [];

  if (rules.length !== 1) {
    fields.push("contract.policy.rules");
  }

  const rule =
    rules.length === 1 &&
    isRecord(rules[0])
      ? rules[0]
      : null;

  if (!rule) {
    fields.push("contract.policy.rules[0]");
    return fields;
  }

  if (rule.kind !== "age_min_by_region") {
    fields.push(
      "contract.policy.rules[0].kind",
    );
    return fields;
  }

  if (
    rule.regionSource !==
    "policy_evidence"
  ) {
    fields.push(
      "contract.policy.rules[0].regionSource",
    );
  }

  if (
    rule.defaultDecision !==
    PHASE5_AGENT_POLICY_DEFAULT_DECISION
  ) {
    fields.push(
      "contract.policy.rules[0].defaultDecision",
    );
  }

  const thresholds =
    isRecord(rule.thresholds)
      ? rule.thresholds
      : null;

  if (!thresholds) {
    fields.push(
      "contract.policy.rules[0].thresholds",
    );
    return fields;
  }

  const expectedRegions =
    Object.keys(
      PHASE5_AGENT_POLICY_THRESHOLDS,
    ).sort();

  const actualRegions =
    Object.keys(thresholds).sort();

  if (
    expectedRegions.join(",") !==
    actualRegions.join(",")
  ) {
    fields.push(
      "contract.policy.rules[0].thresholds.regions",
    );
  }

  for (
    const region of expectedRegions
  ) {
    if (
      finiteNumber(
        thresholds[region],
      ) !==
      PHASE5_AGENT_POLICY_THRESHOLDS[
        region
      ]
    ) {
      fields.push(
        `contract.policy.rules[0].thresholds.${region}`,
      );
    }
  }

  return fields;
}

export function evaluatePhase5AgentRuntimeAuthorization(
  input: Phase5AgentRuntimeAuthorizationInput,
): Phase5AgentRuntimeAuthorizationResult {
  const stateFields =
    canonicalStateMismatchFields(input);

  if (stateFields.length > 0) {
    return buildResult({
      envelope: input.envelope,
      reason: "canonical_challenge_state_invalid",
      httpStatus: 409,
      shouldPersistPolicyOutcome: null,
      canonicalChallengeAccepted: false,
      contractBindingAccepted: false,
      canonicalMismatchFields: stateFields,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
    });
  }

  const contractFields =
    contractMismatchFields(input);

  if (contractFields.length > 0) {
    return buildResult({
      envelope: input.envelope,
      reason: "canonical_contract_mismatch",
      httpStatus: 409,
      shouldPersistPolicyOutcome: null,
      canonicalChallengeAccepted: true,
      contractBindingAccepted: false,
      canonicalMismatchFields: contractFields,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
    });
  }

  const policyFields =
    controlledPolicyMismatchFields(input);

  if (policyFields.length > 0) {
    return buildResult({
      envelope: input.envelope,
      reason:
        "unsupported_contract_policy",
      httpStatus: 409,
      shouldPersistPolicyOutcome: null,
      canonicalChallengeAccepted: true,
      contractBindingAccepted: false,
      canonicalMismatchFields:
        policyFields,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
    });
  }

  let expectedChallengeHash: string;

  try {
    const expectedChallenge =
      buildX402ZkpChallenge({
        merchantId: input.canonical.merchantId,
        resource: {
          method:
            input.contract.resource.method,
          path:
            input.contract.resource.path,
        },
        contract: {
          contractId:
            input.canonical.contractId,
          contractVersion:
            input.canonical.contractVersion,
          isFrozen:
            input.contract.isFrozen,
        },
        network:
          input.canonical.network,
        chain_id:
          input.contract.chain_id,
        caip2ChainId: null,
        asset: {
          type:
            input.contract.asset.type,
          tokenId:
            input.contract.asset.tokenId,
          decimals:
            input.contract.asset.decimals,
        },
        amount:
          input.canonical.amount,
        amountMinor:
          amountToRawUnits(
            input.canonical.amount,
            input.contract.asset.decimals,
          ),
        payTo:
          input.canonical.payTo,
        nonce:
          input.canonical.nonce,
        issuedAt:
          input.canonical.issuedAtSec,
        expiresAt:
          input.canonical.expiresAtSec,
        policy:
          PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
        businessTerms: null,
        buyer: null,
        agent: null,
      });

    expectedChallengeHash =
      hashX402ZkpChallenge(expectedChallenge);
  } catch {
    return buildResult({
      envelope: input.envelope,
      reason:
        "canonical_challenge_construction_failed",
      httpStatus: 409,
      shouldPersistPolicyOutcome: null,
      canonicalChallengeAccepted: false,
      contractBindingAccepted: true,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
    });
  }

  const policy = evaluatePhase5AgentPolicy(
    input.envelope,
    {
      nowSec: input.nowSec,
      challenge: {
        nonce:
          input.canonical.nonce,
        challengeHash:
          expectedChallengeHash,
        issuedAt:
          input.canonical.issuedAtSec,
        expiresAt:
          input.canonical.expiresAtSec,
      },
      scope: {
        merchantId:
          input.canonical.merchantId,
        resourceMethod:
          input.contract.resource.method.toUpperCase(),
        resourcePath:
          input.contract.resource.path,
        contractId:
          input.canonical.contractId,
        contractVersion:
          input.canonical.contractVersion,
        allowedAction:
          PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
      paymentTuple: {
        network:
          input.canonical.network,
        assetType:
          input.contract.asset.type,
        tokenId:
          input.contract.asset.tokenId,
        decimals:
          input.contract.asset.decimals,
        amount:
          input.canonical.amount,
        payTo:
          input.canonical.payTo,
      },
    },
  );

  if (!policy.ok) {
    return buildResult({
      envelope: input.envelope,
      reason: policy.reason,
      httpStatus: policyHttpStatus(policy),
      shouldPersistPolicyOutcome: "failed",
      canonicalChallengeAccepted: true,
      contractBindingAccepted: true,
      expectedChallengeHash,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
      policyEvaluation: policy,
    });
  }

  return buildResult({
    envelope: input.envelope,
    reason: "policy_satisfied",
    httpStatus: 200,
    shouldPersistPolicyOutcome: "satisfied",
    canonicalChallengeAccepted: true,
    contractBindingAccepted: true,
    expectedChallengeHash,
    challengeIssuedAtSec:
      input.canonical.issuedAtSec,
    challengeExpiresAtSec:
      input.canonical.expiresAtSec,
    policyEvaluation: policy,
  });
}
