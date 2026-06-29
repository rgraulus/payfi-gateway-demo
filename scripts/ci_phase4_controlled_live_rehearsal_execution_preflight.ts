#!/usr/bin/env node
/**
 * PR #279 — Phase 4 controlled live rehearsal execution preflight.
 *
 * This is an execution-facing, non-mutating preflight gate.
 *
 * Safe-by-default behavior:
 * - skipped unless PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT=true
 *
 * Enabled behavior:
 * - consumes the #278 runbook as the operator procedure
 * - requires #276 live stack readiness to be explicitly confirmed first
 * - requires #277 live rehearsal input contract to be explicitly confirmed first
 * - validates controlled/preflight-only rehearsal intent
 * - validates production-facing release flags are explicitly disabled
 * - validates controlled execution runtime flags are explicitly disabled for this preflight
 * - validates key rehearsal tuple inputs are still present and shell-safe
 *
 * This harness does not:
 * - start servers
 * - call live services
 * - call CRP fulfill
 * - execute buyer payment
 * - emit PAYMENT-RESPONSE
 * - release protected resources
 * - mutate replay state
 * - persist canonical release state
 * - enable production release
 */

import assert from "node:assert/strict";
import process from "node:process";

const LABEL = "phase4:controlled-live-rehearsal-execution-preflight-test";
const ENABLED = boolEnv("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT", false);

type CheckResult = {
  name: string;
  required: boolean;
  ok: boolean;
  detail?: unknown;
  error?: string;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function env(name: string): string {
  return process.env[name] ?? "";
}

function check(name: string, required: boolean, fn: () => unknown): CheckResult {
  try {
    return {
      name,
      required,
      ok: true,
      detail: fn(),
    };
  } catch (err: any) {
    return {
      name,
      required,
      ok: false,
      error: String(err?.message ?? err),
    };
  }
}

function requireNonEmpty(name: string): string {
  const value = env(name);
  assert.ok(value.length > 0, `${name} is required`);
  return value;
}

function validateTrue(name: string): string {
  const value = requireNonEmpty(name).toLowerCase();
  assert.equal(value, "true", `${name} must be explicitly true`);
  return value;
}

function validateFalse(name: string): string {
  const value = requireNonEmpty(name).toLowerCase();
  assert.equal(value, "false", `${name} must be explicitly false`);
  return value;
}

function validateEnum(name: string, allowed: string[]): string {
  const value = requireNonEmpty(name);
  assert.ok(allowed.includes(value), `${name} must be one of: ${allowed.join(", ")}`);
  return value;
}

function validateKid(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^[A-Za-z0-9._:-]+$/, `${name} contains unsupported characters`);
  return value;
}

function validateContractId(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^cid_[a-f0-9]{64}$/i, `${name} must look like cid_<64 hex chars>`);
  return value;
}

function validateNonEmptyPrintable(name: string): string {
  const value = requireNonEmpty(name);
  assert.ok(!/\s/.test(value), `${name} must not contain whitespace`);
  return value;
}

function validateResourcePath(name: string): string {
  const value = requireNonEmpty(name);
  assert.equal(value, "/paid-gated", `${name} must be preserved exactly as /paid-gated`);
  return value;
}

function isGitBashLikeRuntime(): boolean {
  return env("MSYSTEM").length > 0 || env("MINGW_PREFIX").length > 0;
}

function configuredPhase4ExecutionFlags() {
  const names = [
    "PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED",
    "PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS",
    "PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED",
  ];

  return Object.fromEntries(names.map((name) => [name, env(name) || null]));
}

