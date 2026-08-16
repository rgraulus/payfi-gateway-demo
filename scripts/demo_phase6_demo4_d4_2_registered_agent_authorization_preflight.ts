/**
 * PR #316 — Demo4 D4-2 registered-agent authorization preflight runner.
 *
 * Initial slice: deterministic/offline dispatch lock only.
 *
 * No live registry, CIS-8, Agent Card, database, wallet, signer, contract,
 * transaction, payment, receipt, or resource-release operation is wired here.
 */

import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import process from "node:process";

import {
  DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE,
  evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1,
} from "../src/phase6/demo4RegisteredAgentAuthorizationPreflight";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REQUIREMENT_TYPE,
  AGENT_REGISTRY_REQUIRED_STATUS,
  AGENT_REGISTRY_STANDARD,
  type AgentRegistryRequirementV1,
} from "../src/phase6/agentRegistryTrustContract";

import {
  CONCORDIUM_CIS8004_TRANSPORT_KIND,
  ConcordiumGrpcCis8004ReadTransportV1,
  type ConcordiumCis8004TrustedRegistryConfigV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  CONCORDIUM_CIS8_TRANSPORT_KIND,
  ConcordiumGrpcCis8ReadTransportV1,
  type ConcordiumCis8TrustedConfigV1,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

import {
  HttpsAgentCardFetchTransportV1,
} from "../src/phase6/agentRegistryCardCapabilityFreshness";

import {
  FileContractResolver,
} from "../src/contractResolver";

import {
  getCanonicalChallengeBindingByNonce,
} from "../src/db/gatewayPersistence";

import {
  completePhase5AgentRuntimePolicyEvaluation,
  evaluatePhase5AgentRuntimeCryptographicPreflight,
  type Phase5AgentRuntimeAuthorizationInput,
} from "../src/phase5/agentRuntimeAuthorization";

import {
  evaluatePhase5AgentDelegationLifecycle,
} from "../src/phase5/agentDelegationLifecycle";

import {
  checkPhase5AgentDelegationRevocation,
  getPhase5AgentDelegationUsageSnapshot,
} from "../src/db/phase5AgentDelegationLifecycleStore";

import {
  composeAgentRegistryConditionalGatingV1,
} from "../src/phase6/agentRegistryConditionalGatingComposition";

import {
  persistPhase6AgentRegistryAuthorizationAuditV1,
} from "../src/db/phase6AgentRegistryAuthorizationAuditStore";

import {
  BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,
  type BuyerDelegationVerificationKey,
} from "../src/phase5/buyerDelegationSignatureVerifier";

export const DEMO4_D4_2_RUNNER_TYPE =
  "xcf.phase6.demo4-d4-2-runner" as const;

export const DEMO4_D4_2_RUNNER_VERSION =
  "1.0.0" as const;

export type Demo4D42LiveTransportBundleV1 = {
  readonly registryConfig:
    ConcordiumCis8004TrustedRegistryConfigV1;

  readonly trustedCis8:
    ConcordiumCis8TrustedConfigV1;

  readonly registryTransport:
    ConcordiumGrpcCis8004ReadTransportV1;

  readonly cis8Transport:
    ConcordiumGrpcCis8ReadTransportV1;

  readonly agentCardTransport:
    HttpsAgentCardFetchTransportV1;

  readonly controlledRegistryTransportUsed:
    false;

  readonly controlledCis8TransportUsed:
    false;

  readonly deterministicAgentCardTransportUsed:
    false;

  readonly liveToControlledFallbackAllowed:
    false;

  readonly networkCalled:
    false;

  readonly databaseCalled:
    false;
};

export function buildDemo4D42LiveTransportBundleV1():
Demo4D42LiveTransportBundleV1 {
  const profile =
    DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE;

  const registryConfig:
    ConcordiumCis8004TrustedRegistryConfigV1 =
    Object.freeze({
      network:
        profile.phase6RegistryNetwork,

      registryStandard:
        AGENT_REGISTRY_STANDARD,

      contract:
        Object.freeze({
          index:
            profile.cis8004.contract.index,

          subindex:
            profile.cis8004.contract.subindex,
        }),

      moduleReference:
        profile.cis8004.moduleReference,

      contractName:
        "CIS-8004",

      entrypoint:
        "agentOf",

      grpc:
        Object.freeze({
          host:
            "grpc.testnet.concordium.com",

          port:
            20_000,

          tls:
            true,
        }),

      timeoutMs:
        10_000,

      transport:
        CONCORDIUM_CIS8004_TRANSPORT_KIND,
    });

  const trustedCis8:
    ConcordiumCis8TrustedConfigV1 =
    Object.freeze({
      network:
        profile.phase6RegistryNetwork,

      contract:
        Object.freeze({
          index:
            profile.cis8.contract.index,

          subindex:
            profile.cis8.contract.subindex,
        }),

      moduleReference:
        profile.cis8.moduleReference,

      contractName:
        "CIS-8",

      entrypoint:
        "ownerOfKey",

      grpc:
        Object.freeze({
          host:
            "grpc.testnet.concordium.com",

          port:
            20_000,

          tls:
            true,
        }),

      timeoutMs:
        10_000,

      transport:
        CONCORDIUM_CIS8_TRANSPORT_KIND,
    });

  return Object.freeze({
    registryConfig,

    trustedCis8,

    registryTransport:
      new ConcordiumGrpcCis8004ReadTransportV1(),

    cis8Transport:
      new ConcordiumGrpcCis8ReadTransportV1(),

    agentCardTransport:
      new HttpsAgentCardFetchTransportV1(),

    controlledRegistryTransportUsed:
      false,

    controlledCis8TransportUsed:
      false,

    deterministicAgentCardTransportUsed:
      false,

    liveToControlledFallbackAllowed:
      false,

    networkCalled:
      false,

    databaseCalled:
      false,
  });
}

export const DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH =
  "/paid-gated" as const;

export const DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH =
  "/paid-gated/redeem" as const;

export const DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP =
  "getCanonicalChallengeBindingByNonce" as const;

export const DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY =
  "getPhase5AgentDelegationUsageSnapshot" as const;

export const DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY =
  "claimPhase5AgentDelegationUseAndPersistPolicySatisfied" as const;

export const DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON =
  "gateway_proxy_preclaim_contract_ready" as const;

export type Demo4D42GatewayProxyChallengeProvenanceV1 = {
  readonly source:
    "gateway_proxy";

  readonly gatewayAuthored:
    true;

  readonly resourceMethod:
    "GET";

  readonly resourcePath:
    typeof DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH;

  readonly canonicalLookup:
    typeof DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP;

  readonly canonicalChallengeFound:
    true;

  readonly nonce:
    string;

  readonly challengeId:
    string;
};

export type Demo4D42GatewayProxyRedeemShapeV1 = {
  readonly nonce:
    string;

  readonly authorizationProof:
    unknown;

  readonly agentRegistryReference:
    unknown;
};

export type Demo4D42GatewayProxyPreclaimContractInputV1 = {
  readonly challenge:
    Demo4D42GatewayProxyChallengeProvenanceV1;

  readonly redeemShape:
    Demo4D42GatewayProxyRedeemShapeV1;

  readonly intendedRedeemPath:
    typeof DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH;

  readonly redeemInvocationAllowed:
    false;

  readonly usageBoundary:
    typeof DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY;

  readonly claimBoundary:
    typeof DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY;

  readonly claimInvocationAllowed:
    false;
};

export type Demo4D42GatewayProxyPreclaimContractReasonV1 =
  | typeof DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON
  | "gateway_challenge_provenance_invalid"
  | "redeem_request_shape_invalid"
  | "canonical_nonce_mismatch"
  | "redeem_invocation_not_prohibited"
  | "read_only_usage_boundary_invalid"
  | "phase5_claim_boundary_not_prohibited";

export type Demo4D42GatewayProxyPreclaimContractResultV1 = {
  readonly ok:
    boolean;

  readonly reason:
    Demo4D42GatewayProxyPreclaimContractReasonV1;

  readonly gatewayProxyArchitecturePreserved:
    boolean;

  readonly gatewayAuthoredCanonicalChallengeRequired:
    true;

  readonly redeemRequestShapeValidated:
    boolean;

  readonly intendedRedeemPath:
    typeof DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH;

  readonly redeemInvocationAllowed:
    false;

  readonly redeemInvoked:
    false;

  readonly boundedUseEligibilityReadOnly:
    boolean;

  readonly usageBoundary:
    typeof DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY;

  readonly phase5ClaimInvocationAllowed:
    false;

  readonly phase5ClaimInvoked:
    false;

  readonly liveDispatchAllowed:
    false;

  readonly gatewayCalled:
    false;

  readonly databaseCalled:
    false;

  readonly networkCalled:
    false;

  readonly concordiumTestnetCalled:
    false;

  readonly httpsCalled:
    false;

  readonly policyStateMutated:
    false;

  readonly canonicalStateMutated:
    false;

  readonly usageClaimCreated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly paymentAttempted:
    false;

  readonly receiptRequested:
    false;

  readonly resourceReleased:
    false;

  readonly productionActivation:
    false;
};

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  );
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function gatewayProxyPreclaimResult(
  reason:
    Demo4D42GatewayProxyPreclaimContractReasonV1,

  state: {
    readonly gatewayProxyArchitecturePreserved?:
      boolean;

    readonly redeemRequestShapeValidated?:
      boolean;

    readonly boundedUseEligibilityReadOnly?:
      boolean;
  } = {},
): Demo4D42GatewayProxyPreclaimContractResultV1 {
  return {
    ok:
      reason ===
        DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON,

    reason,

    gatewayProxyArchitecturePreserved:
      state.gatewayProxyArchitecturePreserved ??
      false,

    gatewayAuthoredCanonicalChallengeRequired:
      true,

    redeemRequestShapeValidated:
      state.redeemRequestShapeValidated ??
      false,

    intendedRedeemPath:
      DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH,

    redeemInvocationAllowed:
      false,

    redeemInvoked:
      false,

    boundedUseEligibilityReadOnly:
      state.boundedUseEligibilityReadOnly ??
      false,

    usageBoundary:
      DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY,

    phase5ClaimInvocationAllowed:
      false,

    phase5ClaimInvoked:
      false,

    liveDispatchAllowed:
      false,

    gatewayCalled:
      false,

    databaseCalled:
      false,

    networkCalled:
      false,

    concordiumTestnetCalled:
      false,

    httpsCalled:
      false,

    policyStateMutated:
      false,

    canonicalStateMutated:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    paymentAttempted:
      false,

    receiptRequested:
      false,

    resourceReleased:
      false,

    productionActivation:
      false,
  };
}

