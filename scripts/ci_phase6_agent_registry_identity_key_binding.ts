import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  type AgentRegistryContractCoordinateV1,
} from "../src/phase6/agentRegistryTrustContract";

import {
  CONCORDIUM_CIS8004_READ_RESULT_TYPE,
  type ConcordiumCis8004ExternalReferenceV1,
  type ConcordiumCis8004FinalizedSnapshotV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,
  AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,
  CONCORDIUM_CIS8_READ_RESULT_TYPE,
  CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG,
  CONCORDIUM_CIS8_TRANSPORT_KIND,
  bindAgentRegistryIdentityToPhase5ActingKeyV1,
  type AgentRegistryExternalKeyPolicyV1,
  type AgentRegistryIdentityKeyBindingResultV1,
  type ConcordiumCis8ExternalKeyIdV1,
  type ConcordiumCis8FinalizedReadResultV1,
  type ConcordiumCis8ReadRequestV1,
  type ConcordiumCis8ReadTransportV1,
  type ConcordiumCis8RegistrationV1,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

import {
  hashBuyerToAgentDelegationCredential,
  type BuyerToAgentDelegationCredentialDocument,
} from "../src/phase5/buyerToAgentDelegationCredential";

const LABEL =
  "phase6:agent-registry-identity-key-binding-test";

const CONTRACT =
  "phase6.agentRegistryIdentityKeyBinding.v1";

const NETWORK =
  "ccd:testnet";

const AGENT_TOKEN_ID =
  "0";

const OWNER_ACCOUNT =
  "4-pr301-owner-account";

const REGISTRY_CONTRACT:
  AgentRegistryContractCoordinateV1 = {
    index:
      "12802",

    subindex:
      0,
  };

const REGISTRY_MODULE_REFERENCE =
  "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41";

const FINALIZED_BLOCK_HASH =
  "aa".repeat(
    32,
  );

const OTHER_FINALIZED_BLOCK_HASH =
  "bb".repeat(
    32,
  );

const FIXTURE_PATH =
  "fixtures/phase5/delegation/buyer-to-agent-delegation.valid.example.json";

const DELEGATION_DOCUMENT =
  JSON.parse(
    readFileSync(
      FIXTURE_PATH,
      "utf8",
    ),
  ) as
    BuyerToAgentDelegationCredentialDocument;

const CREDENTIAL_HASH =
  hashBuyerToAgentDelegationCredential(
    DELEGATION_DOCUMENT.credential,
  );

const AGENT_ID =
  DELEGATION_DOCUMENT
    .credential
    .subject
    .agentId;

const AGENT_KEY_ID =
  DELEGATION_DOCUMENT
    .credential
    .subject
    .agentKeyId;

const ACTING_PUBLIC_KEY_HEX =
  Buffer.from(
    DELEGATION_DOCUMENT
      .credential
      .subject
      .agentPublicKeyJwk
      .x,
    "base64url",
  ).toString(
    "hex",
  );

const EXPECTED_KEY_FINGERPRINT =
  `sha256:${
    createHash(
      "sha256",
    )
      .update(
        Buffer.from(
          ACTING_PUBLIC_KEY_HEX,
          "hex",
        ),
      )
      .digest(
        "hex",
      )
  }`;

const FINALIZED_SNAPSHOT:
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

const OTHER_FINALIZED_SNAPSHOT:
  ConcordiumCis8004FinalizedSnapshotV1 = {
    ...FINALIZED_SNAPSHOT,

    finalizedBlockHash:
      OTHER_FINALIZED_BLOCK_HASH,
  };

const CIS8_EXTERNAL_KEY:
  ConcordiumCis8ExternalKeyIdV1 = {
    namespace:
      "xcf:phase5",

    keyType:
      "ed25519",

    publicKeyHex:
      ACTING_PUBLIC_KEY_HEX,
  };

const CIS8_EXTERNAL_REFERENCE:
  ConcordiumCis8004ExternalReferenceV1 = {
    contractAddress:
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .contract,

    kind:
      "CIS-8",

    externalKeyId:
      CIS8_EXTERNAL_KEY,
  };

const ACTIVE_CIS8_REGISTRATION:
  ConcordiumCis8RegistrationV1 = {
    externalKey:
      CIS8_EXTERNAL_KEY,

    owner:
      OWNER_ACCOUNT,

    proofScheme:
      "ed25519-signature",

    status:
      "Active",

    lastUpdated:
      "2026-07-23T21:59:00.000Z",

    metadata:
      [],
  };

class CountingCis8ReadTransport
implements ConcordiumCis8ReadTransportV1 {
  readonly kind =
    CONCORDIUM_CIS8_TRANSPORT_KIND;

  calls =
    0;

  readonly requests:
    ConcordiumCis8ReadRequestV1[] = [];

  constructor(
    private readonly output:
      unknown,

    private readonly failure:
      Error | null = null,
  ) {}

  async read(
    request:
      ConcordiumCis8ReadRequestV1,
  ): Promise<unknown> {
    this.calls +=
      1;

    this.requests.push(
      request,
    );

    if (
      this.failure !==
        null
    ) {
      throw this.failure;
    }

    return this.output;
  }
}

function makeCis8ReadResult(
  overrides:
    Partial<ConcordiumCis8FinalizedReadResultV1> = {},
): ConcordiumCis8FinalizedReadResultV1 {
  return {
    type:
      CONCORDIUM_CIS8_READ_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    network:
      NETWORK,

    cis8Contract:
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .contract,

    moduleReference:
      CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
        .moduleReference,

    snapshot:
      FINALIZED_SNAPSHOT,

    registration:
      ACTIVE_CIS8_REGISTRATION,

    ...overrides,
  };
}

function makeTransport(
  overrides:
    Partial<ConcordiumCis8FinalizedReadResultV1> = {},
): CountingCis8ReadTransport {
  return new CountingCis8ReadTransport(
    makeCis8ReadResult(
      overrides,
    ),
  );
}

function makePhase5BindingResult(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ok:
      true,

    status:
      "accepted",

    reason:
      "accepted",

    cryptographicDelegationVerification:
      true,

    buyerSignatureVerified:
      true,

    agentProofOfPossessionVerified:
      true,

    credentialHash:
      CREDENTIAL_HASH,

    agentId:
      AGENT_ID,

    agentKeyId:
      AGENT_KEY_ID,

    ...overrides,
  };
}

