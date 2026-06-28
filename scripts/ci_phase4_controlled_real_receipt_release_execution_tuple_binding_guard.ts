#!/usr/bin/env node
/**
 * PR 4-13 — Phase 4 controlled real receipt release execution tuple-binding guard.
 *
 * This harness proves controlled execution fails closed when receipt trust and
 * settlement are valid, but the verified receipt does not bind exactly to the
 * issued payment requirement:
 * - mock CRP fulfill is called once
 * - receipt JWS is present, decoded, and signature/JWKS-verified
 * - settlement is finalized and release-consumable
 * - receipt amount intentionally mismatches the payment requirement amount
 * - tuple binding does not verify
 * - release decision, replay, and canonical persistence do not become ready
 * - PAYMENT-RESPONSE is not emitted
 * - protected resource is not released
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

const LABEL = "phase4:controlled-real-receipt-release-execution-tuple-binding-guard-test";
const GATEWAY_PORT = Number(process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_TUPLE_BINDING_GUARD_PORT || 3134);
const CRP_PORT = Number(process.env.PHASE4_CONTROLLED_REAL_RECEIPT_RELEASE_EXECUTION_TUPLE_BINDING_GUARD_CRP_PORT || 8134);
const EXPECTED_RECEIPT_KID = "phase4-test-only";
const RECEIPT_KID = EXPECTED_RECEIPT_KID;
const RECEIPT_AMOUNT = "0.050102";
const RECEIPT_VERSION = "phase4.synthetic.controlled-release-execution-tuple-binding-guard.v1";

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
}

async function syntheticReceiptJws(body: any, privateKey: any): Promise<string> {
  const { SignJWT } = await import("jose");

  return await new SignJWT({
    iss: "phase4-test-crp",
    aud: "payfi-gateway-demo",
    sub: "phase4-controlled-real-receipt-release-execution-tuple-binding-guard",
    receiptVersion: RECEIPT_VERSION,
    merchantId: body?.merchantId,
    nonce: body?.nonce,
    network: body?.network,
    payTo: body?.payTo,
    amount: RECEIPT_AMOUNT,
    asset: body?.asset,
    settlement: {
      status: "finalized",
      txHash: "phase4-synthetic-tuple-binding-guard-tx-hash",
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
        kid: EXPECTED_RECEIPT_KID,
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
  process.env.X402_EXPECTED_KID = EXPECTED_RECEIPT_KID;
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

    const fulfillRequests = mockCrp.requests.filter(
      (entry) => entry.path === "/v1/crp/payments/fulfill",
    );

    const boundary = release.json?.phase4?.realCrpFulfillInvocationBoundary;
    const handoff = boundary?.realReceiptJwsHandoffContract;
    const decodePreflight = boundary?.realReceiptJwsDecodePreflight;
    const signaturePreflight = boundary?.realReceiptJwsSignatureVerificationPreflight;
    const settlementPreflight = boundary?.realReceiptSettlementVerificationPreflight;
    const tuplePreflight = boundary?.realReceiptTupleBindingVerificationPreflight;
    const releaseDecisionPreflight = boundary?.realReceiptReleaseDecisionPreflight;
    const execution = boundary?.controlledRealReceiptReleaseExecution;

    console.log(
      `[${LABEL}] tuple-binding-guard response diagnostics: ${JSON.stringify(
        {
          status: release.status,
          text: release.text,
          json: release.json,
          paymentResponseEmitted: release.headers.get("payment-response") !== null,
          resourceReleased: release.json?.resource === "secret-data",
          crpFulfillCalls: fulfillRequests.length,
          execution,
        },
        null,
        2,
      )}`,
    );

    assert.equal(release.status, 402, `tuple-binding guard receipt must not release resource: ${release.text}`);
    assert.equal(release.headers.get("payment-response"), null, "tuple-binding guard receipt must not emit PAYMENT-RESPONSE");
    assert.notEqual(release.json?.resource, "secret-data", "tuple-binding guard receipt must not release protected resource");
    assert.notEqual(release.json?.paid, true, "tuple-binding guard receipt must not report paid=true");

    assert.equal(fulfillRequests.length, 1, "tuple-binding guard should call mock CRP fulfill once");
    assert.ok(fulfillRequests[0]?.receiptJws, "mock CRP should return a receipt JWS");

    assert.equal(boundary?.status, "called");
    assert.equal(boundary?.receipt?.jwsPresent, true);
    assert.equal(boundary?.receipt?.jwsShapeValid, true);

    assert.equal(handoff?.observed, true);
    assert.equal(handoff?.status, "observed");
    assert.equal(handoff?.receiptJwsPresent, true);
    assert.equal(handoff?.receiptJwsShapeValid, true);

    assert.equal(decodePreflight?.observed, true);
    assert.equal(decodePreflight?.status, "decoded");
    assert.equal(decodePreflight?.header?.kid, RECEIPT_KID);
    assert.equal(decodePreflight?.payload?.receiptVersion, RECEIPT_VERSION);
    assert.equal(decodePreflight?.payload?.releaseConsumable, true);

    assert.equal(signaturePreflight?.observed, true);
    assert.equal(signaturePreflight?.status, "verified");
    assert.equal(signaturePreflight?.signatureVerified, true);
    assert.equal(signaturePreflight?.verified, true);
    assert.equal(signaturePreflight?.jwksVerified, true);
    assert.equal(signaturePreflight?.errorCode, null);
    assert.equal(signaturePreflight?.header?.kid, RECEIPT_KID);
    assert.equal(settlementPreflight?.observed, true);
    assert.equal(settlementPreflight?.status, "verified");
    assert.equal(settlementPreflight?.settlementVerified, true);
    assert.equal(settlementPreflight?.finalizedSettlementVerified, true);

    assert.equal(tuplePreflight?.observed, false);
    assert.equal(tuplePreflight?.status, "mismatch");
    assert.equal(tuplePreflight?.errorCode, "tuple_binding_mismatch");
    assert.equal(tuplePreflight?.signatureVerified, true);
    assert.equal(tuplePreflight?.jwksVerified, true);
    assert.equal(tuplePreflight?.settlementVerified, true);
    assert.equal(tuplePreflight?.finalizedSettlementVerified, true);
    assert.equal(tuplePreflight?.tupleBindingVerified, false);
    assert.equal(tuplePreflight?.tuple?.amount?.expected, "0.050101");
    assert.equal(tuplePreflight?.tuple?.amount?.observed, RECEIPT_AMOUNT);
    assert.equal(tuplePreflight?.tuple?.amount?.matches, false);
    assert.equal(tuplePreflight?.tuple?.allFieldsPresent, true);
    assert.equal(tuplePreflight?.tuple?.exactMatch, false);

    assert.equal(releaseDecisionPreflight?.observed, false);
    assert.equal(releaseDecisionPreflight?.releaseDecisionReady, false);
    assert.equal(releaseDecisionPreflight?.decision?.mutated, false);

    assert.equal(execution?.contract, "phase4.controlledRealReceiptReleaseExecutionHarness.v1");
    assert.equal(execution?.required, true);
    assert.equal(execution?.enabled, true);
    assert.equal(execution?.status, "release_decision_preflight_not_observed");
    assert.equal(execution?.errorCode, "release_decision_preflight_not_observed");
    assert.equal(execution?.releaseDecisionPreflightObserved, false);
    assert.equal(execution?.prerequisites?.releaseDecisionReady, false);
    assert.equal(execution?.releaseDecisionReady, false);
    assert.equal(execution?.releaseConsumable, false);

    assert.equal(execution?.receipt?.jwsPresent, true);
    assert.equal(execution?.receipt?.jwsShapeValid, true);
    assert.equal(execution?.receipt?.verifiedPayloadPresent, true);

    assert.equal(execution?.signatureVerified, true);
    assert.equal(execution?.jwksVerified, true);
    assert.equal(execution?.settlementVerified, true);
    assert.equal(execution?.finalizedSettlementVerified, true);
    assert.equal(execution?.tupleBindingVerified, false);
    assert.equal(execution?.releaseEligible, false);

    assert.equal(execution?.decision?.mutated, false);
    assert.equal(execution?.releaseDecisionMutated, false);
    assert.equal(execution?.paymentResponseEmitted, false);
    assert.equal(execution?.resourceReleased, false);
    assert.equal(execution?.replayTouched, false);
    assert.equal(execution?.canonicalReleasePersisted, false);
    assert.equal(execution?.canonicalReleasePersistence?.persisted, false);

    assert.equal(execution?.receiptJwsRawPrinted, false);
    assert.equal(execution?.receiptJwsPrinted, false);
    assert.equal(execution?.verifiedPayloadRawPrinted, false);
    assert.equal(execution?.releaseDecisionRawPrinted, false);
    assert.equal(execution?.replayRawPrinted, false);
    assert.equal(execution?.canonicalPersistenceRawPrinted, false);
    assert.equal(execution?.productionRelease, false);
    assert.equal(execution?.productionReleaseAuthorizationEvaluated, false);
    assert.equal(execution?.productionReleaseAuthorized, false);
    assert.equal(execution?.sideEffectFreeExceptCrpFulfillCall, true);

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

          crpFulfillCalls: fulfillRequests.length,
          receiptJwsPresent: true,
          receiptKid: RECEIPT_KID,
          receiptAmount: RECEIPT_AMOUNT,
          expectedAmount: "0.050101",
          signaturePreflightStatus: signaturePreflight?.status,
          signatureVerified: signaturePreflight?.signatureVerified === true,
          settlementStatus: settlementPreflight?.status,
          settlementVerified: settlementPreflight?.settlementVerified === true,
          tupleBindingStatus: tuplePreflight?.status,
          tupleBindingVerified: tuplePreflight?.tupleBindingVerified === true,
          amountTupleMatches: tuplePreflight?.tuple?.amount?.matches === true,
          receiptReleaseConsumable: true,

          releaseAttemptStatus: release.status,
          tupleBindingGuardBlocked: release.status === 402,
          decodeStatus: decodePreflight?.status,
          decodedKid: decodePreflight?.header?.kid,
          observedAmount: tuplePreflight?.tuple?.amount?.observed,
          settlementErrorCode: settlementPreflight?.errorCode,
          releaseDecisionPreflightStatus: releaseDecisionPreflight?.status,
          executionStatus: execution?.status,
          executionErrorCode: execution?.errorCode,
          releaseDecisionReady: execution?.releaseDecisionReady === true,
          releaseDecisionMutated: execution?.releaseDecisionMutated === true,
          replayTouched: execution?.replayTouched === true,
          canonicalReleasePersisted: execution?.canonicalReleasePersisted === true,
          paymentResponseEmitted: release.headers.get("payment-response") !== null,
          resourceReleased: release.json?.resource === "secret-data",

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
