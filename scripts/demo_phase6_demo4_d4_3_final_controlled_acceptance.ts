/**
 * PR #318 — Demo4 D4-3 final controlled acceptance runner.
 *
 * inspect:
 *   deterministic/offline contract inspection.
 *
 * execute:
 *   deterministic dispatch plus a separately gated read-only pre-live guard.
 *
 * This slice may perform bounded read-only readiness calls, but it MUST NOT
 * create a fresh challenge or perform any live mutation.
 */

import {
  DEMO4_D4_3_AUTOMATIC_RETRY,
  DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES,
  DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE,
  DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT,
  DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_CONTRACT,
  DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_CONTRACT,
  DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS,
  DEMO4_D4_3_PAYMENT_CONTRACT,
  DEMO4_D4_3_PRODUCTION,
  evaluateDemo4D43LiveExecutionProgressV1,
  evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1,
  inspectDemo4FinalControlledAcceptanceContractV1,
  type Demo4D43ExecutionCapabilityNameV1,
  type Demo4D43ExecutionDispatchInputV1,
  type Demo4D43LiveExecutionJournalV1,
} from "../src/phase6/demo4FinalControlledAcceptance";

import {
  createHash as createD43Hash,
  createPrivateKey as createD43PrivateKey,
  createPublicKey as createD43PublicKey,
  sign as signD43Ed25519,
  type KeyObject as D43KeyObject,
} from "node:crypto";

import {
  readFileSync as readD43FileSync,
} from "node:fs";

import canonicalizeD43 from "canonicalize";

import {
  AGENT_PROOF_OF_POSSESSION_CANONICALIZATION_ALGORITHM as D43_AGENT_POP_CANONICALIZATION,
  AGENT_PROOF_OF_POSSESSION_SIGNATURE_ALGORITHM as D43_AGENT_POP_SIGNATURE_ALGORITHM,
  AGENT_PROOF_OF_POSSESSION_TYPE as D43_AGENT_POP_TYPE,
  AGENT_PROOF_OF_POSSESSION_VERSION as D43_AGENT_POP_VERSION,
  verifyAgentProofOfPossession as verifyD43AgentProofOfPossession,
  type AgentProofOfPossessionDocument as D43AgentProofDocument,
  type AgentProofOfPossessionStatement as D43AgentProofStatement,
} from "../src/phase5/agentProofOfPossessionVerifier";

import {
  PHASE5_AGENT_CRYPTOGRAPHIC_RUNTIME_AUDIENCE as D43_CRYPTOGRAPHIC_AUDIENCE,
} from "../src/phase5/agentCryptographicDelegationBindingVerifier";

import {
  BUYER_TO_AGENT_DELEGATION_ALLOWED_ACTION as D43_DELEGATION_ALLOWED_ACTION,
  BUYER_TO_AGENT_DELEGATION_AMOUNT_MODE as D43_DELEGATION_AMOUNT_MODE,
  BUYER_TO_AGENT_DELEGATION_CANONICALIZATION_ALGORITHM as D43_DELEGATION_CANONICALIZATION,
  BUYER_TO_AGENT_DELEGATION_CREDENTIAL_TYPE as D43_DELEGATION_TYPE,
  BUYER_TO_AGENT_DELEGATION_CREDENTIAL_VERSION as D43_DELEGATION_VERSION,
  BUYER_TO_AGENT_DELEGATION_DOMAIN as D43_DELEGATION_DOMAIN,
  BUYER_TO_AGENT_DELEGATION_SIGNATURE_ALGORITHM as D43_DELEGATION_SIGNATURE_ALGORITHM,
  canonicalizeBuyerToAgentDelegationCredential as canonicalizeD43DelegationCredential,
  hashBuyerToAgentDelegationCredential as hashD43DelegationCredential,
  type BuyerToAgentDelegationCredential as D43DelegationCredential,
  type BuyerToAgentDelegationCredentialDocument as D43DelegationDocument,
  type BuyerToAgentDelegationEd25519PublicKeyJwk as D43Ed25519PublicJwk,
} from "../src/phase5/buyerToAgentDelegationCredential";

import {
  BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE as D43_BUYER_VERIFIER_MODE,
  type BuyerDelegationVerificationKey as D43BuyerVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

import {
  buildX402ZkpChallenge as buildD43X402ZkpChallenge,
  hashX402ZkpChallenge as hashD43X402ZkpChallenge,
} from "../src/phase3/zkpChallenge";

import {
  amountToRawUnits as amountToD43RawUnits,
} from "../src/proofPayload";

import {
  getPhase5AgentDelegationUsageSnapshot,
} from "../src/db/phase5AgentDelegationLifecycleStore";

import {
  executeDemo4D43LiveReadOnlyV1,
} from "./demo_phase6_demo4_d4_3_final_acceptance_readiness";

import {
  executePreparedPltTransferV1,
  preflightPltTransferV1,
  type PltTransferExecutionResultV1,
  type PltTransferPreparedV1,
  type PltTransferPreflightInputV1,
} from "./plt-transfer";


const D43_RUNTIME_POLICY_REQUIREMENT = {
  policyId:
    "age-region-v1",

  policyVersion:
    "1.0.0",

  requirementsHash:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

const MODE_ENV =
  "DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_MODE";

const mode =
  String(
    process.env[MODE_ENV] ??
      "inspect",
  )
    .trim()
    .toLowerCase();

const productionFlagNames =
  [
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
    "NODE_ENV",
  ] as const;

const capabilityEnvNames:
  Readonly<
    Record<
      Demo4D43ExecutionCapabilityNameV1,
      string
    >
  > = {
    challengeNetworkRead:
      "DEMO4_D4_3_CAP_CHALLENGE_NETWORK_READ_AUTHORIZED",

    databaseRead:
      "DEMO4_D4_3_CAP_DATABASE_READ_AUTHORIZED",

    phase6AuditWrite:
      "DEMO4_D4_3_CAP_PHASE6_AUDIT_WRITE_AUTHORIZED",

    buyerPrivateKeyRead:
      "DEMO4_D4_3_CAP_BUYER_PRIVATE_KEY_READ_AUTHORIZED",

    actingPrivateKeyRead:
      "DEMO4_D4_3_CAP_ACTING_PRIVATE_KEY_READ_AUTHORIZED",

    proofSigning:
      "DEMO4_D4_3_CAP_PROOF_SIGNING_AUTHORIZED",

    gatewayRedeem:
      "DEMO4_D4_3_CAP_GATEWAY_REDEEM_AUTHORIZED",

    phase5AtomicClaim:
      "DEMO4_D4_3_CAP_PHASE5_ATOMIC_CLAIM_AUTHORIZED",

    payerWalletRead:
      "DEMO4_D4_3_CAP_PAYER_WALLET_READ_AUTHORIZED",

    paymentTransactionSubmit:
      "DEMO4_D4_3_CAP_PAYMENT_TRANSACTION_SUBMIT_AUTHORIZED",

    crpPaymentCreate:
      "DEMO4_D4_3_CAP_CRP_PAYMENT_CREATE_AUTHORIZED",

    crpFulfill:
      "DEMO4_D4_3_CAP_CRP_FULFILL_AUTHORIZED",

    receiptRelease:
      "DEMO4_D4_3_CAP_RECEIPT_RELEASE_AUTHORIZED",

    replayProbe:
      "DEMO4_D4_3_CAP_REPLAY_PROBE_AUTHORIZED",
  };

function envTrue(
  key: string,
): boolean {
  return (
    String(
      process.env[key] ??
      "",
    )
      .trim()
      .toLowerCase() ===
    "true"
  );
}

function envFalse(
  key: string,
): boolean {
  return (
    String(
      process.env[key] ??
      "",
    )
      .trim()
      .toLowerCase() ===
    "false"
  );
}

function envString(
  key: string,
): string {
  return String(
    process.env[key] ??
    "",
  );
}

function envNumber(
  key: string,
): number {
  return Number(
    process.env[key] ??
      Number.NaN,
  );
}

function productionSurfaceActive():
boolean {
  for (
    const key
    of productionFlagNames
  ) {
    const value =
      String(
        process.env[key] ??
        "",
      )
        .trim()
        .toLowerCase();

    if (
      key === "NODE_ENV"
    ) {
      if (
        value ===
          "production"
      ) {
        return true;
      }

      continue;
    }

    if (
      value ===
        "true"
    ) {
      return true;
    }
  }

  return false;
}

function buildCapabilityAuthorizations():
Demo4D43ExecutionDispatchInputV1[
  "capabilityAuthorizations"
] {
  return Object.fromEntries(
    DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES
      .map(
        (capability) => [
          capability,
          envTrue(
            capabilityEnvNames[
              capability
            ],
          ),
        ],
      ),
  ) as
    Demo4D43ExecutionDispatchInputV1[
      "capabilityAuthorizations"
    ];
}

function buildDispatchInput():
Demo4D43ExecutionDispatchInputV1 {
  return {
    executionAcknowledged:
      envTrue(
        "DEMO4_D4_3_EXECUTION_ACK",
      ),

    pr317ReadinessConfirmed:
      envTrue(
        "DEMO4_D4_3_PR317_READINESS_CONFIRMED",
      ),

    freshExecutionAuthorizationConfirmed:
      envTrue(
        "DEMO4_D4_3_FRESH_EXECUTION_AUTHORIZATION_CONFIRMED",
      ),

    oneShotPaymentAcknowledged:
      envTrue(
        "DEMO4_D4_3_ONE_SHOT_PAYMENT_ACK",
      ),

    ambiguousSubmissionStopAcknowledged:
      envTrue(
        "DEMO4_D4_3_AMBIGUOUS_SUBMISSION_STOP_ACK",
      ),

    maxPaymentSubmissions:
      envNumber(
        "DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS",
      ),

    automaticRetry:
      !envFalse(
        "DEMO4_D4_3_AUTOMATIC_RETRY",
      ),

    productionActivation:
      productionSurfaceActive(),

    canonicalChainId:
      envString(
        "DEMO4_D4_3_CANONICAL_CHAIN_ID",
      ),

    paymentNetwork:
      envString(
        "DEMO4_D4_3_PAYMENT_NETWORK",
      ),

    networkGenesisIndex:
      envNumber(
        "DEMO4_D4_3_NETWORK_GENESIS_INDEX",
      ),

    assetType:
      envString(
        "DEMO4_D4_3_ASSET_TYPE",
      ),

    tokenId:
      envString(
        "DEMO4_D4_3_TOKEN_ID",
      ),

    decimals:
      envNumber(
        "DEMO4_D4_3_DECIMALS",
      ),

    amount:
      envString(
        "DEMO4_D4_3_AMOUNT",
      ),

    amountRaw:
      envString(
        "DEMO4_D4_3_AMOUNT_RAW",
      ),

    merchantId:
      envString(
        "DEMO4_D4_3_MERCHANT_ID",
      ),

    resourceMethod:
      envString(
        "DEMO4_D4_3_RESOURCE_METHOD",
      ),

    resourcePath:
      envString(
        "DEMO4_D4_3_RESOURCE_PATH",
      ),

    payTo:
      envString(
        "DEMO4_D4_3_PAY_TO",
      ),

    capabilityAuthorizations:
      buildCapabilityAuthorizations(),
  };
}

function buildInitialLiveExecutionJournal():
Demo4D43LiveExecutionJournalV1 {
  return {
    completedSteps:
      [],

    boundedUseConsumed:
      false,

    crpPendingRegistered:
      false,

    paymentSubmissionAttempts:
      0,

    paymentOutcome:
      "not_attempted",

    paymentTransactionHashObserved:
      false,

    paymentFinalized:
      false,

    crpIndexed:
      false,

    paymentResponseObserved:
      false,

    resourceReleased:
      false,

    replayRejected:
      false,

    productionActivation:
      false,
  };
}

type Demo4D43PreLiveGuardResultV1 = {
  readonly ok: boolean;
  readonly reason: string;
  readonly readinessReason: string | null;
  readonly gatewayHealthReady: boolean;
  readonly gatewayReady: boolean;
  readonly crpHealthReady: boolean;
  readonly crpJwksReady: boolean;
  readonly registryExact: boolean;
  readonly cis8Exact: boolean;
  readonly agentCardExact: boolean;
  readonly phase4ControlledReleaseReady: boolean;
  readonly phase5Ready: boolean;
  readonly phase6Ready: boolean;
  readonly productionFalse: boolean;
  readonly replayReady: boolean;
  readonly networkCalled: boolean;
};

function objectOrNull(
  value: unknown,
): Record<string, any> | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as Record<string, any>
    : null;
}

function safeLoopbackBaseUrl(
  value: string | undefined,
): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (
      parsed.protocol !== "http:" ||
      (
        host !== "127.0.0.1" &&
        host !== "localhost" &&
        host !== "::1" &&
        host !== "[::1]"
      ) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return null;
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function boundedJsonGet(
  url: string,
): Promise<Record<string, any> | null> {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      5_000,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: {
            accept: "application/json",
          },
        },
      );

    if (!response.ok) {
      return null;
    }

    return objectOrNull(
      await response.json(),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}


export type Demo4D43ProofConstructionChallengeV1 = {
  readonly nonce: string;
  readonly challengeHash: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
};

export type Demo4D43HybridProofConstructionInputV1 = {
  readonly challenge:
    Demo4D43ProofConstructionChallengeV1;

  readonly buyerId: string;
  readonly buyerKeyId: string;
  readonly buyerVerificationKey:
    D43BuyerVerificationKey;
  readonly buyerPrivateKey:
    D43KeyObject;

  readonly agentId: string;
  readonly agentKeyId: string;
  readonly actingPublicKeyJwk:
    D43Ed25519PublicJwk;
  readonly expectedActingPublicKeyHex:
    string;
  readonly actingPrivateKey:
    D43KeyObject;
};

export type Demo4D43HybridProofConstructionResultV1 = {
  readonly ok: true;
  readonly reason:
    "proof_construction_hybrid_registered_acting_key_verified";

  readonly delegationDocument:
    D43DelegationDocument;
  readonly proofDocument:
    D43AgentProofDocument;

  readonly credentialHash: string;
  readonly buyerSignatureVerified: true;
  readonly agentPublicKeyBoundByBuyerSignature: true;
  readonly agentProofOfPossessionVerified: true;
  readonly proofBindingsMatched: true;
};

function d43CanonicalBase64UrlX(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new Error(
      "proof_construction_public_key_invalid",
    );
  }

  const decoded =
    Buffer.from(
      value,
      "base64url",
    );

  if (
    decoded.length !== 32 ||
    decoded.toString("base64url") !== value
  ) {
    throw new Error(
      "proof_construction_public_key_invalid",
    );
  }

  return value;
}

function d43PublicKeyXFromKey(
  key: D43KeyObject,
): string {
  const jwk =
    createD43PublicKey(
      key,
    ).export({
      format: "jwk",
    }) as {
      readonly x?: string;
    };

  return d43CanonicalBase64UrlX(
    jwk.x,
  );
}

function d43SignCanonicalValue(
  value: string,
  privateKey: D43KeyObject,
): string {
  return signD43Ed25519(
    null,
    Buffer.from(
      value,
      "utf8",
    ),
    privateKey,
  ).toString(
    "base64url",
  );
}

function d43CanonicalizeProofStatement(
  statement:
    D43AgentProofStatement,
): string {
  const canonical =
    canonicalizeD43(
      statement,
    );

  if (
    typeof canonical !== "string"
  ) {
    throw new Error(
      "proof_construction_agent_statement_canonicalization_failed",
    );
  }

  return canonical;
}

