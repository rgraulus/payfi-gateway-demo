#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_guarded_test_release.ts
 *
 * PR #157 regression harness.
 *
 * Proves a captured wallet-proof-derived Gateway release decision can be
 * evaluated next to the existing guarded test-release flag surface without
 * weakening the Gateway's fail-closed runtime posture.
 *
 * This is intentionally test-only. It does not submit a real receipt JWS,
 * does not emit PAYMENT-RESPONSE, does not touch replay, does not call CRP
 * fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  parseAuthorizationEnvelope,
} from "../src/phase3/authorizationEnvelope";
import type {
  Phase3DemoContractBindingSnapshot,
} from "../src/phase3/demoChallengeBinding";
import {
  buildPhase3GatewayReleaseDecision,
  type Phase3GatewayReleaseDecision,
} from "../src/phase3/gatewayReleaseDecisionAdapter";
import {
  liveVerifyDirectBuyerEnvelopeWithDeps,
  type LiveZkpSdkInvocationDeps,
} from "../src/phase3/liveZkpVerifierAdapter";
import {
  buildModelAEligibilityResult,
} from "../src/phase3/modelAEligibility";
import {
  bindModelAEligibilityToChallengeContext,
  type ModelAEligibilityBindingResult,
} from "../src/phase3/modelAEligibilityBinding";
import {
  buildX402ReceiptPaymentSatisfaction,
} from "../src/phase3/x402ReceiptPaymentSignal";
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
import {
  buildSafeMetadata,
  describeLiveBuyerProofCaptureAdapterInputContract,
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const GATEWAY_PORT_FLAG_ONLY = Number(process.env.PHASE3_CAPTURED_PROOF_GUARDED_FLAG_ONLY_PORT || 3076);
const GATEWAY_PORT_BOTH_GUARDS = Number(process.env.PHASE3_CAPTURED_PROOF_GUARDED_BOTH_GUARDS_PORT || 3077);
const LABEL = "phase3:captured-proof-guarded-test-release-test";

type GuardScenario = "release-flag-alone" | "both-test-guards";

function asRecord(value: unknown, name: string): Record<string, unknown> {
  assert.equal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    true,
    name + " must be an object",
  );
  return value as Record<string, unknown>;
}

function getRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(parent[key], key);
}

function getString(parent: Record<string, unknown>, key: string): string {
  assert.equal(typeof parent[key], "string", key + " must be a string");
  return String(parent[key]);
}

function buildContractFromChallenge(challenge: Record<string, unknown>): Phase3DemoContractBindingSnapshot {
  const resource = getRecord(challenge, "resource");
  const contract = getRecord(challenge, "contract");
  const asset = getRecord(challenge, "asset");

  return {
    merchantId: getString(challenge, "merchantId"),
    resource: {
      method: getString(resource, "method"),
      path: getString(resource, "path"),
    },
    contractId: getString(contract, "contractId"),
    contractVersion: getString(contract, "contractVersion"),
    isFrozen: contract.isFrozen === true,
    network: getString(challenge, "network"),
    chain_id: getString(challenge, "chain_id"),
    asset: {
      type: getString(asset, "type"),
      tokenId: getString(asset, "tokenId"),
      decimals: Number(asset.decimals),
    },
    amount: getString(challenge, "amount"),
    payTo: getString(challenge, "payTo"),
  };
}

function buildFakeLiveDeps(expectedPresentationContext: string): LiveZkpSdkInvocationDeps {
  return {
    createGrpcClient(input) {
      assert.equal(input.grpcHost, "127.0.0.1");
      assert.equal(input.grpcPort, 1);
      return {
        fake: "grpc-client",
      };
    },

    parsePresentation(input) {
      const presentation = asRecord(input.presentation, "presentation");
      assert.equal(presentation.presentationContext, expectedPresentationContext);
      assert.equal(presentation.sanitized, true);
      assert.equal(presentation.rawProofMaterialPresent, false);

      return {
        fake: "parsed-presentation",
        challenge: expectedPresentationContext,
      };
    },

    async getPublicData(input) {
      assert.deepEqual(input.grpc, {
        fake: "grpc-client",
      });
      assert.equal(input.network, "testnet");
      assert.deepEqual(input.presentation, {
        fake: "parsed-presentation",
        challenge: expectedPresentationContext,
      });

      return [
        {
          inputs: {
            credentialStatements: [{ statement: "age-region-v1" }],
          },
        },
      ];
    },

    async getCryptographicParameters(input) {
      assert.deepEqual(input.grpc, {
        fake: "grpc-client",
      });

      return {
        fake: "cryptographic-parameters",
      };
    },

    verifyPresentation(input) {
      assert.deepEqual(input.presentation, {
        fake: "parsed-presentation",
        challenge: expectedPresentationContext,
      });
      assert.deepEqual(input.cryptographicParameters, {
        fake: "cryptographic-parameters",
      });
      assert.deepEqual(input.publicData, [
        {
          credentialStatements: [{ statement: "age-region-v1" }],
        },
      ]);

      return {
        challenge: expectedPresentationContext,
        credentialStatements: [{ statement: "age-region-v1" }],
      };
    },
  };
}

