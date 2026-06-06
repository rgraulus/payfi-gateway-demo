#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_receipt_required_runtime_release.ts
 *
 * PR #136 regression harness.
 *
 * Proves the guarded Phase 3 runtime release branch now fails closed when
 * policy is satisfied but no x402 receipt signal is present.
 *
 * This PR intentionally does not add new receipt verification behavior here.
 * If a receipt is present, the synthetic branch yields to the existing
 * clientReceiptJws verification path.
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

const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_RECEIPT_REQUIRED_RUNTIME_RELEASE_PORT || 3071);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:gateway-receipt-required-runtime-release-test";

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

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (
        blocked.status === 402 &&
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked response should be present");
    assert.equal(blocked.status, 402, `missing receipt should keep runtime release blocked: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked release must still emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked release must not emit PAYMENT-RESPONSE");

    assert.equal(blocked.json?.ok, false);
    assert.equal(blocked.json?.paid, false);
    assert.equal(blocked.json?.error, "Verified x402 receipt required before guarded Phase 3 runtime release");

    assert.equal(blocked.json?.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(blocked.json?.phase3?.gatewayReleaseEnabled, true);
    assert.equal(blocked.json?.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
    assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);

    assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
    assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);

    assert.equal(blocked.json?.safety?.paymentResponseEmitted, false);
    assert.equal(blocked.json?.safety?.crpCalled, false);
    assert.equal(blocked.json?.safety?.crpFulfillCalled, false);
    assert.equal(blocked.json?.safety?.replayTouched, false);
    assert.equal(blocked.json?.safety?.canonicalReleasePersisted, false);
    assert.equal(blocked.json?.safety?.rawProofPrinted, false);
    assert.equal(blocked.json?.safety?.rawReceiptPrinted, false);

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          runtimeReceiptRequired: blocked.json?.phase3?.runtimeReceiptRequired,
          receiptSignalPresent: blocked.json?.phase3?.receiptSignalPresent,
          missingReceiptRejected: blocked.json?.runtimeReleaseRecognition?.blockedBy,
          releaseDecisionRecognized: blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized,
          resourceReleaseAllowed: blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed,
          productionRelease: blocked.json?.runtimeReleaseRecognition?.productionRelease,

          releaseStatus: blocked.status,
          paymentResponseEmitted: blocked.headers.get("payment-response") !== null,
          crpCalled: blocked.json?.safety?.crpCalled,
          crpFulfillCalled: blocked.json?.safety?.crpFulfillCalled,
          replayTouched: blocked.json?.safety?.replayTouched,
          resourceReleased: false,
          canonicalReleasePersisted: blocked.json?.safety?.canonicalReleasePersisted,
          rawProofPrinted: blocked.json?.safety?.rawProofPrinted,
          rawReceiptPrinted: blocked.json?.safety?.rawReceiptPrinted,
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
