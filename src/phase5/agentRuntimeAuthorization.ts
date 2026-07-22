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
  verifyAgentProofOfPossession,
  type AgentProofOfPossessionReasonCode,
  type AgentProofOfPossessionVerificationResult,
} from "./agentProofOfPossessionVerifier";
import {
  PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,
  verifyPhase5AgentCryptographicDelegationBindings,
  type Phase5AgentCryptographicBindingReason,
  type Phase5AgentCryptographicBindingResult,
} from "./agentCryptographicDelegationBindingVerifier";
import {
  verifyPhase5AgentDelegationBindings,
  type Phase5AgentDelegationBindingContext,
} from "./agentDelegationBindingVerifier";
import type {
  BuyerDelegationVerificationKey,
} from "./buyerDelegationSignatureVerifier";
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

export type Phase5AgentRuntimeLifecycleFailureReason =
  | "invalid_lifecycle_input"
  | "invalid_lifecycle_contract"
  | "lifecycle_contract_mismatch"
  | "delegation_not_yet_valid"
  | "delegation_expired"
  | "delegation_revoked"
  | "revocation_record_mismatch"
  | "delegation_use_exhausted"
  | "usage_contract_mismatch"
  | "claim_conflict"
  | "claim_state_inconsistent"
  | "challenge_missing"
  | "challenge_state_conflict"
  | "invalid_lifecycle_claim";

export type Phase5AgentRuntimeAuthorizationReason =
  | Phase5AgentPolicyEvaluationReason
  | Phase5AgentRuntimeLifecycleFailureReason
  | AgentProofOfPossessionReasonCode
  | Phase5AgentCryptographicBindingReason
  | "canonical_challenge_state_invalid"
  | "canonical_contract_mismatch"
  | "unsupported_contract_policy"
  | "canonical_challenge_construction_failed"
  | "missing_cryptographic_delegation_bundle";

export type Phase5AgentRuntimePersistenceOutcome =
  | "satisfied"
  | "failed"
  | null;

export type Phase5AgentRuntimeLifecycleSignals = {
  readonly currentAuthorizationEstablished:
    boolean;

  readonly validityEvaluatedAgainstClock:
    boolean;

  readonly revocationChecked:
    boolean;

  readonly boundedUseConsumed:
    boolean;
};

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

  readonly cryptographicDelegationVerification:
    boolean;

  readonly delegationContractValidated:
    boolean;

  readonly buyerSignatureVerified:
    boolean;

  readonly agentPublicKeyBoundByBuyerSignature:
    boolean;

  readonly agentProofOfPossessionVerified:
    boolean;

  readonly verifiedDelegationDocumentMatched:
    boolean;

  readonly outerDelegationIdentityBound:
    boolean;

  readonly buyerPolicySubjectBound:
    boolean;

  readonly signedScopeBound:
    boolean;

  readonly signedPaymentTupleBound:
    boolean;

  readonly credentialValidityCoversChallenge:
    boolean;

  readonly signedUsageBound:
    boolean;

  readonly signedReplayBound:
    boolean;

  readonly cryptographicAuthorizationReason:
    string | null;

  readonly cryptographicBindingReason:
    string | null;

  readonly cryptographicMismatchFields:
    readonly string[];

  readonly buyerVerificationKeyTrustEstablished:
    false;

  readonly buyerIdentityAuthenticated:
    false;

  readonly buyerKeyOwnershipEstablished:
    false;

  readonly agentIdentityAuthenticated:
    false;

  readonly agentKeyTrustEstablished:
    false;

  readonly currentAuthorizationEstablished:
    boolean;

  readonly validityEvaluatedAgainstClock:
    boolean;

  readonly revocationChecked:
    boolean;

  readonly boundedUseConsumed:
    boolean;

  readonly challengeReplayStateMutated:
    false;

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
  /**
   * Allows a cryptographically verified, lifecycle-controlled
   * retry to reach the atomic existing-claim check after the
   * canonical challenge is already POLICY_SATISFIED.
   *
   * Omitted or false for every ordinary authorization path.
   */
  readonly allowSatisfiedChallengeRetry?:
    boolean;

  readonly canonical:
    CanonicalChallengeBindingRecord;
  readonly contract: LoadedContractDefinition;

  readonly cryptographicDelegation?: {
    readonly enabled: boolean;

    readonly buyerVerificationKey:
      BuyerDelegationVerificationKey | null;

    readonly expectedAudience?: string;
  };
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