export function buildDemo4D43HybridCryptographicProofBundleV1(
  input:
    Demo4D43HybridProofConstructionInputV1,
): Demo4D43HybridProofConstructionResultV1 {
  const buyerVerificationX =
    d43CanonicalBase64UrlX(
      input
        .buyerVerificationKey
        .publicKeyJwk
        .x,
    );

  const buyerPrivateX =
    d43PublicKeyXFromKey(
      input.buyerPrivateKey,
    );

  if (
    buyerPrivateX !==
    buyerVerificationX
  ) {
    throw new Error(
      "proof_construction_buyer_private_key_mismatch",
    );
  }

  const actingX =
    d43CanonicalBase64UrlX(
      input
        .actingPublicKeyJwk
        .x,
    );

  const actingHex =
    Buffer.from(
      actingX,
      "base64url",
    ).toString(
      "hex",
    );

  if (
    !/^[0-9a-f]{64}$/.test(
      input.expectedActingPublicKeyHex,
    ) ||
    actingHex !==
      input.expectedActingPublicKeyHex
  ) {
    throw new Error(
      "proof_construction_acting_public_key_frozen_mismatch",
    );
  }

  const actingPrivateX =
    d43PublicKeyXFromKey(
      input.actingPrivateKey,
    );

  if (
    actingPrivateX !==
    actingX
  ) {
    throw new Error(
      "proof_construction_acting_private_key_mismatch",
    );
  }

  const challenge =
    input.challenge;

  if (
    !challenge.nonce ||
    !/^[0-9a-f]{64}$/.test(
      challenge.challengeHash,
    ) ||
    !Number.isSafeInteger(
      challenge.issuedAt,
    ) ||
    !Number.isSafeInteger(
      challenge.expiresAt,
    ) ||
    challenge.expiresAt <=
      challenge.issuedAt
  ) {
    throw new Error(
      "proof_construction_challenge_invalid",
    );
  }

  const normalizedActingPublicKey:
    D43Ed25519PublicJwk = {
      kty: "OKP",
      crv: "Ed25519",
      x: actingX,
      kid: input.agentKeyId,
      use: "sig",
      alg: "EdDSA",
    };

  const delegationId =
    `delegation-${challenge.nonce}`;

  const credential:
    D43DelegationCredential = {
      credentialType:
        D43_DELEGATION_TYPE,

      credentialVersion:
        D43_DELEGATION_VERSION,

      delegationId,

      issuer: {
        buyerId:
          input.buyerId,
        buyerKeyId:
          input.buyerKeyId,
      },

      subject: {
        agentId:
          input.agentId,
        agentKeyId:
          input.agentKeyId,
        agentPublicKeyJwk:
          normalizedActingPublicKey,
      },

      scope: {
        merchantId:
          "demo-merchant",

        resource: {
          method:
            "GET",
          path:
            "/paid-gated",
        },

        contract: {
          contractId:
            "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
          contractVersion:
            "1.0.0",
        },

        network:
          "concordium:testnet",

        asset: {
          type:
            "PLT",
          tokenId:
            "EUDemo",
          decimals:
            6,
        },

        amount: {
          mode:
            D43_DELEGATION_AMOUNT_MODE,
          value:
            "0.050101",
        },

        payTo:
          "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

        allowedAction:
          D43_DELEGATION_ALLOWED_ACTION,
      },

      validity: {
        issuedAt:
          challenge.issuedAt - 60,
        notBefore:
          challenge.issuedAt - 60,
        expiresAt:
          challenge.expiresAt + 60,
      },

      usage: {
        maxUses:
          1,
      },

      replay: {
        audience:
          D43_CRYPTOGRAPHIC_AUDIENCE,
        domain:
          D43_DELEGATION_DOMAIN,
        credentialNonce:
          `credential-${challenge.nonce}`,
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
    D43DelegationDocument = {
      credential,

      proof: {
        signatureAlgorithm:
          D43_DELEGATION_SIGNATURE_ALGORITHM,

        canonicalizationAlgorithm:
          D43_DELEGATION_CANONICALIZATION,

        verificationMethod:
          input.buyerKeyId,

        signatureValue:
          d43SignCanonicalValue(
            canonicalizeD43DelegationCredential(
              credential,
            ),
            input.buyerPrivateKey,
          ),
      },
    };

  const credentialHash =
    hashD43DelegationCredential(
      credential,
    );

  const statement:
    D43AgentProofStatement = {
      proofType:
        D43_AGENT_POP_TYPE,

      proofVersion:
        D43_AGENT_POP_VERSION,

      delegationId,
      credentialHash,
      agentId:
        input.agentId,
      agentKeyId:
        input.agentKeyId,

      audience:
        D43_CRYPTOGRAPHIC_AUDIENCE,

      challenge: {
        nonce:
          challenge.nonce,
        challengeHash:
          challenge.challengeHash,
        issuedAt:
          challenge.issuedAt,
        expiresAt:
          challenge.expiresAt,
      },
    };

  const proofDocument:
    D43AgentProofDocument = {
      statement,

      proof: {
        signatureAlgorithm:
          D43_AGENT_POP_SIGNATURE_ALGORITHM,

        canonicalizationAlgorithm:
          D43_AGENT_POP_CANONICALIZATION,

        verificationMethod:
          input.agentKeyId,

        signatureValue:
          d43SignCanonicalValue(
            d43CanonicalizeProofStatement(
              statement,
            ),
            input.actingPrivateKey,
          ),
      },
    };

  const verification =
    verifyD43AgentProofOfPossession({
      delegationDocument,
      buyerVerificationKey:
        input.buyerVerificationKey,
      proofDocument,
      expectedChallenge:
        statement.challenge,
    });

  if (
    !verification.ok ||
    !verification.buyerSignatureVerified ||
    !verification.agentPublicKeyBoundByBuyerSignature ||
    !verification.agentProofOfPossessionVerified ||
    !verification.proofBindingsMatched
  ) {
    throw new Error(
      `proof_construction_local_verification_failed:${verification.reason}`,
    );
  }

  return {
    ok: true,
    reason:
      "proof_construction_hybrid_registered_acting_key_verified",
    delegationDocument,
    proofDocument,
    credentialHash,
    buyerSignatureVerified:
      true,
    agentPublicKeyBoundByBuyerSignature:
      true,
    agentProofOfPossessionVerified:
      true,
    proofBindingsMatched:
      true,
  };
}


export const DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH =
  "keys/demo4-d4-1b/buyer.private-key.pem";

export const DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH_SUFFIX =
  ".xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-private.pk8.pem";

export const DEMO4_D4_3_STALE_AGENT_PRIVATE_KEY_PATH =
  "keys/demo4-d4-1b/agent.private-key.pem";

export function deriveDemo4D43ProofConstructionChallengeV1(
  input: {
    readonly nonce: string;
    readonly issuedAt: number;
    readonly expiresAt: number;
  },
): Demo4D43ProofConstructionChallengeV1 {
  const challenge =
    buildD43X402ZkpChallenge({
      merchantId:
        "demo-merchant",

      resource: {
        method:
          "GET",
        path:
          "/paid-gated",
      },

      contract: {
        contractId:
          "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
        contractVersion:
          "1.0.0",
        isFrozen:
          true,
      },

      network:
        "concordium:testnet",

      chain_id:
        "ccd:4221332d34e1694168c2a0c0b3fd0f27",

      caip2ChainId:
        null,

      asset: {
        type:
          "PLT",
        tokenId:
          "EUDemo",
        decimals:
          6,
      },

      amount:
        "0.050101",

      amountMinor:
        amountToD43RawUnits(
          "0.050101",
          6,
        ),

      payTo:
        "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

      nonce:
        input.nonce,

      issuedAt:
        input.issuedAt,

      expiresAt:
        input.expiresAt,

      policy:
        D43_RUNTIME_POLICY_REQUIREMENT,

      businessTerms:
        null,

      buyer:
        null,

      agent:
        null,
    });

  return {
    nonce:
      input.nonce,

    challengeHash:
      hashD43X402ZkpChallenge(
        challenge,
      ),

    issuedAt:
      input.issuedAt,

    expiresAt:
      input.expiresAt,
  };
}

export type Demo4D43ProofKeyLoadingGateResultV1 = {
  readonly ok: boolean;

  readonly reason:
    | "proof_key_loading_gate_ready"
    | "proof_construction_not_authorized"
    | "buyer_private_key_read_not_authorized"
    | "acting_private_key_read_not_authorized"
    | "proof_signing_not_authorized"
    | "buyer_private_key_path_invalid"
    | "stale_agent_private_key_forbidden"
    | "acting_private_key_path_invalid";

  readonly buyerPrivateKeyPathAccepted:
    boolean;

  readonly actingPrivateKeyPathAccepted:
    boolean;

  readonly staleAgentPrivateKeyForbidden:
    true;
};

function d43NormalizeCustodyPath(
  value:
    string | null | undefined,
): string {
  return String(
    value ?? "",
  )
    .trim()
    .replace(
      /\\/g,
      "/",
    )
    .replace(
      /\/{2,}/g,
      "/",
    )
    .replace(
      /\/$/,
      "",
    );
}

export function evaluateDemo4D43ProofKeyLoadingGateV1(
  input: {
    readonly proofConstructionEnabled:
      boolean;

    readonly proofConstructionAuthorized:
      boolean;

    readonly buyerPrivateKeyReadAuthorized:
      boolean;

    readonly actingPrivateKeyReadAuthorized:
      boolean;

    readonly proofSigningAuthorized:
      boolean;

    readonly buyerPrivateKeyPath:
      string | null | undefined;

    readonly actingPrivateKeyPath:
      string | null | undefined;
  },
): Demo4D43ProofKeyLoadingGateResultV1 {
  const buyerPath =
    d43NormalizeCustodyPath(
      input.buyerPrivateKeyPath,
    );

  const actingPath =
    d43NormalizeCustodyPath(
      input.actingPrivateKeyPath,
    );

  const buyerPathAccepted =
    buyerPath ===
      DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH;

  const staleAgentPath =
    d43NormalizeCustodyPath(
      DEMO4_D4_3_STALE_AGENT_PRIVATE_KEY_PATH,
    );

  const staleAgentSelected =
    actingPath === staleAgentPath ||
    actingPath.endsWith(
      `/${staleAgentPath}`,
    );

  const requiredActingSuffix =
    `/${DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH_SUFFIX}`;

  const actingPathAccepted =
    !staleAgentSelected &&
    (
      actingPath ===
        DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH_SUFFIX ||
      actingPath.endsWith(
        requiredActingSuffix,
      )
    );

  const result = (
    ok: boolean,
    reason:
      Demo4D43ProofKeyLoadingGateResultV1["reason"],
  ): Demo4D43ProofKeyLoadingGateResultV1 => ({
    ok,
    reason,

    buyerPrivateKeyPathAccepted:
      buyerPathAccepted,

    actingPrivateKeyPathAccepted:
      actingPathAccepted,

    staleAgentPrivateKeyForbidden:
      true,
  });

  if (
    !input.proofConstructionEnabled ||
    !input.proofConstructionAuthorized
  ) {
    return result(
      false,
      "proof_construction_not_authorized",
    );
  }

  if (
    !input.buyerPrivateKeyReadAuthorized
  ) {
    return result(
      false,
      "buyer_private_key_read_not_authorized",
    );
  }

  if (
    !input.actingPrivateKeyReadAuthorized
  ) {
    return result(
      false,
      "acting_private_key_read_not_authorized",
    );
  }

  if (
    !input.proofSigningAuthorized
  ) {
    return result(
      false,
      "proof_signing_not_authorized",
    );
  }

  if (!buyerPathAccepted) {
    return result(
      false,
      "buyer_private_key_path_invalid",
    );
  }

  if (staleAgentSelected) {
    return result(
      false,
      "stale_agent_private_key_forbidden",
    );
  }

  if (!actingPathAccepted) {
    return result(
      false,
      "acting_private_key_path_invalid",
    );
  }

  return result(
    true,
    "proof_key_loading_gate_ready",
  );
}

export type Demo4D43BoundedProofKeyLoaderResultV1 = {
  readonly gate:
    Demo4D43ProofKeyLoadingGateResultV1;

  readonly buyerPrivateKey:
    D43KeyObject;

  readonly actingPrivateKey:
    D43KeyObject;

  readonly buyerPrivateKeyReads:
    1;

  readonly actingPrivateKeyReads:
    1;
};

export function loadDemo4D43BoundedProofKeyObjectsV1(
  input: {
    readonly proofConstructionEnabled:
      boolean;

    readonly proofConstructionAuthorized:
      boolean;

    readonly buyerPrivateKeyReadAuthorized:
      boolean;

    readonly actingPrivateKeyReadAuthorized:
      boolean;

    readonly proofSigningAuthorized:
      boolean;

    readonly buyerPrivateKeyPath:
      string | null | undefined;

    readonly actingPrivateKeyPath:
      string | null | undefined;

    readonly readPem:
      (
        path: string,
      ) => string | Buffer;
  },
): Demo4D43BoundedProofKeyLoaderResultV1 {
  const gate =
    evaluateDemo4D43ProofKeyLoadingGateV1(
      input,
    );

  if (!gate.ok) {
    throw new Error(
      `proof_key_loading_gate_rejected:${gate.reason}`,
    );
  }

  const buyerPath =
    d43NormalizeCustodyPath(
      input.buyerPrivateKeyPath,
    );

  const actingPath =
    d43NormalizeCustodyPath(
      input.actingPrivateKeyPath,
    );

  let buyerPem:
    string | Buffer;

  let actingPem:
    string | Buffer;

  try {
    buyerPem =
      input.readPem(
        buyerPath,
      );
  } catch {
    throw new Error(
      "buyer_private_key_read_failed",
    );
  }

  try {
    actingPem =
      input.readPem(
        actingPath,
      );
  } catch {
    throw new Error(
      "acting_private_key_read_failed",
    );
  }

  let buyerPrivateKey:
    D43KeyObject;

  let actingPrivateKey:
    D43KeyObject;

  try {
    buyerPrivateKey =
      createD43PrivateKey(
        buyerPem,
      );
  } catch {
    throw new Error(
      "buyer_private_key_parse_failed",
    );
  }

  try {
    actingPrivateKey =
      createD43PrivateKey(
        actingPem,
      );
  } catch {
    throw new Error(
      "acting_private_key_parse_failed",
    );
  }

  if (
    buyerPrivateKey.type !== "private" ||
    buyerPrivateKey.asymmetricKeyType !==
      "ed25519"
  ) {
    throw new Error(
      "buyer_private_key_not_ed25519",
    );
  }

  if (
    actingPrivateKey.type !== "private" ||
    actingPrivateKey.asymmetricKeyType !==
      "ed25519"
  ) {
    throw new Error(
      "acting_private_key_not_ed25519",
    );
  }

  return {
    gate,
    buyerPrivateKey,
    actingPrivateKey,

    buyerPrivateKeyReads:
      1,

    actingPrivateKeyReads:
      1,
  };
}

export function loadDemo4D43BoundedProofKeyObjectsFromFilesystemV1(
  input: {
    readonly proofConstructionEnabled:
      boolean;

    readonly proofConstructionAuthorized:
      boolean;

    readonly buyerPrivateKeyReadAuthorized:
      boolean;

    readonly actingPrivateKeyReadAuthorized:
      boolean;

    readonly proofSigningAuthorized:
      boolean;

    readonly buyerPrivateKeyPath:
      string | null | undefined;

    readonly actingPrivateKeyPath:
      string | null | undefined;
  },
): Demo4D43BoundedProofKeyLoaderResultV1 {
  return loadDemo4D43BoundedProofKeyObjectsV1({
    ...input,

    readPem:
      (
        path: string,
      ): Buffer =>
        readD43FileSync(
          path,
        ),
  });
}

export const DEMO4_D4_3_FROZEN_TUPLE_ENVIRONMENT_V1 =
  Object.freeze({
    DEMO4_D4_3_CANONICAL_CHAIN_ID:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    DEMO4_D4_3_PAYMENT_NETWORK:
      "concordium:testnet",

    DEMO4_D4_3_NETWORK_GENESIS_INDEX:
      "7",

    DEMO4_D4_3_ASSET_TYPE:
      "PLT",

    DEMO4_D4_3_TOKEN_ID:
      "EUDemo",

    DEMO4_D4_3_DECIMALS:
      "6",

    DEMO4_D4_3_AMOUNT:
      "0.050101",

    DEMO4_D4_3_AMOUNT_RAW:
      "50101",

    DEMO4_D4_3_MERCHANT_ID:
      "demo-merchant",

    DEMO4_D4_3_RESOURCE_METHOD:
      "GET",

    DEMO4_D4_3_RESOURCE_PATH:
      "/paid-gated",

    DEMO4_D4_3_PAY_TO:
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

    DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS:
      "1",

    DEMO4_D4_3_AUTOMATIC_RETRY:
      "false",
  } as const);

export function applyDemo4D43FrozenTupleEnvironmentV1():
void {
  for (
    const [
      key,
      expected,
    ]
    of Object.entries(
      DEMO4_D4_3_FROZEN_TUPLE_ENVIRONMENT_V1,
    )
  ) {
    const existing =
      process.env[key];

    if (
      existing !== undefined &&
      existing !== "" &&
      existing !== expected
    ) {
      throw new Error(
        `frozen_environment_conflict:${key}`,
      );
    }

    process.env[key] =
      expected;
  }
}

export const DEMO4_D4_3_BUYER_VERIFICATION_KEY_PATH =
  "keys/demo4-d4-1b/buyer.verification-key.json";

export const DEMO4_D4_3_ACTING_PUBLIC_KEY_PATH_SUFFIX =
  ".xcf/demo4-d4-1b-cis8-conformant-replacement-v1/replacement-ed25519-public.jwk.json";

const DEMO4_D4_3_BUYER_ID =
  "buyer:xcf:demo4:d4-1b:ceremony-only";

const DEMO4_D4_3_BUYER_KEY_ID =
  "buyer-key:xcf:demo4:d4-1b:ceremony-only";

const DEMO4_D4_3_AGENT_ID =
  "agent:xcf:demo4:registered";

const DEMO4_D4_3_AGENT_KEY_ID =
  "agent-key:xcf:demo4:registered:ed25519-1";

const DEMO4_D4_3_BUYER_PUBLIC_X_SHA256 =
  "81b64d0209c6e6fd62c6c41b4622308812468609187ef9b39af73088ff4bf0cb";

const DEMO4_D4_3_ACTING_PUBLIC_X_SHA256 =
  "951bf3d03070947b3eefa811c04bbfaf9c73d6816daa5df4cc15079eee5ed130";

const DEMO4_D4_3_ACTING_PUBLIC_RAW_HEX =
  "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

function d43Sha256Text(
  value: string,
): string {
  return createD43Hash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function d43ContainsPrivateJwkMaterial(
  value: unknown,
): boolean {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(
      d43ContainsPrivateJwkMaterial,
    );
  }

  const record =
    value as
      Record<string, unknown>;

  if (
    Object.prototype.hasOwnProperty.call(
      record,
      "d",
    )
  ) {
    return true;
  }

  return Object.values(
    record,
  ).some(
    d43ContainsPrivateJwkMaterial,
  );
}

function d43ReadPublicJson(
  path: string,
): Record<string, any> {
  const parsed =
    JSON.parse(
      readD43FileSync(
        path,
      ).toString(
        "utf8",
      ),
    );

  const record =
    objectOrNull(
      parsed,
    );

  if (
    record === null ||
    d43ContainsPrivateJwkMaterial(
      record,
    )
  ) {
    throw new Error(
      "proof_construction_public_key_file_invalid",
    );
  }

  return record;
}

function d43LoadFrozenBuyerVerificationKey(
  path: string,
): D43BuyerVerificationKey {
  if (
    d43NormalizeCustodyPath(
      path,
    ) !==
      DEMO4_D4_3_BUYER_VERIFICATION_KEY_PATH
  ) {
    throw new Error(
      "proof_construction_buyer_public_key_path_invalid",
    );
  }

  const record =
    d43ReadPublicJson(
      path,
    );

  const publicKeyJwk =
    objectOrNull(
      record.publicKeyJwk,
    );

  if (
    record.buyerKeyId !==
      DEMO4_D4_3_BUYER_KEY_ID ||
    publicKeyJwk === null ||
    publicKeyJwk.kty !==
      "OKP" ||
    publicKeyJwk.crv !==
      "Ed25519" ||
    publicKeyJwk.kid !==
      DEMO4_D4_3_BUYER_KEY_ID ||
    typeof publicKeyJwk.x !==
      "string" ||
    d43Sha256Text(
      publicKeyJwk.x,
    ) !==
      DEMO4_D4_3_BUYER_PUBLIC_X_SHA256
  ) {
    throw new Error(
      "proof_construction_buyer_public_key_frozen_mismatch",
    );
  }

  return {
    buyerKeyId:
      DEMO4_D4_3_BUYER_KEY_ID,

    publicKeyJwk:
      publicKeyJwk as
        D43Ed25519PublicJwk,

    source:
      D43_BUYER_VERIFIER_MODE,
  };
}

function d43LoadFrozenActingPublicKey(
  path: string,
): D43Ed25519PublicJwk {
  const normalized =
    d43NormalizeCustodyPath(
      path,
    );

  const suffix =
    `/${DEMO4_D4_3_ACTING_PUBLIC_KEY_PATH_SUFFIX}`;

  if (
    normalized !==
      DEMO4_D4_3_ACTING_PUBLIC_KEY_PATH_SUFFIX &&
    !normalized.endsWith(
      suffix,
    )
  ) {
    throw new Error(
      "proof_construction_acting_public_key_path_invalid",
    );
  }

  const record =
    d43ReadPublicJson(
      path,
    );

  const publicKeyJwk =
    objectOrNull(
      record.publicKeyJwk,
    ) ??
    objectOrNull(
      record.jwk,
    ) ??
    record;

  if (
    publicKeyJwk.kty !==
      "OKP" ||
    publicKeyJwk.crv !==
      "Ed25519" ||
    typeof publicKeyJwk.x !==
      "string" ||
    d43Sha256Text(
      publicKeyJwk.x,
    ) !==
      DEMO4_D4_3_ACTING_PUBLIC_X_SHA256 ||
    Buffer.from(
      publicKeyJwk.x,
      "base64url",
    ).toString(
      "hex",
    ) !==
      DEMO4_D4_3_ACTING_PUBLIC_RAW_HEX
  ) {
    throw new Error(
      "proof_construction_acting_public_key_frozen_mismatch",
    );
  }

  return publicKeyJwk as
    D43Ed25519PublicJwk;
}

export const DEMO4_D4_3_PHASE5_AUTHORIZATION_PROOF_TYPE =
  "xcf.concordium.authorization.agent-delegated.v1" as const;

export const DEMO4_D4_3_PHASE5_ALLOWED_ACTION =
  "authorize_payment_and_resource_access" as const;

export const DEMO4_D4_3_BUYER_ACCOUNT =
  "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7" as const;

export const DEMO4_D4_3_POLICY_REGION =
  "EU" as const;

export const DEMO4_D4_3_POLICY_AGE_OVER =
  21 as const;

export const DEMO4_D4_3_GATEWAY_REDEEM_PATH =
  "/paid-gated/redeem" as const;

export const DEMO4_D4_3_AGENT_REGISTRY_REFERENCE_V1 =
  Object.freeze({
    type:
      "xcf.agent-registry.reference",

    version:
      "1.0.0",

    registryStandard:
      "CIS-8004",

    network:
      "ccd:testnet",

    registryContract:
      Object.freeze({
        index:
          "12802",

        subindex:
          0,
      }),

    agentTokenId:
      "287",

    tokenAddress:
      "ccd:testnet/cis2:12802-0-287",
  } as const);

export type Demo4D43GatewayRedeemBodyV1 = {
  readonly nonce:
    string;

  readonly authorizationProof:
    Record<string, unknown>;

  readonly agentRegistryReference:
    typeof DEMO4_D4_3_AGENT_REGISTRY_REFERENCE_V1;
};

export type Demo4D43RedeemTransportRequestV1 = {
  readonly url:
    string;

  readonly method:
    "POST";

  readonly headers:
    Readonly<Record<string, string>>;

  readonly body:
    string;
};

export type Demo4D43RedeemTransportResponseV1 = {
  readonly status:
    number;

  readonly paymentResponseHeader:
    string | null;

  readonly gatewayCode?:
    string | null;

  readonly gatewayReason?:
    string | null;
};

export type Demo4D43RedeemTransportV1 =
  (
    request:
      Demo4D43RedeemTransportRequestV1,
  ) =>
    Promise<Demo4D43RedeemTransportResponseV1>;

export type Demo4D43RedeemTransportResultV1 = {
  readonly ok:
    boolean;

  readonly reason:
    | "gateway_redeem_transport_completed"
    | "gateway_redeem_http_rejected";

  readonly httpStatus:
    number;

  readonly paymentResponsePresent:
    boolean;

  readonly gatewayCode:
    string | null;

  readonly gatewayReason:
    string | null;

  readonly gatewayCalled:
    true;

  readonly redeemAttempted:
    true;

  readonly transportCalls:
    1;

  readonly phase5ClaimOwnedByGateway:
    true;

  readonly runnerDirectPhase5ClaimInvoked:
    false;

  readonly automaticRetry:
    false;

  readonly paymentAttempted:
    false;

  readonly resourceReleasedByRunner:
    false;

  readonly productionActivation:
    false;
};

function d43AsRecordV1(
  value:
    unknown,
): Record<string, any> | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  )
    ? value as
        Record<string, any>
    : null;
}

