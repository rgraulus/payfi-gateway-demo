/**
 * Phase 6 Concordium CIS-8004 Agent Registry Plugin.
 *
 * PR #300 adds a read-only direct-chain resolver implementation:
 * - pins one trusted Concordium Testnet registry configuration;
 * - reads one latest-finalized snapshot;
 * - verifies the registry instance module reference;
 * - invokes CIS-8004 agentOf at that exact snapshot;
 * - normalizes Active, Revoked, and Missing registry state;
 * - returns PR #298 trust-result contracts through the PR #299 resolver shape;
 * - fails closed on timeout, transport failure, malformed state, or mismatch.
 *
 * This module performs no transaction submission, signing, persistence,
 * Gateway runtime integration, payment action, receipt action, replay
 * mutation, resource release, or production activation.
 */

import { Buffer } from "node:buffer";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_STANDARD,
  AGENT_REGISTRY_TRUST_RESULT_TYPE,
  type AgentRegistryContractCoordinateV1,
  type AgentRegistryReferenceV1,
  type AgentRegistryRequirementV1,
  type AgentRegistryTrustReasonV1,
  type AgentRegistryTrustResultV1,
  validateAgentRegistryReferenceV1,
  validateAgentRegistryRequirementV1,
} from "./agentRegistryTrustContract";

import type {
  AgentRegistryResolverRequestV1,
  AgentRegistryResolverUnavailableV1,
} from "./agentRegistryResolverSeam";

export const CONCORDIUM_CIS8004_RESOLVER_KIND =
  "xcf.agent-registry.resolver" as const;

export const CONCORDIUM_CIS8004_RESOLVER_MODE =
  "concordium_cis8004" as const;

export const CONCORDIUM_CIS8004_TRANSPORT_KIND =
  "direct_chain" as const;

export const CONCORDIUM_CIS8004_READ_RESULT_TYPE =
  "xcf.concordium.cis8004.read-result" as const;

export const CONCORDIUM_CIS8004_RESOLVER_REQUEST_TYPE =
  "xcf.agent-registry.resolve-request" as const;

export const CONCORDIUM_CIS8004_RESOLVER_UNAVAILABLE_TYPE =
  "xcf.agent-registry.resolver-unavailable" as const;

export const CONCORDIUM_CIS8004_AGENT_STATUSES = [
  "Active",
  "Revoked",
] as const;

export type ConcordiumCis8004AgentStatusV1 =
  (typeof CONCORDIUM_CIS8004_AGENT_STATUSES)[number];

export type ConcordiumCis8004TrustedRegistryConfigV1 = {
  readonly network: string;

  readonly registryStandard:
    typeof AGENT_REGISTRY_STANDARD;

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
    typeof CONCORDIUM_CIS8004_TRANSPORT_KIND;
};

export const CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG:
  ConcordiumCis8004TrustedRegistryConfigV1 =
  Object.freeze({
    network:
      "ccd:testnet",

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    contract:
      Object.freeze({
        index:
          "12802",

        subindex:
          0,
      }),

    moduleReference:
      "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41",

    contractName:
      "CIS-8004",

    entrypoint:
      "agentOf",

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
      CONCORDIUM_CIS8004_TRANSPORT_KIND,
  });

export type ConcordiumCis8004FinalizedSnapshotV1 = {
  readonly finalizedBlockHash: string;
  readonly finalizedBlockHeight: number;
  readonly observedAt: string;
  readonly finalized: true;
};

export type ConcordiumCis8004AgentRecordV1 = {
  readonly tokenId: string;

  readonly ownerAccount: string;

  readonly agentUri: string | null;

  readonly metadataHash: string | null;

  readonly externalReference: string | null;

  readonly agentWallet: string | null;

  readonly status:
    ConcordiumCis8004AgentStatusV1;

  readonly registeredAt: string;

  readonly revokedAt: string | null;

  readonly revocationReason: string | null;
};

export type ConcordiumCis8004ReadResultV1 = {
  readonly type:
    typeof CONCORDIUM_CIS8004_READ_RESULT_TYPE;

  readonly version:
    typeof AGENT_REGISTRY_CONTRACT_VERSION;

  readonly network: string;

  readonly registryContract:
    AgentRegistryContractCoordinateV1;

  readonly moduleReference: string;

  readonly snapshot:
    ConcordiumCis8004FinalizedSnapshotV1;

  readonly record:
    ConcordiumCis8004AgentRecordV1 | null;
};

export type ConcordiumCis8004ReadRequestV1 = {
  readonly config:
    ConcordiumCis8004TrustedRegistryConfigV1;

  readonly agentTokenId: string;
};

/**
 * Read boundary for deterministic testing and direct-chain transport.
 *
 * The transport returns unknown so the plugin must validate the result at
 * runtime before constructing an AgentRegistryTrustResultV1.
 */
export interface ConcordiumCis8004ReadTransportV1 {
  readonly kind:
    typeof CONCORDIUM_CIS8004_TRANSPORT_KIND;

  read(
    request:
      ConcordiumCis8004ReadRequestV1,
  ): Promise<unknown>;
}

