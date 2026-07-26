/**
 * PR #304 — Demo3 controlled Agent Registry final acceptance.
 *
 * Six Gateway HTTP paths are exercised:
 *
 * 1. Invalid buyer signature: Phase 5 rejection before Phase 6.
 * 2. Invalid agent proof-of-possession: Phase 5 rejection before Phase 6.
 * 3. Acting key mismatch: controlled Phase 6 registry denial and audit.
 * 4. Tampered Agent Card: controlled Phase 6 integrity denial and audit.
 * 5. Registry-authorized agent with ineligible buyer: Phase 6 passes and the
 *    existing buyer policy denies without bounded-use consumption.
 * 6. Registry-authorized agent with eligible buyer: Phase 6 passes and the
 *    existing bounded-use claim is consumed.
 *
 * This CI harness intentionally keeps payment, settlement, receipt, replay,
 * PAYMENT-RESPONSE, and protected-resource release disabled. The Demo3 runner
 * owns the one controlled live-payment path.
 *
 * Phase 6 audit rows are append-only and are deliberately retained. All
 * mutable Phase 5 challenge, lifecycle, usage, claim, and revocation rows
 * created by this run are removed during cleanup.
 */

import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  spawnSync,
  type ChildProcess,
} from "node:child_process";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  Client,
} from "pg";

import {
  AGENT_REGISTRY_CONTRACT_VERSION,
  AGENT_REGISTRY_REFERENCE_TYPE,
  AGENT_REGISTRY_STANDARD,
} from "../src/phase6/agentRegistryTrustContract";

import {
  CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  killProcessTree,
  phase3HarnessDatabaseUrl,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";


const LABEL =
  "phase6:demo3-final-acceptance";

const RUN_ID =
  randomUUID()
    .replace(
      /-/g,
      "",
    )
    .slice(
      0,
      16,
    );

const ROOT =
  path.resolve(
    ".",
  );

const GATEWAY_PORT =
  Number(
    process.env
      .PHASE6_DEMO3_ACCEPTANCE_GATEWAY_PORT ??
    3150,
  );

const CRP_TRIPWIRE_PORT =
  Number(
    process.env
      .PHASE6_DEMO3_ACCEPTANCE_CRP_PORT ??
    8150,
  );

const ORCHESTRATOR_PORT =
  Number(
    process.env
      .PHASE6_DEMO3_ACCEPTANCE_ORCHESTRATOR_PORT ??
    8151,
  );

const GATEWAY_BASE =
  baseUrlForPort(
    GATEWAY_PORT,
  );

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:pg@127.0.0.1:5432/transaction-outcome";

const WORK_DIRECTORY =
  path.resolve(
    ".tmp",
    `pr304-demo3-${RUN_ID}`,
  );

const KEY_DIRECTORY =
  path.join(
    WORK_DIRECTORY,
    "keys",
  );

const KEY_BUNDLE_PATH =
  path.join(
    KEY_DIRECTORY,
    "phase5-cryptographic-key-bundle.json",
  );

const BUYER_VERIFICATION_KEY_PATH =
  path.join(
    KEY_DIRECTORY,
    "buyer.verification-key.json",
  );

const POSITIVE_MANIFEST_PATH =
  path.join(
    WORK_DIRECTORY,
    "positive.json",
  );

const ACTING_KEY_MISMATCH_MANIFEST_PATH =
  path.join(
    WORK_DIRECTORY,
    "acting_key_mismatch.json",
  );

const TAMPERED_AGENT_CARD_MANIFEST_PATH =
  path.join(
    WORK_DIRECTORY,
    "tampered_agent_card.json",
  );

const PHASE5_LIFECYCLE_MIGRATION =
  path.resolve(
    "db/migrations/002_phase5_agent_delegation_lifecycle.sql",
  );

const PHASE6_AUDIT_MIGRATION =
  path.resolve(
    "db/migrations/003_phase6_agent_registry_authorization_audit.sql",
  );

const PHASE6_OWNER_ACCOUNT_PROFILE_MIGRATION =
  path.resolve(
    "db/migrations/004_phase6_owner_account_binding_authorization_audit.sql",
  );

const PHASE6_FRESHNESS_SOURCE_PROFILE_MIGRATION =
  path.resolve(
    "db/migrations/005_phase6_freshness_source_authorization_audit.sql",
  );

const BUYER_ID =
  `buyer:phase6-demo3:${RUN_ID}`;

const AGENT_ID =
  `agent:phase6-demo3:${RUN_ID}`;

const AGENT_TOKEN_ID =
  "0";

const TOKEN_ADDRESS =
  "ccd:testnet/cis2:12802-0-0";

const AGENT_REGISTRY_REFERENCE = {
  type:
    AGENT_REGISTRY_REFERENCE_TYPE,

  version:
    AGENT_REGISTRY_CONTRACT_VERSION,

  registryStandard:
    AGENT_REGISTRY_STANDARD,

  network:
    CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
      .network,

  registryContract: {
    index:
      CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
        .contract
        .index,

    subindex:
      CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG
        .contract
        .subindex,
  },

  agentTokenId:
    AGENT_TOKEN_ID,

  tokenAddress:
    TOKEN_ADDRESS,
} as const;

const ENVIRONMENT_KEYS = [
  "DATABASE_URL",

  "NODE_ENV",

  "X402_ALLOW_DEV_HARNESS",

  "PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED",

  "PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED",

  "PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED",

  "PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH",

  "PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_ENABLED",

  "PHASE6_DEMO3_CONTROLLED_EVIDENCE_ENABLED",

  "PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_PATH",

  "PHASE3_GATEWAY_RELEASE_ENABLED",

  "PHASE3_GATEWAY_TEST_RELEASE_ONLY",

  "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",

  "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",

  "PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED",

  "CRP_BASE_URL",

  "ORCHESTRATOR_BASE_URL",

  "ORCHESTRATOR_API_KEY",
] as const;

type EnvironmentKey =
  typeof ENVIRONMENT_KEYS[number];

type EnvironmentSnapshot =
  Record<
    EnvironmentKey,
    string | undefined
  >;

type RecordedRequest = {
  readonly method: string;
  readonly path: string;
};

type RecordingServer = {
  readonly baseUrl: string;

  readonly requests:
    RecordedRequest[];

  readonly close:
    () => Promise<void>;
};

type Demo3Scenario =
  | "positive"
  | "acting_key_mismatch"
  | "tampered_agent_card";

type SignatureMutationTarget =
  | "buyer"
  | "agent";

type HelperResult =
  Record<string, unknown>;

type LifecycleSnapshot = {
  readonly challengeStatus:
    string | null;

  readonly releaseStatus:
    string | null;

  readonly claimCount:
    number;

  readonly consumedUses:
    number | null;
};

type AuditRow = {
  readonly audit_id:
    string;

  readonly decision:
    string;

  readonly reason:
    string;

  readonly registry_network:
    string | null;

  readonly agent_token_id:
    string | null;

  readonly registry_status:
    string | null;

  readonly owner_account_bound:
    boolean;

  readonly owner_identity_assurance:
    string | null;

  readonly freshness_source:
    string | null;

  readonly indexer_lag_blocks:
    number | null;

  readonly agent_card_expected_hash:
    string | null;

  readonly agent_card_actual_hash:
    string | null;

  readonly agent_card_integrity_verified:
    boolean;

  readonly key_binding_required:
    boolean;

  readonly key_binding_verified:
    boolean;

  readonly registry_read_captured:
    boolean;

  readonly agent_registry_lookup_attempted:
    boolean;

  readonly cis8_lookup_attempted:
    boolean;

  readonly agent_card_fetch_attempted:
    boolean;

  readonly buyer_policy_evaluated:
    boolean;

  readonly canonical_state_mutated:
    boolean;

  readonly bounded_use_consumed:
    boolean;

  readonly replay_state_mutated:
    boolean;

  readonly payment_attempted:
    boolean;

  readonly receipt_issued:
    boolean;

  readonly resource_released:
    boolean;

  readonly production_activation:
    boolean;
};

type PathExecution = {
  readonly name: string;

  readonly nonce: string;

  readonly credentialHash: string;

  readonly result:
    Awaited<
      ReturnType<
        typeof request
      >
    >;

  readonly lifecycle:
    LifecycleSnapshot;

  readonly auditRows:
    readonly AuditRow[];
};


let gateway:
  ChildProcess | null = null;

let crpTripwire:
  RecordingServer | null = null;

let orchestratorStub:
  RecordingServer | null = null;

let originalEnvironment:
  EnvironmentSnapshot | null = null;

const createdNonces:
  string[] = [];

const createdCredentialHashes:
  string[] = [];

const createdRevocationIds:
  string[] = [];

let lifecycleMigrationApplied =
  false;

let phase6AuditMigrationApplied =
  false;

let phase6OwnerAccountProfileMigrationApplied =
  false;

let phase6FreshnessSourceProfileMigrationApplied =
  false;

let gatewayStartCount =
  0;


function captureEnvironment():
EnvironmentSnapshot {
  const snapshot =
    {} as EnvironmentSnapshot;

  for (
    const key
    of ENVIRONMENT_KEYS
  ) {
    snapshot[key] =
      process.env[key];
  }

  return snapshot;
}


function restoreEnvironment(
  snapshot:
    EnvironmentSnapshot,
): void {
  for (
    const key
    of ENVIRONMENT_KEYS
  ) {
    const value =
      snapshot[key];

    if (
      value ===
        undefined
    ) {
      delete process.env[key];
    } else {
      process.env[key] =
        value;
    }
  }
}


function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}


