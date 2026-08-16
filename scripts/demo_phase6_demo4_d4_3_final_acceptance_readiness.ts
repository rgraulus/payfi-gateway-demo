/**
 * PR #317 — Demo4 D4-3 Final Acceptance Readiness runner.
 *
 * Initial slice:
 *   deterministic dispatch lock + local/non-secret readiness inspection.
 *
 * Default mode is "inspect".
 *
 * The runner MUST NOT create a Gateway challenge, invoke /paid-gated/redeem,
 * claim Phase 5 bounded use, read private-key or wallet contents, create a
 * signer, construct/sign/submit a transaction, attempt payment, call CRP
 * fulfill, request a receipt, mutate replay/canonical state, emit
 * PAYMENT-RESPONSE, release protected content, or activate production.
 *
 * A later live_read_only dispatch is separately gated and remains blocked
 * until the bounded live-read implementation is explicitly wired and the
 * operator has separately authorized that live-read execution.
 */

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  createHash,
} from "node:crypto";

import process from "node:process";

import {
  DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE,
  DEMO4_D4_3_PAYMENT_CONTRACT,
  DEMO4_D4_3_PAYER_EXECUTION_CONTRACT,
  evaluateDemo4FinalAcceptanceReadinessV1,
} from "../src/phase6/demo4FinalAcceptanceReadiness";

export const DEMO4_D4_3_RUNNER_TYPE =
  "xcf.phase6.demo4-d4-3-final-acceptance-readiness-runner" as const;

export const DEMO4_D4_3_RUNNER_VERSION =
  "1.0.0" as const;

export const DEMO4_D4_3_RUNNER_DEFAULT_MODE =
  "inspect" as const;

export const DEMO4_D4_3_LIVE_READ_IMPLEMENTATION_WIRED =
  true as const;

export const DEMO4_D4_3_GATEWAY_BASE_URL_ENV =
  "DEMO4_D4_3_GATEWAY_BASE_URL" as const;

export const DEMO4_D4_3_CRP_BASE_URL_ENV =
  "DEMO4_D4_3_CRP_BASE_URL" as const;

export const DEMO4_D4_3_REPLAY_BACKEND_ENV =
  "X402_REPLAY_BACKEND" as const;

export type Demo4D43RunnerModeV1 =
  | "inspect"
  | "live_read_only"
  | "invalid";

export type Demo4D43RunnerDispatchStateV1 = {
  readonly requestedMode:
    Demo4D43RunnerModeV1;

  readonly reason:
    | "offline_inspect_only"
    | "live_read_only_not_authorized"
    | "live_read_only_configuration_missing"
    | "live_read_only_not_wired"
    | "live_read_only_dispatch_ready"
    | "release_or_production_flag_enabled"
    | "invalid_mode";

  readonly liveReadImplementationWired:
    boolean;

  readonly liveReadActivationPresent:
    boolean;

  readonly operatorAuthorizationMarkerPresent:
    boolean;

  readonly liveReadConfigurationPresent:
    boolean;

  readonly dispatchAllowed:
    boolean;

  readonly networkCalled:
    false;

  readonly databaseCalled:
    false;

  readonly gatewayChallengeCreated:
    false;

  readonly paidGatedRedeemCalled:
    false;

  readonly phase5ClaimInvoked:
    false;

  readonly usageClaimCreated:
    false;

  readonly boundedUseConsumed:
    false;

  readonly actingPrivateKeyRead:
    false;

  readonly payerWalletRead:
    false;

  readonly signerCreated:
    false;

  readonly signingPerformed:
    false;

  readonly transactionConstructed:
    false;

  readonly transactionSubmitted:
    false;

  readonly paymentAttempted:
    false;

  readonly crpFulfillCalled:
    false;

  readonly receiptRequested:
    false;

  readonly receiptIssued:
    false;

  readonly replayStateMutated:
    false;

  readonly canonicalSettlementMutated:
    false;

  readonly canonicalReleasePersisted:
    false;

  readonly paymentResponseEmitted:
    false;

  readonly resourceReleased:
    false;

  readonly productionActivation:
    false;
};

export type Demo4D43LocalInspectionV1 = {
  readonly payerCommandSurfaceExists:
    boolean;

  readonly payerWalletCustodyPathExists:
    boolean;

  readonly actingPrivateKeyCustodyPathExists:
    boolean;

  readonly contractConfigurationExists:
    boolean;

  readonly paymentTupleObservedInContractConfiguration:
    boolean;

  readonly sensitiveFileContentsRead:
    false;

  readonly networkCalled:
    false;

  readonly databaseCalled:
    false;
};

function parseBoolean(
  value:
    string | undefined,
): boolean {
  return (
    value?.trim().toLowerCase() ===
      "true"
  );
}

function requestedMode(
  value:
    string | undefined,
): Demo4D43RunnerModeV1 {
  const normalized =
    (
      value ??
      DEMO4_D4_3_RUNNER_DEFAULT_MODE
    )
      .trim()
      .toLowerCase();

  if (
    normalized ===
      "inspect"
  ) {
    return "inspect";
  }

  if (
    normalized ===
      "live_read_only"
  ) {
    return "live_read_only";
  }

  return "invalid";
}

function releaseOrProductionFlagEnabled(
  env:
    NodeJS.ProcessEnv,
): boolean {
  const forbiddenTrueFlags = [
    "DEMO4_D4_3_PRODUCTION_ACTIVATION",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
  ];

  return forbiddenTrueFlags.some(
    (name) =>
      parseBoolean(
        env[name],
      ),
  );
}