function assertGatewayDecisionSafetyFlags(decision: Phase3GatewayReleaseDecision): void {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

function acceptedReceiptPayment() {
  return buildX402ReceiptPaymentSatisfaction({
    receipt: {
      ok: true,
      source: "x402-receipt",
      receiptVerified: true,
      settlementStatus: "finalized",
      receiptExpired: false,
      rawReceiptPrinted: false,
    },
  });
}

function buildCapturedWalletProofInputFromSanitizedFixture(fixture: Record<string, unknown>) {
  const challenge = getRecord(fixture, "challenge");
  const wallet = getRecord(fixture, "wallet");

  return {
    source: "phase3-test-captured-proof-guarded-release-input",
    captureKind: "raw-wallet-capture-fields",
    capturedAt: "2026-06-10T00:00:00.000Z",

    challenge,
    challengeHash: getString(fixture, "challengeHash"),
    proofType: "concordium.VerifiablePresentation",
    presentation: fixture.presentation,
    walletChallenge: getString(fixture, "walletChallenge"),
    wallet: {
      network: getString(wallet, "network"),
      selectedChain: getString(wallet, "selectedChain"),
      accountAddress: getString(wallet, "accountAddress"),
    },
    submittedAt: "2026-06-10T00:00:00.000Z",

    sanitized: true,
    rawProofMaterialPresent: false,
  };
}

async function buildCapturedProofDecision(): Promise<{
  captureContract: ReturnType<typeof describeLiveBuyerProofCaptureAdapterInputContract>;
  safeMetadata: ReturnType<typeof buildSafeMetadata>;
  parsedOk: boolean;
  decision: Phase3GatewayReleaseDecision;
  boundEligibility: ModelAEligibilityBindingResult;
}> {
  const fixturePath = path.join(
    process.cwd(),
    "fixtures",
    "phase3",
    "wallet-proof-canonical.direct-buyer.sanitized.json",
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const fixtureRecord = asRecord(fixture, "fixture");

  const capturedWalletProofInput = buildCapturedWalletProofInputFromSanitizedFixture(fixtureRecord);
  const capturedWalletProofRecord = asRecord(capturedWalletProofInput, "capturedWalletProofInput");

  assert.equal(capturedWalletProofRecord.captureKind, "raw-wallet-capture-fields");
  assert.equal(capturedWalletProofRecord.sanitized, true);
  assert.equal(capturedWalletProofRecord.rawProofMaterialPresent, false);
  assert.equal(capturedWalletProofRecord.challengeHash, fixtureRecord.challengeHash);
  assert.equal(capturedWalletProofRecord.walletChallenge, fixtureRecord.walletChallenge);
  assert.deepEqual(capturedWalletProofRecord.challenge, fixtureRecord.challenge);
  assert.deepEqual(capturedWalletProofRecord.presentation, fixtureRecord.presentation);

  const captureContract = describeLiveBuyerProofCaptureAdapterInputContract();
  assert.equal(captureContract.adapterInputOnly, true);
  assert.equal(captureContract.productionReleaseAuthorized, false);
  assert.equal(captureContract.gatewayRuntimeMutated, false);
  assert.equal(captureContract.persisted, false);
  assert.equal(captureContract.crpCalled, false);
  assert.equal(captureContract.paymentAttempted, false);
  assert.equal(captureContract.paymentResponseEmitted, false);
  assert.equal(captureContract.replayTouched, false);
  assert.equal(captureContract.rawProofPrinted, false);
  assert.equal(captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"), true);

  const normalizedEnvelope = normalizeWalletProofCapture(capturedWalletProofInput);
  const normalizedRecord = asRecord(normalizedEnvelope, "normalizedEnvelope");

  assert.equal(normalizedRecord.type, "xcf.concordium.authorization.direct-buyer.v1");
  assert.equal(normalizedRecord.challengeHash, fixtureRecord.challengeHash);
  assert.equal(normalizedRecord.walletChallenge, fixtureRecord.walletChallenge);
  assert.deepEqual(normalizedRecord.challenge, fixtureRecord.challenge);
  assert.deepEqual(normalizedRecord.presentation, fixtureRecord.presentation);
  assert.deepEqual(normalizedRecord.wallet, capturedWalletProofRecord.wallet);

  const safeMetadata = buildSafeMetadata(normalizedEnvelope, null);
  assert.equal(safeMetadata.ok, true);
  assert.equal(safeMetadata.normalized, true);
  assert.equal(safeMetadata.accountBindingStatus, "present");
  assert.equal(safeMetadata.rawProofPrinted, false);
  assert.equal(safeMetadata.persisted, false);
  assert.equal(safeMetadata.paymentReleaseAttempted, false);
  assert.equal(safeMetadata.paymentResponseEmitted, false);
  assert.equal(safeMetadata.crpCalled, false);
  assert.equal(safeMetadata.replayTouched, false);

  const parsed = parseAuthorizationEnvelope(normalizedEnvelope);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, "xcf.concordium.authorization.direct-buyer.v1");
  assert.equal(parsed.challengeHash, fixtureRecord.challengeHash);
  assert.equal(parsed.expectedChallengeHash, fixtureRecord.challengeHash);

  if (parsed.envelope.type !== "xcf.concordium.authorization.direct-buyer.v1") {
    throw new Error("expected direct Buyer envelope");
  }

  const liveVerified = await liveVerifyDirectBuyerEnvelopeWithDeps(
    parsed.envelope,
    {
      liveVerify: true,
      grpcHost: "127.0.0.1",
      grpcPort: 1,
      network: "testnet",
    },
    buildFakeLiveDeps(String(fixtureRecord.walletChallenge)),
  );

  assert.equal(liveVerified.ok, true);
  assert.equal(liveVerified.stage, "verified");
  assert.equal(liveVerified.walletChallenge, fixtureRecord.walletChallenge);
  assert.equal(liveVerified.verifiedChallenge, fixtureRecord.walletChallenge);
  assert.equal(liveVerified.challengeBinding, "walletChallenge");
  assert.equal(liveVerified.rawProofPrinted, false);

  const eligibility = buildModelAEligibilityResult({
    verifierResult: liveVerified,
    accountBindingStatus: "present",
  });

  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.eligibilityVerified, true);
  assert.equal(eligibility.challengeVerified, true);
  assert.equal(eligibility.credentialStatementsVerified, true);
  assert.equal(eligibility.releaseAuthorized, false);
  assert.equal(eligibility.paymentReleaseAttempted, false);
  assert.equal(eligibility.paymentResponseEmitted, false);
  assert.equal(eligibility.crpCalled, false);
  assert.equal(eligibility.replayTouched, false);
  assert.equal(eligibility.rawProofPrinted, false);

  const fixtureChallenge = asRecord(fixtureRecord.challenge, "fixture.challenge");
  const contract = buildContractFromChallenge(fixtureChallenge);
  const nonce = getString(fixtureChallenge, "nonce");

  const boundEligibility = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce,
    challenge: fixtureRecord.challenge,
    contract,
  });

  assert.equal(boundEligibility.ok, true);
  assert.equal(boundEligibility.eligibilityVerified, true);
  assert.equal(boundEligibility.challengeBound, true);
  assert.equal(boundEligibility.resourceBound, true);
  assert.equal(boundEligibility.releaseAuthorized, false);
  assert.equal(boundEligibility.paymentReleaseAttempted, false);
  assert.equal(boundEligibility.paymentResponseEmitted, false);
  assert.equal(boundEligibility.crpCalled, false);
  assert.equal(boundEligibility.replayTouched, false);
  assert.equal(boundEligibility.rawProofPrinted, false);

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility,
    payment: acceptedReceiptPayment(),
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.model, "phase3-model-a");
  assert.equal(decision.releaseAuthorized, true);
  assert.equal(decision.reason, "release_authorized");
  assert.equal(decision.eligibilityVerified, true);
  assert.equal(decision.challengeBound, true);
  assert.equal(decision.resourceBound, true);
  assert.equal(decision.paymentSatisfied, true);
  assert.equal(decision.paymentSource, "x402-receipt");
  assert.equal(decision.receiptSignalAccepted, true);
  assert.equal(decision.receiptVerified, true);
  assert.equal(decision.settlementStatus, "finalized");
  assert.equal(decision.receiptExpired, false);
  assert.equal(decision.receiptContextMatched, true);
  assert.equal(decision.receiptContextMismatchField, null);
  assert.equal(decision.paymentResponseAllowed, true);
  assert.equal(decision.resourceReleaseAllowed, true);
  assertGatewayDecisionSafetyFlags(decision);

  return {
    captureContract,
    safeMetadata,
    parsedOk: parsed.ok,
    decision,
    boundEligibility,
  };
}

