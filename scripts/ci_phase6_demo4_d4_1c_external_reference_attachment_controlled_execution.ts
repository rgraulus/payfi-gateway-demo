/**
 * PR #314 — deterministic/offline controlled-execution acceptance.
 *
 * No network, wallet, signer, transaction, payment, or D4-1C action.
 */

import * as assert from "node:assert/strict";

import {
  Buffer,
} from "node:buffer";

import {
  readFileSync,
} from "node:fs";

import {
  DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE,
  DEMO4_D4_1C_CONTROLLED_EXECUTION_SAFETY,
  DEMO4_D4_1C_CONTROLLED_EXECUTION_STAGE,
  DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE,
  buildDemo4D41cControlledExecutionPlanV1,
  authorizeDemo4D41cControlledExecutionV1,
  validateDemo4D41cControlledExecutionActivationV1,
  validateDemo4D41cFutureFinalizedObservationV1,
  validateDemo4D41cLivePreExecutionObservationV1,
} from "../src/phase6/demo4Cis8004ExternalReferenceAttachmentControlledExecution";

import {
  DEMO4_D4_1C_GATE_E_PR314_HANDOFF,
  buildDemo4D41cNormalizedExternalReferenceV1,
} from "../src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight";

import {
  DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED,
  DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED,
  DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED,
  DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_AVAILABLE,
  buildDemo4D41cExternalReferenceSchemaValueForTestV1,
  demo4D41cTransactionEnergyAllowanceFromDryRunV1,
  normalizeDemo4D41cEmbeddedSchemaBytesForTestV1,
  reverseLookupTokenIdV1,
  runDemo4D41cSingleSubmissionForTestV1,
} from "./demo_phase6_demo4_d4_1c_external_reference_attachment_controlled_execution";

const CORE_PATH =
  "src/phase6/demo4Cis8004ExternalReferenceAttachmentControlledExecution.ts";

const RUNNER_PATH =
  "scripts/demo_phase6_demo4_d4_1c_external_reference_attachment_controlled_execution.ts";

function lockedActivation(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    mode:
      "inspect",

    explicitControlledExecutionAuthorizationConfirmed:
      false,

    walletReadEnabled:
      false,

    signerCreationEnabled:
      false,

    transactionConstructionEnabled:
      false,

    transactionSigningEnabled:
      false,

    transactionSubmissionEnabled:
      false,

    paymentEnabled:
      false,

    ...overrides,
  };
}

function validSyntheticFinalizedObservation() {
  return {
    submissionAttempts:
      1,

    automaticRetryAttempted:
      false,

    zeroCcdAttached:
      true,

    transaction: {
      hash:
        "a".repeat(
          64,
        ),

      finalized:
        true,

      finalizedBlockHash:
        "b".repeat(
          64,
        ),

      finalizedBlockHeight:
        "46790000",

      transactionType:
        "update",
    },

    postAgent: {
      tokenId:
        "287",

      ownerAccount:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .ownerAccount,

      agentUri:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .agentCard
          .uri,

      metadataHash:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .agentCard
          .sha256,

      status:
        "Active",

      externalReference:
        buildDemo4D41cNormalizedExternalReferenceV1(),

      revokedAt:
        null,

      revocationReason:
        null,
    },

    reverseLookupTokenId:
      "287",

    cis8PostState: {
      status:
        "Active",

      ownerAccount:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8
          .ownerAccount,

      externalKey:
        {
          ...DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
            .cis8
            .externalKey,
        },

      proofScheme:
        "solana-ed25519",
    },

    safety: {
      exactlyOneSubmissionAttempted:
        true,

      cis8Mutated:
        false,

      paymentAttempted:
        false,

      settlementAttempted:
        false,

      receiptIssued:
        false,

      gatewayRuntimeActivated:
        false,

      protectedResourceReleased:
        false,

      replayStateMutated:
        false,

      productionActivation:
        false,
    },
  };
}

function validSyntheticLivePreExecutionObservation() {
  return {
    network:
      DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
        .network,

    finalizedSnapshot: {
      finalized:
        true,

      finalizedBlockHash:
        "c".repeat(
          64,
        ),

      finalizedBlockHeight:
        "46790001",

      singleFinalizedSnapshotBound:
        true,
    },

    cis8004: {
      contract: {
        ...DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .contract,
      },

      moduleReference:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .moduleReference,

      embeddedSchemaByteLength:
        5700,

      embeddedSchemaSha256:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .embeddedSchemaSha256,

      schemaPresent:
        true,

      tokenId:
        "287",

      tokenPresent:
        true,

      status:
        "Active",

      ownerAccount:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .ownerAccount,

      agentUri:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .agentCard
          .uri,

      metadataHash:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8004
          .agentCard
          .sha256,

      externalReferencePresent:
        false,

      revokedAtPresent:
        false,

      revocationReasonPresent:
        false,
    },

    reverseReference: {
      completeExternalReferenceCompared:
        true,

      alreadyAttached:
        false,

      unique:
        true,
    },

    cis8: {
      contract: {
        ...DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8
          .contract,
      },

      moduleReference:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8
          .moduleReference,

      embeddedSchemaByteLength:
        1918,

      embeddedSchemaSha256:
        "11312a179a14634042795bb2e075552af1d94eef18b7fc96f680d5a335e23b7e",

      status:
        "Active",

      registered:
        true,

      ownerAccount:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8
          .ownerAccount,

      externalKey: {
        ...DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .cis8
          .externalKey,
      },

      completeExternalKeyMatch:
        true,
    },

    parameter: {
      deterministicByteLength:
        117,

      deterministicSha256:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .parameter
          .sha256,

      sdkSerializedByteLength:
        117,

      sdkSerializedSha256:
        DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
          .parameter
          .sha256,

      exactSdkByteEquivalence:
        true,
    },

    dryRunBoundary: {
      capabilityDefined:
        true,

      authorizationPresent:
        false,

      invocationAttempted:
        false,

      performed:
        false,

      attachedCcd:
        "0",

      energySafetyCap:
        "100000",
    },

    safety: {
      readOnlyStateQueryCount:
        3,

      stateMutationPerformed:
        false,

      privateKeyRead:
        false,

      walletRead:
        false,

      signerCreated:
        false,

      transactionConstructed:
        false,

      transactionSigned:
        false,

      transactionSubmitted:
        false,

      paymentAttempted:
        false,

      d4_1cPerformed:
        false,
    },
  };
}