export function evaluateDemo4D42GatewayProxyPreclaimContractV1(
  input:
    Demo4D42GatewayProxyPreclaimContractInputV1,
): Demo4D42GatewayProxyPreclaimContractResultV1 {
  const challenge =
    input.challenge;

  const validChallengeProvenance =
    challenge.source ===
      "gateway_proxy" &&
    challenge.gatewayAuthored ===
      true &&
    challenge.resourceMethod ===
      "GET" &&
    challenge.resourcePath ===
      DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH &&
    challenge.canonicalLookup ===
      DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP &&
    challenge.canonicalChallengeFound ===
      true &&
    isNonEmptyString(
      challenge.nonce,
    ) &&
    isNonEmptyString(
      challenge.challengeId,
    );

  if (!validChallengeProvenance) {
    return gatewayProxyPreclaimResult(
      "gateway_challenge_provenance_invalid",
    );
  }

  const redeemShape =
    input.redeemShape;

  const redeemRequestShapeValidated =
    isNonEmptyString(
      redeemShape.nonce,
    ) &&
    isObjectRecord(
      redeemShape.authorizationProof,
    ) &&
    isObjectRecord(
      redeemShape.agentRegistryReference,
    );

  if (!redeemRequestShapeValidated) {
    return gatewayProxyPreclaimResult(
      "redeem_request_shape_invalid",
      {
        gatewayProxyArchitecturePreserved:
          true,
      },
    );
  }

  if (
    redeemShape.nonce !==
      challenge.nonce
  ) {
    return gatewayProxyPreclaimResult(
      "canonical_nonce_mismatch",
      {
        gatewayProxyArchitecturePreserved:
          true,

        redeemRequestShapeValidated:
          true,
      },
    );
  }

  if (
    input.intendedRedeemPath !==
      DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH ||
    input.redeemInvocationAllowed !==
      false
  ) {
    return gatewayProxyPreclaimResult(
      "redeem_invocation_not_prohibited",
      {
        gatewayProxyArchitecturePreserved:
          true,

        redeemRequestShapeValidated:
          true,
      },
    );
  }

  if (
    input.usageBoundary !==
      DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY
  ) {
    return gatewayProxyPreclaimResult(
      "read_only_usage_boundary_invalid",
      {
        gatewayProxyArchitecturePreserved:
          true,

        redeemRequestShapeValidated:
          true,
      },
    );
  }

  if (
    input.claimBoundary !==
      DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY ||
    input.claimInvocationAllowed !==
      false
  ) {
    return gatewayProxyPreclaimResult(
      "phase5_claim_boundary_not_prohibited",
      {
        gatewayProxyArchitecturePreserved:
          true,

        redeemRequestShapeValidated:
          true,
      },
    );
  }

  return gatewayProxyPreclaimResult(
    DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON,
    {
      gatewayProxyArchitecturePreserved:
        true,

      redeemRequestShapeValidated:
        true,

      boundedUseEligibilityReadOnly:
        true,
    },
  );
}

