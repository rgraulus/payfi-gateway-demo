#!/usr/bin/env ts-node
/**
 * Phase 3 proof shape checker.
 *
 * Safety-first skeleton for local Buyer Wallet proof verification work.
 *
 * This script does NOT perform live Concordium verification.
 * It does NOT call gRPC.
 * It does NOT print raw proof material.
 * It only checks that a local, uncommitted proof JSON file can be parsed
 * and classified into the expected artifact family.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, normalize } from "node:path";

type Args = Record<string, string | boolean>;

type ArtifactFamily =
  | "phase3_harness_capture_wrapper"
  | "verifiable_presentation"
  | "verifiable_presentation_v1"
  | "sanitized_sample_refused"
  | "unknown";

function usage(exitCode = 0): never {
  const msg = `
Usage:
  PHASE3_BUYER_PROOF_PATH=/private/local/buyer-proof.raw.json ts-node scripts/phase3-proof-shape-check.ts

Or:
  ts-node scripts/phase3-proof-shape-check.ts --proof /private/local/buyer-proof.raw.json

Purpose:
  Parse and classify a local Buyer Wallet proof artifact without printing raw proof material.

Safety:
  - Raw wallet proof material must not be committed.
  - This script refuses the repo sanitized fixture.
  - This script prints safe shape metadata only.
  - This script does not perform live gRPC verification.
  - This script does not modify Gateway, CRP, or policy verifier behavior.
`;
  console.error(msg.trim() + "\n");
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;

    const key = a.slice(2);
    if (key === "help") {
      out.help = true;
      continue;
    }

    const v = argv[i + 1];
    if (!v || v.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = v;
      i++;
    }
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function safeKeys(value: unknown): string[] {
  return Object.keys(asRecord(value) ?? {}).sort();
}

function isRepoSanitizedFixture(absPath: string): boolean {
  const rel = normalize(relative(process.cwd(), absPath)).replace(/\\/g, "/");
  return (
    rel === "fixtures/concordium-zkp/phase3-buyer-proof.sample.json" ||
    rel.endsWith("/fixtures/concordium-zkp/phase3-buyer-proof.sample.json")
  );
}

function classifyArtifact(json: unknown): ArtifactFamily {
  const root = asRecord(json);
  if (!root) return "unknown";

  if (
    root.type === "phase3_buyer_wallet_proof_sample" ||
    root.sanitized === true ||
    root.doNotUseForVerification === true
  ) {
    return "sanitized_sample_refused";
  }

  if (
    root.type === "phase3b_browser_wallet_presentation_capture" &&
    asRecord(root.presentation)
  ) {
    return "phase3_harness_capture_wrapper";
  }

  const type = root.type;

  if (
    Array.isArray(type) &&
    type.includes("VerifiablePresentation") &&
    type.includes("ConcordiumVerifiablePresentationV1")
  ) {
    return "verifiable_presentation_v1";
  }

  if (
    typeof root.presentationContext === "string" &&
    asRecord(root.proof) &&
    Array.isArray(root.verifiableCredential)
  ) {
    return "verifiable_presentation";
  }

  return "unknown";
}

function buildSafeSummary(json: unknown, family: ArtifactFamily, proofPath: string) {
  const root = asRecord(json) ?? {};
  const presentation = asRecord(root.presentation);

  const inspected =
    family === "phase3_harness_capture_wrapper" && presentation
      ? presentation
      : root;

  return {
    ok: family !== "sanitized_sample_refused" && family !== "unknown",
    family,
    proofPath,
    rootKeys: safeKeys(root),
    presentationKeys:
      family === "phase3_harness_capture_wrapper"
        ? safeKeys(presentation)
        : safeKeys(root),
    hasProofObject: Boolean(asRecord(inspected.proof)),
    hasPresentationContext: typeof inspected.presentationContext === "string",
    hasVerifiableCredentialArray: Array.isArray(inspected.verifiableCredential),
    statementCount: Array.isArray(root.statements) ? root.statements.length : null,
    selectedChainPresent: typeof root.selectedChain === "string",
    challengePresent:
      typeof root.challenge === "string" ||
      typeof inspected.presentationContext === "string",
    rawProofPrinted: false,
    liveVerificationAttempted: false,
    nextStep:
      "When Concordium Testnet/gRPC is healthy, extend a follow-up script to fetch public data and call verifyPresentation(...).",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const proofArg =
    typeof args.proof === "string" ? args.proof : process.env.PHASE3_BUYER_PROOF_PATH;

  if (!proofArg) {
    console.error("ERROR: missing --proof or PHASE3_BUYER_PROOF_PATH");
    usage(2);
  }

  const proofPath = resolve(proofArg);

  if (!existsSync(proofPath)) {
    console.error(`ERROR: proof file not found: ${proofPath}`);
    process.exit(2);
  }

  if (isRepoSanitizedFixture(proofPath)) {
    console.error(
      "ERROR: refusing to inspect repo sanitized fixture. Provide a local uncommitted raw proof file path instead."
    );
    process.exit(2);
  }

  const raw = readFileSync(proofPath, "utf8");
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: invalid JSON: ${String((err as any)?.message ?? err)}`);
    process.exit(2);
  }

  const family = classifyArtifact(json);

  if (family === "sanitized_sample_refused") {
    console.error(
      "ERROR: refusing sanitized sample-like payload. Provide a local uncommitted raw proof file path instead."
    );
    process.exit(2);
  }

  const summary = buildSafeSummary(json, family, proofPath);

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (family === "unknown") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`ERROR: ${String((err as any)?.message ?? err)}`);
  process.exit(1);
});
