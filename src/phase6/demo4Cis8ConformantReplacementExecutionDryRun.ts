import {
  createHash,
} from "node:crypto";

import {
  buildDemo4D41bReplacementExpectedParameterContractV1,
} from "./demo4Cis8ConformantReplacementProfile";

type UnknownRecord = Record<string, unknown>;

export type ReplacementDryRunContext = {
  readonly sdk: any;
  readonly client: any;
  readonly snapshot: {
    readonly finalizedBlock: unknown;
  };
  readonly contractAddress: unknown;
  readonly embeddedSchema: any;
  readonly ownerAccount: unknown;
};

export type ReplacementDryRunFacts = {
  readonly deterministicParameterByteLength: number;
  readonly deterministicParameterSha256: string;
  readonly sdkSerializedParameterByteLength: number;
  readonly sdkSerializedParameterSha256: string;
  readonly exactSdkByteEquivalence: true;

  readonly usedEnergy: string;
  readonly transactionEnergyAllowance: string;
  readonly energySafetyCap: "100000";
  readonly zeroCcdAttached: true;
};

const ENERGY_CAP = 100_000n;
const MINIMUM_MARGIN = 1_000n;

function record(
  value: unknown,
): UnknownRecord | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : null;
}

function schemaBuffer(
  embeddedSchema: any,
): ArrayBuffer {
  const value = embeddedSchema?.buffer;

  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const copy =
      new Uint8Array(value.byteLength);

    copy.set(
      new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      ),
    );

    return copy.buffer;
  }

  throw new Error(
    "invalid_embedded_schema_buffer",
  );
}

function byteValues(
  value: unknown,
  label: string,
): bigint[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !Number.isInteger(item) ||
        item < 0 ||
        item > 255,
    )
  ) {
    throw new Error(label);
  }

  return value.map(
    (item) => BigInt(item),
  );
}

function parameterForSchema(
  value: unknown,
): unknown {
  const root = record(value);
  const externalKey =
    record(root?.external_key);
  const proof =
    record(root?.proof);

  if (
    typeof externalKey?.namespace !== "string" ||
    typeof externalKey?.key_type !== "string" ||
    typeof proof?.scheme !== "string" ||
    !Array.isArray(root?.metadata) ||
    root.metadata.length !== 0
  ) {
    throw new Error(
      "invalid_registration_parameter_shape",
    );
  }

  return {
    external_key: {
      namespace:
        externalKey.namespace,
      key_type:
        externalKey.key_type,
      public_key:
        byteValues(
          externalKey.public_key,
          "invalid_registration_public_key",
        ),
    },

    proof: {
      scheme: proof.scheme,
      signature:
        byteValues(
          proof.signature,
          "invalid_registration_signature",
        ),
    },

    metadata: [],
  };
}