export type ConcordiumCis8004ClockV1 =
  () => Date;

type UnknownRecord =
  Record<string, unknown>;

type ParsedOption =
  | {
      readonly ok: true;
      readonly value: unknown | null;
    }
  | {
      readonly ok: false;
    };

const MAX_U64 =
  18_446_744_073_709_551_615n;

const READ_RESULT_KEYS = [
  "type",
  "version",
  "network",
  "registryContract",
  "moduleReference",
  "snapshot",
  "record",
] as const;

const SNAPSHOT_KEYS = [
  "finalizedBlockHash",
  "finalizedBlockHeight",
  "observedAt",
  "finalized",
] as const;

const RECORD_KEYS = [
  "tokenId",
  "ownerAccount",
  "agentUri",
  "metadataHash",
  "externalReference",
  "agentWallet",
  "status",
  "registeredAt",
  "revokedAt",
  "revocationReason",
] as const;

const CONTRACT_COORDINATE_KEYS = [
  "index",
  "subindex",
] as const;

const AGENT_OF_RECORD_KEYS = [
  "token_id",
  "owner_account",
  "agent_uri",
  "metadata_hash",
  "external_reference",
  "agent_wallet",
  "status",
  "registered_at",
  "revoked_at",
  "revocation_reason",
  "on_chain_metadata",
] as const;

function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    typeof value !==
      "object" ||
    value ===
      null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function hasExactKeys(
  value: UnknownRecord,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys =
    Object.keys(value);

  return (
    actualKeys.length ===
      expectedKeys.length &&
    actualKeys.every(
      (key) =>
        expectedKeys.includes(key),
    )
  );
}

function isNonEmptyTrimmedString(
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
    value ===
      value.trim()
  );
}

function isCompactString(
  value: unknown,
  maximumLength = 4096,
): value is string {
  return (
    isNonEmptyTrimmedString(
      value,
      maximumLength,
    ) &&
    !/\s/.test(value)
  );
}

function sanitizeCompactString(
  value: string | null,
  maximumLength = 4096,
): string | null {
  return isCompactString(
    value,
    maximumLength,
  )
    ? value
    : null;
}

function isLowerHex64(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{64}$/.test(value)
  );
}

function isIsoTimestamp(
  value: unknown,
): value is string {
  return (
    isNonEmptyTrimmedString(
      value,
      128,
    ) &&
    Number.isFinite(
      Date.parse(value),
    )
  );
}

function normalizeIsoTimestamp(
  value: unknown,
): string | null {
  if (
    value instanceof
      Date &&
    Number.isFinite(
      value.getTime(),
    )
  ) {
    return value.toISOString();
  }

  if (
    typeof value ===
      "object" &&
    value !==
      null
  ) {
    const candidate =
      value as {
        toISOString?: () => string;
        toJSON?: () => unknown;
        toString?: () => string;
      };

    try {
      if (
        typeof candidate.toISOString ===
          "function"
      ) {
        const rendered =
          candidate.toISOString();

        if (
          isIsoTimestamp(
            rendered,
          )
        ) {
          return new Date(
            rendered,
          ).toISOString();
        }
      }
    } catch {
      // Try the remaining representations.
    }

    try {
      if (
        typeof candidate.toJSON ===
          "function"
      ) {
        const rendered =
          candidate.toJSON();

        if (
          isIsoTimestamp(
            rendered,
          )
        ) {
          return new Date(
            rendered,
          ).toISOString();
        }
      }
    } catch {
      // Try string conversion below.
    }
  }

  try {
    const rendered =
      String(value);

    if (
      isIsoTimestamp(
        rendered,
      )
    ) {
      return new Date(
        rendered,
      ).toISOString();
    }
  } catch {
    // Return null below.
  }

  return null;
}

function isCanonicalTokenId(
  value: unknown,
): value is string {
  if (
    typeof value !==
      "string" ||
    !/^(0|[1-9]\d*)$/.test(value)
  ) {
    return false;
  }

  try {
    const parsed =
      BigInt(value);

    return (
      parsed >=
        0n &&
      parsed <=
        MAX_U64
    );
  } catch {
    return false;
  }
}

function tokenIdToU64LittleEndianHex(
  tokenId: string,
): string {
  if (
    !isCanonicalTokenId(
      tokenId,
    )
  ) {
    throw new Error(
      "invalid_cis8004_agent_token_id",
    );
  }

  let remaining =
    BigInt(tokenId);

  const bytes =
    Buffer.alloc(8);

  for (
    let index =
      0;
    index <
      bytes.length;
    index +=
      1
  ) {
    bytes[index] =
      Number(
        remaining &
          0xffn,
      );

    remaining >>=
      8n;
  }

  return bytes.toString(
    "hex",
  );
}

function tokenIdFromU64LittleEndianHex(
  tokenIdHex: unknown,
): string | null {
  if (
    typeof tokenIdHex !==
      "string" ||
    !/^[0-9a-f]{16}$/.test(
      tokenIdHex,
    )
  ) {
    return null;
  }

  const bytes =
    Buffer.from(
      tokenIdHex,
      "hex",
    );

  let tokenId =
    0n;

  for (
    let index =
      bytes.length - 1;
    index >=
      0;
    index -=
      1
  ) {
    tokenId =
      (
        tokenId <<
          8n
      ) +
      BigInt(
        bytes[index],
      );
  }

  return tokenId.toString(
    10,
  );
}

