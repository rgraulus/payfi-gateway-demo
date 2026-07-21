import type {
  AgentProofOfPossessionVerificationResult,
} from "./agentProofOfPossessionVerifier";
import type {
  Phase5AgentDelegationBindingContext,
} from "./agentDelegationBindingVerifier";
import {
  BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION,
  BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE,
  BUYER_TO_AGENT_DELEGATION_DOMAIN,
  hashBuyerToAgentDelegationCredential,
  validateBuyerToAgentDelegationCredentialContract,
  type BuyerToAgentDelegationCredential,
  type BuyerToAgentDelegationCredentialDocument,
} from "./buyerToAgentDelegationCredential";

type JsonRecord = Record<string, unknown>;

export const PHASE5_AGENT_CRYPTOGRAPHIC_BINDING_MODE =
  "controlled_cryptographic_demo2" as const;

export const PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE =
  "xcf-gateway:demo" as const;

export const PHASE5_AGENT_CRYPTOGRAPHIC_BINDING_REASON_CODES = [
  "accepted",
  "cryptographic_delegation_not_verified",
  "invalid_verified_delegation_document",
  "verified_delegation_document_mismatch",
  "outer_delegation_identity_mismatch",
  "signed_delegation_scope_mismatch",
  "signed_delegation_payment_tuple_mismatch",
  "signed_delegation_validity_mismatch",
  "signed_delegation_usage_mismatch",
  "signed_delegation_replay_mismatch",
] as const;

export type Phase5AgentCryptographicBindingReason =
  (typeof PHASE5_AGENT_CRYPTOGRAPHIC_BINDING_REASON_CODES)[number];

export interface Phase5AgentCryptographicBindingInput {
  readonly outerEnvelope: unknown;
  readonly delegationDocument: unknown;
  readonly proofVerification:
    AgentProofOfPossessionVerificationResult;
  readonly expectedContext:
    Phase5AgentDelegationBindingContext;
  readonly expectedAudience: string;
}

export interface Phase5AgentCryptographicBindingResult {
  readonly ok: boolean;
  readonly status: "accepted" | "rejected";
  readonly mode:
    typeof PHASE5_AGENT_CRYPTOGRAPHIC_BINDING_MODE;
  readonly reason:
    Phase5AgentCryptographicBindingReason;
  readonly bindingEvaluated: boolean;
  readonly mismatchFields: readonly string[];

  readonly cryptographicDelegationVerification: boolean;
  readonly buyerSignatureVerified: boolean;
  readonly agentProofOfPossessionVerified: boolean;
  readonly verifiedDelegationDocumentMatched: boolean;
  readonly outerDelegationIdentityBound: boolean;
  readonly buyerPolicySubjectBound: boolean;
  readonly signedScopeBound: boolean;
  readonly signedPaymentTupleBound: boolean;
  readonly credentialValidityCoversChallenge: boolean;
  readonly signedUsageBound: boolean;
  readonly signedReplayBound: boolean;

  readonly credentialHash: string | null;
  readonly delegationId: string | null;
  readonly buyerId: string | null;
  readonly agentId: string | null;
  readonly agentKeyId: string | null;
  readonly audience: string | null;

  readonly buyerVerificationKeyTrustEstablished: false;
  readonly buyerIdentityAuthenticated: false;
  readonly buyerKeyOwnershipEstablished: false;
  readonly agentIdentityAuthenticated: false;
  readonly agentKeyTrustEstablished: false;
  readonly currentAuthorizationEstablished: false;
  readonly validityEvaluatedAgainstClock: false;
  readonly revocationChecked: false;
  readonly boundedUseConsumed: false;
  readonly challengeReplayStateMutated: false;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly protectedResourceReleased: false;
  readonly agentRegistryLookupAttempted: false;
  readonly productionActivation: false;
}

interface OuterEnvelopeSnapshot {
  readonly delegationId: string | null;
  readonly delegationIssuedAt: number | null;
  readonly delegationExpiresAt: number | null;
  readonly buyerPolicySubject: string | null;
  readonly agentId: string | null;
}

