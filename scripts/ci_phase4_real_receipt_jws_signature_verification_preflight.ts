#!/usr/bin/env node
/**
 * PR 4-4 — Phase 4 real receipt JWS signature verification preflight.
 *
 * Receipt JWS signature verification preflight checkpoint.
 *
 * This validates the Phase 4 receipt JWS signature verification preflight on top of the decode preflight:
 * - boundary is harness-gated
 * - policy must be satisfied first
 * - response remains 402
 * - PAYMENT-RESPONSE is not emitted
 * - protected resource is not released
 * - CRP fulfill may be called or may fail closed as unavailable
 * - no raw receipt/proof material is printed
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

const LABEL = "phase4:real-receipt-jws-signature-verification-preflight-test";
const GATEWAY_PORT = Number(process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_PORT || 3125);
const CRP_PORT = Number(process.env.PHASE4_REAL_RECEIPT_JWS_SIGNATURE_VERIFICATION_PREFLIGHT_CRP_PORT || 8125);
const RECEIPT_KID = "phase4-test-only";

function paymentSignatureB64(nonce: string): string {
  return Buffer.from(JSON.stringify({ nonce }), "utf8").toString("base64");
}

async function syntheticReceiptJws(body: any, privateKey: any): Promise<string> {
  const { SignJWT } = await import("jose");

  return await new SignJWT({
    iss: "phase4-test-crp",
    aud: "payfi-gateway-demo",
    sub: "phase4-real-receipt-jws-signature-verification-preflight",
    receiptVersion: "phase4.synthetic.signature-verification-preflight.v1",
    merchantId: body?.merchantId,
    nonce: body?.nonce,
    network: body?.network,
    payTo: body?.payTo,
    amount: body?.amount,
    asset: body?.asset,
    settlement: {
      status: "finalized",
      txHash: "phase4-synthetic-tx-hash",
    },
    testOnly: true,
    releaseConsumable: false,
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
      requests.push({ path, body });

      writeJson(res, 200, {
        ok: true,
        status: "fulfilled",
        match: {
          status: "fulfilled",
          receipt: {
            jws: await syntheticReceiptJws(body, signer.privateKey),
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
    assert.equal(health.phase4?.realCrpFulfillInvocationBoundaryHarness, true);
    assert.equal(health.phase4?.realCrpFulfillInvocationBoundaryEnabled, true);
    assert.equal(health.phase4?.realReceiptJwsHandoffContractHarness, true);
    assert.equal(health.phase4?.realReceiptJwsHandoffContractEnabled, true);
    assert.equal(health.phase4?.realReceiptJwsDecodePreflightHarness, true);
    assert.equal(health.phase4?.realReceiptJwsDecodePreflightEnabled, true);
    assert.equal(health.phase4?.realReceiptJwsSignatureVerificationPreflightHarness, true);
    assert.equal(health.phase4?.realReceiptJwsSignatureVerificationPreflightEnabled, true);

    const pr = await issuePaidGatedChallenge(baseUrl);

    const redeem = await redeemEligiblePolicy(baseUrl, pr);
    assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
    assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
    assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
    assert.equal(redeem.json?.policyDecision?.allowed, true);
    assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

    const boundary = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
      headers: {
        "PAYMENT-SIGNATURE": paymentSignatureB64(pr.nonce),
      },
    });

    assert.equal(boundary.status, 402, `Phase 4 boundary skeleton must keep resource blocked: ${boundary.text}`);
    assert.equal(boundary.headers.get("payment-response"), null, "boundary must not emit PAYMENT-RESPONSE");
    assert.equal(boundary.json?.ok, false);
    assert.equal(boundary.json?.paid, false);
    assert.notEqual(boundary.json?.resource, "secret-data", "boundary must not release protected resource");

    const result = boundary.json?.phase4?.realCrpFulfillInvocationBoundary;
    assert.equal(result?.contract, "phase4.realCrpFulfillInvocationBoundary.v1");
    assert.equal(result?.required, true);
    assert.equal(result?.observed, true);
    assert.equal(result?.enabled, true);
    assert.equal(result?.status, "called");
    assert.equal(
      result?.reason,
      "phase4_real_crp_fulfill_invocation_boundary_receipt_observed_release_blocked",
    );
    assert.equal(result?.errorCode, null);
    assert.equal(result?.errorMessage, null);
    assert.equal(result?.target?.service, "crp");
    assert.equal(result?.target?.operation, "fulfill");
    assert.equal(result?.target?.path, "/v1/crp/payments/fulfill");
    assert.equal(result?.request?.merchantId, pr.merchantId);
    assert.equal(result?.request?.nonce, pr.nonce);
    assert.equal(result?.request?.network, pr.network);
    assert.equal(result?.request?.payTo, pr.payTo);
    assert.equal(result?.request?.amount, pr.amount);
    assert.equal(result?.request?.asset?.tokenId, pr.asset.tokenId);

    assert.equal(result?.safety?.crpFulfillInvocationAttempted, true);
    assert.equal(result?.safety?.externalCallAttempted, true);

    assert.equal(result?.safety?.crpCalled, true);
    assert.equal(result?.safety?.crpFulfillCalled, true);
    assert.equal(result?.receipt?.jwsPresent, true);
    assert.equal(result?.receipt?.jwsShapeValid, true);
    assert.equal(result?.receipt?.rawPrinted, false);

    const handoff = result?.realReceiptJwsHandoffContract;
    assert.equal(handoff?.contract, "phase4.realReceiptJwsHandoffContract.v1");
    assert.equal(handoff?.required, true);
    assert.equal(handoff?.observed, true);
    assert.equal(handoff?.enabled, true);
    assert.equal(handoff?.status, "observed");
    assert.equal(handoff?.source, "crp_fulfill");
    assert.equal(handoff?.handoffObjectPresent, true);
    assert.equal(handoff?.receiptJwsPresent, true);
    assert.equal(handoff?.receiptJwsShapeValid, true);
    assert.equal(handoff?.receiptJwsRawPrinted, false);
    assert.equal(handoff?.receiptJwsPrinted, false);
    assert.equal(handoff?.rawReceiptPrinted, false);
    assert.equal(handoff?.rawProofPrinted, false);
    assert.equal(handoff?.decoded, false);
    assert.equal(handoff?.verified, false);
    assert.equal(handoff?.releaseConsumable, false);
    assert.equal(handoff?.consumedByReleaseDecision, false);
    assert.equal(handoff?.releaseDecisionMutated, false);
    assert.equal(handoff?.productionRelease, false);
    assert.equal(handoff?.paymentResponseEmitted, false);
    assert.equal(handoff?.resourceReleased, false);
    assert.equal(handoff?.replayTouched, false);
    assert.equal(handoff?.canonicalReleasePersisted, false);
    assert.equal(handoff?.sideEffectFreeExceptCrpFulfillCall, true);

    const decodePreflight = result?.realReceiptJwsDecodePreflight;
    assert.equal(decodePreflight?.contract, "phase4.realReceiptJwsDecodePreflight.v1");
    assert.equal(decodePreflight?.required, true);
    assert.equal(decodePreflight?.observed, true);
    assert.equal(decodePreflight?.enabled, true);
    assert.equal(decodePreflight?.status, "decoded");
    assert.equal(decodePreflight?.source, "phase4.realReceiptJwsHandoffContract.v1");
    assert.equal(decodePreflight?.compactPartCount, 3);
    assert.equal(decodePreflight?.receiptJwsPresent, true);
    assert.equal(decodePreflight?.receiptJwsShapeValid, true);
    assert.equal(decodePreflight?.decodedHeaderJson, true);
    assert.equal(decodePreflight?.decodedPayloadJson, true);
    assert.equal(decodePreflight?.header?.alg, "EdDSA");
    assert.equal(decodePreflight?.header?.typ, "JWT");
    assert.equal(decodePreflight?.header?.kid, "phase4-test-only");
    assert.equal(decodePreflight?.header?.rawPrinted, false);
    assert.equal(decodePreflight?.payload?.receiptVersion, "phase4.synthetic.signature-verification-preflight.v1");
    assert.equal(decodePreflight?.payload?.testOnly, true);
    assert.equal(decodePreflight?.payload?.releaseConsumable, false);
    assert.equal(decodePreflight?.payload?.rawPrinted, false);
    assert.equal(decodePreflight?.errorCode, null);
    assert.equal(decodePreflight?.receiptJwsRawPrinted, false);
    assert.equal(decodePreflight?.receiptJwsPrinted, false);
    assert.equal(decodePreflight?.decodedHeaderRawPrinted, false);
    assert.equal(decodePreflight?.decodedPayloadRawPrinted, false);
    assert.equal(decodePreflight?.signatureVerified, false);
    assert.equal(decodePreflight?.verified, false);
    assert.equal(decodePreflight?.settlementVerified, false);
    assert.equal(decodePreflight?.tupleBindingVerified, false);
    assert.equal(decodePreflight?.releaseConsumable, false);
    assert.equal(decodePreflight?.consumedByReleaseDecision, false);
    assert.equal(decodePreflight?.releaseDecisionMutated, false);
    assert.equal(decodePreflight?.productionRelease, false);
    assert.equal(decodePreflight?.paymentResponseEmitted, false);
    assert.equal(decodePreflight?.resourceReleased, false);
    assert.equal(decodePreflight?.replayTouched, false);
    assert.equal(decodePreflight?.canonicalReleasePersisted, false);
    assert.equal(decodePreflight?.sideEffectFreeExceptCrpFulfillCall, true);

    const signaturePreflight = result?.realReceiptJwsSignatureVerificationPreflight;
    assert.equal(signaturePreflight?.contract, "phase4.realReceiptJwsSignatureVerificationPreflight.v1");
    assert.equal(signaturePreflight?.required, true);
    assert.equal(signaturePreflight?.observed, true);
    assert.equal(signaturePreflight?.enabled, true);
    assert.equal(signaturePreflight?.status, "verified");
    assert.equal(signaturePreflight?.source, "phase4.realReceiptJwsDecodePreflight.v1");
    assert.equal(signaturePreflight?.receiptJwsPresent, true);
    assert.equal(signaturePreflight?.receiptJwsShapeValid, true);
    assert.equal(signaturePreflight?.decodePreflightObserved, true);
    assert.equal(signaturePreflight?.decodePreflightStatus, "decoded");
    assert.equal(signaturePreflight?.header?.alg, "EdDSA");
    assert.equal(signaturePreflight?.header?.typ, "JWT");
    assert.equal(signaturePreflight?.header?.kid, RECEIPT_KID);
    assert.equal(signaturePreflight?.header?.rawPrinted, false);
    assert.equal(signaturePreflight?.payload?.receiptVersion, "phase4.synthetic.signature-verification-preflight.v1");
    assert.equal(signaturePreflight?.payload?.testOnly, true);
    assert.equal(signaturePreflight?.payload?.releaseConsumable, false);
    assert.equal(signaturePreflight?.payload?.rawPrinted, false);
    assert.equal(signaturePreflight?.errorCode, null);
    assert.equal(signaturePreflight?.receiptJwsRawPrinted, false);
    assert.equal(signaturePreflight?.receiptJwsPrinted, false);
    assert.equal(signaturePreflight?.verifiedHeaderRawPrinted, false);
    assert.equal(signaturePreflight?.verifiedPayloadRawPrinted, false);
    assert.equal(signaturePreflight?.signatureVerified, true);
    assert.equal(signaturePreflight?.verified, true);
    assert.equal(signaturePreflight?.jwksVerified, true);
    assert.equal(signaturePreflight?.settlementVerified, false);
    assert.equal(signaturePreflight?.tupleBindingVerified, false);
    assert.equal(signaturePreflight?.releaseConsumable, false);
    assert.equal(signaturePreflight?.consumedByReleaseDecision, false);
    assert.equal(signaturePreflight?.releaseDecisionMutated, false);
    assert.equal(signaturePreflight?.productionRelease, false);
    assert.equal(signaturePreflight?.paymentResponseEmitted, false);
    assert.equal(signaturePreflight?.resourceReleased, false);
    assert.equal(signaturePreflight?.replayTouched, false);
    assert.equal(signaturePreflight?.canonicalReleasePersisted, false);
    assert.equal(signaturePreflight?.sideEffectFreeExceptCrpFulfillCall, true);

    assert.equal(result?.safety?.receiptJwsPresent, true);
    assert.equal(result?.safety?.receiptJwsShapeValid, true);
    assert.equal(result?.safety?.receiptJwsRawPrinted, false);
    assert.equal(result?.safety?.rawProofPrinted, false);
    assert.equal(result?.safety?.rawReceiptPrinted, false);
    assert.equal(result?.safety?.productionRelease, false);
    assert.equal(result?.safety?.resourceReleased, false);
    assert.equal(result?.safety?.paymentResponseEmitted, false);
    assert.equal(result?.safety?.canonicalReleasePersisted, false);
    assert.equal(result?.safety?.replayTouched, false);
    assert.equal(result?.safety?.sideEffectFreeExceptCrpFulfillCall, true);

    const fulfillRequests = mockCrp.requests.filter((entry) => entry.path === "/v1/crp/payments/fulfill");
    assert.equal(fulfillRequests.length, 1, "mock CRP fulfill should be called exactly once");
    assert.equal(fulfillRequests[0]?.body?.merchantId, pr.merchantId);
    assert.equal(fulfillRequests[0]?.body?.nonce, pr.nonce);
    assert.equal(fulfillRequests[0]?.body?.network, pr.network);
    assert.equal(fulfillRequests[0]?.body?.payTo, pr.payTo);
    assert.equal(fulfillRequests[0]?.body?.amount, pr.amount);
    assert.equal(fulfillRequests[0]?.body?.asset?.tokenId, pr.asset.tokenId);

    console.log(
      JSON.stringify(
        {
          ok: true,
          label: LABEL,
          phase4BoundaryObserved: true,
          phase4BoundaryStatus: result?.status,
          phase4BoundaryReason: result?.reason,
          receiptJwsPresent: result?.receipt?.jwsPresent === true,
          receiptJwsShapeValid: result?.receipt?.jwsShapeValid === true,
          handoffObserved: result?.realReceiptJwsHandoffContract?.observed === true,
          handoffStatus: result?.realReceiptJwsHandoffContract?.status,
          decodePreflightObserved: result?.realReceiptJwsDecodePreflight?.observed === true,
          decodePreflightStatus: result?.realReceiptJwsDecodePreflight?.status,
          decodePreflightSignatureVerified:
            result?.realReceiptJwsDecodePreflight?.signatureVerified === true,
          decodePreflightReleaseConsumable:
            result?.realReceiptJwsDecodePreflight?.releaseConsumable === true,
          signatureVerificationObserved:
            result?.realReceiptJwsSignatureVerificationPreflight?.observed === true,
          signatureVerificationStatus:
            result?.realReceiptJwsSignatureVerificationPreflight?.status,
          signatureVerificationVerified:
            result?.realReceiptJwsSignatureVerificationPreflight?.signatureVerified === true,
          signatureVerificationReleaseConsumable:
            result?.realReceiptJwsSignatureVerificationPreflight?.releaseConsumable === true,
          paymentResponseEmitted: boundary.headers.get("payment-response") !== null,
          resourceReleased: boundary.json?.resource === "secret-data",
          crpFulfillCalled: result?.safety?.crpFulfillCalled === true,
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
