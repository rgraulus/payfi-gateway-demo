/**
 * PR #304 — Demo3 controlled Agent Registry evidence provider.
 *
 * This is the single permitted Gateway runtime bridge for controlled Demo3
 * evidence. It:
 * - defaults off;
 * - enforces the complete frozen activation guard;
 * - accepts one Gateway-owned temporary public-evidence manifest;
 * - validates that manifest against a closed schema;
 * - constructs only the existing CIS-8004, CIS-8, and Agent Card transports;
 * - performs no authorization, persistence, payment, settlement, receipt,
 *   replay, release, signing, or production activation;
 * - never falls back between controlled and live evidence.
 */

import {
  createHash,
} from "node:crypto";

import {
  readFileSync,
} from "node:fs";

import {
  relative,
  resolve,
  sep,
} from "node:path";

import {
  Buffer,
} from "node:buffer";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
} from "./agentRegistryTrustContract";

import {
  CONCORDIUM_CIS8004_READ_RESULT_TYPE,
  CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,
  CONCORDIUM_CIS8004_TRANSPORT_KIND,
  type ConcordiumCis8004ReadRequestV1,
  type ConcordiumCis8004ReadResultV1,
  type ConcordiumCis8004ReadTransportV1,
} from "./concordiumCis8004RegistryPlugin";

import {
  CONCORDIUM_CIS8_READ_RESULT_TYPE,
  CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG,
  CONCORDIUM_CIS8_TRANSPORT_KIND,
  type ConcordiumCis8FinalizedReadResultV1,
  type ConcordiumCis8ReadRequestV1,
  type ConcordiumCis8ReadTransportV1,
} from "./agentRegistryIdentityKeyBinding";

import {
  DeterministicAgentCardFetchTransportV1,
  type AgentCardFetchTransportV1,
} from "./agentRegistryCardCapabilityFreshness";

export const PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE =
  "xcf.phase6.demo3-controlled-evidence-manifest" as const;

export const PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION =
  "1.0.0" as const;

export const PHASE6_DEMO3_CONTROLLED_EVIDENCE_SCENARIOS = [
  "positive",
  "acting_key_mismatch",
  "tampered_agent_card",
] as const;

export type Phase6Demo3ControlledEvidenceScenarioV1 =
  (typeof PHASE6_DEMO3_CONTROLLED_EVIDENCE_SCENARIOS)[number];

export type Phase6Demo3ControlledEvidenceManifestV1 = {
  readonly type:
    typeof PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE;

  readonly version:
    typeof PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION;

  readonly scenario:
    Phase6Demo3ControlledEvidenceScenarioV1;

  readonly registry: {
    readonly network: string;

    readonly contract: {
      readonly index: string;
      readonly subindex: number;
    };

    readonly moduleReference: string;
    readonly agentTokenId: string;
    readonly tokenAddress: string;
    readonly ownerAccount: string;
    readonly agentWallet: string;
    readonly status: "Active";
    readonly registeredAt: string;
    readonly agentCardUri: string;
    readonly expectedAgentCardSha256: string;

    readonly externalKey: {
      readonly namespace: string;
      readonly keyType: "ed25519";
      readonly publicKeyHex: string;
    };

    readonly finalizedSnapshot: {
      readonly blockHash: string;
      readonly blockHeight: number;
      readonly observedAt: string;
    };
  };

  readonly cis8: {
    readonly network: string;

    readonly contract: {
      readonly index: string;
      readonly subindex: number;
    };

    readonly moduleReference: string;
    readonly namespace: string;
    readonly keyType: "ed25519";
    readonly registeredPublicKeyHex: string;
    readonly registrationStatus: "Active";
    readonly lastUpdated: string;
  };

  readonly agentCard: {
    readonly bytesBase64: string;
    readonly contentType: "application/json";
  };
};