function replayModeForEnv(
  env:
    NodeJS.ProcessEnv,
): "memory" | "redis" | null {
  const raw =
    String(
      env[
        DEMO4_D4_3_REPLAY_BACKEND_ENV
      ] ??
      "",
    )
      .trim()
      .toLowerCase();

  if (
    raw ===
      "memory" ||
    raw ===
      "redis"
  ) {
    return raw;
  }

  return null;
}

function safeLoopbackBaseUrl(
  value:
    string | undefined,
): string | null {
  if (
    value ===
      undefined ||
    value.trim() ===
      ""
  ) {
    return null;
  }

  try {
    const parsed =
      new URL(
        value,
      );

    const host =
      parsed.hostname
        .toLowerCase();

    if (
      (
        parsed.protocol !==
          "http:" &&
        parsed.protocol !==
          "https:"
      ) ||
      (
        host !==
          "127.0.0.1" &&
        host !==
          "localhost" &&
        host !==
          "::1" &&
        host !==
          "[::1]"
      ) ||
      parsed.username !==
        "" ||
      parsed.password !==
        "" ||
      parsed.search !==
        "" ||
      parsed.hash !==
        ""
    ) {
      return null;
    }

    return parsed
      .toString()
      .replace(
        /\/$/,
        "",
      );
  } catch {
    return null;
  }
}

function liveReadConfigurationPresent(
  env:
    NodeJS.ProcessEnv,
): boolean {
  const gatewayBaseUrl =
    safeLoopbackBaseUrl(
      env[
        DEMO4_D4_3_GATEWAY_BASE_URL_ENV
      ],
    );

  const crpBaseUrl =
    safeLoopbackBaseUrl(
      env[
        DEMO4_D4_3_CRP_BASE_URL_ENV
      ],
    );

  const replayMode =
    replayModeForEnv(
      env,
    );

  if (
    gatewayBaseUrl ===
      null ||
    crpBaseUrl ===
      null ||
    replayMode ===
      null
  ) {
    return false;
  }

  if (
    replayMode ===
      "redis"
  ) {
    const redisUrl =
      String(
        env.X402_REDIS_URL ??
        env.REDIS_URL ??
        "",
      ).trim();

    if (
      !redisUrl.startsWith(
        "redis://",
      )
    ) {
      return false;
    }
  }

  return true;
}

export function demo4D43RunnerDispatchStateForTestV1(
  env:
    NodeJS.ProcessEnv = process.env,
): Demo4D43RunnerDispatchStateV1 {
  const mode =
    requestedMode(
      env.DEMO4_D4_3_MODE,
    );

  const liveReadActivationPresent =
    parseBoolean(
      env.DEMO4_D4_3_LIVE_READ_ENABLED,
    );

  const operatorAuthorizationMarkerPresent =
    parseBoolean(
      env.DEMO4_D4_3_LIVE_READ_AUTHORIZED,
    );

  const configurationPresent =
    liveReadConfigurationPresent(
      env,
    );

  const forbiddenFlagEnabled =
    releaseOrProductionFlagEnabled(
      env,
    );

  let reason:
    Demo4D43RunnerDispatchStateV1["reason"];

  let dispatchAllowed =
    false;

  if (
    forbiddenFlagEnabled
  ) {
    reason =
      "release_or_production_flag_enabled";
  } else if (
    mode ===
      "invalid"
  ) {
    reason =
      "invalid_mode";
  } else if (
    mode ===
      "inspect"
  ) {
    reason =
      "offline_inspect_only";
  } else if (
    !liveReadActivationPresent ||
    !operatorAuthorizationMarkerPresent
  ) {
    reason =
      "live_read_only_not_authorized";
  } else if (
    !configurationPresent
  ) {
    reason =
      "live_read_only_configuration_missing";
  } else if (
    !DEMO4_D4_3_LIVE_READ_IMPLEMENTATION_WIRED
  ) {
    reason =
      "live_read_only_not_wired";
  } else {
    reason =
      "live_read_only_dispatch_ready";

    dispatchAllowed =
      true;
  }

  return {
    requestedMode:
      mode,

    reason,

    liveReadImplementationWired:
      DEMO4_D4_3_LIVE_READ_IMPLEMENTATION_WIRED,

    liveReadActivationPresent,

    operatorAuthorizationMarkerPresent,

    liveReadConfigurationPresent:
      configurationPresent,

    dispatchAllowed,

    networkCalled:
      false,

    databaseCalled:
      false,

    gatewayChallengeCreated:
      false,

    paidGatedRedeemCalled:
      false,

    phase5ClaimInvoked:
      false,

    usageClaimCreated:
      false,

    boundedUseConsumed:
      false,

    actingPrivateKeyRead:
      false,

    payerWalletRead:
      false,

    signerCreated:
      false,

    signingPerformed:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    crpFulfillCalled:
      false,

    receiptRequested:
      false,

    receiptIssued:
      false,

    replayStateMutated:
      false,

    canonicalSettlementMutated:
      false,

    canonicalReleasePersisted:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
      false,

    productionActivation:
      false,
  };
}

function packageHasPayerCommand():
boolean {
  const packagePath =
    resolve(
      process.cwd(),
      "package.json",
    );

  if (
    !existsSync(
      packagePath,
    )
  ) {
    return false;
  }

  try {
    const parsed =
      JSON.parse(
        readFileSync(
          packagePath,
          "utf8",
        ),
      ) as {
        scripts?: Record<string, unknown>;
      };

    return (
      typeof parsed.scripts?.[
        DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
          .packageCommand
      ] ===
        "string"
    );
  } catch {
    return false;
  }
}

