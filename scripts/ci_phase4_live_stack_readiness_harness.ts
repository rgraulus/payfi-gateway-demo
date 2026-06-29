#!/usr/bin/env node
/**
 * PR #276 — Phase 4 live stack readiness harness.
 *
 * This is a non-mutating live-stack readiness checkpoint.
 *
 * Safe-by-default behavior:
 * - the harness is skipped unless PHASE4_LIVE_STACK_READINESS_HARNESS=true
 *
 * Enabled behavior:
 * - checks externally running live/local services
 * - verifies wallet-proxy health
 * - verifies CRP health and JWKS reachability
 * - reports CRP JWKS kid(s)
 * - verifies orchestrator health
 * - verifies Gateway health and /readyz
 * - asserts production release flags remain disabled
 * - optionally asserts the Phase 4 readiness flag chain is enabled
 *
 * This harness does not:
 * - start Gateway
 * - call /paid-gated
 * - call CRP fulfill
 * - execute a buyer payment
 * - emit PAYMENT-RESPONSE
 * - release protected resources
 * - mutate replay/canonical persistence
 */

import assert from "node:assert/strict";
import process from "node:process";

const LABEL = "phase4:live-stack-readiness-harness-test";

const ENABLED = boolEnv("PHASE4_LIVE_STACK_READINESS_HARNESS", false);
const EXPECT_PHASE4_FLAGS = boolEnv("PHASE4_LIVE_STACK_READINESS_EXPECT_PHASE4_FLAGS", false);
const REQUIRE_EXPECTED_KID = boolEnv("PHASE4_LIVE_STACK_READINESS_REQUIRE_EXPECTED_KID", false);
const TIMEOUT_MS = Number(process.env.PHASE4_LIVE_STACK_READINESS_TIMEOUT_MS || 5000);

