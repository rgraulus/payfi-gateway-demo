/**
 * Phase 6 Agent Registry identity-to-acting-key binding.
 *
 * This module binds an accepted Phase 5 Ed25519 acting key to the exact
 * external CIS-8 key referenced by one Active CIS-8004 agent record.
 *
 * The implementation is read-only and test-only. It performs no transaction
 * submission, signing, persistence, Gateway release action, payment action,
 * replay mutation, receipt issuance, or resource release.
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  type AgentRegistryContractCoordinateV1,
} from "./agentRegistryTrustContract";

import {
  CONCORDIUM_CIS8004_READ_RESULT_TYPE,
  CONCORDIUM_CIS8004_TRANSPORT_KIND,
  type ConcordiumCis8004ExternalReferenceV1,
  type ConcordiumCis8004FinalizedSnapshotV1,
} from "./concordiumCis8004RegistryPlugin";

import {
  hashBuyerToAgentDelegationCredential,
  validateBuyerToAgentDelegationCredentialContract,
  type BuyerToAgentDelegationCredentialDocument,
} from "../phase5/buyerToAgentDelegationCredential";

export const AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE =
  "xcf.agent-registry.identity-key-binding" as const;

export const AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE =
  "test_only" as const;

export const CONCORDIUM_CIS8_READ_RESULT_TYPE =
  "xcf.concordium.cis8.read-result" as const;

export const CONCORDIUM_CIS8_TRANSPORT_KIND =
  CONCORDIUM_CIS8004_TRANSPORT_KIND;

export const AGENT_REGISTRY_EXTERNAL_KEY_POLICIES = [
  "required",
  "optional",
  "forbidden",
] as const;

export type AgentRegistryExternalKeyPolicyV1 =
  (typeof AGENT_REGISTRY_EXTERNAL_KEY_POLICIES)[number];

export const AGENT_REGISTRY_IDENTITY_KEY_BINDING_REASON_CODES = [
  "accepted",
  "accepted_without_external_key",
  "phase5_binding_not_accepted",
  "credential_contract_invalid",
  "credential_hash_mismatch",
  "agent_identity_mismatch",
  "agent_key_identity_mismatch",
  "invalid_agent_public_key",
  "registry_trust_not_verified",
  "forged_verified_binding",
  "native_binding_not_supported",
  "registry_read_result_invalid",
  "agent_token_mismatch",
  "registry_record_missing",
  "registry_record_not_active",
  "registry_owner_mismatch",
  "external_key_required",
  "external_key_forbidden",
  "external_reference_invalid",
  "unsupported_external_reference_kind",
  "untrusted_cis8_contract",
  "unsupported_external_key_type",
  "agent_public_key_mismatch",
  "cis8_transport_unavailable",
  "cis8_read_result_invalid",
  "snapshot_mismatch",
  "cis8_registration_missing",
  "cis8_registration_revoked",
  "cis8_registration_malformed",
  "cis8_owner_mismatch",
  "cis8_external_key_mismatch",
] as const;

export type AgentRegistryIdentityKeyBindingReasonV1 =
  (typeof AGENT_REGISTRY_IDENTITY_KEY_BINDING_REASON_CODES)[number];

export type ConcordiumCis8ExternalKeyIdV1 = {
  readonly namespace: string;
  readonly keyType: string;
  readonly publicKeyHex: string;
};

export type ConcordiumCis8RegistrationStatusV1 =
  "Active" | "Revoked";

export type ConcordiumCis8RegistrationV1 = {
  readonly externalKey:
    ConcordiumCis8ExternalKeyIdV1;

  readonly owner: string;

  readonly proofScheme: string;

  readonly status:
    ConcordiumCis8RegistrationStatusV1;

  readonly lastUpdated: string;

  readonly metadata:
    readonly {
      readonly key: string;
      readonly value: string;
    }[];
};

export type ConcordiumCis8TrustedConfigV1 = {
  readonly network: string;

  readonly contract:
    AgentRegistryContractCoordinateV1;

  readonly moduleReference: string;

  readonly contractName: string;

  readonly entrypoint: string;

  readonly grpc: {
    readonly host: string;
    readonly port: number;
    readonly tls: boolean;
  };

  readonly timeoutMs: number;

  readonly transport:
    typeof CONCORDIUM_CIS8_TRANSPORT_KIND;
};

export const CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG:
  ConcordiumCis8TrustedConfigV1 =
  Object.freeze({
    network:
      "ccd:testnet",

    contract:
      Object.freeze({
        index:
          "12801",

        subindex:
          0,
      }),

    moduleReference:
      "5a01f4133c353c640120cd0303316bd18ebd9e120a909cd5ff639e92227e75da",

    contractName:
      "CIS-8",

    entrypoint:
      "ownerOfKey",

    grpc:
      Object.freeze({
        host:
          "grpc.testnet.concordium.com",

        port:
          20000,

        tls:
          true,
      }),

    timeoutMs:
      10_000,

    transport:
      CONCORDIUM_CIS8_TRANSPORT_KIND,
  });

export type ConcordiumCis8ReadRequestV1 = {
  readonly config:
    ConcordiumCis8TrustedConfigV1;

  readonly snapshot:
    ConcordiumCis8004FinalizedSnapshotV1;

  readonly externalKey:
    ConcordiumCis8ExternalKeyIdV1;
};

export type ConcordiumCis8FinalizedReadResultV1 = {
  readonly type:
    typeof CONCORDIUM_CIS8_READ_RESULT_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly network: string;

  readonly cis8Contract:
    AgentRegistryContractCoordinateV1;

  readonly moduleReference: string;

  readonly snapshot:
    ConcordiumCis8004FinalizedSnapshotV1;

  readonly registration:
    ConcordiumCis8RegistrationV1 | null;
};

export interface ConcordiumCis8ReadTransportV1 {
  readonly kind:
    typeof CONCORDIUM_CIS8_TRANSPORT_KIND;

  read(
    request:
      ConcordiumCis8ReadRequestV1,
  ): Promise<unknown>;
}

export type AgentRegistryIdentityKeyBindingInputV1 = {
  readonly phase5BindingResult:
    unknown;

  readonly delegationDocument:
    unknown;

  readonly registryTrustResult:
    unknown;

  readonly registryReadResult:
    unknown;

  readonly expectedAgentTokenId:
    string;

  readonly externalKeyPolicy:
    AgentRegistryExternalKeyPolicyV1;

  readonly trustedCis8?:
    ConcordiumCis8TrustedConfigV1;

  readonly transport?:
    ConcordiumCis8ReadTransportV1;
};

export type AgentRegistryIdentityKeyBindingResultV1 = {
  readonly type:
    typeof AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly mode:
    typeof AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE;

  readonly ok: boolean;

  readonly status:
    "accepted" | "rejected";

  readonly reason:
    AgentRegistryIdentityKeyBindingReasonV1;

  readonly testOnly:
    true;

  readonly policy:
    AgentRegistryExternalKeyPolicyV1;

  readonly bindingEvaluated:
    boolean;

  readonly baseRegistryTrustVerified:
    boolean;

  readonly registryTrustPreserved:
    boolean;

  readonly credentialHash:
    string | null;

  readonly agentId:
    string | null;

  readonly agentKeyId:
    string | null;

  readonly agentTokenId:
    string | null;

  readonly ownerAccount:
    string | null;

  readonly externalReferencePresent:
    boolean;

  readonly sameSnapshot:
    boolean;

  readonly cis8LookupAttempted:
    boolean;

  readonly cis8RegistrationActive:
    boolean;

  readonly keyBinding: {
    readonly required: boolean;

    readonly verified: boolean;

    readonly bindingType:
      "CIS-8" | null;

    readonly keyFingerprint:
      string | null;
  };

  readonly gatewayRuntimeChanged:
    false;

  readonly phase5StateMutated:
    false;

  readonly canonicalStateMutated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly replayStateMutated:
    false;

  readonly ufxCalled:
    false;

  readonly crpCalled:
    false;

  readonly paymentAttempted:
    false;

  readonly receiptIssued:
    false;

  readonly paymentResponseEmitted:
    false;

  readonly resourceReleased:
    false;

  readonly transactionSubmitted:
    false;

  readonly signingKeyUsed:
    false;

  readonly persistenceUsed:
    false;

  readonly productionActivation:
    false;
};

type UnknownRecord =
  Record<string, unknown>;

type ParsedOwnerOfKey =
  | {
      readonly ok: true;
      readonly value:
        ConcordiumCis8RegistrationV1 | null;
    }
  | {
      readonly ok: false;
    };

type ResultState = {
  readonly reason:
    AgentRegistryIdentityKeyBindingReasonV1;

  readonly policy:
    AgentRegistryExternalKeyPolicyV1;

  readonly bindingEvaluated?: boolean;

  readonly baseRegistryTrustVerified?: boolean;

  readonly registryTrustPreserved?: boolean;

  readonly credentialHash?: string | null;

  readonly agentId?: string | null;

  readonly agentKeyId?: string | null;

  readonly agentTokenId?: string | null;

  readonly ownerAccount?: string | null;

  readonly externalReferencePresent?: boolean;

  readonly sameSnapshot?: boolean;

  readonly cis8LookupAttempted?: boolean;

  readonly cis8RegistrationActive?: boolean;

  readonly keyBinding?: {
    readonly required: boolean;
    readonly verified: boolean;
    readonly bindingType:
      "CIS-8" | null;
    readonly keyFingerprint:
      string | null;
  };
};

type BindingResultContext =
  Omit<
    ResultState,
    "reason"
  >;

type BindingResultOverrides =
  Omit<
    Partial<ResultState>,
    "reason" | "policy"
  >;

function asRecord(
  value: unknown,
): UnknownRecord | null {
  return (
    value !==
      null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  )
    ? value as UnknownRecord
    : null;
}

function isCompactString(
  value: unknown,
  maximumLength = 4096,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0 &&
    value.length <=
      maximumLength &&
    value.trim() ===
      value &&
    !/[\u0000-\u001f\u007f]/.test(
      value,
    )
  );
}

function isCanonicalTokenId(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^(0|[1-9]\d*)$/.test(
      value,
    )
  );
}

function isLowerHex(
  value: unknown,
  byteLength?: number,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0 &&
    value.length %
      2 ===
      0 &&
    (
      byteLength ===
        undefined ||
      value.length ===
        byteLength * 2
    ) &&
    /^[0-9a-f]+$/.test(
      value,
    )
  );
}

function normalizeIsoTimestamp(
  value: unknown,
): string | null {
  if (
    !isCompactString(
      value,
      256,
    )
  ) {
    return null;
  }

  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
}

function sameContractCoordinate(
  left: unknown,
  right: unknown,
): boolean {
  const leftRecord =
    asRecord(
      left,
    );

  const rightRecord =
    asRecord(
      right,
    );

  return (
    leftRecord !==
      null &&
    rightRecord !==
      null &&
    isCanonicalTokenId(
      leftRecord.index,
    ) &&
    isCanonicalTokenId(
      rightRecord.index,
    ) &&
    leftRecord.index ===
      rightRecord.index &&
    typeof leftRecord.subindex ===
      "number" &&
    Number.isSafeInteger(
      leftRecord.subindex,
    ) &&
    leftRecord.subindex >=
      0 &&
    leftRecord.subindex ===
      rightRecord.subindex
  );
}

function sameSnapshot(
  left: unknown,
  right: unknown,
): boolean {
  const leftRecord =
    asRecord(
      left,
    );

  const rightRecord =
    asRecord(
      right,
    );

  return (
    leftRecord !==
      null &&
    rightRecord !==
      null &&
    isLowerHex(
      leftRecord.finalizedBlockHash,
      32,
    ) &&
    leftRecord.finalizedBlockHash ===
      rightRecord.finalizedBlockHash &&
    typeof leftRecord.finalizedBlockHeight ===
      "number" &&
    Number.isSafeInteger(
      leftRecord.finalizedBlockHeight,
    ) &&
    leftRecord.finalizedBlockHeight >=
      0 &&
    leftRecord.finalizedBlockHeight ===
      rightRecord.finalizedBlockHeight &&
    normalizeIsoTimestamp(
      leftRecord.observedAt,
    ) !==
      null &&
    normalizeIsoTimestamp(
      leftRecord.observedAt,
    ) ===
      normalizeIsoTimestamp(
        rightRecord.observedAt,
      ) &&
    leftRecord.finalized ===
      true &&
    rightRecord.finalized ===
      true
  );
}

function parseByte(
  value: unknown,
): number | null {
  if (
    typeof value ===
      "bigint"
  ) {
    return (
      value >=
        0n &&
      value <=
        255n
    )
      ? Number(
          value,
        )
      : null;
  }

  if (
    typeof value ===
      "number"
  ) {
    return (
      Number.isInteger(
        value,
      ) &&
      value >=
        0 &&
      value <=
        255
    )
      ? value
      : null;
  }

  if (
    typeof value ===
      "string" &&
    /^(0|[1-9]\d*)$/.test(
      value,
    )
  ) {
    const parsed =
      Number(
        value,
      );

    return (
      Number.isSafeInteger(
        parsed,
      ) &&
      parsed >=
        0 &&
      parsed <=
        255
    )
      ? parsed
      : null;
  }

  return null;
}

function parsePublicKeyBytes(
  value: unknown,
): string | null {
  if (
    !Array.isArray(
      value,
    ) ||
    value.length ===
      0 ||
    value.length >
      4096
  ) {
    return null;
  }

  const bytes:
    number[] = [];

  for (
    const candidate of value
  ) {
    const byte =
      parseByte(
        candidate,
      );

    if (
      byte ===
        null
    ) {
      return null;
    }

    bytes.push(
      byte,
    );
  }

  return Buffer
    .from(
      bytes,
    )
    .toString(
      "hex",
    );
}

function parseExternalKey(
  value: unknown,
): ConcordiumCis8ExternalKeyIdV1 | null {
  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null ||
    !isCompactString(
      record.namespace,
      2048,
    ) ||
    !isCompactString(
      record.key_type,
      2048,
    )
  ) {
    return null;
  }

  const publicKeyHex =
    parsePublicKeyBytes(
      record.public_key,
    );

  return publicKeyHex ===
    null
    ? null
    : {
        namespace:
          record.namespace,

        keyType:
          record.key_type,

        publicKeyHex,
      };
}

function parseStatus(
  value: unknown,
): ConcordiumCis8RegistrationStatusV1 | null {
  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null
  ) {
    return null;
  }

  const keys =
    Object.keys(
      record,
    );

  if (
    keys.length !==
      1 ||
    !Array.isArray(
      record[keys[0]],
    ) ||
    (
      keys[0] !==
        "Active" &&
      keys[0] !==
        "Revoked"
    )
  ) {
    return null;
  }

  return keys[0];
}

function parseMetadata(
  value: unknown,
): readonly {
  readonly key: string;
  readonly value: string;
}[] | null {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return null;
  }

  const metadata:
    {
      key: string;
      value: string;
    }[] = [];

  for (
    const candidate of value
  ) {
    const record =
      asRecord(
        candidate,
      );

    if (
      record ===
        null ||
      !isCompactString(
        record.key,
        2048,
      ) ||
      !isCompactString(
        record.value,
        8192,
      )
    ) {
      return null;
    }

    metadata.push({
      key:
        record.key,

      value:
        record.value,
    });
  }

  return metadata;
}

function parseConcordiumOption(
  value: unknown,
): {
  readonly ok: boolean;
  readonly value?: unknown;
} {
  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null
  ) {
    return {
      ok:
        false,
    };
  }

  const keys =
    Object.keys(
      record,
    );

  if (
    keys.length !==
      1
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    keys[0] ===
      "None" &&
    Array.isArray(
      record.None,
    ) &&
    record.None.length ===
      0
  ) {
    return {
      ok:
        true,

      value:
        null,
    };
  }

  if (
    keys[0] ===
      "Some" &&
    Array.isArray(
      record.Some,
    ) &&
    record.Some.length ===
      1
  ) {
    return {
      ok:
        true,

      value:
        record.Some[0],
    };
  }

  return {
    ok:
      false,
  };
}

function parseDecodedOwnerOfKeyResult(
  value: unknown,
): ParsedOwnerOfKey {
  const option =
    parseConcordiumOption(
      value,
    );

  if (
    !option.ok
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    option.value ===
      null
  ) {
    return {
      ok:
        true,

      value:
        null,
    };
  }

  const record =
    asRecord(
      option.value,
    );

  if (
    record ===
      null
  ) {
    return {
      ok:
        false,
    };
  }

  const externalKey =
    parseExternalKey(
      record.external_key,
    );

  const status =
    parseStatus(
      record.status,
    );

  const lastUpdated =
    normalizeIsoTimestamp(
      record.last_updated,
    );

  const metadata =
    parseMetadata(
      record.metadata,
    );

  if (
    externalKey ===
      null ||
    status ===
      null ||
    lastUpdated ===
      null ||
    metadata ===
      null ||
    !isCompactString(
      record.owner,
      2048,
    ) ||
    !isCompactString(
      record.proof_scheme,
      2048,
    )
  ) {
    return {
      ok:
        false,
    };
  }

  return {
    ok:
      true,

    value: {
      externalKey,

      owner:
        record.owner,

      proofScheme:
        record.proof_scheme,

      status,

      lastUpdated,

      metadata,
    },
  };
}

export function normalizeConcordiumCis8DecodedOwnerOfKeyResultForTestV1(
  value: unknown,
): ConcordiumCis8RegistrationV1 | null {
  const parsed =
    parseDecodedOwnerOfKeyResult(
      value,
    );

  if (
    !parsed.ok
  ) {
    throw new Error(
      "invalid_cis8_ownerofkey_result",
    );
  }

  return parsed.value;
}

function isExternalKey(
  value: unknown,
): value is ConcordiumCis8ExternalKeyIdV1 {
  const record =
    asRecord(
      value,
    );

  return (
    record !==
      null &&
    isCompactString(
      record.namespace,
      2048,
    ) &&
    isCompactString(
      record.keyType,
      2048,
    ) &&
    isLowerHex(
      record.publicKeyHex,
    )
  );
}

function sameExternalKey(
  left: ConcordiumCis8ExternalKeyIdV1,
  right: ConcordiumCis8ExternalKeyIdV1,
): boolean {
  return (
    left.namespace ===
      right.namespace &&
    left.keyType ===
      right.keyType &&
    left.publicKeyHex ===
      right.publicKeyHex
  );
}

function parseStructuredExternalReference(
  value: unknown,
):
  | {
      readonly status: "missing";
    }
  | {
      readonly status: "native";
    }
  | {
      readonly status: "invalid";
    }
  | {
      readonly status: "unsupported_kind";
    }
  | {
      readonly status: "cis8";
      readonly value:
        ConcordiumCis8004ExternalReferenceV1;
    } {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return {
      status:
        "missing",
    };
  }

  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null
  ) {
    return {
      status:
        "invalid",
    };
  }

  if (
    record.kind ===
      "native" ||
    record.kind ===
      "Native"
  ) {
    return {
      status:
        "native",
    };
  }

  if (
    typeof record.kind !==
      "string"
  ) {
    return {
      status:
        "invalid",
    };
  }

  if (
    record.kind !==
      "CIS-8"
  ) {
    return {
      status:
        "unsupported_kind",
    };
  }

  const contractAddress =
    asRecord(
      record.contractAddress,
    );

  const externalKeyId =
    asRecord(
      record.externalKeyId,
    );

  if (
    contractAddress ===
      null ||
    externalKeyId ===
      null ||
    !isExternalKey(
      externalKeyId,
    )
  ) {
    return {
      status:
        "invalid",
    };
  }

  if (
    !isCanonicalTokenId(
      contractAddress.index,
    ) ||
    typeof contractAddress.subindex !==
      "number" ||
    !Number.isSafeInteger(
      contractAddress.subindex,
    ) ||
    contractAddress.subindex <
      0
  ) {
    return {
      status:
        "invalid",
    };
  }

  return {
    status:
      "cis8",

    value:
      value as ConcordiumCis8004ExternalReferenceV1,
  };
}

function decodeEd25519Jwk(
  document:
    BuyerToAgentDelegationCredentialDocument,
): {
  readonly publicKeyHex: string;
  readonly fingerprint: string;
} | null {
  const jwk =
    document
      .credential
      .subject
      .agentPublicKeyJwk;

  if (
    jwk.kty !==
      "OKP" ||
    jwk.crv !==
      "Ed25519" ||
    typeof jwk.x !==
      "string" ||
    !/^[A-Za-z0-9_-]+$/.test(
      jwk.x,
    )
  ) {
    return null;
  }

  try {
    const bytes =
      Buffer.from(
        jwk.x,
        "base64url",
      );

    if (
      bytes.length !==
        32 ||
      bytes.toString(
        "base64url",
      ) !==
        jwk.x
    ) {
      return null;
    }

    const publicKeyHex =
      bytes.toString(
        "hex",
      );

    const fingerprint =
      `sha256:${
        createHash(
          "sha256",
        )
          .update(
            bytes,
          )
          .digest(
            "hex",
          )
      }`;

    return {
      publicKeyHex,
      fingerprint,
    };
  } catch {
    return null;
  }
}

function buildResult(
  state:
    ResultState,
): AgentRegistryIdentityKeyBindingResultV1 {
  const accepted =
    state.reason ===
      "accepted" ||
    state.reason ===
      "accepted_without_external_key";

  return {
    type:
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    mode:
      AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,

    ok:
      accepted,

    status:
      accepted
        ? "accepted"
        : "rejected",

    reason:
      state.reason,

    testOnly:
      true,

    policy:
      state.policy,

    bindingEvaluated:
      state.bindingEvaluated ??
      false,

    baseRegistryTrustVerified:
      state.baseRegistryTrustVerified ??
      false,

    registryTrustPreserved:
      state.registryTrustPreserved ??
      false,

    credentialHash:
      state.credentialHash ??
      null,

    agentId:
      state.agentId ??
      null,

    agentKeyId:
      state.agentKeyId ??
      null,

    agentTokenId:
      state.agentTokenId ??
      null,

    ownerAccount:
      state.ownerAccount ??
      null,

    externalReferencePresent:
      state.externalReferencePresent ??
      false,

    sameSnapshot:
      state.sameSnapshot ??
      false,

    cis8LookupAttempted:
      state.cis8LookupAttempted ??
      false,

    cis8RegistrationActive:
      state.cis8RegistrationActive ??
      false,

    keyBinding:
      state.keyBinding ?? {
        required:
          state.policy ===
          "required",

        verified:
          false,

        bindingType:
          null,

        keyFingerprint:
          null,
      },

    gatewayRuntimeChanged:
      false,

    phase5StateMutated:
      false,

    canonicalStateMutated:
      false,

    boundedUseConsumed:
      false,

    replayStateMutated:
      false,

    ufxCalled:
      false,

    crpCalled:
      false,

    paymentAttempted:
      false,

    receiptIssued:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
      false,

    transactionSubmitted:
      false,

    signingKeyUsed:
      false,

    persistenceUsed:
      false,

    productionActivation:
      false,
  };
}

function updateBindingContext(
  context:
    BindingResultContext,

  overrides:
    BindingResultOverrides,
): BindingResultContext {
  return {
    ...context,
    ...overrides,

    policy:
      context.policy,
  };
}

function finishBindingDecision(
  context:
    BindingResultContext,

  reason:
    AgentRegistryIdentityKeyBindingReasonV1,

  overrides:
    BindingResultOverrides = {},
): AgentRegistryIdentityKeyBindingResultV1 {
  return buildResult({
    ...updateBindingContext(
      context,
      overrides,
    ),

    reason,
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>(
    (
      resolve,
      reject,
    ) => {
      const timer =
        setTimeout(
          () => {
            reject(
              new Error(
                "cis8_read_timeout",
              ),
            );
          },
          timeoutMs,
        );

      promise.then(
        (value) => {
          clearTimeout(
            timer,
          );

          resolve(
            value,
          );
        },
        (error) => {
          clearTimeout(
            timer,
          );

          reject(
            error,
          );
        },
      );
    },
  );
}

function parseReadResult(
  value: unknown,
):
  | {
      readonly ok: true;
      readonly value:
        ConcordiumCis8FinalizedReadResultV1;
    }
  | {
      readonly ok: false;

      readonly reason?:
        "registration_status_malformed";
    } {
  const record =
    asRecord(
      value,
    );

  if (
    record ===
      null ||
    record.type !==
      CONCORDIUM_CIS8_READ_RESULT_TYPE ||
    record.version !==
      AGENT_REGISTRY_CONTRACT_VERSION ||
    !isCompactString(
      record.network,
      2048,
    ) ||
    !isLowerHex(
      record.moduleReference,
      32,
    ) ||
    !sameContractCoordinate(
      record.cis8Contract,
      record.cis8Contract,
    ) ||
    !sameSnapshot(
      record.snapshot,
      record.snapshot,
    )
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    record.registration !==
      null
  ) {
    const registration =
      asRecord(
        record.registration,
      );

    if (
      registration ===
        null ||
      !isExternalKey(
        registration.externalKey,
      ) ||
      !isCompactString(
        registration.owner,
        2048,
      ) ||
      !isCompactString(
        registration.proofScheme,
        2048,
      ) ||
      normalizeIsoTimestamp(
        registration.lastUpdated,
      ) ===
        null ||
      !Array.isArray(
        registration.metadata,
      )
    ) {
      return {
        ok:
          false,
      };
    }

    if (
      registration.status !==
        "Active" &&
      registration.status !==
        "Revoked"
    ) {
      return {
        ok:
          false,

        reason:
          "registration_status_malformed",
      };
    }
  }

  return {
    ok:
      true,

    value:
      value as ConcordiumCis8FinalizedReadResultV1,
  };
}

export async function bindAgentRegistryIdentityToPhase5ActingKeyV1(
  input:
    AgentRegistryIdentityKeyBindingInputV1,
): Promise<AgentRegistryIdentityKeyBindingResultV1> {
  const policy =
    input.externalKeyPolicy;

  let context:
    BindingResultContext = {
      policy:
        AGENT_REGISTRY_EXTERNAL_KEY_POLICIES.includes(
          policy,
        )
          ? policy
          : "required",
    };

  if (
    !AGENT_REGISTRY_EXTERNAL_KEY_POLICIES.includes(
      policy,
    )
  ) {
    return finishBindingDecision(
      context,
      "external_reference_invalid",
    );
  }

  const phase5 =
    asRecord(
      input.phase5BindingResult,
    );

  if (
    phase5 ===
      null ||
    phase5.ok !==
      true ||
    phase5.status !==
      "accepted" ||
    phase5.reason !==
      "accepted" ||
    phase5.cryptographicDelegationVerification !==
      true ||
    phase5.buyerSignatureVerified !==
      true ||
    phase5.agentProofOfPossessionVerified !==
      true ||
    !isCompactString(
      phase5.credentialHash,
      512,
    ) ||
    !isCompactString(
      phase5.agentId,
      2048,
    ) ||
    !isCompactString(
      phase5.agentKeyId,
      2048,
    )
  ) {
    return finishBindingDecision(
      context,
      "phase5_binding_not_accepted",
    );
  }

  context =
    updateBindingContext(
      context,
      {
        credentialHash:
          phase5.credentialHash,

        agentId:
          phase5.agentId,

        agentKeyId:
          phase5.agentKeyId,
      },
    );

  const contractValidation =
    validateBuyerToAgentDelegationCredentialContract(
      input.delegationDocument,
    );

  if (
    !contractValidation.ok
  ) {
    return finishBindingDecision(
      context,
      "credential_contract_invalid",
    );
  }

  const document =
    input.delegationDocument as
      BuyerToAgentDelegationCredentialDocument;

  const credentialHash =
    hashBuyerToAgentDelegationCredential(
      document.credential,
    );

  context =
    updateBindingContext(
      context,
      {
        credentialHash,
      },
    );

  if (
    phase5.credentialHash !==
      credentialHash ||
    contractValidation.credentialHash !==
      credentialHash
  ) {
    return finishBindingDecision(
      context,
      "credential_hash_mismatch",
    );
  }

  if (
    document.credential.subject.agentId !==
      phase5.agentId ||
    contractValidation.agentId !==
      phase5.agentId
  ) {
    return finishBindingDecision(
      context,
      "agent_identity_mismatch",
    );
  }

  if (
    document.credential.subject.agentKeyId !==
      phase5.agentKeyId ||
    contractValidation.agentKeyId !==
      phase5.agentKeyId
  ) {
    return finishBindingDecision(
      context,
      "agent_key_identity_mismatch",
    );
  }

  const actingKey =
    decodeEd25519Jwk(
      document,
    );

  if (
    actingKey ===
      null
  ) {
    return finishBindingDecision(
      context,
      "invalid_agent_public_key",
    );
  }

  const trust =
    asRecord(
      input.registryTrustResult,
    );

  const trustIdentity =
    asRecord(
      trust?.identity,
    );

  const trustState =
    asRecord(
      trust?.state,
    );

  const trustFreshness =
    asRecord(
      trust?.freshness,
    );

  const existingBinding =
    asRecord(
      trust?.keyBinding,
    );

  if (
    trust ===
      null ||
    trust.verified !==
      true ||
    trustIdentity ===
      null ||
    trustState ===
      null ||
    trustFreshness ===
      null ||
    trustState.status !==
      "Active" ||
    !isCanonicalTokenId(
      trustIdentity.agentTokenId,
    ) ||
    !isCompactString(
      trustState.ownerAccount,
      2048,
    )
  ) {
    return finishBindingDecision(
      context,
      "registry_trust_not_verified",
    );
  }

  context =
    updateBindingContext(
      context,
      {
        agentTokenId:
          trustIdentity.agentTokenId,

        ownerAccount:
          trustState.ownerAccount,

        baseRegistryTrustVerified:
          true,
      },
    );

  if (
    existingBinding !==
      null &&
    existingBinding.verified ===
      true
  ) {
    return finishBindingDecision(
      context,
      "forged_verified_binding",
    );
  }

  if (
    existingBinding !==
      null &&
    (
      existingBinding.bindingType ===
        "native" ||
      existingBinding.bindingType ===
        "Native"
    )
  ) {
    return finishBindingDecision(
      context,
      "native_binding_not_supported",
    );
  }

  const registryRead =
    asRecord(
      input.registryReadResult,
    );

  const registryRecord =
    asRecord(
      registryRead?.record,
    );

  if (
    registryRead ===
      null ||
    registryRead.type !==
      CONCORDIUM_CIS8004_READ_RESULT_TYPE ||
    registryRead.version !==
      AGENT_REGISTRY_CONTRACT_VERSION ||
    !isCompactString(
      registryRead.network,
      2048,
    ) ||
    !sameSnapshot(
      registryRead.snapshot,
      registryRead.snapshot,
    )
  ) {
    return finishBindingDecision(
      context,
      "registry_read_result_invalid",
    );
  }

  if (
    !sameSnapshot(
      trustFreshness,
      registryRead.snapshot,
    )
  ) {
    return finishBindingDecision(
      context,
      "snapshot_mismatch",
    );
  }

  context =
    updateBindingContext(
      context,
      {
        sameSnapshot:
          true,
      },
    );

  if (
    registryRecord ===
      null
  ) {
    return finishBindingDecision(
      context,
      "registry_record_missing",
    );
  }

  if (
    registryRecord.status !==
      "Active"
  ) {
    return finishBindingDecision(
      context,
      "registry_record_not_active",
    );
  }

  if (
    !isCanonicalTokenId(
      input.expectedAgentTokenId,
    ) ||
    trustIdentity.agentTokenId !==
      input.expectedAgentTokenId ||
    registryRecord.tokenId !==
      input.expectedAgentTokenId
  ) {
    return finishBindingDecision(
      context,
      "agent_token_mismatch",
    );
  }

  if (
    registryRecord.ownerAccount !==
      trustState.ownerAccount
  ) {
    return finishBindingDecision(
      context,
      "registry_owner_mismatch",
    );
  }

  const externalReference =
    parseStructuredExternalReference(
      registryRecord.externalReference,
    );

  if (
    externalReference.status ===
      "native"
  ) {
    return buildResult({
      reason:
        "native_binding_not_supported",

      policy,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      baseRegistryTrustVerified:
        true,

      sameSnapshot:
        true,

      externalReferencePresent:
        true,
    });
  }

  context =
    updateBindingContext(
      context,
      {
        bindingEvaluated:
          true,

        agentTokenId:
          input.expectedAgentTokenId,
      },
    );

  if (
    externalReference.status ===
      "missing"
  ) {
    if (
      policy ===
        "required"
    ) {
      return finishBindingDecision(
        context,
        "external_key_required",
      );
    }

    return finishBindingDecision(
      context,
      "accepted_without_external_key",
      {
        registryTrustPreserved:
          true,

        keyBinding: {
          required:
            false,

          verified:
            false,

          bindingType:
            null,

          keyFingerprint:
            null,
        },
      },
    );
  }

  if (
    policy ===
      "forbidden"
  ) {
    return finishBindingDecision(
      context,
      "external_key_forbidden",
      {
        externalReferencePresent:
          true,
      },
    );
  }

  if (
    externalReference.status ===
      "unsupported_kind"
  ) {
    return finishBindingDecision(
      context,
      "unsupported_external_reference_kind",
      {
        externalReferencePresent:
          true,
      },
    );
  }

  if (
    externalReference.status !==
      "cis8"
  ) {
    return finishBindingDecision(
      context,
      "external_reference_invalid",
      {
        externalReferencePresent:
          true,
      },
    );
  }

  context =
    updateBindingContext(
      context,
      {
        externalReferencePresent:
          true,
      },
    );

  const trustedCis8 =
    input.trustedCis8 ??
    CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG;

  if (
    registryRead.network !==
      trustedCis8.network ||
    !sameContractCoordinate(
      externalReference
        .value
        .contractAddress,
      trustedCis8.contract,
    )
  ) {
    return finishBindingDecision(
      context,
      "untrusted_cis8_contract",
    );
  }

  if (
    externalReference
      .value
      .externalKeyId
      .keyType !==
      "ed25519"
  ) {
    return finishBindingDecision(
      context,
      "unsupported_external_key_type",
    );
  }

  if (
    externalReference
      .value
      .externalKeyId
      .publicKeyHex !==
      actingKey.publicKeyHex
  ) {
    return finishBindingDecision(
      context,
      "agent_public_key_mismatch",
    );
  }

  const transport =
    input.transport ??
    new ConcordiumGrpcCis8ReadTransportV1();

  if (
    transport.kind !==
      CONCORDIUM_CIS8_TRANSPORT_KIND
  ) {
    return finishBindingDecision(
      context,
      "cis8_transport_unavailable",
    );
  }

  context =
    updateBindingContext(
      context,
      {
        cis8LookupAttempted:
          true,
      },
    );

  let transportOutput:
    unknown;

  try {
    transportOutput =
      await withTimeout(
        transport.read({
          config:
            trustedCis8,

          snapshot:
            registryRead
              .snapshot as
              ConcordiumCis8004FinalizedSnapshotV1,

          externalKey:
            externalReference
              .value
              .externalKeyId,
        }),
        trustedCis8.timeoutMs,
      );
  } catch {
    return finishBindingDecision(
      context,
      "cis8_transport_unavailable",
    );
  }

  const parsedRead =
    parseReadResult(
      transportOutput,
    );

  if (
    !parsedRead.ok
  ) {
    return finishBindingDecision(
      context,
      parsedRead.reason ===
        "registration_status_malformed"
        ? "cis8_registration_malformed"
        : "cis8_read_result_invalid",
    );
  }

  const cis8Read =
    parsedRead.value;

  if (
    cis8Read.network !==
      trustedCis8.network ||
    !sameContractCoordinate(
      cis8Read.cis8Contract,
      trustedCis8.contract,
    ) ||
    cis8Read.moduleReference !==
      trustedCis8.moduleReference
  ) {
    return buildResult({
      reason:
        "cis8_read_result_invalid",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,
    });
  }

  if (
    !sameSnapshot(
      cis8Read.snapshot,
      registryRead.snapshot,
    )
  ) {
    return buildResult({
      reason:
        "snapshot_mismatch",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      cis8LookupAttempted:
        true,
    });
  }

  const registration =
    cis8Read.registration;

  if (
    registration ===
      null
  ) {
    return buildResult({
      reason:
        "cis8_registration_missing",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,
    });
  }

  if (
    registration.status ===
      "Revoked"
  ) {
    return buildResult({
      reason:
        "cis8_registration_revoked",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,
    });
  }

  if (
    registration.status !==
      "Active"
  ) {
    return buildResult({
      reason:
        "cis8_registration_malformed",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,
    });
  }

  if (
    registration.owner !==
      registryRecord.ownerAccount
  ) {
    return buildResult({
      reason:
        "cis8_owner_mismatch",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,

      cis8RegistrationActive:
        true,
    });
  }

  if (
    !sameExternalKey(
      registration.externalKey,
      externalReference
        .value
        .externalKeyId,
    )
  ) {
    return buildResult({
      reason:
        "cis8_external_key_mismatch",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,

      cis8RegistrationActive:
        true,
    });
  }

  if (
    registration
      .externalKey
      .publicKeyHex !==
      actingKey.publicKeyHex
  ) {
    return buildResult({
      reason:
        "agent_public_key_mismatch",

      policy,

      bindingEvaluated:
        true,

      baseRegistryTrustVerified:
        true,

      credentialHash,

      agentId:
        phase5.agentId,

      agentKeyId:
        phase5.agentKeyId,

      agentTokenId:
        input.expectedAgentTokenId,

      ownerAccount:
        trustState.ownerAccount,

      externalReferencePresent:
        true,

      sameSnapshot:
        true,

      cis8LookupAttempted:
        true,

      cis8RegistrationActive:
        true,
    });
  }

  return buildResult({
    reason:
      "accepted",

    policy,

    bindingEvaluated:
      true,

    baseRegistryTrustVerified:
      true,

    registryTrustPreserved:
      true,

    credentialHash,

    agentId:
      phase5.agentId,

    agentKeyId:
      phase5.agentKeyId,

    agentTokenId:
      input.expectedAgentTokenId,

    ownerAccount:
      trustState.ownerAccount,

    externalReferencePresent:
      true,

    sameSnapshot:
      true,

    cis8LookupAttempted:
      true,

    cis8RegistrationActive:
      true,

    keyBinding: {
      required:
        policy ===
        "required",

      verified:
        true,

      bindingType:
        "CIS-8",

      keyFingerprint:
        actingKey.fingerprint,
    },
  });
}

function safeModuleReference(
  value: unknown,
  sdk: any,
): string | null {
  try {
    const rendered =
      sdk
        .ModuleReference
        .toHexString(
          value,
        );

    return isLowerHex(
      rendered,
      32,
    )
      ? rendered
      : null;
  } catch {
    const rendered =
      typeof value ===
        "string"
        ? value
        : asRecord(
            value,
          )?.value;

    return isLowerHex(
      rendered,
      32,
    )
      ? rendered
      : null;
  }
}

function safeBlockHeight(
  value: unknown,
): number | null {
  if (
    typeof value ===
      "bigint"
  ) {
    const numberValue =
      Number(
        value,
      );

    return Number.isSafeInteger(
      numberValue,
    ) &&
    numberValue >=
      0
      ? numberValue
      : null;
  }

  return (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value >=
      0
  )
    ? value
    : null;
}

function blockHashFromHex(
  sdk: any,
  value: string,
): unknown {
  if (
    typeof sdk
      ?.BlockHash
      ?.fromHexString ===
      "function"
  ) {
    return sdk
      .BlockHash
      .fromHexString(
        value,
      );
  }

  if (
    typeof sdk
      ?.BlockHash
      ?.fromString ===
      "function"
  ) {
    return sdk
      .BlockHash
      .fromString(
        value,
      );
  }

  return value;
}

export class ConcordiumGrpcCis8ReadTransportV1
implements ConcordiumCis8ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8_TRANSPORT_KIND;

  async read(
    request:
      ConcordiumCis8ReadRequestV1,
  ): Promise<unknown> {
    if (
      request.config.transport !==
        CONCORDIUM_CIS8_TRANSPORT_KIND ||
      !sameSnapshot(
        request.snapshot,
        request.snapshot,
      ) ||
      !isExternalKey(
        request.externalKey,
      )
    ) {
      throw new Error(
        "invalid_cis8_read_request",
      );
    }

    const sdkIndexPath =
      require.resolve(
        "@concordium/web-sdk",
      );

    const sdkDirectory =
      path.dirname(
        sdkIndexPath,
      );

    const grpcModulePath =
      path.join(
        sdkDirectory,
        "nodejs",
        "grpc.js",
      );

    const [
      grpcModule,
      sdk,
    ]: [
      any,
      any,
    ] =
      await Promise.all([
        import(
          pathToFileURL(
            grpcModulePath,
          ).href as any
        ),
        import(
          "@concordium/web-sdk"
        ),
      ]);

    const credentials =
      request.config.grpc.tls
        ? grpcModule
            .credentials
            .createSsl()
        : grpcModule
            .credentials
            .createInsecure();

    const client =
      new grpcModule
        .ConcordiumGRPCNodeClient(
          request.config.grpc.host,
          request.config.grpc.port,
          credentials,
        );

    const block =
      blockHashFromHex(
        sdk,
        request
          .snapshot
          .finalizedBlockHash,
      );

    const blockInfo =
      await client
        .getBlockInfo(
          block,
        );

    const blockHeight =
      safeBlockHeight(
        blockInfo?.blockHeight,
      );

    const observedAt =
      normalizeIsoTimestamp(
        blockInfo?.blockSlotTime,
      );

    if (
      blockInfo ===
        null ||
      blockInfo ===
        undefined ||
      blockInfo.finalized !==
        true ||
      blockHeight !==
        request
          .snapshot
          .finalizedBlockHeight ||
      observedAt !==
        normalizeIsoTimestamp(
          request
            .snapshot
            .observedAt,
        )
    ) {
      throw new Error(
        "cis8_snapshot_mismatch",
      );
    }

    const contractAddress =
      sdk.ContractAddress.create(
        BigInt(
          request
            .config
            .contract
            .index,
        ),
        BigInt(
          request
            .config
            .contract
            .subindex,
        ),
      );

    const instanceInfo =
      await client
        .getInstanceInfo(
          contractAddress,
          block,
        );

    if (
      instanceInfo ===
        null ||
      instanceInfo ===
        undefined
    ) {
      throw new Error(
        "cis8_contract_not_found",
      );
    }

    const moduleReference =
      safeModuleReference(
        instanceInfo.sourceModule,
        sdk,
      );

    if (
      moduleReference ===
        null ||
      moduleReference !==
        request
          .config
          .moduleReference
    ) {
      throw new Error(
        "cis8_module_reference_mismatch",
      );
    }

    const embeddedSchema =
      await client
        .getEmbeddedSchema(
          instanceInfo.sourceModule,
          block,
        );

    if (
      embeddedSchema ===
        null ||
      embeddedSchema ===
        undefined
    ) {
      throw new Error(
        "cis8_embedded_schema_unavailable",
      );
    }

    const contractName =
      sdk
        .ContractName
        .fromStringUnchecked(
          request
            .config
            .contractName,
        );

    const entrypointName =
      sdk
        .EntrypointName
        .fromString(
          request
            .config
            .entrypoint,
        );

    const parameter =
      sdk
        .serializeUpdateContractParameters(
          contractName,
          entrypointName,
          {
            external_key: {
              namespace:
                request
                  .externalKey
                  .namespace,

              key_type:
                request
                  .externalKey
                  .keyType,

              public_key:
                Array.from(
                  Buffer.from(
                    request
                      .externalKey
                      .publicKeyHex,
                    "hex",
                  ),
                  (byte) =>
                    BigInt(
                      byte,
                    ),
                ),
            },
          },
          embeddedSchema.buffer,
        );

    const invocation =
      await client
        .invokeContract(
          {
            method:
              sdk
                .ReceiveName
                .fromString(
                  [
                    request
                      .config
                      .contractName,
                    request
                      .config
                      .entrypoint,
                  ].join(
                    ".",
                  ),
                ),

            contract:
              contractAddress,

            parameter,
          },
          block,
        );

    if (
      invocation ===
        null ||
      invocation ===
        undefined ||
      invocation.tag !==
        "success" ||
      invocation.returnValue ===
        null ||
      invocation.returnValue ===
        undefined
    ) {
      throw new Error(
        "cis8_ownerofkey_invocation_failed",
      );
    }

    const rawReturnValue =
      sdk.unwrap(
        invocation.returnValue,
      );

    const decoded =
      sdk
        .deserializeReceiveReturnValue(
          sdk
            .ReturnValue
            .toBuffer(
              rawReturnValue,
            ),
          embeddedSchema.buffer,
          contractName,
          entrypointName,
        );

    const parsed =
      parseDecodedOwnerOfKeyResult(
        decoded,
      );

    if (
      !parsed.ok
    ) {
      throw new Error(
        "invalid_cis8_ownerofkey_result",
      );
    }

    const result:
      ConcordiumCis8FinalizedReadResultV1 = {
        type:
          CONCORDIUM_CIS8_READ_RESULT_TYPE,

        version:
          AGENT_REGISTRY_CONTRACT_VERSION,

        network:
          request.config.network,

        cis8Contract: {
          index:
            request
              .config
              .contract
              .index,

          subindex:
            request
              .config
              .contract
              .subindex,
        },

        moduleReference,

        snapshot:
          request.snapshot,

        registration:
          parsed.value,
      };

    return result;
  }
}
