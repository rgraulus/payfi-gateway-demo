import assert from "node:assert/strict";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REFERENCE_TYPE,
  AGENT_REGISTRY_REQUIREMENT_TYPE,
  AGENT_REGISTRY_STANDARD,
  type AgentRegistryContractCoordinateV1,
  type AgentRegistryReferenceV1,
  type AgentRegistryRequirementV1,
} from "../src/phase6/agentRegistryTrustContract";

import {
  AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE,
  type AgentRegistryResolverSeamResultV1,
  resolveAgentRegistryTrustForGatewayV1,
} from "../src/phase6/agentRegistryResolverSeam";

import {
  CONCORDIUM_CIS8004_READ_RESULT_TYPE,
  CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,
  CONCORDIUM_CIS8004_TRANSPORT_KIND,
  ConcordiumCis8004RegistryPluginV1,
  ConcordiumGrpcCis8004ReadTransportV1,
  normalizeConcordiumCis8004DecodedAgentOfResultForTestV1,
  type ConcordiumCis8004AgentRecordV1,
  type ConcordiumCis8004FinalizedSnapshotV1,
  type ConcordiumCis8004ReadRequestV1,
  type ConcordiumCis8004ReadResultV1,
  type ConcordiumCis8004ReadTransportV1,
  type ConcordiumCis8004TrustedRegistryConfigV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

const LABEL =
  "phase6:concordium-cis8004-registry-plugin-test";

const CONTRACT =
  "phase6.concordiumCis8004RegistryPlugin.v1";

const NETWORK =
  "ccd:testnet";

const OTHER_NETWORK =
  "ccd:testnet-other";

const REGISTRY_CONTRACT:
  AgentRegistryContractCoordinateV1 = {
    index:
      "12802",

    subindex:
      0,
  };

const OTHER_REGISTRY_CONTRACT:
  AgentRegistryContractCoordinateV1 = {
    index:
      "12803",

    subindex:
      0,
  };

const MODULE_REFERENCE =
  "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41";

const OTHER_MODULE_REFERENCE =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const FINALIZED_BLOCK_HASH =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const AGENT_CARD_HASH =
  "e1299b4e1de23375342f4d2de6d19858d5d02217b4a87a526aa06deb539fc1fc";

const TOKEN_ADDRESS =
  "ccd:testnet/cis2:12802-0-0";

const AGENT_CARD_URI =
  "https://example.test/agents/0/.well-known/agent-card.json";

const OWNER_ACCOUNT =
  "4-pr300-owner-account";

const AGENT_WALLET =
  "4-pr300-agent-wallet";

const FIXED_NOW =
  "2026-07-23T22:00:10.000Z";

const SNAPSHOT:
  ConcordiumCis8004FinalizedSnapshotV1 = {
    finalizedBlockHash:
      FINALIZED_BLOCK_HASH,

    finalizedBlockHeight:
      45_893_823,

    observedAt:
      "2026-07-23T22:00:00.000Z",

    finalized:
      true,
  };

const BASE_REQUIREMENT:
  AgentRegistryRequirementV1 = {
    type:
      AGENT_REGISTRY_REQUIREMENT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    required:
      true,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    trustedRegistries: [
      {
        network:
          NETWORK,

        contract:
          REGISTRY_CONTRACT,

        moduleReference:
          MODULE_REFERENCE,
      },
    ],

    requiredStatus:
      "Active",

    requireAgentCardIntegrity:
      false,

    requiredCapabilities: [],

    requireOwnerAccountBinding:
      true,

    requireVerifiedOwnerIdentity:
      false,

    externalKeyPolicy:
      "optional",

    maxEvidenceAgeSeconds:
      300,

    revalidateBeforeReleaseIfOlderThanSeconds:
      120,
  };

const BASE_REFERENCE:
  AgentRegistryReferenceV1 = {
    type:
      AGENT_REGISTRY_REFERENCE_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    registryStandard:
      AGENT_REGISTRY_STANDARD,

    network:
      NETWORK,

    registryContract:
      REGISTRY_CONTRACT,

    agentTokenId:
      "0",

    tokenAddress:
      TOKEN_ADDRESS,
  };

const ACTIVE_RECORD:
  ConcordiumCis8004AgentRecordV1 = {
    tokenId:
      "0",

    ownerAccount:
      OWNER_ACCOUNT,

    agentUri:
      AGENT_CARD_URI,

    metadataHash:
      AGENT_CARD_HASH,

    externalReference:
      "external:pr300:agent-0",

    agentWallet:
      AGENT_WALLET,

    status:
      "Active",

    registeredAt:
      "2026-07-20T12:00:00.000Z",

    revokedAt:
      null,

    revocationReason:
      null,
  };

const REVOKED_RECORD:
  ConcordiumCis8004AgentRecordV1 = {
    ...ACTIVE_RECORD,

    status:
      "Revoked",

    revokedAt:
      "2026-07-22T12:00:00.000Z",

    revocationReason:
      "test-revocation",
  };

type TransportOperation =
  (
    request:
      ConcordiumCis8004ReadRequestV1,
  ) =>
    unknown |
    Promise<unknown>;

class CountingReadTransport
implements ConcordiumCis8004ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8004_TRANSPORT_KIND;

  calls =
    0;

  readonly requests:
    ConcordiumCis8004ReadRequestV1[] = [];

  constructor(
    private readonly operation:
      TransportOperation,
  ) {}

  async read(
    request:
      ConcordiumCis8004ReadRequestV1,
  ): Promise<unknown> {
    this.calls +=
      1;

    this.requests.push(
      request,
    );

    return await this.operation(
      request,
    );
  }
}

