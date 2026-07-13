import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Client } from "pg";

import {
  computeContractId,
  loadContracts,
} from "../src/contracts";
import {
  buildX402ZkpChallenge,
  hashX402ZkpChallenge,
} from "../src/phase3/zkpChallenge";
import { amountToRawUnits } from "../src/proofPayload";
import {
  PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
} from "../src/phase5/agentDelegationVerifier";
import {
  PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
  PHASE5_AGENT_RUNTIME_MAX_USES,
  PHASE5_AGENT_RUNTIME_MODE,
  PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
  evaluatePhase5AgentRuntimeAuthorization,
} from "../src/phase5/agentRuntimeAuthorization";
import {
  assertPhase3HarnessCanonicalChallengeIssued,
  b64decodeJson,
  baseUrlForPort,
  getPhase3HarnessCanonicalChallengeByNonce,
  installSignalCleanup,
  phase3HarnessDatabaseUrl,
  isPortOpen,
  killProcessTree,
  redeemEligiblePolicy,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const LABEL =
  "phase5:agent-runtime-authorization-composition-test";

const DISABLED_PORT = Number(
  process.env
    .PHASE5_AGENT_RUNTIME_COMPOSITION_DISABLED_PORT ||
    3132,
);

const ENABLED_PORT = Number(
  process.env
    .PHASE5_AGENT_RUNTIME_COMPOSITION_ENABLED_PORT ||
    3133,
);

const DISABLED_BASE =
  baseUrlForPort(DISABLED_PORT);

const ENABLED_BASE =
  baseUrlForPort(ENABLED_PORT);

const CRP_TRIPWIRE_PORT = Number(
  process.env
    .PHASE5_AGENT_RUNTIME_COMPOSITION_CRP_PORT ||
    8132,
);

const ORCHESTRATOR_STUB_PORT = Number(
  process.env
    .PHASE5_AGENT_RUNTIME_COMPOSITION_ORCHESTRATOR_PORT ||
    8133,
);

const CRP_TRIPWIRE_BASE =
  baseUrlForPort(CRP_TRIPWIRE_PORT);

const ORCHESTRATOR_STUB_BASE =
  baseUrlForPort(ORCHESTRATOR_STUB_PORT);

const INVALID_PAYMENT_SIGNATURE =
  Buffer.from(
    '{"nonce":',
    "utf8",
  ).toString("base64");

const ENV_KEYS = [
  "PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED",
  "PHASE3_GATEWAY_RELEASE_ENABLED",
  "PHASE3_GATEWAY_TEST_RELEASE_ONLY",
  "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
  "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
  "PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED",
  "CRP_BASE_URL",
  "ORCHESTRATOR_BASE_URL",
  "ORCHESTRATOR_API_KEY",
] as const;

type EnvironmentSnapshot = Record<
  typeof ENV_KEYS[number],
  string | undefined
>;

type AgentEnvelopeOptions = {
  region: string;
  ageOver: number;
  nonce?: string;
  challengeHashOverride?: string;
};

type ControlledCanonicalBindingLookupResult =
  | {
      found: false;
    }
  | {
      found: true;
      challengeId: string;
      nonce: string;
      status: string;
      releaseStatus: string;
      merchantId: string;
      contractId: string;
      contractVersion: string;
      contractSnapshot: unknown;
      network: string;
      asset: unknown;
      amount: string;
      payTo: string;
      issuedAtSec: number;
      expiresAtSec: number;
    };

async function getControlledCanonicalBindingByNonce(
  nonce: string,
): Promise<ControlledCanonicalBindingLookupResult> {
  const client = new Client({
    connectionString:
      phase3HarnessDatabaseUrl(),
  });

  await client.connect();

  try {
    const result =
      await client.query(
        `
        SELECT
          challenge_id,
          nonce,
          status,
          release_status,
          merchant_id,
          contract_id,
          contract_version,
          contract_snapshot,
          network,
          asset,
          amount,
          pay_to,
          EXTRACT(EPOCH FROM issued_at)
            AS issued_at_sec,
          EXTRACT(EPOCH FROM expires_at)
            AS expires_at_sec
        FROM payment_challenges
        WHERE nonce = $1
        LIMIT 1
        `,
        [nonce],
      );

    if (result.rowCount !== 1) {
      return {
        found: false,
      };
    }

    const row = result.rows[0];

    return {
      found: true,
      challengeId:
        String(row.challenge_id),
      nonce:
        String(row.nonce),
      status:
        String(row.status),
      releaseStatus:
        String(row.release_status),
      merchantId:
        String(row.merchant_id),
      contractId:
        String(row.contract_id),
      contractVersion:
        String(row.contract_version),
      contractSnapshot:
        row.contract_snapshot,
      network:
        String(row.network),
      asset:
        row.asset,
      amount:
        String(row.amount),
      payTo:
        String(row.pay_to),
      issuedAtSec:
        Math.trunc(
          Number(row.issued_at_sec),
        ),
      expiresAtSec:
        Math.trunc(
          Number(row.expires_at_sec),
        ),
    };
  } finally {
    await client.end();
  }
}

type RecordedHttpRequest = {
  method: string;
  path: string;
  body: unknown;
  internalApiKey: string | null;
};

type RecordingServer = {
  baseUrl: string;
  requests: RecordedHttpRequest[];
  close: () => Promise<void>;
};

function readRequestBody(
  req: IncomingMessage,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (raw.length === 0) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });

    req.on("error", reject);
  });
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, {
    "content-type": "application/json",
  });

  res.end(JSON.stringify(body));
}

