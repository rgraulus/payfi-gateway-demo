#!/usr/bin/env node
/**
 * scripts/ci_phase3_payment_response_replay_boundary.ts
 *
 * PR #169 regression harness.
 *
 * Hardens the Phase 3 replay boundary after a successful test-only
 * PAYMENT-RESPONSE emission.
 *
 * This proves:
 *
 *   - first use of a verified finalized x402 receipt can cross the test-only
 *     PAYMENT-RESPONSE boundary
 *   - second use of the same receipt/nonce is rejected
 *   - replay cannot be bypassed by query-string decoration
 *   - replay cannot be bypassed by altering PAYMENT-SIGNATURE while reusing
 *     the same verified receipt
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

const GATEWAY_PORT = Number(process.env.PHASE3_PAYMENT_RESPONSE_REPLAY_BOUNDARY_PORT || 3084);
const JWKS_PORT = Number(process.env.PHASE3_PAYMENT_RESPONSE_REPLAY_BOUNDARY_JWKS_PORT || 8094);

const BASE = baseUrlForPort(GATEWAY_PORT);
const JWKS_BASE = baseUrlForPort(JWKS_PORT);
const JWKS_URL = `${JWKS_BASE}/.well-known/jwks.json`;
const MINT_URL = `${JWKS_BASE}/mint`;
const LABEL = "phase3:payment-response-replay-boundary-test";
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

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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

function assertReplayBlocked(label: string, res: Awaited<ReturnType<typeof request>>) {
  assert.equal(res.status, 402, `${label} must return 402: ${res.text}`);
  assert.equal(res.headers.get("payment-response"), null, `${label} must not emit PAYMENT-RESPONSE`);
  assert.notEqual(res.json?.resource, "secret-data", `${label} must not release protected resource`);
  assert.notEqual(res.json?.paid, true, `${label} must not report paid=true`);

  const text = String(res.text || "");
  assert.match(text, /replay|already claimed|payment required|402/i, `${label} should be safely blocked`);
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
  delete process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH;

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

    let release = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      release = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
        headers: {
          "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
          "X402-RECEIPT": receiptJws,
        },
      });

      if (release.status === 200) {
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
    assert.equal(release.status, 200, `first use must release resource: ${release.text}`);
    assert.equal(release.headers.get("payment-required"), null, "first use must not emit PAYMENT-REQUIRED");
    assert.ok(release.headers.get("payment-response"), "first use must emit PAYMENT-RESPONSE");
    assert.equal(release.json?.ok, true);
    assert.equal(release.json?.paid, true);
    assert.equal(release.json?.resource, "secret-data");

    const paymentResponseHeader = release.headers.get("payment-response");
    const decodedPaymentResponse = assertPaymentResponseHeader(paymentResponseHeader, pr, receiptJws);

    const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
    assert.equal(decision?.observed, true);
    assert.equal(decision?.enforced, true);
    assert.equal(decision?.decisionLayerOnly, false);
    assert.equal(decision?.ok, true);
    assert.equal(decision?.readinessOk, true);
    assert.equal(decision?.readinessStatus, "POLICY_SATISFIED");
    assert.equal(decision?.reason, "release_authorized");
    assert.equal(decision?.paymentResponseAllowed, true);
    assert.equal(decision?.resourceReleaseAllowed, true);
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

    const exactReplay = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
      headers: {
        "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
        "X402-RECEIPT": receiptJws,
      },
    });
    assertReplayBlocked("exact replay", exactReplay);

    const decoratedReplay = await request(
      BASE,
      `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}&decorated=1&b=2&a=1`,
      {
        headers: {
          "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
          "X402-RECEIPT": receiptJws,
        },
      },
    );
    assertReplayBlocked("decorated query replay", decoratedReplay);

    const alteredSignatureNonce = `${pr.nonce}:altered-signature`;
    const alteredSignatureReplay = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
      headers: {
        "PAYMENT-SIGNATURE": paymentSignatureB64(alteredSignatureNonce),
        "X402-RECEIPT": receiptJws,
      },
    });
    assertReplayBlocked("altered signature replay", alteredSignatureReplay);

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.paymentResponseReplayBoundary.v1",

          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          requireLiveZkp: health.phase3.requireLiveZkp,
          allowDevHarness: health.devHarness.allowDevHarness,
          jwksUrl: health.jwksUrl,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          verifiedFinalizedReceiptSubmitted: receiptJws.length > 0,
          firstUseStatus: release.status,
          firstUsePaymentResponseEmitted: paymentResponseHeader !== null,
          firstUsePaymentResponseHeaderValidated: decodedPaymentResponse?.receipt?.jws === receiptJws,
          firstUseResourceReleased: release.json?.resource === "secret-data",

          runtimeDecisionObserved: decision?.observed === true,
          runtimeDecisionEnforced: decision?.enforced === true,
          runtimeDecisionAuthorized: decision?.ok === true,
          runtimeDecisionReason: decision?.reason,
          paymentResponseAllowed: decision?.paymentResponseAllowed,
          resourceReleaseAllowed: decision?.resourceReleaseAllowed,
          productionReleaseAuthorized: decision?.productionRelease,

          exactReplayRejected: exactReplay.status === 402,
          exactReplayPaymentResponseEmitted: exactReplay.headers.get("payment-response") !== null,
          exactReplayResourceReleased: exactReplay.json?.resource === "secret-data",

          decoratedQueryReplayRejected: decoratedReplay.status === 402,
          decoratedQueryReplayPaymentResponseEmitted: decoratedReplay.headers.get("payment-response") !== null,
          decoratedQueryReplayResourceReleased: decoratedReplay.json?.resource === "secret-data",

          alteredSignatureReplayRejected: alteredSignatureReplay.status === 402,
          alteredSignatureReplayPaymentResponseEmitted:
            alteredSignatureReplay.headers.get("payment-response") !== null,
          alteredSignatureReplayResourceReleased: alteredSignatureReplay.json?.resource === "secret-data",

          replayBypassPrevented:
            exactReplay.status === 402 &&
            decoratedReplay.status === 402 &&
            alteredSignatureReplay.status === 402 &&
            exactReplay.headers.get("payment-response") === null &&
            decoratedReplay.headers.get("payment-response") === null &&
            alteredSignatureReplay.headers.get("payment-response") === null,

          decisionPaymentReleaseAttempted: decision?.paymentReleaseAttempted,
          decisionPaymentResponseEmitted: decision?.paymentResponseEmitted,
          crpCalled: decision?.crpCalled,
          crpFulfillCalled: decision?.crpFulfillCalled,
          decisionReplayTouched: decision?.replayTouched,
          decisionResourceReleased: decision?.resourceReleased,
          decisionCanonicalReleasePersisted: decision?.canonicalReleasePersisted,
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