function makeRegistryTrustResult(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    verified:
      true,

    identity: {
      agentTokenId:
        AGENT_TOKEN_ID,
    },

    state: {
      status:
        "Active",

      ownerAccount:
        OWNER_ACCOUNT,
    },

    freshness:
      FINALIZED_SNAPSHOT,

    keyBinding: {
      required:
        false,

      verified:
        false,

      bindingType:
        null,

      keyFingerprint:
        null,
    },

    ...overrides,
  };
}

function makeRegistryReadResult(
  externalReference:
    unknown = CIS8_EXTERNAL_REFERENCE,

  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type:
      CONCORDIUM_CIS8004_READ_RESULT_TYPE,

    version:
      AGENT_REGISTRY_CONTRACT_VERSION,

    network:
      NETWORK,

    registryContract:
      REGISTRY_CONTRACT,

    moduleReference:
      REGISTRY_MODULE_REFERENCE,

    snapshot:
      FINALIZED_SNAPSHOT,

    record: {
      tokenId:
        AGENT_TOKEN_ID,

      ownerAccount:
        OWNER_ACCOUNT,

      agentUri:
        null,

      metadataHash:
        null,

      externalReference,

      agentWallet:
        null,

      status:
        "Active",

      registeredAt:
        "2026-07-20T12:00:00.000Z",

      revokedAt:
        null,

      revocationReason:
        null,
    },

    ...overrides,
  };
}

type BindingInputV1 =
  Parameters<
    typeof bindAgentRegistryIdentityToPhase5ActingKeyV1
  >[0];

