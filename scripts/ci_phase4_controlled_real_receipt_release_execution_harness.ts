#!/usr/bin/env node
/**
 * PR 4-10 — Phase 4 controlled real receipt release execution harness.
 *
 * This harness intentionally crosses from readiness into execution:
 * - mock CRP fulfill is called for first use
 * - receipt JWS is handed off, decoded, signature-verified, settlement-verified,
 *   tuple-bound, and composed into release eligibility
 * - release decision readiness is consumed
 * - replay is mutated for first use
 * - canonical release is persisted
 * - PAYMENT-RESPONSE is emitted
 * - protected resource is released
 * - second use is terminally blocked without another CRP fulfill, PAYMENT-RESPONSE, or resource release
 */

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import process from "node:process";

import {
  baseUrlForPort,
  installSignalCleanup,
  issuePaidGatedChallenge,
  isPortOpen,
  killProcessTree,
  redeemEligiblePolicy,
  request,
  startGateway,
  waitForPortClosed,
  waitForReady,
} from "./phase3GatewayHarnessUtils";

const LABEL = "phase4:controlled-real-receipt-release-execution-harness-test";
const GATEWAY_PORT = Number(process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_PORT || 3131);
const CRP_PORT = Number(process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_CRP_PORT || 8131);
const RECEIPT_KID = "phase4-test-only";
const RECEIPT_VERSION = "phase4.synthetic.controlled-release-execution.v1";

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
}

async function syntheticReceiptJws(body: any, privateKey: any): Promise<string> {
  const { SignJWT } = await import("jose");

  return await new SignJWT({
    iss: "phase4-test-crp",
    aud: "payfi-gateway-demo",
    sub: "phase4-controlled-real-receipt-release-execution",
    receiptVersion: RECEIPT_VERSION,
    merchantId: body?.merchantId,
    nonce: body?.nonce,
    network: body?.network,
    payTo: body?.payTo,
    amount: body?.amount,
    asset: body?.asset,
    settlement: {
      status: "finalized",
      txHash: "phase4-synthetic-release-execution-tx-hash",
    },
    testOnly: true,
    releaseConsumable: true,
  })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "JWT",
      kid: RECEIPT_KID,
    })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

type MockCrpRequest = {
  path: string;
  body: any;
  receiptJws: string;
};

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
  });
  res.end(JSON.stringify(body));
}

