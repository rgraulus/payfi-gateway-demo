#!/usr/bin/env node
/**
 * PR #281 — Phase 4 consolidated live rehearsal fail-closed evidence.
 *
 * This harness does not build a new release path. It consolidates negative
 * evidence around the #280 controlled live/testnet happy path.
 *
 * Safe-by-default behavior:
 * - skipped unless PHASE4_CONSOLIDATED_LIVE_REHEARSAL_FAIL_CLOSED_EVIDENCE=true
 *
 * Enabled behavior:
 * - proves #280 disabled/default path is side-effect free
 * - proves #280 release input gates fail before runtime calls when operator
 *   acknowledgement is missing
 * - proves #280 release input gates fail before runtime calls when controlled
 *   txHash is malformed
 * - delegates to existing controlled release not-ready/signature/tuple guards
 *
 * This harness does not:
 * - start an externally running live Gateway
 * - call a live CRP/facilitator
 * - require a new buyer payment
 * - reuse the consumed #280 nonce for release
 * - enable production release
 * - print raw receipt JWS
 * - print raw PAYMENT-RESPONSE
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const LABEL = "phase4:consolidated-live-rehearsal-fail-closed-evidence-test";
const ENABLED = boolEnv("PHASE4_CONSOLIDATED_LIVE_REHEARSAL_FAIL_CLOSED_EVIDENCE", false);

type EvidenceResult = {
  name: string;
  ok: boolean;
  command: string;
  exitCode: number | null;
  evidence: Record<string, unknown>;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function runNpmScript(
  scriptName: string,
  extraEnv: Record<string, string | undefined>,
): { status: number | null; stdout: string; stderr: string; command: string } {
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...extraEnv,
  };

  const result = spawnSync("npm", ["run", scriptName], {
    env: mergedEnv,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 12 * 1024 * 1024,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    command: `npm run ${scriptName}`,
  };
}

function combinedOutput(run: { stdout: string; stderr: string }): string {
  return `${run.stdout}\n${run.stderr}`;
}

function assertContains(output: string, needle: string, message: string) {
  assert.ok(output.includes(needle), `${message}; missing ${JSON.stringify(needle)}`);
}

function assertNotContains(output: string, needle: string, message: string) {
  assert.ok(!output.includes(needle), `${message}; unexpectedly found ${JSON.stringify(needle)}`);
}

function syntheticReleaseBaseEnv(): Record<string, string> {
  return {
    MSYS_NO_PATHCONV: "1",

    PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH: "true",
    PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH_MODE: "release",

    PHASE4_LIVE_REHEARSAL_RUNBOOK_ACK: "true",
    PHASE4_LIVE_STACK_READINESS_CONFIRMED: "true",
    PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT_CONFIRMED: "true",
    PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT_CONFIRMED: "true",
    PHASE4_LIVE_REHEARSAL_ROLLBACK_ACK: "true",
    PHASE4_LIVE_REHEARSAL_STOP_CONDITIONS_ACK: "true",

    PHASE4_LIVE_REHEARSAL_ALLOW_CRP_FULFILL: "true",
    PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_RELEASE: "true",
    PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_REPLAY_CANONICAL_MUTATION: "true",

    PHASE4_LIVE_REHEARSAL_PREPARED_NONCE: "demo-pr281-fail-closed-input-gate-only",
    PHASE4_LIVE_REHEARSAL_TX_HASH:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

    GATEWAY_BASE_URL: "http://127.0.0.1:9",
    CRP_BASE_URL: "http://127.0.0.1:9",
    CRP_JWKS_URL: "http://127.0.0.1:9/.well-known/jwks.json",
    PHASE4_LIVE_REHEARSAL_EXPECTED_KID: "kid-dev-1",
    X402_EXPECTED_KID: "kid-dev-1",
    X402_REPLAY_BACKEND: "memory",

    PHASE3_GATEWAY_RELEASE_ENABLED: "false",
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: "false",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: "false",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED: "false",

    PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD: "GET",
    PHASE4_LIVE_REHEARSAL_RESOURCE_PATH: "/paid-gated",
    PHASE4_LIVE_REHEARSAL_CONTRACT_ID:
      "cid_e7fb8ef3933f5b45c7a246267858baf5b84ba60a7c178d0b84cc4e90fc564d98",
    PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION: "1.0.0",
    PHASE4_LIVE_REHEARSAL_MERCHANT_ID: "demo-merchant",
    PHASE4_LIVE_REHEARSAL_NETWORK: "concordium:testnet",
    PHASE4_LIVE_REHEARSAL_NETWORK_GENESIS_INDEX: "7",
    PHASE4_LIVE_REHEARSAL_CHAIN_ID: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
    PHASE4_LIVE_REHEARSAL_ASSET_TYPE: "PLT",
    PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID: "EUDemo",
    PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS: "6",
    PHASE4_LIVE_REHEARSAL_AMOUNT: "0.050101",
    PHASE4_LIVE_REHEARSAL_PAY_TO:
      "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
  };
}

function disabledHappyPathEvidence(): EvidenceResult {
  const run = runNpmScript("phase4:controlled-live-rehearsal-execution-happy-path-test", {
    PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH: "",
  });

  const output = combinedOutput(run);

  assert.equal(run.status, 0, `disabled happy-path harness must exit 0: ${output}`);
  assertContains(output, '"skipped": true', "disabled happy-path harness must skip");
  assertContains(output, '"crpFulfillCalled": false', "disabled path must not call CRP fulfill");
  assertContains(output, '"paymentResponseEmitted": false', "disabled path must not emit PAYMENT-RESPONSE");
  assertContains(output, '"protectedResourceReleased": false', "disabled path must not release resource");
  assertContains(output, '"replayTouched": false', "disabled path must not touch replay");
  assertContains(output, '"canonicalReleasePersisted": false', "disabled path must not persist canonical release");
  assertContains(output, '"productionReleaseEnabled": false', "disabled path must not enable production release");

  return {
    name: "#280 disabled/default path is side-effect free",
    ok: true,
    command: run.command,
    exitCode: run.status,
    evidence: {
      skipped: true,
      crpFulfillCalled: false,
      paymentResponseEmitted: false,
      protectedResourceReleased: false,
      replayTouched: false,
      canonicalReleasePersisted: false,
      productionReleaseEnabled: false,
    },
  };
}

function missingOperatorAckEvidence(): EvidenceResult {
  const env = syntheticReleaseBaseEnv();
  delete env.PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_RELEASE;

  const run = runNpmScript("phase4:controlled-live-rehearsal-execution-happy-path-test", env);
  const output = combinedOutput(run);

  assert.notEqual(run.status, 0, "missing operator acknowledgement must fail before runtime");
  assertContains(
    output,
    "PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_RELEASE",
    "failure must identify the missing planned-release acknowledgement",
  );
  assertNotContains(output, '"gateway health"', "missing ack must fail before Gateway health/runtime calls");
  assertNotContains(output, '"crp jwks expected kid"', "missing ack must fail before CRP/JWKS runtime calls");
  assertNotContains(output, '"firstUse"', "missing ack must not attempt first use");
  assertNotContains(output, '"paymentResponseEmitted": true', "missing ack must not emit PAYMENT-RESPONSE");
  assertNotContains(output, '"resourceReleased": true', "missing ack must not release protected resource");
  assertNotContains(output, '"canonicalReleasePersisted": true', "missing ack must not persist canonical release");

  return {
    name: "#280 release refuses missing operator acknowledgement before runtime",
    ok: true,
    command: run.command,
    exitCode: run.status,
    evidence: {
      failedClosed: true,
      failedBeforeGatewayHealth: true,
      firstUseAttempted: false,
      paymentResponseEmitted: false,
      protectedResourceReleased: false,
      canonicalReleasePersisted: false,
      productionReleaseEnabled: false,
    },
  };
}

function malformedTxHashEvidence(): EvidenceResult {
  const env = syntheticReleaseBaseEnv();
  env.PHASE4_LIVE_REHEARSAL_TX_HASH = "not-a-valid-tx-hash";

  const run = runNpmScript("phase4:controlled-live-rehearsal-execution-happy-path-test", env);
  const output = combinedOutput(run);

  assert.notEqual(run.status, 0, "malformed txHash must fail before runtime");
  assertContains(
    output,
    "PHASE4_LIVE_REHEARSAL_TX_HASH",
    "failure must identify malformed controlled txHash",
  );
  assertNotContains(output, '"gateway health"', "malformed txHash must fail before Gateway health/runtime calls");
  assertNotContains(output, '"crp jwks expected kid"', "malformed txHash must fail before CRP/JWKS runtime calls");
  assertNotContains(output, '"firstUse"', "malformed txHash must not attempt first use");
  assertNotContains(output, '"paymentResponseEmitted": true', "malformed txHash must not emit PAYMENT-RESPONSE");
  assertNotContains(output, '"resourceReleased": true', "malformed txHash must not release protected resource");
  assertNotContains(output, '"canonicalReleasePersisted": true', "malformed txHash must not persist canonical release");

  return {
    name: "#280 release refuses malformed controlled txHash before runtime",
    ok: true,
    command: run.command,
    exitCode: run.status,
    evidence: {
      failedClosed: true,
      failedBeforeGatewayHealth: true,
      firstUseAttempted: false,
      paymentResponseEmitted: false,
      protectedResourceReleased: false,
      canonicalReleasePersisted: false,
      productionReleaseEnabled: false,
    },
  };
}

function delegatedGuardEvidence(scriptName: string, name: string): EvidenceResult {
  const run = runNpmScript(scriptName, {});
  const output = combinedOutput(run);

  assert.equal(run.status, 0, `${name} must pass: ${output}`);
  assertContains(output, '"ok": true', `${name} must emit ok=true summary`);
  assertContains(output, '"paymentResponseEmitted": false', `${name} must not emit PAYMENT-RESPONSE`);
  assertContains(output, '"resourceReleased": false', `${name} must not release protected resource`);
  assertContains(output, '"canonicalReleasePersisted": false', `${name} must not persist canonical release`);
  assertContains(output, '"replayTouched": false', `${name} must not touch replay`);

  return {
    name,
    ok: true,
    command: run.command,
    exitCode: run.status,
    evidence: {
      delegatedExistingGuardAssertions: true,
      paymentResponseEmitted: false,
      protectedResourceReleased: false,
      canonicalReleasePersisted: false,
      replayTouched: false,
      productionReleaseEnabled: false,
    },
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
          reason:
            "set PHASE4_CONSOLIDATED_LIVE_REHEARSAL_FAIL_CLOSED_EVIDENCE=true to run consolidated #281 fail-closed evidence",
          safety: {
            startsExternallyRunningGateway: false,
            callsLiveCrp: false,
            requiresNewBuyerPayment: false,
            reusesConsumedHappyPathNonceForRelease: false,
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

  const results: EvidenceResult[] = [];

  results.push(disabledHappyPathEvidence());
  results.push(missingOperatorAckEvidence());
  results.push(malformedTxHashEvidence());

  results.push(
    delegatedGuardEvidence(
      "phase4:controlled-real-receipt-release-execution-not-ready-guard-test",
      "existing controlled release not-ready guard fails closed",
    ),
  );

  results.push(
    delegatedGuardEvidence(
      "phase4:controlled-real-receipt-release-execution-signature-guard-test",
      "existing controlled release signature/JWKS guard fails closed",
    ),
  );

  results.push(
    delegatedGuardEvidence(
      "phase4:controlled-real-receipt-release-execution-tuple-binding-guard-test",
      "existing controlled release tuple-binding guard fails closed",
    ),
  );

  const failed = results.filter((result) => !result.ok);

  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        label: LABEL,
        contract: "phase4.consolidatedLiveRehearsalFailClosedEvidence.v1",
        mode: "consolidated_fail_closed_evidence",
        scope: {
          buildsNewReleasePath: false,
          performsNewLivePayment: false,
          callsLiveCrp: false,
          requiresExternallyRunningStack: false,
          reusesConsumedHappyPathNonceForRelease: false,
          enablesProductionRelease: false,
        },
        safety: {
          paymentResponseEmittedByThisHarness: false,
          protectedResourceReleasedByThisHarness: false,
          liveReplayTouchedByThisHarness: false,
          liveCanonicalReleasePersistedByThisHarness: false,
          rawReceiptPrinted: false,
          rawPaymentResponsePrinted: false,
          productionReleaseEnabled: false,
        },
        results,
        nextFiniteRung: "#282 live rehearsal outcome/release-readiness checkpoint",
      },
      null,
      2,
    ),
  );

  assert.equal(failed.length, 0, `fail-closed evidence failed: ${JSON.stringify(failed)}`);
}

main().catch((err: any) => {
  console.error(`[${LABEL}] failed`);
  console.error(err?.stack ?? err);
  process.exit(1);
});