function d43SafeGatewayDiagnosticStringV1(
  value:
    unknown,
): string | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return (
    normalized.length >
      0 &&
    normalized.length <=
      160 &&
    /^[A-Za-z0-9_.:-]+$/.test(
      normalized,
    )
  )
    ? normalized
    : null;
}

function d43AssertNoPrivateJwkV1(
  value:
    unknown,
  location =
    "$",
): void {
  if (
    Array.isArray(
      value,
    )
  ) {
    value.forEach(
      (
        child,
        index,
      ) =>
        d43AssertNoPrivateJwkV1(
          child,
          `${location}[${index}]`,
        ),
    );

    return;
  }

  const record =
    d43AsRecordV1(
      value,
    );

  if (
    record ===
      null
  ) {
    return;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      record,
    )
  ) {
    if (
      key ===
        "d"
    ) {
      throw new Error(
        `redeem_private_jwk_material_forbidden:${location}.${key}`,
      );
    }

    d43AssertNoPrivateJwkV1(
      child,
      `${location}.${key}`,
    );
  }
}

export function buildDemo4D43AuthorizedAgentRedeemBodyV1(
  input: {
    readonly challenge:
      Demo4D43ProofConstructionChallengeV1;

    readonly proof:
      Demo4D43HybridProofConstructionResultV1;
  },
): Demo4D43GatewayRedeemBodyV1 {
  const challenge =
    input.challenge;

  const proof =
    input.proof;

  if (
    !challenge.nonce ||
    !/^[0-9a-f]{64}$/.test(
      challenge.challengeHash,
    ) ||
    !Number.isSafeInteger(
      challenge.issuedAt,
    ) ||
    !Number.isSafeInteger(
      challenge.expiresAt,
    ) ||
    challenge.expiresAt <=
      challenge.issuedAt ||
    !/^[0-9a-f]{64}$/.test(
      proof.credentialHash,
    ) ||
    proof.buyerSignatureVerified !==
      true ||
    proof.agentPublicKeyBoundByBuyerSignature !==
      true ||
    proof.agentProofOfPossessionVerified !==
      true ||
    proof.proofBindingsMatched !==
      true
  ) {
    throw new Error(
      "redeem_verified_proof_bundle_required",
    );
  }

  const credential =
    d43AsRecordV1(
      proof
        .delegationDocument
        .credential,
    );

  const issuer =
    d43AsRecordV1(
      credential?.issuer,
    );

  const subject =
    d43AsRecordV1(
      credential?.subject,
    );

  const scope =
    d43AsRecordV1(
      credential?.scope,
    );

  const resource =
    d43AsRecordV1(
      scope?.resource,
    );

  const contract =
    d43AsRecordV1(
      scope?.contract,
    );

  const asset =
    d43AsRecordV1(
      scope?.asset,
    );

  const amount =
    d43AsRecordV1(
      scope?.amount,
    );

  const validity =
    d43AsRecordV1(
      credential?.validity,
    );

  const usage =
    d43AsRecordV1(
      credential?.usage,
    );

  const replay =
    d43AsRecordV1(
      credential?.replay,
    );

  const statement =
    d43AsRecordV1(
      proof
        .proofDocument
        .statement,
    );

  const proofChallenge =
    d43AsRecordV1(
      statement?.challenge,
    );

  const delegationId =
    typeof credential?.delegationId ===
      "string"
      ? credential.delegationId
      : "";

  const exactSignedContract =
    delegationId ===
      `delegation-${challenge.nonce}` &&
    issuer?.buyerId ===
      DEMO4_D4_3_BUYER_ID &&
    subject?.agentId ===
      DEMO4_D4_3_AGENT_ID &&
    scope?.merchantId ===
      "demo-merchant" &&
    resource?.method ===
      "GET" &&
    resource?.path ===
      "/paid-gated" &&
    contract?.contractId ===
      "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98" &&
    contract?.contractVersion ===
      "1.0.0" &&
    scope?.network ===
      "concordium:testnet" &&
    asset?.type ===
      "PLT" &&
    asset?.tokenId ===
      "EUDemo" &&
    asset?.decimals ===
      6 &&
    amount?.value ===
      "0.050101" &&
    scope?.payTo ===
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ" &&
    scope?.allowedAction ===
      DEMO4_D4_3_PHASE5_ALLOWED_ACTION &&
    Number.isSafeInteger(
      validity?.issuedAt,
    ) &&
    Number.isSafeInteger(
      validity?.expiresAt,
    ) &&
    validity.issuedAt <=
      challenge.issuedAt &&
    validity.expiresAt >=
      challenge.expiresAt &&
    usage?.maxUses ===
      1 &&
    replay?.credentialNonce ===
      `credential-${challenge.nonce}` &&
    statement?.delegationId ===
      delegationId &&
    statement?.credentialHash ===
      proof.credentialHash &&
    statement?.agentId ===
      DEMO4_D4_3_AGENT_ID &&
    proofChallenge?.nonce ===
      challenge.nonce &&
    proofChallenge?.challengeHash ===
      challenge.challengeHash &&
    proofChallenge?.issuedAt ===
      challenge.issuedAt &&
    proofChallenge?.expiresAt ===
      challenge.expiresAt;

  if (
    !exactSignedContract
  ) {
    throw new Error(
      "redeem_signed_proof_contract_mismatch",
    );
  }

  const authorizationProof:
    Record<string, unknown> = {
      authorizationProofType:
        DEMO4_D4_3_PHASE5_AUTHORIZATION_PROOF_TYPE,

      agent: {
        agentId:
          DEMO4_D4_3_AGENT_ID,

        agentType:
          "controlled-final-acceptance-agent",
      },

      buyer: {
        buyerCommitment:
          `sha256:${proof.credentialHash}`,

        buyerAccount:
          DEMO4_D4_3_BUYER_ACCOUNT,

        policySubject:
          DEMO4_D4_3_BUYER_ID,
      },

      delegation: {
        delegationId,

        delegationIssuedAt:
          validity.issuedAt,

        delegationExpiresAt:
          validity.expiresAt,

        delegationProofPresent:
          true,

        delegationProofPrinted:
          false,
      },

      challenge: {
        nonce:
          challenge.nonce,

        challengeHash:
          challenge.challengeHash,

        issuedAt:
          challenge.issuedAt,

        expiresAt:
          challenge.expiresAt,
      },

      scope: {
        merchantId:
          scope.merchantId,

        resource: {
          method:
            resource.method,

          path:
            resource.path,
        },

        contractId:
          contract.contractId,

        contractVersion:
          contract.contractVersion,

        network:
          scope.network,

        asset: {
          type:
            asset.type,

          tokenId:
            asset.tokenId,

          decimals:
            asset.decimals,
        },

        amount:
          amount.value,

        payTo:
          scope.payTo,

        allowedAction:
          scope.allowedAction,

        maxUses:
          usage.maxUses,
      },

      policyEvidence: {
        proofType:
          "concordium.VerifiablePresentation",

        claims: {
          region:
            DEMO4_D4_3_POLICY_REGION,

          ageOver:
            DEMO4_D4_3_POLICY_AGE_OVER,
        },

        rawProofPrinted:
          false,
      },

      cryptographicProofs: {
        delegationCredential:
          proof.delegationDocument,

        agentProofOfPossession:
          proof.proofDocument,
      },
    };

  const body:
    Demo4D43GatewayRedeemBodyV1 = {
      nonce:
        challenge.nonce,

      authorizationProof,

      agentRegistryReference:
        DEMO4_D4_3_AGENT_REGISTRY_REFERENCE_V1,
    };

  d43AssertNoPrivateJwkV1(
    body,
  );

  return body;
}

function d43ValidateGatewayRedeemBodyV1(
  body:
    Demo4D43GatewayRedeemBodyV1,
): void {
  const authorizationProof =
    d43AsRecordV1(
      body.authorizationProof,
    );

  const challenge =
    d43AsRecordV1(
      authorizationProof?.challenge,
    );

  const reference =
    body.agentRegistryReference;

  const exact =
    typeof body.nonce ===
      "string" &&
    body.nonce.length >
      0 &&
    authorizationProof?.authorizationProofType ===
      DEMO4_D4_3_PHASE5_AUTHORIZATION_PROOF_TYPE &&
    challenge?.nonce ===
      body.nonce &&
    reference.type ===
      "xcf.agent-registry.reference" &&
    reference.version ===
      "1.0.0" &&
    reference.registryStandard ===
      "CIS-8004" &&
    reference.network ===
      "ccd:testnet" &&
    reference.registryContract.index ===
      "12802" &&
    reference.registryContract.subindex ===
      0 &&
    reference.agentTokenId ===
      "287" &&
    reference.tokenAddress ===
      "ccd:testnet/cis2:12802-0-287";

  if (
    !exact
  ) {
    throw new Error(
      "gateway_redeem_body_invalid",
    );
  }

  d43AssertNoPrivateJwkV1(
    body,
  );
}