function contractConfigurationContainsFrozenTuple():
{
  readonly exists: boolean;
  readonly tupleObserved: boolean;
} {
  const contractPath =
    resolve(
      process.cwd(),
      "config/contracts.json",
    );

  if (
    !existsSync(
      contractPath,
    )
  ) {
    return {
      exists:
        false,

      tupleObserved:
        false,
    };
  }

  try {
    const text =
      readFileSync(
        contractPath,
        "utf8",
      );

    const requiredFragments = [
      DEMO4_D4_3_PAYMENT_CONTRACT.network,
      DEMO4_D4_3_PAYMENT_CONTRACT.tokenId,
      DEMO4_D4_3_PAYMENT_CONTRACT.amount,
      DEMO4_D4_3_PAYMENT_CONTRACT.merchantId,
      DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath,
      DEMO4_D4_3_PAYMENT_CONTRACT.payTo,
    ];

    return {
      exists:
        true,

      tupleObserved:
        requiredFragments.every(
          (fragment) =>
            text.includes(
              String(
                fragment,
              ),
            ),
        ),
    };
  } catch {
    return {
      exists:
        true,

      tupleObserved:
        false,
    };
  }
}

function expandedActingPrivateKeyPath():
string {
  const configured =
    DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
      .actingPrivateKeyCustodyPath;

  if (
    !configured.startsWith(
      "$HOME/",
    )
  ) {
    return configured;
  }

  const home =
    process.env.HOME;

  if (!home) {
    return configured;
  }

  return resolve(
    home,
    configured.slice(
      "$HOME/".length,
    ),
  );
}

export function inspectDemo4D43LocalReadinessV1():
Demo4D43LocalInspectionV1 {
  const contract =
    contractConfigurationContainsFrozenTuple();

  return {
    payerCommandSurfaceExists:
      packageHasPayerCommand(),

    payerWalletCustodyPathExists:
      existsSync(
        resolve(
          process.cwd(),
          DEMO4_D4_3_PAYER_EXECUTION_CONTRACT
            .walletCustodyPath,
        ),
      ),

    actingPrivateKeyCustodyPathExists:
      existsSync(
        expandedActingPrivateKeyPath(),
      ),

    contractConfigurationExists:
      contract.exists,

    paymentTupleObservedInContractConfiguration:
      contract.tupleObserved,

    sensitiveFileContentsRead:
      false,

    networkCalled:
      false,

    databaseCalled:
      false,
  };
}

function printDispatchState(
  state:
    Demo4D43RunnerDispatchStateV1,
): void {
  console.log(
    "=== DEMO4 D4-3 FINAL ACCEPTANCE READINESS ===",
  );

  console.log(
    `MODE=${state.requestedMode}`,
  );

  console.log(
    `RUNNER_REASON=${state.reason}`,
  );

  console.log(
    `CANONICAL_CHAIN_ID=${DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId}`,
  );

  console.log(
    `CIS8004_TOKEN_ID=${DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE.cis8004.tokenId}`,
  );

  console.log(
    `PAYMENT_AMOUNT=${DEMO4_D4_3_PAYMENT_CONTRACT.amount}`,
  );

  console.log(
    `MAX_PAYMENT_SUBMISSIONS=${DEMO4_D4_3_PAYMENT_CONTRACT.maxPaymentSubmissions}`,
  );

  console.log(
    `AUTOMATIC_RETRY=${DEMO4_D4_3_PAYMENT_CONTRACT.automaticRetry}`,
  );

  console.log(
    `LIVE_READ_IMPLEMENTATION_WIRED=${state.liveReadImplementationWired}`,
  );

  console.log(
    `LIVE_READ_ACTIVATION_PRESENT=${state.liveReadActivationPresent}`,
  );

  console.log(
    `OPERATOR_AUTHORIZATION_MARKER_PRESENT=${state.operatorAuthorizationMarkerPresent}`,
  );

  console.log(
    `LIVE_READ_CONFIGURATION_PRESENT=${state.liveReadConfigurationPresent}`,
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
    `GATEWAY_CHALLENGE_CREATED=${state.gatewayChallengeCreated}`,
  );

  console.log(
    `PAID_GATED_REDEEM_CALLED=${state.paidGatedRedeemCalled}`,
  );

  console.log(
    `PHASE5_CLAIM_INVOKED=${state.phase5ClaimInvoked}`,
  );

  console.log(
    `USAGE_CLAIM_CREATED=${state.usageClaimCreated}`,
  );

  console.log(
    `BOUNDED_USE_CONSUMED=${state.boundedUseConsumed}`,
  );

  console.log(
    `ACTING_PRIVATE_KEY_READ=${state.actingPrivateKeyRead}`,
  );

  console.log(
    `PAYER_WALLET_READ=${state.payerWalletRead}`,
  );

  console.log(
    `SIGNING_PERFORMED=${state.signingPerformed}`,
  );

  console.log(
    `TRANSACTION_CONSTRUCTED=${state.transactionConstructed}`,
  );

  console.log(
    `TRANSACTION_SUBMITTED=${state.transactionSubmitted}`,
  );

  console.log(
    `PAYMENT_ATTEMPTED=${state.paymentAttempted}`,
  );

  console.log(
    `CRP_FULFILL_CALLED=${state.crpFulfillCalled}`,
  );

  console.log(
    `RECEIPT_REQUESTED=${state.receiptRequested}`,
  );

  console.log(
    `RECEIPT_ISSUED=${state.receiptIssued}`,
  );

  console.log(
    `REPLAY_STATE_MUTATED=${state.replayStateMutated}`,
  );

  console.log(
    `CANONICAL_SETTLEMENT_MUTATED=${state.canonicalSettlementMutated}`,
  );

  console.log(
    `CANONICAL_RELEASE_PERSISTED=${state.canonicalReleasePersisted}`,
  );

  console.log(
    `PAYMENT_RESPONSE_EMITTED=${state.paymentResponseEmitted}`,
  );

  console.log(
    `RESOURCE_RELEASED=${state.resourceReleased}`,
  );

  console.log(
    `PRODUCTION_ACTIVATION=${state.productionActivation}`,
  );
}