function makeBindingInput(
  transport:
    ConcordiumCis8ReadTransportV1,

  overrides:
    Partial<BindingInputV1> = {},
): BindingInputV1 {
  return {
    phase5BindingResult:
      makePhase5BindingResult(),

    delegationDocument:
      DELEGATION_DOCUMENT,

    registryTrustResult:
      makeRegistryTrustResult(),

    registryReadResult:
      makeRegistryReadResult(),

    expectedAgentTokenId:
      AGENT_TOKEN_ID,

    externalKeyPolicy:
      "required",

    transport,

    ...overrides,
  };
}

function assertSafety(
  result:
    AgentRegistryIdentityKeyBindingResultV1,
): void {
  assert.equal(
    result.type,
    AGENT_REGISTRY_IDENTITY_KEY_BINDING_TYPE,
  );

  assert.equal(
    result.version,
    AGENT_REGISTRY_CONTRACT_VERSION,
  );

  assert.equal(
    result.mode,
    AGENT_REGISTRY_IDENTITY_KEY_BINDING_MODE,
  );

  assert.equal(
    result.testOnly,
    true,
  );

  assert.equal(
    result.gatewayRuntimeChanged,
    false,
  );

  assert.equal(
    result.phase5StateMutated,
    false,
  );

  assert.equal(
    result.canonicalStateMutated,
    false,
  );

  assert.equal(
    result.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.replayStateMutated,
    false,
  );

  assert.equal(
    result.ufxCalled,
    false,
  );

  assert.equal(
    result.crpCalled,
    false,
  );

  assert.equal(
    result.paymentAttempted,
    false,
  );

  assert.equal(
    result.receiptIssued,
    false,
  );

  assert.equal(
    result.paymentResponseEmitted,
    false,
  );

  assert.equal(
    result.resourceReleased,
    false,
  );

  assert.equal(
    result.transactionSubmitted,
    false,
  );

  assert.equal(
    result.signingKeyUsed,
    false,
  );

  assert.equal(
    result.persistenceUsed,
    false,
  );

  assert.equal(
    result.productionActivation,
    false,
  );
}

async function evaluateBinding(
  transport:
    ConcordiumCis8ReadTransportV1,

  overrides:
    Partial<BindingInputV1> = {},
): Promise<AgentRegistryIdentityKeyBindingResultV1> {
  const result =
    await bindAgentRegistryIdentityToPhase5ActingKeyV1(
      makeBindingInput(
        transport,
        overrides,
      ),
    );

  assertSafety(
    result,
  );

  return result;
}

function assertAcceptedBinding(
  result:
    AgentRegistryIdentityKeyBindingResultV1,

  policy:
    AgentRegistryExternalKeyPolicyV1,
): void {
  assert.equal(
    result.ok,
    true,
  );

  assert.equal(
    result.status,
    "accepted",
  );

  assert.equal(
    result.reason,
    "accepted",
  );

  assert.equal(
    result.policy,
    policy,
  );

  assert.equal(
    result.bindingEvaluated,
    true,
  );

  assert.equal(
    result.baseRegistryTrustVerified,
    true,
  );

  assert.equal(
    result.registryTrustPreserved,
    true,
  );

  assert.equal(
    result.credentialHash,
    CREDENTIAL_HASH,
  );

  assert.equal(
    result.agentId,
    AGENT_ID,
  );

  assert.equal(
    result.agentKeyId,
    AGENT_KEY_ID,
  );

  assert.equal(
    result.agentTokenId,
    AGENT_TOKEN_ID,
  );

  assert.equal(
    result.ownerAccount,
    OWNER_ACCOUNT,
  );

  assert.equal(
    result.externalReferencePresent,
    true,
  );

  assert.equal(
    result.sameSnapshot,
    true,
  );

  assert.equal(
    result.cis8LookupAttempted,
    true,
  );

  assert.equal(
    result.cis8RegistrationActive,
    true,
  );

  assert.deepEqual(
    result.keyBinding,
    {
      required:
        policy ===
        "required",

      verified:
        true,

      bindingType:
        "CIS-8",

      keyFingerprint:
        EXPECTED_KEY_FINGERPRINT,
    },
  );
}