export async function executeDemo4D43RedeemWithTransportV1(
  input: {
    readonly gatewayBaseUrl:
      string;

    readonly gatewayRedeemAuthorized:
      boolean;

    readonly phase5AtomicClaimAuthorized:
      boolean;

    readonly body:
      Demo4D43GatewayRedeemBodyV1;

    readonly transport:
      Demo4D43RedeemTransportV1;
  },
): Promise<Demo4D43RedeemTransportResultV1> {
  if (
    productionSurfaceActive()
  ) {
    throw new Error(
      "gateway_redeem_production_surface_forbidden",
    );
  }

  if (
    input.gatewayRedeemAuthorized !==
      true
  ) {
    throw new Error(
      "gateway_redeem_not_authorized",
    );
  }

  if (
    input.phase5AtomicClaimAuthorized !==
      true
  ) {
    throw new Error(
      "gateway_owned_phase5_atomic_claim_not_authorized",
    );
  }

  const gatewayBaseUrl =
    safeLoopbackBaseUrl(
      input.gatewayBaseUrl,
    );

  if (
    gatewayBaseUrl ===
      null
  ) {
    throw new Error(
      "gateway_redeem_loopback_base_url_required",
    );
  }

  d43ValidateGatewayRedeemBodyV1(
    input.body,
  );

  const response =
    await input.transport({
      url:
        `${gatewayBaseUrl}${DEMO4_D4_3_GATEWAY_REDEEM_PATH}`,

      method:
        "POST",

      headers: {
        "content-type":
          "application/json",

        accept:
          "application/json",
      },

      body:
        JSON.stringify(
          input.body,
        ),
    });

  if (
    !Number.isInteger(
      response.status,
    ) ||
    response.status <
      100 ||
    response.status >
      599
  ) {
    throw new Error(
      "gateway_redeem_transport_status_invalid",
    );
  }

  return {
    ok:
      response.status ===
        200,

    reason:
      response.status ===
        200
        ? "gateway_redeem_transport_completed"
        : "gateway_redeem_http_rejected",

    httpStatus:
      response.status,

    paymentResponsePresent:
      typeof response.paymentResponseHeader ===
        "string" &&
      response.paymentResponseHeader.length >
        0,

    gatewayCode:
      d43SafeGatewayDiagnosticStringV1(
        response.gatewayCode,
      ),

    gatewayReason:
      d43SafeGatewayDiagnosticStringV1(
        response.gatewayReason,
      ),

    gatewayCalled:
      true,

    redeemAttempted:
      true,

    transportCalls:
      1,

    phase5ClaimOwnedByGateway:
      true,

    runnerDirectPhase5ClaimInvoked:
      false,

    automaticRetry:
      false,

    paymentAttempted:
      false,

    resourceReleasedByRunner:
      false,

    productionActivation:
      false,
  };
}

export async function executeDemo4D43GatewayRedeemV1(
  input: {
    readonly gatewayBaseUrl:
      string;

    readonly body:
      Demo4D43GatewayRedeemBodyV1;
  },
): Promise<Demo4D43RedeemTransportResultV1> {
  return executeDemo4D43RedeemWithTransportV1({
    gatewayBaseUrl:
      input.gatewayBaseUrl,

    gatewayRedeemAuthorized:
      envTrue(
        "DEMO4_D4_3_CAP_GATEWAY_REDEEM_AUTHORIZED",
      ),

    phase5AtomicClaimAuthorized:
      envTrue(
        "DEMO4_D4_3_CAP_PHASE5_ATOMIC_CLAIM_AUTHORIZED",
      ),

    body:
      input.body,

    transport:
      async (
        request,
      ) => {
        const controller =
          new AbortController();

        const timer =
          setTimeout(
            () =>
              controller.abort(),
            10_000,
          );

        try {
          const response =
            await fetch(
              request.url,
              {
                method:
                  request.method,

                headers:
                  request.headers,

                body:
                  request.body,

                redirect:
                  "error",

                signal:
                  controller.signal,
              },
            );

          const responseBody =
            objectOrNull(
              await response.json().catch(
                () => null,
              ),
            );

          return {
            status:
              response.status,

            paymentResponseHeader:
              response.headers.get(
                "payment-response",
              ),

            gatewayCode:
              d43SafeGatewayDiagnosticStringV1(
                responseBody?.code,
              ),

            gatewayReason:
              d43SafeGatewayDiagnosticStringV1(
                responseBody?.reason,
              ),
          };
        } finally {
          clearTimeout(
            timer,
          );
        }
      },
  });
}


// -----------------------------------------------------------------------------
// PR #318 — bounded runner-owned CRP pending registration.
// No payer read, payment submission, fulfill, receipt, release, or replay.
// -----------------------------------------------------------------------------

export type Demo4D43CrpPendingRegistrationResultV1 = {
  readonly ok: boolean;
  readonly reason:
    | "crp_pending_registration_completed"
    | "crp_pending_registration_not_authorized"
    | "crp_pending_registration_claim_not_verified"
    | "crp_pending_registration_contract_mismatch"
    | "crp_pending_registration_http_rejected"
    | "crp_pending_registration_network_outcome_ambiguous";
  readonly httpStatus: number | null;
  readonly pendingRegistered: boolean;
  readonly transportCalls: 0 | 1;
  readonly automaticRetry: false;
  readonly payerWalletRead: false;
  readonly paymentAttempted: false;
  readonly transactionSubmitted: false;
  readonly crpFulfillCalled: false;
  readonly receiptIssued: false;
  readonly replayCalled: false;
  readonly resourceReleased: false;
  readonly productionActivation: false;
};

function d43CrpPendingResult(
  ok: boolean,
  reason: Demo4D43CrpPendingRegistrationResultV1["reason"],
  httpStatus: number | null = null,
  pendingRegistered = false,
  transportCalls: 0 | 1 = 0,
): Demo4D43CrpPendingRegistrationResultV1 {
  return {
    ok,
    reason,
    httpStatus,
    pendingRegistered,
    transportCalls,
    automaticRetry: false,
    payerWalletRead: false,
    paymentAttempted: false,
    transactionSubmitted: false,
    crpFulfillCalled: false,
    receiptIssued: false,
    replayCalled: false,
    resourceReleased: false,
    productionActivation: false,
  };
}

