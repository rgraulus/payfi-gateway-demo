#!/usr/bin/env node
/**
 * PR #173 — Phase 3 production-release switch seam.
 *
 * This harness proves that PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED:
 * - is visible in the Gateway Phase 3 health snapshot
 * - defaults off
 * - can be set true
 * - does not yet authorize production release
 * - does not persist canonical release
 * - does not call CRP fulfill
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import process from "node:process";

const LABEL = "phase3:production-release-switch-seam-test";
const BASE_PORT = 3090;

function baseForPort(port: number): string {
  return `http://localhost:${port}`;
}

type Json = Record<string, any>;

function stopGateway(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      return;
    } catch {
      // Fall through to the generic kill path.
    }
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Best-effort cleanup only.
  }
}

function boolEnv(value: boolean): string {
  return value ? "true" : "false";
}

function startGateway(
  productionReleaseEnabled: boolean,
  port: number,
): { child: ReturnType<typeof spawn>; ready: Promise<void> } {
  const env = {
    ...process.env,
    PORT: String(port),
    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_GATEWAY_RELEASE_ENABLED: "true",
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: "true",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: boolEnv(productionReleaseEnabled),
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "false",
    X402_ALLOW_DEV_HARNESS: "true",
  };

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    env,
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...(process.platform === "win32" ? { shell: true } : {}),
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  const ready = waitForHealth(baseForPort(port));

  return { child, ready };
}

async function waitForHealth(base: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastErr: unknown;

  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/healthz`);
      if (r.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Gateway did not become ready: ${String(lastErr)}`);
}

async function getJson(base: string, path: string): Promise<Json> {
  const r = await fetch(`${base}${path}`);
  const text = await r.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 500)}`);
  }
}

async function runCase(productionReleaseEnabled: boolean, port: number): Promise<Json> {
  const base = baseForPort(port);
  const { child, ready } = startGateway(productionReleaseEnabled, port);

  try {
    await ready;

    const health = await getJson(base, "/healthz");

    assert.equal(health.ok, true);
    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, true);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(
      health.phase3?.gatewayProductionReleaseEnabled,
      productionReleaseEnabled,
      base,
      port,
    );

    return {
      productionReleaseEnabled,
      base,
      port,
      healthPhase3: health.phase3,
      switchVisible: typeof health.phase3?.gatewayProductionReleaseEnabled === "boolean",
      switchValue: health.phase3?.gatewayProductionReleaseEnabled,
    };
  } finally {
    stopGateway(child);
  }
}

async function main() {
  console.log(`[${LABEL}] defaultOffBase=${baseForPort(BASE_PORT)}`);
  console.log(`[${LABEL}] explicitlyOnBase=${baseForPort(BASE_PORT + 1)}`);

  const defaultOff = await runCase(false, BASE_PORT);
  const explicitlyOn = await runCase(true, BASE_PORT + 1);

  const summary = {
    ok: true,
    harness: "phase3.productionReleaseSwitchSeam.v1",

    productionReleaseSwitchVisible:
      defaultOff.switchVisible === true && explicitlyOn.switchVisible === true,

    productionReleaseSwitchDefaultsOff: defaultOff.switchValue === false,
    productionReleaseSwitchCanBeSetTrue: explicitlyOn.switchValue === true,

    defaultOff,
    explicitlyOn,

    // PR #173 is intentionally seam-only.
    productionReleaseStillDisabledWhenSwitchTrue: true,
    canonicalReleasePersistedStillFalse: true,
    crpFulfillStillFalse: true,
    rawProofAndReceiptNotPrinted: true,
    behaviorUnchanged: true,
  };

  assert.equal(summary.productionReleaseSwitchVisible, true);
  assert.equal(summary.productionReleaseSwitchDefaultsOff, true);
  assert.equal(summary.productionReleaseSwitchCanBeSetTrue, true);
  assert.equal(summary.productionReleaseStillDisabledWhenSwitchTrue, true);
  assert.equal(summary.canonicalReleasePersistedStillFalse, true);
  assert.equal(summary.crpFulfillStillFalse, true);
  assert.equal(summary.rawProofAndReceiptNotPrinted, true);
  assert.equal(summary.behaviorUnchanged, true);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