function printLocalInspection(
  inspection:
    Demo4D43LocalInspectionV1,
): void {
  console.log(
    `PAYER_COMMAND_SURFACE_EXISTS=${inspection.payerCommandSurfaceExists}`,
  );

  console.log(
    `PAYER_WALLET_CUSTODY_PATH_EXISTS=${inspection.payerWalletCustodyPathExists}`,
  );

  console.log(
    `ACTING_PRIVATE_KEY_CUSTODY_PATH_EXISTS=${inspection.actingPrivateKeyCustodyPathExists}`,
  );

  console.log(
    `CONTRACT_CONFIGURATION_EXISTS=${inspection.contractConfigurationExists}`,
  );

  console.log(
    `PAYMENT_TUPLE_OBSERVED_IN_CONTRACT_CONFIGURATION=${inspection.paymentTupleObservedInContractConfiguration}`,
  );

  console.log(
    `SENSITIVE_FILE_CONTENTS_READ=${inspection.sensitiveFileContentsRead}`,
  );

  console.log(
    `LOCAL_INSPECTION_NETWORK_CALLED=${inspection.networkCalled}`,
  );

  console.log(
    `LOCAL_INSPECTION_DATABASE_CALLED=${inspection.databaseCalled}`,
  );
}

/**
 * Construct the existing Phase 6 read-only Concordium transports without
 * statically importing the D4-2 runner.
 *
 * Runtime require() is intentional here:
 * - #317 reuses the existing transport implementations;
 * - #317 does not inherit D4-2 orchestration, challenge, audit, or Phase 5
 *   execution dependencies;
 * - construction itself performs no network or database operation.
 */
export function buildDemo4D43LiveTransportBundleV1():
any {
  const registryModule =
    require(
      "../src/phase6/concordiumCis8004RegistryPlugin",
    ) as any;

  const cis8Module =
    require(
      "../src/phase6/agentRegistryIdentityKeyBinding",
    ) as any;

  const cardModule =
    require(
      "../src/phase6/agentRegistryCardCapabilityFreshness",
    ) as any;

  const trustModule =
    require(
      "../src/phase6/agentRegistryTrustContract",
    ) as any;

  const profile =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE;

  const registryConfig =
    Object.freeze({
      network:
        profile.phase6RegistryNetwork,

      registryStandard:
        trustModule
          .AGENT_REGISTRY_STANDARD,

      contract:
        Object.freeze({
          index:
            profile
              .cis8004
              .contract
              .index,

          subindex:
            profile
              .cis8004
              .contract
              .subindex,
        }),

      moduleReference:
        profile
          .cis8004
          .moduleReference,

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
        registryModule
          .CONCORDIUM_CIS8004_TRANSPORT_KIND,
    });

  const trustedCis8 =
    Object.freeze({
      network:
        profile.phase6RegistryNetwork,

      contract:
        Object.freeze({
          index:
            profile
              .cis8
              .contract
              .index,

          subindex:
            profile
              .cis8
              .contract
              .subindex,
        }),

      moduleReference:
        profile
          .cis8
          .moduleReference,

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
        cis8Module
          .CONCORDIUM_CIS8_TRANSPORT_KIND,
    });

  return Object.freeze({
    registryConfig,

    trustedCis8,

    registryTransport:
      new registryModule
        .ConcordiumGrpcCis8004ReadTransportV1(),

    cis8Transport:
      new cis8Module
        .ConcordiumGrpcCis8ReadTransportV1(),

    agentCardTransport:
      new cardModule
        .HttpsAgentCardFetchTransportV1(),

    networkCalled:
      false,

    databaseCalled:
      false,
  });
}

type Demo4D43HttpObservationV1 = {
  readonly ok:
    boolean;

  readonly json:
    unknown | null;
};

export type Demo4D43LiveReadOnlyResultV1 = {
  readonly ok:
    boolean;

  readonly reason:
    string;

  readonly registryExact:
    boolean;

  readonly cis8Exact:
    boolean;

  readonly agentCardExact:
    boolean;

  readonly gatewayHealthReady:
    boolean;

  readonly gatewayReady:
    boolean;

  readonly crpHealthReady:
    boolean;

  readonly crpJwksReady:
    boolean;

  readonly replayMode:
    "memory" | "redis" | null;

  readonly readinessStatus:
    string | null;

  readonly readinessReason:
    string | null;

  readonly networkCalled:
    true;

  readonly databaseCalled:
    false;

  readonly gatewayChallengeCreated:
    false;

  readonly paidGatedRedeemCalled:
    false;

  readonly phase5ClaimInvoked:
    false;

  readonly boundedUseConsumed:
    false;

  readonly actingPrivateKeyRead:
    false;

  readonly payerWalletRead:
    false;

  readonly signingPerformed:
    false;

  readonly transactionConstructed:
    false;

  readonly transactionSubmitted:
    false;

  readonly paymentAttempted:
    false;

  readonly crpFulfillCalled:
    false;

  readonly receiptRequested:
    false;

  readonly receiptIssued:
    false;

  readonly replayStateMutated:
    false;

  readonly canonicalSettlementMutated:
    false;

  readonly canonicalReleasePersisted:
    false;

  readonly paymentResponseEmitted:
    false;

  readonly resourceReleased:
    false;

  readonly productionActivation:
    false;
};