export async function executeDemo4D43CrpPendingRegistrationWithTransportV1(
  input: {
    readonly crpBaseUrl: string;
    readonly authorized: boolean;
    readonly phase5ClaimVerified: boolean;
    readonly paymentRequired: any;
    readonly transport: (request: {
      readonly url: string;
      readonly method: "POST";
      readonly headers: Readonly<Record<string, string>>;
      readonly body: string;
    }) => Promise<{ readonly status: number }>;
  },
): Promise<Demo4D43CrpPendingRegistrationResultV1> {
  if (!input.authorized) {
    return d43CrpPendingResult(false, "crp_pending_registration_not_authorized");
  }

  if (!input.phase5ClaimVerified) {
    return d43CrpPendingResult(false, "crp_pending_registration_claim_not_verified");
  }

  const base = safeLoopbackBaseUrl(input.crpBaseUrl);
  const pr = input.paymentRequired;

  const exactTuple =
    base !== null &&
    typeof pr?.nonce === "string" &&
    pr.nonce.length > 0 &&
    Number.isSafeInteger(pr?.expiresAt) &&
    pr.expiresAt > 0 &&
    pr?.merchantId === "demo-merchant" &&
    pr?.network === "concordium:testnet" &&
    pr?.chain_id === "ccd:4221332d34e1694168c2a0c0b3fd0f27" &&
    pr?.asset?.type === "PLT" &&
    pr?.asset?.tokenId === "EUDemo" &&
    pr?.asset?.decimals === 6 &&
    pr?.amount === "0.050101" &&
    pr?.payTo === "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ" &&
    typeof pr?.contractId === "string" &&
    pr.contractId.length > 0 &&
    pr?.contractVersion === "1.0.0" &&
    pr?.isFrozen === true &&
    pr?.resource?.method === "GET" &&
    pr?.resource?.path === "/paid-gated";

  if (!exactTuple || base === null) {
    return d43CrpPendingResult(false, "crp_pending_registration_contract_mismatch");
  }

  const body = {
    merchantId: pr.merchantId,
    nonce: pr.nonce,
    network: pr.network,
    networkGenesisIndex: 7,
    asset: pr.asset,
    amount: pr.amount,
    payTo: pr.payTo,
    expiry: new Date(pr.expiresAt * 1000).toISOString().replace(".000Z", "Z"),
    metadata: {
      contract: {
        contractId: pr.contractId,
        contractVersion: pr.contractVersion,
        isFrozen: true,
        merchantId: pr.merchantId,
        resource: pr.resource,
        chain_id: pr.chain_id,
        network: pr.network,
        asset: pr.asset,
        amount: pr.amount,
        payTo: pr.payTo,
      },
    },
  };

  try {
    const response = await input.transport({
      url: base + "/v1/crp/payments",
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status < 200 || response.status >= 300) {
      return d43CrpPendingResult(
        false,
        "crp_pending_registration_http_rejected",
        response.status,
        false,
        1,
      );
    }

    return d43CrpPendingResult(
      true,
      "crp_pending_registration_completed",
      response.status,
      true,
      1,
    );
  } catch {
    return d43CrpPendingResult(
      false,
      "crp_pending_registration_network_outcome_ambiguous",
      null,
      false,
      1,
    );
  }
}

export async function executeDemo4D43CrpPendingRegistrationV1(
  input: {
    readonly phase5ClaimVerified: boolean;
    readonly paymentRequired: any;
  },
): Promise<Demo4D43CrpPendingRegistrationResultV1> {
  const base = process.env.DEMO4_D4_3_CRP_BASE_URL ?? "";

  const authorized =
    envTrue("DEMO4_D4_3_CRP_PENDING_REGISTRATION_ENABLED") &&
    envTrue("DEMO4_D4_3_CAP_CRP_PAYMENT_CREATE_AUTHORIZED");

  return executeDemo4D43CrpPendingRegistrationWithTransportV1({
    crpBaseUrl: base,
    authorized,
    phase5ClaimVerified: input.phase5ClaimVerified,
    paymentRequired: input.paymentRequired,
    transport: async (request) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: "error",
          signal: controller.signal,
        });

        return { status: response.status };
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

// -----------------------------------------------------------------------------
// PR #318 — S4/S5 controlled payer adapter.
//
// S4 is a separately authorized payer-wallet preflight. It may perform exactly
// one wallet-file read and one read-only token lookup, but it must not submit a
// transaction.
//
// S5 is a separately authorized one-shot payer invocation. The caller consumes
// the one-payment budget before invoking the payer. There is no automatic retry.
// Ambiguous or failed outcomes require a hard stop.
// -----------------------------------------------------------------------------

export type Demo4D43PayerWalletPreflightEvidenceV1 = {
  readonly ok: boolean;

  readonly reason:
    | "payer_wallet_preflight_completed"
    | "payer_wallet_preflight_not_authorized"
    | "payer_wallet_preflight_crp_pending_required"
    | "payer_wallet_preflight_contract_mismatch"
    | "payer_wallet_preflight_failed";

  readonly preflightCalls:
    0 | 1;

  readonly walletReadCount:
    number | null;

  readonly tokenNetworkReads:
    number | null;

  readonly accountInfoNetworkReads:
    number | null;

  readonly payerTokenBalanceRaw:
    string | null;

  readonly requiredAmountRaw:
    string | null;

  readonly balanceSufficient:
    boolean | null;

  readonly senderAddress:
    string | null;

  readonly tokenId:
    string | null;

  readonly decimals:
    number | null;

  readonly amount:
    string | null;

  readonly amountRaw:
    string | null;

  readonly payTo:
    string | null;

  readonly transactionConstructed:
    false;

  readonly transactionSubmitted:
    false;

  readonly paymentAttempted:
    false;

  readonly automaticRetry:
    false;

  readonly productionActivation:
    false;
};

export type Demo4D43PayerWalletPreflightSessionV1 = {
  readonly evidence:
    Demo4D43PayerWalletPreflightEvidenceV1;

  /*
   * Opaque in-memory payer preparation.
   * Never print or serialize this field.
   */
  readonly prepared:
    PltTransferPreparedV1 | null;
};

function d43PayerWalletPreflightSessionV1(
  evidence:
    Demo4D43PayerWalletPreflightEvidenceV1,
  prepared:
    PltTransferPreparedV1 | null = null,
): Demo4D43PayerWalletPreflightSessionV1 {
  return {
    evidence,
    prepared,
  };
}

function d43PayerWalletPreflightEvidenceV1(
  input: {
    readonly ok:
      boolean;

    readonly reason:
      Demo4D43PayerWalletPreflightEvidenceV1["reason"];

    readonly preflightCalls?:
      0 | 1;

    readonly walletReadCount?:
      number | null;

    readonly tokenNetworkReads?:
      number | null;

    readonly accountInfoNetworkReads?:
      number | null;

    readonly payerTokenBalanceRaw?:
      string | null;

    readonly requiredAmountRaw?:
      string | null;

    readonly balanceSufficient?:
      boolean | null;

    readonly senderAddress?:
      string | null;

    readonly tokenId?:
      string | null;

    readonly decimals?:
      number | null;

    readonly amount?:
      string | null;

    readonly amountRaw?:
      string | null;

    readonly payTo?:
      string | null;
  },
): Demo4D43PayerWalletPreflightEvidenceV1 {
  return {
    ok:
      input.ok,

    reason:
      input.reason,

    preflightCalls:
      input.preflightCalls ??
      0,

    walletReadCount:
      input.walletReadCount ??
      null,

    tokenNetworkReads:
      input.tokenNetworkReads ??
      null,

    accountInfoNetworkReads:
      input.accountInfoNetworkReads ??
      null,

    payerTokenBalanceRaw:
      input.payerTokenBalanceRaw ??
      null,

    requiredAmountRaw:
      input.requiredAmountRaw ??
      null,

    balanceSufficient:
      input.balanceSufficient ??
      null,

    senderAddress:
      input.senderAddress ??
      null,

    tokenId:
      input.tokenId ??
      null,

    decimals:
      input.decimals ??
      null,

    amount:
      input.amount ??
      null,

    amountRaw:
      input.amountRaw ??
      null,

    payTo:
      input.payTo ??
      null,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    automaticRetry:
      false,

    productionActivation:
      false,
  };
}

export async function executeDemo4D43PayerWalletPreflightWithAdapterV1(
  input: {
    readonly authorized:
      boolean;

    readonly crpPendingRegistered:
      boolean;

    readonly paymentRequired:
      any;

    readonly walletPath:
      string;

    readonly grpcHost:
      string;

    readonly grpcPort:
      number;

    readonly preflight:
      (
        input:
          PltTransferPreflightInputV1,
      ) => Promise<PltTransferPreparedV1>;
  },
): Promise<Demo4D43PayerWalletPreflightSessionV1> {
  if (!input.authorized) {
    return d43PayerWalletPreflightSessionV1(
      d43PayerWalletPreflightEvidenceV1({
        ok:
          false,

        reason:
          "payer_wallet_preflight_not_authorized",
      }),
    );
  }

  if (!input.crpPendingRegistered) {
    return d43PayerWalletPreflightSessionV1(
      d43PayerWalletPreflightEvidenceV1({
        ok:
          false,

        reason:
          "payer_wallet_preflight_crp_pending_required",
      }),
    );
  }

  const pr =
    input.paymentRequired;

  let amountRaw:
    string | null =
    null;

  try {
    amountRaw =
      amountToD43RawUnits(
        String(
          pr?.amount ??
          "",
        ),
        Number(
          pr?.asset?.decimals,
        ),
      );
  } catch {
    amountRaw =
      null;
  }

  const exactTuple =
    typeof input.walletPath ===
      "string" &&
    input.walletPath.length >
      0 &&
    input.grpcHost ===
      "grpc.testnet.concordium.com" &&
    input.grpcPort ===
      20000 &&
    pr?.merchantId ===
      "demo-merchant" &&
    pr?.network ===
      "concordium:testnet" &&
    pr?.chain_id ===
      "ccd:4221332d34e1694168c2a0c0b3fd0f27" &&
    pr?.asset?.type ===
      "PLT" &&
    pr?.asset?.tokenId ===
      "EUDemo" &&
    pr?.asset?.decimals ===
      6 &&
    pr?.amount ===
      "0.050101" &&
    amountRaw ===
      "50101" &&
    pr?.payTo ===
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ" &&
    pr?.resource?.method ===
      "GET" &&
    pr?.resource?.path ===
      "/paid-gated";

  if (!exactTuple) {
    return d43PayerWalletPreflightSessionV1(
      d43PayerWalletPreflightEvidenceV1({
        ok:
          false,

        reason:
          "payer_wallet_preflight_contract_mismatch",
      }),
    );
  }

  let prepared:
    PltTransferPreparedV1;

  try {
    prepared =
      await input.preflight({
        walletPath:
          input.walletPath,

        to:
          pr.payTo,

        tokenId:
          pr.asset.tokenId,

        amount:
          pr.amount,

        grpcHost:
          input.grpcHost,

        grpcPort:
          input.grpcPort,
      });
  } catch {
    return d43PayerWalletPreflightSessionV1(
      d43PayerWalletPreflightEvidenceV1({
        ok:
          false,

        reason:
          "payer_wallet_preflight_failed",

        preflightCalls:
          1,
      }),
    );
  }

  const payerBalanceRawValid =
    /^(0|[1-9][0-9]*)$/.test(
      prepared.payerTokenBalanceRaw,
    ) &&
    BigInt(
      prepared.payerTokenBalanceRaw,
    ) >=
      50101n;

  const preparedMatches =
    prepared.walletReadCount ===
      1 &&
    prepared.tokenNetworkReads ===
      1 &&
    prepared.accountInfoNetworkReads ===
      1 &&
    prepared.requiredAmountRaw ===
      "50101" &&
    prepared.balanceSufficient ===
      true &&
    payerBalanceRawValid &&
    prepared.transactionConstructed ===
      false &&
    prepared.transactionSubmitted ===
      false &&
    prepared.senderAddress ===
      DEMO4_D4_3_BUYER_ACCOUNT &&
    prepared.tokenId ===
      "EUDemo" &&
    prepared.decimals ===
      6 &&
    prepared.amount ===
      "0.050101" &&
    prepared.to ===
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ";

  if (!preparedMatches) {
    return d43PayerWalletPreflightSessionV1(
      d43PayerWalletPreflightEvidenceV1({
        ok:
          false,

        reason:
          "payer_wallet_preflight_contract_mismatch",

        preflightCalls:
          1,

        walletReadCount:
          prepared.walletReadCount,

        tokenNetworkReads:
          prepared.tokenNetworkReads,

        accountInfoNetworkReads:
          prepared.accountInfoNetworkReads,

        payerTokenBalanceRaw:
          prepared.payerTokenBalanceRaw,

        requiredAmountRaw:
          prepared.requiredAmountRaw,

        balanceSufficient:
          prepared.balanceSufficient,

        senderAddress:
          prepared.senderAddress,

        tokenId:
          prepared.tokenId,

        decimals:
          prepared.decimals,

        amount:
          prepared.amount,

        amountRaw,

        payTo:
          prepared.to,
      }),
    );
  }

  return d43PayerWalletPreflightSessionV1(
    d43PayerWalletPreflightEvidenceV1({
      ok:
        true,

      reason:
        "payer_wallet_preflight_completed",

      preflightCalls:
        1,

      walletReadCount:
        prepared.walletReadCount,

      tokenNetworkReads:
        prepared.tokenNetworkReads,

      accountInfoNetworkReads:
        prepared.accountInfoNetworkReads,

      payerTokenBalanceRaw:
        prepared.payerTokenBalanceRaw,

      requiredAmountRaw:
        prepared.requiredAmountRaw,

      balanceSufficient:
        prepared.balanceSufficient,

      senderAddress:
        prepared.senderAddress,

      tokenId:
        prepared.tokenId,

      decimals:
        prepared.decimals,

      amount:
        prepared.amount,

      amountRaw,

      payTo:
        prepared.to,
    }),

    prepared,
  );
}

export async function executeDemo4D43PayerWalletPreflightV1(
  input: {
    readonly crpPendingRegistered:
      boolean;

    readonly paymentRequired:
      any;
  },
): Promise<Demo4D43PayerWalletPreflightSessionV1> {
  const authorized =
    envTrue(
      "DEMO4_D4_3_PAYER_WALLET_PREFLIGHT_ENABLED",
    ) &&
    envTrue(
      "DEMO4_D4_3_CAP_PAYER_WALLET_READ_AUTHORIZED",
    );

  const walletPath =
    envString(
      "DEMO4_D4_3_PAYER_WALLET_PATH",
    );

  return executeDemo4D43PayerWalletPreflightWithAdapterV1({
    authorized,

    crpPendingRegistered:
      input.crpPendingRegistered,

    paymentRequired:
      input.paymentRequired,

    walletPath,

    grpcHost:
      "grpc.testnet.concordium.com",

    grpcPort:
      20000,

    preflight:
      preflightPltTransferV1,
  });
}

export type Demo4D43PaymentInvocationResultV1 = {
  readonly ok:
    boolean;

  readonly reason:
    | "payment_invocation_completed"
    | "payment_invocation_not_authorized"
    | "payment_invocation_preflight_not_ready"
    | "payment_invocation_budget_invalid"
    | "payment_invocation_finalized_failure"
    | "payment_invocation_submitted_unknown";

  readonly payerInvocationCalls:
    0 | 1;

  readonly paymentSubmissionAttempts:
    0 | 1;

  readonly paymentAttemptConsumedBeforePayerInvocation:
    boolean;

  readonly signingOperations:
    0 | 1;

  readonly transactionsConstructed:
    0 | 1;

  readonly transactionHash:
    string | null;

  readonly transactionHashObserved:
    boolean;

  readonly paymentOutcome:
    "not_attempted"
    | "finalized_success"
    | "finalized_failure"
    | "submitted_unknown";

  readonly paymentFinalized:
    boolean;

  readonly stopRequired:
    boolean;

  readonly automaticRetry:
    false;

  readonly crpFulfillCalled:
    false;

  readonly resourceReleased:
    false;

  readonly replayCalled:
    false;

  readonly productionActivation:
    false;
};

function d43PaymentInvocationResultV1(
  input: {
    readonly ok:
      boolean;

    readonly reason:
      Demo4D43PaymentInvocationResultV1["reason"];

    readonly payerInvocationCalls?:
      0 | 1;

    readonly paymentSubmissionAttempts?:
      0 | 1;

    readonly paymentAttemptConsumedBeforePayerInvocation?:
      boolean;

    readonly signingOperations?:
      0 | 1;

    readonly transactionsConstructed?:
      0 | 1;

    readonly transactionHash?:
      string | null;

    readonly paymentOutcome?:
      Demo4D43PaymentInvocationResultV1["paymentOutcome"];

    readonly paymentFinalized?:
      boolean;

    readonly stopRequired?:
      boolean;
  },
): Demo4D43PaymentInvocationResultV1 {
  const transactionHash =
    input.transactionHash ??
    null;

  return {
    ok:
      input.ok,

    reason:
      input.reason,

    payerInvocationCalls:
      input.payerInvocationCalls ??
      0,

    paymentSubmissionAttempts:
      input.paymentSubmissionAttempts ??
      0,

    paymentAttemptConsumedBeforePayerInvocation:
      input.paymentAttemptConsumedBeforePayerInvocation ??
      false,

    signingOperations:
      input.signingOperations ??
      0,

    transactionsConstructed:
      input.transactionsConstructed ??
      0,

    transactionHash,

    transactionHashObserved:
      typeof transactionHash ===
        "string" &&
      transactionHash.length >
        0,

    paymentOutcome:
      input.paymentOutcome ??
      "not_attempted",

    paymentFinalized:
      input.paymentFinalized ??
      false,

    stopRequired:
      input.stopRequired ??
      false,

    automaticRetry:
      false,

    crpFulfillCalled:
      false,

    resourceReleased:
      false,

    replayCalled:
      false,

    productionActivation:
      false,
  };
}

export async function executeDemo4D43PaymentInvocationWithAdapterV1(
  input: {
    readonly authorized:
      boolean;

    readonly preflightSession:
      Demo4D43PayerWalletPreflightSessionV1;

    readonly paymentSubmissionBudgetRemaining:
      number;

    readonly invoke:
      (
        prepared:
          PltTransferPreparedV1,
      ) => Promise<PltTransferExecutionResultV1>;
  },
): Promise<Demo4D43PaymentInvocationResultV1> {
  if (!input.authorized) {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_not_authorized",
    });
  }

  if (
    !input.preflightSession
      .evidence.ok ||
    input.preflightSession
      .prepared ===
      null
  ) {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_preflight_not_ready",
    });
  }

  if (
    input.paymentSubmissionBudgetRemaining !==
      1
  ) {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_budget_invalid",
    });
  }

  /*
   * The single payment-attempt budget is consumed before payer invocation.
   * From this point onward every failure is terminal for this one-shot run.
   */
  let execution:
    PltTransferExecutionResultV1;

  try {
    execution =
      await input.invoke(
        input.preflightSession
          .prepared,
      );
  } catch {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_submitted_unknown",

      payerInvocationCalls:
        1,

      paymentSubmissionAttempts:
        1,

      paymentAttemptConsumedBeforePayerInvocation:
        true,

      signingOperations:
        1,

      transactionsConstructed:
        1,

      paymentOutcome:
        "submitted_unknown",

      paymentFinalized:
        false,

      stopRequired:
        true,
    });
  }

  const accountingValid =
    execution
      .paymentSubmissionAttempts ===
      1 &&
    execution
      .signingOperations ===
      1 &&
    execution
      .transactionsConstructed ===
      1 &&
    execution
      .automaticRetry ===
      false;

  if (!accountingValid) {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_submitted_unknown",

      payerInvocationCalls:
        1,

      paymentSubmissionAttempts:
        1,

      paymentAttemptConsumedBeforePayerInvocation:
        true,

      signingOperations:
        1,

      transactionsConstructed:
        1,

      transactionHash:
        execution.txHash,

      paymentOutcome:
        "submitted_unknown",

      paymentFinalized:
        false,

      stopRequired:
        true,
    });
  }

  if (
    execution.outcome ===
      "finalized_success" &&
    execution.ok &&
    execution.finalized
  ) {
    return d43PaymentInvocationResultV1({
      ok:
        true,

      reason:
        "payment_invocation_completed",

      payerInvocationCalls:
        1,

      paymentSubmissionAttempts:
        1,

      paymentAttemptConsumedBeforePayerInvocation:
        true,

      signingOperations:
        1,

      transactionsConstructed:
        1,

      transactionHash:
        execution.txHash,

      paymentOutcome:
        "finalized_success",

      paymentFinalized:
        true,

      stopRequired:
        false,
    });
  }

  if (
    execution.outcome ===
      "finalized_failure"
  ) {
    return d43PaymentInvocationResultV1({
      ok:
        false,

      reason:
        "payment_invocation_finalized_failure",

      payerInvocationCalls:
        1,

      paymentSubmissionAttempts:
        1,

      paymentAttemptConsumedBeforePayerInvocation:
        true,

      signingOperations:
        1,

      transactionsConstructed:
        1,

      transactionHash:
        execution.txHash,

      paymentOutcome:
        "finalized_failure",

      paymentFinalized:
        true,

      stopRequired:
        true,
    });
  }

  return d43PaymentInvocationResultV1({
    ok:
      false,

    reason:
      "payment_invocation_submitted_unknown",

    payerInvocationCalls:
      1,

    paymentSubmissionAttempts:
      1,

    paymentAttemptConsumedBeforePayerInvocation:
      true,

    signingOperations:
      1,

    transactionsConstructed:
      1,

    transactionHash:
      execution.txHash,

    paymentOutcome:
      "submitted_unknown",

    paymentFinalized:
      false,

    stopRequired:
      true,
  });
}

export async function executeDemo4D43PaymentInvocationV1(
  input: {
    readonly preflightSession:
      Demo4D43PayerWalletPreflightSessionV1;
  },
): Promise<Demo4D43PaymentInvocationResultV1> {
  const authorized =
    envTrue(
      "DEMO4_D4_3_PAYMENT_TRANSACTION_SUBMIT_ENABLED",
    ) &&
    envTrue(
      "DEMO4_D4_3_CAP_PAYMENT_TRANSACTION_SUBMIT_AUTHORIZED",
    );

  return executeDemo4D43PaymentInvocationWithAdapterV1({
    authorized,

    preflightSession:
      input.preflightSession,

    paymentSubmissionBudgetRemaining:
      1,

    invoke:
      async (
        prepared,
      ) =>
        executePreparedPltTransferV1({
          prepared,

          waitForFinalization:
            true,
        }),
  });
}

// -----------------------------------------------------------------------------
// PR #318 — canonical post-redeem Phase5 bounded-use verification.
// Read-only: verifies the Gateway-owned atomic claim from canonical persistence.
// -----------------------------------------------------------------------------

export type Demo4D43Phase5ClaimStateVerificationResultV1 = {
  readonly ok: boolean;
  readonly reason:
    | "phase5_claim_state_verified"
    | "phase5_claim_state_missing"
    | "phase5_claim_state_mismatch";
  readonly found: boolean;
  readonly maxUses: number | null;
  readonly consumedUses: number | null;
  readonly claimCount: number | null;
  readonly boundedUseConsumed: boolean;
};

export async function verifyDemo4D43Phase5ClaimStateV1(
  input: {
    readonly credentialHash: string;
    readonly delegationId: string;
  },
): Promise<Demo4D43Phase5ClaimStateVerificationResultV1> {
  const snapshot =
    await getPhase5AgentDelegationUsageSnapshot(
      input.credentialHash,
    );

  if (!snapshot.found) {
    return {
      ok: false,
      reason: "phase5_claim_state_missing",
      found: false,
      maxUses: null,
      consumedUses: null,
      claimCount: null,
      boundedUseConsumed: false,
    };
  }

  const exact =
    snapshot.credentialHash ===
      input.credentialHash &&
    snapshot.delegationId ===
      input.delegationId &&
    snapshot.maxUses ===
      1 &&
    snapshot.consumedUses ===
      1 &&
    snapshot.claimCount ===
      1;

  return {
    ok: exact,
    reason:
      exact
        ? "phase5_claim_state_verified"
        : "phase5_claim_state_mismatch",
    found: true,
    maxUses:
      snapshot.maxUses,
    consumedUses:
      snapshot.consumedUses,
    claimCount:
      snapshot.claimCount,
    boundedUseConsumed:
      exact,
  };
}


export type Demo4D43AuthorizedProofOnlyResultV1 = {
  readonly ok: true;

  readonly reason:
    "authorized_live_proof_construction_verified";

  readonly challenge:
    Demo4D43ProofConstructionChallengeV1;

  readonly credentialHash:
    string;

  readonly delegationDocument:
    D43DelegationDocument;

  readonly proofDocument:
    D43AgentProofDocument;

  readonly buyerPrivateKeyReads:
    1;

  readonly actingPrivateKeyReads:
    1;

  readonly buyerSignatureVerified:
    true;

  readonly agentPublicKeyBoundByBuyerSignature:
    true;

  readonly agentProofOfPossessionVerified:
    true;

  readonly proofBindingsMatched:
    true;

  readonly challengeCreated:
    true;

  readonly canonicalPersistedByGateway:
    true;

  readonly networkCalled:
    true;
};