type Phase5AgentCryptographicProofBundle = {
  readonly delegationDocument: unknown;
  readonly proofDocument: unknown;
};

function cryptographicProofBundle(
  envelope: unknown,
): Phase5AgentCryptographicProofBundle | null {
  const root =
    isRecord(envelope)
      ? envelope
      : null;

  const proofs =
    isRecord(root?.cryptographicProofs)
      ? root.cryptographicProofs
      : null;

  if (
    !proofs ||
    proofs.delegationCredential === undefined ||
    proofs.delegationCredential === null ||
    proofs.agentProofOfPossession === undefined ||
    proofs.agentProofOfPossession === null
  ) {
    return null;
  }

  return {
    delegationDocument:
      proofs.delegationCredential,

    proofDocument:
      proofs.agentProofOfPossession,
  };
}

function cryptographicHttpStatus(
  reason: string,
): 403 | 409 {
  if (
    reason ===
      "challenge_binding_mismatch" ||
    reason ===
      "scope_binding_mismatch" ||
    reason ===
      "payment_tuple_binding_mismatch" ||
    reason ===
      "delegation_challenge_window_mismatch" ||
    reason.startsWith(
      "agent_challenge_",
    ) ||
    reason ===
      "verified_delegation_document_mismatch" ||
    reason ===
      "outer_delegation_identity_mismatch" ||
    reason ===
      "signed_delegation_scope_mismatch" ||
    reason ===
      "signed_delegation_payment_tuple_mismatch" ||
    reason ===
      "signed_delegation_validity_mismatch" ||
    reason ===
      "signed_delegation_usage_mismatch" ||
    reason ===
      "signed_delegation_replay_mismatch"
  ) {
    return 409;
  }

  return 403;
}