async function runAcceptanceAndPolicyCases():
Promise<void> {
  const requiredTransport =
    makeTransport();

  const required =
    await evaluateBinding(
      requiredTransport,
    );

  assertAcceptedBinding(
    required,
    "required",
  );

  assert.equal(
    requiredTransport.calls,
    1,
  );

  assert.deepEqual(
    requiredTransport.requests[0]?.snapshot,
    FINALIZED_SNAPSHOT,
  );

  assert.deepEqual(
    requiredTransport.requests[0]?.externalKey,
    CIS8_EXTERNAL_KEY,
  );

  assert.deepEqual(
    requiredTransport.requests[0]?.config.contract,
    CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG
      .contract,
  );

  const optionalTransport =
    makeTransport();

  const optional =
    await evaluateBinding(
      optionalTransport,
      {
        externalKeyPolicy:
          "optional",
      },
    );

  assertAcceptedBinding(
    optional,
    "optional",
  );

  assert.equal(
    optionalTransport.calls,
    1,
  );

  for (
    const policy of [
      "required",
      "optional",
      "forbidden",
    ] as const
  ) {
    const transport =
      makeTransport();

    const result =
      await evaluateBinding(
        transport,
        {
          externalKeyPolicy:
            policy,

          registryReadResult:
            makeRegistryReadResult(
              null,
            ),
        },
      );

    assert.equal(
      transport.calls,
      0,
    );

    if (
      policy ===
      "required"
    ) {
      assert.equal(
        result.ok,
        false,
      );

      assert.equal(
        result.reason,
        "external_key_required",
      );

      assert.equal(
        result.registryTrustPreserved,
        false,
      );

      assert.deepEqual(
        result.keyBinding,
        {
          required:
            true,

          verified:
            false,

          bindingType:
            null,

          keyFingerprint:
            null,
        },
      );
    } else {
      assert.equal(
        result.ok,
        true,
      );

      assert.equal(
        result.reason,
        "accepted_without_external_key",
      );

      assert.equal(
        result.registryTrustPreserved,
        true,
      );

      assert.deepEqual(
        result.keyBinding,
        {
          required:
            false,

          verified:
            false,

          bindingType:
            null,

          keyFingerprint:
            null,
        },
      );
    }
  }

  const forbiddenTransport =
    makeTransport();

  const forbiddenPresent =
    await evaluateBinding(
      forbiddenTransport,
      {
        externalKeyPolicy:
          "forbidden",
      },
    );

  assert.equal(
    forbiddenPresent.ok,
    false,
  );

  assert.equal(
    forbiddenPresent.reason,
    "external_key_forbidden",
  );

  assert.equal(
    forbiddenPresent.externalReferencePresent,
    true,
  );

  assert.equal(
    forbiddenTransport.calls,
    0,
  );

  console.log(
    "PR301_B2_ACCEPTANCE_POLICY_CASES=true",
  );
}

async function runPhase5IdentityCases():
Promise<void> {
  const cases: {
    readonly name:
      string;

    readonly expectedReason:
      AgentRegistryIdentityKeyBindingResultV1["reason"];

    readonly overrides:
      Partial<BindingInputV1>;
  }[] = [
    {
      name:
        "phase5_not_accepted",

      expectedReason:
        "phase5_binding_not_accepted",

      overrides: {
        phase5BindingResult:
          makePhase5BindingResult({
            ok:
              false,
          }),
      },
    },
    {
      name:
        "credential_contract_invalid",

      expectedReason:
        "credential_contract_invalid",

      overrides: {
        delegationDocument:
          {},
      },
    },
    {
      name:
        "credential_hash_mismatch",

      expectedReason:
        "credential_hash_mismatch",

      overrides: {
        phase5BindingResult:
          makePhase5BindingResult({
            credentialHash:
              "sha256:substituted",
          }),
      },
    },
    {
      name:
        "agent_identity_mismatch",

      expectedReason:
        "agent_identity_mismatch",

      overrides: {
        phase5BindingResult:
          makePhase5BindingResult({
            agentId:
              "agent:substituted",
          }),
      },
    },
    {
      name:
        "agent_key_identity_mismatch",

      expectedReason:
        "agent_key_identity_mismatch",

      overrides: {
        phase5BindingResult:
          makePhase5BindingResult({
            agentKeyId:
              "agent-key-substituted",
          }),
      },
    },
  ];

  for (
    const testCase of
      cases
  ) {
    const transport =
      makeTransport();

    const result =
      await evaluateBinding(
        transport,
        testCase.overrides,
      );

    assert.equal(
      result.ok,
      false,
      testCase.name,
    );

    assert.equal(
      result.status,
      "rejected",
      testCase.name,
    );

    assert.equal(
      result.reason,
      testCase.expectedReason,
      testCase.name,
    );

    assert.equal(
      result.registryTrustPreserved,
      false,
      testCase.name,
    );

    assert.equal(
      result.keyBinding.verified,
      false,
      testCase.name,
    );

    assert.equal(
      transport.calls,
      0,
      testCase.name,
    );
  }

  console.log(
    "PR301_B2_PHASE5_IDENTITY_CASES=true",
  );
}

