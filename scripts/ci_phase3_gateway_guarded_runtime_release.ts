#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_guarded_runtime_release.ts
 *
 * PR #135/#136 regression harness.
 *
 * Proves the Gateway runtime recognizes the guarded Phase 3 release branch
 * when both runtime guards are explicitly enabled, but PR #136 now requires
 * an x402 receipt signal before runtime release is allowed.
 *
 * This is intentionally still test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not persist canonical release.
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
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_GUARDED_RUNTIME_RELEASE_PORT || 3070);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-guarded-runtime-release-test";

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previousReleaseEnabled = process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  const previousTestReleaseOnly = process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  const previousRequireLiveZkp = process.env.PHASE3_REQUIRE_LIVE_ZKP;

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";

  // /paid-gated/redeem still parses only; PR #132/#133 cover live-required rejection
  // and live-bound eligibility separately. This harness focuses on guarded
  // runtime recognition and the PR #136 receipt-required block.
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

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

    if (previousRequireLiveZkp === undefined) {
      delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
    } else {
      process.env.PHASE3_REQUIRE_LIVE_ZKP = previousRequireLiveZkp;
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

    let release = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      release = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (
        release.status === 402 &&
        release.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(release, "guarded runtime response should be present");
    assert.equal(
      release.status,
      402,
      `guarded runtime recognition should require receipt before release: ${release.text}`,
    );
    assert.ok(release.headers.get("payment-required"), "guarded runtime block must still emit PAYMENT-REQUIRED");
    assert.equal(release.headers.get("payment-response"), null, "guarded runtime block must not emit PAYMENT-RESPONSE");

    assert.equal(release.json?.ok, false);
    assert.equal(release.json?.paid, false);
    assert.equal(release.json?.error, "Verified x402 receipt required before guarded Phase 3 runtime release");

    assert.equal(release.json?.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(release.json?.phase3?.gatewayReleaseEnabled, true);
    assert.equal(release.json?.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(release.json?.phase3?.runtimeReceiptRequired, true);
    assert.equal(release.json?.phase3?.receiptSignalPresent, false);

    assert.equal(release.json?.runtimeReleaseRecognition?.recognized, true);
    assert.equal(release.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
    assert.equal(release.json?.runtimeReleaseRecognition?.guardSatisfied, true);
    assert.equal(release.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
    assert.equal(release.json?.runtimeReleaseRecognition?.productionRelease, false);
    assert.equal(release.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
    assert.equal(release.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);

    assert.equal(release.json?.safety?.paymentResponseEmitted, false);
    assert.equal(release.json?.safety?.crpCalled, false);
    assert.equal(release.json?.safety?.crpFulfillCalled, false);
    assert.equal(release.json?.safety?.replayTouched, false);
    assert.equal(release.json?.safety?.canonicalReleasePersisted, false);
    assert.equal(release.json?.safety?.rawProofPrinted, false);
    assert.equal(release.json?.safety?.rawReceiptPrinted, false);

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          guardedRuntimeReleaseRecognized:
            release.json?.runtimeReleaseRecognition?.recognized === true,
          releaseDecisionRecognized:
            release.json?.runtimeReleaseRecognition?.releaseDecisionRecognized === true,
          guardSatisfied:
            release.json?.runtimeReleaseRecognition?.guardSatisfied === true,
          blockedBy: release.json?.runtimeReleaseRecognition?.blockedBy,
          runtimeReceiptRequired: release.json?.phase3?.runtimeReceiptRequired,
          receiptSignalPresent: release.json?.phase3?.receiptSignalPresent,
          productionRelease: release.json?.runtimeReleaseRecognition?.productionRelease,

          releaseStatus: release.status,
          paymentResponseEmitted: release.headers.get("payment-response") !== null,
          crpCalled: release.json?.safety?.crpCalled,
          crpFulfillCalled: release.json?.safety?.crpFulfillCalled,
          replayTouched: release.json?.safety?.replayTouched,
          resourceReleased: release.json?.runtimeReleaseRecognition?.resourceReleaseAllowed === true,
          canonicalReleasePersisted: release.json?.safety?.canonicalReleasePersisted,
          rawProofPrinted: release.json?.safety?.rawProofPrinted,
          rawReceiptPrinted: release.json?.safety?.rawReceiptPrinted,
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