function testObservedPositiveReverseLookupAgentRecordShape():
void {
  const profile =
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE;

  const owner =
    profile
      .cis8004
      .ownerAccount;

  const observedPositiveReverseLookup = {
    Some: [
      {
        token_id:
          "1f01000000000000",

        owner_account:
          owner,

        agent_uri: {
          Some: [
            profile
              .cis8004
              .agentCard
              .uri,
          ],
        },

        metadata_hash: {
          Some: [
            Array.from(
              Buffer.from(
                profile
                  .cis8004
                  .agentCard
                  .sha256,
                "hex",
              ),
              (
                byte,
              ) =>
                BigInt(
                  byte,
                ),
            ),
          ],
        },

        external_reference: {
          Some: [
            {
              contract_address: {
                index:
                  BigInt(
                    profile
                      .cis8
                      .contract
                      .index,
                  ),

                subindex:
                  BigInt(
                    profile
                      .cis8
                      .contract
                      .subindex,
                  ),
              },

              kind: {
                Cis8: [
                  {
                    namespace:
                      profile
                        .cis8
                        .externalKey
                        .namespace,

                    key_type:
                      profile
                        .cis8
                        .externalKey
                        .keyType,

                    public_key:
                      Array.from(
                        Buffer.from(
                          profile
                            .cis8
                            .externalKey
                            .publicKeyHex,
                          "hex",
                        ),
                        (
                          byte,
                        ) =>
                          BigInt(
                            byte,
                          ),
                      ),
                  },
                ],
              },
            },
          ],
        },

        agent_wallet: {
          Some: [
            owner,
          ],
        },

        status: {
          Active: [],
        },

        registered_at:
          "2026-08-03T15:36:09.045+00:00",

        revoked_at: {
          None: [],
        },

        revocation_reason: {
          None: [],
        },

        on_chain_metadata: [],
      },
    ],
  };

  assert.equal(
    reverseLookupTokenIdV1(
      observedPositiveReverseLookup,
    ),
    "287",
    "observed_agentByExternalReference_Some_AgentRecord_must_resolve_token_287",
  );

  assert.equal(
    reverseLookupTokenIdV1({
      Some: [
        287n,
      ],
    }),
    "287",
    "legacy_some_bigint_fallback_preserved",
  );

  assert.equal(
    reverseLookupTokenIdV1(
      287n,
    ),
    "287",
    "legacy_bigint_fallback_preserved",
  );

  assert.equal(
    reverseLookupTokenIdV1(
      "287",
    ),
    "287",
    "legacy_decimal_string_fallback_preserved",
  );

  assert.equal(
    reverseLookupTokenIdV1(
      Buffer.from(
        "1f01000000000000",
        "hex",
      ),
    ),
    "287",
    "legacy_eight_byte_little_endian_fallback_preserved",
  );
}


function testEmbeddedSchemaByteNormalization():
void {
  const expected =
    [
      0x11,
      0x22,
      0x33,
      0x44,
      0x55,
    ] as const;

  const assertExact = (
    label:
      string,
    input:
      unknown,
  ): void => {
    const normalized =
      normalizeDemo4D41cEmbeddedSchemaBytesForTestV1(
        input,
      );

    assert.deepEqual(
      Array.from(
        normalized,
      ),
      expected,
      label,
    );
  };

  assertExact(
    "buffer",
    Buffer.from(
      expected,
    ),
  );

  assertExact(
    "uint8array",
    Uint8Array.from(
      expected,
    ),
  );

  const arrayBuffer =
    Uint8Array.from(
      expected,
    ).buffer;

  assertExact(
    "arraybuffer",
    arrayBuffer,
  );

  const backing =
    Uint8Array.from([
      0xaa,
      ...expected,
      0xbb,
    ]);

  const view =
    new DataView(
      backing.buffer,
      1,
      expected.length,
    );

  assert.equal(
    ArrayBuffer.isView(
      view,
    ),
    true,
  );

  assertExact(
    "arraybuffer_view_exact_offset",
    view,
  );

  assertExact(
    "wrapped_arraybuffer_view_exact_offset",
    {
      buffer:
        view,
    },
  );

  for (
    const malformed
    of [
      null,
      undefined,
      {},
      {
        buffer:
          "not_schema_bytes",
      },
      {
        buffer:
          {},
      },
    ]
  ) {
    assert.throws(
      () =>
        normalizeDemo4D41cEmbeddedSchemaBytesForTestV1(
          malformed,
        ),
      /invalid_embedded_schema_bytes/,
    );
  }
}

