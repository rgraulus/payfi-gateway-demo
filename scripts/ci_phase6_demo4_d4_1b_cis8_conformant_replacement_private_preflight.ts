/**
 * PR #312 Gate 3 — offline private-preflight runner CI.
 *
 * This harness uses an ephemeral in-memory Ed25519 key. It does not read the
 * controlled replacement private key, wallet material, or any network source.
 * It does not construct or submit a transaction or mutate any contract.
 */

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
} from "node:crypto";
import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  spawnSync,
} from "node:child_process";

import {
  buildDemo4D41bReplacementCanonicalMessageV1,
} from "../src/phase6/demo4Cis8ConformantReplacementProfile";

import {
  buildControlledPrivatePreflightV1,
} from "./demo_phase6_demo4_d4_1b_cis8_conformant_replacement_private_preflight";

type TestBody = () => void;

const tests: Array<{
  readonly name: string;
  readonly classification:
    "accepted" | "rejection";
  readonly body: TestBody;
}> = [];

let acceptedCases = 0;
let rejectionCases = 0;

function test(
  name: string,
  classification:
    "accepted" | "rejection",
  body: TestBody,
): void {
  tests.push({
    name,
    classification,
    body,
  });
}

function clone<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value),
  ) as T;
}

function bytesFromHex(
  value: string,
): Uint8Array {
  return Uint8Array.from(
    Buffer.from(value, "hex"),
  );
}

function generatedEd25519Key(): {
  readonly privateKeyPem: string;
  readonly publicKeyHex: string;
} {
  const pair = generateKeyPairSync(
    "ed25519",
  );

  const privateKeyPem = String(
    pair.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
  );

  const publicJwk = pair.publicKey.export({
    format: "jwk",
  }) as {
    readonly kty?: string;
    readonly crv?: string;
    readonly x?: string;
    readonly d?: string;
  };

  assert.equal(publicJwk.kty, "OKP");
  assert.equal(publicJwk.crv, "Ed25519");
  assert.equal(
    typeof publicJwk.x,
    "string",
  );
  assert.equal(
    typeof publicJwk.d,
    "undefined",
  );

  const publicKeyBytes = Buffer.from(
    publicJwk.x as string,
    "base64url",
  );

  assert.equal(
    publicKeyBytes.length,
    32,
  );

  return {
    privateKeyPem,
    publicKeyHex:
      publicKeyBytes.toString("hex"),
  };
}

const publicArtifactPath = resolve(
  process.cwd(),
  "docs/evidence/" +
    "demo4-d4-1b-cis8-conformant-" +
    "replacement-public-preflight.json",
);

const runnerPath = resolve(
  process.cwd(),
  "scripts/" +
    "demo_phase6_demo4_d4_1b_" +
    "cis8_conformant_replacement_" +
    "private_preflight.ts",
);

const livePublicArtifact = JSON.parse(
  readFileSync(
    publicArtifactPath,
    "utf8",
  ),
) as Record<string, unknown>;

function syntheticPublicArtifact(
  publicKeyHex: string,
): Record<string, unknown> {
  const artifact =
    clone(livePublicArtifact);

  const evidence =
    artifact.evidence as
      Record<string, unknown>;

  const canonical =
    buildDemo4D41bReplacementCanonicalMessageV1({
      concordiumAccountBytes:
        bytesFromHex(
          String(evidence.ownerAccountBytesHex),
        ),

      concordiumGenesisHashBytes:
        bytesFromHex(
          String(
            evidence.concordiumGenesisHashBytesHex,
          ),
        ),

      publicKeyBytes:
        bytesFromHex(publicKeyHex),
    });

  assert.equal(
    canonical.ok,
    true,
    "synthetic canonical message must build",
  );

  if (canonical.ok !== true) {
    throw new Error(
      "synthetic_canonical_rejected",
    );
  }

  evidence.replacementPublicKeyHex =
    publicKeyHex;

  evidence.canonicalMessageByteLength =
    canonical.value.byteLength;

  evidence.canonicalMessageSha256 =
    canonical.value.sha256;

  return artifact;
}