const CRP_BASE_URL = trimTrailingSlash(process.env.CRP_BASE_URL || "http://127.0.0.1:8080");
const ORCHESTRATOR_BASE_URL = trimTrailingSlash(process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090");
const GATEWAY_BASE_URL = trimTrailingSlash(process.env.GATEWAY_BASE_URL || "http://localhost:3005");

const WALLET_PROXY_HEALTH_URL =
  process.env.PHASE4_LIVE_STACK_READINESS_WALLET_PROXY_HEALTH_URL || "http://localhost:3000/v0/health";
const CRP_HEALTH_URL = process.env.PHASE4_LIVE_STACK_READINESS_CRP_HEALTH_URL || `${CRP_BASE_URL}/healthz`;
const CRP_JWKS_URL = process.env.CRP_JWKS_URL || `${CRP_BASE_URL}/.well-known/jwks.json`;
const ORCHESTRATOR_HEALTH_URL =
  process.env.PHASE4_LIVE_STACK_READINESS_ORCHESTRATOR_HEALTH_URL || `${ORCHESTRATOR_BASE_URL}/healthz`;
const GATEWAY_HEALTH_URL =
  process.env.PHASE4_LIVE_STACK_READINESS_GATEWAY_HEALTH_URL || `${GATEWAY_BASE_URL}/healthz`;
const GATEWAY_READYZ_URL =
  process.env.PHASE4_LIVE_STACK_READINESS_GATEWAY_READYZ_URL || `${GATEWAY_BASE_URL}/readyz`;
const UPSTREAM_HEALTH_URL = process.env.PHASE4_LIVE_STACK_READINESS_UPSTREAM_HEALTH_URL || "";

const EXPECTED_KID =
  process.env.PHASE4_LIVE_STACK_READINESS_EXPECTED_KID || process.env.X402_EXPECTED_KID || "";

type CheckResult = {
  name: string;
  required: boolean;
  ok: boolean;
  url?: string;
  status?: number;
  detail?: unknown;
  error?: string;
};

type HttpResult = {
  status: number;
  text: string;
  json: any;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function safeUrl(value: string): string {
  return value.replace(/\/\/([^:@/]+):([^@/]+)@/g, "//***:***@");
}

function jsonPreview(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

async function fetchJson(url: string): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let json: any = null;

    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      status: response.status,
      text,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function check(
  name: string,
  url: string,
  required: boolean,
  validate: (http: HttpResult) => unknown,
): Promise<CheckResult> {
  try {
    const http = await fetchJson(url);
    const detail = validate(http);

    return {
      name,
      required,
      ok: true,
      url: safeUrl(url),
      status: http.status,
      detail: jsonPreview(detail),
    };
  } catch (err: any) {
    return {
      name,
      required,
      ok: false,
      url: safeUrl(url),
      error: String(err?.message ?? err),
    };
  }
}

function assertStatus2xx(http: HttpResult, name: string) {
  assert.ok(http.status >= 200 && http.status < 300, `${name} expected 2xx, got ${http.status}: ${http.text}`);
}

function assertFalse(value: unknown, name: string) {
  assert.equal(value, false, `${name} must be false`);
}

function assertTrue(value: unknown, name: string) {
  assert.equal(value, true, `${name} must be true`);
}

function gatewayHealthDetail(http: HttpResult) {
  assertStatus2xx(http, "gateway /healthz");

  const phase3 = http.json?.phase3;
  const phase4 = http.json?.phase4;

  assert.ok(phase3 && typeof phase3 === "object", "gateway /healthz must expose phase3 readiness");
  assert.ok(phase4 && typeof phase4 === "object", "gateway /healthz must expose phase4 readiness");

  assertFalse(phase3.gatewayReleaseEnabled, "phase3.gatewayReleaseEnabled");
  assertFalse(phase3.gatewayTestReleaseOnly, "phase3.gatewayTestReleaseOnly");
  assertFalse(phase3.gatewayProductionReleaseEnabled, "phase3.gatewayProductionReleaseEnabled");
  assertFalse(phase3.gatewayProductionReleaseDryRunEnabled, "phase3.gatewayProductionReleaseDryRunEnabled");

  const phase4FlagNames = [
    "realCrpFulfillInvocationBoundaryHarness",
    "realCrpFulfillInvocationBoundaryEnabled",
    "realReceiptJwsHandoffContractHarness",
    "realReceiptJwsHandoffContractEnabled",
    "realReceiptJwsDecodePreflightHarness",
    "realReceiptJwsDecodePreflightEnabled",
    "realReceiptJwsSignatureVerificationPreflightHarness",
    "realReceiptJwsSignatureVerificationPreflightEnabled",
    "realReceiptSettlementVerificationPreflightHarness",
    "realReceiptSettlementVerificationPreflightEnabled",
    "realReceiptTupleBindingVerificationPreflightHarness",
    "realReceiptTupleBindingVerificationPreflightEnabled",
    "realReceiptReleaseEligibilityCompositionPreflightHarness",
    "realReceiptReleaseEligibilityCompositionPreflightEnabled",
    "realReceiptReplayCanonicalPersistencePreflightHarness",
    "realReceiptReplayCanonicalPersistencePreflightEnabled",
    "realReceiptReleaseDecisionPreflightHarness",
    "realReceiptReleaseDecisionPreflightEnabled",
    "controlledRealReceiptReleaseExecutionHarness",
    "controlledRealReceiptReleaseExecutionEnabled",
  ];

  if (EXPECT_PHASE4_FLAGS) {
    for (const name of phase4FlagNames) {
      assertTrue(phase4[name], `phase4.${name}`);
    }
  }

  return {
    productionReleaseFlags: {
      gatewayReleaseEnabled: phase3.gatewayReleaseEnabled,
      gatewayTestReleaseOnly: phase3.gatewayTestReleaseOnly,
      gatewayProductionReleaseEnabled: phase3.gatewayProductionReleaseEnabled,
      gatewayProductionReleaseDryRunEnabled: phase3.gatewayProductionReleaseDryRunEnabled,
    },
    phase4Flags: Object.fromEntries(phase4FlagNames.map((name) => [name, phase4[name]])),
    phase4FlagExpectation: EXPECT_PHASE4_FLAGS ? "all_true" : "reported_only",
  };
}

function gatewayReadyzDetail(http: HttpResult) {
  assertStatus2xx(http, "gateway /readyz");
  assert.equal(http.json?.ok, true, "gateway /readyz ok must be true");

  if (Object.prototype.hasOwnProperty.call(http.json ?? {}, "jwksOk")) {
    assert.equal(http.json?.jwksOk, true, "gateway /readyz jwksOk must be true when present");
  }

  return {
    ok: http.json?.ok,
    jwksOk: http.json?.jwksOk ?? null,
  };
}

async function main() {
  console.log(`[${LABEL}] enabled=${ENABLED}`);

  if (!ENABLED) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "set PHASE4_LIVE_STACK_READINESS_HARNESS=true to run live-stack readiness checks",
          safety: {
            nonMutating: true,
            crpFulfillCalled: false,
            paymentAttempted: false,
            paymentResponseEmitted: false,
            protectedResourceReleased: false,
            replayTouched: false,
            canonicalReleasePersisted: false,
            productionReleaseEnabled: false,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  if (REQUIRE_EXPECTED_KID) {
    assert.ok(EXPECTED_KID.length > 0, "expected kid is required when REQUIRE_EXPECTED_KID=true");
  }

  const results: CheckResult[] = [];

  results.push(
    await check("wallet-proxy health", WALLET_PROXY_HEALTH_URL, true, (http) => {
      assertStatus2xx(http, "wallet-proxy health");
      assert.equal(http.json?.healthy, true, "wallet-proxy healthy must be true");
      return {
        healthy: http.json?.healthy,
        lastFinalTime: http.json?.lastFinalTime,
        version: http.json?.version,
      };
    }),
  );

  results.push(
    await check("crp health", CRP_HEALTH_URL, true, (http) => {
      assertStatus2xx(http, "crp health");
      return http.json ?? { body: http.text.slice(0, 200) };
    }),
  );

  results.push(
    await check("crp jwks", CRP_JWKS_URL, true, (http) => {
      assertStatus2xx(http, "crp jwks");
      assert.ok(Array.isArray(http.json?.keys), "JWKS must expose keys array");
      assert.ok(http.json.keys.length > 0, "JWKS must expose at least one key");

      const kids = http.json.keys.map((key: any) => key?.kid).filter(Boolean);
      const algs = http.json.keys.map((key: any) => key?.alg).filter(Boolean);

      if (EXPECTED_KID.length > 0) {
        assert.ok(kids.includes(EXPECTED_KID), `expected kid ${EXPECTED_KID} must be present in CRP JWKS`);
      }

      return {
        keyCount: http.json.keys.length,
        kids,
        algs,
        expectedKid: EXPECTED_KID || null,
        expectedKidMode: EXPECTED_KID ? "asserted" : "reported_only",
      };
    }),
  );

  results.push(
    await check("orchestrator health", ORCHESTRATOR_HEALTH_URL, true, (http) => {
      assertStatus2xx(http, "orchestrator health");
      return http.json ?? { body: http.text.slice(0, 200) };
    }),
  );

  results.push(await check("gateway health", GATEWAY_HEALTH_URL, true, gatewayHealthDetail));

  results.push(await check("gateway readyz", GATEWAY_READYZ_URL, true, gatewayReadyzDetail));

  if (UPSTREAM_HEALTH_URL.length > 0) {
    results.push(
      await check("upstream health", UPSTREAM_HEALTH_URL, false, (http) => {
        assertStatus2xx(http, "upstream health");
        return http.json ?? { body: http.text.slice(0, 200) };
      }),
    );
  } else {
    results.push({
      name: "upstream health",
      required: false,
      ok: true,
      detail: {
        skipped: true,
        reason: "PHASE4_LIVE_STACK_READINESS_UPSTREAM_HEALTH_URL not set",
      },
    });
  }

  const requiredFailures = results.filter((result) => result.required && !result.ok);

  console.log(
    JSON.stringify(
      {
        ok: requiredFailures.length === 0,
        label: LABEL,
        mode: "live_stack_readiness",
        config: {
          crpBaseUrl: safeUrl(CRP_BASE_URL),
          orchestratorBaseUrl: safeUrl(ORCHESTRATOR_BASE_URL),
          gatewayBaseUrl: safeUrl(GATEWAY_BASE_URL),
          expectedKid: EXPECTED_KID || null,
          expectPhase4Flags: EXPECT_PHASE4_FLAGS,
          requireExpectedKid: REQUIRE_EXPECTED_KID,
          timeoutMs: TIMEOUT_MS,
        },
        safety: {
          nonMutating: true,
          crpFulfillCalled: false,
          paymentAttempted: false,
          paymentResponseEmitted: false,
          protectedResourceReleased: false,
          replayTouched: false,
          canonicalReleasePersisted: false,
          productionReleaseEnabled: false,
        },
        results,
      },
      null,
      2,
    ),
  );

  assert.equal(requiredFailures.length, 0, `required live-stack readiness checks failed: ${JSON.stringify(requiredFailures)}`);
}

main().catch((err: any) => {
  console.error(`[${LABEL}] failed`);
  console.error(err?.stack ?? err);
  process.exit(1);
});
