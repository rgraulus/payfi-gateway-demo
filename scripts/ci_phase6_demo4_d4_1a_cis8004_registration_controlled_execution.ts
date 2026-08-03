/**
 * PR #311 — Demo4 D4-1A controlled CIS-8004 registration execution.
 *
 * This CI harness exercises only the side-effect-free core. It does not read
 * environment variables, files, private keys, wallets, or network state. It
 * does not create signers, construct or submit transactions, write evidence,
 * mutate CIS-8004/CIS-8, make payments, activate Gateway runtime, release a
 * protected resource, settle, issue receipts, attach D4-1C, revoke, or retry.
 */

import assert from "node:assert/strict";
import {
  after,
  test,
} from "node:test";

import {
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,
  DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,
  buildDemo4D41aCis8004RegistrationPreflightV1,
} from "../src/phase6/demo4Cis8004IdentityRegistrationPreflight";

import {
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES,
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE,
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_SAFETY,
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE,
  DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION,
  authorizeDemo4D41aCis8004SubmissionV1,
  buildDemo4D41aCis8004ControlledExecutionPlanV1,
  buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1,
  validateDemo4D41aCis8004ControlledExecutionActivationV1,
  validateDemo4D41aCis8004DryRunObservationV1,
  type Demo4D41aCis8004ControlledExecutionActivationDecisionV1,
  type Demo4D41aCis8004ControlledExecutionPlanV1,
  type Demo4D41aCis8004ControlledExecutionResultV1,
  type Demo4D41aCis8004ExecutionPreStateV1,
  type Demo4D41aCis8004FinalizedExecutionObservationV1,
  type Demo4D41aCis8004SubmissionAuthorizationV1,
  type Demo4D41aCis8004ValidatedDryRunV1,
} from "../src/phase6/demo4Cis8004IdentityRegistrationControlledExecution";

let acceptedCases =
  0;

let rejectionCases =
  0;

function expectAccepted<T>(
  result:
    Demo4D41aCis8004ControlledExecutionResultV1<T>,
): T {
  assert.equal(
    result.ok,
    true,
  );

  if (
    result.ok !==
      true
  ) {
    throw new Error(
      `expected accepted result, received ${result.reason}`,
    );
  }

  acceptedCases +=
    1;

  return result.value;
}

function expectRejected(
  result:
    Demo4D41aCis8004ControlledExecutionResultV1<unknown>,
  reason:
    string,
): void {
  assert.equal(
    result.ok,
    false,
  );

  if (
    result.ok ===
      true
  ) {
    throw new Error(
      "expected rejected result",
    );
  }

  assert.equal(
    result.reason,
    reason,
  );

  rejectionCases +=
    1;
}

function validPreflightEvidence() {
  const profile =
    DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_PROFILE;

  return {
    type:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_VERSION,

    finalized:
      true,

    finalizedBlockHeight:
      "1",

    network:
      profile.network,

    contractIndex:
      profile.registry.contract.index,

    contractSubindex:
      profile.registry.contract.subindex,

    contractName:
      profile.registry.contractName,

    registerEntrypoint:
      profile.registry.registerEntrypoint,

    moduleReference:
      profile.registry.moduleReference,

    ownerAccount:
      profile.ownerAccount,

    agentCardUri:
      profile.agentCard.uri,

    agentCardUriUtf8ByteLength:
      profile.agentCard.uriUtf8ByteLength,

    agentCardByteLength:
      profile.agentCard.byteLength,

    agentCardSha256:
      profile.agentCard.sha256,

    metadataHashByteLength:
      32,

    moduleSchemaByteLength:
      profile.deployedSchema.moduleSchemaByteLength,

    moduleSchemaSha256:
      profile.deployedSchema.moduleSchemaSha256,

    registerParameterSchemaByteLength:
      profile.deployedSchema.registerParameterSchemaByteLength,

    registerParameterSchemaSha256:
      profile.deployedSchema.registerParameterSchemaSha256,

    deterministicSerialization:
      true,

    parameterByteLength:
      profile.canonicalSerialization.parameterByteLength,

    parameterSha256:
      profile.canonicalSerialization.parameterSha256,

    externalReferencePresent:
      false,

    initialMetadataEntryCount:
      0,

    pr309Disposition:
      profile.pr309Guard.disposition,

    replacementProfileStatus:
      profile.pr309Guard.replacementProfileStatus,

    existingRegistrationAttachable:
      false,

    existingXcfPhase5ReferenceMustNotBeAttached:
      true,

    d4_1cBlocked:
      true,

    safety:
      DEMO4_D4_1A_CIS8004_REGISTRATION_PREFLIGHT_SAFETY,
  } as const;
}