export const DEMO4_D4_2_LIVE_READ_ENABLE_ENV =
  "DEMO4_D4_2_LIVE_READ_ENABLED" as const;

export const DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLE_ENV =
  "DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED" as const;

export const DEMO4_D4_2_NONCE_ENV =
  "DEMO4_D4_2_NONCE" as const;

export const DEMO4_D4_2_AUTHORIZATION_PROOF_PATH_ENV =
  "DEMO4_D4_2_AUTHORIZATION_PROOF_PATH" as const;

export const DEMO4_D4_2_AGENT_REGISTRY_REFERENCE_PATH_ENV =
  "DEMO4_D4_2_AGENT_REGISTRY_REFERENCE_PATH" as const;

export const DEMO4_D4_2_CONTRACTS_CONFIG_PATH_ENV =
  "DEMO4_D4_2_CONTRACTS_CONFIG_PATH" as const;

const DEMO4_D4_2_RELEASE_OR_PRODUCTION_FLAGS =
  Object.freeze([
    "PHASE3_GATEWAY_RELEASE_ENABLED",
    "PHASE3_GATEWAY_TEST_RELEASE_ONLY",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
    "PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED",
  ] as const);

type JsonObject =
  Record<string, unknown>;

function envTrue(
  env: NodeJS.ProcessEnv,
  name: string,
): boolean {
  return (
    String(
      env[name] ??
      "",
    )
      .trim()
      .toLowerCase() ===
    "true"
  );
}

function requiredEnv(
  env: NodeJS.ProcessEnv,
  name: string,
): string {
  const value =
    String(
      env[name] ??
      "",
    ).trim();

  if (value.length === 0) {
    throw new Error(
      `required_environment_missing:${name}`,
    );
  }

  return value;
}

function assertReleaseAndProductionDisabled(
  env: NodeJS.ProcessEnv,
): void {
  for (
    const name
    of DEMO4_D4_2_RELEASE_OR_PRODUCTION_FLAGS
  ) {
    if (envTrue(env, name)) {
      throw new Error(
        `release_or_production_flag_enabled:${name}`,
      );
    }
  }
}

function readJsonObject(
  pathValue: string,
  label: string,
): JsonObject {
  const absolutePath =
    resolve(
      process.cwd(),
      pathValue,
    );

  const parsed =
    JSON.parse(
      readFileSync(
        absolutePath,
        "utf8",
      ),
    );

  if (!isObjectRecord(parsed)) {
    throw new Error(
      `${label}_must_be_json_object`,
    );
  }

  return parsed;
}

function authorizationProofFromFile(
  pathValue: string,
): JsonObject {
  const root =
    readJsonObject(
      pathValue,
      "authorization_proof",
    );

  const nested =
    root.authorizationProof;

  if (
    isObjectRecord(
      nested,
    )
  ) {
    return nested;
  }

  return root;
}

function agentRegistryReferenceFromFile(
  pathValue: string,
): JsonObject {
  const root =
    readJsonObject(
      pathValue,
      "agent_registry_reference",
    );

  const nested =
    root.agentRegistryReference;

  if (
    isObjectRecord(
      nested,
    )
  ) {
    return nested;
  }

  return root;
}