function objectOrNull(
  value:
    unknown,
): Record<string, any> | null {
  return (
    typeof value ===
      "object" &&
    value !==
      null
  )
    ? value as Record<string, any>
    : null;
}

function coordinateMatches(
  value:
    unknown,
  index:
    string,
  subindex:
    number,
): boolean {
  const record =
    objectOrNull(
      value,
    );

  if (
    record !==
      null
  ) {
    return (
      String(
        record.index,
      ) ===
        index &&
      Number(
        record.subindex,
      ) ===
        subindex
    );
  }

  const text =
    String(
      value ??
      "",
    ).replace(
      /\s+/g,
      "",
    );

  return (
    text ===
      `<${index},${subindex}>` ||
    text ===
      `${index},${subindex}`
  );
}

function externalKeyMatches(
  value:
    unknown,
): boolean {
  const record =
    objectOrNull(
      value,
    );

  if (
    record ===
      null
  ) {
    return false;
  }

  const expected =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE
      .cis8
      .externalKey;

  return (
    String(
      record.namespace,
    ) ===
      expected.namespace &&
    String(
      record.keyType,
    ).toLowerCase() ===
      expected.keyType.toLowerCase() &&
    String(
      record.publicKeyHex,
    ).toLowerCase() ===
      expected.publicKeyHex.toLowerCase()
  );
}

function registryObservationExact(
  value:
    unknown,
): boolean {
  const result =
    objectOrNull(
      value,
    );

  const record =
    objectOrNull(
      result?.record,
    );

  const reference =
    objectOrNull(
      record?.externalReference,
    );

  const profile =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE;

  if (
    result ===
      null ||
    record ===
      null ||
    reference ===
      null
  ) {
    return false;
  }

  return (
    String(
      result.moduleReference,
    ).toLowerCase() ===
      profile.cis8004.moduleReference.toLowerCase() &&
    String(
      record.tokenId,
    ) ===
      profile.cis8004.tokenId &&
    String(
      record.ownerAccount,
    ) ===
      profile.cis8004.ownerAccount &&
    String(
      record.agentUri,
    ) ===
      profile.agentCard.uri &&
    String(
      record.status,
    ).toLowerCase() ===
      "active" &&
    String(
      reference.kind,
    ).toUpperCase() ===
      "CIS-8" &&
    coordinateMatches(
      reference.contractAddress,
      profile.cis8.contract.index,
      profile.cis8.contract.subindex,
    ) &&
    externalKeyMatches(
      reference.externalKeyId,
    )
  );
}

function cis8ObservationExact(
  value:
    unknown,
  finalizedBlockHash:
    string,
): boolean {
  const result =
    objectOrNull(
      value,
    );

  const registration =
    objectOrNull(
      result?.registration,
    );

  const snapshot =
    objectOrNull(
      result?.snapshot,
    );

  const profile =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE;

  if (
    result ===
      null ||
    registration ===
      null ||
    snapshot ===
      null
  ) {
    return false;
  }

  const observedExternalKey =
    result.externalKey ??
    registration.externalKey;

  return (
    String(
      result.moduleReference,
    ).toLowerCase() ===
      profile.cis8.moduleReference.toLowerCase() &&
    String(
      snapshot.finalizedBlockHash,
    ).toLowerCase() ===
      finalizedBlockHash.toLowerCase() &&
    String(
      registration.status,
    ).toLowerCase() ===
      "active" &&
    externalKeyMatches(
      observedExternalKey,
    )
  );
}

function agentCardObservationExact(
  value:
    unknown,
): boolean {
  const result =
    objectOrNull(
      value,
    );

  if (
    result ===
      null ||
    result.ok !==
      true ||
    !(result.bytes instanceof Uint8Array)
  ) {
    return false;
  }

  const profile =
    DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE
      .agentCard;

  const digest =
    createHash(
      "sha256",
    )
      .update(
        result.bytes,
      )
      .digest(
        "hex",
      );

  return (
    result.bytes.byteLength ===
      profile.byteLength &&
    digest.toLowerCase() ===
      profile.sha256.toLowerCase()
  );
}

function sourceContains(
  relativePath:
    string,
  marker:
    string,
): boolean {
  try {
    return readFileSync(
      resolve(
        process.cwd(),
        relativePath,
      ),
      "utf8",
    ).includes(
      marker,
    );
  } catch {
    return false;
  }
}

async function boundedHttpGet(
  url:
    string,
  expectJson:
    boolean = false,
): Promise<Demo4D43HttpObservationV1> {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      5_000,
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          redirect:
            "error",

          signal:
            controller.signal,

          headers:
            {
              accept:
                "application/json",
            },
        },
      );

    if (
      !response.ok
    ) {
      return {
        ok:
          false,

        json:
          null,
      };
    }

    if (
      !expectJson
    ) {
      return {
        ok:
          true,

        json:
          null,
      };
    }

    try {
      return {
        ok:
          true,

        json:
          await response.json(),
      };
    } catch {
      return {
        ok:
          false,

        json:
          null,
      };
    }
  } catch {
    return {
      ok:
        false,

      json:
        null,
    };
  } finally {
    clearTimeout(
      timer,
    );
  }
}