function validPlan():
Demo4D41aCis8004ControlledExecutionPlanV1 {
  const preflight =
    buildDemo4D41aCis8004RegistrationPreflightV1(
      validPreflightEvidence(),
    );

  return expectAccepted(
    buildDemo4D41aCis8004ControlledExecutionPlanV1(
      preflight,
    ),
  );
}

function inspectActivation():
Demo4D41aCis8004ControlledExecutionActivationDecisionV1 {
  return expectAccepted(
    validateDemo4D41aCis8004ControlledExecutionActivationV1({
      mode:
        "inspect",

      testnetOnly:
        "true",

      networkReadEnabled:
        "true",
    }),
  );
}

function dryRunActivation():
Demo4D41aCis8004ControlledExecutionActivationDecisionV1 {
  return expectAccepted(
    validateDemo4D41aCis8004ControlledExecutionActivationV1({
      mode:
        "dry_run",

      testnetOnly:
        "true",

      networkReadEnabled:
        "true",

      dryRunEnabled:
        "true",
    }),
  );
}

function executeActivation():
Demo4D41aCis8004ControlledExecutionActivationDecisionV1 {
  return expectAccepted(
    validateDemo4D41aCis8004ControlledExecutionActivationV1({
      mode:
        "execute",

      testnetOnly:
        "true",

      networkReadEnabled:
        "true",

      dryRunEnabled:
        "true",

      privateKeyReadEnabled:
        "true",

      walletReadEnabled:
        "true",

      executionEnabled:
        "true",

      evidenceWriteEnabled:
        "true",

      automaticRetryEnabled:
        "false",
    }),
  );
}

function validDryRun():
Demo4D41aCis8004ValidatedDryRunV1 {
  const profile =
    DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE;

  return expectAccepted(
    validateDemo4D41aCis8004DryRunObservationV1({
      ok:
        true,

      finalizedState:
        true,

      network:
        profile.network,

      contract:
        profile.registry.contract,

      receiveName:
        profile.registry.receiveName,

      parameterByteLength:
        profile.canonicalParameter.byteLength,

      parameterSha256:
        profile.canonicalParameter.sha256,

      usedEnergy:
        "12345",

      returnValuePresent:
        true,

      walletRead:
        false,

      privateKeyRead:
        false,

      signerCreated:
        false,

      signingAttempted:
        false,

      transactionConstructed:
        false,

      transactionSubmitted:
        false,

      automaticRetryAttempted:
        false,
    }),
  );
}

function validPreState():
Demo4D41aCis8004ExecutionPreStateV1 {
  return {
    finalized:
      true,

    protectedToken0Present:
      true,

    protectedToken5Present:
      true,
  };
}

function validSubmissionAuthorization():
Demo4D41aCis8004SubmissionAuthorizationV1 {
  return expectAccepted(
    authorizeDemo4D41aCis8004SubmissionV1({
      activation:
        executeActivation(),

      plan:
        validPlan(),

      dryRun:
        validDryRun(),

      preState:
        validPreState(),

      submissionAttemptsBefore:
        0,
    }),
  );
}

function validFinalizedObservation():
Demo4D41aCis8004FinalizedExecutionObservationV1 {
  const profile =
    DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE;

  return {
    submissionAuthorization:
      validSubmissionAuthorization(),

    submissionAttempts:
      1,

    automaticRetryAttempted:
      false,

    transaction:
      {
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

        energyCost:
          "12345",

        costMicroCcd:
          "6789",

        transactionType:
          "Update",
      },

    registrationEvent:
      {
        tokenId:
          "42",

        owner:
          profile.ownerAccount,

        agentUri:
          profile.agentCard.uri,

        metadataHashHex:
          profile.agentCard.metadataHashHex,

        externalReferencePresent:
          false,

        initialMetadataEntryCount:
          0,
      },

    freshTokenProof:
      {
        tokenId:
          "42",

        tokenAbsentAtPreState:
          true,

        preStateFinalized:
          true,

        preStateFinalizedBlockHash:
          "c".repeat(
            64,
          ),
      },

    ownershipPostcondition:
      {
        tokenId:
          "42",

        registrationExists:
          true,

        owner:
          profile.ownerAccount,

        agentUri:
          profile.agentCard.uri,

        metadataHashHex:
          profile.agentCard.metadataHashHex,

        finalized:
          true,

        finalizedBlockHash:
          "b".repeat(
            64,
          ),
      },

    protectedTokens:
      {
        token0Unchanged:
          true,

        token5Unchanged:
          true,
      },

    safety:
      {
        gatewayRuntimeActivated:
          false,

        protectedResourceReleased:
          false,

        paymentAttempted:
          false,

        settlementAttempted:
          false,

        receiptIssued:
          false,

        d4_1cAttached:
          false,

        revocationAttempted:
          false,
      },
  };
}