type RunOptions = {
  readonly operation:
    TransportOperation;

  readonly requirement?:
    AgentRegistryRequirementV1;

  readonly reference?:
    AgentRegistryReferenceV1;

  readonly config?:
    ConcordiumCis8004TrustedRegistryConfigV1;
};

type RunContext = {
  readonly result:
    AgentRegistryResolverSeamResultV1;

  readonly transport:
    CountingReadTransport;

  readonly resolver:
    ConcordiumCis8004RegistryPluginV1;
};

type AcceptanceCase = {
  readonly name:
    string;

  readonly category:
    "positive" |
    "negative" |
    "safety";

  readonly status:
    string;

  readonly reason:
    string;

  readonly resolverInvoked:
    boolean;

  readonly transportCalls:
    number;
};

const acceptanceCases:
  AcceptanceCase[] = [];

function makeReadResult(
  options: {
    readonly network?:
      string;

    readonly registryContract?:
      AgentRegistryContractCoordinateV1;

    readonly moduleReference?:
      string;

    readonly snapshot?:
      ConcordiumCis8004FinalizedSnapshotV1;

    readonly record?:
      ConcordiumCis8004AgentRecordV1 | null;
  } = {},
): ConcordiumCis8004ReadResultV1 {
  return {
    type:
      CONCORDIUM_CIS8004_READ_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    network:
      options.network ??
      NETWORK,

    registryContract:
      options.registryContract ??
      REGISTRY_CONTRACT,

    moduleReference:
      options.moduleReference ??
      MODULE_REFERENCE,

    snapshot:
      options.snapshot ??
      SNAPSHOT,

    record:
      options.record ===
        undefined
        ? ACTIVE_RECORD
        : options.record,
  };
}

function makeRecord(
  overrides:
    Partial<ConcordiumCis8004AgentRecordV1>,
): ConcordiumCis8004AgentRecordV1 {
  return {
    ...ACTIVE_RECORD,
    ...overrides,
  };
}

function makeReference(
  overrides:
    Partial<AgentRegistryReferenceV1>,
): AgentRegistryReferenceV1 {
  return {
    ...BASE_REFERENCE,
    ...overrides,
  };
}

function fixedClock():
  Date {
  return new Date(
    FIXED_NOW,
  );
}

async function run(
  options:
    RunOptions,
): Promise<RunContext> {
  const transport =
    new CountingReadTransport(
      options.operation,
    );

  const resolver =
    new ConcordiumCis8004RegistryPluginV1(
      transport,
      options.config ??
        CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,
      fixedClock,
    );

  const result =
    await resolveAgentRegistryTrustForGatewayV1({
      requirement:
        options.requirement ??
        BASE_REQUIREMENT,

      reference:
        options.reference ??
        BASE_REFERENCE,

      resolver,
    });

  return {
    result,
    transport,
    resolver,
  };
}