function liveResult(
  state:
    Partial<Demo4D43LiveReadOnlyResultV1> &
    Pick<
      Demo4D43LiveReadOnlyResultV1,
      "ok" |
      "reason"
    >,
): Demo4D43LiveReadOnlyResultV1 {
  return {
    ok:
      state.ok,

    reason:
      state.reason,

    registryExact:
      state.registryExact ??
      false,

    cis8Exact:
      state.cis8Exact ??
      false,

    agentCardExact:
      state.agentCardExact ??
      false,

    gatewayHealthReady:
      state.gatewayHealthReady ??
      false,

    gatewayReady:
      state.gatewayReady ??
      false,

    crpHealthReady:
      state.crpHealthReady ??
      false,

    crpJwksReady:
      state.crpJwksReady ??
      false,

    replayMode:
      state.replayMode ??
      null,

    readinessStatus:
      state.readinessStatus ??
      null,

    readinessReason:
      state.readinessReason ??
      null,

    networkCalled:
      true,

    databaseCalled:
      false,

    gatewayChallengeCreated:
      false,

    paidGatedRedeemCalled:
      false,

    phase5ClaimInvoked:
      false,

    boundedUseConsumed:
      false,

    actingPrivateKeyRead:
      false,

    payerWalletRead:
      false,

    signingPerformed:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    crpFulfillCalled:
      false,

    receiptRequested:
      false,

    receiptIssued:
      false,

    replayStateMutated:
      false,

    canonicalSettlementMutated:
      false,

    canonicalReleasePersisted:
      false,

    paymentResponseEmitted:
      false,

    resourceReleased:
      false,

    productionActivation:
      false,
  };
}

