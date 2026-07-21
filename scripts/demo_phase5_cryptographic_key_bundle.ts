#!/usr/bin/env node
/**
 * Generate a temporary controlled Demo2 cryptographic key bundle.
 *
 * The Gateway receives only buyer.verification-key.json.
 * Buyer and agent private keys remain in temporary PKCS#8 PEM files,
 * are never printed, and must be deleted by the calling demo script.
 *
 * This helper does not call the Gateway, CRP, payment, settlement,
 * replay, release, Agent Registry, or any production authorization path.
 */

import {
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  type BuyerToAgentDelegationEd25519PublicKeyJwk,
} from "../src/phase5/buyerToAgentDelegationCredential";

import {
  BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
  type BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

type Args = {
  outDir?: string;
  buyerId?: string;
  buyerKeyId?: string;
  agentId?: string;
  agentKeyId?: string;
  help?: boolean;
};

type ExportedJwk = {
  readonly kty?: string;
  readonly crv?: string;
  readonly x?: string;
};

type DemoKeyBundleManifest = {
  readonly contract:
    "phase5.demoCryptographicKeyBundle.v1";

  readonly mode:
    "controlled_cryptographic_demo2";

  readonly buyer: {
    readonly buyerId: string;
    readonly buyerKeyId: string;
    readonly verificationKeyFile: string;
    readonly privateKeyFile: string;
  };

  readonly agent: {
    readonly agentId: string;
    readonly agentKeyId: string;
    readonly publicKeyJwk:
      BuyerToAgentDelegationEd25519PublicKeyJwk;
    readonly privateKeyFile: string;
  };

  readonly privateMaterialTemporary: true;
  readonly privateMaterialPrinted: false;
  readonly gatewayCalled: false;
  readonly crpCalled: false;
  readonly paymentAttempted: false;
  readonly protectedResourceReleased: false;
  readonly agentRegistryLookupAttempted: false;
  readonly productionActivation: false;
};

const MANIFEST_FILENAME =
  "phase5-cryptographic-key-bundle.json";

const BUYER_VERIFICATION_KEY_FILENAME =
  "buyer.verification-key.json";

const BUYER_PRIVATE_KEY_FILENAME =
  "buyer.private-key.pem";

const AGENT_PRIVATE_KEY_FILENAME =
  "agent.private-key.pem";

function usage(): string {
  return [
    "Usage:",
    "  ts-node --transpile-only scripts/demo_phase5_cryptographic_key_bundle.ts \\",
    "    --out-dir <temporary-directory> \\",
    "    [--buyer-id <buyer-id>] \\",
    "    [--buyer-key-id <buyer-key-id>] \\",
    "    [--agent-id <agent-id>] \\",
    "    [--agent-key-id <agent-key-id>]",
    "",
    "Creates:",
    `  ${MANIFEST_FILENAME}`,
    `  ${BUYER_VERIFICATION_KEY_FILENAME}`,
    `  ${BUYER_PRIVATE_KEY_FILENAME}`,
    `  ${AGENT_PRIVATE_KEY_FILENAME}`,
    "",
    "Private key contents are never printed.",
    "The caller is responsible for deleting the temporary directory.",
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
    const arg = argv[index];

    if (
      arg === "--help" ||
      arg === "-h"
    ) {
      args.help = true;
      continue;
    }

    const next = argv[index + 1];

    switch (arg) {
      case "--out-dir":
        args.outDir = next;
        index += 1;
        break;

      case "--buyer-id":
        args.buyerId = next;
        index += 1;
        break;

      case "--buyer-key-id":
        args.buyerKeyId = next;
        index += 1;
        break;

      case "--agent-id":
        args.agentId = next;
        index += 1;
        break;

      case "--agent-key-id":
        args.agentKeyId = next;
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

function requireNonEmpty(
  value: string | undefined,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value.trim();
}

function publicJwk(
  key: KeyObject,
  kid: string,
): BuyerToAgentDelegationEd25519PublicKeyJwk {
  const exported =
    key.export({
      format: "jwk",
    }) as ExportedJwk;

  if (
    exported.kty !== "OKP" ||
    exported.crv !== "Ed25519" ||
    typeof exported.x !== "string" ||
    exported.x.length === 0
  ) {
    throw new Error(
      "generated Ed25519 public key has an unexpected JWK shape",
    );
  }

  return {
    kty: "OKP",
    crv: "Ed25519",
    x: exported.x,
    kid,
    use: "sig",
    alg: "EdDSA",
  };
}

function privateKeyPem(
  key: KeyObject,
): string {
  const exported =
    key.export({
      format: "pem",
      type: "pkcs8",
    });

  return Buffer.isBuffer(exported)
    ? exported.toString("utf8")
    : exported;
}

function writeExclusive(
  filePath: string,
  value: string,
  mode: number,
): void {
  const descriptor =
    fs.openSync(
      filePath,
      "wx",
      mode,
    );

  try {
    fs.writeFileSync(
      descriptor,
      value,
      {
        encoding: "utf8",
      },
    );
  } finally {
    fs.closeSync(descriptor);
  }

  try {
    fs.chmodSync(
      filePath,
      mode,
    );
  } catch {
    // Windows may not enforce POSIX mode bits.
    // The demo still uses a unique temporary directory
    // and deletes all private material on completion.
  }
}

function writeJsonExclusive(
  filePath: string,
  value: unknown,
  mode: number,
): void {
  writeExclusive(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    mode,
  );
}

function main(): void {
  const args =
    parseArgs(
      process.argv.slice(2),
    );

  if (args.help) {
    console.log(usage());
    return;
  }

  const outDir =
    path.resolve(
      requireNonEmpty(
        args.outDir,
        "--out-dir",
      ),
    );

  const buyerId =
    args.buyerId ??
    "buyer:phase5-cryptographic-demo2";

  const buyerKeyId =
    args.buyerKeyId ??
    "buyer-key:phase5-cryptographic-demo2";

  const agentId =
    args.agentId ??
    "agent:phase5-cryptographic-demo2";

  const agentKeyId =
    args.agentKeyId ??
    "agent-key:phase5-cryptographic-demo2";

  fs.mkdirSync(
    outDir,
    {
      recursive: true,
      mode: 0o700,
    },
  );

  try {
    fs.chmodSync(
      outDir,
      0o700,
    );
  } catch {
    // Best-effort on Windows.
  }

  const buyerKeyPair =
    generateKeyPairSync(
      "ed25519",
    );

  const agentKeyPair =
    generateKeyPairSync(
      "ed25519",
    );

  const buyerPublicKeyJwk =
    publicJwk(
      buyerKeyPair.publicKey,
      buyerKeyId,
    );

  const agentPublicKeyJwk =
    publicJwk(
      agentKeyPair.publicKey,
      agentKeyId,
    );

  const buyerVerificationKey:
    BuyerDelegationVerificationKey = {
      buyerKeyId,
      publicKeyJwk:
        buyerPublicKeyJwk,
      source:
        BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
    };

  const manifest:
    DemoKeyBundleManifest = {
      contract:
        "phase5.demoCryptographicKeyBundle.v1",

      mode:
        "controlled_cryptographic_demo2",

      buyer: {
        buyerId,
        buyerKeyId,
        verificationKeyFile:
          BUYER_VERIFICATION_KEY_FILENAME,
        privateKeyFile:
          BUYER_PRIVATE_KEY_FILENAME,
      },

      agent: {
        agentId,
        agentKeyId,
        publicKeyJwk:
          agentPublicKeyJwk,
        privateKeyFile:
          AGENT_PRIVATE_KEY_FILENAME,
      },

      privateMaterialTemporary:
        true,

      privateMaterialPrinted:
        false,

      gatewayCalled:
        false,

      crpCalled:
        false,

      paymentAttempted:
        false,

      protectedResourceReleased:
        false,

      agentRegistryLookupAttempted:
        false,

      productionActivation:
        false,
    };

  const manifestPath =
    path.join(
      outDir,
      MANIFEST_FILENAME,
    );

  const buyerVerificationKeyPath =
    path.join(
      outDir,
      BUYER_VERIFICATION_KEY_FILENAME,
    );

  const buyerPrivateKeyPath =
    path.join(
      outDir,
      BUYER_PRIVATE_KEY_FILENAME,
    );

  const agentPrivateKeyPath =
    path.join(
      outDir,
      AGENT_PRIVATE_KEY_FILENAME,
    );

  writeJsonExclusive(
    buyerVerificationKeyPath,
    buyerVerificationKey,
    0o600,
  );

  writeExclusive(
    buyerPrivateKeyPath,
    privateKeyPem(
      buyerKeyPair.privateKey,
    ),
    0o600,
  );

  writeExclusive(
    agentPrivateKeyPath,
    privateKeyPem(
      agentKeyPair.privateKey,
    ),
    0o600,
  );

  writeJsonExclusive(
    manifestPath,
    manifest,
    0o600,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        helper:
          "demo.phase5CryptographicKeyBundle.v1",
        mode:
          manifest.mode,
        outDir,
        manifestPath,
        buyerVerificationKeyPath,
        temporaryPrivateKeyFileCount:
          2,
        privateMaterialTemporary:
          true,
        privateMaterialPrinted:
          false,
        gatewayCalled:
          false,
        crpCalled:
          false,
        paymentAttempted:
          false,
        protectedResourceReleased:
          false,
        agentRegistryLookupAttempted:
          false,
        productionActivation:
          false,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error(
    JSON.stringify(
      {
        ok: false,
        helper:
          "demo.phase5CryptographicKeyBundle.v1",
        reason: message,
        privateMaterialPrinted:
          false,
        gatewayCalled:
          false,
        crpCalled:
          false,
        paymentAttempted:
          false,
        protectedResourceReleased:
          false,
        agentRegistryLookupAttempted:
          false,
        productionActivation:
          false,
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
}
