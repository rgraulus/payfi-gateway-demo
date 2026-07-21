#!/usr/bin/env node
/**
 * Enrich a controlled Phase 5 Demo1 redeem body with Demo2 cryptographic
 * delegation material bound to the exact canonical challenge.
 *
 * The helper reads temporary buyer and agent PKCS#8 private keys but never
 * prints or embeds private material. It performs no Gateway, CRP, payment,
 * settlement, replay, release, Agent Registry, or production action.
 */

import {
  createPrivateKey,
  sign as signEd25519,
} from "node:crypto";

import canonicalize from "canonicalize";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM,
  AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM,
  AGENT_PROOF_OF_POSSESSION_TYPE,
  AGENT_PROOF_OF_POSSESSION_VERSION,
  verifyAgentProofOfPossession,
  type AgentProofOfPossessionDocument,
  type AgentProofOfPossessionStatement,
} from "../src/phase5/agentProofOfPossessionVerifier";

import {
  PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,
} from "../src/phase5/agentCryptographicDelegationBindingVerifier";

import {
  BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION,
  BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE,
  BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM,
  BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE,
  BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION,
  BUYER_TO_AGENT_DELEGATION_DOMAIN,
  BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM,
  canonicalizeBuyerToAgentDelegationCredential,
  hashBuyerToAgentDelegationCredential,
  type BuyerToAgentDelegationCredential,
  type BuyerToAgentDelegationCredentialDocument,
  type BuyerToAgentDelegationEd25519PublicKeyJwk,
} from "../src/phase5/buyerToAgentDelegationCredential";

import {
  type BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

type JsonRecord =
  Record<string, unknown>;

type Args = {
  inputPath?: string;
  keyBundlePath?: string;
  outPath?: string;
  help?: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  ts-node --transpile-only scripts/demo_agent_delegated_cryptographic_authorization_proof.ts \\",
    "    --input <demo1-redeem-body.json> \\",
    "    --key-bundle <phase5-cryptographic-key-bundle.json> \\",
    "    --out <demo2-redeem-body.json>",
    "",
    "The input must already contain the canonical Demo1 Phase 5 envelope.",
    "The output adds cryptographicProofs.delegationCredential and",
    "cryptographicProofs.agentProofOfPossession.",
    "",
    "Private key contents are never printed or written to the output.",
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
      case "--input":
        args.inputPath = next;
        index += 1;
        break;

      case "--key-bundle":
        args.keyBundlePath = next;
        index += 1;
        break;

      case "--out":
        args.outPath = next;
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

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readJsonObject(
  filePath: string,
): JsonRecord {
  const value =
    JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    ) as unknown;

  if (!isRecord(value)) {
    throw new Error(
      `${filePath} must contain a JSON object`,
    );
  }

  return value;
}

function requiredRecord(
  record: JsonRecord,
  field: string,
): JsonRecord {
  const value = record[field];

  if (!isRecord(value)) {
    throw new Error(
      `missing object ${field}`,
    );
  }

  return value;
}

function requiredString(
  record: JsonRecord,
  field: string,
): string {
  const value = record[field];

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `missing string ${field}`,
    );
  }

  return value;
}

function requiredInteger(
  record: JsonRecord,
  field: string,
): number {
  const value = record[field];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(
      `missing integer ${field}`,
    );
  }

  return value;
}

function publicJwk(
  value: unknown,
  expectedKid: string,
): BuyerToAgentDelegationEd25519PublicKeyJwk {
  if (!isRecord(value)) {
    throw new Error(
      "agent public JWK is missing",
    );
  }

  if (
    value.kty !== "OKP" ||
    value.crv !== "Ed25519" ||
    typeof value.x !== "string" ||
    value.x.length === 0 ||
    value.kid !== expectedKid
  ) {
    throw new Error(
      "agent public JWK is invalid",
    );
  }

  return {
    kty: "OKP",
    crv: "Ed25519",
    x: value.x,
    kid: expectedKid,
    use: "sig",
    alg: "EdDSA",
  };
}

function canonicalizeStatement(
  statement:
    AgentProofOfPossessionStatement,
): string {
  const value =
    canonicalize(statement);

  if (typeof value !== "string") {
    throw new Error(
      "agent statement canonicalization failed",
    );
  }

  return value;
}

function signatureValue(
  canonicalValue: string,
  privateKeyPath: string,
): string {
  const privateKey =
    createPrivateKey(
      fs.readFileSync(
        privateKeyPath,
        "utf8",
      ),
    );

  return signEd25519(
    null,
    Buffer.from(
      canonicalValue,
      "utf8",
    ),
    privateKey,
  ).toString("base64url");
}

