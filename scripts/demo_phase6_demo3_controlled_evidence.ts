#!/usr/bin/env node
/**
 * PR #304 — Generate one controlled Demo3 Agent Registry evidence manifest.
 *
 * The helper consumes only the public portion of the temporary Phase 5
 * Demo2 key-bundle manifest. It never reads or prints private-key material.
 *
 * It creates one closed-schema public-evidence manifest for exactly one of:
 * - positive
 * - acting_key_mismatch
 * - tampered_agent_card
 *
 * It does not call the Gateway, Concordium, CRP, payment, settlement,
 * persistence, replay, receipt, or protected-resource release paths.
 */

import {
  createHash,
} from "node:crypto";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  AGENT_REGISTRATION_FILE_TYPE,
} from "../src/phase6/agentRegistryCardCapabilityFreshness";

import {
  CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

import {
  PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE,
  PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION,
  PHASE6_DEMO3_CONTROLLED_EVIDENCE_SCENARIOS,
  validatePhase6Demo3ControlledEvidenceManifestV1,
  type Phase6Demo3ControlledEvidenceManifestV1,
  type Phase6Demo3ControlledEvidenceScenarioV1,
} from "../src/phase6/demo3ControlledEvidenceProvider";

type UnknownRecord =
  Record<string, unknown>;

type Args = {
  keyBundlePath?: string;
  scenario?: string;
  outPath?: string;
  help?: boolean;
};

const AGENT_TOKEN_ID =
  "0";

const TOKEN_ADDRESS =
  "ccd:testnet/cis2:12802-0-0";

const OWNER_ACCOUNT =
  "4-pr304-controlled-owner-account";

const AGENT_WALLET =
  "4-pr304-controlled-agent-wallet";

const AGENT_CARD_URI =
  "https://agent.example/pr304-demo3-card.json";

const EXTERNAL_KEY_NAMESPACE =
  "xcf:phase5";

function usage(): string {
  return [
    "Usage:",
    "  ts-node --transpile-only scripts/demo_phase6_demo3_controlled_evidence.ts \\",
    "    --key-bundle <phase5-cryptographic-key-bundle.json> \\",
    "    --scenario <positive|acting_key_mismatch|tampered_agent_card> \\",
    "    --out <.tmp/pr304-demo3-<run-id>/<manifest>.json>",
    "",
    "The output path must remain inside one unique PR #304 temporary run",
    "directory. Existing output files are never overwritten.",
    "",
    "Private-key files are never read or printed.",
  ].join("\n");
}

function parseArgs(
  argv: readonly string[],
): Args {
  const args: Args = {};

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const arg =
      argv[index];

    if (
      arg === "--help" ||
      arg === "-h"
    ) {
      args.help = true;
      continue;
    }

    const next =
      argv[index + 1];

    switch (arg) {
      case "--key-bundle":
        args.keyBundlePath =
          next;
        index += 1;
        break;

      case "--scenario":
        args.scenario =
          next;
        index += 1;
        break;

      case "--out":
        args.outPath =
          next;
        index += 1;
        break;

      default:
        throw new Error(
          `unsupported argument: ${arg}`,
        );
    }
  }

  return args;
}

function asRecord(
  value: unknown,
): UnknownRecord | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  )
    ? value as UnknownRecord
    : null;
}

function requiredString(
  record: UnknownRecord,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !==
      "string" ||
    value.trim().length ===
      0 ||
    value !==
      value.trim()
  ) {
    throw new Error(
      `${key} must be a non-empty canonical string`,
    );
  }

  return value;
}

function requiredRecord(
  record: UnknownRecord,
  key: string,
): UnknownRecord {
  const value =
    asRecord(
      record[key],
    );

  if (
    value ===
      null
  ) {
    throw new Error(
      `${key} must be an object`,
    );
  }

  return value;
}

function requiredArgument(
  value: string | undefined,
  name: string,
): string {
  if (
    typeof value !==
      "string" ||
    value.trim().length ===
      0
  ) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value.trim();
}

function scenarioArgument(
  value: string | undefined,
): Phase6Demo3ControlledEvidenceScenarioV1 {
  const scenario =
    requiredArgument(
      value,
      "--scenario",
    );

  if (
    !PHASE6_DEMO3_CONTROLLED_EVIDENCE_SCENARIOS.includes(
      scenario as
        Phase6Demo3ControlledEvidenceScenarioV1,
    )
  ) {
    throw new Error(
      `unsupported Demo3 scenario: ${scenario}`,
    );
  }

  return scenario as
    Phase6Demo3ControlledEvidenceScenarioV1;
}

function readJsonObject(
  filePath: string,
): UnknownRecord {
  const parsed =
    JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    ) as unknown;

  const record =
    asRecord(
      parsed,
    );

  if (
    record ===
      null
  ) {
    throw new Error(
      `JSON root must be an object: ${filePath}`,
    );
  }

  return record;
}

