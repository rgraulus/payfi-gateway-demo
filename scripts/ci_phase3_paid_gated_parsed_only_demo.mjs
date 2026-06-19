#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3060;
const BASE = `http://127.0.0.1:${PORT}`;

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

function spawnGateway(env) {
  return spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
}

async function stopGateway(child) {
  if (!child || child.killed) return;

  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
  });

  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
    });
  } else {
    child.kill();
  }

  await Promise.race([
    exited,
    sleep(2_000),
  ]);
}

async function waitForReady(base) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await request(base, "/healthz");
      if (res.status === 200 && res.json?.ok === true) return res.json;
    } catch {
      // keep polling
    }
    await sleep(250);
  }
  throw new Error(`gateway did not become ready at ${base}/healthz`);
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

function buildEnvelope(pr, { region, ageOver }) {
  const challenge = buildChallengeFromPaymentRequired(pr);
  const challengeHash = hashChallenge(challenge);

  return {
    type: "xcf.concordium.authorization.direct-buyer.v1",
    challenge,
    challengeHash,
    proofType: "concordium.VerifiablePresentation",
    presentation: {
      claims: {
        region,
        ageOver,
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

async function issuePaidGatedChallenge(base) {
  const res = await request(base, "/paid-gated");
  assert.equal(res.status, 402, "GET /paid-gated should issue 402");
  const prB64 = res.headers.get("payment-required");
  assert.ok(prB64, "PAYMENT-REQUIRED header must be present");
  const pr = b64decodeJson(prB64);
  assert.equal(pr.resource?.path, "/paid-gated");
  assert.equal(pr.policyRequirements?.required, true);
  assert.ok(pr.nonce, "PAYMENT-REQUIRED must include nonce");
  return pr;
}

async function redeem(base, pr, envelope) {
  return request(base, "/paid-gated/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: pr.nonce,
      authorizationProof: envelope,
    }),
  });
}

async function main() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "false",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgres://postgres:pg@localhost:5432/transaction-outcome",
  };

  const child = spawnGateway(env);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const allowPr = await issuePaidGatedChallenge(BASE);
    const allowEnvelope = buildEnvelope(allowPr, { region: "EU", ageOver: 21 });
    const allowRedeem = await redeem(BASE, allowPr, allowEnvelope);

    assert.equal(allowRedeem.status, 200, `EU/21 redeem should succeed: ${allowRedeem.text}`);
    assert.equal(allowRedeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(allowRedeem.json?.region, "EU");
    assert.equal(allowRedeem.json?.minimumAge, 18);
    assert.equal(allowRedeem.json?.actualAge, 21);
    assert.equal(allowRedeem.json?.verifier?.stage, "parsed");
    assert.equal(allowRedeem.json?.policyDecision?.allowed, true);
    assert.equal(allowRedeem.json?.policyDecision?.rawProofPrinted, false);

    const stillRequiresPayment = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(allowPr.nonce)}`);
    assert.equal(stillRequiresPayment.status, 402, "policy satisfaction alone must not release resource");
    assert.ok(stillRequiresPayment.headers.get("payment-required"), "PAYMENT-REQUIRED must still be present");
    assert.equal(stillRequiresPayment.headers.get("payment-response"), null, "PAYMENT-RESPONSE must not be emitted");

    const denyPr = await issuePaidGatedChallenge(BASE);
    const denyEnvelope = buildEnvelope(denyPr, { region: "US", ageOver: 18 });
    const denyRedeem = await redeem(BASE, denyPr, denyEnvelope);

    assert.equal(denyRedeem.status, 403, `US/18 redeem should fail: ${denyRedeem.text}`);
    assert.equal(denyRedeem.json?.policyStatus, "POLICY_FAILED");
    assert.equal(denyRedeem.json?.code, "age_requirement_not_met");

    await stopGateway(child);

    const strictEnv = {
      ...process.env,
      PORT: String(PORT + 1),
      HOST: "127.0.0.1",
      PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
      PHASE3_ALLOW_PARSED_ONLY_POLICY: "false",
      PHASE3_REQUIRE_LIVE_ZKP: "true",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgres://postgres:pg@localhost:5432/transaction-outcome",
    };

    const strictChild = spawnGateway(strictEnv);

    try {
      const strictBase = `http://127.0.0.1:${PORT + 1}`;

      await waitForReady(strictBase);
      const strictPr = await issuePaidGatedChallenge(strictBase);
      const strictEnvelope = buildEnvelope(strictPr, { region: "EU", ageOver: 21 });
      const strictRedeem = await redeem(strictBase, strictPr, strictEnvelope);

      assert.equal(strictRedeem.status, 403, `live-required non-live-verifiable proof should fail: ${strictRedeem.text}`);
      assert.equal(strictRedeem.json?.code, "verifier_failed");
      assert.equal(strictRedeem.json?.policyStatus, "POLICY_FAILED");
      assert.equal(strictRedeem.json?.verifier?.ok, false);
      assert.equal(strictRedeem.json?.verifier?.stage, "verification_failed");
      assert.equal(strictRedeem.headers.get("payment-response"), null, "live-required rejection must not emit PAYMENT-RESPONSE");
    } finally {
      await stopGateway(strictChild);
    }

    console.log(JSON.stringify({
      ok: true,
      parsedOnlyAllowedEu21: "POLICY_SATISFIED",
      parsedOnlyAllowedUs18: "age_requirement_not_met",
      liveVerificationFailureRejected: "verifier_failed",
      policyAloneDoesNotReleaseResource: true,
      rawProofPrinted: false,
    }, null, 2));
  } finally {
    await stopGateway(child);
  }
}

main().catch((err) => {
  console.error("[phase3:paid-gated-demo-test] ERROR:", err);
  process.exit(1);
});
