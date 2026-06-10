#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_wallet_proof_gateway_seam.ts
 *
 * PR #156 regression harness.
 *
 * Proves a captured wallet-proof input shape can be normalized and mapped into
 * the same fixture-backed Phase 3 Model A Gateway runtime seam validated by PR #155.
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
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";
import {
  buildSafeMetadata,
  describeLiveBuyerProofCaptureAdapterInputContract,
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const GATEWAY_PORT = Number(process.env.PHASE3_CAPTURED_WALLET_PROOF_GATEWAY_SEAM_PORT || 3075);
const BASE = baseUrlForPort(GATEWAY_PORT);
const LABEL = "phase3:captured-wallet-proof-gateway-seam-test";

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
    source: "phase3-test-captured-wallet-proof-input",
    captureKind: "raw-wallet-capture-fields",
    capturedAt: "2026-06-10T00:00:00.000Z",

    // Raw capture fields intentionally sit at the top level instead of inside
    // authorizationProof. This proves the capture-input seam, not the already
    // normalized fixture wrapper path from PR #155.
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

    // Explicitly test-only / sanitized marker.
    sanitized: true,
    rawProofMaterialPresent: false,
  };
}

async function buildCapturedWalletProofGatewayReleaseDecision(): Promise<{
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
  assert.equal(safeMetadata.envelopeType, "xcf.concordium.authorization.direct-buyer.v1");
  assert.equal(safeMetadata.proofType, "concordium.VerifiablePresentation");
  assert.equal(safeMetadata.challengeHashPresent, true);
  assert.equal(safeMetadata.walletChallengePresent, true);
  assert.equal(safeMetadata.walletPresent, true);
  assert.equal(safeMetadata.walletNetworkPresent, true);
  assert.equal(safeMetadata.walletSelectedChainPresent, true);
  assert.equal(safeMetadata.walletAccountAddressPresent, true);
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
  assert.deepEqual(liveVerified.verifiedRequestKeys, ["challenge", "credentialStatements"]);
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

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);

  if (String(process.env.PHASE3_GATEWAY_RELEASE_ENABLED ?? "").toLowerCase() === "true") {
    throw new Error("PHASE3_GATEWAY_RELEASE_ENABLED must not be true for this captured wallet proof seam harness.");
  }

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, false);

    const pr = await issuePaidGatedChallenge(BASE);
    const redeem = await redeemEligiblePolicy(BASE, pr);

    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const capturedWalletProof = await buildCapturedWalletProofGatewayReleaseDecision();

    assert.equal(capturedWalletProof.boundEligibility.ok, true);
    assert.equal(capturedWalletProof.decision.releaseAuthorized, true);
    assert.equal(capturedWalletProof.decision.paymentResponseAllowed, true);
    assert.equal(capturedWalletProof.decision.resourceReleaseAllowed, true);

    const postRedeemProtected = await fetch(`${BASE}/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);
    const postRedeemText = await postRedeemProtected.text();

    assert.equal(
      postRedeemProtected.status,
      402,
      `actual Gateway runtime must remain gated after captured-wallet-proof decision-only proof: ${postRedeemText}`,
    );
    assert.equal(
      postRedeemProtected.headers.get("payment-response"),
      null,
      "actual Gateway runtime must not emit PAYMENT-RESPONSE",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayRuntimeSeamReached: true,
          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",
          eligiblePolicyAllowed: redeem.json?.policyDecision?.allowed === true,

          captureContract: capturedWalletProof.captureContract.contract,
          capturedWalletProofInputShape: "raw-wallet-capture-fields",
          capturedWalletProofAcceptedByContract:
            capturedWalletProof.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
          capturedWalletProofNormalized: capturedWalletProof.safeMetadata.normalized,
          capturedWalletProofWalletPresent: capturedWalletProof.safeMetadata.walletPresent,
          capturedWalletProofAccountBindingStatus: capturedWalletProof.safeMetadata.accountBindingStatus,
          capturedWalletProofParsedAsCanonicalEnvelope: capturedWalletProof.parsedOk,
          capturedWalletProofEligibilityBound: capturedWalletProof.boundEligibility.ok,

          capturedWalletProofGatewayReleaseDecisionAuthorized: capturedWalletProof.decision.releaseAuthorized,
          capturedWalletProofGatewayPaymentResponseAllowed: capturedWalletProof.decision.paymentResponseAllowed,
          capturedWalletProofGatewayResourceReleaseAllowed: capturedWalletProof.decision.resourceReleaseAllowed,
          capturedWalletProofGatewayDecisionReason: capturedWalletProof.decision.reason,
          capturedWalletProofGatewayPaymentSource: capturedWalletProof.decision.paymentSource,

          releaseBlockedByDisabledGatewayRuntimeSeam: health.phase3.gatewayReleaseEnabled === false,
          actualGatewayStillReturns402: postRedeemProtected.status === 402,
          actualGatewayPaymentResponseEmitted: postRedeemProtected.headers.has("payment-response"),

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
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(`[${LABEL}] ERROR:`, err?.stack || err?.message || err);
  process.exit(1);
});
