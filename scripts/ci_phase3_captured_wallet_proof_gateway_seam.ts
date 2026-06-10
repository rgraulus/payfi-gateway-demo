#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_wallet_proof_gateway_seam.ts
 *
 * PR #156 regression harness.
 *
 * Proves a captured wallet-proof input shape can be normalized and mapped into
 * the same fixture-backed Phase 3 Model A Gateway runtime seam validated by PR #155.
 *
 * This is intentionally test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import process from "node:process";

import type {
  ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
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
import {
  buildCapturedProofGatewayDecision,
  type Phase3CapturedProofGatewayDecision,
} from "./phase3-captured-proof-gateway-test-helpers";

const GATEWAY_PORT = Number(process.env.PHASE3_CAPTURED_WALLET_PROOF_GATEWAY_SEAM_PORT || 3075);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:captured-wallet-proof-gateway-seam-test";

async function buildCapturedWalletProofGatewayReleaseDecision(): Promise<{
  captureContract: Phase3CapturedProofGatewayDecision["captureContract"];
  safeMetadata: Phase3CapturedProofGatewayDecision["safeMetadata"];
  parsedOk: boolean;
  decision: Phase3CapturedProofGatewayDecision["decision"];
  boundEligibility: ModelAEligibilityBindingResult;
}> {
  const capturedWalletProof = await buildCapturedProofGatewayDecision({
    source: "phase3-test-captured-wallet-proof-input",
    badNonce: "phase3-pr156-wrong-captured-proof-nonce",
    assertExtendedSafeMetadata: true,
  });

  return {
    captureContract: capturedWalletProof.captureContract,
    safeMetadata: capturedWalletProof.safeMetadata,
    parsedOk: capturedWalletProof.parsedOk,
    decision: capturedWalletProof.decision,
    boundEligibility: capturedWalletProof.boundEligibility,
  };
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (String(process.env.PHASE3_GATEWAY_RELEASE_ENABLED ?? "").toLowerCase() === "true") {
    throw new Error("PHASE3_GATEWAY_RELEASE_ENABLED must not be true for this captured wallet proof seam harness.");
  }

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);
    const redeem = await redeemEligiblePolicy(BASE, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedWalletProof = await buildCapturedWalletProofGatewayReleaseDecision();

    assert.equal(capturedWalletProof.boundEligibility.ok, true);
    assert.equal(capturedWalletProof.decision.releaseAuthorized, true);
    assert.equal(capturedWalletProof.decision.paymentResponseAllowed, true);
    assert.equal(capturedWalletProof.decision.resourceReleaseAllowed, true);

    const postRedeemProtected = await fetch(`${BASE}/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);
    const postRedeemText = await postRedeemProtected.text();

    assert.equal(
      postRedeemProtected.status,
      402,
      `actual Gateway runtime must remain gated after captured-wallet-proof decision-only proof: ${postRedeemText}`,
    );
    assert.equal(
      postRedeemProtected.headers.get("payment-response"),
      null,
      "actual Gateway runtime must not emit PAYMENT-RESPONSE",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayRuntimeSeamReached: true,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          eligiblePolicyAllowed: redeem.json?.policyDecision?.allowed === true,

          captureContract: capturedWalletProof.captureContract.contract,
          capturedWalletProofInputShape: "raw-wallet-capture-fields",
          capturedWalletProofAcceptedByContract:
            capturedWalletProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
          capturedWalletProofNormalized: capturedWalletProof.safeMetadata.normalized,
          capturedWalletProofWalletPresent: capturedWalletProof.safeMetadata.walletPresent,
          capturedWalletProofAccountBindingStatus: capturedWalletProof.safeMetadata.accountBindingStatus,
          capturedWalletProofParsedAsCanonicalEnvelope: capturedWalletProof.parsedOk,
          capturedWalletProofEligibilityBound: capturedWalletProof.boundEligibility.ok,

          capturedWalletProofGatewayReleaseDecisionAuthorized: capturedWalletProof.decision.releaseAuthorized,
          capturedWalletProofGatewayPaymentResponseAllowed: capturedWalletProof.decision.paymentResponseAllowed,
          capturedWalletProofGatewayResourceReleaseAllowed: capturedWalletProof.decision.resourceReleaseAllowed,
          capturedWalletProofGatewayDecisionReason: capturedWalletProof.decision.reason,
          capturedWalletProofGatewayPaymentSource: capturedWalletProof.decision.paymentSource,

          releaseBlockedByDisabledGatewayRuntimeSeam: health.phase3.gatewayReleaseEnabled === false,
          actualGatewayStillReturns402: postRedeemProtected.status === 402,
          actualGatewayPaymentResponseEmitted: postRedeemProtected.headers.has("payment-response"),

          productionReleaseAuthorized: false,
          paymentReleaseAttempted: false,
          paymentResponseEmitted: false,
          crpCalled: false,
          crpFulfillCalled: false,
          replayTouched: false,
          resourceReleased: false,
          canonicalReleasePersisted: false,
          rawProofPrinted: false,
          rawReceiptPrinted: false,
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