function loadBuyerVerificationKey(
  env:
    NodeJS.ProcessEnv,
): BuyerDelegationVerificationKey {
  const pathValue =
    requiredEnv(
      env,
      "PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH",
    );

  const root =
    readJsonObject(
      pathValue,
      "buyer_verification_key",
    );

  const buyerKeyId =
    typeof root.buyerKeyId ===
      "string"
      ? root.buyerKeyId.trim()
      : "";

  const source =
    root.source;

  const publicKeyJwk =
    root.publicKeyJwk;

  if (
    buyerKeyId.length ===
      0 ||
    source !==
      BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE ||
    !isObjectRecord(
      publicKeyJwk,
    ) ||
    publicKeyJwk.kty !==
      "OKP" ||
    publicKeyJwk.crv !==
      "Ed25519" ||
    typeof publicKeyJwk.x !==
      "string" ||
    publicKeyJwk.x.length ===
      0 ||
    Object.prototype.hasOwnProperty.call(
      publicKeyJwk,
      "d",
    )
  ) {
    throw new Error(
      "buyer_verification_key_invalid_or_private_material_present",
    );
  }

  return {
    buyerKeyId,

    source:
      BUYER_DELEGATION_SIGNATURE_VERIFIER_MODE,

    publicKeyJwk:
      publicKeyJwk as unknown as
        BuyerDelegationVerificationKey["publicKeyJwk"],
  };
}

export function buildDemo4D42AgentRegistryRequirementV1():
AgentRegistryRequirementV1 {
  const profile =
    DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE;

  return Object.freeze({
    type:
      AGENT_REGISTRY_REQUIREMENT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    required:
      true,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    trustedRegistries:
      Object.freeze([
        Object.freeze({
          network:
            profile.phase6RegistryNetwork,

          contract:
            Object.freeze({
              index:
                profile.cis8004.contract.index,

              subindex:
                profile.cis8004.contract.subindex,
            }),

          moduleReference:
            profile.cis8004.moduleReference,
        }),
      ]),

    requiredStatus:
      AGENT_REGISTRY_REQUIRED_STATUS,

    requireAgentCardIntegrity:
      true,

    requiredCapabilities:
      Object.freeze([
        "x402.payment.authorize",
        "resource.premium.read",
      ]),

    requireOwnerAccountBinding:
      true,

    requireVerifiedOwnerIdentity:
      false,

    externalKeyPolicy:
      "required",

    maxEvidenceAgeSeconds:
      300,

    revalidateBeforeReleaseIfOlderThanSeconds:
      120,
  });
}

export const DEMO4_D4_2_CAPABILITY_RULES =
  Object.freeze([
    Object.freeze({
      capabilityId:
        "x402.payment.authorize",

      source:
        "x402_support",

      expected:
        true,
    }),

    Object.freeze({
      capabilityId:
        "resource.premium.read",

      source:
        "oasf_skill",

      skill:
        "resource.premium.read",
    }),
  ]);

export type Demo4D42RunnerDispatchStateV1 = {
  readonly type:
    typeof DEMO4_D4_2_RUNNER_TYPE;

  readonly version:
    typeof DEMO4_D4_2_RUNNER_VERSION;

  readonly requestedMode:
    "inspect" | "live_read_only" | "invalid";

  readonly liveReadRequested:
    boolean;

  readonly liveReadActivationPresent:
    boolean;

  readonly auditWriteActivationPresent:
    boolean;

  readonly liveReadImplementationWired:
    true;

  readonly databaseReadImplementationWired:
    true;

  readonly databaseAuditPersistenceWired:
    true;

  readonly dispatchAllowed:
    boolean;

  readonly reason:
    | "offline_inspect_only"
    | "live_read_only_activation_required"
    | "live_read_only_dispatch_ready"
    | "invalid_mode";

  readonly networkCalled:
    false;

  readonly databaseCalled:
    false;

  readonly walletRead:
    false;

  readonly privateKeyRead:
    false;

  readonly signerCreated:
    false;

  readonly contractDryRunPerformed:
    false;

  readonly transactionConstructed:
    false;

  readonly transactionSubmitted:
    false;

  readonly usageClaimCreated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly paymentAttempted:
    false;

  readonly receiptRequested:
    false;

  readonly resourceReleased:
    false;

  readonly productionActivation:
    false;
};

function normalizedMode(
  value: unknown,
): "inspect" | "live_read_only" | "invalid" {
  const mode =
    String(
      value ??
      "inspect",
    )
      .trim()
      .toLowerCase();

  if (mode === "inspect") {
    return "inspect";
  }

  if (mode === "live_read_only") {
    return "live_read_only";
  }

  return "invalid";
}