function makeRegistryReadResultWithRecord(
  recordOverrides:
    Record<string, unknown>,
): Record<string, unknown> {
  const base =
    makeRegistryReadResult();

  const record =
    base.record as
      Record<string, unknown>;

  return {
    ...base,

    record: {
      ...record,
      ...recordOverrides,
    },
  };
}

async function runRegistryTrustAndIdentityCases():
Promise<void> {
  const cases: {
    readonly name:
      string;

    readonly expectedReason:
      AgentRegistryIdentityKeyBindingResultV1["reason"];

    readonly expectedBaseTrust:
      boolean;

    readonly expectedSameSnapshot:
      boolean;

    readonly overrides:
      Partial<BindingInputV1>;
  }[] = [
    {
      name:
        "registry_trust_not_verified",

      expectedReason:
        "registry_trust_not_verified",

      expectedBaseTrust:
        false,

      expectedSameSnapshot:
        false,

      overrides: {
        registryTrustResult:
          makeRegistryTrustResult({
            verified:
              false,
          }),
      },
    },
    {
      name:
        "forged_verified_binding",

      expectedReason:
        "forged_verified_binding",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        false,

      overrides: {
        registryTrustResult:
          makeRegistryTrustResult({
            keyBinding: {
              required:
                true,

              verified:
                true,

              bindingType:
                "CIS-8",

              keyFingerprint:
                EXPECTED_KEY_FINGERPRINT,
            },
          }),
      },
    },
    {
      name:
        "native_binding_claim",

      expectedReason:
        "native_binding_not_supported",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        false,

      overrides: {
        registryTrustResult:
          makeRegistryTrustResult({
            keyBinding: {
              required:
                false,

              verified:
                false,

              bindingType:
                "native",

              keyFingerprint:
                null,
            },
          }),
      },
    },
    {
      name:
        "registry_read_result_invalid",

      expectedReason:
        "registry_read_result_invalid",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        false,

      overrides: {
        registryReadResult:
          {},
      },
    },
    {
      name:
        "registry_snapshot_mismatch",

      expectedReason:
        "snapshot_mismatch",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        false,

      overrides: {
        registryReadResult:
          makeRegistryReadResult(
            CIS8_EXTERNAL_REFERENCE,
            {
              snapshot:
                OTHER_FINALIZED_SNAPSHOT,
            },
          ),
      },
    },
    {
      name:
        "registry_record_missing",

      expectedReason:
        "registry_record_missing",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        true,

      overrides: {
        registryReadResult:
          makeRegistryReadResult(
            CIS8_EXTERNAL_REFERENCE,
            {
              record:
                null,
            },
          ),
      },
    },
    {
      name:
        "registry_record_not_active",

      expectedReason:
        "registry_record_not_active",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        true,

      overrides: {
        registryReadResult:
          makeRegistryReadResultWithRecord({
            status:
              "Revoked",
          }),
      },
    },
    {
      name:
        "registry_token_substitution",

      expectedReason:
        "agent_token_mismatch",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        true,

      overrides: {
        registryReadResult:
          makeRegistryReadResultWithRecord({
            tokenId:
              "1",
          }),
      },
    },
    {
      name:
        "registry_owner_substitution",

      expectedReason:
        "registry_owner_mismatch",

      expectedBaseTrust:
        true,

      expectedSameSnapshot:
        true,

      overrides: {
        registryReadResult:
          makeRegistryReadResultWithRecord({
            ownerAccount:
              "4-substituted-owner",
          }),
      },
    },
  ];

  for (
    const testCase of
      cases
  ) {
    const transport =
      makeTransport();

    const result =
      await evaluateBinding(
        transport,
        testCase.overrides,
      );

    assert.equal(
      result.ok,
      false,
      testCase.name,
    );

    assert.equal(
      result.status,
      "rejected",
      testCase.name,
    );

    assert.equal(
      result.reason,
      testCase.expectedReason,
      testCase.name,
    );

    assert.equal(
      result.baseRegistryTrustVerified,
      testCase.expectedBaseTrust,
      testCase.name,
    );

    assert.equal(
      result.sameSnapshot,
      testCase.expectedSameSnapshot,
      testCase.name,
    );

    assert.equal(
      result.registryTrustPreserved,
      false,
      testCase.name,
    );

    assert.equal(
      result.keyBinding.verified,
      false,
      testCase.name,
    );

    assert.equal(
      transport.calls,
      0,
      testCase.name,
    );
  }

  console.log(
    "PR301_B2_REGISTRY_IDENTITY_CASES=true",
  );
}