function sha256Hex(
  value: Uint8Array,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function deterministicParameterBytes(
  registrationParameter: unknown,
): Uint8Array {
  const root =
    record(registrationParameter);

  const externalKey =
    record(root?.external_key);

  const proof =
    record(root?.proof);

  if (
    typeof externalKey?.namespace !== "string" ||
    typeof externalKey?.key_type !== "string" ||
    typeof proof?.scheme !== "string"
  ) {
    throw new Error(
      "invalid_registration_parameter_shape",
    );
  }

  const publicKeyBytes =
    Uint8Array.from(
      byteValues(
        externalKey.public_key,
        "invalid_registration_public_key",
      ).map(Number),
    );

  const signatureBytes =
    Uint8Array.from(
      byteValues(
        proof.signature,
        "invalid_registration_signature",
      ).map(Number),
    );

  const expected =
    buildDemo4D41bReplacementExpectedParameterContractV1({
      publicKeyBytes,
      signatureBytes,
    });

  if (expected.ok !== true) {
    throw new Error(
      "deterministic_registration_parameter_failed:" +
      expected.reason,
    );
  }

  if (
    externalKey.namespace !==
      expected.value.parameter
        .external_key.namespace ||
    externalKey.key_type !==
      expected.value.parameter
        .external_key.key_type ||
    proof.scheme !==
      expected.value.parameter
        .proof.scheme
  ) {
    throw new Error(
      "registration_parameter_not_cis8_draft_conformant",
    );
  }

  return Uint8Array.from(
    expected.value.serializedBytes,
  );
}

function exactBytesEqual(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function safeEnergy(
  value: unknown,
): bigint {
  const source = record(value);

  for (const candidate of [
    value,
    source?.value,
    source?.energy,
  ]) {
    if (
      typeof candidate === "bigint" &&
      candidate >= 0n
    ) {
      return candidate;
    }

    if (
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0
    ) {
      return BigInt(candidate);
    }

    if (
      typeof candidate === "string" &&
      /^(0|[1-9][0-9]*)$/.test(candidate)
    ) {
      return BigInt(candidate);
    }
  }

  throw new Error(
    "invalid_dry_run_energy",
  );
}

export async function runReplacementRegistrationDryRunV1(
  context: ReplacementDryRunContext,
  registrationParameter: unknown,
): Promise<ReplacementDryRunFacts> {
  const contractName =
    context.sdk.ContractName
      .fromStringUnchecked("CIS-8");

  const entrypointName =
    context.sdk.EntrypointName
      .fromString("registerExternalKey");

  const schemaParameter =
    parameterForSchema(
      registrationParameter,
    );

  const deterministicBytes =
    deterministicParameterBytes(
      registrationParameter,
    );

  const parameter =
    context.sdk.serializeUpdateContractParameters(
      contractName,
      entrypointName,
      schemaParameter,
      schemaBuffer(
        context.embeddedSchema,
      ),
    );

  if (
    typeof context.sdk.Parameter?.toBuffer !==
      "function"
  ) {
    throw new Error(
      "sdk_parameter_buffer_unavailable",
    );
  }

  const sdkSerializedBytes =
    Uint8Array.from(
      context.sdk.Parameter.toBuffer(
        parameter,
      ),
    );

  const deterministicSha256 =
    sha256Hex(
      deterministicBytes,
    );

  const sdkSerializedSha256 =
    sha256Hex(
      sdkSerializedBytes,
    );

  if (
    !exactBytesEqual(
      deterministicBytes,
      sdkSerializedBytes,
    )
  ) {
    throw new Error(
      "deployed_schema_serialization_incompatible:" +
      `expected_length=${deterministicBytes.length}:` +
      `actual_length=${sdkSerializedBytes.length}:` +
      `expected_sha256=${deterministicSha256}:` +
      `actual_sha256=${sdkSerializedSha256}`,
    );
  }

  const invocation =
    await context.client.invokeContract(
      {
        invoker:
          context.ownerAccount,

        contract:
          context.contractAddress,

        method:
          context.sdk.ReceiveName.fromString(
            "CIS-8.registerExternalKey",
          ),

        parameter,

        amount:
          context.sdk.CcdAmount.zero(),

        energy:
          context.sdk.Energy.create(
            ENERGY_CAP,
          ),
      },

      context.snapshot.finalizedBlock,
    );

  if (
    invocation === null ||
    invocation === undefined ||
    invocation.tag !== "success"
  ) {
    throw new Error(
      "register_external_key_dry_run_failed",
    );
  }

  const usedEnergy =
    safeEnergy(invocation.usedEnergy);

  if (usedEnergy > ENERGY_CAP) {
    throw new Error(
      "dry_run_energy_exceeds_safety_cap",
    );
  }

  const percentageMargin =
    usedEnergy / 5n;

  const margin =
    percentageMargin > MINIMUM_MARGIN
      ? percentageMargin
      : MINIMUM_MARGIN;

  const candidate =
    usedEnergy + margin;

  const allowance =
    candidate > ENERGY_CAP
      ? ENERGY_CAP
      : candidate;

  return Object.freeze({
    deterministicParameterByteLength:
      deterministicBytes.length,

    deterministicParameterSha256:
      deterministicSha256,

    sdkSerializedParameterByteLength:
      sdkSerializedBytes.length,

    sdkSerializedParameterSha256:
      sdkSerializedSha256,

    exactSdkByteEquivalence: true,

    usedEnergy:
      usedEnergy.toString(10),

    transactionEnergyAllowance:
      allowance.toString(10),

    energySafetyCap: "100000",
    zeroCcdAttached: true,
  });
}
