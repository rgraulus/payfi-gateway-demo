#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_synthetic_receipt_boundary.ts
 *
 * PR #160 regression harness.
 *
 * Composes the captured Buyer proof guard with the verified synthetic receipt
 * proof boundary in decision space.
 *
 * This is intentionally test-only. It does not submit a receipt JWS to the
 * Gateway, does not emit PAYMENT-RESPONSE, does not touch replay, does not
 * call CRP fulfill, and does not release protected content.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { CcdPltProofV1 } from "../src/proofPayload";
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
  buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1,
  deriveX402ReceiptBindingContextFromCcdPltProofV1,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  buildSafeMetadata,
  describeLiveBuyerProofCaptureAdapterInputContract,
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const LABEL = "phase3:captured-proof-synthetic-receipt-boundary-test";
const NOW_SEC = 1_800_000_000;

type CapturedProofState = {
  captureContract: ReturnType<typeof describeLiveBuyerProofCaptureAdapterInputContract>;
  safeMetadata: ReturnType<typeof buildSafeMetadata>;
  parsedOk: boolean;
  boundEligibility: ModelAEligibilityBindingResult;
  unboundEligibility: ModelAEligibilityBindingResult;
  fixtureChallenge: Record<string, unknown>;
  contract: Phase3DemoContractBindingSnapshot;
  nonce: string;
};

type BoundaryRow = {
  label: string;
  capturedProofAccepted: boolean;
  syntheticReceiptAccepted: boolean;
  receiptContextMatched: boolean;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  productionRelease: false;
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
    source: "phase3-test-captured-proof-synthetic-receipt-boundary-input",
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

function buildSyntheticReceiptProofFromCapturedState(input: {
  state: CapturedProofState;
  expiresAt?: number;
}): CcdPltProofV1 {
  const contract = input.state.contract;
  const expiresAt = input.expiresAt ?? NOW_SEC + 300;

  return {
    proofVersion: "ccd-plt-proof@v1",
    contract: {
      contractId: contract.contractId,
      contractVersion: contract.contractVersion,
      isFrozen: contract.isFrozen,
      merchantId: contract.merchantId,
      resource: {
        method: contract.resource.method.toUpperCase(),
        path: contract.resource.path,
      },
      network: contract.network,
      asset: {
        type: "PLT",
        tokenId: contract.asset.tokenId,
        decimals: contract.asset.decimals,
      },
      amount: contract.amount,
      payTo: contract.payTo,
    },
    nonce: input.state.nonce,
    settlement: {
      status: "finalized",
      settledAt: NOW_SEC - 60,
      expiresAt,
    },
    chain: {
      transactionHash: "phase3syntheticreceiptboundarytxhash",
      blockHash: "phase3syntheticreceiptboundaryblockhash",
      blockHeight: 160,
    },
    paymentEvent: {
      kind: "plt.transfer",
      tokenId: contract.asset.tokenId,
      amountRaw: "50101",
      from: "ccd1qphase3syntheticbuyerplaceholder",
      to: contract.payTo,
    },
  };
}

function decisionFromSyntheticReceipt(input: {
  state: CapturedProofState;
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContextOverride?: ReturnType<typeof deriveX402ReceiptBindingContextFromCcdPltProofV1>;
}): Phase3GatewayReleaseDecision {
  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: NOW_SEC,
  });

  const expectedContext =
    input.expectedContextOverride ??
    deriveX402ReceiptBindingContextFromCcdPltProofV1(input.proof);

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt,
    expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertDecisionSafety(decision);
  return decision;
}

function boundaryRow(input: {
  label: string;
  state: CapturedProofState;
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContextOverride?: ReturnType<typeof deriveX402ReceiptBindingContextFromCcdPltProofV1>;
  expectedReason: string;
  expectedReleaseAuthorized: boolean;
}): BoundaryRow {
  const decision = decisionFromSyntheticReceipt({
    state: input.state,
    boundEligibility: input.boundEligibility,
    proof: input.proof,
    expectedContextOverride: input.expectedContextOverride,
  });

  assert.equal(decision.reason, input.expectedReason, input.label);
  assert.equal(decision.releaseAuthorized, input.expectedReleaseAuthorized, input.label);
  assert.equal(decision.paymentResponseAllowed, input.expectedReleaseAuthorized, input.label);
  assert.equal(decision.resourceReleaseAllowed, input.expectedReleaseAuthorized, input.label);
  // buildPhase3GatewayReleaseDecision is decision-layer only and does not
  // expose runtime productionRelease. Runtime/production release remains out of
  // scope for this harness and is represented explicitly in BoundaryRow output.
  assertDecisionSafety(decision);

  const capturedProofAccepted =
    input.boundEligibility.ok === true &&
    input.boundEligibility.eligibilityVerified === true &&
    input.boundEligibility.challengeBound === true &&
    input.boundEligibility.resourceBound === true;

  const syntheticReceiptAccepted =
    decision.paymentSatisfied === true &&
    decision.receiptSignalAccepted === true &&
    decision.receiptVerified === true &&
    decision.settlementStatus === "finalized" &&
    decision.receiptExpired === false;

  return {
    label: input.label,
    capturedProofAccepted,
    syntheticReceiptAccepted,
    receiptContextMatched: decision.receiptContextMatched,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    productionRelease: false,
  };
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

  const badChallenge = JSON.parse(JSON.stringify(fixtureChallenge));
  badChallenge.nonce = "phase3-pr160-wrong-captured-proof-nonce";

  const unboundEligibility = bindModelAEligibilityToChallengeContext({
    eligibility,
    nonce,
    challenge: badChallenge,
    contract,
  });

  assert.equal(unboundEligibility.ok, false);
  assert.equal(unboundEligibility.bindingCode, "policy_binding_mismatch");
  assert.equal(unboundEligibility.eligibilityVerified, true);
  assert.equal(unboundEligibility.challengeBound, false);
  assert.equal(unboundEligibility.resourceBound, false);
  assert.equal(unboundEligibility.releaseAuthorized, false);
  assert.equal(unboundEligibility.paymentReleaseAttempted, false);
  assert.equal(unboundEligibility.paymentResponseEmitted, false);
  assert.equal(unboundEligibility.crpCalled, false);
  assert.equal(unboundEligibility.replayTouched, false);
  assert.equal(unboundEligibility.rawProofPrinted, false);

  return {
    captureContract,
    safeMetadata,
    parsedOk: parsed.ok,
    boundEligibility,
    unboundEligibility,
    fixtureChallenge,
    contract,
    nonce,
  };
}

