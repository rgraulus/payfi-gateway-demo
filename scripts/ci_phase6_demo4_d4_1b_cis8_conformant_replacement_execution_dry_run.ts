import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

import {
  runReplacementRegistrationDryRunV1,
} from "../src/phase6/demo4Cis8ConformantReplacementExecutionDryRun";

import {
  DEMO4_D4_1B_REPLACEMENT_PROFILE,
  buildDemo4D41bReplacementExpectedParameterContractV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

type InvocationResult =
  | {
      readonly tag: "success";
      readonly usedEnergy: unknown;
    }
  | {
      readonly tag: "failure";
    };

function parameter(): unknown {
  return {
    external_key: {
      namespace:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .externalKeyNamespace,

      key_type:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .externalKeyType,

      public_key:
        Array.from(
          { length: 32 },
          (_, index) => index,
        ),
    },

    proof: {
      scheme:
        DEMO4_D4_1B_REPLACEMENT_PROFILE
          .proofScheme,

      signature:
        Array.from(
          { length: 64 },
          (_, index) => index,
        ),
    },

    metadata: [],
  };
}

function deterministicBytes(): Uint8Array {
  const built =
    buildDemo4D41bReplacementExpectedParameterContractV1({
      publicKeyBytes:
        Uint8Array.from(
          { length: 32 },
          (_, index) => index,
        ),

      signatureBytes:
        Uint8Array.from(
          { length: 64 },
          (_, index) => index,
        ),
    });

  assert.equal(
    built.ok,
    true,
  );

  if (built.ok !== true) {
    throw new Error(
      built.reason,
    );
  }

  return Uint8Array.from(
    built.value.serializedBytes,
  );
}

function context(
  invocationResult: InvocationResult,
  sdkSerializedBytes:
    Uint8Array =
      deterministicBytes(),
) {
  const observed: Record<string, unknown> = {};

  const finalizedBlock = {
    kind: "finalized-test-block",
  };

  const sdk = {
    Parameter: {
      toBuffer(
        value: unknown,
      ) {
        observed.parameterToBufferCalled =
          true;

        assert.ok(
          value instanceof Uint8Array,
        );

        return value;
      },
    },

    ContractName: {
      fromStringUnchecked(
        value: string,
      ) {
        observed.contractName = value;
        return value;
      },
    },

    EntrypointName: {
      fromString(
        value: string,
      ) {
        observed.entrypointName = value;
        return value;
      },
    },

    ReceiveName: {
      fromString(
        value: string,
      ) {
        observed.receiveName = value;
        return value;
      },
    },

    CcdAmount: {
      zero() {
        observed.zeroCcd = true;
        return {
          microCcdAmount: 0n,
        };
      },
    },

    Energy: {
      create(
        value: bigint,
      ) {
        observed.energyCap = value;
        return {
          value,
        };
      },
    },

    serializeUpdateContractParameters(
      contractName: unknown,
      entrypointName: unknown,
      value: unknown,
      schema: ArrayBuffer,
    ) {
      observed.serializedContractName =
        contractName;
      observed.serializedEntrypointName =
        entrypointName;
      observed.parameterShape = value;
      observed.schemaByteLength =
        schema.byteLength;

      return Uint8Array.from(
        sdkSerializedBytes,
      );
    },
  };

  const client = {
    async invokeContract(
      request: unknown,
      block: unknown,
    ) {
      observed.request = request;
      observed.block = block;

      return invocationResult;
    },
  };

  return {
    observed,

    value: {
      sdk,
      client,
      snapshot: {
        finalizedBlock,
      },
      contractAddress: {
        index: 12801n,
        subindex: 0n,
      },
      embeddedSchema: {
        buffer:
          new Uint8Array([
            9,
            8,
            7,
          ]),
      },
      ownerAccount: {
        address: "owner",
      },
    },
  };
}

async function main(): Promise<void> {
  let tests = 0;

  {
    const prepared =
      context({
        tag: "success",
        usedEnergy: "42000",
      });

    const result =
      await runReplacementRegistrationDryRunV1(
        prepared.value,
        parameter(),
      );

    assert.equal(
      result.usedEnergy,
      "42000",
    );

    assert.equal(
      result.transactionEnergyAllowance,
      "50400",
    );

    assert.equal(
      result.energySafetyCap,
      "100000",
    );

    assert.equal(
      result.zeroCcdAttached,
      true,
    );

    assert.equal(
      result.deterministicParameterByteLength,
      180,
    );

    assert.equal(
      result.sdkSerializedParameterByteLength,
      180,
    );

    assert.equal(
      result.exactSdkByteEquivalence,
      true,
    );

    assert.equal(
      result.deterministicParameterSha256,
      result.sdkSerializedParameterSha256,
    );

    assert.equal(
      prepared.observed.parameterToBufferCalled,
      true,
    );

    assert.equal(
      prepared.observed.contractName,
      "CIS-8",
    );

    assert.equal(
      prepared.observed.entrypointName,
      "registerExternalKey",
    );

    assert.equal(
      prepared.observed.receiveName,
      "CIS-8.registerExternalKey",
    );

    assert.equal(
      prepared.observed.energyCap,
      100000n,
    );

    assert.equal(
      prepared.observed.zeroCcd,
      true,
    );

    assert.equal(
      prepared.observed.block,
      prepared.value.snapshot.finalizedBlock,
    );

    tests += 1;
    console.log(
      "PASS accepts one finalized zero-CCD dry run",
    );
  }

  {
    const prepared =
      context({
        tag: "success",
        usedEnergy: 100,
      });

    const result =
      await runReplacementRegistrationDryRunV1(
        prepared.value,
        parameter(),
      );

    assert.equal(
      result.transactionEnergyAllowance,
      "1100",
    );

    tests += 1;
    console.log(
      "PASS applies the minimum energy margin",
    );
  }

  {
    const prepared =
      context({
        tag: "success",
        usedEnergy: 100001n,
      });

    await assert.rejects(
      runReplacementRegistrationDryRunV1(
        prepared.value,
        parameter(),
      ),
      /dry_run_energy_exceeds_safety_cap/,
    );

    tests += 1;
    console.log(
      "PASS rejects energy above the safety cap",
    );
  }

  {
    const prepared =
      context({
        tag: "failure",
      });

    await assert.rejects(
      runReplacementRegistrationDryRunV1(
        prepared.value,
        parameter(),
      ),
      /register_external_key_dry_run_failed/,
    );

    tests += 1;
    console.log(
      "PASS rejects a failed contract invocation",
    );
  }

  {
    const prepared =
      context({
        tag: "success",
        usedEnergy: "1",
      });

    await assert.rejects(
      runReplacementRegistrationDryRunV1(
        prepared.value,
        {
          external_key: {},
          proof: {},
          metadata: [],
        },
      ),
      /invalid_registration_parameter_shape/,
    );

    assert.equal(
      prepared.observed.request,
      undefined,
    );

    tests += 1;
    console.log(
      "PASS rejects malformed material before invocation",
    );
  }

  {
    const source =
      readFileSync(
        resolve(
          process.cwd(),
          "src/phase6/" +
            "demo4Cis8ConformantReplacement" +
            "ExecutionDryRun.ts",
        ),
        "utf8",
      );

    for (const forbidden of [
      /AccountSigner/,
      /Wallet/,
      /sendAccountTransaction/,
      /signTransaction/,
      /createAccountTransaction/,
      /submitTransaction/,
    ]) {
      assert.equal(
        forbidden.test(source),
        false,
      );
    }

    tests += 1;
    console.log(
      "PASS keeps wallet and transaction APIs absent",
    );
  }

  {
    const prepared =
      context(
        {
          tag: "success",
          usedEnergy: "42000",
        },
        new Uint8Array(180),
      );

    await assert.rejects(
      () =>
        runReplacementRegistrationDryRunV1(
          prepared.value,
          parameter(),
        ),
      /deployed_schema_serialization_incompatible:/,
    );

    assert.equal(
      prepared.observed.request,
      undefined,
    );

    assert.equal(
      prepared.observed.parameterToBufferCalled,
      true,
    );

    tests += 1;
    console.log(
      "PASS blocks incompatible deployed-schema bytes before invocation",
    );
  }

  console.log(`TESTS=${tests}`);
  console.log("NETWORK_CALLED=false");
  console.log("DRY_RUN_CALLED_SYNTHETIC_ONLY=true");
  console.log("ZERO_CCD_REQUIRED=true");
  console.log("ENERGY_SAFETY_CAP=100000");
  console.log("WALLET_READ=false");
  console.log("ACCOUNT_SIGNER_CREATED=false");
  console.log("TRANSACTION_CONSTRUCTED=false");
  console.log("TRANSACTION_SIGNED=false");
  console.log("TRANSACTION_SUBMITTED=false");
  console.log("SUBMISSION_ATTEMPT_CONSUMED=false");
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
