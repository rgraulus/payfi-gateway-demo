#!/usr/bin/env node
/**
 * scripts/ci_phase3_controlled_live_direct_buyer_release_demo.ts
 *
 * PR #260 controlled Live Direct Buyer release demo.
 *
 * Demonstrates the Phase 3 demo evolution from manual/human-gated policy
 * evidence to wallet/direct-buyer proof-backed policy evidence.
 *
 * This harness composes existing capabilities:
 * - /paid-gated challenge issuance with policyRequirements
 * - live Direct Buyer wallet proof redeem through /paid-gated/redeem
 * - eligible buyer POLICY_SATISFIED path
 * - ineligible buyer POLICY_FAILED path
 * - synthetic finalized x402 receipt release path for the eligible buyer
 * - replay rejection for the eligible buyer receipt
 *
 * It intentionally does not claim broad production CRP fulfill execution.
 * CRP fulfill, canonical production execution, broad replay mutation, and
 * production release side effects remain outside this controlled demo scope.
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

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
import { normalizeWalletProofCapture } from "./phase3-wallet-proof-capture-harness";

const GATEWAY_PORT = Number(process.env.PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_PORT || 3099);
const JWKS_PORT = Number(process.env.PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_JWKS_PORT || 8099);
const BASE = baseUrlForPort(GATEWAY_PORT);
const JWKS_BASE = baseUrlForPort(JWKS_PORT);
const JWKS_URL = `${JWKS_BASE}/.well-known/jwks.json`;
const MINT_URL = `${JWKS_BASE}/mint`;
const LABEL = "phase3:controlled-live-direct-buyer-release-demo-test";
const isWin = process.platform === "win32";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function nodeCmd() {
  return isWin ? "node.exe" : "node";
}

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
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
          "Usage: PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_HARNESS=true npm run phase3:controlled-live-direct-buyer-release-demo-test -- <local-wallet-proof.json>",
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(2);
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

function startControlledDemoGateway(): ChildProcess {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(GATEWAY_PORT),

    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_GATEWAY_RELEASE_ENABLED: "true",
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: "true",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: "false",
    PHASE3_LIVE_DIRECT_BUYER_CONTROLLED_RELEASE_DEMO_ENABLED: "true",

    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "true",

    PHASE3_GRPC_HOST: process.env.PHASE3_GRPC_HOST || "127.0.0.1",
    PHASE3_GRPC_PORT: process.env.PHASE3_GRPC_PORT || "20001",
    PHASE3_CONCORDIUM_NETWORK: process.env.PHASE3_CONCORDIUM_NETWORK || "testnet",

    CRP_JWKS_URL: JWKS_URL,
    X402_ALLOW_DEV_HARNESS: "true",
    X402_DEBUG: "true",

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

function buildAuthorizationProof(args: {
  capturedAuthorizationProof: any;
  runtimeChallenge: any;
  region: string;
  ageOver: number;
}): any {
  const runtimeChallengeHash = hashChallenge(args.runtimeChallenge);

  const capturedPresentation =
    args.capturedAuthorizationProof.presentation &&
    typeof args.capturedAuthorizationProof.presentation === "object" &&
    !Array.isArray(args.capturedAuthorizationProof.presentation)
      ? args.capturedAuthorizationProof.presentation
      : {};

  return {
    ...args.capturedAuthorizationProof,
    challenge: args.runtimeChallenge,
    challengeHash: runtimeChallengeHash,
    presentation: {
      ...capturedPresentation,
      claims: {
        region: args.region,
        ageOver: args.ageOver,
      },
    },
  };
}

async function redeemWithAuthorizationProof(args: {
  nonce: string;
  authorizationProof: any;
}): Promise<Awaited<ReturnType<typeof request>>> {
  return request(BASE, "/paid-gated/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: args.nonce,
      authorizationProof: args.authorizationProof,
    }),
  });
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

async function releaseWithReceipt(args: {
  nonce: string;
  receiptJws: string;
}): Promise<Awaited<ReturnType<typeof request>>> {
  return request(BASE, `/paid-gated?nonce=${encodeURIComponent(args.nonce)}`, {
    headers: {
      "PAYMENT-SIGNATURE": paymentSignatureB64(args.nonce),
      "X402-RECEIPT": args.receiptJws,
    },
  });
}

async function releaseWithReceiptEventually(args: {
  nonce: string;
  receiptJws: string;
  expectedStatus?: number;
}): Promise<Awaited<ReturnType<typeof request>>> {
  let release = null as Awaited<ReturnType<typeof request>> | null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    release = await releaseWithReceipt(args);

    if (args.expectedStatus !== undefined && release.status === args.expectedStatus) {
      break;
    }

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
  return release;
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);
  console.log(`[${LABEL}] JWKS_URL=${JWKS_URL}`);

  if (String(process.env.PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_HARNESS ?? "").toLowerCase() !== "true") {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "harness_disabled",
          reason:
            "Set PHASE3_CONTROLLED_LIVE_DIRECT_BUYER_RELEASE_DEMO_HARNESS=true to run this local-only harness.",
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
    throw new Error(`gateway port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(JWKS_PORT)) {
    throw new Error(`JWKS port ${JWKS_PORT} is already open. Stop the existing issuer and retry.`);
  }

  const rawCapture = readJsonFile(proofPath);
  const capturedAuthorizationProof = normalizeWalletProofCapture(rawCapture);

  const jwks = startDevJwks();
  await waitForJwks();

  const gateway = startControlledDemoGateway();

  const cleanup = async () => {
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
    assert.equal(health.phase3?.gatewayProductionReleaseEnabled, false);
    assert.equal(health.phase3?.liveDirectBuyerControlledReleaseDemoEnabled, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, true);
    assert.equal(health.devHarness?.allowDevHarness, true);
    assert.equal(health.jwksUrl, JWKS_URL);

    // -----------------------------------------------------------------------
    // Eligible buyer path: EU / 21 satisfies policy, then valid receipt releases.
    // -----------------------------------------------------------------------
    const eligiblePr = await issuePaidGatedChallenge(BASE);
    const eligibleRuntimeChallenge = buildChallengeFromPaymentRequired(eligiblePr);
    const eligibleAuthorizationProof = buildAuthorizationProof({
      capturedAuthorizationProof,
      runtimeChallenge: eligibleRuntimeChallenge,
      region: "EU",
      ageOver: 21,
    });

    const eligibleRedeem = await redeemWithAuthorizationProof({
      nonce: eligiblePr.nonce,
      authorizationProof: eligibleAuthorizationProof,
    });

    assert.equal(
      eligibleRedeem.headers.get("payment-response"),
      null,
      "eligible redeem must not emit PAYMENT-RESPONSE before payment receipt",
    );
    assert.equal(eligibleRedeem.status, 200, `eligible redeem should succeed: ${eligibleRedeem.text}`);
    assert.equal(eligibleRedeem.json?.ok, true);
    assert.equal(eligibleRedeem.json?.nonce, eligiblePr.nonce);
    assert.equal(eligibleRedeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(eligibleRedeem.json?.access, "policy-satisfied");
    assert.equal(eligibleRedeem.json?.region, "EU");
    assert.equal(eligibleRedeem.json?.minimumAge, 18);
    assert.equal(eligibleRedeem.json?.actualAge, 21);
    assert.equal(eligibleRedeem.json?.verifier?.ok, true);
    assert.equal(eligibleRedeem.json?.verifier?.stage, "verified");
    assert.equal(eligibleRedeem.json?.verifier?.challengeBinding, "walletChallenge");
    assert.equal(eligibleRedeem.json?.verifier?.rawProofPrinted, false);
    assert.equal(eligibleRedeem.json?.policyDecision?.allowed, true);
    assert.equal(eligibleRedeem.json?.policyDecision?.rawProofPrinted, false);

    const eligibleReceiptJws = await mintReceiptJws(eligiblePr);
    const eligibleRelease = await releaseWithReceiptEventually({
      nonce: eligiblePr.nonce,
      receiptJws: eligibleReceiptJws,
      expectedStatus: 200,
    });

    assert.equal(
      eligibleRelease.status,
      200,
      `eligible buyer with valid receipt must release resource: ${eligibleRelease.text}`,
    );
    assert.equal(eligibleRelease.headers.get("payment-required"), null);
    assert.ok(eligibleRelease.headers.get("payment-response"), "eligible release must emit PAYMENT-RESPONSE");
    assert.equal(eligibleRelease.json?.ok, true);
    assert.equal(eligibleRelease.json?.paid, true);
    assert.equal(eligibleRelease.json?.resource, "secret-data");

    const eligibleDecision = eligibleRelease.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
    assert.equal(eligibleDecision?.observed, true);
    assert.equal(eligibleDecision?.enforced, true);
    assert.equal(eligibleDecision?.ok, true);
    assert.equal(eligibleDecision?.readinessOk, true);
    assert.equal(eligibleDecision?.readinessStatus, "POLICY_SATISFIED");
    assert.equal(eligibleDecision?.reason, "release_authorized");
    assert.equal(eligibleDecision?.paymentResponseAllowed, true);
    assert.equal(eligibleDecision?.resourceReleaseAllowed, true);
    assert.equal(eligibleDecision?.productionRelease, false);
    assert.equal(eligibleDecision?.crpCalled, false);
    assert.equal(eligibleDecision?.crpFulfillCalled, false);
    assert.equal(eligibleDecision?.canonicalReleasePersisted, false);
    assert.equal(eligibleDecision?.rawProofPrinted, false);
    assert.equal(eligibleDecision?.rawReceiptPrinted, false);

    const eligibleReplay = await releaseWithReceipt({
      nonce: eligiblePr.nonce,
      receiptJws: eligibleReceiptJws,
    });

    assert.equal(eligibleReplay.status, 402, `eligible replay must be rejected: ${eligibleReplay.text}`);
    assert.equal(eligibleReplay.headers.get("payment-response"), null);

    // -----------------------------------------------------------------------
    // Ineligible buyer path: US / 18 fails policy and must not release.
    // -----------------------------------------------------------------------
    const ineligiblePr = await issuePaidGatedChallenge(BASE);
    const ineligibleRuntimeChallenge = buildChallengeFromPaymentRequired(ineligiblePr);
    const ineligibleAuthorizationProof = buildAuthorizationProof({
      capturedAuthorizationProof,
      runtimeChallenge: ineligibleRuntimeChallenge,
      region: "US",
      ageOver: 18,
    });

    const ineligibleRedeem = await redeemWithAuthorizationProof({
      nonce: ineligiblePr.nonce,
      authorizationProof: ineligibleAuthorizationProof,
    });

    assert.equal(ineligibleRedeem.headers.get("payment-response"), null);
    assert.equal(ineligibleRedeem.status, 403, `ineligible redeem should fail policy: ${ineligibleRedeem.text}`);
    assert.equal(ineligibleRedeem.json?.ok, false);
    assert.equal(ineligibleRedeem.json?.nonce, ineligiblePr.nonce);
    assert.equal(ineligibleRedeem.json?.policyStatus, "POLICY_FAILED");
    assert.equal(ineligibleRedeem.json?.code, "age_requirement_not_met");
    assert.equal(ineligibleRedeem.json?.reason, "age_requirement_not_met");
    assert.equal(ineligibleRedeem.json?.verifier?.ok, true);
    assert.equal(ineligibleRedeem.json?.verifier?.stage, "verified");
    assert.equal(ineligibleRedeem.json?.verifier?.challengeBinding, "walletChallenge");
    assert.equal(ineligibleRedeem.json?.verifier?.rawProofPrinted, false);
    assert.equal(ineligibleRedeem.json?.policyDecision?.allowed, true);
    assert.equal(ineligibleRedeem.json?.policyDecision?.rawProofPrinted, false);

    const ineligibleReceiptJws = await mintReceiptJws(ineligiblePr);
    const ineligibleRelease = await releaseWithReceiptEventually({
      nonce: ineligiblePr.nonce,
      receiptJws: ineligibleReceiptJws,
      expectedStatus: 402,
    });

    assert.equal(ineligibleRelease.status, 402, `ineligible buyer must not release resource: ${ineligibleRelease.text}`);
    assert.equal(ineligibleRelease.headers.get("payment-response"), null);
    assert.notEqual(ineligibleRelease.json?.resource, "secret-data");

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.controlledLiveDirectBuyerReleaseDemo.v1",

          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          gatewayProductionReleaseEnabled: health.phase3.gatewayProductionReleaseEnabled,
          liveDirectBuyerControlledReleaseDemoEnabled:
            health.phase3.liveDirectBuyerControlledReleaseDemoEnabled,
          allowParsedOnlyPolicy: health.phase3.allowParsedOnlyPolicy,
          requireLiveZkp: health.phase3.requireLiveZkp,
          allowDevHarness: health.devHarness.allowDevHarness,
          jwksUrl: health.jwksUrl,

          eligible: {
            nonce: eligiblePr.nonce,
            redeemStatus: eligibleRedeem.status,
            policyStatus: eligibleRedeem.json?.policyStatus,
            region: eligibleRedeem.json?.region,
            minimumAge: eligibleRedeem.json?.minimumAge,
            actualAge: eligibleRedeem.json?.actualAge,
            verifierOk: eligibleRedeem.json?.verifier?.ok,
            verifierStage: eligibleRedeem.json?.verifier?.stage,
            verifierChallengeBinding: eligibleRedeem.json?.verifier?.challengeBinding,
            policyAllowed: eligibleRedeem.json?.policyDecision?.allowed,
            syntheticReceiptMinted: eligibleReceiptJws.length > 0,
            releaseStatus: eligibleRelease.status,
            paymentResponseEmitted: eligibleRelease.headers.get("payment-response") !== null,
            releasedResource: eligibleRelease.json?.resource,
            replayRejected: eligibleReplay.status === 402,
            productionRelease: eligibleDecision?.productionRelease,
            crpCalled: eligibleDecision?.crpCalled,
            crpFulfillCalled: eligibleDecision?.crpFulfillCalled,
            canonicalReleasePersisted: eligibleDecision?.canonicalReleasePersisted,
          },

          ineligible: {
            nonce: ineligiblePr.nonce,
            redeemStatus: ineligibleRedeem.status,
            policyStatus: ineligibleRedeem.json?.policyStatus,
            code: ineligibleRedeem.json?.code,
            reason: ineligibleRedeem.json?.reason,
            verifierOk: ineligibleRedeem.json?.verifier?.ok,
            verifierStage: ineligibleRedeem.json?.verifier?.stage,
            verifierChallengeBinding: ineligibleRedeem.json?.verifier?.challengeBinding,
            policyVerifierAllowed: ineligibleRedeem.json?.policyDecision?.allowed,
            syntheticReceiptMinted: ineligibleReceiptJws.length > 0,
            releaseStatus: ineligibleRelease.status,
            paymentResponseEmitted: ineligibleRelease.headers.get("payment-response") !== null,
            resourceReleased: ineligibleRelease.json?.resource === "secret-data",
          },

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
