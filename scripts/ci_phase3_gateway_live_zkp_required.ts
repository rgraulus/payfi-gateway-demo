#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_live_zkp_required.ts
 *
 * PR #132 regression harness.
 *
 * Proves /paid-gated rejects parsed-only policy proof when live Direct Buyer
 * ZKP verification is required.
 *
 * This is intentionally a guard/regression harness. It does not release the
 * protected resource, does not emit PAYMENT-RESPONSE, does not touch replay,
 * does not call CRP fulfill, and does not persist canonical release.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process from "node:process";

import {
  baseUrlForPort,
  buildEligibleEnvelope,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  phase3HarnessDatabaseUrl,
  request,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_LIVE_ZKP_REQUIRED_PORT || 3069);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-live-zkp-required-test";
const isWin = process.platform === "win32";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function startLiveRequiredGateway() {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(GATEWAY_PORT),

    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_GATEWAY_RELEASE_ENABLED: "false",
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: "false",

    // The core PR #132 condition:
    // parsed-only envelopes may still be parsed, but they must not satisfy
    // policy when live ZKP is required.
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "true",

    DATABASE_URL: phase3HarnessDatabaseUrl(),
    ORCHESTRATOR_BASE_URL: process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090",
    ORCHESTRATOR_API_KEY: process.env.ORCHESTRATOR_API_KEY || "dev-internal-key",
    CRP_BASE_URL: process.env.CRP_BASE_URL || "http://127.0.0.1:8080",
    X402_TTL_SEC: process.env.X402_TTL_SEC || "1800",

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const child = spawn(npmCmd(), ["run", "dev"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${LABEL}] gateway spawn error:`, err);
  });

  return child;
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startLiveRequiredGateway();

  const cleanup = async () => {
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, true);

    const pr = await issuePaidGatedChallenge(BASE);
    const envelope = buildEligibleEnvelope(pr);

    const redeem = await request(BASE, "/paid-gated/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nonce: pr.nonce,
        authorizationProof: envelope,
      }),
    });

    assert.equal(redeem.status, 403, `parsed-only redeem must fail when live ZKP is required: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "live-required rejection must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.ok, false);
    assert.equal(redeem.json?.nonce, pr.nonce);
    assert.equal(redeem.json?.code, "verified_proof_required");
    assert.equal(redeem.json?.reason, "verified_proof_required");
    assert.equal(redeem.json?.policyStatus, "POLICY_FAILED");
    assert.equal(redeem.json?.verifier?.ok, true);
    assert.equal(redeem.json?.verifier?.stage, "parsed");
    assert.equal(redeem.json?.verifier?.rawProofPrinted, false);
    assert.equal(redeem.json?.policyDecision?.allowed, false);
    assert.equal(redeem.json?.policyDecision?.code, "verified_proof_required");
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const stillNoRelease = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

    assert.equal(stillNoRelease.status, 402, "failed live-required policy must not release resource");
    assert.ok(stillNoRelease.headers.get("payment-required"), "resource must still require PAYMENT-REQUIRED");
    assert.equal(stillNoRelease.headers.get("payment-response"), null, "failed live-required policy must not emit PAYMENT-RESPONSE");

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          allowParsedOnlyPolicy: health.phase3.allowParsedOnlyPolicy,
          requireLiveZkp: health.phase3.requireLiveZkp,

          parsedOnlyVerifierStage: redeem.json?.verifier?.stage,
          liveRequiredParsedOnlyRejected: redeem.json?.code,
          policyStatus: redeem.json?.policyStatus,

          resourceReleased: false,
          paymentResponseEmitted: false,
          crpCalled: false,
          crpFulfillCalled: false,
          replayTouched: false,
          canonicalReleasePersisted: false,
          rawProofPrinted: false,
          rawReceiptPrinted: false,

          actualGatewayStillReturns402: stillNoRelease.status === 402,
          actualGatewayPaymentResponseEmitted: stillNoRelease.headers.get("payment-response") !== null,
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
