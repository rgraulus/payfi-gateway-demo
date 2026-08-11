import { readFileSync } from "node:fs";

import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";

import {
  buildDemo4D41bReplacementCanonicalMessageV1,
  buildDemo4D41bReplacementExpectedParameterContractV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  type Demo4D41bReplacementPrivatePreflightEvidenceV1,
  type Demo4D41bReplacementPublicPreflightEvidenceV1,
  validateDemo4D41bReplacementPrivatePreflightV1,
  validateDemo4D41bReplacementPublicPreflightV1,
} from "../src/phase6/demo4Cis8ConformantReplacementPreflight";

const SCRIPT =
  "demo.phase6.demo4D41bCis8ConformantReplacementPrivatePreflight.v1";

const PRIVATE_KEY_FILE_ENV =
  "DEMO4_D4_1B_REPLACEMENT_PRIVATE_KEY_FILE";

const PUBLIC_EVIDENCE_FILE_ENV =
  "DEMO4_D4_1B_PUBLIC_PREFLIGHT_EVIDENCE_FILE";

type UnknownRecord = Record<string, unknown>;

type PrivatePreflightHooks = {
  readonly signerCreated?: () => void;
  readonly signingAttempted?: () => void;
  readonly registrationParameterBuilt?: (
    parameter: unknown,
  ) => void;
};

type ControlledPrivatePreflightResult = {
  readonly evidence:
    Demo4D41bReplacementPrivatePreflightEvidenceV1;

  readonly facts: {
    readonly publicKeyHex: string;
    readonly canonicalMessageByteLength: number;
    readonly canonicalMessageSha256: string;
    readonly signatureByteLength: number;
    readonly signatureLocallyVerified: true;
    readonly registrationParameterByteLength: number;
    readonly registrationParameterSha256: string;
  };
};

const runtimeState = {
  environmentRead: false,
  filesystemRead: false,
  filesystemWrite: false,
  privateKeyRead: false,
  walletRead: false,
  keyGenerated: false,
  signerCreated: false,
  signingAttempted: false,
  networkCalled: false,
  contractInvoked: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  cis8Mutated: false,
  cis8004Mutated: false,
  d4_1cAttachmentPerformed: false,
  historicalRegistrationRevoked: false,
  evidenceWritten: false,
  gatewayRuntimeCalled: false,
  paymentAttempted: false,
  settlementAttempted: false,
  receiptIssued: false,
  protectedResourceReleased: false,
  replayStateMutated: false,
  productionActivation: false,
};

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function acceptedValue<T>(
  result:
    | {
        readonly ok: true;
        readonly value: T;
      }
    | {
        readonly ok: false;
        readonly reason: string;
      },
  label: string,
): T {
  if (result.ok !== true) {
    throw new Error(`${label}:${result.reason}`);
  }

  return result.value;
}

function exactLowerHex(
  value: unknown,
  byteLength: number,
  label: string,
): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length !== byteLength * 2 ||
    !/^[0-9a-f]+$/.test(value)
  ) {
    throw new Error(label);
  }

  return Uint8Array.from(
    Buffer.from(value, "hex"),
  );
}

function extractPublicPreflight(
  artifact: unknown,
): Demo4D41bReplacementPublicPreflightEvidenceV1 {
  if (
    !isRecord(artifact) ||
    artifact.status !== "accepted" ||
    artifact.gate !== 3 ||
    artifact.nextRequiredStep !==
      "controlled_private_preflight" ||
    !isRecord(artifact.evidence)
  ) {
    throw new Error(
      "invalid_public_preflight_artifact",
    );
  }

  return acceptedValue(
    validateDemo4D41bReplacementPublicPreflightV1(
      artifact.evidence,
    ),
    "public_preflight_rejected",
  );
}

function deriveRawEd25519PublicKey(
  privateKey: ReturnType<typeof createPrivateKey>,
): {
  readonly publicKey:
    ReturnType<typeof createPublicKey>;
  readonly publicKeyBytes: Uint8Array;
  readonly publicKeyHex: string;
} {
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(
      "replacement_private_key_not_ed25519",
    );
  }

  const publicKey = createPublicKey(privateKey);

  const jwk = publicKey.export({
    format: "jwk",
  }) as {
    readonly kty?: string;
    readonly crv?: string;
    readonly x?: string;
    readonly d?: string;
  };

  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.x !== "string" ||
    typeof jwk.d !== "undefined"
  ) {
    throw new Error(
      "invalid_derived_public_jwk",
    );
  }

  const bytes = Uint8Array.from(
    Buffer.from(jwk.x, "base64url"),
  );

  if (bytes.length !== 32) {
    throw new Error(
      "invalid_derived_public_key_length",
    );
  }

  return {
    publicKey,
    publicKeyBytes: bytes,
    publicKeyHex:
      Buffer.from(bytes).toString("hex"),
  };
}