function buildExpectedBindingContext(
  input: Phase5AgentRuntimeAuthorizationInput,
  expectedChallengeHash: string,
): Phase5AgentDelegationBindingContext {
  return {
    nowSec:
      input.nowSec,

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
        input.contract
          .resource
          .method
          .toUpperCase(),

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
  };
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

  reason:
    Phase5AgentRuntimeAuthorizationReason;

  httpStatus:
    200 | 403 | 409;

  shouldPersistPolicyOutcome:
    Phase5AgentRuntimePersistenceOutcome;

  canonicalChallengeAccepted:
    boolean;

  contractBindingAccepted:
    boolean;

  canonicalMismatchFields?:
    readonly string[];

  expectedChallengeHash?:
    string | null;

  challengeIssuedAtSec?:
    number | null;

  challengeExpiresAtSec?:
    number | null;

  policyEvaluation?:
    Phase5AgentPolicyEvaluationResult | null;

  authorizationAccepted?:
    boolean;

  authorizationReason?:
    string | null;

  lifecycleSignals?:
    Phase5AgentRuntimeLifecycleSignals
    | null;

  proofVerification?:
    AgentProofOfPossessionVerificationResult
    | null;

  cryptographicBinding?:
    Phase5AgentCryptographicBindingResult
    | null;
}): Phase5AgentRuntimeAuthorizationResult {
  const policy =
    args.policyEvaluation ?? null;

  const proofVerification =
    args.proofVerification ?? null;

  const cryptographicBinding =
    args.cryptographicBinding ?? null;

  const lifecycleSignals =
    args.lifecycleSignals ?? null;

  const allowed =
    args.reason === "policy_satisfied";

  return {
    ok:
      allowed,

    status:
      allowed
        ? "allowed"
        : "denied",

    mode:
      PHASE5_AGENT_RUNTIME_MODE,

    reason:
      args.reason,

    httpStatus:
      args.httpStatus,

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

    policyEvaluation:
      policy,

    authorizationProofType:
      envelopeAuthorizationProofType(
        args.envelope,
      ),

    authorizationAccepted:
      args.authorizationAccepted ??
      (
        policy?.authorizationAccepted ===
        true
      ),

    authorizationReason:
      args.authorizationReason ??
      policy?.authorizationReason ??
      null,

    policyEvaluated:
      policy?.policyEvaluated === true,

    policyDecision:
      policy?.policyDecision ??
      "not_evaluated",

    rawProofPrinted:
      policy?.rawProofPrinted === true,

    cryptographicDelegationVerification:
      cryptographicBinding
        ?.cryptographicDelegationVerification ===
      true,

    delegationContractValidated:
      proofVerification
        ?.delegationContractValidated ===
      true,

    buyerSignatureVerified:
      proofVerification
        ?.buyerSignatureVerified ===
      true,

    agentPublicKeyBoundByBuyerSignature:
      proofVerification
        ?.agentPublicKeyBoundByBuyerSignature ===
      true,

    agentProofOfPossessionVerified:
      proofVerification
        ?.agentProofOfPossessionVerified ===
      true,

    verifiedDelegationDocumentMatched:
      cryptographicBinding
        ?.verifiedDelegationDocumentMatched ===
      true,

    outerDelegationIdentityBound:
      cryptographicBinding
        ?.outerDelegationIdentityBound ===
      true,

    buyerPolicySubjectBound:
      cryptographicBinding
        ?.buyerPolicySubjectBound ===
      true,

    signedScopeBound:
      cryptographicBinding
        ?.signedScopeBound ===
      true,

    signedPaymentTupleBound:
      cryptographicBinding
        ?.signedPaymentTupleBound ===
      true,

    credentialValidityCoversChallenge:
      cryptographicBinding
        ?.credentialValidityCoversChallenge ===
      true,

    signedUsageBound:
      cryptographicBinding
        ?.signedUsageBound ===
      true,

    signedReplayBound:
      cryptographicBinding
        ?.signedReplayBound ===
      true,

    cryptographicAuthorizationReason:
      proofVerification?.reason ?? null,

    cryptographicBindingReason:
      cryptographicBinding?.reason ?? null,

    cryptographicMismatchFields: [
      ...(
        cryptographicBinding
          ?.mismatchFields ??
        []
      ),
    ],

    buyerVerificationKeyTrustEstablished:
      false,

    buyerIdentityAuthenticated:
      false,

    buyerKeyOwnershipEstablished:
      false,

    agentIdentityAuthenticated:
      false,

    agentKeyTrustEstablished:
      false,

    currentAuthorizationEstablished:
      lifecycleSignals
        ?.currentAuthorizationEstablished ===
      true,

    validityEvaluatedAgainstClock:
      lifecycleSignals
        ?.validityEvaluatedAgainstClock ===
      true,

    revocationChecked:
      lifecycleSignals
        ?.revocationChecked ===
      true,

    boundedUseConsumed:
      lifecycleSignals
        ?.boundedUseConsumed ===
      true,

    challengeReplayStateMutated:
      false,

    agentRegistryLookupAttempted:
      false,

    gatewayCalled:
      false,

    crpCalled:
      false,

    paymentAttempted:
      false,

    receiptJwsPrinted:
      false,

    paymentResponsePrinted:
      false,

    protectedResourceReleased:
      false,

    replayStateMutated:
      false,

    productionActivation:
      false,
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

  const canonicalStatusAccepted =
    canonical.status === "ISSUED" ||
    (
      input.allowSatisfiedChallengeRetry ===
        true &&
      canonical.status ===
        "POLICY_SATISFIED"
    );

  if (!canonicalStatusAccepted) {
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

export type Phase5AgentRuntimeCryptographicPreflightResult =
  | {
      readonly ok: false;

      readonly result:
        Phase5AgentRuntimeAuthorizationResult;
    }
  | {
      readonly ok: true;

      readonly expectedChallengeHash:
        string;

      readonly expectedContext:
        Phase5AgentDelegationBindingContext;

      readonly proofVerification:
        AgentProofOfPossessionVerificationResult
        | null;

      readonly cryptographicBinding:
        Phase5AgentCryptographicBindingResult
        | null;

      readonly delegationDocument:
        unknown | null;
    };

export function evaluatePhase5AgentRuntimeCryptographicPreflight(
  input:
    Phase5AgentRuntimeAuthorizationInput,
): Phase5AgentRuntimeCryptographicPreflightResult {
  const stateFields =
    canonicalStateMismatchFields(input);

  if (stateFields.length > 0) {
    return {
      ok: false,

      result: buildResult({
        envelope: input.envelope,
        reason:
          "canonical_challenge_state_invalid",
        httpStatus: 409,
        shouldPersistPolicyOutcome: null,
        canonicalChallengeAccepted: false,
        contractBindingAccepted: false,
        canonicalMismatchFields:
          stateFields,
        challengeIssuedAtSec:
          input.canonical.issuedAtSec,
        challengeExpiresAtSec:
          input.canonical.expiresAtSec,
      }),
    };
  }

  const contractFields =
    contractMismatchFields(input);

  if (contractFields.length > 0) {
    return {
      ok: false,

      result: buildResult({
        envelope: input.envelope,
        reason:
          "canonical_contract_mismatch",
        httpStatus: 409,
        shouldPersistPolicyOutcome: null,
        canonicalChallengeAccepted: true,
        contractBindingAccepted: false,
        canonicalMismatchFields:
          contractFields,
        challengeIssuedAtSec:
          input.canonical.issuedAtSec,
        challengeExpiresAtSec:
          input.canonical.expiresAtSec,
      }),
    };
  }

  const policyFields =
    controlledPolicyMismatchFields(input);

  if (policyFields.length > 0) {
    return {
      ok: false,

      result: buildResult({
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
      }),
    };
  }

  let expectedChallengeHash: string;

  try {
    const expectedChallenge =
      buildX402ZkpChallenge({
        merchantId:
          input.canonical.merchantId,

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
      hashX402ZkpChallenge(
        expectedChallenge,
      );
  } catch {
    return {
      ok: false,

      result: buildResult({
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
      }),
    };
  }

  const expectedContext =
    buildExpectedBindingContext(
      input,
      expectedChallengeHash,
    );

  let proofVerification:
    AgentProofOfPossessionVerificationResult
    | null = null;

  let cryptographicBinding:
    Phase5AgentCryptographicBindingResult
    | null = null;

  let delegationDocument:
    unknown | null = null;

  if (
    input.cryptographicDelegation
      ?.enabled === true
  ) {
    const structuralAuthorization =
      verifyPhase5AgentDelegationBindings(
        input.envelope,
        expectedContext,
      );

    if (!structuralAuthorization.ok) {
      return {
        ok: false,

        result: buildResult({
          envelope:
            input.envelope,

          reason:
            "authorization_binding_rejected",

          httpStatus:
            cryptographicHttpStatus(
              structuralAuthorization.reason,
            ),

          shouldPersistPolicyOutcome:
            "failed",

          canonicalChallengeAccepted:
            true,

          contractBindingAccepted:
            true,

          expectedChallengeHash,

          challengeIssuedAtSec:
            input.canonical.issuedAtSec,

          challengeExpiresAtSec:
            input.canonical.expiresAtSec,

          authorizationAccepted:
            false,

          authorizationReason:
            structuralAuthorization.reason,
        }),
      };
    }

    const bundle =
      cryptographicProofBundle(
        input.envelope,
      );

    if (bundle === null) {
      return {
        ok: false,

        result: buildResult({
          envelope:
            input.envelope,

          reason:
            "missing_cryptographic_delegation_bundle",

          httpStatus: 403,

          shouldPersistPolicyOutcome:
            "failed",

          canonicalChallengeAccepted:
            true,

          contractBindingAccepted:
            true,

          expectedChallengeHash,

          challengeIssuedAtSec:
            input.canonical.issuedAtSec,

          challengeExpiresAtSec:
            input.canonical.expiresAtSec,

          authorizationAccepted:
            false,

          authorizationReason:
            "missing_cryptographic_delegation_bundle",
        }),
      };
    }

    delegationDocument =
      bundle.delegationDocument;

    proofVerification =
      verifyAgentProofOfPossession({
        delegationDocument:
          bundle.delegationDocument,

        buyerVerificationKey:
          input
            .cryptographicDelegation
            .buyerVerificationKey,

        proofDocument:
          bundle.proofDocument,

        expectedChallenge: {
          nonce:
            input.canonical.nonce,

          challengeHash:
            expectedChallengeHash,

          issuedAt:
            input.canonical.issuedAtSec,

          expiresAt:
            input.canonical.expiresAtSec,
        },
      });

    if (!proofVerification.ok) {
      return {
        ok: false,

        result: buildResult({
          envelope:
            input.envelope,

          reason:
            proofVerification.reason,

          httpStatus:
            cryptographicHttpStatus(
              proofVerification.reason,
            ),

          shouldPersistPolicyOutcome:
            "failed",

          canonicalChallengeAccepted:
            true,

          contractBindingAccepted:
            true,

          expectedChallengeHash,

          challengeIssuedAtSec:
            input.canonical.issuedAtSec,

          challengeExpiresAtSec:
            input.canonical.expiresAtSec,

          authorizationAccepted:
            false,

          authorizationReason:
            proofVerification.reason,

          proofVerification,
        }),
      };
    }

    cryptographicBinding =
      verifyPhase5AgentCryptographicDelegationBindings({
        outerEnvelope:
          input.envelope,

        delegationDocument:
          bundle.delegationDocument,

        proofVerification,

        expectedContext,

        expectedAudience:
          input
            .cryptographicDelegation
            .expectedAudience ??
          PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,
      });

    if (!cryptographicBinding.ok) {
      return {
        ok: false,

        result: buildResult({
          envelope:
            input.envelope,

          reason:
            cryptographicBinding.reason,

          httpStatus:
            cryptographicHttpStatus(
              cryptographicBinding.reason,
            ),

          shouldPersistPolicyOutcome:
            "failed",

          canonicalChallengeAccepted:
            true,

          contractBindingAccepted:
            true,

          expectedChallengeHash,

          challengeIssuedAtSec:
            input.canonical.issuedAtSec,

          challengeExpiresAtSec:
            input.canonical.expiresAtSec,

          authorizationAccepted:
            false,

          authorizationReason:
            cryptographicBinding.reason,

          proofVerification,

          cryptographicBinding,
        }),
      };
    }
  }

  return {
    ok: true,

    expectedChallengeHash,
    expectedContext,

    proofVerification,
    cryptographicBinding,

    delegationDocument,
  };
}

export function completePhase5AgentRuntimePolicyEvaluation(
  input:
    Phase5AgentRuntimeAuthorizationInput,

  preflight:
    Phase5AgentRuntimeCryptographicPreflightResult,
): Phase5AgentRuntimeAuthorizationResult {
  if (!preflight.ok) {
    return preflight.result;
  }

  const policy =
    evaluatePhase5AgentPolicy(
      input.envelope,
      preflight.expectedContext,
    );

  if (!policy.ok) {
    return buildResult({
      envelope: input.envelope,
      reason: policy.reason,
      httpStatus:
        policyHttpStatus(policy),
      shouldPersistPolicyOutcome:
        "failed",
      canonicalChallengeAccepted: true,
      contractBindingAccepted: true,
      expectedChallengeHash:
        preflight.expectedChallengeHash,
      challengeIssuedAtSec:
        input.canonical.issuedAtSec,
      challengeExpiresAtSec:
        input.canonical.expiresAtSec,
      policyEvaluation: policy,
      proofVerification:
        preflight.proofVerification,
      cryptographicBinding:
        preflight.cryptographicBinding,
    });
  }

  return buildResult({
    envelope: input.envelope,
    reason: "policy_satisfied",
    httpStatus: 200,
    shouldPersistPolicyOutcome:
      "satisfied",
    canonicalChallengeAccepted: true,
    contractBindingAccepted: true,
    expectedChallengeHash:
      preflight.expectedChallengeHash,
    challengeIssuedAtSec:
      input.canonical.issuedAtSec,
    challengeExpiresAtSec:
      input.canonical.expiresAtSec,
    policyEvaluation: policy,
    proofVerification:
      preflight.proofVerification,
    cryptographicBinding:
      preflight.cryptographicBinding,
  });
}

function lifecycleFailureHttpStatus(
  reason:
    Phase5AgentRuntimeLifecycleFailureReason,
): 403 | 409 {
  switch (reason) {
    case "lifecycle_contract_mismatch":
    case "revocation_record_mismatch":
    case "usage_contract_mismatch":
    case "claim_conflict":
    case "claim_state_inconsistent":
    case "challenge_missing":
    case "challenge_state_conflict":
      return 409;

    default:
      return 403;
  }
}

export function applyPhase5AgentRuntimeLifecycleSignals(
  result:
    Phase5AgentRuntimeAuthorizationResult,

  lifecycleSignals:
    Phase5AgentRuntimeLifecycleSignals,
): Phase5AgentRuntimeAuthorizationResult {
  return {
    ...result,

    currentAuthorizationEstablished:
      lifecycleSignals
        .currentAuthorizationEstablished,

    validityEvaluatedAgainstClock:
      lifecycleSignals
        .validityEvaluatedAgainstClock,

    revocationChecked:
      lifecycleSignals
        .revocationChecked,

    boundedUseConsumed:
      lifecycleSignals
        .boundedUseConsumed,
  };
}

export function buildPhase5AgentRuntimeLifecycleFailure(
  args: {
    readonly input:
      Phase5AgentRuntimeAuthorizationInput;

    readonly preflight:
      Extract<
        Phase5AgentRuntimeCryptographicPreflightResult,
        {
          readonly ok: true;
        }
      >;

    readonly reason:
      Phase5AgentRuntimeLifecycleFailureReason;

    readonly lifecycleSignals:
      Phase5AgentRuntimeLifecycleSignals;

    readonly policyResult?:
      Phase5AgentRuntimeAuthorizationResult
      | null;
  },
): Phase5AgentRuntimeAuthorizationResult {
  const policyResult =
    args.policyResult ?? null;

  return buildResult({
    envelope:
      args.input.envelope,

    reason:
      args.reason,

    httpStatus:
      lifecycleFailureHttpStatus(
        args.reason,
      ),

    shouldPersistPolicyOutcome:
      "failed",

    canonicalChallengeAccepted:
      true,

    contractBindingAccepted:
      true,

    expectedChallengeHash:
      args.preflight.expectedChallengeHash,

    challengeIssuedAtSec:
      args.input.canonical.issuedAtSec,

    challengeExpiresAtSec:
      args.input.canonical.expiresAtSec,

    policyEvaluation:
      policyResult?.policyEvaluation ??
      null,

    lifecycleSignals:
      args.lifecycleSignals,

    proofVerification:
      args.preflight.proofVerification,

    cryptographicBinding:
      args.preflight.cryptographicBinding,
  });
}

export function evaluatePhase5AgentRuntimeAuthorization(
  input:
    Phase5AgentRuntimeAuthorizationInput,
): Phase5AgentRuntimeAuthorizationResult {
  const preflight =
    evaluatePhase5AgentRuntimeCryptographicPreflight(
      input,
    );

  return completePhase5AgentRuntimePolicyEvaluation(
    input,
    preflight,
  );
}