test(
  "freezes the finite PR #311 profile",
  () => {
    assert.deepEqual(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES,
      [
        "inspect",
        "dry_run",
        "execute",
      ],
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_TYPE,
      "xcf.demo4.d4-1a.cis8004-registration-controlled-execution",
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_VERSION,
      "1",
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .canonicalParameter
        .byteLength,
      106,
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .canonicalParameter
        .sha256,
      "4e3549b270941d7f5381a28660f4cd96806011c571f477dd2da3f7ae9707449b",
    );

    assert.deepEqual(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .protectedTokenIds,
      [
        "0",
        "5",
      ],
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .submissionLimit,
      1,
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
        .automaticRetry,
      false,
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_SAFETY
        .externalReferencePresent,
      false,
    );

    assert.equal(
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_SAFETY
        .initialMetadataEntryCount,
      0,
    );
  },
);

test(
  "accepts inspect mode as network-read-only",
  () => {
    const value =
      inspectActivation();

    assert.equal(
      value.mode,
      "inspect",
    );

    assert.equal(
      value.mayReadNetwork,
      true,
    );

    assert.equal(
      value.mayDryRun,
      false,
    );

    assert.equal(
      value.mayReadPrivateKey,
      false,
    );

    assert.equal(
      value.mayReadWallet,
      false,
    );

    assert.equal(
      value.maySubmitTransaction,
      false,
    );

    assert.equal(
      value.mayWriteEvidence,
      false,
    );

    assert.equal(
      value.automaticRetryAuthorized,
      false,
    );
  },
);

test(
  "accepts dry-run mode without key, wallet, or transaction authority",
  () => {
    const value =
      dryRunActivation();

    assert.equal(
      value.mode,
      "dry_run",
    );

    assert.equal(
      value.mayDryRun,
      true,
    );

    assert.equal(
      value.mayReadPrivateKey,
      false,
    );

    assert.equal(
      value.mayReadWallet,
      false,
    );

    assert.equal(
      value.mayCreateSigner,
      false,
    );

    assert.equal(
      value.mayConstructTransaction,
      false,
    );

    assert.equal(
      value.maySubmitTransaction,
      false,
    );
  },
);

test(
  "accepts execute mode only with all explicit gates",
  () => {
    const value =
      executeActivation();

    assert.equal(
      value.mode,
      "execute",
    );

    assert.equal(
      value.mayDryRun,
      true,
    );

    assert.equal(
      value.mayReadPrivateKey,
      true,
    );

    assert.equal(
      value.mayReadWallet,
      true,
    );

    assert.equal(
      value.mayCreateSigner,
      true,
    );

    assert.equal(
      value.maySign,
      true,
    );

    assert.equal(
      value.mayConstructTransaction,
      true,
    );

    assert.equal(
      value.maySubmitTransaction,
      true,
    );

    assert.equal(
      value.mayWriteEvidence,
      true,
    );

    assert.equal(
      value.automaticRetryAuthorized,
      false,
    );
  },
);

test(
  "rejects invalid modes and boolean literals",
  () => {
    expectRejected(
      validateDemo4D41aCis8004ControlledExecutionActivationV1({
        mode:
          "unknown",
      }),
      "invalid_mode",
    );

    expectRejected(
      validateDemo4D41aCis8004ControlledExecutionActivationV1({
        mode:
          "inspect",

        testnetOnly:
          "yes",

        networkReadEnabled:
          "true",
      }),
      "invalid_boolean_literal",
    );
  },
);