export function demo4D42RunnerDispatchStateForTestV1(
  env:
    NodeJS.ProcessEnv = process.env,
): Demo4D42RunnerDispatchStateV1 {
  const requestedMode =
    normalizedMode(
      env.DEMO4_D4_2_MODE,
    );

  const liveReadRequested =
    requestedMode ===
      "live_read_only";

  const liveReadActivationPresent =
    envTrue(
      env,
      DEMO4_D4_2_LIVE_READ_ENABLE_ENV,
    );

  const auditWriteActivationPresent =
    envTrue(
      env,
      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLE_ENV,
    );

  const dispatchAllowed =
    liveReadRequested &&
    liveReadActivationPresent;

  const reason:
    Demo4D42RunnerDispatchStateV1["reason"] =
    requestedMode ===
      "invalid"
      ? "invalid_mode"
      : requestedMode ===
          "inspect"
        ? "offline_inspect_only"
        : dispatchAllowed
          ? "live_read_only_dispatch_ready"
          : "live_read_only_activation_required";

  return {
    type:
      DEMO4_D4_2_RUNNER_TYPE,

    version:
      DEMO4_D4_2_RUNNER_VERSION,

    requestedMode,

    liveReadRequested,

    liveReadActivationPresent,

    auditWriteActivationPresent,

    liveReadImplementationWired:
      true,

    databaseReadImplementationWired:
      true,

    databaseAuditPersistenceWired:
      true,

    dispatchAllowed,

    reason,

    networkCalled:
      false,

    databaseCalled:
      false,

    walletRead:
      false,

    privateKeyRead:
      false,

    signerCreated:
      false,

    contractDryRunPerformed:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    paymentAttempted:
      false,

    receiptRequested:
      false,

    resourceReleased:
      false,

    productionActivation:
      false,
  };
}

export type Demo4D42LiveReadOnlyStageV1 =
  | "canonical_challenge"
  | "gateway_proxy_preclaim"
  | "phase5_cryptographic_preflight"
  | "phase5_lifecycle"
  | "phase5_revocation"
  | "phase6_registered_agent"
  | "phase6_audit_activation"
  | "phase6_audit"
  | "buyer_policy"
  | "bounded_use_snapshot"
  | "d4_2_preflight";

export type Demo4D42LiveReadOnlyResultV1 = {
  readonly ok:
    boolean;

  readonly stage:
    Demo4D42LiveReadOnlyStageV1;

  readonly reason:
    string;

  readonly canonicalChallengeFound:
    boolean;

  readonly gatewayProxyPreclaimReady:
    boolean;

  readonly phase5PreflightAccepted:
    boolean;

  readonly lifecycleReady:
    boolean;

  readonly revocationClear:
    boolean;

  readonly phase6Status:
    string | null;

  readonly phase6Reason:
    string | null;

  readonly auditWriteAuthorized:
    boolean;

  readonly auditPersisted:
    boolean;

  readonly buyerPolicyEvaluated:
    boolean;

  readonly usageSnapshotRead:
    boolean;

  readonly d4PreflightStatus:
    string | null;

  readonly d4PreflightReason:
    string | null;

  readonly networkCalled:
    boolean;

  readonly databaseCalled:
    boolean;

  readonly phase6AuditInserted:
    boolean;

  readonly paidGatedRedeemCalled:
    false;

  readonly phase5ClaimInvoked:
    false;

  readonly usageClaimCreated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly paymentAttempted:
    false;

  readonly receiptRequested:
    false;

  readonly resourceReleased:
    false;

  readonly productionActivation:
    false;
};

type LiveResultState = {
  readonly canonicalChallengeFound?:
    boolean;

  readonly gatewayProxyPreclaimReady?:
    boolean;

  readonly phase5PreflightAccepted?:
    boolean;

  readonly lifecycleReady?:
    boolean;

  readonly revocationClear?:
    boolean;

  readonly phase6Status?:
    string | null;

  readonly phase6Reason?:
    string | null;

  readonly auditWriteAuthorized?:
    boolean;

  readonly auditPersisted?:
    boolean;

  readonly buyerPolicyEvaluated?:
    boolean;

  readonly usageSnapshotRead?:
    boolean;

  readonly d4PreflightStatus?:
    string | null;

  readonly d4PreflightReason?:
    string | null;

  readonly networkCalled?:
    boolean;

  readonly databaseCalled?:
    boolean;

  readonly phase6AuditInserted?:
    boolean;
};

function liveResult(
  ok: boolean,
  stage:
    Demo4D42LiveReadOnlyStageV1,
  reason: string,
  state:
    LiveResultState = {},
): Demo4D42LiveReadOnlyResultV1 {
  return {
    ok,

    stage,

    reason,

    canonicalChallengeFound:
      state.canonicalChallengeFound ??
      false,

    gatewayProxyPreclaimReady:
      state.gatewayProxyPreclaimReady ??
      false,

    phase5PreflightAccepted:
      state.phase5PreflightAccepted ??
      false,

    lifecycleReady:
      state.lifecycleReady ??
      false,

    revocationClear:
      state.revocationClear ??
      false,

    phase6Status:
      state.phase6Status ??
      null,

    phase6Reason:
      state.phase6Reason ??
      null,

    auditWriteAuthorized:
      state.auditWriteAuthorized ??
      false,

    auditPersisted:
      state.auditPersisted ??
      false,

    buyerPolicyEvaluated:
      state.buyerPolicyEvaluated ??
      false,

    usageSnapshotRead:
      state.usageSnapshotRead ??
      false,

    d4PreflightStatus:
      state.d4PreflightStatus ??
      null,

    d4PreflightReason:
      state.d4PreflightReason ??
      null,

    networkCalled:
      state.networkCalled ??
      false,

    databaseCalled:
      state.databaseCalled ??
      false,

    phase6AuditInserted:
      state.phase6AuditInserted ??
      false,

    paidGatedRedeemCalled:
      false,

    phase5ClaimInvoked:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    paymentAttempted:
      false,

    receiptRequested:
      false,

    resourceReleased:
      false,

    productionActivation:
      false,
  };
}