export type Phase6Demo3ControlledEvidenceManifestValidationReasonV1 =
  | "valid"
  | "invalid_object_shape"
  | "invalid_manifest_contract"
  | "invalid_scenario"
  | "invalid_registry_evidence"
  | "untrusted_registry"
  | "invalid_cis8_evidence"
  | "untrusted_cis8"
  | "invalid_agent_card_evidence"
  | "scenario_contract_mismatch";

export type Phase6Demo3ControlledEvidenceManifestValidationResultV1 =
  | {
      readonly ok: true;
      readonly reason: "valid";
      readonly value:
        Phase6Demo3ControlledEvidenceManifestV1;
      readonly agentCardBytes:
        Uint8Array;
    }
  | {
      readonly ok: false;
      readonly reason:
        Exclude<
          Phase6Demo3ControlledEvidenceManifestValidationReasonV1,
          "valid"
        >;
      readonly value: null;
      readonly agentCardBytes: null;
    };

export type Phase6Demo3ControlledEvidenceProviderStatusV1 =
  | "disabled"
  | "active"
  | "rejected";

export type Phase6Demo3ControlledEvidenceProviderReasonV1 =
  | "controlled_evidence_disabled"
  | "controlled_evidence_active"
  | "controlled_evidence_production_prohibited"
  | "controlled_evidence_guards_unsatisfied"
  | "controlled_evidence_manifest_path_missing"
  | "controlled_evidence_manifest_path_invalid"
  | "controlled_evidence_manifest_load_failed"
  | "controlled_evidence_manifest_invalid";

export type Phase6Demo3ControlledEvidenceProviderInputV1 = {
  readonly enabledValue:
    unknown;

  readonly manifestPathValue:
    unknown;

  readonly allowDevHarness:
    boolean;

  readonly nodeEnv:
    string | null;

  readonly phase5AgentDelegatedRuntimeEnabled:
    boolean;

  readonly phase5CryptographicDelegationRuntimeEnabled:
    boolean;

  readonly phase5DelegationLifecycleEnforcementEnabled:
    boolean;

  readonly phase6AgentRegistryConditionalGatingEnabled:
    boolean;

  readonly cwd?:
    string;
};

export type Phase6Demo3ControlledEvidenceProviderResultV1 = {
  readonly requested: boolean;
  readonly active: boolean;

  readonly status:
    Phase6Demo3ControlledEvidenceProviderStatusV1;

  readonly reason:
    Phase6Demo3ControlledEvidenceProviderReasonV1;

  readonly scenario:
    Phase6Demo3ControlledEvidenceScenarioV1 | null;

  readonly manifestLoaded: boolean;
  readonly manifestPathAccepted: boolean;

  readonly controlledRegistryTransport:
    ConcordiumCis8004ReadTransportV1 | null;

  readonly controlledCis8Transport:
    ConcordiumCis8ReadTransportV1 | null;

  readonly controlledAgentCardTransport:
    AgentCardFetchTransportV1 | null;

  readonly productionActivation: false;
};

type UnknownRecord =
  Record<string, unknown>;

const MANIFEST_KEYS = [
  "type",
  "version",
  "scenario",
  "registry",
  "cis8",
  "agentCard",
] as const;

const REGISTRY_KEYS = [
  "network",
  "contract",
  "moduleReference",
  "agentTokenId",
  "tokenAddress",
  "ownerAccount",
  "agentWallet",
  "status",
  "registeredAt",
  "agentCardUri",
  "expectedAgentCardSha256",
  "externalKey",
  "finalizedSnapshot",
] as const;

const CIS8_KEYS = [
  "network",
  "contract",
  "moduleReference",
  "namespace",
  "keyType",
  "registeredPublicKeyHex",
  "registrationStatus",
  "lastUpdated",
] as const;

const AGENT_CARD_KEYS = [
  "bytesBase64",
  "contentType",
] as const;

const CONTRACT_KEYS = [
  "index",
  "subindex",
] as const;

const EXTERNAL_KEY_KEYS = [
  "namespace",
  "keyType",
  "publicKeyHex",
] as const;

const FINALIZED_SNAPSHOT_KEYS = [
  "blockHash",
  "blockHeight",
  "observedAt",
] as const;

