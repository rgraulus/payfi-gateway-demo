import assert from "node:assert/strict";

import {
  generateKeyPairSync,
  randomUUID,
  sign as signEd25519,
  type KeyObject,
} from "node:crypto";

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import fs from "node:fs";
import path from "node:path";

import canonicalize from "canonicalize";

import {
  Client,
} from "pg";

import type {
  ChildProcess,
} from "node:child_process";

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
  BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
  type BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

import {
  PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
} from "../src/phase5/agentDelegationVerifier";

import {
  PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
  PHASE5_AGENT_RUNTIME_MAX_USES,
  PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
} from "../src/phase5/agentRuntimeAuthorization";

import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
} from "../src/phase3/zkpChallenge";

import {
  amountToRawUnits,
} from "../src/proofPayload";

import {
  assertPhase3HarnessCanonicalChallengeIssued,
  b64decodeJson,
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  killProcessTree,
  phase3HarnessDatabaseUrl,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";


const LABEL =
  "phase5:final-acceptance-enabled-gateway";

const RUN_ID =
  randomUUID()
    .replace(/-/g, "")
    .slice(0, 16);

const GATEWAY_PORT = Number(
  process.env
    .PHASE5_FINAL_ACCEPTANCE_GATEWAY_PORT ??
    3140,
);

const CRP_TRIPWIRE_PORT = Number(
  process.env
    .PHASE5_FINAL_ACCEPTANCE_CRP_PORT ??
    8140,
);

const ORCHESTRATOR_PORT = Number(
  process.env
    .PHASE5_FINAL_ACCEPTANCE_ORCHESTRATOR_PORT ??
    8141,
);

const GATEWAY_BASE =
  baseUrlForPort(GATEWAY_PORT);

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:pg@127.0.0.1:5432/transaction-outcome";

const INVALID_PAYMENT_SIGNATURE =
  Buffer.from(
    '{"nonce":',
    "utf8",
  ).toString(
    "base64",
  );

const WORK_DIRECTORY =
  path.resolve(
    ".tmp",
    `pr297-final-acceptance-${RUN_ID}`,
  );

const BUYER_KEY_PATH =
  path.join(
    WORK_DIRECTORY,
    "buyer.verification-key.json",
  );

const BUYER_ID =
  `buyer:phase5-final-acceptance:${RUN_ID}`;

const BUYER_KEY_ID =
  `buyer-key:phase5-final-acceptance:${RUN_ID}`;

const AGENT_ID =
  `agent:phase5-final-acceptance:${RUN_ID}`;

const AGENT_KEY_ID =
  `agent-key:phase5-final-acceptance:${RUN_ID}`;


const ENVIRONMENT_KEYS = [
  "DATABASE_URL",

  "PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED",

  "PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED",

  "PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED",

  "PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY",

  "PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY_DELEGATION_ID",

  "PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH",

  "PHASE3_GATEWAY_RELEASE_ENABLED",

  "PHASE3_GATEWAY_TEST_RELEASE_ONLY",

  "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",

  "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",

  "PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED",

  "CRP_BASE_URL",
  "ORCHESTRATOR_BASE_URL",
  "ORCHESTRATOR_API_KEY",
] as const;


type EnvironmentKey =
  typeof ENVIRONMENT_KEYS[number];

type EnvironmentSnapshot =
  Record<
    EnvironmentKey,
    string | undefined
  >;

type RecordedRequest = {
  readonly method: string;
  readonly path: string;
};

type RecordingServer = {
  readonly baseUrl: string;

  readonly requests:
    RecordedRequest[];

  readonly close:
    () => Promise<void>;
};

type PublicJwkExport = {
  readonly kty?: string;
  readonly crv?: string;
  readonly x?: string;
};

type CryptographicIdentity = {
  readonly buyerPrivateKey:
    KeyObject;

  readonly agentPrivateKey:
    KeyObject;

  readonly buyerVerificationKey:
    BuyerDelegationVerificationKey;

  readonly agentPublicKeyJwk:
    BuyerToAgentDelegationEd25519PublicKeyJwk;
};

type SignedDelegation = {
  readonly delegationId: string;
  readonly revocationId: string;

  readonly issuedAt: number;
  readonly notBefore: number;
  readonly expiresAt: number;

  readonly maxUses: number;

  readonly document:
    BuyerToAgentDelegationCredentialDocument;

  readonly credentialHash: string;
};

type LifecycleDatabaseSnapshot = {
  readonly challengeStatus:
    string | null;

  readonly releaseStatus:
    string | null;

  readonly consumedUses:
    number | null;

  readonly maxUses:
    number | null;

  readonly claimCount: number;
};


let gateway:
  ChildProcess | null = null;

let crpTripwire:
  RecordingServer | null = null;

let orchestratorStub:
  RecordingServer | null = null;

let originalEnvironment:
  EnvironmentSnapshot | null = null;

const createdNonces:
  string[] = [];

const createdCredentialHashes:
  string[] = [];

const createdRevocationIds:
  string[] = [];


function captureEnvironment():
EnvironmentSnapshot {
  const snapshot =
    {} as EnvironmentSnapshot;

  for (
    const key
    of ENVIRONMENT_KEYS
  ) {
    snapshot[key] =
      process.env[key];
  }

  return snapshot;
}


function restoreEnvironment(
  snapshot: EnvironmentSnapshot,
): void {
  for (
    const key
    of ENVIRONMENT_KEYS
  ) {
    const value =
      snapshot[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}


function configureEnvironment(
  crpBaseUrl: string,
  orchestratorBaseUrl: string,
): void {
  process.env.DATABASE_URL =
    DATABASE_URL;

  process.env
    .PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED =
    "true";

  process.env
    .PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED =
    "true";

  process.env
    .PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED =
    "true";

  process.env
    .PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY =
    "true";

  process.env
    .PHASE5_DELEGATION_LIFECYCLE_STORE_FAILURE_TEST_ONLY_DELEGATION_ID =
    `delegation-${RUN_ID}-store-failure`;

  process.env
    .PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH =
    BUYER_KEY_PATH;

  process.env
    .PHASE3_GATEWAY_RELEASE_ENABLED =
    "false";

  process.env
    .PHASE3_GATEWAY_TEST_RELEASE_ONLY =
    "false";

  process.env
    .PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED =
    "false";

  process.env
    .PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED =
    "false";

  process.env
    .PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED =
    "false";

  process.env.CRP_BASE_URL =
    crpBaseUrl;

  process.env.ORCHESTRATOR_BASE_URL =
    orchestratorBaseUrl;

  process.env.ORCHESTRATOR_API_KEY =
    "dev-internal-key";
}


async function readRequestBody(
  req: IncomingMessage,
): Promise<void> {
  for await (const _chunk of req) {
    // Consume the complete body without
    // retaining authorization material.
  }
}


function writeJson(
  res: ServerResponse,
  status: number,
  value: unknown,
): void {
  res.statusCode = status;

  res.setHeader(
    "content-type",
    "application/json",
  );

  res.end(
    JSON.stringify(value),
  );
}


async function startCrpTripwire(
  port: number,
): Promise<RecordingServer> {
  const requests:
    RecordedRequest[] = [];

  const server =
    createServer(
      async (req, res) => {
        const requestPath =
          new URL(
            req.url ?? "/",
            "http://127.0.0.1",
          ).pathname;

        await readRequestBody(req);

        requests.push({
          method:
            req.method ?? "UNKNOWN",

          path:
            requestPath,
        });

        writeJson(res, 500, {
          ok: false,

          reason:
            "unexpected_crp_call_in_phase5_final_acceptance",
        });
      },
    );

  await new Promise<void>(
    (resolve, reject) => {
      server.once(
        "error",
        reject,
      );

      server.listen(
        port,
        "127.0.0.1",
        () => {
          server.off(
            "error",
            reject,
          );

          resolve();
        },
      );
    },
  );

  return {
    baseUrl:
      baseUrlForPort(port),

    requests,

    close:
      () =>
        new Promise<void>(
          (resolve, reject) => {
            server.close(
              (error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              },
            );
          },
        ),
  };
}


async function startOrchestratorStub(
  port: number,
): Promise<RecordingServer> {
  const requests:
    RecordedRequest[] = [];

  const server =
    createServer(
      async (req, res) => {
        const requestPath =
          new URL(
            req.url ?? "/",
            "http://127.0.0.1",
          ).pathname;

        await readRequestBody(req);

        requests.push({
          method:
            req.method ?? "UNKNOWN",

          path:
            requestPath,
        });

        if (
          req.method === "POST" &&
          requestPath ===
            "/internal/payments/intents"
        ) {
          writeJson(res, 200, {
            ok: true,
            accepted: true,
          });

          return;
        }

        if (
          req.method === "POST" &&
          requestPath ===
            "/internal/payments/proof"
        ) {
          writeJson(res, 200, {
            ok: true,
            accepted: true,
          });

          return;
        }

        if (
          req.method === "POST" &&
          requestPath ===
            "/internal/payments/release-check"
        ) {
          writeJson(res, 200, {
            ok: true,
            ready: false,

            reason:
              "controlled_final_acceptance_only",
          });

          return;
        }

        writeJson(res, 404, {
          ok: false,
          reason: "not_found",
        });
      },
    );

  await new Promise<void>(
    (resolve, reject) => {
      server.once(
        "error",
        reject,
      );

      server.listen(
        port,
        "127.0.0.1",
        () => {
          server.off(
            "error",
            reject,
          );

          resolve();
        },
      );
    },
  );

  return {
    baseUrl:
      baseUrlForPort(port),

    requests,

    close:
      () =>
        new Promise<void>(
          (resolve, reject) => {
            server.close(
              (error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              },
            );
          },
        ),
  };
}


function publicJwk(
  key: KeyObject,
  keyId: string,
):
BuyerToAgentDelegationEd25519PublicKeyJwk {
  const exported =
    key.export({
      format: "jwk",
    }) as PublicJwkExport;

  assert.equal(
    exported.kty,
    "OKP",
  );

  assert.equal(
    exported.crv,
    "Ed25519",
  );

  const x =
    exported.x;

  if (
    typeof x !== "string" ||
    x.length === 0
  ) {
    throw new Error(
      "generated Ed25519 public key has an invalid x coordinate",
    );
  }

  return {
    kty: "OKP",
    crv: "Ed25519",
    x,
    kid: keyId,
    use: "sig",
    alg: "EdDSA",
  };
}


function createCryptographicIdentity():
CryptographicIdentity {
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
      BUYER_KEY_ID,
    );

  const agentPublicKeyJwk =
    publicJwk(
      agentKeyPair.publicKey,
      AGENT_KEY_ID,
    );

  return {
    buyerPrivateKey:
      buyerKeyPair.privateKey,

    agentPrivateKey:
      agentKeyPair.privateKey,

    buyerVerificationKey: {
      buyerKeyId:
        BUYER_KEY_ID,

      publicKeyJwk:
        buyerPublicKeyJwk,

      source:
        BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
    },

    agentPublicKeyJwk,
  };
}


function signatureValue(
  canonicalValue: string,
  privateKey: KeyObject,
): string {
  return signEd25519(
    null,

    Buffer.from(
      canonicalValue,
      "utf8",
    ),

    privateKey,
  ).toString(
    "base64url",
  );
}


function canonicalizeAgentStatement(
  statement:
    AgentProofOfPossessionStatement,
): string {
  const value =
    canonicalize(statement);

  if (typeof value !== "string") {
    throw new Error(
      "agent statement canonicalization must succeed",
    );
  }

  return value;
}


function buildCanonicalChallenge(
  pr: any,
): ReturnType<
  typeof buildX402ZkpChallenge
> {
  return buildX402ZkpChallenge({
    merchantId:
      pr.merchantId,

    resource: {
      method:
        pr.resource.method,

      path:
        pr.resource.path,
    },

    contract: {
      contractId:
        pr.contractId,

      contractVersion:
        pr.contractVersion,

      isFrozen:
        pr.isFrozen,
    },

    network:
      pr.network,

    chain_id:
      pr.chain_id,

    caip2ChainId:
      null,

    asset: {
      type:
        pr.asset.type,

      tokenId:
        pr.asset.tokenId,

      decimals:
        pr.asset.decimals,
    },

    amount:
      pr.amount,

    amountMinor:
      amountToRawUnits(
        pr.amount,
        pr.asset.decimals,
      ),

    payTo:
      pr.payTo,

    nonce:
      pr.nonce,

    issuedAt:
      pr.issuedAt,

    expiresAt:
      pr.expiresAt,

    policy:
      PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,

    businessTerms:
      null,

    buyer:
      null,

    agent:
      null,
  });
}


function createSignedDelegation(
  pr: any,

  identity:
    CryptographicIdentity,

  options: {
    readonly delegationId: string;
    readonly issuedAt: number;
    readonly notBefore: number;
    readonly expiresAt: number;
    readonly maxUses: number;
  },
): SignedDelegation {
  const revocationId =
    `revocation-${options.delegationId}`;

  const credential:
    BuyerToAgentDelegationCredential = {
      credentialType:
        BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE,

      credentialVersion:
        BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION,

      delegationId:
        options.delegationId,

      issuer: {
        buyerId:
          BUYER_ID,

        buyerKeyId:
          BUYER_KEY_ID,
      },

      subject: {
        agentId:
          AGENT_ID,

        agentKeyId:
          AGENT_KEY_ID,

        agentPublicKeyJwk:
          identity.agentPublicKeyJwk,
      },

      scope: {
        merchantId:
          pr.merchantId,

        resource: {
          method:
            String(
              pr.resource.method,
            ).toUpperCase(),

          path:
            pr.resource.path,
        },

        contract: {
          contractId:
            pr.contractId,

          contractVersion:
            pr.contractVersion,
        },

        network:
          pr.network,

        asset: {
          type: "PLT",

          tokenId:
            pr.asset.tokenId,

          decimals:
            pr.asset.decimals,
        },

        amount: {
          mode:
            BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE,

          value:
            pr.amount,
        },

        payTo:
          pr.payTo,

        allowedAction:
          BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION,
      },

      validity: {
        issuedAt:
          options.issuedAt,

        notBefore:
          options.notBefore,

        expiresAt:
          options.expiresAt,
      },

      usage: {
        maxUses:
          options.maxUses,
      },

      replay: {
        audience:
          PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,

        domain:
          BUYER_TO_AGENT_DELEGATION_DOMAIN,

        credentialNonce:
          `credential-${options.delegationId}`,
      },

      lifecycle: {
        revocationId,

        buyerKeyVersion:
          1,

        agentKeyVersion:
          1,
      },
    };

  const document:
    BuyerToAgentDelegationCredentialDocument = {
      credential,

      proof: {
        signatureAlgorithm:
          BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM,

        canonicalizationAlgorithm:
          BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM,

        verificationMethod:
          BUYER_KEY_ID,

        signatureValue:
          signatureValue(
            canonicalizeBuyerToAgentDelegationCredential(
              credential,
            ),

            identity.buyerPrivateKey,
          ),
      },
    };

  return {
    delegationId:
      options.delegationId,

    revocationId,

    issuedAt:
      options.issuedAt,

    notBefore:
      options.notBefore,

    expiresAt:
      options.expiresAt,

    maxUses:
      options.maxUses,

    document,

    credentialHash:
      hashBuyerToAgentDelegationCredential(
        credential,
      ),
  };
}


function buildRedeemBody(
  pr: any,

  identity:
    CryptographicIdentity,

  delegation:
    SignedDelegation,

  buyerPolicy: {
    readonly region: string;
    readonly ageOver: number;
  },
): any {
  const challenge =
    buildCanonicalChallenge(pr);

  const challengeHash =
    hashX402ZkpChallenge(
      challenge,
    );

  const statement:
    AgentProofOfPossessionStatement = {
      proofType:
        AGENT_PROOF_OF_POSSESSION_TYPE,

      proofVersion:
        AGENT_PROOF_OF_POSSESSION_VERSION,

      delegationId:
        delegation.delegationId,

      credentialHash:
        delegation.credentialHash,

      agentId:
        AGENT_ID,

      agentKeyId:
        AGENT_KEY_ID,

      audience:
        PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE,

      challenge: {
        nonce:
          pr.nonce,

        challengeHash,

        issuedAt:
          pr.issuedAt,

        expiresAt:
          pr.expiresAt,
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
          AGENT_KEY_ID,

        signatureValue:
          signatureValue(
            canonicalizeAgentStatement(
              statement,
            ),

            identity.agentPrivateKey,
          ),
      },
    };

  const localVerification =
    verifyAgentProofOfPossession({
      delegationDocument:
        delegation.document,

      buyerVerificationKey:
        identity.buyerVerificationKey,

      proofDocument,

      expectedChallenge:
        statement.challenge,
    });

  assert.equal(
    localVerification.ok,
    true,

    `local cryptographic verification failed: ${localVerification.reason}`,
  );

  const authorizationProof = {
    authorizationProofType:
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,

    agent: {
      agentId:
        AGENT_ID,

      agentType:
        "controlled-final-acceptance-agent",
    },

    buyer: {
      buyerCommitment:
        `sha256:${RUN_ID}`,

      buyerAccount:
        "ccd1qphase5finalacceptancebuyer",

      policySubject:
        BUYER_ID,
    },

    delegation: {
      delegationId:
        delegation.delegationId,

      delegationIssuedAt:
        delegation.issuedAt,

      delegationExpiresAt:
        delegation.expiresAt,

      delegationProofPresent:
        true,

      delegationProofPrinted:
        false,
    },

    challenge: {
      nonce:
        pr.nonce,

      challengeHash,

      issuedAt:
        pr.issuedAt,

      expiresAt:
        pr.expiresAt,
    },

    scope: {
      merchantId:
        pr.merchantId,

      resource: {
        method:
          String(
            pr.resource.method,
          ).toUpperCase(),

        path:
          pr.resource.path,
      },

      contractId:
        pr.contractId,

      contractVersion:
        pr.contractVersion,

      network:
        pr.network,

      asset: {
        type:
          pr.asset.type,

        tokenId:
          pr.asset.tokenId,

        decimals:
          pr.asset.decimals,
      },

      amount:
        pr.amount,

      payTo:
        pr.payTo,

      allowedAction:
        PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,

      maxUses:
        delegation.maxUses,
    },

    policyEvidence: {
      proofType:
        "concordium.VerifiablePresentation",

      claims: {
        region:
          buyerPolicy.region,

        ageOver:
          buyerPolicy.ageOver,
      },

      rawProofPrinted:
        false,
    },

    cryptographicProofs: {
      delegationCredential:
        delegation.document,

      agentProofOfPossession:
        proofDocument,
    },
  };

  assertNoPrivateJwk(
    authorizationProof,
  );

  return {
    nonce:
      pr.nonce,

    authorizationProof,
  };
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

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  for (
    const [key, child]
    of Object.entries(
      value as Record<string, unknown>,
    )
  ) {
    assert.notEqual(
      key,
      "d",

      `private JWK material found at ${location}.${key}`,
    );

    assertNoPrivateJwk(
      child,
      `${location}.${key}`,
    );
  }
}


async function readLifecycleDatabaseSnapshot(
  nonce: string,
  credentialHash: string,
): Promise<LifecycleDatabaseSnapshot> {
  const client =
    new Client({
      connectionString:
        phase3HarnessDatabaseUrl(),
    });

  await client.connect();

  try {
    const challenge =
      await client.query<{
        status: string;
        release_status: string;
      }>(
        `
        SELECT
          status,
          release_status
        FROM payment_challenges
        WHERE nonce = $1
        LIMIT 1
        `,
        [
          nonce,
        ],
      );

    const usage =
      await client.query<{
        consumed_uses: number | string;
        max_uses: number | string;
      }>(
        `
        SELECT
          consumed_uses,
          max_uses
        FROM phase5_agent_delegation_usage
        WHERE credential_hash = $1
        LIMIT 1
        `,
        [
          credentialHash,
        ],
      );

    const claims =
      await client.query<{
        claim_count: number | string;
      }>(
        `
        SELECT
          COUNT(*) AS claim_count
        FROM phase5_agent_delegation_use_claims
        WHERE credential_hash = $1
        `,
        [
          credentialHash,
        ],
      );

    return {
      challengeStatus:
        challenge.rowCount === 1
          ? String(
              challenge.rows[0].status,
            )
          : null,

      releaseStatus:
        challenge.rowCount === 1
          ? String(
              challenge.rows[0]
                .release_status,
            )
          : null,

      consumedUses:
        usage.rowCount === 1
          ? Number(
              usage.rows[0]
                .consumed_uses,
            )
          : null,

      maxUses:
        usage.rowCount === 1
          ? Number(
              usage.rows[0]
                .max_uses,
            )
          : null,

      claimCount:
        Number(
          claims.rows[0]
            ?.claim_count ??
            0,
        ),
    };
  } finally {
    await client.end();
  }
}


async function insertRevocationFixture(
  delegation:
    SignedDelegation,
): Promise<void> {
  const client =
    new Client({
      connectionString:
        phase3HarnessDatabaseUrl(),
    });

  await client.connect();

  try {
    await client.query(
      `
      INSERT INTO
        phase5_agent_delegation_revocations
        (
          revocation_id,
          delegation_id,
          credential_hash,
          reason_code,
          reason_message,
          metadata
        )
      VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb
        )
      `,
      [
        delegation.revocationId,
        delegation.delegationId,
        delegation.credentialHash,

        "final_acceptance_revoked",

        "Controlled PR #297 final-acceptance revocation fixture.",

        JSON.stringify({
          source:
            "pr297_final_acceptance",

          controlled:
            true,
        }),
      ],
    );
  } finally {
    await client.end();
  }
}


async function readCredentialClaimCount(
  credentialHash: string,
): Promise<number> {
  const client =
    new Client({
      connectionString:
        phase3HarnessDatabaseUrl(),
    });

  await client.connect();

  try {
    const result =
      await client.query<{
        claim_count: number;
      }>(
        `
        SELECT
          COUNT(*)::int AS claim_count
        FROM
          phase5_agent_delegation_use_claims
        WHERE
          credential_hash = $1
        `,
        [
          credentialHash,
        ],
      );

    return Number(
      result.rows[0]?.claim_count ??
      -1,
    );
  } finally {
    await client.end();
  }
}


async function setCanonicalChallengeTimestamps(
  nonce: string,
  issuedAtSec: number,
  expiresAtSec: number,
): Promise<void> {
  assert.equal(
    Number.isInteger(issuedAtSec),
    true,
  );

  assert.equal(
    Number.isInteger(expiresAtSec),
    true,
  );

  assert.equal(
    expiresAtSec > issuedAtSec,
    true,
  );

  const client =
    new Client({
      connectionString:
        phase3HarnessDatabaseUrl(),
    });

  await client.connect();

  try {
    const result =
      await client.query(
        `
        UPDATE
          payment_challenges
        SET
          issued_at =
            to_timestamp($2),
          expires_at =
            to_timestamp($3),
          updated_at =
            now()
        WHERE
          nonce = $1
        `,
        [
          nonce,
          issuedAtSec,
          expiresAtSec,
        ],
      );

    assert.equal(
      result.rowCount,
      1,
      "controlled clock fixture must update exactly one challenge",
    );
  } finally {
    await client.end();
  }
}


async function cleanDatabaseRows():
Promise<void> {
  if (
    createdNonces.length === 0 &&
    createdCredentialHashes.length === 0 &&
    createdRevocationIds.length === 0
  ) {
    return;
  }

  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    await client.query("BEGIN");

    if (
      createdNonces.length > 0 ||
      createdCredentialHashes.length > 0
    ) {
      await client.query(
        `
        DELETE FROM
          phase5_agent_delegation_use_claims
        WHERE
          challenge_nonce =
            ANY($1::text[])
          OR
          credential_hash =
            ANY($2::text[])
        `,
        [
          createdNonces,
          createdCredentialHashes,
        ],
      );
    }

    if (
      createdCredentialHashes.length > 0
    ) {
      await client.query(
        `
        DELETE FROM
          phase5_agent_delegation_usage
        WHERE
          credential_hash =
            ANY($1::text[])
        `,
        [
          createdCredentialHashes,
        ],
      );
    }

    if (
      createdRevocationIds.length > 0
    ) {
      await client.query(
        `
        DELETE FROM
          phase5_agent_delegation_revocations
        WHERE
          revocation_id =
            ANY($1::text[])
        `,
        [
          createdRevocationIds,
        ],
      );
    }

    if (
      createdNonces.length > 0
    ) {
      await client.query(
        `
        DELETE FROM
          payment_challenges
        WHERE
          nonce =
            ANY($1::text[])
        `,
        [
          createdNonces,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}


async function cleanup():
Promise<void> {
  try {
    await cleanDatabaseRows();
  } catch (error) {
    console.error(
      `[${LABEL}] database cleanup failed:`,
      error,
    );
  }

  await killProcessTree(
    gateway,
  );

  gateway = null;

  await waitForPortClosed(
    GATEWAY_PORT,
  );

  if (orchestratorStub) {
    try {
      await orchestratorStub.close();
    } catch {
      // Best-effort controlled cleanup.
    }

    orchestratorStub = null;
  }

  if (crpTripwire) {
    try {
      await crpTripwire.close();
    } catch {
      // Best-effort controlled cleanup.
    }

    crpTripwire = null;
  }

  if (originalEnvironment) {
    restoreEnvironment(
      originalEnvironment,
    );

    originalEnvironment = null;
  }

  fs.rmSync(
    WORK_DIRECTORY,
    {
      recursive: true,
      force: true,
    },
  );
}


async function issuePaidGatedChallengeWithoutCrp(
  base: string,
): Promise<any> {
  const response =
    await request(
      base,
      "/paid-gated",
      {
        headers: {
          "PAYMENT-SIGNATURE":
            INVALID_PAYMENT_SIGNATURE,
        },
      },
    );

  assert.equal(
    response.status,
    402,
    "malformed-signature GET /paid-gated should issue 402",
  );

  assert.equal(
    response.json?.error,
    "Invalid payment signature header",
  );

  assert.equal(
    response.headers.get(
      "payment-response",
    ),
    null,
    "controlled challenge issuance must not emit PAYMENT-RESPONSE",
  );

  const paymentRequiredB64 =
    response.headers.get(
      "payment-required",
    );

  assert.ok(
    paymentRequiredB64,
    "PAYMENT-REQUIRED header must be present",
  );

  const paymentRequired =
    b64decodeJson(
      paymentRequiredB64,
    );

  assert.equal(
    paymentRequired.resource?.path,
    "/paid-gated",
  );

  assert.equal(
    paymentRequired
      .policyRequirements?.required,
    true,
  );

  assert.ok(
    paymentRequired.nonce,
    "PAYMENT-REQUIRED must include nonce",
  );

  await assertPhase3HarnessCanonicalChallengeIssued(
    paymentRequired,
  );

  return paymentRequired;
}


async function runPositiveCurrentCase(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly nonce: string;
  readonly credentialHash: string;
  readonly reason: string;
  readonly usageCount: number;
}> {
  const paymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    paymentRequired.nonce,
  );

  const nowSec =
    Math.floor(
      Date.now() / 1000,
    );

  const delegation =
    createSignedDelegation(
      paymentRequired,
      identity,
      {
        delegationId:
          `delegation-${RUN_ID}-positive`,

        issuedAt:
          nowSec - 60,

        notBefore:
          nowSec - 60,

        expiresAt:
          Math.max(
            paymentRequired.expiresAt + 60,
            nowSec + 3600,
          ),

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  const body =
    buildRedeemBody(
      paymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      },
    );

  assert.equal(
    result.status,
    200,
  );

  assert.equal(
    result.json?.ok,
    true,
  );

  assert.equal(
    result.json?.reason,
    "policy_satisfied",
  );

  assert.equal(
    result.json?.policyStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    result.json?.policyDecision
      ?.policyDecision,
    "allow",
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementEnabled,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.cryptographicDelegationVerification,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.currentAuthorizationEstablished,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.validityEvaluatedAgainstClock,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.credentialCurrentlyValid,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.revocationChecked,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationRevoked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseChecked,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseConsumed,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimReason,
    "claimed",
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimCreated,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimIdempotent,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationUseCount,
    1,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationMaxUses,
    1,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationUseNumber,
    1,
  );

  assert.equal(
    result.json?.phase5
      ?.lifecyclePolicyStateMutated,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.policyStateMutated,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
  );

  const snapshot =
    await readLifecycleDatabaseSnapshot(
      paymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    snapshot.challengeStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    snapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    snapshot.consumedUses,
    1,
  );

  assert.equal(
    snapshot.maxUses,
    1,
  );

  assert.equal(
    snapshot.claimCount,
    1,
  );

  return {
    nonce:
      paymentRequired.nonce,

    credentialHash:
      delegation.credentialHash,

    reason:
      String(
        result.json.reason,
      ),

    usageCount:
      snapshot.consumedUses,
  };
}


async function runPolicyDeniedNoConsumptionCase(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly nonce: string;
  readonly credentialHash: string;
  readonly reason: string;
  readonly claimCount: number;
}> {
  const paymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    paymentRequired.nonce,
  );

  const nowSec =
    Math.floor(
      Date.now() / 1000,
    );

  const delegation =
    createSignedDelegation(
      paymentRequired,
      identity,
      {
        delegationId:
          `delegation-${RUN_ID}-policy-denied`,

        issuedAt:
          nowSec - 60,

        notBefore:
          nowSec - 60,

        expiresAt:
          Math.max(
            paymentRequired.expiresAt + 60,
            nowSec + 3600,
          ),

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  const body =
    buildRedeemBody(
      paymentRequired,
      identity,
      delegation,
      {
        region: "US",
        ageOver: 18,
      },
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      },
    );

  assert.equal(
    result.status,
    403,
  );

  assert.equal(
    result.json?.ok,
    false,
  );

  assert.equal(
    result.json?.reason,
    "age_requirement_not_met",
  );

  assert.equal(
    result.json?.policyStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    result.json?.policyDecision
      ?.policyDecision,
    "deny",
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.cryptographicDelegationVerification,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.validityEvaluatedAgainstClock,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.credentialCurrentlyValid,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.revocationChecked,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationRevoked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.currentAuthorizationEstablished,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.policyStateMutated,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
  );

  const snapshot =
    await readLifecycleDatabaseSnapshot(
      paymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    snapshot.challengeStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    snapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    snapshot.consumedUses,
    null,
    "policy denial must not create or consume usage state",
  );

  assert.equal(
    snapshot.maxUses,
    null,
    "policy denial must not create bounded-use state",
  );

  assert.equal(
    snapshot.claimCount,
    0,
    "policy denial must not create a use claim",
  );

  return {
    nonce:
      paymentRequired.nonce,

    credentialHash:
      delegation.credentialHash,

    reason:
      String(
        result.json.reason,
      ),

    claimCount:
      snapshot.claimCount,
  };
}


async function runRevokedNoConsumptionCase(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly nonce: string;
  readonly credentialHash: string;
  readonly reason: string;
  readonly claimCount: number;
}> {
  const paymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    paymentRequired.nonce,
  );

  const nowSec =
    Math.floor(
      Date.now() / 1000,
    );

  const delegation =
    createSignedDelegation(
      paymentRequired,
      identity,
      {
        delegationId:
          `delegation-${RUN_ID}-revoked`,

        issuedAt:
          nowSec - 60,

        notBefore:
          nowSec - 60,

        expiresAt:
          Math.max(
            paymentRequired.expiresAt + 60,
            nowSec + 3600,
          ),

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  await insertRevocationFixture(
    delegation,
  );

  const body =
    buildRedeemBody(
      paymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      },
    );

  assert.equal(
    result.status,
    403,
    `revoked delegation response: ${result.text}`,
  );

  assert.equal(
    result.json?.ok,
    false,
  );

  assert.equal(
    result.json?.reason,
    "delegation_revoked",
  );

  assert.equal(
    result.json?.code,
    "delegation_revoked",
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.cryptographicDelegationVerification,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.validityEvaluatedAgainstClock,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.credentialCurrentlyValid,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.revocationChecked,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.revocationReason,
    "delegation_revoked",
  );

  assert.equal(
    result.json?.phase5
      ?.delegationRevoked,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.currentAuthorizationEstablished,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.policyStateMutated,
    true,
    "revocation rejection must persist the canonical failure state",
  );

  assert.equal(
    result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
  );

  const snapshot =
    await readLifecycleDatabaseSnapshot(
      paymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    snapshot.challengeStatus,
    "POLICY_FAILED",
    "revocation rejection must persist canonical POLICY_FAILED",
  );

  assert.equal(
    snapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    snapshot.consumedUses,
    null,
    "revoked delegation must not create usage state",
  );

  assert.equal(
    snapshot.maxUses,
    null,
    "revoked delegation must not create bounded-use state",
  );

  assert.equal(
    snapshot.claimCount,
    0,
    "revoked delegation must not create a use claim",
  );

  return {
    nonce:
      paymentRequired.nonce,

    credentialHash:
      delegation.credentialHash,

    reason:
      String(
        result.json.reason,
      ),

    claimCount:
      snapshot.claimCount,
  };
}


async function runIdempotencyAndExhaustionCases(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly retryReason: string;
  readonly exhaustionReason: string;
  readonly usageCount: number;
  readonly maxUses: number;
  readonly totalClaimCount: number;
}> {
  const firstPaymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    firstPaymentRequired.nonce,
  );

  const nowSec =
    Math.floor(
      Date.now() / 1000,
    );

  const delegation =
    createSignedDelegation(
      firstPaymentRequired,
      identity,
      {
        delegationId:
          `delegation-${RUN_ID}-idempotency-exhaustion`,

        issuedAt:
          nowSec - 60,

        notBefore:
          nowSec - 60,

        expiresAt:
          Math.max(
            firstPaymentRequired.expiresAt + 60,
            nowSec + 7200,
          ),

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  const firstBody =
    buildRedeemBody(
      firstPaymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const firstResult =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            firstBody,
          ),
      },
    );

  assert.equal(
    firstResult.status,
    200,
    `initial bounded-use response: ${firstResult.text}`,
  );

  assert.equal(
    firstResult.json?.ok,
    true,
  );

  assert.equal(
    firstResult.json?.reason,
    "policy_satisfied",
  );

  assert.equal(
    firstResult.json?.phase5
      ?.usageClaimReason,
    "claimed",
  );

  assert.equal(
    firstResult.json?.phase5
      ?.usageClaimCreated,
    true,
  );

  assert.equal(
    firstResult.json?.phase5
      ?.usageClaimIdempotent,
    false,
  );

  assert.equal(
    firstResult.json?.phase5
      ?.delegationUseCount,
    1,
  );

  assert.equal(
    firstResult.json?.phase5
      ?.delegationMaxUses,
    1,
  );

  assert.equal(
    firstResult.json?.phase5
      ?.delegationUseNumber,
    1,
  );

  assert.equal(
    firstResult.headers.get(
      "payment-response",
    ),
    null,
  );

  const firstSnapshot =
    await readLifecycleDatabaseSnapshot(
      firstPaymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    firstSnapshot.challengeStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    firstSnapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    firstSnapshot.consumedUses,
    1,
  );

  assert.equal(
    firstSnapshot.maxUses,
    1,
  );

  assert.equal(
    await readCredentialClaimCount(
      delegation.credentialHash,
    ),
    1,
  );


  const retryResult =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            firstBody,
          ),
      },
    );

  assert.equal(
    retryResult.status,
    200,
    `same-nonce retry response: ${retryResult.text}`,
  );

  assert.equal(
    retryResult.json?.ok,
    true,
  );

  assert.equal(
    retryResult.json?.reason,
    "policy_satisfied",
  );

  assert.equal(
    retryResult.json?.phase5
      ?.currentAuthorizationEstablished,
    true,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.boundedUseChecked,
    true,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.boundedUseConsumed,
    true,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.usageClaimReason,
    "already_claimed",
  );

  assert.equal(
    retryResult.json?.phase5
      ?.usageClaimCreated,
    false,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.usageClaimIdempotent,
    true,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.delegationUseCount,
    1,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.delegationMaxUses,
    1,
  );

  assert.equal(
    retryResult.json?.phase5
      ?.delegationUseNumber,
    1,
  );

  assert.equal(
    retryResult.headers.get(
      "payment-response",
    ),
    null,
  );

  const retrySnapshot =
    await readLifecycleDatabaseSnapshot(
      firstPaymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    retrySnapshot.challengeStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    retrySnapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    retrySnapshot.consumedUses,
    1,
    "same-nonce retry must not increment consumed uses",
  );

  assert.equal(
    await readCredentialClaimCount(
      delegation.credentialHash,
    ),
    1,
    "same-nonce retry must not create a second claim",
  );


  const freshPaymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    freshPaymentRequired.nonce,
  );

  const freshBody =
    buildRedeemBody(
      freshPaymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const exhaustedResult =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            freshBody,
          ),
      },
    );

  assert.equal(
    exhaustedResult.status,
    403,
    `fresh-nonce exhaustion response: ${exhaustedResult.text}`,
  );

  assert.equal(
    exhaustedResult.json?.ok,
    false,
  );

  assert.equal(
    exhaustedResult.json?.reason,
    "delegation_use_exhausted",
  );

  assert.equal(
    exhaustedResult.json?.code,
    "delegation_use_exhausted",
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.currentAuthorizationEstablished,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.validityEvaluatedAgainstClock,
    true,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.credentialCurrentlyValid,
    true,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.revocationChecked,
    true,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.delegationRevoked,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.boundedUseChecked,
    true,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.usageClaimReason,
    "delegation_use_exhausted",
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.usageClaimCreated,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.usageClaimIdempotent,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.delegationUseCount,
    1,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.delegationMaxUses,
    1,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.policyStateMutated,
    true,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    exhaustedResult.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    exhaustedResult.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    exhaustedResult.json?.resource,
    "secret-data",
  );

  const exhaustedSnapshot =
    await readLifecycleDatabaseSnapshot(
      freshPaymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    exhaustedSnapshot.challengeStatus,
    "POLICY_FAILED",
    "fresh exhausted nonce must persist canonical POLICY_FAILED",
  );

  assert.equal(
    exhaustedSnapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    exhaustedSnapshot.consumedUses,
    1,
    "exhaustion must not increment consumed uses",
  );

  assert.equal(
    exhaustedSnapshot.maxUses,
    1,
  );

  const totalClaimCount =
    await readCredentialClaimCount(
      delegation.credentialHash,
    );

  assert.equal(
    totalClaimCount,
    1,
    "fresh exhausted nonce must not create a second claim",
  );

  return {
    retryReason:
      String(
        retryResult.json?.phase5
          ?.usageClaimReason,
      ),

    exhaustionReason:
      String(
        exhaustedResult.json?.reason,
      ),

    usageCount:
      Number(
        exhaustedSnapshot.consumedUses,
      ),

    maxUses:
      Number(
        exhaustedSnapshot.maxUses,
      ),

    totalClaimCount,
  };
}


