#!/usr/bin/env node
/**
 * scripts/ci_phase3_decision_persistence_boundary.ts
 *
 * PR #170 regression harness.
 *
 * Asserts the Phase 3 decision-layer persistence boundary.
 *
 * The Gateway already has canonical lifecycle/release persistence machinery.
 * This harness does NOT test for the absence of Gateway persistence capability.
 *
 * Instead, it proves the current Phase 3 runtime decision metadata remains
 * explicit and fail-safe:
 *
 *   - test-only PAYMENT-RESPONSE/resource release may happen in the positive path
 *   - Phase 3 runtime decision metadata must still report productionRelease=false
 *   - Phase 3 runtime decision metadata must still report canonicalReleasePersisted=false
 *   - replay after the positive path must not emit another PAYMENT-RESPONSE
 *   - guarded negative path must not emit PAYMENT-RESPONSE or release content
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

const POSITIVE_GATEWAY_PORT = Number(process.env.PHASE3_DECISION_PERSISTENCE_POSITIVE_PORT || 3085);
const POSITIVE_JWKS_PORT = Number(process.env.PHASE3_DECISION_PERSISTENCE_POSITIVE_JWKS_PORT || 8095);

const NEGATIVE_GATEWAY_PORT = Number(process.env.PHASE3_DECISION_PERSISTENCE_NEGATIVE_PORT || 3086);
const NEGATIVE_JWKS_PORT = Number(process.env.PHASE3_DECISION_PERSISTENCE_NEGATIVE_JWKS_PORT || 8096);

const LABEL = "phase3:decision-persistence-boundary-test";
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

function assertPaymentResponseHeader(payloadB64: string | null, pr: any, receiptJws: string) {
  assert.ok(payloadB64, "PAYMENT-RESPONSE header must be present");

  const decoded = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));

  assert.equal(decoded.version, "x402-v2");
  assert.equal(decoded.contractId, pr.contractId);
  assert.equal(decoded.contractVersion, pr.contractVersion);
  assert.equal(decoded.merchantId, pr.merchantId);
  assert.equal(decoded.nonce, pr.nonce);
  assert.equal(decoded.settled, true);
  assert.equal(decoded.resource?.method, "GET");
  assert.equal(decoded.resource?.path, "/paid-gated");
  assert.equal(decoded.receipt?.jws, receiptJws);
  assert.equal(decoded.receipt?.payload?.proofVersion, "ccd-plt-proof@v1");
  assert.equal(decoded.receipt?.payload?.nonce, pr.nonce);
  assert.equal(decoded.receipt?.payload?.settlement?.status, "finalized");
  assert.equal(decoded.receipt?.payload?.contract?.resource?.path, "/paid-gated");

  return decoded;
}

function assertDecisionPersistenceBoundary(decision: any, label: string) {
  assert.equal(decision?.observed, true, `${label}: runtime decision should be observed`);
  assert.equal(decision?.enforced, true, `${label}: runtime decision should be enforced`);
  assert.equal(decision?.productionRelease, false, `${label}: production release must remain false`);
  assert.equal(
    decision?.canonicalReleasePersisted,
    false,
    `${label}: Phase 3 decision layer must not claim canonical release persistence`,
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

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
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

async function runPositiveScenario() {
  return await withGatewayStack({
    label: `${LABEL}:positive`,
    gatewayPort: POSITIVE_GATEWAY_PORT,
    jwksPort: POSITIVE_JWKS_PORT,
    forceRuntimeDecisionContextMismatch: false,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);

      assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
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

        if (
          release.status === 402 &&
          release.json?.error === "Policy requirements not yet satisfied"
        ) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        break;
      }

      assert.ok(release, "release response should be present");
      assert.equal(release.status, 200, `first use must release resource: ${release.text}`);
      assert.equal(release.headers.get("payment-required"), null, "first use must not emit PAYMENT-REQUIRED");
      assert.ok(release.headers.get("payment-response"), "first use must emit PAYMENT-RESPONSE");
      assert.equal(release.json?.ok, true);
      assert.equal(release.json?.paid, true);
      assert.equal(release.json?.resource, "secret-data");

      const paymentResponseHeader = release.headers.get("payment-response");
      const decodedPaymentResponse = assertPaymentResponseHeader(paymentResponseHeader, pr, receiptJws);

      const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assert.equal(decision?.ok, true);
      assert.equal(decision?.reason, "release_authorized");
      assert.equal(decision?.paymentResponseAllowed, true);
      assert.equal(decision?.resourceReleaseAllowed, true);
      assertDecisionPersistenceBoundary(decision, "positive release");

      const replay = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
        headers: {
          "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
          "X402-RECEIPT": receiptJws,
        },
      });

      assert.equal(replay.status, 402, `replay must return 402: ${replay.text}`);
      assert.equal(replay.headers.get("payment-response"), null, "replay must not emit PAYMENT-RESPONSE");
      assert.notEqual(replay.json?.resource, "secret-data", "replay must not release protected resource");
      assert.notEqual(replay.json?.paid, true, "replay must not report paid=true");

      return {
        gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
        gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
        requireLiveZkp: health.phase3.requireLiveZkp,
        allowDevHarness: health.devHarness.allowDevHarness,
        jwksUrl: health.jwksUrl,

        eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
        verifiedFinalizedReceiptSubmitted: receiptJws.length > 0,

        releaseStatus: release.status,
        paymentResponseEmitted: paymentResponseHeader !== null,
        paymentResponseHeaderValidated: decodedPaymentResponse?.receipt?.jws === receiptJws,
        resourceReleased: release.json?.resource === "secret-data",

        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        runtimeDecisionReason: decision?.reason,
        paymentResponseAllowed: decision?.paymentResponseAllowed,
        resourceReleaseAllowed: decision?.resourceReleaseAllowed,
        productionReleaseAuthorized: decision?.productionRelease,
        decisionCanonicalReleasePersisted: decision?.canonicalReleasePersisted,

        replayRejected: replay.status === 402,
        replayPaymentResponseEmitted: replay.headers.get("payment-response") !== null,
        replayResourceReleased: replay.json?.resource === "secret-data",

        crpCalled: decision?.crpCalled,
        crpFulfillCalled: decision?.crpFulfillCalled,
        decisionReplayTouched: decision?.replayTouched,
        decisionResourceReleased: decision?.resourceReleased,
        rawProofPrinted: decision?.rawProofPrinted,
        rawReceiptPrinted: decision?.rawReceiptPrinted,
      };
    },
  });
}

async function runGuardedNegativeScenario() {
  return await withGatewayStack({
    label: `${LABEL}:guarded-negative`,
    gatewayPort: NEGATIVE_GATEWAY_PORT,
    jwksPort: NEGATIVE_JWKS_PORT,
    forceRuntimeDecisionContextMismatch: true,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);

      assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
      assert.equal(health.phase3?.requireLiveZkp, false);
      assert.equal(health.devHarness?.allowDevHarness, true);
      assert.equal(health.jwksUrl, jwksUrl);

      const pr = await issuePaidGatedChallenge(baseUrl);

      const redeem = await redeemEligiblePolicy(baseUrl, pr);
      assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
      assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
      assert.equal(redeem.json?.policyDecision?.allowed, true);

      const receiptJws = await mintReceiptJws(pr, jwksPort);

      let blocked = null as Awaited<ReturnType<typeof request>> | null;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        blocked = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
          headers: {
            "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
            "X402-RECEIPT": receiptJws,
          },
        });

        if (
          blocked.status === 402 &&
          blocked.json?.error === "Policy requirements not yet satisfied"
        ) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        break;
      }

      assert.ok(blocked, "blocked response should be present");
      assert.equal(blocked.status, 402, `guarded negative must remain blocked: ${blocked.text}`);
      assert.equal(blocked.headers.get("payment-response"), null, "guarded negative must not emit PAYMENT-RESPONSE");
      assert.notEqual(blocked.json?.resource, "secret-data", "guarded negative must not release protected resource");
      assert.notEqual(blocked.json?.paid, true, "guarded negative must not report paid=true");
      assert.equal(blocked.json?.debug?.blockedBy, "phase3_runtime_decision_not_authorized");

      const decision = blocked.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assert.equal(decision?.ok, false);
      assert.equal(decision?.reason, "receipt_context_mismatch");
      assert.equal(decision?.paymentResponseAllowed, false);
      assert.equal(decision?.resourceReleaseAllowed, false);
      assertDecisionPersistenceBoundary(decision, "guarded negative");

      return {
        gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
        gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
        requireLiveZkp: health.phase3.requireLiveZkp,
        allowDevHarness: health.devHarness.allowDevHarness,
        jwksUrl: health.jwksUrl,

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
        decisionCanonicalReleasePersisted: decision?.canonicalReleasePersisted,

        crpCalled: decision?.crpCalled,
        crpFulfillCalled: decision?.crpFulfillCalled,
        decisionReplayTouched: decision?.replayTouched,
        decisionResourceReleased: decision?.resourceReleased,
        rawProofPrinted: decision?.rawProofPrinted,
        rawReceiptPrinted: decision?.rawReceiptPrinted,
      };
    },
  });
}

async function main() {
  const positive = await runPositiveScenario();
  const guardedNegative = await runGuardedNegativeScenario();

  assert.equal(positive.productionReleaseAuthorized, false);
  assert.equal(positive.decisionCanonicalReleasePersisted, false);
  assert.equal(positive.paymentResponseEmitted, true);
  assert.equal(positive.resourceReleased, true);
  assert.equal(positive.replayRejected, true);
  assert.equal(positive.replayPaymentResponseEmitted, false);
  assert.equal(positive.replayResourceReleased, false);

  assert.equal(guardedNegative.productionReleaseAuthorized, false);
  assert.equal(guardedNegative.decisionCanonicalReleasePersisted, false);
  assert.equal(guardedNegative.paymentResponseEmitted, false);
  assert.equal(guardedNegative.resourceReleased, false);
  assert.equal(guardedNegative.runtimeDecisionReason, "receipt_context_mismatch");

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.decisionPersistenceBoundary.v1",

        positive,
        guardedNegative,

        boundaryAsserted:
          positive.productionReleaseAuthorized === false &&
          positive.decisionCanonicalReleasePersisted === false &&
          guardedNegative.productionReleaseAuthorized === false &&
          guardedNegative.decisionCanonicalReleasePersisted === false,

        testOnlyPaymentResponseStillAllowed:
          positive.paymentResponseEmitted === true &&
          positive.resourceReleased === true &&
          positive.runtimeDecisionReason === "release_authorized",

        guardedNegativeStillBlocked:
          guardedNegative.blockedStatus === 402 &&
          guardedNegative.paymentResponseEmitted === false &&
          guardedNegative.resourceReleased === false,

        replayStillBlocked:
          positive.replayRejected === true &&
          positive.replayPaymentResponseEmitted === false &&
          positive.replayResourceReleased === false,

        productionReleaseAuthorized: false,
        decisionCanonicalReleasePersisted: false,
        crpFulfillCalled:
          positive.crpFulfillCalled === true || guardedNegative.crpFulfillCalled === true,
        rawProofPrinted:
          positive.rawProofPrinted === true || guardedNegative.rawProofPrinted === true,
        rawReceiptPrinted:
          positive.rawReceiptPrinted === true || guardedNegative.rawReceiptPrinted === true,
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