function assertSafety(
  result:
    AgentRegistryResolverSeamResultV1,
  expectedResolverInvoked:
    boolean,
  context:
    string,
): void {
  assert.equal(
    result.mode,
    AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE,
    context,
  );

  assert.equal(
    result.resolverInvoked,
    expectedResolverInvoked,
    context,
  );

  assert.equal(
    result.fixtureResolverInvoked,
    false,
    context,
  );

  assert.equal(
    result.concordiumResolverInvoked,
    expectedResolverInvoked,
    context,
  );

  assert.equal(
    result.registryNetworkCalled,
    expectedResolverInvoked,
    context,
  );

  assert.equal(
    result.agentRegistryLookupAttempted,
    expectedResolverInvoked,
    context,
  );

  for (
    const marker of [
      "gatewayRuntimeCalled",
      "gatewayRuntimeChanged",
      "phase5StateMutated",
      "canonicalStateMutated",
      "boundedUseConsumed",
      "replayStateMutated",
      "ufxCalled",
      "crpCalled",
      "paymentAttempted",
      "receiptIssued",
      "paymentResponseEmitted",
      "resourceReleased",
      "productionActivation",
    ] as const
  ) {
    assert.equal(
      result[marker],
      false,
      `${context}:${marker}`,
    );
  }
}

function assertOutcome(
  context:
    RunContext,
  expected: {
    readonly ok:
      boolean;

    readonly status:
      AgentRegistryResolverSeamResultV1["status"];

    readonly reason:
      AgentRegistryResolverSeamResultV1["reason"];

    readonly resolverInvoked:
      boolean;

    readonly transportCalls:
      number;

    readonly trustSatisfied:
      boolean | null;

    readonly trustResultPresent:
      boolean;
  },
  name:
    string,
): void {
  assert.equal(
    context.result.ok,
    expected.ok,
    name,
  );

  assert.equal(
    context.result.status,
    expected.status,
    name,
  );

  assert.equal(
    context.result.reason,
    expected.reason,
    name,
  );

  assert.equal(
    context.transport.calls,
    expected.transportCalls,
    name,
  );

  assert.equal(
    context.result.registryTrustSatisfied,
    expected.trustSatisfied,
    name,
  );

  assert.equal(
    context.result.trustResult !==
      null,
    expected.trustResultPresent,
    name,
  );

  assertSafety(
    context.result,
    expected.resolverInvoked,
    name,
  );
}

function addCase(
  name:
    string,
  category:
    AcceptanceCase["category"],
  context:
    RunContext,
): void {
  acceptanceCases.push({
    name,
    category,

    status:
      context.result.status,

    reason:
      context.result.reason,

    resolverInvoked:
      context.result.resolverInvoked,

    transportCalls:
      context.transport.calls,
  });
}

function requireTrustResult(
  context:
    RunContext,
  name:
    string,
): NonNullable<
  AgentRegistryResolverSeamResultV1["trustResult"]
> {
  assert.notEqual(
    context.result.trustResult,
    null,
    name,
  );

  if (
    context.result.trustResult ===
      null
  ) {
    throw new Error(
      `${name}:trust_result_missing`,
    );
  }

  return context.result.trustResult;
}

const LIVE_SMOKE_FLAG =
  "--live-smoke";

const LIVE_MISSING_TOKEN_ID =
  "18446744073709551615";

function requireLiveTrustResult(
  result:
    AgentRegistryResolverSeamResultV1,
  context:
    string,
): NonNullable<
  AgentRegistryResolverSeamResultV1["trustResult"]
> {
  assert.notEqual(
    result.trustResult,
    null,
    context,
  );

  if (
    result.trustResult ===
      null
  ) {
    throw new Error(
      `${context}:trust_result_missing`,
    );
  }

  return result.trustResult;
}

function assertLiveFinalizedSnapshot(
  result:
    AgentRegistryResolverSeamResultV1,
  context:
    string,
): void {
  const trustResult =
    requireLiveTrustResult(
      result,
      context,
    );

  assert.equal(
    trustResult.freshness.source,
    "direct_chain",
    context,
  );

  assert.match(
    trustResult.freshness.finalizedBlockHash ??
      "",
    /^[0-9a-f]{64}$/,
    context,
  );

  assert.ok(
    typeof trustResult.freshness.finalizedBlockHeight ===
      "number" &&
    Number.isSafeInteger(
      trustResult.freshness.finalizedBlockHeight,
    ),
    context,
  );

  assert.ok(
    trustResult.freshness.observedAt !==
      null &&
    Number.isFinite(
      Date.parse(
        trustResult.freshness.observedAt,
      ),
    ),
    context,
  );

  assert.equal(
    trustResult.freshness.indexerLagBlocks,
    null,
    context,
  );
}

