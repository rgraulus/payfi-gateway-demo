#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_positive_composition_decision.ts
 *
 * PR #123 regression harness:
 *
 * Proves the Gateway-facing positive composition decision:
 *
 *   eligible + challenge/resource-bound + paymentSatisfied:true
 *   => releaseAuthorized:true as a decision only
 *
 * This is intentionally test-only. It does not submit a payment receipt,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { composeModelAReleaseDecision } from "../src/phase3/modelAReleaseComposition";

const ROOT = process.cwd();
const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_POSITIVE_COMPOSITION_PORT || 3063);
const BASE = `http://127.0.0.1:${GATEWAY_PORT}`;
const isWin = process.platform === "win32";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function hashChallenge(challenge) {
  return createHash("sha256").update(stableStringify(challenge), "utf8").digest("hex");
}

function b64decodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.end();
      resolve(true);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function request(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
  };
}

async function waitForReady(base, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await request(base, "/healthz");
      if (res.status === 200 && res.json?.ok === true) return res.json;
    } catch {
      // Gateway is still starting.
    }

    await sleep(150);
  }

  throw new Error(`gateway did not become ready at ${base}/healthz`);
}

function killProcessTree(child) {
  if (!child || !child.pid) return Promise.resolve();

  if (isWin) {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });

      killer.on("error", () => resolve());
      killer.on("exit", () => resolve());
    });
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }

  return Promise.resolve();
}

async function waitForPortClosed(port, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return;
    await sleep(100);
  }
}

function startGateway() {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(GATEWAY_PORT),

    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "false",

    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgres://postgres:pg@localhost:5432/transaction-outcome",
    ORCHESTRATOR_BASE_URL: process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090",
    ORCHESTRATOR_API_KEY: process.env.ORCHESTRATOR_API_KEY || "dev-internal-key",
    CRP_BASE_URL: process.env.CRP_BASE_URL || "http://127.0.0.1:8080",
    X402_TTL_SEC: process.env.X402_TTL_SEC || "1800",

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const child = spawn(npmCmd(), ["run", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error("[phase3:gateway-positive-composition-test] gateway spawn error:", err);
  });

  return child;
}

function buildChallengeFromPaymentRequired(pr) {
  return {
    type: "xcf.x402.zkp.challenge",
    version: "1.0.0",
    x402Version: "x402-v2",

    merchantId: pr.merchantId,
    resource: {
      method: pr.resource.method,
      path: pr.resource.path,
    },
    contract: {
      contractId: pr.contractId,
      contractVersion: pr.contractVersion,
      isFrozen: pr.isFrozen,
    },

    network: pr.network,
    chain_id: pr.chain_id,
    caip2ChainId: null,

    asset: pr.asset,
    amount: pr.amount,
    amountMinor: String(Math.round(Number(pr.amount) * 10 ** Number(pr.asset.decimals))),
    payTo: pr.payTo,

    nonce: pr.nonce,
    issuedAt: pr.issuedAt,
    expiresAt: pr.expiresAt,

    policy: {
      policyId: "age-region-v1",
      policyVersion: "1.0.0",
      requirementsHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },

    businessTerms: {
      termsId: null,
      termsVersion: null,
      termsHash: null,
      termsUri: null,
      termsSchema: null,
    },

    buyer: null,
    agent: null,
  };
}

function buildEligibleEnvelope(pr) {
  const challenge = buildChallengeFromPaymentRequired(pr);
  const challengeHash = hashChallenge(challenge);

  return {
    type: "xcf.concordium.authorization.direct-buyer.v1",
    challenge,
    challengeHash,
    proofType: "concordium.VerifiablePresentation",
    presentation: {
      claims: {
        region: "EU",
        ageOver: 21,
      },
    },
    walletChallenge: challengeHash,
    wallet: {
      network: "concordium:testnet",
      selectedChain: "concordium:testnet",
      accountAddress: "ccd1qphase3directbuyerdemo",
    },
    submittedAt: new Date().toISOString(),
  };
}