test(
  "requires testnet and network-read gates",
  () => {
    expectRejected(
      validateDemo4D41aCis8004ControlledExecutionActivationV1({
        mode:
          "inspect",

        testnetOnly:
          "false",

        networkReadEnabled:
          "true",
      }),
      "testnet_only_gate_required",
    );

    expectRejected(
      validateDemo4D41aCis8004ControlledExecutionActivationV1({
        mode:
          "inspect",

        testnetOnly:
          "true",
      }),
      "network_gate_required",
    );
  },
);

test(
  "forbids automatic retry in every mode",
  () => {
    for (
      const mode of
        DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_MODES
    ) {
      expectRejected(
        validateDemo4D41aCis8004ControlledExecutionActivationV1({
          mode,

          testnetOnly:
            "true",

          networkReadEnabled:
            "true",

          dryRunEnabled:
            mode === "inspect"
              ? "false"
              : "true",

          privateKeyReadEnabled:
            mode === "execute"
              ? "true"
              : "false",

          walletReadEnabled:
            mode === "execute"
              ? "true"
              : "false",

          executionEnabled:
            mode === "execute"
              ? "true"
              : "false",

          evidenceWriteEnabled:
            mode === "execute"
              ? "true"
              : "false",

          automaticRetryEnabled:
            "true",
        }),
        "automatic_retry_gate_forbidden",
      );
    }
  },
);

test(
  "inspect mode forbids all elevated gates",
  () => {
    const cases =
      [
        [
          "dryRunEnabled",
          "dry_run_gate_forbidden",
        ],
        [
          "privateKeyReadEnabled",
          "private_key_gate_forbidden",
        ],
        [
          "walletReadEnabled",
          "wallet_gate_forbidden",
        ],
        [
          "executionEnabled",
          "execution_gate_forbidden",
        ],
        [
          "evidenceWriteEnabled",
          "evidence_write_gate_forbidden",
        ],
      ] as const;

    for (
      const [
        key,
        reason,
      ] of cases
    ) {
      expectRejected(
        validateDemo4D41aCis8004ControlledExecutionActivationV1({
          mode:
            "inspect",

          testnetOnly:
            "true",

          networkReadEnabled:
            "true",

          [key]:
            "true",
        }),
        reason,
      );
    }
  },
);

test(
  "dry-run mode requires its gate and forbids elevated gates",
  () => {
    expectRejected(
      validateDemo4D41aCis8004ControlledExecutionActivationV1({
        mode:
          "dry_run",

        testnetOnly:
          "true",

        networkReadEnabled:
          "true",
      }),
      "dry_run_gate_required",
    );

    const cases =
      [
        [
          "privateKeyReadEnabled",
          "private_key_gate_forbidden",
        ],
        [
          "walletReadEnabled",
          "wallet_gate_forbidden",
        ],
        [
          "executionEnabled",
          "execution_gate_forbidden",
        ],
        [
          "evidenceWriteEnabled",
          "evidence_write_gate_forbidden",
        ],
      ] as const;

    for (
      const [
        key,
        reason,
      ] of cases
    ) {
      expectRejected(
        validateDemo4D41aCis8004ControlledExecutionActivationV1({
          mode:
            "dry_run",

          testnetOnly:
            "true",

          networkReadEnabled:
            "true",

          dryRunEnabled:
            "true",

          [key]:
            "true",
        }),
        reason,
      );
    }
  },
);

test(
  "execute mode requires every elevated gate",
  () => {
    const base =
      {
        mode:
          "execute",

        testnetOnly:
          "true",

        networkReadEnabled:
          "true",

        dryRunEnabled:
          "true",

        privateKeyReadEnabled:
          "true",

        walletReadEnabled:
          "true",

        executionEnabled:
          "true",

        evidenceWriteEnabled:
          "true",
      } as const;

    const cases =
      [
        [
          "dryRunEnabled",
          "dry_run_gate_required",
        ],
        [
          "privateKeyReadEnabled",
          "private_key_gate_required",
        ],
        [
          "walletReadEnabled",
          "wallet_gate_required",
        ],
        [
          "executionEnabled",
          "execution_gate_required",
        ],
        [
          "evidenceWriteEnabled",
          "evidence_write_gate_required",
        ],
      ] as const;

    for (
      const [
        key,
        reason,
      ] of cases
    ) {
      expectRejected(
        validateDemo4D41aCis8004ControlledExecutionActivationV1({
          ...base,

          [key]:
            "false",
        }),
        reason,
      );
    }
  },
);

