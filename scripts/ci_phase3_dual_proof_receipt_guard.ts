#!/usr/bin/env node
/**
 * scripts/ci_phase3_dual_proof_receipt_guard.ts
 *
 * PR #159 regression harness.
 *
 * Proves the Phase 3 guarded release decision must require both:
 *
 *   1. a valid captured Buyer proof / Model A eligibility binding
 *   2. a verified finalized x402 receipt payment signal
 *
 * This is intentionally decision-space-only plus a fail-closed runtime sanity
 * check. It does not submit a real receipt JWS, does not emit PAYMENT-RESPONSE,
 * does not touch replay, does not call CRP fulfill, and does not release
 * protected content.
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
  type X402ReceiptPaymentSignal,
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

const GATEWAY_PORT = Number(process.env.PHASE3_DUAL_PROOF_RECEIPT_GUARD_PORT || 3079);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:dual-proof-receipt-guard-test";

type CapturedProofState = {
  captureContract: ReturnType<typeof describeLiveBuyerProofCaptureAdapterInputContract>;
  safeMetadata: ReturnType<typeof buildSafeMetadata>;
  parsedOk: boolean;
  boundEligibility: ModelAEligibilityBindingResult;
  fixtureChallenge: Record<string, unknown>;
  contract: Phase3DemoContractBindingSnapshot;
  nonce: string;
};

type DualGuardMatrixRow = {
  label: string;
  capturedProofAccepted: boolean;
  receiptAccepted: boolean;
  dualGuardEligible: boolean;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
};

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

function buildCapturedWalletProofInputFromSanitizedFixture(fixture: Record<string, unknown>) {
  const challenge = getRecord(fixture, "challenge");
  const wallet = getRecord(fixture, "wallet");

  return {
    source: "phase3-test-dual-proof-receipt-guard-input",
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

function assertDecisionSafety(decision: Phase3GatewayReleaseDecision): void {
  assert.equal(decision.paymentReleaseAttempted, false);
  assert.equal(decision.paymentResponseEmitted, false);
  assert.equal(decision.crpCalled, false);
  assert.equal(decision.replayTouched, false);
  assert.equal(decision.rawProofPrinted, false);
  assert.equal(decision.rawReceiptPrinted, false);
}

function receiptSignal(input: {
  ok?: boolean;
  receiptVerified?: boolean;
  settlementStatus?: X402ReceiptPaymentSignal["settlementStatus"];
  receiptExpired?: boolean;
} = {}): X402ReceiptPaymentSignal {
  return {
    ok: input.ok ?? true,
    source: "x402-receipt",
    receiptVerified: input.receiptVerified ?? true,
    settlementStatus: input.settlementStatus ?? "finalized",
    receiptExpired: input.receiptExpired ?? false,
    rawReceiptPrinted: false,
  };
}

function decisionFor(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
}): Phase3GatewayReleaseDecision {
  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt: input.receipt,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertDecisionSafety(decision);
  return decision;
}

async function buildCapturedProofState(): Promise<CapturedProofState> {
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

  return {
    captureContract,
    safeMetadata,
    parsedOk: parsed.ok,
    boundEligibility,
    fixtureChallenge,
    contract,
    nonce,
  };
}

function cloneChallenge(challenge: Record<string, unknown>): any {
  return JSON.parse(JSON.stringify(challenge));
}

function buildUnboundEligibility(state: CapturedProofState): ModelAEligibilityBindingResult {
  const badChallenge = cloneChallenge(state.fixtureChallenge);
  badChallenge.nonce = "phase3-dual-proof-wrong-nonce";

  const rebound = bindModelAEligibilityToChallengeContext({
    eligibility: {
      ok: true,
      model: "phase3-model-a",
      proofVerified: true,
      eligibilityVerified: true,
      challengeVerified: true,
      credentialStatementsVerified: true,
      accountBindingStatus: "present",
      verifierStage: "verified",
      releaseAuthorized: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      crpCalled: false,
      replayTouched: false,
      rawProofPrinted: false,
    },
    nonce: state.nonce,
    challenge: badChallenge,
    contract: state.contract,
  });

  assert.equal(rebound.ok, false);
  assert.equal(rebound.bindingCode, "policy_binding_mismatch");
  assert.equal(rebound.eligibilityVerified, true);
  assert.equal(rebound.challengeBound, false);
  assert.equal(rebound.resourceBound, false);
  assert.equal(rebound.releaseAuthorized, false);
  assert.equal(rebound.paymentReleaseAttempted, false);
  assert.equal(rebound.paymentResponseEmitted, false);
  assert.equal(rebound.crpCalled, false);
  assert.equal(rebound.replayTouched, false);
  assert.equal(rebound.rawProofPrinted, false);

  return rebound;
}

function matrixRow(input: {
  label: string;
  boundEligibility: ModelAEligibilityBindingResult;
  receipt: X402ReceiptPaymentSignal;
  expectedReason: string;
  expectedEligible: boolean;
}): DualGuardMatrixRow {
  const decision = decisionFor({
    boundEligibility: input.boundEligibility,
    receipt: input.receipt,
  });

  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.releaseAuthorized, input.expectedEligible, input.label);
  assert.equal(decision.paymentResponseAllowed, input.expectedEligible, input.label);
  assert.equal(decision.resourceReleaseAllowed, input.expectedEligible, input.label);

  const capturedProofAccepted =
    input.boundEligibility.ok === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true;

  const receiptAccepted =
    decision.paymentSatisfied === true &&
    decision.receiptSignalAccepted === true &&
    decision.receiptVerified === true &&
    decision.settlementStatus === "finalized" &&
    decision.receiptExpired === false;

  const dualGuardEligible =
    capturedProofAccepted === true &&
    receiptAccepted === true &&
    decision.releaseAuthorized === true &&
    decision.paymentResponseAllowed === true &&
    decision.resourceReleaseAllowed === true;

  assert.equal(dualGuardEligible, input.expectedEligible, input.label);

  return {
    label: input.label,
    capturedProofAccepted,
    receiptAccepted,
    dualGuardEligible,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
  };
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const previousReleaseEnabled = process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
  const previousTestReleaseOnly = process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
  const previousRequireLiveZkp = process.env.PHASE3_REQUIRE_LIVE_ZKP;

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "true";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "true";
  process.env.PHASE3_REQUIRE_LIVE_ZKP = "false";

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    if (previousReleaseEnabled === undefined) {
      delete process.env.PHASE3_GATEWAY_RELEASE_ENABLED;
    } else {
      process.env.PHASE3_GATEWAY_RELEASE_ENABLED = previousReleaseEnabled;
    }

    if (previousTestReleaseOnly === undefined) {
      delete process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY;
    } else {
      process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = previousTestReleaseOnly;
    }

    if (previousRequireLiveZkp === undefined) {
      delete process.env.PHASE3_REQUIRE_LIVE_ZKP;
    } else {
      process.env.PHASE3_REQUIRE_LIVE_ZKP = previousRequireLiveZkp;
    }

    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, true);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, true);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);

    const redeem = await redeemEligiblePolicy(BASE, pr);
    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedProof = await buildCapturedProofState();
    const unboundEligibility = buildUnboundEligibility(capturedProof);

    const rows = [
      matrixRow({
        label: "valid captured proof + verified finalized receipt",
        boundEligibility: capturedProof.boundEligibility,
        receipt: receiptSignal(),
        expectedReason: "release_authorized",
        expectedEligible: true,
      }),
      matrixRow({
        label: "valid captured proof + missing receipt",
        boundEligibility: capturedProof.boundEligibility,
        receipt: receiptSignal({
          ok: false,
          receiptVerified: false,
        }),
        expectedReason: "receipt_not_verified",
        expectedEligible: false,
      }),
      matrixRow({
        label: "valid captured proof + pending receipt",
        boundEligibility: capturedProof.boundEligibility,
        receipt: receiptSignal({
          settlementStatus: "pending",
        }),
        expectedReason: "settlement_not_finalized",
        expectedEligible: false,
      }),
      matrixRow({
        label: "valid captured proof + expired receipt",
        boundEligibility: capturedProof.boundEligibility,
        receipt: receiptSignal({
          receiptExpired: true,
        }),
        expectedReason: "receipt_expired",
        expectedEligible: false,
      }),
      matrixRow({
        label: "invalid captured proof binding + verified finalized receipt",
        boundEligibility: unboundEligibility,
        receipt: receiptSignal(),
        expectedReason: "eligibility_not_bound",
        expectedEligible: false,
      }),
    ];

    let blocked = null as Awaited<ReturnType<typeof request>> | null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);

      if (
        blocked.status === 402 &&
        blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(blocked, "blocked runtime response should be present");
    assert.equal(blocked.status, 402, `guarded runtime must remain blocked without receipt: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "blocked runtime must emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "blocked runtime must not emit PAYMENT-RESPONSE");

    assert.equal(blocked.json?.runtimeReleaseRecognition?.recognized, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.releaseDecisionRecognized, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.guardSatisfied, true);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.blockedBy, "missing_x402_receipt_signal");
    assert.equal(blocked.json?.phase3?.runtimeReceiptRequired, true);
    assert.equal(blocked.json?.phase3?.receiptSignalPresent, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.productionRelease, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.paymentResponseAllowed, false);
    assert.equal(blocked.json?.runtimeReleaseRecognition?.resourceReleaseAllowed, false);

    const safety = blocked.json?.safety ?? {};
    assert.equal(safety.paymentResponseEmitted, false);
    assert.equal(safety.crpCalled, false);
    assert.equal(safety.crpFulfillCalled, false);
    assert.equal(safety.replayTouched, false);
    assert.equal(safety.canonicalReleasePersisted, false);
    assert.equal(safety.rawProofPrinted, false);
    assert.equal(safety.rawReceiptPrinted, false);

    const eligibleRows = rows.filter((row) => row.dualGuardEligible === true);
    const ineligibleRows = rows.filter((row) => row.dualGuardEligible === false);

    assert.equal(eligibleRows.length, 1);
    assert.equal(eligibleRows[0].label, "valid captured proof + verified finalized receipt");
    assert.equal(ineligibleRows.length, 4);

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.dualProofReceiptGuard.v1",
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

          rows,
          dualGuardEligibleRows: eligibleRows.length,
          dualGuardIneligibleRows: ineligibleRows.length,
          dualGuardRequiresCapturedProof:
            rows.find((row) => row.label === "invalid captured proof binding + verified finalized receipt")
              ?.dualGuardEligible === false,
          dualGuardRequiresVerifiedReceipt:
            rows.find((row) => row.label === "valid captured proof + missing receipt")
              ?.dualGuardEligible === false,
          dualGuardRequiresFinalizedReceipt:
            rows.find((row) => row.label === "valid captured proof + pending receipt")
              ?.dualGuardEligible === false,
          dualGuardRejectsExpiredReceipt:
            rows.find((row) => row.label === "valid captured proof + expired receipt")
              ?.dualGuardEligible === false,

          runtimeSanityMissingReceiptBlocked:
            blocked.json?.runtimeReleaseRecognition?.blockedBy === "missing_x402_receipt_signal",
          actualGatewayStillReturns402: blocked.status === 402,
          actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,

          productionReleaseAuthorized: false,
          paymentReleaseAttempted: false,
          paymentResponseEmitted: false,
          crpCalled: safety.crpCalled,
          crpFulfillCalled: safety.crpFulfillCalled,
          replayTouched: safety.replayTouched,
          resourceReleased: false,
          canonicalReleasePersisted: safety.canonicalReleasePersisted,
          rawProofPrinted: safety.rawProofPrinted,
          rawReceiptPrinted: safety.rawReceiptPrinted,
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
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