function testStrictExternalReferenceContractAddressSchemaValue():
void {
  const schemaValue =
    buildDemo4D41cExternalReferenceSchemaValueForTestV1();

  const contractAddress =
    schemaValue
      .contract_address;

  assert.deepEqual(
    Object.keys(
      contractAddress,
    ).sort(),
    [
      "index",
      "subindex",
    ],
  );

  assert.equal(
    typeof contractAddress.index,
    "bigint",
  );

  assert.equal(
    contractAddress.index,
    12801n,
  );

  assert.equal(
    typeof contractAddress.subindex,
    "bigint",
  );

  assert.equal(
    contractAddress.subindex,
    0n,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      contractAddress,
      "type",
    ),
    false,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      contractAddress,
      "value",
    ),
    false,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      contractAddress,
      "address",
    ),
    false,
  );

  const preflightModule =
    require(
      "../src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight"
    ) as typeof import(
      "../src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight"
    );

  const candidate =
    preflightModule
      .buildDemo4D41cAttachmentCandidateV1();

  assert.equal(
    contractAddress.index,
    BigInt(
      candidate
        .externalReference
        .contract
        .index,
    ),
  );

  assert.equal(
    contractAddress.subindex,
    BigInt(
      candidate
        .externalReference
        .contract
        .subindex,
    ),
  );

  const sdk =
    require(
      "@concordium/web-sdk"
    );

  const sdkContractAddress =
    sdk.ContractAddress
      .create(
        BigInt(
          candidate
            .externalReference
            .contract
            .index,
        ),

        BigInt(
          candidate
            .externalReference
            .contract
            .subindex,
        ),
      );

  const sdkSchemaValue =
    sdk.ContractAddress
      .toSchemaValue(
        sdkContractAddress,
      );

  assert.deepEqual(
    Object.keys(
      sdkSchemaValue,
    ).sort(),
    [
      "index",
      "subindex",
    ],
  );

  assert.deepEqual(
    contractAddress,
    sdkSchemaValue,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      sdkSchemaValue,
      "__type",
    ),
    false,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      contractAddress,
      "__type",
    ),
    false,
  );

  const manualBytes =
    Buffer.from(
      preflightModule
        .serializeDemo4D41cSetExternalReferenceParameterV1(
          candidate,
        ),
    );

  const manualSha256 =
    require(
      "node:crypto"
    )
      .createHash(
        "sha256",
      )
      .update(
        manualBytes,
      )
      .digest(
        "hex",
      );

  const gateB =
    preflightModule
      .DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE;

  assert.equal(
    gateB.established,
    true,
  );

  assert.equal(
    gateB.deployedSchema.byteLength,
    5700,
  );

  assert.equal(
    gateB.deployedSchema.sha256,
    "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
  );

  assert.equal(
    gateB.sdkSerialization.parameterByteLength,
    117,
  );

  assert.equal(
    gateB.sdkSerialization.parameterSha256,
    "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",
  );

  assert.equal(
    gateB.sdkSerialization.exactManualByteEquivalence,
    true,
  );

  assert.equal(
    gateB.sdkSerialization.firstMismatchIndex,
    -1,
  );

  assert.equal(
    manualBytes.length,
    gateB
      .sdkSerialization
      .parameterByteLength,
  );

  assert.equal(
    manualSha256,
    gateB
      .sdkSerialization
      .parameterSha256,
  );

  assert.equal(
    manualBytes.length,
    117,
  );

  assert.equal(
    manualSha256,
    "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",
  );
}


async function testBoundedContractDryRunInvocation():
Promise<void> {
  const runnerModule =
    require(
      "./demo_phase6_demo4_d4_1c_external_reference_attachment_controlled_execution"
    );

  const runBoundedDryRun =
    runnerModule
      .runDemo4D41cBoundedDryRunInvocationForTestV1;

  assert.equal(
    typeof runBoundedDryRun,
    "function",
  );

  const zeroCcdMarker =
    Object.freeze({
      type:
        "zero-ccd",
    });

  const energyMarker =
    Object.freeze({
      type:
        "energy",
      value:
        100000n,
    });

  const receiveNameMarker =
    Object.freeze({
      value:
        "CIS-8004.setExternalReference",
    });

  const ownerAccount =
    Object.freeze({
      type:
        "owner-account",
    });

  const contractAddress =
    Object.freeze({
      type:
        "contract-address",
    });

  const parameter =
    Object.freeze({
      type:
        "parameter",
    });

  const finalizedBlock =
    Object.freeze({
      type:
        "finalized-block",
    });

  const calls:
    any[] =
    [];

  const sdk = {
    CcdAmount: {
      zero() {
        return zeroCcdMarker;
      },
    },

    Energy: {
      create(
        value:
          bigint,
      ) {
        assert.equal(
          value,
          100000n,
        );

        return energyMarker;
      },
    },

    ReceiveName: {
      fromString(
        value:
          string,
      ) {
        assert.equal(
          value,
          "CIS-8004.setExternalReference",
        );

        return receiveNameMarker;
      },
    },
  };

  const client = {
    async invokeContract(
      request:
        unknown,
      block:
        unknown,
    ) {
      calls.push({
        request,
        block,
      });

      return {
        tag:
          "success",

        usedEnergy:
          2575n,

        returnValue:
          new Uint8Array([
            1,
          ]),
      };
    },
  };

  const result =
    await runBoundedDryRun({
      sdk,
      client,
      finalizedBlock,
      ownerAccount,
      contractAddress,
      parameter,
    });

  assert.equal(
    calls.length,
    1,
  );

  assert.equal(
    calls[0].block,
    finalizedBlock,
  );

  assert.equal(
    calls[0].request.invoker,
    ownerAccount,
  );

  assert.equal(
    calls[0].request.contract,
    contractAddress,
  );

  assert.equal(
    calls[0].request.method,
    receiveNameMarker,
  );

  assert.equal(
    calls[0].request.parameter,
    parameter,
  );

  assert.equal(
    calls[0].request.amount,
    zeroCcdMarker,
  );

  assert.equal(
    calls[0].request.energy,
    energyMarker,
  );

  assert.deepEqual(
    result,
    {
      attemptCount:
        1,

      succeeded:
        true,

      usedEnergy:
        "2575",

      energySafetyCap:
        "100000",

      zeroCcdAttached:
        true,

      automaticRetryAttempted:
        false,

      returnValuePresent:
        true,
    },
  );

  let failedInvocationCalls =
    0;

  await assert.rejects(
    async () =>
      runBoundedDryRun({
        sdk,

        client: {
          async invokeContract() {
            failedInvocationCalls +=
              1;

            return {
              tag:
                "failure",
            };
          },
        },

        finalizedBlock,
        ownerAccount,
        contractAddress,
        parameter,
      }),

    /set_external_reference_dry_run_failed/,
  );

  assert.equal(
    failedInvocationCalls,
    1,
  );

  let excessiveEnergyCalls =
    0;

  await assert.rejects(
    async () =>
      runBoundedDryRun({
        sdk,

        client: {
          async invokeContract() {
            excessiveEnergyCalls +=
              1;

            return {
              tag:
                "success",

              usedEnergy:
                100001n,
            };
          },
        },

        finalizedBlock,
        ownerAccount,
        contractAddress,
        parameter,
      }),

    /dry_run_energy_exceeds_safety_cap/,
  );

  assert.equal(
    excessiveEnergyCalls,
    1,
  );

  let stringEnergyCalls =
    0;

  const stringEnergyResult =
    await runBoundedDryRun({
      sdk,

      client: {
        async invokeContract() {
          stringEnergyCalls +=
            1;

          return {
            tag:
              "success",

            usedEnergy:
              "2575",
          };
        },
      },

      finalizedBlock,
      ownerAccount,
      contractAddress,
      parameter,
    });

  assert.equal(
    stringEnergyCalls,
    1,
  );

  assert.equal(
    stringEnergyResult
      .usedEnergy,
    "2575",
  );

  console.log(
    "PR314_BOUNDED_DRY_RUN_OFFLINE_MOCK_TEST_PASSED=true",
  );
}