export async function executeDemo4D42LiveReadOnlyV1(
  env:
    NodeJS.ProcessEnv = process.env,
): Promise<Demo4D42LiveReadOnlyResultV1> {
  assertReleaseAndProductionDisabled(
    env,
  );

  if (
    !envTrue(
      env,
      DEMO4_D4_2_LIVE_READ_ENABLE_ENV,
    )
  ) {
    return liveResult(
      false,
      "canonical_challenge",
      "live_read_only_activation_required",
    );
  }

  const nonce =
    requiredEnv(
      env,
      DEMO4_D4_2_NONCE_ENV,
    );

  const authorizationProof =
    authorizationProofFromFile(
      requiredEnv(
        env,
        DEMO4_D4_2_AUTHORIZATION_PROOF_PATH_ENV,
      ),
    );

  const agentRegistryReference =
    agentRegistryReferenceFromFile(
      requiredEnv(
        env,
        DEMO4_D4_2_AGENT_REGISTRY_REFERENCE_PATH_ENV,
      ),
    );

  const buyerVerificationKey =
    loadBuyerVerificationKey(
      env,
    );

  const canonical =
    await getCanonicalChallengeBindingByNonce(
      nonce,
    );

  if (!canonical.found) {
    return liveResult(
      false,
      "canonical_challenge",
      "canonical_challenge_not_found",
      {
        databaseCalled:
          true,
      },
    );
  }

  if (
    canonical.nonce !==
      nonce ||
    canonical.status !==
      "ISSUED" ||
    canonical.releaseStatus !==
      "NOT_RELEASED"
  ) {
    return liveResult(
      false,
      "canonical_challenge",
      "canonical_challenge_not_fresh_issued",
      {
        canonicalChallengeFound:
          true,

        databaseCalled:
          true,
      },
    );
  }

  const configPath =
    String(
      env[
        DEMO4_D4_2_CONTRACTS_CONFIG_PATH_ENV
      ] ??
      "config/contracts.json",
    );

  const contractResolver =
    new FileContractResolver(
      resolve(
        process.cwd(),
        configPath,
      ),
    );

  const contract =
    contractResolver.resolveByResource({
      method:
        "GET",

      pathname:
        DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH,
    });

  const preclaim =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      challenge: {
        source:
          "gateway_proxy",

        gatewayAuthored:
          true,

        resourceMethod:
          "GET",

        resourcePath:
          DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH,

        canonicalLookup:
          DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP,

        canonicalChallengeFound:
          true,

        nonce:
          canonical.nonce,

        challengeId:
          canonical.challengeId,
      },

      redeemShape: {
        nonce,

        authorizationProof,

        agentRegistryReference,
      },

      intendedRedeemPath:
        DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH,

      redeemInvocationAllowed:
        false,

      usageBoundary:
        DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY,

      claimBoundary:
        DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY,

      claimInvocationAllowed:
        false,
    });

  if (!preclaim.ok) {
    return liveResult(
      false,
      "gateway_proxy_preclaim",
      preclaim.reason,
      {
        canonicalChallengeFound:
          true,

        databaseCalled:
          true,
      },
    );
  }

  const nowSec =
    Math.floor(
      Date.now() /
      1000,
    );

  const phase5RuntimeInput = {
    nonce,

    envelope:
      authorizationProof,

    nowSec,

    allowSatisfiedChallengeRetry:
      false,

    canonical,

    contract,

    cryptographicDelegation: {
      enabled:
        true,

      buyerVerificationKey,
    },
  } satisfies
    Phase5AgentRuntimeAuthorizationInput;

  const preflight =
    evaluatePhase5AgentRuntimeCryptographicPreflight(
      phase5RuntimeInput,
    );

  if (!preflight.ok) {
    return liveResult(
      false,
      "phase5_cryptographic_preflight",
      preflight.result.reason,
      {
        canonicalChallengeFound:
          true,

        gatewayProxyPreclaimReady:
          true,

        databaseCalled:
          true,
      },
    );
  }

  if (
    preflight.delegationDocument ===
      null ||
    preflight.proofVerification ===
      null ||
    preflight.cryptographicBinding ===
      null
  ) {
    return liveResult(
      false,
      "phase5_cryptographic_preflight",
      "phase5_preflight_missing_lifecycle_material",
      {
        canonicalChallengeFound:
          true,

        gatewayProxyPreclaimReady:
          true,

        phase5PreflightAccepted:
          true,

        databaseCalled:
          true,
      },
    );
  }

  const lifecycle =
    evaluatePhase5AgentDelegationLifecycle({
      delegationDocument:
        preflight.delegationDocument,

      proofVerification:
        preflight.proofVerification,

      cryptographicBinding:
        preflight.cryptographicBinding,

      nowSec,
    });

  if (
    !lifecycle.ok ||
    lifecycle.lifecycleContract ===
      null
  ) {
    return liveResult(
      false,
      "phase5_lifecycle",
      lifecycle.reason,
      {
        canonicalChallengeFound:
          true,

        gatewayProxyPreclaimReady:
          true,

        phase5PreflightAccepted:
          true,

        databaseCalled:
          true,
      },
    );
  }

  const revocation =
    await checkPhase5AgentDelegationRevocation(
      lifecycle.lifecycleContract,
    );

  if (!revocation.ok) {
    return liveResult(
      false,
      "phase5_revocation",
      revocation.reason,
      {
        canonicalChallengeFound:
          true,

        gatewayProxyPreclaimReady:
          true,

        phase5PreflightAccepted:
          true,

        lifecycleReady:
          true,

        databaseCalled:
          true,
      },
    );
  }

  const transports =
    buildDemo4D42LiveTransportBundleV1();

  const registeredAgentAuthorization =
    await composeAgentRegistryConditionalGatingV1({
      phase5Preflight:
        preflight,

      requirement:
        buildDemo4D42AgentRegistryRequirementV1(),

      reference:
        agentRegistryReference,

      capabilityRules:
        DEMO4_D4_2_CAPABILITY_RULES,

      now:
        new Date(
          nowSec *
          1000,
        ).toISOString(),

      registryTransport:
        transports.registryTransport,

      registryConfig:
        transports.registryConfig,

      trustedCis8:
        transports.trustedCis8,

      cis8Transport:
        transports.cis8Transport,

      agentCardTransport:
        transports.agentCardTransport,
    });

  const phase6State = {
    canonicalChallengeFound:
      true,

    gatewayProxyPreclaimReady:
      true,

    phase5PreflightAccepted:
      true,

    lifecycleReady:
      true,

    revocationClear:
      true,

    phase6Status:
      registeredAgentAuthorization.status,

    phase6Reason:
      registeredAgentAuthorization.reason,

    networkCalled:
      registeredAgentAuthorization.registryNetworkCalled ||
      registeredAgentAuthorization.agentCardNetworkCalled,

    databaseCalled:
      true,
  } as const;

  const auditWriteAuthorized =
    envTrue(
      env,
      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLE_ENV,
    );

  if (!auditWriteAuthorized) {
    return liveResult(
      false,
      "phase6_audit_activation",
      "phase6_audit_write_not_enabled",
      {
        ...phase6State,

        auditWriteAuthorized:
          false,
      },
    );
  }

  const registryAudit =
    await persistPhase6AgentRegistryAuthorizationAuditV1({
      challengeId:
        canonical.challengeId,

      nonce,

      merchantId:
        canonical.merchantId,

      authorization:
        registeredAgentAuthorization,
    });

  if (
    !registryAudit.ok ||
    registryAudit.auditPersisted !==
      true
  ) {
    return liveResult(
      false,
      "phase6_audit",
      registryAudit.reason,
      {
        ...phase6State,

        auditWriteAuthorized:
          true,

        phase6AuditInserted:
          registryAudit.auditPersisted,
      },
    );
  }

  if (
    !registeredAgentAuthorization.ok ||
    registeredAgentAuthorization.status !==
      "allowed" ||
    registeredAgentAuthorization
      .paymentEligibilityHandoff ===
      null
  ) {
    return liveResult(
      false,
      "phase6_registered_agent",
      registeredAgentAuthorization.reason,
      {
        ...phase6State,

        auditWriteAuthorized:
          true,

        auditPersisted:
          true,

        phase6AuditInserted:
          true,
      },
    );
  }

  const policyResult =
    completePhase5AgentRuntimePolicyEvaluation(
      phase5RuntimeInput,
      preflight,
    );

  if (
    policyResult.policyEvaluation ===
      null
  ) {
    return liveResult(
      false,
      "buyer_policy",
      "buyer_policy_result_missing",
      {
        ...phase6State,

        auditWriteAuthorized:
          true,

        auditPersisted:
          true,

        phase6AuditInserted:
          true,
      },
    );
  }

  if (!policyResult.ok) {
    return liveResult(
      false,
      "buyer_policy",
      policyResult.reason,
      {
        ...phase6State,

        auditWriteAuthorized:
          true,

        auditPersisted:
          true,

        phase6AuditInserted:
          true,

        buyerPolicyEvaluated:
          policyResult
            .policyEvaluation
            .policyEvaluated,
      },
    );
  }

  const usage =
    await getPhase5AgentDelegationUsageSnapshot(
      lifecycle.lifecycleContract
        .credentialHash,
    );

  const d4Input = {
    liveProfile:
      DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE,

    lifecycle,

    revocation,

    registeredAgentAuthorization,

    registryAudit,

    buyerPolicy:
      policyResult.policyEvaluation,

    usage,
  } satisfies
    Parameters<
      typeof evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1
    >[0];

  const d4Result =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      d4Input,
    );

  return liveResult(
    d4Result.ok,
    "d4_2_preflight",
    d4Result.reason,
    {
      ...phase6State,

      auditWriteAuthorized:
        true,

      auditPersisted:
        true,

      phase6AuditInserted:
        true,

      buyerPolicyEvaluated:
        policyResult
          .policyEvaluation
          .policyEvaluated,

      usageSnapshotRead:
        true,

      d4PreflightStatus:
        d4Result.status,

      d4PreflightReason:
        d4Result.reason,
    },
  );
}

