import type {
  AgentProofOfPossessionVerificationResult,
} from './agentProofOfPossessionVerifier';

import type {
  Phase5AgentCryptographicBindingResult,
} from './agentCryptographicDelegationBindingVerifier';

export const PHASE5_AGENT_DELEGATION_LIFECYCLE_MODE =
  'controlled_test_only' as const;

export type Phase5AgentDelegationLifecycleContract = {
  readonly delegationId: string;
  readonly credentialHash: string;
  readonly revocationId: string;
  readonly buyerKeyVersion: number;
  readonly agentKeyVersion: number;
  readonly maxUses: number;
};

export type Phase5AgentDelegationLifecycleReason =
  | 'lifecycle_ready'
  | 'cryptographic_delegation_not_verified'
  | 'cryptographic_binding_not_verified'
  | 'invalid_lifecycle_input'
  | 'invalid_lifecycle_contract'
  | 'lifecycle_contract_mismatch'
  | 'delegation_not_yet_valid'
  | 'delegation_expired';

export type Phase5AgentDelegationLifecycleInput = {
  readonly delegationDocument: unknown;

  readonly proofVerification:
    AgentProofOfPossessionVerificationResult;

  readonly cryptographicBinding:
    Phase5AgentCryptographicBindingResult;

  readonly nowSec: number;
};

export type Phase5AgentDelegationLifecycleResult = {
  readonly ok: boolean;
  readonly status:
    | 'accepted'
    | 'rejected';

  readonly reason:
    Phase5AgentDelegationLifecycleReason;

  readonly mode:
    typeof PHASE5_AGENT_DELEGATION_LIFECYCLE_MODE;

  readonly lifecycleEvaluated: boolean;
  readonly lifecycleContractValidated: boolean;
  readonly lifecycleContractMatched: boolean;

  readonly cryptographicDelegationVerified: boolean;
  readonly cryptographicBindingVerified: boolean;

  readonly validityEvaluatedAgainstClock: boolean;
  readonly credentialCurrentlyValid: boolean;

  readonly nowSec: number | null;
  readonly notBeforeSec: number | null;
  readonly expiresAtSec: number | null;

  readonly delegationId: string | null;
  readonly credentialHash: string | null;
  readonly revocationId: string | null;

  readonly buyerKeyVersion: number | null;
  readonly agentKeyVersion: number | null;
  readonly maxUses: number | null;

  readonly lifecycleContract:
    Phase5AgentDelegationLifecycleContract
    | null;

  readonly revocationChecked: false;
  readonly delegationRevoked: false;

  readonly boundedUseChecked: false;
  readonly boundedUseConsumed: false;

  readonly currentAuthorizationEstablished: false;

  readonly buyerVerificationKeyTrustEstablished: false;
  readonly buyerIdentityAuthenticated: false;
  readonly buyerKeyOwnershipEstablished: false;

  readonly agentIdentityAuthenticated: false;
  readonly agentKeyTrustEstablished: false;

  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;

  readonly receiptJwsPrinted: false;
  readonly paymentResponsePrinted: false;
  readonly protectedResourceReleased: false;

  readonly agentRegistryLookupAttempted: false;
  readonly productionActivation: false;
};

type UnknownRecord =
  Record<string, unknown>;

type ParsedLifecycleCredential = {
  readonly contract:
    Phase5AgentDelegationLifecycleContract;

  readonly notBeforeSec: number;
  readonly expiresAtSec: number;
};

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nonEmptyString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    value.length > 0
  )
    ? value
    : null;
}

function positiveSafeInteger(
  value: unknown,
): number | null {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  )
    ? value
    : null;
}

function nonNegativeSafeInteger(
  value: unknown,
): number | null {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
    ? value
    : null;
}

function credentialHash(
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{64}$/.test(value)
  )
    ? value
    : null;
}