async function liveSmoke():
  Promise<void> {
  assert.equal(
    process.argv
      .slice(2)
      .filter(
        (argument) =>
          argument ===
            LIVE_SMOKE_FLAG,
      )
      .length,
    1,
    "exactly one explicit --live-smoke flag is required",
  );

  const resolver =
    new ConcordiumCis8004RegistryPluginV1(
      new ConcordiumGrpcCis8004ReadTransportV1(),
    );

  const sdkBigintHashBytes =
    Array.from(
      Buffer.from(
        AGENT_CARD_HASH,
        "hex",
      ),
      (byte) =>
        BigInt(
          byte,
        ),
    );

  const sdkDecodedRecord =
    normalizeConcordiumCis8004DecodedAgentOfResultForTestV1({
      Some: [
        {
          token_id:
            "0000000000000000",

          owner_account:
            OWNER_ACCOUNT,

          agent_uri: {
            Some: [
              AGENT_CARD_URI,
            ],
          },

          metadata_hash: {
            Some: [
              sdkBigintHashBytes,
            ],
          },

          external_reference: {
            None: [],
          },

          agent_wallet: {
            Some: [
              AGENT_WALLET,
            ],
          },

          status: {
            Active: [],
          },

          registered_at:
            "2026-07-20T12:00:00.000Z",

          revoked_at: {
            None: [],
          },

          revocation_reason: {
            None: [],
          },

          on_chain_metadata: [],
        },
      ],
    });

  assert.equal(
    sdkDecodedRecord?.metadataHash,
    AGENT_CARD_HASH,
    "SDK bigint metadata-hash bytes normalize to lowercase hex",
  );

  const active =
    await resolveAgentRegistryTrustForGatewayV1({
      requirement:
        BASE_REQUIREMENT,

      reference:
        BASE_REFERENCE,

      resolver,
    });

  assert.equal(
    active.ok,
    true,
    "live active token",
  );

  assert.equal(
    active.status,
    "resolved",
    "live active token",
  );

  assert.equal(
    active.reason,
    "agent_registry_verified",
    "live active token",
  );

  assert.equal(
    active.registryTrustSatisfied,
    true,
    "live active token",
  );

  const activeTrust =
    requireLiveTrustResult(
      active,
      "live active token",
    );

  assert.equal(
    activeTrust.identity.agentTokenId,
    "0",
  );

  assert.equal(
    activeTrust.identity.moduleReference,
    MODULE_REFERENCE,
  );

  assert.equal(
    activeTrust.state.status,
    "Active",
  );

  assert.equal(
    activeTrust.state.ownerAccountBound,
    true,
  );

  assert.equal(
    activeTrust.state.ownerIdentityAssurance,
    "not_evaluated",
  );

  assert.equal(
    activeTrust.agentCard.integrityVerified,
    false,
  );

  assertLiveFinalizedSnapshot(
    active,
    "live active token",
  );

  assertSafety(
    active,
    true,
    "live active token",
  );

  const missingReference =
    makeReference({
      agentTokenId:
        LIVE_MISSING_TOKEN_ID,

      tokenAddress:
        `ccd:testnet/cis2:12802-0-${LIVE_MISSING_TOKEN_ID}`,
    });

  const missing =
    await resolveAgentRegistryTrustForGatewayV1({
      requirement:
        BASE_REQUIREMENT,

      reference:
        missingReference,

      resolver,
    });

  assert.equal(
    missing.ok,
    true,
    "live missing token",
  );

  assert.equal(
    missing.status,
    "resolved",
    "live missing token",
  );

  assert.equal(
    missing.reason,
    "agent_not_registered",
    "live missing token",
  );

  assert.equal(
    missing.registryTrustSatisfied,
    false,
    "live missing token",
  );

  const missingTrust =
    requireLiveTrustResult(
      missing,
      "live missing token",
    );

  assert.equal(
    missingTrust.identity.agentTokenId,
    LIVE_MISSING_TOKEN_ID,
  );

  assert.equal(
    missingTrust.state.status,
    "Missing",
  );

  assertLiveFinalizedSnapshot(
    missing,
    "live missing token",
  );

  assertSafety(
    missing,
    true,
    "live missing token",
  );

  console.log(
    JSON.stringify(
      {
        ok:
          true,

        label:
          "phase6:concordium-cis8004-registry-plugin-live-smoke",

        mode:
          AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE,

        network:
          NETWORK,

        registryContract:
          REGISTRY_CONTRACT,

        moduleReference:
          MODULE_REFERENCE,

        active: {
          tokenId:
            "0",

          status:
            activeTrust.state.status,

          ownerAccountPresent:
            activeTrust.state.ownerAccount !==
            null,

          agentWalletPresent:
            activeTrust.state.agentWallet !==
            null,

          agentUriPresent:
            activeTrust.agentCard.uri !==
            null,

          metadataHashPresent:
            activeTrust.agentCard.hash !==
            null,

          finalizedBlockHash:
            activeTrust.freshness.finalizedBlockHash,

          finalizedBlockHeight:
            activeTrust.freshness.finalizedBlockHeight,

          observedAt:
            activeTrust.freshness.observedAt,
        },

        missing: {
          tokenId:
            LIVE_MISSING_TOKEN_ID,

          status:
            missingTrust.state.status,

          finalizedBlockHash:
            missingTrust.freshness.finalizedBlockHash,

          finalizedBlockHeight:
            missingTrust.freshness.finalizedBlockHeight,

          observedAt:
            missingTrust.freshness.observedAt,
        },

        safety: {
          transactionSubmitted:
            false,

          signingKeyUsed:
            false,

          agentUriFetched:
            false,

          persistenceUsed:
            false,

          gatewayRuntimeChanged:
            false,

          phase5StateMutated:
            false,

          paymentAttempted:
            false,

          receiptIssued:
            false,

          resourceReleased:
            false,

          productionActivation:
            false,
        },
      },
      null,
      2,
    ),
  );

  console.log(
    "PR300_LIVE_SMOKE_EXPLICIT_OPT_IN=true",
  );

  console.log(
    "PR300_LIVE_ACTIVE_TOKEN_VERIFIED=true",
  );

  console.log(
    "PR300_LIVE_MISSING_TOKEN_VERIFIED=true",
  );

  console.log(
    "PR300_LIVE_MODULE_PIN_VERIFIED=true",
  );

  console.log(
    "PR300_LIVE_FINALIZED_SNAPSHOTS_VERIFIED=true",
  );

  console.log(
    "PR300_LIVE_NO_TRANSACTION=true",
  );

  console.log(
    "PR300_LIVE_NO_SIGNING_KEY=true",
  );

  console.log(
    "PR300_LIVE_AGENT_URI_NOT_FETCHED=true",
  );

  console.log(
    "PR300_LIVE_SMOKE_ACCEPTANCE=true",
  );
}