async function startCrpTripwire(
  port: number,
): Promise<RecordingServer> {
  const requests: RecordedHttpRequest[] = [];

  const server = createServer(
    async (req, res) => {
      const requestPath =
        new URL(
          req.url ?? "/",
          "http://127.0.0.1",
        ).pathname;

      requests.push({
        method: req.method ?? "UNKNOWN",
        path: requestPath,
        body: await readRequestBody(req),
        internalApiKey:
          typeof req.headers[
            "x-internal-api-key"
          ] === "string"
            ? req.headers[
                "x-internal-api-key"
              ]
            : null,
      });

      writeJson(res, 500, {
        ok: false,
        reason:
          "unexpected_crp_call_in_phase5_runtime_composition",
      });
    },
  );

  await new Promise<void>(
    (resolve, reject) => {
      server.once("error", reject);

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
      `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>(
        (resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        },
      ),
  };
}

async function startOrchestratorStub(
  port: number,
): Promise<RecordingServer> {
  const requests: RecordedHttpRequest[] = [];

  const server = createServer(
    async (req, res) => {
      const requestPath =
        new URL(
          req.url ?? "/",
          "http://127.0.0.1",
        ).pathname;

      requests.push({
        method: req.method ?? "UNKNOWN",
        path: requestPath,
        body: await readRequestBody(req),
        internalApiKey:
          typeof req.headers[
            "x-internal-api-key"
          ] === "string"
            ? req.headers[
                "x-internal-api-key"
              ]
            : null,
      });

      if (
        req.method === "POST" &&
        requestPath ===
          "/internal/payments/intents"
      ) {
        writeJson(res, 200, {
          ok: true,
          accepted: true,
        });
        return;
      }

      if (
        req.method === "POST" &&
        requestPath ===
          "/internal/payments/proof"
      ) {
        writeJson(res, 200, {
          ok: true,
          accepted: true,
        });
        return;
      }

      if (
        req.method === "POST" &&
        requestPath ===
          "/internal/payments/release-check"
      ) {
        writeJson(res, 200, {
          ok: true,
          ready: false,
          reason:
            "controlled_composition_only",
        });
        return;
      }

      writeJson(res, 404, {
        ok: false,
        reason: "not_found",
      });
    },
  );

  await new Promise<void>(
    (resolve, reject) => {
      server.once("error", reject);

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
      `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>(
        (resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        },
      ),
  };
}

async function waitForRecordedPathCount(
  server: RecordingServer,
  path: string,
  expectedCount: number,
  timeoutMs = 3_000,
): Promise<void> {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const count =
      server.requests.filter(
        (requestEntry) =>
          requestEntry.path === path,
      ).length;

    if (count >= expectedCount) {
      return;
    }

    await sleep(50);
  }

  const finalCount =
    server.requests.filter(
      (requestEntry) =>
        requestEntry.path === path,
    ).length;

  assert.equal(
    finalCount,
    expectedCount,
    `expected ${expectedCount} recorded request(s) for ${path}`,
  );
}

let crpTripwire:
  RecordingServer | null = null;

let orchestratorStub:
  RecordingServer | null = null;

let disabledGateway:
  ChildProcess | null = null;

let enabledGateway:
  ChildProcess | null = null;

function captureEnvironment():
EnvironmentSnapshot {
  const snapshot =
    {} as EnvironmentSnapshot;

  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
  }

  return snapshot;
}