test(
  "builds a frozen plan from the accepted PR #310 handoff",
  () => {
    const plan =
      validPlan();

    assert.equal(
      plan.status,
      "controlled_execution_ready",
    );

    assert.equal(
      plan.sourcePreflight.transactionExecutionAuthorized,
      false,
    );

    assert.equal(
      plan.network,
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.network,
    );

    assert.equal(
      plan.ownerAccount,
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.ownerAccount,
    );

    assert.deepEqual(
      plan.canonicalParameter,
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE.canonicalParameter,
    );

    assert.equal(
      plan.submissionLimit,
      1,
    );

    assert.equal(
      plan.automaticRetryAuthorized,
      false,
    );

    assert.equal(
      plan.transactionExecutionAuthorized,
      false,
    );
  },
);

test(
  "rejects invalid preflight handoffs",
  () => {
    expectRejected(
      buildDemo4D41aCis8004ControlledExecutionPlanV1({
        ok:
          false,

        status:
          "rejected",

        reason:
          "invalid_evidence_shape",
      } as any),
      "preflight_rejected",
    );

    const accepted =
      buildDemo4D41aCis8004RegistrationPreflightV1(
        validPreflightEvidence(),
      );

    assert.equal(
      accepted.ok,
      true,
    );

    if (
      accepted.ok !==
        true
    ) {
      throw new Error(
        "valid preflight unexpectedly rejected",
      );
    }

    expectRejected(
      buildDemo4D41aCis8004ControlledExecutionPlanV1({
        ...accepted,

        plan:
          {
            ...accepted.plan,

            transactionExecutionAuthorized:
              true,
          },
      } as any),
      "preflight_handoff_invalid",
    );
  },
);

test(
  "validates a finalized side-effect-free dry run",
  () => {
    const dryRun =
      validDryRun();

    assert.equal(
      dryRun.status,
      "dry_run_passed",
    );

    assert.equal(
      dryRun.finalizedState,
      true,
    );

    assert.equal(
      dryRun.parameterByteLength,
      106,
    );

    assert.equal(
      dryRun.sideEffectFree,
      true,
    );
  },
);

test(
  "rejects failed, wrong-target, and wrong-parameter dry runs",
  () => {
    const profile =
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE;

    const base =
      {
        ok:
          true,

        finalizedState:
          true,

        network:
          profile.network,

        contract:
          profile.registry.contract,

        receiveName:
          profile.registry.receiveName,

        parameterByteLength:
          profile.canonicalParameter.byteLength,

        parameterSha256:
          profile.canonicalParameter.sha256,

        usedEnergy:
          "12345",

        returnValuePresent:
          true,

        walletRead:
          false,

        privateKeyRead:
          false,

        signerCreated:
          false,

        signingAttempted:
          false,

        transactionConstructed:
          false,

        transactionSubmitted:
          false,

        automaticRetryAttempted:
          false,
      };

    expectRejected(
      validateDemo4D41aCis8004DryRunObservationV1({
        ...base,

        ok:
          false,
      }),
      "dry_run_rejected",
    );

    expectRejected(
      validateDemo4D41aCis8004DryRunObservationV1({
        ...base,

        receiveName:
          "CIS-8004.wrong",
      }),
      "dry_run_target_mismatch",
    );

    expectRejected(
      validateDemo4D41aCis8004DryRunObservationV1({
        ...base,

        parameterSha256:
          "0".repeat(
            64,
          ),
      }),
      "dry_run_parameter_mismatch",
    );
  },
);

test(
  "rejects every dry-run side effect",
  () => {
    const profile =
      DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE;

    const base =
      {
        ok:
          true,

        finalizedState:
          true,

        network:
          profile.network,

        contract:
          profile.registry.contract,

        receiveName:
          profile.registry.receiveName,

        parameterByteLength:
          profile.canonicalParameter.byteLength,

        parameterSha256:
          profile.canonicalParameter.sha256,

        usedEnergy:
          "12345",

        returnValuePresent:
          true,

        walletRead:
          false,

        privateKeyRead:
          false,

        signerCreated:
          false,

        signingAttempted:
          false,

        transactionConstructed:
          false,

        transactionSubmitted:
          false,

        automaticRetryAttempted:
          false,
      };

    for (
      const key of
        [
          "walletRead",
          "privateKeyRead",
          "signerCreated",
          "signingAttempted",
          "transactionConstructed",
          "transactionSubmitted",
          "automaticRetryAttempted",
        ] as const
    ) {
      expectRejected(
        validateDemo4D41aCis8004DryRunObservationV1({
          ...base,

          [key]:
            true,
        }),
        "dry_run_not_side_effect_free",
      );
    }
  },
);

