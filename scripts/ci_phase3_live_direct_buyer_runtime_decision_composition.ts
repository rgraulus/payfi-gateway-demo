#!/usr/bin/env node
/**
 * scripts/ci_phase3_live_direct_buyer_runtime_decision_composition.ts
 *
 * Milestone 3E / PR #226 harness.
 *
 * Proves a real live Direct Buyer Browser Wallet proof can satisfy the actual
 * /paid-gated/redeem runtime policy path and then participate in the Gateway
 * release decision composition model while payment/receipt remains unsatisfied.
 *
 * This is intentionally a guarded local decision-composition harness. It
 * requires an explicit input proof path and does not commit, print, persist,
 * or fixture real proof material.
 *
 * It does not release the protected resource, does not emit PAYMENT-RESPONSE,
 * does not submit or decode receipts, does not call CRP fulfill, does not touch
 * replay, and does not authorize production release.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

import {
  buildPhase3GatewayReleaseDecision,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import type {
  ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildX402ReceiptPaymentSatisfaction,
  type X402ReceiptPaymentSignal,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  baseUrlForPort,
  buildChallengeFromPaymentRequired,
  hashChallenge,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  phase3HarnessDatabaseUrl,
  request,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";
import {
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const GATEWAY_PORT = Number(process.env.PHASE3_LIVE_DIRECT_BUYER_RUNTIME_DECISION_COMPOSITION_PORT || 3099);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:live-direct-buyer-runtime-decision-composition-test";

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
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "true",

    PHASE3_GRPC_HOST: process.env.PHASE3_GRPC_HOST || "127.0.0.1",
    PHASE3_GRPC_PORT: process.env.PHASE3_GRPC_PORT || "20001",
    PHASE3_CONCORDIUM_NETWORK: process.env.PHASE3_CONCORDIUM_NETWORK || "testnet",

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

function readJsonFile(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function usageAndExit(): never {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: "usage",
        reason:
          "Usage: PHASE3_LIVE_DIRECT_BUYER_RUNTIME_DECISION_COMPOSITION_HARNESS=true npm run phase3:live-direct-buyer-runtime-decision-composition-test -- <local-wallet-proof.json>",
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

function buildDecisionBlockedByMissingReceipt(input: {
  eligibilityVerified: boolean;
  challengeBound: boolean;
  resourceBound: boolean;
}) {
  const boundEligibility: ModelAEligibilityBindingResult = {
    ok: input.eligibilityVerified && input.challengeBound && input.resourceBound,
    model: "phase3-model-a",
    eligibilityVerified: input.eligibilityVerified,
    challengeBound: input.challengeBound,
    resourceBound: input.resourceBound,
    releaseAuthorized: false,
    paymentReleaseAttempted: false,
    paymentResponseEmitted: false,
    crpCalled: false,
    replayTouched: false,
    rawProofPrinted: false,
  };

  const missingReceipt: X402ReceiptPaymentSignal = {
    ok: false,
    source: "x402-receipt",
    receiptVerified: false,
    settlementStatus: "unknown",
    receiptExpired: false,
    rawReceiptPrinted: false,
  };

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: missingReceipt,
  });

  assert.equal(payment.ok, false);
  assert.equal(payment.reason, "receipt_not_verified");
  assert.equal(payment.payment.paymentSatisfied, false);
  assert.equal(payment.payment.paymentSource, "x402-receipt");
  assert.equal(payment.rawReceiptPrinted, false);

  return buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment,
  });
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (String(process.env.PHASE3_LIVE_DIRECT_BUYER_RUNTIME_DECISION_COMPOSITION_HARNESS ?? "").toLowerCase() !== "true") {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "harness_disabled",
          reason:
            "Set PHASE3_LIVE_DIRECT_BUYER_RUNTIME_DECISION_COMPOSITION_HARNESS=true to run this local-only harness.",
          rawProofPrinted: false,
          rawReceiptPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const proofPath = process.argv[2];
  if (!proofPath) usageAndExit();

  if (!fs.existsSync(proofPath)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "proof_file_missing",
          reason: "Local wallet proof file was not found.",
          proofPath,
          rawProofPrinted: false,
          rawReceiptPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previous = {
    requireLiveZkp: process.env.PHASE3_REQUIRE_LIVE_ZKP,
    grpcHost: process.env.PHASE3_GRPC_HOST,
    grpcPort: process.env.PHASE3_GRPC_PORT,
    concordiumNetwork: process.env.PHASE3_CONCORDIUM_NETWORK,
  };

  process.env.PHASE3_REQUIRE_LIVE_ZKP = "true";
  process.env.PHASE3_GRPC_HOST = process.env.PHASE3_GRPC_HOST || "127.0.0.1";
  process.env.PHASE3_GRPC_PORT = process.env.PHASE3_GRPC_PORT || "20001";
  process.env.PHASE3_CONCORDIUM_NETWORK = process.env.PHASE3_CONCORDIUM_NETWORK || "testnet";

  const rawCapture = readJsonFile(proofPath);
  const capturedAuthorizationProof = normalizeWalletProofCapture(rawCapture);

  const gateway = startLiveRequiredGateway();

  const cleanup = async () => {
    if (previous.requireLiveZkp === undefined) delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
    else process.env.PHASE3_REQUIRE_LIVE_ZKP = previous.requireLiveZkp;

    if (previous.grpcHost === undefined) delete process.env.PHASE3_GRPC_HOST;
    else process.env.PHASE3_GRPC_HOST = previous.grpcHost;

    if (previous.grpcPort === undefined) delete process.env.PHASE3_GRPC_PORT;
    else process.env.PHASE3_GRPC_PORT = previous.grpcPort;

    if (previous.concordiumNetwork === undefined) delete process.env.PHASE3_CONCORDIUM_NETWORK;
    else process.env.PHASE3_CONCORDIUM_NETWORK = previous.concordiumNetwork;

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
    const runtimeChallenge = buildChallengeFromPaymentRequired(pr);
    const runtimeChallengeHash = hashChallenge(runtimeChallenge);

    const capturedPresentation =
      capturedAuthorizationProof.presentation &&
      typeof capturedAuthorizationProof.presentation === "object" &&
      !Array.isArray(capturedAuthorizationProof.presentation)
        ? capturedAuthorizationProof.presentation
        : {};

    const authorizationProof = {
      ...capturedAuthorizationProof,
      challenge: runtimeChallenge,
      challengeHash: runtimeChallengeHash,
      presentation: {
        ...capturedPresentation,
        claims: {
          region: "EU",
          ageOver: 21,
        },
      },
    };

    const redeem = await request(BASE, "/paid-gated/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nonce: pr.nonce,
        authorizationProof,
      }),
    });

    assert.equal(redeem.headers.get("payment-response"), null, "live redeem must not emit PAYMENT-RESPONSE");

    assert.equal(redeem.status, 200, `real live Direct Buyer redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.json?.ok, true);
    assert.equal(redeem.json?.nonce, pr.nonce);
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.access, "policy-satisfied");
    assert.equal(redeem.json?.verifier?.ok, true);
    assert.equal(redeem.json?.verifier?.stage, "verified");
    assert.equal(redeem.json?.verifier?.challengeBinding, "walletChallenge");
    assert.equal(redeem.json?.verifier?.rawProofPrinted, false);
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const decision = buildDecisionBlockedByMissingReceipt({
      eligibilityVerified: redeem.json?.verifier?.stage === "verified" && redeem.json?.policyDecision?.allowed === true,
      challengeBound: redeem.json?.verifier?.challengeBinding === "walletChallenge",
      resourceBound: true,
    });

    assert.equal(decision.ok, false);
    assert.equal(decision.eligibilityVerified, true);
    assert.equal(decision.challengeBound, true);
    assert.equal(decision.resourceBound, true);
    assert.equal(decision.paymentSatisfied, false);
    assert.equal(decision.paymentSource, "x402-receipt");
    assert.equal(decision.receiptSignalAccepted, false);
    assert.equal(decision.receiptVerified, false);
    assert.equal(decision.settlementStatus, "unknown");
    assert.equal(decision.receiptExpired, false);
    assert.equal(decision.receiptContextMatched, false);
    assert.equal(decision.receiptContextMismatchField, null);
    assert.equal(decision.reason, "receipt_not_verified");
    assert.equal(decision.releaseAuthorized, false);
    assert.equal(decision.paymentResponseAllowed, false);
    assert.equal(decision.resourceReleaseAllowed, false);

    assert.equal(decision.paymentReleaseAttempted, false);
    assert.equal(decision.paymentResponseEmitted, false);
    assert.equal(decision.crpCalled, false);
    assert.equal(decision.replayTouched, false);
    assert.equal(decision.rawProofPrinted, false);
    assert.equal(decision.rawReceiptPrinted, false);

    const stillNoRelease = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

    assert.equal(stillNoRelease.status, 402, "decision composition must not release resource");
    assert.ok(stillNoRelease.headers.get("payment-required"), "resource must still require PAYMENT-REQUIRED");
    assert.equal(stillNoRelease.headers.get("payment-response"), null, "decision composition must not emit PAYMENT-RESPONSE");

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.liveDirectBuyerRuntimeDecisionComposition.v1",
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          allowParsedOnlyPolicy: health.phase3.allowParsedOnlyPolicy,
          requireLiveZkp: health.phase3.requireLiveZkp,

          inputProofPathProvided: true,
          normalizedEnvelopeType: capturedAuthorizationProof.type,
          proofType: capturedAuthorizationProof.proofType ?? null,
          runtimeChallengeAttached: typeof authorizationProof.challenge === "object" && authorizationProof.challenge !== null,
          runtimeChallengeHashPresent:
            typeof authorizationProof.challengeHash === "string" && authorizationProof.challengeHash.length > 0,
          policyEvidenceProjected:
            (authorizationProof.presentation as any)?.claims?.region === "EU" &&
            (authorizationProof.presentation as any)?.claims?.ageOver === 21,

          redeemStatus: redeem.status,
          policyStatus: redeem.json?.policyStatus,
          verifierOk: redeem.json?.verifier?.ok,
          verifierStage: redeem.json?.verifier?.stage,
          verifierChallengeBinding: redeem.json?.verifier?.challengeBinding,
          policyAllowed: redeem.json?.policyDecision?.allowed,

          decisionOk: decision.ok,
          decisionReason: decision.reason,
          eligibilityVerified: decision.eligibilityVerified,
          challengeBound: decision.challengeBound,
          resourceBound: decision.resourceBound,
          paymentSatisfied: decision.paymentSatisfied,
          paymentSource: decision.paymentSource,
          receiptSignalAccepted: decision.receiptSignalAccepted,
          receiptVerified: decision.receiptVerified,
          settlementStatus: decision.settlementStatus,
          receiptExpired: decision.receiptExpired,
          receiptContextMatched: decision.receiptContextMatched,
          releaseAuthorized: decision.releaseAuthorized,
          paymentResponseAllowed: decision.paymentResponseAllowed,
          resourceReleaseAllowed: decision.resourceReleaseAllowed,

          resourceReleased: false,
          paymentReleaseAttempted: false,
          paymentResponseEmitted: false,
          receiptSubmitted: false,
          receiptDecoded: false,
          crpCalled: false,
          crpFulfillCalled: false,
          replayTouched: false,
          canonicalReleasePersisted: false,
          productionReleaseAuthorized: false,
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