function parseLifecycleCredential(
  delegationDocument: unknown,
  verifiedCredentialHash: string,
): ParsedLifecycleCredential | null {
  const root =
    isRecord(delegationDocument)
      ? delegationDocument
      : null;

  const credential =
    isRecord(root?.credential)
      ? root.credential
      : null;

  const validity =
    isRecord(credential?.validity)
      ? credential.validity
      : null;

  const usage =
    isRecord(credential?.usage)
      ? credential.usage
      : null;

  const lifecycle =
    isRecord(credential?.lifecycle)
      ? credential.lifecycle
      : null;

  const delegationId =
    nonEmptyString(
      credential?.delegationId,
    );

  const notBeforeSec =
    positiveSafeInteger(
      validity?.notBefore,
    );

  const expiresAtSec =
    positiveSafeInteger(
      validity?.expiresAt,
    );

  const maxUses =
    positiveSafeInteger(
      usage?.maxUses,
    );

  const revocationId =
    nonEmptyString(
      lifecycle?.revocationId,
    );

  const buyerKeyVersion =
    positiveSafeInteger(
      lifecycle?.buyerKeyVersion,
    );

  const agentKeyVersion =
    positiveSafeInteger(
      lifecycle?.agentKeyVersion,
    );

  if (
    delegationId === null ||
    notBeforeSec === null ||
    expiresAtSec === null ||
    maxUses === null ||
    revocationId === null ||
    buyerKeyVersion === null ||
    agentKeyVersion === null ||
    notBeforeSec >= expiresAtSec
  ) {
    return null;
  }

  return {
    contract: {
      delegationId,
      credentialHash:
        verifiedCredentialHash,
      revocationId,
      buyerKeyVersion,
      agentKeyVersion,
      maxUses,
    },

    notBeforeSec,
    expiresAtSec,
  };
}

function cryptographicVerificationAccepted(
  proof:
    AgentProofOfPossessionVerificationResult,
): boolean {
  return (
    proof.ok === true &&
    proof.delegationContractValidated === true &&
    proof.buyerSignatureVerified === true &&
    proof.agentPublicKeyBoundByBuyerSignature === true &&
    proof.agentProofOfPossessionVerified === true &&
    credentialHash(
      proof.credentialHash,
    ) !== null &&
    nonEmptyString(
      proof.delegationId,
    ) !== null
  );
}

function cryptographicBindingAccepted(
  binding:
    Phase5AgentCryptographicBindingResult,
): boolean {
  return (
    binding.ok === true &&
    binding.cryptographicDelegationVerification === true &&
    binding.buyerSignatureVerified === true &&
    binding.agentProofOfPossessionVerified === true &&
    binding.verifiedDelegationDocumentMatched === true &&
    binding.outerDelegationIdentityBound === true &&
    binding.buyerPolicySubjectBound === true &&
    binding.signedScopeBound === true &&
    binding.signedPaymentTupleBound === true &&
    binding.credentialValidityCoversChallenge === true &&
    binding.signedUsageBound === true &&
    binding.signedReplayBound === true &&
    credentialHash(
      binding.credentialHash,
    ) !== null &&
    nonEmptyString(
      binding.delegationId,
    ) !== null
  );
}

function buildResult(
  input:
    Phase5AgentDelegationLifecycleInput,
  values: {
    readonly reason:
      Phase5AgentDelegationLifecycleReason;

    readonly lifecycleEvaluated?: boolean;
    readonly lifecycleContractValidated?: boolean;
    readonly lifecycleContractMatched?: boolean;

    readonly validityEvaluatedAgainstClock?: boolean;
    readonly credentialCurrentlyValid?: boolean;

    readonly parsed?:
      ParsedLifecycleCredential
      | null;

    readonly verifiedCredentialHash?:
      string
      | null;

    readonly verifiedDelegationId?:
      string
      | null;
  },
): Phase5AgentDelegationLifecycleResult {
  const ok =
    values.reason ===
    'lifecycle_ready';

  const parsed =
    values.parsed ??
    null;

  const contract =
    parsed?.contract ??
    null;

  return {
    ok,

    status:
      ok
        ? 'accepted'
        : 'rejected',

    reason:
      values.reason,

    mode:
      PHASE5_AGENT_DELEGATION_LIFECYCLE_MODE,

    lifecycleEvaluated:
      values.lifecycleEvaluated ??
      false,

    lifecycleContractValidated:
      values.lifecycleContractValidated ??
      false,

    lifecycleContractMatched:
      values.lifecycleContractMatched ??
      false,

    cryptographicDelegationVerified:
      cryptographicVerificationAccepted(
        input.proofVerification,
      ),

    cryptographicBindingVerified:
      cryptographicBindingAccepted(
        input.cryptographicBinding,
      ),

    validityEvaluatedAgainstClock:
      values.validityEvaluatedAgainstClock ??
      false,

    credentialCurrentlyValid:
      values.credentialCurrentlyValid ??
      false,

    nowSec:
      nonNegativeSafeInteger(
        input.nowSec,
      ),

    notBeforeSec:
      parsed?.notBeforeSec ??
      null,

    expiresAtSec:
      parsed?.expiresAtSec ??
      null,

    delegationId:
      contract?.delegationId ??
      values.verifiedDelegationId ??
      null,

    credentialHash:
      contract?.credentialHash ??
      values.verifiedCredentialHash ??
      null,

    revocationId:
      contract?.revocationId ??
      null,

    buyerKeyVersion:
      contract?.buyerKeyVersion ??
      null,

    agentKeyVersion:
      contract?.agentKeyVersion ??
      null,

    maxUses:
      contract?.maxUses ??
      null,

    lifecycleContract:
      contract,

    revocationChecked: false,
    delegationRevoked: false,

    boundedUseChecked: false,
    boundedUseConsumed: false,

    currentAuthorizationEstablished: false,

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

    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,

    receiptJwsPrinted: false,
    paymentResponsePrinted: false,
    protectedResourceReleased: false,

    agentRegistryLookupAttempted: false,
    productionActivation: false,
  };
}

