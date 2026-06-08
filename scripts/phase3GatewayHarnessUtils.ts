import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = process.cwd();
const isWin = process.platform === "win32";

export const DEFAULT_PHASE3_HARNESS_DATABASE_URL =
  "postgres://postgres:pg@localhost:5432/transaction-outcome";

export function phase3HarnessDatabaseUrl(): string {
  return (
    process.env.PHASE3_HARNESS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    DEFAULT_PHASE3_HARNESS_DATABASE_URL
  );
}

export type Phase3GatewayHarnessConfig = {
  port: number;
  label: string;
};

export type HttpResult = {
  status: number;
  headers: Headers;
  text: string;
  json: any;
};

function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

export function baseUrlForPort(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function hashChallenge(challenge: any): string {
  return createHash("sha256").update(stableStringify(challenge), "utf8").digest("hex");
}

export function b64decodeJson(value: string): any {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

export function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.end();
      resolve(true);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

export async function request(base: string, path: string, options: RequestInit = {}): Promise<HttpResult> {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
  };
}

export async function waitForReady(base: string, timeoutMs = 15_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await request(base, "/healthz");
      if (res.status === 200 && res.json?.ok === true) return res.json;
    } catch {
      // Gateway is still starting.
    }

    await sleep(150);
  }

  throw new Error(`gateway did not become ready at ${base}/healthz`);
}

export function killProcessTree(child: ChildProcess | null | undefined): Promise<void> {
  if (!child || !child.pid) return Promise.resolve();

  if (isWin) {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });

      killer.on("error", () => resolve());
      killer.on("exit", () => resolve());
    });
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }

  return Promise.resolve();
}

export async function waitForPortClosed(port: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return;
    await sleep(100);
  }
}

export function startGateway(config: Phase3GatewayHarnessConfig): ChildProcess {
  const env = {
    ...process.env,

    HOST: "127.0.0.1",
    PORT: String(config.port),

    PHASE3_GATEWAY_POLICY_GATE_ENABLED: "true",
    PHASE3_ALLOW_PARSED_ONLY_POLICY: "true",
    PHASE3_REQUIRE_LIVE_ZKP: "false",

    DATABASE_URL: phase3HarnessDatabaseUrl(),
    ORCHESTRATOR_BASE_URL: process.env.ORCHESTRATOR_BASE_URL || "http://localhost:8090",
    ORCHESTRATOR_API_KEY: process.env.ORCHESTRATOR_API_KEY || "dev-internal-key",
    CRP_BASE_URL: process.env.CRP_BASE_URL || "http://127.0.0.1:8080",
    X402_TTL_SEC: process.env.X402_TTL_SEC || "1800",

    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const child = spawn(npmCmd(), ["run", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
    ...(isWin ? { shell: true } : {}),
  });

  child.on("error", (err) => {
    console.error(`[${config.label}] gateway spawn error:`, err);
  });

  return child;
}

export function buildChallengeFromPaymentRequired(pr: any): any {
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

export function buildEligibleEnvelope(pr: any): any {
  const challenge = buildChallengeFromPaymentRequired(pr);
  const challengeHash = hashChallenge(challenge);

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
      accountAddress: "ccd1qphase3directbuyerdemo",
    },
    submittedAt: new Date().toISOString(),
  };
}

export async function issuePaidGatedChallenge(base: string): Promise<any> {
  const res = await request(base, "/paid-gated");

  assert.equal(res.status, 402, "GET /paid-gated should issue 402");
  assert.equal(res.headers.get("payment-response"), null, "initial 402 must not emit PAYMENT-RESPONSE");

  const prB64 = res.headers.get("payment-required");
  assert.ok(prB64, "PAYMENT-REQUIRED header must be present");

  const pr = b64decodeJson(prB64);
  assert.equal(pr.resource?.path, "/paid-gated");
  assert.equal(pr.policyRequirements?.required, true);
  assert.ok(pr.nonce, "PAYMENT-REQUIRED must include nonce");

  return pr;
}

export function redeemEligiblePolicy(base: string, pr: any): Promise<HttpResult> {
  const envelope = buildEligibleEnvelope(pr);

  return request(base, "/paid-gated/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nonce: pr.nonce,
      authorizationProof: envelope,
    }),
  });
}

export async function assertStillNoRelease(base: string, nonce: string, message: string): Promise<HttpResult> {
  const stillNoRelease = await request(base, `/paid-gated?nonce=${encodeURIComponent(nonce)}`);

  assert.equal(stillNoRelease.status, 402, message);
  assert.ok(stillNoRelease.headers.get("payment-required"), "resource must still require PAYMENT-REQUIRED");
  assert.equal(stillNoRelease.headers.get("payment-response"), null, "decision-only test must not emit PAYMENT-RESPONSE");

  return stillNoRelease;
}

export function installSignalCleanup(cleanup: () => Promise<void>): void {
  process.on("SIGINT", () => {
    void cleanup().finally(() => process.exit(1));
  });

  process.on("SIGTERM", () => {
    void cleanup().finally(() => process.exit(1));
  });
}