function printDispatchState(
  state:
    Demo4D42RunnerDispatchStateV1,
): void {
  console.log(
    "=== DEMO4 D4-2 REGISTERED-AGENT AUTHORIZATION PREFLIGHT ===",
  );

  console.log(
    `MODE=${state.requestedMode}`,
  );

  console.log(
    `RUNNER_REASON=${state.reason}`,
  );

  console.log(
    `CANONICAL_NETWORK=${DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE.canonicalNetwork}`,
  );

  console.log(
    `CIS8004_CONTRACT=<${DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE.cis8004.contract.index},${DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE.cis8004.contract.subindex}>`,
  );

  console.log(
    `CIS8004_TOKEN_ID=${DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE.cis8004.tokenId}`,
  );

  console.log(
    `LIVE_READ_IMPLEMENTATION_WIRED=${state.liveReadImplementationWired}`,
  );

  console.log(
    `DATABASE_READ_IMPLEMENTATION_WIRED=${state.databaseReadImplementationWired}`,
  );

  console.log(
    `DATABASE_AUDIT_PERSISTENCE_WIRED=${state.databaseAuditPersistenceWired}`,
  );

  console.log(
    `LIVE_READ_ACTIVATION_PRESENT=${state.liveReadActivationPresent}`,
  );

  console.log(
    `AUDIT_WRITE_ACTIVATION_PRESENT=${state.auditWriteActivationPresent}`,
  );

  console.log(
    `DISPATCH_ALLOWED=${state.dispatchAllowed}`,
  );

  console.log(
    `NETWORK_CALLED=${state.networkCalled}`,
  );

  console.log(
    `DATABASE_CALLED=${state.databaseCalled}`,
  );

  console.log(
    `USAGE_CLAIM_CREATED=${state.usageClaimCreated}`,
  );

  console.log(
    `BOUNDED_USE_CONSUMED=${state.boundedUseConsumed}`,
  );

  console.log(
    `PAYMENT_ATTEMPTED=${state.paymentAttempted}`,
  );

  console.log(
    `RESOURCE_RELEASED=${state.resourceReleased}`,
  );

  console.log(
    `PRODUCTION_ACTIVATION=${state.productionActivation}`,
  );
}