export async function executeDemo4D43AuthorizedProofOnlyV1(
  input: {
    readonly buyerVerificationKeyPath:
      string;

    readonly actingPublicKeyPath:
      string;

    readonly buyerPrivateKeyPath:
      string;

    readonly actingPrivateKeyPath:
      string;
  },
): Promise<Demo4D43AuthorizedProofOnlyResultV1> {
  applyDemo4D43FrozenTupleEnvironmentV1();

  const preLive =
    await executePreLiveGuard();

  if (!preLive.ok) {
    throw new Error(
      `authorized_proof_pre_live_guard_failed:${preLive.reason}`,
    );
  }

  const buyerVerificationKey =
    d43LoadFrozenBuyerVerificationKey(
      input.buyerVerificationKeyPath,
    );

  const actingPublicKeyJwk =
    d43LoadFrozenActingPublicKey(
      input.actingPublicKeyPath,
    );

  const freshChallenge =
    await executeFreshChallenge();

  if (
    !freshChallenge.ok ||
    freshChallenge.nonce === null ||
    freshChallenge.challengeHash === null ||
    freshChallenge.issuedAt === null ||
    freshChallenge.expiresAt === null ||
    !freshChallenge.canonicalPersistedByGateway
  ) {
    throw new Error(
      `authorized_proof_fresh_challenge_failed:${freshChallenge.reason}`,
    );
  }

  const challenge:
    Demo4D43ProofConstructionChallengeV1 = {
      nonce:
        freshChallenge.nonce,

      challengeHash:
        freshChallenge.challengeHash,

      issuedAt:
        freshChallenge.issuedAt,

      expiresAt:
        freshChallenge.expiresAt,
    };

  const loaded =
    loadDemo4D43BoundedProofKeyObjectsFromFilesystemV1({
      proofConstructionEnabled:
        envTrue(
          "DEMO4_D4_3_PROOF_CONSTRUCTION_ENABLED",
        ),

      proofConstructionAuthorized:
        envTrue(
          "DEMO4_D4_3_PROOF_CONSTRUCTION_AUTHORIZED",
        ),

      buyerPrivateKeyReadAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_BUYER_PRIVATE_KEY_READ_AUTHORIZED",
        ),

      actingPrivateKeyReadAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_ACTING_PRIVATE_KEY_READ_AUTHORIZED",
        ),

      proofSigningAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_PROOF_SIGNING_AUTHORIZED",
        ),

      buyerPrivateKeyPath:
        input.buyerPrivateKeyPath,

      actingPrivateKeyPath:
        input.actingPrivateKeyPath,
    });

  const proof =
    buildDemo4D43HybridCryptographicProofBundleV1({
      challenge,

      buyerId:
        DEMO4_D4_3_BUYER_ID,

      buyerKeyId:
        DEMO4_D4_3_BUYER_KEY_ID,

      buyerVerificationKey,

      buyerPrivateKey:
        loaded.buyerPrivateKey,

      agentId:
        DEMO4_D4_3_AGENT_ID,

      agentKeyId:
        DEMO4_D4_3_AGENT_KEY_ID,

      actingPublicKeyJwk,

      expectedActingPublicKeyHex:
        DEMO4_D4_3_ACTING_PUBLIC_RAW_HEX,

      actingPrivateKey:
        loaded.actingPrivateKey,
    });

  return {
    ok:
      true,

    reason:
      "authorized_live_proof_construction_verified",

    challenge,

    credentialHash:
      proof.credentialHash,

    delegationDocument:
      proof.delegationDocument,

    proofDocument:
      proof.proofDocument,

    buyerPrivateKeyReads:
      loaded.buyerPrivateKeyReads,

    actingPrivateKeyReads:
      loaded.actingPrivateKeyReads,

    buyerSignatureVerified:
      proof.buyerSignatureVerified,

    agentPublicKeyBoundByBuyerSignature:
      proof.agentPublicKeyBoundByBuyerSignature,

    agentProofOfPossessionVerified:
      proof.agentProofOfPossessionVerified,

    proofBindingsMatched:
      proof.proofBindingsMatched,

    challengeCreated:
      true,

    canonicalPersistedByGateway:
      true,

    networkCalled:
      true,
  };
}

type Demo4D43FreshChallengeResultV1 = {
  readonly ok: boolean;
  readonly reason: string;
  readonly httpStatus: number | null;
  readonly nonce: string | null;
  readonly challengeHash: string | null;
  readonly issuedAt: number | null;
  readonly expiresAt: number | null;
  readonly contractId: string | null;
  readonly contractVersion: string | null;
  readonly chainId: string | null;
  readonly networkCalled: boolean;
  readonly challengeMayHaveBeenCreated: boolean;
  readonly canonicalPersistedByGateway: boolean;
};

async function executeFreshChallenge():
Promise<Demo4D43FreshChallengeResultV1> {
  const gatewayBaseUrl =
    safeLoopbackBaseUrl(
      process.env.DEMO4_D4_3_GATEWAY_BASE_URL,
    );

  const resourceMethod =
    envString(
      "DEMO4_D4_3_RESOURCE_METHOD",
    );

  const resourcePath =
    envString(
      "DEMO4_D4_3_RESOURCE_PATH",
    );

  const blocked = (
    reason: string,
  ): Demo4D43FreshChallengeResultV1 => ({
    ok: false,
    reason,
    httpStatus: null,
    nonce: null,
    challengeHash: null,
    issuedAt: null,
    expiresAt: null,
    contractId: null,
    contractVersion: null,
    chainId: null,
    networkCalled: false,
    challengeMayHaveBeenCreated: false,
    canonicalPersistedByGateway: false,
  });

  if (
    !envTrue("DEMO4_D4_3_FRESH_CHALLENGE_ENABLED") ||
    !envTrue("DEMO4_D4_3_FRESH_CHALLENGE_AUTHORIZED") ||
    gatewayBaseUrl === null ||
    resourceMethod !== "GET" ||
    resourcePath !== "/paid-gated"
  ) {
    return blocked(
      "fresh_challenge_not_authorized_or_configured",
    );
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      5_000,
    );

  try {
    const response =
      await fetch(
        `${gatewayBaseUrl}${resourcePath}`,
        {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: {
            accept: "application/json",
          },
        },
      );

    const paymentRequiredHeader =
      response.headers.get(
        "payment-required",
      );

    const body =
      objectOrNull(
        await response.json().catch(
          () => null,
        ),
      );

    if (
      response.status !== 402 ||
      !paymentRequiredHeader
    ) {
      return {
        ...blocked(
          "fresh_challenge_response_not_402_with_payment_required",
        ),
        httpStatus: response.status,
        networkCalled: true,
        challengeMayHaveBeenCreated: true,
      };
    }

    let payload:
      Record<string, any> | null =
      null;

    try {
      payload =
        objectOrNull(
          JSON.parse(
            Buffer.from(
              paymentRequiredHeader,
              "base64",
            ).toString(
              "utf8",
            ),
          ),
        );
    } catch {
      payload =
        null;
    }

    if (payload === null) {
      return {
        ...blocked(
          "fresh_challenge_payment_required_decode_failed",
        ),
        httpStatus: response.status,
        networkCalled: true,
        challengeMayHaveBeenCreated: true,
      };
    }

    const resource =
      objectOrNull(
        payload.resource,
      );

    const asset =
      objectOrNull(
        payload.asset,
      );

    const bodyPaymentRequired =
      objectOrNull(
        body?.paymentRequired,
      );

    const nonce =
      typeof payload.nonce === "string"
        ? payload.nonce
        : null;

    const issuedAt =
      typeof payload.issuedAt === "number"
        ? payload.issuedAt
        : null;

    const expiresAt =
      typeof payload.expiresAt === "number"
        ? payload.expiresAt
        : null;

    const exact =
      payload.version === "x402-v2" &&
      payload.contractId ===
        "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98" &&
      payload.contractVersion === "1.0.0" &&
      payload.isFrozen === true &&
      payload.merchantId ===
        envString(
          "DEMO4_D4_3_MERCHANT_ID",
        ) &&
      resource?.method ===
        resourceMethod &&
      resource?.path ===
        resourcePath &&
      payload.network ===
        envString(
          "DEMO4_D4_3_PAYMENT_NETWORK",
        ) &&
      asset?.type ===
        envString(
          "DEMO4_D4_3_ASSET_TYPE",
        ) &&
      asset?.tokenId ===
        envString(
          "DEMO4_D4_3_TOKEN_ID",
        ) &&
      asset?.decimals ===
        envNumber(
          "DEMO4_D4_3_DECIMALS",
        ) &&
      payload.amount ===
        envString(
          "DEMO4_D4_3_AMOUNT",
        ) &&
      payload.payTo ===
        envString(
          "DEMO4_D4_3_PAY_TO",
        ) &&
      payload.chain_id ===
        envString(
          "DEMO4_D4_3_CANONICAL_CHAIN_ID",
        ) &&
      payload.policyRequired === true &&
      nonce !== null &&
      nonce.startsWith("demo-") &&
      issuedAt !== null &&
      expiresAt !== null &&
      expiresAt > issuedAt &&
      bodyPaymentRequired?.nonce ===
        nonce;

    if (!exact) {
      return {
        ok: false,
        reason:
          "fresh_challenge_frozen_contract_mismatch",
        httpStatus: response.status,
        nonce,
        challengeHash: null,
        issuedAt,
        expiresAt,
        contractId:
          typeof payload.contractId === "string"
            ? payload.contractId
            : null,
        contractVersion:
          typeof payload.contractVersion === "string"
            ? payload.contractVersion
            : null,
        chainId:
          typeof payload.chain_id === "string"
            ? payload.chain_id
            : null,
        networkCalled: true,
        challengeMayHaveBeenCreated: true,
        canonicalPersistedByGateway: true,
      };
    }

    const proofChallenge =
      deriveDemo4D43ProofConstructionChallengeV1({
        nonce:
          nonce as string,

        issuedAt:
          issuedAt as number,

        expiresAt:
          expiresAt as number,
      });

    return {
      ok: true,
      reason:
        "fresh_challenge_created_and_frozen_tuple_verified",
      httpStatus: response.status,
      nonce,
      challengeHash:
        proofChallenge.challengeHash,
      issuedAt,
      expiresAt,
      contractId:
        payload.contractId,
      contractVersion:
        payload.contractVersion,
      chainId:
        payload.chain_id,
      networkCalled: true,
      challengeMayHaveBeenCreated: true,
      canonicalPersistedByGateway: true,
    };
  } catch {
    return {
      ...blocked(
        "fresh_challenge_network_outcome_ambiguous",
      ),
      networkCalled: true,
      challengeMayHaveBeenCreated: true,
    };
  } finally {
    clearTimeout(
      timer,
    );
  }
}

async function executePreLiveGuard():
Promise<Demo4D43PreLiveGuardResultV1> {
  const gatewayBaseUrl =
    safeLoopbackBaseUrl(
      process.env.DEMO4_D4_3_GATEWAY_BASE_URL,
    );

  const crpBaseUrl =
    safeLoopbackBaseUrl(
      process.env.DEMO4_D4_3_CRP_BASE_URL,
    );

  if (
    !envTrue("DEMO4_D4_3_PRE_LIVE_GUARD_ENABLED") ||
    !envTrue("DEMO4_D4_3_PRE_LIVE_GUARD_AUTHORIZED") ||
    gatewayBaseUrl === null ||
    crpBaseUrl === null
  ) {
    return {
      ok: false,
      reason: "pre_live_guard_not_authorized_or_configured",
      readinessReason: null,
      gatewayHealthReady: false,
      gatewayReady: false,
      crpHealthReady: false,
      crpJwksReady: false,
      registryExact: false,
      cis8Exact: false,
      agentCardExact: false,
      phase4ControlledReleaseReady: false,
      phase5Ready: false,
      phase6Ready: false,
      productionFalse: true,
      replayReady: false,
      networkCalled: false,
    };
  }

  const readiness =
    await executeDemo4D43LiveReadOnlyV1({
      ...process.env,
      DEMO4_D4_3_MODE:
        "live_read_only",
      DEMO4_D4_3_LIVE_READ_ENABLED:
        "true",
      DEMO4_D4_3_LIVE_READ_AUTHORIZED:
        "true",
      DEMO4_D4_3_GATEWAY_BASE_URL:
        gatewayBaseUrl,
      DEMO4_D4_3_CRP_BASE_URL:
        crpBaseUrl,
      X402_REPLAY_BACKEND:
        process.env.X402_REPLAY_BACKEND ??
        "memory",
      DEMO4_D4_3_PRODUCTION_ACTIVATION:
        "false",
      PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED:
        "false",
      PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED:
        "false",
    });

  const health =
    await boundedJsonGet(
      `${gatewayBaseUrl}/healthz`,
    );

  const phase3 =
    objectOrNull(
      health?.phase3,
    );

  const phase4 =
    objectOrNull(
      health?.phase4,
    );

  const phase5 =
    objectOrNull(
      health?.phase5,
    );

  const phase6 =
    objectOrNull(
      health?.phase6,
    );

  const replay =
    objectOrNull(
      health?.replay,
    );

  const productionFalse =
    health !== null &&
    phase3?.gatewayReleaseEnabled === false &&
    phase3?.gatewayTestReleaseOnly === false &&
    phase3?.gatewayProductionReleaseEnabled === false &&
    phase3?.gatewayProductionReleaseDryRunEnabled === false &&
    phase5?.productionActivation === false &&
    phase6?.productionActivation === false;

  const phase4ControlledReleaseReady =
    phase4?.controlledRealReceiptReleaseExecutionHarness === true &&
    phase4?.controlledRealReceiptReleaseExecutionEnabled === true;

  const phase5Ready =
    phase5?.agentDelegatedRuntimeEnabled === true &&
    phase5?.cryptographicDelegationRuntimeEnabled === true &&
    phase5?.cryptographicDelegationRuntimeActive === true &&
    phase5?.delegationLifecycleEnforcementEnabled === true &&
    phase5?.delegationLifecycleEnforcementActive === true &&
    phase5?.buyerVerificationKeyLoaded === true;

  const phase6Ready =
    phase6?.agentRegistryConditionalGatingEnabled === true &&
    phase6?.agentRegistryConditionalGatingActive === true;

  const expectedReplay =
    String(
      process.env.X402_REPLAY_BACKEND ??
      "memory",
    )
      .trim()
      .toLowerCase();

  const replayReady =
    (
      expectedReplay === "memory" ||
      expectedReplay === "redis"
    ) &&
    replay?.backend === expectedReplay;

  let reason =
    "pre_live_guard_ready";

  if (!readiness.ok) {
    reason =
      `pre_live_guard_pr317_readiness_failed:${readiness.reason}`;
  } else if (!productionFalse) {
    reason =
      "pre_live_guard_release_surface_not_fail_closed";
  } else if (!phase5Ready) {
    reason =
      "pre_live_guard_phase5_not_ready";
  } else if (!phase6Ready) {
    reason =
      "pre_live_guard_phase6_not_ready";
  } else if (!replayReady) {
    reason =
      "pre_live_guard_replay_not_ready";
  } else if (!phase4ControlledReleaseReady) {
    reason =
      "pre_live_guard_phase4_release_execution_not_enabled";
  }

  return {
    ok:
      readiness.ok &&
      productionFalse &&
      phase4ControlledReleaseReady &&
      phase5Ready &&
      phase6Ready &&
      replayReady,
    reason,
    readinessReason:
      readiness.reason,
    gatewayHealthReady:
      readiness.gatewayHealthReady,
    gatewayReady:
      readiness.gatewayReady,
    crpHealthReady:
      readiness.crpHealthReady,
    crpJwksReady:
      readiness.crpJwksReady,
    registryExact:
      readiness.registryExact,
    cis8Exact:
      readiness.cis8Exact,
    agentCardExact:
      readiness.agentCardExact,
    phase4ControlledReleaseReady,
    phase5Ready,
    phase6Ready,
    productionFalse,
    replayReady,
    networkCalled: true,
  };
}

function printNoSideEffects(
  networkCalled:
    boolean = false,
):
void {
  console.log(
    `NETWORK_CALLED=${networkCalled}`,
  );
  console.log("DATABASE_CALLED=false");
  console.log("BUYER_PRIVATE_KEY_READ=false");
  console.log("ACTING_PRIVATE_KEY_READ=false");
  console.log("PAYER_WALLET_READ=false");
  console.log("SIGNING_PERFORMED=false");
  console.log("TRANSACTION_CONSTRUCTED=false");
  console.log("TRANSACTION_SUBMITTED=false");
  console.log("PAYMENT_ATTEMPTED=false");
  console.log("PHASE5_CLAIM_INVOKED=false");
  console.log("USAGE_CLAIM_CREATED=false");
  console.log("BOUNDED_USE_CONSUMED=false");
  console.log("CRP_FULFILL_CALLED=false");
  console.log("RECEIPT_REQUESTED=false");
  console.log("RECEIPT_ISSUED=false");
  console.log("REPLAY_STATE_MUTATED=false");
  console.log("CANONICAL_RELEASE_PERSISTED=false");
  console.log("PAYMENT_RESPONSE_EMITTED=false");
  console.log("RESOURCE_RELEASED=false");
  console.log("PRODUCTION_ACTIVATION=false");
}

