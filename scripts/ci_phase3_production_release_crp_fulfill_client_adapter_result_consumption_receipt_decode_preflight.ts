#!/usr/bin/env node
/**
 * PR #213 — Phase 3 production release CRP fulfill client adapter result consumption receipt decode preflight.
 *
 * This harness proves the Gateway observes the receipt material handling gate, then exposes
 * a receipt decode preflight without decoding, parsing, or verifying receipt material.
 *
 * - switch OFF + dry-run OFF => readiness gate inactive
 * - switch OFF + dry-run ON  => readiness gate inactive
 * - switch ON  + dry-run OFF => readiness gate inactive
 * - switch ON  + dry-run ON  + result consumption OFF => enablement gate observed as blocked
 * - switch ON  + dry-run ON  + result consumption ON  => receipt decode preflight observed as ready and non-decoding
 * - no result or receipt material is consumed, decoded, or parsed
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

const LABEL = "phase3:production-release-crp-fulfill-client-adapter-result-consumption-receipt-decode-preflight-test";

const SWITCH_OFF_GATEWAY_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_RESULT_CONSUMPTION_RECEIPT_DECODE_PREFLIGHT_OFF_PORT || 3136);
const SWITCH_OFF_JWKS_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_RESULT_CONSUMPTION_RECEIPT_DECODE_PREFLIGHT_OFF_JWKS_PORT || 8146);

const SWITCH_ON_GATEWAY_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_RESULT_CONSUMPTION_RECEIPT_DECODE_PREFLIGHT_ON_PORT || 3137);
const SWITCH_ON_JWKS_PORT = Number(process.env.PHASE3_PROD_CRP_FULFILL_CLIENT_ADAPTER_RESULT_CONSUMPTION_RECEIPT_DECODE_PREFLIGHT_ON_JWKS_PORT || 8147);

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
  resultConsumptionEnabled: boolean;
  run: (ctx: { baseUrl: string; jwksPort: number; jwksUrl: string }) => Promise<T>;
}): Promise<T> {
  const baseUrl = base(input.gatewayPort);
  const url = jwksUrl(input.jwksPort);

  console.log(`[${input.label}] BASE=${baseUrl}`);
  console.log(`[${input.label}] JWKS_URL=${url}`);
  console.log(`[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=${input.productionSwitchEnabled}`);
  console.log(`[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED=${input.dryRunEnabled}`);
  console.log(
    `[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED=${input.resultConsumptionEnabled}`,
  );

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
    PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED:
      process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED,
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
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED = input.resultConsumptionEnabled
    ? "true"
    : "false";
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
  resultConsumptionEnabled: boolean;
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
    resultConsumptionEnabled: input.resultConsumptionEnabled,
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
          productionReleaseCrpFulfillClientAdapterInputRequired:
            decision?.productionReleaseCrpFulfillClientAdapterInputRequired === true,
          productionReleaseCrpFulfillClientAdapterInputContract:
            decision?.productionReleaseCrpFulfillClientAdapterInputContract ?? null,
          productionReleaseCrpFulfillClientAdapterInputBuilt:
            decision?.productionReleaseCrpFulfillClientAdapterInputBuilt === true,
          productionReleaseCrpFulfillClientAdapterInputReady:
            decision?.productionReleaseCrpFulfillClientAdapterInputReady === true,
          productionReleaseCrpFulfillClientAdapterInputBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterInputBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterInputSanitized:
            decision?.productionReleaseCrpFulfillClientAdapterInputSanitized === true,
          productionReleaseCrpFulfillClientAdapterInputJwsIncluded:
            decision?.productionReleaseCrpFulfillClientAdapterInputJwsIncluded === true,
          productionReleaseCrpFulfillClientAdapterInputRawProofIncluded:
            decision?.productionReleaseCrpFulfillClientAdapterInputRawProofIncluded === true,
          productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded:
            decision?.productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded === true,
          productionReleaseCrpFulfillClientAdapterInputPreview:
            decision?.productionReleaseCrpFulfillClientAdapterInputPreview ?? null,
          productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterInputCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterInputCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterInputSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterInputSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterNoopResultRequired:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultRequired === true,
          productionReleaseCrpFulfillClientAdapterNoopResultObserved:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultObserved === true,
          productionReleaseCrpFulfillClientAdapterNoopResultStatus:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultStatus ?? null,
          productionReleaseCrpFulfillClientAdapterNoopResultReason:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultReason ?? null,
          productionReleaseCrpFulfillClientAdapterNoopResult:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResult ?? null,
          productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterNoopResultSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterNoopResultSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateRequired === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterDecisionGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterDecisionGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterDecisionGate:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGate ?? null,
          productionReleaseCrpFulfillClientAdapterDecisionGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterDecisionGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateRequired === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateMode:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateMode ?? null,
          productionReleaseCrpFulfillClientAdapterInvocationGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterInvocationGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterInvocationGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterInvocationGate:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGate ?? null,
          productionReleaseCrpFulfillClientAdapterInvocationGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterInvocationGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationMode:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationMode ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReason:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReason ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationResult:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason ?? null,
          productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessRequired === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessReady:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessReady === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessContract:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessContract ?? null,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessStatus:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessStatus ?? null,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessReason:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessReason ?? null,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterHandoffReadiness:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadiness ?? null,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterHandoffReadinessSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterHandoffReadinessSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultContractRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractRequired === true,
          productionReleaseCrpFulfillClientAdapterResultContractAvailable:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractAvailable === true,
          productionReleaseCrpFulfillClientAdapterResultContract:
            decision?.productionReleaseCrpFulfillClientAdapterResultContract ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractMode:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractMode ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractReady:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractReady === true,
          productionReleaseCrpFulfillClientAdapterResultContractBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractExpectedShape:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultContractCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultContractAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultContractAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultContractSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResult:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResult ?? null,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultDecisionGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultHandlingGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultHandlingGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultHandlingGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContract:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContract ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldAuditResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptJws === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireReceiptPayload === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireFinalizedSettlement === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireTupleBinding === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditWouldRequireNoReplay === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateDryRunAuditSanitized === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldAuditResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptJws === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireReceiptPayload === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireFinalizedSettlement === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireTupleBinding === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateWouldRequireNoReplay === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumptionEnabled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumptionEnabled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumptionEnabled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumptionEnabled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateProductionReleaseAuthorizationEnabled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateProductionReleaseAuthorizationEnabled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsReceiptConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightBlockedBy:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightBlockedBy ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight ?? null,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsResultConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsReceiptConsumption === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsCrpFulfill === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched === true,
          productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree:
            decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer === "object" &&
          decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer !== null
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsResultConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsCrpFulfill === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlockedBy
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate === "object" &&
          decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate !== null
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsCrpFulfill === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateResultConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightBlockedBy ?? null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight === "object" &&
          decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight !== null
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsResultConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsCrpFulfill === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightResultConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate ?? null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsResultConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsCrpFulfill === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateResultConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason:
          typeof decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason === "string"
            ? decision.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason
            : null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy ?? null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight ?? null,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsResultConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptConsumption === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsCrpFulfill === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightResultConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched === true,
        productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree:
          decision?.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree === true,
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
    resultConsumptionEnabled: false,
  });

  const switchOffDryRunOn = await runScenario({
    label: `${LABEL}:switch-off-dry-run-on`,
    gatewayPort: SWITCH_OFF_GATEWAY_PORT,
    jwksPort: SWITCH_OFF_JWKS_PORT,
    productionSwitchEnabled: false,
    dryRunEnabled: true,
    resultConsumptionEnabled: false,
  });

  const switchOnDryRunOff = await runScenario({
    label: `${LABEL}:switch-on-dry-run-off`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
    dryRunEnabled: false,
    resultConsumptionEnabled: false,
  });

  const switchOnDryRunOn = await runScenario({
    label: `${LABEL}:switch-on-dry-run-on`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
    dryRunEnabled: true,
    resultConsumptionEnabled: false,
  });

  const switchOnDryRunOnResultConsumptionOn = await runScenario({
    label: `${LABEL}:switch-on-dry-run-on-result-consumption-on`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
    dryRunEnabled: true,
    resultConsumptionEnabled: true,
  });

  const summary = {
    ok: true,
    harness: "phase3.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight.v1",

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

      crpFulfillClientAdapterInputBuiltAfterContractRequired:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterContractRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputBuilt === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputBlockedBy === null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputSanitized === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.contract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1",

      crpFulfillClientAdapterInputSanitizedAndSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputJwsIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputRawProofIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputRawReceiptIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputCrpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.sanitized === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.jwsIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.rawProofIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.rawReceiptIncluded === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.adapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.crpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputPreview?.safety?.productionRelease === false,
      crpFulfillClientAdapterNoopResultObservedAfterInputReady:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInputReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultReason ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.ok === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.status === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.reason ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.inputContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.inputReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.inputSanitized === true,
      crpFulfillClientAdapterNoopResultSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultAdapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultCrpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.adapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.crpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.productionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResult?.sideEffectFree === true,
      crpFulfillClientAdapterDecisionGateObservedAfterNoopResult:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterNoopResultObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateReason ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.status === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.reason ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.blockedBy ===
          "production_release_crp_fulfill_client_adapter_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.inputContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.inputReady === true,
      crpFulfillClientAdapterDecisionGateBlocksRelease:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateAllowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateAllowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.productionRelease === false,
      crpFulfillClientAdapterDecisionGateSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateAdapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateCrpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.adapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.crpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGate?.sideEffectFree === true,
      crpFulfillClientAdapterInvocationGateObservedAfterDecisionGate:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDecisionGateObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateMode === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateReason ===
          "production_release_crp_fulfill_client_adapter_invocation_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_invocation_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.mode === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.status === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.reason ===
          "production_release_crp_fulfill_client_adapter_invocation_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.blockedBy ===
          "production_release_crp_fulfill_client_adapter_invocation_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.decisionGateStatus ===
          "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.inputContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.inputReady === true,
      crpFulfillClientAdapterInvocationGateBlocksRelease:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateAllowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateAllowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.productionRelease === false,
      crpFulfillClientAdapterInvocationGateSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateAdapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateCrpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.adapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.crpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGate?.sideEffectFree === true,
      crpFulfillClientAdapterDryRunInvocationObservedAfterInvocationGate:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterInvocationGateObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationMode === "dry_run" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationStatus === "would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReason ===
          "production_release_crp_fulfill_client_adapter_dry_run_would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.mode === "dry_run" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.status ===
          "would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.reason ===
          "production_release_crp_fulfill_client_adapter_dry_run_would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.invocationGateStatus ===
          "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.inputContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.inputReady === true,
      crpFulfillClientAdapterDryRunInvocationBlocksRelease:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationAllowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.productionRelease ===
          false,
      crpFulfillClientAdapterDryRunInvocationSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationAdapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationExternalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationCrpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationSideEffectFree === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.crpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationResult?.sideEffectFree ===
          true,
      crpFulfillClientAdapterDryRunInvocationReceiptEmittedAfterDryRunInvocation:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationObserved === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptEmitted === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.dryRunInvocationReceipt.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptReason ===
          "production_release_crp_fulfill_client_adapter_dry_run_invocation_recorded" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.contract ===
          "phase3.productionRelease.crpFulfillClientAdapter.dryRunInvocationReceipt.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.mode ===
          "dry_run" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.status ===
          "recorded" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.reason ===
          "production_release_crp_fulfill_client_adapter_dry_run_invocation_recorded",
      crpFulfillClientAdapterDryRunInvocationReceiptPreservesAdapterContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.adapter
          ?.invocationStatus === "would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.adapter
          ?.invocationReason ===
          "production_release_crp_fulfill_client_adapter_dry_run_would_invoke" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.adapter
          ?.invocationGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.adapter
          ?.invocationGateReason ===
          "production_release_crp_fulfill_client_adapter_invocation_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.input?.contract ===
          "phase3.productionRelease.crpFulfillClientAdapter.input.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.input?.ready ===
          true,
      crpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.adapterInvoked === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.crpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.crpFulfillCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.productionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterDryRunInvocationReceipt?.safety
          ?.sideEffectFree === true,
      crpFulfillClientAdapterResultContractObservedAfterHandoffReadiness:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterHandoffReadinessReady === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractRequired === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractAvailable === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContract ===
          "phase3.productionRelease.crpFulfillClientAdapter.resultContract.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractMode ===
          "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractReady === false,
      crpFulfillClientAdapterResultContractDefinesExpectedShape:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape?.ok ===
          "boolean" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape?.status ===
          "success|disabled|would_invoke|failed" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape
          ?.receiptJwsPresent === "boolean" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape
          ?.receiptPayloadPresent === "boolean" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape?.txHash ===
          "string|null" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape
          ?.settlementStatus === "string|null" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape
          ?.productionReleaseAuthorized === "boolean" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExpectedShape
          ?.sideEffectFree === "boolean",
      crpFulfillClientAdapterResultContractBlocksExecution:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractAllowsProductionRelease ===
          false,
      crpFulfillClientAdapterResultContractSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractCrpCalled === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractSideEffectFree ===
          true,
      crpFulfillClientAdapterResultContractNoopResultInactiveUntilResultContractAvailable:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResult === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultContractNoopResult === null,
      crpFulfillClientAdapterResultContractNoopResultObservedAfterResultContract:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractAvailable === true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultStatus ===
          "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultReason ===
          "production_release_crp_fulfill_client_adapter_result_contract_noop_disabled",
      crpFulfillClientAdapterResultContractNoopResultMatchesResultContractShape:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.ok === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.status ===
          "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.reason ===
          "production_release_crp_fulfill_client_adapter_result_contract_noop_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.mode ===
          "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.httpStatus ===
          null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.crpStatus ===
          null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.receiptJwsPresent === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.receiptPayloadPresent === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.txHash ===
          null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.settlementStatus === null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.errorCode === null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.errorMessage === null &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.productionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.sideEffectFree === true,
      crpFulfillClientAdapterResultContractNoopResultBlocksExecution:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.allowsProductionRelease === false,
      crpFulfillClientAdapterResultContractNoopResultSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResult
          ?.crpFulfillCalled === false,

      crpFulfillClientAdapterResultDecisionGateInactiveUntilNoopResultObserved:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGate === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultDecisionGate === null,
      crpFulfillClientAdapterResultDecisionGateObservedAfterNoopResult:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultContractNoopResultObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateStatus ===
          "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateReason ===
          "production_release_crp_fulfill_client_adapter_result_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_disabled",
      crpFulfillClientAdapterResultDecisionGateBlocksExecution:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.productionRelease === false,
      crpFulfillClientAdapterResultDecisionGatePreservesResultContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultStatus ===
          "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultReason ===
          "production_release_crp_fulfill_client_adapter_result_contract_noop_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate?.resultMode ===
          "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.receiptJwsPresent === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.receiptPayloadPresent === false,
      crpFulfillClientAdapterResultDecisionGateSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGateSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultDecisionGate
          ?.crpFulfillCalled === false,

      crpFulfillClientAdapterResultConsumptionContractInactiveUntilHandlingGateObserved:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContract === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionContract === null,
      crpFulfillClientAdapterResultConsumptionContractObservedAfterHandlingGate:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultHandlingGateObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractMode ===
          "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractReady ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_consumption_contract_only",
      crpFulfillClientAdapterResultConsumptionContractDefinesExpectedShape:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.contract ===
          "phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionContract.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.expectedShape?.contract ===
          "phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionContract.v1" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractExpectedShape
          ?.safety?.sideEffectFree === "boolean",
      crpFulfillClientAdapterResultConsumptionContractBlocksResultConsumption:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsResultConsumption ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.allowsResultConsumption === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.productionRelease === false,
      crpFulfillClientAdapterResultConsumptionContractPreservesHandlingContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.handlingGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.handlingGateReason ===
          "production_release_crp_fulfill_client_adapter_result_handling_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.handlingGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_handling_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.decisionGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.resultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.resultMode === "contract_only",
      crpFulfillClientAdapterResultConsumptionContractSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContract
          ?.crpFulfillCalled === false,


      crpFulfillClientAdapterResultConsumptionDecisionGateInactiveUntilConsumptionContractAvailable:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate === null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate === null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate === null,
      crpFulfillClientAdapterResultConsumptionDecisionGateObservedAfterConsumptionContract:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionContractAvailable ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateStatus ===
          "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_consumption_disabled",
      crpFulfillClientAdapterResultConsumptionDecisionGateBlocksResultConsumption:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsResultConsumption ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.allowsResultConsumption === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.productionRelease === false,
      crpFulfillClientAdapterResultConsumptionDecisionGatePreservesConsumptionContractContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.consumptionContractMode === "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.consumptionContractReady === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.consumptionContractBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_consumption_contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.consumptionContractAvailable === true,
      crpFulfillClientAdapterResultConsumptionDecisionGatePreservesHandlingContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.handlingGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.handlingGateReason ===
          "production_release_crp_fulfill_client_adapter_result_handling_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.handlingGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_handling_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.decisionGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.resultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.resultMode === "contract_only",
      crpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGate
          ?.crpFulfillCalled === false,


      crpFulfillClientAdapterResultConsumptionNoopResultInactiveUntilDecisionGateObserved:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult ===
          null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult ===
          null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult ===
          null,
      crpFulfillClientAdapterResultConsumptionNoopResultObservedAfterDecisionGate:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDecisionGateObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultStatus ===
          "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_noop_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.ok ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.mode ===
          "contract_only",
      crpFulfillClientAdapterResultConsumptionNoopResultPreservesDecisionGateContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.decisionGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.decisionGateReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.decisionGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_consumption_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.consumptionContractMode === "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.handlingGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.resultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.resultMode === "contract_only",
      crpFulfillClientAdapterResultConsumptionNoopResultBlocksResultConsumption:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsResultConsumption ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.allowsResultConsumption === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.productionRelease === false,
      crpFulfillClientAdapterResultConsumptionNoopResultDoesNotConsumeReceipt:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultResultConsumed ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultReceiptConsumed ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.resultConsumed === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.receiptConsumed === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.receiptJwsPresent === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.receiptPayloadPresent === false,
      crpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResult
          ?.crpFulfillCalled === false,


      crpFulfillClientAdapterResultConsumptionHandlingGateInactiveUntilNoopResultObserved:
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved ===
          false &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus ===
          "inactive" &&
        switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate ===
          null &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved ===
          false &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus ===
          "inactive" &&
        switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate ===
          null &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved ===
          false &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus ===
          "inactive" &&
        switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate ===
          null,
      crpFulfillClientAdapterResultConsumptionHandlingGateObservedAfterNoopResult:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopResultObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateRequired ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus ===
          "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_handling_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy ===
          "production_release_crp_fulfill_client_adapter_result_consumption_handling_disabled",
      crpFulfillClientAdapterResultConsumptionHandlingGatePreservesNoopResultContext:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.noopResultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.noopResultReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_noop_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.noopResultMode === "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.decisionGateStatus === "blocked" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.decisionGateReason ===
          "production_release_crp_fulfill_client_adapter_result_consumption_disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.consumptionContractMode === "contract_only" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.resultStatus === "disabled" &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.resultMode === "contract_only",
      crpFulfillClientAdapterResultConsumptionHandlingGateBlocksResultConsumption:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsResultConsumption ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsCrpFulfill ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAllowsProductionRelease ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.allowsResultConsumption === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.allowsCrpFulfill === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.allowsProductionRelease === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.productionReleaseAuthorized === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.productionRelease === false,
      crpFulfillClientAdapterResultConsumptionHandlingGateDoesNotConsumeReceipt:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateResultConsumed ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReceiptConsumed ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.resultConsumed === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.receiptConsumed === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.receiptJwsPresent === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.receiptPayloadPresent === false,
      crpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree:
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateAdapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateExternalCallAttempted ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateCrpFulfillCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree ===
          true &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate?.adapterInvoked ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.externalCallAttempted === false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate?.crpCalled ===
          false &&
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.crpFulfillCalled === false,

    crpFulfillClientAdapterResultConsumptionDryRunAuditInactiveUntilHandlingGateObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus ===
        'inactive' &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus ===
        'inactive' &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus ===
        'inactive',
    crpFulfillClientAdapterResultConsumptionDryRunAuditObservedAfterHandlingGate:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateObserved ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditRequired ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus ===
        'recorded' &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_dry_run_audit_recorded',
    crpFulfillClientAdapterResultConsumptionDryRunAuditPreservesHandlingGateContext:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.source?.handlingGateStatus ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateStatus &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.source?.handlingGateReason ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateReason &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.source?.handlingGateBlockedBy ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGateBlockedBy &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.source?.noopResultStatus ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.noopResultStatus &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.source?.noopResultReason ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionHandlingGate
          ?.noopResultReason,
    crpFulfillClientAdapterResultConsumptionDryRunAuditRecordsWouldAuditChecks:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldAuditResultConsumption === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldRequireReceiptJws === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldRequireReceiptPayload === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldRequireFinalizedSettlement === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldRequireTupleBinding === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.audit?.wouldRequireNoReplay === true,
    crpFulfillClientAdapterResultConsumptionDryRunAuditDoesNotConsumeResult:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditResultConsumed ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.result?.resultConsumed === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsResultConsumption ===
        false,
    crpFulfillClientAdapterResultConsumptionDryRunAuditDoesNotConsumeReceipt:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReceiptConsumed ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.result?.receiptConsumed === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.result?.receiptJwsPresent === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.result?.receiptPayloadPresent === false,
    crpFulfillClientAdapterResultConsumptionDryRunAuditSanitized:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.safety?.sanitized === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.safety?.rawProofIncluded === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.safety?.rawReceiptIncluded === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
        ?.safety?.jwsIncluded === false,
    crpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree ===
        true &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree ===
        true &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAdapterInvoked ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditExternalCallAttempted ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpCalled ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditCrpFulfillCalled ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsCrpFulfill ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditAllowsProductionRelease ===
        false,
    crpFulfillClientAdapterResultConsumptionReadinessGateInactiveUntilDryRunAuditObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus ===
        'inactive' &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus ===
        'inactive' &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus ===
        'inactive',
    crpFulfillClientAdapterResultConsumptionReadinessGateObservedAfterDryRunAudit:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditObserved ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateRequired ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus ===
        'blocked' &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_readiness_not_enabled',
    crpFulfillClientAdapterResultConsumptionReadinessGatePreservesDryRunAuditContext:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.source?.dryRunAuditStatus ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditStatus &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.source?.dryRunAuditReason ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditReason &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.source?.dryRunAuditBlockedBy ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditBlockedBy &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.source?.dryRunAuditContract ===
        switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionDryRunAuditArtifact
          ?.contract,
    crpFulfillClientAdapterResultConsumptionReadinessGateRecordsReadinessChecklist:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.dryRunAuditObserved === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.dryRunAuditSanitized === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldAuditResultConsumption === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldRequireReceiptJws === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldRequireReceiptPayload === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldRequireFinalizedSettlement === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldRequireTupleBinding === true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.audit?.wouldRequireNoReplay === true,
    crpFulfillClientAdapterResultConsumptionReadinessGateBlocksConsumption:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsResultConsumption ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsReceiptConsumption ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.readiness?.resultConsumptionEnabled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.readiness?.receiptConsumptionEnabled === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.readiness?.productionReleaseAuthorizationEnabled === false,
    crpFulfillClientAdapterResultConsumptionReadinessGateDoesNotConsumeResultOrReceipt:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateResultConsumed ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReceiptConsumed ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.result?.resultConsumed === false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGate
        ?.result?.receiptConsumed === false,
    crpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree ===
        true &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree ===
        true &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAdapterInvoked ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateExternalCallAttempted ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpCalled ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateCrpFulfillCalled ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsCrpFulfill ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateAllowsProductionRelease ===
        false,
    crpFulfillClientAdapterResultConsumptionEnablementGateInactiveUntilReadinessObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved ===
        false &&
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ===
        'inactive' &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ===
        'inactive' &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ===
        'inactive',
    crpFulfillClientAdapterResultConsumptionEnablementGateObservedAfterReadinessGate:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired ===
        true &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved ===
        true,
    crpFulfillClientAdapterResultConsumptionEnablementGateBlockedByDefault:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ===
        'blocked' &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_enablement_disabled' &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy ===
        'production_release_crp_fulfill_client_adapter_result_consumption_enablement_disabled',
    crpFulfillClientAdapterResultConsumptionEnablementGateRecognizesEnablementFlag:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus ===
        'enabled' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_enablement_enabled' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateBlockedBy ===
        null &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.enablement?.enabled === true,
    crpFulfillClientAdapterResultConsumptionEnablementGatePreservesReadinessContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.source?.readinessGateStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateStatus &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.source?.readinessGateReason ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateReason &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.source?.readinessGateBlockedBy ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReadinessGateBlockedBy &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.source?.dryRunAuditObserved === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.source?.dryRunAuditSanitized === true,
    crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotConsumeResult:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateResultConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.result?.resultConsumed === false,
    crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotConsumeReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.result?.receiptConsumed === false,
    crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGate
        ?.enablement?.allowsProductionRelease === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,
    crpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree:
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionActivationPreflightInactiveUntilEnablementGateEnabled:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateEnabled ===
        true,
    crpFulfillClientAdapterResultConsumptionActivationPreflightObservedAfterEnablementGateEnabled:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus ===
        'preflight_ready' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_activation_preflight_ready',
    crpFulfillClientAdapterResultConsumptionActivationPreflightPreservesEnablementContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.source?.enablementGateStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateStatus &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.source?.enablementGateReason ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionEnablementGateReason &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.source?.enablementGateEnabled === true,
    crpFulfillClientAdapterResultConsumptionActivationPreflightRecordsRequiredChecks:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.preflight?.receiptJwsRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.preflight?.receiptPayloadRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.preflight?.finalizedSettlementRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.preflight?.tupleBindingRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.preflight?.replayProtectionRequired === true,
    crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotConsumeResult:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightResultConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.safety?.resultConsumed === false,
    crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotConsumeReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.safety?.receiptConsumed === false,
    crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.safety?.replayTouched === false,
    crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflight
        ?.safety?.allowsProductionRelease === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,
    crpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerInactiveUntilActivationPreflightReady:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus ===
        'preflight_ready',
    crpFulfillClientAdapterResultConsumptionNoopConsumerObservedAfterActivationPreflight:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus ===
        'disabled' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_disabled',
    crpFulfillClientAdapterResultConsumptionNoopConsumerDisabledByDefault:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerBlockedBy ===
        'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_disabled' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.status === 'disabled' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.blockedBy ===
        'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_disabled',
    crpFulfillClientAdapterResultConsumptionNoopConsumerPreservesActivationPreflightContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.source?.activationPreflightStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.source?.activationPreflightReason ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightReason &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.source?.enablementGateEnabled === true,
    crpFulfillClientAdapterResultConsumptionNoopConsumerRecordsRequiredChecks:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.requiredChecks?.receiptJwsRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.requiredChecks?.receiptPayloadRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.requiredChecks?.finalizedSettlementRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.requiredChecks?.tupleBindingRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.requiredChecks?.replayProtectionRequired === true,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotConsumeResult:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerResultConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.result?.resultConsumed === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.safety?.resultConsumed === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotConsumeReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.result?.receiptConsumed === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.safety?.receiptConsumed === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotDecodeReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReceiptDecoded ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReceiptDecode ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.result?.receiptDecoded === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotVerifyFinalizedSettlement:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerFinalizedSettlementVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsFinalizedSettlementVerification ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotVerifyTupleBinding:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerTupleBindingVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsTupleBinding ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsReplayCheck ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumer
        ?.consumer?.allowsProductionRelease === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateInactiveUntilNoopConsumerObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus ===
        'disabled',
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObservedAfterNoopConsumer:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus ===
        'blocked' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_noop_consumer_handling_disabled',
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGatePreservesNoopConsumerContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.source?.noopConsumerStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerStatus &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.source?.noopConsumerReason ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerReason &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.source?.activationPreflightStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionActivationPreflightStatus,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlocksConsumption:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsResultConsumption ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptConsumption ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.gate?.allowsResultConsumption === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.gate?.allowsReceiptConsumption === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotDecodeReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReceiptDecoded ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReceiptDecode ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotVerifySettlementOrTuple:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateFinalizedSettlementVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateTupleBindingVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsFinalizedSettlementVerification ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsTupleBinding ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsReplayCheck ===
        false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGate
        ?.gate?.allowsProductionRelease === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,
    crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightInactiveUntilNoopConsumerHandlingGateObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus ===
        'blocked',
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObservedAfterNoopConsumerHandlingGate:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightStatus ===
        'preflight_ready' &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReason ===
        'production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_preflight_ready',
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightPreservesHandlingGateContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.source?.noopConsumerHandlingGateStatus ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateStatus &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.source?.noopConsumerHandlingGateReason ===
        switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateReason &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.source?.enablementGateEnabled === true,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRecordsReceiptMaterialRequirements:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.receiptMaterial?.receiptJwsRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.receiptMaterial?.receiptPayloadRequired === true,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotObserveReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptJwsPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.receiptMaterial?.receiptJwsPresent === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.receiptMaterial?.receiptPayloadPresent === false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotConsumeReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptMaterialConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.receiptMaterial?.receiptMaterialConsumed === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.safety?.receiptConsumed === false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotDecodeOrParseReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptDecoded ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReceiptPayloadParsed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptDecode ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReceiptPayloadParse ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotVerifySettlementOrTuple:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightFinalizedSettlementVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightTupleBindingVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsFinalizedSettlementVerification ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsTupleBinding ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsReplayCheck ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflight
        ?.safety?.productionReleaseAuthorized === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateInactiveUntilReceiptMaterialPreflightObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObservedAfterReceiptMaterialPreflight:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateStatus ===
        "blocked" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReason ===
        "production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_handling_disabled" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlockedBy ===
        "production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_handling_disabled",

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGatePreservesPreflightContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.source?.receiptMaterialPreflightStatus === "preflight_ready" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.source?.receiptMaterialPreflightReason ===
        "production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_preflight_ready" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.source?.receiptMaterialPreflightContract ===
        "phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptMaterialPreflight.v1",

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRecordsReceiptMaterialRequirements:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptJwsRequired === true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptPayloadRequired === true,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlocksHandling:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptHandling ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialHandled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.gate?.allowsReceiptHandling === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptMaterialHandled === false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotObserveReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptJwsPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptJwsPresent === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptPayloadPresent === false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotConsumeReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptMaterialConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.receiptMaterial?.receiptMaterialConsumed === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.safety?.receiptConsumed === false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotDecodeOrParseReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptDecoded ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReceiptPayloadParsed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptDecode ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReceiptPayloadParse ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotVerifySettlementOrTuple:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateFinalizedSettlementVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateTupleBindingVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsFinalizedSettlementVerification ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsTupleBinding ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsReplayCheck ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGate
        ?.safety?.productionReleaseAuthorized === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,

    crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateCrpFulfillCalled ===
        false,
    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightInactiveUntilReceiptMaterialHandlingGateObserved:
      switchOffDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired ===
        false &&
      switchOffDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired ===
        false &&
      switchOnDryRunOff.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired ===
        false &&
      switchOnDryRunOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObservedAfterReceiptMaterialHandlingGate:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObserved ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightStatus ===
        "preflight_ready" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReason ===
        "production_release_crp_fulfill_client_adapter_result_consumption_receipt_decode_preflight_ready" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightBlockedBy ===
        null,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightPreservesHandlingGateContext:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.source?.receiptMaterialHandlingGateStatus === "blocked" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.source?.receiptMaterialHandlingGateReason ===
        "production_release_crp_fulfill_client_adapter_result_consumption_receipt_material_handling_disabled" &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.source?.receiptMaterialHandlingGateContract ===
        "phase3.productionRelease.crpFulfillClientAdapter.resultConsumptionReceiptMaterialHandlingGate.v1",

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRecordsDecodeRequirements:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecodeRequired ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.preflight?.wouldRequireReceiptDecode === true,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotObserveReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptJwsPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadPresent ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.receiptDecode?.receiptJwsPresent === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.receiptDecode?.receiptPayloadPresent === false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotHandleOrConsumeReceiptMaterial:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialHandled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptMaterialConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptConsumed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptHandling ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotDecodeOrParseReceipt:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptDecoded ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReceiptPayloadParsed ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptDecode ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReceiptPayloadParse ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotVerifySettlementOrTuple:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightFinalizedSettlementVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightTupleBindingVerified ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsFinalizedSettlementVerification ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsTupleBinding ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotTouchReplay:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightReplayTouched ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsReplayCheck ===
        false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotAuthorizeProductionRelease:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAllowsProductionRelease ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflight
        ?.safety?.productionReleaseAuthorized === false &&
      switchOnDryRunOnResultConsumptionOn.productionRelease === false,

    crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree:
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree ===
        true &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightAdapterInvoked ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightExternalCallAttempted ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpCalled ===
        false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseCrpFulfillClientAdapterResultConsumptionReceiptDecodePreflightCrpFulfillCalled ===
        false,
    adapterStillNotInvoked:
      switchOnDryRunOn.productionReleaseAdapterInvoked === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseAdapterInvoked === false &&
      switchOnDryRunOn.productionReleaseAdapterBlockedBy === "production_release_adapter_disabled" &&
      switchOnDryRunOn.productionReleaseAdapterInputPreview?.safety?.adapterInvoked === false &&
      switchOnDryRunOn.productionReleaseAdapterNoopResult?.adapterInvoked === false,

    externalAdapterCallStillFalse:
      switchOffDryRunOff.productionReleaseAdapterExternalCallAttempted === false &&
      switchOffDryRunOn.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOff.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOn.productionReleaseAdapterExternalCallAttempted === false &&
      switchOnDryRunOnResultConsumptionOn.productionReleaseAdapterExternalCallAttempted === false &&
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
    switchOnDryRunOnResultConsumptionOn,
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
  assert.equal(summary.crpFulfillClientAdapterInputBuiltAfterContractRequired, true);
  assert.equal(summary.crpFulfillClientAdapterInputSanitizedAndSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterNoopResultObservedAfterInputReady, true);
  assert.equal(summary.crpFulfillClientAdapterNoopResultSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterDecisionGateObservedAfterNoopResult, true);
  assert.equal(summary.crpFulfillClientAdapterDecisionGateBlocksRelease, true);
  assert.equal(summary.crpFulfillClientAdapterDecisionGateSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterInvocationGateObservedAfterDecisionGate, true);
  assert.equal(summary.crpFulfillClientAdapterInvocationGateBlocksRelease, true);
  assert.equal(summary.crpFulfillClientAdapterInvocationGateSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationObservedAfterInvocationGate, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationBlocksRelease, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationReceiptEmittedAfterDryRunInvocation, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationReceiptPreservesAdapterContext, true);
  assert.equal(summary.crpFulfillClientAdapterDryRunInvocationReceiptSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractObservedAfterHandoffReadiness, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractDefinesExpectedShape, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractBlocksExecution, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractNoopResultInactiveUntilResultContractAvailable, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractNoopResultObservedAfterResultContract, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractNoopResultMatchesResultContractShape, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractNoopResultBlocksExecution, true);
  assert.equal(summary.crpFulfillClientAdapterResultContractNoopResultSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultDecisionGateInactiveUntilNoopResultObserved, true);
  assert.equal(summary.crpFulfillClientAdapterResultDecisionGateObservedAfterNoopResult, true);
  assert.equal(summary.crpFulfillClientAdapterResultDecisionGateBlocksExecution, true);
  assert.equal(summary.crpFulfillClientAdapterResultDecisionGatePreservesResultContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultDecisionGateSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractInactiveUntilHandlingGateObserved, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractObservedAfterHandlingGate, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractDefinesExpectedShape, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractBlocksResultConsumption, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractPreservesHandlingContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionContractSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGateInactiveUntilConsumptionContractAvailable, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGateObservedAfterConsumptionContract, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGateBlocksResultConsumption, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGatePreservesConsumptionContractContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGatePreservesHandlingContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDecisionGateSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultInactiveUntilDecisionGateObserved, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultObservedAfterDecisionGate, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultPreservesDecisionGateContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultBlocksResultConsumption, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultDoesNotConsumeReceipt, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionNoopResultSideEffectFree, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGateInactiveUntilNoopResultObserved, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGateObservedAfterNoopResult, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGatePreservesNoopResultContext, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGateBlocksResultConsumption, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGateDoesNotConsumeReceipt, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionHandlingGateSideEffectFree, true);
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditInactiveUntilHandlingGateObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditObservedAfterHandlingGate,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditPreservesHandlingGateContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditRecordsWouldAuditChecks,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditDoesNotConsumeResult,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionDryRunAuditDoesNotConsumeReceipt,
    true,
  );
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDryRunAuditSanitized, true);
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionDryRunAuditSideEffectFree, true);
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGateInactiveUntilDryRunAuditObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGateObservedAfterDryRunAudit,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGatePreservesDryRunAuditContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGateRecordsReadinessChecklist,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGateBlocksConsumption,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReadinessGateDoesNotConsumeResultOrReceipt,
    true,
  );
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionReadinessGateSideEffectFree, true);
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateInactiveUntilReadinessObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateObservedAfterReadinessGate,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateBlockedByDefault,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateRecognizesEnablementFlag,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGatePreservesReadinessContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotConsumeResult,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotConsumeReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionEnablementGateDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionEnablementGateSideEffectFree, true);
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightInactiveUntilEnablementGateEnabled,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightObservedAfterEnablementGateEnabled,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightPreservesEnablementContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightRecordsRequiredChecks,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotConsumeResult,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotConsumeReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionActivationPreflightDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(summary.crpFulfillClientAdapterResultConsumptionActivationPreflightSideEffectFree, true);

  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerInactiveUntilActivationPreflightReady,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerObservedAfterActivationPreflight,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDisabledByDefault,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerPreservesActivationPreflightContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerRecordsRequiredChecks,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotConsumeResult,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotConsumeReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotDecodeReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotVerifyFinalizedSettlement,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotVerifyTupleBinding,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerSideEffectFree,
    true,
  );

  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateInactiveUntilNoopConsumerObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateObservedAfterNoopConsumer,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGatePreservesNoopConsumerContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateBlocksConsumption,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotDecodeReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotVerifySettlementOrTuple,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionNoopConsumerHandlingGateSideEffectFree,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightInactiveUntilNoopConsumerHandlingGateObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightObservedAfterNoopConsumerHandlingGate,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightPreservesHandlingGateContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightRecordsReceiptMaterialRequirements,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotObserveReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotConsumeReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotDecodeOrParseReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotVerifySettlementOrTuple,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialPreflightSideEffectFree,
    true,
  );

  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateInactiveUntilReceiptMaterialPreflightObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateObservedAfterReceiptMaterialPreflight,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGatePreservesPreflightContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateRecordsReceiptMaterialRequirements,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateBlocksHandling,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotObserveReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotConsumeReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotDecodeOrParseReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotVerifySettlementOrTuple,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptMaterialHandlingGateSideEffectFree,
    true,
  );

  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightInactiveUntilReceiptMaterialHandlingGateObserved,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightObservedAfterReceiptMaterialHandlingGate,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightPreservesHandlingGateContext,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightRecordsDecodeRequirements,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotObserveReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotHandleOrConsumeReceiptMaterial,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotDecodeOrParseReceipt,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotVerifySettlementOrTuple,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotTouchReplay,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightDoesNotAuthorizeProductionRelease,
    true,
  );
  assert.equal(
    summary.crpFulfillClientAdapterResultConsumptionReceiptDecodePreflightSideEffectFree,
    true,
  );
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