function decodeCanonicalEd25519PublicKey(
  value: unknown,
): Uint8Array {
  if (
    typeof value !==
      "string" ||
    value.length ===
      0
  ) {
    throw new Error(
      "agent public JWK x is missing",
    );
  }

  const bytes =
    Buffer.from(
      value,
      "base64url",
    );

  if (
    bytes.byteLength !==
      32 ||
    bytes.toString(
      "base64url",
    ) !==
      value
  ) {
    throw new Error(
      "agent public JWK x is not canonical Ed25519 material",
    );
  }

  return Uint8Array.from(
    bytes,
  );
}

function alternatePublicKey(
  source: Uint8Array,
): Uint8Array {
  const alternate =
    Uint8Array.from(
      source,
    );

  alternate[0] =
    alternate[0] ^
    0xff;

  if (
    Buffer.from(
      alternate,
    ).equals(
      Buffer.from(
        source,
      ),
    )
  ) {
    throw new Error(
      "failed to derive alternate acting-key mismatch fixture",
    );
  }

  return alternate;
}

function sha256LowerHex(
  bytes: Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

function canonicalAgentCard(
  name: string,
): Uint8Array {
  const card = {
    type:
      AGENT_REGISTRATION_FILE_TYPE,

    name,

    x402Support:
      true,

    active:
      true,

    services: [
      {
        name:
          "premium-resource",

        endpoint:
          "https://agent.example/service",

        version:
          "1.0.0",

        skills: [
          "resource.premium.read",
        ],

        domains: [
          "payments",
        ],
      },
    ],

    supportedTrust: [
      "reputation",
    ],
  };

  return Buffer.from(
    JSON.stringify(
      card,
    ),
    "utf8",
  );
}

function controlledOutputPath(
  cwd: string,
  value: string,
): string {
  const root =
    path.resolve(
      cwd,
    );

  const absolute =
    path.resolve(
      root,
      value,
    );

  const relativePath =
    path.relative(
      root,
      absolute,
    );

  if (
    relativePath.length ===
      0 ||
    relativePath ===
      ".." ||
    relativePath.startsWith(
      `..${path.sep}`,
    ) ||
    relativePath.includes(
      `${path.sep}..${path.sep}`,
    )
  ) {
    throw new Error(
      "output path escapes the repository",
    );
  }

  const segments =
    relativePath.split(
      path.sep,
    );

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
    throw new Error(
      "output must be .tmp/pr304-demo3-<run-id>/<file>.json",
    );
  }

  return absolute;
}

function writeJsonExclusive(
  filePath: string,
  value: unknown,
): void {
  fs.mkdirSync(
    path.dirname(
      filePath,
    ),
    {
      recursive:
        true,

      mode:
        0o700,
    },
  );

  const descriptor =
    fs.openSync(
      filePath,
      "wx",
      0o600,
    );

  try {
    fs.writeFileSync(
      descriptor,
      `${JSON.stringify(
        value,
        null,
        2,
      )}\n`,
      {
        encoding:
          "utf8",
      },
    );
  } finally {
    fs.closeSync(
      descriptor,
    );
  }

  try {
    fs.chmodSync(
      filePath,
      0o600,
    );
  } catch {
    // Windows may not enforce POSIX mode bits.
  }
}