function printLiveResult(
  result:
    Demo4D42LiveReadOnlyResultV1,
): void {
  console.log(
    `LIVE_RESULT_OK=${result.ok}`,
  );

  console.log(
    `LIVE_RESULT_STAGE=${result.stage}`,
  );

  console.log(
    `LIVE_RESULT_REASON=${result.reason}`,
  );

  console.log(
    `CANONICAL_CHALLENGE_FOUND=${result.canonicalChallengeFound}`,
  );

  console.log(
    `GATEWAY_PROXY_PRECLAIM_READY=${result.gatewayProxyPreclaimReady}`,
  );

  console.log(
    `PHASE5_PREFLIGHT_ACCEPTED=${result.phase5PreflightAccepted}`,
  );

  console.log(
    `LIFECYCLE_READY=${result.lifecycleReady}`,
  );

  console.log(
    `REVOCATION_CLEAR=${result.revocationClear}`,
  );

  console.log(
    `PHASE6_STATUS=${result.phase6Status ?? "NOT_REACHED"}`,
  );

  console.log(
    `PHASE6_REASON=${result.phase6Reason ?? "NOT_REACHED"}`,
  );

  console.log(
    `AUDIT_WRITE_AUTHORIZED=${result.auditWriteAuthorized}`,
  );

  console.log(
    `AUDIT_PERSISTED=${result.auditPersisted}`,
  );

  console.log(
    `BUYER_POLICY_EVALUATED=${result.buyerPolicyEvaluated}`,
  );

  console.log(
    `USAGE_SNAPSHOT_READ=${result.usageSnapshotRead}`,
  );

  console.log(
    `D4_2_PREFLIGHT_STATUS=${result.d4PreflightStatus ?? "NOT_REACHED"}`,
  );

  console.log(
    `D4_2_PREFLIGHT_REASON=${result.d4PreflightReason ?? "NOT_REACHED"}`,
  );

  console.log(
    `NETWORK_CALLED=${result.networkCalled}`,
  );

  console.log(
    `DATABASE_CALLED=${result.databaseCalled}`,
  );

  console.log(
    `PHASE6_AUDIT_INSERTED=${result.phase6AuditInserted}`,
  );

  console.log(
    `PAID_GATED_REDEEM_CALLED=${result.paidGatedRedeemCalled}`,
  );

  console.log(
    `PHASE5_CLAIM_INVOKED=${result.phase5ClaimInvoked}`,
  );

  console.log(
    `USAGE_CLAIM_CREATED=${result.usageClaimCreated}`,
  );

  console.log(
    `BOUNDED_USE_CONSUMED=${result.boundedUseConsumed}`,
  );

  console.log(
    `PAYMENT_ATTEMPTED=${result.paymentAttempted}`,
  );

  console.log(
    `RECEIPT_REQUESTED=${result.receiptRequested}`,
  );

  console.log(
    `RESOURCE_RELEASED=${result.resourceReleased}`,
  );

  console.log(
    `PRODUCTION_ACTIVATION=${result.productionActivation}`,
  );
}

async function main(): Promise<void> {
  const state =
    demo4D42RunnerDispatchStateForTestV1();

  printDispatchState(
    state,
  );

  if (
    state.requestedMode ===
      "inspect"
  ) {
    console.log(
      "RUNNER_RESULT=LIVE_READ_ONLY_WIRING_INSPECTED_NO_EXECUTION",
    );

    return;
  }

  if (
    state.requestedMode ===
      "invalid" ||
    !state.dispatchAllowed
  ) {
    console.log(
      "RUNNER_RESULT=LIVE_READ_ONLY_DISPATCH_BLOCKED",
    );

    process.exitCode =
      2;

    return;
  }

  const result =
    await executeDemo4D42LiveReadOnlyV1();

  printLiveResult(
    result,
  );

  console.log(
    `RUNNER_RESULT=${
      result.ok
        ? "D4_2_LIVE_READ_ONLY_PREFLIGHT_READY"
        : "D4_2_LIVE_READ_ONLY_PREFLIGHT_STOPPED"
    }`,
  );

  if (!result.ok) {
    process.exitCode =
      3;
  }
}

if (require.main === module) {
  void main().catch(
    (error: unknown) => {
      const reason =
        error instanceof Error
          ? error.message
          : "unknown_error";

      console.error(
        `RUNNER_ERROR=${reason}`,
      );

      console.error(
        "PAID_GATED_REDEEM_CALLED=false",
      );

      console.error(
        "PHASE5_CLAIM_INVOKED=false",
      );

      console.error(
        "BOUNDED_USE_CONSUMED=false",
      );

      console.error(
        "PAYMENT_ATTEMPTED=false",
      );

      console.error(
        "RESOURCE_RELEASED=false",
      );

      console.error(
        "PRODUCTION_ACTIVATION=false",
      );

      process.exitCode =
        1;
    },
  );
}
