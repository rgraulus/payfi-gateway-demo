#!/usr/bin/env node
/**
 * scripts/ci_phase3_gateway_gate_disabled.mjs
 *
 * Regression test for the Phase 3 Gateway policy gate default-disabled behavior.
 *
 * This script starts the Gateway on a test port with
 * PHASE3_GATEWAY_POLICY_GATE_ENABLED intentionally unset, then verifies:
 * - /healthz reports phase3.gatewayPolicyGateEnabled=false
 * - /paid-gated is disabled
 * - /paid-gated/redeem is disabled before policy verifier logic can run
 * - /x402/paid-gated is disabled through handleX402
 * - /paid still reaches the normal x402 402 PAYMENT-REQUIRED path
 *
 * It does not require CRP, Orchestrator, Facilitator, or live Concordium services.
 */

import { spawn } from "child_process";
import net from "net";
import process from "process";

const ROOT = process.cwd();
const GATEWAY_PORT = Number(process.env.PHASE3_GATEWAY_GATE_TEST_PORT || 3059);
const BASE = `http://127.0.0.1:${GATEWAY_PORT}`;

const isWin = process.platform === "win32";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForHttpOk(url, timeoutMs = 15_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // Gateway is still starting.
    }

    await sleep(100);
  }

  return false;
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 300)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectDisabled(path, init = undefined) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = await readJson(res);

  assert(
    res.status === 404,
    `${path} expected HTTP 404 when gate disabled, got ${res.status}`,
  );
  assert(
    body?.code === "phase3_gateway_policy_gate_disabled",
    `${path} expected disabled code, got ${body?.code}`,
  );
  assert(
    body?.reason === "phase3_gateway_policy_gate_disabled",
    `${path} expected disabled reason, got ${body?.reason}`,
  );
  assert(
    body?.phase3?.gatewayPolicyGateEnabled === false,
    `${path} expected phase3.gatewayPolicyGateEnabled=false`,
  );

  return body;
}

function killProcessTree(child) {
  if (!child || !child.pid) return Promise.resolve();

  if (isWin) {
    // npm.cmd/shell can leave the underlying node.exe alive on Windows.
    // taskkill /T kills the full child process tree.
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

function startGateway() {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(GATEWAY_PORT),

    // Normal local Gateway envs. Downstream services are intentionally not required
    // for disabled-gate assertions.
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgres://postgres:pg@localhost:5432/transaction-outcome",
    ORCHESTRATOR_BASE_URL: process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090",
    ORCHESTRATOR_API_KEY: process.env.ORCHESTRATOR_API_KEY || "dev-internal-key",
    CRP_BASE_URL: process.env.CRP_BASE_URL || "http://127.0.0.1:8080",
    X402_TTL_SEC: process.env.X402_TTL_SEC || "1800",

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  // Critical assertion for this regression: default-disabled means unset.
  delete env.PHASE3_GATEWAY_POLICY_GATE_ENABLED;

  const child = spawn(npmCmd(), ["run", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error("[phase3:gateway-gate-test] gateway spawn error:", err);
  });

  return child;
}

async function main() {
  console.log(`[phase3:gateway-gate-test] BASE=${BASE}`);
  console.log("[phase3:gateway-gate-test] PHASE3_GATEWAY_POLICY_GATE_ENABLED intentionally unset");

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway();

  const cleanup = async () => {
    await killProcessTree(gateway);

    for (let i = 0; i < 50; i++) {
      if (!(await isPortOpen(GATEWAY_PORT))) return;
      await sleep(100);
    }

    console.warn(
      `[phase3:gateway-gate-test] WARNING: port ${GATEWAY_PORT} may still be open after shutdown`,
    );
  };

  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(1));
  });

  process.on("SIGTERM", () => {
    void cleanup().finally(() => process.exit(1));
  });

  try {
    const ready = await waitForHttpOk(`${BASE}/healthz`, 15_000);
    assert(ready, `gateway did not become ready at ${BASE}/healthz`);

    const healthRes = await fetch(`${BASE}/healthz`);
    const health = await readJson(healthRes);

    assert(health?.ok === true, "/healthz expected ok=true");
    assert(
      health?.phase3?.gatewayPolicyGateEnabled === false,
      "/healthz expected phase3.gatewayPolicyGateEnabled=false",
    );

    await expectDisabled("/paid-gated");

    await expectDisabled("/paid-gated/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nonce: "test-disabled-gate" }),
    });

    await expectDisabled("/x402/paid-gated");

    const paidRes = await fetch(`${BASE}/paid`);
    assert(paidRes.status === 402, `/paid expected HTTP 402, got ${paidRes.status}`);
    assert(
      paidRes.headers.has("payment-required"),
      "/paid expected PAYMENT-REQUIRED header",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          paidGatedDisabled: true,
          redeemDisabled: true,
          x402PaidGatedDisabled: true,
          paidStillReturns402: true,
          paymentRequiredHeaderPresent: true,
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
  console.error("[phase3:gateway-gate-test] ERROR:", err?.stack || err?.message || err);
  process.exit(1);
});