function main(): void {
  const args =
    parseArgs(
      process.argv.slice(
        2,
      ),
    );

  if (
    args.help
  ) {
    console.log(
      usage(),
    );

    return;
  }

  const keyBundlePath =
    path.resolve(
      requiredArgument(
        args.keyBundlePath,
        "--key-bundle",
      ),
    );

  const scenario =
    scenarioArgument(
      args.scenario,
    );

  const outPath =
    controlledOutputPath(
      process.cwd(),
      requiredArgument(
        args.outPath,
        "--out",
      ),
    );

  const keyBundle =
    readJsonObject(
      keyBundlePath,
    );

  if (
    keyBundle.contract !==
      "phase5.demoCryptographicKeyBundle.v1" ||
    keyBundle.mode !==
      "controlled_cryptographic_demo2"
  ) {
    throw new Error(
      "unsupported Phase 5 key-bundle contract",
    );
  }

  const agent =
    requiredRecord(
      keyBundle,
      "agent",
    );

  const agentKeyId =
    requiredString(
      agent,
      "agentKeyId",
    );

  const publicJwk =
    requiredRecord(
      agent,
      "publicKeyJwk",
    );

  if (
    publicJwk.kty !==
      "OKP" ||
    publicJwk.crv !==
      "Ed25519" ||
    (
      publicJwk.kid !==
        undefined &&
      publicJwk.kid !==
        agentKeyId
    ) ||
    (
      publicJwk.use !==
        undefined &&
      publicJwk.use !==
        "sig"
    ) ||
    (
      publicJwk.alg !==
        undefined &&
      publicJwk.alg !==
        "EdDSA"
    )
  ) {
    throw new Error(
      "Phase 5 agent public JWK contract is invalid",
    );
  }

  const phase5PublicKey =
    decodeCanonicalEd25519PublicKey(
      publicJwk.x,
    );

  const registryPublicKey =
    scenario ===
      "acting_key_mismatch"
      ? alternatePublicKey(
          phase5PublicKey,
        )
      : phase5PublicKey;

  const positiveCardBytes =
    canonicalAgentCard(
      "PR304 controlled Demo3 agent",
    );

  const deliveredCardBytes =
    scenario ===
      "tampered_agent_card"
      ? canonicalAgentCard(
          "PR304 controlled Demo3 tampered agent",
        )
      : positiveCardBytes;

  const expectedCardHash =
    sha256LowerHex(
      positiveCardBytes,
    );

  const deliveredCardHash =
    sha256LowerHex(
      deliveredCardBytes,
    );

  if (
    scenario ===
      "tampered_agent_card"
      ? expectedCardHash ===
          deliveredCardHash
      : expectedCardHash !==
          deliveredCardHash
  ) {
    throw new Error(
      "Agent Card scenario fixture is incoherent",
    );
  }

  const nowMs =
    Date.now();

  const observedAt =
    new Date(
      nowMs,
    ).toISOString();

  const registeredAt =
    new Date(
      nowMs -
      60_000,
    ).toISOString();

  const lastUpdated =
    new Date(
      nowMs -
      30_000,
    ).toISOString();

  const blockHash =
    createHash(
      "sha256",
    )
      .update(
        `pr304-demo3:${scenario}:${observedAt}`,
        "utf8",
      )
      .digest(
        "hex",
      );

  const publicKeyHex =
    Buffer.from(
      registryPublicKey,
    ).toString(
      "hex",
    );

  const manifest:
    Phase6Demo3ControlledEvidenceManifestV1 = {
      type:
        PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE,

      version:
        PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION,

      scenario,

      registry: {
        network:
          CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
            .network,

        contract: {
          index:
            CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
              .contract
              .index,

          subindex:
            CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
              .contract
              .subindex,
        },

        moduleReference:
          CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
            .moduleReference,

        agentTokenId:
          AGENT_TOKEN_ID,

        tokenAddress:
          TOKEN_ADDRESS,

        ownerAccount:
          OWNER_ACCOUNT,

        agentWallet:
          AGENT_WALLET,

        status:
          "Active",

        registeredAt,

        agentCardUri:
          AGENT_CARD_URI,

        expectedAgentCardSha256:
          expectedCardHash,

        externalKey: {
          namespace:
            EXTERNAL_KEY_NAMESPACE,

          keyType:
            "ed25519",

          publicKeyHex,
        },

        finalizedSnapshot: {
          blockHash,

          blockHeight:
            123_456,

          observedAt,
        },
      },

      cis8: {
        network:
          CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
            .network,

        contract: {
          index:
            CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
              .contract
              .index,

          subindex:
            CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
              .contract
              .subindex,
        },

        moduleReference:
          CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
            .moduleReference,

        namespace:
          EXTERNAL_KEY_NAMESPACE,

        keyType:
          "ed25519",

        registeredPublicKeyHex:
          publicKeyHex,

        registrationStatus:
          "Active",

        lastUpdated,
      },

      agentCard: {
        bytesBase64:
          Buffer.from(
            deliveredCardBytes,
          ).toString(
            "base64",
          ),

        contentType:
          "application/json",
      },
    };

  const validation =
    validatePhase6Demo3ControlledEvidenceManifestV1(
      manifest,
    );

  if (
    validation.ok !==
      true
  ) {
    throw new Error(
      `generated manifest failed provider validation: ${validation.reason}`,
    );
  }

  writeJsonExclusive(
    outPath,
    manifest,
  );

  console.log(
    JSON.stringify(
      {
        contract:
          PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_TYPE,

        version:
          PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_VERSION,

        scenario,

        manifestPath:
          path.relative(
            process.cwd(),
            outPath,
          ),

        manifestValidated:
          true,

        registryEvidenceControlled:
          true,

        cis8EvidenceControlled:
          true,

        agentCardEvidenceControlled:
          true,

        actingKeyMatchesPhase5:
          scenario !==
          "acting_key_mismatch",

        deliveredAgentCardMatchesExpectedHash:
          scenario !==
          "tampered_agent_card",

        privateMaterialRead:
          false,

        privateMaterialPrinted:
          false,

        gatewayCalled:
          false,

        concordiumCalled:
          false,

        crpCalled:
          false,

        paymentAttempted:
          false,

        protectedResourceReleased:
          false,

        productionActivation:
          false,
      },
      null,
      2,
    ),
  );
}

main();