function authorizedExecutionInput(
  overrides:
    Record<
      string,
      unknown
    > = {},
) {
  return {
    mode:
      "execute",

    explicitControlledExecutionAuthorizationConfirmed:
      true,

    d4_1cAttachmentAuthorizationConfirmed:
      true,

    testnetOnly:
      true,

    walletReadEnabled:
      true,

    signerCreationEnabled:
      true,

    transactionConstructionEnabled:
      true,

    transactionSigningEnabled:
      true,

    transactionSubmissionEnabled:
      true,

    paymentEnabled:
      false,

    submissionLimit:
      1,

    submissionAttemptsBefore:
      0,

    automaticRetryAuthorized:
      false,

    zeroCcdRequired:
      true,

    executeDispatchEnabled:
      true,

    ...overrides,
  };
}

async function testExactlyOneExecutionBoundary():
Promise<void> {
  const authorization =
    authorizeDemo4D41cControlledExecutionV1(
      authorizedExecutionInput(),
    );

  assert.equal(
    authorization.ok,
    true,
  );

  if (
    authorization.ok !==
      true
  ) {
    throw new Error(
      "positive_execution_authorization_failed",
    );
  }

  for (
    const [
      override,
      expectedReason,
    ]
    of [
      [
        {
          executeDispatchEnabled:
            false,
        },
        "execute_dispatch_locked",
      ],
      [
        {
          explicitControlledExecutionAuthorizationConfirmed:
            false,
        },
        "explicit_d4_1c_execution_authorization_required",
      ],
      [
        {
          d4_1cAttachmentAuthorizationConfirmed:
            false,
        },
        "explicit_d4_1c_execution_authorization_required",
      ],
      [
        {
          testnetOnly:
            false,
        },
        "testnet_only_required",
      ],
      [
        {
          walletReadEnabled:
            false,
        },
        "required_execution_capability_not_authorized",
      ],
      [
        {
          signerCreationEnabled:
            false,
        },
        "required_execution_capability_not_authorized",
      ],
      [
        {
          transactionConstructionEnabled:
            false,
        },
        "required_execution_capability_not_authorized",
      ],
      [
        {
          transactionSigningEnabled:
            false,
        },
        "required_execution_capability_not_authorized",
      ],
      [
        {
          transactionSubmissionEnabled:
            false,
        },
        "required_execution_capability_not_authorized",
      ],
      [
        {
          paymentEnabled:
            true,
        },
        "payment_must_remain_disabled",
      ],
      [
        {
          submissionAttemptsBefore:
            1,
        },
        "unsafe_submission_authorization",
      ],
      [
        {
          submissionLimit:
            2,
        },
        "unsafe_submission_authorization",
      ],
      [
        {
          automaticRetryAuthorized:
            true,
        },
        "unsafe_submission_authorization",
      ],
      [
        {
          zeroCcdRequired:
            false,
        },
        "unsafe_submission_authorization",
      ],
    ] as const
  ) {
    const rejected =
      authorizeDemo4D41cControlledExecutionV1(
        authorizedExecutionInput(
          override,
        ),
      );

    assert.equal(
      rejected.ok,
      false,
    );

    if (
      rejected.ok ===
        false
    ) {
      assert.equal(
        rejected.reason,
        expectedReason,
      );
    }
  }

  const allowance =
    demo4D41cTransactionEnergyAllowanceFromDryRunV1(
      "2575",
    );

  assert.equal(
    allowance,
    3575n,
  );

  assert.equal(
    demo4D41cTransactionEnergyAllowanceFromDryRunV1(
      "100000",
    ),
    100000n,
  );

  const calls:
    any[] =
    [];

  const state = {
    transactionConstructed:
      false,

    transactionSigningAttempted:
      false,

    transactionSubmissionAttempted:
      false,

    submissionAttempts:
      0,

    transactionSubmitted:
      false,

    automaticRetryAttempted:
      false,
  };

  const energyMarker =
    Object.freeze({
      kind:
        "energy",
    });

  const expiryMarker =
    Object.freeze({
      kind:
        "expiry",
    });

  const sdk = {
    Energy: {
      create(
        value:
          bigint,
      ) {
        assert.equal(
          value,
          3575n,
        );

        return energyMarker;
      },
    },

    TransactionExpiry: {
      futureMinutes(
        value:
          number,
      ) {
        assert.equal(
          value,
          5,
        );

        return expiryMarker;
      },
    },
  };

  let sendCalls =
    0;

  const contract = {
    async createAndSendUpdateTransaction(
      entrypoint:
        unknown,
      serializer:
        unknown,
      metadata:
        any,
      parameter:
        unknown,
      signer:
        unknown,
    ) {
      sendCalls +=
        1;

      calls.push({
        entrypoint,
        serializer,
        metadata,
        parameter,
        signer,
      });

      return {
        synthetic:
          "transaction-hash",
      };
    },
  };

  const serializer =
    (
      _value:
        unknown,
    ) =>
      new ArrayBuffer(
        117,
      );

  const submitted =
    await runDemo4D41cSingleSubmissionForTestV1({
      authorization:
        authorization.value,

      sdk,
      contract,

      entrypoint:
        "setExternalReference",

      serializer,

      parameter:
        "parameter",

      sender:
        "sender",

      signer:
        "signer",

      energyAllowance:
        allowance,

      state,
    });

  assert.equal(
    sendCalls,
    1,
  );

  assert.equal(
    "amount" in
      calls[0].metadata,
    false,
  );

  assert.equal(
    calls[0]
      .metadata
      .energy,
    energyMarker,
  );

  assert.equal(
    calls[0]
      .metadata
      .expiry,
    expiryMarker,
  );

  assert.equal(
    submitted
      .zeroCcdAttached,
    true,
  );

  assert.equal(
    submitted
      .submissionAttempts,
    1,
  );

  assert.equal(
    state
      .transactionConstructed,
    true,
  );

  assert.equal(
    state
      .transactionSigningAttempted,
    true,
  );

  assert.equal(
    state
      .transactionSubmissionAttempted,
    true,
  );

  assert.equal(
    state
      .transactionSubmitted,
    true,
  );

  await assert.rejects(
    async () =>
      runDemo4D41cSingleSubmissionForTestV1({
        authorization:
          authorization.value,

        sdk,
        contract,

        entrypoint:
          "setExternalReference",

        serializer,

        parameter:
          "parameter",

        sender:
          "sender",

        signer:
          "signer",

        energyAllowance:
          allowance,

        state,
      }),

    /duplicate_submission_forbidden/,
  );

  assert.equal(
    sendCalls,
    1,
  );

  const failedState = {
    transactionConstructed:
      false,
    transactionSigningAttempted:
      false,
    transactionSubmissionAttempted:
      false,
    submissionAttempts:
      0,
    transactionSubmitted:
      false,
    automaticRetryAttempted:
      false,
  };

  let failedSendCalls =
    0;

  await assert.rejects(
    async () =>
      runDemo4D41cSingleSubmissionForTestV1({
        authorization:
          authorization.value,

        sdk,

        contract: {
          async createAndSendUpdateTransaction() {
            failedSendCalls +=
              1;

            throw new Error(
              "synthetic_submission_failure",
            );
          },
        },

        entrypoint:
          "setExternalReference",

        serializer,

        parameter:
          "parameter",

        sender:
          "sender",

        signer:
          "signer",

        energyAllowance:
          allowance,

        state:
          failedState,
      }),

    /synthetic_submission_failure/,
  );

  assert.equal(
    failedSendCalls,
    1,
  );

  assert.equal(
    failedState
      .submissionAttempts,
    1,
  );

  assert.equal(
    failedState
      .transactionSubmitted,
    false,
  );

  await assert.rejects(
    async () =>
      runDemo4D41cSingleSubmissionForTestV1({
        authorization:
          authorization.value,

        sdk,

        contract: {
          async createAndSendUpdateTransaction() {
            failedSendCalls +=
              1;

            return {};
          },
        },

        entrypoint:
          "setExternalReference",

        serializer,

        parameter:
          "parameter",

        sender:
          "sender",

        signer:
          "signer",

        energyAllowance:
          allowance,

        state:
          failedState,
      }),

    /duplicate_submission_forbidden/,
  );

  assert.equal(
    failedSendCalls,
    1,
  );

  const invalidEnergyState = {
    transactionConstructed:
      false,
    transactionSigningAttempted:
      false,
    transactionSubmissionAttempted:
      false,
    submissionAttempts:
      0,
    transactionSubmitted:
      false,
    automaticRetryAttempted:
      false,
  };

  await assert.rejects(
    async () =>
      runDemo4D41cSingleSubmissionForTestV1({
        authorization:
          authorization.value,

        sdk,
        contract,

        entrypoint:
          "setExternalReference",

        serializer,

        parameter:
          "parameter",

        sender:
          "sender",

        signer:
          "signer",

        energyAllowance:
          100001n,

        state:
          invalidEnergyState,
      }),

    /transaction_energy_allowance_out_of_bounds/,
  );

  assert.equal(
    invalidEnergyState
      .submissionAttempts,
    0,
  );

  assert.equal(
    validateDemo4D41cFutureFinalizedObservationV1(
      validSyntheticFinalizedObservation(),
    ).ok,
    true,
  );

  const paymentMutation =
    validSyntheticFinalizedObservation();

  paymentMutation
    .safety
    .paymentAttempted =
      true;

  assert.equal(
    validateDemo4D41cFutureFinalizedObservationV1(
      paymentMutation,
    ).ok,
    false,
  );

  const runnerSource =
    readFileSync(
      RUNNER_PATH,
      "utf8",
    );

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.equal(
    (
      runnerSource.match(
        /buildAccountSigner\s*\(/g,
      ) ??
      []
    ).length,
    1,
  );

  assert.equal(
    (
      runnerSource.match(
        /createAndSendUpdateTransaction\s*\(/g,
      ) ??
      []
    ).length,
    1,
  );

  assert.equal(
    (
      runnerSource.match(
        /readFileSync\s*\(/g,
      ) ??
      []
    ).length,
    1,
  );

  const executionStart =
    runnerSource.indexOf(
      "export async function runDemo4D41cControlledExecutionV1(",
    );

  const executionEnd =
    runnerSource.indexOf(
      "async function main():",
      executionStart,
    );

  assert.equal(
    executionStart >=
      0 &&
    executionEnd >
      executionStart,
    true,
    "execution_source_boundary_missing",
  );

  const executionSource =
    runnerSource.slice(
      executionStart,
      executionEnd,
    );

  assert.equal(
    (
      executionSource.match(
        /await invokeDecodedReadOnly/g,
      ) ??
      []
    ).length,
    6,
    "execution_must_revalidate_exactly_six_pre_post_state_queries",
  );

  for (
    const forbidden
    of [
      "sendAccountTransaction(",
      "sendBlockItem(",
      "writeFileSync(",
      "PAYMENT-RESPONSE",
    ]
  ) {
    assert.equal(
      runnerSource.includes(
        forbidden,
      ),
      false,
      `forbidden_execution_surface:${forbidden}`,
    );
  }

  console.log(
    "PR314_EXACTLY_ONE_EXECUTION_OFFLINE_TESTS_PASSED=true",
  );
}

async function main():
Promise<void> {
  await testBoundedContractDryRunInvocation();

  await testExactlyOneExecutionBoundary();

  testStrictExternalReferenceContractAddressSchemaValue();

  testEmbeddedSchemaByteNormalization();

  testObservedPositiveReverseLookupAgentRecordShape();

  const plan =
    buildDemo4D41cControlledExecutionPlanV1();

  assert.equal(
    plan.stage,
    DEMO4_D4_1C_CONTROLLED_EXECUTION_STAGE,
  );

  assert.equal(
    plan.status,
    "controlled_execution_implementation_locked",
  );

  assert.equal(
    plan.sourceHandoffStatus,
    "pr314_controlled_attachment_preflight_ready",
  );

  assert.equal(
    plan.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );

  assert.equal(
    plan.cis8004.contract.index,
    12802,
  );

  assert.equal(
    plan.cis8004.contract.subindex,
    0,
  );

  assert.equal(
    plan.cis8004.tokenId,
    287,
  );

  assert.equal(
    plan.cis8004.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    plan.cis8004.receiveName,
    "CIS-8004.setExternalReference",
  );

  assert.equal(
    plan.cis8.contract.index,
    12801,
  );

  assert.equal(
    plan.cis8.contract.subindex,
    0,
  );

  assert.equal(
    plan.parameter.byteLength,
    117,
  );

  assert.equal(
    plan.parameter.sha256,
    "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",
  );

  assert.equal(
    plan.parameter.deterministicBytesReverified,
    true,
  );

  assert.equal(
    plan.submissionLimit,
    1,
  );

  assert.equal(
    plan.submissionAttemptsBefore,
    0,
  );

  assert.equal(
    plan.remainingSubmissionAttempts,
    1,
  );

  assert.equal(
    plan.automaticRetryAuthorized,
    false,
  );

  assert.equal(
    plan.zeroCcdRequired,
    true,
  );

  assert.equal(
    plan.separateExecutionAuthorizationRequired,
    true,
  );

  assert.equal(
    plan.transactionExecutionAuthorized,
    false,
  );

  assert.equal(
    plan.d4_1cAttachmentAuthorized,
    false,
  );

  assert.equal(
    plan.executeDispatchEnabled,
    false,
  );

  assert.equal(
    DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED,
    false,
  );

  assert.equal(
    DEMO4_D4_1C_CONTROLLED_EXECUTION_SAFETY
      .executeDispatchEnabled,
    false,
  );

  assert.equal(
    DEMO4_D4_1C_GATE_E_PR314_HANDOFF
      .futureExecutionBoundary
      .transactionExecutionAuthorized,
    false,
  );

  const inspect =
    validateDemo4D41cControlledExecutionActivationV1(
      lockedActivation(),
    );

  assert.equal(
    inspect.ok,
    true,
  );

  if (
    inspect.ok
  ) {
    assert.equal(
      inspect.value.status,
      "inspect_only_execute_locked",
    );

    assert.equal(
      inspect.value.transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      inspect.value.d4_1cAttachmentAuthorized,
      false,
    );
  }

  const execute =
    validateDemo4D41cControlledExecutionActivationV1(
      lockedActivation({
        mode:
          "execute",
      }),
    );

  assert.deepEqual(
    execute,
    {
      ok:
        false,

      reason:
        "execute_dispatch_locked",
    },
  );

  for (
    const capability
    of [
      "explicitControlledExecutionAuthorizationConfirmed",
      "walletReadEnabled",
      "signerCreationEnabled",
      "transactionConstructionEnabled",
      "transactionSigningEnabled",
      "transactionSubmissionEnabled",
      "paymentEnabled",
    ]
  ) {
    assert.deepEqual(
      validateDemo4D41cControlledExecutionActivationV1(
        lockedActivation({
          [capability]:
            true,
        }),
      ),
      {
        ok:
          false,

        reason:
          "initial_slice_capability_forbidden",
      },
      capability,
    );
  }

  const validObservation =
    validSyntheticFinalizedObservation();

  const validated =
    validateDemo4D41cFutureFinalizedObservationV1(
      validObservation,
    );

  assert.equal(
    validated.ok,
    true,
  );

  if (
    validated.ok
  ) {
    assert.equal(
      validated.value.status,
      "finalized_external_reference_attachment_confirmed",
    );

    assert.equal(
      validated.value.reverseLookupTokenId,
      "287",
    );

    assert.equal(
      validated.value.postAgent.status,
      "Active",
    );

    assert.equal(
      validated.value.cis8PostState.status,
      "Active",
    );

    assert.equal(
      validated.value.safety.cis8Mutated,
      false,
    );

    assert.equal(
      validated.value.safety.paymentAttempted,
      false,
    );
  }

  const wrongReverse =
    structuredClone(
      validObservation,
    );

  wrongReverse.reverseLookupTokenId =
    "288";

  assert.deepEqual(
    validateDemo4D41cFutureFinalizedObservationV1(
      wrongReverse,
    ),
    {
      ok:
        false,

      reason:
        "reverse_lookup_postcondition_failed",
    },
  );

  const wrongOwner = {
    ...validObservation,

    postAgent: {
      ...validObservation.postAgent,

      ownerAccount:
        "wrong-owner",
    },
  };

  assert.deepEqual(
    validateDemo4D41cFutureFinalizedObservationV1(
      wrongOwner,
    ),
    {
      ok:
        false,

      reason:
        "cis8004_postcondition_failed",
    },
  );

  const wrongExternalKey = {
    ...validObservation,

    postAgent: {
      ...validObservation.postAgent,

      externalReference: {
        ...validObservation
          .postAgent
          .externalReference,

        externalKey: {
          ...validObservation
            .postAgent
            .externalReference
            .externalKey,

          publicKeyHex:
            "00".repeat(
              32,
            ),
        },
      },
    },
  };

  assert.deepEqual(
    validateDemo4D41cFutureFinalizedObservationV1(
      wrongExternalKey,
    ),
    {
      ok:
        false,

      reason:
        "cis8004_postcondition_failed",
    },
  );

  const mutatedCis8 =
    structuredClone(
      validObservation,
    );

  mutatedCis8.safety.cis8Mutated =
    true;

  assert.deepEqual(
    validateDemo4D41cFutureFinalizedObservationV1(
      mutatedCis8,
    ),
    {
      ok:
        false,

      reason:
        "unsafe_finalized_evidence",
    },
  );

  const retry =
    structuredClone(
      validObservation,
    );

  retry.automaticRetryAttempted =
    true;

  assert.deepEqual(
    validateDemo4D41cFutureFinalizedObservationV1(
      retry,
    ),
    {
      ok:
        false,

      reason:
        "submission_safety_postcondition_failed",
    },
  );

  assert.equal(
    DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED,
    false,
  );

  assert.equal(
    DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED,
    false,
  );

  const livePreExecutionObservation =
    validSyntheticLivePreExecutionObservation();

  const livePreExecutionValidated =
    validateDemo4D41cLivePreExecutionObservationV1(
      livePreExecutionObservation,
    );

  assert.equal(
    livePreExecutionValidated.ok,
    true,
  );

  if (
    livePreExecutionValidated.ok
  ) {
    assert.equal(
      livePreExecutionValidated.value.status,
      "live_preexecution_readiness_confirmed",
    );

    assert.equal(
      livePreExecutionValidated
        .value
        .cis8004
        .externalReferencePresent,
      false,
    );

    assert.equal(
      livePreExecutionValidated
        .value
        .reverseReference
        .alreadyAttached,
      false,
    );

    assert.equal(
      livePreExecutionValidated
        .value
        .cis8
        .status,
      "Active",
    );

    assert.equal(
      livePreExecutionValidated
        .value
        .parameter
        .exactSdkByteEquivalence,
      true,
    );

    assert.equal(
      livePreExecutionValidated
        .value
        .dryRunBoundary
        .performed,
      false,
    );
  }

  const nonFinalized = {
    ...livePreExecutionObservation,

    finalizedSnapshot: {
      ...livePreExecutionObservation
        .finalizedSnapshot,

      finalized:
        false,
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      nonFinalized,
    ),
    {
      ok:
        false,

      reason:
        "finalized_snapshot_revalidation_failed",
    },
  );

  const alreadyAttached = {
    ...livePreExecutionObservation,

    cis8004: {
      ...livePreExecutionObservation
        .cis8004,

      externalReferencePresent:
        true,
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      alreadyAttached,
    ),
    {
      ok:
        false,

      reason:
        "cis8004_live_revalidation_failed",
    },
  );

  const reverseAttached = {
    ...livePreExecutionObservation,

    reverseReference: {
      ...livePreExecutionObservation
        .reverseReference,

      alreadyAttached:
        true,

      unique:
        false,
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      reverseAttached,
    ),
    {
      ok:
        false,

      reason:
        "reverse_reference_live_revalidation_failed",
    },
  );

  const inactiveCis8 = {
    ...livePreExecutionObservation,

    cis8: {
      ...livePreExecutionObservation
        .cis8,

      status:
        "Revoked",
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      inactiveCis8,
    ),
    {
      ok:
        false,

      reason:
        "cis8_live_revalidation_failed",
    },
  );

  const wrongSchema = {
    ...livePreExecutionObservation,

    cis8004: {
      ...livePreExecutionObservation
        .cis8004,

      embeddedSchemaSha256:
        "0".repeat(
          64,
        ),
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      wrongSchema,
    ),
    {
      ok:
        false,

      reason:
        "cis8004_live_revalidation_failed",
    },
  );

  const wrongSdkParameter = {
    ...livePreExecutionObservation,

    parameter: {
      ...livePreExecutionObservation
        .parameter,

      sdkSerializedSha256:
        "0".repeat(
          64,
        ),

      exactSdkByteEquivalence:
        false,
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      wrongSdkParameter,
    ),
    {
      ok:
        false,

      reason:
        "deployed_schema_parameter_revalidation_failed",
    },
  );

  const unauthorizedDryRun = {
    ...livePreExecutionObservation,

    dryRunBoundary: {
      ...livePreExecutionObservation
        .dryRunBoundary,

      authorizationPresent:
        true,

      invocationAttempted:
        true,

      performed:
        true,
    },
  };

  assert.deepEqual(
    validateDemo4D41cLivePreExecutionObservationV1(
      unauthorizedDryRun,
    ),
    {
      ok:
        false,

      reason:
        "dry_run_boundary_must_remain_locked",
    },
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .implementationDefined,
    true,
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .dispatchAuthorized,
    false,
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .expectedReadOnlyStateQueryCount,
    3,
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .parameterByteLength,
    117,
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .cis8004
      .reverseLookupEntrypoint,
    "agentByExternalReference",
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_PROFILE
      .parameterSha256,
    DEMO4_D4_1C_CONTROLLED_EXECUTION_PROFILE
      .parameter
      .sha256,
  );

  assert.equal(
    DEMO4_D4_1C_PUBLIC_READ_IMPLEMENTATION_AVAILABLE,
    true,
  );

  const runnerSource =
    readFileSync(
      RUNNER_PATH,
      "utf8",
    );

  const coreSource =
    readFileSync(
      CORE_PATH,
      "utf8",
    );

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  for (
    const requiredPublicReadSurface
    of [
      "@concordium/web-sdk",
      "ConcordiumGRPCNodeClient",
      "getConsensusStatus",
      "getBlockInfo",
      "getInstanceInfo",
      "getEmbeddedSchema",
      "invokeContract",
      "reverseLookupEntrypoint",
      "ownerOfKey",
      "validateDemo4D41cLivePreExecutionObservationV1",
    ]
  ) {
    assert.equal(
      runnerSource.includes(
        requiredPublicReadSurface,
      ),
      true,
      `required_public_read_surface:${requiredPublicReadSurface}`,
    );
  }

  for (
    const forbiddenRuntimeSurface
    of [
      "sendAccountTransaction",
      "sendBlockItem",
      "writeFileSync",
      "walletExport",
      "privateKeyPath",
      "privateKeyMaterial",
    ]
  ) {
    assert.equal(
      runnerSource.includes(
        forbiddenRuntimeSurface,
      ),
      false,
      `forbidden_runtime_surface:${forbiddenRuntimeSurface}`,
    );
  }


  const boundedDryRunPrimitiveStart =
    runnerSource.indexOf(
      "export async function runDemo4D41cBoundedDryRunInvocationForTestV1(",
    );

  const boundedDryRunPrimitiveEnd =
    runnerSource.indexOf(
      "export async function runDemo4D41cContractDryRunV1(",
      boundedDryRunPrimitiveStart,
    );

  assert.equal(
    boundedDryRunPrimitiveStart >=
      0,
    true,
    "bounded_dry_run_primitive_missing",
  );

  assert.equal(
    boundedDryRunPrimitiveEnd >
      boundedDryRunPrimitiveStart,
    true,
    "bounded_dry_run_primitive_boundary_missing",
  );

  const boundedDryRunPrimitiveSource =
    runnerSource.slice(
      boundedDryRunPrimitiveStart,
      boundedDryRunPrimitiveEnd,
    );

  for (
    const requiredBoundedDryRunSurface
    of [
      ".invokeContract(",
      ".CcdAmount",
      ".zero()",
      ".Energy",
      ".create(",
      "100_000n",
      "CIS-8004.setExternalReference",
      "dry_run_energy_exceeds_safety_cap",
      "set_external_reference_dry_run_failed",
    ]
  ) {
    assert.equal(
      boundedDryRunPrimitiveSource.includes(
        requiredBoundedDryRunSurface,
      ),
      true,
      `required_bounded_dry_run_surface:${requiredBoundedDryRunSurface}`,
    );
  }

  const runnerOutsideBoundedDryRunPrimitive =
    runnerSource.slice(
      0,
      boundedDryRunPrimitiveStart,
    ) +
    runnerSource.slice(
      boundedDryRunPrimitiveEnd,
    );

  for (
    const dryRunOnlySurface
    of [
      "CcdAmount",
    ]
  ) {
    assert.equal(
      runnerOutsideBoundedDryRunPrimitive.includes(
        dryRunOnlySurface,
      ),
      false,
      `dry_run_capability_escaped_bounded_primitive:${dryRunOnlySurface}`,
    );
  }

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.equal(
    runnerSource.includes(
      "runDemo4D41cContractDryRunV1",
    ),
    true,
  );

  assert.equal(
    runnerSource.includes(
      "DEMO4_D4_1C_DRY_RUN_IMPLEMENTATION_AVAILABLE",
    ),
    true,
  );

  const liveDryRunStart =
    runnerSource.indexOf(
      "export async function runDemo4D41cContractDryRunV1()",
    );

  const liveDryRunEnd =
    runnerSource.indexOf(
      "const DEMO4_D4_1C_MAX_WALLET_BYTES =",
      liveDryRunStart,
    );

  assert.equal(
    liveDryRunStart >=
      0 &&
    liveDryRunEnd >
      liveDryRunStart,
    true,
    "live_dry_run_surface_missing",
  );

  const liveDryRunSource =
    runnerSource.slice(
      liveDryRunStart,
      liveDryRunEnd,
    );

  assert.equal(
    (
      liveDryRunSource.match(
        /await invokeDecodedReadOnly/g,
      ) ??
      []
    ).length,
    3,
    "live_dry_run_must_revalidate_exactly_three_state_queries",
  );

  for (
    const requiredLiveDryRunPreconditionSurface
    of [
      "getConsensusStatus",
      "getBlockInfo",
      "getInstanceInfo",
      "getEmbeddedSchema",
      "agentOfEntrypoint",
      "reverseLookupEntrypoint",
      "ownerOfKeyEntrypoint",
      "validateDemo4D41cLivePreExecutionObservationV1",
      "runDemo4D41cBoundedDryRunInvocationForTestV1",
      "sdk.serializeUpdateContractParameters",
    ]
  ) {
    assert.equal(
      liveDryRunSource.includes(
        requiredLiveDryRunPreconditionSurface,
      ),
      true,
      `required_live_dry_run_precondition_surface:${requiredLiveDryRunPreconditionSurface}`,
    );
  }

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_EXECUTE_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_LIVE_PREEXECUTION_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.match(
    runnerSource,
    /DEMO4_D4_1C_DRY_RUN_DISPATCH_ENABLED\s*=\s*\n?\s*false/,
  );

  assert.equal(
    coreSource.includes(
      "createAndSendUpdateTransaction",
    ),
    false,
  );

  console.log(
    "PR314_INITIAL_OFFLINE_CONTROLLED_EXECUTION_TESTS_PASSED=true",
  );
  console.log(
    `PR314_STAGE=${plan.stage}`,
  );
  console.log(
    `NETWORK=${plan.network}`,
  );
  console.log(
    `CIS8004_CONTRACT=<${plan.cis8004.contract.index},${plan.cis8004.contract.subindex}>`,
  );
  console.log(
    `AGENT_TOKEN_ID=${plan.cis8004.tokenId}`,
  );
  console.log(
    `CIS8_CONTRACT=<${plan.cis8.contract.index},${plan.cis8.contract.subindex}>`,
  );
  console.log(
    `PARAMETER_BYTE_LENGTH=${plan.parameter.byteLength}`,
  );
  console.log(
    `PARAMETER_SHA256=${plan.parameter.sha256}`,
  );
  console.log(
    `SUBMISSION_LIMIT=${plan.submissionLimit}`,
  );
  console.log(
    `SUBMISSION_ATTEMPTS_BEFORE=${plan.submissionAttemptsBefore}`,
  );
  console.log(
    `ZERO_CCD_REQUIRED=${plan.zeroCcdRequired}`,
  );
  console.log(
    `AUTOMATIC_RETRY_AUTHORIZED=${plan.automaticRetryAuthorized}`,
  );
  console.log(
    `EXECUTE_DISPATCH_ENABLED=${plan.executeDispatchEnabled}`,
  );
  console.log(
    `TRANSACTION_EXECUTION_AUTHORIZED=${plan.transactionExecutionAuthorized}`,
  );
  console.log(
    `D4_1C_ATTACHMENT_AUTHORIZED=${plan.d4_1cAttachmentAuthorized}`,
  );
  console.log(
    "NETWORK_CALLED=false",
  );
  console.log(
    "PRIVATE_KEY_READ=false",
  );
  console.log(
    "WALLET_READ=false",
  );
  console.log(
    "SIGNER_CREATED=false",
  );
  console.log(
    "CONTRACT_DRY_RUN_PERFORMED=false",
  );
  console.log(
    "TRANSACTION_CONSTRUCTED=false",
  );
  console.log(
    "TRANSACTION_SIGNED=false",
  );
  console.log(
    "TRANSACTION_SUBMITTED=false",
  );
  console.log(
    "PAYMENT_ATTEMPTED=false",
  );
  console.log(
    "D4_1C_PERFORMED=false",
  );
}

void main().catch(
  (
    error:
      unknown,
  ) => {
    const message =
      error instanceof
        Error
        ? error.message
        : String(
            error,
          );

    console.error(
      `PR314_OFFLINE_CI_FAILED=${message}`,
    );

    process.exitCode =
      1;
  },
);
