#!/usr/bin/env node
/**
 * scripts/ci_phase3_guarded_runtime_release_decision_recognition.ts
 *
 * PR #167 regression harness.
 *
 * Proves the Gateway can recognize and enforce a guarded Phase 3 runtime
 * release decision after a verified x402 receipt reaches the runtime decision
 * layer, while still blocking the external release boundary.
 *
 * This intentionally uses a non-production, test-release-only forced context
 * mismatch seam so the runtime decision is observed and enforced, but no
 * PAYMENT-RESPONSE is emitted, no protected content is released, replay is not
 * touched, CRP fulfill is not called, and canonical release is not persisted.
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

const GATEWAY_PORT = Number(
  process.env.PHASE3_GUARDED_RUNTIME_RELEASE_DECISION_RECOGNITION_PORT || 3082,
);
const JWKS_PORT = Number(
  process.env.PHASE3_GUARDED_RUNTIME_RELEASE_DECISION_RECOGNITION_JWKS_PORT || 8092,
);

const BASE = baseUrlForPort(GATEWAY_PORT);
const JWKS_BASE = baseUrlForPort(JWKS_PORT);
const JWKS_URL = `${JWKS_BASE}/.well-known/jwks.json`;
const MINT_URL = `${JWKS_BASE}/mint`;
const LABEL = "phase3:guarded-runtime-release-decision-recognition-test";
const isWin = process.platform === "win32";

function nodeCmd() {
  return isWin ? "node.exe" : "node";
}

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
}

function startDevJwks(): ChildProcess {
  const child = spawn(nodeCmd(), ["scripts/dev_jwks_server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(JWKS_PORT),
    },
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${LABEL}] dev JWKS spawn error:`, err);
  });

  return child;
}

async function waitForJwks(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(JWKS_URL);
      if (res.status === 200) return;
    } catch {
      // issuer still starting
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`dev JWKS did not become ready at ${JWKS_URL}`);
}

function mintUrlFromPaymentRequired(pr: any): string {
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

  const u = new URL(MINT_URL);
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

async function mintReceiptJws(pr: any): Promise<string> {
  const url = mintUrlFromPaymentRequired(pr);
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
  assert.equal(json.payloadPreview?.contract?.resource?.path, "/paid-gated");

  return json.jws;
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

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);
  console.log(`[${LABEL}] JWKS_URL=${JWKS_URL}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`gateway port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(JWKS_PORT)) {
    throw new Error(`JWKS port ${JWKS_PORT} is already open. Stop the existing issuer and retry.`);
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
  process.env.CRP_JWKS_URL = JWKS_URL;
  process.env.X402_ALLOW_DEV_HARNESS = "true";
  process.env.X402_DEBUG = "true";
  process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH = "true";

  const jwks = startDevJwks();
  await waitForJwks();

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await killProcessTree(jwks);
    await waitForPortClosed(GATEWAY_PORT);
    await waitForPortClosed(JWKS_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, true);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);
    assert.equal(health.devHarness?.allowDevHarness, true);
    assert.equal(health.jwksUrl, JWKS_URL);

    const pr = await issuePaidGatedChallenge(BASE);

    const redeem = await redeemEligiblePolicy(BASE, pr);
    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const receiptJws = await mintReceiptJws(pr);

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
        headers: {
          "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
          "X402-RECEIPT": receiptJws,
        },
      });

      if (
        blocked.status === 402 &&
        blocked.json?.debug?.blockedBy === "phase3_runtime_decision_not_authorized"
      ) {
        break;
      }

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
    assert.equal(
      blocked.status,
      402,
      `guarded runtime decision recognition must not cross release boundary: ${blocked.text}`,
    );

    assert.ok(blocked.headers.get("payment-required"), "blocked response must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked response must not emit PAYMENT-RESPONSE");

    assert.equal(blocked.json?.ok, false);
    assert.equal(blocked.json?.paid, false);
    assert.equal(blocked.json?.error, "Phase 3 runtime decision rejected release");
    assert.equal(blocked.json?.debug?.blockedBy, "phase3_runtime_decision_not_authorized");

    const decision = blocked.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
    assert.equal(decision?.observed, true);
    assert.equal(decision?.enforced, true);
    assert.equal(decision?.decisionLayerOnly, false);
    assert.equal(decision?.ok, false);
    assert.equal(decision?.readinessOk, true);
    assert.equal(decision?.readinessStatus, "POLICY_SATISFIED");
    assert.equal(decision?.reason, "receipt_context_mismatch");
    assert.equal(decision?.paymentResponseAllowed, false);
    assert.equal(decision?.resourceReleaseAllowed, false);
    assert.equal(decision?.productionRelease, false);

    assert.equal(decision?.paymentReleaseAttempted, false);
    assert.equal(decision?.paymentResponseEmitted, false);
    assert.equal(decision?.crpCalled, false);
    assert.equal(decision?.crpFulfillCalled, false);
    assert.equal(decision?.replayTouched, false);
    assert.equal(decision?.resourceReleased, false);
    assert.equal(decision?.canonicalReleasePersisted, false);
    assert.equal(decision?.rawProofPrinted, false);
    assert.equal(decision?.rawReceiptPrinted, false);

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.guardedRuntimeReleaseDecisionRecognition.v1",

          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,
          allowDevHarness: health.devHarness.allowDevHarness,
          jwksUrl: health.jwksUrl,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          verifiedReceiptSubmitted: receiptJws.length > 0,

          runtimeDecisionObserved: decision?.observed === true,
          runtimeDecisionEnforced: decision?.enforced === true,
          runtimeDecisionLayerOnly: decision?.decisionLayerOnly === true,
          runtimeDecisionReachedBeforePaymentResponse: true,
          blockedBy: blocked.json?.debug?.blockedBy,
          decisionReason: decision?.reason,

          releaseStatus: blocked.status,
          actualGatewayStillReturns402: blocked.status === 402,
          actualGatewayPaymentRequiredEmitted: blocked.headers.get("payment-required") !== null,
          actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

          paymentResponseAllowed: decision?.paymentResponseAllowed,
          resourceReleaseAllowed: decision?.resourceReleaseAllowed,
          productionReleaseAuthorized: decision?.productionRelease,
          paymentReleaseAttempted: decision?.paymentReleaseAttempted,
          paymentResponseEmitted: decision?.paymentResponseEmitted,
          crpCalled: decision?.crpCalled,
          crpFulfillCalled: decision?.crpFulfillCalled,
          replayTouched: decision?.replayTouched,
          resourceReleased: decision?.resourceReleased,
          canonicalReleasePersisted: decision?.canonicalReleasePersisted,
          rawProofPrinted: decision?.rawProofPrinted,
          rawReceiptPrinted: decision?.rawReceiptPrinted,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
