#!/usr/bin/env node
/**
 * scripts/ci_phase3_production_release_disabled_boundary.ts
 *
 * PR #171 regression harness.
 *
 * Asserts that Phase 3 production release remains disabled.
 *
 * This harness intentionally distinguishes test-only release from production
 * release:
 *
 *   - PHASE3_GATEWAY_RELEASE_ENABLED=true and PHASE3_GATEWAY_TEST_RELEASE_ONLY=true
 *     may allow a valid test-only PAYMENT-RESPONSE/resource release.
 *
 *   - PHASE3_GATEWAY_RELEASE_ENABLED=true without the test-only flag may still
 *     allow release when a verified finalized receipt is submitted, but it must
 *     not claim production release.
 *
 *   - guarded negative runtime decisions must remain blocked and must not claim
 *     production release.
 *
 * This harness does not require CRP, CRP fulfill, or a live wallet.
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

const TEST_ONLY_GATEWAY_PORT = Number(process.env.PHASE3_PROD_DISABLED_TEST_ONLY_PORT || 3087);
const TEST_ONLY_JWKS_PORT = Number(process.env.PHASE3_PROD_DISABLED_TEST_ONLY_JWKS_PORT || 8097);

const RELEASE_FLAG_ONLY_GATEWAY_PORT = Number(process.env.PHASE3_PROD_DISABLED_RELEASE_FLAG_ONLY_PORT || 3088);
const RELEASE_FLAG_ONLY_JWKS_PORT = Number(process.env.PHASE3_PROD_DISABLED_RELEASE_FLAG_ONLY_JWKS_PORT || 8098);

const GUARDED_NEGATIVE_GATEWAY_PORT = Number(process.env.PHASE3_PROD_DISABLED_GUARDED_NEGATIVE_PORT || 3089);
const GUARDED_NEGATIVE_JWKS_PORT = Number(process.env.PHASE3_PROD_DISABLED_GUARDED_NEGATIVE_JWKS_PORT || 8099);

const LABEL = "phase3:production-release-disabled-boundary-test";
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

function assertNoProductionRelease(decision: any, label: string) {
  assert.notEqual(decision?.productionRelease, true, `${label}: productionRelease must never be true`);
  assert.notEqual(
    decision?.canonicalReleasePersisted,
    true,
    `${label}: canonicalReleasePersisted must not be claimed as true`,
  );
  assert.notEqual(decision?.crpFulfillCalled, true, `${label}: CRP fulfill must not be called`);
  assert.notEqual(decision?.rawProofPrinted, true, `${label}: raw proof must not be printed`);
  assert.notEqual(decision?.rawReceiptPrinted, true, `${label}: raw receipt must not be printed`);
}

async function withGatewayStack<T>(input: {
  label: string;
  gatewayPort: number;
  jwksPort: number;
  releaseEnabled: boolean;
  testReleaseOnly: boolean;
  forceRuntimeDecisionContextMismatch: boolean;
  run: (ctx: { baseUrl: string; jwksPort: number; jwksUrl: string }) => Promise<T>;
}): Promise<T> {
  const baseUrl = base(input.gatewayPort);
  const url = jwksUrl(input.jwksPort);

  console.log(`[${input.label}] BASE=${baseUrl}`);
  console.log(`[${input.label}] JWKS_URL=${url}`);

  if (await isPortOpen(input.gatewayPort)) {
    throw new Error(`gateway port ${input.gatewayPort} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(input.jwksPort)) {
    throw new Error(`JWKS port ${input.jwksPort} is already open. Stop the existing issuer and retry.`);
  }

  const previous = {
    PHASE3_GATEWAY_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    PHASE3_REQUIRE_LIVE_ZKP: process.env.PHASE3_REQUIRE_LIVE_ZKP,
    CRP_JWKS_URL: process.env.CRP_JWKS_URL,
    X402_ALLOW_DEV_HARNESS: process.env.X402_ALLOW_DEV_HARNESS,
    X402_DEBUG: process.env.X402_DEBUG,
    PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH:
      process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = input.releaseEnabled ? "true" : "false";

  if (input.testReleaseOnly) {
    process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  } else {
    delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  }

  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";
  process.env.CRP_JWKS_URL = url;
  process.env.X402_ALLOW_DEV_HARNESS = "true";
  process.env.X402_DEBUG = "true";

  if (input.forceRuntimeDecisionContextMismatch) {
    process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH = "true";
  } else {
    delete process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH;
  }

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

async function setupPolicyAndReceipt(baseUrl: string, jwksPort: number) {
  const pr = await issuePaidGatedChallenge(baseUrl);

  const redeem = await redeemEligiblePolicy(baseUrl, pr);
  assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
  assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
  assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
  assert.equal(redeem.json?.policyDecision?.allowed, true);
  assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

  const receiptJws = await mintReceiptJws(pr, jwksPort);

  return { pr, redeem, receiptJws };
}

async function runReleaseAttempt(baseUrl: string, nonce: string, receiptJws: string) {
  let res = null as Awaited<ReturnType<typeof request>> | null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    res = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(nonce)}`, {
      headers: {
        "PAYMENT-SIGNATURE": paymentSignatureB64(nonce),
        "X402-RECEIPT": receiptJws,
      },
    });

    if (
      res.status === 402 &&
      res.json?.error === "Policy requirements not yet satisfied"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }

    return res;
  }

  assert.ok(res, "release attempt response should be present");
  return res;
}

async function runTestOnlyPositiveScenario() {
  return await withGatewayStack({
    label: `${LABEL}:test-only-positive`,
    gatewayPort: TEST_ONLY_GATEWAY_PORT,
    jwksPort: TEST_ONLY_JWKS_PORT,
    releaseEnabled: true,
    testReleaseOnly: true,
    forceRuntimeDecisionContextMismatch: false,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
      assert.equal(health.phase3?.requireLiveZkp, false);
      assert.equal(health.jwksUrl, jwksUrl);

      const { pr, redeem, receiptJws } = await setupPolicyAndReceipt(baseUrl, jwksPort);
      const release = await runReleaseAttempt(baseUrl, pr.nonce, receiptJws);

      assert.equal(release.status, 200, `test-only positive release should succeed: ${release.text}`);
      assert.equal(release.headers.get("payment-required"), null);
      assert.ok(release.headers.get("payment-response"), "test-only positive release must emit PAYMENT-RESPONSE");
      assert.equal(release.json?.resource, "secret-data");
      assert.equal(release.json?.paid, true);

      const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assert.equal(decision?.observed, true);
      assert.equal(decision?.enforced, true);
      assert.equal(decision?.ok, true);
      assert.equal(decision?.reason, "release_authorized");
      assert.equal(decision?.paymentResponseAllowed, true);
      assert.equal(decision?.resourceReleaseAllowed, true);
      assert.equal(decision?.productionRelease, false);
      assertNoProductionRelease(decision, "test-only positive");

      return {
        gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
        requireLiveZkp: health.phase3.requireLiveZkp,
        eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
        verifiedFinalizedReceiptSubmitted: receiptJws.length > 0,
        releaseStatus: release.status,
        paymentResponseEmitted: release.headers.get("payment-response") !== null,
        resourceReleased: release.json?.resource === "secret-data",
        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        runtimeDecisionReason: decision?.reason,
        paymentResponseAllowed: decision?.paymentResponseAllowed,
        resourceReleaseAllowed: decision?.resourceReleaseAllowed,
        productionReleaseAuthorized: decision?.productionRelease,
        canonicalReleasePersisted: decision?.canonicalReleasePersisted,
        crpCalled: decision?.crpCalled,
        crpFulfillCalled: decision?.crpFulfillCalled,
        rawProofPrinted: decision?.rawProofPrinted,
        rawReceiptPrinted: decision?.rawReceiptPrinted,
      };
    },
  });
}

async function runReleaseFlagOnlyScenario() {
  return await withGatewayStack({
    label: `${LABEL}:release-flag-only`,
    gatewayPort: RELEASE_FLAG_ONLY_GATEWAY_PORT,
    jwksPort: RELEASE_FLAG_ONLY_JWKS_PORT,
    releaseEnabled: true,
    testReleaseOnly: false,
    forceRuntimeDecisionContextMismatch: false,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
      assert.equal(health.phase3?.requireLiveZkp, false);
      assert.equal(health.jwksUrl, jwksUrl);

      const { pr, redeem, receiptJws } = await setupPolicyAndReceipt(baseUrl, jwksPort);
      const release = await runReleaseAttempt(baseUrl, pr.nonce, receiptJws);

      assert.equal(
        release.status,
        200,
        `release flag + verified receipt currently releases resource, but must not claim production release: ${release.text}`,
      );
      assert.equal(release.json?.resource, "secret-data");
      assert.equal(release.json?.paid, true);

      const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assert.equal(decision?.observed, true);
      assert.equal(decision?.enforced, true);
      assert.equal(decision?.ok, true);
      assert.equal(decision?.reason, "release_authorized");
      assert.equal(decision?.paymentResponseAllowed, true);
      assert.equal(decision?.resourceReleaseAllowed, true);
      assert.equal(decision?.productionRelease, false);
      assertNoProductionRelease(decision, "release flag only");

      return {
        gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
        requireLiveZkp: health.phase3.requireLiveZkp,
        eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
        verifiedFinalizedReceiptSubmitted: receiptJws.length > 0,
        releaseStatus: release.status,
        paymentResponseEmitted: release.headers.get("payment-response") !== null,
        resourceReleased: release.json?.resource === "secret-data",
        paid: release.json?.paid === true,
        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        runtimeDecisionReason: decision?.reason,
        paymentResponseAllowed: decision?.paymentResponseAllowed,
        resourceReleaseAllowed: decision?.resourceReleaseAllowed,
        productionReleaseAuthorized: decision?.productionRelease,
        canonicalReleasePersisted: decision?.canonicalReleasePersisted,
        crpCalled: decision?.crpCalled,
        crpFulfillCalled: decision?.crpFulfillCalled,
        rawProofPrinted: decision?.rawProofPrinted,
        rawReceiptPrinted: decision?.rawReceiptPrinted,
      };
    },
  });
}

async function runGuardedNegativeScenario() {
  return await withGatewayStack({
    label: `${LABEL}:guarded-negative`,
    gatewayPort: GUARDED_NEGATIVE_GATEWAY_PORT,
    jwksPort: GUARDED_NEGATIVE_JWKS_PORT,
    releaseEnabled: true,
    testReleaseOnly: true,
    forceRuntimeDecisionContextMismatch: true,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
      assert.equal(health.phase3?.requireLiveZkp, false);
      assert.equal(health.jwksUrl, jwksUrl);

      const { redeem, pr, receiptJws } = await setupPolicyAndReceipt(baseUrl, jwksPort);
      const blocked = await runReleaseAttempt(baseUrl, pr.nonce, receiptJws);

      assert.equal(blocked.status, 402, `guarded negative must remain blocked: ${blocked.text}`);
      assert.equal(blocked.headers.get("payment-response"), null, "guarded negative must not emit PAYMENT-RESPONSE");
      assert.notEqual(blocked.json?.resource, "secret-data", "guarded negative must not release protected resource");
      assert.notEqual(blocked.json?.paid, true, "guarded negative must not report paid=true");
      assert.equal(blocked.json?.debug?.blockedBy, "phase3_runtime_decision_not_authorized");

      const decision = blocked.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assert.equal(decision?.observed, true);
      assert.equal(decision?.enforced, true);
      assert.equal(decision?.ok, false);
      assert.equal(decision?.reason, "receipt_context_mismatch");
      assert.equal(decision?.paymentResponseAllowed, false);
      assert.equal(decision?.resourceReleaseAllowed, false);
      assert.equal(decision?.productionRelease, false);
      assertNoProductionRelease(decision, "guarded negative");

      return {
        gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
        requireLiveZkp: health.phase3.requireLiveZkp,
        eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
        verifiedFinalizedReceiptSubmitted: receiptJws.length > 0,
        blockedStatus: blocked.status,
        blockedBy: blocked.json?.debug?.blockedBy,
        paymentResponseEmitted: blocked.headers.get("payment-response") !== null,
        resourceReleased: blocked.json?.resource === "secret-data",
        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        runtimeDecisionReason: decision?.reason,
        paymentResponseAllowed: decision?.paymentResponseAllowed,
        resourceReleaseAllowed: decision?.resourceReleaseAllowed,
        productionReleaseAuthorized: decision?.productionRelease,
        canonicalReleasePersisted: decision?.canonicalReleasePersisted,
        crpCalled: decision?.crpCalled,
        crpFulfillCalled: decision?.crpFulfillCalled,
        rawProofPrinted: decision?.rawProofPrinted,
        rawReceiptPrinted: decision?.rawReceiptPrinted,
      };
    },
  });
}

async function main() {
  const testOnlyPositive = await runTestOnlyPositiveScenario();
  const releaseFlagOnly = await runReleaseFlagOnlyScenario();
  const guardedNegative = await runGuardedNegativeScenario();

  assert.equal(testOnlyPositive.paymentResponseEmitted, true);
  assert.equal(testOnlyPositive.resourceReleased, true);
  assert.equal(testOnlyPositive.productionReleaseAuthorized, false);

  assert.equal(releaseFlagOnly.gatewayReleaseEnabled, true);
  assert.equal(releaseFlagOnly.gatewayTestReleaseOnly, false);
  assert.equal(releaseFlagOnly.releaseStatus, 200);
  assert.equal(releaseFlagOnly.resourceReleased, true);
  assert.equal(releaseFlagOnly.productionReleaseAuthorized, false);
  assert.equal(releaseFlagOnly.canonicalReleasePersisted, false);

  assert.equal(guardedNegative.blockedStatus, 402);
  assert.equal(guardedNegative.paymentResponseEmitted, false);
  assert.equal(guardedNegative.resourceReleased, false);
  assert.equal(guardedNegative.productionReleaseAuthorized, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.productionReleaseDisabledBoundary.v1",

        testOnlyPositive,
        releaseFlagOnly,
        guardedNegative,

        testOnlyReleaseAllowedButNotProduction:
          testOnlyPositive.paymentResponseEmitted === true &&
          testOnlyPositive.resourceReleased === true &&
          testOnlyPositive.productionReleaseAuthorized === false,

        releaseFlagOnlyMayReleaseButNotProduction:
          releaseFlagOnly.gatewayReleaseEnabled === true &&
          releaseFlagOnly.gatewayTestReleaseOnly === false &&
          releaseFlagOnly.releaseStatus === 200 &&
          releaseFlagOnly.resourceReleased === true &&
          releaseFlagOnly.productionReleaseAuthorized === false &&
          releaseFlagOnly.canonicalReleasePersisted === false,

        guardedNegativeStillBlocked:
          guardedNegative.blockedStatus === 402 &&
          guardedNegative.paymentResponseEmitted === false &&
          guardedNegative.resourceReleased === false &&
          guardedNegative.productionReleaseAuthorized === false,

        productionReleaseNeverAuthorized:
          testOnlyPositive.productionReleaseAuthorized === false &&
          releaseFlagOnly.productionReleaseAuthorized === false &&
          guardedNegative.productionReleaseAuthorized === false,

        crpFulfillCalled:
          testOnlyPositive.crpFulfillCalled === true || guardedNegative.crpFulfillCalled === true,
        rawProofPrinted:
          testOnlyPositive.rawProofPrinted === true || guardedNegative.rawProofPrinted === true,
        rawReceiptPrinted:
          testOnlyPositive.rawReceiptPrinted === true || guardedNegative.rawReceiptPrinted === true,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
