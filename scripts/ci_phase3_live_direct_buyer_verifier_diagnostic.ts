#!/usr/bin/env node
/**
 * scripts/ci_phase3_live_direct_buyer_verifier_diagnostic.ts
 *
 * Phase 3 Milestone 3A diagnostic harness.
 *
 * Safely normalizes a captured Direct Buyer wallet proof file and invokes the
 * real Concordium live verifier path. This harness is diagnostic-only:
 *
 * - does not start the Gateway
 * - does not call /paid-gated
 * - does not emit PAYMENT-RESPONSE
 * - does not release protected content
 * - does not submit or decode receipts
 * - does not call CRP or CRP fulfill
 * - does not touch replay
 * - does not persist proof material
 * - does not print raw proof material
 */

import fs from "node:fs";
import process from "node:process";

import {
  liveVerifyDirectBuyerEnvelope,
} from "../src/phase3/liveZkpVerifierAdapter";
import {
  buildSafeMetadata,
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

function safeError(err: unknown): string {
  const msg = String((err as any)?.message ?? err);
  return msg.length > 500 ? msg.slice(0, 500) + "..." : msg;
}

function emitAndExit(summary: Record<string, unknown>, code: number): never {
  console.log(
    JSON.stringify(
      {
        harness: "phase3.liveDirectBuyerVerifierDiagnostic.v1",
        ...summary,
        productionReleaseAuthorized: false,
        paymentReleaseAttempted: false,
        paymentResponseEmitted: false,
        resourceReleased: false,
        receiptSubmitted: false,
        receiptDecoded: false,
        crpCalled: false,
        crpFulfillCalled: false,
        replayTouched: false,
        canonicalReleasePersisted: false,
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(code);
}

async function main(): Promise<void> {
  if (String(process.env.PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC ?? "").toLowerCase() !== "true") {
    emitAndExit(
      {
        ok: false,
        code: "harness_disabled",
        reason:
          "Set PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true to run this diagnostic harness.",
      },
      1,
    );
  }

  const filePath = process.argv[2];
  if (!filePath) {
    emitAndExit(
      {
        ok: false,
        code: "missing_input_file",
        reason:
          "Usage: PHASE3_LIVE_DIRECT_BUYER_VERIFIER_DIAGNOSTIC=true npm run phase3:live-direct-buyer-verifier-diagnostic-test -- <wallet-proof.json>",
      },
      1,
    );
  }

  let rawInput: string;
  try {
    rawInput = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    emitAndExit(
      {
        ok: false,
        code: "input_read_failed",
        reason: safeError(err),
      },
      1,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch (err) {
    emitAndExit(
      {
        ok: false,
        code: "invalid_json",
        reason: safeError(err),
      },
      1,
    );
  }

  const envelope = normalizeWalletProofCapture(parsed) as any;
  const verifierResult = await liveVerifyDirectBuyerEnvelope(envelope, {
    liveVerify: true,
    grpcHost: process.env.PHASE3_GRPC_HOST ?? "127.0.0.1",
    grpcPort: process.env.PHASE3_GRPC_PORT ? Number(process.env.PHASE3_GRPC_PORT) : 1,
    network: process.env.PHASE3_CONCORDIUM_NETWORK ?? "testnet",
  });

  const safeMetadata = buildSafeMetadata(envelope, verifierResult.ok ? null : verifierResult);

  const summary = {
    ok: verifierResult.ok === true && verifierResult.stage === "verified",
    code: verifierResult.ok === true ? "verified" : "verification_failed",
    normalized: safeMetadata.normalized,
    envelopeType: safeMetadata.envelopeType,
    proofType: safeMetadata.proofType,
    challengeHashPresent: safeMetadata.challengeHashPresent,
    challengeHashLength: safeMetadata.challengeHashLength,
    presentationKind: safeMetadata.presentationKind,
    walletChallengePresent: safeMetadata.walletChallengePresent,
    walletPresent: safeMetadata.walletPresent,
    walletNetworkPresent: safeMetadata.walletNetworkPresent,
    walletSelectedChainPresent: safeMetadata.walletSelectedChainPresent,
    walletAccountAddressPresent: safeMetadata.walletAccountAddressPresent,
    accountBindingStatus: safeMetadata.accountBindingStatus,

    liveVerifyAttempted: true,
    verifierOk: verifierResult.ok,
    verifierStage: verifierResult.stage,
    verifierReason: verifierResult.reason ?? null,
    verifierNetwork: verifierResult.network ?? null,
    verifierGrpcHost: verifierResult.grpcHost ?? null,
    verifierGrpcPort: verifierResult.grpcPort ?? null,
    credentialCount: verifierResult.credentialCount ?? null,
    verifiedRequestKeys: verifierResult.verifiedRequestKeys ?? null,
    walletChallenge: verifierResult.walletChallenge ? "[present]" : null,
    verifiedChallenge: verifierResult.verifiedChallenge ? "[present]" : null,
    challengeBinding: verifierResult.challengeBinding ?? null,
    challengeBound:
      verifierResult.challengeBinding === "walletChallenge" &&
      verifierResult.verifiedChallenge !== null &&
      verifierResult.verifiedChallenge !== undefined,

    delegatedAgentVerificationSupported: verifierResult.delegatedAgentVerificationSupported,
    agentRegistryLookupAttempted: verifierResult.agentRegistryLookupAttempted,
  };

  emitAndExit(summary, summary.ok ? 0 : 1);
}

main().catch((err) => {
  emitAndExit(
    {
      ok: false,
      code: "unexpected_error",
      reason: safeError(err),
    },
    1,
  );
});