async function issuePaidGatedChallenge() {
  const res = await request(BASE, "/paid-gated");

  assert.equal(res.status, 402, "GET /paid-gated should issue 402");
  assert.equal(res.headers.get("payment-response"), null, "initial 402 must not emit PAYMENT-RESPONSE");

  const prB64 = res.headers.get("payment-required");
  assert.ok(prB64, "PAYMENT-REQUIRED header must be present");

  const pr = b64decodeJson(prB64);
  assert.equal(pr.resource?.path, "/paid-gated");
  assert.equal(pr.policyRequirements?.required, true);
  assert.ok(pr.nonce, "PAYMENT-REQUIRED must include nonce");

  return pr;
}

async function redeemEligiblePolicy(pr) {
  const envelope = buildEligibleEnvelope(pr);

  return request(BASE, "/paid-gated/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: pr.nonce,
      authorizationProof: envelope,
    }),
  });
}

function buildDecisionOnlyPositiveComposition() {
  const decision = composeModelAReleaseDecision({
    boundEligibility: {
      ok: true,
      model: "phase3-model-a",
      eligibilityVerified: true,
      challengeBound: true,
      resourceBound: true,
      releaseAuthorized: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      replayTouched: false,
      rawProofPrinted: false,
    },
    payment: {
      paymentSatisfied: true,
      paymentSource: "test-only",
    },
  });

  return {
    ...decision,
    releaseDecisionOnly: true,
    crpFulfillCalled: decision.crpCalled,
    resourceReleased: false,
  };
}

async function main() {
  console.log(`[phase3:gateway-positive-composition-test] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway();

  const cleanup = async () => {
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(1));
  });

  process.on("SIGTERM", () => {
    void cleanup().finally(() => process.exit(1));
  });

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge();
    const redeem = await redeemEligiblePolicy(pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const decision = buildDecisionOnlyPositiveComposition();

    assert.equal(decision.ok, true);
    assert.equal(decision.eligibilityVerified, true);
    assert.equal(decision.challengeBound, true);
    assert.equal(decision.resourceBound, true);
    assert.equal(decision.paymentSatisfied, true);
    assert.equal(decision.releaseAuthorized, true);
    assert.equal(decision.releaseDecisionOnly, true);

    assert.equal(decision.paymentReleaseAttempted, false);
    assert.equal(decision.paymentResponseEmitted, false);
    assert.equal(decision.crpFulfillCalled, false);
    assert.equal(decision.replayTouched, false);
    assert.equal(decision.resourceReleased, false);
    assert.equal(decision.rawProofPrinted, false);

    const stillNoRelease = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

    assert.equal(stillNoRelease.status, 402, "positive decision-only test must not release resource");
    assert.ok(stillNoRelease.headers.get("payment-required"), "resource must still require PAYMENT-REQUIRED");
    assert.equal(stillNoRelease.headers.get("payment-response"), null, "decision-only test must not emit PAYMENT-RESPONSE");

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          eligibilityVerified: decision.eligibilityVerified,
          challengeBound: decision.challengeBound,
          resourceBound: decision.resourceBound,
          paymentSatisfied: decision.paymentSatisfied,
          paymentSource: decision.paymentSource,
          releaseAuthorized: decision.releaseAuthorized,
          releaseDecisionOnly: decision.releaseDecisionOnly,
          paymentReleaseAttempted: decision.paymentReleaseAttempted,
          paymentResponseEmitted: decision.paymentResponseEmitted,
          crpFulfillCalled: decision.crpFulfillCalled,
          replayTouched: decision.replayTouched,
          resourceReleased: decision.resourceReleased,
          rawProofPrinted: decision.rawProofPrinted,
          actualGatewayStillReturns402: stillNoRelease.status === 402,
          actualGatewayPaymentResponseEmitted: stillNoRelease.headers.has("payment-response"),
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
  console.error("[phase3:gateway-positive-composition-test] ERROR:", err?.stack || err?.message || err);
  process.exit(1);
});
