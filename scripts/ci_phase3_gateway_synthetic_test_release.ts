#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_synthetic_test_release.ts
 *
 * PR #130B regression harness.
 *
 * Proves a controlled synthetic Phase 3 Gateway test-only release can happen
 * only when both release guards are explicitly enabled.
 *
 * This is intentionally synthetic and test-only. It does not submit a real
 * receipt JWS, does not emit PAYMENT-RESPONSE, does not touch replay, does not
 * call CRP fulfill, and does not persist canonical release.
 */

import assert from "node:assert/strict";
import process from "node:process";

import {
  baseUrlForPort,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  redeemEligiblePolicy,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_SYNTHETIC_TEST_RELEASE_PORT || 3068);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-synthetic-test-release-test";

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previousReleaseEnabled = process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  const previousTestReleaseOnly = process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    if (previousReleaseEnabled === undefined) {
      delete process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
    } else {
      process.env.PHASE3_GATEWAY_RELEASE_ENABLED = previousReleaseEnabled;
    }

    if (previousTestReleaseOnly === undefined) {
      delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
    } else {
      process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = previousTestReleaseOnly;
    }

    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, true);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);

    const redeem = await redeemEligiblePolicy(BASE, pr);
    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    let release: Response | null = null;
    let releaseText = "";
    let releaseJson: any = null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      release = await fetch(`${BASE}/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);
      releaseText = await release.text();
      releaseJson = releaseText ? JSON.parse(releaseText) : null;

      if (release.status === 200) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(release, "release response should be present");
    assert.equal(release.status, 200, `synthetic release should return 200: ${releaseText}`);
    assert.equal(release.headers.get("payment-response"), null, "synthetic release must not emit PAYMENT-RESPONSE");

    assert.equal(releaseJson?.ok, true);
    assert.equal(releaseJson?.paid, true);
    assert.equal(releaseJson?.nonce, pr.nonce);
    assert.equal(releaseJson?.access, "phase3-synthetic-test-release");
    assert.equal(releaseJson?.resource, "/paid-gated");
    assert.equal(releaseJson?.synthetic, true);

    assert.equal(releaseJson?.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(releaseJson?.phase3?.gatewayReleaseEnabled, true);
    assert.equal(releaseJson?.phase3?.gatewayTestReleaseOnly, true);

    assert.equal(releaseJson?.policy?.status, "POLICY_SATISFIED");

    assert.equal(releaseJson?.safety?.paymentResponseEmitted, false);
    assert.equal(releaseJson?.safety?.crpCalled, false);
    assert.equal(releaseJson?.safety?.crpFulfillCalled, false);
    assert.equal(releaseJson?.safety?.replayTouched, false);
    assert.equal(releaseJson?.safety?.canonicalReleasePersisted, false);
    assert.equal(releaseJson?.safety?.rawProofPrinted, false);
    assert.equal(releaseJson?.safety?.rawReceiptPrinted, false);

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          syntheticReleaseStatus: release.status,
          syntheticReleaseAllowed: releaseJson?.access === "phase3-synthetic-test-release",
          paymentResponseEmitted: release.headers.get("payment-response") !== null,
          crpCalled: releaseJson?.safety?.crpCalled,
          crpFulfillCalled: releaseJson?.safety?.crpFulfillCalled,
          replayTouched: releaseJson?.safety?.replayTouched,
          canonicalReleasePersisted: releaseJson?.safety?.canonicalReleasePersisted,
          rawProofPrinted: releaseJson?.safety?.rawProofPrinted,
          rawReceiptPrinted: releaseJson?.safety?.rawReceiptPrinted,
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