async function runClockFailureCase(
  identity:
    CryptographicIdentity,

  mode:
    "not_yet_valid"
    | "expired",
): Promise<{
  readonly reason: string;
  readonly canonicalStatus: string;
  readonly claimCount: number;
}> {
  const paymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    paymentRequired.nonce,
  );

  const nowSec =
    Math.floor(
      Date.now() / 1000,
    );

  const fixture =
    mode === "not_yet_valid"
      ? {
          canonicalIssuedAt:
            nowSec + 120,

          canonicalExpiresAt:
            nowSec + 600,

          credentialIssuedAt:
            nowSec,

          credentialNotBefore:
            nowSec + 60,

          credentialExpiresAt:
            nowSec + 700,

          expectedReason:
            "delegation_not_yet_valid",
        }
      : {
          canonicalIssuedAt:
            nowSec - 600,

          canonicalExpiresAt:
            nowSec - 300,

          credentialIssuedAt:
            nowSec - 700,

          credentialNotBefore:
            nowSec - 700,

          credentialExpiresAt:
            nowSec - 60,

          expectedReason:
            "challenge_expired",
        };

  await setCanonicalChallengeTimestamps(
    paymentRequired.nonce,
    fixture.canonicalIssuedAt,
    fixture.canonicalExpiresAt,
  );

  paymentRequired.issuedAt =
    fixture.canonicalIssuedAt;

  paymentRequired.expiresAt =
    fixture.canonicalExpiresAt;

  const delegation =
    createSignedDelegation(
      paymentRequired,
      identity,
      {
        delegationId:
          (
            `delegation-${RUN_ID}-clock-`
            + mode
          ),

        issuedAt:
          fixture.credentialIssuedAt,

        notBefore:
          fixture.credentialNotBefore,

        expiresAt:
          fixture.credentialExpiresAt,

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  const body =
    buildRedeemBody(
      paymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      },
    );

  assert.equal(
    result.status,
    403,
    (
      `${mode} lifecycle response: `
      + result.text
    ),
  );

  assert.equal(
    result.json?.ok,
    false,
  );

  if (mode === "expired") {
    assert.equal(
      result.json?.reason,
      "authorization_binding_rejected",
    );

    assert.equal(
      result.json?.code,
      "authorization_binding_rejected",
    );

    assert.equal(
      result.json?.verifier
        ?.authorizationReason,
      fixture.expectedReason,
    );
  } else {
    assert.equal(
      result.json?.reason,
      fixture.expectedReason,
    );

    assert.equal(
      result.json?.code,
      fixture.expectedReason,
    );
  }

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.currentAuthorizationEstablished,
    false,
  );

  if (mode === "expired") {
    assert.equal(
      result.json?.phase5
        ?.cryptographicDelegationVerification,
      false,
    );

    assert.equal(
      result.json?.phase5
        ?.lifecycleEvaluated,
      false,
    );

    assert.equal(
      result.json?.phase5
        ?.validityEvaluatedAgainstClock,
      false,
    );

    assert.equal(
      result.json?.verifier
        ?.authorizationReason,
      fixture.expectedReason,
    );
  } else {
    assert.equal(
      result.json?.phase5
        ?.cryptographicDelegationVerification,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.delegationContractValidated,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.buyerSignatureVerified,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.agentProofOfPossessionVerified,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.credentialValidityCoversChallenge,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.lifecycleEvaluated,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.lifecycleReason,
      fixture.expectedReason,
    );

    assert.equal(
      result.json?.phase5
        ?.validityEvaluatedAgainstClock,
      true,
    );

    assert.equal(
      result.json?.phase5
        ?.credentialCurrentlyValid,
      false,
    );
  }

  assert.equal(
    result.json?.phase5
      ?.revocationChecked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationRevoked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseChecked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimReason,
    null,
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimCreated,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.usageClaimIdempotent,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
  );

  const snapshot =
    await readLifecycleDatabaseSnapshot(
      paymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    snapshot.challengeStatus,
    "POLICY_FAILED",
    (
      `${mode} rejection must persist `
      + "canonical POLICY_FAILED"
    ),
  );

  assert.equal(
    snapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    snapshot.consumedUses,
    null,
    (
      `${mode} rejection must not `
      + "create usage state"
    ),
  );

  assert.equal(
    snapshot.maxUses,
    null,
  );

  assert.equal(
    snapshot.claimCount,
    0,
    (
      `${mode} rejection must not `
      + "create a use claim"
    ),
  );

  return {
    reason:
      mode === "expired"
        ? String(
            result.json?.verifier
              ?.authorizationReason,
          )
        : String(
            result.json.reason,
          ),

    canonicalStatus:
      String(
        snapshot.challengeStatus,
      ),

    claimCount:
      snapshot.claimCount,
  };
}