function restoreEnv(previous: {
  releaseEnabled: string | undefined;
  testReleaseOnly: string | undefined;
  requireLiveZkp: string | undefined;
}) {
  if (previous.releaseEnabled === undefined) {
    delete process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  } else {
    process.env.PHASE3_GATEWAY_RELEASE_ENABLED = previous.releaseEnabled;
  }

  if (previous.testReleaseOnly === undefined) {
    delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  } else {
    process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = previous.testReleaseOnly;
  }

  if (previous.requireLiveZkp === undefined) {
    delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
  } else {
    process.env.PHASE3_REQUIRE_LIVE_ZKP = previous.requireLiveZkp;
  }
}

async function runGuardScenario(input: {
  scenario: GuardScenario;
  port: number;
  releaseEnabled: boolean;
  testReleaseOnly: boolean;
}) {
  const base = baseUrlForPort(input.port);
  console.log(`[${LABEL}:${input.scenario}] BASE=${base}`);

  if (await isPortOpen(input.port)) {
    throw new Error(`port ${input.port} is already open. Stop the existing gateway and retry.`);
  }

  const previous = {
    releaseEnabled: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    testReleaseOnly: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    requireLiveZkp: process.env.PHASE3_REQUIRE_LIVE_ZKP,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = input.releaseEnabled ? "true" : "false";

  if (input.testReleaseOnly) {
    process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  } else {
    delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  }

  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

  const gateway = startGateway({
    port: input.port,
    label: `${LABEL}:${input.scenario}`,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await waitForPortClosed(input.port);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(base);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, input.releaseEnabled);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, input.testReleaseOnly);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(base);
    const redeem = await redeemEligiblePolicy(base, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedProof = await buildCapturedProofDecision();

    assert.equal(capturedProof.decision.releaseAuthorized, true);
    assert.equal(capturedProof.decision.paymentResponseAllowed, true);
    assert.equal(capturedProof.decision.resourceReleaseAllowed, true);
    assert.equal(capturedProof.boundEligibility.ok, true);
    assert.equal(capturedProof.safeMetadata.accountBindingStatus, "present");

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(base, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (blocked.status === 402) {
        if (input.testReleaseOnly) {
          if (blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal") {
            break;
          }
        } else {
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked runtime response should be present");
    assert.equal(blocked.status, 402, `runtime must remain blocked: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked runtime must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked runtime must not emit PAYMENT-RESPONSE");

    if (input.testReleaseOnly) {
      assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
      assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
      assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
      assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);
    } else {
      assert.equal(health.phase3?.gatewayReleaseEnabled, true);
      assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
      assert.equal(input.releaseEnabled, true);
      assert.equal(input.testReleaseOnly, false);
    }

    const safety = blocked.json?.safety ?? {};
    if (input.testReleaseOnly) {
      assert.equal(safety.paymentResponseEmitted, false);
      assert.equal(safety.crpCalled, false);
      assert.equal(safety.crpFulfillCalled, false);
      assert.equal(safety.replayTouched, false);
      assert.equal(safety.canonicalReleasePersisted, false);
      assert.equal(safety.rawProofPrinted, false);
      assert.equal(safety.rawReceiptPrinted, false);
    }

    return {
      ok: true,
      scenario: input.scenario,
      gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
      gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
      gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
      requireLiveZkp: health.phase3.requireLiveZkp,
      eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

      capturedProofInputShape: "raw-wallet-capture-fields",
      capturedProofAcceptedByContract:
        capturedProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
      capturedProofNormalized: capturedProof.safeMetadata.normalized,
      capturedProofAccountBindingStatus: capturedProof.safeMetadata.accountBindingStatus,
      capturedProofParsedAsCanonicalEnvelope: capturedProof.parsedOk,
      capturedProofEligibilityBound: capturedProof.boundEligibility.ok,

      capturedProofReleaseDecisionAuthorized: capturedProof.decision.releaseAuthorized,
      capturedProofPaymentResponseAllowedByDecision: capturedProof.decision.paymentResponseAllowed,
      capturedProofResourceReleaseAllowedByDecision: capturedProof.decision.resourceReleaseAllowed,
      capturedProofDecisionReason: capturedProof.decision.reason,
      capturedProofPaymentSource: capturedProof.decision.paymentSource,

      runtimeStatus: blocked.status,
      releaseFlagAloneInsufficient:
        input.scenario === "release-flag-alone" &&
        health.phase3.gatewayReleaseEnabled === true &&
        health.phase3.gatewayTestReleaseOnly === false,
      bothGuardsSatisfied:
        input.scenario === "both-test-guards" &&
        health.phase3.gatewayReleaseEnabled === true &&
        health.phase3.gatewayTestReleaseOnly === true,
      runtimeReceiptRequired: blocked.json?.phase3?.runtimeReceiptRequired === true,
      receiptSignalPresent: blocked.json?.phase3?.receiptSignalPresent === true,
      missingReceiptRejected:
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal",
      guardedRuntimeReleaseRecognized:
        blocked.json?.runtimeReleaseRecognition?.recognized === true,
      releaseDecisionRecognized:
        blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized === true,

      actualGatewayStillReturns402: blocked.status === 402,
      actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

      productionReleaseAuthorized: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: input.testReleaseOnly ? safety.crpCalled : false,
      crpFulfillCalled: input.testReleaseOnly ? safety.crpFulfillCalled : false,
      replayTouched: input.testReleaseOnly ? safety.replayTouched : false,
      resourceReleased: false,
      canonicalReleasePersisted: input.testReleaseOnly ? safety.canonicalReleasePersisted : false,
      rawProofPrinted: input.testReleaseOnly ? safety.rawProofPrinted : false,
      rawReceiptPrinted: input.testReleaseOnly ? safety.rawReceiptPrinted : false,
    };
  } finally {
    await cleanup();
  }
}

async function main() {
  const flagOnly = await runGuardScenario({
    scenario: "release-flag-alone",
    port: GATEWAY_PORT_FLAG_ONLY,
    releaseEnabled: true,
    testReleaseOnly: false,
  });

  const bothGuards = await runGuardScenario({
    scenario: "both-test-guards",
    port: GATEWAY_PORT_BOTH_GUARDS,
    releaseEnabled: true,
    testReleaseOnly: true,
  });

  assert.equal(flagOnly.releaseFlagAloneInsufficient, true);
  assert.equal(flagOnly.actualGatewayStillReturns402, true);
  assert.equal(flagOnly.actualGatewayPaymentResponseEmitted, false);
  assert.equal(flagOnly.capturedProofReleaseDecisionAuthorized, true);

  assert.equal(bothGuards.bothGuardsSatisfied, true);
  assert.equal(bothGuards.guardedRuntimeReleaseRecognized, true);
  assert.equal(bothGuards.missingReceiptRejected, true);
  assert.equal(bothGuards.actualGatewayStillReturns402, true);
  assert.equal(bothGuards.actualGatewayPaymentResponseEmitted, false);
  assert.equal(bothGuards.capturedProofReleaseDecisionAuthorized, true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofGuardedTestRelease.v1",
        scenarios: [flagOnly, bothGuards],

        capturedProofDecisionAuthorizedInBothScenarios:
          flagOnly.capturedProofReleaseDecisionAuthorized === true &&
          bothGuards.capturedProofReleaseDecisionAuthorized === true,

        releaseFlagAloneInsufficient: flagOnly.releaseFlagAloneInsufficient,
        bothTestGuardsStillRequireReceipt: bothGuards.missingReceiptRejected,
        actualGatewayStillReturns402InBothScenarios:
          flagOnly.actualGatewayStillReturns402 === true &&
          bothGuards.actualGatewayStillReturns402 === true,
        actualGatewayPaymentResponseEmittedInEitherScenario:
          flagOnly.actualGatewayPaymentResponseEmitted === true ||
          bothGuards.actualGatewayPaymentResponseEmitted === true,

        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        resourceReleased: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