function isContractCoordinate(
  value: unknown,
): value is AgentRegistryContractCoordinateV1 {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    hasExactKeys(
      record,
      CONTRACT_COORDINATE_KEYS,
    ) &&
    typeof record.index ===
      "string" &&
    /^(0|[1-9]\d*)$/.test(
      record.index,
    ) &&
    typeof record.subindex ===
      "number" &&
    Number.isSafeInteger(
      record.subindex,
    ) &&
    record.subindex >=
      0
  );
}

function sameContractCoordinate(
  left:
    AgentRegistryContractCoordinateV1,
  right:
    AgentRegistryContractCoordinateV1,
): boolean {
  return (
    left.index ===
      right.index &&
    left.subindex ===
      right.subindex
  );
}

function parseConcordiumOption(
  value: unknown,
): ParsedOption {
  const record =
    asRecord(value);

  if (
    record ===
      null
  ) {
    return {
      ok:
        false,
    };
  }

  if (
    hasExactKeys(
      record,
      [
        "None",
      ],
    ) &&
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
    hasExactKeys(
      record,
      [
        "Some",
      ],
    ) &&
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

function parseConcordiumStatus(
  value: unknown,
): ConcordiumCis8004AgentStatusV1 | null {
  const record =
    asRecord(value);

  if (
    record ===
      null
  ) {
    return null;
  }

  for (
    const status of
      CONCORDIUM_CIS8004_AGENT_STATUSES
  ) {
    if (
      hasExactKeys(
        record,
        [
          status,
        ],
      ) &&
      Array.isArray(
        record[status],
      ) &&
      (
        record[status] as unknown[]
      ).length ===
        0
    ) {
      return status;
    }
  }

  return null;
}

function parseHashByteArray(
  value: unknown,
): string | null {
  if (
    !Array.isArray(
      value,
    ) ||
    value.length !==
      32
  ) {
    return null;
  }

  const bytes:
    number[] = [];

  for (
    const child of
      value
  ) {
      const parsed =
        typeof child ===
          "number"
          ? child
          : (
              typeof child ===
                "bigint"
                ? (
                    child >=
                      0n &&
                    child <=
                      255n
                      ? Number(
                          child,
                        )
                      : Number.NaN
                  )
                : (
                    typeof child ===
                      "string" &&
                    /^\d+$/.test(
                      child,
                    )
                      ? Number(
                          child,
                        )
                      : Number.NaN
                  )
            );
    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed <
        0 ||
      parsed >
        255
    ) {
      return null;
    }

    bytes.push(
      parsed,
    );
  }

  const hash =
    Buffer.from(
      bytes,
    ).toString(
      "hex",
    );

  return isLowerHex64(
    hash,
  )
    ? hash
    : null;
}

function parseOptionalString(
  option: ParsedOption,
  maximumLength = 4096,
): string | null | undefined {
  if (
    !option.ok
  ) {
    return undefined;
  }

  if (
    option.value ===
      null
  ) {
    return null;
  }

  return isNonEmptyTrimmedString(
    option.value,
    maximumLength,
  )
    ? option.value
    : undefined;
}

function parseOptionalCompactString(
  option: ParsedOption,
  maximumLength = 4096,
): string | null | undefined {
  if (
    !option.ok
  ) {
    return undefined;
  }

  if (
    option.value ===
      null
  ) {
    return null;
  }

  return isCompactString(
    option.value,
    maximumLength,
  )
    ? option.value
    : undefined;
}

function parseOptionalIsoTimestamp(
  option: ParsedOption,
): string | null | undefined {
  if (
    !option.ok
  ) {
    return undefined;
  }

  if (
    option.value ===
      null
  ) {
    return null;
  }

  const timestamp =
    normalizeIsoTimestamp(
      option.value,
    );

  return timestamp ??
    undefined;
}

function normalizeDecodedAgentOfResult(
  value: unknown,
): ConcordiumCis8004AgentRecordV1 | null {
  const outer =
    parseConcordiumOption(
      value,
    );

  if (
    !outer.ok
  ) {
    throw new Error(
      "malformed_cis8004_agentof_option",
    );
  }

  if (
    outer.value ===
      null
  ) {
    return null;
  }

  const record =
    asRecord(
      outer.value,
    );

  if (
    record ===
      null ||
    !hasExactKeys(
      record,
      AGENT_OF_RECORD_KEYS,
    )
  ) {
    throw new Error(
      "malformed_cis8004_agent_record",
    );
  }

  const tokenId =
    tokenIdFromU64LittleEndianHex(
      record.token_id,
    );

  const status =
    parseConcordiumStatus(
      record.status,
    );

  const agentUri =
    parseOptionalString(
      parseConcordiumOption(
        record.agent_uri,
      ),
      4096,
    );

  const externalReference =
    parseOptionalString(
      parseConcordiumOption(
        record.external_reference,
      ),
      4096,
    );

  const agentWallet =
    parseOptionalCompactString(
      parseConcordiumOption(
        record.agent_wallet,
      ),
      2048,
    );

  const revokedAt =
    parseOptionalIsoTimestamp(
      parseConcordiumOption(
        record.revoked_at,
      ),
    );

  const revocationReason =
    parseOptionalString(
      parseConcordiumOption(
        record.revocation_reason,
      ),
      4096,
    );

  const metadataHashOption =
    parseConcordiumOption(
      record.metadata_hash,
    );

  let metadataHash:
    string | null | undefined;

  if (
    !metadataHashOption.ok
  ) {
    metadataHash =
      undefined;
  } else if (
    metadataHashOption.value ===
      null
  ) {
    metadataHash =
      null;
  } else {
    metadataHash =
      parseHashByteArray(
        metadataHashOption.value,
      ) ??
      undefined;
  }

  const registeredAt =
    normalizeIsoTimestamp(
      record.registered_at,
    );

  if (
    tokenId ===
      null ||
    status ===
      null ||
    !isCompactString(
      record.owner_account,
      2048,
    ) ||
    agentUri ===
      undefined ||
    metadataHash ===
      undefined ||
    externalReference ===
      undefined ||
    agentWallet ===
      undefined ||
    registeredAt ===
      null ||
    revokedAt ===
      undefined ||
    revocationReason ===
      undefined ||
    !Array.isArray(
      record.on_chain_metadata,
    )
  ) {
    throw new Error(
      "invalid_cis8004_agent_record",
    );
  }

  if (
    status ===
      "Active" &&
    (
      revokedAt !==
        null ||
      revocationReason !==
        null
    )
  ) {
    throw new Error(
      "contradictory_active_cis8004_agent_record",
    );
  }

  if (
    status ===
      "Revoked" &&
    revokedAt ===
      null
  ) {
    throw new Error(
      "contradictory_revoked_cis8004_agent_record",
    );
  }

  return {
    tokenId,

    ownerAccount:
      record.owner_account,

    agentUri,

    metadataHash,

    externalReference,

    agentWallet,

    status,

    registeredAt,

    revokedAt,

    revocationReason,
  };
}

  /**
   * Deterministic test access to the SDK decode normalizer.
   * Performs no network, transaction, signing, or persistence action.
   */
  export function normalizeConcordiumCis8004DecodedAgentOfResultForTestV1(
    value: unknown,
  ): ConcordiumCis8004AgentRecordV1 | null {
    return normalizeDecodedAgentOfResult(
      value,
    );
  }

function isNullableString(
  value: unknown,
  maximumLength = 4096,
): value is string | null {
  return (
    value ===
      null ||
    isNonEmptyTrimmedString(
      value,
      maximumLength,
    )
  );
}

function isNullableCompactString(
  value: unknown,
  maximumLength = 4096,
): value is string | null {
  return (
    value ===
      null ||
    isCompactString(
      value,
      maximumLength,
    )
  );
}

function isNullableLowerHex64(
  value: unknown,
): value is string | null {
  return (
    value ===
      null ||
    isLowerHex64(
      value,
    )
  );
}

function isAgentRecord(
  value: unknown,
): value is ConcordiumCis8004AgentRecordV1 {
  const record =
    asRecord(value);

  if (
    record ===
      null ||
    !hasExactKeys(
      record,
      RECORD_KEYS,
    ) ||
    !isCanonicalTokenId(
      record.tokenId,
    ) ||
    !isCompactString(
      record.ownerAccount,
      2048,
    ) ||
    !isNullableString(
      record.agentUri,
      4096,
    ) ||
    !isNullableLowerHex64(
      record.metadataHash,
    ) ||
    !isNullableString(
      record.externalReference,
      4096,
    ) ||
    !isNullableCompactString(
      record.agentWallet,
      2048,
    ) ||
    !CONCORDIUM_CIS8004_AGENT_STATUSES.includes(
      record.status as
        ConcordiumCis8004AgentStatusV1,
    ) ||
    !isIsoTimestamp(
      record.registeredAt,
    ) ||
    !(
      record.revokedAt ===
        null ||
      isIsoTimestamp(
        record.revokedAt,
      )
    ) ||
    !isNullableString(
      record.revocationReason,
      4096,
    )
  ) {
    return false;
  }

  if (
    record.status ===
      "Active"
  ) {
    return (
      record.revokedAt ===
        null &&
      record.revocationReason ===
        null
    );
  }

  return (
    record.status ===
      "Revoked" &&
    record.revokedAt !==
      null
  );
}

function isFinalizedSnapshot(
  value: unknown,
): value is ConcordiumCis8004FinalizedSnapshotV1 {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    hasExactKeys(
      record,
      SNAPSHOT_KEYS,
    ) &&
    isLowerHex64(
      record.finalizedBlockHash,
    ) &&
    typeof record.finalizedBlockHeight ===
      "number" &&
    Number.isSafeInteger(
      record.finalizedBlockHeight,
    ) &&
    record.finalizedBlockHeight >=
      0 &&
    isIsoTimestamp(
      record.observedAt,
    ) &&
    record.finalized ===
      true
  );
}