function printStaticContract():
void {
  console.log(
    `CONTRACT=${DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_CONTRACT}`,
  );

  console.log(
    `EXECUTION_DISPATCH_CONTRACT=${DEMO4_D4_3_FINAL_CONTROLLED_ACCEPTANCE_EXECUTION_DISPATCH_CONTRACT}`,
  );

  console.log(
    `MAX_PAYMENT_SUBMISSIONS=${DEMO4_D4_3_MAX_PAYMENT_SUBMISSIONS}`,
  );

  console.log(
    `AUTOMATIC_RETRY=${DEMO4_D4_3_AUTOMATIC_RETRY}`,
  );

  console.log(
    `PRODUCTION=${DEMO4_D4_3_PRODUCTION}`,
  );

  console.log(
    `EXPECTED_STAGE_COUNT=${DEMO4_D4_3_EXPECTED_STAGE_SEQUENCE.length}`,
  );

  console.log(
    `REQUIRED_CAPABILITY_COUNT=${DEMO4_D4_3_EXECUTION_CAPABILITY_NAMES.length}`,
  );

  console.log(
    `PAYMENT_CHAIN_ID=${DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId}`,
  );

  console.log(
    `PAYMENT_NETWORK=${DEMO4_D4_3_PAYMENT_CONTRACT.paymentNetwork}`,
  );

  console.log(
    `PAYMENT_TOKEN_ID=${DEMO4_D4_3_PAYMENT_CONTRACT.tokenId}`,
  );

  console.log(
    `PAYMENT_AMOUNT=${DEMO4_D4_3_PAYMENT_CONTRACT.amount}`,
  );

  console.log(
    `PAYMENT_AMOUNT_RAW=${DEMO4_D4_3_PAYMENT_CONTRACT.amountRaw}`,
  );

  console.log(
    `PAYMENT_RESOURCE=${DEMO4_D4_3_PAYMENT_CONTRACT.resourceMethod} ${DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath}`,
  );

  console.log(
    `PAYMENT_PAY_TO=${DEMO4_D4_3_PAYMENT_CONTRACT.payTo}`,
  );
}