function restoreEnvironment(
  snapshot: EnvironmentSnapshot,
): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function configureControlledEnvironment(
  runtimeEnabled: boolean,
): void {
  process.env
    .PHASE5_AGENT_DELEGATED_RUNTIME_ENABLED =
    runtimeEnabled ? "true" : "false";

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED =
    "false";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY =
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

  // Challenge issuance uses an early malformed-signature return so the
  // Gateway must never enter CRP match or fulfill. The tripwire records any
  // accidental request and makes the final safety report evidence-based.
  process.env.CRP_BASE_URL =
    CRP_TRIPWIRE_BASE;

  // Canonical challenge persistence legitimately emits an orchestrator
  // intent. The local stub records that bounded side effect.
  process.env.ORCHESTRATOR_BASE_URL =
    ORCHESTRATOR_STUB_BASE;

  process.env.ORCHESTRATOR_API_KEY =
    "dev-internal-key";
}

function acceptedProofTypes(pr: any):
readonly string[] {
  const value =
    pr?.policyRequirements
      ?.acceptedProofTypes;

  return Array.isArray(value)
    ? value.map(String)
    : [];
}

function buildAgentEnvelope(
  pr: any,
  options: AgentEnvelopeOptions,
): any {
  const nonce =
    options.nonce ?? pr.nonce;

  const challenge =
    buildX402ZkpChallenge({
      merchantId: pr.merchantId,
      resource: {
        method: pr.resource.method,
        path: pr.resource.path,
      },
      contract: {
        contractId: pr.contractId,
        contractVersion:
          pr.contractVersion,
        isFrozen: pr.isFrozen,
      },
      network: pr.network,
      chain_id: pr.chain_id,
      caip2ChainId: null,
      asset: {
        type: pr.asset.type,
        tokenId: pr.asset.tokenId,
        decimals: pr.asset.decimals,
      },
      amount: pr.amount,
      amountMinor:
        amountToRawUnits(
          pr.amount,
          pr.asset.decimals,
        ),
      payTo: pr.payTo,
      nonce,
      issuedAt: pr.issuedAt,
      expiresAt: pr.expiresAt,
      policy:
        PHASE5_AGENT_RUNTIME_POLICY_REQUIREMENT,
      businessTerms: null,
      buyer: null,
      agent: null,
    });

  const challengeHash =
    options.challengeHashOverride ??
    hashX402ZkpChallenge(challenge);

  return {
    authorizationProofType:
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,

    agent: {
      agentId:
        "agent:local-demo:phase5-runtime-composition",
      agentType:
        "controlled-local-demo-agent",
    },

    buyer: {
      buyerCommitment:
        "sha256:phase5-runtime-buyer-commitment",
      buyerAccount:
        "ccd1qphase5runtimebuyer",
      policySubject:
        "buyer:phase5-runtime-demo",
    },

    delegation: {
      delegationId:
        `delegation-${nonce}`,
      delegationIssuedAt:
        pr.issuedAt - 60,
      delegationExpiresAt:
        pr.expiresAt + 60,
      delegationProofPresent: true,
      delegationProofPrinted: false,
    },

    challenge: {
      nonce,
      challengeHash,
      issuedAt: pr.issuedAt,
      expiresAt: pr.expiresAt,
    },

    scope: {
      merchantId: pr.merchantId,
      resource: {
        method:
          String(pr.resource.method)
            .toUpperCase(),
        path: pr.resource.path,
      },
      contractId: pr.contractId,
      contractVersion:
        pr.contractVersion,
      network: pr.network,
      asset: {
        type: pr.asset.type,
        tokenId: pr.asset.tokenId,
        decimals: pr.asset.decimals,
      },
      amount: pr.amount,
      payTo: pr.payTo,
      allowedAction:
        PHASE5_AGENT_RUNTIME_ALLOWED_ACTION,
      maxUses:
        PHASE5_AGENT_RUNTIME_MAX_USES,
    },

    policyEvidence: {
      proofType:
        "concordium.VerifiablePresentation",
      claims: {
        region: options.region,
        ageOver: options.ageOver,
      },
      rawProofPrinted: false,
    },
  };
}

async function issuePaidGatedChallengeWithoutCrp(
  base: string,
): Promise<any> {
  const response =
    await request(
      base,
      "/paid-gated",
      {
        headers: {
          "PAYMENT-SIGNATURE":
            INVALID_PAYMENT_SIGNATURE,
        },
      },
    );

  assert.equal(
    response.status,
    402,
    "malformed-signature GET /paid-gated should issue 402",
  );

  assert.equal(
    response.json?.error,
    "Invalid payment signature header",
  );

  assert.equal(
    response.headers.get(
      "payment-response",
    ),
    null,
    "initial controlled 402 must not emit PAYMENT-RESPONSE",
  );

  const paymentRequiredB64 =
    response.headers.get(
      "payment-required",
    );

  assert.ok(
    paymentRequiredB64,
    "PAYMENT-REQUIRED header must be present",
  );

  const paymentRequired =
    b64decodeJson(
      paymentRequiredB64,
    );

  assert.equal(
    paymentRequired.resource?.path,
    "/paid-gated",
  );

  assert.equal(
    paymentRequired
      .policyRequirements?.required,
    true,
  );

  assert.ok(
    paymentRequired.nonce,
    "PAYMENT-REQUIRED must include nonce",
  );

  await assertPhase3HarnessCanonicalChallengeIssued(
    paymentRequired,
  );

  return paymentRequired;
}