function isReadResult(
  value: unknown,
): value is ConcordiumCis8004ReadResultV1 {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    hasExactKeys(
      record,
      READ_RESULT_KEYS,
    ) &&
    record.type ===
      CONCORDIUM_CIS8004_READ_RESULT_TYPE &&
    record.version ===
      AGENT_REGISTRY_CONTRACT_VERSION &&
    isCompactString(
      record.network,
      2048,
    ) &&
    isContractCoordinate(
      record.registryContract,
    ) &&
    isLowerHex64(
      record.moduleReference,
    ) &&
    isFinalizedSnapshot(
      record.snapshot,
    ) &&
    (
      record.record ===
        null ||
      isAgentRecord(
        record.record,
      )
    )
  );
}

function safeModuleReference(
  value: unknown,
  sdk: any,
): string | null {
  try {
    const rendered =
      sdk.ModuleReference.toHexString(
        value,
      );

    if (
      isLowerHex64(
        rendered,
      )
    ) {
      return rendered;
    }
  } catch {
    // Try scalar conversion below.
  }

  try {
    const rendered =
      String(value);

    return isLowerHex64(
      rendered,
    )
      ? rendered
      : null;
  } catch {
    return null;
  }
}

function safeBlockHash(
  value: unknown,
  sdk: any,
): string | null {
  try {
    const rendered =
      sdk.BlockHash.toHexString(
        value,
      );

    if (
      isLowerHex64(
        rendered,
      )
    ) {
      return rendered;
    }
  } catch {
    // Try scalar conversion below.
  }

  try {
    const rendered =
      String(value);

    return isLowerHex64(
      rendered,
    )
      ? rendered
      : null;
  } catch {
    return null;
  }
}

