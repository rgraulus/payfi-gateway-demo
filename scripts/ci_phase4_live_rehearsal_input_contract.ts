#!/usr/bin/env node
/**
 * PR #277 — Phase 4 live/testnet rehearsal input contract.
 *
 * This is a non-mutating operator-input contract checkpoint.
 *
 * Safe-by-default behavior:
 * - skipped unless PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT=true
 *
 * Enabled behavior:
 * - validates the exact env/config contract required before a live/testnet rehearsal
 * - validates production release flags are explicitly disabled
 * - validates endpoint URL shape
 * - validates receipt trust inputs such as expected kid
 * - validates replay backend selection
 * - validates the intended payment tuple/resource contract inputs
 *
 * This harness does not:
 * - start servers
 * - call live services
 * - call CRP fulfill
 * - execute payment
 * - emit PAYMENT-RESPONSE
 * - release protected resources
 * - mutate replay/canonical persistence
 */

import assert from "node:assert/strict";
import process from "node:process";

const LABEL = "phase4:live-rehearsal-input-contract-test";

const ENABLED = boolEnv("PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT", false);

type CheckResult = {
  name: string;
  required: boolean;
  ok: boolean;
  value?: unknown;
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

function maskSecret(value: string): string {
  if (value.length === 0) return "";
  if (/^https?:\/\//.test(value) || /^postgres:\/\//.test(value) || /^redis:\/\//.test(value)) {
    return value.replace(/\/\/([^:@/]+):([^@/]+)@/g, "//***:***@");
  }
  return "***";
}

function safeValue(name: string, value: string): string {
  const upper = name.toUpperCase();

  if (upper.includes("DATABASE_URL") || upper.includes("REDIS_URL")) {
    return maskSecret(value);
  }

  const isSensitiveName =
    upper.includes("SECRET") ||
    upper.includes("PRIVATE_KEY") ||
    upper.includes("API_KEY") ||
    upper.endsWith("_KEY") ||
    upper.includes("AUTH_TOKEN") ||
    upper.includes("ACCESS_TOKEN") ||
    upper.includes("BEARER_TOKEN");

  if (isSensitiveName) {
    return maskSecret(value);
  }

  return value;
}

function check(name: string, required: boolean, fn: () => unknown): CheckResult {
  try {
    const detail = fn();
    return {
      name,
      required,
      ok: true,
      detail,
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

function validateUrl(name: string): string {
  const value = requireNonEmpty(name);
  const parsed = new URL(value);
  assert.ok(parsed.protocol === "http:" || parsed.protocol === "https:", `${name} must be http(s) URL`);
  assert.ok(parsed.hostname.length > 0, `${name} must include hostname`);
  return safeValue(name, value);
}

function validateDatabaseUrl(name: string): string {
  const value = requireNonEmpty(name);
  const parsed = new URL(value);
  assert.ok(parsed.protocol === "postgres:", `${name} must be postgres:// URL`);
  assert.ok(parsed.hostname.length > 0, `${name} must include hostname`);
  return safeValue(name, value);
}

function validateExplicitFalse(name: string): string {
  const value = requireNonEmpty(name).toLowerCase();
  assert.equal(value, "false", `${name} must be explicitly false`);
  return value;
}

function validateEnum(name: string, allowed: string[]): string {
  const value = requireNonEmpty(name);
  assert.ok(allowed.includes(value), `${name} must be one of: ${allowed.join(", ")}`);
  return value;
}

function validatePath(name: string): string {
  const value = requireNonEmpty(name);
  assert.ok(value.startsWith("/"), `${name} must start with /`);
  assert.ok(!value.includes(".."), `${name} must not contain ..`);
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

function validateContractVersion(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^\d+\.\d+\.\d+$/, `${name} must be semver-like, e.g. 1.0.0`);
  return value;
}

function validateInteger(name: string): number {
  const value = requireNonEmpty(name);
  assert.match(value, /^\d+$/, `${name} must be a non-negative integer`);
  return Number(value);
}

function validateAmount(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^(0|[1-9]\d*)(\.\d+)?$/, `${name} must be a positive decimal string`);
  assert.ok(Number(value) > 0, `${name} must be greater than zero`);
  return value;
}

function validateNonEmptyPrintable(name: string): string {
  const value = requireNonEmpty(name);
  assert.ok(!/\s/.test(value), `${name} must not contain whitespace`);
  return safeValue(name, value);
}

function isGitBashLikeRuntime(): boolean {
  return env("MSYSTEM").length > 0 || env("MINGW_PREFIX").length > 0;
}

function configuredPhase4Flags() {
  const names = [
    "PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS",
    "PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS",
    "PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_HARNESS",
    "PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED",
    "PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_HARNESS",
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
          reason: "set PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT=true to validate live/testnet rehearsal inputs",
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

  results.push(check("intent", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_INTENT", ["readiness_only", "controlled_release_execution"]),
  ));

  results.push(check("database url", true, () => validateDatabaseUrl("DATABASE_URL")));
  results.push(check("gateway base url", true, () => validateUrl("GATEWAY_BASE_URL")));
  results.push(check("orchestrator base url", true, () => validateUrl("ORCHESTRATOR_BASE_URL")));
  results.push(check("orchestrator api key present", true, () => validateNonEmptyPrintable("ORCHESTRATOR_API_KEY")));
  results.push(check("crp base url", true, () => validateUrl("CRP_BASE_URL")));
  results.push(check("crp jwks url", true, () => validateUrl("CRP_JWKS_URL")));
  results.push(check("expected kid", true, () =>
    env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID") || validateKid("X402_EXPECTED_KID"),
  ));

  if (env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID")) {
    results.push(check("phase4 rehearsal expected kid shape", true, () =>
      validateKid("PHASE4_LIVE_REHEARSAL_EXPECTED_KID"),
    ));
  }

  results.push(check("replay backend", true, () => validateEnum("X402_REPLAY_BACKEND", ["memory", "redis"])));

  if (env("X402_REPLAY_BACKEND") === "redis") {
    results.push(check("redis url for replay backend", true, () => {
      const value = env("X402_REDIS_URL") || env("REDIS_URL");
      assert.ok(value.length > 0, "X402_REDIS_URL or REDIS_URL is required when X402_REPLAY_BACKEND=redis");
      const parsed = new URL(value);
      assert.equal(parsed.protocol, "redis:", "redis replay URL must use redis://");
      return maskSecret(value);
    }));
  }

  const productionFlags = [
    "PHASE3_GATEWAY_RELEASE_ENABLED",
    "PHASE3_GATEWAY_TEST_RELEASE_ONLY",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
  ];

  for (const name of productionFlags) {
    results.push(check(`production flag disabled: ${name}`, true, () => validateExplicitFalse(name)));
  }

  results.push(check("resource method", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD", ["GET", "POST"]),
  ));
  results.push(check("resource path", true, () => validatePath("PHASE4_LIVE_REHEARSAL_RESOURCE_PATH")));

  const gitBashLikeRuntime = isGitBashLikeRuntime();
  results.push(check("git bash path conversion disabled", gitBashLikeRuntime, () => {
    if (!gitBashLikeRuntime) {
      return { detected: false, requirement: "not_applicable" };
    }

    assert.equal(
      env("MSYS_NO_PATHCONV"),
      "1",
      "MSYS_NO_PATHCONV=1 is required under Git Bash/MSYS to preserve leading-slash resource paths",
    );

    return {
      detected: true,
      MSYSTEM: env("MSYSTEM") || null,
      MSYS_NO_PATHCONV: env("MSYS_NO_PATHCONV"),
    };
  }));

  results.push(check("contract id", true, () => validateContractId("PHASE4_LIVE_REHEARSAL_CONTRACT_ID")));
  results.push(check("contract version", true, () => validateContractVersion("PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION")));
  results.push(check("merchant id", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_MERCHANT_ID")));
  results.push(check("network", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_NETWORK", ["concordium:testnet"]),
  ));
  results.push(check("chain id", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_CHAIN_ID")));
  results.push(check("asset type", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_ASSET_TYPE", ["PLT"]),
  ));
  results.push(check("asset token id", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID")));
  results.push(check("asset decimals", true, () => validateInteger("PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS")));
  results.push(check("amount", true, () => validateAmount("PHASE4_LIVE_REHEARSAL_AMOUNT")));
  results.push(check("payTo", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_PAY_TO")));

  results.push(check("phase4 flags declaration", false, () => ({
    configured: configuredPhase4Flags(),
    requirement:
      env("PHASE4_LIVE_REHEARSAL_INTENT") === "controlled_release_execution"
        ? "future controlled execution rehearsal should explicitly set and validate the full Phase 4 flag chain"
        : "not required for readiness_only input contract",
  })));

  const requiredFailures = results.filter((result) => result.required && !result.ok);

  console.log(
    JSON.stringify(
      {
        ok: requiredFailures.length === 0,
        label: LABEL,
        contract: "phase4.liveRehearsalInputContract.v1",
        mode: "input_contract_only",
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
        results,
      },
      null,
      2,
    ),
  );

  assert.equal(
    requiredFailures.length,
    0,
    `required live/testnet rehearsal input contract checks failed: ${JSON.stringify(requiredFailures)}`,
  );
}

main().catch((err: any) => {
  console.error(`[${LABEL}] failed`);
  console.error(err?.stack ?? err);
  process.exit(1);
});