async function assertStillNoReleaseWithoutCrp(
  base: string,
  nonce: string,
  message: string,
): Promise<void> {
  const response =
    await request(
      base,
      `/paid-gated?nonce=${encodeURIComponent(nonce)}`,
      {
        headers: {
          "PAYMENT-SIGNATURE":
            INVALID_PAYMENT_SIGNATURE,
        },
      },
    );

  assert.equal(
    response.status,
    402,
    message,
  );

  assert.ok(
    response.headers.get(
      "payment-required",
    ),
    "resource must still emit PAYMENT-REQUIRED",
  );

  assert.equal(
    response.headers.get(
      "payment-response",
    ),
    null,
    "unsettled resource must not emit PAYMENT-RESPONSE",
  );

  assert.notEqual(
    response.json?.resource,
    "secret-data",
    "unsettled resource must not be released",
  );
}

async function redeemAgent(
  base: string,
  nonce: string,
  authorizationProof: any,
) {
  return request(
    base,
    "/paid-gated/redeem",
    {
      method: "POST",
      headers: {
        "content-type":
          "application/json",
      },
      body: JSON.stringify({
        nonce,
        authorizationProof,
      }),
    },
  );
}

async function waitForCanonicalStatus(
  nonce: string,
  expectedStatus: string,
  timeoutMs = 3_000,
) {
  const deadline =
    Date.now() + timeoutMs;

  let canonical =
    await getPhase3HarnessCanonicalChallengeByNonce(
      nonce,
    );

  while (
    Date.now() < deadline &&
    (
      !canonical.found ||
      canonical.status !==
        expectedStatus
    )
  ) {
    await sleep(100);

    canonical =
      await getPhase3HarnessCanonicalChallengeByNonce(
        nonce,
      );
  }

  assert.equal(
    canonical.found,
    true,
    `canonical challenge ${nonce} should exist`,
  );

  assert.equal(
    canonical.status,
    expectedStatus,
    `canonical challenge ${nonce} should reach ${expectedStatus}`,
  );

  return canonical;
}

function assertNoPaymentResponse(
  result: Awaited<
    ReturnType<typeof request>
  >,
  message: string,
): void {
  assert.equal(
    result.headers.get(
      "payment-response",
    ),
    null,
    message,
  );
}

async function runDisabledRuntimeCase():
Promise<{
  nonce: string;
  status: string;
}> {
  configureControlledEnvironment(false);

  disabledGateway =
    startGateway({
      port: DISABLED_PORT,
      label: `${LABEL}:disabled`,
    });

  const health =
    await waitForReady(DISABLED_BASE);

  assert.equal(
    health.phase5
      ?.agentDelegatedRuntimeEnabled,
    false,
  );

  assert.equal(
    health.phase5?.productionActivation,
    false,
  );

  const pr =
    await issuePaidGatedChallengeWithoutCrp(
      DISABLED_BASE,
    );

  await assertPhase3HarnessCanonicalChallengeIssued(
    pr,
  );

  assert.equal(
    acceptedProofTypes(pr).includes(
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
    ),
    false,
    "disabled runtime must not advertise the Phase 5 authorization type",
  );

  const envelope =
    buildAgentEnvelope(pr, {
      region: "EU",
      ageOver: 21,
    });

  const redeem =
    await redeemAgent(
      DISABLED_BASE,
      pr.nonce,
      envelope,
    );

  assert.equal(redeem.status, 403);
  assert.equal(redeem.json?.ok, false);
  assert.equal(
    redeem.json?.reason,
    "phase5_agent_delegated_runtime_disabled",
  );
  assert.equal(
    redeem.json?.policyStatus,
    "POLICY_NOT_EVALUATED",
  );
  assert.equal(
    redeem.json?.phase5
      ?.policyStateMutated,
    false,
  );

  assertNoPaymentResponse(
    redeem,
    "disabled Phase 5 runtime must not emit PAYMENT-RESPONSE",
  );

  const canonical =
    await waitForCanonicalStatus(
      pr.nonce,
      "ISSUED",
    );

  assert.equal(
    canonical.releaseStatus,
    "NOT_RELEASED",
  );

  await killProcessTree(
    disabledGateway,
  );
  disabledGateway = null;

  await waitForPortClosed(
    DISABLED_PORT,
  );

  return {
    nonce: pr.nonce,
    status: String(canonical.status),
  };
}