test(
  "keeps the private runner offline and transaction free",
  "accepted",
  () => {
    const source = readFileSync(
      runnerPath,
      "utf8",
    );

    const forbidden: ReadonlyArray<{
      readonly name: string;
      readonly pattern: RegExp;
    }> = [
      {
        name: "network module",
        pattern:
          /from\s+["']node:(?:http|https|net|tls|dgram)["']/,
      },
      {
        name: "network fetch",
        pattern: /\bfetch\s*\(/,
      },
      {
        name: "Concordium SDK",
        pattern:
          /@concordium\/web-sdk/,
      },
      {
        name: "transaction API",
        pattern:
          /\b(?:sendTransaction|updateContract|invokeContract|executeContract)\s*\(/,
      },
      {
        name: "filesystem write",
        pattern:
          /\b(?:writeFileSync|appendFileSync|unlinkSync|rmSync)\s*\(/,
      },
      {
        name: "process execution",
        pattern:
          /\b(?:execSync|execFileSync|spawnSync)\s*\(/,
      },
    ];

    for (const item of forbidden) {
      assert.equal(
        item.pattern.test(source),
        false,
        `runner contains forbidden ${item.name}`,
      );
    }
  },
);

test(
  "signs and verifies one synthetic canonical message",
  "accepted",
  () => {
    const key = generatedEd25519Key();

    const artifact =
      syntheticPublicArtifact(
        key.publicKeyHex,
      );

    const result =
      buildControlledPrivatePreflightV1({
        privateKeyPem:
          key.privateKeyPem,
        publicPreflightArtifact:
          artifact,
      });

    assert.equal(
      result.evidence
        .publicKeyMatchesPrivateKey,
      true,
    );

    assert.equal(
      result.facts.signatureByteLength,
      64,
    );

    assert.equal(
      result.facts
        .signatureLocallyVerified,
      true,
    );

    assert.equal(
      result.facts
        .registrationParameterByteLength,
      168,
    );

    assert.match(
      result.facts
        .registrationParameterSha256,
      /^[0-9a-f]{64}$/,
    );

    assert.equal(
      result.evidence
        .privateKeyMaterialIncluded,
      false,
    );

    assert.equal(
      result.evidence
        .rawSignatureIncluded,
      false,
    );

    assert.equal(
      result.evidence
        .walletMaterialIncluded,
      false,
    );

    const serialized =
      JSON.stringify(result);

    assert.equal(
      serialized.includes(
        "BEGIN PRIVATE KEY",
      ),
      false,
    );

    assert.equal(
      serialized.includes(
        key.privateKeyPem,
      ),
      false,
    );
  },
);

test(
  "rejects a mismatched private key",
  "rejection",
  () => {
    const expectedKey =
      generatedEd25519Key();

    const wrongKey =
      generatedEd25519Key();

    const artifact =
      syntheticPublicArtifact(
        expectedKey.publicKeyHex,
      );

    assert.throws(
      () =>
        buildControlledPrivatePreflightV1({
          privateKeyPem:
            wrongKey.privateKeyPem,
          publicPreflightArtifact:
            artifact,
        }),
      /private_public_key_mismatch/,
    );
  },
);

test(
  "rejects a non-accepted public artifact",
  "rejection",
  () => {
    const key = generatedEd25519Key();

    const artifact =
      syntheticPublicArtifact(
        key.publicKeyHex,
      );

    artifact.status = "rejected";

    assert.throws(
      () =>
        buildControlledPrivatePreflightV1({
          privateKeyPem:
            key.privateKeyPem,
          publicPreflightArtifact:
            artifact,
        }),
      /invalid_public_preflight_artifact/,
    );
  },
);

test(
  "fails closed before filesystem access when inputs are absent",
  "rejection",
  () => {
    const environment = {
      ...process.env,
    };

    delete environment[
      "DEMO4_D4_1B_REPLACEMENT_PRIVATE_KEY_FILE"
    ];

    delete environment[
      "DEMO4_D4_1B_PUBLIC_PREFLIGHT_EVIDENCE_FILE"
    ];

    const execution = spawnSync(
      process.execPath,
      [
        resolve(
          process.cwd(),
          "node_modules/ts-node/dist/bin.js",
        ),
        "--transpile-only",
        runnerPath,
      ],
      {
        cwd: process.cwd(),
        env: environment,
        encoding: "utf8",
      },
    );

    assert.equal(
      execution.status,
      1,
    );

    const output = JSON.parse(
      execution.stdout,
    );

    assert.equal(output.ok, false);

    assert.equal(
      output.runtime.filesystemRead,
      false,
    );

    assert.equal(
      output.runtime.privateKeyRead,
      false,
    );

    assert.equal(
      output.runtime.signingAttempted,
      false,
    );

    assert.equal(
      output.runtime
        .transactionConstructed,
      false,
    );

    assert.equal(
      output.runtime
        .transactionSubmitted,
      false,
    );
  },
);

let failed = 0;

for (const current of tests) {
  try {
    current.body();

    if (
      current.classification ===
      "accepted"
    ) {
      acceptedCases += 1;
    } else {
      rejectionCases += 1;
    }

    console.log(
      `PASS ${current.name}`,
    );
  } catch (error) {
    failed += 1;

    console.error(
      `FAIL ${current.name}`,
    );

    console.error(error);
  }
}

console.log(
  `TESTS=${tests.length}`,
);
console.log(
  `ACCEPTED_CASES=${acceptedCases}`,
);
console.log(
  `REJECTION_CASES=${rejectionCases}`,
);
console.log(
  "REPLACEMENT_PRIVATE_KEY_READ=false",
);
console.log(
  "SYNTHETIC_KEY_GENERATED=true",
);
console.log(
  "SYNTHETIC_SIGNING_ATTEMPTED=true",
);
console.log(
  "NETWORK_CALLED=false",
);
console.log(
  "TRANSACTION_CONSTRUCTED=false",
);
console.log(
  "TRANSACTION_SUBMITTED=false",
);
console.log(
  "GATE4_AUTHORIZED=false",
);

if (failed !== 0) {
  process.exitCode = 1;
}