const MAX_AGENT_CARD_BYTES =
  262_144;

function asRecord(
  value: unknown,
): UnknownRecord | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : null;
}

function hasExactKeys(
  value: UnknownRecord,
  keys: readonly string[],
): boolean {
  const actual =
    Object.keys(value);

  return (
    actual.length ===
      keys.length &&
    actual.every(
      (key) =>
        keys.includes(key),
    )
  );
}

function compactString(
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

function canonicalTimestamp(
  value: unknown,
): value is string {
  if (
    typeof value !==
      "string"
  ) {
    return false;
  }

  const milliseconds =
    Date.parse(value);

  if (
    !Number.isFinite(
      milliseconds,
    )
  ) {
    return false;
  }

  try {
    return (
      new Date(
        milliseconds,
      ).toISOString() ===
      value
    );
  } catch {
    return false;
  }
}

function lowerHex(
  value: unknown,
  byteLength: number,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length ===
      byteLength *
        2 &&
    /^[0-9a-f]+$/.test(
      value,
    )
  );
}

function canonicalU64String(
  value: unknown,
): value is string {
  if (
    typeof value !==
      "string" ||
    !/^(0|[1-9][0-9]*)$/.test(
      value,
    )
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
        18_446_744_073_709_551_615n
    );
  } catch {
    return false;
  }
}