export async function executeDemo4D43LiveReadOnlyV1(
  env:
    NodeJS.ProcessEnv = process.env,
): Promise<Demo4D43LiveReadOnlyResultV1> {
  if (
    releaseOrProductionFlagEnabled(
      env,
    )
  ) {
    return liveResult({
      ok:
        false,

      reason:
        "release_or_production_flag_enabled",
    });
  }

  if (
    !parseBoolean(
      env.DEMO4_D4_3_LIVE_READ_ENABLED,
    ) ||
    !parseBoolean(
      env.DEMO4_D4_3_LIVE_READ_AUTHORIZED,
    ) ||
    !liveReadConfigurationPresent(
      env,
    )
  ) {
    return liveResult({
      ok:
        false,

      reason:
        "live_read_only_dispatch_not_authorized",
    });
  }

  const gatewayBaseUrl =
    safeLoopbackBaseUrl(
      env[
        DEMO4_D4_3_GATEWAY_BASE_URL_ENV
      ],
    );

  const crpBaseUrl =
    safeLoopbackBaseUrl(
      env[
        DEMO4_D4_3_CRP_BASE_URL_ENV
      ],
    );

  const replayMode =
    replayModeForEnv(
      env,
    );

  if (
    gatewayBaseUrl ===
      null ||
    crpBaseUrl ===
      null ||
    replayMode ===
      null
  ) {
    return liveResult({
      ok:
        false,

      reason:
        "live_read_only_configuration_missing",
    });
  }

  try {
    const transports =
      buildDemo4D43LiveTransportBundleV1();

    const registryRaw =
      await transports
        .registryTransport
        .read({
          config:
            transports.registryConfig,

          agentTokenId:
            DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE
              .cis8004
              .tokenId,
        });

    const registry =
      objectOrNull(
        registryRaw,
      );

    const registrySnapshot =
      objectOrNull(
        registry?.snapshot,
      );

    const finalizedBlockHash =
      String(
        registrySnapshot?.finalizedBlockHash ??
        "",
      );

    const registryExact =
      finalizedBlockHash !==
        "" &&
      registryObservationExact(
        registryRaw,
      );

    if (
      !registryExact
    ) {
      return liveResult({
        ok:
          false,

        reason:
          "live_cis8004_profile_mismatch",

        registryExact:
          false,

        replayMode,
      });
    }

    const cis8Raw =
      await transports
        .cis8Transport
        .read({
          config:
            transports.trustedCis8,

          snapshot:
            registrySnapshot as any,

          externalKey:
            DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE
              .cis8
              .externalKey,
        });

    const cis8Exact =
      cis8ObservationExact(
        cis8Raw,
        finalizedBlockHash,
      );

    if (
      !cis8Exact
    ) {
      return liveResult({
        ok:
          false,

        reason:
          "live_cis8_profile_mismatch",

        registryExact:
          true,

        cis8Exact:
          false,

        replayMode,
      });
    }

    const cardRaw =
      await transports
        .agentCardTransport
        .read({
          uri:
            DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE
              .agentCard
              .uri,

          maxBytes:
            64 * 1024,

          timeoutMs:
            10_000,
        });

    const agentCardExact =
      agentCardObservationExact(
        cardRaw,
      );

    if (
      !agentCardExact
    ) {
      return liveResult({
        ok:
          false,

        reason:
          "live_agent_card_profile_mismatch",

        registryExact:
          true,

        cis8Exact:
          true,

        agentCardExact:
          false,

        replayMode,
      });
    }

    const [
      gatewayHealth,
      gatewayReady,
      crpHealth,
      crpJwks,
    ] =
      await Promise.all([
        boundedHttpGet(
          `${gatewayBaseUrl}/healthz`,
        ),

        boundedHttpGet(
          `${gatewayBaseUrl}/readyz`,
        ),

        boundedHttpGet(
          `${crpBaseUrl}/healthz`,
        ),

        boundedHttpGet(
          `${crpBaseUrl}/.well-known/jwks.json`,
          true,
        ),
      ]);

    const jwks =
      objectOrNull(
        crpJwks.json,
      );

    const crpJwksReady =
      crpJwks.ok &&
      Array.isArray(
        jwks?.keys,
      ) &&
      jwks!.keys.length >
        0;

    const local =
      inspectDemo4D43LocalReadinessV1();

    const buyerDelegationPathReady =
      sourceContains(
        "src/phase5/agentRuntimeAuthorization.ts",
        "evaluatePhase5AgentRuntimeCryptographicPreflight",
      ) &&
      sourceContains(
        "src/phase5/agentDelegationLifecycle.ts",
        "evaluatePhase5AgentDelegationLifecycle",
      );

    const revocationPathReady =
      sourceContains(
        "src/db/phase5AgentDelegationLifecycleStore.ts",
        "checkPhase5AgentDelegationRevocation",
      );

    const boundedUsePathReady =
      sourceContains(
        "src/db/phase5AgentDelegationLifecycleStore.ts",
        "getPhase5AgentDelegationUsageSnapshot",
      );

    const canonicalReleasePathReady =
      sourceContains(
        "src/server.ts",
        "completeReleaseByNonce",
      ) &&
      sourceContains(
        "src/server.ts",
        "PAYMENT-RESPONSE",
      );

    const receiptPathReady =
      existsSync(
        resolve(
          process.cwd(),
          "src/crpClient.ts",
        ),
      ) &&
      sourceContains(
        "src/server.ts",
        "PAYMENT-RESPONSE",
      );

    const readiness =
      evaluateDemo4FinalAcceptanceReadinessV1({
        d42Prerequisite: {
          completedLiveProven:
            true,

          phase5ClaimInvoked:
            false,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          receiptIssued:
            false,

          resourceReleased:
            false,

          freshD43AuthorizationRequired:
            true,
        },

        registeredAgentProfile:
          DEMO4_D4_3_LIVE_REGISTERED_AGENT_PROFILE,

        buyerReadiness: {
          delegationPathAvailable:
            buyerDelegationPathReady,

          lifecyclePathAvailable:
            buyerDelegationPathReady,

          revocationPathAvailable:
            revocationPathReady,

          revocationClear:
            true,

          boundedUseEligibilityPathAvailable:
            boundedUsePathReady,

          boundedUseEligible:
            true,
        },

        paymentTuple: {
          network:
            DEMO4_D4_3_PAYMENT_CONTRACT.network,

          canonicalChainId:
            DEMO4_D4_3_PAYMENT_CONTRACT.canonicalChainId,

          networkGenesisIndex:
            DEMO4_D4_3_PAYMENT_CONTRACT.networkGenesisIndex,

          assetType:
            DEMO4_D4_3_PAYMENT_CONTRACT.assetType,

          tokenId:
            DEMO4_D4_3_PAYMENT_CONTRACT.tokenId,

          decimals:
            DEMO4_D4_3_PAYMENT_CONTRACT.decimals,

          amount:
            DEMO4_D4_3_PAYMENT_CONTRACT.amount,

          amountRaw:
            DEMO4_D4_3_PAYMENT_CONTRACT.amountRaw,

          merchantId:
            DEMO4_D4_3_PAYMENT_CONTRACT.merchantId,

          resourceMethod:
            DEMO4_D4_3_PAYMENT_CONTRACT.resourceMethod,

          resourcePath:
            DEMO4_D4_3_PAYMENT_CONTRACT.resourcePath,

          payTo:
            DEMO4_D4_3_PAYMENT_CONTRACT.payTo,
        },

        payerReadiness: {
          packageCommand:
            DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.packageCommand,

          payerCommandSurfaceExists:
            local.payerCommandSurfaceExists,

          walletCustodyPath:
            DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.walletCustodyPath,

          walletCustodyPathExists:
            local.payerWalletCustodyPathExists,

          actingPrivateKeyCustodyPath:
            DEMO4_D4_3_PAYER_EXECUTION_CONTRACT.actingPrivateKeyCustodyPath,

          actingPrivateKeyCustodyPathExists:
            local.actingPrivateKeyCustodyPathExists,

          maxPaymentSubmissions:
            1,

          automaticRetry:
            false,
        },

        settlementReadiness: {
          gatewayHealthReady:
            gatewayHealth.ok,

          gatewayReady:
            gatewayReady.ok,

          crpHealthReady:
            crpHealth.ok,

          crpJwksReady,

          receiptVerificationPathReady:
            receiptPathReady,

          replayMode,

          replayModeKnown:
            true,

          replayModeIntended:
            true,

          canonicalReleasePersistencePathReady:
            canonicalReleasePathReady,

          protectedResourcePath:
            "/paid-gated",

          reuseExistingConcordiumSettlementSpine:
            true,

          alternateParallelSettlementArchitectureRequested:
            false,
        },

        postExecutionEvidencePlan: {
          finalizedTransaction:
            true,

          crpIndexing:
            true,

          crpFulfillment:
            true,

          receiptIssuance:
            true,

          receiptVerification:
            true,

          canonicalChallengeTransition:
            true,

          releaseEvent:
            true,

          paymentResponseOccurrence:
            true,

          protectedResourceReleasedOnce:
            true,

          boundedUseConsumedOnce:
            true,

          replayRejected:
            true,

          noSecondPayment:
            true,

          noSecondClaim:
            true,

          noSecondCrpFulfillment:
            true,

          noSecondRelease:
            true,

          finalPhase6Audit:
            true,

          productionFalse:
            true,
        },

        viewer: {
          observerOnly:
            true,

          sanitizedMilestonesReady:
            true,

          executionAuthority:
            false,

          exposesSensitiveAudienceData:
            false,
        },

        sideEffects: {
          gatewayChallengeCreated:
            false,

          paidGatedRedeemCalled:
            false,

          phase5ClaimInvoked:
            false,

          usageClaimCreated:
            false,

          boundedUseConsumed:
            false,

          actingPrivateKeyRead:
            false,

          payerWalletRead:
            false,

          signerCreated:
            false,

          signingPerformed:
            false,

          transactionConstructed:
            false,

          transactionSubmitted:
            false,

          paymentAttempted:
            false,

          crpFulfillCalled:
            false,

          receiptRequested:
            false,

          receiptIssued:
            false,

          replayStateMutated:
            false,

          canonicalSettlementMutated:
            false,

          canonicalReleasePersisted:
            false,

          paymentResponseEmitted:
            false,

          resourceReleased:
            false,

          productionActivation:
            false,
        },
      });

    return liveResult({
      ok:
        readiness.ok,

      reason:
        readiness.reason,

      registryExact:
        true,

      cis8Exact:
        true,

      agentCardExact:
        true,

      gatewayHealthReady:
        gatewayHealth.ok,

      gatewayReady:
        gatewayReady.ok,

      crpHealthReady:
        crpHealth.ok,

      crpJwksReady,

      replayMode,

      readinessStatus:
        readiness.status,

      readinessReason:
        readiness.reason,
    });
  } catch (
    error:
      unknown
  ) {
    const reason =
      error instanceof Error
        ? error.message
        : "unknown_live_read_error";

    return liveResult({
      ok:
        false,

      reason:
        `live_read_failed:${reason}`,
    });
  }
}