interface BindingState {
  verifiedDelegationDocumentMatched: boolean;
  outerDelegationIdentityBound: boolean;
  buyerPolicySubjectBound: boolean;
  signedScopeBound: boolean;
  signedPaymentTupleBound: boolean;
  credentialValidityCoversChallenge: boolean;
  signedUsageBound: boolean;
  signedReplayBound: boolean;
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(value: unknown): string | null {
  return (
    typeof value === "string" &&
    value.length > 0
  )
    ? value
    : null;
}

function numberValue(value: unknown): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function getDelegationDocument(
  value: unknown,
): BuyerToAgentDelegationCredentialDocument | null {
  const validation =
    validateBuyerToAgentDelegationCredentialContract(
      value,
    );

  if (!validation.ok) {
    return null;
  }

  return value as
    BuyerToAgentDelegationCredentialDocument;
}

function snapshotOuterEnvelope(
  value: unknown,
): OuterEnvelopeSnapshot {
  const root = isRecord(value) ? value : {};

  const delegation = isRecord(root.delegation)
    ? root.delegation
    : null;

  const buyer = isRecord(root.buyer)
    ? root.buyer
    : null;

  const agent = isRecord(root.agent)
    ? root.agent
    : null;

  return {
    delegationId:
      stringValue(delegation?.delegationId),

    delegationIssuedAt:
      numberValue(
        delegation?.delegationIssuedAt,
      ),

    delegationExpiresAt:
      numberValue(
        delegation?.delegationExpiresAt,
      ),

    buyerPolicySubject:
      stringValue(buyer?.policySubject),

    agentId:
      stringValue(agent?.agentId),
  };
}

function cryptographicVerificationAccepted(
  result: AgentProofOfPossessionVerificationResult,
): boolean {
  return (
    result.ok === true &&
    result.delegationContractValidated === true &&
    result.buyerSignatureVerified === true &&
    result.agentPublicKeyBoundByBuyerSignature === true &&
    result.agentProofOfPossessionVerified === true
  );
}

function verifiedDocumentMismatchFields(
  credential: BuyerToAgentDelegationCredential,
  proof: AgentProofOfPossessionVerificationResult,
): string[] {
  const fields: string[] = [];

  let credentialHash: string | null = null;

  try {
    credentialHash =
      hashBuyerToAgentDelegationCredential(
        credential,
      );
  } catch {
    fields.push("credential.hash");
  }

  if (
    credentialHash === null ||
    credentialHash !== proof.credentialHash
  ) {
    if (!fields.includes("credential.hash")) {
      fields.push("credential.hash");
    }
  }

  if (
    credential.delegationId !==
    proof.delegationId
  ) {
    fields.push(
      "credential.delegationId",
    );
  }

  if (
    credential.subject.agentId !==
    proof.agentId
  ) {
    fields.push(
      "credential.subject.agentId",
    );
  }

  if (
    credential.subject.agentKeyId !==
    proof.agentKeyId
  ) {
    fields.push(
      "credential.subject.agentKeyId",
    );
  }

  return fields;
}

function outerIdentityMismatchFields(
  outer: OuterEnvelopeSnapshot,
  credential: BuyerToAgentDelegationCredential,
): string[] {
  const fields: string[] = [];

  if (
    outer.delegationId !==
    credential.delegationId
  ) {
    fields.push(
      "outer.delegation.delegationId",
    );
  }

  if (
    outer.agentId !==
    credential.subject.agentId
  ) {
    fields.push(
      "outer.agent.agentId",
    );
  }

  if (
    outer.buyerPolicySubject !==
    credential.issuer.buyerId
  ) {
    fields.push(
      "outer.buyer.policySubject",
    );
  }

  if (
    outer.delegationIssuedAt !==
    credential.validity.issuedAt
  ) {
    fields.push(
      "outer.delegation.delegationIssuedAt",
    );
  }

  if (
    outer.delegationExpiresAt !==
    credential.validity.expiresAt
  ) {
    fields.push(
      "outer.delegation.delegationExpiresAt",
    );
  }

  return fields;
}

function signedScopeMismatchFields(
  credential: BuyerToAgentDelegationCredential,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];
  const { scope } = credential;

  if (
    scope.merchantId !==
    expected.scope.merchantId
  ) {
    fields.push(
      "credential.scope.merchantId",
    );
  }

  if (
    scope.resource.method !==
    expected.scope.resourceMethod
  ) {
    fields.push(
      "credential.scope.resource.method",
    );
  }

  if (
    scope.resource.path !==
    expected.scope.resourcePath
  ) {
    fields.push(
      "credential.scope.resource.path",
    );
  }

  if (
    scope.contract.contractId !==
    expected.scope.contractId
  ) {
    fields.push(
      "credential.scope.contract.contractId",
    );
  }

  if (
    scope.contract.contractVersion !==
    expected.scope.contractVersion
  ) {
    fields.push(
      "credential.scope.contract.contractVersion",
    );
  }

  if (
    scope.allowedAction !==
      BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION ||
    scope.allowedAction !==
      expected.scope.allowedAction
  ) {
    fields.push(
      "credential.scope.allowedAction",
    );
  }