async function runClockFailureCases(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly notYetValid: {
    readonly reason: string;
    readonly canonicalStatus: string;
    readonly claimCount: number;
  };

  readonly expired: {
    readonly reason: string;
    readonly canonicalStatus: string;
    readonly claimCount: number;
  };
}> {
  const notYetValid =
    await runClockFailureCase(
      identity,
      "not_yet_valid",
    );

  const expired =
    await runClockFailureCase(
      identity,
      "expired",
    );

  return {
    notYetValid,
    expired,
  };
}


async function runStoreFailureCase(
  identity:
    CryptographicIdentity,
): Promise<{
  readonly reason: string;
  readonly canonicalStatus: string;
  readonly claimCount: number;
}> {
  const paymentRequired =
    await issuePaidGatedChallengeWithoutCrp(
      GATEWAY_BASE,
    );

  createdNonces.push(
    paymentRequired.nonce,
  );

  const delegation =
    createSignedDelegation(
      paymentRequired,
      identity,
      {
        delegationId:
          `delegation-${RUN_ID}-store-failure`,

        issuedAt:
          paymentRequired.issuedAt - 60,

        notBefore:
          paymentRequired.issuedAt - 60,

        expiresAt:
          paymentRequired.expiresAt + 60,

        maxUses:
          PHASE5_AGENT_RUNTIME_MAX_USES,
      },
    );

  createdCredentialHashes.push(
    delegation.credentialHash,
  );

  createdRevocationIds.push(
    delegation.revocationId,
  );

  const body =
    buildRedeemBody(
      paymentRequired,
      identity,
      delegation,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(body),
      },
    );

  assert.equal(
    result.status,
    503,
    (
      "lifecycle store failure response: "
      + result.text
    ),
  );

  assert.equal(
    result.json?.ok,
    false,
  );

  assert.equal(
    result.json?.code,
    "phase5_delegation_lifecycle_store_error",
  );

  assert.equal(
    result.json?.reason,
    "phase5_delegation_lifecycle_store_error",
  );

  assert.equal(
    result.json?.policyStatus,
    "POLICY_NOT_EVALUATED",
  );

  assert.equal(
    result.json?.phase5
      ?.runtimeEnabled,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.cryptographicDelegationRuntimeEnabled,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementEnabled,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    result.json?.phase5
      ?.policyStateMutated,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.currentAuthorizationEstablished,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.revocationChecked,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    result.json?.phase5
      ?.productionActivation,
    false,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
  );

  const snapshot =
    await readLifecycleDatabaseSnapshot(
      paymentRequired.nonce,
      delegation.credentialHash,
    );

  assert.equal(
    snapshot.challengeStatus,
    "ISSUED",
    "store failure must not mutate canonical state",
  );

  assert.equal(
    snapshot.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    snapshot.consumedUses,
    null,
  );

  assert.equal(
    snapshot.maxUses,
    null,
  );

  assert.equal(
    snapshot.claimCount,
    0,
    "store failure must not create a use claim",
  );

  return {
    reason:
      String(
        result.json.reason,
      ),

    canonicalStatus:
      String(
        snapshot.challengeStatus,
      ),

    claimCount:
      snapshot.claimCount,
  };
}