async function main():
  Promise<void> {
  const active =
    await run({
      operation:
        () =>
          makeReadResult(),
    });

  assertOutcome(
    active,
    {
      ok:
        true,

      status:
        "resolved",

      reason:
        "agent_registry_verified",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        true,

      trustResultPresent:
        true,
    },
    "active registry record",
  );

  const activeTrust =
    requireTrustResult(
      active,
      "active registry record",
    );

  assert.equal(
    activeTrust.state.status,
    "Active",
  );

  addCase(
    "active record resolves from one finalized snapshot",
    "positive",
    active,
  );

  assert.equal(
    activeTrust.state.ownerAccount,
    OWNER_ACCOUNT,
  );

  assert.equal(
    activeTrust.state.ownerAccountBound,
    true,
  );

  assert.equal(
    activeTrust.state.ownerIdentityAssurance,
    "not_evaluated",
  );

  assert.equal(
    activeTrust.state.agentWallet,
    AGENT_WALLET,
  );

  addCase(
    "owner account and wallet are normalized",
    "positive",
    active,
  );

  assert.equal(
    activeTrust.identity.moduleReference,
    MODULE_REFERENCE,
  );

  addCase(
    "trusted module reference is preserved",
    "positive",
    active,
  );

  assert.equal(
    activeTrust.agentCard.uri,
    AGENT_CARD_URI,
  );

  assert.equal(
    activeTrust.agentCard.hash,
    AGENT_CARD_HASH,
  );

  assert.equal(
    activeTrust.agentCard.integrityVerified,
    false,
  );

  addCase(
    "agent card URI and hash remain opaque unverified facts",
    "positive",
    active,
  );

  assert.equal(
    activeTrust.freshness.source,
    "direct_chain",
  );

  assert.equal(
    activeTrust.freshness.finalizedBlockHash,
    FINALIZED_BLOCK_HASH,
  );

  assert.equal(
    activeTrust.freshness.finalizedBlockHeight,
    SNAPSHOT.finalizedBlockHeight,
  );

  assert.equal(
    activeTrust.freshness.observedAt,
    SNAPSHOT.observedAt,
  );

  assert.equal(
    activeTrust.freshness.evidenceAgeSeconds,
    10,
  );

  assert.equal(
    activeTrust.freshness.indexerLagBlocks,
    null,
  );

  assert.equal(
    activeTrust.freshness.fresh,
    true,
  );

  addCase(
    "finalized hash height and observation time are normalized",
    "positive",
    active,
  );

  assert.equal(
    active.transport.requests.length,
    1,
  );

  assert.equal(
    active
      .transport
      .requests[0]
      .agentTokenId,
    "0",
  );

  assert.equal(
    activeTrust
      .freshness
      .finalizedBlockHash,
    SNAPSHOT.finalizedBlockHash,
  );

  addCase(
    "all normalized facts use one transport snapshot",
    "positive",
    active,
  );

  const revoked =
    await run({
      operation:
        () =>
          makeReadResult({
            record:
              REVOKED_RECORD,
          }),
    });

  assertOutcome(
    revoked,
    {
      ok:
        true,

      status:
        "resolved",

      reason:
        "agent_registry_revoked",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        false,

      trustResultPresent:
        true,
    },
    "revoked registry record",
  );

  const revokedTrust =
    requireTrustResult(
      revoked,
      "revoked registry record",
    );

  assert.equal(
    revokedTrust.state.status,
    "Revoked",
  );

  addCase(
    "revoked record maps to a coherent negative result",
    "negative",
    revoked,
  );

  const missing =
    await run({
      operation:
        () =>
          makeReadResult({
            record:
              null,
          }),
    });

  assertOutcome(
    missing,
    {
      ok:
        true,

      status:
        "resolved",

      reason:
        "agent_not_registered",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        false,

      trustResultPresent:
        true,
    },
    "missing registry record",
  );

  assert.equal(
    requireTrustResult(
      missing,
      "missing registry record",
    ).state.status,
    "Missing",
  );

  addCase(
    "missing token maps to agent_not_registered",
    "negative",
    missing,
  );

  const unsupportedNetwork =
    await run({
      reference:
        makeReference({
          network:
            OTHER_NETWORK,

          tokenAddress:
            "ccd:testnet-other/cis2:12802-0-0",
        }),

      operation:
        () => {
          throw new Error(
            "unsupported_network_transport_must_not_run",
          );
        },
    });

  assertOutcome(
    unsupportedNetwork,
    {
      ok:
        false,

      status:
        "rejected",

      reason:
        "untrusted_registry_contract",

      resolverInvoked:
        false,

      transportCalls:
        0,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "unsupported network pre-transport",
  );

  addCase(
    "unsupported network fails before transport",
    "negative",
    unsupportedNetwork,
  );

  const wrongContract =
    await run({
      reference:
        makeReference({
          registryContract:
            OTHER_REGISTRY_CONTRACT,

          tokenAddress:
            "ccd:testnet/cis2:12803-0-0",
        }),

      operation:
        () => {
          throw new Error(
            "wrong_contract_transport_must_not_run",
          );
        },
    });

  assertOutcome(
    wrongContract,
    {
      ok:
        false,

      status:
        "rejected",

      reason:
        "untrusted_registry_contract",

      resolverInvoked:
        false,

      transportCalls:
        0,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "wrong contract pre-transport",
  );

  addCase(
    "wrong contract fails before transport",
    "negative",
    wrongContract,
  );

  const moduleMismatch =
    await run({
      operation:
        () =>
          makeReadResult({
            moduleReference:
              OTHER_MODULE_REFERENCE,
          }),
    });

  assertOutcome(
    moduleMismatch,
    {
      ok:
        false,

      status:
        "rejected",

      reason:
        "agent_registry_contract_mismatch",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "module mismatch",
  );

  addCase(
    "module mismatch fails closed",
    "negative",
    moduleMismatch,
  );

  const contractMissing =
    await run({
      operation:
        async () => {
          throw new Error(
            "cis8004_contract_not_found",
          );
        },
    });

  assertOutcome(
    contractMissing,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "contract missing",
  );

  addCase(
    "missing contract fails unavailable",
    "negative",
    contractMissing,
  );

  const invocationFailure =
    await run({
      operation:
        async () => {
          throw new Error(
            "cis8004_agentof_invocation_failed",
          );
        },
    });

  assertOutcome(
    invocationFailure,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "invocation failure",
  );

  addCase(
    "agentOf invocation failure is unavailable",
    "negative",
    invocationFailure,
  );

  const timeoutConfig:
    ConcordiumCis8004TrustedRegistryConfigV1 = {
      ...CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,

      timeoutMs:
        20,
    };

  const timeout =
    await run({
      config:
        timeoutConfig,

      operation:
        () =>
          new Promise<never>(
            () => {
              // Intentionally never resolves.
            },
          ),
    });

  assertOutcome(
    timeout,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "transport timeout",
  );

  addCase(
    "transport timeout fails unavailable",
    "negative",
    timeout,
  );

  const malformed =
    await run({
      operation:
        () =>
          ({
            malformed:
              true,
          }),
    });

  assertOutcome(
    malformed,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "malformed transport result",
  );

  addCase(
    "malformed transport result fails closed",
    "negative",
    malformed,
  );

  const contradictoryStatus =
    await run({
      operation:
        () =>
          makeReadResult({
            record:
              makeRecord({
                status:
                  "Active",

                revokedAt:
                  "2026-07-22T12:00:00.000Z",

                revocationReason:
                  "contradictory-active-record",
              }),
          }),
    });

  assertOutcome(
    contradictoryStatus,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "contradictory status",
  );

  addCase(
    "contradictory status and revocation facts fail closed",
    "negative",
    contradictoryStatus,
  );

  const contradictoryOwner =
    await run({
      operation:
        () =>
          makeReadResult({
            record:
              makeRecord({
                ownerAccount:
                  " ",
              }),
          }),
    });

  assertOutcome(
    contradictoryOwner,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "invalid owner",
  );

  addCase(
    "malformed owner fact fails closed",
    "negative",
    contradictoryOwner,
  );

  const tokenSubstitution =
    await run({
      operation:
        () =>
          makeReadResult({
            record:
              makeRecord({
                tokenId:
                  "1",
              }),
          }),
    });

  assertOutcome(
    tokenSubstitution,
    {
      ok:
        false,

      status:
        "rejected",

      reason:
        "agent_registry_identity_mismatch",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "token substitution",
  );

  addCase(
    "token substitution is rejected by the Gateway adapter",
    "negative",
    tokenSubstitution,
  );

  const transportException =
    await run({
      operation:
        () => {
          throw new Error(
            "deterministic_transport_exception",
          );
        },
    });

  assertOutcome(
    transportException,
    {
      ok:
        false,

      status:
        "unavailable",

      reason:
        "agent_registry_resolver_unavailable",

      resolverInvoked:
        true,

      transportCalls:
        1,

      trustSatisfied:
        null,

      trustResultPresent:
        false,
    },
    "transport exception",
  );

  addCase(
    "transport exception maps to unavailable",
    "negative",
    transportException,
  );

  const directTransport =
    new ConcordiumGrpcCis8004ReadTransportV1();

  assert.equal(
    directTransport.kind,
    CONCORDIUM_CIS8004_TRANSPORT_KIND,
  );

  const directTransportMethods =
    Object
      .getOwnPropertyNames(
        Object.getPrototypeOf(
          directTransport,
        ),
      )
      .filter(
        (name) =>
          name !==
          "constructor",
      )
      .sort();

  assert.deepEqual(
    directTransportMethods,
    [
      "read",
    ],
  );

  acceptanceCases.push({
    name:
      "direct transport exposes a read-only surface",

    category:
      "safety",

    status:
      "accepted",

    reason:
      "read_only_transport",

    resolverInvoked:
      false,

    transportCalls:
      0,
  });

  assert.equal(
    acceptanceCases.length,
    20,
  );

  const positiveCaseCount =
    acceptanceCases.filter(
      (testCase) =>
        testCase.category ===
        "positive",
    ).length;

  const negativeCaseCount =
    acceptanceCases.filter(
      (testCase) =>
        testCase.category ===
        "negative",
    ).length;

  const safetyCaseCount =
    acceptanceCases.filter(
      (testCase) =>
        testCase.category ===
        "safety",
    ).length;

  assert.equal(
    positiveCaseCount,
    6,
  );

  assert.equal(
    negativeCaseCount,
    13,
  );

  assert.equal(
    safetyCaseCount,
    1,
  );

  const acceptanceMarkers = {
    PR300_PINNED_TESTNET_CONFIGURATION:
      true,

    PR300_DIRECT_CHAIN_READ_TRANSPORT:
      true,

    PR300_ONE_FINALIZED_SNAPSHOT:
      true,

    PR300_ACTIVE_RECORD_NORMALIZED:
      true,

    PR300_REVOKED_RECORD_NORMALIZED:
      true,

    PR300_MISSING_RECORD_NORMALIZED:
      true,

    PR300_OWNER_ACCOUNT_BOUND:
      true,

    PR300_MODULE_PIN_ENFORCED:
      true,

    PR300_AGENT_CARD_FACTS_OPAQUE:
      true,

    PR300_AGENT_CARD_INTEGRITY_NOT_CLAIMED:
      true,

    PR300_FINALIZED_HASH_HEIGHT_TIME_PRESENT:
      true,

    PR300_UNSUPPORTED_NETWORK_PRETRANSPORT:
      true,

    PR300_WRONG_CONTRACT_PRETRANSPORT:
      true,

    PR300_MODULE_MISMATCH_FAILS_CLOSED:
      true,

    PR300_CONTRACT_MISSING_FAILS_CLOSED:
      true,

    PR300_INVOCATION_FAILURE_FAILS_CLOSED:
      true,

    PR300_TIMEOUT_FAILS_CLOSED:
      true,

    PR300_MALFORMED_RESULT_FAILS_CLOSED:
      true,

    PR300_CONTRADICTORY_RESULT_FAILS_CLOSED:
      true,

    PR300_TOKEN_SUBSTITUTION_REJECTED:
      true,

    PR300_TRANSPORT_EXCEPTION_UNAVAILABLE:
      true,

    PR300_GATEWAY_RUNTIME_CHANGED:
      false,

    PR300_PHASE5_STATE_MUTATED:
      false,

    PR300_CANONICAL_STATE_MUTATED:
      false,

    PR300_UFX_CALLED:
      false,

    PR300_CRP_CALLED:
      false,

    PR300_PAYMENT_ATTEMPTED:
      false,

    PR300_RECEIPT_ISSUED:
      false,

    PR300_PAYMENT_RESPONSE_EMITTED:
      false,

    PR300_RESOURCE_RELEASED:
      false,

    PR300_PRODUCTION_ACTIVATION:
      false,

    PR300_DETERMINISTIC_ACCEPTANCE:
      true,
  } as const;

  const summary = {
    ok:
      true,

    label:
      LABEL,

    contract:
      CONTRACT,

    mode:
      AGENT_REGISTRY_CONCORDIUM_CIS8004_RESOLVER_MODE,

    network:
      NETWORK,

    registryContract:
      REGISTRY_CONTRACT,

    moduleReference:
      MODULE_REFERENCE,

    transport:
      CONCORDIUM_CIS8004_TRANSPORT_KIND,

    caseCount:
      acceptanceCases.length,

    positiveCaseCount,
    negativeCaseCount,
    safetyCaseCount,

    cases:
      acceptanceCases,

    safety: {
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
    },

    acceptanceMarkers,
  };

  console.log(
    JSON.stringify(
      summary,
      null,
      2,
    ),
  );

  for (
    const [
      marker,
      value,
    ] of Object.entries(
      acceptanceMarkers,
    )
  ) {
    console.log(
      `${marker}=${value}`,
    );
  }
}

const selectedRun =
  process.argv
    .slice(2)
    .includes(
      LIVE_SMOKE_FLAG,
    )
    ? liveSmoke
    : main;

selectedRun().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
