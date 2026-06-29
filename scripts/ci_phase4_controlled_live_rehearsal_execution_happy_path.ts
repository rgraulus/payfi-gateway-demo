#!/usr/bin/env node
/**
 * PR #280 — Phase 4 controlled live/testnet rehearsal execution happy path.
 *
 * This harness intentionally bridges from #279 preflight into a bounded
 * externally-running live/testnet rehearsal.
 *
 * Safe-by-default behavior:
 * - skipped unless PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH=true
 *
 * Modes:
 * - prepare: issue PAYMENT-REQUIRED and redeem the policy envelope only
 * - release: perform the planned controlled release attempt for a prepared nonce
 *
 * This harness does not:
 * - start Gateway
 * - start CRP/facilitator
 * - start orchestrator
 * - start wallet-proxy/Postgres/Concordium node
 * - enable production release
 * - print raw receipt JWS
 * - print raw PAYMENT-RESPONSE
 *
 * In release mode it may intentionally trigger the bounded rehearsal side effects:
 * - CRP fulfill via the externally running Gateway
 * - PAYMENT-RESPONSE emission
 * - protected resource release
 * - replay mutation
 * - canonical release persistence
 *
 * Those side effects require explicit operator acknowledgements.
 */

import assert from "node:assert/strict";
import process from "node:process";

const LABEL = "phase4:controlled-live-rehearsal-execution-happy-path-test";
const ENABLED = boolEnv("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH", false);
const MODE = env("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH_MODE");
const TIMEOUT_MS = Number(env("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_TIMEOUT_MS") || 15000);

type HttpResult = {
  status: number;
  headers: Headers;
  text: string;
  json: any;
};

type CheckResult = {
  name: string;
  required: boolean;
  ok: boolean;
  detail?: unknown;
  error?: string;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true" || raw === "1";
}

function env(name: string): string {
  return process.env[name] ?? "";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function safeUrl(value: string): string {
  return value.replace(/\/\/([^:@/]+):([^@/]+)@/g, "//***:***@");
}

function requireNonEmpty(name: string): string {
  const value = env(name);
  assert.ok(value.length > 0, `${name} is required`);
  return value;
}

function validateTrue(name: string): string {
  const value = requireNonEmpty(name).toLowerCase();
  assert.equal(value, "true", `${name} must be explicitly true`);
  return value;
}

function validateFalse(name: string): string {
  const value = requireNonEmpty(name).toLowerCase();
  assert.equal(value, "false", `${name} must be explicitly false`);
  return value;
}

function validateEnum(name: string, allowed: string[]): string {
  const value = requireNonEmpty(name);
  assert.ok(allowed.includes(value), `${name} must be one of: ${allowed.join(", ")}`);
  return value;
}

function validateUrl(name: string): string {
  const value = requireNonEmpty(name);
  const parsed = new URL(value);
  assert.ok(parsed.protocol === "http:" || parsed.protocol === "https:", `${name} must be http(s) URL`);
  assert.ok(parsed.hostname.length > 0, `${name} must include hostname`);
  return safeUrl(value);
}

function validateKid(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^[A-Za-z0-9._:-]+$/, `${name} contains unsupported characters`);
  return value;
}

function validateContractId(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^cid_[a-f0-9]{64}$/i, `${name} must look like cid_<64 hex chars>`);
  return value;
}

function validateNonEmptyPrintable(name: string): string {
  const value = requireNonEmpty(name);
  assert.ok(!/\s/.test(value), `${name} must not contain whitespace`);
  return value;
}

function validateResourcePath(name: string): string {
  const value = requireNonEmpty(name);
  assert.equal(value, "/paid-gated", `${name} must be preserved exactly as /paid-gated`);
  return value;
}

function validateAmount(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^(0|[1-9]\d*)(\.\d+)?$/, `${name} must be a positive decimal string`);
  assert.ok(Number(value) > 0, `${name} must be greater than zero`);
  return value;
}