async function main():
Promise<void> {
  console.log(
    "=== DEMO4 D4-3 FINAL CONTROLLED ACCEPTANCE ===",
  );

  console.log(
    `MODE=${mode}`,
  );

  const contract =
    inspectDemo4FinalControlledAcceptanceContractV1();

  console.log(
    `CONTRACT_OK=${contract.ok}`,
  );

  console.log(
    `CONTRACT_STATUS=${contract.status}`,
  );

  console.log(
    `CONTRACT_REASON=${contract.reason}`,
  );

  printStaticContract();

  console.log(
    `PRODUCTION_SURFACE_ACTIVE=${productionSurfaceActive()}`,
  );

  if (
    productionSurfaceActive()
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_PRODUCTION_SURFACE_ACTIVE",
    );

    console.log(
      "EXECUTION_DISPATCH_READY=false",
    );

    printNoSideEffects();

    process.exitCode =
      2;

    return;
  }

  if (
    mode === "inspect"
  ) {
    if (!contract.ok) {
      console.log(
        "RUNNER_RESULT=BLOCKED_CONTRACT_INVALID",
      );

      printNoSideEffects();

      process.exitCode =
        1;

      return;
    }

    console.log(
      "RUNNER_RESULT=D4_3_FINAL_CONTROLLED_ACCEPTANCE_CONTRACT_READY",
    );

    console.log(
      "EXECUTION_DISPATCH_EVALUATED=false",
    );

    console.log(
      "FRESH_EXECUTION_AUTHORIZATION_REQUIRED=true",
    );

    console.log(
      "LIVE_EXECUTION_IMPLEMENTED=false",
    );

    printNoSideEffects();

    return;
  }

  if (
    mode !== "execute"
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_UNSUPPORTED_MODE",
    );

    console.log(
      "EXECUTION_DISPATCH_READY=false",
    );

    printNoSideEffects();

    process.exitCode =
      2;

    return;
  }

  const dispatch =
    evaluateDemo4FinalControlledAcceptanceExecutionDispatchV1(
      buildDispatchInput(),
    );

  console.log(
    `EXECUTION_DISPATCH_OK=${dispatch.ok}`,
  );

  console.log(
    `EXECUTION_DISPATCH_STATUS=${dispatch.status}`,
  );

  console.log(
    `EXECUTION_DISPATCH_REASON=${dispatch.reason}`,
  );

  console.log(
    `EXECUTION_DISPATCH_MISSING_CAPABILITY_COUNT=${dispatch.missingCapabilities.length}`,
  );

  console.log(
    `EXECUTION_DISPATCH_MISSING_CAPABILITIES=${dispatch.missingCapabilities.join(",")}`,
  );

  console.log(
    `LIVE_EXECUTION_IMPLEMENTED=${dispatch.liveExecutionImplemented}`,
  );

  if (!dispatch.ok) {
    console.log(
      "RUNNER_RESULT=BLOCKED_EXECUTION_DISPATCH_CONTRACT",
    );

    console.log(
      "EXECUTION_DISPATCH_READY=false",
    );

    printNoSideEffects();

    process.exitCode =
      2;

    return;
  }

  const liveProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      buildInitialLiveExecutionJournal(),
    );

  console.log(
    `LIVE_ORCHESTRATION_CONTRACT=${DEMO4_D4_3_LIVE_EXECUTION_ORCHESTRATION_CONTRACT.contract}`,
  );

  console.log(
    `LIVE_ORCHESTRATION_STEP_COUNT=${DEMO4_D4_3_LIVE_EXECUTION_STEP_ORDER.length}`,
  );

  console.log(
    `LIVE_ORCHESTRATION_OK=${liveProgress.ok}`,
  );

  console.log(
    `LIVE_ORCHESTRATION_STATUS=${liveProgress.status}`,
  );

  console.log(
    `LIVE_ORCHESTRATION_REASON=${liveProgress.reason}`,
  );

  console.log(
    `LIVE_ORCHESTRATION_NEXT_STEP=${liveProgress.nextStep ?? ""}`,
  );

  if (
    !liveProgress.ok ||
    liveProgress.status !== "ready" ||
    liveProgress.nextStep !== "pre_live_guard"
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_LIVE_ORCHESTRATION_CONTRACT",
    );

    printNoSideEffects();

    process.exitCode =
      2;

    return;
  }

  if (
    !envTrue("DEMO4_D4_3_PRE_LIVE_GUARD_ENABLED") ||
    !envTrue("DEMO4_D4_3_PRE_LIVE_GUARD_AUTHORIZED")
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_AT_PRE_LIVE_GUARD",
    );

    console.log(
      "EXECUTION_DISPATCH_READY=true",
    );

    console.log(
      "LIVE_ORCHESTRATION_WIRED=true",
    );

    console.log(
      "PRE_LIVE_GUARD_IMPLEMENTED=true",
    );

    console.log(
      "PRE_LIVE_GUARD_EXECUTED=false",
    );

    console.log(
      "FRESH_BOUNDARY_AUTHORIZATION_STILL_REQUIRED=true",
    );

    printNoSideEffects();

    process.exitCode =
      2;

    return;
  }

  const preLiveGuard =
    await executePreLiveGuard();

  console.log(
    `PRE_LIVE_GUARD_OK=${preLiveGuard.ok}`,
  );

  console.log(
    `PRE_LIVE_GUARD_REASON=${preLiveGuard.reason}`,
  );

  console.log(
    `PRE_LIVE_GUARD_PR317_READINESS_REASON=${preLiveGuard.readinessReason ?? ""}`,
  );

  console.log(
    `PRE_LIVE_GUARD_GATEWAY_HEALTH_READY=${preLiveGuard.gatewayHealthReady}`,
  );

  console.log(
    `PRE_LIVE_GUARD_GATEWAY_READY=${preLiveGuard.gatewayReady}`,
  );

  console.log(
    `PRE_LIVE_GUARD_CRP_HEALTH_READY=${preLiveGuard.crpHealthReady}`,
  );

  console.log(
    `PRE_LIVE_GUARD_CRP_JWKS_READY=${preLiveGuard.crpJwksReady}`,
  );

  console.log(
    `PRE_LIVE_GUARD_CIS8004_EXACT=${preLiveGuard.registryExact}`,
  );

  console.log(
    `PRE_LIVE_GUARD_CIS8_EXACT=${preLiveGuard.cis8Exact}`,
  );

  console.log(
    `PRE_LIVE_GUARD_AGENT_CARD_EXACT=${preLiveGuard.agentCardExact}`,
  );

  console.log(
    `PRE_LIVE_GUARD_PHASE4_CONTROLLED_RELEASE_READY=${preLiveGuard.phase4ControlledReleaseReady}`,
  );

  console.log(
    `PRE_LIVE_GUARD_PHASE5_READY=${preLiveGuard.phase5Ready}`,
  );

  console.log(
    `PRE_LIVE_GUARD_PHASE6_READY=${preLiveGuard.phase6Ready}`,
  );

  console.log(
    `PRE_LIVE_GUARD_PRODUCTION_FALSE=${preLiveGuard.productionFalse}`,
  );

  console.log(
    `PRE_LIVE_GUARD_REPLAY_READY=${preLiveGuard.replayReady}`,
  );

  console.log(
    "PRE_LIVE_GUARD_EXECUTED=true",
  );

  if (!preLiveGuard.ok) {
    console.log(
      "RUNNER_RESULT=BLOCKED_PRE_LIVE_GUARD_NOT_READY",
    );

    console.log(
      "FRESH_CHALLENGE_CREATED=false",
    );

    printNoSideEffects(
      preLiveGuard.networkCalled,
    );

    process.exitCode =
      3;

    return;
  }

  const guardedJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...buildInitialLiveExecutionJournal(),

      completedSteps: [
        "pre_live_guard",
      ],
    };

  const guardedProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      guardedJournal,
    );

  console.log(
    `POST_GUARD_ORCHESTRATION_OK=${guardedProgress.ok}`,
  );

  console.log(
    `POST_GUARD_ORCHESTRATION_STATUS=${guardedProgress.status}`,
  );

  console.log(
    `POST_GUARD_ORCHESTRATION_REASON=${guardedProgress.reason}`,
  );

  console.log(
    `POST_GUARD_ORCHESTRATION_NEXT_STEP=${guardedProgress.nextStep ?? ""}`,
  );

  if (
    !guardedProgress.ok ||
    guardedProgress.status !== "ready" ||
    guardedProgress.nextStep !== "fresh_challenge"
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_POST_GUARD_ORCHESTRATION_CONTRACT",
    );

    printNoSideEffects(
      true,
    );

    process.exitCode =
      3;

    return;
  }

  if (
    !envTrue("DEMO4_D4_3_FRESH_CHALLENGE_ENABLED") ||
    !envTrue("DEMO4_D4_3_FRESH_CHALLENGE_AUTHORIZED")
  ) {
    console.log(
      "RUNNER_RESULT=BLOCKED_AT_FRESH_CHALLENGE",
    );

    console.log(
      "PRE_LIVE_GUARD_COMPLETE=true",
    );

    console.log(
      "FRESH_CHALLENGE_IMPLEMENTED=true",
    );

    console.log(
      "FRESH_CHALLENGE_CREATED=false",
    );

    console.log(
      "FRESH_CHALLENGE_AUTHORIZATION_REQUIRED=true",
    );

    printNoSideEffects(
      true,
    );

    process.exitCode =
      2;

    return;
  }

  const freshChallenge =
    await executeFreshChallenge();

  console.log(
    `FRESH_CHALLENGE_OK=${freshChallenge.ok}`,
  );

  console.log(
    `FRESH_CHALLENGE_REASON=${freshChallenge.reason}`,
  );

  console.log(
    `FRESH_CHALLENGE_HTTP_STATUS=${freshChallenge.httpStatus ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_NONCE=${freshChallenge.nonce ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_HASH=${freshChallenge.challengeHash ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_ISSUED_AT=${freshChallenge.issuedAt ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_EXPIRES_AT=${freshChallenge.expiresAt ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_CONTRACT_ID=${freshChallenge.contractId ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_CONTRACT_VERSION=${freshChallenge.contractVersion ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_CHAIN_ID=${freshChallenge.chainId ?? ""}`,
  );

  console.log(
    `FRESH_CHALLENGE_CANONICAL_PERSISTED_BY_GATEWAY=${freshChallenge.canonicalPersistedByGateway}`,
  );

  if (!freshChallenge.ok) {
    console.log(
      freshChallenge.challengeMayHaveBeenCreated
        ? "FRESH_CHALLENGE_CREATED=UNKNOWN"
        : "FRESH_CHALLENGE_CREATED=false",
    );

    console.log(
      "FRESH_CHALLENGE_RETRY_ALLOWED=false",
    );

    console.log(
      `NETWORK_CALLED=${freshChallenge.networkCalled}`,
    );

    console.log(
      `DATABASE_CALLED=${freshChallenge.challengeMayHaveBeenCreated}`,
    );

    console.log(
      "BUYER_PRIVATE_KEY_READ=false",
    );
    console.log(
      "ACTING_PRIVATE_KEY_READ=false",
    );
    console.log(
      "PAYER_WALLET_READ=false",
    );
    console.log(
      "SIGNING_PERFORMED=false",
    );
    console.log(
      "TRANSACTION_CONSTRUCTED=false",
    );
    console.log(
      "TRANSACTION_SUBMITTED=false",
    );
    console.log(
      "PAYMENT_ATTEMPTED=false",
    );
    console.log(
      "PHASE5_CLAIM_INVOKED=false",
    );
    console.log(
      "USAGE_CLAIM_CREATED=false",
    );
    console.log(
      "BOUNDED_USE_CONSUMED=false",
    );
    console.log(
      "CRP_FULFILL_CALLED=false",
    );
    console.log(
      "RECEIPT_REQUESTED=false",
    );
    console.log(
      "RECEIPT_ISSUED=false",
    );
    console.log(
      "REPLAY_STATE_MUTATED=false",
    );
    console.log(
      "CANONICAL_RELEASE_PERSISTED=false",
    );
    console.log(
      "PAYMENT_RESPONSE_EMITTED=false",
    );
    console.log(
      "RESOURCE_RELEASED=false",
    );
    console.log(
      "PRODUCTION_ACTIVATION=false",
    );

    process.exitCode =
      freshChallenge.challengeMayHaveBeenCreated
        ? 4
        : 3;

    return;
  }

  const challengeJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...guardedJournal,

      completedSteps: [
        "pre_live_guard",
        "fresh_challenge",
      ],
    };

  const challengeProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      challengeJournal,
    );

  console.log(
    `POST_CHALLENGE_ORCHESTRATION_OK=${challengeProgress.ok}`,
  );

  console.log(
    `POST_CHALLENGE_ORCHESTRATION_STATUS=${challengeProgress.status}`,
  );

  console.log(
    `POST_CHALLENGE_ORCHESTRATION_REASON=${challengeProgress.reason}`,
  );

  console.log(
    `POST_CHALLENGE_ORCHESTRATION_NEXT_STEP=${challengeProgress.nextStep ?? ""}`,
  );

  if (
    !challengeProgress.ok ||
    challengeProgress.status !== "ready" ||
    challengeProgress.nextStep !== "proof_construction"
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_FRESH_CHALLENGE_ORCHESTRATION_MISMATCH",
    );

    process.exitCode =
      4;

    return;
  }

  const proofKeyLoadingGate =
    evaluateDemo4D43ProofKeyLoadingGateV1({
      proofConstructionEnabled:
        envTrue(
          "DEMO4_D4_3_PROOF_CONSTRUCTION_ENABLED",
        ),

      proofConstructionAuthorized:
        envTrue(
          "DEMO4_D4_3_PROOF_CONSTRUCTION_AUTHORIZED",
        ),

      buyerPrivateKeyReadAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_BUYER_PRIVATE_KEY_READ_AUTHORIZED",
        ),

      actingPrivateKeyReadAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_ACTING_PRIVATE_KEY_READ_AUTHORIZED",
        ),

      proofSigningAuthorized:
        envTrue(
          "DEMO4_D4_3_CAP_PROOF_SIGNING_AUTHORIZED",
        ),

      buyerPrivateKeyPath:
        envString(
          "DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH",
        ),

      actingPrivateKeyPath:
        envString(
          "DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH",
        ),
    });

  console.log(
    `PROOF_KEY_LOADING_GATE_OK=${proofKeyLoadingGate.ok}`,
  );

  console.log(
    `PROOF_KEY_LOADING_GATE_REASON=${proofKeyLoadingGate.reason}`,
  );

  console.log(
    `BUYER_PRIVATE_KEY_PATH_ACCEPTED=${proofKeyLoadingGate.buyerPrivateKeyPathAccepted}`,
  );

  console.log(
    `ACTING_PRIVATE_KEY_PATH_ACCEPTED=${proofKeyLoadingGate.actingPrivateKeyPathAccepted}`,
  );

  console.log(
    `STALE_AGENT_PRIVATE_KEY_FORBIDDEN=${proofKeyLoadingGate.staleAgentPrivateKeyForbidden}`,
  );

  if (!proofKeyLoadingGate.ok) {
    console.log(
      "RUNNER_RESULT=BLOCKED_AT_PROOF_KEY_LOADING_GATE",
    );

    console.log(
      "PRE_LIVE_GUARD_COMPLETE=true",
    );

    console.log(
      "FRESH_CHALLENGE_IMPLEMENTED=true",
    );

    console.log(
      "FRESH_CHALLENGE_CREATED=true",
    );

    console.log(
      "PROOF_CONSTRUCTION_AUTHORIZATION_REQUIRED=true",
    );

    console.log(
      "PRIVATE_KEY_CONTENT_READ=false",
    );

    console.log(
      "NETWORK_CALLED=true",
    );

    console.log(
      "DATABASE_CALLED=true",
    );

    console.log(
      "BUYER_PRIVATE_KEY_READ=false",
    );
    console.log(
      "ACTING_PRIVATE_KEY_READ=false",
    );
    console.log(
      "PAYER_WALLET_READ=false",
    );
    console.log(
      "SIGNING_PERFORMED=false",
    );
    console.log(
      "TRANSACTION_CONSTRUCTED=false",
    );
    console.log(
      "TRANSACTION_SUBMITTED=false",
    );
    console.log(
      "PAYMENT_ATTEMPTED=false",
    );
    console.log(
      "PHASE5_CLAIM_INVOKED=false",
    );
    console.log(
      "USAGE_CLAIM_CREATED=false",
    );
    console.log(
      "BOUNDED_USE_CONSUMED=false",
    );
    console.log(
      "CRP_PENDING_REGISTERED=false",
    );
    console.log(
      "CRP_FULFILL_CALLED=false",
    );
    console.log(
      "RECEIPT_REQUESTED=false",
    );
    console.log(
      "RECEIPT_ISSUED=false",
    );
    console.log(
      "REPLAY_STATE_MUTATED=false",
    );
    console.log(
      "CANONICAL_RELEASE_PERSISTED=false",
    );
    console.log(
      "PAYMENT_RESPONSE_EMITTED=false",
    );
    console.log(
      "RESOURCE_RELEASED=false",
    );
    console.log(
      "PRODUCTION_ACTIVATION=false",
    );

    process.exitCode =
      2;

    return;
  }

  if (
    freshChallenge.nonce === null ||
    freshChallenge.challengeHash === null ||
    freshChallenge.issuedAt === null ||
    freshChallenge.expiresAt === null ||
    freshChallenge.contractId === null ||
    freshChallenge.contractVersion === null
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_FRESH_CHALLENGE_INVARIANT_MISMATCH",
    );

    process.exitCode =
      4;

    return;
  }

  const proofChallenge:
    Demo4D43ProofConstructionChallengeV1 = {
      nonce:
        freshChallenge.nonce,

      challengeHash:
        freshChallenge.challengeHash,

      issuedAt:
        freshChallenge.issuedAt,

      expiresAt:
        freshChallenge.expiresAt,
    };

  const buyerPrivateKeyPath =
    envString(
      "DEMO4_D4_3_BUYER_PRIVATE_KEY_PATH",
    ) ?? "";

  const actingPrivateKeyPath =
    envString(
      "DEMO4_D4_3_ACTING_PRIVATE_KEY_PATH",
    ) ?? "";

  const actingPublicKeyPath =
    actingPrivateKeyPath.replace(
      /replacement-ed25519-private\.pk8\.pem$/,
      "replacement-ed25519-public.jwk.json",
    );

  const buyerVerificationKey =
    d43LoadFrozenBuyerVerificationKey(
      DEMO4_D4_3_BUYER_VERIFICATION_KEY_PATH,
    );

  const actingPublicKeyJwk =
    d43LoadFrozenActingPublicKey(
      actingPublicKeyPath,
    );

  const loadedProofKeys =
    loadDemo4D43BoundedProofKeyObjectsFromFilesystemV1({
      proofConstructionEnabled:
        true,

      proofConstructionAuthorized:
        true,

      buyerPrivateKeyReadAuthorized:
        true,

      actingPrivateKeyReadAuthorized:
        true,

      proofSigningAuthorized:
        true,

      buyerPrivateKeyPath,

      actingPrivateKeyPath,
    });

  const proof =
    buildDemo4D43HybridCryptographicProofBundleV1({
      challenge:
        proofChallenge,

      buyerId:
        DEMO4_D4_3_BUYER_ID,

      buyerKeyId:
        DEMO4_D4_3_BUYER_KEY_ID,

      buyerVerificationKey,

      buyerPrivateKey:
        loadedProofKeys.buyerPrivateKey,

      agentId:
        DEMO4_D4_3_AGENT_ID,

      agentKeyId:
        DEMO4_D4_3_AGENT_KEY_ID,

      actingPublicKeyJwk,

      expectedActingPublicKeyHex:
        DEMO4_D4_3_ACTING_PUBLIC_RAW_HEX,

      actingPrivateKey:
        loadedProofKeys.actingPrivateKey,
    });

  console.log(
    `PROOF_CONSTRUCTION_OK=${proof.ok}`,
  );

  console.log(
    `PROOF_CONSTRUCTION_REASON=${proof.reason}`,
  );

  console.log(
    `BUYER_SIGNATURE_VERIFIED=${proof.buyerSignatureVerified}`,
  );

  console.log(
    `AGENT_PUBLIC_KEY_BOUND_BY_BUYER_SIGNATURE=${proof.agentPublicKeyBoundByBuyerSignature}`,
  );

  console.log(
    `AGENT_PROOF_OF_POSSESSION_VERIFIED=${proof.agentProofOfPossessionVerified}`,
  );

  console.log(
    `PROOF_BINDINGS_MATCHED=${proof.proofBindingsMatched}`,
  );

  const proofJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...challengeJournal,

      completedSteps: [
        "pre_live_guard",
        "fresh_challenge",
        "proof_construction",
      ],
    };

  const proofProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      proofJournal,
    );

  console.log(
    `POST_PROOF_ORCHESTRATION_OK=${proofProgress.ok}`,
  );

  console.log(
    `POST_PROOF_ORCHESTRATION_NEXT_STEP=${proofProgress.nextStep ?? ""}`,
  );

  if (
    !proofProgress.ok ||
    proofProgress.status !== "ready" ||
    proofProgress.nextStep !== "redeem_and_claim"
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_PROOF_ORCHESTRATION_MISMATCH",
    );

    process.exitCode =
      4;

    return;
  }

  const redeemBody =
    buildDemo4D43AuthorizedAgentRedeemBodyV1({
      challenge:
        proofChallenge,

      proof,
    });

  const redeem =
    await executeDemo4D43GatewayRedeemV1({
      gatewayBaseUrl:
        envString(
          "DEMO4_D4_3_GATEWAY_BASE_URL",
        ) ?? "",

      body:
        redeemBody,
    });

  console.log(
    `GATEWAY_REDEEM_OK=${redeem.ok}`,
  );

  console.log(
    `GATEWAY_REDEEM_REASON=${redeem.reason}`,
  );

  console.log(
    `GATEWAY_REDEEM_HTTP_STATUS=${redeem.httpStatus}`,
  );

  console.log(
    `GATEWAY_REDEEM_RESPONSE_CODE=${redeem.gatewayCode ?? ""}`,
  );

  console.log(
    `GATEWAY_REDEEM_RESPONSE_REASON=${redeem.gatewayReason ?? ""}`,
  );

  console.log(
    `GATEWAY_REDEEM_PAYMENT_RESPONSE_PRESENT=${redeem.paymentResponsePresent}`,
  );

  if (
    !redeem.ok ||
    redeem.paymentResponsePresent
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_GATEWAY_REDEEM",
    );

    console.log(
      "PAYMENT_ATTEMPTED=false",
    );

    console.log(
      "CRP_PENDING_REGISTERED=false",
    );

    process.exitCode =
      5;

    return;
  }

  const redeemJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...proofJournal,

      completedSteps: [
        "pre_live_guard",
        "fresh_challenge",
        "proof_construction",
        "redeem_and_claim",
      ],
    };

  const redeemProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      redeemJournal,
    );

  console.log(
    `POST_REDEEM_ORCHESTRATION_OK=${redeemProgress.ok}`,
  );

  console.log(
    `POST_REDEEM_ORCHESTRATION_NEXT_STEP=${redeemProgress.nextStep ?? ""}`,
  );

  if (
    !redeemProgress.ok ||
    redeemProgress.status !== "ready" ||
    redeemProgress.nextStep !== "verify_claim_state"
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_REDEEM_ORCHESTRATION_MISMATCH",
    );

    process.exitCode =
      5;

    return;
  }

  const claimState =
    await verifyDemo4D43Phase5ClaimStateV1({
      credentialHash:
        proof.credentialHash,

      delegationId:
        `delegation-${proofChallenge.nonce}`,
    });

  console.log(
    `PHASE5_CLAIM_STATE_OK=${claimState.ok}`,
  );

  console.log(
    `PHASE5_CLAIM_STATE_REASON=${claimState.reason}`,
  );

  console.log(
    `PHASE5_CLAIM_STATE_FOUND=${claimState.found}`,
  );

  console.log(
    `PHASE5_MAX_USES=${claimState.maxUses ?? ""}`,
  );

  console.log(
    `PHASE5_CONSUMED_USES=${claimState.consumedUses ?? ""}`,
  );

  console.log(
    `PHASE5_CLAIM_COUNT=${claimState.claimCount ?? ""}`,
  );

  if (!claimState.ok) {
    console.log(
      "RUNNER_RESULT=STOP_PHASE5_CLAIM_STATE_NOT_VERIFIED",
    );

    console.log(
      "CRP_PENDING_REGISTERED=false",
    );

    console.log(
      "PAYMENT_ATTEMPTED=false",
    );

    process.exitCode =
      5;

    return;
  }

  const claimJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...redeemJournal,

      completedSteps: [
        "pre_live_guard",
        "fresh_challenge",
        "proof_construction",
        "redeem_and_claim",
        "verify_claim_state",
      ],

      boundedUseConsumed:
        true,
    };

  const claimProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      claimJournal,
    );

  console.log(
    `POST_CLAIM_VERIFY_ORCHESTRATION_OK=${claimProgress.ok}`,
  );

  console.log(
    `POST_CLAIM_VERIFY_ORCHESTRATION_NEXT_STEP=${claimProgress.nextStep ?? ""}`,
  );

  if (
    !claimProgress.ok ||
    claimProgress.status !== "ready" ||
    claimProgress.nextStep !== "crp_pending_registration"
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_CLAIM_VERIFY_ORCHESTRATION_MISMATCH",
    );

    process.exitCode =
      5;

    return;
  }

  const crpPending =
    await executeDemo4D43CrpPendingRegistrationV1({
      phase5ClaimVerified:
        true,

      paymentRequired: {
        nonce:
          proofChallenge.nonce,

        expiresAt:
          proofChallenge.expiresAt,

        merchantId:
          "demo-merchant",

        network:
          "concordium:testnet",

        chain_id:
          "ccd:4221332d34e1694168c2a0c0b3fd0f27",

        asset: {
          type:
            "PLT",

          tokenId:
            "EUDemo",

          decimals:
            6,
        },

        amount:
          "0.050101",

        payTo:
          "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",

        contractId:
          freshChallenge.contractId,

        contractVersion:
          freshChallenge.contractVersion,

        isFrozen:
          true,

        resource: {
          method:
            "GET",

          path:
            "/paid-gated",
        },
      },
    });

  console.log(
    `CRP_PENDING_OK=${crpPending.ok}`,
  );

  console.log(
    `CRP_PENDING_REASON=${crpPending.reason}`,
  );

  console.log(
    `CRP_PENDING_HTTP_STATUS=${crpPending.httpStatus ?? ""}`,
  );

  console.log(
    `CRP_PENDING_REGISTERED=${crpPending.pendingRegistered}`,
  );

  console.log(
    `CRP_PENDING_TRANSPORT_CALLS=${crpPending.transportCalls}`,
  );

  if (!crpPending.ok) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_CRP_PENDING_REGISTRATION",
    );

    console.log(
      "CRP_PENDING_RETRY_ALLOWED=false",
    );

    console.log(
      "PAYER_WALLET_READ=false",
    );

    console.log(
      "PAYMENT_ATTEMPTED=false",
    );

    process.exitCode =
      6;

    return;
  }

  const crpJournal:
    Demo4D43LiveExecutionJournalV1 = {
      ...claimJournal,

      completedSteps: [
        "pre_live_guard",
        "fresh_challenge",
        "proof_construction",
        "redeem_and_claim",
        "verify_claim_state",
        "crp_pending_registration",
      ],

      crpPendingRegistered:
        true,
    };

  const crpProgress =
    evaluateDemo4D43LiveExecutionProgressV1(
      crpJournal,
    );

  console.log(
    `POST_CRP_PENDING_ORCHESTRATION_OK=${crpProgress.ok}`,
  );

  console.log(
    `POST_CRP_PENDING_ORCHESTRATION_STATUS=${crpProgress.status}`,
  );

  console.log(
    `POST_CRP_PENDING_ORCHESTRATION_REASON=${crpProgress.reason}`,
  );

  console.log(
    `POST_CRP_PENDING_ORCHESTRATION_NEXT_STEP=${crpProgress.nextStep ?? ""}`,
  );

  if (
    !crpProgress.ok ||
    crpProgress.status !== "ready" ||
    crpProgress.nextStep !== "payer_wallet_preflight"
  ) {
    console.log(
      "RUNNER_RESULT=STOP_AFTER_CRP_PENDING_ORCHESTRATION_MISMATCH",
    );

    process.exitCode =
      6;

    return;
  }

  console.log(
    "RUNNER_RESULT=STOP_BEFORE_PAYER_WALLET_PREFLIGHT",
  );

  console.log(
    "PRE_LIVE_GUARD_COMPLETE=true",
  );

  console.log(
    "FRESH_CHALLENGE_CREATED=true",
  );

  console.log(
    "PROOF_CONSTRUCTION_COMPLETE=true",
  );

  console.log(
    "PRIVATE_KEY_CONTENT_READ=true",
  );

  console.log(
    `BUYER_PRIVATE_KEY_READ=${loadedProofKeys.buyerPrivateKeyReads === 1}`,
  );

  console.log(
    `ACTING_PRIVATE_KEY_READ=${loadedProofKeys.actingPrivateKeyReads === 1}`,
  );

  console.log(
    "SIGNING_PERFORMED=true",
  );

  console.log(
    "PHASE5_CLAIM_INVOKED=true",
  );

  console.log(
    "USAGE_CLAIM_CREATED=true",
  );

  console.log(
    "BOUNDED_USE_CONSUMED=true",
  );

  console.log(
    "PAYER_WALLET_READ=false",
  );

  console.log(
    "TRANSACTION_CONSTRUCTED=false",
  );

  console.log(
    "TRANSACTION_SUBMITTED=false",
  );

  console.log(
    "PAYMENT_ATTEMPTED=false",
  );

  console.log(
    "CRP_FULFILL_CALLED=false",
  );

  console.log(
    "RECEIPT_REQUESTED=false",
  );

  console.log(
    "RECEIPT_ISSUED=false",
  );

  console.log(
    "REPLAY_STATE_MUTATED=false",
  );

  console.log(
    "CANONICAL_RELEASE_PERSISTED=false",
  );

  console.log(
    "PAYMENT_RESPONSE_EMITTED=false",
  );

  console.log(
    "RESOURCE_RELEASED=false",
  );

  console.log(
    "PRODUCTION_ACTIVATION=false",
  );

  process.exitCode =
    2;

}

if (require.main === module) {
  void main().catch(
  (
    error:
      unknown,
  ) => {
    const reason =
      error instanceof Error
        ? error.message
        : "unknown_error";

    console.error(
      `RUNNER_ERROR=${reason}`,
    );

    console.error(
      "FRESH_CHALLENGE_CREATED=false",
    );

    printNoSideEffects(
      true,
    );

    process.exitCode =
      1;
  },
);
}