test(
  "authorizes exactly one submission only after execute activation and dry run",
  () => {
    const authorization =
      validSubmissionAuthorization();

    assert.equal(
      authorization.status,
      "submission_authorized",
    );

    assert.equal(
      authorization.submissionLimit,
      1,
    );

    assert.equal(
      authorization.submissionAttemptsBefore,
      0,
    );

    assert.equal(
      authorization.remainingSubmissionAttempts,
      1,
    );

    assert.equal(
      authorization.automaticRetryAuthorized,
      false,
    );

    assert.equal(
      authorization.transactionExecutionAuthorized,
      true,
    );
  },
);

test(
  "rejects unsafe submission authorization states",
  () => {
    const input =
      {
        activation:
          executeActivation(),

        plan:
          validPlan(),

        dryRun:
          validDryRun(),

        preState:
          validPreState(),

        submissionAttemptsBefore:
          0,
      };

    expectRejected(
      authorizeDemo4D41aCis8004SubmissionV1({
        ...input,

        activation:
          inspectActivation(),
      }),
      "execute_mode_required",
    );

    expectRejected(
      authorizeDemo4D41aCis8004SubmissionV1({
        ...input,

        submissionAttemptsBefore:
          1,
      }),
      "submission_attempt_limit_exceeded",
    );

    expectRejected(
      authorizeDemo4D41aCis8004SubmissionV1({
        ...input,

        preState:
          {
            ...input.preState,

            finalized:
              false,
          },
      }),
      "pre_state_not_finalized",
    );

    expectRejected(
      authorizeDemo4D41aCis8004SubmissionV1({
        ...input,

        preState:
          {
            ...input.preState,

            protectedToken0Present:
              false,
          },
      }),
      "protected_token_precondition_failed",
    );


  },
);

test(
  "builds sanitized finalized evidence",
  () => {
    const evidence =
      expectAccepted(
        buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1(
          validFinalizedObservation(),
        ),
      );

    assert.equal(
      evidence.status,
      "finalized_registration_confirmed",
    );

    assert.equal(
      evidence.registration.tokenId,
      "42",
    );

    assert.equal(
      evidence.registration.externalReferencePresent,
      false,
    );

    assert.equal(
      evidence.registration.initialMetadataEntryCount,
      0,
    );

    assert.equal(
      evidence.protectedTokens.token0Unchanged,
      true,
    );

    assert.equal(
      evidence.protectedTokens.token5Unchanged,
      true,
    );

    assert.equal(
      evidence.safety.exactlyOneSubmissionAttempted,
      true,
    );

    assert.equal(
      evidence.safety.automaticRetryAttempted,
      false,
    );

    assert.equal(
      "wallet" in evidence,
      false,
    );

    assert.equal(
      "privateKey" in evidence,
      false,
    );

    assert.equal(
      "signer" in evidence,
      false,
    );
  },
);

test(
  "rejects submission-count, retry, finalization, and hash failures",
  () => {
    const valid =
      validFinalizedObservation();

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        submissionAttempts:
          2,
      }),
      "submission_attempt_limit_exceeded",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        automaticRetryAttempted:
          true,
      }),
      "unsafe_finalized_evidence",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        transaction:
          {
            ...valid.transaction,

            finalized:
              false,
          },
      }),
      "finalization_required",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        freshTokenProof:
          {
            ...valid.freshTokenProof,

            preStateFinalized:
              false,
          },
      }),
      "finalization_required",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        transaction:
          {
            ...valid.transaction,

            hash:
              "",
          },
      }),
      "transaction_hash_invalid",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        freshTokenProof:
          {
            ...valid.freshTokenProof,

            preStateFinalizedBlockHash:
              "",
          },
      }),
      "transaction_hash_invalid",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        freshTokenProof:
          {
            ...valid.freshTokenProof,

            preStateFinalizedBlockHash:
              valid.transaction.finalizedBlockHash,
          },
      }),
      "finalization_required",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        ownershipPostcondition:
          {
            ...valid.ownershipPostcondition,

            finalizedBlockHash:
              "d".repeat(
                64,
              ),
          },
      }),
      "finalization_required",
    );
  },
);