function validateTxHash(name: string): string {
  const value = requireNonEmpty(name);
  assert.match(value, /^[a-f0-9]{64}$/i, `${name} must be a 64-character hex transaction hash`);
  return value;
}

function isGitBashLikeRuntime(): boolean {
  return env("MSYSTEM").length > 0 || env("MINGW_PREFIX").length > 0;
}

function b64decodeJson(value: string): any {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function paymentSignatureB64(payload: { nonce: string; txHash?: string; networkGenesisIndex?: number }): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function request(base: string, path: string, options: RequestInit = {}): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: any = null;

    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      status: res.status,
      headers: res.headers,
      text,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function check(name: string, required: boolean, fn: () => unknown | Promise<unknown>): Promise<CheckResult> {
  try {
    return {
      name,
      required,
      ok: true,
      detail: await fn(),
    };
  } catch (err: any) {
    return {
      name,
      required,
      ok: false,
      error: String(err?.message ?? err),
    };
  }
}

function gatewayBaseUrl(): string {
  return trimTrailingSlash(requireNonEmpty("GATEWAY_BASE_URL"));
}

function assertProductionFlagsDisabled(health: any) {
  assert.equal(health.phase3?.gatewayReleaseEnabled, false, "phase3.gatewayReleaseEnabled must be false");
  assert.equal(health.phase3?.gatewayTestReleaseOnly, false, "phase3.gatewayTestReleaseOnly must be false");
  assert.equal(
    health.phase3?.gatewayProductionReleaseEnabled,
    false,
    "phase3.gatewayProductionReleaseEnabled must be false",
  );

  if (Object.prototype.hasOwnProperty.call(health.phase3 ?? {}, "gatewayProductionReleaseDryRunEnabled")) {
    assert.equal(
      health.phase3?.gatewayProductionReleaseDryRunEnabled,
      false,
      "phase3.gatewayProductionReleaseDryRunEnabled must be false",
    );
  }
}

function assertPhase4ExecutionFlagsEnabled(health: any) {
  const phase4Names = [
    "realCrpFulfillInvocationBoundaryHarness",
    "realCrpFulfillInvocationBoundaryEnabled",
    "realReceiptJwsHandoffContractHarness",
    "realReceiptJwsHandoffContractEnabled",
    "realReceiptJwsDecodePreflightHarness",
    "realReceiptJwsDecodePreflightEnabled",
    "realReceiptJwsSignatureVerificationPreflightHarness",
    "realReceiptJwsSignatureVerificationPreflightEnabled",
    "realReceiptSettlementVerificationPreflightHarness",
    "realReceiptSettlementVerificationPreflightEnabled",
    "realReceiptTupleBindingVerificationPreflightHarness",
    "realReceiptTupleBindingVerificationPreflightEnabled",
    "realReceiptReleaseEligibilityCompositionPreflightHarness",
    "realReceiptReleaseEligibilityCompositionPreflightEnabled",
    "realReceiptReplayCanonicalPersistencePreflightHarness",
    "realReceiptReplayCanonicalPersistencePreflightEnabled",
    "realReceiptReleaseDecisionPreflightHarness",
    "realReceiptReleaseDecisionPreflightEnabled",
    "controlledRealReceiptReleaseExecutionHarness",
    "controlledRealReceiptReleaseExecutionEnabled",
  ];

  for (const name of phase4Names) {
    assert.equal(health.phase4?.[name], true, `phase4.${name} must be true for release mode`);
  }

  return Object.fromEntries(phase4Names.map((name) => [name, health.phase4?.[name]]));
}

async function getGatewayHealth(baseUrl: string): Promise<any> {
  const health = await request(baseUrl, "/healthz", {
    headers: { accept: "application/json" },
  });

  assert.ok(health.status >= 200 && health.status < 300, `gateway /healthz expected 2xx, got ${health.status}`);
  assert.equal(health.json?.ok, true, "gateway /healthz ok must be true");
  assertProductionFlagsDisabled(health.json);

  return health.json;
}

async function getGatewayReadyz(baseUrl: string): Promise<any> {
  const readyz = await request(baseUrl, "/readyz", {
    headers: { accept: "application/json" },
  });

  assert.ok(readyz.status >= 200 && readyz.status < 300, `gateway /readyz expected 2xx, got ${readyz.status}`);
  assert.equal(readyz.json?.ok, true, "gateway /readyz ok must be true");

  if (Object.prototype.hasOwnProperty.call(readyz.json ?? {}, "jwksOk")) {
    assert.equal(readyz.json?.jwksOk, true, "gateway /readyz jwksOk must be true when present");
  }

  return readyz.json;
}

async function fetchJwksKid(url: string, expectedKid: string): Promise<unknown> {
  const jwks = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const text = await jwks.text();
  const json = text.length > 0 ? JSON.parse(text) : null;

  assert.ok(jwks.status >= 200 && jwks.status < 300, `CRP JWKS expected 2xx, got ${jwks.status}`);
  assert.ok(Array.isArray(json?.keys), "CRP JWKS must expose keys array");

  const kids = json.keys.map((key: any) => key?.kid).filter(Boolean);
  assert.ok(kids.includes(expectedKid), `expected kid ${expectedKid} must be present in CRP JWKS`);

  return {
    keyCount: json.keys.length,
    kids,
    expectedKid,
  };
}

function buildChallengeFromPaymentRequired(pr: any): any {
  return {
    type: "xcf.x402.zkp.challenge",
    version: "1.0.0",
    x402Version: "x402-v2",

    merchantId: pr.merchantId,
    resource: {
      method: pr.resource.method,
      path: pr.resource.path,
    },
    contract: {
      contractId: pr.contractId,
      contractVersion: pr.contractVersion,
      isFrozen: pr.isFrozen,
    },

    network: pr.network,
    chain_id: pr.chain_id,
    caip2ChainId: null,

    asset: pr.asset,
    amount: pr.amount,
    amountMinor: String(Math.round(Number(pr.amount) * 10 ** Number(pr.asset.decimals))),
    payTo: pr.payTo,

    nonce: pr.nonce,
    issuedAt: pr.issuedAt,
    expiresAt: pr.expiresAt,

    policy: {
      policyId: "age-region-v1",
      policyVersion: "1.0.0",
      requirementsHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },

    businessTerms: {
      termsId: null,
      termsVersion: null,
      termsHash: null,
      termsUri: null,
      termsSchema: null,
    },

    buyer: null,
    agent: null,
  };
}

async function buildEligibleEnvelope(pr: any): Promise<any> {
  const challenge = buildChallengeFromPaymentRequired(pr);
  const challengeHash = await sha256Hex(stableStringify(challenge));

  return {
    type: "xcf.concordium.authorization.direct-buyer.v1",
    challenge,
    challengeHash,
    proofType: "concordium.VerifiablePresentation",
    presentation: {
      claims: {
        region: "EU",
        ageOver: 21,
      },
    },
    walletChallenge: challengeHash,
    wallet: {
      network: "concordium:testnet",
      selectedChain: "concordium:testnet",
      accountAddress: "ccd1qphase4liverehearsaldemo",
    },
    submittedAt: new Date().toISOString(),
  };
}

function assertPaymentRequiredTuple(pr: any) {
  const x402Version = pr.x402Version ?? pr.version;
  assert.equal(x402Version, "x402-v2", "PAYMENT-REQUIRED version/x402Version must be x402-v2");
  assert.equal(pr.resource?.method, env("PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD"));
  assert.equal(pr.resource?.path, env("PHASE4_LIVE_REHEARSAL_RESOURCE_PATH"));
  assert.equal(pr.contractId, env("PHASE4_LIVE_REHEARSAL_CONTRACT_ID"));
  assert.equal(pr.contractVersion, env("PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION"));
  assert.equal(pr.merchantId, env("PHASE4_LIVE_REHEARSAL_MERCHANT_ID"));
  assert.equal(pr.network, env("PHASE4_LIVE_REHEARSAL_NETWORK"));
  assert.equal(pr.chain_id, env("PHASE4_LIVE_REHEARSAL_CHAIN_ID"));
  assert.equal(pr.asset?.type, env("PHASE4_LIVE_REHEARSAL_ASSET_TYPE"));
  assert.equal(pr.asset?.tokenId, env("PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID"));
  assert.equal(String(pr.asset?.decimals), env("PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS"));
  assert.equal(String(pr.amount), env("PHASE4_LIVE_REHEARSAL_AMOUNT"));
  assert.equal(pr.payTo, env("PHASE4_LIVE_REHEARSAL_PAY_TO"));
  assert.ok(pr.nonce, "PAYMENT-REQUIRED nonce must be present");
}

async function issuePaymentRequired(baseUrl: string): Promise<any> {
  const resourcePath = validateResourcePath("PHASE4_LIVE_REHEARSAL_RESOURCE_PATH");
  const issue = await request(baseUrl, resourcePath, {
    headers: { accept: "application/json" },
  });

  assert.equal(issue.status, 402, `GET ${resourcePath} should issue 402 PAYMENT-REQUIRED`);
  assert.equal(issue.headers.get("payment-response"), null, "initial 402 must not emit PAYMENT-RESPONSE");

  const prB64 = issue.headers.get("payment-required");
  assert.ok(prB64, "PAYMENT-REQUIRED header must be present");

  const pr = b64decodeJson(prB64);
  assertPaymentRequiredTuple(pr);

  return pr;
}

async function redeemPolicy(baseUrl: string, pr: any): Promise<HttpResult> {
  const envelope = await buildEligibleEnvelope(pr);

  return await request(baseUrl, "/paid-gated/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: pr.nonce,
      authorizationProof: envelope,
    }),
  });
}