async function runEnabledRuntimeCases():
Promise<{
  missingCanonicalRejected: boolean;
  unsupportedPolicyGuarded: boolean;
  badBindingStatus: string;
  deniedStatus: string;
  allowedStatus: string;
  legacyDirectBuyerAvailable: boolean;
}> {
  configureControlledEnvironment(true);

  enabledGateway =
    startGateway({
      port: ENABLED_PORT,
      label: `${LABEL}:enabled`,
    });

  const health =
    await waitForReady(ENABLED_BASE);

  assert.equal(
    health.phase5
      ?.agentDelegatedRuntimeEnabled,
    true,
  );

  assert.equal(
    health.phase5?.mode,
    PHASE5_AGENT_RUNTIME_MODE,
  );

  assert.equal(
    health.phase5
      ?.cryptographicDelegationVerification,
    false,
  );

  assert.equal(
    health.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );

  assert.equal(
    health.phase5?.productionActivation,
    false,
  );

  // -----------------------------------------------------------------------
  // Advertised capability + bad challenge binding.
  // -----------------------------------------------------------------------

  const badBindingPr =
    await issuePaidGatedChallengeWithoutCrp(
      ENABLED_BASE,
    );

  await assertPhase3HarnessCanonicalChallengeIssued(
    badBindingPr,
  );

  assert.equal(
    acceptedProofTypes(
      badBindingPr,
    ).includes(
      PHASE5_AGENT_DELEGATED_AUTHORIZATION_PROOF_TYPE,
    ),
    true,
    "enabled runtime must advertise the canonical Phase 5 authorization type",
  );

  // -----------------------------------------------------------------------
  // A coherent rehashed contract with unsupported policy semantics must fail
  // before policy evaluation and without requesting canonical persistence.
  // -----------------------------------------------------------------------

  const canonicalForPolicyGuard =
    await getControlledCanonicalBindingByNonce(
      badBindingPr.nonce,
    );

  assert.equal(
    canonicalForPolicyGuard.found,
    true,
    "policy guard requires the canonical issued challenge",
  );

  if (!canonicalForPolicyGuard.found) {
    throw new Error(
      "canonical challenge unexpectedly missing for policy guard",
    );
  }

  const loadedContract =
    loadContracts().contracts.find(
      (contract) =>
        contract.resource.method
          .toUpperCase() === "GET" &&
        contract.resource.path ===
          "/paid-gated",
    );

  assert.ok(
    loadedContract,
    "GET /paid-gated contract must be loaded",
  );

  if (!loadedContract) {
    throw new Error(
      "GET /paid-gated contract was not loaded",
    );
  }

  const unsupportedPolicy = {
    kind: "composite" as const,
    version: "v1" as const,
    rules: [
      {
        kind:
          "age_min_by_region" as const,
        regionSource:
          "policy_evidence" as const,
        thresholds: {
          EU: 17,
          US: 21,
        },
        defaultDecision:
          "deny" as const,
      },
    ],
    ext: loadedContract.policy?.ext,
  };

  const unsupportedContractDraft = {
    ...loadedContract,
    contractId:
      "cid_policy_guard_placeholder",
    policyRequired: true,
    policyVersion: "v1" as const,
    policy: unsupportedPolicy,
  };

  const unsupportedContractId =
    computeContractId(
      unsupportedContractDraft,
    );

  const unsupportedContract = {
    ...unsupportedContractDraft,
    contractId:
      unsupportedContractId,
  };

  const originalSnapshot =
    canonicalForPolicyGuard
      .contractSnapshot;

  const unsupportedCanonical = {
    ...canonicalForPolicyGuard,
    contractId:
      unsupportedContractId,
    contractSnapshot: {
      ...(
        originalSnapshot &&
        typeof originalSnapshot ===
          "object" &&
        !Array.isArray(
          originalSnapshot,
        )
          ? originalSnapshot
          : {}
      ),
      contractId:
        unsupportedContractId,
    },
  };

  const unsupportedPolicyResult =
    evaluatePhase5AgentRuntimeAuthorization({
      nonce: badBindingPr.nonce,
      envelope:
        buildAgentEnvelope(
          badBindingPr,
          {
            region: "EU",
            ageOver: 21,
          },
        ),
      nowSec:
        badBindingPr.issuedAt + 1,
      canonical:
        unsupportedCanonical,
      contract:
        unsupportedContract,
    });

  assert.equal(
    unsupportedPolicyResult.ok,
    false,
  );

  assert.equal(
    unsupportedPolicyResult.reason,
    "unsupported_contract_policy",
  );

  assert.equal(
    unsupportedPolicyResult.httpStatus,
    409,
  );

  assert.equal(
    unsupportedPolicyResult.policyStatus,
    "POLICY_NOT_EVALUATED",
  );

  assert.equal(
    unsupportedPolicyResult
      .shouldPersistPolicyOutcome,
    null,
  );

  assert.equal(
    unsupportedPolicyResult.policyEvaluated,
    false,
  );

  assert.equal(
    unsupportedPolicyResult
      .canonicalMismatchFields
      .includes(
        "contract.policy.rules[0].thresholds.EU",
      ),
    true,
  );

  // -----------------------------------------------------------------------
  // Missing canonical nonce must fail before evaluation and without mutation.
  // -----------------------------------------------------------------------

  const missingNonce =
    `phase5-missing-${randomUUID()}`;

  const missingEnvelope =
    buildAgentEnvelope(
      badBindingPr,
      {
        region: "EU",
        ageOver: 21,
        nonce: missingNonce,
      },
    );

  const missingRedeem =
    await redeemAgent(
      ENABLED_BASE,
      missingNonce,
      missingEnvelope,
    );

  assert.equal(
    missingRedeem.status,
    409,
  );
  assert.equal(
    missingRedeem.json?.reason,
    "phase5_canonical_challenge_not_found",
  );
  assert.equal(
    missingRedeem.json?.policyStatus,
    "POLICY_NOT_EVALUATED",
  );
  assert.equal(
    missingRedeem.json?.phase5
      ?.policyStateMutated,
    false,
  );

  assertNoPaymentResponse(
    missingRedeem,
    "missing canonical challenge must not emit PAYMENT-RESPONSE",
  );

  const missingCanonical =
    await getPhase3HarnessCanonicalChallengeByNonce(
      missingNonce,
    );

  assert.equal(
    missingCanonical.found,
    false,
  );

  // -----------------------------------------------------------------------
  // Incorrect challenge hash must persist POLICY_FAILED.
  // -----------------------------------------------------------------------

  const badBindingEnvelope =
    buildAgentEnvelope(
      badBindingPr,
      {
        region: "EU",
        ageOver: 21,
        challengeHashOverride:
          "f".repeat(64),
      },
    );

  const badBindingRedeem =
    await redeemAgent(
      ENABLED_BASE,
      badBindingPr.nonce,
      badBindingEnvelope,
    );

  assert.equal(
    badBindingRedeem.status,
    409,
  );
  assert.equal(
    badBindingRedeem.json?.reason,
    "authorization_binding_rejected",
  );
  assert.equal(
    badBindingRedeem.json?.verifier
      ?.authorizationReason,
    "challenge_binding_mismatch",
  );
  assert.equal(
    badBindingRedeem.json?.policyStatus,
    "POLICY_FAILED",
  );
  assert.equal(
    badBindingRedeem.json?.phase5
      ?.policyStateMutated,
    true,
  );

  assertNoPaymentResponse(
    badBindingRedeem,
    "binding rejection must not emit PAYMENT-RESPONSE",
  );

  const badBindingCanonical =
    await waitForCanonicalStatus(
      badBindingPr.nonce,
      "POLICY_FAILED",
    );

  assert.equal(
    badBindingCanonical.releaseStatus,
    "NOT_RELEASED",
  );

  // -----------------------------------------------------------------------
  // Valid delegation + denied buyer policy must stop before payment.
  // -----------------------------------------------------------------------

  const deniedPr =
    await issuePaidGatedChallengeWithoutCrp(
      ENABLED_BASE,
    );

  const deniedEnvelope =
    buildAgentEnvelope(
      deniedPr,
      {
        region: "US",
        ageOver: 18,
      },
    );

  const deniedRedeem =
    await redeemAgent(
      ENABLED_BASE,
      deniedPr.nonce,
      deniedEnvelope,
    );

  assert.equal(
    deniedRedeem.status,
    403,
  );
  assert.equal(
    deniedRedeem.json?.reason,
    "age_requirement_not_met",
  );
  assert.equal(
    deniedRedeem.json?.verifier
      ?.authorizationAccepted,
    true,
  );
  assert.equal(
    deniedRedeem.json?.policyDecision
      ?.policyDecision,
    "deny",
  );
  assert.equal(
    deniedRedeem.json?.policyStatus,
    "POLICY_FAILED",
  );
  assert.equal(
    deniedRedeem.json?.phase5
      ?.policyStateMutated,
    true,
  );

  assertNoPaymentResponse(
    deniedRedeem,
    "denied buyer policy must not emit PAYMENT-RESPONSE",
  );

  const deniedCanonical =
    await waitForCanonicalStatus(
      deniedPr.nonce,
      "POLICY_FAILED",
    );

  assert.equal(
    deniedCanonical.releaseStatus,
    "NOT_RELEASED",
  );

  // -----------------------------------------------------------------------
  // Valid delegation + eligible buyer must persist POLICY_SATISFIED.
  // -----------------------------------------------------------------------

  const allowedPr =
    await issuePaidGatedChallengeWithoutCrp(
      ENABLED_BASE,
    );

  const allowedEnvelope =
    buildAgentEnvelope(
      allowedPr,
      {
        region: "EU",
        ageOver: 21,
      },
    );

  const allowedRedeem =
    await redeemAgent(
      ENABLED_BASE,
      allowedPr.nonce,
      allowedEnvelope,
    );

  assert.equal(
    allowedRedeem.status,
    200,
  );
  assert.equal(
    allowedRedeem.json?.ok,
    true,
  );
  assert.equal(
    allowedRedeem.json?.reason,
    "policy_satisfied",
  );
  assert.equal(
    allowedRedeem.json?.policyStatus,
    "POLICY_SATISFIED",
  );
  assert.equal(
    allowedRedeem.json?.policyDecision
      ?.policyDecision,
    "allow",
  );
  assert.equal(
    allowedRedeem.json?.phase5
      ?.policyStateMutated,
    true,
  );
  assert.equal(
    allowedRedeem.json?.phase5
      ?.cryptographicDelegationVerification,
    false,
  );
  assert.equal(
    allowedRedeem.json?.phase5
      ?.agentRegistryLookupAttempted,
    false,
  );
  assert.equal(
    allowedRedeem.json?.phase5
      ?.productionActivation,
    false,
  );

  assertNoPaymentResponse(
    allowedRedeem,
    "Phase 5 policy satisfaction alone must not emit PAYMENT-RESPONSE",
  );

  const allowedCanonical =
    await waitForCanonicalStatus(
      allowedPr.nonce,
      "POLICY_SATISFIED",
    );

  assert.equal(
    allowedCanonical.releaseStatus,
    "NOT_RELEASED",
  );

  await assertStillNoReleaseWithoutCrp(
    ENABLED_BASE,
    allowedPr.nonce,
    "Phase 5 policy satisfaction must not release the resource without settlement",
  );

  // -----------------------------------------------------------------------
  // Existing Direct Buyer dispatch remains available with Phase 5 enabled.
  // -----------------------------------------------------------------------

  const directBuyerPr =
    await issuePaidGatedChallengeWithoutCrp(
      ENABLED_BASE,
    );

  const directBuyerRedeem =
    await redeemEligiblePolicy(
      ENABLED_BASE,
      directBuyerPr,
    );

  assert.equal(
    directBuyerRedeem.status,
    200,
    `existing Direct Buyer redeem should remain available: ${directBuyerRedeem.text}`,
  );
  assert.equal(
    directBuyerRedeem.json?.policyStatus,
    "POLICY_SATISFIED",
  );
  assert.equal(
    directBuyerRedeem.json?.verifier?.type,
    "concordium_zkp_authorization_v1",
  );

  assertNoPaymentResponse(
    directBuyerRedeem,
    "Direct Buyer policy redeem must still not emit PAYMENT-RESPONSE",
  );

  await waitForCanonicalStatus(
    directBuyerPr.nonce,
    "POLICY_SATISFIED",
  );

  return {
    missingCanonicalRejected:
      missingRedeem.json?.reason ===
      "phase5_canonical_challenge_not_found",
    unsupportedPolicyGuarded:
      unsupportedPolicyResult.reason ===
      "unsupported_contract_policy" &&
      unsupportedPolicyResult
        .shouldPersistPolicyOutcome ===
        null,
    badBindingStatus:
      String(badBindingCanonical.status),
    deniedStatus:
      String(deniedCanonical.status),
    allowedStatus:
      String(allowedCanonical.status),
    legacyDirectBuyerAvailable:
      directBuyerRedeem.status === 200,
  };
}