async function startMockCrp(port: number, signer: { privateKey: any; jwks: any }) {
  const requests: MockCrpRequest[] = [];

  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

    if (req.method === "GET" && path === "/.well-known/jwks.json") {
      writeJson(res, 200, signer.jwks);
      return;
    }

    if (req.method !== "POST" || path !== "/v1/crp/payments/fulfill") {
      writeJson(res, 404, { ok: false, reason: "not_found" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const receiptJws = await syntheticReceiptJws(body, signer.privateKey);

      requests.push({ path, body, receiptJws });

      writeJson(res, 200, {
        ok: true,
        status: "fulfilled",
        match: {
          status: "fulfilled",
          receipt: {
            jws: receiptJws,
          },
        },
      });
    } catch (err: any) {
      writeJson(res, 400, {
        ok: false,
        reason: "invalid_json",
        error: String(err?.message ?? err),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function decodePaymentResponseHeader(payloadB64: string | null, pr: any, receiptJws: string) {
  assert.ok(payloadB64, "PAYMENT-RESPONSE header must be present");

  const decoded = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));

  assert.equal(decoded.version, "x402-v2");
  assert.equal(decoded.contractId, pr.contractId);
  assert.equal(decoded.contractVersion, pr.contractVersion);
  assert.equal(decoded.merchantId, pr.merchantId);
  assert.equal(decoded.nonce, pr.nonce);
  assert.equal(decoded.settled, true);
  assert.equal(decoded.resource?.method, "GET");
  assert.equal(decoded.resource?.path, "/paid-gated");
  assert.equal(decoded.receipt?.jws, receiptJws);
  assert.equal(decoded.receipt?.payload?.receiptVersion, RECEIPT_VERSION);
  assert.equal(decoded.receipt?.payload?.nonce, pr.nonce);
  assert.equal(decoded.receipt?.payload?.settlement?.status, "finalized");
  assert.equal(decoded.receipt?.payload?.settlement?.txHash, "phase4-synthetic-release-execution-tx-hash");
  assert.equal(decoded.receipt?.payload?.testOnly, true);
  assert.equal(decoded.receipt?.payload?.releaseConsumable, true);

  return decoded;
}

async function releaseAttempt(baseUrl: string, nonce: string) {
  return await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(nonce)}`, {
    headers: {
      "PAYMENT-SIGNATURE": paymentSignatureB64(nonce),
    },
  });
}

async function main() {
  const baseUrl = baseUrlForPort(GATEWAY_PORT);

  console.log(`[${LABEL}] BASE=${baseUrl}`);

  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`gateway port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  if (await isPortOpen(CRP_PORT)) {
    throw new Error(`mock CRP port ${CRP_PORT} is already open. Stop the existing service and retry.`);
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const { exportJWK } = await import("jose");
  const publicJwk = await exportJWK(publicKey);
  const jwks = {
    keys: [
      {
        ...publicJwk,
        kid: RECEIPT_KID,
        alg: "EdDSA",
        use: "sig",
      },
    ],
  };

  const mockCrp = await startMockCrp(CRP_PORT, { privateKey, jwks });

  const previous = {
    PHASE3_GATEWAY_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_RELEASE_ENABLED,
    PHASE3_GATEWAY_TEST_RELEASE_ONLY: process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY,
    PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED: process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED,
    PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED:
      process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED,

    PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS:
      process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS,
    PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED:
      process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED,
    PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS,
    PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED,
    PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED,
    PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_HARNESS:
      process.env.PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_HARNESS,
    PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED:
      process.env.PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED,
    PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS:
      process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS,
    PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED:
      process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED,

    CRP_BASE_URL: process.env.CRP_BASE_URL,
    CRP_JWKS_URL: process.env.CRP_JWKS_URL,
    X402_EXPECTED_KID: process.env.X402_EXPECTED_KID,
    X402_DEBUG: process.env.X402_DEBUG,
  };

  process.env.PHASE3_GATEWAY_RELEASE_ENABLED = "false";
  process.env.PHASE3_GATEWAY_TEST_RELEASE_ONLY = "false";
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED = "false";
  process.env.PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED = "false";

  process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_HARNESS = "true";
  process.env.PHASE4_REAL_CRP_FULFILL_INVOCATION_BOUNDARY_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_HANDOFF_CONTRACT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_DECODE_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_SETTLEMENT_VERIFICATION_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_TUPLE_BINDING_VERIFICATION_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_RELEASE_ELIGIBILITY_COMPOSITION_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_REPLAY_CANONICAL_PERSISTENCE_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_HARNESS = "true";
  process.env.PHASE4_REAL_RECEIPT_RELEASE_DECISION_PREFLIGHT_ENABLED = "true";
  process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_HARNESS = "true";
  process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_ENABLED = "true";

  process.env.CRP_BASE_URL = mockCrp.baseUrl;
  process.env.CRP_JWKS_URL = `${mockCrp.baseUrl}/.well-known/jwks.json`;
  process.env.X402_EXPECTED_KID = RECEIPT_KID;
  process.env.X402_DEBUG = "true";

  const gateway = startGateway({
    port: GATEWAY_PORT,
    label: LABEL,
  });

  const cleanup = async () => {
    restoreEnv(previous);
    await killProcessTree(gateway);
    await waitForPortClosed(GATEWAY_PORT);
    await mockCrp.close();
    await waitForPortClosed(CRP_PORT);
  };

  installSignalCleanup(cleanup);

  try {
    const health = await waitForReady(baseUrl);

    assert.equal(health.phase3?.gatewayPolicyGateEnabled, true);
    assert.equal(health.phase3?.gatewayReleaseEnabled, false);
    assert.equal(health.phase3?.gatewayTestReleaseOnly, false);
    assert.equal(health.phase3?.gatewayProductionReleaseEnabled, false);

    assert.equal(health.phase4?.controlledRealReceiptReleaseExecutionHarness, true);
    assert.equal(health.phase4?.controlledRealReceiptReleaseExecutionEnabled, true);

    const pr = await issuePaidGatedChallenge(baseUrl);

    const redeem = await redeemEligiblePolicy(baseUrl, pr);
    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const release = await releaseAttempt(baseUrl, pr.nonce);

    assert.equal(release.status, 200, `first use must release resource: ${release.text}`);
    assert.equal(release.headers.get("payment-required"), null, "first use must not emit PAYMENT-REQUIRED");
    assert.ok(release.headers.get("payment-response"), "first use must emit PAYMENT-RESPONSE");
    assert.equal(release.json?.ok, true);
    assert.equal(release.json?.paid, true);
    assert.equal(release.json?.nonce, pr.nonce);
    assert.equal(release.json?.resource, "secret-data");

    const fulfillRequestsAfterRelease = mockCrp.requests.filter(
      (entry) => entry.path === "/v1/crp/payments/fulfill",
    );
    assert.equal(fulfillRequestsAfterRelease.length, 1, "first use should call mock CRP fulfill once");

    const paymentResponseHeader = release.headers.get("payment-response");
    const decodedPaymentResponse = decodePaymentResponseHeader(
      paymentResponseHeader,
      pr,
      fulfillRequestsAfterRelease[0]!.receiptJws,
    );

    const execution = release.json?.phase4?.controlledRealReceiptReleaseExecution;
    assert.equal(execution?.contract, "phase4.controlledRealReceiptReleaseExecutionHarness.v1");
    assert.equal(execution?.required, true);
    assert.equal(execution?.observed, true);
    assert.equal(execution?.enabled, true);
    assert.equal(execution?.status, "released");
    assert.equal(execution?.releaseDecisionPreflightObserved, true);
    assert.equal(execution?.releaseDecisionPreflightStatus, "ready");
    assert.equal(execution?.prerequisites?.releaseEligible, true);
    assert.equal(execution?.prerequisites?.releaseDecisionReady, true);
    assert.equal(execution?.prerequisites?.replayMutationReady, true);
    assert.equal(execution?.prerequisites?.canonicalReleasePersistenceReady, true);
    assert.equal(execution?.prerequisites?.allReady, true);
    assert.equal(execution?.receipt?.jwsPresent, true);
    assert.equal(execution?.receipt?.jwsShapeValid, true);
    assert.equal(execution?.receipt?.verifiedPayloadPresent, true);
    assert.equal(execution?.replay?.checkEvaluated, true);
    assert.equal(execution?.replay?.mutationReady, true);
    assert.equal(execution?.replay?.mutationAllowed, true);
    assert.equal(execution?.replay?.touched, true);
    assert.equal(execution?.replay?.tupleKeyPresent, true);
    assert.equal(execution?.canonicalReleasePersistence?.evaluated, true);
    assert.equal(execution?.canonicalReleasePersistence?.ready, true);
    assert.equal(execution?.canonicalReleasePersistence?.persistenceAllowed, true);
    assert.equal(execution?.canonicalReleasePersistence?.persisted, true);
    assert.equal(execution?.decision?.evaluated, true);
    assert.equal(execution?.decision?.ready, true);
    assert.equal(execution?.decision?.mutationAllowed, true);
    assert.equal(execution?.decision?.mutated, true);
    assert.equal(execution?.errorCode, null);
    assert.equal(execution?.receiptJwsRawPrinted, false);
    assert.equal(execution?.receiptJwsPrinted, false);
    assert.equal(execution?.verifiedPayloadRawPrinted, false);
    assert.equal(execution?.releaseDecisionRawPrinted, false);
    assert.equal(execution?.replayRawPrinted, false);
    assert.equal(execution?.canonicalPersistenceRawPrinted, false);
    assert.equal(execution?.signatureVerified, true);
    assert.equal(execution?.jwksVerified, true);
    assert.equal(execution?.settlementVerified, true);
    assert.equal(execution?.finalizedSettlementVerified, true);
    assert.equal(execution?.tupleBindingVerified, true);
    assert.equal(execution?.releaseEligible, true);
    assert.equal(execution?.releaseDecisionReady, true);
    assert.equal(execution?.releaseConsumable, true);
    assert.equal(execution?.releaseDecisionMutated, true);
    assert.equal(execution?.productionRelease, false);
    assert.equal(execution?.productionReleaseAuthorizationEvaluated, false);
    assert.equal(execution?.productionReleaseAuthorized, false);
    assert.equal(execution?.paymentResponseEmitted, true);
    assert.equal(execution?.resourceReleased, true);
    assert.equal(execution?.replayTouched, true);
    assert.equal(execution?.canonicalReleasePersisted, true);
    assert.equal(execution?.sideEffectFreeExceptCrpFulfillCall, false);

    const replay = await releaseAttempt(baseUrl, pr.nonce);

    console.log(
      `[${LABEL}] second-use response diagnostics: ${JSON.stringify(
        {
          status: replay.status,
          text: replay.text,
          json: replay.json,
          paymentResponseEmitted: replay.headers.get("payment-response") !== null,
          resourceReleased: replay.json?.resource === "secret-data",
          crpFulfillCallsAfterRelease: fulfillRequestsAfterRelease.length,
          crpFulfillCallsAfterReplay: mockCrp.requests.filter(
            (entry) => entry.path === "/v1/crp/payments/fulfill",
          ).length,
        },
        null,
        2,
      )}`,
    );

    assert.equal(replay.status, 402, `second use must be blocked: ${replay.text}`);
    assert.equal(
      replay.json?.debug?.challengeStatus,
      "RELEASED",
      "second use should observe terminal released challenge state",
    );
    assert.equal(
      replay.json?.debug?.releaseStatus,
      "RELEASED",
      "second use should observe terminal released release state",
    );
    assert.equal(replay.headers.get("payment-response"), null, "second use must not emit PAYMENT-RESPONSE");
    assert.notEqual(replay.json?.resource, "secret-data", "second use must not release protected resource");
    assert.notEqual(replay.json?.paid, true, "second use must not report paid=true");

    const fulfillRequestsAfterReplay = mockCrp.requests.filter(
      (entry) => entry.path === "/v1/crp/payments/fulfill",
    );
    assert.equal(
      fulfillRequestsAfterReplay.length,
      fulfillRequestsAfterRelease.length,
      "second use must not perform an additional mock CRP fulfill after first release",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          label: LABEL,

          gatewayPolicyGateEnabled: health.phase3.gatewayPolicyGateEnabled,
          gatewayReleaseEnabled: health.phase3.gatewayReleaseEnabled,
          gatewayTestReleaseOnly: health.phase3.gatewayTestReleaseOnly,
          gatewayProductionReleaseEnabled: health.phase3.gatewayProductionReleaseEnabled,

          controlledExecutionHarness: health.phase4.controlledRealReceiptReleaseExecutionHarness,
          controlledExecutionEnabled: health.phase4.controlledRealReceiptReleaseExecutionEnabled,

          eligiblePolicyRedeemed: redeem.json?.policyStatus === "POLICY_SATISFIED",

          firstUseStatus: release.status,
          firstUsePaymentResponseEmitted: paymentResponseHeader !== null,
          firstUsePaymentResponseHeaderValidated:
            decodedPaymentResponse?.receipt?.payload?.receiptVersion === RECEIPT_VERSION,
          firstUseResourceReleased: release.json?.resource === "secret-data",

          executionStatus: execution?.status,
          releaseDecisionReady: execution?.releaseDecisionReady === true,
          releaseDecisionMutated: execution?.releaseDecisionMutated === true,
          replayTouched: execution?.replayTouched === true,
          canonicalReleasePersisted: execution?.canonicalReleasePersisted === true,
          paymentResponseEmitted: execution?.paymentResponseEmitted === true,
          resourceReleased: execution?.resourceReleased === true,

          secondUseStatus: replay.status,
          secondUseBlocked: replay.status === 402,
          secondUseBlockReason: replay.json?.debug?.reason ?? replay.json?.error ?? null,
          secondUseChallengeStatus: replay.json?.debug?.challengeStatus ?? null,
          secondUseReleaseStatus: replay.json?.debug?.releaseStatus ?? null,
          secondUsePaymentResponseEmitted: replay.headers.get("payment-response") !== null,
          secondUseResourceReleased: replay.json?.resource === "secret-data",

          crpFulfillCalls: fulfillRequestsAfterReplay.length,

          rawReceiptPrinted: false,
          rawProofPrinted: false,
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
  console.error(`[${LABEL}] failed:`, err);
  process.exit(1);
});
