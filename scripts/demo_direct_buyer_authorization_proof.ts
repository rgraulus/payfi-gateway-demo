#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  buildChallengeFromPaymentRequired,
  hashChallenge,
} from "./phase3GatewayHarnessUtils";
import {
  normalizeWalletProofCapture,
} from "./phase3-wallet-proof-capture-harness";

type Args = {
  paymentRequiredPath?: string;
  proofPath?: string;
  outPath?: string;
  region?: string;
  ageOver?: number;
  help?: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  ts-node --transpile-only scripts/demo_direct_buyer_authorization_proof.ts \\",
    "    --payment-required <gated-pr.json> \\",
    "    --proof <direct-buyer-proof.json> \\",
    "    --out <direct-buyer-auth.json> \\",
    "    --region <EU|US> \\",
    "    --age-over <number>",
    "",
    "This helper writes a /paid-gated/redeem request body containing a",
    "Direct Buyer authorizationProof bound to the runtime PAYMENT-REQUIRED challenge.",
    "",
    "Safety:",
    "  - does not print the raw proof",
    "  - does not call Gateway",
    "  - does not call CRP",
    "  - does not attempt payment",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    const next = argv[i + 1];

    switch (arg) {
      case "--payment-required":
        args.paymentRequiredPath = next;
        i += 1;
        break;
      case "--proof":
        args.proofPath = next;
        i += 1;
        break;
      case "--out":
        args.outPath = next;
        i += 1;
        break;
      case "--region":
        args.region = String(next || "").toUpperCase();
        i += 1;
        break;
      case "--age-over":
        args.ageOver = Number(next);
        i += 1;
        break;
      default:
        throw new Error(`unsupported argument: ${arg}`);
    }
  }

  return args;
}

function requireNonEmpty(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requireWholeNumber(value: number | undefined, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative whole number`);
  }
  return Number(value);
}

function readJsonFile(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safePresentationObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function buildAuthorizationProof(args: {
  capturedAuthorizationProof: any;
  runtimeChallenge: any;
  region: string;
  ageOver: number;
}): any {
  const runtimeChallengeHash = hashChallenge(args.runtimeChallenge);
  const capturedPresentation = safePresentationObject(args.capturedAuthorizationProof.presentation);

  return {
    ...args.capturedAuthorizationProof,
    challenge: args.runtimeChallenge,
    challengeHash: runtimeChallengeHash,
    presentation: {
      ...capturedPresentation,
      claims: {
        region: args.region,
        ageOver: args.ageOver,
      },
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  const paymentRequiredPath = requireNonEmpty(args.paymentRequiredPath, "--payment-required");
  const proofPath = requireNonEmpty(args.proofPath, "--proof");
  const outPath = requireNonEmpty(args.outPath, "--out");
  const region = requireNonEmpty(args.region, "--region").toUpperCase();
  const ageOver = requireWholeNumber(args.ageOver, "--age-over");

  if (region !== "EU" && region !== "US") {
    throw new Error("--region must be EU or US");
  }

  if (!fs.existsSync(paymentRequiredPath)) {
    throw new Error(`PAYMENT-REQUIRED file not found: ${paymentRequiredPath}`);
  }

  if (!fs.existsSync(proofPath)) {
    throw new Error(`Direct Buyer proof file not found: ${proofPath}`);
  }

  const pr = readJsonFile(paymentRequiredPath);
  const rawProof = readJsonFile(proofPath);
  const capturedAuthorizationProof = normalizeWalletProofCapture(rawProof);

  const runtimeChallenge = buildChallengeFromPaymentRequired(pr);
  const authorizationProof = buildAuthorizationProof({
    capturedAuthorizationProof,
    runtimeChallenge,
    region,
    ageOver,
  });

  const body = {
    nonce: pr.nonce,
    authorizationProof,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");

  const summary = {
    ok: true,
    helper: "demo.directBuyerAuthorizationProof.v1",
    outPath,
    nonce: typeof pr.nonce === "string" ? pr.nonce : null,
    region,
    ageOver,
    authorizationProofType:
      typeof authorizationProof.type === "string" ? authorizationProof.type : null,
    proofType:
      typeof authorizationProof.proofType === "string" ? authorizationProof.proofType : null,
    challengeHashPresent:
      typeof authorizationProof.challengeHash === "string" &&
      authorizationProof.challengeHash.length > 0,
    challengeHashLength:
      typeof authorizationProof.challengeHash === "string"
        ? authorizationProof.challengeHash.length
        : 0,
    rawProofPrinted: false,
    gatewayCalled: false,
    crpCalled: false,
    paymentAttempted: false,
  };

  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (err: any) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        helper: "demo.directBuyerAuthorizationProof.v1",
        reason: String(err?.message ?? err),
        rawProofPrinted: false,
        gatewayCalled: false,
        crpCalled: false,
        paymentAttempted: false,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