async function main(): Promise<void> {
  console.log(
    `[${LABEL}] disabled=${DISABLED_BASE} enabled=${ENABLED_BASE}`,
  );

  if (await isPortOpen(DISABLED_PORT)) {
    throw new Error(
      `port ${DISABLED_PORT} is already open`,
    );
  }

  if (await isPortOpen(ENABLED_PORT)) {
    throw new Error(
      `port ${ENABLED_PORT} is already open`,
    );
  }

  if (
    await isPortOpen(
      CRP_TRIPWIRE_PORT,
    )
  ) {
    throw new Error(
      `CRP tripwire port ${CRP_TRIPWIRE_PORT} is already open`,
    );
  }

  if (
    await isPortOpen(
      ORCHESTRATOR_STUB_PORT,
    )
  ) {
    throw new Error(
      `orchestrator stub port ${ORCHESTRATOR_STUB_PORT} is already open`,
    );
  }

  crpTripwire =
    await startCrpTripwire(
      CRP_TRIPWIRE_PORT,
    );

  orchestratorStub =
    await startOrchestratorStub(
      ORCHESTRATOR_STUB_PORT,
    );

  const environment =
    captureEnvironment();

  const cleanup = async () => {
    await killProcessTree(
      disabledGateway,
    );
    await killProcessTree(
      enabledGateway,
    );

    await waitForPortClosed(
      DISABLED_PORT,
    );
    await waitForPortClosed(
      ENABLED_PORT,
    );

    if (crpTripwire) {
      await crpTripwire.close();
      crpTripwire = null;
    }

    if (orchestratorStub) {
      await orchestratorStub.close();
      orchestratorStub = null;
    }

    await waitForPortClosed(
      CRP_TRIPWIRE_PORT,
    );

    await waitForPortClosed(
      ORCHESTRATOR_STUB_PORT,
    );

    restoreEnvironment(
      environment,
    );
  };

  installSignalCleanup(cleanup);

  try {
    const disabled =
      await runDisabledRuntimeCase();

    const enabled =
      await runEnabledRuntimeCases();

    assert.ok(
      crpTripwire,
      "CRP tripwire must be running during assertions",
    );

    assert.ok(
      orchestratorStub,
      "orchestrator stub must be running during assertions",
    );

    const expectedIntentCalls = 6;

    await waitForRecordedPathCount(
      orchestratorStub,
      "/internal/payments/intents",
      expectedIntentCalls,
    );

    const crpRequests =
      [...crpTripwire.requests];

    const orchestratorIntentRequests =
      orchestratorStub.requests.filter(
        (requestEntry) =>
          requestEntry.path ===
          "/internal/payments/intents",
      );

    const orchestratorProofRequests =
      orchestratorStub.requests.filter(
        (requestEntry) =>
          requestEntry.path ===
          "/internal/payments/proof",
      );

    const orchestratorReleaseCheckRequests =
      orchestratorStub.requests.filter(
        (requestEntry) =>
          requestEntry.path ===
          "/internal/payments/release-check",
      );

    assert.equal(
      crpRequests.length,
      0,
      "controlled Phase 5 runtime composition must not call CRP",
    );

    assert.equal(
      orchestratorIntentRequests.length,
      expectedIntentCalls,
      "each controlled challenge issuance should emit one orchestrator intent",
    );

    assert.equal(
      orchestratorStub.requests.length,
      expectedIntentCalls,
      "orchestrator must receive only the expected intent calls",
    );

    assert.equal(
      orchestratorProofRequests.length,
      0,
      "composition harness must not submit payment proof to orchestrator",
    );

    assert.equal(
      orchestratorReleaseCheckRequests.length,
      0,
      "composition harness must not request orchestrator release checks",
    );

    for (
      const requestEntry
      of orchestratorIntentRequests
    ) {
      assert.equal(
        requestEntry.method,
        "POST",
      );

      assert.equal(
        requestEntry.internalApiKey,
        "dev-internal-key",
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          label: LABEL,
          contract:
            "phase5.agentRuntimeAuthorizationComposition.v1",
          mode:
            PHASE5_AGENT_RUNTIME_MODE,
          gatewayCalled: true,
          canonicalPersistenceObserved:
            true,
          crpCalled:
            crpRequests.length > 0,
          crpRequestCount:
            crpRequests.length,
          crpMatchCalled:
            crpRequests.some(
              (requestEntry) =>
                requestEntry.path ===
                "/v1/crp/payments/match",
            ),
          crpFulfillCalled:
            crpRequests.some(
              (requestEntry) =>
                requestEntry.path ===
                "/v1/crp/payments/fulfill",
            ),
          orchestratorCalled:
            orchestratorStub.requests.length > 0,
          orchestratorIntentCalls:
            orchestratorIntentRequests.length,
          orchestratorProofCalls:
            orchestratorProofRequests.length,
          orchestratorReleaseCheckCalls:
            orchestratorReleaseCheckRequests.length,
          paymentAttempted: false,
          receiptJwsPresent: false,
          receiptJwsPrinted: false,
          paymentResponseEmitted: false,
          protectedResourceReleased:
            false,
          replayTouched: false,
          cryptographicDelegationVerification:
            false,
          agentRegistryLookupAttempted:
            false,
          productionActivation: false,
          disabled,
          enabled,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(
    `[${LABEL}] failed`,
    error,
  );
  process.exitCode = 1;
});