async function main() {
  console.log(`[${LABEL}] decision-space only; no Gateway receipt submission`);

  const state = await buildCapturedProofState();

  const validProof = buildSyntheticReceiptProofFromCapturedState({
    state,
  });

  const wrongExpectedContext = {
    ...deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof),
    nonce: "phase3-pr160-wrong-expected-receipt-nonce",
  };

  const expiredProof = buildSyntheticReceiptProofFromCapturedState({
    state,
    expiresAt: NOW_SEC,
  });

  const rows = [
    boundaryRow({
      label: "valid captured proof + verified synthetic finalized receipt",
      state,
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedReason: "release_authorized",
      expectedReleaseAuthorized: true,
    }),
    boundaryRow({
      label: "valid captured proof + verified synthetic receipt wrong expected context",
      state,
      boundEligibility: state.boundEligibility,
      proof: validProof,
      expectedContextOverride: wrongExpectedContext,
      expectedReason: "receipt_context_mismatch",
      expectedReleaseAuthorized: false,
    }),
    boundaryRow({
      label: "invalid captured proof binding + verified synthetic finalized receipt",
      state,
      boundEligibility: state.unboundEligibility,
      proof: validProof,
      expectedReason: "eligibility_not_bound",
      expectedReleaseAuthorized: false,
    }),
    boundaryRow({
      label: "valid captured proof + verified synthetic expired receipt",
      state,
      boundEligibility: state.boundEligibility,
      proof: expiredProof,
      expectedReason: "receipt_expired",
      expectedReleaseAuthorized: false,
    }),
  ];

  const authorizedRows = rows.filter((row) => row.releaseAuthorized === true);
  const deniedRows = rows.filter((row) => row.releaseAuthorized === false);

  assert.equal(authorizedRows.length, 1);
  assert.equal(authorizedRows[0].label, "valid captured proof + verified synthetic finalized receipt");
  assert.equal(deniedRows.length, 3);

  assert.equal(rows.every((row) => row.productionRelease === false), true);
  assert.equal(
    rows.every((row) => row.releaseAuthorized === row.paymentResponseAllowed),
    true,
  );
  assert.equal(
    rows.every((row) => row.releaseAuthorized === row.resourceReleaseAllowed),
    true,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofSyntheticReceiptBoundary.v1",
        decisionSpaceOnly: true,
        gatewayReceiptSubmitted: false,
        paymentResponseEmitted: false,
        replayTouched: false,
        crpCalled: false,
        crpFulfillCalled: false,
        resourceReleased: false,

        capturedProofInputShape: "raw-wallet-capture-fields",
        capturedProofAcceptedByContract:
          state.captureContract.acceptedInputShapes.includes("raw-wallet-capture-fields"),
        capturedProofNormalized: state.safeMetadata.normalized,
        capturedProofAccountBindingStatus: state.safeMetadata.accountBindingStatus,
        capturedProofParsedAsCanonicalEnvelope: state.parsedOk,
        capturedProofEligibilityBound: state.boundEligibility.ok,

        syntheticReceiptBoundaryUsed: true,
        syntheticReceiptProofVersion: validProof.proofVersion,
        syntheticReceiptDerivedContextMatches:
          deriveX402ReceiptBindingContextFromCcdPltProofV1(validProof).nonce === state.nonce,

        rows,
        authorizedRows: authorizedRows.length,
        deniedRows: deniedRows.length,

        validCapturedProofAndVerifiedSyntheticReceiptAuthorizesDecision:
          authorizedRows.length === 1,
        wrongReceiptExpectedContextRejected:
          rows.find((row) => row.decisionReason === "receipt_context_mismatch")
            ?.releaseAuthorized === false,
        invalidCapturedProofWithVerifiedSyntheticReceiptRejected:
          rows.find((row) => row.decisionReason === "eligibility_not_bound")
            ?.releaseAuthorized === false,
        expiredSyntheticReceiptRejected:
          rows.find((row) => row.decisionReason === "receipt_expired")
            ?.releaseAuthorized === false,

        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
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