async function runExternalReferenceAndTransportCases():
Promise<void> {
  const noReadCases: {
    readonly name:
      string;

    readonly expectedReason:
      AgentRegistryIdentityKeyBindingResultV1["reason"];

    readonly reference:
      unknown;
  }[] = [
    {
      name:
        "native_reference_claim",

      expectedReason:
        "native_binding_not_supported",

      reference: {
        kind:
          "native",
      },
    },
    {
      name:
        "unsupported_reference_kind",

      expectedReason:
        "unsupported_external_reference_kind",

      reference: {
        ...CIS8_EXTERNAL_REFERENCE,

        kind:
          "CIS-9",
      },
    },
    {
      name:
        "malformed_external_reference",

      expectedReason:
        "external_reference_invalid",

      reference:
        {},
    },
    {
      name:
        "untrusted_cis8_contract",

      expectedReason:
        "untrusted_cis8_contract",

      reference: {
        ...CIS8_EXTERNAL_REFERENCE,

        contractAddress: {
          index:
            "999999",

          subindex:
            0,
        },
      },
    },
    {
      name:
        "unsupported_external_key_type",

      expectedReason:
        "unsupported_external_key_type",

      reference: {
        ...CIS8_EXTERNAL_REFERENCE,

        externalKeyId: {
          ...CIS8_EXTERNAL_KEY,

          keyType:
            "secp256k1",
        },
      },
    },
    {
      name:
        "phase5_raw_key_mismatch",

      expectedReason:
        "agent_public_key_mismatch",

      reference: {
        ...CIS8_EXTERNAL_REFERENCE,

        externalKeyId: {
          ...CIS8_EXTERNAL_KEY,

          publicKeyHex:
            "00".repeat(
              32,
            ),
        },
      },
    },
  ];

  for (
    const testCase of
      noReadCases
  ) {
    const transport =
      makeTransport();

    const result =
      await evaluateBinding(
        transport,
        {
          registryReadResult:
            makeRegistryReadResult(
              testCase.reference,
            ),
        },
      );

    assert.equal(
      result.ok,
      false,
      testCase.name,
    );

    assert.equal(
      result.reason,
      testCase.expectedReason,
      testCase.name,
    );

    assert.equal(
      result.keyBinding.verified,
      false,
      testCase.name,
    );

    assert.equal(
      transport.calls,
      0,
      testCase.name,
    );
  }

  const invalidKindTransport = {
    kind:
      "invalid-transport",

    async read():
    Promise<unknown> {
      throw new Error(
        "invalid_transport_must_not_read",
      );
    },
  } as unknown as
    ConcordiumCis8ReadTransportV1;

  const invalidKindResult =
    await evaluateBinding(
      invalidKindTransport,
    );

  assert.equal(
    invalidKindResult.reason,
    "cis8_transport_unavailable",
  );

  const failingTransport =
    new CountingCis8ReadTransport(
      null,
      new Error(
        "synthetic_transport_failure",
      ),
    );

  const transportFailure =
    await evaluateBinding(
      failingTransport,
    );

  assert.equal(
    transportFailure.reason,
    "cis8_transport_unavailable",
  );

  assert.equal(
    failingTransport.calls,
    1,
  );

  const invalidReadTransport =
    new CountingCis8ReadTransport(
      {},
    );

  const invalidRead =
    await evaluateBinding(
      invalidReadTransport,
    );

  assert.equal(
    invalidRead.reason,
    "cis8_read_result_invalid",
  );

  assert.equal(
    invalidReadTransport.calls,
    1,
  );

  console.log(
    "PR301_B2_EXTERNAL_REFERENCE_TRANSPORT_CASES=true",
  );
}