function requiredRecord(
  value: unknown,
  location: string,
): Record<string, unknown> {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      `${location} must be an object`,
    );
  }

  return value;
}


function requiredString(
  value: unknown,
  location: string,
): string {
  if (
    typeof value !==
      "string" ||
    value.length ===
      0
  ) {
    throw new Error(
      `${location} must be a non-empty string`,
    );
  }

  return value;
}


function writeJsonFile(
  filePath: string,
  value: unknown,
): void {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      value,
      null,
      2,
    )}\n`,
    {
      encoding:
        "utf8",
    },
  );
}


function readJsonFile(
  filePath: string,
): Record<string, unknown> {
  return requiredRecord(
    JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    ) as unknown,
    filePath,
  );
}


function assertNoPrivateJwk(
  value: unknown,
  location = "$",
): void {
  if (
    Array.isArray(
      value,
    )
  ) {
    value.forEach(
      (
        entry,
        index,
      ) =>
        assertNoPrivateJwk(
          entry,
          `${location}[${index}]`,
        ),
    );

    return;
  }

  if (
    !isRecord(
      value,
    )
  ) {
    return;
  }

  for (
    const [
      key,
      child,
    ]
    of Object.entries(
      value,
    )
  ) {
    assert.notEqual(
      key,
      "d",
      `private JWK material found at ${location}.${key}`,
    );

    assertNoPrivateJwk(
      child,
      `${location}.${key}`,
    );
  }
}


function runNodeJson(
  scriptPath: string,
  args: readonly string[],
  options: {
    readonly requireOk?: boolean;
  } = {},
): HelperResult {
  const execution =
    spawnSync(
      process.execPath,
      [
        "-r",
        "ts-node/register/transpile-only",
        scriptPath,
        ...args,
      ],
      {
        cwd:
          ROOT,

        encoding:
          "utf8",

        env: {
          ...process.env,
        },

        windowsHide:
          true,
      },
    );

  if (
    execution.status !==
      0
  ) {
    throw new Error(
      [
        `${scriptPath} failed with status ${execution.status}`,
        execution.stdout,
        execution.stderr,
      ]
        .filter(
          Boolean,
        )
        .join(
          "\n",
        ),
    );
  }

  const parsed =
    JSON.parse(
      execution.stdout,
    ) as unknown;

  const result =
    requiredRecord(
      parsed,
      `${scriptPath} output`,
    );

  if (
    options.requireOk !==
      false
  ) {
    assert.equal(
      result.ok,
      true,
      `${scriptPath} helper result`,
    );
  }

  assert.equal(
    result.productionActivation,
    false,
    `${scriptPath} productionActivation`,
  );

  return result;
}


async function readRequestBody(
  req:
    IncomingMessage,
): Promise<void> {
  for await (
    const _chunk
    of req
  ) {
    // Consume without retaining authorization material.
  }
}


function writeJsonResponse(
  res:
    ServerResponse,
  status: number,
  value: unknown,
): void {
  res.statusCode =
    status;

  res.setHeader(
    "content-type",
    "application/json",
  );

  res.end(
    JSON.stringify(
      value,
    ),
  );
}


async function startCrpTripwire(
  port: number,
): Promise<RecordingServer> {
  const requests:
    RecordedRequest[] = [];

  const server =
    createServer(
      async (
        req,
        res,
      ) => {
        const requestPath =
          new URL(
            req.url ??
              "/",
            "http://127.0.0.1",
          ).pathname;

        await readRequestBody(
          req,
        );

        requests.push({
          method:
            req.method ??
            "UNKNOWN",

          path:
            requestPath,
        });

        writeJsonResponse(
          res,
          500,
          {
            ok:
              false,

            reason:
              "unexpected_crp_call_in_phase6_demo3_acceptance",
          },
        );
      },
    );

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      server.once(
        "error",
        reject,
      );

      server.listen(
        port,
        "127.0.0.1",
        () => {
          server.off(
            "error",
            reject,
          );

          resolve();
        },
      );
    },
  );

  return {
    baseUrl:
      baseUrlForPort(
        port,
      ),

    requests,

    close:
      () =>
        new Promise<void>(
          (
            resolve,
            reject,
          ) => {
            server.close(
              (
                error,
              ) => {
                if (
                  error
                ) {
                  reject(
                    error,
                  );
                } else {
                  resolve();
                }
              },
            );
          },
        ),
  };
}


async function startOrchestratorStub(
  port: number,
): Promise<RecordingServer> {
  const requests:
    RecordedRequest[] = [];

  const server =
    createServer(
      async (
        req,
        res,
      ) => {
        const requestPath =
          new URL(
            req.url ??
              "/",
            "http://127.0.0.1",
          ).pathname;

        await readRequestBody(
          req,
        );

        requests.push({
          method:
            req.method ??
            "UNKNOWN",

          path:
            requestPath,
        });

        if (
          req.method ===
            "POST" &&
          requestPath ===
            "/internal/payments/intents"
        ) {
          writeJsonResponse(
            res,
            200,
            {
              ok:
                true,

              accepted:
                true,
            },
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          requestPath ===
            "/internal/payments/proof"
        ) {
          writeJsonResponse(
            res,
            200,
            {
              ok:
                true,

              accepted:
                true,
            },
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          requestPath ===
            "/internal/payments/release-check"
        ) {
          writeJsonResponse(
            res,
            200,
            {
              ok:
                true,

              ready:
                false,

              reason:
                "controlled_phase6_demo3_acceptance_only",
            },
          );

          return;
        }

        writeJsonResponse(
          res,
          404,
          {
            ok:
              false,

            reason:
              "not_found",
          },
        );
      },
    );

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      server.once(
        "error",
        reject,
      );

      server.listen(
        port,
        "127.0.0.1",
        () => {
          server.off(
            "error",
            reject,
          );

          resolve();
        },
      );
    },
  );

  return {
    baseUrl:
      baseUrlForPort(
        port,
      ),

    requests,

    close:
      () =>
        new Promise<void>(
          (
            resolve,
            reject,
          ) => {
            server.close(
              (
                error,
              ) => {
                if (
                  error
                ) {
                  reject(
                    error,
                  );
                } else {
                  resolve();
                }
              },
            );
          },
        ),
  };
}


async function applyMigrationIfMissing(
  tableName: string,
  migrationPath: string,
): Promise<boolean> {
  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    const exists =
      await client.query<{
        relation:
          string | null;
      }>(
        `
        SELECT
          to_regclass($1)::text
            AS relation
        `,
        [
          tableName,
        ],
      );

    if (
      exists.rows[0]
        ?.relation !==
        null &&
      exists.rows[0]
        ?.relation !==
        undefined
    ) {
      return false;
    }

    const sql =
      fs.readFileSync(
        migrationPath,
        "utf8",
      );

    await client.query(
      sql,
    );

    const confirmed =
      await client.query<{
        relation:
          string | null;
      }>(
        `
        SELECT
          to_regclass($1)::text
            AS relation
        `,
        [
          tableName,
        ],
      );

    assert.notEqual(
      confirmed.rows[0]
        ?.relation ??
        null,
      null,
      `${tableName} migration confirmation`,
    );

    return true;
  } finally {
    await client.end();
  }
}



async function applyMigrationIfConstraintMissing(
  tableName: string,
  constraintName: string,
  migrationPath: string,
): Promise<boolean> {
  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    const existing =
      await client.query<{
        present:
          boolean;
      }>(
        `
        SELECT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE
            conrelid = to_regclass($1)
            AND conname = $2
        ) AS present
        `,
        [
          tableName,
          constraintName,
        ],
      );

    if (
      existing.rows[0]
        ?.present ===
      true
    ) {
      return false;
    }

    const sql =
      fs.readFileSync(
        migrationPath,
        "utf8",
      );

    await client.query(
      sql,
    );

    return true;
  } finally {
    await client.end();
  }
}


function configureBaseEnvironment(
  crpBaseUrl: string,
  orchestratorBaseUrl: string,
): void {
  process.env.DATABASE_URL =
    DATABASE_URL;

  process.env.NODE_ENV =
    "development";

  process.env.X402_ALLOW_DEV_HARNESS =
    "true";

  process.env
    .PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED =
    "true";

  process.env
    .PHASE5_CRYPTOGRAPHIC_DELEGATION_RUNTIME_ENABLED =
    "true";

  process.env
    .PHASE5_DELEGATION_LIFECYCLE_ENFORCEMENT_ENABLED =
    "true";

  process.env
    .PHASE5_CRYPTOGRAPHIC_BUYER_VERIFICATION_KEY_PATH =
    BUYER_VERIFICATION_KEY_PATH;

  process.env
    .PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_ENABLED =
    "true";

  process.env
    .PHASE6_DEMO3_CONTROLLED_EVIDENCE_ENABLED =
    "true";

  process.env
    .PHASE3_GATEWAY_RELEASE_ENABLED =
    "false";

  process.env
    .PHASE3_GATEWAY_TEST_RELEASE_ONLY =
    "false";

  process.env
    .PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED =
    "false";

  process.env
    .PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED =
    "false";

  process.env
    .PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED =
    "false";

  process.env.CRP_BASE_URL =
    crpBaseUrl;

  process.env.ORCHESTRATOR_BASE_URL =
    orchestratorBaseUrl;

  process.env.ORCHESTRATOR_API_KEY =
    "dev-internal-key";
}


async function stopGateway():
Promise<void> {
  await killProcessTree(
    gateway,
  );

  gateway =
    null;

  await waitForPortClosed(
    GATEWAY_PORT,
  );
}


async function startGatewayForScenario(
  scenario:
    Demo3Scenario,
  manifestPath: string,
): Promise<Record<string, unknown>> {
  await stopGateway();

  process.env
    .PHASE6_DEMO3_CONTROLLED_EVIDENCE_MANIFEST_PATH =
    path.relative(
      ROOT,
      manifestPath,
    );

  gateway =
    startGateway({
      port:
        GATEWAY_PORT,

      label:
        `${LABEL}:${scenario}`,
    });

  gatewayStartCount +=
    1;

  const health =
    requiredRecord(
      await waitForReady(
        GATEWAY_BASE,
      ),
      "Gateway health",
    );

  const phase5 =
    requiredRecord(
      health.phase5,
      "health.phase5",
    );

  const phase6 =
    requiredRecord(
      health.phase6,
      "health.phase6",
    );

  const controlled =
    requiredRecord(
      phase6.demo3ControlledEvidence,
      "health.phase6.demo3ControlledEvidence",
    );

  assert.equal(
    phase5.agentDelegatedRuntimeEnabled,
    true,
  );

  assert.equal(
    phase5.cryptographicDelegationRuntimeEnabled,
    true,
  );

  assert.equal(
    phase5.delegationLifecycleEnforcementActive,
    true,
  );

  assert.equal(
    phase5.buyerVerificationKeyLoaded,
    true,
  );

  assert.equal(
    phase6.agentRegistryConditionalGatingEnabled,
    true,
  );

  assert.equal(
    phase6.agentRegistryConditionalGatingActive,
    true,
  );

  assert.equal(
    controlled.requested,
    true,
  );

  assert.equal(
    controlled.active,
    true,
  );

  assert.equal(
    controlled.status,
    "active",
  );

  assert.equal(
    controlled.reason,
    "controlled_evidence_active",
  );

  assert.equal(
    controlled.scenario,
    scenario,
  );

  assert.equal(
    controlled.manifestLoaded,
    true,
  );

  assert.equal(
    controlled.manifestPathAccepted,
    true,
  );

  assert.equal(
    controlled.productionActivation,
    false,
  );

  assert.equal(
    phase6.productionActivation,
    false,
  );

  return health;
}


function generateControlledFixtures():
void {
  fs.mkdirSync(
    KEY_DIRECTORY,
    {
      recursive:
        true,

      mode:
        0o700,
    },
  );

  const keyResult =
    runNodeJson(
      "scripts/demo_phase5_cryptographic_key_bundle.ts",
      [
        "--out-dir",
        KEY_DIRECTORY,

        "--buyer-id",
        BUYER_ID,

        "--buyer-key-id",
        `buyer-key:phase6-demo3:${RUN_ID}`,

        "--agent-id",
        AGENT_ID,

        "--agent-key-id",
        `agent-key:phase6-demo3:${RUN_ID}`,
      ],
    );

  assert.equal(
    keyResult.privateMaterialTemporary,
    true,
  );

  assert.equal(
    keyResult.privateMaterialPrinted,
    false,
  );

  assert.equal(
    keyResult.paymentAttempted,
    false,
  );

  assert.equal(
    fs.existsSync(
      KEY_BUNDLE_PATH,
    ),
    true,
  );

  assert.equal(
    fs.existsSync(
      BUYER_VERIFICATION_KEY_PATH,
    ),
    true,
  );

  for (
    const fixture
    of [
      {
        scenario:
          "positive" as const,

        manifestPath:
          POSITIVE_MANIFEST_PATH,
      },

      {
        scenario:
          "acting_key_mismatch" as const,

        manifestPath:
          ACTING_KEY_MISMATCH_MANIFEST_PATH,
      },

      {
        scenario:
          "tampered_agent_card" as const,

        manifestPath:
          TAMPERED_AGENT_CARD_MANIFEST_PATH,
      },
    ]
  ) {
    const result =
      runNodeJson(
        "scripts/demo_phase6_demo3_controlled_evidence.ts",
        [
          "--key-bundle",
          KEY_BUNDLE_PATH,

          "--scenario",
          fixture.scenario,

          "--out",
          path.relative(
            ROOT,
            fixture.manifestPath,
          ),
        ],
        {
          requireOk:
            false,
        },
      );

    assert.equal(
      result.scenario,
      fixture.scenario,
    );

    assert.equal(
      result.manifestValidated,
      true,
    );

    assert.equal(
      result.privateMaterialRead,
      false,
    );

    assert.equal(
      result.privateMaterialPrinted,
      false,
    );

    assert.equal(
      result.gatewayCalled,
      false,
    );

    assert.equal(
      result.concordiumCalled,
      false,
    );

    assert.equal(
      result.paymentAttempted,
      false,
    );
  }
}


async function issueChallenge(
  prefix: string,
): Promise<Record<string, unknown>> {
  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated",
    );

  assert.equal(
    result.status,
    402,
    `${prefix}: initial challenge status`,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
    `${prefix}: initial challenge PAYMENT-RESPONSE`,
  );

  const encoded =
    result.headers.get(
      "payment-required",
    );

  assert.notEqual(
    encoded,
    null,
    `${prefix}: PAYMENT-REQUIRED header`,
  );

  const paymentRequired =
    requiredRecord(
      JSON.parse(
        Buffer.from(
          requiredString(
            encoded,
            `${prefix}.payment-required`,
          ),
          "base64",
        ).toString(
          "utf8",
        ),
      ) as unknown,
      `${prefix}.paymentRequired`,
    );

  assert.equal(
    requiredRecord(
      paymentRequired.resource,
      `${prefix}.resource`,
    ).path,
    "/paid-gated",
  );

  assert.equal(
    requiredRecord(
      paymentRequired.policyRequirements,
      `${prefix}.policyRequirements`,
    ).required,
    true,
  );

  const nonce =
    requiredString(
      paymentRequired.nonce,
      `${prefix}.nonce`,
    );

  createdNonces.push(
    nonce,
  );

  const paymentRequiredPath =
    path.join(
      WORK_DIRECTORY,
      `${prefix}-payment-required.json`,
    );

  writeJsonFile(
    paymentRequiredPath,
    paymentRequired,
  );

  return paymentRequired;
}


function tamperSignatureByte(
  body:
    Record<string, unknown>,
  target:
    SignatureMutationTarget,
): Record<string, unknown> {
  const cloned =
    JSON.parse(
      JSON.stringify(
        body,
      ),
    ) as unknown;

  const root =
    requiredRecord(
      cloned,
      "tampered body",
    );

  const authorizationProof =
    requiredRecord(
      root.authorizationProof,
      "authorizationProof",
    );

  const cryptographicProofs =
    requiredRecord(
      authorizationProof.cryptographicProofs,
      "authorizationProof.cryptographicProofs",
    );

  const document =
    target ===
      "buyer"
      ? requiredRecord(
          cryptographicProofs.delegationCredential,
          "delegationCredential",
        )
      : requiredRecord(
          cryptographicProofs.agentProofOfPossession,
          "agentProofOfPossession",
        );

  const proof =
    requiredRecord(
      document.proof,
      `${target}.proof`,
    );

  const signature =
    requiredString(
      proof.signatureValue,
      `${target}.signatureValue`,
    );

  const decoded =
    Buffer.from(
      signature,
      "base64url",
    );

  assert.equal(
    decoded.byteLength,
    64,
    `${target}: Ed25519 signature length`,
  );

  const mutated =
    Buffer.from(
      decoded,
    );

  mutated[
    mutated.byteLength -
    1
  ] ^=
    0x01;

  const replacement =
    mutated.toString(
      "base64url",
    );

  assert.notEqual(
    replacement,
    signature,
  );

  proof.signatureValue =
    replacement;

  assertNoPrivateJwk(
    root,
  );

  return root;
}


function buildRedeemBody(
  prefix: string,
  paymentRequired:
    Record<string, unknown>,
  buyerPolicy: {
    readonly region:
      "EU" | "US";

    readonly ageOver:
      number;
  },
  mutation:
    SignatureMutationTarget | null,
): {
  readonly body:
    Record<string, unknown>;

  readonly credentialHash:
    string;

  readonly revocationId:
    string;
} {
  const paymentRequiredPath =
    path.join(
      WORK_DIRECTORY,
      `${prefix}-payment-required.json`,
    );

  const structuralPath =
    path.join(
      WORK_DIRECTORY,
      `${prefix}-structural.json`,
    );

  const cryptographicPath =
    path.join(
      WORK_DIRECTORY,
      `${prefix}-cryptographic.json`,
    );

  const structuralResult =
    runNodeJson(
      "scripts/demo_agent_delegated_authorization_proof.ts",
      [
        "--payment-required",
        paymentRequiredPath,

        "--out",
        structuralPath,

        "--region",
        buyerPolicy.region,

        "--age-over",
        String(
          buyerPolicy.ageOver,
        ),

        "--agent-id",
        AGENT_ID,

        "--buyer-commitment",
        `sha256:phase6-demo3:${RUN_ID}:${prefix}`,

        "--buyer-account",
        "ccd1qphase6demo3controlledbuyer",

        "--policy-subject",
        BUYER_ID,

        "--delegation-id",
        `delegation-${RUN_ID}-${prefix}`,
      ],
    );

  assert.equal(
    structuralResult.rawProofPrinted,
    false,
  );

  assert.equal(
    structuralResult.paymentAttempted,
    false,
  );

  const cryptographicResult =
    runNodeJson(
      "scripts/demo_agent_delegated_cryptographic_authorization_proof.ts",
      [
        "--input",
        structuralPath,

        "--key-bundle",
        KEY_BUNDLE_PATH,

        "--out",
        cryptographicPath,
      ],
    );

  assert.equal(
    cryptographicResult.delegationContractValidated,
    true,
  );

  assert.equal(
    cryptographicResult.buyerSignatureVerified,
    true,
  );

  assert.equal(
    cryptographicResult.agentProofOfPossessionVerified,
    true,
  );

  assert.equal(
    cryptographicResult.privateMaterialPrinted,
    false,
  );

  const credentialHash =
    requiredString(
      cryptographicResult.credentialHash,
      `${prefix}.credentialHash`,
    );

  const body =
    readJsonFile(
      cryptographicPath,
    );

  assert.equal(
    body.nonce,
    paymentRequired.nonce,
  );

  body.agentRegistryReference =
    AGENT_REGISTRY_REFERENCE;

  const authorizationProof =
    requiredRecord(
      body.authorizationProof,
      `${prefix}.authorizationProof`,
    );

  const cryptographicProofs =
    requiredRecord(
      authorizationProof.cryptographicProofs,
      `${prefix}.cryptographicProofs`,
    );

  const delegationCredential =
    requiredRecord(
      cryptographicProofs.delegationCredential,
      `${prefix}.delegationCredential`,
    );

  const credential =
    requiredRecord(
      delegationCredential.credential,
      `${prefix}.credential`,
    );

  const lifecycle =
    requiredRecord(
      credential.lifecycle,
      `${prefix}.lifecycle`,
    );

  const revocationId =
    requiredString(
      lifecycle.revocationId,
      `${prefix}.revocationId`,
    );

  createdCredentialHashes.push(
    credentialHash,
  );

  createdRevocationIds.push(
    revocationId,
  );

  const finalBody =
    mutation ===
      null
      ? body
      : tamperSignatureByte(
          body,
          mutation,
        );

  assertNoPrivateJwk(
    finalBody,
  );

  writeJsonFile(
    path.join(
      WORK_DIRECTORY,
      `${prefix}-redeem.json`,
    ),
    finalBody,
  );

  return {
    body:
      finalBody,

    credentialHash,

    revocationId,
  };
}


async function readLifecycleSnapshot(
  nonce: string,
  credentialHash: string,
): Promise<LifecycleSnapshot> {
  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    const challenge =
      await client.query<{
        status:
          string;

        release_status:
          string;
      }>(
        `
        SELECT
          status,
          release_status
        FROM public.payment_challenges
        WHERE nonce = $1
        LIMIT 1
        `,
        [
          nonce,
        ],
      );

    const claims =
      await client.query<{
        claim_count:
          number;
      }>(
        `
        SELECT
          COUNT(*)::int
            AS claim_count
        FROM public.phase5_agent_delegation_use_claims
        WHERE
          challenge_nonce = $1
          OR credential_hash = $2
        `,
        [
          nonce,
          credentialHash,
        ],
      );

    const usage =
      await client.query<{
        consumed_uses:
          number | string;
      }>(
        `
        SELECT
          consumed_uses
        FROM public.phase5_agent_delegation_usage
        WHERE credential_hash = $1
        LIMIT 1
        `,
        [
          credentialHash,
        ],
      );

    return {
      challengeStatus:
        challenge.rowCount ===
          1
          ? String(
              challenge.rows[0]
                .status,
            )
          : null,

      releaseStatus:
        challenge.rowCount ===
          1
          ? String(
              challenge.rows[0]
                .release_status,
            )
          : null,

      claimCount:
        Number(
          claims.rows[0]
            ?.claim_count ??
          0,
        ),

      consumedUses:
        usage.rowCount ===
          1
          ? Number(
              usage.rows[0]
                .consumed_uses,
            )
          : null,
    };
  } finally {
    await client.end();
  }
}


async function readAuditRows(
  nonce: string,
): Promise<readonly AuditRow[]> {
  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    const result =
      await client.query<AuditRow>(
        `
        SELECT
          audit_id::text,
          decision,
          reason,
          registry_network,
          agent_token_id,
          registry_status,
          owner_account_bound,
          owner_identity_assurance,
          freshness_source,
          indexer_lag_blocks,
          agent_card_expected_hash,
          agent_card_actual_hash,
          agent_card_integrity_verified,
          key_binding_required,
          key_binding_verified,
          registry_read_captured,
          agent_registry_lookup_attempted,
          cis8_lookup_attempted,
          agent_card_fetch_attempted,
          buyer_policy_evaluated,
          canonical_state_mutated,
          bounded_use_consumed,
          replay_state_mutated,
          payment_attempted,
          receipt_issued,
          resource_released,
          production_activation
        FROM public.phase6_agent_registry_authorization_audit
        WHERE nonce = $1
        ORDER BY audit_id ASC
        `,
        [
          nonce,
        ],
      );

    return result.rows;
  } finally {
    await client.end();
  }
}


async function executePath(
  name: string,
  buyerPolicy: {
    readonly region:
      "EU" | "US";

    readonly ageOver:
      number;
  },
  mutation:
    SignatureMutationTarget | null,
): Promise<PathExecution> {
  const crpRequestCountBeforeChallenge =
    crpTripwire?.requests.length ??
    0;

  const paymentRequired =
    await issueChallenge(
      name,
    );

  const crpChallengePaths =
    (
      crpTripwire?.requests ??
      []
    )
      .slice(
        crpRequestCountBeforeChallenge,
      )
      .map(
        (
          entry,
        ) =>
          `${entry.method} ${entry.path}`,
      );

  assert.deepEqual(
    crpChallengePaths,
    [
      "POST /v1/crp/payments/match",
      "POST /v1/crp/payments/fulfill",
    ],
    `${name}: canonical challenge CRP probe`,
  );

  const crpRequestCountBeforeRedeem =
    crpTripwire?.requests.length ??
    0;

  const nonce =
    requiredString(
      paymentRequired.nonce,
      `${name}.nonce`,
    );

  const built =
    buildRedeemBody(
      name,
      paymentRequired,
      buyerPolicy,
      mutation,
    );

  const result =
    await request(
      GATEWAY_BASE,
      "/paid-gated/redeem",
      {
        method:
          "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            built.body,
          ),
      },
    );

  const crpRequestCountAfterRedeem =
    crpTripwire?.requests.length ??
    0;

  assert.equal(
    crpRequestCountAfterRedeem,
    crpRequestCountBeforeRedeem,
    `${name}: redeem authorization must not call CRP`,
  );

  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
    `${name}: PAYMENT-RESPONSE must remain absent`,
  );

  assert.notEqual(
    result.json?.resource,
    "secret-data",
    `${name}: protected resource must remain closed`,
  );

  const lifecycle =
    await readLifecycleSnapshot(
      nonce,
      built.credentialHash,
    );

  const auditRows =
    await readAuditRows(
      nonce,
    );

  return {
    name,
    nonce,
    credentialHash:
      built.credentialHash,
    result,
    lifecycle,
    auditRows,
  };
}


function assertAuditSideEffectsClosed(
  row:
    AuditRow,
  name: string,
): void {
  assert.equal(
    row.buyer_policy_evaluated,
    false,
    `${name}: audit buyer_policy_evaluated`,
  );

  assert.equal(
    row.canonical_state_mutated,
    false,
    `${name}: audit canonical_state_mutated`,
  );

  assert.equal(
    row.bounded_use_consumed,
    false,
    `${name}: audit bounded_use_consumed`,
  );

  assert.equal(
    row.replay_state_mutated,
    false,
    `${name}: audit replay_state_mutated`,
  );

  assert.equal(
    row.payment_attempted,
    false,
    `${name}: audit payment_attempted`,
  );

  assert.equal(
    row.receipt_issued,
    false,
    `${name}: audit receipt_issued`,
  );

  assert.equal(
    row.resource_released,
    false,
    `${name}: audit resource_released`,
  );

  assert.equal(
    row.production_activation,
    false,
    `${name}: audit production_activation`,
  );
}


function assertPhase6DeniedPath(
  execution:
    PathExecution,
  expectedReason:
    "agent_registry_key_mismatch"
    | "agent_card_hash_mismatch",
): AuditRow {
  assert.equal(
    execution.result.status,
    403,
    execution.name,
  );

  assert.equal(
    execution.result.json?.ok,
    false,
  );

  assert.equal(
    execution.result.json?.code,
    expectedReason,
  );

  assert.equal(
    execution.result.json?.reason,
    expectedReason,
  );

  assert.equal(
    execution.result.json?.policyStatus,
    "POLICY_NOT_EVALUATED",
  );

  assert.equal(
    execution.result.json?.phase6
      ?.status,
    "denied",
  );

  assert.equal(
    execution.result.json?.phase6
      ?.reason,
    expectedReason,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.auditPersisted,
    true,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.buyerPolicyEvaluated,
    false,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.paymentAttempted,
    false,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.resourceReleased,
    false,
  );

  assert.equal(
    execution.result.json?.phase6
      ?.productionActivation,
    false,
  );

  assert.equal(
    execution.lifecycle.claimCount,
    0,
  );

  assert.equal(
    execution.lifecycle.consumedUses,
    null,
  );

  assert.equal(
    execution.lifecycle.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    execution.auditRows.length,
    1,
  );

  const row =
    execution.auditRows[0];

  assert.equal(
    row.decision,
    "denied",
  );

  assert.equal(
    row.reason,
    expectedReason,
  );

  assert.equal(
    row.registry_network,
    "ccd:testnet",
  );

  assert.equal(
    row.agent_token_id,
    AGENT_TOKEN_ID,
  );

  assert.equal(
    row.registry_read_captured,
    true,
  );

  assert.equal(
    row.agent_registry_lookup_attempted,
    true,
  );

  assertAuditSideEffectsClosed(
    row,
    execution.name,
  );

  return row;
}


function assertAllowedAudit(
  execution:
    PathExecution,
): AuditRow {
  assert.equal(
    execution.auditRows.length,
    1,
    `${execution.name}: audit row count`,
  );

  const row =
    execution.auditRows[0];

  assert.equal(
    row.decision,
    "allowed",
  );

  assert.equal(
    row.reason,
    "accepted",
  );

  assert.equal(
    row.registry_network,
    "ccd:testnet",
  );

  assert.equal(
    row.agent_token_id,
    AGENT_TOKEN_ID,
  );

  assert.equal(
    row.registry_status,
    "Active",
  );

  assert.equal(
    row.owner_account_bound,
    true,
  );

  assert.equal(
    row.owner_identity_assurance,
    "not_evaluated",
  );

  assert.equal(
    row.freshness_source,
    "direct_chain",
  );

  assert.equal(
    row.indexer_lag_blocks,
    null,
  );

  assert.notEqual(
    row.agent_card_expected_hash,
    null,
  );

  assert.equal(
    row.agent_card_actual_hash,
    row.agent_card_expected_hash,
  );

  assert.equal(
    row.agent_card_integrity_verified,
    true,
  );

  assert.equal(
    row.key_binding_required,
    true,
  );

  assert.equal(
    row.key_binding_verified,
    true,
  );

  assert.equal(
    row.registry_read_captured,
    true,
  );

  assert.equal(
    row.agent_registry_lookup_attempted,
    true,
  );

  assert.equal(
    row.cis8_lookup_attempted,
    true,
  );

  assert.equal(
    row.agent_card_fetch_attempted,
    true,
  );

  assertAuditSideEffectsClosed(
    row,
    execution.name,
  );

  return row;
}


async function cleanMutableDatabaseRows():
Promise<void> {
  if (
    createdNonces.length ===
      0 &&
    createdCredentialHashes.length ===
      0 &&
    createdRevocationIds.length ===
      0
  ) {
    return;
  }

  const client =
    new Client({
      connectionString:
        DATABASE_URL,
    });

  await client.connect();

  try {
    await client.query(
      "BEGIN",
    );

    if (
      createdNonces.length >
        0 ||
      createdCredentialHashes.length >
        0
    ) {
      await client.query(
        `
        DELETE FROM
          public.phase5_agent_delegation_use_claims
        WHERE
          challenge_nonce =
            ANY($1::text[])
          OR credential_hash =
            ANY($2::text[])
        `,
        [
          createdNonces,
          createdCredentialHashes,
        ],
      );
    }

    if (
      createdCredentialHashes.length >
        0
    ) {
      await client.query(
        `
        DELETE FROM
          public.phase5_agent_delegation_usage
        WHERE credential_hash =
          ANY($1::text[])
        `,
        [
          createdCredentialHashes,
        ],
      );
    }

    if (
      createdRevocationIds.length >
        0
    ) {
      await client.query(
        `
        DELETE FROM
          public.phase5_agent_delegation_revocations
        WHERE revocation_id =
          ANY($1::text[])
        `,
        [
          createdRevocationIds,
        ],
      );
    }

    if (
      createdNonces.length >
        0
    ) {
      await client.query(
        `
        DELETE FROM
          public.payment_challenges
        WHERE nonce =
          ANY($1::text[])
        `,
        [
          createdNonces,
        ],
      );
    }

    await client.query(
      "COMMIT",
    );
  } catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    await client.end();
  }
}


async function cleanup():
Promise<void> {
  await stopGateway();

  if (
    orchestratorStub
  ) {
    try {
      await orchestratorStub.close();
    } catch {
      // Best-effort controlled cleanup.
    }

    orchestratorStub =
      null;
  }

  if (
    crpTripwire
  ) {
    try {
      await crpTripwire.close();
    } catch {
      // Best-effort controlled cleanup.
    }

    crpTripwire =
      null;
  }

  try {
    await cleanMutableDatabaseRows();
  } catch (
    error
  ) {
    console.error(
      `[${LABEL}] mutable database cleanup failed:`,
      error,
    );
  }

  if (
    originalEnvironment
  ) {
    restoreEnvironment(
      originalEnvironment,
    );

    originalEnvironment =
      null;
  }

  fs.rmSync(
    WORK_DIRECTORY,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}


async function main():
Promise<void> {
  originalEnvironment =
    captureEnvironment();

  fs.mkdirSync(
    WORK_DIRECTORY,
    {
      recursive:
        true,

      mode:
        0o700,
    },
  );

  for (
    const [
      port,
      label,
    ]
    of [
      [
        GATEWAY_PORT,
        "Gateway",
      ],

      [
        CRP_TRIPWIRE_PORT,
        "CRP tripwire",
      ],

      [
        ORCHESTRATOR_PORT,
        "orchestrator",
      ],
    ] as const
  ) {
    assert.equal(
      await isPortOpen(
        port,
      ),
      false,
      `${label} port ${port} must be free`,
    );
  }

  assert.equal(
    fs.existsSync(
      PHASE5_LIFECYCLE_MIGRATION,
    ),
    true,
  );

  assert.equal(
    fs.existsSync(
      PHASE6_AUDIT_MIGRATION,
    ),
    true,
  );

  assert.equal(
    fs.existsSync(
      PHASE6_OWNER_ACCOUNT_PROFILE_MIGRATION,
    ),
    true,
  );

  assert.equal(
    fs.existsSync(
      PHASE6_FRESHNESS_SOURCE_PROFILE_MIGRATION,
    ),
    true,
  );

  lifecycleMigrationApplied =
    await applyMigrationIfMissing(
      "public.phase5_agent_delegation_usage",
      PHASE5_LIFECYCLE_MIGRATION,
    );

  phase6AuditMigrationApplied =
    await applyMigrationIfMissing(
      "public.phase6_agent_registry_authorization_audit",
      PHASE6_AUDIT_MIGRATION,
    );

  phase6OwnerAccountProfileMigrationApplied =
    await applyMigrationIfConstraintMissing(
      "public.phase6_agent_registry_authorization_audit",
      "phase6_agent_registry_authorization_allowed_evidence_check",
      PHASE6_OWNER_ACCOUNT_PROFILE_MIGRATION,
    );

  phase6FreshnessSourceProfileMigrationApplied =
    await applyMigrationIfConstraintMissing(
      "public.phase6_agent_registry_authorization_audit",
      "phase6_agent_registry_authorization_freshness_source_check",
      PHASE6_FRESHNESS_SOURCE_PROFILE_MIGRATION,
    );

  generateControlledFixtures();

  crpTripwire =
    await startCrpTripwire(
      CRP_TRIPWIRE_PORT,
    );

  orchestratorStub =
    await startOrchestratorStub(
      ORCHESTRATOR_PORT,
    );

  configureBaseEnvironment(
    crpTripwire.baseUrl,
    orchestratorStub.baseUrl,
  );

  await startGatewayForScenario(
    "positive",
    POSITIVE_MANIFEST_PATH,
  );

  const path1 =
    await executePath(
      "path1-invalid-buyer-signature",
      {
        region:
          "EU",

        ageOver:
          21,
      },
      "buyer",
    );

  assert.equal(
    path1.result.status,
    403,
  );

  assert.equal(
    path1.result.json?.reason,
    "buyer_signature_verification_failed",
  );

  assert.equal(
    path1.result.json?.policyStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    path1.result.json?.verifier
      ?.buyerSignatureVerified,
    false,
  );

  assert.equal(
    path1.result.json?.verifier
      ?.agentProofOfPossessionVerified,
    false,
  );

  assert.equal(
    path1.result.json?.verifier
      ?.policyEvaluated,
    false,
  );

  assert.equal(
    path1.result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    path1.result.json?.phase6,
    undefined,
  );

  assert.equal(
    path1.auditRows.length,
    0,
  );

  assert.equal(
    path1.lifecycle.claimCount,
    0,
  );

  const path2 =
    await executePath(
      "path2-invalid-agent-pop",
      {
        region:
          "EU",

        ageOver:
          21,
      },
      "agent",
    );

  assert.equal(
    path2.result.status,
    403,
  );

  assert.equal(
    path2.result.json?.reason,
    "agent_proof_verification_failed",
  );

  assert.equal(
    path2.result.json?.policyStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    path2.result.json?.verifier
      ?.buyerSignatureVerified,
    true,
  );

  assert.equal(
    path2.result.json?.verifier
      ?.agentPublicKeyBoundByBuyerSignature,
    true,
  );

  assert.equal(
    path2.result.json?.verifier
      ?.agentProofOfPossessionVerified,
    false,
  );

  assert.equal(
    path2.result.json?.verifier
      ?.policyEvaluated,
    false,
  );

  assert.equal(
    path2.result.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    path2.result.json?.phase6,
    undefined,
  );

  assert.equal(
    path2.auditRows.length,
    0,
  );

  assert.equal(
    path2.lifecycle.claimCount,
    0,
  );

  await startGatewayForScenario(
    "acting_key_mismatch",
    ACTING_KEY_MISMATCH_MANIFEST_PATH,
  );

  const path3 =
    await executePath(
      "path3-acting-key-mismatch",
      {
        region:
          "EU",

        ageOver:
          21,
      },
      null,
    );

  const path3Audit =
    assertPhase6DeniedPath(
      path3,
      "agent_registry_key_mismatch",
    );

  assert.equal(
    path3.result.json?.phase6
      ?.cis8LookupAttempted,
    false,
  );

  assert.equal(
    path3.result.json?.phase6
      ?.agentCardFetchAttempted,
    false,
  );

  assert.equal(
    path3Audit.cis8_lookup_attempted,
    false,
  );

  assert.equal(
    path3Audit.agent_card_fetch_attempted,
    false,
  );

  await startGatewayForScenario(
    "tampered_agent_card",
    TAMPERED_AGENT_CARD_MANIFEST_PATH,
  );

  const path4 =
    await executePath(
      "path4-tampered-agent-card",
      {
        region:
          "EU",

        ageOver:
          21,
      },
      null,
    );

  const path4Audit =
    assertPhase6DeniedPath(
      path4,
      "agent_card_hash_mismatch",
    );

  assert.equal(
    path4.result.json?.phase6
      ?.cis8LookupAttempted,
    true,
  );

  assert.equal(
    path4.result.json?.phase6
      ?.agentCardFetchAttempted,
    true,
  );

  assert.equal(
    path4Audit.cis8_lookup_attempted,
    true,
  );

  assert.equal(
    path4Audit.agent_card_fetch_attempted,
    true,
  );

  assert.notEqual(
    path4Audit.agent_card_expected_hash,
    null,
  );

  assert.notEqual(
    path4Audit.agent_card_actual_hash,
    null,
  );

  assert.notEqual(
    path4Audit.agent_card_expected_hash,
    path4Audit.agent_card_actual_hash,
  );

  assert.equal(
    path4Audit.agent_card_integrity_verified,
    false,
  );

  await startGatewayForScenario(
    "positive",
    POSITIVE_MANIFEST_PATH,
  );

  const path5 =
    await executePath(
      "path5-ineligible-buyer",
      {
        region:
          "US",

        ageOver:
          18,
      },
      null,
    );

  assert.equal(
    path5.result.status,
    403,
  );

  assert.equal(
    path5.result.json?.reason,
    "age_requirement_not_met",
  );

  assert.equal(
    path5.result.json?.policyStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    path5.result.json?.policyDecision
      ?.policyDecision,
    "deny",
  );

  assert.equal(
    path5.result.json?.phase6
      ?.status,
    "allowed",
  );

  assert.equal(
    path5.result.json?.phase6
      ?.reason,
    "accepted",
  );

  assert.equal(
    path5.result.json?.phase6
      ?.auditPersisted,
    true,
  );

  assert.equal(
    path5.result.json?.phase6
      ?.paymentEligibilityHandoffPresent,
    true,
  );

  assert.equal(
    path5.result.json?.phase5
      ?.boundedUseConsumed,
    false,
  );

  assert.equal(
    path5.lifecycle.challengeStatus,
    "POLICY_FAILED",
  );

  assert.equal(
    path5.lifecycle.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    path5.lifecycle.claimCount,
    0,
  );

  assert.equal(
    path5.lifecycle.consumedUses,
    null,
  );

  const path5Audit =
    assertAllowedAudit(
      path5,
    );

  const path6 =
    await executePath(
      "path6-eligible-buyer",
      {
        region:
          "EU",

        ageOver:
          21,
      },
      null,
    );

  assert.equal(
    path6.result.status,
    200,
  );

  assert.equal(
    path6.result.json?.ok,
    true,
  );

  assert.equal(
    path6.result.json?.reason,
    "policy_satisfied",
  );

  assert.equal(
    path6.result.json?.policyStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    path6.result.json?.policyDecision
      ?.policyDecision,
    "allow",
  );

  assert.equal(
    path6.result.json?.phase6
      ?.status,
    "allowed",
  );

  assert.equal(
    path6.result.json?.phase6
      ?.reason,
    "accepted",
  );

  assert.equal(
    path6.result.json?.phase6
      ?.auditPersisted,
    true,
  );

  assert.equal(
    path6.result.json?.phase6
      ?.paymentEligibilityHandoffPresent,
    true,
  );

  assert.equal(
    path6.result.json?.phase5
      ?.currentAuthorizationEstablished,
    true,
  );

  assert.equal(
    path6.result.json?.phase5
      ?.boundedUseConsumed,
    true,
  );

  assert.equal(
    path6.result.json?.phase5
      ?.usageClaimReason,
    "claimed",
  );

  assert.equal(
    path6.result.json?.phase5
      ?.usageClaimCreated,
    true,
  );

  assert.equal(
    path6.result.json?.phase5
      ?.delegationUseCount,
    1,
  );

  assert.equal(
    path6.lifecycle.challengeStatus,
    "POLICY_SATISFIED",
  );

  assert.equal(
    path6.lifecycle.releaseStatus,
    "NOT_RELEASED",
  );

  assert.equal(
    path6.lifecycle.claimCount,
    1,
  );

  assert.equal(
    path6.lifecycle.consumedUses,
    1,
  );

  const path6Audit =
    assertAllowedAudit(
      path6,
    );

  const recordedCrpPaths =
    crpTripwire.requests.map(
      (
        entry,
      ) =>
        `${entry.method} ${entry.path}`,
    );

  const expectedChallengeCrpPaths =
    Array.from(
      {
        length:
          6,
      },
      () => [
        "POST /v1/crp/payments/match",
        "POST /v1/crp/payments/fulfill",
      ],
    ).flat();

  assert.deepEqual(
    recordedCrpPaths,
    expectedChallengeCrpPaths,
    (
      "Demo3 challenge CRP probes must remain canonical "
      + "and redeem authorization must add none; "
      + `recorded=${JSON.stringify(recordedCrpPaths)}`
    ),
  );

  const orchestratorIntentCount =
    orchestratorStub.requests.filter(
      (
        entry,
      ) =>
        entry.method ===
          "POST" &&
        entry.path ===
          "/internal/payments/intents",
    ).length;

  assert.equal(
    orchestratorIntentCount,
    6,
    "six challenges must emit six orchestrator intents",
  );

  const retainedAuditIds = [
    path3Audit.audit_id,
    path4Audit.audit_id,
    path5Audit.audit_id,
    path6Audit.audit_id,
  ];

  assert.equal(
    new Set(
      retainedAuditIds,
    ).size,
    4,
  );

  console.log(
    JSON.stringify(
      {
        ok:
          true,

        label:
          LABEL,

        runId:
          RUN_ID,

        matrixCases:
          6,

        passedCases:
          6,

        gatewayStartCount,

        migrations: {
          lifecycleAppliedByHarness:
            lifecycleMigrationApplied,

          phase6AuditAppliedByHarness:
            phase6AuditMigrationApplied,

          ownerAccountProfileAppliedByHarness:
            phase6OwnerAccountProfileMigrationApplied,

          freshnessSourceProfileAppliedByHarness:
            phase6FreshnessSourceProfileMigrationApplied,

          applicationStartupAutoAppliedMigration:
            false,
        },

        path1InvalidBuyerSignature: {
          rejected:
            true,

          reason:
            path1.result.json?.reason,

          phase6Reached:
            false,

          auditRows:
            path1.auditRows.length,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        path2InvalidAgentProof: {
          rejected:
            true,

          reason:
            path2.result.json?.reason,

          phase6Reached:
            false,

          auditRows:
            path2.auditRows.length,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        path3ActingKeyMismatch: {
          rejected:
            true,

          reason:
            path3.result.json?.reason,

          auditPersisted:
            true,

          auditId:
            path3Audit.audit_id,

          buyerPolicyEvaluated:
            false,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        path4TamperedAgentCard: {
          rejected:
            true,

          reason:
            path4.result.json?.reason,

          auditPersisted:
            true,

          auditId:
            path4Audit.audit_id,

          integrityVerified:
            path4Audit.agent_card_integrity_verified,

          buyerPolicyEvaluated:
            false,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        path5IneligibleBuyer: {
          phase6Allowed:
            true,

          auditPersisted:
            true,

          auditId:
            path5Audit.audit_id,

          policyDecision:
            "deny",

          reason:
            path5.result.json?.reason,

          boundedUseConsumed:
            false,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        path6EligibleBuyer: {
          phase6Allowed:
            true,

          auditPersisted:
            true,

          auditId:
            path6Audit.audit_id,

          policyDecision:
            "allow",

          boundedUseConsumed:
            true,

          useCount:
            path6.lifecycle.consumedUses,

          paymentAttempted:
            false,

          resourceReleased:
            false,
        },

        audit: {
          appendOnly:
            true,

          retainedRowCount:
            retainedAuditIds.length,

          retainedAuditIds,

          rawMaterialPersisted:
            false,

          updateAttempted:
            false,

          deleteAttempted:
            false,

          truncateAttempted:
            false,
        },

        sideEffects: {
          gatewayCalled:
            true,

          controlledRegistryEvidenceUsed:
            true,

          controlledCis8EvidenceUsed:
            true,

          controlledAgentCardEvidenceUsed:
            true,

          crpCalled:
            false,

          paymentAttempted:
            false,

          receiptIssued:
            false,

          paymentResponseEmitted:
            false,

          replayStateMutated:
            false,

          protectedResourceReleased:
            false,

          productionActivation:
            false,
        },

        privateMaterial: {
          temporary:
            true,

          printed:
            false,

          persistedToRepository:
            false,
        },
      },
      null,
      2,
    ),
  );

  console.log();
  console.log(
    "PR304_PATH1_INVALID_BUYER_SIGNATURE_REJECTED=true",
  );

  console.log(
    "PR304_PATH2_INVALID_AGENT_POP_REJECTED=true",
  );

  console.log(
    "PR304_PATH3_AGENT_REGISTRY_KEY_MISMATCH_AUDITED=true",
  );

  console.log(
    "PR304_PATH4_AGENT_CARD_HASH_MISMATCH_AUDITED=true",
  );

  console.log(
    "PR304_PATH5_INELIGIBLE_BUYER_NO_CONSUMPTION=true",
  );

  console.log(
    "PR304_PATH6_ELIGIBLE_BUYER_BOUNDED_USE_CONSUMED=true",
  );

  console.log(
    "PR304_PHASE6_APPEND_ONLY_AUDIT_RETAINED=true",
  );

  console.log(
    "PR304_FINAL_ACCEPTANCE_NO_PAYMENT_OR_RELEASE=true",
  );

  console.log(
    "PR304_PHASE6_FINAL_ACCEPTANCE_COMPLETE=true",
  );
}


installSignalCleanup(
  cleanup,
);


void main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error(
        `[${LABEL}] failed:`,
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await cleanup();

      console.log();
      console.log(
        "PR304_FINAL_ACCEPTANCE_CLEANUP_COMPLETE=true",
      );
    },
  );