function safeBlockHeight(
  value: unknown,
): number | null {
  try {
    const parsed =
      typeof value ===
        "bigint"
        ? Number(value)
        : (
            typeof value ===
              "number"
              ? value
              : Number(
                  String(value),
                )
          );

    return (
      Number.isSafeInteger(
        parsed,
      ) &&
      parsed >=
        0
    )
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function unavailableResult():
  AgentRegistryResolverUnavailableV1 {
  return {
    type:
      CONCORDIUM_CIS8004_RESOLVER_UNAVAILABLE_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    status:
      "unavailable",

    reason:
      "agent_registry_resolver_unavailable",
  };
}

function withTimeout<T>(
  operation: Promise<T>,
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
                "concordium_cis8004_read_timeout",
              ),
            );
          },
          timeoutMs,
        );

      operation.then(
        (value) => {
          clearTimeout(
            timer,
          );

          resolve(
            value,
          );
        },
        (error: unknown) => {
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

function buildFreshness(
  snapshot:
    ConcordiumCis8004FinalizedSnapshotV1 | null,
  now:
    Date,
): AgentRegistryTrustResultV1["freshness"] {
  if (
    snapshot ===
      null ||
    !Number.isFinite(
      now.getTime(),
    )
  ) {
    return {
      source:
        "direct_chain",

      finalizedBlockHeight:
        null,

      finalizedBlockHash:
        null,

      observedAt:
        null,

      evidenceAgeSeconds:
        null,

      indexerLagBlocks:
        null,

      fresh:
        false,
    };
  }

  const observedAtMilliseconds =
    Date.parse(
      snapshot.observedAt,
    );

  if (
    !Number.isFinite(
      observedAtMilliseconds,
    )
  ) {
    return {
      source:
        "direct_chain",

      finalizedBlockHeight:
        null,

      finalizedBlockHash:
        null,

      observedAt:
        null,

      evidenceAgeSeconds:
        null,

      indexerLagBlocks:
        null,

      fresh:
        false,
    };
  }

  const evidenceAgeSeconds =
    Math.max(
      0,
      Math.floor(
        (
          now.getTime() -
          observedAtMilliseconds
        ) /
          1000,
      ),
    );

  return {
    source:
      "direct_chain",

    finalizedBlockHeight:
      snapshot.finalizedBlockHeight,

    finalizedBlockHash:
      snapshot.finalizedBlockHash,

    observedAt:
      snapshot.observedAt,

    evidenceAgeSeconds,

    indexerLagBlocks:
      null,

    fresh:
      true,
  };
}

type BuildTrustResultOptions = {
  readonly requirement:
    AgentRegistryRequirementV1;

  readonly reference:
    AgentRegistryReferenceV1;

  readonly verified:
    boolean;

  readonly reason:
    AgentRegistryTrustReasonV1;

  readonly moduleReference:
    string | null;

  readonly agentTokenId:
    string;

  readonly status:
    AgentRegistryTrustResultV1["state"]["status"];

  readonly ownerAccount:
    string | null;

  readonly ownerAccountBound:
    boolean;

  readonly agentWallet:
    string | null;

  readonly agentUri:
    string | null;

  readonly metadataHash:
    string | null;

  readonly snapshot:
    ConcordiumCis8004FinalizedSnapshotV1 | null;

  readonly now:
    Date;
};

function buildTrustResult(
  options:
    BuildTrustResultOptions,
): AgentRegistryTrustResultV1 {
  const requiredCapabilities =
    [
      ...options
        .requirement
        .requiredCapabilities,
    ];

  const missingCapabilities =
    [
      ...requiredCapabilities,
    ];

  const capabilitiesSatisfied =
    missingCapabilities.length ===
      0;

  return {
    type:
      AGENT_REGISTRY_TRUST_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    verified:
      options.verified,

    reason:
      options.reason,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    identity: {
      network:
        options.reference.network,

      registryContract:
        options.reference.registryContract,

      moduleReference:
        options.moduleReference,

      agentTokenId:
        options.agentTokenId,

      tokenAddress:
        options.reference.tokenAddress,
    },

    state: {
      status:
        options.status,

      ownerAccount:
        options.ownerAccount,

      ownerAccountBound:
        options.ownerAccountBound,

      ownerIdentityAssurance:
        "not_evaluated",

      agentWallet:
        options.agentWallet,
    },

    agentCard: {
      uri:
        sanitizeCompactString(
          options.agentUri,
          4096,
        ),

      hash:
        isLowerHex64(
          options.metadataHash,
        )
          ? options.metadataHash
          : null,

      integrityVerified:
        false,
    },

    keyBinding: {
      required:
        options
          .requirement
          .externalKeyPolicy ===
          "required",

      verified:
        false,

      bindingType:
        null,

      keyFingerprint:
        null,
    },

    capabilities: {
      required:
        requiredCapabilities,

      satisfied:
        [],

      missing:
        missingCapabilities,

      policySatisfied:
        capabilitiesSatisfied,
    },

    freshness:
      buildFreshness(
        options.snapshot,
        options.now,
      ),

    evidenceHash:
      null,
  };
}

function activeReason(
  requirement:
    AgentRegistryRequirementV1,
  freshness:
    AgentRegistryTrustResultV1["freshness"],
): AgentRegistryTrustReasonV1 {
  if (
    requirement
      .requireAgentCardIntegrity
  ) {
    return "agent_card_fetch_failed";
  }

  if (
    requirement
      .requiredCapabilities
      .length >
      0
  ) {
    return "agent_capability_missing";
  }

  if (
    requirement
      .requireVerifiedOwnerIdentity
  ) {
    return "agent_registry_owner_mismatch";
  }

  if (
    requirement
      .externalKeyPolicy !==
      "optional"
  ) {
    return "agent_registry_key_mismatch";
  }

  if (
    !freshness.fresh
  ) {
    return "agent_registry_evidence_stale";
  }

  return "agent_registry_result_invalid";
}

/**
 * Read-only Concordium gRPC implementation.
 *
 * A single latest-finalized block hash is captured and reused for:
 * - block information;
 * - contract instance information;
 * - embedded module schema;
 * - CIS-8004 agentOf invocation.
 */
export class ConcordiumGrpcCis8004ReadTransportV1
implements ConcordiumCis8004ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8004_TRANSPORT_KIND;

  async read(
    request:
      ConcordiumCis8004ReadRequestV1,
  ): Promise<unknown> {
    if (
      request.config.transport !==
        CONCORDIUM_CIS8004_TRANSPORT_KIND ||
      !isCanonicalTokenId(
        request.agentTokenId,
      )
    ) {
      throw new Error(
        "invalid_concordium_cis8004_read_request",
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

    const grpcModuleUrl =
      pathToFileURL(
        grpcModulePath,
      ).href;

    const [
      grpcModule,
      sdk,
    ]: [
      any,
      any,
    ] =
      await Promise.all([
        import(
          grpcModuleUrl as any
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

    const consensus =
      await client
        .getConsensusStatus();

    const finalizedBlock =
      consensus
        .lastFinalizedBlock;

    if (
      finalizedBlock ===
        null ||
      finalizedBlock ===
        undefined
    ) {
      throw new Error(
        "missing_latest_finalized_block",
      );
    }

    const blockInfo =
      await client
        .getBlockInfo(
          finalizedBlock,
        );

    if (
      blockInfo ===
        null ||
      blockInfo ===
        undefined ||
      blockInfo.finalized !==
        true
    ) {
      throw new Error(
        "non_finalized_registry_snapshot",
      );
    }

    const finalizedBlockHash =
      safeBlockHash(
        finalizedBlock,
        sdk,
      );

    const finalizedBlockHeight =
      safeBlockHeight(
        blockInfo.blockHeight ??
          consensus
            .lastFinalizedBlockHeight,
      );

    const observedAt =
      normalizeIsoTimestamp(
        blockInfo.blockSlotTime,
      );

    if (
      finalizedBlockHash ===
        null ||
      finalizedBlockHeight ===
        null ||
      observedAt ===
        null
    ) {
      throw new Error(
        "invalid_finalized_snapshot_metadata",
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
          finalizedBlock,
        );

    if (
      instanceInfo ===
        null ||
      instanceInfo ===
        undefined
    ) {
      throw new Error(
        "cis8004_contract_not_found",
      );
    }

    const moduleReference =
      safeModuleReference(
        instanceInfo.sourceModule,
        sdk,
      );

    if (
      moduleReference ===
        null
    ) {
      throw new Error(
        "invalid_cis8004_module_reference",
      );
    }

    const embeddedSchema =
      await client
        .getEmbeddedSchema(
          instanceInfo.sourceModule,
          finalizedBlock,
        );

    if (
      embeddedSchema ===
        null ||
      embeddedSchema ===
        undefined
    ) {
      throw new Error(
        "cis8004_embedded_schema_unavailable",
      );
    }

    const contractName =
      sdk.ContractName
        .fromStringUnchecked(
          request
            .config
            .contractName,
        );

    const entrypointName =
      sdk.EntrypointName
        .fromString(
          request
            .config
            .entrypoint,
        );

    const parameter =
      sdk.serializeUpdateContractParameters(
        contractName,
        entrypointName,
        tokenIdToU64LittleEndianHex(
          request.agentTokenId,
        ),
        embeddedSchema.buffer,
      );

    const invocation =
      await client
        .invokeContract(
          {
            method:
              sdk.ReceiveName
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
          finalizedBlock,
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
        "cis8004_agentof_invocation_failed",
      );
    }

    const rawReturnValue =
      sdk.unwrap(
        invocation.returnValue,
      );

    const decoded =
      sdk.deserializeReceiveReturnValue(
        sdk.ReturnValue.toBuffer(
          rawReturnValue,
        ),
        embeddedSchema.buffer,
        contractName,
        entrypointName,
      );

    const record =
      normalizeDecodedAgentOfResult(
        decoded,
      );

    const result:
      ConcordiumCis8004ReadResultV1 = {
        type:
          CONCORDIUM_CIS8004_READ_RESULT_TYPE,

        version:
          AGENT_REGISTRY_CONTRACT_VERSION,

        network:
          request.config.network,

        registryContract:
          {
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

        snapshot: {
          finalizedBlockHash,

          finalizedBlockHeight,

          observedAt,

          finalized:
            true,
        },

        record,
      };

    return result;
  }
}

/**
 * Concordium CIS-8004 resolver implementation.
 *
 * The class is structurally compatible with the widened PR #299 resolver
 * interface introduced later in PR #300. It deliberately does not import or
 * change the current fixture-only resolver mode constant.
 */
export class ConcordiumCis8004RegistryPluginV1 {
  readonly kind =
    CONCORDIUM_CIS8004_RESOLVER_KIND;

  readonly version =
    AGENT_REGISTRY_CONTRACT_VERSION;

  readonly mode =
    CONCORDIUM_CIS8004_RESOLVER_MODE;

  readonly config:
    ConcordiumCis8004TrustedRegistryConfigV1;

  constructor(
    private readonly transport:
      ConcordiumCis8004ReadTransportV1 =
        new ConcordiumGrpcCis8004ReadTransportV1(),

    config:
      ConcordiumCis8004TrustedRegistryConfigV1 =
        CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,

    private readonly now:
      ConcordiumCis8004ClockV1 =
        () =>
          new Date(),
  ) {
    this.config =
      config;
  }

  async resolve(
    request:
      AgentRegistryResolverRequestV1,
  ): Promise<unknown> {
    const requestRecord =
      asRecord(
        request,
      );

    if (
      requestRecord ===
        null ||
      !hasExactKeys(
        requestRecord,
        [
          "type",
          "version",
          "requirement",
          "reference",
        ],
      ) ||
      requestRecord.type !==
        CONCORDIUM_CIS8004_RESOLVER_REQUEST_TYPE ||
      requestRecord.version !==
        AGENT_REGISTRY_CONTRACT_VERSION
    ) {
      return unavailableResult();
    }

    const requirementValidation =
      validateAgentRegistryRequirementV1(
        requestRecord.requirement,
      );

    const referenceValidation =
      validateAgentRegistryReferenceV1(
        requestRecord.reference,
      );

    if (
      !requirementValidation.ok ||
      requirementValidation.value ===
        null ||
      !referenceValidation.ok ||
      referenceValidation.value ===
        null
    ) {
      return unavailableResult();
    }

    const requirement =
      requirementValidation.value;

    const reference =
      referenceValidation.value;

    if (
      !requirement.required ||
      requirement.registryStandard !==
        this.config.registryStandard ||
      reference.registryStandard !==
        this.config.registryStandard
    ) {
      return unavailableResult();
    }

    const now =
      this.now();

    const trustedRegistry =
      requirement
        .trustedRegistries
        .find(
          (candidate) =>
            candidate.network ===
              reference.network &&
            sameContractCoordinate(
              candidate.contract,
              reference.registryContract,
            ),
        ) ??
      null;

    const referenceMatchesPinnedRegistry =
      reference.network ===
        this.config.network &&
      sameContractCoordinate(
        reference.registryContract,
        this.config.contract,
      );

    const trustedRegistryMatchesPinnedModule =
      trustedRegistry !==
        null &&
      (
        trustedRegistry.moduleReference ===
          undefined ||
        trustedRegistry.moduleReference ===
          this.config.moduleReference
      );

    if (
      trustedRegistry ===
        null ||
      !referenceMatchesPinnedRegistry ||
      !trustedRegistryMatchesPinnedModule
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "untrusted_registry_contract",

          moduleReference:
            this.config.moduleReference,

          agentTokenId:
            reference.agentTokenId,

          status:
            "Unknown",

          ownerAccount:
            null,

          ownerAccountBound:
            false,

          agentWallet:
            null,

          agentUri:
            null,

          metadataHash:
            null,

          snapshot:
            null,

          now,
        },
      );
    }

    if (
      !isCanonicalTokenId(
        reference.agentTokenId,
      ) ||
      this.transport.kind !==
        CONCORDIUM_CIS8004_TRANSPORT_KIND
    ) {
      return unavailableResult();
    }

    let transportOutput:
      unknown;

    try {
      transportOutput =
        await withTimeout(
          this.transport.read(
            {
              config:
                this.config,

              agentTokenId:
                reference.agentTokenId,
            },
          ),
          this.config.timeoutMs,
        );
    } catch {
      return unavailableResult();
    }

    if (
      !isReadResult(
        transportOutput,
      )
    ) {
      return unavailableResult();
    }

    const readResult =
      transportOutput;

    if (
      readResult.network !==
        this.config.network ||
      !sameContractCoordinate(
        readResult.registryContract,
        this.config.contract,
      )
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_registry_contract_mismatch",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            reference.agentTokenId,

          status:
            "Unknown",

          ownerAccount:
            null,

          ownerAccountBound:
            false,

          agentWallet:
            null,

          agentUri:
            null,

          metadataHash:
            null,

          snapshot:
            readResult.snapshot,

          now,
        },
      );
    }

    if (
      readResult.moduleReference !==
        this.config.moduleReference
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_registry_contract_mismatch",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            reference.agentTokenId,

          status:
            "Unknown",

          ownerAccount:
            null,

          ownerAccountBound:
            false,

          agentWallet:
            null,

          agentUri:
            null,

          metadataHash:
            null,

          snapshot:
            readResult.snapshot,

          now,
        },
      );
    }

    if (
      readResult.record ===
        null
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_not_registered",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            reference.agentTokenId,

          status:
            "Missing",

          ownerAccount:
            null,

          ownerAccountBound:
            false,

          agentWallet:
            null,

          agentUri:
            null,

          metadataHash:
            null,

          snapshot:
            readResult.snapshot,

          now,
        },
      );
    }

    const record =
      readResult.record;

    if (
      record.tokenId !==
        reference.agentTokenId
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_registry_identity_mismatch",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            record.tokenId,

          status:
            "Unknown",

          ownerAccount:
            null,

          ownerAccountBound:
            false,

          agentWallet:
            null,

          agentUri:
            null,

          metadataHash:
            null,

          snapshot:
            readResult.snapshot,

          now,
        },
      );
    }

    if (
      record.status ===
        "Revoked"
    ) {
      return buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_registry_revoked",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            record.tokenId,

          status:
            "Revoked",

          ownerAccount:
            record.ownerAccount,

          ownerAccountBound:
            true,

          agentWallet:
            record.agentWallet,

          agentUri:
            record.agentUri,

          metadataHash:
            record.metadataHash,

          snapshot:
            readResult.snapshot,

          now,
        },
      );
    }

    const provisional =
      buildTrustResult(
        {
          requirement,
          reference,

          verified:
            false,

          reason:
            "agent_registry_result_invalid",

          moduleReference:
            readResult.moduleReference,

          agentTokenId:
            record.tokenId,

          status:
            "Active",

          ownerAccount:
            record.ownerAccount,

          ownerAccountBound:
            true,

          agentWallet:
            record.agentWallet,

          agentUri:
            record.agentUri,

          metadataHash:
            record.metadataHash,

          snapshot:
            readResult.snapshot,

          now,
        },
      );

    const baseProfileVerified =
      provisional
        .freshness
        .fresh &&
      !requirement
        .requireAgentCardIntegrity &&
      requirement
        .requiredCapabilities
        .length ===
        0 &&
      !requirement
        .requireVerifiedOwnerIdentity &&
      requirement
        .externalKeyPolicy ===
        "optional" &&
      (
        !requirement
          .requireOwnerAccountBinding ||
        provisional
          .state
          .ownerAccountBound
      );

    const reason =
      baseProfileVerified
        ? "agent_registry_verified"
        : activeReason(
            requirement,
            provisional.freshness,
          );

    return buildTrustResult(
      {
        requirement,
        reference,

        verified:
          baseProfileVerified,

        reason,

        moduleReference:
          readResult.moduleReference,

        agentTokenId:
          record.tokenId,

        status:
          "Active",

        ownerAccount:
          record.ownerAccount,

        ownerAccountBound:
          true,

        agentWallet:
          record.agentWallet,

        agentUri:
          record.agentUri,

        metadataHash:
          record.metadataHash,

        snapshot:
          readResult.snapshot,

        now,
      },
    );
  }
}