  return fields;
}

function signedPaymentMismatchFields(
  credential: BuyerToAgentDelegationCredential,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];
  const { scope } = credential;

  if (
    scope.network !==
    expected.paymentTuple.network
  ) {
    fields.push(
      "credential.scope.network",
    );
  }

  if (
    scope.asset.type !==
    expected.paymentTuple.assetType
  ) {
    fields.push(
      "credential.scope.asset.type",
    );
  }

  if (
    scope.asset.tokenId !==
    expected.paymentTuple.tokenId
  ) {
    fields.push(
      "credential.scope.asset.tokenId",
    );
  }

  if (
    scope.asset.decimals !==
    expected.paymentTuple.decimals
  ) {
    fields.push(
      "credential.scope.asset.decimals",
    );
  }

  if (
    scope.amount.mode !==
      BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE ||
    scope.amount.value !==
      expected.paymentTuple.amount
  ) {
    fields.push(
      "credential.scope.amount",
    );
  }

  if (
    scope.payTo !==
    expected.paymentTuple.payTo
  ) {
    fields.push(
      "credential.scope.payTo",
    );
  }

  return fields;
}

function validityMismatchFields(
  credential: BuyerToAgentDelegationCredential,
  expected: Phase5AgentDelegationBindingContext,
): string[] {
  const fields: string[] = [];

  const issuedAt =
    expected.challenge.issuedAt;

  const expiresAt =
    expected.challenge.expiresAt;

  if (
    issuedAt === undefined ||
    credential.validity.issuedAt >
      issuedAt
  ) {
    fields.push(
      "credential.validity.issuedAt",
    );
  }

  if (
    issuedAt === undefined ||
    credential.validity.notBefore >
      issuedAt
  ) {
    fields.push(
      "credential.validity.notBefore",
    );
  }

  if (
    expiresAt === undefined ||
    credential.validity.expiresAt <
      expiresAt
  ) {
    fields.push(
      "credential.validity.expiresAt",
    );
  }

  return fields;
}

function buildResult(args: {
  input: Phase5AgentCryptographicBindingInput;

  document:
    BuyerToAgentDelegationCredentialDocument
    | null;

  reason:
    Phase5AgentCryptographicBindingReason;

  bindingEvaluated: boolean;

  mismatchFields:
    readonly string[];

  state?: Partial<BindingState>;
}): Phase5AgentCryptographicBindingResult {
  const proof =
    args.input.proofVerification;

  const credential =
    args.document?.credential ?? null;

  const state =
    args.state ?? {};

  return {
    ok:
      args.reason === "accepted",

    status:
      args.reason === "accepted"
        ? "accepted"
        : "rejected",

    mode:
      PHASE5_AGENT_CRYPTOGRAPHIC_BINDING_MODE,

    reason:
      args.reason,

    bindingEvaluated:
      args.bindingEvaluated,

    mismatchFields: [
      ...args.mismatchFields,
    ],

    cryptographicDelegationVerification:
      cryptographicVerificationAccepted(
        proof,
      ),

    buyerSignatureVerified:
      proof.buyerSignatureVerified,

    agentProofOfPossessionVerified:
      proof.agentProofOfPossessionVerified,

    verifiedDelegationDocumentMatched:
      state
        .verifiedDelegationDocumentMatched ??
      false,

    outerDelegationIdentityBound:
      state
        .outerDelegationIdentityBound ??
      false,

    buyerPolicySubjectBound:
      state
        .buyerPolicySubjectBound ??
      false,

    signedScopeBound:
      state.signedScopeBound ?? false,

    signedPaymentTupleBound:
      state
        .signedPaymentTupleBound ??
      false,

    credentialValidityCoversChallenge:
      state
        .credentialValidityCoversChallenge ??
      false,

    signedUsageBound:
      state.signedUsageBound ?? false,

    signedReplayBound:
      state.signedReplayBound ?? false,

    credentialHash:
      proof.credentialHash,

    delegationId:
      credential?.delegationId ??
      proof.delegationId,

    buyerId:
      credential?.issuer.buyerId ??
      null,

    agentId:
      credential?.subject.agentId ??
      proof.agentId,

    agentKeyId:
      credential?.subject.agentKeyId ??
      proof.agentKeyId,

    audience:
      credential?.replay.audience ??
      null,

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
      false,

    validityEvaluatedAgainstClock:
      false,

    revocationChecked:
      false,

    boundedUseConsumed:
      false,

    challengeReplayStateMutated:
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

    agentRegistryLookupAttempted:
      false,

    productionActivation:
      false,
  };
}