async function main() {
  console.log(`[${LABEL}] enabled=${ENABLED}`);

  if (!ENABLED) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason:
            "set PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT=true to validate the controlled live rehearsal execution preflight gate",
          safety: {
            nonMutating: true,
            networkCalls: false,
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

  const results: CheckResult[] = [];

  results.push(check("runbook acknowledged", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_RUNBOOK_ACK"),
  ));
  results.push(check("#276 live stack readiness confirmed", true, () =>
    validateTrue("PHASE4_LIVE_STACK_READINESS_CONFIRMED"),
  ));
  results.push(check("#277 input contract confirmed", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT_CONFIRMED"),
  ));
  results.push(check("rollback procedure acknowledged", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_ROLLBACK_ACK"),
  ));
  results.push(check("stop conditions acknowledged", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_STOP_CONDITIONS_ACK"),
  ));

  results.push(check("execution preflight mode", true, () =>
    validateEnum("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT_MODE", ["preflight_only"]),
  ));
  results.push(check("rehearsal intent", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_INTENT", ["controlled_release_execution"]),
  ));

  const productionFlags = [
    "PHASE3_GATEWAY_RELEASE_ENABLED",
    "PHASE3_GATEWAY_TEST_RELEASE_ONLY",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
  ];

  for (const name of productionFlags) {
    results.push(check(`production flag disabled: ${name}`, true, () => validateFalse(name)));
  }

  results.push(check("controlled execution harness disabled for preflight", true, () =>
    validateFalse("PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS"),
  ));
  results.push(check("controlled execution runtime disabled for preflight", true, () =>
    validateFalse("PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED"),
  ));

  results.push(check("expected kid", true, () =>
    env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID") || validateKid("X402_EXPECTED_KID"),
  ));

  if (env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID")) {
    results.push(check("phase4 rehearsal expected kid shape", true, () =>
      validateKid("PHASE4_LIVE_REHEARSAL_EXPECTED_KID"),
    ));
  }

  results.push(check("resource method", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD", ["GET"]),
  ));
  results.push(check("resource path preserved", true, () =>
    validateResourcePath("PHASE4_LIVE_REHEARSAL_RESOURCE_PATH"),
  ));

  const gitBashLikeRuntime = isGitBashLikeRuntime();
  results.push(check("git bash path conversion disabled", gitBashLikeRuntime, () => {
    if (!gitBashLikeRuntime) {
      return { detected: false, requirement: "not_applicable" };
    }

    assert.equal(
      env("MSYS_NO_PATHCONV"),
      "1",
      "MSYS_NO_PATHCONV=1 is required under Git Bash/MSYS to preserve /paid-gated",
    );

    return {
      detected: true,
      MSYSTEM: env("MSYSTEM") || null,
      MSYS_NO_PATHCONV: env("MSYS_NO_PATHCONV"),
    };
  }));

  results.push(check("contract id confirmed", true, () =>
    validateContractId("PHASE4_LIVE_REHEARSAL_CONTRACT_ID"),
  ));
  results.push(check("chain id confirmed", true, () =>
    validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_CHAIN_ID"),
  ));
  results.push(check("payTo confirmed", true, () =>
    validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_PAY_TO"),
  ));
  results.push(check("replay backend intentional", true, () =>
    validateEnum("X402_REPLAY_BACKEND", ["memory", "redis"]),
  ));

  if (env("X402_REPLAY_BACKEND") === "redis") {
    results.push(check("redis replay url configured", true, () => {
      const value = env("X402_REDIS_URL") || env("REDIS_URL");
      assert.ok(value.length > 0, "X402_REDIS_URL or REDIS_URL is required when X402_REPLAY_BACKEND=redis");
      const parsed = new URL(value);
      assert.equal(parsed.protocol, "redis:", "redis replay URL must use redis://");
      return { configured: true };
    }));
  }

  results.push(check("phase4 execution flags declaration", false, () => ({
    configured: configuredPhase4ExecutionFlags(),
    note:
      "For #279 these are reported only, except controlled execution harness/enabled must remain explicitly false. #280 may deliberately change execution flags.",
  })));

  const requiredFailures = results.filter((result) => result.required && !result.ok);

  console.log(
    JSON.stringify(
      {
        ok: requiredFailures.length === 0,
        label: LABEL,
        contract: "phase4.controlledLiveRehearsalExecutionPreflight.v1",
        mode: "controlled_live_rehearsal_execution_preflight",
        prerequisites: {
          runbookConsumed: env("PHASE4_LIVE_REHEARSAL_RUNBOOK_ACK") === "true",
          liveStackReadinessConfirmed: env("PHASE4_LIVE_STACK_READINESS_CONFIRMED") === "true",
          inputContractConfirmed: env("PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT_CONFIRMED") === "true",
          rollbackAcknowledged: env("PHASE4_LIVE_REHEARSAL_ROLLBACK_ACK") === "true",
          stopConditionsAcknowledged: env("PHASE4_LIVE_REHEARSAL_STOP_CONDITIONS_ACK") === "true",
        },
        safety: {
          nonMutating: true,
          networkCalls: false,
          crpFulfillCalled: false,
          paymentAttempted: false,
          paymentResponseEmitted: false,
          protectedResourceReleased: false,
          replayTouched: false,
          canonicalReleasePersisted: false,
          productionReleaseEnabled: false,
        },
        nextFiniteRung:
          requiredFailures.length === 0
            ? "#280 controlled live/testnet rehearsal execution happy path"
            : "stop before execution and fix failed preflight inputs",
        results,
      },
      null,
      2,
    ),
  );

  assert.equal(
    requiredFailures.length,
    0,
    `required controlled live rehearsal execution preflight checks failed: ${JSON.stringify(requiredFailures)}`,
  );
}

main().catch((err: any) => {
  console.error(`[${LABEL}] failed`);
  console.error(err?.stack ?? err);
  process.exit(1);
});