test(
  "requires pre-state token absence and unchanged protected tokens",
  () => {
    const valid =
      validFinalizedObservation();

    for (
      const tokenId of
        [
          "0",
          "5",
          "",
        ]
    ) {
      expectRejected(
        buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
          ...valid,

          registrationEvent:
            {
              ...valid.registrationEvent,

              tokenId,
            },
        }),
        "fresh_token_required",
      );
    }

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        freshTokenProof:
          {
            ...valid.freshTokenProof,

            tokenAbsentAtPreState:
              false,
          },
      }),
      "fresh_token_required",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        freshTokenProof:
          {
            ...valid.freshTokenProof,

            tokenId:
              "43",
          },
      }),
      "fresh_token_required",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        protectedTokens:
          {
            ...valid.protectedTokens,

            token0Unchanged:
              false,
          },
      }),
      "protected_token_mutation_detected",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        protectedTokens:
          {
            ...valid.protectedTokens,

            token5Unchanged:
              false,
          },
      }),
      "protected_token_mutation_detected",
    );
  },
);

test(
  "rejects mismatched registration and ownership postconditions",
  () => {
    const valid =
      validFinalizedObservation();

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        registrationEvent:
          {
            ...valid.registrationEvent,

            owner:
              "wrong-owner",
          },
      }),
      "registration_event_mismatch",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        registrationEvent:
          {
            ...valid.registrationEvent,

            externalReferencePresent:
              true,
          },
      }),
      "registration_event_mismatch",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        registrationEvent:
          {
            ...valid.registrationEvent,

            initialMetadataEntryCount:
              1,
          },
      }),
      "registration_event_mismatch",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        ownershipPostcondition:
          {
            ...valid.ownershipPostcondition,

            registrationExists:
              false,
          },
      }),
      "ownership_postcondition_failed",
    );

    expectRejected(
      buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
        ...valid,

        ownershipPostcondition:
          {
            ...valid.ownershipPostcondition,

            tokenId:
              "43",
          },
      }),
      "ownership_postcondition_failed",
    );
  },
);

test(
  "rejects every forbidden adjacent side effect",
  () => {
    const valid =
      validFinalizedObservation();

    for (
      const key of
        [
          "gatewayRuntimeActivated",
          "protectedResourceReleased",
          "paymentAttempted",
          "settlementAttempted",
          "receiptIssued",
          "d4_1cAttached",
          "revocationAttempted",
        ] as const
    ) {
      expectRejected(
        buildDemo4D41aCis8004SanitizedFinalizedEvidenceV1({
          ...valid,

          safety:
            {
              ...valid.safety,

              [key]:
                true,
            },
        }),
        "unsafe_finalized_evidence",
      );
    }
  },
);

after(
  () => {
    assert.ok(
      acceptedCases >=
        10,
    );

    assert.ok(
      rejectionCases >=
        40,
    );

    console.log(
      JSON.stringify(
        {
          ok:
            true,

          harness:
            "phase6.demo4.d4-1a.cis8004-registration-controlled-execution.ci.v1",

          acceptedCases,

          rejectionCases,

          canonicalParameterByteLength:
            DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
              .canonicalParameter
              .byteLength,

          canonicalParameterSha256:
            DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
              .canonicalParameter
              .sha256,

          submissionLimit:
            DEMO4_D4_1A_CIS8004_CONTROLLED_EXECUTION_PROFILE
              .submissionLimit,

          automaticRetryAuthorized:
            false,

          evidencePlaceholderCreated:
            false,

          safety:
            {
              environmentRead:
                false,

              filesystemRead:
                false,

              filesystemWrite:
                false,

              networkCalled:
                false,

              privateKeyRead:
                false,

              walletRead:
                false,

              signerCreated:
                false,

              signingAttempted:
                false,

              transactionConstructed:
                false,

              transactionSubmitted:
                false,

              paymentAttempted:
                false,

              cis8004Mutated:
                false,

              cis8Mutated:
                false,

              gatewayRuntimeActivated:
                false,

              protectedResourceReleased:
                false,

              settlementAttempted:
                false,

              receiptIssued:
                false,

              replayStateMutated:
                false,

              d4_1cAttached:
                false,

              revocationAttempted:
                false,

              automaticRetryAttempted:
                false,

              productionActivation:
                false,
            },
        },
        null,
        2,
      ),
    );
  },
);