function contractCoordinate(
  value: unknown,
): value is {
  readonly index: string;
  readonly subindex: number;
} {
  const record =
    asRecord(value);

  return (
    record !==
      null &&
    hasExactKeys(
      record,
      CONTRACT_KEYS,
    ) &&
    canonicalU64String(
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

function sameCoordinate(
  left: {
    readonly index: string;
    readonly subindex: number;
  },
  right: {
    readonly index: string;
    readonly subindex: number;
  },
): boolean {
  return (
    left.index ===
      right.index &&
    left.subindex ===
      right.subindex
  );
}

function httpsUri(
  value: unknown,
): value is string {
  if (
    !compactString(
      value,
      4096,
    )
  ) {
    return false;
  }

  try {
    const parsed =
      new URL(value);

    return (
      parsed.protocol ===
        "https:" &&
      parsed.username ===
        "" &&
      parsed.password ===
        ""
    );
  } catch {
    return false;
  }
}

function decodeCanonicalBase64(
  value: unknown,
): Uint8Array | null {
  if (
    typeof value !==
      "string" ||
    value.length ===
      0 ||
    value.length %
      4 !==
      0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    return null;
  }

  const bytes =
    Buffer.from(
      value,
      "base64",
    );

  if (
    bytes.length ===
      0 ||
    bytes.length >
      MAX_AGENT_CARD_BYTES ||
    bytes.toString(
      "base64",
    ) !==
      value
  ) {
    return null;
  }

  return Uint8Array.from(
    bytes,
  );
}

function sha256LowerHex(
  bytes: Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(bytes)
    .digest("hex");
}

function invalidManifest(
  reason:
    Exclude<
      Phase6Demo3ControlledEvidenceManifestValidationReasonV1,
      "valid"
    >,
): Phase6Demo3ControlledEvidenceManifestValidationResultV1 {
  return {
    ok: false,
    reason,
    value: null,
    agentCardBytes: null,
  };
}

export function validatePhase6Demo3ControlledEvidenceManifestV1(
  value: unknown,
): Phase6Demo3ControlledEvidenceManifestValidationResultV1 {
  const manifest =
    asRecord(value);

  if (
    manifest ===
      null ||
    !hasExactKeys(
      manifest,
      MANIFEST_KEYS,
    )
  ) {
    return invalidManifest(
      "invalid_object_shape",
    );
  }

  if (
    manifest.type !==
      PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE ||
    manifest.version !==
      PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION
  ) {
    return invalidManifest(
      "invalid_manifest_contract",
    );
  }

  if (
    !PHASE6_DEMO3_CONTROLLED_EVIDENCE_SCENARIOS.includes(
      manifest.scenario as
        Phase6Demo3ControlledEvidenceScenarioV1,
    )
  ) {
    return invalidManifest(
      "invalid_scenario",
    );
  }

  const registry =
    asRecord(
      manifest.registry,
    );

  const cis8 =
    asRecord(
      manifest.cis8,
    );

  const agentCard =
    asRecord(
      manifest.agentCard,
    );

  if (
    registry ===
      null ||
    !hasExactKeys(
      registry,
      REGISTRY_KEYS,
    ) ||
    !compactString(
      registry.network,
      2048,
    ) ||
    !contractCoordinate(
      registry.contract,
    ) ||
    !lowerHex(
      registry.moduleReference,
      32,
    ) ||
    !canonicalU64String(
      registry.agentTokenId,
    ) ||
    !compactString(
      registry.tokenAddress,
      4096,
    ) ||
    !compactString(
      registry.ownerAccount,
      2048,
    ) ||
    !compactString(
      registry.agentWallet,
      2048,
    ) ||
    registry.status !==
      "Active" ||
    !canonicalTimestamp(
      registry.registeredAt,
    ) ||
    !httpsUri(
      registry.agentCardUri,
    ) ||
    !lowerHex(
      registry.expectedAgentCardSha256,
      32,
    )
  ) {
    return invalidManifest(
      "invalid_registry_evidence",
    );
  }

  const externalKey =
    asRecord(
      registry.externalKey,
    );

  const snapshot =
    asRecord(
      registry.finalizedSnapshot,
    );

  if (
    externalKey ===
      null ||
    !hasExactKeys(
      externalKey,
      EXTERNAL_KEY_KEYS,
    ) ||
    !compactString(
      externalKey.namespace,
      256,
    ) ||
    externalKey.keyType !==
      "ed25519" ||
    !lowerHex(
      externalKey.publicKeyHex,
      32,
    ) ||
    snapshot ===
      null ||
    !hasExactKeys(
      snapshot,
      FINALIZED_SNAPSHOT_KEYS,
    ) ||
    !lowerHex(
      snapshot.blockHash,
      32,
    ) ||
    typeof snapshot.blockHeight !==
      "number" ||
    !Number.isSafeInteger(
      snapshot.blockHeight,
    ) ||
    snapshot.blockHeight <
      0 ||
    !canonicalTimestamp(
      snapshot.observedAt,
    )
  ) {
    return invalidManifest(
      "invalid_registry_evidence",
    );
  }

  if (
    registry.network !==
      CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
        .network ||
    !sameCoordinate(
      registry.contract,
      CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
        .contract,
    ) ||
    registry.moduleReference !==
      CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
        .moduleReference
  ) {
    return invalidManifest(
      "untrusted_registry",
    );
  }

  if (
    cis8 ===
      null ||
    !hasExactKeys(
      cis8,
      CIS8_KEYS,
    ) ||
    !compactString(
      cis8.network,
      2048,
    ) ||
    !contractCoordinate(
      cis8.contract,
    ) ||
    !lowerHex(
      cis8.moduleReference,
      32,
    ) ||
    !compactString(
      cis8.namespace,
      256,
    ) ||
    cis8.keyType !==
      "ed25519" ||
    !lowerHex(
      cis8.registeredPublicKeyHex,
      32,
    ) ||
    cis8.registrationStatus !==
      "Active" ||
    !canonicalTimestamp(
      cis8.lastUpdated,
    )
  ) {
    return invalidManifest(
      "invalid_cis8_evidence",
    );
  }

  if (
    cis8.network !==
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .network ||
    !sameCoordinate(
      cis8.contract,
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .contract,
    ) ||
    cis8.moduleReference !==
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .moduleReference ||
    cis8.namespace !==
      externalKey.namespace ||
    cis8.keyType !==
      externalKey.keyType
  ) {
    return invalidManifest(
      "untrusted_cis8",
    );
  }

  if (
    agentCard ===
      null ||
    !hasExactKeys(
      agentCard,
      AGENT_CARD_KEYS,
    ) ||
    agentCard.contentType !==
      "application/json"
  ) {
    return invalidManifest(
      "invalid_agent_card_evidence",
    );
  }

  const agentCardBytes =
    decodeCanonicalBase64(
      agentCard.bytesBase64,
    );

  if (
    agentCardBytes ===
      null
  ) {
    return invalidManifest(
      "invalid_agent_card_evidence",
    );
  }

  const actualAgentCardSha256 =
    sha256LowerHex(
      agentCardBytes,
    );

  const scenario =
    manifest.scenario as
      Phase6Demo3ControlledEvidenceScenarioV1;

  /*
   * The manifest establishes only internal public-evidence coherence.
   *
   * Whether the coherent registry/CIS-8 key matches the verified Phase 5
   * acting key is decided by the existing identity-key-binding stage during
   * the real Gateway request lifecycle. The provider must not infer,
   * override, or pre-authorize that runtime fact.
   */
  const registryKeyEvidenceCoherent =
    externalKey.publicKeyHex ===
      cis8.registeredPublicKeyHex;

  const cardHashMatches =
    registry.expectedAgentCardSha256 ===
      actualAgentCardSha256;

  const scenarioCoherent =
    (
      scenario ===
        "positive" &&
      registryKeyEvidenceCoherent &&
      cardHashMatches
    ) ||
    (
      scenario ===
        "acting_key_mismatch" &&
      registryKeyEvidenceCoherent &&
      cardHashMatches
    ) ||
    (
      scenario ===
        "tampered_agent_card" &&
      registryKeyEvidenceCoherent &&
      !cardHashMatches
    );

  if (
    !scenarioCoherent
  ) {
    return invalidManifest(
      "scenario_contract_mismatch",
    );
  }

  return {
    ok: true,
    reason: "valid",
    value:
      value as
        Phase6Demo3ControlledEvidenceManifestV1,
    agentCardBytes,
  };
}

class ControlledCis8004ReadTransportV1
implements ConcordiumCis8004ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8004_TRANSPORT_KIND;

  constructor(
    private readonly manifest:
      Phase6Demo3ControlledEvidenceManifestV1,
  ) {}

  async read(
    request:
      ConcordiumCis8004ReadRequestV1,
  ): Promise<unknown> {
    const registry =
      this.manifest.registry;

    if (
      request.agentTokenId !==
        registry.agentTokenId ||
      request.config.network !==
        registry.network ||
      !sameCoordinate(
        request.config.contract,
        registry.contract,
      ) ||
      request.config.moduleReference !==
        registry.moduleReference
    ) {
      throw new Error(
        "controlled_registry_request_mismatch",
      );
    }

    const result:
      ConcordiumCis8004ReadResultV1 = {
        type:
          CONCORDIUM_CIS8004_READ_RESULT_TYPE,

        version:
          AGENT_REGISTRY_CONTRACT_VERSION,

        network:
          registry.network,

        registryContract: {
          index:
            registry.contract.index,

          subindex:
            registry.contract.subindex,
        },

        moduleReference:
          registry.moduleReference,

        snapshot: {
          finalizedBlockHash:
            registry.finalizedSnapshot
              .blockHash,

          finalizedBlockHeight:
            registry.finalizedSnapshot
              .blockHeight,

          observedAt:
            registry.finalizedSnapshot
              .observedAt,

          finalized:
            true,
        },

        record: {
          tokenId:
            registry.agentTokenId,

          ownerAccount:
            registry.ownerAccount,

          agentUri:
            registry.agentCardUri,

          metadataHash:
            registry.expectedAgentCardSha256,

          externalReference: {
            contractAddress: {
              index:
                this.manifest.cis8
                  .contract
                  .index,

              subindex:
                this.manifest.cis8
                  .contract
                  .subindex,
            },

            kind:
              "CIS-8",

            externalKeyId: {
              namespace:
                registry.externalKey
                  .namespace,

              keyType:
                registry.externalKey
                  .keyType,

              publicKeyHex:
                registry.externalKey
                  .publicKeyHex,
            },
          },

          agentWallet:
            registry.agentWallet,

          status:
            registry.status,

          registeredAt:
            registry.registeredAt,

          revokedAt:
            null,

          revocationReason:
            null,
        },
      };

    return result;
  }
}

class ControlledCis8ReadTransportV1
implements ConcordiumCis8ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8_TRANSPORT_KIND;

  constructor(
    private readonly manifest:
      Phase6Demo3ControlledEvidenceManifestV1,
  ) {}

  async read(
    request:
      ConcordiumCis8ReadRequestV1,
  ): Promise<unknown> {
    const registry =
      this.manifest.registry;

    const cis8 =
      this.manifest.cis8;

    if (
      request.config.network !==
        cis8.network ||
      !sameCoordinate(
        request.config.contract,
        cis8.contract,
      ) ||
      request.config.moduleReference !==
        cis8.moduleReference ||
      request.snapshot.finalizedBlockHash !==
        registry.finalizedSnapshot
          .blockHash ||
      request.snapshot.finalizedBlockHeight !==
        registry.finalizedSnapshot
          .blockHeight ||
      request.snapshot.observedAt !==
        registry.finalizedSnapshot
          .observedAt ||
      request.snapshot.finalized !==
        true ||
      request.externalKey.namespace !==
        registry.externalKey
          .namespace ||
      request.externalKey.keyType !==
        registry.externalKey
          .keyType ||
      request.externalKey.publicKeyHex !==
        registry.externalKey
          .publicKeyHex
    ) {
      throw new Error(
        "controlled_cis8_request_mismatch",
      );
    }

    const result:
      ConcordiumCis8FinalizedReadResultV1 = {
        type:
          CONCORDIUM_CIS8_READ_RESULT_TYPE,

        version:
          AGENT_REGISTRY_CONTRACT_VERSION,

        network:
          cis8.network,

        cis8Contract: {
          index:
            cis8.contract.index,

          subindex:
            cis8.contract.subindex,
        },

        moduleReference:
          cis8.moduleReference,

        snapshot: {
          finalizedBlockHash:
            registry.finalizedSnapshot
              .blockHash,

          finalizedBlockHeight:
            registry.finalizedSnapshot
              .blockHeight,

          observedAt:
            registry.finalizedSnapshot
              .observedAt,

          finalized:
            true,
        },

        registration: {
          externalKey: {
            namespace:
              cis8.namespace,

            keyType:
              cis8.keyType,

            publicKeyHex:
              cis8.registeredPublicKeyHex,
          },

          owner:
            registry.ownerAccount,

          proofScheme:
            "ed25519-signature",

          status:
            cis8.registrationStatus,

          lastUpdated:
            cis8.lastUpdated,

          metadata:
            [],
        },
      };

    return result;
  }
}

function disabledResult():
Phase6Demo3ControlledEvidenceProviderResultV1 {
  return {
    requested: false,
    active: false,
    status: "disabled",
    reason: "controlled_evidence_disabled",
    scenario: null,
    manifestLoaded: false,
    manifestPathAccepted: false,
    controlledRegistryTransport: null,
    controlledCis8Transport: null,
    controlledAgentCardTransport: null,
    productionActivation: false,
  };
}

function rejectedResult(
  reason:
    Exclude<
      Phase6Demo3ControlledEvidenceProviderReasonV1,
      "controlled_evidence_disabled" |
      "controlled_evidence_active"
    >,

  options: {
    readonly manifestLoaded?: boolean;
    readonly manifestPathAccepted?: boolean;
  } = {},
): Phase6Demo3ControlledEvidenceProviderResultV1 {
  return {
    requested: true,
    active: false,
    status: "rejected",
    reason,
    scenario: null,
    manifestLoaded:
      options.manifestLoaded ??
      false,
    manifestPathAccepted:
      options.manifestPathAccepted ??
      false,
    controlledRegistryTransport: null,
    controlledCis8Transport: null,
    controlledAgentCardTransport: null,
    productionActivation: false,
  };
}

function requestedTrue(
  value: unknown,
): boolean {
  return (
    typeof value ===
      "string" &&
    value.toLowerCase() ===
      "true"
  );
}

function controlledManifestPath(
  cwd: string,
  value: unknown,
): string | null {
  if (
    !compactString(
      value,
      4096,
    )
  ) {
    return null;
  }

  const root =
    resolve(cwd);

  const absolute =
    resolve(
      root,
      value,
    );

  const relativePath =
    relative(
      root,
      absolute,
    );

  if (
    relativePath.length ===
      0 ||
    relativePath ===
      ".." ||
    relativePath.startsWith(
      `..${sep}`,
    ) ||
    relativePath.includes(
      `${sep}..${sep}`,
    )
  ) {
    return null;
  }

  const segments =
    relativePath.split(sep);

  if (
    segments.length !==
      3 ||
    segments[0] !==
      ".tmp" ||
    !segments[1].startsWith(
      "pr304-demo3-",
    ) ||
    segments[1].length <=
      "pr304-demo3-".length ||
    !segments[2].endsWith(
      ".json",
    )
  ) {
    return null;
  }

  return absolute;
}

export function createPhase6Demo3ControlledEvidenceProviderV1(
  input:
    Phase6Demo3ControlledEvidenceProviderInputV1,
): Phase6Demo3ControlledEvidenceProviderResultV1 {
  const requested =
    requestedTrue(
      input.enabledValue,
    );

  if (
    !requested
  ) {
    return disabledResult();
  }

  if (
    String(
      input.nodeEnv ??
      "",
    ).toLowerCase() ===
      "production"
  ) {
    return rejectedResult(
      "controlled_evidence_production_prohibited",
    );
  }

  const guardsSatisfied =
    input.allowDevHarness &&
    input.phase5AgentDelegatedRuntimeEnabled &&
    input.phase5CryptographicDelegationRuntimeEnabled &&
    input.phase5DelegationLifecycleEnforcementEnabled &&
    input.phase6AgentRegistryConditionalGatingEnabled;

  if (
    !guardsSatisfied
  ) {
    return rejectedResult(
      "controlled_evidence_guards_unsatisfied",
    );
  }

  if (
    !compactString(
      input.manifestPathValue,
      4096,
    )
  ) {
    return rejectedResult(
      "controlled_evidence_manifest_path_missing",
    );
  }

  const manifestPath =
    controlledManifestPath(
      input.cwd ??
        process.cwd(),
      input.manifestPathValue,
    );

  if (
    manifestPath ===
      null
  ) {
    return rejectedResult(
      "controlled_evidence_manifest_path_invalid",
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        readFileSync(
          manifestPath,
          "utf8",
        ),
      ) as unknown;
  } catch {
    return rejectedResult(
      "controlled_evidence_manifest_load_failed",
      {
        manifestPathAccepted:
          true,
      },
    );
  }

  const validation =
    validatePhase6Demo3ControlledEvidenceManifestV1(
      parsed,
    );

  if (
    !validation.ok
  ) {
    return rejectedResult(
      "controlled_evidence_manifest_invalid",
      {
        manifestLoaded:
          true,

        manifestPathAccepted:
          true,
      },
    );
  }

  const manifest =
    validation.value;

  return {
    requested: true,
    active: true,
    status: "active",
    reason: "controlled_evidence_active",
    scenario:
      manifest.scenario,
    manifestLoaded: true,
    manifestPathAccepted: true,

    controlledRegistryTransport:
      new ControlledCis8004ReadTransportV1(
        manifest,
      ),

    controlledCis8Transport:
      new ControlledCis8ReadTransportV1(
        manifest,
      ),

    controlledAgentCardTransport:
      new DeterministicAgentCardFetchTransportV1({
        [manifest.registry.agentCardUri]: {
          ok: true,
          bytes:
            validation.agentCardBytes,
          contentType:
            manifest.agentCard.contentType,
        },
      }),

    productionActivation: false,
  };
}
