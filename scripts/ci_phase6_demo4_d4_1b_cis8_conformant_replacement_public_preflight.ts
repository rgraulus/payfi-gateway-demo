/**
 * PR #312 Gate 3 — offline contract tests for the controlled public-only
 * CIS-8 conformant-replacement preflight runner.
 *
 * No successful public preflight is executed here. Runtime tests fail before
 * any network access because the replacement public key is missing or invalid.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type TestKind = "accepted" | "rejection";

const runnerPath = resolve(
  "scripts/demo_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight.ts",
);

const runnerSource =
  readFileSync(runnerPath, "utf8");

const tests: Array<{
  readonly name: string;
  readonly kind: TestKind;
  readonly body: () => void;
}> = [];

let acceptedCases = 0;
let rejectionCases = 0;

function test(
  name: string,
  kind: TestKind,
  body: () => void,
): void {
  tests.push({ name, kind, body });
}

function runFailClosed(
  publicKeyHex?: string,
): Record<string, any> {
  const environment = {
    ...process.env,
  };

  delete environment
    .DEMO4_D4_1B_REPLACEMENT_PUBLIC_KEY_HEX;

  if (publicKeyHex !== undefined) {
    environment
      .DEMO4_D4_1B_REPLACEMENT_PUBLIC_KEY_HEX =
        publicKeyHex;
  }

  const result = spawnSync(
    process.execPath,
    [
      require.resolve("ts-node/dist/bin.js"),
      "--transpile-only",
      runnerPath,
    ],
    {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);

  const output = result.stderr.trim();
  assert.notEqual(output, "");

  return JSON.parse(output) as
    Record<string, any>;
}

function assertNoLiveActivity(
  output: Record<string, any>,
): void {
  assert.equal(
    output.runtime.normativeSourceFetched,
    false,
  );
  assert.equal(
    output.runtime.solanaCaipSourceFetched,
    false,
  );
  assert.equal(
    output.runtime.solanaGenesisQueried,
    false,
  );
  assert.equal(
    output.runtime.concordiumNetworkCalled,
    false,
  );
  assert.equal(
    output.runtime.contractInvokedReadOnly,
    false,
  );
  assert.equal(output.runtime.privateKeyRead, false);
  assert.equal(output.runtime.walletRead, false);
  assert.equal(output.runtime.signingAttempted, false);
  assert.equal(
    output.runtime.transactionConstructed,
    false,
  );
  assert.equal(
    output.runtime.transactionSubmitted,
    false,
  );
  assert.equal(output.runtime.cis8Mutated, false);
  assert.equal(output.runtime.cis8004Mutated, false);
  assert.equal(
    output.runtime.d4_1cAttachmentPerformed,
    false,
  );
  assert.equal(
    output.runtime.productionActivation,
    false,
  );
}

test(
  "keeps private, signing, write, and transaction APIs absent",
  "accepted",
  () => {
    const forbidden = [
      "readFileSync",
      "writeFileSync",
      "createPrivateKey",
      "createPublicKey",
      "signEd25519",
      "sendAccountTransaction",
      "sendBlockItem",
      "updateContract",
      "executeRegistration",
    ];

    for (const token of forbidden) {
      assert.equal(
        runnerSource.includes(token),
        false,
        `forbidden runner token: ${token}`,
      );
    }
  },
);

test(
  "uses one exact public-key environment binding",
  "accepted",
  () => {
    assert.equal(
      runnerSource.includes(
        "DEMO4_D4_1B_REPLACEMENT_PUBLIC_KEY_HEX",
      ),
      true,
    );

    assert.equal(
      (
        runnerSource.match(
          /process\.env\[/g,
        ) ?? []
      ).length,
      1,
    );

    assert.equal(
      runnerSource.includes(
        "/^[0-9a-f]{64}$/",
      ),
      true,
    );
  },
);

test(
  "converts fetched response bytes without empty ArrayBuffer coercion",
  "accepted",
  () => {
    assert.equal(
      runnerSource.includes(
        "const bytes = new Uint8Array(",
      ),
      true,
    );

    assert.equal(
      runnerSource.includes(
        "const bytes = Uint8Array.from(",
      ),
      false,
    );

    assert.equal(
      runnerSource.indexOf(
        "runtimeState.normativeSourceFetched = true",
      ) <
        runnerSource.indexOf(
          "const response = await fetch(url",
        ),
      true,
    );
  },
);

test(
  "contains all three public drift checks",
  "accepted",
  () => {
    assert.equal(
      runnerSource.includes(
        "normative_source_pin_drift",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "solana_caip_source_pin_drift",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "solana_devnet_genesis_drift",
      ),
      true,
    );
  },
);

test(
  "pins Concordium inspection to finalized state",
  "accepted",
  () => {
    assert.equal(
      runnerSource.includes(
        "getConsensusStatus",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "blockInfo.finalized !== true",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "snapshot.finalizedBlock",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "await client.invokeContract",
      ),
      true,
    );
  },
);

test(
  "validates the exact replacement evidence contract",
  "accepted",
  () => {
    assert.equal(
      runnerSource.includes(
        "validateDemo4D41bReplacementPublicPreflightV1",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "DEMO4_D4_1B_REPLACEMENT_PREFLIGHT_SAFETY",
      ),
      true,
    );
    assert.equal(
      runnerSource.includes(
        "replacement_key_already_registered",
      ),
      true,
    );
  },
);

test(
  "has one fail-closed executable entrypoint",
  "accepted",
  () => {
    assert.equal(
      (
        runnerSource.match(
          /main\(\)\.catch/g,
        ) ?? []
      ).length,
      1,
    );
    assert.equal(
      runnerSource.includes(
        "process.exitCode = 1",
      ),
      true,
    );
  },
);

test(
  "wires the exact offline package command",
  "accepted",
  () => {
    const packageJson = JSON.parse(
      readFileSync(
        resolve("package.json"),
        "utf8",
      ),
    );

    assert.equal(
      packageJson.scripts[
        "phase6:demo4-d4-1b-cis8-conformant-replacement-public-preflight-test"
      ],
      "ts-node --transpile-only scripts/ci_phase6_demo4_d4_1b_cis8_conformant_replacement_public_preflight.ts",
    );
  },
);

test(
  "fails closed when the public key is missing",
  "rejection",
  () => {
    const output = runFailClosed();

    assert.equal(output.ok, false);
    assert.equal(
      output.reason,
      "invalid_replacement_public_key_hex",
    );
    assertNoLiveActivity(output);
  },
);

test(
  "fails closed on a non-lowercase public key",
  "rejection",
  () => {
    const output =
      runFailClosed("AA".repeat(32));

    assert.equal(output.ok, false);
    assert.equal(
      output.reason,
      "invalid_replacement_public_key_hex",
    );
    assertNoLiveActivity(output);
  },
);

for (const current of tests) {
  current.body();

  if (current.kind === "accepted") {
    acceptedCases += 1;
  } else {
    rejectionCases += 1;
  }

  console.log(`PASS ${current.name}`);
}

console.log(`TESTS=${tests.length}`);
console.log(`ACCEPTED_CASES=${acceptedCases}`);
console.log(`REJECTION_CASES=${rejectionCases}`);
console.log("PRIVATE_KEY_READ=false");
console.log("WALLET_READ=false");
console.log("SIGNING_ATTEMPTED=false");
console.log("NETWORK_CALLED=false");
console.log("TRANSACTION_SUBMITTED=false");