export function buildControlledPrivatePreflightV1(
  input: {
    readonly privateKeyPem: string;
    readonly publicPreflightArtifact: unknown;
  },
  hooks: PrivatePreflightHooks = {},
): ControlledPrivatePreflightResult {
  const publicPreflight =
    extractPublicPreflight(
      input.publicPreflightArtifact,
    );

  const privateKey =
    createPrivateKey(input.privateKeyPem);

  hooks.signerCreated?.();

  const derived =
    deriveRawEd25519PublicKey(privateKey);

  if (
    derived.publicKeyHex !==
    publicPreflight.replacementPublicKeyHex
  ) {
    throw new Error(
      "private_public_key_mismatch",
    );
  }

  const ownerBytes = exactLowerHex(
    publicPreflight.ownerAccountBytesHex,
    32,
    "invalid_owner_account_bytes",
  );

  const genesisBytes = exactLowerHex(
    publicPreflight.concordiumGenesisHashBytesHex,
    32,
    "invalid_concordium_genesis_bytes",
  );

  const canonical = acceptedValue(
    buildDemo4D41bReplacementCanonicalMessageV1({
      concordiumAccountBytes: ownerBytes,
      concordiumGenesisHashBytes:
        genesisBytes,
      publicKeyBytes:
        derived.publicKeyBytes,
    }),
    "canonical_message_rejected",
  );

  if (
    canonical.byteLength !==
      publicPreflight.canonicalMessageByteLength ||
    canonical.sha256 !==
      publicPreflight.canonicalMessageSha256
  ) {
    throw new Error(
      "canonical_message_mismatch",
    );
  }

  hooks.signingAttempted?.();

  const signature = sign(
    null,
    Buffer.from(canonical.bytes),
    privateKey,
  );

  if (signature.length !== 64) {
    throw new Error(
      "invalid_signature_length",
    );
  }

  const locallyVerified = verify(
    null,
    Buffer.from(canonical.bytes),
    derived.publicKey,
    signature,
  );

  if (locallyVerified !== true) {
    throw new Error(
      "signature_not_locally_verified",
    );
  }

  const parameter = acceptedValue(
    buildDemo4D41bReplacementExpectedParameterContractV1({
      publicKeyBytes:
        derived.publicKeyBytes,
      signatureBytes:
        Uint8Array.from(signature),
    }),
    "registration_parameter_rejected",
  );

  if (
    parameter.byteLength !==
    publicPreflight
      .expectedRegistrationParameterByteLength
  ) {
    throw new Error(
      "registration_parameter_length_mismatch",
    );
  }

  hooks.registrationParameterBuilt?.(
    parameter.parameter,
  );

  const candidate = {
    publicPreflight,

    publicKeyMatchesPrivateKey: true,
    signatureByteLength: 64,
    signatureLocallyVerified: true,

    registrationParameterByteLength:
      parameter.byteLength,
    registrationParameterSha256:
      parameter.sha256,

    privateKeyMaterialIncluded: false,
    rawSignatureIncluded: false,
    walletMaterialIncluded: false,
  } as const;

  const evidence = acceptedValue(
    validateDemo4D41bReplacementPrivatePreflightV1(
      candidate,
    ),
    "private_preflight_rejected",
  );

  return {
    evidence,
    facts: {
      publicKeyHex:
        derived.publicKeyHex,
      canonicalMessageByteLength:
        canonical.byteLength,
      canonicalMessageSha256:
        canonical.sha256,
      signatureByteLength:
        signature.length,
      signatureLocallyVerified: true,
      registrationParameterByteLength:
        parameter.byteLength,
      registrationParameterSha256:
        parameter.sha256,
    },
  };
}

function requiredEnvironmentValue(
  name: string,
): string {
  runtimeState.environmentRead = true;

  const value = process.env[name];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `missing_required_environment:${name}`,
    );
  }

  return value;
}

function runtimeSafetyResult(): UnknownRecord {
  return {
    ...runtimeState,
  };
}

function sanitizedReason(
  error: unknown,
): string {
  const value =
    error instanceof Error
      ? error.message
      : "unknown_private_preflight_failure";

  return value
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[redacted]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

function main(): void {
  try {
    const privateKeyFile =
      requiredEnvironmentValue(
        PRIVATE_KEY_FILE_ENV,
      );

    const publicEvidenceFile =
      requiredEnvironmentValue(
        PUBLIC_EVIDENCE_FILE_ENV,
      );

    runtimeState.filesystemRead = true;

    const publicArtifact = JSON.parse(
      readFileSync(
        publicEvidenceFile,
        "utf8",
      ),
    );

    runtimeState.privateKeyRead = true;

    const privateKeyPem =
      readFileSync(
        privateKeyFile,
        "utf8",
      );

    const result =
      buildControlledPrivatePreflightV1(
        {
          privateKeyPem,
          publicPreflightArtifact:
            publicArtifact,
        },
        {
          signerCreated: () => {
            runtimeState.signerCreated = true;
          },
          signingAttempted: () => {
            runtimeState.signingAttempted = true;
          },
        },
      );

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          script: SCRIPT,
          gate: 3,
          implementationStage:
            "controlled_private_preflight",
          environment:
            "offline_local_private_key",
          evidence: result.evidence,
          facts: result.facts,
          runtime:
            runtimeSafetyResult(),
          nextRequiredStep:
            "capture_private_preflight_evidence",
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: false,
          script: SCRIPT,
          gate: 3,
          implementationStage:
            "controlled_private_preflight",
          reason:
            sanitizedReason(error),
          runtime:
            runtimeSafetyResult(),
        },
        null,
        2,
      ) + "\n",
    );

    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