export function verifyPhase5AgentCryptographicDelegationBindings(
  input: Phase5AgentCryptographicBindingInput,
): Phase5AgentCryptographicBindingResult {
  if (
    !cryptographicVerificationAccepted(
      input.proofVerification,
    )
  ) {
    return buildResult({
      input,
      document: null,

      reason:
        "cryptographic_delegation_not_verified",

      bindingEvaluated:
        false,

      mismatchFields:
        [],
    });
  }

  const document =
    getDelegationDocument(
      input.delegationDocument,
    );

  if (document === null) {
    return buildResult({
      input,
      document: null,

      reason:
        "invalid_verified_delegation_document",

      bindingEvaluated:
        false,

      mismatchFields: [
        "delegationDocument",
      ],
    });
  }

  const verifiedDocumentFields =
    verifiedDocumentMismatchFields(
      document.credential,
      input.proofVerification,
    );

  if (
    verifiedDocumentFields.length > 0
  ) {
    return buildResult({
      input,
      document,

      reason:
        "verified_delegation_document_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        verifiedDocumentFields,
    });
  }

  const outer =
    snapshotOuterEnvelope(
      input.outerEnvelope,
    );

  const outerFields =
    outerIdentityMismatchFields(
      outer,
      document.credential,
    );

  if (outerFields.length > 0) {
    return buildResult({
      input,
      document,

      reason:
        "outer_delegation_identity_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        outerFields,

      state: {
        verifiedDelegationDocumentMatched:
          true,
      },
    });
  }

  const acceptedIdentityState = {
    verifiedDelegationDocumentMatched:
      true,

    outerDelegationIdentityBound:
      true,

    buyerPolicySubjectBound:
      true,
  } as const;

  const scopeFields =
    signedScopeMismatchFields(
      document.credential,
      input.expectedContext,
    );

  if (scopeFields.length > 0) {
    return buildResult({
      input,
      document,

      reason:
        "signed_delegation_scope_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        scopeFields,

      state:
        acceptedIdentityState,
    });
  }

  const paymentFields =
    signedPaymentMismatchFields(
      document.credential,
      input.expectedContext,
    );

  if (paymentFields.length > 0) {
    return buildResult({
      input,
      document,

      reason:
        "signed_delegation_payment_tuple_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        paymentFields,

      state: {
        ...acceptedIdentityState,

        signedScopeBound:
          true,
      },
    });
  }

  const validityFields =
    validityMismatchFields(
      document.credential,
      input.expectedContext,
    );

  if (validityFields.length > 0) {
    return buildResult({
      input,
      document,

      reason:
        "signed_delegation_validity_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        validityFields,

      state: {
        ...acceptedIdentityState,

        signedScopeBound:
          true,

        signedPaymentTupleBound:
          true,
      },
    });
  }

  if (
    document.credential.usage.maxUses !==
    input.expectedContext.scope.maxUses
  ) {
    return buildResult({
      input,
      document,

      reason:
        "signed_delegation_usage_mismatch",

      bindingEvaluated:
        true,

      mismatchFields: [
        "credential.usage.maxUses",
      ],

      state: {
        ...acceptedIdentityState,

        signedScopeBound:
          true,

        signedPaymentTupleBound:
          true,

        credentialValidityCoversChallenge:
          true,
      },
    });
  }

  const replayFields: string[] = [];

  if (
    document.credential.replay.audience !==
    input.expectedAudience
  ) {
    replayFields.push(
      "credential.replay.audience",
    );
  }

  if (
    document.credential.replay.domain !==
    BUYER_TO_AGENT_DELEGATION_DOMAIN
  ) {
    replayFields.push(
      "credential.replay.domain",
    );
  }

  if (replayFields.length > 0) {
    return buildResult({
      input,
      document,

      reason:
        "signed_delegation_replay_mismatch",

      bindingEvaluated:
        true,

      mismatchFields:
        replayFields,

      state: {
        ...acceptedIdentityState,

        signedScopeBound:
          true,

        signedPaymentTupleBound:
          true,

        credentialValidityCoversChallenge:
          true,

        signedUsageBound:
          true,
      },
    });
  }

  return buildResult({
    input,
    document,

    reason:
      "accepted",

    bindingEvaluated:
      true,

    mismatchFields:
      [],

    state: {
      ...acceptedIdentityState,

      signedScopeBound:
        true,

      signedPaymentTupleBound:
        true,

      credentialValidityCoversChallenge:
        true,

      signedUsageBound:
        true,

      signedReplayBound:
        true,
    },
  });
}