async function releaseAttempt(baseUrl: string, nonce: string): Promise<HttpResult> {
  const txHash = validateTxHash("PHASE4_LIVE_REHEARSAL_TX_HASH");
  const networkGenesisIndex = Number(validateEnum("PHASE4_LIVE_REHEARSAL_NETWORK_GENESIS_INDEX", ["7"]));

  return await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(nonce)}`, {
    headers: {
      "PAYMENT-SIGNATURE": paymentSignatureB64({
        nonce,
        txHash,
        networkGenesisIndex,
      }),
    },
  });
}

function executionFromReleaseJson(json: any): any {
  return (
    json?.phase4?.controlledRealReceiptReleaseExecution ??
    json?.phase4?.realCrpFulfillInvocationBoundary?.controlledRealReceiptReleaseExecution ??
    null
  );
}

function paymentResponseSummary(headerValue: string | null): unknown {
  if (!headerValue) return null;

  try {
    const decoded = b64decodeJson(headerValue);
    return {
      present: true,
      version: decoded?.version ?? null,
      contractId: decoded?.contractId ?? null,
      contractVersion: decoded?.contractVersion ?? null,
      merchantId: decoded?.merchantId ?? null,
      nonce: decoded?.nonce ?? null,
      settled: decoded?.settled ?? null,
      resource: decoded?.resource ?? null,
      receipt: {
        jwsPresent: typeof decoded?.receipt?.jws === "string" && decoded.receipt.jws.length > 0,
        payloadPresent: typeof decoded?.receipt?.payload === "object" && decoded.receipt.payload !== null,
        receiptVersion: decoded?.receipt?.payload?.receiptVersion ?? null,
        settlementStatus: decoded?.receipt?.payload?.settlement?.status ?? null,
        txHashPresent: typeof decoded?.receipt?.payload?.settlement?.txHash === "string",
        kid: decoded?.receipt?.header?.kid ?? null,
      },
    };
  } catch {
    return {
      present: true,
      decodeFailed: true,
    };
  }
}

async function validateCommonInputs(mode: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  results.push(await check("mode", true, () =>
    validateEnum("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH_MODE", ["prepare", "release"]),
  ));
  results.push(await check("runbook acknowledged", true, () => validateTrue("PHASE4_LIVE_REHEARSAL_RUNBOOK_ACK")));
  results.push(await check("#276 live stack readiness confirmed", true, () =>
    validateTrue("PHASE4_LIVE_STACK_READINESS_CONFIRMED"),
  ));
  results.push(await check("#277 input contract confirmed", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_INPUT_CONTRACT_CONFIRMED"),
  ));
  results.push(await check("#279 execution preflight confirmed", true, () =>
    validateTrue("PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_PREFLIGHT_CONFIRMED"),
  ));
  results.push(await check("rollback acknowledged", true, () => validateTrue("PHASE4_LIVE_REHEARSAL_ROLLBACK_ACK")));
  results.push(await check("stop conditions acknowledged", true, () =>
    validateTrue("PHASE4_LIVE_REHEARSAL_STOP_CONDITIONS_ACK"),
  ));

  results.push(await check("gateway base url", true, () => validateUrl("GATEWAY_BASE_URL")));
  results.push(await check("crp base url", true, () => validateUrl("CRP_BASE_URL")));
  results.push(await check("crp jwks url", true, () => validateUrl("CRP_JWKS_URL")));
  results.push(await check("expected kid", true, () =>
    env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID") || validateKid("X402_EXPECTED_KID"),
  ));

  if (env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID")) {
    results.push(await check("phase4 expected kid shape", true, () =>
      validateKid("PHASE4_LIVE_REHEARSAL_EXPECTED_KID"),
    ));
  }

  const productionFlags = [
    "PHASE3_GATEWAY_RELEASE_ENABLED",
    "PHASE3_GATEWAY_TEST_RELEASE_ONLY",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_ENABLED",
    "PHASE3_GATEWAY_PRODUCTION_RELEASE_DRY_RUN_ENABLED",
  ];

  for (const name of productionFlags) {
    results.push(await check(`production flag disabled: ${name}`, true, () => validateFalse(name)));
  }

  results.push(await check("resource method", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_RESOURCE_METHOD", ["GET"]),
  ));
  results.push(await check("resource path preserved", true, () => validateResourcePath("PHASE4_LIVE_REHEARSAL_RESOURCE_PATH")));

  const gitBashLikeRuntime = isGitBashLikeRuntime();
  results.push(await check("git bash path conversion disabled", gitBashLikeRuntime, () => {
    if (!gitBashLikeRuntime) {
      return { detected: false, requirement: "not_applicable" };
    }

    assert.equal(
      env("MSYS_NO_PATHCONV"),
      "1",
      "MSYS_NO_PATHCONV=1 is required under Git Bash/MSYS to preserve /paid-gated",
    );

    return {
      detected: true,
      MSYSTEM: env("MSYSTEM") || null,
      MSYS_NO_PATHCONV: env("MSYS_NO_PATHCONV"),
    };
  }));

  results.push(await check("contract id", true, () => validateContractId("PHASE4_LIVE_REHEARSAL_CONTRACT_ID")));
  results.push(await check("contract version", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_CONTRACT_VERSION", ["1.0.0"]),
  ));
  results.push(await check("merchant id", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_MERCHANT_ID", ["demo-merchant"]),
  ));
  results.push(await check("network", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_NETWORK", ["concordium:testnet"]),
  ));
  results.push(await check("network genesis index", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_NETWORK_GENESIS_INDEX", ["7"]),
  ));
  results.push(await check("chain id", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_CHAIN_ID")));
  results.push(await check("asset type", true, () => validateEnum("PHASE4_LIVE_REHEARSAL_ASSET_TYPE", ["PLT"])));
  results.push(await check("asset token id", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_ASSET_TOKEN_ID", ["EUDemo"]),
  ));
  results.push(await check("asset decimals", true, () =>
    validateEnum("PHASE4_LIVE_REHEARSAL_ASSET_DECIMALS", ["6"]),
  ));
  results.push(await check("amount", true, () => validateAmount("PHASE4_LIVE_REHEARSAL_AMOUNT")));
  results.push(await check("payTo", true, () => validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_PAY_TO")));
  results.push(await check("replay backend", true, () => validateEnum("X402_REPLAY_BACKEND", ["memory", "redis"])));

  if (env("X402_REPLAY_BACKEND") === "redis") {
    results.push(await check("redis replay url configured", true, () => {
      const value = env("X402_REDIS_URL") || env("REDIS_URL");
      assert.ok(value.length > 0, "X402_REDIS_URL or REDIS_URL is required when X402_REPLAY_BACKEND=redis");
      const parsed = new URL(value);
      assert.equal(parsed.protocol, "redis:", "redis replay URL must use redis://");
      return { configured: true };
    }));
  }

  if (mode === "release") {
    results.push(await check("operator allows CRP fulfill", true, () =>
      validateTrue("PHASE4_LIVE_REHEARSAL_ALLOW_CRP_FULFILL"),
    ));
    results.push(await check("operator allows planned release", true, () =>
      validateTrue("PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_RELEASE"),
    ));
    results.push(await check("operator allows replay/canonical mutation", true, () =>
      validateTrue("PHASE4_LIVE_REHEARSAL_ALLOW_PLANNED_REPLAY_CANONICAL_MUTATION"),
    ));
    results.push(await check("prepared nonce", true, () =>
      validateNonEmptyPrintable("PHASE4_LIVE_REHEARSAL_PREPARED_NONCE"),
    ));
    results.push(await check("controlled tx hash", true, () =>
      validateTxHash("PHASE4_LIVE_REHEARSAL_TX_HASH"),
    ));
  }

  return results;
}

function failIfRequired(results: CheckResult[]) {
  const requiredFailures = results.filter((result) => result.required && !result.ok);
  assert.equal(
    requiredFailures.length,
    0,
    `required controlled live rehearsal happy-path checks failed: ${JSON.stringify(requiredFailures)}`,
  );
}

async function runPrepare(baseUrl: string, health: any, readyz: any) {
  const pr = await issuePaymentRequired(baseUrl);

  const redeem = await redeemPolicy(baseUrl, pr);
  assert.equal(redeem.status, 200, `eligible policy redeem should succeed: ${redeem.text}`);
  assert.equal(redeem.headers.get("payment-response"), null, "policy redeem must not emit PAYMENT-RESPONSE");
  assert.equal(redeem.json?.policyStatus, "POLICY_SATISFIED");
  assert.equal(redeem.json?.policyDecision?.allowed, true);
  assert.equal(redeem.json?.policyDecision?.rawProofPrinted, false);

  const noRelease = await request(baseUrl, `/paid-gated?nonce=${encodeURIComponent(pr.nonce)}`, {
    headers: { accept: "application/json" },
  });
  assert.equal(noRelease.status, 402, "prepare mode must still require payment/release signal");
  assert.equal(noRelease.headers.get("payment-response"), null, "prepare mode must not emit PAYMENT-RESPONSE");
  assert.notEqual(noRelease.json?.resource, "secret-data", "prepare mode must not release protected resource");

  return {
    ok: true,
    label: LABEL,
    contract: "phase4.controlledLiveRehearsalExecutionHappyPath.v1",
    mode: "prepare",
    gateway: {
      baseUrl: safeUrl(baseUrl),
      healthOk: health.ok === true,
      readyzOk: readyz.ok === true,
      jwksOk: readyz.jwksOk ?? null,
    },
    paymentRequired: {
      nonce: pr.nonce,
      x402Version: pr.x402Version ?? pr.version ?? null,
      contractId: pr.contractId,
      contractVersion: pr.contractVersion,
      merchantId: pr.merchantId,
      network: pr.network,
      chainId: pr.chain_id,
      resource: pr.resource,
      asset: pr.asset,
      amount: pr.amount,
      payTo: pr.payTo,
    },
    policyRedeem: {
      status: redeem.status,
      policyStatus: redeem.json?.policyStatus ?? null,
      allowed: redeem.json?.policyDecision?.allowed === true,
      paymentResponseEmitted: redeem.headers.get("payment-response") !== null,
      rawProofPrinted: redeem.json?.policyDecision?.rawProofPrinted === true,
    },
    safety: {
      crpFulfillCalled: false,
      paymentAttemptedByHarness: false,
      paymentResponseEmitted: false,
      protectedResourceReleased: false,
      replayTouched: false,
      canonicalReleasePersisted: false,
      productionReleaseEnabled: false,
      rawReceiptPrinted: false,
      rawPaymentResponsePrinted: false,
    },
    operatorNextStep:
      "Perform the controlled testnet payment/settlement for this nonce outside the harness, then rerun in release mode with PHASE4_LIVE_REHEARSAL_PREPARED_NONCE set.",
  };
}

async function runRelease(baseUrl: string, health: any, readyz: any) {
  const phase4Flags = assertPhase4ExecutionFlagsEnabled(health);
  const nonce = requireNonEmpty("PHASE4_LIVE_REHEARSAL_PREPARED_NONCE");

  const release = await releaseAttempt(baseUrl, nonce);

  assert.equal(release.status, 200, `planned release must return 200: ${release.text}`);
  assert.equal(release.headers.get("payment-required"), null, "planned release must not emit PAYMENT-REQUIRED");
  assert.ok(release.headers.get("payment-response"), "planned release must emit PAYMENT-RESPONSE");
  assert.equal(release.json?.ok, true);
  assert.equal(release.json?.paid, true);
  assert.equal(release.json?.nonce, nonce);
  assert.equal(release.json?.resource, "secret-data");

  const execution = executionFromReleaseJson(release.json);
  assert.ok(execution, "controlled execution diagnostics must be present");
  assert.equal(execution?.contract, "phase4.controlledRealReceiptReleaseExecutionHarness.v1");
  assert.equal(execution?.status, "released");
  assert.equal(execution?.required, true);
  assert.equal(execution?.observed, true);
  assert.equal(execution?.enabled, true);
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

  const replay = await releaseAttempt(baseUrl, nonce);

  assert.equal(replay.status, 402, `second use must be blocked: ${replay.text}`);
  assert.equal(replay.headers.get("payment-response"), null, "second use must not emit PAYMENT-RESPONSE");
  assert.notEqual(replay.json?.resource, "secret-data", "second use must not release protected resource");
  assert.notEqual(replay.json?.paid, true, "second use must not report paid=true");

  return {
    ok: true,
    label: LABEL,
    contract: "phase4.controlledLiveRehearsalExecutionHappyPath.v1",
    mode: "release",
    gateway: {
      baseUrl: safeUrl(baseUrl),
      healthOk: health.ok === true,
      readyzOk: readyz.ok === true,
      jwksOk: readyz.jwksOk ?? null,
    },
    phase4Flags,
    plannedSideEffects: {
      crpFulfillMayBeCalledByGateway: true,
      paymentResponseEmitted: true,
      protectedResourceReleased: true,
      replayTouched: true,
      canonicalReleasePersisted: true,
      productionReleaseEnabled: false,
    },
    firstUse: {
      status: release.status,
      nonce,
      paid: release.json?.paid === true,
      resourceReleased: release.json?.resource === "secret-data",
      paymentResponseEmitted: release.headers.get("payment-response") !== null,
      paymentResponse: paymentResponseSummary(release.headers.get("payment-response")),
      executionStatus: execution?.status,
      releaseDecisionReady: execution?.releaseDecisionReady === true,
      releaseDecisionMutated: execution?.releaseDecisionMutated === true,
      replayTouched: execution?.replayTouched === true,
      canonicalReleasePersisted: execution?.canonicalReleasePersisted === true,
      productionRelease: execution?.productionRelease === true,
      productionReleaseAuthorized: execution?.productionReleaseAuthorized === true,
    },
    secondUse: {
      status: replay.status,
      blocked: replay.status === 402,
      paymentResponseEmitted: replay.headers.get("payment-response") !== null,
      resourceReleased: replay.json?.resource === "secret-data",
      challengeStatus: replay.json?.debug?.challengeStatus ?? null,
      releaseStatus: replay.json?.debug?.releaseStatus ?? null,
      reason: replay.json?.debug?.reason ?? replay.json?.error ?? null,
    },
    safety: {
      rawReceiptPrinted: false,
      rawPaymentResponsePrinted: false,
      productionReleaseEnabled: false,
    },
    nextFiniteRung: "#281 consolidated live rehearsal fail-closed evidence",
  };
}

async function main() {
  console.log(`[${LABEL}] enabled=${ENABLED}`);

  if (!ENABLED) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason:
            "set PHASE4_CONTROLLED_LIVE_REHEARSAL_EXECUTION_HAPPY_PATH=true to run the controlled live rehearsal happy path harness",
          safety: {
            externallyRunningStackRequired: true,
            startsServices: false,
            crpFulfillCalled: false,
            paymentAttemptedByHarness: false,
            paymentResponseEmitted: false,
            protectedResourceReleased: false,
            replayTouched: false,
            canonicalReleasePersisted: false,
            productionReleaseEnabled: false,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const mode = MODE;
  const commonResults = await validateCommonInputs(mode);
  failIfRequired(commonResults);

  const baseUrl = gatewayBaseUrl();
  const expectedKid = env("PHASE4_LIVE_REHEARSAL_EXPECTED_KID") || env("X402_EXPECTED_KID");

  const runtimeResults: CheckResult[] = [];
  let health: any = null;
  let readyz: any = null;

  runtimeResults.push(await check("gateway health", true, async () => {
    health = await getGatewayHealth(baseUrl);
    return {
      ok: health.ok === true,
      productionFlags: {
        gatewayReleaseEnabled: health.phase3?.gatewayReleaseEnabled,
        gatewayTestReleaseOnly: health.phase3?.gatewayTestReleaseOnly,
        gatewayProductionReleaseEnabled: health.phase3?.gatewayProductionReleaseEnabled,
        gatewayProductionReleaseDryRunEnabled: health.phase3?.gatewayProductionReleaseDryRunEnabled ?? null,
      },
      phase4: {
        controlledRealReceiptReleaseExecutionHarness:
          health.phase4?.controlledRealReceiptReleaseExecutionHarness ?? null,
        controlledRealReceiptReleaseExecutionEnabled:
          health.phase4?.controlledRealReceiptReleaseExecutionEnabled ?? null,
      },
    };
  }));

  runtimeResults.push(await check("gateway readyz", true, async () => {
    readyz = await getGatewayReadyz(baseUrl);
    return {
      ok: readyz.ok === true,
      jwksOk: readyz.jwksOk ?? null,
    };
  }));

  runtimeResults.push(await check("crp jwks expected kid", true, async () =>
    await fetchJwksKid(requireNonEmpty("CRP_JWKS_URL"), expectedKid),
  ));

  failIfRequired(runtimeResults);

  const result =
    mode === "prepare"
      ? await runPrepare(baseUrl, health, readyz)
      : await runRelease(baseUrl, health, readyz);

  console.log(
    JSON.stringify(
      {
        ...result,
        prerequisiteChecks: commonResults,
        runtimeChecks: runtimeResults,
      },
      null,
      2,
    ),
  );
}

main().catch((err: any) => {
  console.error(`[${LABEL}] failed`);
  console.error(err?.stack ?? err);
  process.exit(1);
});
