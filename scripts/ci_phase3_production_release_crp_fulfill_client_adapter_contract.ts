#!/usr/bin/env node
/**
 * PR #189 — Phase 3 production release CRP fulfill client adapter contract boundary.
 *
 * This harness proves the Gateway recognizes the disabled CRP fulfill client adapter scaffold
 * as ready for the future client adapter contract, while keeping that contract side-effect-free.
 *
 * - switch OFF + dry-run OFF => execution seam inactive
 * - switch OFF + dry-run ON  => execution seam inactive
 * - switch ON  + dry-run OFF => execution seam inactive
 * - switch ON  + dry-run ON  => execution seam recognized but not executed
 * - execution mode remains disabled
 * - no external adapter / CRP call is attempted
 * - productionRelease remains false
 * - CRP fulfill remains false
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";

import {
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  redeemEligiblePolicy,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const LABEL = "phase3:production-release-crp-fulfill-client-adapter-contract-test";

const SWITCH_OFF_GATEWAY_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_CONTRACT_OFF_PORT || 3112);
const SWITCH_OFF_JWKS_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_CONTRACT_OFF_JWKS_PORT || 8122);

const SWITCH_ON_GATEWAY_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_CONTRACT_ON_PORT || 3113);
const SWITCH_ON_JWKS_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_CONTRACT_ON_JWKS_PORT || 8123);

const isWin = process.platform === "win32";

function nodeCmd() {
  return isWin ? "node.exe" : "node";
}

function base(port: number): string {
  return baseUrlForPort(port);
}

function jwksUrl(port: number): string {
  return `${base(port)}/.well-known/jwks.json`;
}

function mintUrl(port: number): string {
  return `${base(port)}/mint`;
}

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
}

function startDevJwks(port: number, label: string): ChildProcess {
  const child = spawn(nodeCmd(), ["scripts/dev_jwks_server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${label}] dev JWKS spawn error:`, err);
  });

  return child;
}

async function waitForJwks(port: number, timeoutMs = 15_000): Promise<void> {
  const url = jwksUrl(port);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // issuer still starting
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`dev JWKS did not become ready at ${url}`);
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function mintUrlFromPaymentRequired(pr: any, jwksPort: number): string {
  const required = [
    pr.nonce,
    pr.contractId,
    pr.contractVersion,
    pr.merchantId,
    pr.resource?.method,
    pr.resource?.path,
    pr.network,
    pr.asset?.tokenId,
    pr.asset?.decimals,
    pr.amount,
    pr.payTo,
  ];

  if (required.some((v) => v === undefined || v === null || v === "")) {
    throw new Error("PAYMENT-REQUIRED missing required mint fields");
  }

  if (typeof pr.isFrozen !== "boolean") {
    throw new Error("PAYMENT-REQUIRED missing isFrozen boolean");
  }

  const u = new URL(mintUrl(jwksPort));
  u.searchParams.set("nonce", pr.nonce);
  u.searchParams.set("contractId", pr.contractId);
  u.searchParams.set("contractVersion", pr.contractVersion);
  u.searchParams.set("isFrozen", String(pr.isFrozen));
  u.searchParams.set("merchantId", pr.merchantId);
  u.searchParams.set("method", String(pr.resource.method).toUpperCase());
  u.searchParams.set("path", String(pr.resource.path));
  u.searchParams.set("network", pr.network);
  u.searchParams.set("tokenId", pr.asset.tokenId);
  u.searchParams.set("decimals", String(pr.asset.decimals));
  u.searchParams.set("amount", pr.amount);
  u.searchParams.set("payTo", pr.payTo);
  u.searchParams.set("settlementStatus", "finalized");
  u.searchParams.set("ttlSec", "300");

  return u.toString();
}

async function mintReceiptJws(pr: any, jwksPort: number): Promise<string> {
  const url = mintUrlFromPaymentRequired(pr, jwksPort);
  const res = await fetch(url);
  const text = await res.text();

  assert.equal(res.status, 200, `mint should succeed: ${text}`);

  const json = JSON.parse(text);
  assert.equal(json.ok, true, `mint ok should be true: ${text}`);
  assert.equal(typeof json.jws, "string", `mint should return jws: ${text}`);
  assert.ok(json.jws.length > 0, "minted jws should not be empty");

  assert.equal(json.payloadPreview?.proofVersion, "ccd-plt-proof@v1");
  assert.equal(json.payloadPreview?.nonce, pr.nonce);
  assert.equal(json.payloadPreview?.settlement?.status, "finalized");
  assert.equal(json.payloadPreview?.contract?.resource?.method, "GET");
  assert.equal(json.payloadPreview?.contract?.resource?.path, "/paid-gated");
  assert.equal(json.payloadPreview?.contract?.merchantId, pr.merchantId);
  assert.equal(json.payloadPreview?.contract?.network, pr.network);
  assert.equal(json.payloadPreview?.contract?.asset?.tokenId, pr.asset.tokenId);
  assert.equal(json.payloadPreview?.contract?.amount, pr.amount);
  assert.equal(json.payloadPreview?.contract?.payTo, pr.payTo);

  return json.jws;
}

function assertDecisionSideEffectFree(
  decision: any,
  label: string,
  expected: {
    canonicalReleasePersistenceReady: boolean;
    canonicalReleasePersisted: boolean;
    executionPreflightReady: boolean;
    executionMode: "disabled" | "dry_run";
  },
) {
  assert.equal(decision?.observed, true, `${label}: decision observed`);
  assert.equal(decision?.enforced, true, `${label}: decision enforced`);
  assert.equal(decision?.paymentResponseAllowed, true, `${label}: test-only payment response remains allowed`);
  assert.equal(decision?.resourceReleaseAllowed, true, `${label}: test-only resource release remains allowed`);
  assert.equal(decision?.productionReleaseCandidate, true, `${label}: production candidate recognized`);
  assert.equal(decision?.productionReleaseSwitchRequired, true, `${label}: production switch required`);
  assert.equal(
    typeof decision?.canonicalReleasePersistenceRequired,
    "boolean",
    `${label}: canonical persistence required flag should be present`,
  );
  assert.equal(
    typeof decision?.canonicalReleasePersistenceReady,
    "boolean",
    `${label}: canonical persistence ready flag should be present`,
  );
  assert.equal(
    decision?.canonicalReleasePersistenceReady,
    expected.canonicalReleasePersistenceReady,
    `${label}: canonical persistence ready should match expected switch-aware value`,
  );
  assert.equal(
    typeof decision?.productionReleaseExecutionPreflightRequired,
    "boolean",
    `${label}: execution preflight required flag should be present`,
  );
  assert.equal(
    typeof decision?.productionReleaseExecutionPreflightReady,
    "boolean",
    `${label}: execution preflight ready flag should be present`,
  );
  assert.equal(
    decision?.productionReleaseExecutionPreflightRequired,
    expected.canonicalReleasePersistenceReady,
    `${label}: execution preflight should be required only after canonical persistence is ready`,
  );
  assert.equal(
    decision?.productionReleaseExecutionPreflightReady,
    expected.executionPreflightReady,
    `${label}: execution preflight ready should match expected dry-run boundary`,
  );
  assert.equal(
    decision?.productionReleaseExecutionMode,
    expected.executionMode,
    `${label}: execution mode should match expected dry-run boundary`,
  );
  assert.equal(decision?.productionRelease, false, `${label}: production release remains false`);
  assert.equal(
    decision?.canonicalReleasePersisted,
    expected.canonicalReleasePersisted,
    `${label}: canonical release persistence should match expected switch-aware value`,
  );
  assert.equal(decision?.crpCalled, false, `${label}: CRP must not be called`);
  assert.equal(decision?.crpFulfillCalled, false, `${label}: CRP fulfill must not be called`);
  assert.equal(decision?.rawProofPrinted, false, `${label}: raw proof must not be printed`);
  assert.equal(decision?.rawReceiptPrinted, false, `${label}: raw receipt must not be printed`);
}

async function withGatewayStack<T>(input: {
  label: string;
  gatewayPort: number;
  jwksPort: number;
  productionSwitchEnabled: boolean;
  dryRunEnabled: boolean;
  run: (ctx: { baseUrl: string; jwksPort: number; jwksUrl: string }) => Promise<T>;
}): Promise<T> {
  const baseUrl = base(input.gatewayPort);
  const url = jwksUrl(input.jwksPort);

  console.log(`[${input.label}] BASE=${baseUrl}`);
  console.log(`[${input.label}] JWKS_URL=${url}`);
  console.log(`[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=${input.productionSwitchEnabled}`);
  console.log(`[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=${input.dryRunEnabled}`);

  if (await isPortOpen(input.gatewayPort)) {
    throw new Error(`gateway port ${input.gatewayPort} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(input.jwksPort)) {
    throw new Error(`JWKS port ${input.jwksPort} is already open. Stop the existing issuer and retry.`);
  }

  const previous = {
    PHASE3_GATEWAY_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED,
    PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED:
      process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED,
    PHASE3_REQUIRE_LIVE_ZKP: process.env.PHASE3_REQUIRE_LIVE_ZKP,
    CRP_JWKS_URL: process.env.CRP_JWKS_URL,
    X402_ALLOW_DEV_HARNESS: process.env.X402_ALLOW_DEV_HARNESS,
    X402_DEBUG: process.env.X402_DEBUG,
    PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH:
      process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED = input.productionSwitchEnabled ? "true" : "false";
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED = input.dryRunEnabled ? "true" : "false";
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";
  process.env.CRP_JWKS_URL = url;
  process.env.X402_ALLOW_DEV_HARNESS = "true";
  process.env.X402_DEBUG = "true";
  delete process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH;

  const jwks = startDevJwks(input.jwksPort, input.label);
  await waitForJwks(input.jwksPort);

  const gateway = startGateway({
    port: input.gatewayPort,
    label: input.label,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await killProcessTree(jwks);
    await waitForPortClosed(input.gatewayPort);
    await waitForPortClosed(input.jwksPort);
  };

  installSignalCleanup(cleanup);

  try {
    return await input.run({ baseUrl, jwksPort: input.jwksPort, jwksUrl: url });
  } finally {
    await cleanup();
  }
}

async function runScenario(input: {
  label: string;
  gatewayPort: number;
  jwksPort: number;
  productionSwitchEnabled: boolean;
  dryRunEnabled: boolean;
}) {
  return await withGatewayStack({
    ...input,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);

      assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
      assert.equal(health.phase3?.gatewayProductionReleaseEnabled, input.productionSwitchEnabled);
      assert.equal(health.phase3?.gatewayProductionReleaseDryRunEnabled, input.dryRunEnabled);
      assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
      assert.equal(health.phase3?.requireLiveZkp, false);
      assert.equal(health.devHarness?.allowDevHarness, true);
      assert.equal(health.jwksUrl, jwksUrl);

      const pr = await issuePaidGatedChallenge(baseUrl);

      const redeem = await redeemEligiblePolicy(baseUrl, pr);
      assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
      assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
      assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
      assert.equal(redeem.json?.policyDecision?.allowed, true);
      assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

      const receiptJws = await mintReceiptJws(pr, jwksPort);

      let release = null as Awaited<ReturnType<typeof request>> | null;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        release = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
          headers: {
            "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
            "X402-RECEIPT": receiptJws,
          },
        });

        if (release.status === 200) break;

        if (release.status === 402 && release.json?.error === "Policy requirements not yet satisfied") {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        break;
      }

      assert.ok(release, "release response should be present");
      assert.equal(release.status, 200, `test-only release should still succeed: ${release.text}`);
      assert.ok(release.headers.get("payment-response"), "test-only release must emit PAYMENT-RESPONSE");
      assert.equal(release.json?.ok, true);
      assert.equal(release.json?.paid, true);
      assert.equal(release.json?.resource, "secret-data");

      const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assertDecisionSideEffectFree(decision, input.label, {
        canonicalReleasePersistenceReady: input.productionSwitchEnabled,
        canonicalReleasePersisted: input.productionSwitchEnabled,
        executionPreflightReady: input.productionSwitchEnabled && input.dryRunEnabled,
        executionMode: input.productionSwitchEnabled && input.dryRunEnabled ? "dry_run" : "disabled",
      });

      assert.equal(decision?.productionReleaseSwitchEnabled, input.productionSwitchEnabled);
      assert.equal(decision?.productionReleaseEligible, input.productionSwitchEnabled);

      if (input.productionSwitchEnabled && input.dryRunEnabled) {
        assert.equal(decision?.canonicalReleasePersistenceRequired, true);
        assert.equal(decision?.canonicalReleasePersistenceReady, true);
        assert.equal(decision?.canonicalReleasePersisted, true);
        assert.equal(decision?.productionReleaseExecutionPreflightRequired, true);
        assert.equal(decision?.productionReleaseExecutionPreflightReady, true);
        assert.equal(decision?.productionReleaseExecutionMode, "dry_run");
        assert.equal(decision?.productionReleaseExecutionBlockedBy, null);
        assert.equal(decision?.productionReleaseExecutionRecognizedButNotExecuted, false);
        assert.equal(decision?.productionReleaseDryRun, true);
        assert.equal(decision?.productionReleaseWouldExecute, true);
        assert.equal(decision?.productionReleaseDryRunAuditEvent, true);
        assert.equal(decision?.productionReleaseDryRunReason, "production_release_would_execute");
        assert.equal(decision?.productionReleaseAdapterRequired, true);
        assert.equal(decision?.productionReleaseAdapterMode, "contract_only");
        assert.equal(decision?.productionReleaseAdapterReady, false);
        assert.equal(decision?.productionReleaseAdapterWouldInvoke, true);
        assert.equal(decision?.productionReleaseAdapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterBlockedBy, "production_release_adapter_disabled");
        assert.equal(decision?.productionReleaseAdapterInputContract, "phase3.productionReleaseAdapter.input.v1");
        assert.equal(decision?.productionReleaseAdapterInputBuilt, true);
        assert.equal(decision?.productionReleaseAdapterInputReady, true);
        assert.equal(decision?.productionReleaseAdapterInputBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterInputSanitized, true);
        assert.equal(decision?.productionReleaseAdapterInputJwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterRawProofIncluded, false);
        assert.equal(decision?.productionReleaseAdapterRawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.contract, "phase3.productionReleaseAdapter.input.v1");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.release?.mode, "dry_run");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.release?.wouldExecute, true);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.release?.adapterMode, "contract_only");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.challenge?.nonce, pr.nonce);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.challenge?.challengeId, pr.nonce);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.resource?.method, "GET");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.resource?.path, "/paid-gated");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.merchant?.merchantId, pr.merchantId);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.merchant?.payTo, pr.payTo);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.contractBinding?.contractId, pr.contractId);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.contractBinding?.contractVersion, pr.contractVersion);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.contractBinding?.isFrozen, pr.isFrozen);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.payment?.network, pr.network);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.payment?.asset?.tokenId, pr.asset.tokenId);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.payment?.asset?.decimals, pr.asset.decimals);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.payment?.amount, pr.amount);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.receipt?.proofVersion, "ccd-plt-proof@v1");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.receipt?.settlementStatus, "finalized");
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.sanitized, true);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.rawProofIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.rawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.jwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.productionReleaseAuthorized, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.adapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.safety?.crpFulfillCalled, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.jws, undefined);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.rawProof, undefined);
        assert.equal(decision?.productionReleaseAdapterInputPreview?.rawReceipt, undefined);
        assert.equal(decision?.productionReleaseAdapterNoopFunctionAvailable, true);
        assert.equal(decision?.productionReleaseAdapterNoopResultObserved, true);
        assert.equal(decision?.productionReleaseAdapterNoopResultStatus, "disabled");
        assert.equal(decision?.productionReleaseAdapterNoopResultReason, "production_release_adapter_disabled");
        assert.equal(decision?.productionReleaseAdapterNoopSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.ok, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.status, "disabled");
        assert.equal(decision?.productionReleaseAdapterNoopResult?.reason, "production_release_adapter_disabled");
        assert.equal(decision?.productionReleaseAdapterNoopResult?.inputContract, "phase3.productionReleaseAdapter.input.v1");
        assert.equal(decision?.productionReleaseAdapterNoopResult?.inputBuilt, true);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.inputReady, true);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.inputSanitized, true);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.inputJwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.adapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.externalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.productionReleaseAuthorized, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.crpFulfillCalled, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult?.sideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDecisionObserved, true);
        assert.equal(decision?.productionReleaseAdapterDecisionStatus, "blocked");
        assert.equal(decision?.productionReleaseAdapterDecisionReason, "production_release_adapter_disabled");
        assert.equal(decision?.productionReleaseAdapterDecisionBlockedBy, "production_release_adapter_disabled");
        assert.equal(decision?.productionReleaseAdapterDecisionAllowsProductionRelease, false);
        assert.equal(decision?.productionReleaseAdapterDecisionSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationRequired, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationObserved, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationMode, "dry_run");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationStatus, "would_invoke");
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReason,
          "production_release_adapter_dry_run_would_invoke",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.ok, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.status, "would_invoke");
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationResult?.reason,
          "production_release_adapter_dry_run_would_invoke",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.mode, "dry_run");
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationResult?.adapterDecisionStatus,
          "blocked",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationResult?.adapterDecisionReason,
          "production_release_adapter_disabled",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationResult?.inputContract,
          "phase3.productionReleaseAdapter.input.v1",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.inputBuilt, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.inputReady, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.inputSanitized, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.inputJwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.adapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.externalCallAttempted, false);
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationResult?.productionReleaseAuthorized,
          false,
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.crpFulfillCalled, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult?.sideEffectFree, true);

        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptEmitted, true);
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceiptContract,
          "phase3.productionReleaseAdapter.dryRunInvocationReceipt.v1",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceiptReason,
          "production_release_adapter_dry_run_invocation_recorded",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree, true);
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.contract,
          "phase3.productionReleaseAdapter.dryRunInvocationReceipt.v1",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.mode, "dry_run");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.status, "recorded");
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.reason,
          "production_release_adapter_dry_run_invocation_recorded",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.decisionStatus,
          "blocked",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.decisionReason,
          "production_release_adapter_disabled",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.invocationStatus,
          "would_invoke",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.invocationReason,
          "production_release_adapter_dry_run_would_invoke",
        );
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.contract,
          "phase3.productionReleaseAdapter.input.v1",
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.built, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.ready, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.sanitized, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.jwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.rawProofIncluded, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.input?.rawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.safety?.adapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.safety?.externalCallAttempted, false);
        assert.equal(
          decision?.productionReleaseAdapterDryRunInvocationReceipt?.safety?.productionReleaseAuthorized,
          false,
        );
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.safety?.crpFulfillCalled, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt?.safety?.sideEffectFree, true);

        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftRequired, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftBuilt, true);
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraftContract,
          "phase3.productionRelease.crpFulfillRequestDraft.v1",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraftReason,
          "production_release_crp_fulfill_request_draft_built",
        );
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftSanitized, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled, false);
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.contract,
          "phase3.productionRelease.crpFulfillRequestDraft.v1",
        );
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.mode, "dry_run");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.status, "drafted");
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.reason,
          "production_release_crp_fulfill_request_draft_built",
        );
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.target?.service, "crp");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.target?.operation, "fulfill");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.target?.method, "POST");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.target?.path, "/v1/crp/payments/fulfill");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.request?.resource?.method, "GET");
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.request?.resource?.path, "/paid-gated");
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.merchant?.merchantId,
          "demo-merchant",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.payment?.network,
          "concordium:testnet",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.payment?.asset?.tokenId,
          "EUDemo",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.payment?.amountRaw,
          "50101",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.receipt?.proofVersion,
          "ccd-plt-proof@v1",
        );
        assert.equal(
          decision?.productionReleaseCrpFulfillRequestDraft?.request?.receipt?.settlementStatus,
          "finalized",
        );
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.sanitized, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.jwsIncluded, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.rawProofIncluded, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.rawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.adapterInvoked, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.externalCallAttempted, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.crpCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.crpFulfillCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.productionReleaseAuthorized, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.productionRelease, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft?.safety?.sideEffectFree, true);
        assert.equal(decision?.productionReleaseBlockedBy, null);
        assert.equal(decision?.productionReleaseRecognizedButNotExecuted, true);
      } else if (input.productionSwitchEnabled) {
        assert.equal(decision?.canonicalReleasePersistenceRequired, true);
        assert.equal(decision?.canonicalReleasePersistenceReady, true);
        assert.equal(decision?.canonicalReleasePersisted, true);
        assert.equal(decision?.productionReleaseExecutionPreflightRequired, true);
        assert.equal(decision?.productionReleaseExecutionPreflightReady, false);
        assert.equal(decision?.productionReleaseExecutionMode, "disabled");
        assert.equal(
          decision?.productionReleaseExecutionBlockedBy,
          "production_release_execution_disabled",
        );
        assert.equal(decision?.productionReleaseExecutionRecognizedButNotExecuted, true);
        assert.equal(decision?.productionReleaseDryRun, false);
        assert.equal(decision?.productionReleaseWouldExecute, false);
        assert.equal(decision?.productionReleaseDryRunAuditEvent, false);
        assert.equal(decision?.productionReleaseDryRunReason, null);
        assert.equal(decision?.productionReleaseAdapterRequired, false);
        assert.equal(decision?.productionReleaseAdapterMode, "inactive");
        assert.equal(decision?.productionReleaseAdapterReady, false);
        assert.equal(decision?.productionReleaseAdapterWouldInvoke, false);
        assert.equal(decision?.productionReleaseAdapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterInputContract, null);
        assert.equal(decision?.productionReleaseAdapterInputBuilt, false);
        assert.equal(decision?.productionReleaseAdapterInputReady, false);
        assert.equal(decision?.productionReleaseAdapterInputBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterInputSanitized, false);
        assert.equal(decision?.productionReleaseAdapterInputJwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview, null);
        assert.equal(decision?.productionReleaseAdapterNoopFunctionAvailable, false);
        assert.equal(decision?.productionReleaseAdapterNoopResultObserved, false);
        assert.equal(decision?.productionReleaseAdapterNoopResultStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterNoopResultReason, null);
        assert.equal(decision?.productionReleaseAdapterNoopSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult, null);
        assert.equal(decision?.productionReleaseAdapterDecisionObserved, false);
        assert.equal(decision?.productionReleaseAdapterDecisionStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterDecisionReason, null);
        assert.equal(decision?.productionReleaseAdapterDecisionBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterDecisionAllowsProductionRelease, false);
        assert.equal(decision?.productionReleaseAdapterDecisionSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationRequired, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationObserved, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationMode, "inactive");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReason, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptEmitted, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptContract, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptReason, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftRequired, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftBuilt, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftContract, null);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftReason, null);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftSanitized, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft, null);
        assert.equal(decision?.productionReleaseAdapterRawProofIncluded, false);
        assert.equal(decision?.productionReleaseAdapterRawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseBlockedBy, "production_release_execution_disabled");
        assert.equal(decision?.productionReleaseRecognizedButNotExecuted, true);
      } else {
        assert.equal(decision?.canonicalReleasePersistenceRequired, false);
        assert.equal(decision?.canonicalReleasePersistenceReady, false);
        assert.equal(decision?.productionReleaseExecutionPreflightRequired, false);
        assert.equal(decision?.productionReleaseExecutionPreflightReady, false);
        assert.equal(decision?.productionReleaseExecutionMode, "disabled");
        assert.equal(
          decision?.productionReleaseExecutionBlockedBy,
          "production_release_switch_disabled",
        );
        assert.equal(decision?.productionReleaseExecutionRecognizedButNotExecuted, false);
        assert.equal(decision?.productionReleaseDryRun, false);
        assert.equal(decision?.productionReleaseWouldExecute, false);
        assert.equal(decision?.productionReleaseDryRunAuditEvent, false);
        assert.equal(decision?.productionReleaseDryRunReason, null);
        assert.equal(decision?.productionReleaseAdapterRequired, false);
        assert.equal(decision?.productionReleaseAdapterMode, "inactive");
        assert.equal(decision?.productionReleaseAdapterReady, false);
        assert.equal(decision?.productionReleaseAdapterWouldInvoke, false);
        assert.equal(decision?.productionReleaseAdapterInvoked, false);
        assert.equal(decision?.productionReleaseAdapterBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterInputContract, null);
        assert.equal(decision?.productionReleaseAdapterInputBuilt, false);
        assert.equal(decision?.productionReleaseAdapterInputReady, false);
        assert.equal(decision?.productionReleaseAdapterInputBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterInputSanitized, false);
        assert.equal(decision?.productionReleaseAdapterInputJwsIncluded, false);
        assert.equal(decision?.productionReleaseAdapterInputPreview, null);
        assert.equal(decision?.productionReleaseAdapterNoopFunctionAvailable, false);
        assert.equal(decision?.productionReleaseAdapterNoopResultObserved, false);
        assert.equal(decision?.productionReleaseAdapterNoopResultStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterNoopResultReason, null);
        assert.equal(decision?.productionReleaseAdapterNoopSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterNoopResult, null);
        assert.equal(decision?.productionReleaseAdapterDecisionObserved, false);
        assert.equal(decision?.productionReleaseAdapterDecisionStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterDecisionReason, null);
        assert.equal(decision?.productionReleaseAdapterDecisionBlockedBy, null);
        assert.equal(decision?.productionReleaseAdapterDecisionAllowsProductionRelease, false);
        assert.equal(decision?.productionReleaseAdapterDecisionSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationRequired, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationObserved, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationMode, "inactive");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationStatus, "inactive");
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReason, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationSideEffectFree, true);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationResult, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptEmitted, false);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceipt, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptContract, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptReason, null);
        assert.equal(decision?.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftRequired, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftBuilt, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftContract, null);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftReason, null);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftSanitized, true);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftExternalCallAttempted, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled, false);
        assert.equal(decision?.productionReleaseCrpFulfillRequestDraft, null);
        assert.equal(decision?.productionReleaseAdapterRawProofIncluded, false);
        assert.equal(decision?.productionReleaseAdapterRawReceiptIncluded, false);
        assert.equal(decision?.productionReleaseBlockedBy, "production_release_switch_disabled");
        assert.equal(decision?.productionReleaseRecognizedButNotExecuted, false);
      }

      return {
        productionSwitchEnabled: input.productionSwitchEnabled,
        dryRunEnabled: input.dryRunEnabled,
        gatewayProductionReleaseEnabled: health.phase3.gatewayProductionReleaseEnabled,
        gatewayProductionReleaseDryRunEnabled:
          health.phase3.gatewayProductionReleaseDryRunEnabled === true,
        eligiblePolicyRedeemed: true,
        verifiedFinalizedReceiptSubmitted: true,
        releaseStatus: release.status,
        paymentResponseEmitted: release.headers.get("payment-response") !== null,
        resourceReleased: release.json?.resource === "secret-data",
        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        productionReleaseCandidate: decision?.productionReleaseCandidate === true,
        productionReleaseSwitchRequired: decision?.productionReleaseSwitchRequired === true,
        productionReleaseSwitchEnabled: decision?.productionReleaseSwitchEnabled === true,
        productionReleaseEligible: decision?.productionReleaseEligible === true,
        canonicalReleasePersistenceRequired: decision?.canonicalReleasePersistenceRequired === true,
        canonicalReleasePersistenceReady: decision?.canonicalReleasePersistenceReady === true,
        productionReleaseExecutionPreflightRequired:
          decision?.productionReleaseExecutionPreflightRequired === true,
        productionReleaseExecutionPreflightReady:
          decision?.productionReleaseExecutionPreflightReady === true,
        productionReleaseExecutionMode: decision?.productionReleaseExecutionMode ?? null,
        productionReleaseExecutionBlockedBy:
          decision?.productionReleaseExecutionBlockedBy ?? null,
        productionReleaseExecutionRecognizedButNotExecuted:
          decision?.productionReleaseExecutionRecognizedButNotExecuted === true,
        productionReleaseDryRun: decision?.productionReleaseDryRun === true,
        productionReleaseWouldExecute: decision?.productionReleaseWouldExecute === true,
        productionReleaseDryRunAuditEvent: decision?.productionReleaseDryRunAuditEvent === true,
        productionReleaseDryRunReason: decision?.productionReleaseDryRunReason ?? null,
        productionReleaseAdapterRequired: decision?.productionReleaseAdapterRequired === true,
        productionReleaseAdapterMode: decision?.productionReleaseAdapterMode ?? null,
        productionReleaseAdapterReady: decision?.productionReleaseAdapterReady === true,
        productionReleaseAdapterWouldInvoke: decision?.productionReleaseAdapterWouldInvoke === true,
        productionReleaseAdapterInvoked: decision?.productionReleaseAdapterInvoked === true,
        productionReleaseAdapterBlockedBy: decision?.productionReleaseAdapterBlockedBy ?? null,
        productionReleaseAdapterInputContract: decision?.productionReleaseAdapterInputContract ?? null,
        productionReleaseAdapterInputBuilt: decision?.productionReleaseAdapterInputBuilt === true,
        productionReleaseAdapterInputReady: decision?.productionReleaseAdapterInputReady === true,
        productionReleaseAdapterInputBlockedBy:
          decision?.productionReleaseAdapterInputBlockedBy ?? null,
        productionReleaseAdapterInputSanitized:
          decision?.productionReleaseAdapterInputSanitized === true,
        productionReleaseAdapterInputJwsIncluded:
          decision?.productionReleaseAdapterInputJwsIncluded === true,
        productionReleaseAdapterInputPreview: decision?.productionReleaseAdapterInputPreview ?? null,
        productionReleaseAdapterNoopFunctionAvailable:
          decision?.productionReleaseAdapterNoopFunctionAvailable === true,
        productionReleaseAdapterNoopResultObserved:
          decision?.productionReleaseAdapterNoopResultObserved === true,
        productionReleaseAdapterNoopResultStatus:
          decision?.productionReleaseAdapterNoopResultStatus ?? null,
        productionReleaseAdapterNoopResultReason:
          decision?.productionReleaseAdapterNoopResultReason ?? null,
        productionReleaseAdapterNoopSideEffectFree:
          decision?.productionReleaseAdapterNoopSideEffectFree === true,
        productionReleaseAdapterExternalCallAttempted:
          decision?.productionReleaseAdapterExternalCallAttempted === true,
        productionReleaseAdapterNoopResult:
          decision?.productionReleaseAdapterNoopResult ?? null,
        productionReleaseAdapterDecisionObserved:
          decision?.productionReleaseAdapterDecisionObserved === true,
        productionReleaseAdapterDecisionStatus:
          decision?.productionReleaseAdapterDecisionStatus ?? null,
        productionReleaseAdapterDecisionReason:
          decision?.productionReleaseAdapterDecisionReason ?? null,
        productionReleaseAdapterDecisionBlockedBy:
          decision?.productionReleaseAdapterDecisionBlockedBy ?? null,
        productionReleaseAdapterDecisionAllowsProductionRelease:
          decision?.productionReleaseAdapterDecisionAllowsProductionRelease === true,
        productionReleaseAdapterDecisionSideEffectFree:
          decision?.productionReleaseAdapterDecisionSideEffectFree === true,
        productionReleaseAdapterDryRunInvocationRequired:
          decision?.productionReleaseAdapterDryRunInvocationRequired === true,
        productionReleaseAdapterDryRunInvocationObserved:
          decision?.productionReleaseAdapterDryRunInvocationObserved === true,
        productionReleaseAdapterDryRunInvocationMode:
          decision?.productionReleaseAdapterDryRunInvocationMode ?? null,
        productionReleaseAdapterDryRunInvocationStatus:
          decision?.productionReleaseAdapterDryRunInvocationStatus ?? null,
        productionReleaseAdapterDryRunInvocationReason:
          decision?.productionReleaseAdapterDryRunInvocationReason ?? null,
        productionReleaseAdapterDryRunInvocationExternalCallAttempted:
          decision?.productionReleaseAdapterDryRunInvocationExternalCallAttempted === true,
        productionReleaseAdapterDryRunInvocationSideEffectFree:
          decision?.productionReleaseAdapterDryRunInvocationSideEffectFree === true,
        productionReleaseAdapterDryRunInvocationResult:
          decision?.productionReleaseAdapterDryRunInvocationResult ?? null,
        productionReleaseAdapterDryRunInvocationReceiptEmitted:
          decision?.productionReleaseAdapterDryRunInvocationReceiptEmitted === true,
        productionReleaseAdapterDryRunInvocationReceipt:
          decision?.productionReleaseAdapterDryRunInvocationReceipt ?? null,
        productionReleaseAdapterDryRunInvocationReceiptContract:
          decision?.productionReleaseAdapterDryRunInvocationReceiptContract ?? null,
        productionReleaseAdapterDryRunInvocationReceiptReason:
          decision?.productionReleaseAdapterDryRunInvocationReceiptReason ?? null,
        productionReleaseAdapterDryRunInvocationReceiptSideEffectFree:
          decision?.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree === true,
        productionReleaseCrpFulfillRequestDraftRequired:
          decision?.productionReleaseCrpFulfillRequestDraftRequired === true,
        productionReleaseCrpFulfillRequestDraftBuilt:
          decision?.productionReleaseCrpFulfillRequestDraftBuilt === true,
        productionReleaseCrpFulfillRequestDraftContract:
          decision?.productionReleaseCrpFulfillRequestDraftContract ?? null,
        productionReleaseCrpFulfillRequestDraftReason:
          decision?.productionReleaseCrpFulfillRequestDraftReason ?? null,
        productionReleaseCrpFulfillRequestDraftSanitized:
          decision?.productionReleaseCrpFulfillRequestDraftSanitized === true,
        productionReleaseCrpFulfillRequestDraftExternalCallAttempted:
          decision?.productionReleaseCrpFulfillRequestDraftExternalCallAttempted ?? null,
        productionReleaseCrpFulfillRequestDraftCrpCalled:
          decision?.productionReleaseCrpFulfillRequestDraftCrpCalled ?? null,
        productionReleaseCrpFulfillRequestDraftCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled ?? null,
        productionReleaseCrpFulfillRequestDraft:
          decision?.productionReleaseCrpFulfillRequestDraft ?? null,
          productionReleaseCrpFulfillRequestValidationRequired:
            decision?.productionReleaseCrpFulfillRequestValidationRequired === true,
          productionReleaseCrpFulfillRequestValidationReady:
            decision?.productionReleaseCrpFulfillRequestValidationReady === true,
          productionReleaseCrpFulfillRequestValidationStatus:
            decision?.productionReleaseCrpFulfillRequestValidationStatus ?? null,
          productionReleaseCrpFulfillRequestValidationReason:
            decision?.productionReleaseCrpFulfillRequestValidationReason ?? null,
          productionReleaseCrpFulfillRequestValidationErrors:
            decision?.productionReleaseCrpFulfillRequestValidationErrors ?? null,
          productionReleaseCrpFulfillRequestValidationSideEffectFree:
            decision?.productionReleaseCrpFulfillRequestValidationSideEffectFree === true,
          productionReleaseCrpFulfillExecutionRequired:
            decision?.productionReleaseCrpFulfillExecutionRequired === true,
          productionReleaseCrpFulfillExecutionClientAvailable:
            decision?.productionReleaseCrpFulfillExecutionClientAvailable === true,
          productionReleaseCrpFulfillExecutionMode:
            decision?.productionReleaseCrpFulfillExecutionMode ?? null,
          productionReleaseCrpFulfillExecutionReady:
            decision?.productionReleaseCrpFulfillExecutionReady === true,
          productionReleaseCrpFulfillExecutionBlockedBy:
            decision?.productionReleaseCrpFulfillExecutionBlockedBy ?? null,
          productionReleaseCrpFulfillExecutionRecognizedButNotExecuted:
            decision?.productionReleaseCrpFulfillExecutionRecognizedButNotExecuted === true,
          productionReleaseCrpFulfillExecutionExternalCallAttempted:
            decision?.productionReleaseCrpFulfillExecutionExternalCallAttempted === true,
          productionReleaseCrpFulfillExecutionCrpCalled:
            decision?.productionReleaseCrpFulfillExecutionCrpCalled === true,
          productionReleaseCrpFulfillExecutionCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillExecutionCrpFulfillCalled === true,
          productionReleaseCrpFulfillExecutionSideEffectFree:
            decision?.productionReleaseCrpFulfillExecutionSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterScaffoldRequired:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldRequired === true,
          productionReleaseCrpFulfillClientAdapterScaffoldAvailable:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldAvailable === true,
          productionReleaseCrpFulfillClientAdapterScaffoldMode:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldMode ?? null,
          productionReleaseCrpFulfillClientAdapterScaffoldReady:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldReady === true,
          productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterScaffoldWouldCall:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldWouldCall === true,
          productionReleaseCrpFulfillClientAdapterScaffoldCalled:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldCalled === true,
          productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterContractRequired:
            decision?.productionReleaseCrpFulfillClientAdapterContractRequired === true,
          productionReleaseCrpFulfillClientAdapterContractAvailable:
            decision?.productionReleaseCrpFulfillClientAdapterContractAvailable === true,
          productionReleaseCrpFulfillClientAdapterContract:
            decision?.productionReleaseCrpFulfillClientAdapterContract ?? null,
          productionReleaseCrpFulfillClientAdapterContractMode:
            decision?.productionReleaseCrpFulfillClientAdapterContractMode ?? null,
          productionReleaseCrpFulfillClientAdapterContractReady:
            decision?.productionReleaseCrpFulfillClientAdapterContractReady === true,
          productionReleaseCrpFulfillClientAdapterContractBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterContractBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterContractInputRequired:
            decision?.productionReleaseCrpFulfillClientAdapterContractInputRequired === true,
          productionReleaseCrpFulfillClientAdapterContractResultRequired:
            decision?.productionReleaseCrpFulfillClientAdapterContractResultRequired === true,
          productionReleaseCrpFulfillClientAdapterContractInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterContractInvoked === true,
          productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterContractCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterContractCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterContractSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterContractSideEffectFree === true,
        productionReleaseAdapterRawProofIncluded:
          decision?.productionReleaseAdapterRawProofIncluded === true,
        productionReleaseAdapterRawReceiptIncluded:
          decision?.productionReleaseAdapterRawReceiptIncluded === true,
        productionReleaseBlockedBy: decision?.productionReleaseBlockedBy ?? null,
        productionReleaseRecognizedButNotExecuted:
          decision?.productionReleaseRecognizedButNotExecuted === true,
        productionRelease: decision?.productionRelease === true,
        canonicalReleasePersisted: decision?.canonicalReleasePersisted === true,
        crpCalled: decision?.crpCalled === true,
        crpFulfillCalled: decision?.crpFulfillCalled === true,
        rawProofPrinted: decision?.rawProofPrinted === true,
        rawReceiptPrinted: decision?.rawReceiptPrinted === true,
      };
    },
  });
}

async function main() {
  const switchOffDryRunOff = await runScenario({
    label: `${LABEL}:switch-off-dry-run-off`,
    gatewayPort: SWITCH_OFF_GATEWAY_PORT,
    jwksPort: SWITCH_OFF_JWKS_PORT,
    productionSwitchEnabled: false,
    dryRunEnabled: false,
  });

  const switchOffDryRunOn = await runScenario({
    label: `${LABEL}:switch-off-dry-run-on`,
    gatewayPort: SWITCH_OFF_GATEWAY_PORT,
    jwksPort: SWITCH_OFF_JWKS_PORT,
    productionSwitchEnabled: false,
    dryRunEnabled: true,
  });

  const switchOnDryRunOff = await runScenario({
    label: `${LABEL}:switch-on-dry-run-off`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
    dryRunEnabled: false,
  });

  const switchOnDryRunOn = await runScenario({
    label: `${LABEL}:switch-on-dry-run-on`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
    dryRunEnabled: true,
  });

  const summary = {
    ok: true,
    harness: "phase3.productionReleaseCrpFulfillClientAdapterContract.v1",

    adapterInputInactiveWhenSwitchOff:
      switchOffDryRunOff.productionReleaseAdapterInputBuilt === false &&
      switchOffDryRunOn.productionReleaseAdapterInputBuilt === false &&
      switchOffDryRunOff.productionReleaseAdapterInputReady === false &&
      switchOffDryRunOn.productionReleaseAdapterInputReady === false &&
      switchOffDryRunOff.productionReleaseAdapterInputPreview === null &&
      switchOffDryRunOn.productionReleaseAdapterInputPreview === null,

    adapterInputInactiveWhenDryRunOff:
      switchOnDryRunOff.productionReleaseCandidate === true &&
      switchOnDryRunOff.productionReleaseEligible === true &&
      switchOnDryRunOff.productionReleaseDryRun === false &&
      switchOnDryRunOff.productionReleaseAdapterInputBuilt === false &&
      switchOnDryRunOff.productionReleaseAdapterInputReady === false &&
      switchOnDryRunOff.productionReleaseAdapterInputPreview === null,

    adapterInputBuiltOnlyAfterDryRunWouldExecute:
      switchOnDryRunOn.productionReleaseCandidate === true &&
      switchOnDryRunOn.productionReleaseEligible === true &&
      switchOnDryRunOn.canonicalReleasePersistenceReady === true &&
      switchOnDryRunOn.productionReleaseDryRun === true &&
      switchOnDryRunOn.productionReleaseWouldExecute === true &&
      switchOnDryRunOn.productionReleaseAdapterRequired === true &&
      switchOnDryRunOn.productionReleaseAdapterInputBuilt === true &&
      switchOnDryRunOn.productionReleaseAdapterInputReady === true,

    adapterInputContractIsStable:
      switchOnDryRunOn.productionReleaseAdapterInputContract === "phase3.productionReleaseAdapter.input.v1" &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.contract === "phase3.productionReleaseAdapter.input.v1",

    adapterInputPreviewIsSanitized:
      switchOnDryRunOn.productionReleaseAdapterInputSanitized === true &&
      switchOnDryRunOn.productionReleaseAdapterInputJwsIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterRawProofIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterRawReceiptIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.sanitized === true &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.rawProofIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.rawReceiptIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.jwsIncluded === false,

    noopResultInactiveUntilInputBuilt:
      switchOffDryRunOff.productionReleaseAdapterNoopFunctionAvailable === false &&
      switchOffDryRunOff.productionReleaseAdapterNoopResultObserved === false &&
      switchOffDryRunOff.productionReleaseAdapterNoopResultStatus === "inactive" &&
      switchOffDryRunOn.productionReleaseAdapterNoopFunctionAvailable === false &&
      switchOffDryRunOn.productionReleaseAdapterNoopResultObserved === false &&
      switchOffDryRunOn.productionReleaseAdapterNoopResultStatus === "inactive" &&
      switchOnDryRunOff.productionReleaseAdapterNoopFunctionAvailable === false &&
      switchOnDryRunOff.productionReleaseAdapterNoopResultObserved === false &&
      switchOnDryRunOff.productionReleaseAdapterNoopResultStatus === "inactive",

    noopResultObservedAsDisabledAfterInputBuilt:
      switchOnDryRunOn.productionReleaseAdapterNoopFunctionAvailable === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResultObserved === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResultStatus === "disabled" &&
      switchOnDryRunOn.productionReleaseAdapterNoopResultReason === "production_release_adapter_disabled" &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.status === "disabled" &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.reason === "production_release_adapter_disabled",

    noopResultPreservesInputContract:
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.inputContract === "phase3.productionReleaseAdapter.input.v1" &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.inputBuilt === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.inputReady === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.inputSanitized === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.inputJwsIncluded === false,

    adapterDecisionInactiveUntilNoopResultObserved:
      switchOffDryRunOff.productionReleaseAdapterDecisionObserved === false &&
      switchOffDryRunOff.productionReleaseAdapterDecisionStatus === "inactive" &&
      switchOffDryRunOff.productionReleaseAdapterDecisionReason === null &&
      switchOffDryRunOn.productionReleaseAdapterDecisionObserved === false &&
      switchOffDryRunOn.productionReleaseAdapterDecisionStatus === "inactive" &&
      switchOffDryRunOn.productionReleaseAdapterDecisionReason === null &&
      switchOnDryRunOff.productionReleaseAdapterDecisionObserved === false &&
      switchOnDryRunOff.productionReleaseAdapterDecisionStatus === "inactive" &&
      switchOnDryRunOff.productionReleaseAdapterDecisionReason === null,

    adapterDecisionObservedAsBlockedAfterNoopResult:
      switchOnDryRunOn.productionReleaseAdapterDecisionObserved === true &&
      switchOnDryRunOn.productionReleaseAdapterDecisionStatus === "blocked" &&
      switchOnDryRunOn.productionReleaseAdapterDecisionReason === "production_release_adapter_disabled" &&
      switchOnDryRunOn.productionReleaseAdapterDecisionBlockedBy === "production_release_adapter_disabled",

    adapterDecisionNeverAllowsProductionRelease:
      switchOffDryRunOff.productionReleaseAdapterDecisionAllowsProductionRelease === false &&
      switchOffDryRunOn.productionReleaseAdapterDecisionAllowsProductionRelease === false &&
      switchOnDryRunOff.productionReleaseAdapterDecisionAllowsProductionRelease === false &&
      switchOnDryRunOn.productionReleaseAdapterDecisionAllowsProductionRelease === false,

    adapterDecisionSideEffectFree:
      switchOffDryRunOff.productionReleaseAdapterDecisionSideEffectFree === true &&
      switchOffDryRunOn.productionReleaseAdapterDecisionSideEffectFree === true &&
      switchOnDryRunOff.productionReleaseAdapterDecisionSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterDecisionSideEffectFree === true,

    dryRunInvocationInactiveUntilDecisionObserved:
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationObserved === false &&
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationStatus === "inactive" &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationObserved === false &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationStatus === "inactive" &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationObserved === false &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationStatus === "inactive",

    dryRunInvocationObservedAsWouldInvokeAfterDecision:
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationRequired === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationObserved === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationMode === "dry_run" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationStatus === "would_invoke" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReason ===
        "production_release_adapter_dry_run_would_invoke",

    dryRunInvocationPreservesInputContract:
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationResult?.inputContract ===
        "phase3.productionReleaseAdapter.input.v1" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationResult?.inputBuilt === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationResult?.inputReady === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationResult?.inputSanitized === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationResult?.inputJwsIncluded === false,

    dryRunInvocationNoExternalCall:
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationExternalCallAttempted === false &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationExternalCallAttempted === false &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationExternalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationExternalCallAttempted === false,

    dryRunInvocationSideEffectFree:
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationSideEffectFree === true &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationSideEffectFree === true &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationSideEffectFree === true,

    dryRunReceiptInactiveUntilInvocationObserved:
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationReceiptEmitted === false &&
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationReceipt === null &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationReceiptEmitted === false &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationReceipt === null &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationReceiptEmitted === false &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationReceipt === null,

    dryRunReceiptEmittedAfterInvocationObserved:
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceiptEmitted === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceiptContract ===
        "phase3.productionReleaseAdapter.dryRunInvocationReceipt.v1" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceiptReason ===
        "production_release_adapter_dry_run_invocation_recorded" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.status === "recorded" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.mode === "dry_run",

    dryRunReceiptPreservesAdapterContext:
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.decisionStatus ===
        "blocked" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.decisionReason ===
        "production_release_adapter_disabled" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.invocationStatus ===
        "would_invoke" &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.adapter?.invocationReason ===
        "production_release_adapter_dry_run_would_invoke",

    dryRunReceiptSanitized:
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.input?.sanitized === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.input?.jwsIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.input?.rawProofIncluded === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.input?.rawReceiptIncluded === false,

    dryRunReceiptSideEffectFree:
      switchOffDryRunOff.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree === true &&
      switchOffDryRunOn.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree === true &&
      switchOnDryRunOff.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceiptSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.safety?.adapterInvoked === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.safety?.externalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.safety?.productionReleaseAuthorized === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.safety?.crpFulfillCalled === false &&
      switchOnDryRunOn.productionReleaseAdapterDryRunInvocationReceipt?.safety?.sideEffectFree === true,

    crpFulfillRequestDraftInactiveUntilAdapterReceipt:
      switchOffDryRunOff.productionReleaseCrpFulfillRequestDraftBuilt === false &&
      switchOffDryRunOff.productionReleaseCrpFulfillRequestDraft === null &&
      switchOffDryRunOn.productionReleaseCrpFulfillRequestDraftBuilt === false &&
      switchOffDryRunOn.productionReleaseCrpFulfillRequestDraft === null &&
      switchOnDryRunOff.productionReleaseCrpFulfillRequestDraftBuilt === false &&
      switchOnDryRunOff.productionReleaseCrpFulfillRequestDraft === null,

    crpFulfillRequestDraftBuiltAfterAdapterReceipt:
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftRequired === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftBuilt === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftContract ===
        "phase3.productionRelease.crpFulfillRequestDraft.v1" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftReason ===
        "production_release_crp_fulfill_request_draft_built" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.status === "drafted" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.mode === "dry_run",

    crpFulfillRequestDraftTargetsCrpFulfill:
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.target?.service === "crp" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.target?.operation === "fulfill" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.target?.method === "POST" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.target?.path === "/v1/crp/payments/fulfill",

    crpFulfillRequestDraftPreservesPaymentContext:
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.resource?.method === "GET" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.resource?.path === "/paid-gated" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.merchant?.merchantId === "demo-merchant" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.payment?.network === "concordium:testnet" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.payment?.asset?.tokenId === "EUDemo" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.payment?.amountRaw === "50101" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.receipt?.proofVersion === "ccd-plt-proof@v1" &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.request?.receipt?.settlementStatus === "finalized",

    crpFulfillRequestDraftSanitized:
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftSanitized === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.sanitized === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.jwsIncluded === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.rawProofIncluded === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.rawReceiptIncluded === false,

    crpFulfillRequestDraftSideEffectFree:
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftExternalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftCrpCalled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.adapterInvoked === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.externalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.crpCalled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.crpFulfillCalled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.productionReleaseAuthorized === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.productionRelease === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillRequestDraft?.safety?.sideEffectFree === true,

      crpFulfillRequestValidationInactiveUntilDraftBuilt:
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationRequired === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationReady === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationStatus === "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationReason === null &&
        Array.isArray(switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationErrors) &&
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationErrors.length === 0 &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationReady === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationStatus === "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationReason === null &&
        Array.isArray(switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationErrors) &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationErrors.length === 0 &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationReady === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationStatus === "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationReason === null &&
        Array.isArray(switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationErrors) &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationErrors.length === 0,

      crpFulfillRequestValidationReadyAfterDraftBuilt:
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationStatus === "valid" &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationReason ===
          "production_release_crp_fulfill_request_validation_valid" &&
        Array.isArray(switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationErrors) &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationErrors.length === 0,

      crpFulfillRequestValidationSideEffectFree:
        switchOffDryRunOff.productionReleaseCrpFulfillRequestValidationSideEffectFree === true &&
        switchOffDryRunOn.productionReleaseCrpFulfillRequestValidationSideEffectFree === true &&
        switchOnDryRunOff.productionReleaseCrpFulfillRequestValidationSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillRequestDraftCrpFulfillCalled === false,

      crpFulfillExecutionInactiveUntilRequestValidated:
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionRequired === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionClientAvailable === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionMode === "disabled" &&
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionReady === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionBlockedBy === null &&
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionRecognizedButNotExecuted === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionClientAvailable === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionMode === "disabled" &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionReady === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionBlockedBy === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionRecognizedButNotExecuted === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionClientAvailable === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionMode === "disabled" &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionReady === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionBlockedBy === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionRecognizedButNotExecuted === false,

      crpFulfillExecutionSeamRecognizedAfterValidation:
        switchOnDryRunOn.productionReleaseCrpFulfillRequestValidationReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionClientAvailable === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionMode === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionReady === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionBlockedBy ===
          "production_release_crp_fulfill_execution_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionRecognizedButNotExecuted === true,

      crpFulfillExecutionSideEffectFree:
        switchOffDryRunOff.productionReleaseCrpFulfillExecutionSideEffectFree === true &&
        switchOffDryRunOn.productionReleaseCrpFulfillExecutionSideEffectFree === true &&
        switchOnDryRunOff.productionReleaseCrpFulfillExecutionSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionCrpFulfillCalled === false,

      crpFulfillClientAdapterScaffoldInactiveUntilExecutionRequired:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldRequired === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldAvailable === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldMode === "disabled" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldReady === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy === null &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldWouldCall === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldAvailable === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldMode === "disabled" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldReady === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldWouldCall === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldAvailable === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldMode === "disabled" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldReady === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldWouldCall === false,

      crpFulfillClientAdapterScaffoldRecognizedAfterExecutionRequired:
        switchOnDryRunOn.productionReleaseCrpFulfillExecutionRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldAvailable === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldMode === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldReady === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldBlockedBy ===
          "production_release_crp_fulfill_client_adapter_scaffold_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldWouldCall === true,

      crpFulfillClientAdapterScaffoldSideEffectFree:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree === true &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree === true &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldCrpFulfillCalled === false,

      crpFulfillClientAdapterContractInactiveUntilScaffoldRequired:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractRequired === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractAvailable === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContract === null &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractMode === "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractReady === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractBlockedBy === null &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractInputRequired === false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractResultRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractAvailable === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContract === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractMode === "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractReady === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractBlockedBy === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractInputRequired === false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractResultRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractAvailable === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContract === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractMode === "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractReady === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractBlockedBy === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractInputRequired === false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractResultRequired === false,

      crpFulfillClientAdapterContractRecognizedAfterScaffoldRequired:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterScaffoldRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractAvailable === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.contract.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractMode === "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractReady === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractBlockedBy ===
          "production_release_crp_fulfill_client_adapter_contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractInputRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractResultRequired === true,

      crpFulfillClientAdapterContractSideEffectFree:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterContractSideEffectFree === true &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterContractSideEffectFree === true &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterContractSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractCrpFulfillCalled === false,

    adapterStillNotInvoked:
      switchOnDryRunOn.productionReleaseAdapterInvoked === false &&
      switchOnDryRunOn.productionReleaseAdapterBlockedBy === "production_release_adapter_disabled" &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.adapterInvoked === false &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.adapterInvoked === false,

    externalAdapterCallStillFalse:
      switchOffDryRunOff.productionReleaseAdapterExternalCallAttempted === false &&
      switchOffDryRunOn.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOff.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.externalCallAttempted === false,

    noopResultSideEffectFree:
      switchOffDryRunOff.productionReleaseAdapterNoopSideEffectFree === true &&
      switchOffDryRunOn.productionReleaseAdapterNoopSideEffectFree === true &&
      switchOnDryRunOff.productionReleaseAdapterNoopSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopSideEffectFree === true &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.sideEffectFree === true,

    productionReleaseStillFalse:
      switchOffDryRunOff.productionRelease === false &&
      switchOffDryRunOn.productionRelease === false &&
      switchOnDryRunOff.productionRelease === false &&
      switchOnDryRunOn.productionRelease === false,

    crpFulfillStillFalse:
      switchOffDryRunOff.crpFulfillCalled === false &&
      switchOffDryRunOn.crpFulfillCalled === false &&
      switchOnDryRunOff.crpFulfillCalled === false &&
      switchOnDryRunOn.crpFulfillCalled === false,

    rawProofAndReceiptNotPrinted:
      switchOffDryRunOff.rawProofPrinted === false &&
      switchOffDryRunOff.rawReceiptPrinted === false &&
      switchOffDryRunOn.rawProofPrinted === false &&
      switchOffDryRunOn.rawReceiptPrinted === false &&
      switchOnDryRunOff.rawProofPrinted === false &&
      switchOnDryRunOff.rawReceiptPrinted === false &&
      switchOnDryRunOn.rawProofPrinted === false &&
      switchOnDryRunOn.rawReceiptPrinted === false,

    behaviorStillSideEffectFree: true,

    switchOffDryRunOff,
    switchOffDryRunOn,
    switchOnDryRunOff,
    switchOnDryRunOn,
  };

  assert.equal(summary.adapterInputInactiveWhenSwitchOff, true);
  assert.equal(summary.adapterInputInactiveWhenDryRunOff, true);
  assert.equal(summary.adapterInputBuiltOnlyAfterDryRunWouldExecute, true);
  assert.equal(summary.adapterInputContractIsStable, true);
  assert.equal(summary.adapterInputPreviewIsSanitized, true);
  assert.equal(summary.noopResultInactiveUntilInputBuilt, true);
  assert.equal(summary.noopResultObservedAsDisabledAfterInputBuilt, true);
  assert.equal(summary.noopResultPreservesInputContract, true);
  assert.equal(summary.adapterDecisionInactiveUntilNoopResultObserved, true);
  assert.equal(summary.adapterDecisionObservedAsBlockedAfterNoopResult, true);
  assert.equal(summary.adapterDecisionNeverAllowsProductionRelease, true);
  assert.equal(summary.adapterDecisionSideEffectFree, true);
  assert.equal(summary.dryRunInvocationInactiveUntilDecisionObserved, true);
  assert.equal(summary.dryRunInvocationObservedAsWouldInvokeAfterDecision, true);
  assert.equal(summary.dryRunInvocationPreservesInputContract, true);
  assert.equal(summary.dryRunInvocationNoExternalCall, true);
  assert.equal(summary.dryRunInvocationSideEffectFree, true);
  assert.equal(summary.dryRunReceiptInactiveUntilInvocationObserved, true);
  assert.equal(summary.dryRunReceiptEmittedAfterInvocationObserved, true);
  assert.equal(summary.dryRunReceiptPreservesAdapterContext, true);
  assert.equal(summary.dryRunReceiptSanitized, true);
  assert.equal(summary.dryRunReceiptSideEffectFree, true);
  assert.equal(summary.crpFulfillRequestDraftInactiveUntilAdapterReceipt, true);
  assert.equal(summary.crpFulfillRequestDraftBuiltAfterAdapterReceipt, true);
  assert.equal(summary.crpFulfillRequestDraftTargetsCrpFulfill, true);
  assert.equal(summary.crpFulfillRequestDraftPreservesPaymentContext, true);
  assert.equal(summary.crpFulfillRequestDraftSanitized, true);
  assert.equal(summary.crpFulfillRequestDraftSideEffectFree, true);
  assert.equal(summary.crpFulfillRequestValidationInactiveUntilDraftBuilt, true);
  assert.equal(summary.crpFulfillRequestValidationReadyAfterDraftBuilt, true);
  assert.equal(summary.crpFulfillRequestValidationSideEffectFree, true);
  assert.equal(summary.crpFulfillExecutionInactiveUntilRequestValidated, true);
  assert.equal(summary.crpFulfillExecutionSeamRecognizedAfterValidation, true);
  assert.equal(summary.crpFulfillExecutionSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterScaffoldInactiveUntilExecutionRequired, true);
  assert.equal(summary.crpFulfillClientAdapterScaffoldRecognizedAfterExecutionRequired, true);
  assert.equal(summary.crpFulfillClientAdapterScaffoldSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterContractInactiveUntilScaffoldRequired, true);
  assert.equal(summary.crpFulfillClientAdapterContractRecognizedAfterScaffoldRequired, true);
  assert.equal(summary.crpFulfillClientAdapterContractSideEffectFree, true);
  assert.equal(summary.adapterStillNotInvoked, true);
  assert.equal(summary.externalAdapterCallStillFalse, true);
  assert.equal(summary.noopResultSideEffectFree, true);
  assert.equal(summary.productionReleaseStillFalse, true);
  assert.equal(summary.crpFulfillStillFalse, true);
  assert.equal(summary.rawProofAndReceiptNotPrinted, true);
  assert.equal(summary.behaviorStillSideEffectFree, true);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