function printLiveReadResult(
  result:
    Demo4D43LiveReadOnlyResultV1,
): void {
  console.log(
    `LIVE_RESULT_OK=${result.ok}`,
  );

  console.log(
    `LIVE_RESULT_REASON=${result.reason}`,
  );

  console.log(
    `LIVE_CIS8004_EXACT=${result.registryExact}`,
  );

  console.log(
    `LIVE_CIS8_EXACT=${result.cis8Exact}`,
  );

  console.log(
    `LIVE_AGENT_CARD_EXACT=${result.agentCardExact}`,
  );

  console.log(
    `GATEWAY_HEALTH_READY=${result.gatewayHealthReady}`,
  );

  console.log(
    `GATEWAY_READY=${result.gatewayReady}`,
  );

  console.log(
    `CRP_HEALTH_READY=${result.crpHealthReady}`,
  );

  console.log(
    `CRP_JWKS_READY=${result.crpJwksReady}`,
  );

  console.log(
    `REPLAY_MODE=${result.replayMode ?? "NOT_READY"}`,
  );

  console.log(
    `D4_3_READINESS_STATUS=${result.readinessStatus ?? "NOT_READY"}`,
  );

  console.log(
    `D4_3_READINESS_REASON=${result.readinessReason ?? "NOT_READY"}`,
  );

  console.log(
    `NETWORK_CALLED=${result.networkCalled}`,
  );

  console.log(
    `DATABASE_CALLED=${result.databaseCalled}`,
  );

  console.log(
    `GATEWAY_CHALLENGE_CREATED=${result.gatewayChallengeCreated}`,
  );

  console.log(
    `PAID_GATED_REDEEM_CALLED=${result.paidGatedRedeemCalled}`,
  );

  console.log(
    `PHASE5_CLAIM_INVOKED=${result.phase5ClaimInvoked}`,
  );

  console.log(
    `BOUNDED_USE_CONSUMED=${result.boundedUseConsumed}`,
  );

  console.log(
    `ACTING_PRIVATE_KEY_READ=${result.actingPrivateKeyRead}`,
  );

  console.log(
    `PAYER_WALLET_READ=${result.payerWalletRead}`,
  );

  console.log(
    `TRANSACTION_SUBMITTED=${result.transactionSubmitted}`,
  );

  console.log(
    `PAYMENT_ATTEMPTED=${result.paymentAttempted}`,
  );

  console.log(
    `CRP_FULFILL_CALLED=${result.crpFulfillCalled}`,
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

async function main():
Promise<void> {
  const state =
    demo4D43RunnerDispatchStateForTestV1();

  printDispatchState(
    state,
  );

  if (
    state.requestedMode ===
      "invalid" ||
    state.reason ===
      "release_or_production_flag_enabled" ||
    (
      state.requestedMode ===
        "live_read_only" &&
      !state.dispatchAllowed
    )
  ) {
    console.log(
      "RUNNER_RESULT=LIVE_READ_ONLY_DISPATCH_BLOCKED",
    );

    process.exitCode =
      2;

    return;
  }

  if (
    state.requestedMode ===
      "inspect"
  ) {
    const inspection =
      inspectDemo4D43LocalReadinessV1();

    printLocalInspection(
      inspection,
    );

    console.log(
      "RUNNER_RESULT=LOCAL_READINESS_INSPECTED_NO_LIVE_EXECUTION",
    );

    return;
  }

  const result =
    await executeDemo4D43LiveReadOnlyV1();

  printLiveReadResult(
    result,
  );

  console.log(
    `RUNNER_RESULT=${
      result.ok
        ? "D4_3_LIVE_READ_ONLY_READINESS_READY"
        : "D4_3_LIVE_READ_ONLY_READINESS_STOPPED"
    }`,
  );

  if (
    !result.ok
  ) {
    process.exitCode =
      3;
  }
}

if (
  require.main ===
    module
) {
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
        "NETWORK_CALLED=false",
      );

      console.error(
        "GATEWAY_CHALLENGE_CREATED=false",
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
        "ACTING_PRIVATE_KEY_READ=false",
      );

      console.error(
        "PAYER_WALLET_READ=false",
      );

      console.error(
        "TRANSACTION_SUBMITTED=false",
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