export function evaluatePhase5AgentDelegationLifecycle(
  input:
    Phase5AgentDelegationLifecycleInput,
): Phase5AgentDelegationLifecycleResult {
  const verifiedCredentialHash =
    credentialHash(
      input
        .proofVerification
        .credentialHash,
    );

  const bindingCredentialHash =
    credentialHash(
      input
        .cryptographicBinding
        .credentialHash,
    );

  const verifiedDelegationId =
    nonEmptyString(
      input
        .proofVerification
        .delegationId,
    );

  const bindingDelegationId =
    nonEmptyString(
      input
        .cryptographicBinding
        .delegationId,
    );

  if (
    !cryptographicVerificationAccepted(
      input.proofVerification,
    )
  ) {
    return buildResult(input, {
      reason:
        'cryptographic_delegation_not_verified',

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  if (
    !cryptographicBindingAccepted(
      input.cryptographicBinding,
    )
  ) {
    return buildResult(input, {
      reason:
        'cryptographic_binding_not_verified',

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  const nowSec =
    nonNegativeSafeInteger(
      input.nowSec,
    );

  if (
    nowSec === null ||
    verifiedCredentialHash === null ||
    bindingCredentialHash === null ||
    verifiedDelegationId === null ||
    bindingDelegationId === null
  ) {
    return buildResult(input, {
      reason:
        'invalid_lifecycle_input',

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  const parsed =
    parseLifecycleCredential(
      input.delegationDocument,
      verifiedCredentialHash,
    );

  if (parsed === null) {
    return buildResult(input, {
      reason:
        'invalid_lifecycle_contract',

      lifecycleEvaluated: true,

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  const lifecycleContractMatched =
    parsed.contract.credentialHash ===
      verifiedCredentialHash &&
    parsed.contract.credentialHash ===
      bindingCredentialHash &&
    parsed.contract.delegationId ===
      verifiedDelegationId &&
    parsed.contract.delegationId ===
      bindingDelegationId;

  if (!lifecycleContractMatched) {
    return buildResult(input, {
      reason:
        'lifecycle_contract_mismatch',

      lifecycleEvaluated: true,
      lifecycleContractValidated: true,
      lifecycleContractMatched: false,

      parsed,

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  if (
    nowSec <
    parsed.notBeforeSec
  ) {
    return buildResult(input, {
      reason:
        'delegation_not_yet_valid',

      lifecycleEvaluated: true,
      lifecycleContractValidated: true,
      lifecycleContractMatched: true,

      validityEvaluatedAgainstClock:
        true,

      credentialCurrentlyValid:
        false,

      parsed,

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  if (
    nowSec >=
    parsed.expiresAtSec
  ) {
    return buildResult(input, {
      reason:
        'delegation_expired',

      lifecycleEvaluated: true,
      lifecycleContractValidated: true,
      lifecycleContractMatched: true,

      validityEvaluatedAgainstClock:
        true,

      credentialCurrentlyValid:
        false,

      parsed,

      verifiedCredentialHash,
      verifiedDelegationId,
    });
  }

  return buildResult(input, {
    reason:
      'lifecycle_ready',

    lifecycleEvaluated: true,
    lifecycleContractValidated: true,
    lifecycleContractMatched: true,

    validityEvaluatedAgainstClock:
      true,

    credentialCurrentlyValid:
      true,

    parsed,

    verifiedCredentialHash,
    verifiedDelegationId,
  });
}