function makeRawCis8Registration(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...ACTIVE_CIS8_REGISTRATION,
    ...overrides,
  };
}

function makeRawCis8ReadResult(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...makeCis8ReadResult(),
    ...overrides,
  };
}

async function runCis8RegistrationCases():
Promise<void> {
  const cases: {
    readonly name:
      string;

    readonly expectedReason:
      AgentRegistryIdentityKeyBindingResultV1["reason"];

    readonly expectedSameSnapshot:
      boolean;

    readonly expectedRegistrationActive:
      boolean;

    readonly output:
      unknown;
  }[] = [
    {
      name:
        "cis8_snapshot_mismatch",

      expectedReason:
        "snapshot_mismatch",

      expectedSameSnapshot:
        false,

      expectedRegistrationActive:
        false,

      output:
        makeCis8ReadResult({
          snapshot:
            OTHER_FINALIZED_SNAPSHOT,
        }),
    },
    {
      name:
        "cis8_registration_missing",

      expectedReason:
        "cis8_registration_missing",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        false,

      output:
        makeCis8ReadResult({
          registration:
            null,
        }),
    },
    {
      name:
        "cis8_registration_revoked",

      expectedReason:
        "cis8_registration_revoked",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        false,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              status:
                "Revoked",
            }),
        }),
    },
    {
      name:
        "cis8_registration_malformed",

      expectedReason:
        "cis8_registration_malformed",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        false,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              status:
                "Suspended",
            }),
        }),
    },
    {
      name:
        "cis8_owner_substitution",

      expectedReason:
        "cis8_owner_mismatch",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        true,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              owner:
                "4-substituted-owner",
            }),
        }),
    },
    {
      name:
        "cis8_namespace_substitution",

      expectedReason:
        "cis8_external_key_mismatch",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        true,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              externalKey: {
                ...CIS8_EXTERNAL_KEY,

                namespace:
                  "substituted",
              },
            }),
        }),
    },
    {
      name:
        "cis8_key_type_substitution",

      expectedReason:
        "cis8_external_key_mismatch",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        true,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              externalKey: {
                ...CIS8_EXTERNAL_KEY,

                keyType:
                  "secp256k1",
              },
            }),
        }),
    },
    {
      name:
        "cis8_raw_key_substitution",

      expectedReason:
        "cis8_external_key_mismatch",

      expectedSameSnapshot:
        true,

      expectedRegistrationActive:
        true,

      output:
        makeRawCis8ReadResult({
          registration:
            makeRawCis8Registration({
              externalKey: {
                ...CIS8_EXTERNAL_KEY,

                publicKeyHex:
                  "00".repeat(
                    32,
                  ),
              },
            }),
        }),
    },
  ];

  for (
    const testCase of
      cases
  ) {
    const transport =
      new CountingCis8ReadTransport(
        testCase.output,
      );

    const result =
      await evaluateBinding(
        transport,
      );

    assert.equal(
      result.ok,
      false,
      testCase.name,
    );

    assert.equal(
      result.status,
      "rejected",
      testCase.name,
    );

    assert.equal(
      result.reason,
      testCase.expectedReason,
      testCase.name,
    );

    assert.equal(
      result.sameSnapshot,
      testCase.expectedSameSnapshot,
      testCase.name,
    );

    assert.equal(
      result.cis8LookupAttempted,
      true,
      testCase.name,
    );

    assert.equal(
      result.cis8RegistrationActive,
      testCase.expectedRegistrationActive,
      testCase.name,
    );

    assert.equal(
      result.keyBinding.verified,
      false,
      testCase.name,
    );

    assert.equal(
      transport.calls,
      1,
      testCase.name,
    );
  }

  console.log(
    "PR301_B2_CIS8_REGISTRATION_CASES=true",
  );
}