async function main():
Promise<void> {
  originalEnvironment =
    captureEnvironment();

  fs.mkdirSync(
    WORK_DIRECTORY,
    {
      recursive: true,
    },
  );

  assert.equal(
    await isPortOpen(
      GATEWAY_PORT,
    ),
    false,
    `Gateway port ${GATEWAY_PORT} must be free`,
  );

  assert.equal(
    await isPortOpen(
      CRP_TRIPWIRE_PORT,
    ),
    false,
    `CRP tripwire port ${CRP_TRIPWIRE_PORT} must be free`,
  );

  assert.equal(
    await isPortOpen(
      ORCHESTRATOR_PORT,
    ),
    false,
    `orchestrator port ${ORCHESTRATOR_PORT} must be free`,
  );

  const identity =
    createCryptographicIdentity();

  fs.writeFileSync(
    BUYER_KEY_PATH,

    `${JSON.stringify(
      identity.buyerVerificationKey,
      null,
      2,
    )}\n`,

    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  assertNoPrivateJwk(
    identity.buyerVerificationKey,
  );

  crpTripwire =
    await startCrpTripwire(
      CRP_TRIPWIRE_PORT,
    );

  orchestratorStub =
    await startOrchestratorStub(
      ORCHESTRATOR_PORT,
    );

  configureEnvironment(
    crpTripwire.baseUrl,
    orchestratorStub.baseUrl,
  );

  gateway =
    startGateway({
      port:
        GATEWAY_PORT,

      label:
        LABEL,
    });

  const health =
    await waitForReady(
      GATEWAY_BASE,
    );

  assert.equal(
    health.phase5
      ?.agentDelegatedRuntimeEnabled,
    true,
  );

  assert.equal(
    health.phase5
      ?.cryptographicDelegationRuntimeEnabled,
    true,
  );

  assert.equal(
    health.phase5
      ?.cryptographicDelegationRuntimeActive,
    true,
  );

  assert.equal(
    health.phase5
      ?.delegationLifecycleEnforcementEnabled,
    true,
  );

  assert.equal(
    health.phase5
      ?.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    health.phase5
      ?.buyerVerificationKeyLoaded,
    true,
  );

  assert.equal(
    health.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    health.phase5
      ?.productionActivation,
    false,
  );

  const positive =
    await runPositiveCurrentCase(
      identity,
    );

  const policyDenied =
    await runPolicyDeniedNoConsumptionCase(
      identity,
    );

  const revoked =
    await runRevokedNoConsumptionCase(
      identity,
    );

  const boundedUse =
    await runIdempotencyAndExhaustionCases(
      identity,
    );

  const clockFailures =
    await runClockFailureCases(
      identity,
    );

  const storeFailure =
    await runStoreFailureCase(
      identity,
    );

  const recordedCrpPaths =
    crpTripwire.requests.map(
      (entry) =>
        `${entry.method} ${entry.path}`,
    );

  assert.deepEqual(
    recordedCrpPaths,
    [],
    (
      "controlled lifecycle acceptance must not call CRP; "
      + `recorded=${JSON.stringify(recordedCrpPaths)}`
    ),
  );

  const intentCount =
    orchestratorStub.requests.filter(
      (entry) =>
        entry.path ===
          "/internal/payments/intents",
    ).length;

  assert.equal(
    intentCount,
    8,
    "eight canonical challenges should emit eight orchestrator intents",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,

        label:
          LABEL,

        runId:
          RUN_ID,

        matrixCases:
          8,

        passedCases:
          8,

        positiveCurrent: {
          accepted:
            true,

          reason:
            positive.reason,

          usageCount:
            positive.usageCount,

          maxUses:
            1,

          policyStatus:
            "POLICY_SATISFIED",

          releaseStatus:
            "NOT_RELEASED",
        },

        policyDeniedNoConsumption: {
          rejected:
            true,

          reason:
            policyDenied.reason,

          policyStatus:
            "POLICY_FAILED",

          usageCreated:
            false,

          claimCount:
            policyDenied.claimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        revokedNoConsumption: {
          rejected:
            true,

          reason:
            revoked.reason,

          canonicalStatus:
            "POLICY_FAILED",

          usageCreated:
            false,

          claimCount:
            revoked.claimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        sameNonceIdempotent: {
          accepted:
            true,

          usageClaimReason:
            boundedUse.retryReason,

          usageClaimCreated:
            false,

          usageClaimIdempotent:
            true,

          usageCount:
            boundedUse.usageCount,

          totalClaimCount:
            boundedUse.totalClaimCount,
        },

        freshNonceExhausted: {
          rejected:
            true,

          reason:
            boundedUse.exhaustionReason,

          usageCount:
            boundedUse.usageCount,

          maxUses:
            boundedUse.maxUses,

          totalClaimCount:
            boundedUse.totalClaimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        notYetValidNoConsumption: {
          rejected:
            true,

          reason:
            clockFailures
              .notYetValid
              .reason,

          canonicalStatus:
            clockFailures
              .notYetValid
              .canonicalStatus,

          claimCount:
            clockFailures
              .notYetValid
              .claimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        expiredNoConsumption: {
          rejected:
            true,

          reason:
            clockFailures
              .expired
              .reason,

          canonicalStatus:
            clockFailures
              .expired
              .canonicalStatus,

          claimCount:
            clockFailures
              .expired
              .claimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        lifecycleStoreFailureFailsClosed: {
          rejected:
            true,

          reason:
            storeFailure.reason,

          policyStatus:
            "POLICY_NOT_EVALUATED",

          canonicalStatus:
            storeFailure.canonicalStatus,

          claimCount:
            storeFailure.claimCount,

          releaseStatus:
            "NOT_RELEASED",
        },

        sideEffects: {
          gatewayCalled:
            true,

          crpCalled:
            false,

          paymentAttempted:
            false,

          paymentResponseEmitted:
            false,

          protectedResourceReleased:
            false,

          agentRegistryLookupAttempted:
            false,

          productionActivation:
            false,
        },

        privateMaterial: {
          writtenToRepository:
            false,

          writtenToTemporaryFiles:
            false,

          printed:
            false,
        },
      },
      null,
      2,
    ),
  );

  console.log();
  console.log(
    "PR297_FINAL_ACCEPTANCE_POSITIVE_CURRENT=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_POLICY_DENY_NO_CONSUMPTION=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_REVOKED_NO_CONSUMPTION=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_SAME_NONCE_IDEMPOTENT=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_FRESH_NONCE_EXHAUSTED=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_NOT_YET_VALID_NO_CONSUMPTION=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_EXPIRED_NO_CONSUMPTION=true",
  );

  console.log(
    "PR297_FINAL_ACCEPTANCE_STORE_FAILURE_FAILS_CLOSED=true",
  );
}


installSignalCleanup(
  cleanup,
);


void main()
  .catch(
    (error: unknown) => {
      console.error(
        `[${LABEL}] failed:`,
        error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await cleanup();

      console.log();
      console.log(
        "PR297_FINAL_ACCEPTANCE_CLEANUP_COMPLETE=true",
      );
    },
  );