function assertNoPrivateJwk(
  value: unknown,
  location = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        assertNoPrivateJwk(
          item,
          `${location}[${index}]`,
        ),
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (key === "d") {
      throw new Error(
        `private JWK material found at ${location}.${key}`,
      );
    }

    assertNoPrivateJwk(
      child,
      `${location}.${key}`,
    );
  }
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

  const inputPath =
    path.resolve(
      requireNonEmpty(
        args.inputPath,
        "--input",
      ),
    );

  const keyBundlePath =
    path.resolve(
      requireNonEmpty(
        args.keyBundlePath,
        "--key-bundle",
      ),
    );

  const outPath =
    path.resolve(
      requireNonEmpty(
        args.outPath,
        "--out",
      ),
    );

  const body =
    readJsonObject(inputPath);

  const authorizationProof =
    requiredRecord(
      body,
      "authorizationProof",
    );

  const challenge =
    requiredRecord(
      authorizationProof,
      "challenge",
    );

  const delegation =
    requiredRecord(
      authorizationProof,
      "delegation",
    );

  const buyer =
    requiredRecord(
      authorizationProof,
      "buyer",
    );

  const agent =
    requiredRecord(
      authorizationProof,
      "agent",
    );

  const scope =
    requiredRecord(
      authorizationProof,
      "scope",
    );

  const resource =
    requiredRecord(
      scope,
      "resource",
    );

  const asset =
    requiredRecord(
      scope,
      "asset",
    );

  const manifest =
    readJsonObject(keyBundlePath);

  const manifestBuyer =
    requiredRecord(
      manifest,
      "buyer",
    );

  const manifestAgent =
    requiredRecord(
      manifest,
      "agent",
    );

  const bundleDirectory =
    path.dirname(keyBundlePath);

  const buyerId =
    requiredString(
      manifestBuyer,
      "buyerId",
    );

  const buyerKeyId =
    requiredString(
      manifestBuyer,
      "buyerKeyId",
    );

  const agentId =
    requiredString(
      manifestAgent,
      "agentId",
    );

  const agentKeyId =
    requiredString(
      manifestAgent,
      "agentKeyId",
    );

  if (
    requiredString(
      buyer,
      "policySubject",
    ) !== buyerId
  ) {
    throw new Error(
      "Demo1 buyer.policySubject does not match key-bundle buyerId",
    );
  }

  if (
    requiredString(
      agent,
      "agentId",
    ) !== agentId
  ) {
    throw new Error(
      "Demo1 agent.agentId does not match key-bundle agentId",
    );
  }

  const buyerPrivateKeyPath =
    path.resolve(
      bundleDirectory,
      requiredString(
        manifestBuyer,
        "privateKeyFile",
      ),
    );

  const agentPrivateKeyPath =
    path.resolve(
      bundleDirectory,
      requiredString(
        manifestAgent,
        "privateKeyFile",
      ),
    );

  const buyerVerificationKeyPath =
    path.resolve(
      bundleDirectory,
      requiredString(
        manifestBuyer,
        "verificationKeyFile",
      ),
    );

  const buyerVerificationKey =
    readJsonObject(
      buyerVerificationKeyPath,
    ) as unknown as
      BuyerDelegationVerificationKey;

  const nonce =
    requiredString(
      body,
      "nonce",
    );

  if (
    requiredString(
      challenge,
      "nonce",
    ) !== nonce
  ) {
    throw new Error(
      "body nonce does not match authorization challenge",
    );
  }

  const delegationId =
    requiredString(
      delegation,
      "delegationId",
    );

  const issuedAt =
    requiredInteger(
      delegation,
      "delegationIssuedAt",
    );

  const expiresAt =
    requiredInteger(
      delegation,
      "delegationExpiresAt",
    );

  const challengeIssuedAt =
    requiredInteger(
      challenge,
      "issuedAt",
    );

  const challengeExpiresAt =
    requiredInteger(
      challenge,
      "expiresAt",
    );

  if (
    issuedAt > challengeIssuedAt ||
    expiresAt < challengeExpiresAt
  ) {
    throw new Error(
      "delegation validity does not contain challenge window",
    );
  }

  const credential:
    BuyerToAgentDelegationCredential = {
      credentialType:
        BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE,

      credentialVersion:
        BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION,

      delegationId,

      issuer: {
        buyerId,
        buyerKeyId,
      },

      subject: {
        agentId,
        agentKeyId,
        agentPublicKeyJwk:
          publicJwk(
            manifestAgent.publicKeyJwk,
            agentKeyId,
          ),
      },

      scope: {
        merchantId:
          requiredString(
            scope,
            "merchantId",
          ),

        resource: {
          method:
            requiredString(
              resource,
              "method",
            ).toUpperCase(),

          path:
            requiredString(
              resource,
              "path",
            ),
        },

        contract: {
          contractId:
            requiredString(
              scope,
              "contractId",
            ),

          contractVersion:
            requiredString(
              scope,
              "contractVersion",
            ),
        },

        network:
          requiredString(
            scope,
            "network",
          ),

        asset: {
          type: "PLT",

          tokenId:
            requiredString(
              asset,
              "tokenId",
            ),

          decimals:
            requiredInteger(
              asset,
              "decimals",
            ),
        },

        amount: {
          mode:
            BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE,

          value:
            requiredString(
              scope,
              "amount",
            ),
        },

        payTo:
          requiredString(
            scope,
            "payTo",
          ),

        allowedAction:
          BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION,
      },

      validity: {
        issuedAt,
        notBefore: issuedAt,
        expiresAt,
      },

      usage: {
        maxUses:
          requiredInteger(
            scope,
            "maxUses",
          ),
      },

      replay: {
        audience:
          PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,

        domain:
          BUYER_TO_AGENT_DELEGATION_DOMAIN,

        credentialNonce:
          `credential-${nonce}`,
      },

      lifecycle: {
        revocationId:
          `revocation-${delegationId}`,

        buyerKeyVersion:
          1,

        agentKeyVersion:
          1,
      },
    };

  const delegationDocument:
    BuyerToAgentDelegationCredentialDocument = {
      credential,

      proof: {
        signatureAlgorithm:
          BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM,

        canonicalizationAlgorithm:
          BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM,

        verificationMethod:
          buyerKeyId,

        signatureValue:
          signatureValue(
            canonicalizeBuyerToAgentDelegationCredential(
              credential,
            ),
            buyerPrivateKeyPath,
          ),
      },
    };

  const credentialHash =
    hashBuyerToAgentDelegationCredential(
      credential,
    );

  const statement:
    AgentProofOfPossessionStatement = {
      proofType:
        AGENT_PROOF_OF_POSSESSION_TYPE,

      proofVersion:
        AGENT_PROOF_OF_POSSESSION_VERSION,

      delegationId,
      credentialHash,
      agentId,
      agentKeyId,

      audience:
        PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,

      challenge: {
        nonce,

        challengeHash:
          requiredString(
            challenge,
            "challengeHash",
          ),

        issuedAt:
          challengeIssuedAt,

        expiresAt:
          challengeExpiresAt,
      },
    };

  const proofDocument:
    AgentProofOfPossessionDocument = {
      statement,

      proof: {
        signatureAlgorithm:
          AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM,

        canonicalizationAlgorithm:
          AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM,

        verificationMethod:
          agentKeyId,

        signatureValue:
          signatureValue(
            canonicalizeStatement(
              statement,
            ),
            agentPrivateKeyPath,
          ),
      },
    };

  const verification =
    verifyAgentProofOfPossession({
      delegationDocument,
      buyerVerificationKey,
      proofDocument,
      expectedChallenge:
        statement.challenge,
    });

  if (!verification.ok) {
    throw new Error(
      `local cryptographic verification failed: ${verification.reason}`,
    );
  }

  authorizationProof.cryptographicProofs = {
    delegationCredential:
      delegationDocument,

    agentProofOfPossession:
      proofDocument,
  };

  assertNoPrivateJwk(body);

  fs.mkdirSync(
    path.dirname(outPath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    outPath,
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        helper:
          "demo.agentDelegatedCryptographicAuthorizationProof.v1",

        mode:
          "controlled_cryptographic_demo2",

        outPath,
        nonce,
        delegationId,
        credentialHash,

        delegationContractValidated:
          verification.delegationContractValidated,

        buyerSignatureVerified:
          verification.buyerSignatureVerified,

        agentPublicKeyBoundByBuyerSignature:
          verification
            .agentPublicKeyBoundByBuyerSignature,

        agentProofOfPossessionVerified:
          verification
            .agentProofOfPossessionVerified,

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
          "demo.agentDelegatedCryptographicAuthorizationProof.v1",

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