function makeMalformedJwkDocument():
BuyerToAgentDelegationCredentialDocument {
  const document =
    JSON.parse(
      JSON.stringify(
        DELEGATION_DOCUMENT,
      ),
    ) as BuyerToAgentDelegationCredentialDocument;

  document
    .credential
    .subject
    .agentPublicKeyJwk
    .x =
      "not-valid-base64url!";

  return document;
}

async function runFinalFrozenCoverageCases():
Promise<void> {
  const malformedDocument =
    makeMalformedJwkDocument();

  const malformedTransport =
    makeTransport();

  const malformedJwk =
    await evaluateBinding(
      malformedTransport,
      {
        delegationDocument:
          malformedDocument,

        phase5BindingResult:
          makePhase5BindingResult({
            credentialHash:
              hashBuyerToAgentDelegationCredential(
                malformedDocument.credential,
              ),
          }),
      },
    );

  assert.equal(
    malformedJwk.ok,
    false,
    "malformed_jwk",
  );

  assert.equal(
    malformedJwk.reason,
    "credential_contract_invalid",
    "malformed_jwk",
  );

  assert.equal(
    malformedTransport.calls,
    0,
    "malformed_jwk",
  );

  let timeoutCalls =
    0;

  const timeoutTransport:
    ConcordiumCis8ReadTransportV1 = {
      kind:
        CONCORDIUM_CIS8_TRANSPORT_KIND,

      async read():
      Promise<unknown> {
        timeoutCalls +=
          1;

        return new Promise<unknown>(
          () => {},
        );
      },
    };

  const timeoutResult =
    await evaluateBinding(
      timeoutTransport,
      {
        trustedCis8: {
          ...CONCORDIUM_CIS8_TESTNET_TRUSTED_CONFIG,

          timeoutMs:
            1,
        },
      },
    );

  assert.equal(
    timeoutResult.ok,
    false,
    "cis8_timeout",
  );

  assert.equal(
    timeoutResult.reason,
    "cis8_transport_unavailable",
    "cis8_timeout",
  );

  assert.equal(
    timeoutCalls,
    1,
    "cis8_timeout",
  );

  console.log(
    "PR301_B2_FINAL_FROZEN_CASES=true",
  );
}

async function main():
Promise<void> {
  await runPhase5IdentityCases();

  await runRegistryTrustAndIdentityCases();

  await runExternalReferenceAndTransportCases();

  await runCis8RegistrationCases();

  await runFinalFrozenCoverageCases();

  await runAcceptanceAndPolicyCases();

  console.log(
    JSON.stringify(
      {
        label:
          LABEL,

        contract:
          CONTRACT,

        exactCis8Success:
          true,

        canonicalFingerprint:
          EXPECTED_KEY_FINGERPRINT,

        policyMatrix:
          true,

        phase5IdentityDefenses:
          true,

        registryIdentityDefenses:
          true,

        externalReferenceTransportDefenses:
          true,

        cis8RegistrationDefenses:
          true,

        malformedJwkDefense:
          true,

        timeoutDefense:
          true,

        frozenCaseAudit:
          "complete",

        zeroSideEffects:
          true,
      },
    ),
  );
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error(
      `${LABEL}: FAIL`,
      error,
    );

    process.exitCode =
      1;
  },
);
