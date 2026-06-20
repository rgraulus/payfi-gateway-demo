#!/usr/bin/env node
/**
 * scripts/ci_phase3_live_direct_buyer_receipt_decoder_adapter_test_only_dry_run_invocation_preflight.ts
 *
 * Milestone 3H / PR #236 harness.
 *
 * Proves a real live Direct Buyer Browser Wallet proof can satisfy the actual
 * /paid-gated/redeem runtime policy path, while a receipt/JWS-shaped artifact
 * is reduced to sanitized handoff metadata, a decode-readiness descriptor,
 * a decoder-input contract descriptor, a disabled/noop decoder invocation
 * guard, a noop-to-real decoder readiness contract, a test-only real
 * decoder adapter gate contract, a test-only gate-open preflight
 * contract, and a dry-run/stub adapter invocation preflight contract
 * bound to the fresh PAYMENT-REQUIRED tuple.
 *
 * This is intentionally a guarded local preflight harness. It does not submit
 * the receipt JWS to Gateway, does not build a runtime decoder input object,
 * does not invoke decode, proves only a dry-run/stub adapter invocation can be observed,
 * does not produce or consume a decoder result, does not verify the receipt
 * in the runtime path, does not release the protected
 * resource, does not emit PAYMENT-RESPONSE, does not call CRP fulfill, does not
 * touch replay, and does not authorize production release.
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

import {
  buildReceiptDecodeMetadataBoundaryDescriptor,
  validateReceiptDecodeMetadataBoundaryDescriptor,
} from "../src/phase3/receiptDecodeMetadataBoundary";
import { receiptSha12 } from "../src/x402/receiptFingerprint";
import {
  baseUrlForPort,
  buildChallengeFromPaymentRequired,
  hashChallenge,
  installSignalCleanup,
  isPortOpen,
  issuePaidGatedChallenge,
  killProcessTree,
  phase3HarnessDatabaseUrl,
  request,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";
import {
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

const GATEWAY_PORT = Number(process.env.PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION_PREFLIGHT_PORT || 3105);
const JWKS_PORT = Number(process.env.PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION_PREFLIGHT_JWKS_PORT || 8155);
const BASE = baseUrlForPort(GATEWAY_PORT);
const JWKS_BASE = baseUrlForPort(JWKS_PORT);
const LABEL = "phase3:live-direct-buyer-receipt-decoder-adapter-test-only-dry-run-invocation-preflight-test";
const TEST_ONLY_GATE_OPEN = process.env.PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_GATE_OPEN === "true";
const TEST_ONLY_DRY_RUN_INVOCATION = process.env.PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION === "true";

const isWin = process.platform === "win32";

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

function nodeCmd() {
  return isWin ? "node.exe" : "node";
}

function startLiveRequiredGateway() {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(GATEWAY_PORT),

    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_GATEWAY_RELEASE_ENABLED: "false",
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: "false",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: "false",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED: "false",
    PHASE3_GATEWAY_PRODUCTION_RELEASE_RESULT_CONSUMPTION_ENABLED: "false",
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "true",

    PHASE3_GRPC_HOST: process.env.PHASE3_GRPC_HOST || "127.0.0.1",
    PHASE3_GRPC_PORT: process.env.PHASE3_GRPC_PORT || "20001",
    PHASE3_CONCORDIUM_NETWORK: process.env.PHASE3_CONCORDIUM_NETWORK || "testnet",

    DATABASE_URL: phase3HarnessDatabaseUrl(),
    ORCHESTRATOR_BASE_URL: process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090",
    ORCHESTRATOR_API_KEY: process.env.ORCHESTRATOR_API_KEY || "dev-internal-key",
    CRP_BASE_URL: process.env.CRP_BASE_URL || "http://127.0.0.1:8080",
    X402_TTL_SEC: process.env.X402_TTL_SEC || "1800",

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const child = spawn(npmCmd(), ["run", "dev"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${LABEL}] gateway spawn error:`, err);
  });

  return child;
}

function startDevJwks(): ChildProcess {
  const child = spawn(nodeCmd(), ["scripts/dev_jwks_server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(JWKS_PORT),
    },
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${LABEL}] dev JWKS spawn error:`, err);
  });

  return child;
}

async function waitForJwks(timeoutMs = 15_000): Promise<void> {
  const url = `${JWKS_BASE}/.well-known/jwks.json`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // issuer still starting
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`dev JWKS did not become ready at ${url}`);
}

function readJsonFile(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function usageAndExit(): never {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: "usage",
        reason:
          "Usage: PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION_PREFLIGHT_HARNESS=true npm run phase3:live-direct-buyer-receipt-decoder-adapter-test-only-dry-run-invocation-preflight-test -- <local-wallet-proof.json>",
        rawProofPrinted: false,
        rawReceiptPrinted: false,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

function mintUrlFromPaymentRequired(pr: any): string {
  const required = [
    pr.nonce,
    pr.contractId,
    pr.contractVersion,
    pr.merchantId,
    pr.resource?.method,
    pr.resource?.path,
    pr.network,
    pr.asset?.tokenId,
    pr.asset?.decimals,
    pr.amount,
    pr.payTo,
  ];

  if (required.some((v) => v === undefined || v === null || v === "")) {
    throw new Error("PAYMENT-REQUIRED missing required mint fields");
  }

  if (typeof pr.isFrozen !== "boolean") {
    throw new Error("PAYMENT-REQUIRED missing isFrozen boolean");
  }

  const u = new URL(`${JWKS_BASE}/mint`);
  u.searchParams.set("nonce", pr.nonce);
  u.searchParams.set("contractId", pr.contractId);
  u.searchParams.set("contractVersion", pr.contractVersion);
  u.searchParams.set("isFrozen", String(pr.isFrozen));
  u.searchParams.set("merchantId", pr.merchantId);
  u.searchParams.set("method", String(pr.resource.method).toUpperCase());
  u.searchParams.set("path", String(pr.resource.path));
  u.searchParams.set("network", pr.network);
  u.searchParams.set("tokenId", pr.asset.tokenId);
  u.searchParams.set("decimals", String(pr.asset.decimals));
  u.searchParams.set("amount", pr.amount);
  u.searchParams.set("payTo", pr.payTo);
  u.searchParams.set("settlementStatus", "finalized");
  u.searchParams.set("ttlSec", "300");

  return u.toString();
}

async function mintReceiptJwsForHandoff(pr: any): Promise<{
  receiptJws: string;
  receiptSha12: string;
  payloadPreview: any;
}> {
  const res = await fetch(mintUrlFromPaymentRequired(pr));
  const text = await res.text();

  assert.equal(res.status, 200, `mint should succeed: ${text}`);

  const json = JSON.parse(text);
  assert.equal(json.ok, true, `mint ok should be true: ${text}`);
  assert.equal(typeof json.jws, "string", "mint should return a JWS string");
  assert.ok(json.jws.length > 0, "minted JWS should not be empty");

  const preview = json.payloadPreview;
  assert.equal(preview?.proofVersion, "ccd-plt-proof@v1");
  assert.equal(preview?.nonce, pr.nonce);
  assert.equal(preview?.settlement?.status, "finalized");
  assert.equal(preview?.contract?.contractId, pr.contractId);
  assert.equal(preview?.contract?.contractVersion, pr.contractVersion);
  assert.equal(preview?.contract?.isFrozen, pr.isFrozen);
  assert.equal(preview?.contract?.merchantId, pr.merchantId);
  assert.equal(preview?.contract?.resource?.method, "GET");
  assert.equal(preview?.contract?.resource?.path, "/paid-gated");
  assert.equal(preview?.contract?.network, pr.network);
  assert.equal(preview?.contract?.asset?.type, "PLT");
  assert.equal(preview?.contract?.asset?.tokenId, pr.asset.tokenId);
  assert.equal(preview?.contract?.asset?.decimals, pr.asset.decimals);
  assert.equal(preview?.contract?.amount, pr.amount);
  assert.equal(preview?.contract?.payTo, pr.payTo);
  assert.equal(preview?.paymentEvent?.kind, "plt.transfer");
  assert.equal(preview?.paymentEvent?.tokenId, pr.asset.tokenId);
  assert.equal(preview?.paymentEvent?.amountRaw, "50101");
  assert.equal(preview?.paymentEvent?.to, pr.payTo);

  return {
    receiptJws: json.jws,
    receiptSha12: receiptSha12(json.jws),
    payloadPreview: preview,
  };
}

function buildSanitizedReceiptJwsHandoff(input: {
  pr: any;
  receiptSha12: string;
  receiptJwsLength: number;
  payloadPreview: any;
}) {
  return {
    contract: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
    mode: "preflight_only",
    status: "handoff_ready",
    reason: "receipt_decoder_noop_result_contract_proved_not_produced_not_consumed_without_runtime_decoder_invocation",
    source: {
      paymentRequiredNonce: input.pr.nonce,
      resource: {
        method: input.pr.resource.method,
        path: input.pr.resource.path,
      },
      merchantId: input.pr.merchantId,
      network: input.pr.network,
    },
    receipt: {
      receiptJwsPresent: true,
      receiptJwsSha12: input.receiptSha12,
      receiptJwsLength: input.receiptJwsLength,
      proofVersion: input.payloadPreview?.proofVersion ?? null,
      settlementStatus: input.payloadPreview?.settlement?.status ?? null,
      receiptPayloadPresent: true,
      receiptPayloadDecoded: false,
      receiptVerified: false,
      receiptDecodeInvoked: false,
      receiptSubmittedToGateway: false,
    },
    decodeReadiness: (() => {
      const descriptor = buildReceiptDecodeMetadataBoundaryDescriptor();
      const validation = validateReceiptDecodeMetadataBoundaryDescriptor(descriptor);

      return {
        descriptorBuilt: true,
        contract: descriptor.contract,
        mode: descriptor.mode,
        status: descriptor.status,
        ready: descriptor.ready,
        validationOk: validation.ok,
        validationReason: validation.reason,
        futureDecoderInputRequired: descriptor.decoderInput.futureDecoderInputRequired,
        metadataOnly: descriptor.decoderInput.metadataOnly,
        decoderInputObjectBuilt: descriptor.decoderInput.inputObjectBuilt,
        decoderInvocationAllowed: descriptor.decoderInput.decoderInvocationAllowed,
        decoderInvocationObserved: descriptor.decoderInput.decoderInvocationObserved,
        receiptJwsAccepted: descriptor.decoderInput.receiptJwsAccepted,
        receiptPayloadAccepted: descriptor.decoderInput.receiptPayloadAccepted,
        receiptBytesAccepted: descriptor.decoderInput.receiptBytesAccepted,
        receiptObjectAccepted: descriptor.decoderInput.receiptObjectAccepted,
        transactionHashAccepted: descriptor.decoderInput.transactionHashAccepted,
        allowedMetadataCategories: [...descriptor.decoderInput.allowedMetadataCategories],
        prohibitedReceiptMaterialCategories: [...descriptor.decoderInput.prohibitedReceiptMaterialCategories],
      };
    })(),
    decoderInputContract: (() => {
      const descriptor = buildReceiptDecodeMetadataBoundaryDescriptor();
      const validation = validateReceiptDecodeMetadataBoundaryDescriptor(descriptor);

      return {
        contract: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
        mode: "metadata_shape_only",
        status: "contract_ready",
        sourceBoundaryContract: descriptor.contract,
        sourceBoundaryStatus: descriptor.status,
        sourceBoundaryReady: descriptor.ready,
        sourceBoundaryValidationOk: validation.ok,
        sourceBoundaryValidationReason: validation.reason,
        contractDescriptorBuilt: true,
        sanitized: true,
        metadataOnly: true,
        runtimeDecoderInputObjectBuilt: false,
        actualDecoderInputObjectBuilt: false,
        decoderInvocationAllowed: false,
        decoderInvocationObserved: false,
        decoderInvoked: false,
        receiptJwsIncluded: false,
        receiptPayloadIncluded: false,
        receiptBytesIncluded: false,
        receiptObjectIncluded: false,
        receiptTransactionHashIncluded: false,
        settlementFieldsIncluded: false,
        replayKeyIncluded: false,
        rawReceiptIncluded: false,
        rawProofIncluded: false,
        receiptReference: {
          kind: "receipt_jws_fingerprint",
          receiptJwsSha12: input.receiptSha12,
          receiptJwsLength: input.receiptJwsLength,
          receiptJwsIncluded: false,
          receiptPayloadDecoded: false,
        },
        inputShape: {
          contractBinding: {
            contractId: input.pr.contractId,
            contractVersion: input.pr.contractVersion,
            isFrozen: input.pr.isFrozen,
          },
          resourceBinding: {
            method: input.pr.resource.method,
            path: input.pr.resource.path,
          },
          merchantBinding: {
            merchantId: input.pr.merchantId,
          },
          networkBinding: {
            network: input.pr.network,
          },
          assetBinding: {
            type: input.pr.asset.type,
            tokenId: input.pr.asset.tokenId,
            decimals: input.pr.asset.decimals,
          },
          amountBinding: {
            amount: input.pr.amount,
            amountRaw: "50101",
          },
          destinationBinding: {
            payTo: input.pr.payTo,
          },
          nonceBinding: {
            nonce: input.pr.nonce,
          },
          upstreamGateContext: {
            required: true,
            policyStatusExpected: "POLICY_SATISFIED",
            verifierStageExpected: "verified",
          },
          decoderContractVersion: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
        },
        allowedMetadataCategories: [...descriptor.decoderInput.allowedMetadataCategories],
        prohibitedReceiptMaterialCategories: [...descriptor.decoderInput.prohibitedReceiptMaterialCategories],
      };
    })(),
    decoderInvocationGuard: {
      contract: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
      mode: "disabled_noop",
      status: "blocked",
      invocationSeamPresent: true,
      invocationEnabled: false,
      invocationAllowed: false,
      invocationAttempted: false,
      invocationObserved: false,
      noopResultProduced: false,
      decodedReceiptProduced: false,
      decodedReceiptConsumed: false,
      receiptJwsPassedToDecoder: false,
      receiptPayloadPassedToDecoder: false,
      receiptBytesPassedToDecoder: false,
      receiptObjectPassedToDecoder: false,
      transactionHashPassedToDecoder: false,
      settlementFieldsPassedToDecoder: false,
      replayKeyPassedToDecoder: false,
      rawReceiptPassedToDecoder: false,
      rawProofPassedToDecoder: false,
      decoderResultConsumedByReleaseDecision: false,
      releaseDecisionMutatedByDecoderResult: false,
    },
    decoderNoopResultContract: {
      contract: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
      mode: "noop_result_contract_only",
      status: "not_produced",
      resultContractPresent: true,
      resultSchemaVersion: "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1",
      resultProduced: false,
      noopResultProduced: false,
      decodedReceiptProduced: false,
      decodedReceiptVerified: false,
      decodedReceiptConsumed: false,
      resultConsumedByReleaseDecision: false,
      releaseDecisionMutatedByResult: false,
      receiptJwsUsed: false,
      receiptPayloadUsed: false,
      receiptBytesUsed: false,
      receiptObjectUsed: false,
      transactionHashUsed: false,
      settlementFieldsUsed: false,
      replayKeyUsed: false,
      rawReceiptUsed: false,
      rawProofUsed: false,
      resultReference: {
        kind: "noop_decoder_result_contract_fingerprint",
        receiptJwsSha12: input.receiptSha12,
        receiptJwsLength: input.receiptJwsLength,
        receiptJwsIncluded: false,
        receiptPayloadDecoded: false,
        resultDerivedFromReceiptMaterial: false,
      },
    },
      decoderNoopToRealReadiness: {
        contract: "phase3.liveDirectBuyer.receiptDecoderNoopToRealReadinessPreflight.v1",
        mode: "readiness_contract_only",
        status: "not_ready",
        readinessDescriptorPresent: true,
        realDecoderAdapterRepresented: true,
        realDecoderAdapterInvoked: false,
        realDecoderAdapterInvocationAllowed: false,
        realDecoderAdapterInvocationAttempted: false,
        testOnlyEnablementRequired: true,
        testOnlyEnablementPresent: false,
        productionEnablementPresent: false,
        decoderInputContractRequired: true,
        decoderInputContractPresent: true,
        noopResultContractRequired: true,
        noopResultContractPresent: true,
        receiptMaterialStillRejected: true,
        receiptJwsAcceptedForDecode: false,
        receiptPayloadAcceptedForDecode: false,
        receiptBytesAcceptedForDecode: false,
        receiptObjectAcceptedForDecode: false,
        rawReceiptAcceptedForDecode: false,
        rawProofAcceptedForDecode: false,
        decodedReceiptProduced: false,
        decodedReceiptVerified: false,
        decoderResultProduced: false,
        decoderResultConsumedByReleaseDecision: false,
        releaseDecisionMutatedByDecoderResult: false,
        runtimeDecoderInputObjectBuilt: false,
        readinessFailures: [
          "test_only_enablement_missing",
          "real_decoder_adapter_disabled",
          "receipt_material_not_accepted",
          "runtime_decoder_input_not_built",
        ],
      },
      realDecoderAdapterGate: {
        contract: "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyGatePreflight.v1",
        mode: "test_only_gate_contract",
        status: "closed",
        gateDescriptorPresent: true,
        productionEnabled: false,
        productionEnablementAccepted: false,
        testOnlyGateRequired: true,
        testOnlyGatePresent: false,
        testOnlyGateSatisfied: false,
        adapterRepresented: true,
        adapterInvocationAllowed: false,
        adapterInvocationAttempted: false,
        adapterInvoked: false,
        receiptMaterialAccepted: false,
        receiptJwsAcceptedForDecode: false,
        receiptPayloadAcceptedForDecode: false,
        receiptBytesAcceptedForDecode: false,
        receiptObjectAcceptedForDecode: false,
        rawReceiptAcceptedForDecode: false,
        rawProofAcceptedForDecode: false,
        runtimeDecoderInputObjectBuilt: false,
        actualDecoderInputObjectBuilt: false,
        decodedReceiptProduced: false,
        decodedReceiptVerified: false,
        decoderResultProduced: false,
        decoderResultConsumedByReleaseDecision: false,
        releaseDecisionMutatedByDecoderResult: false,
        paymentResponseEmissionAllowed: false,
        crpFulfillAllowed: false,
        replayMutationAllowed: false,
        canonicalReleasePersistenceAllowed: false,
        productionReleaseAllowed: false,
        gateFailures: [
          "test_only_gate_missing",
          "production_disabled",
          "receipt_material_not_accepted",
          "runtime_decoder_input_not_built",
        ],
      },
      realDecoderAdapterGateOpenPreflight: {
        contract: "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyGateOpenPreflight.v1",
        mode: "test_only_gate_open_contract",
        status: TEST_ONLY_GATE_OPEN ? "open_test_only" : "closed",
        gateDescriptorPresent: true,
        testOnlyGateRequired: true,
        testOnlyGateOpenFlagPresent: TEST_ONLY_GATE_OPEN,
        testOnlyGateSatisfied: TEST_ONLY_GATE_OPEN,
        productionEnabled: false,
        productionEnablementAccepted: false,
        adapterRepresented: true,
        adapterInvocationAllowed: false,
        adapterInvocationAttempted: false,
        adapterInvoked: false,
        receiptMaterialAccepted: false,
        runtimeDecoderInputObjectBuilt: false,
        actualDecoderInputObjectBuilt: false,
        decodedReceiptProduced: false,
        decodedReceiptVerified: false,
        decoderResultProduced: false,
        decoderResultConsumedByReleaseDecision: false,
        releaseDecisionMutatedByDecoderResult: false,
        paymentResponseEmissionAllowed: false,
        crpFulfillAllowed: false,
        replayMutationAllowed: false,
        canonicalReleasePersistenceAllowed: false,
        productionReleaseAllowed: false,
        gateFailures: TEST_ONLY_GATE_OPEN
          ? ["adapter_invocation_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"]
          : ["test_only_gate_missing", "production_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"],
      },
      realDecoderAdapterDryRunInvocationPreflight: {
        contract: "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyDryRunInvocationPreflight.v1",
        mode: "test_only_dry_run_invocation_contract",
        status: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION ? "dry_run_invocation_observed" : "blocked",
        dryRunDescriptorPresent: true,
        testOnlyGateOpenRequired: true,
        testOnlyGateOpenSatisfied: TEST_ONLY_GATE_OPEN,
        dryRunInvocationFlagRequired: true,
        dryRunInvocationFlagPresent: TEST_ONLY_DRY_RUN_INVOCATION,
        dryRunInvocationAllowed: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION,
        dryRunInvocationAttempted: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION,
        dryRunInvocationObserved: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION,
        adapterStubRepresented: true,
        adapterStubInvoked: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION,
        realDecoderAdapterInvoked: false,
        realDecoderInvoked: false,
        receiptMaterialAccepted: false,
        receiptJwsAcceptedForDecode: false,
        receiptPayloadAcceptedForDecode: false,
        receiptBytesAcceptedForDecode: false,
        receiptObjectAcceptedForDecode: false,
        rawReceiptAcceptedForDecode: false,
        rawProofAcceptedForDecode: false,
        runtimeDecoderInputObjectBuilt: false,
        actualDecoderInputObjectBuilt: false,
        decodedReceiptProduced: false,
        decodedReceiptVerified: false,
        decoderResultProduced: false,
        decoderResultConsumedByReleaseDecision: false,
        releaseDecisionMutatedByDecoderResult: false,
        paymentResponseEmissionAllowed: false,
        crpFulfillAllowed: false,
        replayMutationAllowed: false,
        canonicalReleasePersistenceAllowed: false,
        productionReleaseAllowed: false,
        dryRunFailures: TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION
          ? ["real_decoder_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built", "release_consumption_disabled"]
          : ["test_only_gate_not_open_or_dry_run_missing", "real_decoder_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"],
      },
      binding: {
        nonceMatched: input.payloadPreview?.nonce === input.pr.nonce,
        resourceMatched:
          input.payloadPreview?.contract?.resource?.method === input.pr.resource.method &&
          input.payloadPreview?.contract?.resource?.path === input.pr.resource.path,
        contractMatched:
          input.payloadPreview?.contract?.contractId === input.pr.contractId &&
          input.payloadPreview?.contract?.contractVersion === input.pr.contractVersion &&
          input.payloadPreview?.contract?.isFrozen === input.pr.isFrozen,
        merchantMatched: input.payloadPreview?.contract?.merchantId === input.pr.merchantId,
        paymentTupleMatched:
          input.payloadPreview?.contract?.network === input.pr.network &&
          input.payloadPreview?.contract?.asset?.tokenId === input.pr.asset.tokenId &&
          input.payloadPreview?.contract?.asset?.decimals === input.pr.asset.decimals &&
          input.payloadPreview?.contract?.amount === input.pr.amount &&
          input.payloadPreview?.contract?.payTo === input.pr.payTo &&
          input.payloadPreview?.paymentEvent?.amountRaw === "50101",
      },
    safety: {
      sanitized: true,
      handoffAccepted: true,
      preflightOnly: true,
      rawProofIncluded: false,
      rawReceiptIncluded: false,
      jwsIncluded: false,
      receiptSubmittedToGateway: false,
      receiptDecodeInvoked: false,
      receiptVerified: false,
      receiptDecodeReadinessDescriptorBuilt: true,
      receiptDecodeReadinessDescriptorValid: true,
      decoderInputContractDescriptorBuilt: true,
      decoderInputContractDescriptorValid: true,
      decoderInputContractMetadataOnly: true,
      decoderInputObjectBuilt: false,
      runtimeDecoderInputObjectBuilt: false,
      actualDecoderInputObjectBuilt: false,
      decoderInvocationAllowed: false,
      decoderInvocationObserved: false,
      decoderInvocationGuardPresent: true,
      decoderInvocationGuardMode: "disabled_noop",
      decoderInvocationGuardStatus: "blocked",
      decoderInvocationEnabled: false,
      decoderInvocationAttempted: false,
      decoderInvocationObservedByGuard: false,
      noopDecoderResultContractPresent: true,
      noopDecoderResultContractStatus: "not_produced",
      noopDecoderResultContractMode: "noop_result_contract_only",
      noopDecoderResultProduced: false,
      decodedReceiptProduced: false,
      decodedReceiptVerified: false,
      decodedReceiptConsumed: false,
      decoderResultProduced: false,
      decoderResultConsumedByReleaseDecision: false,
      releaseDecisionMutatedByDecoderResult: false,
      receiptMaterialAcceptedForDecode: false,
      resultConsumed: false,
      receiptConsumed: false,
      paymentReleaseAttempted: false,
      paymentResponseEmitted: false,
      resourceReleased: false,
      adapterInvoked: false,
      externalCallAttempted: false,
      crpCalled: false,
      crpFulfillCalled: false,
      replayTouched: false,
      canonicalReleasePersisted: false,
      productionReleaseAuthorized: false,
      productionRelease: false,
      sideEffectFree: true,
    },
  };
}

async function main() {
  console.log(`[${LABEL}] BASE=${BASE}`);
  console.log(`[${LABEL}] JWKS_BASE=${JWKS_BASE}`);

  if (String(process.env.PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION_PREFLIGHT_HARNESS ?? "").toLowerCase() !== "true") {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "harness_disabled",
          reason:
            "Set PHASE3_LIVE_DIRECT_BUYER_RECEIPT_DECODER_ADAPTER_TEST_ONLY_DRY_RUN_INVOCATION_PREFLIGHT_HARNESS=true to run this local-only harness.",
          rawProofPrinted: false,
          rawReceiptPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const proofPath = process.argv[2];
  if (!proofPath) usageAndExit();

  if (!fs.existsSync(proofPath)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "proof_file_missing",
          proofPath,
          rawProofPrinted: false,
          rawReceiptPrinted: false,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`gateway port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(JWKS_PORT)) {
    throw new Error(`JWKS port ${JWKS_PORT} is already open. Stop the existing dev JWKS issuer and retry.`);
  }

  const walletCapture = readJsonFile(proofPath);
  const capturedAuthorizationProof = normalizeWalletProofCapture(walletCapture);
  const gateway = startLiveRequiredGateway();
  const jwks = startDevJwks();

  const cleanup = async () => {
    await killProcessTree(gateway);
    await killProcessTree(jwks);
    await waitForPortClosed(GATEWAY_PORT);
    await waitForPortClosed(JWKS_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    await waitForJwks();
    const health = await waitForReady(BASE);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
    assert.equal(health.phase3?.gatewayProductionReleaseEnabled, false);
    assert.equal(health.phase3?.gatewayProductionReleaseDryRunEnabled, false);
    assert.equal(health.phase3?.allowParsedOnlyPolicy, true);
    assert.equal(health.phase3?.requireLiveZkp, true);

    const pr = await issuePaidGatedChallenge(BASE);
    const runtimeChallenge = buildChallengeFromPaymentRequired(pr);
    const runtimeChallengeHash = hashChallenge(runtimeChallenge);

    const authorizationProof = {
      ...capturedAuthorizationProof,
      challenge: runtimeChallenge,
      challengeHash: runtimeChallengeHash,
      presentation: {
        ...(capturedAuthorizationProof as any).presentation,
        claims: {
          ...((capturedAuthorizationProof as any).presentation?.claims ?? {}),
          region: "EU",
          ageOver: 21,
        },
      },
    };

    const redeem = await request(BASE, "/paid-gated/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        nonce: pr.nonce,
        authorizationProof,
      }),
    });

    assert.equal(redeem.headers.get("payment-response"), null, "redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.status, 200, `redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.json?.ok, true);
    assert.equal(redeem.json?.nonce, pr.nonce);
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.access, "policy-satisfied");
    assert.equal(redeem.json?.verifier?.ok, true);
    assert.equal(redeem.json?.verifier?.stage, "verified");
    assert.equal(redeem.json?.verifier?.challengeBinding, "walletChallenge");
    assert.equal(redeem.json?.verifier?.rawProofPrinted, false);
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const minted = await mintReceiptJwsForHandoff(pr);
    const handoff = buildSanitizedReceiptJwsHandoff({
      pr,
      receiptSha12: minted.receiptSha12,
      receiptJwsLength: minted.receiptJws.length,
      payloadPreview: minted.payloadPreview,
    });

    assert.equal(handoff.receipt.receiptJwsPresent, true);
    assert.equal(handoff.receipt.receiptJwsSha12, minted.receiptSha12);
    assert.equal(handoff.receipt.receiptJwsLength, minted.receiptJws.length);
    assert.equal(handoff.receipt.proofVersion, "ccd-plt-proof@v1");
    assert.equal(handoff.receipt.settlementStatus, "finalized");
    assert.equal(handoff.receipt.receiptPayloadPresent, true);
    assert.equal(handoff.receipt.receiptPayloadDecoded, false);
    assert.equal(handoff.receipt.receiptVerified, false);
    assert.equal(handoff.receipt.receiptDecodeInvoked, false);
    assert.equal(handoff.receipt.receiptSubmittedToGateway, false);
    assert.equal(handoff.decodeReadiness.descriptorBuilt, true);
    assert.equal(handoff.decodeReadiness.validationOk, true);
    assert.equal(handoff.decodeReadiness.validationReason, null);
    assert.equal(handoff.decodeReadiness.status, "preflight_ready");
    assert.equal(handoff.decodeReadiness.ready, false);
    assert.equal(handoff.decodeReadiness.futureDecoderInputRequired, true);
    assert.equal(handoff.decodeReadiness.metadataOnly, true);
    assert.equal(handoff.decodeReadiness.decoderInputObjectBuilt, false);
    assert.equal(handoff.decodeReadiness.decoderInvocationAllowed, false);
    assert.equal(handoff.decodeReadiness.decoderInvocationObserved, false);
    assert.equal(handoff.decodeReadiness.receiptJwsAccepted, false);
    assert.equal(handoff.decodeReadiness.receiptPayloadAccepted, false);
    assert.equal(handoff.decodeReadiness.receiptBytesAccepted, false);
    assert.equal(handoff.decodeReadiness.receiptObjectAccepted, false);
    assert.equal(handoff.decodeReadiness.transactionHashAccepted, false);
    assert.equal(handoff.decoderInputContract.contractDescriptorBuilt, true);
    assert.equal(handoff.decoderInputContract.contract, "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1");
    assert.equal(handoff.decoderInputContract.mode, "metadata_shape_only");
    assert.equal(handoff.decoderInputContract.status, "contract_ready");
    assert.equal(handoff.decoderInputContract.sourceBoundaryValidationOk, true);
    assert.equal(handoff.decoderInputContract.sourceBoundaryReady, false);
    assert.equal(handoff.decoderInputContract.sanitized, true);
    assert.equal(handoff.decoderInputContract.metadataOnly, true);
    assert.equal(handoff.decoderInputContract.runtimeDecoderInputObjectBuilt, false);
    assert.equal(handoff.decoderInputContract.actualDecoderInputObjectBuilt, false);
    assert.equal(handoff.decoderInputContract.decoderInvocationAllowed, false);
    assert.equal(handoff.decoderInputContract.decoderInvocationObserved, false);
    assert.equal(handoff.decoderInputContract.decoderInvoked, false);
    assert.equal(handoff.decoderInputContract.receiptJwsIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptPayloadIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptBytesIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptObjectIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptTransactionHashIncluded, false);
    assert.equal(handoff.decoderInputContract.settlementFieldsIncluded, false);
    assert.equal(handoff.decoderInputContract.replayKeyIncluded, false);
    assert.equal(handoff.decoderInputContract.rawReceiptIncluded, false);
    assert.equal(handoff.decoderInputContract.rawProofIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptReference.receiptJwsSha12, minted.receiptSha12);
    assert.equal(handoff.decoderInputContract.receiptReference.receiptJwsLength, minted.receiptJws.length);
    assert.equal(handoff.decoderInputContract.receiptReference.receiptJwsIncluded, false);
    assert.equal(handoff.decoderInputContract.receiptReference.receiptPayloadDecoded, false);
    assert.equal(handoff.decoderInputContract.inputShape.contractBinding.contractId, pr.contractId);
    assert.equal(handoff.decoderInputContract.inputShape.resourceBinding.path, pr.resource.path);
    assert.equal(handoff.decoderInputContract.inputShape.merchantBinding.merchantId, pr.merchantId);
    assert.equal(handoff.decoderInputContract.inputShape.nonceBinding.nonce, pr.nonce);
    assert.equal(handoff.decoderInvocationGuard.contract, "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1");
    assert.equal(handoff.decoderInvocationGuard.mode, "disabled_noop");
    assert.equal(handoff.decoderInvocationGuard.status, "blocked");
    assert.equal(handoff.decoderInvocationGuard.invocationSeamPresent, true);
    assert.equal(handoff.decoderInvocationGuard.invocationEnabled, false);
    assert.equal(handoff.decoderInvocationGuard.invocationAllowed, false);
    assert.equal(handoff.decoderInvocationGuard.invocationAttempted, false);
    assert.equal(handoff.decoderInvocationGuard.invocationObserved, false);
    assert.equal(handoff.decoderInvocationGuard.noopResultProduced, false);
    assert.equal(handoff.decoderInvocationGuard.decodedReceiptProduced, false);
    assert.equal(handoff.decoderInvocationGuard.decodedReceiptConsumed, false);
    assert.equal(handoff.decoderInvocationGuard.receiptJwsPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.receiptPayloadPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.receiptBytesPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.receiptObjectPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.transactionHashPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.settlementFieldsPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.replayKeyPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.rawReceiptPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.rawProofPassedToDecoder, false);
    assert.equal(handoff.decoderInvocationGuard.decoderResultConsumedByReleaseDecision, false);
    assert.equal(handoff.decoderInvocationGuard.releaseDecisionMutatedByDecoderResult, false);
    assert.equal(handoff.decoderNoopResultContract.contract, "phase3.liveDirectBuyer.receiptDecoderNoopResultContractPreflight.v1");
    assert.equal(handoff.decoderNoopResultContract.mode, "noop_result_contract_only");
    assert.equal(handoff.decoderNoopResultContract.status, "not_produced");
    assert.equal(handoff.decoderNoopResultContract.resultContractPresent, true);
    assert.equal(handoff.decoderNoopResultContract.resultProduced, false);
    assert.equal(handoff.decoderNoopResultContract.noopResultProduced, false);
    assert.equal(handoff.decoderNoopResultContract.decodedReceiptProduced, false);
    assert.equal(handoff.decoderNoopResultContract.decodedReceiptVerified, false);
    assert.equal(handoff.decoderNoopResultContract.decodedReceiptConsumed, false);
    assert.equal(handoff.decoderNoopResultContract.resultConsumedByReleaseDecision, false);
    assert.equal(handoff.decoderNoopResultContract.releaseDecisionMutatedByResult, false);
    assert.equal(handoff.decoderNoopResultContract.receiptJwsUsed, false);
    assert.equal(handoff.decoderNoopResultContract.receiptPayloadUsed, false);
    assert.equal(handoff.decoderNoopResultContract.receiptBytesUsed, false);
    assert.equal(handoff.decoderNoopResultContract.receiptObjectUsed, false);
    assert.equal(handoff.decoderNoopResultContract.transactionHashUsed, false);
    assert.equal(handoff.decoderNoopResultContract.settlementFieldsUsed, false);
    assert.equal(handoff.decoderNoopResultContract.replayKeyUsed, false);
    assert.equal(handoff.decoderNoopResultContract.rawReceiptUsed, false);
    assert.equal(handoff.decoderNoopResultContract.rawProofUsed, false);
    assert.equal(handoff.decoderNoopResultContract.resultReference.receiptJwsSha12, minted.receiptSha12);
    assert.equal(handoff.decoderNoopResultContract.resultReference.receiptJwsLength, minted.receiptJws.length);
    assert.equal(handoff.decoderNoopResultContract.resultReference.receiptJwsIncluded, false);
    assert.equal(handoff.decoderNoopResultContract.resultReference.receiptPayloadDecoded, false);
    assert.equal(handoff.decoderNoopResultContract.resultReference.resultDerivedFromReceiptMaterial, false);
      assert.equal(handoff.decoderNoopToRealReadiness.contract, "phase3.liveDirectBuyer.receiptDecoderNoopToRealReadinessPreflight.v1");
      assert.equal(handoff.decoderNoopToRealReadiness.mode, "readiness_contract_only");
      assert.equal(handoff.decoderNoopToRealReadiness.status, "not_ready");
      assert.equal(handoff.decoderNoopToRealReadiness.readinessDescriptorPresent, true);
      assert.equal(handoff.decoderNoopToRealReadiness.realDecoderAdapterRepresented, true);
      assert.equal(handoff.decoderNoopToRealReadiness.realDecoderAdapterInvoked, false);
      assert.equal(handoff.decoderNoopToRealReadiness.realDecoderAdapterInvocationAllowed, false);
      assert.equal(handoff.decoderNoopToRealReadiness.realDecoderAdapterInvocationAttempted, false);
      assert.equal(handoff.decoderNoopToRealReadiness.testOnlyEnablementRequired, true);
      assert.equal(handoff.decoderNoopToRealReadiness.testOnlyEnablementPresent, false);
      assert.equal(handoff.decoderNoopToRealReadiness.productionEnablementPresent, false);
      assert.equal(handoff.decoderNoopToRealReadiness.decoderInputContractRequired, true);
      assert.equal(handoff.decoderNoopToRealReadiness.decoderInputContractPresent, true);
      assert.equal(handoff.decoderNoopToRealReadiness.noopResultContractRequired, true);
      assert.equal(handoff.decoderNoopToRealReadiness.noopResultContractPresent, true);
      assert.equal(handoff.decoderNoopToRealReadiness.receiptMaterialStillRejected, true);
      assert.equal(handoff.decoderNoopToRealReadiness.receiptJwsAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.receiptPayloadAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.receiptBytesAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.receiptObjectAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.rawReceiptAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.rawProofAcceptedForDecode, false);
      assert.equal(handoff.decoderNoopToRealReadiness.decodedReceiptProduced, false);
      assert.equal(handoff.decoderNoopToRealReadiness.decodedReceiptVerified, false);
      assert.equal(handoff.decoderNoopToRealReadiness.decoderResultProduced, false);
      assert.equal(handoff.decoderNoopToRealReadiness.decoderResultConsumedByReleaseDecision, false);
      assert.equal(handoff.decoderNoopToRealReadiness.releaseDecisionMutatedByDecoderResult, false);
      assert.equal(handoff.decoderNoopToRealReadiness.runtimeDecoderInputObjectBuilt, false);
      assert.deepEqual(handoff.decoderNoopToRealReadiness.readinessFailures, [
        "test_only_enablement_missing",
        "real_decoder_adapter_disabled",
        "receipt_material_not_accepted",
        "runtime_decoder_input_not_built",
      ]);
      assert.equal(handoff.realDecoderAdapterGate.contract, "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyGatePreflight.v1");
      assert.equal(handoff.realDecoderAdapterGate.mode, "test_only_gate_contract");
      assert.equal(handoff.realDecoderAdapterGate.status, "closed");
      assert.equal(handoff.realDecoderAdapterGate.gateDescriptorPresent, true);
      assert.equal(handoff.realDecoderAdapterGate.productionEnabled, false);
      assert.equal(handoff.realDecoderAdapterGate.productionEnablementAccepted, false);
      assert.equal(handoff.realDecoderAdapterGate.testOnlyGateRequired, true);
      assert.equal(handoff.realDecoderAdapterGate.testOnlyGatePresent, false);
      assert.equal(handoff.realDecoderAdapterGate.testOnlyGateSatisfied, false);
      assert.equal(handoff.realDecoderAdapterGate.adapterRepresented, true);
      assert.equal(handoff.realDecoderAdapterGate.adapterInvocationAllowed, false);
      assert.equal(handoff.realDecoderAdapterGate.adapterInvocationAttempted, false);
      assert.equal(handoff.realDecoderAdapterGate.adapterInvoked, false);
      assert.equal(handoff.realDecoderAdapterGate.receiptMaterialAccepted, false);
      assert.equal(handoff.realDecoderAdapterGate.receiptJwsAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.receiptPayloadAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.receiptBytesAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.receiptObjectAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.rawReceiptAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.rawProofAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterGate.runtimeDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterGate.actualDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterGate.decodedReceiptProduced, false);
      assert.equal(handoff.realDecoderAdapterGate.decodedReceiptVerified, false);
      assert.equal(handoff.realDecoderAdapterGate.decoderResultProduced, false);
      assert.equal(handoff.realDecoderAdapterGate.decoderResultConsumedByReleaseDecision, false);
      assert.equal(handoff.realDecoderAdapterGate.releaseDecisionMutatedByDecoderResult, false);
      assert.equal(handoff.realDecoderAdapterGate.paymentResponseEmissionAllowed, false);
      assert.equal(handoff.realDecoderAdapterGate.crpFulfillAllowed, false);
      assert.equal(handoff.realDecoderAdapterGate.replayMutationAllowed, false);
      assert.equal(handoff.realDecoderAdapterGate.canonicalReleasePersistenceAllowed, false);
      assert.equal(handoff.realDecoderAdapterGate.productionReleaseAllowed, false);
      assert.deepEqual(handoff.realDecoderAdapterGate.gateFailures, [
        "test_only_gate_missing",
        "production_disabled",
        "receipt_material_not_accepted",
        "runtime_decoder_input_not_built",
      ]);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.contract, "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyGateOpenPreflight.v1");
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.mode, "test_only_gate_open_contract");
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.status, TEST_ONLY_GATE_OPEN ? "open_test_only" : "closed");
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.gateDescriptorPresent, true);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.testOnlyGateRequired, true);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.testOnlyGateOpenFlagPresent, TEST_ONLY_GATE_OPEN);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.testOnlyGateSatisfied, TEST_ONLY_GATE_OPEN);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.productionEnabled, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.productionEnablementAccepted, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.adapterRepresented, true);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.adapterInvocationAllowed, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.adapterInvocationAttempted, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.adapterInvoked, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.receiptMaterialAccepted, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.runtimeDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.actualDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.decodedReceiptProduced, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.decodedReceiptVerified, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.decoderResultProduced, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.decoderResultConsumedByReleaseDecision, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.releaseDecisionMutatedByDecoderResult, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.paymentResponseEmissionAllowed, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.crpFulfillAllowed, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.replayMutationAllowed, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.canonicalReleasePersistenceAllowed, false);
      assert.equal(handoff.realDecoderAdapterGateOpenPreflight.productionReleaseAllowed, false);
      assert.deepEqual(
        handoff.realDecoderAdapterGateOpenPreflight.gateFailures,
        TEST_ONLY_GATE_OPEN
          ? ["adapter_invocation_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"]
          : ["test_only_gate_missing", "production_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"],
      );
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.contract, "phase3.liveDirectBuyer.receiptDecoderAdapterTestOnlyDryRunInvocationPreflight.v1");
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.mode, "test_only_dry_run_invocation_contract");
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.status, TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION ? "dry_run_invocation_observed" : "blocked");
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunDescriptorPresent, true);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.testOnlyGateOpenRequired, true);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.testOnlyGateOpenSatisfied, TEST_ONLY_GATE_OPEN);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationFlagRequired, true);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationFlagPresent, TEST_ONLY_DRY_RUN_INVOCATION);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationAllowed, TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationAttempted, TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationObserved, TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.adapterStubRepresented, true);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.adapterStubInvoked, TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.realDecoderAdapterInvoked, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.realDecoderInvoked, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.receiptMaterialAccepted, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.receiptJwsAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.receiptPayloadAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.receiptBytesAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.receiptObjectAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.rawReceiptAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.rawProofAcceptedForDecode, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.runtimeDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.actualDecoderInputObjectBuilt, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.decodedReceiptProduced, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.decodedReceiptVerified, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.decoderResultProduced, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.decoderResultConsumedByReleaseDecision, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.releaseDecisionMutatedByDecoderResult, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.paymentResponseEmissionAllowed, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.crpFulfillAllowed, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.replayMutationAllowed, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.canonicalReleasePersistenceAllowed, false);
      assert.equal(handoff.realDecoderAdapterDryRunInvocationPreflight.productionReleaseAllowed, false);
      assert.deepEqual(
        handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunFailures,
        TEST_ONLY_GATE_OPEN && TEST_ONLY_DRY_RUN_INVOCATION
          ? ["real_decoder_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built", "release_consumption_disabled"]
          : ["test_only_gate_not_open_or_dry_run_missing", "real_decoder_still_disabled", "receipt_material_not_accepted", "runtime_decoder_input_not_built"],
      );
    assert.equal(handoff.binding.nonceMatched, true);
    assert.equal(handoff.binding.resourceMatched, true);
    assert.equal(handoff.binding.contractMatched, true);
    assert.equal(handoff.binding.merchantMatched, true);
    assert.equal(handoff.binding.paymentTupleMatched, true);
    assert.equal(handoff.safety.sanitized, true);
    assert.equal(handoff.safety.handoffAccepted, true);
    assert.equal(handoff.safety.preflightOnly, true);
    assert.equal(handoff.safety.rawProofIncluded, false);
    assert.equal(handoff.safety.rawReceiptIncluded, false);
    assert.equal(handoff.safety.jwsIncluded, false);
    assert.equal(handoff.safety.receiptSubmittedToGateway, false);
    assert.equal(handoff.safety.receiptDecodeInvoked, false);
    assert.equal(handoff.safety.receiptVerified, false);
    assert.equal(handoff.safety.receiptDecodeReadinessDescriptorBuilt, true);
    assert.equal(handoff.safety.receiptDecodeReadinessDescriptorValid, true);
    assert.equal(handoff.safety.decoderInputContractDescriptorBuilt, true);
    assert.equal(handoff.safety.decoderInputContractDescriptorValid, true);
    assert.equal(handoff.safety.decoderInputContractMetadataOnly, true);
    assert.equal(handoff.safety.decoderInputObjectBuilt, false);
    assert.equal(handoff.safety.runtimeDecoderInputObjectBuilt, false);
    assert.equal(handoff.safety.actualDecoderInputObjectBuilt, false);
    assert.equal(handoff.safety.decoderInvocationAllowed, false);
    assert.equal(handoff.safety.decoderInvocationObserved, false);
    assert.equal(handoff.safety.decoderInvocationGuardPresent, true);
    assert.equal(handoff.safety.decoderInvocationGuardMode, "disabled_noop");
    assert.equal(handoff.safety.decoderInvocationGuardStatus, "blocked");
    assert.equal(handoff.safety.decoderInvocationEnabled, false);
    assert.equal(handoff.safety.decoderInvocationAttempted, false);
    assert.equal(handoff.safety.decoderInvocationObservedByGuard, false);
    assert.equal(handoff.safety.noopDecoderResultProduced, false);
    assert.equal(handoff.safety.decodedReceiptProduced, false);
    assert.equal(handoff.safety.receiptMaterialAcceptedForDecode, false);
    assert.equal(handoff.safety.resultConsumed, false);
    assert.equal(handoff.safety.receiptConsumed, false);
    assert.equal(handoff.safety.paymentReleaseAttempted, false);
    assert.equal(handoff.safety.paymentResponseEmitted, false);
    assert.equal(handoff.safety.resourceReleased, false);
    assert.equal(handoff.safety.adapterInvoked, false);
    assert.equal(handoff.safety.externalCallAttempted, false);
    assert.equal(handoff.safety.crpCalled, false);
    assert.equal(handoff.safety.crpFulfillCalled, false);
    assert.equal(handoff.safety.replayTouched, false);
    assert.equal(handoff.safety.canonicalReleasePersisted, false);
    assert.equal(handoff.safety.productionReleaseAuthorized, false);
    assert.equal(handoff.safety.productionRelease, false);
    assert.equal(handoff.safety.sideEffectFree, true);

    const blocked = await request(BASE, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`);
    assert.equal(blocked.status, 402, `actual gateway must remain unreleased: ${blocked.text}`);
    assert.ok(blocked.headers.get("payment-required"), "actual gateway should still emit PAYMENT-REQUIRED");
    assert.equal(blocked.headers.get("payment-response"), null, "actual gateway must not emit PAYMENT-RESPONSE");

    console.log(
      JSON.stringify(
        {
          ok: true,
          harness: "phase3.liveDirectBuyerReceiptDecoderAdapterTestOnlyDryRunInvocationPreflight.v1",
          gatewayPolicyGateEnabled: true,
          gatewayReleaseEnabled: false,
          gatewayTestReleaseOnly: false,
          gatewayProductionReleaseEnabled: false,
          gatewayProductionReleaseDryRunEnabled: false,
          gatewayProductionReleaseResultConsumptionEnabled: false,
          allowParsedOnlyPolicy: true,
          requireLiveZkp: true,
          inputProofPathProvided: true,
          normalizedEnvelopeType: capturedAuthorizationProof.type,
          proofType: capturedAuthorizationProof.proofType ?? null,
          runtimeChallengeAttached: true,
          runtimeChallengeHashPresent: typeof runtimeChallengeHash === "string" && runtimeChallengeHash.length > 0,
          policyEvidenceProjected: true,
          redeemStatus: redeem.status,
          policyStatus: redeem.json?.policyStatus,
          verifierOk: redeem.json?.verifier?.ok === true,
          verifierStage: redeem.json?.verifier?.stage,
          verifierChallengeBinding: redeem.json?.verifier?.challengeBinding,
          policyAllowed: redeem.json?.policyDecision?.allowed === true,
          receiptJwsHandoffBuilt: true,
          receiptDecodeReadinessDescriptorBuilt: handoff.decodeReadiness.descriptorBuilt,
          decoderInputContractDescriptorBuilt: handoff.decoderInputContract.contractDescriptorBuilt,
          decoderInvocationGuardPresent: handoff.decoderInvocationGuard.invocationSeamPresent,
          decoderInvocationGuardMode: handoff.decoderInvocationGuard.mode,
          decoderInvocationGuardStatus: handoff.decoderInvocationGuard.status,
          decoderNoopResultContractPresent: handoff.decoderNoopResultContract.resultContractPresent,
          decoderNoopResultContractMode: handoff.decoderNoopResultContract.mode,
          decoderNoopResultContractStatus: handoff.decoderNoopResultContract.status,
          decoderNoopResultProduced: handoff.decoderNoopResultContract.resultProduced,
          decoderNoopResultConsumedByReleaseDecision: handoff.decoderNoopResultContract.resultConsumedByReleaseDecision,
          decoderNoopResultMutatedReleaseDecision: handoff.decoderNoopResultContract.releaseDecisionMutatedByResult,
          decoderNoopResultDerivedFromReceiptMaterial: handoff.decoderNoopResultContract.resultReference.resultDerivedFromReceiptMaterial,
            decoderNoopToRealReadinessContract: handoff.decoderNoopToRealReadiness.contract,
            decoderNoopToRealReadinessMode: handoff.decoderNoopToRealReadiness.mode,
            decoderNoopToRealReadinessStatus: handoff.decoderNoopToRealReadiness.status,
            decoderNoopToRealReadinessDescriptorPresent: handoff.decoderNoopToRealReadiness.readinessDescriptorPresent,
            realDecoderAdapterRepresented: handoff.decoderNoopToRealReadiness.realDecoderAdapterRepresented,
            realDecoderAdapterInvoked: handoff.decoderNoopToRealReadiness.realDecoderAdapterInvoked,
            realDecoderAdapterInvocationAllowed: handoff.decoderNoopToRealReadiness.realDecoderAdapterInvocationAllowed,
            realDecoderAdapterInvocationAttempted: handoff.decoderNoopToRealReadiness.realDecoderAdapterInvocationAttempted,
            testOnlyEnablementRequired: handoff.decoderNoopToRealReadiness.testOnlyEnablementRequired,
            testOnlyEnablementPresent: handoff.decoderNoopToRealReadiness.testOnlyEnablementPresent,
            productionEnablementPresent: handoff.decoderNoopToRealReadiness.productionEnablementPresent,
            decoderInputContractRequiredForRealReadiness: handoff.decoderNoopToRealReadiness.decoderInputContractRequired,
            decoderInputContractPresentForRealReadiness: handoff.decoderNoopToRealReadiness.decoderInputContractPresent,
            noopResultContractRequiredForRealReadiness: handoff.decoderNoopToRealReadiness.noopResultContractRequired,
            noopResultContractPresentForRealReadiness: handoff.decoderNoopToRealReadiness.noopResultContractPresent,
            receiptMaterialStillRejectedForRealReadiness: handoff.decoderNoopToRealReadiness.receiptMaterialStillRejected,
            readinessFailures: handoff.decoderNoopToRealReadiness.readinessFailures,
            realDecoderAdapterGateContract: handoff.realDecoderAdapterGate.contract,
            realDecoderAdapterGateMode: handoff.realDecoderAdapterGate.mode,
            realDecoderAdapterGateStatus: handoff.realDecoderAdapterGate.status,
            realDecoderAdapterGateDescriptorPresent: handoff.realDecoderAdapterGate.gateDescriptorPresent,
            realDecoderAdapterGateProductionEnabled: handoff.realDecoderAdapterGate.productionEnabled,
            realDecoderAdapterGateProductionEnablementAccepted: handoff.realDecoderAdapterGate.productionEnablementAccepted,
            testOnlyGateRequired: handoff.realDecoderAdapterGate.testOnlyGateRequired,
            testOnlyGatePresent: handoff.realDecoderAdapterGate.testOnlyGatePresent,
            testOnlyGateSatisfied: handoff.realDecoderAdapterGate.testOnlyGateSatisfied,
            realDecoderAdapterGateAdapterRepresented: handoff.realDecoderAdapterGate.adapterRepresented,
            realDecoderAdapterGateInvocationAllowed: handoff.realDecoderAdapterGate.adapterInvocationAllowed,
            realDecoderAdapterGateInvocationAttempted: handoff.realDecoderAdapterGate.adapterInvocationAttempted,
            realDecoderAdapterGateAdapterInvoked: handoff.realDecoderAdapterGate.adapterInvoked,
            realDecoderAdapterGateReceiptMaterialAccepted: handoff.realDecoderAdapterGate.receiptMaterialAccepted,
            realDecoderAdapterGateRuntimeDecoderInputObjectBuilt: handoff.realDecoderAdapterGate.runtimeDecoderInputObjectBuilt,
            realDecoderAdapterGateActualDecoderInputObjectBuilt: handoff.realDecoderAdapterGate.actualDecoderInputObjectBuilt,
            realDecoderAdapterGateDecodedReceiptProduced: handoff.realDecoderAdapterGate.decodedReceiptProduced,
            realDecoderAdapterGateDecodedReceiptVerified: handoff.realDecoderAdapterGate.decodedReceiptVerified,
            realDecoderAdapterGateDecoderResultProduced: handoff.realDecoderAdapterGate.decoderResultProduced,
            realDecoderAdapterGateDecoderResultConsumedByReleaseDecision: handoff.realDecoderAdapterGate.decoderResultConsumedByReleaseDecision,
            realDecoderAdapterGateReleaseDecisionMutatedByDecoderResult: handoff.realDecoderAdapterGate.releaseDecisionMutatedByDecoderResult,
            realDecoderAdapterGatePaymentResponseEmissionAllowed: handoff.realDecoderAdapterGate.paymentResponseEmissionAllowed,
            realDecoderAdapterGateCrpFulfillAllowed: handoff.realDecoderAdapterGate.crpFulfillAllowed,
            realDecoderAdapterGateReplayMutationAllowed: handoff.realDecoderAdapterGate.replayMutationAllowed,
            realDecoderAdapterGateCanonicalReleasePersistenceAllowed: handoff.realDecoderAdapterGate.canonicalReleasePersistenceAllowed,
            realDecoderAdapterGateProductionReleaseAllowed: handoff.realDecoderAdapterGate.productionReleaseAllowed,
            realDecoderAdapterGateFailures: handoff.realDecoderAdapterGate.gateFailures,
            realDecoderAdapterGateOpenContract: handoff.realDecoderAdapterGateOpenPreflight.contract,
            realDecoderAdapterGateOpenMode: handoff.realDecoderAdapterGateOpenPreflight.mode,
            realDecoderAdapterGateOpenStatus: handoff.realDecoderAdapterGateOpenPreflight.status,
            realDecoderAdapterGateOpenDescriptorPresent: handoff.realDecoderAdapterGateOpenPreflight.gateDescriptorPresent,
            realDecoderAdapterGateOpenFlagPresent: handoff.realDecoderAdapterGateOpenPreflight.testOnlyGateOpenFlagPresent,
            realDecoderAdapterGateOpenSatisfied: handoff.realDecoderAdapterGateOpenPreflight.testOnlyGateSatisfied,
            realDecoderAdapterGateOpenProductionEnabled: handoff.realDecoderAdapterGateOpenPreflight.productionEnabled,
            realDecoderAdapterGateOpenProductionEnablementAccepted: handoff.realDecoderAdapterGateOpenPreflight.productionEnablementAccepted,
            realDecoderAdapterGateOpenInvocationAllowed: handoff.realDecoderAdapterGateOpenPreflight.adapterInvocationAllowed,
            realDecoderAdapterGateOpenInvocationAttempted: handoff.realDecoderAdapterGateOpenPreflight.adapterInvocationAttempted,
            realDecoderAdapterGateOpenAdapterInvoked: handoff.realDecoderAdapterGateOpenPreflight.adapterInvoked,
            realDecoderAdapterGateOpenReceiptMaterialAccepted: handoff.realDecoderAdapterGateOpenPreflight.receiptMaterialAccepted,
            realDecoderAdapterGateOpenRuntimeDecoderInputObjectBuilt: handoff.realDecoderAdapterGateOpenPreflight.runtimeDecoderInputObjectBuilt,
            realDecoderAdapterGateOpenActualDecoderInputObjectBuilt: handoff.realDecoderAdapterGateOpenPreflight.actualDecoderInputObjectBuilt,
            realDecoderAdapterGateOpenDecodedReceiptProduced: handoff.realDecoderAdapterGateOpenPreflight.decodedReceiptProduced,
            realDecoderAdapterGateOpenDecodedReceiptVerified: handoff.realDecoderAdapterGateOpenPreflight.decodedReceiptVerified,
            realDecoderAdapterGateOpenDecoderResultProduced: handoff.realDecoderAdapterGateOpenPreflight.decoderResultProduced,
            realDecoderAdapterGateOpenDecoderResultConsumedByReleaseDecision: handoff.realDecoderAdapterGateOpenPreflight.decoderResultConsumedByReleaseDecision,
            realDecoderAdapterGateOpenReleaseDecisionMutatedByDecoderResult: handoff.realDecoderAdapterGateOpenPreflight.releaseDecisionMutatedByDecoderResult,
            realDecoderAdapterGateOpenPaymentResponseEmissionAllowed: handoff.realDecoderAdapterGateOpenPreflight.paymentResponseEmissionAllowed,
            realDecoderAdapterGateOpenCrpFulfillAllowed: handoff.realDecoderAdapterGateOpenPreflight.crpFulfillAllowed,
            realDecoderAdapterGateOpenReplayMutationAllowed: handoff.realDecoderAdapterGateOpenPreflight.replayMutationAllowed,
            realDecoderAdapterGateOpenCanonicalReleasePersistenceAllowed: handoff.realDecoderAdapterGateOpenPreflight.canonicalReleasePersistenceAllowed,
            realDecoderAdapterGateOpenProductionReleaseAllowed: handoff.realDecoderAdapterGateOpenPreflight.productionReleaseAllowed,
            realDecoderAdapterGateOpenFailures: handoff.realDecoderAdapterGateOpenPreflight.gateFailures,
            realDecoderAdapterDryRunInvocationContract: handoff.realDecoderAdapterDryRunInvocationPreflight.contract,
            realDecoderAdapterDryRunInvocationMode: handoff.realDecoderAdapterDryRunInvocationPreflight.mode,
            realDecoderAdapterDryRunInvocationStatus: handoff.realDecoderAdapterDryRunInvocationPreflight.status,
            realDecoderAdapterDryRunDescriptorPresent: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunDescriptorPresent,
            realDecoderAdapterDryRunGateOpenRequired: handoff.realDecoderAdapterDryRunInvocationPreflight.testOnlyGateOpenRequired,
            realDecoderAdapterDryRunGateOpenSatisfied: handoff.realDecoderAdapterDryRunInvocationPreflight.testOnlyGateOpenSatisfied,
            realDecoderAdapterDryRunFlagRequired: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationFlagRequired,
            realDecoderAdapterDryRunFlagPresent: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationFlagPresent,
            realDecoderAdapterDryRunInvocationAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationAllowed,
            realDecoderAdapterDryRunInvocationAttempted: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationAttempted,
            realDecoderAdapterDryRunInvocationObserved: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunInvocationObserved,
            realDecoderAdapterDryRunAdapterStubRepresented: handoff.realDecoderAdapterDryRunInvocationPreflight.adapterStubRepresented,
            realDecoderAdapterDryRunAdapterStubInvoked: handoff.realDecoderAdapterDryRunInvocationPreflight.adapterStubInvoked,
            realDecoderAdapterDryRunRealDecoderAdapterInvoked: handoff.realDecoderAdapterDryRunInvocationPreflight.realDecoderAdapterInvoked,
            realDecoderAdapterDryRunRealDecoderInvoked: handoff.realDecoderAdapterDryRunInvocationPreflight.realDecoderInvoked,
            realDecoderAdapterDryRunReceiptMaterialAccepted: handoff.realDecoderAdapterDryRunInvocationPreflight.receiptMaterialAccepted,
            realDecoderAdapterDryRunRuntimeDecoderInputObjectBuilt: handoff.realDecoderAdapterDryRunInvocationPreflight.runtimeDecoderInputObjectBuilt,
            realDecoderAdapterDryRunActualDecoderInputObjectBuilt: handoff.realDecoderAdapterDryRunInvocationPreflight.actualDecoderInputObjectBuilt,
            realDecoderAdapterDryRunDecodedReceiptProduced: handoff.realDecoderAdapterDryRunInvocationPreflight.decodedReceiptProduced,
            realDecoderAdapterDryRunDecodedReceiptVerified: handoff.realDecoderAdapterDryRunInvocationPreflight.decodedReceiptVerified,
            realDecoderAdapterDryRunDecoderResultProduced: handoff.realDecoderAdapterDryRunInvocationPreflight.decoderResultProduced,
            realDecoderAdapterDryRunDecoderResultConsumedByReleaseDecision: handoff.realDecoderAdapterDryRunInvocationPreflight.decoderResultConsumedByReleaseDecision,
            realDecoderAdapterDryRunReleaseDecisionMutatedByDecoderResult: handoff.realDecoderAdapterDryRunInvocationPreflight.releaseDecisionMutatedByDecoderResult,
            realDecoderAdapterDryRunPaymentResponseEmissionAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.paymentResponseEmissionAllowed,
            realDecoderAdapterDryRunCrpFulfillAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.crpFulfillAllowed,
            realDecoderAdapterDryRunReplayMutationAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.replayMutationAllowed,
            realDecoderAdapterDryRunCanonicalReleasePersistenceAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.canonicalReleasePersistenceAllowed,
            realDecoderAdapterDryRunProductionReleaseAllowed: handoff.realDecoderAdapterDryRunInvocationPreflight.productionReleaseAllowed,
            realDecoderAdapterDryRunFailures: handoff.realDecoderAdapterDryRunInvocationPreflight.dryRunFailures,
          receiptJwsPresent: handoff.receipt.receiptJwsPresent,
          receiptJwsSha12: handoff.receipt.receiptJwsSha12,
          receiptJwsLength: handoff.receipt.receiptJwsLength,
          receiptJwsRawPrinted: false,
          receiptSubmittedToGateway: handoff.receipt.receiptSubmittedToGateway,
          receiptPayloadPresent: handoff.receipt.receiptPayloadPresent,
          receiptPayloadDecoded: handoff.receipt.receiptPayloadDecoded,
          receiptDecodeInvoked: handoff.receipt.receiptDecodeInvoked,
          receiptVerified: handoff.receipt.receiptVerified,
          receiptDecodeReadinessContract: handoff.decodeReadiness.contract,
          receiptDecodeReadinessStatus: handoff.decodeReadiness.status,
          receiptDecodeReady: handoff.decodeReadiness.ready,
          receiptDecodeReadinessValidationOk: handoff.decodeReadiness.validationOk,
          futureDecoderInputRequired: handoff.decodeReadiness.futureDecoderInputRequired,
          receiptDecodeMetadataOnly: handoff.decodeReadiness.metadataOnly,
          decoderInputContract: handoff.decoderInputContract.contract,
          decoderInputContractStatus: handoff.decoderInputContract.status,
          decoderInputContractMode: handoff.decoderInputContract.mode,
          decoderInputContractMetadataOnly: handoff.decoderInputContract.metadataOnly,
          decoderInputContractSourceBoundaryValidationOk: handoff.decoderInputContract.sourceBoundaryValidationOk,
          decoderInputContractSourceBoundaryReady: handoff.decoderInputContract.sourceBoundaryReady,
          decoderInputObjectBuilt: handoff.decodeReadiness.decoderInputObjectBuilt,
          runtimeDecoderInputObjectBuilt: handoff.decoderInputContract.runtimeDecoderInputObjectBuilt,
          actualDecoderInputObjectBuilt: handoff.decoderInputContract.actualDecoderInputObjectBuilt,
          decoderInvocationAllowed: handoff.decoderInputContract.decoderInvocationAllowed,
          decoderInvocationObserved: handoff.decoderInputContract.decoderInvocationObserved,
          decoderInvoked: handoff.decoderInputContract.decoderInvoked,
          decoderInvocationEnabled: handoff.decoderInvocationGuard.invocationEnabled,
          decoderInvocationAttempted: handoff.decoderInvocationGuard.invocationAttempted,
          decoderInvocationObservedByGuard: handoff.decoderInvocationGuard.invocationObserved,
          noopDecoderResultProduced: handoff.decoderInvocationGuard.noopResultProduced,
          decodedReceiptProduced: handoff.decoderInvocationGuard.decodedReceiptProduced,
          decodedReceiptVerified: handoff.decoderNoopResultContract.decodedReceiptVerified,
          decoderResultProduced: handoff.decoderNoopResultContract.resultProduced,
          decodedReceiptConsumed: handoff.decoderInvocationGuard.decodedReceiptConsumed,
          decoderResultConsumedByReleaseDecision: handoff.decoderInvocationGuard.decoderResultConsumedByReleaseDecision,
          releaseDecisionMutatedByDecoderResult: handoff.decoderInvocationGuard.releaseDecisionMutatedByDecoderResult,
          receiptJwsAcceptedForDecode: handoff.decodeReadiness.receiptJwsAccepted,
          receiptPayloadAcceptedForDecode: handoff.decodeReadiness.receiptPayloadAccepted,
          receiptBytesAcceptedForDecode: handoff.decodeReadiness.receiptBytesAccepted,
          receiptObjectAcceptedForDecode: handoff.decodeReadiness.receiptObjectAccepted,
          transactionHashAcceptedForDecode: handoff.decodeReadiness.transactionHashAccepted,
          receiptJwsIncludedInDecoderInputContract: handoff.decoderInputContract.receiptJwsIncluded,
          receiptPayloadIncludedInDecoderInputContract: handoff.decoderInputContract.receiptPayloadIncluded,
          receiptBytesIncludedInDecoderInputContract: handoff.decoderInputContract.receiptBytesIncluded,
          receiptObjectIncludedInDecoderInputContract: handoff.decoderInputContract.receiptObjectIncluded,
          transactionHashIncludedInDecoderInputContract: handoff.decoderInputContract.receiptTransactionHashIncluded,
          settlementFieldsIncludedInDecoderInputContract: handoff.decoderInputContract.settlementFieldsIncluded,
          replayKeyIncludedInDecoderInputContract: handoff.decoderInputContract.replayKeyIncluded,
          rawReceiptIncludedInDecoderInputContract: handoff.decoderInputContract.rawReceiptIncluded,
          rawProofIncludedInDecoderInputContract: handoff.decoderInputContract.rawProofIncluded,
          receiptJwsPassedToDecoder: handoff.decoderInvocationGuard.receiptJwsPassedToDecoder,
          receiptPayloadPassedToDecoder: handoff.decoderInvocationGuard.receiptPayloadPassedToDecoder,
          receiptBytesPassedToDecoder: handoff.decoderInvocationGuard.receiptBytesPassedToDecoder,
          receiptObjectPassedToDecoder: handoff.decoderInvocationGuard.receiptObjectPassedToDecoder,
          transactionHashPassedToDecoder: handoff.decoderInvocationGuard.transactionHashPassedToDecoder,
          settlementFieldsPassedToDecoder: handoff.decoderInvocationGuard.settlementFieldsPassedToDecoder,
          replayKeyPassedToDecoder: handoff.decoderInvocationGuard.replayKeyPassedToDecoder,
          rawReceiptPassedToDecoder: handoff.decoderInvocationGuard.rawReceiptPassedToDecoder,
          rawProofPassedToDecoder: handoff.decoderInvocationGuard.rawProofPassedToDecoder,
            receiptJwsUsedByNoopResultContract: handoff.decoderNoopResultContract.receiptJwsUsed,
            receiptPayloadUsedByNoopResultContract: handoff.decoderNoopResultContract.receiptPayloadUsed,
            receiptBytesUsedByNoopResultContract: handoff.decoderNoopResultContract.receiptBytesUsed,
            receiptObjectUsedByNoopResultContract: handoff.decoderNoopResultContract.receiptObjectUsed,
            transactionHashUsedByNoopResultContract: handoff.decoderNoopResultContract.transactionHashUsed,
            settlementFieldsUsedByNoopResultContract: handoff.decoderNoopResultContract.settlementFieldsUsed,
            replayKeyUsedByNoopResultContract: handoff.decoderNoopResultContract.replayKeyUsed,
            rawReceiptUsedByNoopResultContract: handoff.decoderNoopResultContract.rawReceiptUsed,
            rawProofUsedByNoopResultContract: handoff.decoderNoopResultContract.rawProofUsed,
          receiptProofVersion: handoff.receipt.proofVersion,
          receiptSettlementStatus: handoff.receipt.settlementStatus,
          receiptMaterialSanitized: handoff.safety.sanitized,
          receiptContextBuiltFromPaymentRequired: true,
          receiptContextNonceMatched: handoff.binding.nonceMatched,
          receiptContextResourceMatched: handoff.binding.resourceMatched,
          receiptContextContractMatched: handoff.binding.contractMatched,
          receiptContextMerchantMatched: handoff.binding.merchantMatched,
          receiptContextPaymentTupleMatched: handoff.binding.paymentTupleMatched,
          handoffContract: handoff.contract,
          handoffStatus: handoff.status,
          handoffAccepted: handoff.safety.handoffAccepted,
          decisionPreflightOnly: handoff.safety.preflightOnly,
          receiptDecodeReadinessPreflightOnly: true,
          decoderInputContractPreflightOnly: true,
          decoderNoopResultContractPreflightOnly: true,
          actualGatewayStillReturns402: blocked.status === 402,
          actualGatewayPaymentResponseEmitted: blocked.headers.get("payment-response") !== null,
          resourceReleased: handoff.safety.resourceReleased,
          paymentReleaseAttempted: handoff.safety.paymentReleaseAttempted,
          paymentResponseEmitted: handoff.safety.paymentResponseEmitted,
          adapterInvoked: handoff.safety.adapterInvoked,
          externalCallAttempted: handoff.safety.externalCallAttempted,
          crpCalled: handoff.safety.crpCalled,
          crpFulfillCalled: handoff.safety.crpFulfillCalled,
          replayTouched: handoff.safety.replayTouched,
          canonicalReleasePersisted: handoff.safety.canonicalReleasePersisted,
          productionReleaseAuthorized: handoff.safety.productionReleaseAuthorized,
          productionRelease: handoff.safety.productionRelease,
          sideEffectFree: handoff.safety.sideEffectFree,
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

main().catch(async (err) => {
  console.error(`[${LABEL}] failed`, err);
  process.exitCode = 1;
});
