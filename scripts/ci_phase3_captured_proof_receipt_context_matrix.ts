#!/usr/bin/env node
/**
 * scripts/ci_phase3_captured_proof_receipt_context_matrix.ts
 *
 * PR #161 regression harness.
 *
 * Proves a verified synthetic x402 receipt boundary cannot be reused across
 * the wrong captured Buyer proof / challenge / payment context.
 *
 * This is intentionally test-only and decision-space-only. It does not submit
 * a receipt JWS to the Gateway, does not emit PAYMENT-RESPONSE, does not touch
 * replay, does not call CRP fulfill, and does not release protected content.
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
  type X402ReceiptBindingContext,
  type X402ReceiptContextMismatchField,
} from "../src/phase3/x402ReceiptPaymentSignal";
import {
  buildSafeMetadata,
  describeLiveBuyerProofCaptureAdapterInputContract,
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const LABEL = "phase3:captured-proof-receipt-context-matrix-test";
const NOW_SEC = 1_800_000_000;

type CapturedProofState = {
  captureContract: ReturnType<typeof describeLiveBuyerProofCaptureAdapterInputContract>;
  safeMetadata: ReturnType<typeof buildSafeMetadata>;
  parsedOk: boolean;
  boundEligibility: ModelAEligibilityBindingResult;
  fixtureChallenge: Record<string, unknown>;
  contract: Phase3DemoContractBindingSnapshot;
  nonce: string;
};

type ContextMismatchRow = {
  label: string;
  expectedMismatchField: X402ReceiptContextMismatchField | null;
  actualMismatchField: X402ReceiptContextMismatchField | null;
  decisionOk: boolean;
  decisionReason: string;
  releaseAuthorized: boolean;
  paymentResponseAllowed: boolean;
  resourceReleaseAllowed: boolean;
  capturedProofAccepted: boolean;
  receiptVerified: boolean;
  receiptContextMatched: boolean;
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
    source: "phase3-test-captured-proof-receipt-context-matrix-input",
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

function buildSyntheticReceiptProofFromCapturedState(state: CapturedProofState): CcdPltProofV1 {
  const contract = state.contract;

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
    nonce: state.nonce,
    settlement: {
      status: "finalized",
      settledAt: NOW_SEC - 60,
      expiresAt: NOW_SEC + 300,
    },
    chain: {
      transactionHash: "phase3contextmatrixtxhash",
      blockHash: "phase3contextmatrixblockhash",
      blockHeight: 161,
    },
    paymentEvent: {
      kind: "plt.transfer",
      tokenId: contract.asset.tokenId,
      amountRaw: "50101",
      from: "ccd1qphase3contextmatrixbuyerplaceholder",
      to: contract.payTo,
    },
  };
}

function decisionFromExpectedContext(input: {
  boundEligibility: ModelAEligibilityBindingResult;
  proof: CcdPltProofV1;
  expectedContext: X402ReceiptBindingContext;
}): Phase3GatewayReleaseDecision {
  const receipt = buildX402ReceiptPaymentSignalFromVerifiedCcdPltProofV1({
    proof: input.proof,
    nowSec: NOW_SEC,
  });

  const payment = buildX402ReceiptPaymentSatisfaction({
    receipt,
    expectedContext: input.expectedContext,
  });

  const decision = buildPhase3GatewayReleaseDecision({
    boundEligibility: input.boundEligibility,
    payment,
  });

  assertDecisionSafety(decision);
  return decision;
}

function mutateContext(
  base: X402ReceiptBindingContext,
  field: X402ReceiptContextMismatchField,
): X402ReceiptBindingContext | undefined {
  if (field === "missing_receipt_context") {
    return undefined;
  }

  const out: X402ReceiptBindingContext = JSON.parse(JSON.stringify(base));

  switch (field) {
    case "nonce":
      out.nonce = "phase3-pr161-wrong-nonce";
      break;
    case "resource.method":
      out.resource.method = "POST";
      break;
    case "resource.path":
      out.resource.path = "/paid-gated-other";
      break;
    case "contract.contractId":
      out.contract.contractId = "cid_phase3_pr161_wrong_contract";
      break;
    case "contract.contractVersion":
      out.contract.contractVersion = "9.9.9";
      break;
    case "contract.merchantId":
      out.contract.merchantId = "wrong-merchant";
      break;
    case "network":
      out.network = "concordium:mainnet";
      break;
    case "asset.type":
      out.asset.type = "CCD";
      break;
    case "asset.tokenId":
      out.asset.tokenId = "OtherDemo";
      break;
    case "asset.decimals":
      out.asset.decimals = 8;
      break;
    case "amount":
      out.amount = "0.999999";
      break;
    case "payTo":
      out.payTo = "ccd1qphase3wrongmerchant";
      break;
    default:
      throw new Error(`unhandled context mismatch field: ${field}`);
  }

  return out;
}

function rowFor(input: {
  label: string;
  state: CapturedProofState;
  proof: CcdPltProofV1;
  expectedContext: X402ReceiptBindingContext;
  expectedMismatchField: X402ReceiptContextMismatchField | null;
  expectedReleaseAuthorized: boolean;
}): ContextMismatchRow {
  const decision = decisionFromExpectedContext({
    boundEligibility: input.state.boundEligibility,
    proof: input.proof,
    expectedContext: input.expectedContext,
  });

  assert.equal(
    decision.releaseAuthorized,
    input.expectedReleaseAuthorized,
    input.label,
  );
  assert.equal(
    decision.paymentResponseAllowed,
    input.expectedReleaseAuthorized,
    input.label,
  );
  assert.equal(
    decision.resourceReleaseAllowed,
    input.expectedReleaseAuthorized,
    input.label,
  );

  if (input.expectedMismatchField === null) {
    assert.equal(decision.reason, "release_authorized", input.label);
    assert.equal(decision.receiptContextMatched, true, input.label);
    assert.equal(decision.receiptContextMismatchField, null, input.label);
  } else {
    assert.equal(decision.reason, "receipt_context_mismatch", input.label);
    assert.equal(decision.receiptContextMatched, false, input.label);
    assert.equal(decision.receiptContextMismatchField, input.expectedMismatchField, input.label);
  }

  assertDecisionSafety(decision);

  return {
    label: input.label,
    expectedMismatchField: input.expectedMismatchField,
    actualMismatchField: decision.receiptContextMismatchField,
    decisionOk: decision.ok,
    decisionReason: decision.reason,
    releaseAuthorized: decision.releaseAuthorized,
    paymentResponseAllowed: decision.paymentResponseAllowed,
    resourceReleaseAllowed: decision.resourceReleaseAllowed,
    capturedProofAccepted:
      input.state.boundEligibility.ok === true &&
      input.state.boundEligibility.eligibilityVerified === true &&
      input.state.boundEligibility.challengeBound === true &&
      input.state.boundEligibility.resourceBound === true,
    receiptVerified: decision.receiptVerified,
    receiptContextMatched: decision.receiptContextMatched,
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

async function main() {
  console.log(`[${LABEL}] decision-space only; no Gateway receipt submission`);

  const state = await buildCapturedProofState();
  const proof = buildSyntheticReceiptProofFromCapturedState(state);
  const matchingContext = deriveX402ReceiptBindingContextFromCcdPltProofV1(proof);

  const mismatchFields: X402ReceiptContextMismatchField[] = [
    "nonce",
    "resource.method",
    "resource.path",
    "contract.contractId",
    "contract.contractVersion",
    "contract.merchantId",
    "network",
    "asset.type",
    "asset.tokenId",
    "asset.decimals",
    "amount",
    "payTo",
  ];

  const positive = rowFor({
    label: "matching captured proof + verified synthetic receipt context",
    state,
    proof,
    expectedContext: matchingContext,
    expectedMismatchField: null,
    expectedReleaseAuthorized: true,
  });

  const mismatchRows = mismatchFields.map((field) => {
    const expectedContext = mutateContext(matchingContext, field);
    assert.ok(expectedContext, `${field} should produce an expected context`);

    return rowFor({
      label: `wrong ${field}`,
      state,
      proof,
      expectedContext,
      expectedMismatchField: field,
      expectedReleaseAuthorized: false,
    });
  });

  const rows = [positive, ...mismatchRows];

  assert.equal(positive.decisionReason, "release_authorized");
  assert.equal(positive.releaseAuthorized, true);
  assert.equal(positive.paymentResponseAllowed, true);
  assert.equal(positive.resourceReleaseAllowed, true);
  assert.equal(positive.receiptContextMatched, true);

  assert.equal(mismatchRows.length, mismatchFields.length);
  assert.equal(mismatchRows.every((row) => row.decisionReason === "receipt_context_mismatch"), true);
  assert.equal(mismatchRows.every((row) => row.releaseAuthorized === false), true);
  assert.equal(mismatchRows.every((row) => row.paymentResponseAllowed === false), true);
  assert.equal(mismatchRows.every((row) => row.resourceReleaseAllowed === false), true);
  assert.equal(mismatchRows.every((row) => row.receiptContextMatched === false), true);
  assert.deepEqual(
    mismatchRows.map((row) => row.actualMismatchField),
    mismatchFields,
  );

  assert.equal(rows.every((row) => row.capturedProofAccepted === true), true);
  assert.equal(rows.every((row) => row.receiptVerified === true), true);
  assert.equal(rows.every((row) => row.productionRelease === false), true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        harness: "phase3.capturedProofReceiptContextMatrix.v1",
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

        positiveControlAuthorized: positive.releaseAuthorized,
        receiptContextFieldsCovered: mismatchFields,
        mismatchRows,
        mismatchRowsRejected: mismatchRows.length,
        allMismatchesRejected: mismatchRows.every((row) => row.releaseAuthorized === false),
        mismatchFieldsRoundTripped:
          JSON.stringify(mismatchRows.map((row) => row.actualMismatchField)) ===
          JSON.stringify(mismatchFields),

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
