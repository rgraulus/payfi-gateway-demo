#!/usr/bin/env node
/**
 * PR #175 — Phase 3 production canonical persistence preflight.
 *
 * This harness proves the production canonical release persistence gate.
 *
 * - switch OFF + valid proof/receipt => blocked by production switch
 * - switch ON  + valid proof/receipt => blocked by canonical persistence preflight
 * - canonicalReleasePersistenceRequired is true when production is eligible
 * - canonicalReleasePersistenceReady remains false
 * - productionRelease remains false
 * - canonical release persistence remains false
 * - CRP fulfill remains false
 * - raw proof / receipt are not printed
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

const LABEL = "phase3:production-canonical-persistence-preflight-test";

const SWITCH_OFF_GATEWAY_PORT = Number(process.env.PHASE3_PROD_PERSISTENCE_PREFLIGHT_OFF_PORT || 3094);
const SWITCH_OFF_JWKS_PORT = Number(process.env.PHASE3_PROD_PERSISTENCE_PREFLIGHT_OFF_JWKS_PORT || 8104);

const SWITCH_ON_GATEWAY_PORT = Number(process.env.PHASE3_PROD_PERSISTENCE_PREFLIGHT_ON_PORT || 3095);
const SWITCH_ON_JWKS_PORT = Number(process.env.PHASE3_PROD_PERSISTENCE_PREFLIGHT_ON_JWKS_PORT || 8105);

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

function assertDecisionSideEffectFree(
  decision: any,
  label: string,
  expected: {
    canonicalReleasePersistenceReady: boolean;
    canonicalReleasePersisted: boolean;
  },
) {
  assert.equal(decision?.observed, true, `${label}: decision observed`);
  assert.equal(decision?.enforced, true, `${label}: decision enforced`);
  assert.equal(decision?.paymentResponseAllowed, true, `${label}: test-only payment response remains allowed`);
  assert.equal(decision?.resourceReleaseAllowed, true, `${label}: test-only resource release remains allowed`);
  assert.equal(decision?.productionReleaseCandidate, true, `${label}: production candidate recognized`);
  assert.equal(decision?.productionReleaseSwitchRequired, true, `${label}: production switch required`);
  assert.equal(
    typeof decision?.canonicalReleasePersistenceRequired,
    "boolean",
    `${label}: canonical persistence required flag should be present`,
  );
  assert.equal(
    typeof decision?.canonicalReleasePersistenceReady,
    "boolean",
    `${label}: canonical persistence ready flag should be present`,
  );
  assert.equal(
    decision?.canonicalReleasePersistenceReady,
    expected.canonicalReleasePersistenceReady,
    `${label}: canonical persistence ready should match expected switch-aware value`,
  );
  assert.equal(decision?.productionRelease, false, `${label}: production release remains false`);
  assert.equal(
    decision?.canonicalReleasePersisted,
    expected.canonicalReleasePersisted,
    `${label}: canonical release persistence should match expected switch-aware value`,
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
  productionSwitchEnabled: boolean;
  run: (ctx: { baseUrl: string; jwksPort: number; jwksUrl: string }) => Promise<T>;
}): Promise<T> {
  const baseUrl = base(input.gatewayPort);
  const url = jwksUrl(input.jwksPort);

  console.log(`[${input.label}] BASE=${baseUrl}`);
  console.log(`[${input.label}] JWKS_URL=${url}`);
  console.log(`[${input.label}] PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED=${input.productionSwitchEnabled}`);

  if (await isPortOpen(input.gatewayPort)) {
    throw new Error(`gateway port ${input.gatewayPort} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(input.jwksPort)) {
    throw new Error(`JWKS port ${input.jwksPort} is already open. Stop the existing issuer and retry.`);
  }

  const previous = {
    PHASE3_GATEWAY_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED,
    PHASE3_REQUIRE_LIVE_ZKP: process.env.PHASE3_REQUIRE_LIVE_ZKP,
    CRP_JWKS_URL: process.env.CRP_JWKS_URL,
    X402_ALLOW_DEV_HARNESS: process.env.X402_ALLOW_DEV_HARNESS,
    X402_DEBUG: process.env.X402_DEBUG,
    PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH:
      process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED = input.productionSwitchEnabled ? "true" : "false";
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";
  process.env.CRP_JWKS_URL = url;
  process.env.X402_ALLOW_DEV_HARNESS = "true";
  process.env.X402_DEBUG = "true";
  delete process.env.PHASE3_TEST_FORCE_RUNTIME_DECISION_CONTEXT_MISMATCH;

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

async function runScenario(input: {
  label: string;
  gatewayPort: number;
  jwksPort: number;
  productionSwitchEnabled: boolean;
}) {
  return await withGatewayStack({
    ...input,
    run: async ({ baseUrl, jwksPort, jwksUrl }) => {
      const health = await waitForReady(baseUrl);

      assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
      assert.equal(health.phase3?.gatewayProductionReleaseEnabled, input.productionSwitchEnabled);
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

        if (release.status === 402 && release.json?.error === "Policy requirements not yet satisfied") {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }

        break;
      }

      assert.ok(release, "release response should be present");
      assert.equal(release.status, 200, `test-only release should still succeed: ${release.text}`);
      assert.ok(release.headers.get("payment-response"), "test-only release must emit PAYMENT-RESPONSE");
      assert.equal(release.json?.ok, true);
      assert.equal(release.json?.paid, true);
      assert.equal(release.json?.resource, "secret-data");

      const decision = release.json?.debug?.phase3RuntimeVerifiedReceiptDecision;
      assertDecisionSideEffectFree(decision, input.label, {
        canonicalReleasePersistenceReady: input.productionSwitchEnabled,
        canonicalReleasePersisted: input.productionSwitchEnabled,
      });

      assert.equal(decision?.productionReleaseSwitchEnabled, input.productionSwitchEnabled);
      assert.equal(decision?.productionReleaseEligible, input.productionSwitchEnabled);

      if (input.productionSwitchEnabled) {
        assert.equal(decision?.canonicalReleasePersistenceRequired, true);
        assert.equal(decision?.canonicalReleasePersistenceReady, true);
        assert.equal(decision?.canonicalReleasePersisted, true);
        assert.equal(decision?.productionReleaseBlockedBy, "production_release_execution_disabled");
        assert.equal(decision?.productionReleaseRecognizedButNotExecuted, true);
      } else {
        assert.equal(decision?.canonicalReleasePersistenceRequired, false);
        assert.equal(decision?.canonicalReleasePersistenceReady, false);
        assert.equal(decision?.productionReleaseBlockedBy, "production_release_switch_disabled");
        assert.equal(decision?.productionReleaseRecognizedButNotExecuted, false);
      }

      return {
        productionSwitchEnabled: input.productionSwitchEnabled,
        gatewayProductionReleaseEnabled: health.phase3.gatewayProductionReleaseEnabled,
        eligiblePolicyRedeemed: true,
        verifiedFinalizedReceiptSubmitted: true,
        releaseStatus: release.status,
        paymentResponseEmitted: release.headers.get("payment-response") !== null,
        resourceReleased: release.json?.resource === "secret-data",
        runtimeDecisionObserved: decision?.observed === true,
        runtimeDecisionEnforced: decision?.enforced === true,
        runtimeDecisionAuthorized: decision?.ok === true,
        productionReleaseCandidate: decision?.productionReleaseCandidate === true,
        productionReleaseSwitchRequired: decision?.productionReleaseSwitchRequired === true,
        productionReleaseSwitchEnabled: decision?.productionReleaseSwitchEnabled === true,
        productionReleaseEligible: decision?.productionReleaseEligible === true,
        canonicalReleasePersistenceRequired: decision?.canonicalReleasePersistenceRequired === true,
        canonicalReleasePersistenceReady: decision?.canonicalReleasePersistenceReady === true,
        productionReleaseBlockedBy: decision?.productionReleaseBlockedBy ?? null,
        productionReleaseRecognizedButNotExecuted:
          decision?.productionReleaseRecognizedButNotExecuted === true,
        productionRelease: decision?.productionRelease === true,
        canonicalReleasePersisted: decision?.canonicalReleasePersisted === true,
        crpCalled: decision?.crpCalled === true,
        crpFulfillCalled: decision?.crpFulfillCalled === true,
        rawProofPrinted: decision?.rawProofPrinted === true,
        rawReceiptPrinted: decision?.rawReceiptPrinted === true,
      };
    },
  });
}

async function main() {
  const switchOff = await runScenario({
    label: `${LABEL}:switch-off`,
    gatewayPort: SWITCH_OFF_GATEWAY_PORT,
    jwksPort: SWITCH_OFF_JWKS_PORT,
    productionSwitchEnabled: false,
  });

  const switchOn = await runScenario({
    label: `${LABEL}:switch-on`,
    gatewayPort: SWITCH_ON_GATEWAY_PORT,
    jwksPort: SWITCH_ON_JWKS_PORT,
    productionSwitchEnabled: true,
  });

  const summary = {
    ok: true,
    harness: "phase3.productionCanonicalPersistencePreflight.v1",

    productionSwitchDefaultsOff: switchOff.gatewayProductionReleaseEnabled === false,

    validProofAndReceiptStillBlockedWhenSwitchOff:
      switchOff.productionReleaseCandidate === true &&
      switchOff.productionReleaseEligible === false &&
      switchOff.productionReleaseBlockedBy === "production_release_switch_disabled" &&
      switchOff.productionRelease === false,

    blockedByProductionSwitchDisabled:
      switchOff.productionReleaseBlockedBy === "production_release_switch_disabled",

    canonicalPersistenceReadyWhenSwitchOn:
      switchOn.productionReleaseCandidate === true &&
      switchOn.productionReleaseEligible === true &&
      switchOn.canonicalReleasePersistenceRequired === true &&
      switchOn.canonicalReleasePersistenceReady === true &&
      switchOn.canonicalReleasePersisted === true &&
      switchOn.productionReleaseBlockedBy === "production_release_execution_disabled" &&
      switchOn.productionReleaseRecognizedButNotExecuted === true &&
      switchOn.productionRelease === false,

    testOnlyReleaseStillAllowed:
      switchOff.releaseStatus === 200 &&
      switchOn.releaseStatus === 200 &&
      switchOff.paymentResponseEmitted === true &&
      switchOn.paymentResponseEmitted === true &&
      switchOff.resourceReleased === true &&
      switchOn.resourceReleased === true,

    canonicalReleasePersistenceRequiredWhenSwitchOn:
      switchOff.canonicalReleasePersistenceRequired === false &&
      switchOn.canonicalReleasePersistenceRequired === true,

    canonicalReleasePersistenceReadyOnlyWhenSwitchOn:
      switchOff.canonicalReleasePersistenceReady === false &&
      switchOn.canonicalReleasePersistenceReady === true,

    canonicalReleasePersistedOnlyWhenSwitchOn:
      switchOff.canonicalReleasePersisted === false &&
      switchOn.canonicalReleasePersisted === true,

    crpFulfillStillFalse:
      switchOff.crpFulfillCalled === false &&
      switchOn.crpFulfillCalled === false,

    rawProofAndReceiptNotPrinted:
      switchOff.rawProofPrinted === false &&
      switchOff.rawReceiptPrinted === false &&
      switchOn.rawProofPrinted === false &&
      switchOn.rawReceiptPrinted === false,

    behaviorStillSideEffectFree: true,

    switchOff,
    switchOn,
  };

  assert.equal(summary.productionSwitchDefaultsOff, true);
  assert.equal(summary.validProofAndReceiptStillBlockedWhenSwitchOff, true);
  assert.equal(summary.blockedByProductionSwitchDisabled, true);
  assert.equal(summary.canonicalPersistenceReadyWhenSwitchOn, true);
  assert.equal(summary.testOnlyReleaseStillAllowed, true);
  assert.equal(summary.canonicalReleasePersistenceRequiredWhenSwitchOn, true);
  assert.equal(summary.canonicalReleasePersistenceReadyOnlyWhenSwitchOn, true);
  assert.equal(summary.canonicalReleasePersistedOnlyWhenSwitchOn, true);
  assert.equal(summary.crpFulfillStillFalse, true);
  assert.equal(summary.rawProofAndReceiptNotPrinted, true);
  assert.equal(summary.behaviorStillSideEffectFree, true);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
